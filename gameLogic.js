// Lógica pura do jogo, sem dependência de socket.io.
// Cada função recebe (e muta) um objeto `state` e, quando há efeitos
// colaterais para a camada de rede (animações), os retorna em `{ animacoes }`.

const EXTENSOES_VIDEO = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const EXTENSOES_IMAGEM = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
// Um slide pode ser uma imagem estática ou um vídeo (fica em loop até o operador avançar).
const EXTENSOES_SLIDE = [...EXTENSOES_IMAGEM, ...EXTENSOES_VIDEO];
const TEXTOS_PONTO = { futsal: 'GOL!', basquete: 'CESTA!', volei: 'PONTO!' };

// "Parcial" = set no vôlei, quarto no basquete: um trecho do jogo com placar
// próprio, que entra no histórico (`state.parciais`) quando fecha.
//
// O fechamento é SEMPRE uma ação explícita do operador (ação `fechar_set`) —
// a pontuação apenas HABILITA o botão na mesa. Nada aqui zera o placar
// sozinho: um ponto anotado por engano no fim do set não pode encerrar a
// parcial e apagar o placar sem confirmação humana.
//
// `pontos(numero)` devolve a pontuação que habilita o fechamento, ou `null`
// quando quem fecha a parcial é o cronômetro e não o placar (basquete) — aí o
// botão fica sempre à disposição do operador.
const REGRAS_PARCIAL = {
    volei: {
        rotulo: 'SET',
        pontos: (numero) => (numero >= 5 ? 15 : 25), // 5º set (tie-break) vai só até 15
        vantagem: 2,
        parciaisParaVencer: 3, // melhor de 5: fechado o 3º set, não há mais set para fechar
        maximoParciais: 5,
        parciaisExibidas: 5 // o telão mostra a grade inteira desde o 1º saque
    },
    // Basquete: o quarto termina pelo cronômetro, não pelo placar (e pode
    // acabar empatado). A lógica já funciona — falta só a mesa de basquete
    // chamar `fechar_set` e o telão exibir `area_parciais`.
    basquete: {
        rotulo: 'QUARTO',
        pontos: () => null,
        vantagem: 0,
        parciaisParaVencer: null,
        maximoParciais: null, // sem teto: prorrogação entra como parcial extra
        parciaisExibidas: 4 // os 4 quartos; a prorrogação vira uma coluna a mais
    }
};

// Falta coletiva a partir da qual a mesa avisa o operador de que a PRÓXIMA
// falta muda a cobrança. Futsal: da 6ª falta acumulada no tempo em diante é
// tiro livre direto sem barreira, então o aviso acende na 5ª. Basquete
// (FIBA): a partir da 5ª falta coletiva no quarto o time adversário cobra
// lances livres, então o aviso acende na 4ª. Vôlei não tem falta coletiva.
// É só aviso: nada aqui bloqueia ou cobra coisa alguma.
const REGRAS_FALTA = {
    futsal: { limite: 5 },
    basquete: { limite: 4 }
};

function criarEstadoInicial() {
    return {
        esporte: 'futsal',
        // Lance a lance do jogo (ponto, falta, fechamento de set), na ordem em
        // que aconteceram. É o que a mesa mostra na gaveta "Lances" e o que
        // permite corrigir um lance ESPECÍFICO (`estornar_lance`) em vez de só
        // "tirar 1 do placar". Corrigir não apaga: marca `estornado`, como o
        // log append-only da API.
        lances: [],
        // Contador de ids de lance. Não volta a zero no `zerar_tudo` de
        // propósito: o server.js guarda lanceId → uuid do evento na API, e um
        // id reaproveitado apontaria para o evento de outro lance.
        seqLance: 0,
        sacando: null,
        periodo: 1,
        transmissaoAtiva: false,
        patrocinadores: [],
        // Nome do vídeo de espera em public/base/ (null = tela de espera antiga,
        // com o degradê e o "Aguardando transmissão..."). Ver escolherVideoBase.
        videoStandby: null,
        // Placar de cada parcial já FECHADA, em ordem: [{ a, b }, ...].
        // Alimenta a faixa de parciais do telão e o número da parcial atual.
        parciais: [],
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

// Número da parcial em disputa (1-based): as já fechadas + ela.
function numeroParcialAtual(state) {
    return (Array.isArray(state.parciais) ? state.parciais.length : 0) + 1;
}

// Número da parcial que está realmente sendo disputada, ou `null` se não há
// mais nenhuma: no vôlei o jogo acabou (3 sets) ou os 5 já foram fechados.
function parcialEmAndamento(state) {
    const regra = REGRAS_PARCIAL[state.esporte];
    if (!regra) return null;

    const numero = numeroParcialAtual(state);
    if (regra.maximoParciais && numero > regra.maximoParciais) return null;
    if (regra.parciaisParaVencer
        && (state.timeA.sets >= regra.parciaisParaVencer || state.timeB.sets >= regra.parciaisParaVencer)) return null;

    return numero;
}

// Quantas colunas o telão desenha. A grade inteira aparece desde o começo (5
// sets no vôlei, 4 quartos no basquete) e só cresce se o jogo passar disso —
// prorrogação de basquete, que não tem teto.
function quantidadeParciais(state) {
    const regra = REGRAS_PARCIAL[state.esporte];
    if (!regra) return 0;

    const fechadas = Array.isArray(state.parciais) ? state.parciais.length : 0;
    return Math.max(regra.parciaisExibidas, fechadas, parcialEmAndamento(state) || 0);
}

// Se a parcial atual já pode ser fechada. Serve para a mesa decidir se mostra
// o botão de fechar set — não fecha nada por conta própria.
function parcialFechavel(state) {
    const numero = parcialEmAndamento(state);
    if (numero == null) return false;

    const regra = REGRAS_PARCIAL[state.esporte];
    const alvo = regra.pontos(numero);
    if (alvo == null) return true; // fecha por cronômetro: quem decide é o operador

    const a = state.timeA.placar, b = state.timeB.placar;
    return Math.max(a, b) >= alvo && Math.abs(a - b) >= regra.vantagem;
}

// Quem levou a parcial pelo placar corrente. `null` em empate — impossível no
// vôlei, normal num quarto de basquete.
function vencedorParcial(state) {
    const a = state.timeA.placar, b = state.timeB.placar;
    if (a === b) return null;
    return a > b ? 'timeA' : 'timeB';
}

// Set point: o time está a UM ponto de fechar a parcial. É um ESTADO (dura
// enquanto durar, pode trocar de lado a cada rally), não um evento — por isso
// vive aqui como derivado do placar, e não como animação disparada por
// `comandoPlacar`.
//
// Em vez de reescrever "24 com 2 de vantagem", simula o próximo ponto e
// pergunta ao `parcialFechavel`: a regra fica num lugar só, e o tie-break de 15,
// a vantagem de 2 (24x24 não é set point) e o fim de jogo saem de graça.
//
// Só existe onde a parcial fecha por PLACAR. No basquete o quarto termina pelo
// cronômetro (`pontos` devolve null), então nunca há set point.
function pontoDeParcial(state) {
    const regra = REGRAS_PARCIAL[state.esporte];
    if (!regra || regra.pontos(numeroParcialAtual(state)) == null) return null;
    // Se a pontuação já fecha a parcial, o time não está "a um ponto": está
    // esperando o operador fechar.
    if (parcialFechavel(state)) return null;

    for (const time of ['timeA', 'timeB']) {
        const hipotese = {
            esporte: state.esporte,
            parciais: state.parciais,
            timeA: { placar: state.timeA.placar, sets: state.timeA.sets },
            timeB: { placar: state.timeB.placar, sets: state.timeB.sets }
        };
        hipotese[time].placar += 1;
        if (parcialFechavel(hipotese)) return time;
    }
    return null;
}

// Só o que a gaveta de lances precisa do jogador: o elenco pode trazer foto em
// base64, e o lance vai em todo broadcast.
function jogadorDoLance(jogador) {
    if (!jogador) return null;
    return { numero: jogador.numero ?? '', nome: jogador.nome || '' };
}

function registrarLance(state, campos, now) {
    if (!Array.isArray(state.lances)) state.lances = [];
    state.seqLance = (state.seqLance || 0) + 1;
    const decorrido = tempoDecorrido(state.cronometro, now);
    const lance = {
        id: state.seqLance,
        tipo: campos.tipo,
        time: campos.time || null,
        valor: campos.valor ?? null,
        jogador: jogadorDoLance(campos.jogador),
        periodo: state.periodo,
        parcial: numeroParcialAtual(state),
        // O que o relógio da mesa mostrava no lance: decorrido (cronômetro
        // crescente) e restante (regressivo). A mesa escolhe qual exibir.
        cronometroMs: decorrido,
        restanteMs: Math.max(0, state.cronometro.duracaoConfigurada - decorrido),
        estornado: false,
        ...(campos.extra || {})
    };
    state.lances.push(lance);
    return lance;
}

// Um lance pode ser corrigido se desfazê-lo ainda faz sentido no placar ATUAL:
//  - ponto: só da parcial em disputa — depois que o set fecha, o placar dele
//    foi para o histórico e tirar ponto do placar novo seria errado;
//  - falta: só do período atual — as faltas são zeradas na troca de período;
//  - set: só o ÚLTIMO fechamento (é o que `reabrir_set` sabe desfazer).
function lanceEstornavel(state, lance) {
    if (!lance || lance.estornado) return false;
    if (lance.tipo === 'ponto') return lance.parcial === numeroParcialAtual(state);
    if (lance.tipo === 'falta') return lance.periodo === state.periodo && state[lance.time].faltas > 0;
    if (lance.tipo === 'set') {
        const ultimoSet = ultimoLanceDeSet(state);
        return ultimoSet === lance && Array.isArray(state.parciais) && state.parciais.length === lance.parcial;
    }
    return false;
}

function ultimoLanceDeSet(state) {
    const lances = Array.isArray(state.lances) ? state.lances : [];
    for (let i = lances.length - 1; i >= 0; i--) {
        if (lances[i].tipo === 'set' && !lances[i].estornado) return lances[i];
    }
    return null;
}

// Lances como a mesa precisa: cada um com `estornavel` já calculado, para a
// regra acima não ser reimplementada no HTML.
function lancesParaTela(state) {
    const lances = Array.isArray(state.lances) ? state.lances : [];
    return lances.map(l => ({ ...l, estornavel: lanceEstornavel(state, l) }));
}

// Limite de faltas do esporte atual (null onde não há falta coletiva).
function limiteFaltas(state) {
    const regra = REGRAS_FALTA[state.esporte];
    return regra ? regra.limite : null;
}

// Quais times já estão no limite (a próxima falta muda a cobrança).
function alertaFaltas(state) {
    const limite = limiteFaltas(state);
    return {
        timeA: limite != null && state.timeA.faltas >= limite,
        timeB: limite != null && state.timeB.faltas >= limite
    };
}

// `now` injetável pelo mesmo motivo de comandoCronometro: o lance guarda o
// tempo do cronômetro no instante em que aconteceu.
//
// Além de `animacoes`, devolve `lance` (o lance criado por esta ação, se
// houver) e `estornado` (o lance desfeito por `estornar_lance`) — o server.js
// usa os dois para ligar o lance ao evento correspondente na API.
function comandoPlacar(state, { time, acao, valor, jogador, lanceId } = {}, now = Date.now()) {
    const animacoes = [];
    let lance = null, estornado = null;
    if (!Array.isArray(state.parciais)) state.parciais = []; // estado antigo, sem histórico
    if (!Array.isArray(state.lances)) state.lances = [];

    if (acao === 'add_ponto') {
        lance = registrarLance(state, { tipo: 'ponto', time, valor, jogador }, now);
        state[time].placar += valor;
        state.sacando = time;
        const texto = TEXTOS_PONTO[state.esporte] || 'PONTO!';
        if (jogador) {
            // `tipo: 'ponto'` é o que permite o telão preferir o vídeo do
            // jogador (se tiver) nessa animação — falta nunca usa vídeo.
            animacoes.push({ name: 'animacao_ponto', payload: { tipo: 'ponto', texto, jogador, timeNome: state[time].nome, timeLogo: state[time].logo } });
        } else {
            // Sem jogador escolhido o ponto ainda é do TIME: a faixa entra com
            // o nome e a logo dele no lugar do jogador, em vez de o lance
            // passar sem anúncio nenhum no telão. `tipo` próprio porque não há
            // jogador — e, portanto, nunca há vídeo de apresentação para tocar.
            animacoes.push({ name: 'animacao_ponto', payload: { tipo: 'ponto_time', texto, timeNome: state[time].nome, timeLogo: state[time].logo } });
        }

        // O set/quarto NÃO fecha sozinho aqui: chegar a 25 (ou 15 no tie-break)
        // com 2 de vantagem apenas faz `parcialFechavel()` liberar o botão de
        // fechar set na mesa, que então emite `fechar_set`.
    }

    if (acao === 'sub_ponto' && state[time].placar > 0) state[time].placar -= valor;
    if (acao === 'add_set') state[time].sets += 1;
    if (acao === 'sub_set' && state[time].sets > 0) state[time].sets -= 1;
    if (acao === 'add_falta') {
        lance = registrarLance(state, { tipo: 'falta', time, valor: 1, jogador }, now);
        state[time].faltas += 1;
        // `tipo: 'falta'` faz o telão usar sempre a foto (nunca o vídeo),
        // mesmo que o jogador tenha um vídeo cadastrado.
        if (jogador) animacoes.push({ name: 'animacao_ponto', payload: { tipo: 'falta', texto: 'FALTA!', jogador, timeNome: state[time].nome, timeLogo: state[time].logo } });
    }
    if (acao === 'sub_falta' && state[time].faltas > 0) state[time].faltas -= 1;

    // Fecha a parcial em disputa: guarda o placar dela no histórico, credita o
    // set a quem venceu e zera o placar para a próxima. Não checa
    // `parcialFechavel` de propósito — o botão da mesa é o filtro, e o
    // operador precisa poder encerrar uma parcial fora da regra (WO, partida
    // interrompida) sem ficar travado.
    if (acao === 'fechar_set') {
        const regra = REGRAS_PARCIAL[state.esporte];
        const numero = numeroParcialAtual(state);
        const vencedor = vencedorParcial(state);
        const placar = { a: state.timeA.placar, b: state.timeB.placar };

        lance = registrarLance(state, { tipo: 'set', time: vencedor, extra: { placar: { ...placar } } }, now);
        state.parciais.push({ ...placar });
        if (vencedor) state[vencedor].sets += 1;
        state.timeA.placar = 0;
        state.timeB.placar = 0;
        state.sacando = null;

        // O anúncio leva o retrato do fechamento porque o `atualizar_tela` só
        // chega depois — e nele o placar da parcial já foi zerado.
        const decidido = !!(regra && regra.parciaisParaVencer
            && (state.timeA.sets >= regra.parciaisParaVencer || state.timeB.sets >= regra.parciaisParaVencer));
        animacoes.push({
            name: 'animacao_parcial',
            payload: {
                tipo: decidido ? 'jogo' : 'parcial',
                rotulo: regra ? regra.rotulo : 'SET',
                numero,
                vencedor, // null num quarto empatado de basquete
                placar,
                sets: { a: state.timeA.sets, b: state.timeB.sets },
                times: { a: state.timeA.nome, b: state.timeB.nome }
            }
        });
    }

    // Desfaz o último fechamento (operador clicou por engano): devolve o placar
    // daquela parcial e retira o set de quem havia vencido.
    if (acao === 'reabrir_set' && state.parciais.length > 0) {
        const lanceSet = ultimoLanceDeSet(state);
        if (lanceSet && lanceSet.parcial === state.parciais.length) lanceSet.estornado = true;
        const ultima = state.parciais.pop();
        state.timeA.placar = ultima.a;
        state.timeB.placar = ultima.b;
        const vencedor = vencedorParcial(state);
        if (vencedor && state[vencedor].sets > 0) state[vencedor].sets -= 1;
    }

    // Corrige UM lance específico (o "Desfazer" e o "Estornar" da mesa): tira
    // do placar exatamente o que aquele lance pôs, e marca o lance como
    // estornado em vez de apagá-lo. Fechamento de set não passa por aqui — é
    // `reabrir_set`. Lance que já não pode ser desfeito (ver lanceEstornavel)
    // é ignorado em silêncio.
    if (acao === 'estornar_lance') {
        const alvo = state.lances.find(l => l.id === lanceId);
        if (alvo && alvo.tipo !== 'set' && lanceEstornavel(state, alvo)) {
            if (alvo.tipo === 'ponto') state[alvo.time].placar = Math.max(0, state[alvo.time].placar - (alvo.valor || 0));
            if (alvo.tipo === 'falta') state[alvo.time].faltas = Math.max(0, state[alvo.time].faltas - 1);
            alvo.estornado = true;
            estornado = alvo;
        }
    }

    // Troca de período/quarto: falta coletiva recomeça do zero. Ação separada
    // de `add_periodo` porque o +/− período da mesa também serve para corrigir
    // um período marcado errado — e aí as faltas não podem sumir.
    if (acao === 'zerar_faltas') {
        state.timeA.faltas = 0;
        state.timeB.faltas = 0;
    }
    if (acao === 'add_periodo') state.periodo += 1;
    if (acao === 'sub_periodo' && state.periodo > 1) state.periodo -= 1;
    // Zera valores de jogo (placar, sets, faltas, período, cronômetro) sem
    // interromper a transmissão do telão.
    if (acao === 'zerar_tudo') {
        state.timeA.placar = 0; state.timeA.sets = 0; state.timeA.faltas = 0;
        state.timeB.placar = 0; state.timeB.sets = 0; state.timeB.faltas = 0;
        state.parciais = [];
        state.lances = []; // `seqLance` continua contando (ver criarEstadoInicial)
        state.sacando = null;
        state.periodo = 1;
        state.cronometro.rodando = false;
        state.cronometro.tempoAcumulado = 0;
        state.cronometro.inicioTimestamp = 0;
    }

    return { animacoes, lance, estornado };
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

// Vídeo de espera do telão: o primeiro vídeo que estiver em public/base/.
// A pasta é de arte (fundos, elementos por esporte), então basta largar o
// arquivo lá — não há tela de upload para ela. Ordem alfabética, e não a ordem
// que o sistema de arquivos devolver, para que dois telões nunca discordem.
function escolherVideoBase(files = []) {
    const videos = filtrarVideos(files)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return videos[0] || null;
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
    REGRAS_PARCIAL,
    REGRAS_FALTA,
    criarEstadoInicial,
    configurarJogo,
    comandoPlacar,
    lanceEstornavel,
    lancesParaTela,
    limiteFaltas,
    alertaFaltas,
    numeroParcialAtual,
    parcialEmAndamento,
    quantidadeParciais,
    parcialFechavel,
    vencedorParcial,
    pontoDeParcial,
    comandoCronometro,
    tempoDecorrido,
    comandoTransmissao,
    comandoSlides,
    filtrarVideos,
    filtrarImagens,
    filtrarSlides,
    escolherVideoBase,
    sanitizarNomeArquivo
};
