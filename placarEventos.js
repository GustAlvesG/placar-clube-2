// Fila de eventos para o endpoint POST /jogos/{jogo}/eventos da API do
// Placar Clube (ver docs/placar-clube-api.md). Responsabilidades deste
// módulo, e só estas:
//
//   1. Gerar `uuid` (idempotência) e `sequencia` (ordem) no momento em que o
//      evento acontece — nunca no momento do envio, para que um retry
//      reenvie exatamente o mesmo uuid.
//   2. Acumular eventos pendentes e mandá-los em lote (nunca um POST por
//      evento).
//   3. Traduzir uma correção (`sub_ponto`/`sub_falta`/`sub_set` do placar
//      local) em um evento `estorno` referenciando o uuid original — o log
//      é append-only, nunca há UPDATE/DELETE de um evento já enviado.
//
// Não duplica regra de negócio nenhuma da API: não decide se um ponto vale
// 1/2/3, não decide quando um set termina — isso já aconteceu em
// gameLogic.js. Este módulo só sabe transformar a *ação já aplicada* no
// payload que a API espera.

const crypto = require('crypto');

// "Y-m-d H:i:s.v" (precisão de milissegundo), hora local do servidor —
// mesmo padrão dos exemplos em docs/placar-clube-api.md.
function formatarOcorridoEm(data = new Date()) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())} `
        + `${pad(data.getHours())}:${pad(data.getMinutes())}:${pad(data.getSeconds())}.${pad(data.getMilliseconds(), 3)}`;
}

// Estado da fila de um jogo. `ultimaSequencia` retoma de onde uma conexão
// anterior parou (resposta de POST /jogos/{jogo}/iniciar) — nunca reinicia
// do zero se a partida já tinha eventos.
function criarEstadoFila(ultimaSequencia = 0) {
    return {
        sequencia: ultimaSequencia,
        pendentes: [],       // eventos gerados, ainda não confirmados pela API
        ultimosPorChave: {}, // chave (ex.: "timeA:ponto") -> uuid do último evento dessa chave, p/ estorno
        enviando: false,
        ultimoErro: null
    };
}

// Registra um evento novo na fila e devolve o objeto pronto para enviar.
// `campos.chaveEstorno`, se presente, marca este evento como "desfazível":
// uma chamada futura a `criarEstorno` com a mesma chave vai referenciá-lo.
function registrarEvento(fila, campos, agora = new Date()) {
    fila.sequencia += 1;
    const evento = {
        uuid: crypto.randomUUID(),
        sequencia: fila.sequencia,
        tipo: campos.tipo,
        time_id: campos.time_id,
        jogador_id: campos.jogador_id,
        valor: campos.valor,
        periodo: campos.periodo,
        cronometro_ms: campos.cronometro_ms,
        ocorrido_em: formatarOcorridoEm(agora),
        payload: campos.payload ?? null
    };
    fila.pendentes.push(evento);
    if (campos.chaveEstorno) fila.ultimosPorChave[campos.chaveEstorno] = evento.uuid;
    return evento;
}

// Gera o `estorno` de correção referenciando o último evento registrado sob
// `chaveEstorno`. Devolve `null` (sem lançar) se não há o que desfazer
// remotamente — ex.: app reiniciado no meio do jogo e perdeu o rastro em
// memória; nesse caso o placar local ainda é ajustado, mas cabe ao operador
// saber que a correção não chegou à API (avisar na UI, não falhar em
// silêncio).
function criarEstorno(fila, chaveEstorno, motivo, agora = new Date()) {
    const uuidOriginal = fila.ultimosPorChave[chaveEstorno];
    if (!uuidOriginal) return null;
    delete fila.ultimosPorChave[chaveEstorno]; // não deixa um 2º desfazer referenciar o mesmo evento
    return registrarEvento(fila, { tipo: 'estorno', payload: { evento_uuid: uuidOriginal, motivo } }, agora);
}

// Traduz uma ação de `comando_placar` (gameLogic.js) na intenção de evento
// correspondente. Devolve `{ modo: 'ignorar' }` quando a ação não tem
// representação 1:1 na API — notavelmente `zerar_tudo`: é um reset manual
// do Node sem equivalente de "desfazer tudo" no log append-only, então não
// tenta sincronizar automaticamente (ver seção "Regras por modalidade" e
// "estorno" da doc: correção é sempre um evento novo, não um reset em massa).
// `time` continua como 'timeA'/'timeB' — a resolução para o `time_id` da
// Laravel é responsabilidade de quem chama (server.js), que é quem guarda
// esse mapeamento.
// `ponto` e `falta` agora EXIGEM cronometro_ms na API (inteiro, ms, >= 0) — um
// evento sem isso volta em `rejeitados` e some do placar/súmula. Nunca deixa
// o campo undefined/negativo/fracionário chegar até lá: normaliza para 0
// quando o chamador não conseguiu determinar o tempo do cronômetro.
function normalizarCronometroMs(valor) {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function traduzirAcaoPlacar({ acao, time, valor, jogador, periodo, cronometroMs, parcial }) {
    const jogadorId = jogador && jogador.jogador_id;
    switch (acao) {
        case 'add_ponto':
            return {
                modo: 'registrar',
                chaveEstorno: `${time}:ponto`,
                time,
                campos: { tipo: 'ponto', jogador_id: jogadorId, valor: valor || 1, periodo, cronometro_ms: normalizarCronometroMs(cronometroMs) }
            };
        case 'sub_ponto':
            return { modo: 'estornar', chaveEstorno: `${time}:ponto`, motivo: 'ponto desfeito pelo operador' };
        case 'add_falta':
            return {
                modo: 'registrar',
                chaveEstorno: `${time}:falta`,
                time,
                campos: { tipo: 'falta', jogador_id: jogadorId, periodo, cronometro_ms: normalizarCronometroMs(cronometroMs) }
            };
        case 'sub_falta':
            return { modo: 'estornar', chaveEstorno: `${time}:falta`, motivo: 'falta desfeita pelo operador' };
        case 'add_set':
            return { modo: 'registrar', chaveEstorno: `${time}:set`, time, campos: { tipo: 'set', periodo } };
        case 'sub_set':
            return { modo: 'estornar', chaveEstorno: `${time}:set`, motivo: 'set desfeito pelo operador' };
        // Fechamento de parcial (set no vôlei, quarto no basquete): é o mesmo
        // evento `set` da API, com `time` = quem levou a parcial (null num
        // quarto empatado de basquete, e aí o evento fica sem time_id).
        // O placar da parcial vai em `payload` — campo livre, o mesmo em que o
        // estorno guarda `evento_uuid`/`motivo` — para que a súmula monte o
        // set a set sem ter que reprocessar todos os pontos. Ver a seção
        // "Rota/contrato pendente" no README: hoje é informativo, a API ainda
        // não expõe as parciais de volta.
        case 'fechar_set':
            return {
                modo: 'registrar',
                chaveEstorno: `${time}:set`,
                time,
                campos: {
                    tipo: 'set',
                    periodo,
                    payload: parcial
                        ? { numero: parcial.numero, placar_casa: parcial.a, placar_visitante: parcial.b }
                        : null
                }
            };
        case 'reabrir_set':
            return { modo: 'estornar', chaveEstorno: `${time}:set`, motivo: 'set reaberto pelo operador' };
        case 'add_periodo':
        case 'sub_periodo':
            return { modo: 'registrar', time: null, campos: { tipo: 'periodo', periodo } };
        default:
            return { modo: 'ignorar' };
    }
}

function traduzirAcaoCronometro({ acao, periodo }) {
    const mapaTipo = { play: 'crono_play', pause: 'crono_pause', set: 'crono_set' };
    const tipo = mapaTipo[acao];
    if (!tipo) return { modo: 'ignorar' };
    return { modo: 'registrar', time: null, campos: { tipo, periodo } };
}

// Envia os eventos pendentes em um único lote. Idempotente por natureza do
// endpoint (uuid) — seguro chamar de novo se a chamada anterior falhou por
// rede. Só remove da fila os uuids que a API confirmou ter processado
// (aceitos, duplicados OU rejeitados — rejeitado também é "processado", só
// que com motivo; fica para quem chamou decidir o que fazer com o motivo).
// Eventos registrados *depois* que o lote já foi montado continuam na fila
// para o próximo envio.
async function enviarPendentes(apiCliente, config, jogoId, fila) {
    if (fila.enviando || fila.pendentes.length === 0) return null;
    fila.enviando = true;
    const lote = fila.pendentes.slice();
    try {
        const resultado = await apiCliente.enviarEventos(config, jogoId, lote);
        const processados = new Set([
            ...(resultado.aceitos || []),
            ...(resultado.duplicados || []),
            ...(resultado.rejeitados || []).map(r => r.uuid)
        ]);
        fila.pendentes = fila.pendentes.filter(e => !processados.has(e.uuid));
        fila.ultimoErro = null;
        return resultado;
    } catch (erro) {
        fila.ultimoErro = erro;
        throw erro;
    } finally {
        fila.enviando = false;
    }
}

module.exports = {
    formatarOcorridoEm,
    criarEstadoFila,
    registrarEvento,
    criarEstorno,
    traduzirAcaoPlacar,
    traduzirAcaoCronometro,
    enviarPendentes
};
