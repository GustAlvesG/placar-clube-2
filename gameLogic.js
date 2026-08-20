// Lógica pura do jogo, sem dependência de socket.io.
// Cada função recebe (e muta) um objeto `state` e, quando há efeitos
// colaterais para a camada de rede (animações), os retorna em `{ animacoes }`.

const EXTENSOES_VIDEO = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const EXTENSOES_IMAGEM = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
// Um slide pode ser uma imagem estática ou um vídeo (fica em loop até o operador avançar).
const EXTENSOES_SLIDE = [...EXTENSOES_IMAGEM, ...EXTENSOES_VIDEO];
const TEXTOS_PONTO = { futsal: 'GOL!', basquete: 'CESTA!', volei: 'PONTO!' };

function criarEstadoInicial() {
    return {
        esporte: 'futsal',
        sacando: null,
        periodo: 1,
        transmissaoAtiva: false,
        patrocinadores: [],
        timeA: { nome: 'Time Local', logo: '', placar: 0, sets: 0, faltas: 0, elenco: [] },
        timeB: { nome: 'Visitante', logo: '', placar: 0, sets: 0, faltas: 0, elenco: [] },
        cronometro: { rodando: false, tempoAcumulado: 0, inicioTimestamp: 0, duracaoConfigurada: 600000 },
        slides: { arquivos: [], indice: 0, ativo: false }
    };
}

function configurarJogo(state, dados = {}) {
    if (dados.esporte) state.esporte = dados.esporte;
    if (dados.timeA_nome) state.timeA.nome = dados.timeA_nome;
    if (dados.timeB_nome) state.timeB.nome = dados.timeB_nome;
    if (dados.timeA_logo !== undefined) state.timeA.logo = dados.timeA_logo;
    if (dados.timeB_logo !== undefined) state.timeB.logo = dados.timeB_logo;
    if (dados.timeA_elenco) state.timeA.elenco = dados.timeA_elenco;
    if (dados.timeB_elenco) state.timeB.elenco = dados.timeB_elenco;
    if ('sacando' in dados) state.sacando = dados.sacando;
    return state;
}

function comandoPlacar(state, { time, acao, valor, jogador } = {}) {
    const animacoes = [];

    if (acao === 'add_ponto') {
        state[time].placar += valor;
        state.sacando = time;
        if (jogador) {
            const texto = TEXTOS_PONTO[state.esporte] || 'PONTO!';
            // `tipo: 'ponto'` é o que permite o telão preferir o vídeo do
            // jogador (se tiver) nessa animação — falta nunca usa vídeo.
            animacoes.push({ name: 'animacao_ponto', payload: { tipo: 'ponto', texto, jogador, timeNome: state[time].nome } });
        }

        // Vôlei: ponto que leva a >=25 com diferença >=2 vence o set.
        if (state.esporte === 'volei') {
            const outroTime = time === 'timeA' ? 'timeB' : 'timeA';
            const placarTime = state[time].placar;
            const placarOutro = state[outroTime].placar;
            if (placarTime >= 25 && (placarTime - placarOutro) >= 2) {
                state[time].sets += 1;
                state.timeA.placar = 0;
                state.timeB.placar = 0;
                state.sacando = null;
            }
        }
    }

    if (acao === 'sub_ponto' && state[time].placar > 0) state[time].placar -= valor;
    if (acao === 'add_set') state[time].sets += 1;
    if (acao === 'sub_set' && state[time].sets > 0) state[time].sets -= 1;
    if (acao === 'add_falta') {
        state[time].faltas += 1;
        // `tipo: 'falta'` faz o telão usar sempre a foto (nunca o vídeo),
        // mesmo que o jogador tenha um vídeo cadastrado.
        if (jogador) animacoes.push({ name: 'animacao_ponto', payload: { tipo: 'falta', texto: 'FALTA!', jogador, timeNome: state[time].nome } });
    }
    if (acao === 'sub_falta' && state[time].faltas > 0) state[time].faltas -= 1;
    if (acao === 'add_periodo') state.periodo += 1;
    if (acao === 'sub_periodo' && state.periodo > 1) state.periodo -= 1;
    // Zera valores de jogo (placar, sets, faltas, período, cronômetro) sem
    // interromper a transmissão do telão.
    if (acao === 'zerar_tudo') {
        state.timeA.placar = 0; state.timeA.sets = 0; state.timeA.faltas = 0;
        state.timeB.placar = 0; state.timeB.sets = 0; state.timeB.faltas = 0;
        state.sacando = null;
        state.periodo = 1;
        state.cronometro.rodando = false;
        state.cronometro.tempoAcumulado = 0;
        state.cronometro.inicioTimestamp = 0;
    }

    return { animacoes };
}

function comandoCronometro(state, { acao, valor, segundos } = {}, now = Date.now()) {
    if (acao === 'play' && !state.cronometro.rodando) {
        state.cronometro.rodando = true;
        state.cronometro.inicioTimestamp = now;
    } else if (acao === 'pause' && state.cronometro.rodando) {
        state.cronometro.rodando = false;
        state.cronometro.tempoAcumulado += (now - state.cronometro.inicioTimestamp);
    } else if (acao === 'set') {
        state.cronometro.rodando = false;
        state.cronometro.tempoAcumulado = 0;
        state.cronometro.duracaoConfigurada = ((valor || 0) * 60 + (segundos || 0)) * 1000;
    }
    return state;
}

// Tempo decorrido do cronômetro do JOGO (não o relógio de parede), em ms, no
// instante `agora` — soma o que já foi acumulado (pausas anteriores) com o
// trecho em andamento, se estiver rodando. `now` injetável pelo mesmo motivo
// de comandoCronometro: testável sem depender do relógio real. Usado pela
// integração com a API do Placar Clube para preencher `cronometro_ms` em
// eventos de ponto/falta — nunca usar `tempoAcumulado` sozinho, que fica
// parado enquanto o cronômetro está rodando.
function tempoDecorrido(cronometro, agora = Date.now()) {
    return cronometro.tempoAcumulado + (cronometro.rodando ? (agora - cronometro.inicioTimestamp) : 0);
}

function comandoTransmissao(state, dados = {}) {
    state.transmissaoAtiva = !!dados.ativa;
    return state;
}

// Apresentação de slides (imagens em sequência) exibida em tela cheia no
// telão. O estado guarda a fila e o índice atual para que telões que
// conectem no meio da apresentação sincronizem corretamente.
function comandoSlides(state, { acao, arquivos } = {}) {
    if (acao === 'iniciar') {
        state.slides.arquivos = Array.isArray(arquivos) ? arquivos : [];
        state.slides.indice = 0;
        state.slides.ativo = state.slides.arquivos.length > 0;
    } else if (acao === 'proximo') {
        if (state.slides.ativo && state.slides.indice < state.slides.arquivos.length - 1) {
            state.slides.indice += 1;
        }
    } else if (acao === 'anterior') {
        if (state.slides.ativo && state.slides.indice > 0) {
            state.slides.indice -= 1;
        }
    } else if (acao === 'parar') {
        state.slides.ativo = false;
        state.slides.arquivos = [];
        state.slides.indice = 0;
    }
    return state;
}

function filtrarVideos(files = []) {
    return files.filter(f => EXTENSOES_VIDEO.includes(extname(f)));
}

function filtrarImagens(files = []) {
    return files.filter(f => EXTENSOES_IMAGEM.includes(extname(f)));
}

function filtrarSlides(files = []) {
    return files.filter(f => EXTENSOES_SLIDE.includes(extname(f)));
}

// Reduz um nome vindo do cliente a um nome de arquivo seguro para gravar em
// disco: descarta qualquer caminho (previne traversal) e troca caracteres
// problemáticos por "_". Retorna '' se não sobrar nada utilizável.
function sanitizarNomeArquivo(nome) {
    const base = String(nome || '').split(/[\\/]/).pop().trim();
    const limpo = base.replace(/[^a-zA-Z0-9À-ÿ ._-]/g, '_');
    return /^[. ]*$/.test(limpo) ? '' : limpo;
}

// extname minimalista (evita depender de `path` para manter o módulo puro)
function extname(nome) {
    const i = String(nome).lastIndexOf('.');
    return i < 0 ? '' : String(nome).slice(i).toLowerCase();
}

module.exports = {
    EXTENSOES_VIDEO,
    EXTENSOES_IMAGEM,
    EXTENSOES_SLIDE,
    criarEstadoInicial,
    configurarJogo,
    comandoPlacar,
    comandoCronometro,
    tempoDecorrido,
    comandoTransmissao,
    comandoSlides,
    filtrarVideos,
    filtrarImagens,
    filtrarSlides,
    sanitizarNomeArquivo
};
