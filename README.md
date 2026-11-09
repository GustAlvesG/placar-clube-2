# Placar Clube 🏀⚽🏐

Placar eletrônico em tempo real para **futsal, basquete e vôlei**, transmitido para
vários telões ao mesmo tempo pela rede local, com mesa de controle em tablet,
animações de ponto com foto/vídeo do jogador, comerciais, slides, carrossel de
patrocinadores e integração opcional com a API do clube (súmula oficial).

## Documentação

- 📘 **[Manual do Usuário](docs/manual-do-usuario.md)** — para quem opera o placar nos jogos
- 🛠️ **[Documentação Técnica](docs/documentacao-tecnica.md)** — arquitetura, contratos, manutenção
- 🤖 **[CLAUDE.md](CLAUDE.md)** — guia para agentes Claude que forem alterar o projeto
- 📑 [Índice completo](docs/README.md)

## Tecnologias

Node.js 22+ · Express 5 · Socket.IO 4 · HTML/CSS/JavaScript puro (sem build) ·
testes com `node:test` nativo.

## Instalação rápida

```bash
# Linux (instala e registra o serviço systemd "placar-clube")
bash setup.sh

# Windows (PowerShell)
.\setup.ps1
```

### Manual

```bash
git clone https://github.com/GustAlvesG/placar-clube.git
cd placar-clube
npm install
cp .env.example .env    # opcional: integração com a API do clube
npm start               # ou: npm run dev (recarga automática)
```

Sem `.env` preenchido o sistema funciona em **modo manual** (sem súmula).

## Telas

O servidor escuta na porta **4000**, em todas as interfaces de rede.

| Tela | Endereço |
|---|---|
| Telão | `http://<ip-do-servidor>:4000/` |
| Configuração | `http://<ip-do-servidor>:4000/controle/` |
| Mesa de controle | `http://<ip-do-servidor>:4000/controle/controle.html` |
| Anúncios (vídeos, slides, patrocinadores) | `http://<ip-do-servidor>:4000/controle/controle_anuncios.html` |
| Placar simples (só números) | `http://<ip-do-servidor>:4000/static.html` |

## Scripts

```bash
npm start            # produção
npm run dev          # desenvolvimento (nodemon)
npm test             # testes (node:test)
npm run test:watch   # testes em modo watch
```

## Estrutura

```
server.js          transporte: Express + Socket.IO, estado do jogo, uploads, integração
gameLogic.js       regras do jogo (funções puras, testáveis)
placarApi.js       cliente HTTP da API do clube (Laravel)
placarEventos.js   fila de eventos da súmula (uuid, sequência, estorno, lote)
env.js             leitura do .env
public/            telão, telas de controle, arte e mídia
test/              testes unitários
docs/              documentação
```

## Licença

ISC — dúvidas e bugs: [issues no GitHub](https://github.com/GustAlvesG/placar-clube/issues).
