# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Placar Clube is a real-time scoreboard system for sports events (futsal, basquete, vôlei) broadcast to multiple screens via WebSocket. Backend: Node.js + Express + Socket.IO. Frontend: plain HTML/CSS/JS served as static files (no build step, no framework, no bundler).

## Commands

```bash
npm start          # Production server (node server.js)
npm run dev        # Development with nodemon (auto-reload on server.js / gameLogic.js changes)
npm test           # Run test suite (node:test, native — zero test-runner dependencies)
npm run test:watch # Run tests in watch mode
```

Run a single test file: `node --test test/gameLogic.test.js`. There is no separate lint command configured.

Note: `server.js` listens on port `4000` (`server.listen(4000, '0.0.0.0', ...)`) — the README's examples reference port 3000, which is stale.

`playwright` and `socket.io-client` are devDependencies but there are no Playwright specs/config or e2e tests in the repo yet — only the `node:test` suite in `test/gameLogic.test.js` exists.

## Architecture

### Core split: pure logic vs. transport

The entire game-rules layer lives in [gameLogic.js](gameLogic.js) as framework-free functions that take a mutable `state` object and a payload, mutate `state` in place, and (for actions with client-facing side effects) return `{ animacoes }` to emit. This module has zero Socket.IO/Express dependency, which is why it's fully unit-testable via `node:test` without spinning up a server. [server.js](server.js) is a thin transport layer: it holds the single in-memory `gameState`, wires each `socket.on(...)` handler to the matching `gameLogic` function, and calls `broadcast()` afterward.

When changing game rules (scoring, sets, timer, fouls), edit `gameLogic.js` and add/adjust tests in `test/gameLogic.test.js`. When changing what triggers those rules or how state reaches clients, edit `server.js`.

### State shape

There is one global `gameState` object per server process (not per-room/per-match). Shape (see `criarEstadoInicial()` in gameLogic.js):

```
{ esporte, sacando, periodo, transmissaoAtiva,
  patrocinadores: [filename],   // imagens em public/patrocinadores/, sincronizado pelo servidor
  timeA: { nome, logo, placar, sets, faltas, elenco: [{numero, nome, foto}] },
  timeB: { ...same },
  cronometro: { rodando, tempoAcumulado, inicioTimestamp, duracaoConfigurada } }
```

Photos/logos are stored inline as base64 data URIs directly in `gameState` (no file uploads/storage layer).

### Data flow

Operator UI (`public/controle/*.html`) → Socket.IO event → `server.js` handler → `gameLogic.js` function mutates `gameState` → `server.js` emits any animation events → `broadcast()` sends `atualizar_tela` (full state + `serverTime`) to **all** connected clients (scoreboard screens and control panels alike). There's no per-client filtering — every client gets the entire state on every change.

Key Socket.IO events: `configurar_jogo`, `comando_placar`, `comando_cronometro`, `comando_transmissao`, `comando_video`, `solicitar_videos` (client→server); `atualizar_tela`, `animacao_ponto`, `executar_video`, `lista_videos` (server→client). Full payload shapes are documented in README.md.

### Clock synchronization across screens

Each `atualizar_tela` broadcast includes `serverTime: Date.now()`. Clients compute `clockOffset = Date.now() - serverTime` and add it to `cronometro.inicioTimestamp` so the countdown/count-up timer renders in sync across multiple screens regardless of network latency or local clock drift. This logic is duplicated in each HTML page that displays a timer — see the `clockOffset` block in `public/index.html` and the `public/controle/*.html` files.

### Per-sport rule differences (encoded in gameLogic.js, not config)

- **Vôlei**: reaching ≥25 points with a ≥2-point lead auto-wins the set (`comandoPlacar`'s `add_ponto` branch) — resets both scores to 0 and clears `sacando`. Futsal/basquete never trigger this.
- **Basquete**: countdown timer with centiseconds (`duracaoConfigurada`); **futsal** also counts down but displays MM:SS only; vôlei counts up.
- Point-animation text varies by sport (`TEXTOS_PONTO`: futsal → "GOL!", basquete → "CESTA!", volei → "PONTO!").

### Video/ad playback

Videos live in `public/videos/` (gitignored, created at server startup if missing). `filtrarVideos()` in gameLogic.js filters by extension (`.mp4 .webm .mov .avi .mkv`, case-insensitive) — this is the only part of that flow with logic worth testing; the rest (`comando_video`, `solicitar_videos`) in server.js is a direct passthrough/broadcast with no state mutation. `comando_video` accepts `loop: true` on `playlist`/`play`: the telão refills the queue from the original playlist when it empties (guarded so a playlist where every video fails doesn't loop forever) until a `stop` arrives.

### File uploads (videos and sponsor logos)

`server.js` exposes streaming HTTP endpoints (no multer/body-parser — the request body is piped straight to disk): `POST /api/upload/:tipo?nome=<filename>` and `DELETE /api/:tipo/:nome`, where `tipo` is `video` (→ `public/videos/`) or `patrocinador` (→ `public/patrocinadores/`, gitignored). Filenames pass through `sanitizarNomeArquivo()` in gameLogic.js (strips paths, replaces unsafe chars) and must have a valid extension for the type (`EXTENSOES_VIDEO` / `EXTENSOES_IMAGEM`). After any change the server re-syncs: video changes broadcast `lista_videos` to everyone; sponsor changes reload `gameState.patrocinadores` and `broadcast()`. Upload/delete UI lives in `public/controle/controle_anuncios.html`.

### Sponsor carousel

The telão footer scrolls sponsor logos (`.sponsor-*` in style.css). Source of truth is the files in `public/patrocinadores/`: at startup (and after each upload/delete) the server reads the dir into `gameState.patrocinadores` as an array of filenames, and the telão builds the track as `<img src="patrocinadores/<name>">`. Empty list hides the carousel container. The telão caches a signature of the list to avoid rebuilding the DOM (and restarting the CSS animation) on every broadcast.

### Frontend structure (no build step)

`public/index.html` is the scoreboard display (the "telão"). `public/controle/` holds the operator-facing pages: `index.html` (setup: sport, team names/logos, roster), `controle.html` (universal control), `controle_futsal.html`/`controle_basquete.html`/`controle_volei.html` (sport-specific controls), `controle_anuncios.html` (video queue manager). All are static HTML with inline/linked vanilla JS and Tailwind-style CSS — edit them directly, there's no compilation step and nodemon explicitly ignores `public/` for reloads.
