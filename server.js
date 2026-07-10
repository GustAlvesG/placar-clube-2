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
if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
}

let gameState = logic.criarEstadoInicial();

function broadcast() {
    io.emit('atualizar_tela', { ...gameState, serverTime: Date.now() });
}

io.on('connection', (socket) => {
    // Sincroniza novo cliente com o estado atual do jogo
    socket.emit('atualizar_tela', { ...gameState, serverTime: Date.now() });

    // Gestão de Vídeos (Comerciais)
    socket.on('solicitar_videos', () => {
        fs.readdir(videoDir, (err, files) => {
            if (err) {
                console.error('Erro ao ler diretório de vídeos:', err.message);
                socket.emit('lista_videos', []);
                return;
            }
            const videos = logic.filtrarVideos(files);
            console.log(`Vídeos encontrados em ${videoDir}:`, videos);
            socket.emit('lista_videos', videos);
        });
    });

    socket.on('comando_video', (dados) => {
        io.emit('executar_video', dados);
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
