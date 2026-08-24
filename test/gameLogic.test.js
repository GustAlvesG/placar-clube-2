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
    assert.deepEqual(s.patrocinadores, []);
    assert.equal(s.cronometro.duracaoConfigurada, 600000);
    assert.deepEqual(s.slides, { arquivos: [], indice: 0, ativo: false });
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
        assert.deepEqual(animacoes[0].payload, { tipo: 'ponto', texto, jogador, timeNome: 'Águia' });
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
// Parciais (set no vôlei / quarto no basquete): habilitar != fechar
// ---------------------------------------------------------------------------
test('vôlei: 25x23 NÃO fecha o set sozinho — só habilita o fechamento', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 23;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.placar, 25);
    assert.equal(s.timeB.placar, 23);
    assert.equal(s.timeA.sets, 0);
    assert.deepEqual(s.parciais, []);
    assert.equal(logic.parcialFechavel(s), true);
    assert.equal(logic.vencedorParcial(s), 'timeA');
});

test('vôlei: 25x24 não habilita o fechamento (diferença menor que 2)', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 24;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.placar, 25);
    assert.equal(s.timeB.placar, 24);
    assert.equal(logic.parcialFechavel(s), false);
});

test('vôlei: 26x24 habilita o fechamento por vantagem', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25;
    s.timeB.placar = 24;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(logic.parcialFechavel(s), true);
});

test('vôlei: 5º set (tie-break) fecha em 15, não em 25', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.parciais = [{ a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 1 }];
    s.timeA.sets = 2;
    s.timeB.sets = 2;
    assert.equal(logic.numeroParcialAtual(s), 5);
    s.timeA.placar = 15;
    s.timeB.placar = 13;
    assert.equal(logic.parcialFechavel(s), true);
});

test('vôlei: com o jogo decidido (3 sets) não há mais set para fechar', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.sets = 3;
    s.timeA.placar = 25;
    s.timeB.placar = 10;
    assert.equal(logic.parcialFechavel(s), false);
});

test('fechar_set guarda a parcial, credita o set e zera o placar', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25;
    s.timeB.placar = 23;
    s.sacando = 'timeA';
    logic.comandoPlacar(s, { acao: 'fechar_set' });
    assert.deepEqual(s.parciais, [{ a: 25, b: 23 }]);
    assert.equal(s.timeA.sets, 1);
    assert.equal(s.timeB.sets, 0);
    assert.equal(s.timeA.placar, 0);
    assert.equal(s.timeB.placar, 0);
    assert.equal(s.sacando, null);
    assert.equal(logic.numeroParcialAtual(s), 2);
});

test('reabrir_set devolve o placar da última parcial e retira o set', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25;
    s.timeB.placar = 23;
    logic.comandoPlacar(s, { acao: 'fechar_set' });
    logic.comandoPlacar(s, { acao: 'reabrir_set' });
    assert.deepEqual(s.parciais, []);
    assert.equal(s.timeA.sets, 0);
    assert.equal(s.timeA.placar, 25);
    assert.equal(s.timeB.placar, 23);
});

test('reabrir_set sem parcial nenhuma não muda nada', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 7;
    logic.comandoPlacar(s, { acao: 'reabrir_set' });
    assert.deepEqual(s.parciais, []);
    assert.equal(s.timeA.placar, 7);
    assert.equal(s.timeA.sets, 0);
});

test('basquete: quarto fecha por decisão do operador (empate não credita set)', () => {
    const s = novoEstado({ esporte: 'basquete' });
    assert.equal(logic.parcialFechavel(s), true); // quem fecha é o cronômetro
    s.timeA.placar = 18;
    s.timeB.placar = 18;
    logic.comandoPlacar(s, { acao: 'fechar_set' });
    assert.deepEqual(s.parciais, [{ a: 18, b: 18 }]);
    assert.equal(s.timeA.sets, 0);
    assert.equal(s.timeB.sets, 0);
});

test('futsal: não tem parcial para fechar', () => {
    const s = novoEstado({ esporte: 'futsal' });

// ---------------------------------------------------------------------------
// Grade de parciais: o telão mostra todas, inclusive as que não começaram
// ---------------------------------------------------------------------------
test('vôlei desenha os 5 sets desde o primeiro saque', () => {
    const s = novoEstado({ esporte: 'volei' });
    assert.equal(logic.quantidadeParciais(s), 5);
    assert.equal(logic.parcialEmAndamento(s), 1);
});

test('no 3º set a grade continua com 5 colunas e a 3ª é a em disputa', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.parciais = [{ a: 25, b: 20 }, { a: 18, b: 25 }];
    s.timeA.sets = 1;
    s.timeB.sets = 1;
    assert.equal(logic.quantidadeParciais(s), 5);
    assert.equal(logic.parcialEmAndamento(s), 3);
});

test('com o jogo decidido não há parcial em disputa, mas a grade permanece', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.parciais = [{ a: 25, b: 20 }, { a: 25, b: 18 }, { a: 25, b: 22 }];
    s.timeA.sets = 3;
    assert.equal(logic.parcialEmAndamento(s), null);
    assert.equal(logic.quantidadeParciais(s), 5);
});

test('basquete desenha os 4 quartos e a prorrogação vira uma coluna a mais', () => {
    const s = novoEstado({ esporte: 'basquete' });
    assert.equal(logic.quantidadeParciais(s), 4);

    s.parciais = [{ a: 20, b: 18 }, { a: 15, b: 22 }, { a: 19, b: 19 }, { a: 21, b: 16 }];
    assert.equal(logic.parcialEmAndamento(s), 5);
    assert.equal(logic.quantidadeParciais(s), 5);
});

test('futsal não tem grade de parciais', () => {
    const s = novoEstado({ esporte: 'futsal' });
    assert.equal(logic.quantidadeParciais(s), 0);
    assert.equal(logic.parcialEmAndamento(s), null);
});

// ---------------------------------------------------------------------------
// Set point: o time está a UM ponto de fechar a parcial
// ---------------------------------------------------------------------------
test('set point em 24x23 é do time que lidera', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 23;
    assert.equal(logic.pontoDeParcial(s), 'timeA');
});

test('set point acompanha o visitante em 23x24', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 23;
    s.timeB.placar = 24;
    assert.equal(logic.pontoDeParcial(s), 'timeB');
});

test('24x24 NÃO é set point — o próximo ponto não fecha (precisa de 2 de vantagem)', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 24;
    assert.equal(logic.pontoDeParcial(s), null);
});

test('25x24 é set point: 26x24 fecharia por vantagem', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25;
    s.timeB.placar = 24;
    assert.equal(logic.pontoDeParcial(s), 'timeA');
});

test('com a parcial já fechável (25x23) não há set point — o set está ganho, esperando o operador', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 25;
    s.timeB.placar = 23;
    assert.equal(logic.parcialFechavel(s), true);
    assert.equal(logic.pontoDeParcial(s), null);
});

test('longe do fim não há set point', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 23;
    s.timeB.placar = 20;
    assert.equal(logic.pontoDeParcial(s), null);
});

test('set point do tie-break sai em 14, não em 24', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.parciais = [{ a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 1 }];
    s.timeA.sets = 2;
    s.timeB.sets = 2;
    s.timeA.placar = 14;
    s.timeB.placar = 10;
    assert.equal(logic.pontoDeParcial(s), 'timeA');
});

test('com o jogo já decidido não há set point', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.sets = 3;
    s.timeA.placar = 24;
    s.timeB.placar = 20;
    assert.equal(logic.pontoDeParcial(s), null);
});

test('basquete e futsal nunca têm set point (a parcial não fecha por placar)', () => {
    for (const esporte of ['basquete', 'futsal']) {
        const s = novoEstado({ esporte });
        s.timeA.placar = 24;
        s.timeB.placar = 20;
        assert.equal(logic.pontoDeParcial(s), null, esporte);
    }
});

test('pontoDeParcial não altera o estado (só simula o próximo ponto)', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.timeA.placar = 24;
    s.timeB.placar = 23;
    const antes = JSON.stringify(s);
    logic.pontoDeParcial(s);
    assert.equal(JSON.stringify(s), antes);
});
    s.timeA.placar = 24;
    logic.comandoPlacar(s, { time: 'timeA', acao: 'add_ponto', valor: 1 });
    assert.equal(s.timeA.placar, 25);
    assert.equal(s.timeA.sets, 0);
    assert.equal(logic.parcialFechavel(s), false);
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
    assert.deepEqual(animacoes[0].payload, { tipo: 'falta', texto: 'FALTA!', jogador, timeNome: 'Leões' });
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
test('zerar_tudo reseta placar, sets, faltas, sacando, período e cronômetro, mas MANTÉM a transmissão', () => {
    const s = novoEstado({ esporte: 'volei' });
    s.parciais = [{ a: 25, b: 20 }, { a: 18, b: 25 }];
    s.timeA.placar = 10; s.timeA.sets = 2; s.timeA.faltas = 3;
    s.timeB.placar = 8; s.timeB.sets = 1; s.timeB.faltas = 4;
    s.sacando = 'timeA'; s.periodo = 3; s.transmissaoAtiva = true;
    s.cronometro = { rodando: true, tempoAcumulado: 5000, inicioTimestamp: 123, duracaoConfigurada: 600000 };

    logic.comandoPlacar(s, { acao: 'zerar_tudo' });

    assert.deepEqual(s.parciais, []);
    assert.equal(s.timeA.placar, 0); assert.equal(s.timeA.sets, 0); assert.equal(s.timeA.faltas, 0);
    assert.equal(s.timeB.placar, 0); assert.equal(s.timeB.sets, 0); assert.equal(s.timeB.faltas, 0);
    assert.equal(s.sacando, null);
    assert.equal(s.periodo, 1);
    assert.equal(s.transmissaoAtiva, true); // transmissão segue no ar
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
// tempoDecorrido — usado para preencher cronometro_ms nos eventos da API
// ---------------------------------------------------------------------------
test('tempoDecorrido soma o acumulado ao trecho em andamento quando está rodando', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'play' }, 1000);
    assert.equal(logic.tempoDecorrido(s.cronometro, 13600), 12600);
});

test('tempoDecorrido não soma nada extra quando está pausado (usa o valor congelado)', () => {
    const s = novoEstado();
    logic.comandoCronometro(s, { acao: 'play' }, 1000);
    logic.comandoCronometro(s, { acao: 'pause' }, 4000);
    // "agora" bem depois da pausa não deve inflar o tempo — ficou congelado em 3000.
    assert.equal(logic.tempoDecorrido(s.cronometro, 999999), 3000);
});

test('tempoDecorrido com cronômetro nunca iniciado é zero', () => {
    const s = novoEstado();
    assert.equal(logic.tempoDecorrido(s.cronometro, 50000), 0);
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
// comandoSlides
// ---------------------------------------------------------------------------
test('comandoSlides iniciar carrega a fila e ativa a apresentação no índice 0', () => {
    const s = novoEstado();
    logic.comandoSlides(s, { acao: 'iniciar', arquivos: ['a.png', 'b.png', 'c.png'] });
    assert.deepEqual(s.slides, { arquivos: ['a.png', 'b.png', 'c.png'], indice: 0, ativo: true });
});

test('comandoSlides iniciar com fila vazia não ativa a apresentação', () => {
    const s = novoEstado();
    logic.comandoSlides(s, { acao: 'iniciar', arquivos: [] });
    assert.equal(s.slides.ativo, false);
});

test('comandoSlides proximo avança o índice sem passar do último slide', () => {
    const s = novoEstado();
    logic.comandoSlides(s, { acao: 'iniciar', arquivos: ['a.png', 'b.png'] });
    logic.comandoSlides(s, { acao: 'proximo' });
    assert.equal(s.slides.indice, 1);
    logic.comandoSlides(s, { acao: 'proximo' }); // já no último: não deve passar
    assert.equal(s.slides.indice, 1);
});

test('comandoSlides anterior recua o índice sem passar do primeiro slide', () => {
    const s = novoEstado();
    logic.comandoSlides(s, { acao: 'iniciar', arquivos: ['a.png', 'b.png'] });
    logic.comandoSlides(s, { acao: 'anterior' }); // já no primeiro: não deve recuar
    assert.equal(s.slides.indice, 0);
    logic.comandoSlides(s, { acao: 'proximo' });
    logic.comandoSlides(s, { acao: 'anterior' });
    assert.equal(s.slides.indice, 0);
});

test('comandoSlides proximo/anterior não fazem nada quando a apresentação está parada', () => {
    const s = novoEstado();
    logic.comandoSlides(s, { acao: 'proximo' });
    assert.equal(s.slides.indice, 0);
    assert.equal(s.slides.ativo, false);
});

test('comandoSlides parar limpa a fila e desativa a apresentação', () => {
    const s = novoEstado();
    logic.comandoSlides(s, { acao: 'iniciar', arquivos: ['a.png', 'b.png'] });
    logic.comandoSlides(s, { acao: 'proximo' });
    logic.comandoSlides(s, { acao: 'parar' });
    assert.deepEqual(s.slides, { arquivos: [], indice: 0, ativo: false });
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

// ---------------------------------------------------------------------------
// filtrarImagens (logos de patrocinadores)
// ---------------------------------------------------------------------------
test('filtrarImagens aceita extensões de imagem e ignora o resto', () => {
    const entrada = ['logo.png', 'marca.JPG', 'anim.gif', 'foto.jpeg', 'icone.webp', 'vetor.svg', 'video.mp4', 'doc.txt', 'semext'];
    const saida = logic.filtrarImagens(entrada);
    assert.deepEqual(saida, ['logo.png', 'marca.JPG', 'anim.gif', 'foto.jpeg', 'icone.webp', 'vetor.svg']);
});

// ---------------------------------------------------------------------------
// filtrarSlides (um slide pode ser imagem OU vídeo)
// ---------------------------------------------------------------------------
test('filtrarSlides aceita extensões de imagem e de vídeo, ignora o resto', () => {
    const entrada = ['foto.png', 'clipe.mp4', 'anim.webm', 'doc.pdf', 'planilha.xlsx', 'semext'];
    const saida = logic.filtrarSlides(entrada);
    assert.deepEqual(saida, ['foto.png', 'clipe.mp4', 'anim.webm']);
});

test('filtrarSlides com lista vazia retorna vazio', () => {
    assert.deepEqual(logic.filtrarSlides([]), []);
});

// ---------------------------------------------------------------------------
// sanitizarNomeArquivo (uploads)
// ---------------------------------------------------------------------------
test('sanitizarNomeArquivo mantém nomes comuns (acentos, espaços, hífen)', () => {
    assert.equal(logic.sanitizarNomeArquivo('Logo Patrocínio - 2026.png'), 'Logo Patrocínio - 2026.png');
});

test('sanitizarNomeArquivo descarta caminho (previne traversal)', () => {
    assert.equal(logic.sanitizarNomeArquivo('../../etc/senha.png'), 'senha.png');
    assert.equal(logic.sanitizarNomeArquivo('C:\\Windows\\logo.png'), 'logo.png');
});

test('sanitizarNomeArquivo troca caracteres perigosos por _', () => {
    assert.equal(logic.sanitizarNomeArquivo('a<b>:c?.png'), 'a_b__c_.png');
});

test('sanitizarNomeArquivo retorna vazio para nomes inutilizáveis', () => {
    assert.equal(logic.sanitizarNomeArquivo(''), '');
    assert.equal(logic.sanitizarNomeArquivo('...'), '');
    assert.equal(logic.sanitizarNomeArquivo('..'), '');
    assert.equal(logic.sanitizarNomeArquivo(null), '');
});
