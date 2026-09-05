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

// Estáticos.
//
// `__dirname` e não 'public': o caminho relativo depende do diretório de onde o
// processo foi iniciado, e num serviço (pm2/systemd) isso nem sempre é a raiz
// do projeto — daria 404 ou, pior, uma cópia velha do public/.
//
// `no-cache` em html/css/js: o telão passa dias com a mesma aba aberta e o
// deploy troca esses arquivos sem trocar o nome deles; com o cache padrão do
// navegador a TV continua exibindo a versão anterior depois de subir uma
// correção. `no-cache` não desliga o cache — obriga a revalidar pelo ETag, que
// responde 304 (poucos bytes) quando nada mudou. Imagens, vídeos e logos ficam
// de fora: são pesados, mudam de nome quando mudam, e não têm esse problema.
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders(res, arquivo) {
        if (/\.(html|css|js)$/i.test(arquivo)) res.setHeader('Cache-Control', 'no-cache');
    }
}));

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
    ultimoErro: null,
    // Já foi marcado como ao_vivo nesta sessão? Evita chamar /iniciar de novo a
    // cada PLAY (ver `iniciarJogoNaApi` e o handler de `comando_cronometro`).
    iniciado: false
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
        cronometroMs: gameState ? logic.tempoDecorrido(gameState.cronometro) : undefined,
        // Só `fechar_set` usa: placar da parcial que acabou de fechar.
        parcial: payload.parcial
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
    integracao.iniciado = false;
}

// Marca o jogo como ao_vivo na API. Chamada pelo botão manual
// (`placar_iniciar_jogo`) e automaticamente no primeiro PLAY do cronômetro — o
// "start" do tempo É o que diz que o jogo começou, então cobre a marcação de
// ao vivo sem exigir um clique à parte do operador (ver handler de
// `comando_cronometro`). Idempotente do lado da API: reconexão/reload no meio
// da partida retoma a sequência em vez de reiniciar do zero.
async function iniciarJogoNaApi(id, operador) {
    const resposta = await placarApi.iniciarJogo(laravelConfig, id, { operador });
    integracao.fila = placarEventos.criarEstadoFila(resposta.ultima_sequencia || 0);
    integracao.statusConexao = 'sincronizado';
    integracao.ultimoErro = null;
    integracao.iniciado = true;
    broadcastIntegracao();
    return resposta;
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
// Pasta de arte do telão (fundos e elementos por esporte). O vídeo de espera
// mora aqui: é conteúdo fixo da casa, não material que o operador sobe a cada
// jogo — por isso não tem tela de upload nem entra em TIPOS_ARQUIVO.
const baseDir = path.join(__dirname, 'public', 'base');
const patrocinadorDir = path.join(__dirname, 'public', 'patrocinadores');
const slideDir = path.join(__dirname, 'public', 'slides');
for (const dir of [videoDir, patrocinadorDir, slideDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let gameState = logic.criarEstadoInicial();

// Payload de `atualizar_tela`: o estado + o relógio do servidor (para os
// telões sincronizarem o cronômetro) + os derivados de gameLogic de que a mesa
// precisa — assim a regra de fechamento de set/quarto fica só em gameLogic.js e
// não é reimplementada em cada HTML de controle.
function payloadEstado() {
    return {
        ...gameState,
        serverTime: Date.now(),
        parcialFechavel: logic.parcialFechavel(gameState),
        parcialAtual: logic.numeroParcialAtual(gameState),
        // Grade completa de sets/quartos que o telão desenha, e qual deles está
        // em disputa (`null` com o jogo decidido) — derivado aqui para o HTML
        // não reimplementar "melhor de 5".
        totalParciais: logic.quantidadeParciais(gameState),
        parcialEmAndamento: logic.parcialEmAndamento(gameState),
        // 'timeA' | 'timeB' | null — quem está a um ponto de fechar a parcial.
        setPoint: logic.pontoDeParcial(gameState)
    };
}

function broadcast() {
    io.emit('atualizar_tela', payloadEstado());
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

// Relê public/base/ e guarda no estado o vídeo de espera. Roda no boot e a cada
// telão que conecta: assim, largar o arquivo na pasta e recarregar o telão já
// basta — sem reiniciar o servidor no meio de um evento.
function sincronizarVideoStandby(cb) {
    fs.readdir(baseDir, (err, files) => {
        const anterior = gameState.videoStandby;
        gameState.videoStandby = err ? null : logic.escolherVideoBase(files);
        if (cb) cb(gameState.videoStandby !== anterior);
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
sincronizarVideoStandby();        // e o vídeo de espera, se houver um em base/

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
    socket.emit('atualizar_tela', payloadEstado());
    // O vídeo de espera pode ter sido trocado na pasta com o servidor no ar;
    // só rebroadcasta se mudou de verdade, para não repintar o telão à toa.
    sincronizarVideoStandby(mudou => { if (mudou) broadcast(); });
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
            const resposta = await iniciarJogoNaApi(id, operador);
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
        const acao = payload && payload.acao;

        // `fechar_set` e `reabrir_set` chegam sem `time`: quem levou a parcial
        // sai do placar. No fechamento isso precisa ser lido ANTES do comando,
        // que zera o placar em seguida.
        const antesDoFechamento = acao === 'fechar_set'
            ? {
                time: logic.vencedorParcial(gameState),
                parcial: {
                    numero: logic.numeroParcialAtual(gameState),
                    a: gameState.timeA.placar,
                    b: gameState.timeB.placar
                }
            }
            : null;

        const { animacoes } = logic.comandoPlacar(gameState, payload);
        animacoes.forEach(a => io.emit(a.name, a.payload));
        broadcast(); // otimista: telão atualiza antes de qualquer chamada à API

        if (antesDoFechamento) {
            registrarEventoDeAcaoPlacar({ ...payload, ...antesDoFechamento });
        } else if (acao === 'reabrir_set') {
            // Na reabertura o placar da parcial já voltou ao gameState, então o
            // vencedor (e com ele a chave do estorno) é lido DEPOIS do comando.
            registrarEventoDeAcaoPlacar({ ...payload, time: logic.vencedorParcial(gameState) });
        } else {
            registrarEventoDeAcaoPlacar(payload);
        }
    });

    // Gestão do Cronômetro
    socket.on('comando_cronometro', (payload) => {
        logic.comandoCronometro(gameState, payload, Date.now());
        broadcast();
        registrarEventoDeCronometro(payload);

        // O "start" do cronômetro é o que marca o jogo como ao vivo na API —
        // dá PLAY uma vez e não precisa lembrar de um botão separado antes.
        // Só dispara uma vez por jogo (`integracao.iniciado`); erro aqui não
        // deve travar o cronômetro, que já rodou otimisticamente.
        if (payload && payload.acao === 'play' && integracaoConfigurada() && integracao.jogoId && !integracao.iniciado) {
            iniciarJogoNaApi(integracao.jogoId).catch(erro => {
                integracao.statusConexao = (erro.status === 401 || erro.status === 403) ? 'erro_configuracao' : 'erro';
                integracao.ultimoErro = erro;
                broadcastIntegracao();
                console.error('Falha ao marcar jogo como ao vivo automaticamente ao dar PLAY:', erro.message);
            });
        }
    });

    // Reset completo da tela de configuração: diferente de `zerar_tudo` (ação
    // de `comando_placar`, usada nas telas de jogo para zerar placar sem
    // apagar nomes/elenco/vínculo com a API durante uma partida em
    // andamento), este evento é "esquece tudo e começa do zero" — nomes,
    // logos, elenco, esporte, transmissão e o vínculo com o jogo da API.
    // Preserva só os patrocinadores (recurso do carrossel, não do jogo).
    socket.on('zerar_configuracao_completa', () => {
        const patrocinadoresAtuais = gameState.patrocinadores;
        const videoStandbyAtual = gameState.videoStandby;
        gameState = logic.criarEstadoInicial();
        gameState.patrocinadores = patrocinadoresAtuais;
        // Ambos vêm de pasta, não da configuração do jogo: zerar o jogo não
        // pode apagá-los do estado.
        gameState.videoStandby = videoStandbyAtual;

        integracao.jogoId = null;
        integracao.timeAId = null;
        integracao.timeBId = null;
        integracao.fila = placarEventos.criarEstadoFila(0);
        integracao.statusConexao = integracaoConfigurada() ? 'ocioso' : 'nao_configurado';
        integracao.ultimoErro = null;
        integracao.iniciado = false;

        broadcast();
        broadcastIntegracao();
    });
});

if (require.main === module) {
    server.listen(4000, '0.0.0.0', () => {
        console.log('Servidor rodando! Acesse via IP na rede (ex: http://192.168.x.x:4000)');
    });
}

module.exports = { app, server, io };
