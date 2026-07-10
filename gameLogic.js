// Lógica pura do jogo, sem dependência de socket.io.
// Cada função recebe (e muta) um objeto `state` e, quando há efeitos
// colaterais para a camada de rede (animações), os retorna em `{ animacoes }`.

const EXTENSOES_VIDEO = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const TEXTOS_PONTO = { futsal: 'GOL!', basquete: 'CESTA!', volei: 'PONTO!' };

function criarEstadoInicial() {
    return {
        esporte: 'futsal',
        sacando: null,
        periodo: 1,
        transmissaoAtiva: false,
        timeA: { nome: 'Time Local', logo: '', placar: 0, sets: 0, faltas: 0, elenco: [] },
        timeB: { nome: 'Visitante', logo: '', placar: 0, sets: 0, faltas: 0, elenco: [] },
        cronometro: { rodando: false, tempoAcumulado: 0, inicioTimestamp: 0, duracaoConfigurada: 600000 }
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
            animacoes.push({ name: 'animacao_ponto', payload: { texto, jogador, timeNome: state[time].nome } });
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
        if (jogador) animacoes.push({ name: 'animacao_ponto', payload: { texto: 'FALTA!', jogador, timeNome: state[time].nome } });
    }
    if (acao === 'sub_falta' && state[time].faltas > 0) state[time].faltas -= 1;
    if (acao === 'add_periodo') state.periodo += 1;
    if (acao === 'sub_periodo' && state.periodo > 1) state.periodo -= 1;
    if (acao === 'zerar_tudo') {
        state.timeA.placar = 0; state.timeA.sets = 0; state.timeA.faltas = 0;
        state.timeB.placar = 0; state.timeB.sets = 0; state.timeB.faltas = 0;
        state.sacando = null;
        state.periodo = 1;
        state.transmissaoAtiva = false;
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

function comandoTransmissao(state, dados = {}) {
    state.transmissaoAtiva = !!dados.ativa;
    return state;
}

function filtrarVideos(files = []) {
    return files.filter(f => EXTENSOES_VIDEO.includes(extname(f)));
}

// extname minimalista (evita depender de `path` para manter o módulo puro)
function extname(nome) {
    const i = String(nome).lastIndexOf('.');
    return i < 0 ? '' : String(nome).slice(i).toLowerCase();
}

module.exports = {
    EXTENSOES_VIDEO,
    criarEstadoInicial,
    configurarJogo,
    comandoPlacar,
    comandoCronometro,
    comandoTransmissao,
    filtrarVideos
};
