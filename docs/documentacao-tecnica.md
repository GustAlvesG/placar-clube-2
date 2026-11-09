# Placar Clube — Documentação Técnica

Público: desenvolvedores que vão manter, corrigir ou estender o sistema.
Para operar o placar num jogo, veja o [Manual do Usuário](manual-do-usuario.md).

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack e dependências](#2-stack-e-dependências)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Arquitetura](#4-arquitetura)
5. [O estado do jogo (`gameState`)](#5-o-estado-do-jogo-gamestate)
6. [Módulo `gameLogic.js`](#6-módulo-gamelogicjs)
7. [Módulo `server.js`](#7-módulo-serverjs)
8. [Contrato Socket.IO](#8-contrato-socketio)
9. [Endpoints HTTP](#9-endpoints-http)
10. [Integração com a API Laravel](#10-integração-com-a-api-laravel)
11. [Frontend](#11-frontend)
12. [O telão em detalhe](#12-o-telão-em-detalhe)
13. [Testes](#13-testes)
14. [Instalação, execução e deploy](#14-instalação-execução-e-deploy)
15. [Limitações conhecidas e dívidas técnicas](#15-limitações-conhecidas-e-dívidas-técnicas)
16. [Receitas de manutenção](#16-receitas-de-manutenção)

---

## 1. Visão geral

O Placar Clube é um placar eletrônico em tempo real para **futsal, basquete e
vôlei**. Um servidor Node.js mantém o estado de um único jogo em memória e o
transmite via **Socket.IO** para todas as telas conectadas na rede local:

- **Telão** (`/`) — o placar exibido na TV/projetor; pode haver vários.
- **Configuração** (`/controle/`) — escolhe esporte, times, logos, elenco; carrega
  jogos da API do clube; liga/desliga a transmissão.
- **Mesa de controle** (`/controle/controle.html`) — marca pontos, faltas, sets,
  controla o cronômetro.
- **Anúncios** (`/controle/controle_anuncios.html`) — vídeos comerciais, slides e
  logos de patrocinadores.

Opcionalmente o servidor se integra a uma **API Laravel externa** ("Placar Clube"),
fonte de verdade de equipes, times, jogadores, jogos e do log de eventos (súmula).
Sem essa configuração o sistema funciona em **modo manual**.

---

## 2. Stack e dependências

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22+ (usa `fetch`, `FormData`, `Blob`, `crypto.randomUUID` nativos) |
| HTTP | Express 5 (só arquivos estáticos + 2 rotas de upload/exclusão) |
| Tempo real | Socket.IO 4 |
| Frontend | HTML + CSS + JavaScript puro, **sem build** |
| Testes | `node:test` nativo (zero dependências de test runner) |
| Dev | nodemon (recarrega em mudanças de `server.js`/`gameLogic.js`) |

Dependências de produção: apenas `express` e `socket.io`.
`devDependencies`: `nodemon`, `playwright` (verificação manual end-to-end — não há
specs Playwright no repositório) e `socket.io-client`.

**Dependências de CDN no frontend** (exigem internet nas máquinas de controle):

| Página | CDN | Para quê |
|---|---|---|
| páginas de controle | `cdn.tailwindcss.com` | classes utilitárias de CSS |
| `controle/index.html` | `cdn.sheetjs.com` (xlsx 0.20.3) | importar elenco de `.xlsx`/`.xls` |
| `controle_anuncios.html` | `cdnjs` pdf.js 3.11.174 (carregado sob demanda) | converter PDF em slides |

O `.env` é lido por um carregador próprio ([env.js](../env.js)), sem `dotenv`. Ele
**nunca sobrescreve** variáveis já presentes no ambiente.

---

## 3. Estrutura de pastas

```
placar-clube-2/
├── server.js              # Transporte: Express + Socket.IO, estado global, integração
├── gameLogic.js           # Regras do jogo — funções puras, sem rede
├── placarApi.js           # Cliente HTTP da API Laravel (sem estado)
├── placarEventos.js       # Fila de eventos para a API (uuid, sequência, estorno, lote)
├── env.js                 # Carregador mínimo de .env
├── .env.example           # LARAVEL_BASE_URL e LARAVEL_API_TOKEN
├── nodemon.json           # Observa só server.js e gameLogic.js
├── setup.sh               # Instalação Linux + serviço systemd
├── setup.ps1              # Instalação Windows
├── docs/
│   ├── README.md                  # Índice da documentação
│   ├── documentacao-tecnica.md    # Este arquivo
│   ├── manual-do-usuario.md       # Manual dos operadores
│   └── prompt-api-parciais.md     # Pedido de mudança para o time Laravel
├── test/
│   ├── gameLogic.test.js
│   ├── placarApi.test.js
│   └── placarEventos.test.js
└── public/                # Servido estaticamente
    ├── index.html         # Telão
    ├── static.html        # Placar minimalista (só números), sem arte
    ├── style.css          # Estilos do telão
    ├── base/              # Arte do telão (VERSIONADA no Git)
    │   ├── background.png, FUNDO.png, waiting.mp4
    │   └── futsal/ basquete/ volei/   # box.png, CAIXA.png, element-*.png
    ├── videos/            # Comerciais        (gitignored, criada no boot)
    ├── slides/            # Slides            (gitignored, criada no boot)
    ├── patrocinadores/    # Logos do carrossel(gitignored, criada no boot)
    └── controle/
        ├── index.html                 # Configuração
        ├── controle.html              # Mesa de controle (única p/ os 3 esportes)
        ├── controle_anuncios.html     # Vídeos, slides, patrocinadores
        └── controle_{futsal,basquete,volei}.html  # Só redirecionam p/ controle.html
```

---

## 4. Arquitetura

### 4.1 Separação lógica pura × transporte

```
┌────────────────────┐   eventos Socket.IO   ┌──────────────────────────────┐
│ Telas de controle  │ ────────────────────▶ │ server.js (transporte)       │
│ (tablets/PC)       │                       │  • gameState (memória)       │
└────────────────────┘                       │  • handlers socket.on(...)   │
          ▲                                  │  • broadcast()               │
          │ atualizar_tela (estado completo) │        │                     │
          │◀─────────────────────────────────│        ▼                     │
┌────────────────────┐                       │  gameLogic.js (regras puras) │
│ Telões (TV)        │◀──────────────────────│                              │
└────────────────────┘  animacao_*, vídeos   │  integração (opcional):      │
                                             │  placarEventos → placarApi ──┼──▶ API Laravel
                                             └──────────────────────────────┘
```

- **[gameLogic.js](../gameLogic.js)**: toda regra de jogo. Cada função recebe um
  `state` mutável e um payload, muta o estado no lugar e, quando há efeito para os
  clientes (animação), devolve `{ animacoes }`. Não importa Socket.IO, Express,
  `fs` nem `path` — por isso é testável sem servidor.
- **[server.js](../server.js)**: camada fina. Mantém o `gameState`, liga cada
  `socket.on(...)` à função correspondente de `gameLogic`, emite as animações e
  chama `broadcast()`.
- **[placarApi.js](../placarApi.js)** e **[placarEventos.js](../placarEventos.js)**:
  integração com a API externa. Também não guardam estado de negócio nem decidem
  regra de jogo.

**Regra prática:** mudou regra de jogo (pontuação, sets, cronômetro, faltas) →
`gameLogic.js` + teste em `test/gameLogic.test.js`. Mudou o que dispara a regra ou
como o estado chega aos clientes → `server.js`.

### 4.2 Fluxo de uma ação

1. Operador toca "+1" na mesa → `socket.emit('comando_placar', { time, acao: 'add_ponto', valor, jogador })`.
2. `server.js` chama `logic.comandoPlacar(gameState, payload)`.
3. O estado é mutado; a função devolve `animacoes` (ex.: `animacao_ponto`).
4. O servidor emite cada animação para **todos** os clientes.
5. `broadcast()` envia `atualizar_tela` com o estado completo + derivados.
6. **Depois** (otimista), se houver jogo da API carregado, a ação é traduzida em
   evento e entra na fila de sincronização.

Não há filtragem por cliente: todos recebem o estado inteiro a cada mudança.

### 4.3 Um jogo por processo

Existe **um** `gameState` global. Não há salas nem múltiplas partidas. Rodar duas
quadras simultâneas exige duas instâncias do servidor (portas diferentes).

O estado vive **só em memória**: reiniciar o processo zera placar, sets, parciais e
a fila de eventos pendentes da integração.

---

## 5. O estado do jogo (`gameState`)

Criado por `criarEstadoInicial()`:

```js
{
  esporte: 'futsal' | 'basquete' | 'volei',     // padrão 'futsal'
  sacando: 'timeA' | 'timeB' | null,            // quem pontuou por último (indicador de saque)
  periodo: 1,                                   // período/tempo/quarto corrente (mín. 1)
  transmissaoAtiva: false,                      // false = telão em tela de espera
  patrocinadores: ['logo1.png', ...],           // arquivos de public/patrocinadores/ (servidor sincroniza)
  videoStandby: 'waiting.mp4' | null,           // 1º vídeo (alfabético) de public/base/
  parciais: [{ a: 25, b: 23 }, ...],            // placar de cada set/quarto JÁ FECHADO
  timeA: {
    nome: 'Time Local', logo: '',               // logo: data URI base64 ou URL da API
    placar: 0, sets: 0, faltas: 0,
    elenco: [{ numero, nome, foto, video?, jogador_id?, titular?, capitao? }]
  },
  timeB: { /* idem, nome padrão 'Visitante' */ },
  cronometro: {
    rodando: false,
    tempoAcumulado: 0,          // ms acumulados em trechos anteriores (até o último pause)
    inicioTimestamp: 0,         // Date.now() do último play
    duracaoConfigurada: 600000  // ms — base da contagem regressiva (futsal/basquete)
  },
  slides: { arquivos: [], indice: 0, ativo: false }
}
```

Observações:

- **Fotos e logos** podem ser *data URIs* base64 (modo manual) ou URLs (jogo
  carregado da API). Vão inteiras em todo `atualizar_tela`.
- Campos `video`, `jogador_id`, `titular`, `capitao` no elenco só existem quando o
  jogo vem da API (ou foi editado depois de vir).

### 5.1 Payload de `atualizar_tela`

`payloadEstado()` em `server.js` envia o estado + campos derivados, para que os
HTMLs não reimplementem regra:

| Campo | Origem | Significado |
|---|---|---|
| `serverTime` | `Date.now()` | relógio do servidor, para sincronizar cronômetros |
| `parcialFechavel` | `parcialFechavel()` | a mesa deve habilitar "FECHAR SET"? |
| `parcialAtual` | `numeroParcialAtual()` | nº (1-based) da parcial em disputa |
| `totalParciais` | `quantidadeParciais()` | quantas colunas a grade de parciais desenha |
| `parcialEmAndamento` | `parcialEmAndamento()` | nº da parcial em disputa, ou `null` com o jogo decidido |
| `setPoint` | `pontoDeParcial()` | `'timeA'`/`'timeB'`/`null` — quem está a 1 ponto de fechar |

---

## 6. Módulo `gameLogic.js`

### 6.1 Constantes

| Constante | Valor |
|---|---|
| `EXTENSOES_VIDEO` | `.mp4 .webm .mov .avi .mkv` |
| `EXTENSOES_IMAGEM` | `.png .jpg .jpeg .gif .webp .svg` |
| `EXTENSOES_SLIDE` | imagens + vídeos |
| `TEXTOS_PONTO` (interna) | futsal `GOL!`, basquete `CESTA!`, vôlei `PONTO!` |
| `REGRAS_PARCIAL` | regras de set (vôlei) e quarto (basquete), ver 6.3 |

### 6.2 Funções

| Função | O que faz |
|---|---|
| `criarEstadoInicial()` | novo estado padrão |
| `configurarJogo(state, dados)` | aplica `esporte`, `timeA_nome`/`timeB_nome` (só se não vazios), `timeA_logo`/`timeB_logo` (aceita `''` para remover), `timeA_elenco`/`timeB_elenco`, `sacando` |
| `comandoPlacar(state, { time, acao, valor, jogador })` | ações de placar (tabela 6.4); devolve `{ animacoes }` |
| `comandoCronometro(state, { acao, valor, segundos }, now)` | `play` / `pause` / `set` (minutos + segundos). `now` injetável para teste |
| `tempoDecorrido(cronometro, agora)` | ms decorridos do cronômetro do jogo (acumulado + trecho corrente) |
| `comandoTransmissao(state, { ativa })` | liga/desliga a transmissão |
| `comandoSlides(state, { acao, arquivos })` | `iniciar` / `proximo` / `anterior` / `parar` |
| `numeroParcialAtual(state)` | parciais fechadas + 1 |
| `parcialEmAndamento(state)` | nº da parcial em disputa ou `null` (jogo decidido / teto atingido) |
| `quantidadeParciais(state)` | colunas a desenhar no telão |
| `parcialFechavel(state)` | se a pontuação já permite fechar a parcial |
| `vencedorParcial(state)` | `'timeA'`/`'timeB'`/`null` (empate) pelo placar corrente |
| `pontoDeParcial(state)` | set point: simula +1 para cada time e pergunta a `parcialFechavel` |
| `filtrarVideos` / `filtrarImagens` / `filtrarSlides(files)` | filtram por extensão (case-insensitive) |
| `escolherVideoBase(files)` | 1º vídeo em ordem alfabética natural (estável entre telões) |
| `sanitizarNomeArquivo(nome)` | remove caminho (anti path traversal), troca caracteres inseguros por `_`, devolve `''` se nada útil sobrar |

### 6.3 Regras de parcial (`REGRAS_PARCIAL`)

"Parcial" = **set** no vôlei, **quarto** no basquete.

| | Vôlei | Basquete |
|---|---|---|
| `rotulo` | `SET` | `QUARTO` |
| Pontos que habilitam o fechamento | 25; **15 no 5º set** | `null` (fecha pelo cronômetro — botão sempre disponível) |
| Vantagem mínima | 2 | 0 |
| Parciais para vencer | 3 (melhor de 5) | — |
| Máximo de parciais | 5 | sem teto (prorrogação) |
| Colunas exibidas | 5 | 4 |

**O fechamento é sempre manual.** Chegar a 25×23 só faz `parcialFechavel` virar
`true`; quem fecha é o operador, emitindo `fechar_set`. Motivo: um ponto lançado por
engano no fim do set não pode zerar o placar sem confirmação humana. `fechar_set`
também **não** valida `parcialFechavel` — o filtro é o botão da mesa, e o operador
precisa poder encerrar fora da regra (WO, jogo interrompido).

> Futsal não tem entrada em `REGRAS_PARCIAL`: não há parciais.

### 6.4 Ações de `comandoPlacar`

| Ação | Efeito | Animação emitida |
|---|---|---|
| `add_ponto` | `placar += valor`; `sacando = time` | `animacao_ponto` com `tipo: 'ponto'` (com jogador) ou `'ponto_time'` (sem jogador) |
| `sub_ponto` | `placar -= valor` se placar > 0 | — |
| `add_set` / `sub_set` | ±1 set (piso 0) | — |
| `add_falta` | +1 falta | `animacao_ponto` `tipo: 'falta'`, **só se houver jogador** |
| `sub_falta` | −1 falta (piso 0) | — |
| `fechar_set` | empurra `{a,b}` em `parciais`, +1 set ao vencedor (nenhum em empate), zera placares e `sacando` | `animacao_parcial` (`tipo: 'parcial'` ou `'jogo'` quando decidido) |
| `reabrir_set` | desfaz o último fechamento: devolve o placar e retira o set | — |
| `add_periodo` / `sub_periodo` | ±1 período (piso 1) | — |
| `zerar_tudo` | zera placar/sets/faltas/parciais/sacando/período/cronômetro (mantém times, elenco, transmissão e vínculo com a API) | — |

O payload de `animacao_parcial` carrega o **retrato do fechamento** (placar, sets,
nomes, número), porque o `atualizar_tela` seguinte já chega com o placar zerado.

### 6.5 Cronômetro

- `play`: se parado, `rodando = true`, `inicioTimestamp = now`.
- `pause`: se rodando, acumula `now - inicioTimestamp` em `tempoAcumulado`.
- `set`: para, zera o acumulado e define `duracaoConfigurada = (min*60 + seg) * 1000`.

Direção de exibição (decidida no frontend): **futsal** regressivo MM:SS,
**basquete** regressivo MM:SS.cc (centésimos), **vôlei** crescente MM:SS.

**Sincronização entre telas:** cada `atualizar_tela` traz `serverTime`. O cliente
calcula `clockOffset = Date.now() - serverTime` e soma em
`cronometro.inicioTimestamp`, de modo que todos os telões mostram o mesmo tempo
independentemente da latência ou do relógio local. Esse bloco está **duplicado**
em `public/index.html` e `public/controle/controle.html`.

---

## 7. Módulo `server.js`

Responsabilidades:

1. **Estáticos** de `public/` (via `__dirname`, para funcionar sob systemd/pm2).
   `.html/.css/.js` saem com `Cache-Control: no-cache` — o telão fica dias aberto e
   precisa pegar deploys novos; o ETag responde 304 quando nada mudou. Mídias usam
   o cache padrão.
2. **Pastas de mídia**: cria `videos/`, `patrocinadores/` e `slides/` no boot se
   faltarem.
3. **Estado**: `gameState` global, `payloadEstado()` e `broadcast()`.
4. **Sincronização de pastas**:
   - `sincronizarPatrocinadores()` — no boot e após upload/exclusão de logo.
   - `sincronizarVideoStandby()` — no boot e **a cada conexão de socket**; só
     rebroadcast se o vídeo mudou. Trocar o vídeo da pasta e recarregar o telão
     basta.
5. **Upload/exclusão** HTTP (seção 9).
6. **Handlers Socket.IO** (seção 8).
7. **Integração** com a API Laravel (seção 10).
8. Escuta em **`0.0.0.0:4000`** apenas quando executado diretamente
   (`require.main === module`). Exporta `{ app, server, io }` — útil para subir
   uma instância de teste em outra porta:
   ```bash
   node -e "const {server}=require('./server.js'); server.listen(4100,'0.0.0.0',()=>console.log('up'))"
   ```

---

## 8. Contrato Socket.IO

### 8.1 Cliente → servidor

| Evento | Payload | Efeito |
|---|---|---|
| `configurar_jogo` | `{ esporte?, timeA_nome?, timeB_nome?, timeA_logo?, timeB_logo?, timeA_elenco?, timeB_elenco?, sacando? }` | `configurarJogo` + broadcast |
| `comando_placar` | `{ time?, acao, valor?, jogador? }` | `comandoPlacar`, emite animações, broadcast, depois registra evento na API |
| `comando_cronometro` | `{ acao: 'play'\|'pause'\|'set', valor?, segundos? }` | `comandoCronometro`, broadcast, registra evento; o **primeiro `play`** de um jogo da API o marca como ao vivo |
| `comando_transmissao` | `{ ativa: boolean }` | liga/desliga o telão |
| `comando_video` | `{ acao: 'playlist'\|'play'\|'stop', arquivos?, arquivo?, loop? }` | repassa como `executar_video` para todos (sem mutar estado) |
| `solicitar_videos` | — | responde `lista_videos` só ao solicitante |
| `comando_slides` | `{ acao: 'iniciar'\|'proximo'\|'anterior'\|'parar', arquivos? }` | `comandoSlides` + broadcast (o estado dos slides vai no `atualizar_tela`) |
| `solicitar_slides` | — | responde `lista_slides` |
| `zerar_configuracao_completa` | — | **reset total**: novo estado inicial (preserva `patrocinadores` e `videoStandby`) e desvincula o jogo da API |
| `placar_chamar` | `{ acao, payload }` + ack | dispatcher genérico para a API (ver 10.4) |
| `placar_carregar_jogo` | `{ jogoId }` + ack | `GET /jogos/{id}` e aplica no estado |
| `placar_criar_jogo` | `{ dados }` + ack | `POST /jogos` (avulso) e aplica no estado |
| `placar_iniciar_jogo` | `{ jogoId?, operador? }` + ack | marca o jogo como ao vivo |
| `placar_salvar_escalacao` | `{ jogoId?, time_id, jogadores }` + ack | substitui a escalação do time |
| `placar_encerrar_jogo` | `{ jogoId?, placar_casa, placar_fora, sets_casa, sets_fora, periodos_jogados }` + ack | esvazia a fila e encerra o jogo |

Respostas com ack seguem `{ ok: true, dado }` ou `{ ok: false, status?, erro, corpo? }`.

> **Dois "zerar" diferentes, ambos necessários:** `comando_placar`/`zerar_tudo`
> (mesa — preserva times, elenco e vínculo com a API no meio da partida) e
> `zerar_configuracao_completa` (configuração — apaga tudo e desvincula a API).

### 8.2 Servidor → clientes

| Evento | Payload | Destino |
|---|---|---|
| `atualizar_tela` | estado + derivados (5.1) | todos, a cada mudança; e ao conectar |
| `animacao_ponto` | `{ tipo: 'ponto'\|'ponto_time'\|'falta', texto, jogador?, timeNome, timeLogo }` | todos |
| `animacao_parcial` | `{ tipo: 'parcial'\|'jogo', rotulo, numero, vencedor, placar:{a,b}, sets:{a,b}, times:{a,b} }` | todos |
| `executar_video` | repasse de `comando_video` | todos |
| `lista_videos` | `[nomes]` | solicitante; todos após upload/exclusão |
| `lista_slides` | `[nomes]` (ordem natural) | solicitante; todos após upload/exclusão |
| `integracao_status` | `{ configurada, jogoId, statusConexao, pendentes, ultimoErro }` | todos |
| `integracao_eventos_rejeitados` | `[{ uuid, motivo, ... }]` | todos |

`statusConexao`: `nao_configurado`, `ocioso`, `carregado`, `sincronizando`,
`sincronizado`, `erro`, `erro_configuracao` (401/403).

---

## 9. Endpoints HTTP

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/upload/:tipo?nome=<arquivo>` | corpo da requisição gravado em disco por *stream* (sem multer) |
| `DELETE` | `/api/:tipo/:nome` | apaga o arquivo |

`:tipo` ∈ `video` (→ `public/videos/`), `patrocinador` (→ `public/patrocinadores/`),
`slide` (→ `public/slides/`). O nome passa por `sanitizarNomeArquivo()` e a extensão
precisa estar na lista do tipo. Upload abortado remove o arquivo parcial.

Após qualquer mudança: vídeos → `lista_videos` para todos; slides → `lista_slides`;
patrocinadores → relê a pasta e faz `broadcast()`.

`public/base/` **não** tem endpoint nem UI de upload (fica fora de `TIPOS_ARQUIVO`
de propósito): é arte fixa versionada no Git.

> Não há autenticação nem limite de tamanho nesses endpoints — assume-se rede local
> confiável. Ver seção 15.

---

## 10. Integração com a API Laravel

### 10.1 Configuração

```env
# .env (copie de .env.example)
LARAVEL_BASE_URL=http://localhost:8000   # sem /api/placar
LARAVEL_API_TOKEN=1|AbCd...              # token Sanctum com a ability placar:operar
```

Sem as duas variáveis o servidor loga um aviso e opera em modo manual
(`statusConexao: 'nao_configurado'`); a tela de configuração desabilita os modos
de API.

### 10.2 `placarApi.js` — cliente HTTP

- Todas as funções recebem `config = { baseUrl, token, fetchImpl? }` como 1º
  argumento (testável sem mock de módulo; `fetchImpl` só nos testes).
- Prefixo `/api/placar`, cabeçalho `Authorization: Bearer <token>`, JSON.
- Status fora de 2xx → `ErroPlacarApi` com `status` e `corpo`. Interpretação:
  401 parar e avisar; 403 configuração; 404 ids dessincronizados; 422 payload
  inválido; 429 requisições rápidas demais.
- `enviarVideoJogador` é a exceção: multipart (`video`, mp4/webm, ≤ 28 MB), não
  base64 — sem UI ainda.

Endpoints cobertos: `ping`, `modalidades`, `equipes` (+logo), `times` (+elenco,
+logo), `jogadores` (+foto, +vídeo), `jogos` (listar, obter, criar, iniciar,
escalação, eventos, encerrar, súmula, atuação do jogador), `scout/jogadores/{id}`.
`GET /scout/artilharia` **foi removido** da API.

### 10.3 `placarEventos.js` — fila de eventos

O log da API é **append-only**. O módulo:

1. Gera `uuid` (idempotência) e `sequencia` (ordem) **no momento da ação**, não do
   envio — um retry reenvia o mesmo uuid.
2. Acumula eventos e envia **em lote** (`POST /jogos/{id}/eventos`).
3. Traduz correções (`sub_ponto`, `sub_falta`, `sub_set`, `reabrir_set`) em evento
   `estorno` que referencia o uuid original (via `ultimosPorChave`, chave
   `"timeA:ponto"` etc.). Sem rastro em memória (ex.: servidor reiniciado),
   `criarEstorno` devolve `null` e só o placar local é ajustado.

Tradução de ações:

| Ação local | Evento na API |
|---|---|
| `add_ponto` | `ponto` (`valor`, `jogador_id`, `periodo`, `cronometro_ms`) |
| `add_falta` | `falta` (`jogador_id`, `periodo`, `cronometro_ms`) |
| `add_set` / `fechar_set` | `set` (`fechar_set` leva `payload: { numero, placar_casa, placar_visitante }`; `time_id` `null` em quarto empatado) |
| `sub_*` / `reabrir_set` | `estorno` |
| `add_periodo` / `sub_periodo` | `periodo` |
| cronômetro `play`/`pause`/`set` | `crono_play` / `crono_pause` / `crono_set` |
| `zerar_tudo` | **ignorado** (não existe "desfazer tudo" no log) |

`cronometro_ms` é **obrigatório** em `ponto`/`falta`: vem de
`gameLogic.tempoDecorrido()` (nunca de `tempoAcumulado`, que congela com o relógio
rodando) e é normalizado para inteiro ≥ 0.

`enviarPendentes` remove da fila os uuids **aceitos, duplicados e rejeitados**
(rejeitado também foi processado); eventos registrados durante um envio em voo
permanecem para o próximo lote.

### 10.4 Bookkeeping em `server.js`

O objeto `integracao` (`jogoId`, `timeAId`, `timeBId`, `fila`, `statusConexao`,
`ultimoErro`, `iniciado`) fica **fora** do `gameState`: é transporte, não regra.

- `aplicarJogoNoEstado(resposta)` — faz `zerar_tudo`, copia esporte, nomes, logos
  (`logo_url`) e elencos (`mapearElencoApi`), e reinicia a fila.
- `iniciarJogoNaApi()` — `POST /iniciar`; retoma a sequência de
  `ultima_sequencia` (idempotente em reconexões). Chamado pelo botão manual **e
  automaticamente no primeiro PLAY** do cronômetro (`integracao.iniciado`).
- `tentarEnviarPendentes()` — nunca lança; roda após cada evento e a cada **5 s**
  (`setInterval(...).unref()`).
- `placar_encerrar_jogo` esvazia a fila antes de encerrar; a resposta pode trazer
  `observacoes` (divergência para conferência humana).
- `ACOES_PLACAR_API` — mapa do dispatcher `placar_chamar`: `ping`,
  `listarModalidades`, `listarEquipes`, `criarEquipe`, `enviarLogoEquipe`,
  `removerLogoEquipe`, `listarTimes`, `elencoDoTime`, `criarTime`,
  `enviarLogoTime`, `removerLogoTime`, `criarJogador`, `enviarFotoJogador`,
  `removerFotoJogador`, `removerVideoJogador`, `listarJogos`, `sumulaDoJogo`,
  `atuacaoDoJogador`, `perfilJogador`.

Atualizações de placar são **otimistas**: o telão atualiza antes de qualquer
chamada à API; a sincronização acontece em segundo plano.

### 10.5 Pendência no contrato: parciais

A API recebe as parciais (no `payload` do evento `set`) mas ainda **não as
devolve** em `GET /jogos/{id}`. Assim a grade "set a set" só existe na memória do
Node. O pedido ao time Laravel está em
[prompt-api-parciais.md](prompt-api-parciais.md). Os comentários do código citam
`docs/placar-clube-api.md` (contrato da API), que **não está neste repositório** —
é mantido pelo time Laravel.

---

## 11. Frontend

Sem build, sem framework, sem bundler. Edite os arquivos direto; o nodemon ignora
`public/` (basta recarregar a página). Todas as páginas usam o cliente servido em
`/socket.io/socket.io.js` e expõem um `socket` global.

### 11.1 Configuração — `public/controle/index.html`

- Painel **Integração com o Placar Clube** com três modos: *Selecionar jogo
  existente* (recomendado, padrão), *Criar jogo agora* (avulso) e *Manual*. Com
  integração disponível e nenhum jogo carregado, a tela muda sozinha para
  "Selecionar" e já busca.
- `aplicarRespostaJogoNaTela()` (usada por **Carregar** e pela criação avulsa)
  preenche a tela e chama **`enviarConfiguracao()`** direto — o fluxo da API não
  precisa de "Salvar", e **não trava** o formulário, porque editar o elenco logo
  depois é comum.
- `salvarConfig()` = `enviarConfiguracao()` + validação + **trava** do formulário
  (confirmação do modo manual). Não mover a trava para dentro de
  `enviarConfiguracao`.
- O cartão de transmissão fica logo abaixo do de API; `#lista-jogos` tem altura
  limitada com rolagem própria — para a agenda não empurrar o botão para fora da
  tela.
- Elenco: adicionar/remover/editar jogadores, foto por jogador, checkboxes de
  titular/capitão, `💾 Salvar escalação (API)` (só jogadores com `jogador_id`).
- Importação de elenco (`importarElenco`): `.txt/.csv` (`;`, `,`, TAB ou espaço) e
  `.xlsx/.xls` via SheetJS; **substitui** o elenco com confirmação.
- Modo avulso: `criarTime` para A e B (a API faz *firstOrCreate* por
  `equipe_nome`) e depois `placar_criar_jogo`.

### 11.2 Mesa — `public/controle/controle.html`

- **Uma tela para os três esportes.** O que muda fica no objeto `ESPORTES`:

  ```js
  futsal:   { botoes: 1, textoPonto: '+1 GOL',   faltas: true,  periodo: true,  sets: false, parciais: false, crono: 'regressivo' }
  basquete: { botoes: 3, textoPonto: '+1',       faltas: true,  periodo: true,  sets: false, parciais: false, crono: 'regressivo_cs' }
  volei:    { botoes: 1, textoPonto: '+1 PONTO', faltas: false, periodo: false, sets: true,  parciais: true,  crono: 'crescente' }
  ```

  `sets` (contador no painel) e `parciais` (barra de fechar/reabrir) são flags
  separadas de propósito.
- Layout por frequência de uso: relógio no topo (toque = play/pause), botão de
  ponto ocupando a altura do painel, rodapé com −1 (com `confirm()`) e ação
  contextual, e o resto atrás de **⚙ MAIS** (definir tempo, reiniciar, período,
  inverter lados, fechar jogo, parar transmissão, zerar).
- **Inverter lados** é só do aparelho (`localStorage` `placar_controle_invertido`),
  nunca muda o servidor nem o telão.
- **Cores dos times são variáveis CSS** (`.tema-azul`/`.tema-vermelho`) aplicadas a
  `[data-lado]` por `aplicarTemas()`, para a cor seguir o *time* na inversão. Não
  use classes Tailwind de cor fixas nos painéis.
- Modal de jogador: elenco ordenado por número (sem número no fim);
  "Sem jogador específico" marca sem creditar; "✕ Cancelar"/`Esc` desiste sem
  enviar nada (limpa `pendingAcao`).
- Badge `🔗 #id · ok/N pend.` reflete `integracao_status`;
  `integracao_eventos_rejeitados` vira `alert`.
- `controle_futsal.html`, `controle_basquete.html`, `controle_volei.html` são só
  redirecionamentos para manter atalhos antigos dos tablets.

### 11.3 Anúncios — `public/controle/controle_anuncios.html`

Abas **🎬 Vídeos** e **🖼️ Slides**, mais a seção de **📣 Patrocinadores**.

- Vídeos: lista, upload (`⬆ Enviar vídeo`), exclusão, fila, `🔁 LOOP`,
  `▶ REPRODUZIR FILA` (`comando_video` `playlist`), `⏹ PARAR`.
- Slides: upload de imagens/vídeos, **📄 Enviar PDF** (cada página vira um PNG
  `<nome>_001.png`… convertido no navegador com pdf.js), fila, iniciar, anterior,
  avançar, parar. O estado dos slides vive no `gameState` — telão que reconecta no
  meio da apresentação sincroniza sozinho.
- Patrocinadores: upload/exclusão de logos.

### 11.4 Telão — `public/index.html` + `public/style.css`

Ver seção 12.

### 11.5 `public/static.html`

Placar minimalista (fundo preto, só números de placar e sets do vôlei), sem arte
nem animações. Útil como saída alternativa ou para diagnóstico.

---

## 12. O telão em detalhe

### 12.1 Camadas (de baixo para cima)

1. **Placar** (`.placar-container`) com a arte do esporte (`changeCssSport`,
   `sportConfig` define áreas extras: sets/parciais no vôlei, faltas no
   futsal/basquete).
2. **Faixas de animação** dentro do container: `#anim-overlay` (z 40, ponto/falta)
   e `#set-overlay` (z 41, fechamento de parcial).
3. **Vídeo do jogador** `#anim-video-overlay` (z 88, irmão do container).
4. **Slides**, **comerciais** (z 100) e **tela de espera** (`#tela-inicial`)
   cobrindo tudo.

### 12.2 Tamanho em tela cheia

A arte (`base/background.png` + `box.png` do esporte) é **2:1** e tudo dentro do
placar é posicionado em `%`/`cqw`. Por isso a única transformação que mantém o
alinhamento é a **escala uniforme**: o container é o maior 2:1 que cabe
(`width: min(100vw, 200vh)`). Não estique (posições em % da altura, fontes em
`cqw`) nem use `cover` (corta logos do clube/CBC nos cantos e a faixa de
patrocinadores).

A sobra é pintada com as **cores das bordas da arte** (`--borda-arte-topo`,
`--borda-arte-base`, `--borda-arte-lados` no topo de `style.css`, via
`body::before`/`::after` e fundo do `body`). O vídeo de espera usa as mesmas
cores pela classe `.preenche-sobra`. **Se a arte mudar, remeça as bordas** (linhas
0 e 511 de `background.png` em 1024×512; colunas 0/1023) e atualize as variáveis.

O telão pede **tela cheia** no primeiro clique/tecla da sessão (o mesmo gesto que
libera o áudio), só uma vez; depois, duplo-clique alterna. Um `resize` com debounce
re-executa `ajustarNome()`.

**Regra:** tudo desenhado sobre o placar mede em `cqw`; `vh`/`vw` só para o que é
tela cheia de verdade (standby, slides, comerciais, vídeo do jogador).

### 12.3 Tela de espera

Enquanto `transmissaoAtiva` é `false`, `#tela-inicial` toca `gameState.videoStandby`
(de `public/base/`) em loop, **mudo**, ocupando a tela. `aplicarStandby()` só troca
`video.src` quando o nome muda (o `atualizar_tela` chega a cada tique) e pausa o
vídeo durante a transmissão. Sem vídeo na pasta: cartão `#standby-texto` (ícone do
esporte + nome do clube + "Aguardando transmissão..."). Para ter som, trocar
`comSom: false` por `true` em `aplicarStandby()`.

### 12.4 Nome do time em uma linha

`ajustarNome()` cede na ordem: encolhe a fonte (2,5 → 1,4 cqw), condensa
(`scaleX` até 0,8), por fim corta com reticências.

### 12.5 Faixa de ponto/falta (`#anim-overlay`)

Faixa grená (`#2a0008 → #6a0414 → #8e1030`) com fios dourados, 5 s num **único**
keyframe (abrir/segurar/fechar — duas animações com delay brigariam pelo
`clip-path`). Conteúdo: etiqueta (`GOL!`…), `#número` + nome do jogador, brasão +
nome do clube, e a linha de **todos os patrocinadores**
(`montarPatrocinadoresAnim`, altura via `alturaLogoPatro`, que diminui conforme a
lista cresce). Recolocar a classe `.ativo` reinicia a animação (lance novo corta o
anterior).

| Tempo | O que acontece |
|---|---|
| 0,00–0,55 s | a faixa se abre da esquerda para a direita (`clip-path`) |
| 0,25–1,00 s | foto, time, ação e jogador entram escalonados |
| 0,55–1,65 s | brilho dourado varre a faixa |
| 4,55–5,00 s | a faixa se fecha para a direita |

Tamanhos: etiqueta 2,3 cqw; `#número` 4,4 cqw + nome 7 cqw; brasão 4,2 cqw de
altura + nome do clube 3 cqw. Logos de patrocinadores dividem a largura em fatias
iguais (`flex: 1 1 0; min-width: 0`) e a altura cai com a quantidade: 6 cqw até 4
logos, 5,2 até 6, 4,4 até 9, 3,6 acima disso. Com 8 patrocinadores a faixa vai de
47 % para 60 % da altura do placar durante os 5 s; para desligar, esconda
`#anim-patrocinadores`.

Variações: `.sem-foto` (texto centrado), `.sem-logo-time`, `.anim-falta` (sem
brilho, sem patrocinadores), `.anim-time-only` (ponto sem jogador: logo do time
no lugar da foto, em quadrado arredondado com `contain`).

Se o jogador tem `video`, num **ponto** (nunca em falta) o vídeo toca primeiro em
tela cheia (`mostrarVideoJogador`, fade de 600 ms, trava de 30 s) e a faixa entra
depois; se o vídeo falhar, cai direto para a faixa.

### 12.6 Fechamento de set / fim de jogo (`#set-overlay`)

Mesma linguagem visual, maior, **9 s**. Uma linha por time com os pontos da
parcial (vencedor em dourado) e o total de sets embaixo. Com o jogo decidido vira
**FIM DE JOGO** e o campeão pulsa. Corta a faixa de ponto e o vídeo do jogador.

### 12.7 Set point e parciais

- **Set point**: selo dourado sobre o número do time quando `setPoint` não é
  `null`; a animação de entrada roda só quando o estado muda (`renderSetPoint`).
- **Grade de parciais** (`renderParciais`): todas as colunas desde o início
  (5 sets / 4 quartos), cada uma *fechada* (vencedor em dourado), *em disputa*
  (placar ao vivo) ou *futura* (travessão).
- **Basquete ainda não exibe parciais.** Para ligar: `extraAreas: [areaFault, areaParciais]`
  no `sportConfig.basquete` de `public/index.html` e `parciais: true` no basquete
  em `ESPORTES` de `controle.html`. `gameLogic`/`server` não mudam.

### 12.8 Cronômetro e placar sempre visíveis (basquete)

No basquete o tempo e o placar nunca podem sumir. Enquanto uma faixa ou o vídeo do
jogador está em cena, `manterJogoVisivel()` (no laço de 50 ms do cronômetro) move o
relógio para `#tempo-flutuante` (faixa do topo da arte) e o placar para
`#placar-flutuante` (faixa da base), escondendo os originais. A placa de baixo
**repete o relógio** no centro (`#pf-tempo`, entre os pontos dos dois times), de
modo que o tempo aparece em cima e embaixo; os dois textos são escritos no mesmo
tique do laço.
`atualizarPlacarFlutuante()` roda a cada `atualizar_tela`. Comerciais, slides e
standby continuam cobrindo tudo. Não vale para futsal e vôlei.

### 12.9 Carrossel de patrocinadores

A arte reserva uma faixa escura a partir de **y=455 de 512 px (88,87 %)**, igual
nos três esportes — é o `top` de `.sponsor-carousel-container`. Subir esse valor
joga as logos sobre os nomes dos times. Medidas em `cqw`, nunca `px`. Uma
assinatura da lista evita reconstruir o DOM (e reiniciar a animação) a cada
broadcast. Lista vazia esconde o carrossel.

### 12.10 Áudio e autoplay

Vídeos sempre começam (mudos se necessário — `tocarSemGesto`); o som é ligado
assim que o navegador permitir. Enquanto mudo à força aparece "🔇 Som bloqueado…";
qualquer clique/tecla libera (`liberarAudio`). Em produção, rodar o navegador com
`--autoplay-policy=no-user-gesture-required --kiosk`.

Na playlist de comerciais com `loop: true`, a fila é recarregada ao esvaziar,
desde que ao menos um vídeo tenha tocado no ciclo (evita loop infinito com todos
falhando).

---

## 13. Testes

```bash
npm test                              # node --test (todos os arquivos em test/)
npm run test:watch
node --test test/gameLogic.test.js    # um arquivo
```

| Arquivo | Cobre |
|---|---|
| `test/gameLogic.test.js` | estado inicial, placar, parciais/set point, cronômetro, configuração, slides, filtros, `escolherVideoBase`, sanitização |
| `test/placarApi.test.js` | URLs, cabeçalhos, query strings, erros tipados (via `fetchImpl` falso) |
| `test/placarEventos.test.js` | uuid/sequência, estorno, tradução de ações, envio em lote e retry |

Estado atual: **128 testes, todos passando**.

Não há testes automatizados para os handlers de `server.js`, os endpoints HTTP nem
o frontend. Verificação end-to-end é manual com Playwright (ver
`.claude/skills/verify/SKILL.md`): subir em outra porta, dirigir as páginas por
`page.evaluate(() => socket.emit(...))`, ligar a transmissão antes de capturar o
placar, limpar o estado e os arquivos enviados ao final.

---

## 14. Instalação, execução e deploy

### Desenvolvimento

```bash
npm install
cp .env.example .env     # opcional: integração com a API
npm run dev              # nodemon, porta 4000
```

### Produção (Linux)

`bash setup.sh` (sem sudo): verifica node/npm/git/systemd, clona ou faz `git pull`,
`npm install --omit=dev` e registra o serviço systemd `placar-clube`
(`Restart=on-failure`). Rodar de novo atualiza e reinicia.

```bash
systemctl status placar-clube
sudo systemctl restart placar-clube
journalctl -u placar-clube -f
```

### Produção (Windows)

`.\setup.ps1`: verifica pré-requisitos, clona, instala, roda os testes e oferece
`npm start`. Não registra serviço.

### URLs (porta 4000)

| Tela | URL |
|---|---|
| Telão | `http://<ip>:4000/` |
| Configuração | `http://<ip>:4000/controle/` |
| Mesa | `http://<ip>:4000/controle/controle.html` |
| Anúncios | `http://<ip>:4000/controle/controle_anuncios.html` |
| Placar simples | `http://<ip>:4000/static.html` |

A porta está fixa no código (`server.listen(4000, ...)`).

---

## 15. Limitações conhecidas e dívidas técnicas

- **Estado só em memória** — reiniciar perde placar, parciais e a fila de eventos
  ainda não enviados à API.
- **Um jogo por processo.**
- **Sem autenticação** nos sockets e nos endpoints de upload/exclusão; **sem limite
  de tamanho** de upload. Pressupõe rede local confiável.
- **Handlers síncronos sem `try/catch`** (`comando_placar`, `comando_cronometro`,
  `configurar_jogo`) — payload malformado (ex.: `time` inválido) pode lançar.
- **Fotos/logos em base64** trafegam inteiras em todo `atualizar_tela`.
- **Dependências de CDN** nas telas de controle (Tailwind, SheetJS, pdf.js).
- **Parciais não voltam da API** (10.5).
- Bloco de `clockOffset` duplicado entre telão e mesa.
- `.gitignore` lista `CLAUDE.md`, mas o arquivo já é versionado (continua rastreado).

---

## 16. Receitas de manutenção

**Adicionar/alterar uma regra de pontuação** → `gameLogic.js` (`comandoPlacar` ou
`REGRAS_PARCIAL`) + teste. Se a mesa precisar saber de algo derivado, exponha em
`payloadEstado()` em vez de recalcular no HTML.

**Adicionar um esporte** → `TEXTOS_PONTO` e, se tiver parciais, `REGRAS_PARCIAL`
(`gameLogic.js`); entrada em `ESPORTES` (`controle.html`); `sportConfig` e arte em
`public/base/<esporte>/` (`index.html`); opção na configuração
(`controle/index.html`); `traduzirAcaoPlacar` se houver ação nova.

**Novo tipo de arquivo enviado pelo operador** → entrada em `TIPOS_ARQUIVO`
(`server.js`), lista de extensões em `gameLogic.js`, pasta no `.gitignore` e no
laço de criação de diretórios, e o tratamento em `aposMudancaArquivo`.

**Nova chamada à API Laravel** → função em `placarApi.js` (+ teste com
`fetchImpl`), e, se for consulta de tela, entrada em `ACOES_PLACAR_API`.

**Nova ação de placar que deve ir para a súmula** → `case` em
`traduzirAcaoPlacar` (`placarEventos.js`) + teste.

**Mudança na arte do telão** → remedir as bordas (`--borda-arte-*`) e o início da
faixa de patrocinadores (88,87 %).
