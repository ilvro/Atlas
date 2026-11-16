# Frente G — Cômodos de forma livre (redondos e em polígono)

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas**. Quem implementa: Gemini.

## O que estamos tentando fazer

Os cômodos são conjuntos de células de 1,5 m (`Comodo.cells`), e as paredes nascem das arestas das células (`paredesDerivadas` em `src/domain/geometria.ts`). Isso é ótimo para casas e masmorras, mas não desenha nada redondo nem diagonal. O moinho e o farol de Lysdal viraram uma cruz de células. Torres, faróis, moinhos, silos, salões circulares, absides de igreja, câmaras de reator e módulos de estação espacial ficam todos de fora.

**Meta:** um cômodo pode ter um **contorno livre** (polígono em metros, inclusive um círculo aproximado por muitos lados). O piso, as paredes (com as faces internas do estilo caixa), a névoa, a visão e o telhado seguem o contorno. As células continuam existindo, derivadas do contorno, para tudo o que pensa em células (edifícios, névoa por cômodo, explorado, mobília).

## Decisões

- **Documento:** `Comodo.outline?: Ponto[]`, um polígono simples em metros, sentido anti-horário, de 3 a 64 vértices. Com ele, `cells` passa a ser **derivado**: as células cujo centro cai dentro do polígono, recalculadas pelo comando (nunca à mão). Sem `outline`, nada muda.
- **Paredes:** um cômodo com contorno gera **uma parede fechada** que segue o polígono (`source: { roomId }`), em vez das arestas de célula. Onde uma aresta do polígono coincide com a parede de um cômodo de células vizinho (aresta alinhada à grade), o trecho coincidente é omitido do polígono: a parede do vizinho serve às duas salas e a porta entre eles funciona.
- **Telhado:** forma nova `'cone'` (faces em leque do contorno até o centróide, como a pirâmide). Para um cômodo com contorno, `quatro-aguas` e `duas-aguas` caem em `cone`; `plano` vira o polígono com platibanda; `piramide` vira `cone`.
- **Atalhos:** `circulo(centro, raio, lados = 24)`, `octogono(centro, raio)` e `poligonoRegular(centro, raio, lados, giro)` em `src/domain/formas-de-comodo.ts`, para a interface e o conector.
- **Não entra:** cômodo girado (retângulo inclinado): ele é só um polígono de 4 vértices e funciona de graça, mas a mobília automática pressupõe paredes alinhadas e não garante resultado bom. Fica documentado como limitação.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| G1 | Contorno no documento, formas e células derivadas | domínio |
| G2 | Paredes do contorno | domínio |
| G3 | Piso e faces internas pelo contorno | procedural |
| G4 | Telhado em cone e telhado de contorno | domínio + render |
| G5 | Ferramenta de cômodo redondo e em polígono no editor | interface |
| G6 | Cômodos de forma livre pelo conector | conector + guia |

Ordem: G1 → G2 → G3 → G4; G5 e G6 depois de G3.

---

### G1 — Contorno no documento, formas e células derivadas  ✅
Objetivo: o documento aceita um cômodo de contorno livre e mantém as células coerentes.
Depende de: —.
Ler: `src/domain/mapa.ts` (`Comodo`), `src/domain/validacao.ts` (validação de `rooms`), `src/state/comandos-construir.ts` (`comodo.criar`, `comodo.atualizar` e onde chamam `recalcularParedes`), `src/domain/celulas.ts`, `src/domain/geometria.ts` (`cantoDoMundo`, a conversão entre célula e metro).
Arquivos: mudar `mapa.ts`, `validacao.ts`, `comandos-construir.ts`; criar `src/domain/formas-de-comodo.ts`, `tests/unit/formas-de-comodo.test.ts`; testes de validação e de comandos.
Como:
1. `Comodo.outline?: Ponto[]`. Validação: 3 a 64 vértices finitos; polígono simples (sem autointerseção; teste de pares de arestas não adjacentes); área ≥ 2 m². Normalize para anti-horário ao gravar.
2. `formas-de-comodo.ts`: `circulo`, `octogono`, `poligonoRegular`, `areaDoPoligono`, `pontoNoPoligono` (par-ímpar), `celulasDoContorno(grade, outline): [number, number][]` (as células cujo centro está dentro) e `normalizarContorno` (anti-horário, sem vértices repetidos nem colineares).
3. `comodo.criar` aceita `outline?`: com ele, as `celulas` do comando são ignoradas e recalculadas. `comodo.atualizar` com `patch.outline` recalcula as células; `outline: null` remove o contorno (o cômodo volta a ser de células, com as células atuais).
4. Um cômodo com contorno cujas células derivadas ficariam vazias (contorno pequeno ou fora da grade) é recusado com `ErroDeComando` claro.
Não fazer: paredes (G2); render.
Testes: círculo de raio 3 m numa grade de 1,5 m dá cerca de 12 a 16 células; polígono em laço (autointerseção) é recusado; horário vira anti-horário; `outline: null` mantém as células; um documento sem `outline` valida igual.
Pronto quando: `npm test` passa.
Commit: `rooms can have a free outline polygon`

### G2 — Paredes do contorno  ⬜
Objetivo: o cômodo de contorno tem parede que segue o polígono e porta que funciona.
Depende de: G1.
Ler: `src/domain/geometria.ts` inteiro (`arestasDeParede`, `paredesDerivadas`, `arestasCobertas`, `recalcularParedes`, `encaixarNaParede`, `motivoDeNaoCaber`), `src/domain/visibilidade.ts` (`oclusores`), `src/domain/movimento.ts` (`bloqueioNoCaminho`).
Arquivos: mudar `geometria.ts`; testes em `tests/unit/geometria.test.ts` (ou o arquivo de paredes que existir).
Como:
1. `arestasDeParede` ignora as células de cômodos com `outline` (elas não geram aresta unitária).
2. Nova `paredesDoContorno(m): ParedeDerivada[]`: para cada cômodo com `outline`, o caminho fechado (último ponto = primeiro). Antes, recorte dos lados os trechos que coincidem com arestas de parede de cômodos de células (só lados horizontais ou verticais sobre linhas da grade podem coincidir; compare com `arestasDeParede` dos outros). Se o recorte quebrar o laço, gere várias paredes abertas. Id estável: `` `wc_${roomId}_${n}` ``.
3. `paredesDerivadas` devolve as de células e as de contorno. `recalcularParedes` reprojeta aberturas e objetos de parede como hoje: confirme com teste que uma porta numa parede de contorno sobrevive a mover o contorno levemente.
4. `encaixarNaParede` já trabalha com segmentos quaisquer? Confirme: uma porta em lado oblíquo deve encaixar. Se o código supuser lados alinhados, generalize para segmento qualquer (projeção ortogonal no segmento).
Não fazer: desenho (G3).
Testes: círculo isolado gera 1 parede fechada com 24 segmentos; a visão não atravessa a parede do círculo (`oclusores`); uma porta no círculo deixa passar (`bloqueioNoCaminho` com a porta aberta); um octógono encostado num cômodo retangular não duplica a parede no trecho comum, e a porta entre eles liga os dois.
Pronto quando: `npm test` passa.
Commit: `outline rooms derive their walls`

### G3 — Piso e faces internas pelo contorno  ⬜
Objetivo: o cômodo redondo é desenhado redondo: piso recortado, sombra de contato e faces internas do estilo caixa.
Depende de: G2.
Ler: `src/procedural/assar.ts` (`assarComodo`, `facesDoContorno`, `pintarFacePixel`, `ao_longo`), `src/domain/geometria.ts` (`contornoDoComodo`, `SegmentoDeContorno`, `facesDoContorno`), `src/render/entradas.ts` (`entradaDoComodo`, `chaveDoComodo`), `src/render/mascara-de-comodos.ts`.
Arquivos: mudar `geometria.ts` (`contornoDoComodo` e `facesDoContorno`), `assar.ts`, `entradas.ts`, `mascara-de-comodos.ts`; e2e em `tests/e2e/comodos-livres.test.ts`.
Como:
1. `contornoDoComodo(m, cells, outline?)`: com `outline`, devolve um único laço com um `SegmentoDeContorno` por lado (normal para dentro, `ks` vazio). A `EntradaDoComodo` leva o `outline` e a chave do bake inclui o contorno.
2. `facesDoContorno`: o vértice interno da face hoje soma as normais (`prof * (n_ant + n)`), o que só é exato a 90°. Use a junta de esquadria: `prof * (n_ant + n) / (1 + n_ant·n)`, limitada a 3 × `prof` em ângulos muito fechados. O caso de 90° continua dando o mesmo resultado (teste).
3. No Ilustrado, as faces já usam a transformação do segmento (`ctx.transform(dx, dy, …)`): confira visualmente um círculo. No Pixel (`pintarFacePixel`), se o código supuser lado alinhado, desenhe as faces oblíquas com a cor sólida da parede e o friso, sem a textura de papel (anote na ficha).
4. `mascara-de-comodos.ts` (chuva, neve e neblina que não entram em cômodo coberto): use o polígono quando houver contorno.
Testes (e2e): um cômodo circular de raio 4 m num mapa: o pixel no centro tem a cor do piso, o pixel a 4,5 m do centro tem a cor do terreno, e o pixel a 3,9 m na direção 45° é mais escuro que o centro (face ou sombra de contato).
Pronto quando: um farol redondo se desenha redondo nas duas estéticas, com as faces internas acompanhando a curva.
Commit: `outline rooms draw round floors and wall faces`

### G4 — Telhado em cone e telhado de contorno  ⬜
Objetivo: a torre redonda tem telhado cônico.
Depende de: G3.
Ler: `src/domain/telhado-geometria.ts` inteiro (`formaDe`, `trechosDe`, `aguasDe`, `aguasDoTrecho`, `Face`), `src/render/telhados.ts` (desenho das faces e da sombra), `src/domain/mapa.ts` (`FORMAS_DE_TELHADO`), `src/domain/presets.ts` (`ESTILOS_DE_TELHADO`).
Arquivos: mudar `mapa.ts`, `telhado-geometria.ts`, `telhados.ts`, `presets.ts`, `validacao.ts`; testes em `tests/unit/telhado-geometria.test.ts`.
Como:
1. `FORMAS_DE_TELHADO` ganha `'cone'`.
2. `trechosDe`: um cômodo com `outline` é sempre um trecho sozinho (não se funde com vizinhos).
3. `aguasDoContorno(outline, roof, beiral = 0.25)`: expande o polígono pelo beiral (deslocamento com esquadria, como na G3); `cone`, `piramide`, `quatro-aguas` e `duas-aguas` → uma face triangular por lado, do lado até o centróide, com `queda` apontando para fora pela normal do lado; `plano` → o polígono e a platibanda. `aguasDoTrecho` usa isso quando o trecho tem contorno.
4. Estilo novo `torre-redonda` (`telha.escamas`, `cone`, íngreme, sem detalhes) e `torre-conica-de-palha` (`telha.palha`, `cone`, íngreme). O `telhadoPadrao` de um cômodo com contorno circular (8 lados ou mais) escolhe `torre-redonda`.
5. No render, o cone com 24 faces fica liso com a luz direcional que já existe; confira que a cumeeira não é desenhada no cone.
Testes: círculo de 24 lados dá 24 faces triangulares que somam a área do polígono expandido; `quatro-aguas` num contorno vira leque; estilo `torre-redonda` existe no catálogo.
Pronto quando: o farol redondo aparece com telhado cônico na vista de telhados (B1).
Commit: `added cone roofs for outline rooms`

### G5 — Ferramenta de cômodo redondo e em polígono no editor  ⬜
Objetivo: o mestre desenha cômodos redondos e poligonais.
Depende de: G3.
Ler: `src/render/viewport.ts` (a ferramenta Cômodo, por volta da linha 640: como o retângulo é arrastado e vira `comodo.criar`), `src/ui/Biblioteca.tsx` (a seção da ferramenta Cômodo), `src/ui/Inspetor.tsx` (`CamposDoComodo`), `docs/INTERFACE.md`.
Arquivos: mudar `viewport.ts`, `Biblioteca.tsx`, `Inspetor.tsx` e o estado da ferramenta.
Como:
1. Na Biblioteca do Cômodo, um seletor de forma: Retângulo (como hoje), Círculo (arrastar do centro para fora define o raio; mostra o raio em metros) e Polígono (cliques põem vértices; duplo clique ou clicar no primeiro fecha; Esc cancela; Shift trava em 45°). Lados do círculo: 24 (campo avançado: 8 a 48).
2. O fantasma do desenho mostra o polígono e as células que o cômodo vai ocupar, em translúcido.
3. No Inspetor de um cômodo com contorno: "Forma: livre (N lados)", o raio quando for regular, e "Converter em células" (aplica `outline: null`).
Testes: unitários do estado (círculo → `comodo.criar` com `outline` de 24 pontos e raio certo; polígono fecha no primeiro ponto).
Pronto quando: o mestre desenha a torre redonda do farol em três gestos: círculo, porta e telhado.
Commit: `room tool draws circles and polygons`

### G6 — Cômodos de forma livre pelo conector  ⬜
Objetivo: o Claude cria torres, absides e módulos redondos.
Depende de: G4.
Ler: `src/authoring/construcao.ts` (`comodos`, `PedidoDeComodo`), `src/app/ponte-escrita.ts` (`atlas_comodos`), `src/app/ponte-leitura.ts` (`resumirMapa`, que a B2 ampliou), guias.
Arquivos: mudar `construcao.ts`, `ponte-escrita.ts`, `ponte-leitura.ts`, `ferramentas-atlas.md`, `catalogo-base.json`; testes.
Como:
1. `PedidoDeComodo` aceita, **em vez de** `rets`: `circulo: { centro: Ponto; raio: number; lados?: number }` ou `poligono: Ponto[]`, em **metros** (diga isso no guia em destaque, porque `rets` é em células).
2. `resumirMapa`: um cômodo com contorno traz `forma: 'circulo'` (quando regular com 12 lados ou mais, com `centro` e `raio`) ou `forma: 'poligono'` com os vértices arredondados a 0,1 m.
3. Guia: exemplos de farol (círculo de raio 3, porta, telhado `torre-redonda`), igreja com abside (nave retangular + semicírculo encostado) e módulo de estação (octógono com quatro corredores).
Testes: `atlas_comodos` com `circulo` cria o cômodo com contorno; `rets` e `circulo` juntos são recusados; o resumo devolve o círculo.
Pronto quando: pelo MCP, o farol de Lysdal sai redondo, com telhado cônico.
Commit: `connector creates round and polygon rooms`
