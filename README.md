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
| `comando_video` | `{ acao, arquivo? }` | Play/stop de vídeos |
| `solicitar_videos` | `{}` | Lista vídeos em `public/videos/` |

#### Do Servidor para Clientes

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `atualizar_tela` | `{ ...gameState, serverTime }` | Broadcast do estado completo |
| `animacao_ponto` | `{ texto, jogador, timeNome }` | Animação ao marcar ponto/falta |
| `executar_video` | `{ acao, arquivo? }` | Instrui telão a tocar vídeo |
| `lista_videos` | `[filenames]` | Lista de vídeos disponíveis |

---

## gameState (Estrutura do Estado)

```javascript
{
  esporte: 'futsal' | 'basquete' | 'volei',
  sacando: 'timeA' | 'timeB' | null,
  periodo: number,                    // 1, 2, 3...
  transmissaoAtiva: boolean,
  
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
    duracaoConfigurada: number        // ms (para basquete countdown)
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
- `zerar_tudo`: reseta placar, sets, faltas, sacando, período, transmissão, cronômetro

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

## Fluxo de Telas

### 1. Configuração (`/controle/index.html`)

- Seleciona esporte (futsal/basquete/vôlei)
- Cadastra nome e logo de cada time (upload de imagem)
- **Cadastro de Elenco**: adiciona jogadores com número, nome e foto (opcional)
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
- Cronômetro ascendente MM:SS
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
- **Coluna direita**: fila de reprodução
- Adicionar vídeo à fila com botão **+ Adicionar**
- **REPRODUZIR FILA**: emite `comando_video` com array de arquivos
- Telão toca sequencialmente, ao terminar o último retorna ao placar

### 5. Telão (Placar) (`/index.html`)

- **Tela inicial**: overlay preto com ícone do esporte + "Aguardando transmissão..." (pulsando)
  - Desaparece ao clicar INICIAR TRANSMISSÃO na configuração
- **Placar**: nomes, placar, sets, faltas, período (conforme o esporte)
- **Logos**: repositionados por esporte (vôlei esquerda/direita, futsal/basquete mais abaixo)
- **Timer**: 
  - Futsal/Vôlei: ascendente MM:SS
  - Basquete: descendente MM:SS.cc
- **Animação de ponto/falta**: overlay com nome do time, ação (GOL!/CESTA!/PONTO!/FALTA!), **foto redonda** do jogador + número + nome (3 segundos)
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
- Timer: ascendente (00:00 → 99:59)
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
- Placar: até 25 pontos (com diferença ≥2 para vencer set)
- Ao atingir 25×23 (ou melhor): **set é automático**, placar zera, sacando limpa
- Sets: controle manual
- Saque: indicador visual (TIME A / nenhum / TIME B)

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
