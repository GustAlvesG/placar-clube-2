const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const logic = require('./gameLogic');
const placarApi = require('./placarApi');
const placarEventos = require('./placarEventos');
const { carregarEnv } = require('./env');

carregarEnv();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ---- Integração com a API do Placar Clube (Laravel) ----
// Este bloco é bookkeeping de TRANSPORTE (ids do lado Laravel, fila de
// eventos, status de conexão) — nunca regra de jogo. Por isso fica fora de
// gameState/gameLogic.js, que continuam sem depender de rede nenhuma. Ver
// placarApi.js (cliente HTTP) e placarEventos.js (fila/uuid/sequencia).
const laravelConfig = {
    baseUrl: (process.env.LARAVEL_BASE_URL || '').replace(/\/+$/, ''),
    token: process.env.LARAVEL_API_TOKEN || ''
};

function integracaoConfigurada() {
    return !!(laravelConfig.baseUrl && laravelConfig.token);
}

let integracao = {
    jogoId: null,
    timeAId: null,
    timeBId: null,
    fila: placarEventos.criarEstadoFila(0),
    statusConexao: integracaoConfigurada() ? 'ocioso' : 'nao_configurado',
    ultimoErro: null
};

if (!integracaoConfigurada()) {
    console.log('Integração com a API do Placar Clube não configurada (LARAVEL_BASE_URL/LARAVEL_API_TOKEN ausentes em .env) — rodando em modo manual.');
}

function statusIntegracao() {
    return {
        configurada: integracaoConfigurada(),
        jogoId: integracao.jogoId,
        statusConexao: integracao.statusConexao,
        pendentes: integracao.fila.pendentes.length,
        ultimoErro: integracao.ultimoErro ? String(integracao.ultimoErro.message || integracao.ultimoErro) : null
    };
}

function broadcastIntegracao() {
    io.emit('integracao_status', statusIntegracao());
}

// Tenta esvaziar a fila de eventos pendentes. Nunca lançamos daqui pra fora
// — falha de rede/API só fica registrada em `integracao.ultimoErro` e a
// fila continua intacta para a próxima tentativa (chamada isolada ou o
// retry periódico logo abaixo).
async function tentarEnviarPendentes() {
    if (!integracaoConfigurada() || !integracao.jogoId) return;
    if (integracao.fila.pendentes.length === 0 || integracao.fila.enviando) return;
    try {
        integracao.statusConexao = 'sincronizando';
        broadcastIntegracao();
        const resultado = await placarEventos.enviarPendentes(placarApi, laravelConfig, integracao.jogoId, integracao.fila);
        integracao.statusConexao = 'sincronizado';
        integracao.ultimoErro = null;
        if (resultado && resultado.rejeitados && resultado.rejeitados.length) {
            io.emit('integracao_eventos_rejeitados', resultado.rejeitados);
        }
    } catch (erro) {
        // 401/403 são erro de configuração/autenticação (não adianta insistir
        // do mesmo jeito); os demais (rede, 5xx, 429) são candidatos a retry.
        integracao.statusConexao = (erro.status === 401 || erro.status === 403) ? 'erro_configuracao' : 'erro';
        integracao.ultimoErro = erro;
        console.error('Falha ao enviar eventos para a API do Placar Clube:', erro.message);
    } finally {
        broadcastIntegracao();
    }
}

// Retry periódico best-effort — cobre o caso de uma falha de rede passageira
// entre o momento do evento e a próxima ação do operador. unref() para não
// segurar o processo vivo (mesmo espírito de um cron: não é essencial).
const intervaloSincronizacao = setInterval(tentarEnviarPendentes, 5000);
intervaloSincronizacao.unref();

function idDoTime(timeChave) {
    if (timeChave === 'timeA') return integracao.timeAId;
    if (timeChave === 'timeB') return integracao.timeBId;
    return undefined;
}

// Traduz a ação já aplicada ao gameState (placar ou cronômetro) num evento
// (ou estorno) para a fila — e dispara o envio, sem bloquear quem chamou.
function aplicarTraducaoNaFila(trad) {
    if (!trad || trad.modo === 'ignorar') return;
    if (trad.modo === 'estornar') {
        const evento = placarEventos.criarEstorno(integracao.fila, trad.chaveEstorno, trad.motivo);
        if (!evento) {
            console.warn(`Integração Placar Clube: nada para desfazer remotamente (${trad.chaveEstorno}) — sem evento rastreado nesta sessão.`);
        }
    } else if (trad.modo === 'registrar') {
        const timeId = trad.time ? idDoTime(trad.time) : undefined;
        placarEventos.registrarEvento(integracao.fila, { ...trad.campos, time_id: timeId, chaveEstorno: trad.chaveEstorno });
    }
    broadcastIntegracao();
    tentarEnviarPendentes();
}

function registrarEventoDeAcaoPlacar(payload = {}) {
    if (!integracaoConfigurada() || !integracao.jogoId) return;
    aplicarTraducaoNaFila(placarEventos.traduzirAcaoPlacar({
        acao: payload.acao,
        time: payload.time,
        valor: payload.valor,
        jogador: payload.jogador,
        periodo: gameState ? gameState.periodo : undefined,
        // cronometro_ms agora é OBRIGATÓRIO em ponto/falta na API — precisa ser
        // o tempo decorrido no instante do lance, não `tempoAcumulado` sozinho
        // (que fica congelado enquanto o cronômetro está rodando).
        cronometroMs: gameState ? logic.tempoDecorrido(gameState.cronometro) : undefined
    }));
}

function registrarEventoDeCronometro(payload = {}) {
    if (!integracaoConfigurada() || !integracao.jogoId) return;
    aplicarTraducaoNaFila(placarEventos.traduzirAcaoCronometro({
        acao: payload.acao,
        periodo: gameState ? gameState.periodo : undefined
    }));
}

// Molda a resposta de GET/POST /jogos(/{jogo}) — { jogo, time_casa, time_fora }
// — no formato de elenco que o resto do app já usa (configurarJogo,
// gameLogic.js): {numero, nome, foto}. `jogador_id` é acrescentado para que
// os eventos de ponto/falta consigam referenciar o jogador certo na API.
// `video` (video_url) é novo: vídeo curto de apresentação do jogador, sempre
// tratado como opcional — a maioria não tem (vem `null` da API).
function mapearElencoApi(elenco = []) {
    return elenco.map(j => ({
        numero: String(j.numero ?? ''),
        nome: j.nome_exibicao || '',
        foto: j.foto_url || '',
        video: j.video_url || '',
        jogador_id: j.jogador_id,
        titular: !!j.titular,
        capitao: !!j.capitao
    }));
}

// Aplica o payload de um jogo vindo da API (planejado OU recém-criado em
// modo avulso — mesmo formato, ver docs/placar-clube-api.md) ao gameState e
// reinicia a fila de eventos deste jogo.
function aplicarJogoNoEstado(resposta) {
    const { jogo, time_casa, time_fora } = resposta;
    logic.comandoPlacar(gameState, { acao: 'zerar_tudo' });
    gameState.esporte = jogo.esporte;
    gameState.timeA.nome = time_casa.nome_exibicao;
    gameState.timeA.logo = time_casa.logo_url || '';
    gameState.timeA.elenco = mapearElencoApi(time_casa.elenco);
    gameState.timeB.nome = time_fora.nome_exibicao;
    gameState.timeB.logo = time_fora.logo_url || '';
    gameState.timeB.elenco = mapearElencoApi(time_fora.elenco);

    integracao.jogoId = jogo.id;
    integracao.timeAId = time_casa.id;
    integracao.timeBId = time_fora.id;
    integracao.fila = placarEventos.criarEstadoFila(0); // ultima_sequencia real só chega em /iniciar
    integracao.statusConexao = 'carregado';
    integracao.ultimoErro = null;
}

// Dispatcher genérico para chamadas de API que são só leitura/criação e não
// precisam mexer no gameState (telas de seleção/criação avulsa). Mantém
// server.js fino: a regra de cada endpoint vive em placarApi.js.
const ACOES_PLACAR_API = {
    ping: () => placarApi.ping(laravelConfig),
    listarModalidades: () => placarApi.listarModalidades(laravelConfig),
    listarEquipes: (p) => placarApi.listarEquipes(laravelConfig, p),
    criarEquipe: (p) => placarApi.criarEquipe(laravelConfig, p),
    enviarLogoEquipe: (p) => placarApi.enviarLogoEquipe(laravelConfig, p.equipeId, p),
    removerLogoEquipe: (p) => placarApi.removerLogoEquipe(laravelConfig, p.equipeId),
    listarTimes: (p) => placarApi.listarTimes(laravelConfig, p),
    elencoDoTime: (p) => placarApi.elencoDoTime(laravelConfig, p.timeId, p),
    criarTime: (p) => placarApi.criarTime(laravelConfig, p),
    enviarLogoTime: (p) => placarApi.enviarLogoTime(laravelConfig, p.timeId, p),
    removerLogoTime: (p) => placarApi.removerLogoTime(laravelConfig, p.timeId),
    criarJogador: (p) => placarApi.criarJogador(laravelConfig, p),
    enviarFotoJogador: (p) => placarApi.enviarFotoJogador(laravelConfig, p.jogadorId, p),
    removerFotoJogador: (p) => placarApi.removerFotoJogador(laravelConfig, p.jogadorId),
    removerVideoJogador: (p) => placarApi.removerVideoJogador(laravelConfig, p.jogadorId),
    listarJogos: (p) => placarApi.listarJogos(laravelConfig, p),
    sumulaDoJogo: (p) => placarApi.sumulaDoJogo(laravelConfig, p.jogoId),
    // GET /scout/artilharia foi removido da API — os substitutos são sempre
    // por partida (não mais um ranking agregado entre jogos).
    atuacaoDoJogador: (p) => placarApi.atuacaoDoJogador(laravelConfig, p.jogoId, p.jogadorId),
    perfilJogador: (p) => placarApi.perfilJogador(laravelConfig, p.jogadorId, p)
};

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
    socket.emit('integracao_status', statusIntegracao());

    // ---- Integração com a API do Placar Clube ----

    // Dispatcher genérico: telas de seleção/criação avulsa (equipes, times,
    // jogadores, jogos, scout) chamam por aqui. Resposta via ack callback,
    // nunca broadcast — é uma consulta/ação de um operador, não um evento de
    // telão.
    socket.on('placar_chamar', async ({ acao, payload } = {}, callback) => {
        const responder = typeof callback === 'function' ? callback : () => {};
        const executar = ACOES_PLACAR_API[acao];
        if (!executar) return responder({ ok: false, erro: `Ação desconhecida: ${acao}` });
        try {
            const dado = await executar(payload || {});
            responder({ ok: true, dado });
        } catch (erro) {
            responder({ ok: false, status: erro.status, erro: erro.message, corpo: erro.corpo });
        }
    });

    // Modo planejado: carrega um jogo já cadastrado e aplica ao gameState.
    socket.on('placar_carregar_jogo', async ({ jogoId } = {}, callback) => {
        const responder = typeof callback === 'function' ? callback : () => {};
        try {
            const resposta = await placarApi.obterJogo(laravelConfig, jogoId);
            aplicarJogoNoEstado(resposta);
            broadcast();
            broadcastIntegracao();
            responder({ ok: true, dado: resposta });
        } catch (erro) {
            responder({ ok: false, status: erro.status, erro: erro.message, corpo: erro.corpo });
        }
    });

    // Modo avulso: cria equipe/time/jogador (via placar_chamar) e por fim o
    // jogo — que já devolve o mesmo payload de obterJogo, então aplicamos
    // igual (sem chamada extra).
    socket.on('placar_criar_jogo', async ({ dados } = {}, callback) => {
        const responder = typeof callback === 'function' ? callback : () => {};
        try {
            const resposta = await placarApi.criarJogo(laravelConfig, dados);
            aplicarJogoNoEstado(resposta);
            broadcast();
            broadcastIntegracao();
            responder({ ok: true, dado: resposta });
        } catch (erro) {
            responder({ ok: false, status: erro.status, erro: erro.message, corpo: erro.corpo });
        }
    });

    socket.on('placar_iniciar_jogo', async ({ jogoId, operador } = {}, callback) => {
        const responder = typeof callback === 'function' ? callback : () => {};
        const id = jogoId || integracao.jogoId;
        if (!id) return responder({ ok: false, erro: 'Nenhum jogo carregado' });
        try {
            const resposta = await placarApi.iniciarJogo(laravelConfig, id, { operador });
            // Idempotente: se o jogo já estava ao_vivo (reconexão/reload no meio
            // da partida), retoma a sequência a partir do que a API já tem —
            // nunca reinicia do zero.
            integracao.fila = placarEventos.criarEstadoFila(resposta.ultima_sequencia || 0);
            integracao.statusConexao = 'sincronizado';
            integracao.ultimoErro = null;
            broadcastIntegracao();
            responder({ ok: true, dado: resposta });
        } catch (erro) {
            responder({ ok: false, status: erro.status, erro: erro.message, corpo: erro.corpo });
        }
    });

    socket.on('placar_salvar_escalacao', async ({ jogoId, time_id, jogadores } = {}, callback) => {
        const responder = typeof callback === 'function' ? callback : () => {};
        const id = jogoId || integracao.jogoId;
        if (!id) return responder({ ok: false, erro: 'Nenhum jogo carregado' });
        try {
            const resposta = await placarApi.salvarEscalacao(laravelConfig, id, { time_id, jogadores });
            responder({ ok: true, dado: resposta });
        } catch (erro) {
            responder({ ok: false, status: erro.status, erro: erro.message, corpo: erro.corpo });
        }
    });

    socket.on('placar_encerrar_jogo', async ({ jogoId, ...dados } = {}, callback) => {
        const responder = typeof callback === 'function' ? callback : () => {};
        const id = jogoId || integracao.jogoId;
        if (!id) return responder({ ok: false, erro: 'Nenhum jogo carregado' });
        try {
            // Antes de encerrar, esvazia a fila para não deixar evento pendente
            // para trás — o placar final que a API recalcula tem que refletir
            // tudo que já foi jogado.
            await tentarEnviarPendentes();
            const resposta = await placarApi.encerrarJogo(laravelConfig, id, dados);
            responder({ ok: true, dado: resposta }); // dado.observacoes pode trazer divergência p/ conferência humana
        } catch (erro) {
            responder({ ok: false, status: erro.status, erro: erro.message, corpo: erro.corpo });
        }
    });

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
        broadcast(); // otimista: telão atualiza antes de qualquer chamada à API
        registrarEventoDeAcaoPlacar(payload);
    });

    // Gestão do Cronômetro
    socket.on('comando_cronometro', (payload) => {
        logic.comandoCronometro(gameState, payload, Date.now());
        broadcast();
        registrarEventoDeCronometro(payload);
    });
});

if (require.main === module) {
    server.listen(4000, '0.0.0.0', () => {
        console.log('Servidor rodando! Acesse via IP na rede (ex: http://192.168.x.x:4000)');
    });
}

module.exports = { app, server, io };
