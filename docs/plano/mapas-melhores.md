# Mapas melhores pelo assistente — visão geral

> Documento-mestre da iniciativa. Diz **o problema, o objetivo, o diagnóstico e a ordem**. Cada frente tem seu arquivo de fichas (tabela no fim). Quem implementa lê este arquivo uma vez e depois só a ficha da vez.

## O problema

O mestre pediu ao Claude (app de desktop, pelo conector MCP `mesa`) um mapa da vila de Lysdal, da campanha *O Segredo na Montanha*. Saíram dois mapas, "Lysdal · a vila" e "Lysdal · a vila (neve)", e os dois ficaram fracos:

- **As casas não têm identidade.** São 40 cômodos retangulares, quase todos de 6×6 a 9×9 m, em casas de 1 a 3 cômodos. Não há planta em L, anexo, alpendre, diferença de porte nem telhado.
- **Faltam profundidade e elevação.** A vila fica num platô na referência, com um penhasco descendo para a floresta. No Atlas, isso virou um muro de rocha em volta de um oval.
- **O cemitério são 118 cópias da mesma lápide** de 0,5 × 0,2 m, alinhadas em grade. O conjunto `cemiterio` do `atlas_espalhar` existe e não foi usado.
- **O moinho e o farol saíram como uma cruz de células**, sem a torre redonda, sem as pás e sem o andar de baixo.
- **A composição ficou centralizada.** Um oval no meio do retângulo parece "mapa quadrado", enquanto a referência ocupa uma crista na diagonal.

Os mapas de exemplo da Fase 10, feitos pelo Claude Code, ficaram muito melhores. A diferença não é o modelo. É o que ele tinha à mão: comparava com a referência a cada passo, refazia o que destoava, escrevia código para compor e sabia o que o motor desenha bem. O Claude do app só recebe ferramentas de baixo nível (pinte células, ponha cômodos retangulares, ponha objetos um a um) e um guia que ensina a ordem das chamadas, não o ofício.

**E não é só vila.** O mestre pode pedir uma nave de *Alien Isolation*, um hospital abandonado, uma masmorra ou uma estação polar. Tudo o que for feito aqui precisa servir para **qualquer lugar e qualquer gênero**.

## O objetivo

O Claude do app deve conseguir, a partir de uma conversa e de uma imagem de referência, construir no Atlas um mapa que um mestre exigente reconheça como bom: lugares com identidade, escala certa, volume, luz e história, no nível dos exemplos da Fase 10, sem que o mestre precise apontar cada defeito.

Para isso, cinco coisas precisam existir:

1. **App sempre atualizado.** O Claude não pode trabalhar num Atlas antigo (frente A).
2. **Olhos.** O Claude precisa ver o que o jogador vê (telhados, andares, relevo) e ter uma crítica objetiva do próprio mapa (frente B).
3. **Ofício.** Um método de projeto que sirva para qualquer lugar, com repertório por tipo de lugar e por gênero (frente C).
4. **Mãos de alto nível.** Ferramentas que montam um edifício inteiro, mobíliam, traçam caminhos e compõem arranjos, em vez de cem chamadas de baixo nível (frente D), e um acervo mais largo, inclusive de ficção científica (frente E).
5. **Motor capaz.** Relevo em patamares, cômodos de forma livre (redondos), andares e acabamento do terreno (frentes F a I).

## Diagnóstico técnico (conferido no código em 2026-11-14)

| Achado | Onde | Efeito |
| --- | --- | --- |
| O lançador do app de desktop só monta o `dist-desktop` quando `dist-desktop/Mesa/index.html` **não existe**. Reiniciar não atualiza. | `Mesa/scripts/launch-desktop.mjs`, `iniciarAppDesktop` | O Claude usou um Atlas de 13/11 às 16h12, sem nada da frente de telhados (catálogo com 3 coberturas e sem estilos). |
| `atlas_ver_mapa` fotografa na vista **Construir** (`projetor(true)` só esconde a grade). Em Construir, o telhado tem alvo 0. | `src/render/viewport.ts` `capturar`; `src/render/telhados.ts` `alvoDe` | Mesmo com telhados, o Claude nunca os vê. |
| `atlas_mapa_ler` não informa o telhado, a forma real nem o andar dos cômodos (só o retângulo envolvente). | `src/app/ponte-leitura.ts` `resumirMapa` | O Claude não consegue conferir o que fez. |
| O guia é lido uma vez, na partida do servidor MCP. | `scripts/ponte/mcp.ts` (`lerGuia` em `criarServidor`) | Qualquer melhoria no guia exige reiniciar o app do Claude. |
| A mobília automática por função (`propostaDeMobilia`), as luzes (`propostaDeLuzes`) e as portas (`propostaDePorta`) existem, mas o conector não as expõe. | `src/authoring/mobiliar.ts`, `luzes.ts`, `portas.ts` | O Claude mobília à mão, objeto por objeto, e erra o tamanho e o encosto. |
| São 15 tipos de cômodo, todos domésticos ou medievais. Não há estábulo, celeiro, loja, depósito, cela nem nada de nave. São 3 gêneros: investigação, moderno e fantasia. | `src/domain/presets.ts` (`TIPOS_DE_COMODO`, `GENEROS`) | O moinho virou `porao` e a queijaria virou `cozinha`. Uma nave é impossível. |
| Os cômodos são células de 1,5 m. Não há cômodo redondo nem em diagonal. | `src/domain/mapa.ts` (`Comodo.cells`), `geometria.ts` (`paredesDerivadas`) | Torres, moinhos, faróis e salões circulares viram escadinhas. |
| Não há altitude. O relevo é maciço (massa de rocha) ou escarpa (linha). | `src/procedural/macico.ts`, `escarpa.ts` | Um platô com penhasco para a floresta não tem como ser dito. |
| O documento tem `Comodo.levelId`, mas nada mais tem andar e não há interface. | `src/domain/mapa.ts`; `docs/VISAO.md:203` | Cada andar vira um mapa separado. |

## Princípios que valem para todas as frentes

- **Genérico antes de específico.** Nada de "ferramenta de vila". Uma ferramenta de edifício serve para casa, igreja, hangar e módulo de nave; um arranjo serve para cemitério, acampamento e baia de carga.
- **O documento guarda significado, não pixels** (regra da `VISAO.md`). Campos novos são opcionais: um mapa salvo antes abre igual, sem migração.
- **Puro antes de render.** Domínio e `authoring` com testes primeiro; render e interface depois, em fichas separadas.
- **Toda ferramenta nova do conector** segue o PM4b: descrição de 60 a 180 caracteres, esquema enxuto, ajuda longa em `docs/assistente/guia/ferramentas-atlas.md`. Depois, `npm run ponte:catalogo` para regenerar `scripts/ponte/catalogo-base.json`. O teste `tests/unit/ponte-escrita.test.ts` confere o tamanho.
- **Erros que ensinam.** Uma recusa diz o que existe e como corrigir, como `ErroDeConstrucao` já faz.

## Quem faz o quê

- **Gemini implementa** as fichas de código (frentes A, B, D, F, G, H, I e as partes de dados da E).
- **O Opus (Claude Code) faz diretamente** o que é conteúdo e ofício: o guia de projeto (frente C) e os desenhos do acervo (frente E, receitas e materiais). Essas fichas estão marcadas com **[Opus]**.
- O Opus revisa cada frente ao fim e confere as fichas seguintes contra o código do momento.

## Como implementar uma ficha (para o Gemini)

1. Leia o `AGENTS.md` da raiz e o do projeto (`Atlas/AGENTS.md` ou `Mesa/AGENTS.md`), este documento uma vez e a ficha da vez. Leia os arquivos de "Ler" **antes** de escrever qualquer código.
2. Uma ficha por vez, na ordem de "Depende de". Não junte fichas nem adiante trabalho de outra.
3. **Se a ficha não bater com o código** (função que não existe, assinatura diferente, arquivo movido): pare e reporte o que a ficha pede, o que o código tem e duas saídas possíveis. Não invente arquitetura.
4. TypeScript `strict`, sem `any` novo. Siga o estilo do arquivo: comentários em português, nomes em português, funções puras no domínio e em `authoring`.
5. Antes de concluir: `npm run typecheck` e `npm test` passando no projeto tocado (e `npm run test:e2e` quando a ficha pedir). Se mexeu no conector, rode `npm run ponte:catalogo`.
6. Ao concluir: marque a ficha com ✅, anote desvios numa linha "Nota:", acrescente uma linha no `Atlas/progress.md` (seção da frente) e sugira a mensagem de commit. **Não commite.**

## Frentes e ordem

| Frente | Arquivo | Quem | Depende de |
| --- | --- | --- | --- |
| A — App sempre atualizado | [app-atualizado.md](app-atualizado.md) | Gemini | — |
| B — Olhos do assistente | [olhos-do-assistente.md](olhos-do-assistente.md) | Gemini | — |
| C — Guia de projeto | [guia-de-projeto.md](guia-de-projeto.md) | **Opus** | B (C1 não depende), D e E para as partes que citam ferramentas novas |
| D — Construção de alto nível | [construcao-de-alto-nivel.md](construcao-de-alto-nivel.md) | Gemini | B1 |
| E — Acervo ampliado e gênero de ficção científica | [acervo-ampliado.md](acervo-ampliado.md) | **Opus** (desenhos) + Gemini (dados) | — |
| F — Relevo em patamares | [patamares.md](patamares.md) | Gemini | — |
| G — Cômodos de forma livre | [comodos-livres.md](comodos-livres.md) | Gemini | — |
| H — Andares | [andares.md](andares.md) | Gemini | G recomendado (torre redonda de vários andares) |
| I — Acabamento do terreno e dos edifícios | [acabamento-do-terreno.md](acabamento-do-terreno.md) | Gemini | F1 |
| J — Realismo, rotação, composição e guias | [realismo-e-composicao.md](realismo-e-composicao.md) | Gemini / Claude | I4 |

**Ordem recomendada:**

1. A inteira: barata, e sem ela nada do resto chega ao Claude do app.
2. B inteira: o Claude passa a se ver e a se criticar.
3. Em paralelo: C1 (Opus) e E (Opus nos desenhos; Gemini em E1 e E2).
4. D: ferramentas de alto nível.
5. F, depois G, depois H: o motor ganha volume.
6. I: polimento.
7. C2 (Opus): o guia passa a ensinar as ferramentas e o motor novos.
8. **Validação:** refazer "Lysdal · a vila (neve)" pelo Claude do app, só com conversa e a imagem de referência, e comparar lado a lado. Depois, pedir uma nave no estilo *Alien Isolation* como teste de generalidade.
