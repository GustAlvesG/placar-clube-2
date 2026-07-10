const { test } = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../gameLogic');

// Estado limpo a cada cenário, sempre partindo do padrão real.
function novoEstado(overrides = {}) {
    return Object.assign(logic.criarEstadoInicial(), overrides);
}

// ---------------------------------------------------------------------------
// criarEstadoInicial
// ---------------------------------------------------------------------------
test('criarEstadoInicial retorna o estado padrão esperado', () => {
    const s = logic.criarEstadoInicial();
    assert.equal(s.esporte, 'futsal');
    assert.equal(s.sacando, null);
    assert.equal(s.periodo, 1);
    assert.equal(s.transmissaoAtiva, false);
    assert.equal(s.timeA.placar, 0);
    assert.equal(s.timeB.faltas, 0);
    assert.deepEqual(s.timeA.elenco, []);
    assert.equal(s.cronometro.duracaoConfigurada, 600000);
});

test('criarEstadoInicial gera objetos independentes (sem estado compartilhado)', () => {
    const a = logic.criarEstadoInicial();
    const b = logic.criarEstadoInicial();
    a.timeA.placar = 5;
    a.timeA.elenco.push({ nome: 'X' });
    assert.equal(b.timeA.placar, 0);
    assert.deepEqual(b.timeA.elenco, []);
});

// ---------------------------------------------------------------------------
// comandoPlacar — pontos
// ---------------------------------------------------------------------------
test('add_ponto soma pelo valor e define o time que sacou', () => {
    const s = novoEstado();
    const { animacoes } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 2 });
    assert.equal(s.timeA.placar, 2);
    assert.equal(s.sacando, 'timeA');
    assert.deepEqual(animacoes, []);
});

test('add_ponto com jogador emite animação com texto por esporte', () => {
    for (const [esporte, texto] of [['futsal', 'GOL!'], ['basquete', 'CESTA!'], ['volei', 'PONTO!']]) {
        const s = novoEstado({ esporte });
        s.timeA.nome = 'Águia';
        const jogador = { numero: '10', nome: 'João', foto: '' };
        const { animacoes } = logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1, jogador });
        assert.equal(animacoes.length, 1);
        assert.equal(animacoes[0].name, 'animacao_ponto');
        assert.deepEqual(animacoes[0].payload, { texto, jogador, timeNome: 'Águia' });
    }
});

test('add_ponto sem jogador não emite animação', () => {
    const s = novoEstado();
    const { animacoes } = logic.comandoPlacar(s, { time: 'timeB', acao: 'add_ponto', valor: 3 });
    assert.equal(s.timeB.placar, 3);
    assert.deepEqual(animacoes, []);
});

test('sub_ponto decrementa mas nunca abaixo de zero', () => {
    const s = novoEstado();
    s.timeA.placar = 1;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'sub_ponto', valor: 1 });
    assert.equal(s.timeA.placar, 0);
    // já em zero, não muda
    logic.comandoPlacar(s, { time: 'timeA', acao: 'sub_ponto', valor: 1 });
    assert.equal(s.timeA.placar, 0);
});

// ---------------------------------------------------------------------------
// comandoPlacar — vôlei (set automático)
// ---------------------------------------------------------------------------
test('vôlei: 25x23 vence o set, zera placares e limpa o saque', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 23;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.sets, 1);
    assert.equal(s.timeA.placar, 0);
    assert.equal(s.timeB.placar, 0);
    assert.equal(s.sacando, null);
});

test('vôlei: 25x24 NÃO vence o set (diferença menor que 2)', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 24;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.sets, 0);
    assert.equal(s.timeA.placar, 25);
    assert.equal(s.timeB.placar, 24);
});

test('vôlei: 26x24 vence o set por vantagem', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25;
    s.timeB.placar = 24;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.sets, 1);
    assert.equal(s.timeA.placar, 0);
    assert.equal(s.timeB.placar, 0);
});

test('futsal: chegar a 25 não dispara lógica de set', () => {
    const s = novoEstado({ esporte: 'futsal' });
    s.timeA.placar = 24;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.placar, 25);
    assert.equal(s.timeA.sets, 0);
});

// ---------------------------------------------------------------------------
// comandoPlacar — sets, faltas, período
// ---------------------------------------------------------------------------
test('add_set / sub_set respeitam o piso zero', () => {
    const s = novoEstado();
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_set' });
    assert.equal(s.timeA.sets, 1);
    logic.comandoPlacar(s, { time: 'timeA', acao: 'sub_set' });
    assert.equal(s.timeA.sets, 0);
    logic.comandoPlacar(s, { time: 'timeA', acao: 'sub_set' });
    assert.equal(s.timeA.sets, 0);
});

test('add_falta com jogador emite animação FALTA!', () => {
    const s = novoEstado();
    s.timeB.nome = 'Leões';
    const jogador = { numero: '7', nome: 'Pedro', foto: 'data:img' };
    const { animacoes } = logic.comandoPlacar(s, { time: 'timeB', acao: 'add_falta', jogador });
    assert.equal(s.timeB.faltas, 1);
    assert.equal(animacoes.length, 1);
    assert.deepEqual(animacoes[0].payload, { texto: 'FALTA!', jogador, timeNome: 'Leões' });
});

test('add_falta sem jogador não emite animação', () => {
    const s = novoEstado();
    const { animacoes } = logic.comandoPlacar(s, { time: 'timeB', acao: 'add_falta' });
    assert.equal(s.timeB.faltas, 1);
    assert.deepEqual(animacoes, []);
});

test('sub_falta nunca fica negativo', () => {
    const s = novoEstado();
    logic.comandoPlacar(s, { time: 'timeA', acao: 'sub_falta' });
    assert.equal(s.timeA.faltas, 0);
});

test('add_periodo incrementa; sub_periodo nunca abaixo de 1', () => {
    const s = novoEstado();
    logic.comandoPlacar(s, { acao: 'add_periodo' });
    assert.equal(s.periodo, 2);
    logic.comandoPlacar(s, { acao: 'sub_periodo' });
    assert.equal(s.periodo, 1);
    logic.comandoPlacar(s, { acao: 'sub_periodo' });
    assert.equal(s.periodo, 1);
});

// ---------------------------------------------------------------------------
// comandoPlacar — zerar_tudo
// ---------------------------------------------------------------------------
test('zerar_tudo reseta placar, sets, faltas, sacando, período, transmissão e cronômetro', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 10; s.timeA.sets = 2; s.timeA.faltas = 3;
    s.timeB.placar = 8; s.timeB.sets = 1; s.timeB.faltas = 4;
    s.sacando = 'timeA'; s.periodo = 3; s.transmissaoAtiva = true;
    s.cronometro = { rodando: true, tempoAcumulado: 5000, inicioTimestamp: 123, duracaoConfigurada: 600000 };

    logic.comandoPlacar(s, { acao: 'zerar_tudo' });

    assert.equal(s.timeA.placar, 0); assert.equal(s.timeA.sets, 0); assert.equal(s.timeA.faltas, 0);
    assert.equal(s.timeB.placar, 0); assert.equal(s.timeB.sets, 0); assert.equal(s.timeB.faltas, 0);
    assert.equal(s.sacando, null);
    assert.equal(s.periodo, 1);
    assert.equal(s.transmissaoAtiva, false);
    assert.equal(s.cronometro.rodando, false);
    assert.equal(s.cronometro.tempoAcumulado, 0);
    assert.equal(s.cronometro.inicioTimestamp, 0);
});

// ---------------------------------------------------------------------------
// comandoCronometro (now injetado)
// ---------------------------------------------------------------------------
test('play liga o cronômetro e grava o inicioTimestamp', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'play' }, 1000);
    assert.equal(s.cronometro.rodando, true);
    assert.equal(s.cronometro.inicioTimestamp, 1000);
});

test('play não faz nada se já estiver rodando', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'play' }, 1000);
    logic.comandoCronometro(s, { acao: 'play' }, 5000);
    assert.equal(s.cronometro.inicioTimestamp, 1000);
});

test('pause acumula o tempo decorrido e desliga', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'play' }, 1000);
    logic.comandoCronometro(s, { acao: 'pause' }, 4000);
    assert.equal(s.cronometro.rodando, false);
    assert.equal(s.cronometro.tempoAcumulado, 3000);
});

test('pause não faz nada se não estiver rodando', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'pause' }, 4000);
    assert.equal(s.cronometro.tempoAcumulado, 0);
});

test('play após pause continua somando o tempo acumulado', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'play' }, 1000);
    logic.comandoCronometro(s, { acao: 'pause' }, 3000); // +2000
    logic.comandoCronometro(s, { acao: 'play' }, 10000);
    logic.comandoCronometro(s, { acao: 'pause' }, 10500); // +500
    assert.equal(s.cronometro.tempoAcumulado, 2500);
});

test('set define a duração em ms a partir de minutos e segundos', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'set', valor: 10, segundos: 30 });
    assert.equal(s.cronometro.duracaoConfigurada, 630000);
    assert.equal(s.cronometro.rodando, false);
    assert.equal(s.cronometro.tempoAcumulado, 0);
});

test('set funciona só com minutos (segundos ausente)', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'set', valor: 8 });
    assert.equal(s.cronometro.duracaoConfigurada, 480000);
});

test('set com tudo zerado zera a duração', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'set', valor: 0, segundos: 0 });
    assert.equal(s.cronometro.duracaoConfigurada, 0);
});

// ---------------------------------------------------------------------------
// configurarJogo
// ---------------------------------------------------------------------------
test('configurarJogo aplica esporte, nomes, logos e elenco', () => {
    const s = novoEstado();
    const elenco = [{ numero: '1', nome: 'Goleiro', foto: '' }];
    logic.configurarJogo(s, {
        esporte: 'basquete',
        timeA_nome: 'Casa', timeB_nome: 'Fora',
        timeA_logo: 'data:a', timeB_logo: 'data:b',
        timeA_elenco: elenco
    });
    assert.equal(s.esporte, 'basquete');
    assert.equal(s.timeA.nome, 'Casa');
    assert.equal(s.timeB.nome, 'Fora');
    assert.equal(s.timeA.logo, 'data:a');
    assert.equal(s.timeB.logo, 'data:b');
    assert.deepEqual(s.timeA.elenco, elenco);
});

test('configurarJogo honra sacando = null (chave presente)', () => {
    const s = novoEstado();
    s.sacando = 'timeA';
    logic.configurarJogo(s, { sacando: null });
    assert.equal(s.sacando, null);
});

test('configurarJogo não sobrescreve campos não informados', () => {
    const s = novoEstado();
    s.timeA.nome = 'Original';
    logic.configurarJogo(s, { esporte: 'volei' });
    assert.equal(s.timeA.nome, 'Original');
    assert.equal(s.esporte, 'volei');
});

test('configurarJogo permite limpar a logo com string vazia', () => {
    const s = novoEstado();
    s.timeA.logo = 'data:antiga';
    logic.configurarJogo(s, { timeA_logo: '' });
    assert.equal(s.timeA.logo, '');
});

// ---------------------------------------------------------------------------
// comandoTransmissao
// ---------------------------------------------------------------------------
test('comandoTransmissao faz coerção booleana', () => {
    const s = novoEstado();
    logic.comandoTransmissao(s, { ativa: true });
    assert.equal(s.transmissaoAtiva, true);
    logic.comandoTransmissao(s, { ativa: false });
    assert.equal(s.transmissaoAtiva, false);
    logic.comandoTransmissao(s, {});
    assert.equal(s.transmissaoAtiva, false);
});

// ---------------------------------------------------------------------------
// filtrarVideos
// ---------------------------------------------------------------------------
test('filtrarVideos aceita extensões válidas e ignora o resto', () => {
    const entrada = ['jogo.mp4', 'intro.WEBM', 'clip.MOV', 'velho.avi', 'gravacao.mkv', 'nota.txt', 'foto.png', 'semext'];
    const saida = logic.filtrarVideos(entrada);
    assert.deepEqual(saida, ['jogo.mp4', 'intro.WEBM', 'clip.MOV', 'velho.avi', 'gravacao.mkv']);
});

test('filtrarVideos com lista vazia retorna vazio', () => {
    assert.deepEqual(logic.filtrarVideos([]), []);
});
