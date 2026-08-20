// Cliente da API do Placar Clube (Laravel, módulo "Placar Clube").
//
// Este módulo NUNCA guarda estado de negócio nem duplica regras que já vivem
// no backend Laravel — é só o transporte HTTP: monta a requisição, autentica
// com o token Sanctum, e traduz a resposta (ou o erro) para quem chamou.
// Toda função recebe `config` como primeiro argumento em vez de ler
// `process.env` diretamente, para ficar testável sem mocks de módulo — ver
// test/placarApi.test.js (mesmo princípio do `now` injetável em
// `comandoCronometro`, gameLogic.js).
//
// `config` = { baseUrl, token, fetchImpl? } — `fetchImpl` é opcional, usado
// só nos testes (default: `fetch` global do Node).

// Erro tipado para status HTTP fora de 2xx — quem chama decide como reagir
// por `status` (ver seção "Erros" de docs/placar-clube-api.md):
//   401 -> parar tudo, avisar operador
//   403 -> erro de configuração, não é retry
//   404 -> bug de estado local do Node (ids dessincronizados)
//   422 -> payload malformado da própria chamada
//   429 -> Node mandando requisições rápido demais, corrigir o buffer
class ErroPlacarApi extends Error {
    constructor(status, corpo) {
        const motivo = corpo && typeof corpo === 'object' && corpo.message
            ? corpo.message
            : `status ${status}`;
        super(`Erro na API do Placar Clube: ${motivo}`);
        this.name = 'ErroPlacarApi';
        this.status = status;
        this.corpo = corpo;
    }
}

function paraQueryString(params = {}) {
    const qs = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
        if (valor !== undefined && valor !== null && valor !== '') qs.set(chave, valor);
    }
    const s = qs.toString();
    return s ? `?${s}` : '';
}

async function chamarApi(config, metodo, caminho, corpo) {
    if (!config || !config.baseUrl || !config.token) {
        throw new Error('placarApi: config.baseUrl e config.token são obrigatórios');
    }
    const fetchImpl = config.fetchImpl || fetch;
    const resp = await fetchImpl(`${config.baseUrl}/api/placar${caminho}`, {
        method: metodo,
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/json',
            ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {})
        },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined
    });

    const texto = await resp.text();
    let dados = null;
    if (texto) {
        try { dados = JSON.parse(texto); } catch { dados = texto; }
    }

    if (!resp.ok) throw new ErroPlacarApi(resp.status, dados);
    return dados;
}

// ---- Diagnóstico / referência ----

function ping(config) {
    return chamarApi(config, 'GET', '/ping');
}

function listarModalidades(config) {
    return chamarApi(config, 'GET', '/modalidades');
}

// ---- Equipes ----

function listarEquipes(config, { busca, modalidade } = {}) {
    return chamarApi(config, 'GET', `/equipes${paraQueryString({ busca, modalidade })}`);
}

function criarEquipe(config, dados) {
    return chamarApi(config, 'POST', '/equipes', dados);
}

function enviarLogoEquipe(config, equipeId, { arquivo_base64 }) {
    return chamarApi(config, 'POST', `/equipes/${equipeId}/logo`, { arquivo_base64 });
}

function removerLogoEquipe(config, equipeId) {
    return chamarApi(config, 'DELETE', `/equipes/${equipeId}/logo`);
}

// ---- Times ----

function listarTimes(config, { modalidade, equipe_id, categoria, busca } = {}) {
    return chamarApi(config, 'GET', `/times${paraQueryString({ modalidade, equipe_id, categoria, busca })}`);
}

function elencoDoTime(config, timeId, { temporada } = {}) {
    return chamarApi(config, 'GET', `/times/${timeId}/elenco${paraQueryString({ temporada })}`);
}

function criarTime(config, dados) {
    return chamarApi(config, 'POST', '/times', dados);
}

function enviarLogoTime(config, timeId, { arquivo_base64 }) {
    return chamarApi(config, 'POST', `/times/${timeId}/logo`, { arquivo_base64 });
}

function removerLogoTime(config, timeId) {
    return chamarApi(config, 'DELETE', `/times/${timeId}/logo`);
}

// ---- Jogadores ----

function criarJogador(config, dados) {
    return chamarApi(config, 'POST', '/jogadores', dados);
}

function enviarFotoJogador(config, jogadorId, { arquivo_base64 }) {
    return chamarApi(config, 'POST', `/jogadores/${jogadorId}/foto`, { arquivo_base64 });
}

function removerFotoJogador(config, jogadorId) {
    return chamarApi(config, 'DELETE', `/jogadores/${jogadorId}/foto`);
}

// Vídeo do jogador (apresentação curta) — ao contrário de logo/foto, a API
// NÃO aceita base64 aqui: só multipart, campo `video`, mp4/webm, até 28MB.
// Por isso não passa por `chamarApi` (que sempre serializa o corpo como
// JSON) — monta o multipart com FormData/Blob nativos do Node.
async function enviarVideoJogador(config, jogadorId, { buffer, nomeArquivo, tipoConteudo }) {
    if (!config || !config.baseUrl || !config.token) {
        throw new Error('placarApi: config.baseUrl e config.token são obrigatórios');
    }
    const fetchImpl = config.fetchImpl || fetch;
    const form = new FormData();
    form.append('video', new Blob([buffer], { type: tipoConteudo || 'video/mp4' }), nomeArquivo || 'video.mp4');

    const resp = await fetchImpl(`${config.baseUrl}/api/placar/jogadores/${jogadorId}/video`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.token}`, 'Accept': 'application/json' },
        body: form
    });
    const texto = await resp.text();
    let dados = null;
    if (texto) { try { dados = JSON.parse(texto); } catch { dados = texto; } }
    if (!resp.ok) throw new ErroPlacarApi(resp.status, dados);
    return dados;
}

function removerVideoJogador(config, jogadorId) {
    return chamarApi(config, 'DELETE', `/jogadores/${jogadorId}/video`);
}

// ---- Jogos — ciclo de vida ----

function listarJogos(config, { status, data, modalidade, competicao_id } = {}) {
    return chamarApi(config, 'GET', `/jogos${paraQueryString({ status, data, modalidade, competicao_id })}`);
}

function obterJogo(config, jogoId) {
    return chamarApi(config, 'GET', `/jogos/${jogoId}`);
}

function criarJogo(config, dados) {
    return chamarApi(config, 'POST', '/jogos', dados);
}

function iniciarJogo(config, jogoId, { operador } = {}) {
    return chamarApi(config, 'POST', `/jogos/${jogoId}/iniciar`, operador !== undefined ? { operador } : {});
}

function salvarEscalacao(config, jogoId, { time_id, jogadores }) {
    return chamarApi(config, 'POST', `/jogos/${jogoId}/escalacao`, { time_id, jogadores });
}

// O endpoint mais chamado durante uma partida — sempre em lote, nunca um
// POST por evento (ver docs/placar-clube-api.md, seção do endpoint de
// eventos). `eventos` já deve vir pronto (uuid/sequencia/ocorrido_em
// preenchidos por placarEventos.js).
function enviarEventos(config, jogoId, eventos) {
    return chamarApi(config, 'POST', `/jogos/${jogoId}/eventos`, { eventos });
}

function encerrarJogo(config, jogoId, dados) {
    return chamarApi(config, 'POST', `/jogos/${jogoId}/encerrar`, dados);
}

function sumulaDoJogo(config, jogoId) {
    return chamarApi(config, 'GET', `/jogos/${jogoId}/sumula`);
}

// Ficha minutada do jogador NESTA partida (lances com minuto, cronometro_ms,
// estornado). Substituto — por partida — do antigo /scout/artilharia.
function atuacaoDoJogador(config, jogoId, jogadorId) {
    return chamarApi(config, 'GET', `/jogos/${jogoId}/jogadores/${jogadorId}/atuacao`);
}

// ---- Scout ----
// GET /scout/artilharia foi REMOVIDO da API (respondia ranking agregado
// entre jogos) — não existe mais substituto 1:1; ver atuacaoDoJogador acima
// e perfilJogador abaixo, ambos organizados por partida.

// Formato de resposta mudou: era perfil agregado com média; agora é lista de
// partidas em que o jogador atuou (pontos/faltas por partida, sem lances).
function perfilJogador(config, jogadorId, { temporada } = {}) {
    return chamarApi(config, 'GET', `/scout/jogadores/${jogadorId}${paraQueryString({ temporada })}`);
}

module.exports = {
    ErroPlacarApi,
    ping,
    listarModalidades,
    listarEquipes,
    criarEquipe,
    enviarLogoEquipe,
    removerLogoEquipe,
    listarTimes,
    elencoDoTime,
    criarTime,
    enviarLogoTime,
    removerLogoTime,
    criarJogador,
    enviarFotoJogador,
    removerFotoJogador,
    enviarVideoJogador,
    removerVideoJogador,
    listarJogos,
    obterJogo,
    criarJogo,
    iniciarJogo,
    salvarEscalacao,
    enviarEventos,
    encerrarJogo,
    sumulaDoJogo,
    atuacaoDoJogador,
    perfilJogador
};
