# CLAUDE.md

Guia para agentes Claude (Claude Code) trabalhando neste repositório. Escrito em
português, como o código, os comentários e a interface. **Responda ao usuário em
português.**

Documentação completa:
- [docs/documentacao-tecnica.md](docs/documentacao-tecnica.md) — arquitetura, contratos, módulos, telão
- [docs/manual-do-usuario.md](docs/manual-do-usuario.md) — como os operadores usam o sistema
- [docs/prompt-api-parciais.md](docs/prompt-api-parciais.md) — pedido pendente ao time Laravel

Este arquivo resume o que um agente precisa saber **antes** de mexer no código:
o mapa, as invariantes e as armadilhas. Ao mudar comportamento, atualize também
a documentação em `docs/` (e este arquivo, se a mudança afetar algo listado aqui).

---

## Visão geral

Placar eletrônico em tempo real para **futsal, basquete e vôlei**, transmitido a
várias telas via WebSocket na rede local do ginásio.

- Backend: Node.js 22+ (`fetch`/`FormData`/`crypto.randomUUID` nativos) + Express 5 + Socket.IO 4.
- Frontend: HTML/CSS/JS puro servido de `public/`. **Sem build, sem framework, sem bundler.**
- Integração opcional com uma API Laravel externa ("Placar Clube") — fonte de
  verdade de times/jogadores/jogos e da súmula.

## Comandos

```bash
npm start              # produção (node server.js) — porta 4000
npm run dev            # nodemon (recarrega só em server.js / gameLogic.js)
npm test               # node --test — 4 arquivos em test/, 149 testes
npm run test:watch
node --test test/gameLogic.test.js   # um arquivo só
```

Não há lint configurado. A porta é **4000**, fixa em `server.listen(4000, '0.0.0.0')`.

Para verificar de ponta a ponta use a skill **`verify`**
(`.claude/skills/verify/SKILL.md`): sobe uma instância isolada na porta 4100
(`node -e "const {server}=require('./server.js'); server.listen(4100,...)"`) e
dirige as páginas com Playwright (devDependency; não há specs Playwright no repo).
A porta 4000 costuma estar ocupada pelo servidor de dev do usuário.

## Mapa do código

| Arquivo | Papel |
|---|---|
| [gameLogic.js](gameLogic.js) | **Toda** regra de jogo. Funções puras: recebem `state` mutável + payload, mutam no lugar, devolvem `{ animacoes }` quando há efeito para clientes. Zero dependência de rede/`fs`/`path`. |
| [server.js](server.js) | Transporte fino: `gameState` global, handlers `socket.on`, `broadcast()`, upload/exclusão HTTP, bookkeeping da integração. |
| [placarApi.js](placarApi.js) | Cliente HTTP da API Laravel. Sem estado; toda função recebe `config = { baseUrl, token, fetchImpl? }`. |
| [placarEventos.js](placarEventos.js) | Fila de eventos para a API: uuid/sequência no momento da ação, estorno, envio em lote. |
| [env.js](env.js) | Carregador mínimo de `.env` (sem `dotenv`); nunca sobrescreve variáveis do ambiente. |
| `public/index.html` + `style.css` | **Telão**. |
| `public/controle/index.html` | Só redireciona `/controle/` para `controle.html#preparar` (entrada do operador). |
| `public/controle/configuracao.html` | Configuração (esporte, times, elenco, API, transmissão). |
| `public/controle/controle.html` | **Controle** (antes "Mesa") — **uma tela para os três esportes**. |
| `public/controle/controle_anuncios.html` | **Mídia**: vídeos, slides (inclui PDF→PNG), patrocinadores. |
| `public/controle/ui.css` + `ui.js` | Base visual e diálogos (`avisar`/`confirmar`/`toast`/`data-segurar`) da configuração e da mídia. |
| `public/controle/controle_{futsal,basquete,volei}.html` | Só redirecionam para `controle.html` (atalhos antigos nos tablets). **Não apagar.** |
| `public/static.html` | Placar minimalista (só números). |
| `public/placar-neutro.html` | Placar paralelo neutro, tema claro/escuro, só leitura e **só pela URL** (não linkar). |
| `public/base/` | Arte do telão, **versionada**. Sem endpoint de upload. |
| `public/videos/`, `slides/`, `patrocinadores/` | Mídia enviada pelo operador — gitignored, criadas no boot. |

**Onde mexer:** regra de jogo → `gameLogic.js` + teste em `test/gameLogic.test.js`.
O que dispara a regra ou como o estado chega aos clientes → `server.js`. Valores
derivados de que a mesa/telão precisam → calcule em `gameLogic` e exponha em
`payloadEstado()`; **não reimplemente regra no HTML**.

## Fluxo de dados

Tela de controle → evento Socket.IO → handler em `server.js` → função de
`gameLogic` muta `gameState` → servidor emite animações → `broadcast()` envia
`atualizar_tela` (estado completo + `serverTime` + derivados) para **todos** os
clientes. Sem filtragem por cliente. Só depois disso, se houver jogo da API
carregado, a ação vira evento na fila (atualização **otimista**).

Um único `gameState` por processo, **só em memória** (reiniciar zera tudo,
inclusive a fila de eventos pendentes da API).

Formato do estado: ver `criarEstadoInicial()` e a seção 5 da documentação técnica.
Campos derivados em `atualizar_tela`: `parcialFechavel`, `parcialAtual`,
`totalParciais`, `parcialEmAndamento`, `setPoint`, `lances` (com `estornavel`),
`limiteFaltas`, `alertaFaltas`.

## Invariantes e decisões que NÃO devem ser desfeitas

### Regras de jogo
- **Fechar set/quarto é sempre manual** (ação `fechar_set`). Atingir 25 com 2 de
  vantagem (15 no 5º set) só torna `parcialFechavel` verdadeiro, habilitando o
  botão na mesa. Nada fecha sozinho; `fechar_set` também não valida a regra (WO,
  jogo interrompido). `reabrir_set` desfaz o último fechamento.
- Parciais: `REGRAS_PARCIAL` em `gameLogic.js` (vôlei = set, melhor de 5; basquete
  = quarto, fecha pelo cronômetro, sem teto). Futsal não tem parciais.
- Set point (`pontoDeParcial`) simula +1 ponto e pergunta a `parcialFechavel` —
  não duplique a regra.
- `add_ponto` sempre emite `animacao_ponto` (`tipo: 'ponto'` com jogador,
  `'ponto_time'` sem). `add_falta` só emite com jogador (`tipo: 'falta'`).
- Textos: futsal `GOL!`, basquete `CESTA!`, vôlei `PONTO!`.
- Cronômetro: futsal regressivo MM:SS; basquete regressivo MM:SS.cc; vôlei
  crescente. Funções que dependem de tempo recebem `now` injetável (testes).
- **Lances**: `add_ponto`, `add_falta` e `fechar_set` registram um lance em
  `state.lances` (jogador sem foto). Correção = `estornar_lance` (marca
  `estornado`, nunca apaga) ou `reabrir_set`. O que pode ser corrigido é
  `lanceEstornavel` (ponto só da parcial atual, falta só do período atual, set só
  o último). `seqLance` não zera no `zerar_tudo` (ids ligam lance → uuid na API).
- Faltas: `REGRAS_FALTA` (futsal 5, basquete 4) só gera **aviso** (`alertaFaltas`).
  `zerar_faltas` é ação separada de `add_periodo` de propósito (± período corrige
  sem apagar faltas).

### Dois "zerar", ambos necessários
- `comando_placar` / `zerar_tudo` (mesa): zera números e cronômetro, **preserva**
  times, elenco, transmissão e vínculo com a API.
- `zerar_configuracao_completa` (configuração): estado inicial + desvincula a API;
  preserva só `patrocinadores` e `videoStandby` (vêm de pasta).

### Sincronização do relógio
Clientes fazem `clockOffset = Date.now() - serverTime` e somam em
`cronometro.inicioTimestamp`. Bloco repetido em `public/index.html`,
`public/placar-neutro.html` e
`public/controle/controle.html` — mude nos três.

### Integração com a API Laravel
- Configurada por `LARAVEL_BASE_URL` (sem `/api/placar`) e `LARAVEL_API_TOKEN` no
  `.env`. Sem elas: modo manual, nada quebra.
- Bookkeeping (`integracao`: ids, fila, status, `uuidPorLance`) fica **fora** do
  `gameState`. `estornar_lance` estorna o uuid exato do lance
  (`placarEventos.estornarEvento`), não o "último da chave".
- Log da API é **append-only**: correção = evento `estorno` referenciando o uuid
  original, nunca update/delete. `zerar_tudo` não é sincronizado.
- `cronometro_ms` é **obrigatório** em `ponto`/`falta`: use
  `logic.tempoDecorrido(cronometro)`, nunca `tempoAcumulado` sozinho.
- uuid/sequência gerados no momento da ação (retry reenvia o mesmo uuid). Envio
  em lote, retry a cada 5 s, `tentarEnviarPendentes` nunca lança.
- O **primeiro PLAY** do cronômetro marca o jogo como ao vivo (`iniciarJogoNaApi`,
  `integracao.iniciado`) — decisão explícita do usuário.
- O fluxo **pela API é o principal**; o manual é fallback. A configuração abre em
  "Selecionar jogo existente".
- `GET /scout/artilharia` foi removido da API. Parciais ainda não voltam da API
  (ver `docs/prompt-api-parciais.md`). Comentários citam
  `docs/placar-clube-api.md`, que **não está neste repo** (é do time Laravel).

### Tela de configuração (`public/controle/configuracao.html`)
- `enviarConfiguracao()` = só emite. `salvarConfig()` = emite + valida + **trava**
  o formulário. `aplicarRespostaJogoNaTela` (Carregar e avulso) chama
  `enviarConfiguracao()` e **não trava** — editar elenco logo após carregar é
  normal. Não coloque a trava dentro de `enviarConfiguracao`.
- O cartão de transmissão fica logo abaixo do cartão da API; `#lista-jogos` tem
  altura limitada com rolagem própria.
- O esporte marcado e não salvo não é desfeito por `atualizar_tela`
  (`esporteEditado`) — enviar uma logo dispara broadcast.

### Configuração e mídia (base comum)
- Mesmo desenho da mesa (escuro, tablet, sem Tailwind) via `ui.css`/`ui.js`. A
  mesa tem CSS próprio com os **mesmos tokens** — mude cores nos dois lugares.
- Nenhuma tela de operação usa `alert()`/`confirm()`: use `avisar()`,
  `confirmar()` (Promise) e `toast()` de `ui.js`. Destrutivo de verdade (zerar
  tudo) é `data-segurar` (evento `segurado`).

### Controle (`public/controle/controle.html`)
- Na interface o nome é **Controle**, nunca "Mesa" (pedido do usuário). Nomes
  internos antigos (`.mesa`, `renderMesa`) podem ficar.
- Feita para **tablet** (paisagem; funciona em pé). CSS próprio, **sem Tailwind**,
  tema escuro fixo. Três abas no hash: `#preparar` (jogos da API + checklist),
  `#controle` (o antigo `#mesa` ainda funciona), `#telao` (cenas placar/slides/espera, comerciais, slides). Sem hash e
  com API configurada sem jogo carregado, abre em Preparar. "Ir para o controle"
  pergunta se põe o jogo no telão quando a transmissão está desligada.
- O que muda por esporte vive no objeto `ESPORTES` no topo do script
  (`botoes` com valor/rótulo, `verbo`, `faltas`/`avisoFalta`, `periodo`/`periodos`,
  `sets`, `parciais`, `crono`, `presets`). Para um esporte novo ou regra de UI por
  esporte, edite ali — **não** duplique a página.
- Layout por frequência de uso: relógio no topo (toque = play/pause), botão de
  ponto ocupando o painel, rodapé com **último lance + Desfazer** e a ação do
  momento (fechar set / próximo período); o resto atrás de **Mais**.
- **Desfazer não tem prazo** (pedido explícito do usuário — não volte a um
  "desfazer por 5 s"). Age só sobre o último lance não estornado e só acende se
  ele for `estornavel`; nunca pula para um lance mais antigo. Ponto/falta →
  `estornar_lance`; set → `reabrir_set`. Lances antigos: gaveta **Lances**.
- Ações destrutivas no Mais (zerar, zerar faltas, encerrar na API) são de
  **segurar 1,2 s** (`data-segurar`). A tela não usa `alert()`/`confirm()`:
  avisos abrem uma folha (`avisar()`), retornos rápidos usam `toast()`.
- Cores dos times são **variáveis CSS** (`.tema-azul`/`.tema-vermelho`, via
  `aplicarTemas()` em `[data-lado]`), para a cor seguir o time ao inverter lados.
  Não use cores fixas nos painéis.
- Inverter lados e modo rápido são só do aparelho (`localStorage`), nunca do
  servidor/telão.
- Folha de jogador: "Marcar sem jogador" marca sem creditar; "Cancelar"/Esc/toque
  fora não envia nada e limpa `pendente`.

### Telão (`public/index.html` + `public/style.css`)
- **Escala uniforme 2:1**: `.placar-container` com `width: min(100vw, 200vh)`;
  tudo dentro em `%`/`cqw`. Não estique nem use `cover`. Sobra pintada com
  `--borda-arte-topo/-base/-lados` (topo do `style.css`); o vídeo de espera usa
  `.preenche-sobra`. **Se a arte mudar, remeça essas bordas.**
- Qualquer coisa sobre o placar mede em `cqw`; `vh`/`vw` só para tela cheia real
  (standby, slides, comerciais, vídeo do jogador).
- Carrossel de patrocinadores: faixa escura da arte começa em **88,87 %** (y=455/512,
  igual nos 3 esportes) — é o `top` de `.sponsor-carousel-container`. Não suba.
  Medidas em `cqw`. Assinatura da lista evita reconstruir o DOM a cada broadcast.
- Faixa de ponto (`#anim-overlay`, z 40) mostra **todos** os patrocinadores
  (`montarPatrocinadoresAnim`); um único keyframe de 5 s. Faixa de parcial
  (`#set-overlay`, z 41), 9 s. Vídeo do jogador (`#anim-video-overlay`, z 88) só
  em ponto, nunca em falta.
- **Basquete: tempo e placar nunca somem.** Com faixa/vídeo em cena,
  `manterJogoVisivel()` (laço de 50 ms) troca para `#tempo-flutuante` e
  `#placar-flutuante` (que repete o relógio no centro, `#pf-tempo` — o tempo fica
  em cima **e** embaixo); `atualizarPlacarFlutuante()` roda a cada `atualizar_tela`.
  Não vale para futsal/vôlei; comerciais/slides/standby cobrem tudo de propósito.
- Vídeo de espera: `escolherVideoBase()` = 1º vídeo em ordem alfabética de
  `public/base/` (estável entre telões); `sincronizarVideoStandby()` roda no boot e
  a cada conexão. `aplicarStandby()` só troca `src` quando o nome muda e pausa
  durante a transmissão. Sem vídeo → cartão `#standby-texto`.
- Tela cheia pedida no primeiro gesto (uma vez); depois duplo-clique alterna.
  `resize` com debounce re-roda `ajustarNome()`.
- Autoplay: vídeos começam mudos se preciso (`tocarSemGesto`), som liga quando
  permitido; aviso "🔇 Som bloqueado" até um clique.
- Basquete ainda não exibe parciais: para ligar, `extraAreas: [areaFault, areaParciais]`
  em `sportConfig.basquete` (index.html) e `parciais: true` em `ESPORTES` (controle.html).

### Arquivos e uploads
- `POST /api/upload/:tipo?nome=` (corpo direto em disco, sem multer) e
  `DELETE /api/:tipo/:nome`, com `tipo` ∈ `video | patrocinador | slide`.
  Nome passa por `sanitizarNomeArquivo()`; extensão validada por tipo.
- `public/base/` fica **fora** de `TIPOS_ARQUIVO` de propósito.
- Estáticos `.html/.css/.js` saem com `Cache-Control: no-cache` (telão fica dias
  aberto e precisa pegar deploys).
- `comando_video` (com `loop`) é repasse puro para `executar_video`; slides têm
  estado no `gameState` (telão que reconecta sincroniza).

## Limitações conhecidas (não "consertar" sem combinar com o usuário)

Estado só em memória; um jogo por processo; sem autenticação nos sockets nem nos
uploads; sem limite de tamanho de upload; handlers síncronos sem `try/catch`;
fotos base64 em todo broadcast; importar planilha e PDF dependem de CDN
(SheetJS, pdf.js); sem testes de `server.js`/frontend. O roadmap dessas melhorias
foi discutido com o usuário — pergunte antes de iniciar uma delas.

## Convenções

- Código, comentários, mensagens de commit e UI em **português**.
- Comentários explicam o **porquê** (há muitos — leia-os antes de alterar um trecho).
- Testes com `node:test` + `node:assert/strict`, sem dependências; injete `now`
  e `fetchImpl` em vez de mockar módulos.
- Depois de mudar comportamento visível, rode `npm test` e, para telas, a skill `verify`.
