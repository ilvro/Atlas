# Protótipo de estilos (Fase 1)

Protótipo descartável que responde às perguntas da Fase 1 do [roadmap](../../docs/ROADMAP.md). Não é o código do produto: a Fase 2 recomeça com a estrutura de [ARQUITETURA.md](../../docs/ARQUITETURA.md) e reaproveita as ideias daqui.

```bash
npm install
npm run dev          # http://127.0.0.1:5180/
npm run medir        # com o dev aberto: capturas e FPS em medicao/
```

**Controles:** clique para andar · WASD passo a passo · botão direito ou espaço para arrastar · roda para zoom · `E`/clique na porta · `L` lanterna · `R` relâmpago · `1`–`4` climas · `P` Pixel · `B` paredes · `M` visão do mestre · `G` grade · `F` enquadrar.

## O que tem

| Arquivo | Papel |
| --- | --- |
| `src/mapa.js` | O documento: cômodos por células, aberturas em arestas, objetos por receita, luzes com `energia` |
| `src/receitas.js` | Descrições de desenho (partes com forma, material e altura); objetos de parede com `face` e `topo` |
| `src/materiais.js` | Uma descrição por material; `pintarIlustrado` e `pintarPixel` a interpretam |
| `src/raster.js` | As mesmas partes viram Ilustrado (sombra pela altura, sombreado, nanquim) ou Pixel (limiar, sombreado de borda, contorno de 1 px) |
| `src/assar.js` | Camadas estáticas por renderizador e estilo de parede: pisos, faces caixa, objetos, topo das paredes, memória em esboço, fundo com cartela |
| `src/geometria.js` | Contorno dos cômodos, faces com meia-esquadria, oclusores, polígono de visibilidade, caminho |
| `src/sprite.js` | Personagem paramétrico 16×24 em 4 direções, parado e andando |
| `src/climas.js` | Dia, tempestade, noite e apagão: só luz, paleta, acabamento e partículas |
| `src/filtros.js` | Acabamento, luz em faixas e paleta de 32 cores com dithering |
| `src/main.js`, `src/ui.js` | PixiJS 8, passes de luz/visão/névoa, câmera, controles e painel no tema da Ficha |

## Resultado (2 de novembro de 2026)

Medido com `npm run medir` em 1920×1080, Chromium do Playwright 1.58.2, **AMD Radeon RX 580** (máquina do usuário). Capturas em `medicao/`.

| Pergunta | Resposta |
| --- | --- |
| Uma descrição, dois renderizadores? | **Sim.** Mesa, cadeiras, tapetes, estantes, janelas, quadro, poltrona e escrivaninha saem das mesmas partes nos dois estilos, sem nenhum ajuste por estilo. O Pixel a 24 px por célula é o mais convincente; 16 funciona; 12 perde detalhe. |
| Paredes caixa convencem? | **Sim.** Faces com papel de parede, lambri, janelas com cortina, estante com livros e quadro; meia-esquadria certa nos cantos e no cômodo em L; porta vista como vão escuro nas duas faces. O grid continua no piso real. |
| Névoa com memória? | **Sim, e é a marca mais forte.** O cômodo explorado vira papel com hachura, contornos a nanquim e o nome à máquina de escrever. |
| Sprite no Pixel? | **Funciona** (4 direções, parado e andando). Precisa de mais trabalho de arte nos rostos e acessórios. |
| Climas mudam o momento? | **Sim.** Dia, tempestade (chuva lá fora, relâmpago pelas janelas, trovão), noite (lustre e abajur acendem) e apagão (luzes elétricas piscam e apagam, só o lampião e a lanterna ficam). |
| 60 fps com tudo ligado? | **Sim:** 60 fps (p5 = 60) nas 10 combinações medidas. |

Tempo para assar as camadas estáticas: Ilustrado com paredes caixa ≈ 1,9 s; Ilustrado sólido ≈ 25 ms com cache de ruído quente; Pixel 0,2–0,6 s. Tudo na thread principal: no produto, vai para worker.

## Lições para a Fase 2

- **Filtros aninhados em render targets falham no Pixi 8.** `BlurFilter` num contêiner com bordas fora da origem deslocou a máscara da névoa; um filtro dentro de um contêiner já filtrado sumiu com a luz. Regra: filtros só em passadas de nível superior que cobrem o render target inteiro (luz bruta → luz → faixas → mundo).
- **Shaders de filtro em GLSL ES 1.00.** O Pixi pode compilar sem `#version 300 es`: nada de arrays constantes; uniformes compartilhados com o vertex precisam de `highp`.
- **Ruído procedural precisa de cache por variação, não por seed.** Gerar um ladrilho por parte levou o assar a 20 s; cinco variações deslocadas resolveram (1,9 s).
- **Texto no canvas em metros quebra no Chrome** com fontes menores que 1 px: texto sempre em pixels reais.
- **No Pixel, a luz precisa ser em degraus** antes de multiplicar a cena; com degradê contínuo + dithering vira ruído.
- **Fog:** o polígono de visão ganha um contorno da espessura da parede, para a parede aparecer sem revelar o outro lado.

## Pendências conhecidas

- Título da cartela no Pixel ainda fraco: falta uma fonte pixel própria (bitmap).
- Transição animada da memória (traço ganhando cor) e borda suave da névoa no Ilustrado (sem `BlurFilter`).
- Sprite também no Ilustrado (opção prevista); hoje o Ilustrado usa o retrato.
- Luzes das receitas (o lampião está no mapa, não na receita da mesa).
- Assar em worker e por partes (só o que mudou).
- O retrato da Muirenn em `public/` veio da Ficha só para o teste local; não vai para nenhum build publicado.
