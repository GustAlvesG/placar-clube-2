const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('../placarApi');

// Fake de fetch: grava a última chamada e devolve a resposta configurada.
// Sem framework de mock, no mesmo espírito de test/gameLogic.test.js (só
// objetos simples e node:assert).
function criarFetchFake(status, corpo) {
    const chamadas = [];
    const fetchImpl = async (url, opcoes) => {
        chamadas.push({ url, opcoes });
        const texto = corpo === undefined ? '' : JSON.stringify(corpo);
        return new Response(texto, { status });
    };
    fetchImpl.chamadas = chamadas;
    return fetchImpl;
}

function configBase(fetchImpl) {
    return { baseUrl: 'http://laravel.test', token: 'tok123', fetchImpl };
}

// ---- chamarApi (via qualquer endpoint) — URL, método, headers, body ----

test('monta a URL com o prefixo /api/placar e o método correto', async () => {
    const fetchImpl = criarFetchFake(200, { ok: true });
    await api.obterJogo(configBase(fetchImpl), 12);
    assert.equal(fetchImpl.chamadas.length, 1);
    assert.equal(fetchImpl.chamadas[0].url, 'http://laravel.test/api/placar/jogos/12');
    assert.equal(fetchImpl.chamadas[0].opcoes.method, 'GET');
});

test('envia o Bearer token e Accept em toda chamada', async () => {
    const fetchImpl = criarFetchFake(200, {});
    await api.ping(configBase(fetchImpl));
    const headers = fetchImpl.chamadas[0].opcoes.headers;
    assert.equal(headers['Authorization'], 'Bearer tok123');
    assert.equal(headers['Accept'], 'application/json');
});

test('POST com corpo serializa como JSON e seta Content-Type', async () => {
    const fetchImpl = criarFetchFake(201, { id: 1 });
    await api.criarEquipe(configBase(fetchImpl), { nome: 'Clube X' });
    const { opcoes } = fetchImpl.chamadas[0];
    assert.equal(opcoes.method, 'POST');
    assert.equal(opcoes.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(opcoes.body), { nome: 'Clube X' });
});

test('GET sem corpo não seta Content-Type nem body', async () => {
    const fetchImpl = criarFetchFake(200, []);
    await api.listarEquipes(configBase(fetchImpl));
    const { opcoes } = fetchImpl.chamadas[0];
    assert.equal(opcoes.headers['Content-Type'], undefined);
    assert.equal(opcoes.body, undefined);
});

test('filtros de listagem viram query string, omitindo valores vazios', async () => {
    const fetchImpl = criarFetchFake(200, []);
    await api.listarJogos(configBase(fetchImpl), { status: 'ao_vivo', modalidade: undefined, data: '' });
    assert.equal(fetchImpl.chamadas[0].url, 'http://laravel.test/api/placar/jogos?status=ao_vivo');
});

test('sem nenhum filtro, não anexa "?" na URL', async () => {
    const fetchImpl = criarFetchFake(200, []);
    await api.listarJogos(configBase(fetchImpl));
    assert.equal(fetchImpl.chamadas[0].url, 'http://laravel.test/api/placar/jogos');
});

// ---- Erros ----

test('resposta 2xx devolve o corpo já parseado como JSON', async () => {
    const fetchImpl = criarFetchFake(200, { jogo: { id: 1 } });
    const resultado = await api.obterJogo(configBase(fetchImpl), 1);
    assert.deepEqual(resultado, { jogo: { id: 1 } });
});

test('resposta fora de 2xx lança ErroPlacarApi com o status e o corpo', async () => {
    const fetchImpl = criarFetchFake(401, { message: 'Unauthenticated.' });
    await assert.rejects(
        () => api.ping(configBase(fetchImpl)),
        (erro) => {
            assert.ok(erro instanceof api.ErroPlacarApi);
            assert.equal(erro.status, 401);
            assert.deepEqual(erro.corpo, { message: 'Unauthenticated.' });
            return true;
        }
    );
});

test('404 também vira ErroPlacarApi (não string genérica)', async () => {
    const fetchImpl = criarFetchFake(404, { message: 'Not Found' });
    await assert.rejects(() => api.obterJogo(configBase(fetchImpl), 999), api.ErroPlacarApi);
});

test('429 também vira ErroPlacarApi com status 429', async () => {
    const fetchImpl = criarFetchFake(429, { message: 'Too Many Attempts.' });
    await assert.rejects(
        () => api.enviarEventos(configBase(fetchImpl), 1, []),
        (erro) => erro.status === 429
    );
});

test('exige baseUrl e token configurados antes de chamar a rede', async () => {
    await assert.rejects(() => api.ping({ baseUrl: '', token: '' }));
});

// Categoria normalizada no servidor: POST /times devolve 200 (reaproveitou)
// em vez de 201 (criou) quando já existe um time equivalente — 200 é
// sucesso, não erro (fetch's resp.ok já cobre 200-299, não só 201).
test('POST /times com status 200 (time reaproveitado) não lança', async () => {
    const fetchImpl = criarFetchFake(200, { id: 3, nome_exibicao: 'CFCSN Adulto' });
    const resultado = await api.criarTime(configBase(fetchImpl), { equipe_nome: 'CFCSN', modalidade: 'futsal', categoria: 'Sub 15' });
    assert.equal(resultado.id, 3);
});

test('POST /times com status 201 (criou) também funciona normalmente', async () => {
    const fetchImpl = criarFetchFake(201, { id: 9 });
    const resultado = await api.criarTime(configBase(fetchImpl), { equipe_nome: 'Nova', modalidade: 'futsal' });
    assert.equal(resultado.id, 9);
});

// ---- /scout/artilharia foi removido; atuacaoDoJogador é o substituto por partida ----

test('artilharia não existe mais como função exportada', () => {
    assert.equal(api.artilharia, undefined);
});

test('atuacaoDoJogador monta a URL /jogos/{jogo}/jogadores/{jogador}/atuacao', async () => {
    const fetchImpl = criarFetchFake(200, { totais: { pontos: 2 } });
    await api.atuacaoDoJogador(configBase(fetchImpl), 12, 1);
    assert.equal(fetchImpl.chamadas[0].url, 'http://laravel.test/api/placar/jogos/12/jogadores/1/atuacao');
    assert.equal(fetchImpl.chamadas[0].opcoes.method, 'GET');
});

// ---- Vídeo do jogador: multipart, não base64 ----

test('enviarVideoJogador manda multipart no campo "video", não JSON', async () => {
    const chamadas = [];
    const fetchImpl = async (url, opcoes) => {
        chamadas.push({ url, opcoes });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await api.enviarVideoJogador(configBase(fetchImpl), 1, { buffer: Buffer.from('conteudo-fake'), nomeArquivo: 'entrada.mp4', tipoConteudo: 'video/mp4' });
    const { url, opcoes } = chamadas[0];
    assert.equal(url, 'http://laravel.test/api/placar/jogadores/1/video');
    assert.equal(opcoes.method, 'POST');
    assert.ok(opcoes.body instanceof FormData);
    assert.equal(opcoes.headers['Content-Type'], undefined); // FormData define o próprio boundary
    const arquivo = opcoes.body.get('video');
    assert.equal(arquivo.name, 'entrada.mp4');
    assert.equal(arquivo.type, 'video/mp4');
});

test('enviarVideoJogador propaga erro 422 (ex.: arquivo não é vídeo de verdade)', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ message: 'Arquivo inválido' }), { status: 422 });
    await assert.rejects(
        () => api.enviarVideoJogador(configBase(fetchImpl), 1, { buffer: Buffer.from('x') }),
        (erro) => erro instanceof api.ErroPlacarApi && erro.status === 422
    );
});

test('removerVideoJogador chama DELETE em /jogadores/{jogador}/video', async () => {
    const fetchImpl = criarFetchFake(200, { ok: true });
    await api.removerVideoJogador(configBase(fetchImpl), 1);
    assert.equal(fetchImpl.chamadas[0].url, 'http://laravel.test/api/placar/jogadores/1/video');
    assert.equal(fetchImpl.chamadas[0].opcoes.method, 'DELETE');
});

// ---- Endpoints do endpoint de eventos (o mais crítico) ----

test('enviarEventos manda { eventos } no corpo e devolve aceitos/duplicados/rejeitados', async () => {
    const resposta = { aceitos: ['u1'], duplicados: [], rejeitados: [] };
    const fetchImpl = criarFetchFake(200, resposta);
    const eventos = [{ uuid: 'u1', sequencia: 1, tipo: 'ponto', ocorrido_em: '2026-01-01 00:00:00.000' }];
    const resultado = await api.enviarEventos(configBase(fetchImpl), 42, eventos);
    assert.equal(fetchImpl.chamadas[0].url, 'http://laravel.test/api/placar/jogos/42/eventos');
    assert.deepEqual(JSON.parse(fetchImpl.chamadas[0].opcoes.body), { eventos });
    assert.deepEqual(resultado, resposta);
});

test('iniciarJogo sem operador manda corpo {} (não omite o body)', async () => {
    const fetchImpl = criarFetchFake(200, { ultima_sequencia: 5 });
    await api.iniciarJogo(configBase(fetchImpl), 7);
    assert.deepEqual(JSON.parse(fetchImpl.chamadas[0].opcoes.body), {});
});

test('salvarEscalacao manda time_id e jogadores', async () => {
    const fetchImpl = criarFetchFake(200, { ok: true });
    const jogadores = [{ jogador_id: 1, numero: '10', titular: true }];
    await api.salvarEscalacao(configBase(fetchImpl), 7, { time_id: 3, jogadores });
    assert.deepEqual(JSON.parse(fetchImpl.chamadas[0].opcoes.body), { time_id: 3, jogadores });
});
