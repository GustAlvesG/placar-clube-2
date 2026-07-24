const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const logic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const videoDir = path.join(__dirname, 'public', 'videos');
const patrocinadorDir = path.join(__dirname, 'public', 'patrocinadores');
const slideDir = path.join(__dirname, 'public', 'slides');
for (const dir of [videoDir, patrocinadorDir, slideDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let gameState = logic.criarEstadoInicial();

function broadcast() {
    io.emit('atualizar_tela', { ...gameState, serverTime: Date.now() });
}

// ---- Upload/exclusão de arquivos (vídeos e logos de patrocinadores) ----
// Os patrocinadores do carrossel são os arquivos de imagem em
// public/patrocinadores/; o estado guarda a lista de nomes e é rebroadcast
// a cada mudança para que todos os telões atualizem sozinhos.
const TIPOS_ARQUIVO = {
    video: { dir: videoDir, extensoes: logic.EXTENSOES_VIDEO },
    patrocinador: { dir: patrocinadorDir, extensoes: logic.EXTENSOES_IMAGEM },
    slide: { dir: slideDir, extensoes: logic.EXTENSOES_SLIDE } // slide = imagem OU vídeo
};

function listarVideos(cb) {
    fs.readdir(videoDir, (err, files) => cb(err ? [] : logic.filtrarVideos(files)));
}

function listarSlides(cb) {
    fs.readdir(slideDir, (err, files) => {
        const slides = err ? [] : logic.filtrarSlides(files);
        slides.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        cb(slides);
    });
}

function sincronizarPatrocinadores(broadcastDepois) {
    fs.readdir(patrocinadorDir, (err, files) => {
        gameState.patrocinadores = err ? [] : logic.filtrarImagens(files);
        if (broadcastDepois) broadcast();
    });
}

function aposMudancaArquivo(tipo) {
    if (tipo === 'patrocinador') sincronizarPatrocinadores(true);
    else if (tipo === 'slide') listarSlides(slides => io.emit('lista_slides', slides));
    else listarVideos(videos => io.emit('lista_videos', videos));
}

sincronizarPatrocinadores(false); // carrega as logos já presentes na pasta

app.post('/api/upload/:tipo', (req, res) => {
    const cfg = TIPOS_ARQUIVO[req.params.tipo];
    if (!cfg) return res.status(404).json({ erro: 'Tipo de upload desconhecido' });

    const nome = logic.sanitizarNomeArquivo(req.query.nome);
    if (!nome || !cfg.extensoes.includes(path.extname(nome).toLowerCase())) {
        return res.status(400).json({ erro: `Nome inválido ou extensão não permitida (aceitas: ${cfg.extensoes.join(', ')})` });
    }

    const destinoPath = path.join(cfg.dir, nome);
    const destino = fs.createWriteStream(destinoPath);
    req.pipe(destino);
    req.on('aborted', () => {
        destino.destroy();
        fs.unlink(destinoPath, () => {}); // remove upload parcial
    });
    destino.on('finish', () => {
        aposMudancaArquivo(req.params.tipo);
        res.json({ ok: true, nome });
    });
    destino.on('error', (err) => {
        console.error('Erro ao gravar upload:', err.message);
        if (!res.headersSent) res.status(500).json({ erro: err.message });
    });
});

app.delete('/api/:tipo/:nome', (req, res) => {
    const cfg = TIPOS_ARQUIVO[req.params.tipo];
    if (!cfg) return res.status(404).json({ erro: 'Tipo desconhecido' });

    const nome = logic.sanitizarNomeArquivo(req.params.nome);
    if (!nome) return res.status(400).json({ erro: 'Nome inválido' });

    fs.unlink(path.join(cfg.dir, nome), (err) => {
        if (err) return res.status(err.code === 'ENOENT' ? 404 : 500).json({ erro: err.message });
        aposMudancaArquivo(req.params.tipo);
        res.json({ ok: true });
    });
});

io.on('connection', (socket) => {
    // Sincroniza novo cliente com o estado atual do jogo
    socket.emit('atualizar_tela', { ...gameState, serverTime: Date.now() });

    // Gestão de Vídeos (Comerciais)
    socket.on('solicitar_videos', () => {
        listarVideos(videos => {
            console.log(`Vídeos encontrados em ${videoDir}:`, videos);
            socket.emit('lista_videos', videos);
        });
    });

    socket.on('comando_video', (dados) => {
        io.emit('executar_video', dados);
    });

    // Apresentação de Slides (imagens em tela cheia)
    socket.on('solicitar_slides', () => {
        listarSlides(slides => socket.emit('lista_slides', slides));
    });

    socket.on('comando_slides', (dados) => {
        logic.comandoSlides(gameState, dados);
        broadcast();
    });

    socket.on('comando_transmissao', (dados) => {
        logic.comandoTransmissao(gameState, dados);
        broadcast();
    });

    // Configuração Inicial e Atualização de Dados
    socket.on('configurar_jogo', (dados) => {
        logic.configurarJogo(gameState, dados);
        broadcast();
    });

    // Ações de Placar e Anúncio de Jogador
    socket.on('comando_placar', (payload) => {
        const { animacoes } = logic.comandoPlacar(gameState, payload);
        animacoes.forEach(a => io.emit(a.name, a.payload));
        broadcast();
    });

    // Gestão do Cronômetro
    socket.on('comando_cronometro', (payload) => {
        logic.comandoCronometro(gameState, payload, Date.now());
        broadcast();
    });
});

if (require.main === module) {
    server.listen(4000, '0.0.0.0', () => {
        console.log('Servidor rodando! Acesse via IP na rede (ex: http://192.168.x.x:4000)');
    });
}

module.exports = { app, server, io };
