# Documentação do Placar Clube

| Documento | Para quem | Conteúdo |
|---|---|---|
| [Manual do Usuário](manual-do-usuario.md) | operadores do controle, do telão e da mídia | preparar o telão, configurar o jogo, operar o Controle, regras por esporte, mídia, problemas comuns, roteiro rápido |
| [Documentação Técnica](documentacao-tecnica.md) | desenvolvedores | arquitetura, estado, `gameLogic.js`, `server.js`, contrato Socket.IO, endpoints HTTP, integração com a API Laravel, frontend, telão, testes, deploy, limitações, receitas de manutenção |
| [CLAUDE.md](../CLAUDE.md) | agentes Claude (Claude Code) | mapa do código, invariantes, armadilhas e convenções para alterar o projeto com segurança |
| [Pedido à API: parciais](prompt-api-parciais.md) | time Laravel | o que a API precisa devolver para a grade "set a set" sobreviver a um reinício |

Visão geral e instalação rápida: [README do projeto](../README.md).

## Mantendo a documentação em dia

- Mudou uma regra de jogo, evento Socket.IO, endpoint ou a integração → atualize a
  **Documentação Técnica** (e o `CLAUDE.md`, se for uma invariante listada lá).
- Mudou um botão, rótulo ou fluxo de tela → atualize o **Manual do Usuário**.
- A contagem de testes citada nos documentos sai de `npm test`.
