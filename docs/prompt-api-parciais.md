# Prompt para a API do Placar Clube (Laravel): parciais de set/quarto

Contexto: o placar eletrônico (Node) passou a fechar set/quarto **manualmente**
(botão na mesa, nunca automático) e a guardar o placar de cada parcial fechada
para exibir a faixa "set a set" no telão. Hoje essa lista vive **só em memória do
Node** — some se o processo reiniciar no meio da partida. Abaixo o que o lado
Laravel precisa fazer para virar a fonte de verdade também disso.

## 1. O que o Node já está mandando (nenhuma rota nova)

Continua sendo o lote de eventos existente:

```
POST /api/placar/jogos/{jogo}/eventos
Authorization: Bearer <token>   (ability: placar:operar)
```

O fechamento de parcial usa o tipo `set` que já existe, agora com o placar da
parcial em `payload`:

```json
{
  "uuid": "9f2c…",
  "sequencia": 137,
  "tipo": "set",
  "time_id": 12,
  "periodo": 1,
  "ocorrido_em": "2026-08-21 20:41:07.512",
  "payload": { "numero": 2, "placar_casa": 25, "placar_visitante": 23 }
}
```

Características:

- `time_id` = quem **levou** a parcial. Vem `null` quando não há vencedor — quarto
  de basquete empatado. Um evento `set` sem `time_id` não pode ser rejeitado.
- `payload.numero` é 1-based e conta as parciais já fechadas + 1 no momento do
  fechamento (1 = primeiro set).
- `placar_casa` / `placar_visitante` são o placar **daquela parcial**, não o
  acumulado do jogo.
- Correção de um fechamento equivocado continua sendo `estorno` referenciando o
  `uuid` do evento `set` (log append-only, nada de UPDATE/DELETE).
- Se a validação hoje rejeita chaves desconhecidas em `payload`, precisa aceitar
  essas três — senão o evento volta em `rejeitados` e a parcial se perde.

## 2. O que falta a API devolver (a alteração pedida)

Ninguém consegue reconstruir a faixa de parciais a partir da API hoje. Duas
saídas, na ordem de preferência:

### 2.1 Acrescentar `parciais` ao jogo já existente (preferido)

```
GET /api/placar/jogos/{jogo}
```

Acrescentar ao payload de resposta, junto de `jogo`/`time_casa`/`time_fora`:

```json
"parciais": [
  { "numero": 1, "placar_casa": 25, "placar_visitante": 23, "time_vencedor_id": 12 },
  { "numero": 2, "placar_casa": 18, "placar_visitante": 25, "time_vencedor_id": 13 }
]
```

- Ordenado por `numero` crescente, só as parciais **fechadas**.
- Derivado dos eventos `set` já persistidos (descontando os estornados) — não
  precisa de tabela nova nem de outra rota.
- `time_vencedor_id` pode ser `null` (empate).
- Array vazio quando nenhuma parcial fechou; nunca `null`.

Por que nessa rota: é a que o Node já chama em `placar_carregar_jogo`, então
recuperar o estado depois de um restart no meio do jogo não custa chamada extra.
Se `placar_casa`/`placar_fora` e `sets_casa`/`sets_fora` correntes também
vierem aí, o telão volta inteiro depois de uma queda — hoje ele volta zerado.

### 2.2 Incluir as parciais na súmula

```
GET /api/placar/jogos/{jogo}/sumula
```

Mesma estrutura de `parciais`. É o dado que falta para a súmula mostrar o set a
set (25/23, 18/25, …) em vez de só o placar final — o formato que a tabela de
vôlei/basquete usa oficialmente.

## 3. O que **não** muda

- Nenhum endpoint novo, nenhum verbo novo, nenhuma mudança de autenticação.
- O Node continua sem decidir regra de negócio nenhuma: `POST /eventos` segue
  sendo append-only, com `uuid` de idempotência e `sequencia` por jogo.
- `cronometro_ms` continua obrigatório em `ponto`/`falta` e não se aplica a `set`.
