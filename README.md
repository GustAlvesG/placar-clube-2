# Placar Clube 🏀⚽🏐

Sistema de controle de placar em tempo real para eventos esportivos (futsal, basquete e vôlei) com transmissão ao vivo via WebSocket.

## Visão Geral

**Placar Clube** é uma aplicação web full-stack que permite:
- Controlar placar, pontos, sets, faltas e período de um jogo em tempo real
- Transmitir o placar para múltiplos telões simultâneos
- Exibir animações personalizadas ao marcar pontos/faltas com jogadores
- Gerenciar elenco de jogadores com fotos e números
- Reproduzir vídeos e comerciais em tela cheia
- Suporte para futsal, basquete e vôlei com regras específicas

### Tecnologias

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: HTML5 + CSS (Tailwind) + JavaScript vanilla
- **Testes**: Node.js `node:test` (nativo)
- **Dev**: Nodemon (reload automático)

---

## Instalação Rápida

### Linux / macOS
```bash
bash setup.sh
```

### Windows (PowerShell)
```powershell
.\setup.ps1
```

Ou veja a seção **Instalação Manual** abaixo.

---

## Instalação Manual

### Pré-requisitos
- Node.js 22+ ([download](https://nodejs.org))
- Git

### Passos

1. **Clonar o repositório**
   ```bash
   git clone https://github.com/GustAlvesG/placar-clube.git
   cd placar-clube
   ```

2. **Instalar dependências**
   ```bash
   npm install
   ```

2.1. **(Opcional) Configurar a integração com a API do Placar Clube**
   ```bash
   cp .env.example .env   # preencha LARAVEL_BASE_URL e LARAVEL_API_TOKEN
   ```
   Sem isso o app funciona normalmente em modo manual — ver seção
   [Integração com a API do Placar Clube (Laravel)](#integração-com-a-api-do-placar-clube-laravel).

3. **Iniciar o servidor**
   - **Modo produção**:
     ```bash
     npm start
     ```
   - **Modo desenvolvimento** (com nodemon):
     ```bash
     npm run dev
     ```

4. **Acessar**
   - Placar: `http://localhost:3000`
   - Configuração: `http://localhost:3000/controle/`
   - Controle do jogo: `http://localhost:3000/controle/controle.html`
   - Anúncios/vídeos: `http://localhost:3000/controle/controle_anuncios.html`

---

## Scripts NPM

```bash
npm start                # Inicia servidor produção
npm run dev              # Inicia com nodemon (reload automático)
npm test                 # Roda testes unitários
npm run test:watch      # Roda testes em modo watch
```

---

## Arquitetura

### Estrutura de Pastas

```
placar-clube/
├── server.js                      # Servidor Express + Socket.IO
├── gameLogic.js                   # Lógica pura do jogo (testável)
├── nodemon.json                   # Configuração de reload
├── package.json
├── public/
│   ├── index.html                 # Placar (telão)
│   ├── style.css                  # Estilos CSS
│   ├── base/                      # Imagens por esporte
│   │   ├── futsal/
│   │   ├── basquete/
│   │   └── volei/
│   ├── videos/                    # Vídeos/comerciais (.mp4, .webm, .mkv, etc)
│   └── controle/
│       ├── index.html             # Configuração (nomes, elenco, esporte)
│       ├── controle.html          # Controle universal
│       ├── controle_futsal.html   # Controle futsal
│       ├── controle_basquete.html # Controle basquete
│       ├── controle_volei.html    # Controle vôlei
│       └── controle_anuncios.html # Gerenciador de vídeos
└── test/
    └── gameLogic.test.js          # Suite de testes (31 testes)
```

### Fluxo de Dados

```
Operador (controle.html)
    ↓
Socket.IO evento
    ↓
server.js (handler)
    ↓
gameLogic.js (lógica pura)
    ↓
gameState (mutação)
    ↓
broadcast() → io.emit('atualizar_tela')
    ↓
Telão (index.html) + Controles (recebem estado)
```

### Socket.IO Eventos

#### Do Operador para o Servidor

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `configurar_jogo` | `{ esporte, timeA_nome, timeB_nome, timeA_logo?, timeB_logo?, timeA_elenco, timeB_elenco, sacando? }` | Configura esporte, nomes, logos, elenco |
| `comando_placar` | `{ time, acao, valor, jogador? }` | Marca pontos, faltas, sets, período |
| `comando_cronometro` | `{ acao, valor?, segundos? }` | Controla timer (play/pause/set) |
| `comando_transmissao` | `{ ativa: boolean }` | Liga/desliga transmissão |
| `comando_video` | `{ acao, arquivo?, arquivos?, loop? }` | Play/stop de vídeos; `loop: true` repete a playlist até o STOP |
| `solicitar_videos` | `{}` | Lista vídeos em `public/videos/` |

#### Do Servidor para Clientes

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `atualizar_tela` | `{ ...gameState, serverTime }` | Broadcast do estado completo |
| `animacao_ponto` | `{ tipo, texto, jogador, timeNome }` | Faixa de ponto/falta com o jogador |
| `animacao_parcial` | `{ tipo, rotulo, numero, vencedor, placar, sets, times }` | Faixa de fechamento de set/quarto (e fim de jogo) |
| `executar_video` | `{ acao, arquivo? }` | Instrui telão a tocar vídeo |
| `lista_videos` | `[filenames]` | Lista de vídeos disponíveis (também broadcast após upload/exclusão) |

#### Endpoints HTTP (upload/exclusão de arquivos)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/upload/video?nome=arquivo.mp4` | Grava o corpo da requisição em `public/videos/` (stream) |
| `POST` | `/api/upload/patrocinador?nome=logo.png` | Grava em `public/patrocinadores/` e rebroadcast o estado |
| `DELETE` | `/api/video/:nome` | Exclui o vídeo do servidor |
| `DELETE` | `/api/patrocinador/:nome` | Exclui a logo e rebroadcast o estado |

Nomes são sanitizados no servidor (sem path traversal) e a extensão precisa ser válida para o tipo (vídeos: `.mp4 .webm .mov .avi .mkv`; imagens: `.png .jpg .jpeg .gif .webp .svg`).

---

## gameState (Estrutura do Estado)

```javascript
{
  esporte: 'futsal' | 'basquete' | 'volei',
  sacando: 'timeA' | 'timeB' | null,
  periodo: number,                    // 1, 2, 3...
  transmissaoAtiva: boolean,
  patrocinadores: [string],             // nomes dos arquivos de imagem em
                                        // public/patrocinadores/ (carrossel do telão),
                                        // sincronizado pelo servidor a cada upload/exclusão
  
  timeA: {
    nome: string,
    logo: string (base64 ou ""),
    placar: number,
    sets: number,
    faltas: number,
    elenco: [
      { numero: string, nome: string, foto: string (base64 ou "") },
      ...
    ]
  },
  timeB: { /* idem */ },
  
  cronometro: {
    rodando: boolean,
    tempoAcumulado: number,           // ms
    inicioTimestamp: number,          // ms (quando foi ligado)
    duracaoConfigurada: number        // ms (countdown do basquete e do futsal)
  }
}
```

---

## gameLogic.js - Funções Puras

Módulo que encapsula toda a lógica do jogo, permitindo testes unitários sem Socket.IO.

### `criarEstadoInicial()`
Retorna um novo `gameState` padrão.

```javascript
const state = logic.criarEstadoInicial();
```

### `configurarJogo(state, dados)`
Aplica configurações ao estado: esporte, nomes, logos, elenco, saque.

```javascript
logic.configurarJogo(state, {
  esporte: 'basquete',
  timeA_nome: 'Águias',
  timeB_nome: 'Leões',
  timeA_elenco: [
    { numero: '10', nome: 'João Silva', foto: 'data:image/...' }
  ],
  sacando: null
});
```

### `comandoPlacar(state, { time, acao, valor, jogador })`
Aplica ações de placar e retorna animações a emitir.

**Ações**:
- `add_ponto`: adiciona pontos (futsal/basquete: +1/+2/+3; vôlei: +1)
  - No vôlei, 25 pontos com diferença ≥2 vence o set automaticamente
- `sub_ponto`: subtrai pontos (piso 0)
- `add_set` / `sub_set`: adiciona/subtrai sets (sub piso 0)
- `add_falta` / `sub_falta`: adiciona/subtrai faltas (sub piso 0)
- `add_periodo` / `sub_periodo`: incrementa/decrementa período (sub piso 1)
- `zerar_tudo`: reseta placar, sets, faltas, sacando, período e cronômetro (a transmissão segue no ar)

```javascript
const { animacoes } = logic.comandoPlacar(state, {
  time: 'timeA',
  acao: 'add_ponto',
  valor: 2,
  jogador: { numero: '7', nome: 'Pedro', foto: 'data:...' }
});
// animacoes[0] = { name: 'animacao_ponto', payload: { texto: 'CESTA!', jogador, timeNome } }
```

### `comandoCronometro(state, { acao, valor, segundos }, now)`
Controla o cronômetro.

**Ações**:
- `play`: liga o cronômetro
- `pause`: pausa e acumula tempo decorrido
- `set`: define duração em minutos + segundos

```javascript
logic.comandoCronometro(state, { acao: 'set', valor: 10, segundos: 30 }, Date.now());
// duracaoConfigurada = 630000 ms (10:30)
```

### `comandoTransmissao(state, dados)`
Ativa/desativa transmissão.

```javascript
logic.comandoTransmissao(state, { ativa: true });
```

### `filtrarVideos(files)`
Filtra extensões válidas (`.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`).

```javascript
const videos = logic.filtrarVideos(fs.readdirSync(videoDir));
// ['jogo.mp4', 'intro.webm', ...]
```

---

## server.js - Servidor

Instancia Express + Socket.IO, expõe handlers de socket para receber eventos do operador.

### Lifecycle

1. **Conexão nova**: emite `atualizar_tela` com estado completo + `serverTime` para sincronização de cliente
2. **Evento do operador**: chama função de `gameLogic`, mutua `gameState`, emite animações se houver, faz `broadcast()`
3. **Broadcast**: emite `atualizar_tela` para **todos os clientes**

### Handlers

- `socket.on('configurar_jogo', dados)` → `logic.configurarJogo(gameState, dados)` → broadcast
- `socket.on('comando_placar', payload)` → `logic.comandoPlacar(gameState, payload)` → emit animações → broadcast
- `socket.on('comando_cronometro', payload)` → `logic.comandoCronometro(gameState, payload, Date.now())` → broadcast
- `socket.on('comando_transmissao', dados)` → `logic.comandoTransmissao(gameState, dados)` → broadcast
- `socket.on('comando_video', dados)` → broadcast direto para `executar_video`
- `socket.on('solicitar_videos', )` → list `public/videos/` → `lista_videos`

---

## Integração com a API do Placar Clube (Laravel)

Este app não tem cadastro de equipes/times/jogadores/jogos próprio — quando configurado,
ele consome uma API Laravel externa (módulo "Placar Clube", rota base `/api/placar`) que é
a fonte de verdade desses dados e do histórico de eventos da partida. Sem essa
configuração, o app continua funcionando 100% como antes (modo manual, sem integração).

### Configuração

Copie `.env.example` para `.env` e preencha:

```env
LARAVEL_BASE_URL=http://localhost:8000   # sem o sufixo /api/placar
LARAVEL_API_TOKEN=1|AbCdEf...            # gerado via `php artisan placar:token node-dev`
```

Sem essas duas variáveis preenchidas, o servidor loga um aviso na inicialização e a
integração fica desativada (nenhuma tela de operador quebra — as opções "Selecionar jogo
existente"/"Criar jogo agora" ficam desabilitadas na tela de configuração).

### Módulos

- **`placarApi.js`** — cliente HTTP puro para todos os endpoints documentados (autenticação
  Bearer, um `ErroPlacarApi` tipado por status HTTP). Não guarda estado nenhum; toda função
  recebe `config = { baseUrl, token, fetchImpl? }`.
- **`placarEventos.js`** — fila de eventos do jogo: gera `uuid`/`sequencia` no momento em
  que a ação acontece, traduz ações de placar/cronômetro em eventos (ou em `estorno`,
  quando o operador desfaz um ponto/falta/set), e envia em lote via `placarApi.enviarEventos`.
  `cronometro_ms` é **obrigatório** em `ponto`/`falta` na API — vem de
  `gameLogic.tempoDecorrido(cronometro)`, nunca de `tempoAcumulado` sozinho (que fica
  congelado enquanto o cronômetro está rodando).
- **`server.js`** — dono do bookkeeping de transporte (id do jogo/times na Laravel, fila
  pendente, status de conexão) e dos handlers de socket `placar_*` (ver abaixo). `gameLogic.js`
  continua sem nenhuma dependência de rede.

### Handlers de socket adicionais

- `placar_chamar` (`{ acao, payload }`, ack) → dispatcher genérico para leitura/criação
  (equipes, times, jogadores, jogos, scout) — usado pelas telas de seleção/criação avulsa.
- `placar_carregar_jogo` (`{ jogoId }`, ack) → `GET /jogos/{jogo}`, aplica ao `gameState`.
- `placar_criar_jogo` (`{ dados }`, ack) → modo avulso: cria o jogo (times já criados via
  `placar_chamar`) e aplica ao `gameState` do mesmo jeito.
- `placar_iniciar_jogo`, `placar_salvar_escalacao`, `placar_encerrar_jogo` (ack) → ciclo de
  vida do jogo.
- `integracao_status` (server → client, broadcast) → `{ configurada, jogoId, statusConexao,
  pendentes, ultimoErro }`, consumido pelo badge de sincronização em `controle*.html`.
- `integracao_eventos_rejeitados` (server → client, broadcast) → lista de eventos que a API
  rejeitou dentro de um lote (ver `rejeitados` do endpoint de eventos) — mostrado como
  alerta em `controle*.html`.

### Notas da versão atual da API

- `GET /scout/artilharia` **não existe mais** (removido do lado Laravel) — `placarApi.js`
  não expõe mais essa função; os substitutos são `atuacaoDoJogador` (ficha minutada do
  jogador numa partida) e `perfilJogador` (lista de partidas em que atuou).
- Elenco de cada time agora traz `video` (de `video_url`) ao lado de `foto` — vídeo curto
  de apresentação do jogador, sempre opcional (`''`/`null` quando não existe). Consumido
  hoje só como indicador (🎬) na tela de configuração; `placarApi.enviarVideoJogador`/
  `removerVideoJogador` existem no cliente (multipart, campo `video`, mp4/webm, ≤28MB —
  **não aceita base64**, ao contrário de logo/foto), mas a UI de gravar/enviar vídeo ainda
  não foi construída.
- `categoria` é normalizada no servidor: `POST /times` pode responder `200` (reaproveitou
  um time existente) em vez de `201` (criou) — tratado como sucesso normalmente, já que
  `fetch`'s `resp.ok` cobre toda a faixa 200–299.

### Rota/contrato pendente: parciais de set/quarto

Fechar um set manda o evento `set` que já existe, agora com o placar da parcial em
`payload` (`{ numero, placar_casa, placar_visitante }`) e `time_id` = quem levou
(`null` num quarto empatado de basquete). Falta o outro lado: **a API ainda não devolve
as parciais**, então a faixa "set a set" do telão vive só na memória do Node e se perde
se o processo reiniciar no meio da partida (o mesmo já valia para placar e sets).

O que precisa mudar no Laravel está em
[docs/prompt-api-parciais.md](docs/prompt-api-parciais.md) — resumo: acrescentar um array
`parciais` a `GET /jogos/{jogo}` (derivado dos eventos `set` já persistidos, sem tabela
nem rota nova) e o mesmo na súmula. Nenhum endpoint novo.

### Fluxo na tela de configuração (`/controle/index.html`)

Um painel "Integração com o Placar Clube" oferece três modos: **Manual** (o de sempre, sem
API), **Selecionar jogo existente** (busca por `status`/`data`, carrega elenco e nomes da
API) e **Criar jogo agora** (avulso — cria times pelo nome e o jogo). Depois de carregar/criar
um jogo, "Iniciar jogo (API)" marca a partida `ao_vivo`; o elenco ganha checkboxes de
titular/capitão e um botão para salvar a escalação. Em `controle.html`, um botão "Encerrar
jogo (API)" fecha o placar quando a partida termina.

Todo evento de placar/cronômetro gerado a partir daí (`comando_placar`/`comando_cronometro`)
é aplicado **otimisticamente** no `gameState` e propagado ao telão antes de qualquer chamada
à API — a sincronização com a Laravel acontece em segundo plano, com retry automático em
caso de falha de rede.

---

## Fluxo de Telas

### 1. Configuração (`/controle/index.html`)

- Seleciona esporte (futsal/basquete/vôlei)
- Cadastra nome e logo de cada time (upload de imagem)
- **Cadastro de Elenco**: adiciona jogadores com número, nome e foto (opcional)
- **Importar elenco** (.txt/.csv/.xlsx): uma linha por jogador, ex. `10;João Silva` (aceita `;`, `,`, TAB ou espaço como separador; em planilhas, colunas Número/Nome) — a página traz um guia com exemplos dos dois formatos
- Clicar **SALVAR** emite `configurar_jogo` com `timeA_elenco` e `timeB_elenco`
- Botão de **INICIAR/ENCERRAR TRANSMISSÃO** toggle `transmissaoAtiva`

### 2. Controle do Jogo

#### Controle Universal (`/controle/controle.html`)
- Layout 3-colunas: TIME A | TIMER | TIME B
- Mostra +1 (sempre), +2/+3 (só basquete), Sets (só vôlei), Faltas (futsal + basquete)
- Período (futsal + basquete)
- Timer com PLAY/PAUSE e definidor MM:SS

#### Controle do Futsal (`/controle/controle_futsal.html`)
- +1 GOL por time
- Faltas com +/−
- Período com +/−
- Cronômetro descendente MM:SS (sem centissegundos), com definidor de tempo e botão REINICIAR CRONO
- Modal de seleção de jogador ao marcar

#### Controle do Basquete (`/controle/controle_basquete.html`)
- +1/+2/+3 por time
- Faltas com +/−
- Período com +/−
- Cronômetro descendente MM:SS.cc (centissegundos)
- Modal de seleção de jogador ao marcar

#### Controle do Vôlei (`/controle/controle_volei.html`)
- +1 PONTO por time
- Sets com +/−
- Indicador de saque (TIME A / nenhum / TIME B)
- Cronômetro ascendente MM:SS
- Modal de seleção de jogador ao marcar

### 3. Seleção de Jogador

Ao clicar +ponto/+falta, se o time tiver elenco cadastrado:
1. Modal abre com grid de botões
2. Cada botão exibe **número bem grande** + nome
3. Operador toca nome do jogador
4. Emite `comando_placar` com objeto completo do jogador
5. Modal fecha

### 4. Anúncios (`/controle/controle_anuncios.html`)

- **Coluna esquerda**: lista de vídeos em `public/videos/`
  - **⬆ Enviar vídeo**: faz upload permanente para o servidor (`public/videos/`)
  - **🗑** em cada vídeo: exclui o arquivo do servidor (com confirmação)
- **Coluna direita**: fila de reprodução
- Adicionar vídeo à fila com botão **+ Adicionar**
- **REPRODUZIR FILA**: emite `comando_video` com array de arquivos
- Toggle **🔁 LOOP**: com ele marcado, a fila reinicia do começo ao terminar o último vídeo (até clicar em ⏹ PARAR)
- **Patrocinadores**: seção com as logos do carrossel do telão — **⬆ Enviar logo** grava em `public/patrocinadores/` e o **×** exclui; o telão atualiza na hora em todas as telas
- Telão toca sequencialmente, ao terminar o último retorna ao placar (ou reinicia a fila, se em loop)

### 5. Telão (Placar) (`/index.html`)

- **Tela inicial**: overlay preto com ícone do esporte + "Aguardando transmissão..." (pulsando)
  - Desaparece ao clicar INICIAR TRANSMISSÃO na configuração
- **Placar**: nomes, placar, sets, faltas, período (conforme o esporte)
- **Logos**: repositionados por esporte (vôlei esquerda/direita, futsal/basquete mais abaixo)
- **Timer**: 
  - Vôlei: ascendente MM:SS
  - Futsal: descendente MM:SS
  - Basquete: descendente MM:SS.cc
- **Animação de ponto/falta**: faixa grená atravessando a tela com o time, a ação (GOL!/CESTA!/PONTO!/FALTA!) e a **foto redonda** do jogador + número + nome (5 segundos) — ver "Animação de ponto/falta" adiante
- **Vídeos**: tocam fullscreen (z-index 100), ao terminar retorna ao placar

---

## Sincronização de Múltiplos Clientes

Cada cliente recebe `serverTime: Date.now()` no evento `atualizar_tela`.

Ao conectar ou receber estado:
```javascript
const clockOffset = Date.now() - dados.serverTime;
dados.cronometro.inicioTimestamp += clockOffset;
```

Isso garante que mesmo com latência, o timer mostra o mesmo tempo em todos os telões.

---

## Regras de Jogo

### Futsal
- Timer: descendente MM:SS (a partir do tempo configurado, sem centissegundos)
- Placar: sem limite
- Período: controle manual
- Sets: não

### Basquete
- Timer: descendente (MM:SS.cc) com centissegundos
- Placar: sem limite
- Período: controle manual
- Faltas: controle manual

### Vôlei
- Timer: ascendente (00:00 → 99:59)
- Placar: 25 pontos com diferença ≥2 fecha o set (o **5º set**, tie-break, fecha em 15)
- Ao atingir a pontuação de fechamento o set **não fecha sozinho**: aparece o botão
  **FECHAR SET** na mesa. Quem fecha é sempre o operador — um ponto anotado por
  engano no fim do set não pode zerar o placar sem confirmação.
- Fechar o set grava a parcial em `state.parciais`, credita o set a quem venceu e
  zera o placar. **↩ REABRIR** desfaz o último fechamento (devolve o placar e retira o set).
- Sets: contadores só de leitura na mesa (quem mexe neles é o fechamento do set)
- Saque: indicador visual (TIME A / nenhum / TIME B)

### Nome do time em uma linha só

O nome nunca quebra em duas linhas. `ajustarNome()` em
[public/index.html](public/index.html) mede o texto e vai cedendo na ordem que
menos custa legibilidade:

1. **encolhe a fonte** de 2,5cqw até o piso de 1,4cqw;
2. **condensa as letras** (`scaleX`) até 0,8 — apertar custa menos que diminuir
   mais;
3. **corta com reticências** se nem assim couber.

Só o passo 3 perde informação, e só é alcançado por nome muito longo (~50
caracteres ou mais): "ASSOCIAÇÃO DESPORTIVA CLASSISTA DOS FUNCIONÁRIOS PÚBLICOS"
vira "ASSOCIAÇÃO DESPORTIVA CLASSISTA DO…". Se isso acontecer com um time real,
a saída é cadastrar o nome curto na configuração do jogo — a caixa tem 25% da
largura do telão e o placar ocupa o centro.

A conta é feita em `cqw`, que escala junto com o container: coube uma vez, cabe
em qualquer resolução de telão, sem recalcular no resize.

### Animação de ponto/falta

Ao marcar com um jogador escolhido, o telão abre uma **faixa grená** de ponta a
ponta da tela, nas cores do próprio placar: degradê `#2a0008 → #6a0414 →
#8e1030`, fios dourados em cima e embaixo, meio-tom de bolinhas adensando à
direita (o mesmo motivo da arte de fundo).

Dentro dela, a foto redonda com anel dourado e o texto em três degraus — quem
marcou é o assunto, o lance é só a etiqueta que diz por quê:

| Degrau | Conteúdo | Tamanho |
|---|---|---|
| Etiqueta | `PONTO!` / `GOL!` / `CESTA!` / `FALTA!`, dourado | 2,3cqw |
| Destaque | `#número` (4,4cqw) + **nome do jogador** | 7cqw |
| Apoio | nome do clube | 3cqw |

As duas faixas de animação vivem **dentro** do `.placar-container` e medem em
`cqw`, a mesma régua do resto do placar — ver "Escala das faixas" abaixo.

A coreografia mora inteira em `#anim-overlay` no [style.css](public/style.css) —
o telão só põe e tira a classe `.ativo` (tirar e repor reinicia tudo, porque
ponto vem em rajada e o lance novo tem que cortar o anterior):

| Tempo | O que acontece |
|---|---|
| 0,00–0,55s | a faixa se abre da esquerda para a direita (`clip-path`) |
| 0,25–1,00s | foto, time, ação e jogador entram escalonados |
| 0,55–1,65s | um brilho dourado varre a faixa |
| 4,55–5,00s | a faixa se fecha para a direita e some |

Abrir, segurar e fechar estão num **único** keyframe de 5s: duas animações com
delay brigariam pelo `clip-path` e a de saída venceria já na entrada (a última
da lista ganha, e `fill: both` aplica o quadro inicial durante o atraso).

Duas variações de layout: **sem foto** cadastrada o bloco de texto se centra
sozinho (`.sem-foto`), e **falta** não é comemoração — mesma faixa em grená
fechado, fio rosado no lugar do dourado e sem o brilho (`.anim-falta`).

A faixa ocupa cerca de 27% da altura, então o placar continua à vista acima e
abaixo dela. Quando o jogador tem vídeo cadastrado, o vídeo em tela cheia vem
antes e a faixa entra ao terminar.

### Fechamento de set / fim de jogo

Fechar a parcial dispara `animacao_parcial`, e o telão abre uma faixa na mesma
linguagem da de ponto — grená, fios dourados, meio-tom, varredura — em versão
maior e **9 segundos** em cena (o dobro), porque é quando a quadra para e todo
mundo olha para o telão:

```
                        1º SET
  ▌CLUBE DOS FUNCIONÁRIOS                              25
   VILA NOVA                                           20
                      SETS 1 × 0
```

Uma linha por time (nome à esquerda, pontos da parcial à direita), a de quem
levou em dourado e com barra; embaixo, o total de sets/quartos. Com o jogo
decidido a etiqueta vira **FIM DE JOGO**, os fios engrossam e o campeão pulsa em
dourado três vezes — a linha continua mostrando o placar do último set, e o
resultado da série fica no rodapé.

O payload leva o **retrato do fechamento** (placar, sets, nomes, número da
parcial) porque o `atualizar_tela` chega depois do anúncio e já com o placar da
parcial zerado — ler do estado mostraria 0 × 0.

O fechamento manda em cena: ao entrar, corta a faixa de ponto (z-index 41 contra
40, dentro do placar) e o vídeo do lance, que é irmão do container e por isso sai
por JS.

### Escala das faixas

As faixas de ponto e de fechamento são **filhas do `.placar-container`** e todas
as medidas delas estão em `cqw`, igual ao resto do placar.

Isso não é detalhe de estilo, é correção de bug: o container tem **largura fixa
de 1024px** (`width: 1024px` em [style.css](public/style.css)), então medir a
faixa em `vh`/`vw` a amarrava ao tamanho da **janela**, não ao do placar. Em
telas com proporção diferente da do monitor onde a animação foi ajustada — um
painel largo e baixo, por exemplo — a faixa saía desproporcional em relação ao
placar, apesar de o placar em si continuar igual.

Com `cqw` a proporção é a mesma em qualquer tela: o nome do jogador é sempre 7%
da largura do placar (contra 8% dos dígitos do placar), e a faixa sempre cobre a
largura inteira dele. Verificado em 1280×720, 1920×1080, 1920×600 e 1024×768 —
medidas idênticas nas quatro.

Regra prática: **qualquer coisa desenhada sobre o placar mede em `cqw`**; `vh`/`vw`
ficam para o que é realmente de tela cheia (standby, slides, comerciais e o vídeo
do jogador).

O pulso do campeão fica nos **filhos** da linha (`.set-linha-nome`,
`.set-linha-pontos`): aplicado na própria linha ele perderia para
`#set-overlay.ativo #set-linha-a` — dois ids ganham de quatro classes — e o
shorthand `animation` apagaria a animação de entrada.

### Set point

Quando um time está a **um ponto** de fechar a parcial, o telão mostra um selo
dourado **SET POINT** na faixa livre entre o TEMPO e os placares, alinhado sobre
o número desse time.

Set point é um **estado**, não um evento: dura enquanto durar (pode atravessar
vários rallies em 24-24, 25-25, 30-30…) e pode trocar de lado. Por isso a
animação de entrada (~0,9s: cai, dá um pop e um brilho varre o selo) roda só
quando o estado **muda** — apareceu, sumiu ou trocou de time. Nos pontos
seguintes o selo continua no pulso lento, sem reanunciar. Sai quando:

- a diferença cai para menos de 2 (24-24 não é set point), ou
- a pontuação já fecha o set (25-23): aí o set está ganho e o que vale é o botão
  **FECHAR SET** na mesa.

Quem calcula é `pontoDeParcial()` em [gameLogic.js](gameLogic.js): em vez de
reescrever "24 com 2 de vantagem", ela simula o próximo ponto e pergunta ao
`parcialFechavel()`. A regra fica num só lugar — o tie-break de 15, a vantagem de
2 e o fim de jogo saem de graça, e no basquete o selo nunca aparece porque lá o
quarto fecha pelo cronômetro, não pelo placar.

### Parciais (set a set / quarto a quarto)

Na faixa central inferior o telão desenha a **grade inteira** do jogo, não só o
que já passou — no vôlei os 5 sets desde o primeiro saque, no basquete os 4
quartos. Cada coluna tem o número (1º, 2º…) e os dois placares, em um de três
estados:

| Estado | O que mostra |
|---|---|
| Fechada | resultado final, com quem levou em dourado |
| Em disputa | placar ao vivo, sem destaque (ninguém venceu ainda) e com um fundo discreto |
| Ainda não começou | travessão apagado |

Assim dá para ler o andamento de relance: no 3º set aparecem os finais do 1º e
do 2º, a parcial ao vivo do 3º e o traço do 4º e do 5º.

Fonte: `state.parciais` (`[{ a, b }, ...]`, só as fechadas) mais três campos
derivados no `payloadEstado()` de [server.js](server.js) — `totalParciais`
(quantas colunas), `parcialEmAndamento` (qual está em disputa, `null` com o jogo
decidido) e o placar ao vivo do próprio estado. O HTML não conhece "melhor de 5":
quem responde é `quantidadeParciais()`/`parcialEmAndamento()` em
[gameLogic.js](gameLogic.js). A grade só cresce além do previsto na prorrogação
do basquete, que não tem teto.

As colunas têm largura igual (`flex: 1`) para os números não dançarem quando o
placar passa de um para dois dígitos. Na mesa, a faixa `#parciais-mesa` continua
listando só os sets fechados — lá o set em disputa já é o placar grande da tela.

A lógica é a mesma para os dois esportes (`REGRAS_PARCIAL` em
[gameLogic.js](gameLogic.js)): no vôlei a parcial é o **set** e a pontuação
habilita o botão; no basquete é o **quarto**, que termina pelo cronômetro e por
isso deixa o botão sempre disponível. Hoje só o vôlei está ligado na interface —
para ligar no basquete faltam dois passos:

1. em `public/index.html`, no `sportConfig.basquete`, trocar
   `extraAreas: [areaFault]` por `extraAreas: [areaFault, areaParciais]`;
2. em `public/controle/controle_basquete.html`, acrescentar o botão que emite
   `comando_placar` com `acao: 'fechar_set'` (e o `reabrir_set` para desfazer).

Nada em `gameLogic.js`/`server.js` precisa mudar.

---

## Testes

Com `node:test` nativo (zero dependências):

```bash
npm test              # Roda uma vez
npm run test:watch   # Roda em modo watch
```

**Cobertura**: 31 testes
- `criarEstadoInicial` (2 testes)
- `comandoPlacar` (16 testes) — pontos, sets, faltas, período, vôlei, zerar_tudo
- `comandoCronometro` (8 testes) — play, pause, set
- `configurarJogo` (4 testes)
- `comandoTransmissao` (1 teste)
- `filtrarVideos` (2 testes)

Todos os testes passam:
```
✔ 31 tests passed
```

---

## Desenvolvimento

### Modo Watch
```bash
npm run dev
```

Reinicia o servidor ao editar:
- `server.js`
- `gameLogic.js`

Ignora (não reinicia):
- `public/` (HTML/CSS/JS do cliente)
- `test/`
- `node_modules/`

### Debug com Logs
O servidor imprime logs de vídeos encontrados:
```
Vídeos encontrados em /path/to/public/videos/: [jogo.mp4, intro.webm]
```

---

## Deployment

### Em Produção
```bash
npm install --production
npm start
```

Servidor escuta em `0.0.0.0:3000` (acessível pela rede).

Exemplo de URL (substitua pelo IP do servidor):
```
http://192.168.1.50:3000
http://192.168.1.50:3000/controle/
```

---

## Troubleshooting

### Vídeos não aparecem na lista de anúncios
1. Verifique se os arquivos estão em `public/videos/`
2. Extensões aceitas: `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv` (case-insensitive)
3. Abra o DevTools (F12) → Console → procure por erros
4. Se aparecer "sem test/", é normal — é só o aviso de que `npm test` procurou lá

### Vídeo só começa depois de um clique na tela (autoplay)

Não deveria mais acontecer: **a reprodução nunca depende de clique**. Pela
política do Chrome/Edge, vídeo *com áudio* só toca depois de um gesto do usuário,
mas vídeo *mudo* toca sempre — então o telão começa mudo (garantido) e liga o som
sozinho assim que ele for permitido. Enquanto estiver mudo à força aparece um
aviso discreto no canto: **"🔇 Som bloqueado pelo navegador — clique na tela para
liberar"**. Qualquer clique/tecla libera o som na hora, sem reiniciar o vídeo.

Para que o **som** também funcione sem nenhum clique, suba o navegador do telão
com a política de autoplay liberada — é o modo recomendado para o telão fixo:

```bash
# Windows (Chrome)
chrome.exe --autoplay-policy=no-user-gesture-required --kiosk http://<IP>:4000

# Windows (Edge)
msedge.exe --autoplay-policy=no-user-gesture-required --kiosk http://<IP>:4000
```

O telão detecta sozinho que o áudio está liberado (sondagem no carregamento da
página) e já toca o primeiro vídeo com som. No Firefox o equivalente é
`media.autoplay.default = 0` em `about:config`.

### Navegador não consegue tocar vídeos
- Chrome/Edge: suportam `.mp4` (H.264), `.webm` nativamente
- `.mkv`: **não suportado**; converta com `ffmpeg`:
  ```bash
  ffmpeg -i video.mkv -c:v libx264 -c:a aac video.mp4
  ```

### Timer não sincroniza entre telões
- Verifique se todos estão em `http://<IP>:3000` (mesmo servidor)
- Relógios dos computadores devem estar próximos

### Modal de jogador não aparece
- Cadastre elenco em **Configuração** e clique **SALVAR**
- Verifique que o elenco carregou: vá para o controle do esporte, deve aparecer na UI

---

## Exemplo de Uso Completo

### Setup Inicial
1. Navegue para `http://192.168.1.50:3000/controle/` (em um tablet/PC)
2. Selecione **Futsal**
3. Preencha nomes: "Cidade A" e "Cidade B"
4. Adicione jogadores:
   - `10 | João Silva | [foto]`
   - `7 | Pedro Santos | [foto]`
5. Clique **SALVAR**
6. Clique **INICIAR TRANSMISSÃO** (overlay de standby desaparece no telão)

### Durante o Jogo
1. Abra `http://192.168.1.50:3000/controle/controle_futsal.html` no tablet
2. Clique **▶ PLAY** (cronômetro começa)
3. Clique **+1 GOL** (TIME A) → selecione **João Silva** no modal
4. Telão exibe: "CIDADE A" → "GOL!" → foto + "10 João Silva" por 3 segundos
5. Placar sobe automaticamente no telão

### Comercial no Meio
1. Abra `http://192.168.1.50:3000/controle/controle_anuncios.html`
2. Adicione "jogo_highlights.mp4" à fila
3. Clique **▶ REPRODUZIR FILA**
4. Telão exibe vídeo fullscreen
5. Ao terminar, volta ao placar automaticamente

---

## Contribuindo

Faça um fork, crie uma branch, abra um PR. Testes passam com `npm test`.

---

## Licença

ISC

---

## Suporte

Para bugs ou dúvidas, abra uma issue no [GitHub](https://github.com/GustAlvesG/placar-clube/issues).

---

**Última atualização**: 2026-05-30  
**Versão**: 1.0.0
