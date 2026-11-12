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
6. [Durante o jogo: o Controle](#6-durante-o-jogo-o-controle)
7. [Regras por esporte](#7-regras-por-esporte)
8. [Fim de jogo](#8-fim-de-jogo)
9. [Mídia: comerciais, slides e patrocinadores](#9-mídia-comerciais-slides-e-patrocinadores)
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

Tudo que o Controle faz aparece **na hora** em todos os telões.

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
| **Controle (entrada)** | `http://192.168.1.50:4000/controle/` | abre o Controle na aba Preparar |
| **Configuração** | `http://192.168.1.50:4000/controle/configuracao.html` | editar elenco e logos, jogo avulso ou manual |
| **Controle** | `http://192.168.1.50:4000/controle/controle.html` | no tablet: preparar, marcar e controlar o telão |
| **Mídia** | `http://192.168.1.50:4000/controle/controle_anuncios.html` | enviar e organizar comerciais, slides e patrocinadores |

> Dica: salve esses endereços como favoritos (ou atalho na tela inicial) em cada
> aparelho. Atalhos antigos como `controle_futsal.html`, `controle_basquete.html` e
> `controle_volei.html` continuam funcionando — eles levam para o Controle.

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

> No dia a dia, carregue o jogo pela aba **Preparar** do Controle (seção 6.1). Esta
> tela é para o que o Controle não faz: editar elenco e logos, criar jogo avulso,
> montar um jogo manual.

Abra a tela de **Configuração** (`/controle/configuracao.html`, ou **Configuração** no topo do
Controle e da Mídia). Ela segue a ordem em que o jogo é montado: **1 Jogo**, **2
Transmissão**, **3 Esporte** e os dois times.

### 5.1 Selecionar jogo (recomendado)

Use quando o jogo **já está cadastrado** no sistema do clube. É o caminho
preferido: tudo o que for marcado vai para a súmula oficial.

1. Em **1 Jogo**, toque em **Selecionar jogo**. Com o sistema do clube ligado, a
   tela já abre assim e já busca.
2. Se quiser, escolha o **status** (Agendado, Ao vivo, Encerrado ou todos) e a
   data, e toque em **Buscar jogos**.
3. Na lista, toque em **Carregar** no jogo desejado.
4. Pronto: esporte, nomes, logos e elencos são preenchidos **e já enviados ao
   telão**. Uma faixa verde confirma o número do jogo.

Não é preciso salvar. **Mas**, se você alterar algo depois de carregar (elenco,
nomes, fotos), toque em **Salvar configuração** para o telão receber a mudança.

Opcional, ainda nessa tela:

- **Titular / capitão**: com jogo do sistema carregado, cada jogador ganha os
  botões **T** e **C**. Marque e toque em **Salvar escalação na API** do time.
  Isso substitui a escalação salva antes.
- **Marcar ao vivo agora**: marca a partida como "ao vivo". Não é obrigatório,
  **o primeiro ▶ PLAY do cronômetro já faz isso sozinho**.

### 5.2 Criar jogo agora (avulso)

Use quando o jogo **não está cadastrado**, mas você quer que ele entre no sistema
do clube.

1. Escolha o **esporte** e preencha os nomes do **Time A** e do **Time B**.
2. Em **1 Jogo → Criar jogo agora**, informe **categoria** (padrão: Adulto) e
   **local** (opcionais).
3. Toque em **Criar times e jogo agora**. O sistema reaproveita os times que já
   existirem com o mesmo nome, cria o jogo e o carrega no telão.

### 5.3 Manual (sem API)

Use só quando não há sistema do clube disponível (sem internet, jogo amistoso
etc.). **Nada vai para a súmula oficial.**

1. Em **3 Esporte**, escolha o esporte.
2. Preencha **Time A · casa** e **Time B · visitante**: nome e, se quiser, logo
   (**Escolher**; **Remover** tira a logo).
3. Monte o **elenco** de cada time (ver 5.4).
4. Toque em **Salvar configuração**. O formulário fica travado para evitar
   alterações acidentais (para editar de novo, recarregue a página).

### 5.4 Elenco

Para cada time:

- **+ Jogador**: número, nome e foto (ícone de câmera, opcional). O **×** remove.
- **Importar**: carrega o elenco inteiro de um arquivo. Ele **substitui** o
  elenco atual (a tela pergunta antes).
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
- Jogadores com o ícone de **câmera de vídeo** têm vídeo de apresentação
  cadastrado no sistema do clube: no telão, ao marcar ponto, o vídeo toca antes
  da faixa.

> Cadastrar o elenco é o que permite escolher **quem marcou** no Controle. Sem elenco,
> o ponto vai para o time e o telão anuncia o time.

### 5.5 Ligar a transmissão

No cartão **2 Transmissão do telão**, toque em **Iniciar transmissão**. O telão
sai da tela de espera, mostra o placar, e você vai direto para o Controle. O mesmo
botão encerra a transmissão. (No Controle, a aba **Telão** faz o mesmo.)

### 5.6 Zerar tudo

No fim da tela de Configuração. **Apaga tudo**: esporte, nomes, logos, elenco,
placar, cronômetro e o vínculo com o jogo do sistema do clube. Use **só ao
terminar um jogo e antes de preparar o próximo**. Para evitar acidente, é preciso
**segurar o botão** até a barra encher (pouco mais de 1 segundo).

Não confunda com o "Zerar placar" do Controle (ver 6.8), que só zera os números.

---

## 6. Durante o jogo: o Controle

Abra o **Controle** (`/controle/` ou `/controle/controle.html`) no **tablet**, de
preferência deitado. Ela se adapta sozinha ao esporte configurado e tem três
abas no topo, na ordem do dia de jogo:

| Aba | Para quê |
|---|---|
| **Preparar** | escolher o jogo do dia e conferir se está tudo pronto |
| **Controle** | marcar o jogo |
| **Telão** | decidir o que vai ao ar: placar, slides, espera ou comerciais |

Ao lado das abas ficam sempre visíveis o esporte, se o **telão está no ar** e o
estado do envio ao sistema do clube.

### 6.1 Preparar

- **Jogos**: os jogos do dia vindos do sistema do clube. Use **‹ ›** para ver
  outros dias e **⟳** para atualizar. Toque em **Carregar** no jogo certo. Se já
  houver outro jogo carregado, a própria linha pergunta se você quer trocar (trocar
  zera o placar do Controle).
- **Antes de começar**: um checklist. **Verde** está pronto; **âmbar** ainda
  precisa de você.
  - *Jogo* carregado.
  - *Elencos*: quantos atletas e titulares. **Editar** leva à Configuração.
  - *Relógio*: o tempo de cada período. **Alterar** abre o ajuste.
  - *Telão*: **Pôr no ar** liga a transmissão.
- **Ir para o controle** quando estiver tudo verde. Se o telão ainda estiver na
  espera, a tela pergunta *"Deseja colocar o jogo … no telão agora?"*: **Sim, pôr
  no ar** liga o placar no telão; **Agora não** só abre o Controle.

Jogo fora da lista ou sem internet? Monte-o à mão na **Configuração** (seção 5.3).

### 6.2 O Controle

```
┌──────────────────────────────────────────────────────────────┐
│ FUTSAL · TELÃO NO AR   [Preparar|Controle|Telão]   Lances  Mais  │  ← topo
│ [− 2º +]          [ ▶ 12:47 ]                     Ajustar    │  ← relógio
├──────────────────────────────┬───────────────────────────────┤
│ LEÕES DO SUL            3    │ TIGRES FC                2    │
│          +1 GOL              │          +1 GOL               │  ← meio
│ Faltas ●●●●○      + FALTA    │ Faltas ●●○○○      + FALTA     │
├──────────────────────────────┴───────────────────────────────┤
│ Último lance: Gol · Leões · #10 Rafael   [↩ DESFAZER] [ação] │  ← rodapé
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Cronômetro

- **Toque no relógio** para iniciar ou pausar.
  - **Verde** = parado. **Âmbar** = correndo. **Vermelho** = tempo esgotado.
- O primeiro PLAY de um jogo carregado da API já marca o jogo como **ao vivo** no
  sistema do clube.
- **− / +** ao lado do relógio corrigem o período (tempo/quarto). Não mexem nas
  faltas.
- **Ajustar** abre o ajuste do relógio: digite minutos e segundos (ou toque num
  tempo pronto, como 20:00) e toque em **Definir relógio**. **Recomeçar o
  período** volta o relógio ao tempo definido.
- Quando o tempo **acaba**, aparece no rodapé **Ir para o 3º quarto** (ou o
  período seguinte): um toque avança o período, **zera as faltas** e recarrega o
  relógio. No último período aparece **Fim do período · encerrar**.

### 6.4 Marcar ponto

1. Toque no **botão grande** do time (no basquete: **+1 lance livre**, **+2
   cesta**, **+3 três**).
2. Se o time tem elenco, sobe a lista de jogadores na cor do time: **Em quadra**
   (titulares) primeiro, **Banco** depois, cada um pelo número. Toque em quem
   marcou.
3. Embaixo da lista:
   - **Marcar sem jogador** — marca o ponto para o time, sem creditar ninguém. O
     telão anuncia o time.
   - **Cancelar** (ou **Esc**, ou tocar fora da lista) — desiste: **nada** é
     marcado.

**Modo rápido** (em **Mais**): marca ponto e falta direto, sem perguntar o
jogador. Vale só para este tablet.

### 6.5 Corrigir: Desfazer e Lances

- O rodapé mostra sempre o **último lance** (o que foi, de qual time, quem e em
  que minuto). **↩ Desfazer** desfaz exatamente esse lance, **sem prazo**: o
  botão continua lá até o próximo lance. Depois de desfazer, o rodapé passa a
  mostrar o lance anterior.
- Para corrigir um lance mais antigo, abra **Lances** (topo). Cada linha tem
  **Estornar**; a linha pergunta de novo antes de confirmar.
- Corrigir **não apaga**: no sistema do clube vira um **estorno** do lance, e na
  lista ele fica riscado.
- Alguns lances não podem mais ser corrigidos por aqui: ponto de um set que já
  fechou e falta de um período que já passou. Nesses casos o botão não aparece.

### 6.6 Faltas (futsal e basquete)

Toque em **+ Falta** do time e escolha o jogador (ou **Marcar sem jogador**). Com
jogador escolhido, o telão mostra a faixa de **FALTA!**.

Os pontinhos mostram as faltas do período. Ao chegar no limite, eles ficam
**âmbar** e aparece um aviso:

- **Futsal**, 5ª falta: *próxima falta: tiro livre*.
- **Basquete**, 4ª falta: *bônus: lances livres*.

É só um aviso; o Controle não bloqueia nada.

### 6.7 Envio ao sistema do clube

Quando o jogo veio da API, aparece no topo `#número`:

| Indicador | Significado |
|---|---|
| `· em dia` | tudo enviado ao sistema do clube |
| âmbar `· N enviando` | há lances a caminho |
| vermelho `· erro` | não está conseguindo enviar (sem conexão, por exemplo) |

Lances pendentes são reenviados **automaticamente** a cada poucos segundos. O
placar do telão nunca espera a internet. Se o sistema do clube **recusar** algum
lance, aparece um aviso explicando o motivo.

> Atenção: **não reinicie o servidor** com lances pendentes — eles se perdem.

### 6.8 Mais

Controles usados uma vez por jogo, ou que apagam coisas, ficam aqui. Os que
apagam pedem para você **segurar o botão** até a barra encher (pouco mais de 1
segundo); soltar antes cancela.

| Controle | Para quê |
|---|---|
| **Cronômetro** | definir minutos e segundos; recomeçar o período |
| **Inverter lados** | troca qual time fica à esquerda **só neste tablet** (o telão não muda). As cores acompanham o time |
| **Modo rápido** | marcar sem perguntar o jogador (só neste tablet) |
| **Encerrar jogo na API** *(segure)* | encerra o jogo no sistema do clube (ver seção 8) |
| **Parar a transmissão / Pôr o telão no ar** | liga ou desliga o placar no telão |
| **Reabrir o último set** | vôlei: desfaz o último fechamento |
| **Zerar faltas** *(segure)* | zera as faltas dos dois times |
| **Zerar placar e relógio** *(segure)* | zera os números, **mantendo** times, elenco e o vínculo com a API |
| **Configuração completa / Arquivos de mídia** | atalhos para as outras telas |

**Esc** fecha o painel.

### 6.9 Telão

- **Placar / Slides / Espera**: toque no que deve ir ao ar. O cartão marcado
  **● NO AR** é o que o telão mostra agora. *Slides* começa a apresentação com
  todos os slides da pasta.
- **Comerciais**: toque nos vídeos na ordem em que devem tocar (o número aparece
  ao lado) e em **Tocar escolhidos**. Sem escolher nenhum, **Tocar todos**.
  **Parar vídeo** volta ao que estava no ar.
- **Slides**: com a apresentação no ar, **Anterior** / **Avançar** / **Parar
  apresentação**.
- Enviar ou excluir arquivos fica em **Arquivos de mídia** (tela Mídia, seção 9).

---

## 7. Regras por esporte

### ⚽ Futsal

- Botão **+1 GOL**. Telão anuncia **GOL!**.
- Cronômetro **regressivo** (MM:SS).
- Faltas e período controlados pelo Controle.

### 🏀 Basquete

- Botões **+1**, **+2**, **+3**. Telão anuncia **CESTA!**.
- Cronômetro **regressivo com centésimos** (MM:SS.cc).
- Faltas e quarto (período) controlados pelo Controle.
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
  (**15** no 5º set, o tie-break), aparece no rodapé o botão **✔ Fechar Nº set**.
  O Controle também mostra o selo **Set point** sobre o time que está a um ponto.
  Tocando nele:
  - o placar do set vai para o histórico,
  - o set é creditado ao vencedor,
  - o placar volta a 0 × 0,
  - o telão mostra a faixa do set (ou **FIM DE JOGO**, ao terceiro set vencido).
- Fechou por engano? **↩ Desfazer** no rodapé (ou **Reabrir** em Lances / Mais) desfaz o último fechamento.
- O jogo é **melhor de 5 sets**.

---

## 8. Fim de jogo

1. Confira o placar final.
2. Se o jogo veio da API: **Mais → Encerrar jogo na API** (segure o botão). O sistema envia
   tudo que estiver pendente e registra o resultado (placar, sets e períodos). Se
   houver diferença entre o que o Controle marcou e o que o sistema contou, aparece um
   aviso para conferência.
3. **Mais → Parar a transmissão** (ou aba **Telão → Espera**).
4. Antes do próximo jogo, na Configuração: **Zerar tudo** (segure) e prepare o
   novo jogo.

---

## 9. Mídia: comerciais, slides e patrocinadores

Abra **Mídia** (`/controle/controle_anuncios.html`, ou **Mídia** no topo da
configuração, ou **Arquivos de mídia** no Controle). Ela tem três abas.

> Durante o jogo, para só pôr no ar o que já está no servidor, a aba **Telão** da
> Controle é mais rápida (seção 6.9). Esta tela é para enviar, excluir e montar a
> ordem com calma.

### 9.1 Comerciais (vídeos)

1. **Enviar** sobe um ou mais vídeos ao servidor (ficam salvos para os próximos
   jogos). Formatos: `.mp4` (recomendado), `.webm`, `.mov`, `.avi`, `.mkv`.
2. Na lista **Vídeos no servidor**, toque em **+ Fila** (ou **Todos na fila**)
   para montar a **Fila de reprodução**. O **×** tira da fila; **Limpar** esvazia.
3. Ligue **Repetir** se quiser que a fila recomece até você parar.
4. **Tocar fila no telão**: o telão exibe os vídeos em tela cheia, em sequência.
5. Ao terminar (sem repetir), o telão volta sozinho ao placar. **Parar**
   interrompe a qualquer momento.
6. A **lixeira** ao lado de um vídeo o apaga do servidor (a tela pergunta antes).

### 9.2 Slides

Apresentação de imagens (ou vídeos curtos) em tela cheia, avançada à mão.

1. **Imagens ou vídeos** ou **PDF**: cada página do PDF vira um slide.
   Apresentações PowerPoint: exporte antes como PDF ou imagens.
2. Toque em **+ Ordem** nos slides, na sequência da apresentação (ou **Todos**).
3. **Começar apresentação no telão**; depois **Anterior** / **Avançar**. O número
   do slide atual aparece entre os dois.
4. **Parar** volta ao placar.

Um slide em vídeo fica tocando em loop até você avançar. O telão mostra
discretamente "slide atual / total".

### 9.3 Patrocinadores

- **Enviar logo** adiciona a logo ao **carrossel** do rodapé do telão. Formatos:
  `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` (PNG com fundo transparente fica
  melhor). A prévia usa fundo escuro, como a faixa do telão.
- A **lixeira** remove a logo (a tela pergunta antes).
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
A transmissão está desligada: no Controle, aba **Telão → Placar** (ou **Iniciar
transmissão** na Configuração).

**Não aparece a lista de jogadores ao marcar ponto.**
O time está sem elenco. Cadastre o elenco na Configuração e toque em **Salvar
configuração**.

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
Toque no botão de recarregar (setas em círculo) na tela Mídia.

**As opções de API estão desabilitadas.**
O servidor não está configurado para o sistema do clube. Use o modo **Manual** e
avise o responsável técnico.

**O indicador `#número` mostra lances enviando há muito tempo.**
Provavelmente a internet do servidor caiu. O placar segue funcionando; os lances
serão enviados quando a conexão voltar. **Não reinicie o servidor** enquanto houver
pendências. Se o indicador ficar vermelho mesmo com internet, avise o técnico (pode ser
problema de credencial).

**Importar PDF/planilha não funciona.**
Essas funções precisam de internet no aparelho de controle.

**O servidor foi reiniciado no meio do jogo.**
O placar volta zerado. Recarregue o jogo (Configuração → Carregar), acerte o placar
pelo Controle e siga. Lances que ainda não tinham sido enviados ao sistema do clube
precisam ser conferidos na súmula.

---

## 12. Roteiro rápido (cola para a mesa)

**Antes**
1. Telão: abrir o endereço, clicar uma vez.
2. Controle → aba **Preparar** → **Carregar** o jogo.
3. Checklist todo verde (relógio em **Alterar**, telão em **Pôr no ar**).
4. **Ir para o controle** → **Sim, pôr no ar**.

**Durante**
- Relógio: toque = play/pausa.
- Ponto: botão grande → jogador (ou **Marcar sem jogador**; **Cancelar** se errou o botão).
- Errou o lance: **↩ Desfazer** no rodapé (sem prazo). Lance antigo: **Lances → Estornar**.
- Vôlei: **Fechar set** quando aparecer; **Desfazer** se fechou por engano.
- Basquete/futsal: tempo zerou → **Ir para o próximo período** no rodapé.

**Depois**
1. **Mais → Encerrar jogo na API** (segure).
2. **Mais → Parar a transmissão**.
3. Configuração → **Zerar tudo** (segure), antes do próximo jogo.
