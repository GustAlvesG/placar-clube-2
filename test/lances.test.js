// Lance a lance, correção de lance específico e aviso de faltas — o que a
// mesa usa na gaveta "Lances", no "Desfazer" do rodapé e nos pontos de falta.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../gameLogic');
const eventos = require('../placarEventos');

function novoEstado(overrides = {}) {
    return Object.assign(logic.criarEstadoInicial(), overrides);
}

// ---------------------------------------------------------------------------
// Registro de lances
// ---------------------------------------------------------------------------
test('add_ponto registra um lance com jogador enxuto e o tempo do cronômetro', () => {
    const s = novoEstado();
    s.cronometro = { rodando: true, tempoAcumulado: 60000, inicioTimestamp: 1000, duracaoConfigurada: 600000 };
    const jogador = { numero: '10', nome: 'Rafael', foto: 'data:image/png;base64,AAAA', jogador_id: 7 };
    const { lance } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 2, jogador }, 6000);
    assert.equal(s.lances.length, 1);
    assert.equal(lance, s.lances[0]);
    assert.equal(lance.tipo, 'ponto');
    assert.equal(lance.time, 'timeA');
    assert.equal(lance.valor, 2);
    assert.deepEqual(lance.jogador, { numero: '10', nome: 'Rafael' }); // sem foto no broadcast
    assert.equal(lance.cronometroMs, 65000);
    assert.equal(lance.restanteMs, 535000);
    assert.equal(lance.periodo, 1);
    assert.equal(lance.parcial, 1);
    assert.equal(lance.estornado, false);
});

test('add_falta registra lance; sem jogador fica jogador null', () => {
    const s = novoEstado();
    const { lance } = logic.comandoPlacar(s, { time: 'timeB', acao: 'add_falta', valor: 1 });
    assert.equal(lance.tipo, 'falta');
    assert.equal(lance.jogador, null);
    assert.equal(s.timeB.faltas, 1);
});

test('ações que não são lance não registram nada', () => {
    const s = novoEstado();
    const { lance } = logic.comandoPlacar(s, { acao: 'add_periodo', valor: 1 });
    assert.equal(lance, null);
    assert.deepEqual(s.lances, []);
});

test('ids de lance são crescentes e não voltam a zero no zerar_tudo', () => {
    const s = novoEstado();
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    logic.comandoPlacar(s, { acao: 'zerar_tudo' });
    assert.deepEqual(s.lances, []);
    const { lance } = logic.comandoPlacar(s, { time: 'timeB', acao: 'add_ponto', valor: 1 });
    assert.equal(lance.id, 3);
});

// ---------------------------------------------------------------------------
// estornar_lance
// ---------------------------------------------------------------------------
test('estornar_lance tira exatamente o valor daquele lance e marca estornado', () => {
    const s = novoEstado({ esporte: 'basquete' });
    const { lance: tres } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 3 });
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 2 });
    const { estornado } = logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: tres.id });
    assert.equal(s.timeA.placar, 2);
    assert.equal(estornado, tres);
    assert.equal(tres.estornado, true);
    assert.equal(s.lances.length, 2); // não apaga
});

test('estornar_lance de falta tira uma falta', () => {
    const s = novoEstado();
    const { lance } = logic.comandoPlacar(s, { time: 'timeB', acao: 'add_falta', valor: 1 });
    logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: lance.id });
    assert.equal(s.timeB.faltas, 0);
    assert.equal(lance.estornado, true);
});

test('estornar_lance duas vezes não desconta duas vezes', () => {
    const s = novoEstado();
    const { lance } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: lance.id });
    const { estornado } = logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: lance.id });
    assert.equal(s.timeA.placar, 1);
    assert.equal(estornado, null);
});

test('estornar_lance com id desconhecido é ignorado', () => {
    const s = novoEstado();
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    const { estornado } = logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: 999 });
    assert.equal(estornado, null);
    assert.equal(s.timeA.placar, 1);
});

test('estornar_lance não emite animação', () => {
    const s = novoEstado();
    const { lance } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    const { animacoes } = logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: lance.id });
    assert.deepEqual(animacoes, []);
});

test('ponto de um set já fechado não é estornável; volta a ser se o set reabrir', () => {
    const s = novoEstado({ esporte: 'volei' });
    const { lance } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    s.timeA.placar = 25; s.timeB.placar = 20;
    logic.comandoPlacar(s, { acao: 'fechar_set' });
    assert.equal(logic.lanceEstornavel(s, lance), false);
    logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: lance.id });
    assert.equal(s.timeA.placar, 0); // placar do set novo intacto
    logic.comandoPlacar(s, { acao: 'reabrir_set' });
    assert.equal(logic.lanceEstornavel(s, lance), true);
});

test('fechar_set registra lance de set com o placar; reabrir_set marca esse lance estornado', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25; s.timeB.placar = 23;
    const { lance } = logic.comandoPlacar(s, { acao: 'fechar_set' });
    assert.equal(lance.tipo, 'set');
    assert.equal(lance.time, 'timeA');
    assert.deepEqual(lance.placar, { a: 25, b: 23 });
    assert.equal(lance.parcial, 1);
    assert.equal(logic.lanceEstornavel(s, lance), true);
    logic.comandoPlacar(s, { acao: 'reabrir_set' });
    assert.equal(lance.estornado, true);
});

test('só o último fechamento de set é estornável, e nunca por estornar_lance', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25; s.timeB.placar = 10;
    const { lance: primeiro } = logic.comandoPlacar(s, { acao: 'fechar_set' });
    s.timeB.placar = 25;
    const { lance: segundo } = logic.comandoPlacar(s, { acao: 'fechar_set' });
    assert.equal(logic.lanceEstornavel(s, primeiro), false);
    assert.equal(logic.lanceEstornavel(s, segundo), true);
    logic.comandoPlacar(s, { acao: 'estornar_lance', lanceId: segundo.id });
    assert.equal(segundo.estornado, false);
    assert.equal(s.parciais.length, 2);
});

test('falta de período anterior não é estornável', () => {
    const s = novoEstado();
    const { lance } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_falta', valor: 1 });
    logic.comandoPlacar(s, { acao: 'add_periodo', valor: 1 });
    logic.comandoPlacar(s, { acao: 'zerar_faltas' });
    assert.equal(logic.lanceEstornavel(s, lance), false);
});

test('lancesParaTela acrescenta estornavel sem mutar o estado', () => {
    const s = novoEstado();
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    const lista = logic.lancesParaTela(s);
    assert.equal(lista[0].estornavel, true);
    assert.equal('estornavel' in s.lances[0], false);
});

test('estado antigo sem lances não quebra comandoPlacar nem lancesParaTela', () => {
    const s = novoEstado();
    delete s.lances; delete s.seqLance;
    assert.deepEqual(logic.lancesParaTela(s), []);
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.lances.length, 1);
    assert.equal(s.lances[0].id, 1);
});

// ---------------------------------------------------------------------------
// Faltas: zerar na troca de período e aviso de limite
// ---------------------------------------------------------------------------
test('zerar_faltas zera as faltas dos dois times e mais nada', () => {
    const s = novoEstado();
    s.timeA.faltas = 4; s.timeB.faltas = 2; s.timeA.placar = 3; s.periodo = 2;
    logic.comandoPlacar(s, { acao: 'zerar_faltas' });
    assert.equal(s.timeA.faltas, 0);
    assert.equal(s.timeB.faltas, 0);
    assert.equal(s.timeA.placar, 3);
    assert.equal(s.periodo, 2);
});

test('limiteFaltas: 5 no futsal, 4 no basquete, nenhum no vôlei', () => {
    assert.equal(logic.limiteFaltas(novoEstado({ esporte: 'futsal' })), 5);
    assert.equal(logic.limiteFaltas(novoEstado({ esporte: 'basquete' })), 4);
    assert.equal(logic.limiteFaltas(novoEstado({ esporte: 'volei' })), null);
});

test('alertaFaltas acende no limite, por time', () => {
    const s = novoEstado({ esporte: 'futsal' });
    s.timeA.faltas = 4; s.timeB.faltas = 5;
    assert.deepEqual(logic.alertaFaltas(s), { timeA: false, timeB: true });
    const b = novoEstado({ esporte: 'basquete' });
    b.timeA.faltas = 4;
    assert.deepEqual(logic.alertaFaltas(b), { timeA: true, timeB: false });
    const v = novoEstado({ esporte: 'volei' });
    v.timeA.faltas = 9;
    assert.deepEqual(logic.alertaFaltas(v), { timeA: false, timeB: false });
});

// ---------------------------------------------------------------------------
// placarEventos.estornarEvento — estorno de um evento específico na API
// ---------------------------------------------------------------------------
test('estornarEvento referencia o uuid dado, mesmo que não seja o último da chave', () => {
    const fila = eventos.criarEstadoFila(0);
    const primeiro = eventos.registrarEvento(fila, { tipo: 'ponto', chaveEstorno: 'timeA:ponto' });
    const segundo = eventos.registrarEvento(fila, { tipo: 'ponto', chaveEstorno: 'timeA:ponto' });
    const estorno = eventos.estornarEvento(fila, primeiro.uuid, 'ponto desfeito pelo operador');
    assert.equal(estorno.tipo, 'estorno');
    assert.equal(estorno.payload.evento_uuid, primeiro.uuid);
    assert.equal(fila.ultimosPorChave['timeA:ponto'], segundo.uuid); // era outro evento
});

test('estornarEvento esquece a chave que apontava para o evento estornado', () => {
    const fila = eventos.criarEstadoFila(0);
    const ev = eventos.registrarEvento(fila, { tipo: 'falta', chaveEstorno: 'timeB:falta' });
    eventos.estornarEvento(fila, ev.uuid, 'falta desfeita pelo operador');
    assert.equal(eventos.criarEstorno(fila, 'timeB:falta', 'de novo'), null);
});

test('estornarEvento sem uuid devolve null e não registra nada', () => {
    const fila = eventos.criarEstadoFila(0);
    assert.equal(eventos.estornarEvento(fila, undefined, 'x'), null);
    assert.equal(fila.pendentes.length, 0);
});
