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
  videoStandby: filename|null,  // vídeo de espera em public/base/, sincronizado pelo servidor
  timeA: { nome, logo, placar, sets, faltas, elenco: [{numero, nome, foto}] },
  timeB: { ...same },
  cronometro: { rodando, tempoAcumulado, inicioTimestamp, duracaoConfigurada } }
```

Photos/logos are stored inline as base64 data URIs directly in `gameState` (no file uploads/storage layer).

### Data flow

Operator UI (`public/controle/*.html`) → Socket.IO event → `server.js` handler → `gameLogic.js` function mutates `gameState` → `server.js` emits any animation events → `broadcast()` sends `atualizar_tela` (full state + `serverTime`) to **all** connected clients (scoreboard screens and control panels alike). There's no per-client filtering — every client gets the entire state on every change.

Key Socket.IO events: `configurar_jogo`, `comando_placar`, `comando_cronometro`, `comando_transmissao`, `comando_video`, `solicitar_videos` (client→server); `atualizar_tela`, `animacao_ponto`, `executar_video`, `lista_videos` (server→client). Full payload shapes are documented in README.md.

### Clock synchronization across screens

Each `atualizar_tela` broadcast includes `serverTime: Date.now()`. Clients compute `clockOffset = Date.now() - serverTime` and add it to `cronometro.inicioTimestamp` so the countdown/count-up timer renders in sync across multiple screens regardless of network latency or local clock drift. This logic is duplicated in each HTML page that displays a timer — see the `clockOffset` block in `public/index.html` and `public/controle/controle.html`.

### Per-sport rule differences (encoded in gameLogic.js, not config)

- **Vôlei**: reaching ≥25 points with a ≥2-point lead auto-wins the set (`comandoPlacar`'s `add_ponto` branch) — resets both scores to 0 and clears `sacando`. Futsal/basquete never trigger this.
- **Basquete**: countdown timer with centiseconds (`duracaoConfigurada`); **futsal** also counts down but displays MM:SS only; vôlei counts up.
- Point-animation text varies by sport (`TEXTOS_PONTO`: futsal → "GOL!", basquete → "CESTA!", volei → "PONTO!").

### Video/ad playback

Videos live in `public/videos/` (gitignored, created at server startup if missing). `filtrarVideos()` in gameLogic.js filters by extension (`.mp4 .webm .mov .avi .mkv`, case-insensitive) — this is the only part of that flow with logic worth testing; the rest (`comando_video`, `solicitar_videos`) in server.js is a direct passthrough/broadcast with no state mutation. `comando_video` accepts `loop: true` on `playlist`/`play`: the telão refills the queue from the original playlist when it empties (guarded so a playlist where every video fails doesn't loop forever) until a `stop` arrives.

### File uploads (videos and sponsor logos)

`server.js` exposes streaming HTTP endpoints (no multer/body-parser — the request body is piped straight to disk): `POST /api/upload/:tipo?nome=<filename>` and `DELETE /api/:tipo/:nome`, where `tipo` is `video` (→ `public/videos/`) or `patrocinador` (→ `public/patrocinadores/`, gitignored). Filenames pass through `sanitizarNomeArquivo()` in gameLogic.js (strips paths, replaces unsafe chars) and must have a valid extension for the type (`EXTENSOES_VIDEO` / `EXTENSOES_IMAGEM`). After any change the server re-syncs: video changes broadcast `lista_videos` to everyone; sponsor changes reload `gameState.patrocinadores` and `broadcast()`. Upload/delete UI lives in `public/controle/controle_anuncios.html`.

### Standby video

The telão's waiting screen (`#tela-inicial`, shown until `transmissaoAtiva`) plays a video from **`public/base/`** on loop, muted, filling the screen. `escolherVideoBase()` in gameLogic.js picks the first video file there in alphabetical order (stability matters: two telões must never pick differently); `sincronizarVideoStandby()` in server.js writes it to `gameState.videoStandby` at boot **and on every socket connection**, so dropping a new file in the folder and reloading the telão is enough — no restart. With no video in `public/base/`, the page falls back to the old card (`#standby-texto`: sport icon + club name + "Aguardando transmissão...").

`public/base/` is the art folder (backgrounds, per-sport elements) and is **git-tracked** — unlike `videos/`, `slides/` and `patrocinadores/` there is no upload endpoint or UI for it, and it is deliberately absent from `TIPOS_ARQUIVO`.

`aplicarStandby()` in public/index.html only touches `video.src` when the filename actually changes (assigning it restarts playback, and `atualizar_tela` arrives on every clock tick) and pauses the video while transmission is on so it isn't decoded behind the scoreboard.

### Sponsor carousel

The telão footer scrolls sponsor logos (`.sponsor-*` in style.css). Source of truth is the files in `public/patrocinadores/`: at startup (and after each upload/delete) the server reads the dir into `gameState.patrocinadores` as an array of filenames, and the telão builds the track as `<img src="patrocinadores/<name>">`. Empty list hides the carousel container. The telão caches a signature of the list to avoid rebuilding the DOM (and restarting the CSS animation) on every broadcast.

The footer strip is **not free real estate**: the artwork reserves a dark band for it that starts at y=455 of the scoreboard's 512px height (**88.87%**, identical in all three sports — measured by compositing `base/background.png` with each sport's `box.png` and finding the first row, contiguous to the bottom, where no pixel exceeds luminance 20). `.sponsor-carousel-container`'s `top` is that number; raising it spills the logos onto the team-names strip above. Inside the band, logos render at ~52px. Size everything in that footer in `cqw`, never `px` — the strip used fixed `150x60px` and shrank relative to the rest of the telão, which is what made the logos look tiny.

Because the band is inherently short, the same list also feeds the **point-animation banner** (`#anim-patrocinadores`, filled by `montarPatrocinadoresAnim`), where **all** sponsors appear at once, much larger, for the 5s the banner is on screen.

### Frontend structure (no build step)

`public/index.html` is the scoreboard display (the "telão"). `public/controle/` holds the operator-facing pages: `index.html` (setup: sport, team names/logos, roster), `controle.html` (the scoring table — **one screen for all three sports**), `controle_anuncios.html` (video queue manager). All are static HTML with inline/linked vanilla JS and Tailwind-style CSS — edit them directly, there's no compilation step and nodemon explicitly ignores `public/` for reloads.

`controle_futsal.html`/`controle_basquete.html`/`controle_volei.html` are **not** separate screens any more — they are one-line redirects to `controle.html`, kept only so bookmarks saved on the operators' tablets keep working. Everything that differs per sport (number of point buttons, faltas vs. sets, período, timer direction, set-closing bar) lives in the `ESPORTES` object at the top of `controle.html`'s script; add a sport or change a per-sport rule there, not by forking the page. The layout is ordered by how often the operator touches each control: clock in the top bar (tapping it toggles play/pause), a full-height scoring button per team in the middle, correction (−1, behind a `confirm()`) plus the contextual action in the bottom bar, and everything used once per game or destructive (definir tempo, período, inverter lados, fechar jogo, parar transmissão, zerar) behind the `⚙ MAIS` overlay.

Team colors are **CSS custom properties** (`.tema-azul`/`.tema-vermelho` in the page's `<style>`), applied to `[data-lado]` elements by `aplicarTemas()` — not Tailwind color classes. This is what lets "inverter lados" repaint both panels so the color follows the *team* rather than the screen position. When restyling a panel, extend the variables; a hardcoded `bg-blue-600` there would stop swapping on invert.

Note the two "zerar" are different and both must keep existing: `comando_placar`/`zerar_tudo` (from the table, preserves teams/roster/API link mid-match) vs. `zerar_configuracao_completa` (from the setup screen, resets everything and unlinks the API game).
