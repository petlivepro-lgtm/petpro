---
name: Pet Live Pro — landing pública
description: O quadro de status do petshop num palco claro, com o celular do tutor vendo o mesmo atendimento ao vivo.
colors:
  orange: "#ff6a00"
  orange-hover: "#ff7d24"
  orange-text: "#e65c00"
  ink: "#1f2a33"
  ink-hover: "#2b3a46"
  ink-strong-body: "#3a4651"
  ink-nav: "#3d4954"
  mute: "#5d6873"
  placeholder: "#6b7680"
  line: "#e6eaee"
  line-field: "#d5dbe0"
  line-dashed: "#c9d1d8"
  track: "#e3e8ec"
  soft: "#f4f6f8"
  white: "#ffffff"
  device: "#0d1317"
  on-dark-mute: "#aab5be"
  on-dark-text: "#c9d1d8"
  on-dark-line: "#33424e"
  on-dark-surface: "#2b3843"
  petrol: "#1d4e5f"
  live: "#d12b20"
  live-tint: "#fff4ec"
  st-banho: "#2a73b8"
  st-tosa: "#8a4fc0"
  st-pronto: "#237a4b"
  pronto-deep: "#1d6a41"
  pronto-tint: "#e2f2e9"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 5.4vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  price:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title-plan:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
  title-lg:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  title-sm:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.4
  lede:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.625
  body-faq:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  body-step:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.625
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  nav:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  mock-meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
  caption-xs:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  mock-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.35
  mock-xs:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
  live-tag:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.12em"
  mock-micro:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9.5px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  bar: "3px"
  tag: "4px"
  caption: "5px"
  strip: "8px"
  control: "10px"
  thumb: "11px"
  card: "14px"
  demo: "18px"
  panel: "20px"
  stage: "24px"
  phone-screen: "29px"
  phone: "38px"
  pill: "9999px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "32px"
  gutter-desktop: "72px"
  section-mobile: "96px"
  section-desktop: "128px"
  card-pad: "28px"
  grid-gap: "20px"
  board-gap: "14px"
  container: "1440px"
components:
  button-cta:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 24px"
    height: "54px"
  button-cta-hover:
    backgroundColor: "{colors.orange-hover}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-ink-hover:
    backgroundColor: "{colors.ink-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  input-signup:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 16px"
    height: "54px"
  nav-capsule:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.pill}"
    padding: "5px"
  nav-link:
    textColor: "{colors.ink-nav}"
    typography: "{typography.nav}"
    rounded: "{rounded.pill}"
    padding: "9px 16px"
  nav-link-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
  stage:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.stage}"
    padding: "28px"
  pet-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px"
  feature-card:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.panel}"
    padding: "28px"
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  live-tag:
    backgroundColor: "{colors.live}"
    textColor: "{colors.white}"
    typography: "{typography.live-tag}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  plan-card-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.stage}"
    padding: "36px"
---

# Design System: Pet Live Pro — landing pública

Escopo: só a landing pública (`apps/landing`, petlivepro.com.br). O painel (`pro-web`) e o app do tutor (`tutor-pwa`) mantêm a própria UI de produto.

## Overview

**Creative North Star: "Quadro do dia"**

A página é o balcão do petshop visto de cima: fundo branco com muito respiro, e no centro um palco cinza-claro arredondado onde o dia acontece em quatro colunas (Chegou, No banho, Na tosa, Pronto). Ao lado do quadro, o celular do tutor mostra o mesmo atendimento ao vivo. A prova é o próprio produto em movimento, desenhado com capricho de interface real: cards brancos com sombra suave, cor de estado com contraste AA, números em fonte tabular.

O tom é o da categoria executado com cuidado, não um cartaz. Os títulos são Manrope 800 em duas cores: a primeira frase em grafite, o complemento em laranja de texto. O laranja puro aparece em preenchimento (botão, linha da rota, progresso, destaque da câmera) e como texto apenas sobre fundo escuro. O vermelho existe só para dizer "ao vivo".

O movimento conta a história: os pets mudam de coluna (FLIP de 560ms), o celular segue a Luna, a notificação desce como push, a van percorre a rota até "entregue", o boletim se preenche e o destaque "ao vivo" das câmeras segue o pet de sala em sala. Toda animação pausa fora da tela, tem controle de pausa e assenta num estado final legível com `prefers-reduced-motion`.

**Key Characteristics:**
- Fundo branco, palco `soft` com borda `line` e cantos de 24px.
- Títulos em duas cores (grafite + laranja de texto), tracking negativo, `text-wrap: balance`.
- Cards brancos com sombra difusa em grafite translúcido; nada de sombra dura.
- Cor de estado por coluna (Chegou, Banho, Tosa, Pronto), sempre em ponto ou barra, nunca como fundo de página.
- Vermelho exclusivo do "ao vivo"; laranja puro como preenchimento e texto só no escuro.
- Mocks de produto (quadro, celular, push, rota, boletim) como ilustração principal, com dados marcados como exemplo.

## Colors

Branco e cinzas frios do grafite, um laranja de marca usado com parcimônia e uma família de cores de estado que só existe para ler o quadro.

### Primary
- **Laranja Pet Live** (`orange`): preenchimento do botão principal "Criar conta" (com texto grafite), linha tracejada que liga o card da Luna ao celular, rota da van, barras de progresso do celular, bolinhas do Clubinho, anel do destaque de câmera e texto de destaque sobre o grafite. Hover em `orange-hover`.
- **Laranja de Texto** (`orange-text`): a segunda frase de todo título, o "Pro" da marca, ícones de check e de abrir dúvida, cor do cursor e do anel de foco em fundo claro.

### Secondary
- **Petróleo** (`petrol`): apenas nos ícones da lista "O que você precisa". Cor institucional de apoio, nunca de destaque.

### Tertiary
- **Vermelho No Ar** (`live`): ponto "ao vivo", etiqueta AO VIVO e nada mais. A faixa "está assistindo" dos cards em atendimento usa `live-tint` como fundo.
- **Cores de estado**: Chegou usa `ink`; No banho `st-banho`; Na tosa `st-tosa`; Pronto `st-pronto`. Aparecem como ponto de 9px no cabeçalho da coluna. `st-pronto` também marca as garantias, o selo "entregue" e o preenchimento do boletim; `pronto-deep` sobre `pronto-tint` forma o selo "Enviado".

### Neutral
- **Grafite** (`ink`): texto, títulos, botão secundário escuro, fundo do plano em destaque e do bloco de fechamento. Hover do botão escuro em `ink-hover`.
- **Cinza de Apoio** (`mute`): todo texto secundário (lede, descrições, metadados, rodapé). É a cor de texto mais repetida da página.
- **Tons de leitura** (`ink-strong-body`, `ink-nav`, `placeholder`): corpo da lista de requisitos, links inativos do menu e placeholder do campo.
- **Palco** (`soft`): fundo do quadro, dos cards de recursos, dos demos e da cápsula do menu.
- **Linhas** (`line`, `line-field`, `line-dashed`, `track`): borda do palco e divisórias; borda do campo e linha pontilhada da linha do tempo; selo tracejado "nome provisório" e rota de fundo; trilhos de progresso e ruas do mapa.
- **Aparelho** (`device`): corpo do celular de mockup.
- **Sobre o escuro** (`on-dark-mute`, `on-dark-text`, `on-dark-line`, `on-dark-surface`): textos de apoio, divisórias e pílulas dentro do plano em destaque e do fechamento.

### Named Rules
**The Laranja Que Lê Rule.** Texto laranja sobre claro é sempre `orange-text`, e só em título grande, ícone ou marca. `orange` como texto só sobre grafite. Como preenchimento (botão, rota, progresso, anel), `orange` é o tom certo.

**The Vermelho É Ao Vivo Rule.** `live` só sinaliza transmissão: ponto, etiqueta AO VIVO e a faixa de quem está assistindo. Erro, alerta ou destaque nunca usam esse vermelho.

**The Estado Tem Cor Rule.** Cada coluna do quadro tem uma cor fixa, aplicada como ponto ou barra pequena. A mesma cor significa o mesmo estado em qualquer mock.

## Typography

**Display Font:** Manrope (com ui-sans-serif, system-ui)
**Body Font:** Inter (com ui-sans-serif, system-ui)
**Label/Mono Font:** Sora, só para números tabulares (preço, horário, contagens, valores)

**Character:** Manrope extrabold dá aos títulos peso de marca sem virar cartaz; Inter carrega leitura e interface; Sora com `tabular-nums` faz os números parecerem saídos do sistema.

### Hierarchy
- **Display** (800, `display`, 1.02, -0.04em): só o título do herói, três linhas largas.
- **Headline** (800, `headline`, 1.08, -0.03em): títulos de seção em duas cores e o título do fechamento.
- **Price** (Sora 700, 40px, tabular): valor do plano.
- **Title** (Manrope 800/700, 26px / 22px / 20px / 19px): nome do plano; título do bloco "O que você precisa"; título de card de recurso; títulos de passo e de item, e a marca no menu.
- **Lede** (Inter 400, 18px, 1.625): subtítulo de seção e do herói, em `mute`; a pergunta do FAQ usa o mesmo tamanho em Manrope 700.
- **Body** (Inter 400, 16.5px / 16px / 15.5px / 15px, 1.625): resposta do FAQ (máx. 68ch); campo e botões; texto dos passos e requisitos; descrições de card (máx. 300px), itens de plano e links do rodapé.
- **Nav** (Inter 600, 14.5px): links da cápsula do menu; o título da notificação no mock usa o mesmo passo em Manrope.
- **Caption / Label** (14px, 13px, 12px): legendas "Agora: Banho"; chips, garantias, cabeçalho de coluna e títulos do rodapé (13px, uppercase com tracking 0.08–0.1em só nesses dois casos); notas de "dados de exemplo" (12px).
- **Escala de mock** (12.5px, 11.5px, 11px, 10px, 9.5px): texto de interface dentro dos mocks de produto (notificação, boletim, celular, câmeras) e a etiqueta AO VIVO (Manrope 800, 10px, 0.12em). São tamanhos de tela reduzida; não servem para texto corrido da página.

### Named Rules
**The Título Em Duas Cores Rule.** Todo título de seção é uma frase em grafite seguida do complemento em laranja de texto, numa só tag, com `text-wrap: balance`.

**The Número É Sora Rule.** Preço, horário, contagem e valor monetário usam Sora com `tabular-nums`; texto nunca usa Sora.

**The Mock Fica No Mock Rule.** Tamanhos abaixo de 12px vivem só dentro de mocks de produto e da etiqueta AO VIVO.

## Layout

Contêiner único de até 1440px com respiro lateral de 16px (mobile), 32px (sm) e 72px (lg). Seções separadas por 96px no mobile e 128px no desktop, sem divisórias nem faixas de fundo; o branco faz a separação. Menu fixo de 72px (84px no lg).

O herói é uma grade de duas colunas no lg (título largo à esquerda, coluna de até 500px com lede, formulário e garantias à direita, alinhadas pela base) e, abaixo, o palco em largura total. No palco, o quadro de quatro colunas e o celular de 240px dividem a grade (`1fr` + 250px); abaixo do lg, as colunas viram um carrossel horizontal com snap (236px por coluna) e o celular desce. A linha tracejada que liga o card ao celular só existe a partir de 1280px.

Recursos usam uma grade bento de 6 colunas com linhas de 150px; passos usam 4 colunas sobre uma linha pontilhada; preços 2 colunas; FAQ título fixo de 420px à esquerda e lista à direita. Ritmo interno: cards com 28px de padding, gaps de 20–24px entre cards e 14px entre colunas do quadro.

## Elevation & Depth

Profundidade híbrida: superfícies planas em `soft` para palcos e cards de recurso, e cards brancos levantados por sombras difusas em grafite translúcido para o que é "objeto" do produto (card de pet, plano, notificação, celular). Nenhuma sombra é dura ou deslocada; todas têm blur largo e opacidade baixa.

### Shadow Vocabulary
- **Card de pet** (`box-shadow: 0 1px 2px rgba(31,42,51,.05), 0 4px 14px rgba(31,42,51,.06)`): cards do quadro em repouso.
- **Card em foco** (`box-shadow: 0 0 0 2px var(--orange), 0 18px 40px rgba(31,42,51,.16)`): o card que o tutor acompanha (Luna).
- **Mock flutuante** (`box-shadow: 0 4px 14px rgba(31,42,51,.08)`): cartão do boletim e etiqueta da rota.
- **Plano** (`box-shadow: 0 1px 2px rgba(31,42,51,.05), 0 20px 50px rgba(31,42,51,.08)`): plano claro.
- **Celular** (`box-shadow: 0 30px 60px rgba(31,42,51,.28)`): o aparelho do tutor.
- **Notificação** (`box-shadow: 0 10px 30px rgba(0,0,0,.25)`): push sobre a tela de bloqueio desfocada.
- **Aba ativa** (`box-shadow: 0 1px 2px rgba(31,42,51,.08)`): link ativo na cápsula do menu.
- **Anel de destaque** (`box-shadow: 0 0 0 3px var(--orange)`): câmera ativa; o passo ao vivo usa borda laranja com halo `0 0 0 4px` em laranja claríssimo.

### Named Rules
**The Sombra Macia Rule.** Sombra é sempre difusa e em grafite translúcido; destaque se faz com anel laranja, não com sombra mais escura.

## Shapes

Cantos arredondados em escala crescente com o tamanho do objeto: trilhos de 3px, etiqueta AO VIVO 4px, faixa "assistindo" 8px, botões do menu e ícones 10px, miniatura de pet 11px, card de pet, campo e botão principal 14px, demos 18px, cards de recurso 20px, palco, planos e fechamento 24px, celular 38px (tela 29px). Pílulas (`pill`) para cápsula do menu, chips, horários, contadores e o botão de pausa. Bordas finas de 1px em `line`; tracejado só para o que é provisório ou para trajetos (rota, linha do tempo, ligação card-celular).

## Components

### Buttons
- **Shape:** cantos de 14px no CTA (54px de altura) e de 10px nos botões do menu.
- **Primary:** "Criar conta" em `orange` com texto `ink` em 700, 24px de padding lateral; hover em `orange-hover`, `active` desce 1px.
- **Escuro:** "Criar conta" do menu e do plano claro em `ink` com texto branco; hover `ink-hover`.
- **Ghost:** "Entrar" transparente, hover com fundo `soft`.
- **Pausa:** círculo de 32px, branco com borda `line`, ícone play/pause; obrigatório em todo mock que se atualiza sozinho.

### Chips
- **Style:** pílula branca sobre `soft`, 13px semibold, padding 7px 12px (pedidos, perfis). Contador "tutores assistindo" é a mesma pílula com borda `line` e ponto ao vivo.
- **Provisório:** pílula de borda tracejada `line-dashed` para "nome provisório".

### Cards / Containers
- **Palco:** `soft`, borda `line`, 24px de canto, padding 16/24/28px.
- **Card de pet:** branco, 14px, padding 12px, miniatura 44px; em atendimento ganha a imagem da câmera (150px) e a faixa `live-tint` "está assistindo".
- **Card de recurso:** `soft`, 20px, padding 28px, título 20px e descrição em `mute`; o visual fica ancorado no rodapé do card.
- **Plano:** claro (branco, borda `line`, sombra de plano) ou em destaque (grafite, texto branco, CTA laranja). Recursos indefinidos aparecem como linhas-esqueleto em vez de texto inventado.

### Inputs / Fields
- **Style:** `Input` de `@mylivepet/ui`, 54px de altura, 14px de canto, fundo branco, borda `line-field` (sem borda sobre o escuro), placeholder `placeholder`.
- **Focus:** anel global de 2px em `orange-text` com offset de 3px; sobre o escuro, `orange`.

### Navigation
- **Desktop:** menu fixo branco a 90% com blur; marca à esquerda, cápsula `soft` de links ao centro (link ativo vira pílula branca com sombra leve), "Entrar" e "Criar conta" à direita. "Câmera ao vivo" leva o ponto vermelho.
- **Mobile:** a cápsula vira uma faixa rolável de pílulas sob o menu, com máscara de fade à direita; ativo em `soft`.

### Quadro do dia (signature)
Quatro colunas com ponto de cor de estado, rótulo uppercase 13px e contador Sora. Os cards deslizam entre colunas a cada 3,6s (FLIP 560ms, `cubic-bezier(0.77, 0, 0.175, 1)`; entrada 360ms com `cubic-bezier(0.23, 1, 0.32, 1)`). O celular do tutor (240 × 496px) mostra a câmera com AO VIVO, progresso Chegou → Na tosa → Pronto e gravações; uma curva tracejada laranja liga o card focado ao celular.

### Etiqueta AO VIVO
Pílula vermelha de canto 4px, Manrope 800 10px, ponto branco piscando (1,4s). Nas câmeras por sala, só a câmera ativa mostra a etiqueta e o anel laranja; as demais ficam escurecidas (`brightness(.62) saturate(.8)`).

## Do's and Don'ts

### Do:
- **Do** separar seções só com espaço (96px / 128px) sobre branco; o cinza `soft` é para palcos e cards.
- **Do** escrever todo título de seção como frase grafite + complemento em `orange-text`.
- **Do** usar `orange` como preenchimento (CTA com texto grafite, rota, progresso, anel de destaque) e como texto apenas sobre grafite.
- **Do** mostrar o produto em mocks com dados marcados como exemplo e cenas marcadas como ilustrativas.
- **Do** pausar animações fora da tela, oferecer botão de pausa e assentar num estado final legível com `prefers-reduced-motion`.
- **Do** usar Sora tabular para todo número.

### Don't:
- **Don't** usar `orange` (#ff6a00) como cor de texto sobre fundo claro.
- **Don't** usar o vermelho `live` para algo que não seja transmissão ao vivo.
- **Don't** usar sombras duras ou deslocadas; destaque é anel laranja ou sombra difusa.
- **Don't** trocar a cor de um estado do quadro entre mocks.
- **Don't** usar tamanhos abaixo de 12px fora de mocks de produto e da etiqueta AO VIVO.
- **Don't** usar campos nativos estilizados à mão; formulários usam os componentes de `@mylivepet/ui`.
