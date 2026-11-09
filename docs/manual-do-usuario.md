# Placar Clube — Manual do Usuário

Este manual é para quem **opera o placar** durante os jogos: a equipe da mesa,
quem cuida do telão e quem cuida dos anúncios. Não é preciso saber programar.

---

## Sumário

1. [O que é o Placar Clube](#1-o-que-é-o-placar-clube)
2. [Antes do jogo: o que você precisa](#2-antes-do-jogo-o-que-você-precisa)
3. [As telas do sistema](#3-as-telas-do-sistema)
4. [Preparar o telão](#4-preparar-o-telão)
5. [Configurar o jogo](#5-configurar-o-jogo)
6. [Durante o jogo: a mesa de controle](#6-durante-o-jogo-a-mesa-de-controle)
7. [Regras por esporte](#7-regras-por-esporte)
8. [Fim de jogo](#8-fim-de-jogo)
9. [Anúncios: vídeos, slides e patrocinadores](#9-anúncios-vídeos-slides-e-patrocinadores)
10. [O que aparece no telão](#10-o-que-aparece-no-telão)
11. [Problemas comuns](#11-problemas-comuns)
12. [Roteiro rápido (cola para a mesa)](#12-roteiro-rápido-cola-para-a-mesa)

---

## 1. O que é o Placar Clube

É o placar eletrônico do clube para **futsal, basquete e vôlei**. Um computador
(o *servidor*) fica ligado na rede do ginásio, e todas as outras telas se conectam
a ele pelo navegador:

- o **telão** (TV ou projetor) mostra o placar para o público;
- o **tablet da mesa** marca pontos, faltas, sets e controla o cronômetro;
- um computador ou tablet pode cuidar dos **anúncios** (vídeos e slides).

Tudo que a mesa faz aparece **na hora** em todos os telões.

Quando o jogo está cadastrado no sistema do clube (a "API"), cada ponto e falta
também vai para a **súmula oficial**, automaticamente.

---

## 2. Antes do jogo: o que você precisa

- O **servidor** ligado e com o Placar Clube rodando.
- O **endereço do servidor** na rede, por exemplo `192.168.1.50`. Pergunte a quem
  instalou o sistema. Nos exemplos abaixo usamos `192.168.1.50`.
- Todos os aparelhos (telão, tablet, computador) **na mesma rede** do servidor.
- **Internet** nos aparelhos de controle (as telas de controle carregam alguns
  recursos da internet, como a importação de planilhas e de PDF).
- Um navegador atualizado — **Chrome** ou **Edge** são os recomendados.

---

## 3. As telas do sistema

| Tela | Endereço | Quem usa |
|---|---|---|
| **Telão** | `http://192.168.1.50:4000` | a TV/projetor |
| **Configuração** | `http://192.168.1.50:4000/controle/` | antes do jogo |
| **Mesa de controle** | `http://192.168.1.50:4000/controle/controle.html` | durante o jogo |
| **Anúncios** | `http://192.168.1.50:4000/controle/controle_anuncios.html` | intervalos |

> Dica: salve esses endereços como favoritos (ou atalho na tela inicial) em cada
> aparelho. Atalhos antigos como `controle_futsal.html`, `controle_basquete.html` e
> `controle_volei.html` continuam funcionando — eles levam para a mesa única.

Você pode abrir várias telas ao mesmo tempo, em vários aparelhos. Todas ficam
sincronizadas.

---

## 4. Preparar o telão

1. No computador ligado à TV, abra o **Chrome** ou **Edge** no endereço do telão.
2. **Clique uma vez** na tela (ou aperte qualquer tecla). Isso:
   - coloca o telão em **tela cheia**;
   - **libera o som** dos vídeos.
3. Enquanto o jogo não começa, o telão mostra o **vídeo de espera** (ou o nome do
   clube com "Aguardando transmissão...").

Atalhos no telão:

- **Duplo-clique** liga/desliga a tela cheia.
- **Esc** sai da tela cheia.

Se aparecer no canto **"🔇 Som bloqueado pelo navegador — clique na tela para
liberar"**, é só clicar uma vez no telão. Os vídeos continuam tocando, apenas sem
som até o clique.

> Para o telão fixo, peça ao responsável técnico para configurar o navegador em
> modo quiosque com som liberado (ver [Problemas comuns](#11-problemas-comuns)).
> Assim ele já abre em tela cheia e com som, sem precisar de clique.

---

## 5. Configurar o jogo

Abra a tela de **Configuração** (`/controle/`). No topo fica o painel
**Integração com o Placar Clube**, com três formas de preparar o jogo.

### 5.1 📋 Selecionar jogo existente (recomendado)

Use quando o jogo **já está cadastrado** no sistema do clube. É o caminho
preferido: tudo o que for marcado vai para a súmula oficial.

1. Escolha o **status** (Agendado, Ao vivo, Encerrado ou todos) e, se quiser, a
   data.
2. Clique em **🔎 Buscar jogos**.
3. Na lista, clique em **Carregar** no jogo desejado.
4. Pronto: esporte, nomes, logos e elencos são preenchidos **e já enviados ao
   telão**. Uma mensagem confirma o número do jogo.

Não é preciso clicar em "Salvar". **Mas**, se você alterar algo depois de
carregar (elenco, nomes, fotos), clique em **✅ SALVAR CONFIGURAÇÃO** para o telão
receber a mudança.

Opcional, ainda nessa tela:

- **Titular / capitão**: marque nos jogadores e clique em **💾 Salvar escalação
  (API)** de cada time. Isso substitui a escalação salva antes.
- **🚦 Iniciar jogo (marcar ao vivo na API)**: marca a partida como "ao vivo". Não
  é obrigatório — **o primeiro ▶ PLAY do cronômetro já faz isso sozinho**.

### 5.2 ➕ Criar jogo agora (avulso)

Use quando o jogo **não está cadastrado**, mas você quer que ele entre no sistema
do clube.

1. Escolha o **esporte** e preencha os nomes do **TIME A** e do **TIME B**.
2. Informe **categoria** (padrão: Adulto) e **local** (opcionais).
3. Clique em **➕ Criar times e jogo agora**. O sistema reaproveita os times que já existirem com o mesmo
   nome, cria o jogo e o carrega no telão.

### 5.3 ✋ Manual (sem API)

Use só quando não há sistema do clube disponível (sem internet, jogo amistoso
etc.). **Nada vai para a súmula oficial.**

1. Em **Regras do Jogo**, escolha o esporte.
2. Preencha **🏠 TIME A (Local)** e **✈️ TIME B (Visitante)**: nome e, se quiser,
   logo.
3. Monte o **elenco** de cada time (ver 5.4).
4. Clique em **✅ SALVAR CONFIGURAÇÃO**. O formulário fica travado para evitar
   alterações acidentais.

### 5.4 Elenco

Para cada time:

- **+ Adicionar Jogador**: número, nome e foto (📷, opcional).
- **📄 Importar (.txt/.xlsx)**: carrega o elenco inteiro de um arquivo. Ele
  **substitui** o elenco atual (o sistema pede confirmação).
  - Arquivo de texto (`.txt` ou `.csv`): **uma linha por jogador**, número e nome
    separados por `;`, `,`, TAB ou espaço. O número é opcional.
    ```
    10;João Silva
    7;Pedro Santos
    Carlos Lima
    ```
  - Planilha (`.xlsx` ou `.xls`): colunas **Número** e **Nome** (o cabeçalho é
    opcional).
  - As fotos são adicionadas depois, uma a uma.
- Jogadores com 🎬 têm **vídeo de apresentação** cadastrado no sistema do clube: no
  telão, ao marcar ponto, o vídeo toca antes da faixa.

> Cadastrar o elenco é o que permite escolher **quem marcou** na mesa. Sem elenco,
> o ponto vai para o time e o telão anuncia o time.

### 5.5 Ligar a transmissão

No cartão **Transmissão do Telão**, clique em **📡 INICIAR TRANSMISSÃO**. O telão
sai da tela de espera e mostra o placar. O mesmo botão encerra a transmissão.

### 5.6 ⚠️ ZERAR PLACAR E DADOS

No fim da tela de Configuração. **Apaga tudo**: esporte, nomes, logos, elenco,
placar, cronômetro e o vínculo com o jogo do sistema do clube. Use **só ao
terminar um jogo e antes de preparar o próximo**. O sistema pede confirmação.

Não confunda com o "Zerar" da mesa (ver 6.6), que só zera os números.

---

## 6. Durante o jogo: a mesa de controle

Abra a **Mesa de controle** (`/controle/controle.html`) no tablet. Ela se adapta
sozinha ao esporte configurado.

```
┌──────────────────────────────────────────────────────────┐
│  ⚽ FUTSAL   🔗 #123 · ok        [ 10:00 ]        ⚙ MAIS  │  ← topo
├───────────────────────────┬──────────────────────────────┤
│  CASA                     │  VISITANTE                   │
│                           │                              │
│        +1 GOL             │        +1 GOL                │  ← meio
│                           │                              │
├───────────────────────────┴──────────────────────────────┤
│  −1   + FALTA     [ação do momento]    + FALTA   −1      │  ← rodapé
└──────────────────────────────────────────────────────────┘
```

### 6.1 Cronômetro (topo)

- **Toque no relógio** para iniciar ou pausar.
  - **Verde** = parado. **Âmbar** = correndo.
- O primeiro PLAY de um jogo carregado da API já marca o jogo como **ao vivo** no
  sistema do clube.
- Para **definir o tempo** (ex.: 20:00) ou **reiniciar**, use o **⚙ MAIS**.

### 6.2 Marcar ponto (meio)

1. Toque no **botão grande** do time (no basquete há **+1**, **+2** e **+3**).
2. Se o time tem elenco, abre a lista de jogadores, **ordenada por número**.
   Toque em quem marcou.
3. Opções no rodapé da lista:
   - **Sem jogador específico** — marca o ponto para o time, sem creditar
     ninguém. O telão anuncia o time.
   - **✕ Cancelar** (ou **Esc**) — desiste: **nada** é marcado. Use quando tocou
     no botão errado.

### 6.3 Corrigir (rodapé)

- **−1** tira um ponto do time. O sistema pergunta antes, mostrando o time e como
  o placar vai ficar. Com placar 0, o botão fica apagado.
- Faltas têm **−** e **+** próprios.
- Correções também vão para a súmula, como **estorno** do lance anterior.

### 6.4 Faltas (futsal e basquete)

Toque em **+ FALTA** do time e escolha o jogador (ou "Sem jogador específico").
Com jogador escolhido, o telão mostra a faixa de **FALTA!**.

### 6.5 Badge de sincronização

Quando o jogo veio da API, aparece no topo `🔗 #número`:

| Badge | Significado |
|---|---|
| verde `· ok` | tudo enviado ao sistema do clube |
| amarelo | enviando agora |
| vermelho / `· N pend.` | há lances esperando envio (sem conexão, por exemplo) |

Lances pendentes são reenviados **automaticamente** a cada poucos segundos. O
placar do telão nunca espera a internet. Se o sistema do clube **recusar** algum
lance, aparece um aviso explicando o motivo.

> Atenção: **não reinicie o servidor** com lances pendentes — eles se perdem.

### 6.6 ⚙ MAIS

Controles usados uma vez por jogo ou que apagam coisas ficam aqui, para não serem
tocados por engano:

| Controle | Para quê |
|---|---|
| **Cronômetro → DEFINIR** | define minutos e segundos do período |
| **↺ Reiniciar cronômetro** | volta ao tempo definido |
| **− Período / + Período** | muda o período/tempo/quarto (futsal e basquete) |
| **🔁 Inverter lados** | troca qual time fica à esquerda **só neste tablet** (o telão não muda). As cores acompanham o time. Útil quando a mesa fica do outro lado da quadra |
| **🏁 Fechar jogo** | encerra o jogo no sistema do clube (ver seção 8) |
| **⏹ Parar transmissão do telão** | volta o telão para a tela de espera |
| **⚠ Zerar placar, faltas e cronômetro** | zera os números, **mantendo** times, elenco e o vínculo com a API |

**Esc** fecha o painel.

---

## 7. Regras por esporte

### ⚽ Futsal

- Botão **+1 GOL**. Telão anuncia **GOL!**.
- Cronômetro **regressivo** (MM:SS).
- Faltas e período controlados pela mesa.

### 🏀 Basquete

- Botões **+1**, **+2**, **+3**. Telão anuncia **CESTA!**.
- Cronômetro **regressivo com centésimos** (MM:SS.cc).
- Faltas e quarto (período) controlados pela mesa.
- Placar e tempo **nunca somem** do telão: durante as animações o tempo aparece
  numa placa no topo e também no meio da placa da base, entre os pontos dos dois
  times.

### 🏐 Vôlei

- Botão **+1 PONTO**. Telão anuncia **PONTO!**.
- Cronômetro **crescente** (conta o tempo de jogo).
- O time que marcou fica indicado como **sacando**.
- **SET POINT**: quando um time está a um ponto de fechar o set, o telão mostra
  um selo dourado sobre o placar dele.
- **Fechar o set é sempre manual.** Ao chegar a **25 pontos com 2 de vantagem**
  (**15** no 5º set, o tie-break), aparece no rodapé o botão **✔ FECHAR SET**.
  Tocando nele:
  - o placar do set vai para o histórico,
  - o set é creditado ao vencedor,
  - o placar volta a 0 × 0,
  - o telão mostra a faixa do set (ou **FIM DE JOGO**, ao terceiro set vencido).
- Fechou por engano? **↩ REABRIR** desfaz o último fechamento.
- O jogo é **melhor de 5 sets**.

---

## 8. Fim de jogo

1. Confira o placar final.
2. Se o jogo veio da API: **⚙ MAIS → 🏁 Fechar jogo**. Confirme. O sistema envia
   tudo que estiver pendente e registra o resultado (placar, sets e períodos). Se
   houver diferença entre o que a mesa marcou e o que o sistema contou, aparece um
   aviso para conferência.
3. **⚙ MAIS → ⏹ Parar transmissão** (ou pela tela de Configuração).
4. Antes do próximo jogo, na Configuração: **⚠️ ZERAR PLACAR E DADOS** e prepare o
   novo jogo.

---

## 9. Anúncios: vídeos, slides e patrocinadores

Abra **Anúncios** (`/controle/controle_anuncios.html`).

### 9.1 🎬 Vídeos (comerciais)

1. **⬆ Enviar vídeo** para subir um arquivo ao servidor (fica salvo para os
   próximos jogos). Formatos: `.mp4` (recomendado), `.webm`, `.mov`, `.avi`,
   `.mkv`.
2. Na lista **Vídeos disponíveis**, clique em **+ Adicionar** (ou **☑ Selecionar
   tudo**) para montar a **Fila de reprodução**.
3. Marque **🔁 LOOP** se quiser que a fila repita até você parar.
4. **▶ REPRODUZIR FILA** — o telão exibe os vídeos em tela cheia, em sequência.
5. Ao terminar (sem loop), o telão volta sozinho ao placar. **⏹ PARAR**
   interrompe a qualquer momento.
6. **🗑** ao lado de um vídeo o apaga do servidor (pede confirmação).

### 9.2 🖼️ Slides

Apresentação de imagens (ou vídeos curtos) em tela cheia, avançada à mão.

1. **⬆ Enviar imagens/vídeos** ou **📄 Enviar PDF** — cada página do PDF vira um
   slide. Apresentações PowerPoint: exporte antes como PDF ou imagens.
2. Monte a **Fila da apresentação** na ordem desejada.
3. **▶ INICIAR APRESENTAÇÃO**, depois **◀ ANTERIOR** / **AVANÇAR ▶**.
4. **⏹ PARAR** volta ao placar.

Um slide em vídeo fica tocando em loop até você avançar. O telão mostra
discretamente "slide atual / total".

### 9.3 📣 Patrocinadores

- **⬆ Enviar logo** adiciona a logo ao **carrossel** do rodapé do telão. Formatos:
  `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` (PNG com fundo transparente fica
  melhor).
- **×** remove a logo.
- Todos os telões atualizam na hora.
- As mesmas logos aparecem **em tamanho maior** na faixa de cada ponto marcado.
- Sem nenhuma logo, o carrossel some.

---

## 10. O que aparece no telão

| Situação | O que o público vê |
|---|---|
| Transmissão desligada | vídeo de espera (ou nome do clube + "Aguardando transmissão...") |
| Jogo em andamento | nomes, logos, placar, cronômetro, período/faltas ou sets, carrossel de patrocinadores |
| Ponto com jogador | faixa grená com GOL!/CESTA!/PONTO!, foto, número e nome do jogador, brasão do time e logos dos patrocinadores (5 s). Se o jogador tem vídeo, o vídeo toca antes |
| Ponto sem jogador | a mesma faixa, com a logo e o nome do time |
| Falta com jogador | faixa mais sóbria com FALTA! (sem patrocinadores) |
| Fechamento de set | faixa grande com o placar do set e o total de sets (9 s); FIM DE JOGO no último |
| Vôlei | grade "set a set" com os 5 sets, selo de SET POINT |
| Comerciais / slides | tela cheia, cobrindo o placar |

Nomes de time muito longos são reduzidos automaticamente para caber em uma linha;
em casos extremos, terminam com "…". Se isso acontecer, cadastre um nome mais
curto.

---

## 11. Problemas comuns

**O telão não muda quando marco pontos.**
Confira se o telão e o tablet estão no mesmo endereço de servidor e na mesma rede.
Recarregue as duas páginas (F5).

**O telão continua na tela de espera.**
A transmissão está desligada: **📡 INICIAR TRANSMISSÃO** na Configuração.

**Não aparece a lista de jogadores ao marcar ponto.**
O time está sem elenco. Cadastre o elenco na Configuração e clique em **✅ SALVAR
CONFIGURAÇÃO**.

**Os vídeos tocam sem som.**
Clique uma vez no telão. Para resolver de vez, o técnico pode abrir o navegador do
telão assim:
```
chrome.exe --autoplay-policy=no-user-gesture-required --kiosk http://192.168.1.50:4000
msedge.exe --autoplay-policy=no-user-gesture-required --kiosk http://192.168.1.50:4000
```

**Um vídeo não toca.**
Prefira `.mp4` (H.264). Arquivos `.mkv` geralmente não tocam no navegador; peça
para convertê-los para `.mp4`.

**O vídeo novo não aparece na lista.**
Clique em **🔄 Recarregar** na tela de Anúncios.

**As opções de API estão desabilitadas.**
O servidor não está configurado para o sistema do clube. Use o modo **Manual** e
avise o responsável técnico.

**O badge mostra lances pendentes há muito tempo.**
Provavelmente a internet do servidor caiu. O placar segue funcionando; os lances
serão enviados quando a conexão voltar. **Não reinicie o servidor** enquanto houver
pendências. Se o badge ficar vermelho mesmo com internet, avise o técnico (pode ser
problema de credencial).

**Importar PDF/planilha não funciona.**
Essas funções precisam de internet no aparelho de controle.

**O servidor foi reiniciado no meio do jogo.**
O placar volta zerado. Recarregue o jogo (Configuração → Carregar), acerte o placar
pela mesa e siga. Lances que ainda não tinham sido enviados ao sistema do clube
precisam ser conferidos na súmula.

---

## 12. Roteiro rápido (cola para a mesa)

**Antes**
1. Telão: abrir o endereço, clicar uma vez.
2. Configuração: 📋 Selecionar jogo → 🔎 Buscar → **Carregar**.
3. (Se mudar elenco: ✅ SALVAR CONFIGURAÇÃO.)
4. 📡 **INICIAR TRANSMISSÃO**.
5. Mesa: ⚙ MAIS → definir o tempo.

**Durante**
- Relógio: toque = play/pausa.
- Ponto: botão grande → jogador (ou "Sem jogador específico"; "✕ Cancelar" se errou).
- Errou o ponto: **−1**.
- Vôlei: **FECHAR SET** quando aparecer; ↩ REABRIR se fechou por engano.
- Basquete/futsal: ⚙ MAIS → + Período no intervalo.

**Depois**
1. ⚙ MAIS → 🏁 **Fechar jogo**.
2. ⏹ Parar transmissão.
3. Configuração → ⚠️ ZERAR PLACAR E DADOS (antes do próximo jogo).
