# Frente F — Relevo em patamares

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas**. Quem implementa: Gemini.

## O que estamos tentando fazer

O Atlas é uma vista de cima com profundidade falsa (`docs/VISAO.md`), e isso continua. Mas hoje não há como dizer "esta área está 20 m abaixo daquela". O relevo existe de duas formas:

- **maciço** (`atlas_terreno` com material de uso `macico`): uma massa de rocha com volume própria, que vira parede de pedra;
- **escarpa** (`atlas_paredes` com `kind: 'cliff'`): uma linha com face de rocha descendo para um lado.

Na referência de Lysdal, a vila está num platô e, além da borda, o terreno despenca para uma floresta muito abaixo. Com as ferramentas de hoje, isso virou um muro de rocha cercando um oval. O que falta é **altitude no chão**: a floresta lá embaixo deve parecer distante (mais escura, enevoada, na sombra do penhasco), e a borda do platô deve ser uma queda de verdade, desenhada com a altura certa.

**Meta:** o terreno ganha **patamares**, áreas pintadas com uma altitude em metros (positiva ou negativa; o resto vale 0). A partir deles, o Atlas deriva sozinho:

1. as **escarpas na borda** entre patamares (com a altura do desnível, bloqueando o passo quando ele passa de 1 m);
2. o **tom pela altitude**: o que está abaixo escurece, esfria e ganha névoa, proporcionalmente à profundidade;
3. a **sombra do penhasco** sobre o nível de baixo, na direção do sol;
4. os **objetos** do nível de baixo recebem o mesmo tom (árvores lá embaixo parecem distantes).

Não é 3D: é a mesma vista de cima, com sinais visuais de profundidade.

## Decisões

- **Documento:** `Terreno.relief?: { patamares: Record<string, Patamar> }`, com `Patamar = { id: string; altura: number; cells: Faixa[] }`, em células de `terrain.resolution`. Os patamares são disjuntos, como as camadas. Ausente vale altitude 0 em tudo, e os mapas salvos abrem iguais. `id` = `idDoPatamar(altura)` = `` `p${Math.round(altura * 10)}` `` (um patamar por altitude).
- **Escarpas derivadas**, como as do maciço (`atualizarEscarpasDoMacico` em `src/domain/contorno.ts`): paredes `kind: 'cliff'` com `source: { reliefStep: number }` (o limiar de altitude daquela borda), refeitas sempre que o relevo muda. Desnível abaixo de `DEGRAU_TRANSPONIVEL = 1` m não gera parede: é degrau transponível, só desenhado.
- **O desenho da face** reaproveita a escarpa avulsa (`src/procedural/escarpa.ts`, `larguraDaFace`), que já tem altura. A largura da face fica limitada a `FACE_MAXIMA = 6` m, para quedas grandes não engolirem o mapa.
- **Visão:** a escarpa do relevo não bloqueia a visão nem a luz (a mesma regra da escarpa de hoje).
- **Rampas e escadas:** quem quer subir pinta patamares intermediários com menos de 1 m de diferença (vira rampa), ou põe uma escada (objeto) e abre um vão na parede derivada com a ação de desanexar, que já existe para as paredes de maciço.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| F1 | Patamares no documento, comandos e escarpas derivadas | domínio + comandos |
| F2 | Tom pela altitude no terreno e nos objetos | procedural + render |
| F3 | Sombra do penhasco sobre o nível de baixo | render |
| F4 | Pincel de relevo e linhas de nível no editor | interface |
| F5 | Relevo pelo conector | conector + guia |

Ordem: F1 → F2 → F3; F4 e F5 depois de F1.

---

### F1 — Patamares no documento, comandos e escarpas derivadas  ⬜
Objetivo: o documento guarda a altitude, e as bordas viram escarpas sozinhas.
Depende de: —.
Ler: `src/domain/mapa.ts` (`Terreno`, `Parede.source`), `src/domain/validacao.ts` (validação de `terrain` e de `source`), `src/domain/contorno.ts` inteiro (`contornar`, `atualizarEscarpasDoMacico`, `idDaEscarpa`), `src/state/comandos-construir.ts` (`terreno.pintar`, `terreno.apagar` e a chamada a `atualizarEscarpasDoMacico`), `src/state/comandos.ts` (o tipo `Comando`), `src/domain/celulas.ts`, `src/domain/geometria.ts:205-215` (`recalcularParedes` não mexe nas paredes de terreno: confira que também deixa as do relevo).
Arquivos: mudar `mapa.ts`, `validacao.ts`, `contorno.ts` (ou criar `src/domain/relevo.ts` com o puro e só chamar daqui), `comandos-construir.ts`, `comandos.ts`; testes em `tests/unit/relevo.test.ts` (novo) e `tests/unit/validacao.test.ts`.
Como:
1. Tipos em `mapa.ts`: `Patamar`, `Terreno.relief?`, e `Parede.source` aceita `{ reliefStep: number }`. Validação: altura finita entre −200 e 200; patamares disjuntos; `reliefStep` só em `kind: 'cliff'`.
2. `src/domain/relevo.ts`, puro:
   - `alturaNaCelula(m, i, j): number` e `alturaEm(m, p: Ponto): number` (procura nos patamares; cache por `WeakMap` no objeto `relief`, como em `edificios.ts`);
   - `alturasDistintas(m): number[]` (inclui 0 se houver célula fora de patamar);
   - `bordasDoRelevo(m): { limiar: number; desnivel: number; caminhos: Ponto[][] }[]`: para cada altitude distinta `t` acima da menor, a máscara "altura ≥ t" contornada com `contornar` (a mesma tolerância das escarpas de maciço). `desnivel` = `t` menos a altitude distinta anterior. A borda de cada contorno desce para fora da máscara: o `drop` é o lado de fora (confira a orientação devolvida por `contornar`; o teste deve provar o lado).
3. `atualizarEscarpasDoRelevo(m)`: apaga as paredes com `source.reliefStep` e cria uma escarpa por caminho, com desnível ≥ `DEGRAU_TRANSPONIVEL`: `kind: 'cliff'`, `height: desnivel`, `material` da camada de maciço mais próxima ou `rocha.cinza`, `blocks: { move: true, sight: false, light: false }` e id estável (`` `wr_${limiar}_${n}` ``). Degraus abaixo de 1 m ficam numa lista `degrausDoRelevo(m)`, só para o render.
4. Comandos `relevo.pintar { altura: number; celulas: [number, number][] }` (tira as células de qualquer outro patamar e as põe no da altura; altura 0 só tira) e `relevo.apagar { celulas }` (equivale a altura 0). Os dois chamam `atualizarEscarpasDoRelevo`. Siga o padrão de `terreno.pintar` (células normalizadas, `codificar`, `unir`, `subtrair`).
5. `VERSAO_MAPA` não muda (campo opcional). Confira em `src/domain/migracoes.ts` que um documento sem `relief` passa direto.
Não fazer: render (F2 e F3); interface (F4).
Testes: pintar −20 num retângulo gera uma escarpa fechada em volta, com `drop` para dentro (o lado baixo); pintar −0,5 não gera parede, mas aparece em `degrausDoRelevo`; dois patamares vizinhos (0 → −8 → −20) geram duas bordas com desníveis 8 e 12; apagar devolve a 0 e remove as paredes; um documento antigo valida; a escarpa derivada bloqueia o movimento (`bloqueioNoCaminho`).
Pronto quando: `npm test` passa, e no editor, pintando o relevo por um teste e2e ou pelo console, aparecem as escarpas (o desenho delas já vem do código da escarpa avulsa; confira em `ehEscarpaAvulsa`, em `src/render/entradas.ts`, que elas são tratadas como avulsas, e ajuste se não forem).
Commit: `added terrain relief steps with derived cliffs`

### F2 — Tom pela altitude no terreno e nos objetos  ⬜
Objetivo: o que está mais baixo parece distante: mais escuro, mais frio e enevoado.
Depende de: F1.
Ler: `src/render/entradas.ts` (`entradaDoTerreno`, `chaveDoTerreno`), `src/procedural/assar.ts` (`EntradaDeTerreno`, `assarTerreno`), `src/render/cena.ts` (`sincronizarTerreno` e onde os objetos ganham `tint`; procure `harmonize`), `src/domain/clima.ts` (cor do ambiente e do céu), `src/procedural/escarpa.ts` (`larguraDaFace`).
Arquivos: mudar `entradas.ts`, `assar.ts`, `cena.ts`, `escarpa.ts`; e2e em `tests/e2e/relevo.test.ts` (novo).
Como:
1. `EntradaDeTerreno` ganha `relevo?: { faixas: { altura: number; celulas: Faixa[] }[]; topo: number; neblina: string }`. `topo` é a maior altitude do mapa. `neblina` é a cor de névoa do clima (céu misturado ao ambiente; use a mesma conta que `src/render/neblina.ts` usar, ou um azul acinzentado `#8a9aae` misturado 50% ao ambiente). A chave do terreno inclui um hash do relevo.
2. Em `assarTerreno`, depois de pintar as camadas: para cada patamar abaixo do `topo`, com `p = clamp((topo - altura) / PROFUNDIDADE_DE_NEVOA, 0, 1)` e `PROFUNDIDADE_DE_NEVOA = 30` m, pinte as células do patamar com: (a) multiplicar por um cinza `1 - 0,35·p` (escurece) e (b) a cor de névoa com alfa `0,45·p` por cima, com a borda suavizada por 0,5 m (reuse a borda suave das camadas). No Pixel, a névoa é *dither* (2 níveis) em vez de alfa contínuo.
3. Degraus (`degrausDoRelevo`): uma linha de sombra de 0,15 m no lado baixo e um fio claro no alto.
4. `larguraDaFace`: limite em `FACE_MAXIMA = 6` m.
5. Objetos: na `Cena`, ao (re)desenhar um objeto, se o mapa tem relevo, `tint` = a mesma conta de escurecimento e névoa pela `alturaEm(m, o.position)` (fator multiplicativo e mistura para a cor de névoa, aproximados por `tint`, porque o Pixi não mistura cor aditiva por sprite sem filtro). Recalcule quando o relevo ou o clima mudarem. Objetos com `harmonize` combinam as duas tintas por multiplicação.
Não fazer: sombra projetada (F3).
Testes (e2e): um mapa de 30 × 20 m, metade em −25 m e metade em 0, com grama nos dois: o brilho médio da metade baixa fica pelo menos 20% abaixo do da alta; uma árvore na metade baixa tem `tint` diferente de branco; trocar o clima refaz o tom.
Pronto quando: o platô parece estar acima da mata, mesmo sem sombra.
Commit: `lower terrain fades with depth haze`

### F3 — Sombra do penhasco sobre o nível de baixo  ⬜
Objetivo: a borda alta projeta sombra no nível de baixo, na direção do sol.
Depende de: F2.
Ler: `src/render/sombras-do-sol.ts` inteiro (como maciços e escarpas já projetam sombra: `ALTURA_DA_ROCHA`, `macicos`), `src/domain/sol.ts`.
Arquivos: mudar `sombras-do-sol.ts`; e2e em `tests/e2e/relevo.test.ts`.
Como: para cada borda de `bordasDoRelevo` (F1), projetar o polígono da borda deslocado na direção oposta ao sol, com comprimento `min(desnivel × 0,6, 12)` m, só sobre o lado baixo (recorte pela máscara do lado baixo, ou desenhe e apague o lado alto com o `apagar` que o arquivo já usa). Mesma cor e desfoque das outras sombras, para que se fundam sem escurecer em dobro.
Testes (e2e): com o sol vindo do noroeste, a faixa logo a sudeste da borda (no lado baixo) fica mais escura que a mesma faixa com o sol do sudeste.
Pronto quando: ao mudar a hora do clima, a sombra do penhasco gira com o sol.
Commit: `relief cliffs cast sun shadows on lower ground`

### F4 — Pincel de relevo e linhas de nível no editor  ⬜
Objetivo: o mestre pinta e vê a altitude.
Depende de: F1.
Ler: `src/ui/Biblioteca.tsx` (`Terreno`, linhas 110 a 125: lista de materiais do pincel), `src/render/viewport.ts` (onde a ferramenta Terreno chama `terreno.pintar`), `src/render/pincel.ts`, `docs/INTERFACE.md` (identidade visual).
Arquivos: mudar `Biblioteca.tsx`, `viewport.ts` e o estado da ferramenta (procure onde `terreno: { material }` vive no estado do editor); criar `src/render/linhas-de-nivel.ts`; testes de interação, se houver padrão.
Como:
1. Na Biblioteca do Terreno, uma seção "Relevo" acima dos materiais: um campo numérico de altitude (−100 a 100 m, passo 0,5), os atalhos −20, −5, 0, +3 e +10, e um botão de borracha (altitude 0). Com o relevo escolhido, o pincel pinta `relevo.pintar` em vez de material.
2. `linhas-de-nivel.ts`: no modo Construir, enquanto o pincel de relevo está ativo (e com um interruptor "Mostrar relevo" na barra), desenhe as bordas de `bordasDoRelevo` com um traço tracejado e um rótulo de altitude ("−20 m") a cada ~15 m de borda. Nunca no projetor nem na vista de jogador.
Testes: unitário do estado (escolher altitude troca o comando do pincel); e2e opcional (pintar e ver a escarpa).
Pronto quando: o mestre pinta um vale de −15 m com o pincel e vê as linhas de nível.
Commit: `added relief brush and contour lines`

### F5 — Relevo pelo conector  ⬜
Objetivo: o Claude pinta altitude e lê o relevo.
Depende de: F1 (F2 e F3 para valer a pena).
Ler: `src/authoring/construcao.ts` (`terreno`, `OpDeTerreno`), `src/app/ponte-escrita.ts` (`atlas_terreno`), `src/app/ponte-leitura.ts` (`resumirMapa`), guia `ferramentas-atlas.md` e `mapas.md`.
Arquivos: mudar `construcao.ts`, `ponte-escrita.ts`, `ponte-leitura.ts`, guias, `catalogo-base.json`; testes em `tests/unit/construcao.test.ts` e `ponte-*.test.ts`.
Como:
1. `OpDeTerreno.acao` aceita `'relevo'` com `altura: number` (−200 a 200) e a `forma`. Gera `relevo.pintar` com as células da forma (`celulasDaForma`, com `irregular` para bordas naturais).
2. `resumirMapa` ganha `relevo: [{ altura, area (m²), caixa: [x, y, largura, altura] }]` e o número de escarpas derivadas.
3. Guia: quando usar patamar, maciço e escarpa avulsa, em três frases; exemplo de platô com vale ("vila a 0 m, mata a −25 m com `irregular: 1.5`, a trilha desce em degraus de 0,8 m"); regra: o que está lá embaixo também recebe árvores e objetos, em escala real (o tom de profundidade cuida da distância).
Testes: `acao: 'relevo'` gera o comando; altura fora do limite é recusada; o resumo traz os patamares.
Pronto quando: pelo MCP, o Claude refaz a borda de Lysdal como platô sobre mata baixa, e a imagem lê como penhasco.
Commit: `relief painting and summary in the connector`
