const { test } = require('node:test');
const assert = require('node:assert/strict');
const fila = require('../placarEventos');

// ---- formatarOcorridoEm ----

test('formatarOcorridoEm formata "Y-m-d H:i:s.v" com precisão de milissegundo', () => {
    const data = new Date(2026, 0, 5, 9, 3, 7, 42); // 2026-01-05 09:03:07.042
    assert.equal(fila.formatarOcorridoEm(data), '2026-01-05 09:03:07.042');
});

// ---- criarEstadoFila / registrarEvento ----

test('criarEstadoFila retoma a partir de ultima_sequencia, não do zero', () => {
    const estado = fila.criarEstadoFila(41);
    const evento = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    assert.equal(evento.sequencia, 42);
});

test('registrarEvento gera uuid único por evento e preenche os campos documentados', () => {
    const estado = fila.criarEstadoFila(0);
    const agora = new Date(2026, 7, 6, 19, 34, 12, 500);
    const evento = fila.registrarEvento(estado, {
        tipo: 'ponto', time_id: 1, jogador_id: 7, valor: 1, periodo: 1, cronometro_ms: 542000
    }, agora);
    assert.match(evento.uuid, /^[0-9a-f-]{36}$/);
    assert.equal(evento.sequencia, 1);
    assert.equal(evento.tipo, 'ponto');
    assert.equal(evento.time_id, 1);
    assert.equal(evento.jogador_id, 7);
    assert.equal(evento.valor, 1);
    assert.equal(evento.periodo, 1);
    assert.equal(evento.cronometro_ms, 542000);
    assert.equal(evento.ocorrido_em, '2026-08-06 19:34:12.500');
    assert.equal(evento.payload, null);
    assert.equal(estado.pendentes.length, 1);
    assert.equal(estado.pendentes[0], evento);
});

test('dois eventos seguidos incrementam sequencia e geram uuids diferentes', () => {
    const estado = fila.criarEstadoFila(0);
    const e1 = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    const e2 = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    assert.equal(e1.sequencia, 1);
    assert.equal(e2.sequencia, 2);
    assert.notEqual(e1.uuid, e2.uuid);
});

// ---- criarEstorno ----

test('criarEstorno referencia o uuid do último evento registrado sob a mesma chave', () => {
    const estado = fila.criarEstadoFila(0);
    const original = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1, chaveEstorno: 'timeA:ponto' });
    const estorno = fila.criarEstorno(estado, 'timeA:ponto', 'ponto lançado errado');
    assert.equal(estorno.tipo, 'estorno');
    assert.deepEqual(estorno.payload, { evento_uuid: original.uuid, motivo: 'ponto lançado errado' });
    assert.equal(estado.pendentes.length, 2);
});

test('criarEstorno devolve null quando não há evento rastreado para a chave (ex.: app reiniciado)', () => {
    const estado = fila.criarEstadoFila(0);
    const resultado = fila.criarEstorno(estado, 'timeA:ponto', 'motivo qualquer');
    assert.equal(resultado, null);
    assert.equal(estado.pendentes.length, 0);
});

test('um segundo estorno da mesma chave não referencia o evento já estornado', () => {
    const estado = fila.criarEstadoFila(0);
    fila.registrarEvento(estado, { tipo: 'ponto', valor: 1, chaveEstorno: 'timeA:ponto' });
    fila.criarEstorno(estado, 'timeA:ponto', 'primeiro desfazer');
    const segundo = fila.criarEstorno(estado, 'timeA:ponto', 'segundo desfazer');
    assert.equal(segundo, null);
});

// ---- traduzirAcaoPlacar ----

test('add_ponto vira registrar tipo ponto com chaveEstorno rastreável', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA', valor: 2, jogador: { jogador_id: 9 }, periodo: 2, cronometroMs: 1000 });
    assert.equal(t.modo, 'registrar');
    assert.equal(t.chaveEstorno, 'timeA:ponto');
    assert.deepEqual(t.campos, { tipo: 'ponto', jogador_id: 9, valor: 2, periodo: 2, cronometro_ms: 1000 });
});

test('add_ponto sem valor explícito default para 1', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeB' });
    assert.equal(t.campos.valor, 1);
});

// cronometro_ms passou a ser obrigatório em ponto/falta na API — um evento
// sem isso volta em rejeitados. Nunca deixamos passar undefined/negativo/fracionário.
test('add_ponto sem cronometroMs normaliza para 0 (nunca undefined)', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA' });
    assert.equal(t.campos.cronometro_ms, 0);
});

test('add_ponto preserva cronometroMs válido (inteiro >= 0)', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA', cronometroMs: 754000 });
    assert.equal(t.campos.cronometro_ms, 754000);
});

test('add_ponto arredonda cronometroMs fracionário', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA', cronometroMs: 754000.7 });
    assert.equal(t.campos.cronometro_ms, 754001);
});

test('add_ponto com cronometroMs negativo/inválido normaliza para 0', () => {
    assert.equal(fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA', cronometroMs: -50 }).campos.cronometro_ms, 0);
    assert.equal(fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA', cronometroMs: NaN }).campos.cronometro_ms, 0);
    assert.equal(fila.traduzirAcaoPlacar({ acao: 'add_ponto', time: 'timeA', cronometroMs: undefined }).campos.cronometro_ms, 0);
});

test('add_falta também normaliza cronometro_ms', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'add_falta', time: 'timeB', cronometroMs: 12345.9 });
    assert.equal(t.campos.cronometro_ms, 12346);
});

test('sub_ponto vira estornar referenciando a mesma chave do add_ponto', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'sub_ponto', time: 'timeA' });
    assert.equal(t.modo, 'estornar');
    assert.equal(t.chaveEstorno, 'timeA:ponto');
});

test('add_falta / sub_falta seguem o mesmo padrão de par registrar/estornar', () => {
    const add = fila.traduzirAcaoPlacar({ acao: 'add_falta', time: 'timeB', jogador: { jogador_id: 3 } });
    const sub = fila.traduzirAcaoPlacar({ acao: 'sub_falta', time: 'timeB' });
    assert.equal(add.campos.tipo, 'falta');
    assert.equal(add.chaveEstorno, 'timeB:falta');
    assert.equal(sub.modo, 'estornar');
    assert.equal(sub.chaveEstorno, 'timeB:falta');
});

test('zerar_tudo não tem tradução — não sincroniza automaticamente com a API', () => {
    const t = fila.traduzirAcaoPlacar({ acao: 'zerar_tudo', time: 'timeA' });
    assert.equal(t.modo, 'ignorar');
});

test('ação de placar desconhecida é ignorada, não lança', () => {
    assert.equal(fila.traduzirAcaoPlacar({ acao: 'inexistente' }).modo, 'ignorar');
});

// ---- traduzirAcaoCronometro ----

test('play/pause/set do cronômetro viram crono_play/crono_pause/crono_set', () => {
    assert.equal(fila.traduzirAcaoCronometro({ acao: 'play' }).campos.tipo, 'crono_play');
    assert.equal(fila.traduzirAcaoCronometro({ acao: 'pause' }).campos.tipo, 'crono_pause');
    assert.equal(fila.traduzirAcaoCronometro({ acao: 'set' }).campos.tipo, 'crono_set');
});

test('ação de cronômetro desconhecida é ignorada', () => {
    assert.equal(fila.traduzirAcaoCronometro({ acao: 'nope' }).modo, 'ignorar');
});

// ---- enviarPendentes ----

function apiFake(resultado, { erro } = {}) {
    const chamadas = [];
    return {
        chamadas,
        enviarEventos: async (config, jogoId, eventos) => {
            chamadas.push({ config, jogoId, eventos });
            if (erro) throw erro;
            return resultado;
        }
    };
}

test('enviarPendentes manda o lote e remove da fila os uuids aceitos', async () => {
    const estado = fila.criarEstadoFila(0);
    const e1 = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    const api = apiFake({ aceitos: [e1.uuid], duplicados: [], rejeitados: [] });
    const resultado = await fila.enviarPendentes(api, {}, 42, estado);
    assert.equal(resultado.aceitos.length, 1);
    assert.equal(estado.pendentes.length, 0);
    assert.equal(api.chamadas[0].jogoId, 42);
});

test('enviarPendentes remove também duplicados e rejeitados (a API já processou, só não aceitou)', async () => {
    const estado = fila.criarEstadoFila(0);
    const e1 = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    const e2 = fila.registrarEvento(estado, { tipo: 'falta' });
    const api = apiFake({ aceitos: [], duplicados: [e1.uuid], rejeitados: [{ uuid: e2.uuid, motivo: 'inválido' }] });
    await fila.enviarPendentes(api, {}, 42, estado);
    assert.equal(estado.pendentes.length, 0);
});

test('enviarPendentes com fila vazia não chama a API', async () => {
    const estado = fila.criarEstadoFila(0);
    const api = apiFake({ aceitos: [], duplicados: [], rejeitados: [] });
    const resultado = await fila.enviarPendentes(api, {}, 42, estado);
    assert.equal(resultado, null);
    assert.equal(api.chamadas.length, 0);
});

test('falha de rede mantém os eventos na fila para retry e registra o erro', async () => {
    const estado = fila.criarEstadoFila(0);
    fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    const falha = new Error('network down');
    const api = apiFake(null, { erro: falha });
    await assert.rejects(() => fila.enviarPendentes(api, {}, 42, estado), falha);
    assert.equal(estado.pendentes.length, 1);
    assert.equal(estado.ultimoErro, falha);
    assert.equal(estado.enviando, false); // não trava um envio futuro
});

test('evento registrado durante um envio em voo permanece pendente após o envio terminar', async () => {
    const estado = fila.criarEstadoFila(0);
    const e1 = fila.registrarEvento(estado, { tipo: 'ponto', valor: 1 });
    let jaRegistrouOSegundo = false;
    const api = {
        enviarEventos: async () => {
            // Simula um evento novo chegando enquanto o POST ainda está em voo.
            fila.registrarEvento(estado, { tipo: 'falta' });
            jaRegistrouOSegundo = true;
            return { aceitos: [e1.uuid], duplicados: [], rejeitados: [] };
        }
    };
    await fila.enviarPendentes(api, {}, 42, estado);
    assert.ok(jaRegistrouOSegundo);
    assert.equal(estado.pendentes.length, 1); // só o e1 foi confirmado; o novo continua pendente
    assert.equal(estado.pendentes[0].tipo, 'falta');
});
