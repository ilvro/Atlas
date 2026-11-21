# N — Telhados detalhados

Referências: `docs/referencias/telhados/` (cabana de tábuas gasta, casa de tabuinhas, delegacia de telha com musgo e puxado mais baixo; os mapas de O Segredo na Ilha) e `atlas-2026-11-19.png` (os 14 estilos de hoje, às 15h).

## Diagnóstico (2026-11-19)

O Atlas já tem um sistema de telhados completo **de estrutura** ([telhados.md](telhados.md), T1–T7, e G4 em [comodos-livres.md](comodos-livres.md)): edifício derivado, fade por edifício, 12 coberturas, 5 formas (quatro águas, duas águas, plano, pirâmide e cone), 14 estilos, detalhes (chaminé, cruz, sino, cata-vento, claraboia e caixa-d'água), penumbra dos interiores e chave do mestre na sessão. O que falta para chegar às referências é **o desenho e a luz**, não a estrutura:

1. **O telhado fica fora da luz da Frente L.** `telhados.raiz` vem depois de `mundoIluminado` e da névoa (`cena.ts:118`), então não recebe luz HDR, relevo, AO nem curva de tom. A única luz dele é um véu branco ou preto por água (`telhados.ts:244-246`). Por isso ele parece chapado ao lado do chão e das paredes, que já têm relevo. À noite, os lampiões da rua também não o iluminam.
2. **A textura é chapada e se repete.** Cada cobertura é um ladrilho de 2 × 2 m (`coberturas.ts`), sem altura. A repetição aparece (na palha, por exemplo, em faixas concêntricas), e as peças não têm espessura nem sombra própria.
3. **Todo telhado está novo.** Não há musgo escorrendo, sujeira nos rincões, telha quebrada ou faltando, buraco, remendo, fuligem ou neve. Nas referências, é isso que dá a cara: a delegacia tem musgo em fios na direção da queda, e a cabana tem a madeira manchada e esburacada.
4. **Faltam as peças de acabamento.** A cumeeira é um traço de 0,12 m, e não há capa de cumeeira em peças, espigão nos quatro-águas, beiral com espessura, testeira nem guarda-pó no oitão.
5. **Falta a fachada.** Nos mapas de O Segredo na Ilha, abaixo do beiral da frente aparece a parede de fora com a porta e as janelas. É o que faz a casa parecer uma casa vista de cima, e não uma placa. É coerente com as paredes "caixa" do Atlas.
6. **Os encontros são falsos.** Em L e em T, os retângulos se sobrepõem (`telhado-geometria.ts`, "sem rincão de verdade"), e o puxado não pode ficar mais baixo que o corpo da casa (a delegacia da referência).
7. **O catálogo não cobre "qualquer casa de qualquer era".** Faltam tábuas (a cabana da referência), telha francesa, telha esmaltada oriental, chapa com junta, fibrocimento, mármore, folha de ouro, chumbo, vidro, vitral, bambu e couro. Também faltam as formas uma água, mansarda, holandês (celeiro), cúpula, abóbada, pagode (beiral curvo) e bulbo.

**Resposta curta:** hoje, não. Dá para ter variedade de material e de forma, mas não o detalhe das referências. A distância está no motor (itens 1, 2 e 6), não em ajuste de material, então não adianta só acrescentar coberturas.

## Decisões

- **O telhado passa a ser um assado por edifício**, como os cômodos, e não um `Graphics` com textura. O assado devolve **cor** (albedo com alfa) e **normal** (RG = normal xy, B = oclusão). Normal e não altura: a água do telhado é uma rampa suave, e no mapa de altura de 8 bits ela viraria curvas de nível (armadilha da Frente L).
- **A forma é um campo de altura, e não uma lista de faces.** Para cada ponto, `h(p)` é o **máximo** entre os retângulos (ou o contorno) do trecho, cada um com a função da forma dele. O máximo resolve sozinho rincões, encontros em L e T e o puxado mais baixo. A inclinação sai do gradiente (em float, no worker), e as fiadas seguem a distância ao beiral (`v`) e a posição ao longo da aresta (`u`), como num telhado de verdade: paralelas ao beiral, encontrando-se no espigão. Qualquer forma nova é só uma função nova de `h`.
- **Cobertura, desgaste, acabamento e detalhes são camadas separadas do mesmo assado.** A cobertura diz o material e as peças. O desgaste diz musgo, sujeira, dano e neve. O acabamento (cumeeira, espigão, beiral, testeira) e os detalhes vêm da cobertura e da forma.
- **O documento ganha só campos opcionais** em `roof`: `wear` e as formas novas. Sem eles, vale o desenho de hoje melhorado: os mapas salvos abrem sem migração. A neve `'auto'` segue `climate.weather.snow`.
- **Luz própria dos telhados:** albedo × (ambiente externo + sol × N·L + luzes externas), com a mesma exposição e curva de tom da composição. Luzes dentro de cômodos cobertos não iluminam o telhado; lampiões da rua, sim.
- **Fachada:** faixa de 0,9 m abaixo dos beirais voltados para a frente do mapa (+y), com a parede de fora, as portas e as janelas. Fica numa camada **abaixo das peças** (a pessoa na rua fica na frente da parede) e some junto com o telhado. `style.facades?: boolean`, ausente = ligado.
- **Pixel:** continua funcionando com o mesmo assado quantizado na paleta, mas sem trabalho próprio nesta frente (o Pixel está em espera).
- **Quem faz:** domínio, interface e ponte com o Sonnet; desenho, assado e render com o Opus (regra do visual).
- **Desempenho:** o assado por edifício (≈ 64 px/m) depende da fila puxada e do cache persistente da [Frente M](carregamento.md) (M2 e M5). Sem eles, uma vila com 20 casas somaria segundos à carga.

## Tarefas

| # | Tarefa | Camada | Quem |
| --- | --- | --- | --- |
| N1 | Documento: desgaste, formas novas e fachadas | domínio | Sonnet |
| N2 | Campo de altura do telhado | domínio | Sonnet |
| N3 | Coberturas com relevo e peças | procedural | Opus |
| N4 | Assado do telhado: cobertura, acabamento e detalhes | procedural | Opus |
| N5 | Desgaste: musgo, sujeira, dano, remendo, fuligem e neve | procedural | Opus |
| N6 | Camada de telhados iluminada | render | Opus |
| N7 | Fachada sob o beiral | procedural + render | Opus |
| N8a | Coberturas de todas as eras | procedural | Opus |
| N8b | Coberturas nobres e transparentes: mármore, ouro, vidro, vitral | procedural + render | Opus |
| N9 | Estilos, estado do telhado no Inspetor e ponte | domínio + interface + ponte | Sonnet |
| N10 | Prancha, exemplos e guia | validação | Opus |

Ordem: N1 → N2 → N3 → N4 → N6 (aqui o telhado novo substitui o antigo) → N5 → N7 → N8a → N8b → N9 → N10. N4 e N6 dependem de M2; o N6 deve entrar depois da M5, ou junto.

---

### N1 — Documento: desgaste, formas novas e fachadas  ✅
Objetivo: o documento consegue dizer "telha velha com musgo e duas telhas faltando, coberta de neve" e as formas novas.
Depende de: —.
Ler: `src/domain/mapa.ts:90-110` (`FORMAS_DE_TELHADO`, `DetalheDeTelhado`, `Comodo.roof`) e `Estilo`, `src/domain/validacao.ts`, `src/state/comandos-construir.ts` (merge de `roof` em `comodo.atualizar`), `src/domain/telhado-geometria.ts` (`formaDe`, `trechosDe`).
Arquivos: mudar `mapa.ts`, `validacao.ts`, `telhado-geometria.ts` (só `formaDe`/`trechosDe`); testes no arquivo de validação existente e em `tests/unit/telhado-geometria.test.ts`.
Como:
1. `FORMAS_DE_TELHADO` ganha `'uma-agua' | 'mansarda' | 'holandes' | 'cupula' | 'abobada' | 'pagode' | 'bulbo'`.
2. `roof.wear?: { moss?: number; dirt?: number; damage?: number; snow?: number | 'auto' }` (0–1). Ausente = `{ moss: 0, dirt: 0.15, damage: 0, snow: 'auto' }`, devolvido por `formaDe` (renomear para `telhadoEfetivo` se ficar mais claro; manter `formaDe` como alias).
3. `roof.seed?: number` (ausente = `floor.seed` da primeira sala, como hoje para os detalhes).
4. `Estilo.facades?: boolean` (ausente = `true`).
5. `trechosDe` passa a separar também por `wear` diferente.
6. Validação: números entre 0 e 1; forma desconhecida é recusada; documentos sem os campos passam.
Não fazer: render; estilos novos (N9).
Testes: validação dos campos novos; `formaDe` com e sem `wear`; dois cômodos vizinhos com `wear` diferente dão dois trechos.
Pronto quando: `npm run typecheck` e `npm test` passam e os exemplos abrem.
Nota: `src/app/ponte-escrita.ts` espalhava `[...FORMAS_DE_TELHADO]` em `atlas_comodos`; para não estourar o catálogo base nem o orçamento de 30 KB antes da N9, `telhadoForma` ficou temporariamente restrito às 5 formas anteriores (com comentário para voltar para `[...FORMAS_DE_TELHADO]` na N9).
Commit: `roofs can describe wear, new shapes and facades`

### N2 — Campo de altura do telhado  ✅
Objetivo: uma função pura diz, para cada ponto de um edifício, a altura do telhado, a inclinação, a direção das fiadas e se o ponto está num rincão, numa cumeeira ou num espigão.
Depende de: N1.
Ler: `src/domain/telhado-geometria.ts` inteiro (`retangulosDe`, `aguasDe`, `aguasDoTrecho`, o caso de contorno e o cone), `src/domain/geometria.ts`.
Arquivos: criar `src/domain/campo-do-telhado.ts` e `tests/unit/campo-do-telhado.test.ts`.
Como:
1. `campoDoEdificio(m, ed, beiral = 0.25): CampoDoTelhado`, com `amostrar(x, y): Amostra | null`, sendo `Amostra = { h, gx, gy, u, v, trecho, peca: 'agua' | 'cumeeira' | 'espigao' | 'rincao' | 'beiral' | 'plano', distAresta }`, e a caixa em metros.
2. Para cada retângulo (expandido pelo beiral) de cada trecho, uma função `h_r(p)` com `d` = distância até a borda do retângulo, `ang` = 30° (ou 50° quando `steep`) e `k = tan(ang)`:
   - `quatro-aguas` e `piramide`: `k × min(dx, dy)`;
   - `duas-aguas`: `k × d` só no eixo curto (cumeeira no eixo de `ridge`);
   - `uma-agua`: `k × (distância à borda baixa)`, com queda para +y por padrão (`ridge` diz o eixo);
   - `mansarda` e `holandes`: duas inclinações (70° até 40% do meio-vão e 25° depois), em quatro ou em duas águas;
   - `plano`: constante, mais a platibanda;
   - `cupula`: `√(r² − ρ²)` sobre o círculo inscrito; `bulbo`: perfil de cebola com ponta; `abobada`: semicilindro no eixo maior;
   - `pagode`: `k × d^1.6` (beiral curvo que levanta nas pontas);
   - contorno livre (cone): `k × distância ao contorno`, como hoje.
3. `h(p) = max_r h_r(p)` + `alturaBase` (3 m). O trecho que vence dá `trecho`, `u` e `v` (`v` = distância ao beiral daquele retângulo, `u` = posição ao longo da aresta mais próxima). `rincao`: os dois maiores `h_r` diferem menos que 2 cm e vêm de retângulos diferentes; `cumeeira` e `espigao`: o gradiente muda de direção a menos de 6 cm.
4. Puxado mais baixo: num trecho mais estreito, a cumeeira fica naturalmente mais baixa, e o máximo faz o resto. Não é preciso campo novo.
5. Gradiente analítico por forma (ou diferença central de 1 cm, se ficar mais simples) em float.
Não fazer: raster; cores.
Testes: 4 × 2 em quatro águas: altura máxima no centro, gradiente apontando para fora em cada água, espigões nas diagonais; L de duas duas-águas: existe rincão na diagonal interna; puxado de 2 m ao lado de corpo de 6 m: o puxado fica mais baixo e não cobre a cumeeira do corpo; cúpula: `h` máximo no centro e simétrico; `u`/`v` contínuos dentro de uma água.
Pronto quando: `npm test` passa.
Nota: `(gx, gy) = (∂h/∂x, ∂h/∂y)` aponta no sentido da subida (para dentro), de modo que a normal da água para N4/N6 é `normalize(-gx, -gy, 1)` (com `(-gx, -gy)` apontando para fora/queda, igual a `composicao-de-luz.ts`). `v` cresce a partir de `0` no beiral da água vencedora e `u` corre em metros ao longo da aresta mais próxima (arco em metros nas formas radiais e perímetro acumulado no contorno livre). Exporta `campoDoEdificio`, `campoDosTrechos` (para o worker do N4), `ALTURA_BASE_TELHADO`, `BEIRAL_PADRAO`, `CampoDoTelhado` (`caixa: { x0, y0, x1, y1, w, h }`, `trechos`, `beiral`, `alturaMaxima`, `amostrar`), `AmostraDoTelhado` (alias `Amostra`, com `indiceTrecho` e `folgaRincao` para AO de rincão no N4) e `PecaDoTelhado`. Em encontros em L/T/puxado, alas perpendiculares mais estreitas (ou iguais) estendem a borda interna até a linha média do corpo para formar rincões contínuos até a cumeeira sem degrau.
Commit: `added a height field for roof shapes with valleys and hips`

### N3 — Coberturas com relevo e peças  ✅
Objetivo: cada cobertura diz, além do tom, a altura miúda e a peça (telha, tábua, ardósia), para ter espessura, sombra própria e variação peça a peça.
Depende de: —.
Ler: `src/procedural/coberturas.ts` inteiro (`Amostrador`, `amostrarPonto`, `amostrarCobertura`, `pecaNaFiada`), `src/procedural/materiais.ts` (materiais `telha.*`, `Material.mancha`), as notas da Frente L sobre pintores de altura (só platôs, juntas e biséis).
Arquivos: mudar `coberturas.ts`; testes em `tests/unit/coberturas.test.ts`.
Como:
1. `Amostra` ganha `h` (0–1, a altura miúda dentro da peça: borda de baixo da telha mais alta, sombra da fiada de cima, junta funda) e `id` (inteiro estável por peça).
2. As coberturas deixam de ser periódicas de 2 m: amostram em `(u, v)` contínuos (a função recebe metros, e o período deixa de ser obrigatório). O ladrilho periódico fica só para a miniatura e para o Pixel antigo.
3. Variação por peça: tom ±8% e mancha por `hash(id)`; nas telhas de barro, uma em cada ~40 é mais clara ou mais escura (telha trocada).
4. Ajustar as 12 coberturas para o relevo ter leitura de cima: barro (canal em arco, sombra da de cima), ardósia (placas finas com borda), escamas, palha (feixes com borda grossa no beiral), tabuinhas (desencontradas com fresta), pedra, cobre, zinco, concreto, grama, lona e velha (que vira barro com `wear` no N9).
Não fazer: render; desgaste (N5).
Testes: toda cobertura devolve `h` em [0, 1] e `id` estável; mesma entrada dá a mesma saída; duas peças vizinhas têm `id` diferente.
Pronto quando: uma prancha (`?prancha=coberturas`, ou o script de prancha existente) mostra as 12 com relevo sombreado de um sol fixo, e o usuário aprova.
Commit: `roof coverings have per-piece relief and variation`
Nota: Prancha de validação visual gerada em `test-results/n3-coberturas.png` (12 coberturas em 3,5 × 2,5 m contínuo a 80 px/m, sombreadas por sol direcional + faixa do mapa `h`). API exportada em `src/procedural/coberturas.ts` para uso da N4/N5: `AmostraDeCobertura` (`{ t, m, h, id }`), `amostrarPontoContinuo(m, u, v, semente?, saida?)`, `amostradorContinuo(m, semente?)` (sem alocação por pixel), `corDaAmostra(m, t, mancha, saida?)` e `hashDaPeca(id, semente?)`. Convenção de eixo: `u` corre ao longo do beiral e `+v` aponta na direção da queda d'água (a fiada de cima cobre a de baixo; no N4, passar `v` crescendo em direção ao beiral). `amostrarPonto`, `amostrarCobertura` e `texturaDeCobertura` continuam periódicos em 2 m para miniaturas e Pixel.

### N4 — Assado do telhado: cobertura, acabamento e detalhes  ✅
Objetivo: um pedido de assado devolve o telhado inteiro de um edifício, em cor e normal.
Depende de: N2, N3, M2.
Ler: `src/procedural/executar.ts` (`PedidoDeBake`, `paraBitmap`), `src/procedural/assar.ts` (`assarComodo`, como um cômodo vira `Assado`), `src/procedural/detalhes-de-telhado.ts` (`descricaoDoDetalhe`, `posicoesDosDetalhes`), `src/render/entradas.ts` (`entradaDoComodo`, chaves).
Arquivos: criar `src/procedural/assar-telhado.ts`; mudar `executar.ts`, `entradas.ts` (`entradaDoTelhado`, `chaveDoTelhado`); testes em `tests/unit/assar-telhado.test.ts` (o que for puro) e e2e de prancha.
Como:
1. `EntradaDoTelhado`: os trechos do edifício (células ou contorno, `roof` efetivo, semente), a grade, as paredes de fora (para a fachada do N7), o clima que importa (neve e direção do sol, **não**: a luz é do N6) e o gênero.
2. `assarTelhado(e, res, estilo): Assado` com `tela` (cor + alfa), `normal` (RG = N.xy × 0,5 + 0,5, B = AO) e `origem`. Por pixel: `campo.amostrar` → cobertura em `(u, v)` → normal = normal da água (do gradiente) inclinada pela derivada de `h` da peça → cor.
3. Acabamento por `peca` do campo: cumeeira e espigão recebem uma **capa** própria da cobertura (telhas-canal emborcadas no barro, chapa dobrada no zinco e no cobre, tábua no tabuado e na tabuinha, feixe de palha na palha, pedra na pedra); beiral com 6 cm de testeira escura e sombra embaixo; oitão (duas águas) com guarda-pó.
4. AO: rincões e encontros escurecem (pela diferença entre os dois maiores `h_r`); a borda do beiral, também.
5. Detalhes: `posicoesDosDetalhes` passa a usar o campo (chaminé numa água, a 1/3 da cumeeira). O desenho do detalhe entra no mesmo assado (cor e normal), por cima, com sombra própria projetada na água conforme a direção do sol da entrada.
6. `ResultadoDeBake` ganha `normal?: ImageBitmap`. O worker a transfere.
Não fazer: render na cena (N6); desgaste (N5); fachada (N7).
Testes: o assado de uma casa 4 × 3 tem alfa 0 fora do beiral e 1 dentro; numa casa em L, a normal muda de lado ao cruzar o rincão; mesma entrada dá o mesmo bitmap.
Pronto quando: a prancha mostra uma casa em L, uma igreja (nave + torre) e uma cúpula com fiadas paralelas ao beiral, capas de cumeeira e rincão.
Nota: Prancha de validação visual gerada em `test-results/n4-telhados.png` (casa em L de barro com chaminé, igreja nave + torre de ardósia com cruz e sino, e cúpula de cobre com cata-vento, em Albedo, Normal/AO e Prévia Sombreada). `src/procedural/assar-telhado.ts` exporta `amostrarTelhado` (puro em `Uint8ClampedArray` para testes em Node) e `assarTelhado` (Canvas/Worker com `assarDescricao` para detalhes); `src/render/entradas.ts` exporta `EntradaDoTelhado`, `entradaDoTelhado` e `chaveDoTelhado` (omitindo `sol` quando não há detalhes para não invalidar o cache ao mudar a hora); `executar.ts` inclui `{ tipo: 'telhado' }` e `ResultadoDeBake.normal`; `baker.ts` dá prioridade `2` a `tipo === 'telhado'`.
Commit: `roofs are baked per building with color and normal maps`

### N5 — Desgaste: musgo, sujeira, dano, remendo, fuligem e neve  ✅
Objetivo: cada telhado conta a história da casa: novo, gasto, abandonado, nevado.
Depende de: N4.
Ler: `src/procedural/assar-telhado.ts`, `src/procedural/ruido.ts`, `Material.mancha` em `materiais.ts`, as referências (delegacia e cabana).
Arquivos: mudar `assar-telhado.ts`; criar `src/procedural/desgaste-de-telhado.ts`; testes em `tests/unit/desgaste-de-telhado.test.ts`.
Como:
1. **Musgo** (`moss`): ruído esticado na direção da queda (`(u × 3, v × 0,6)`), que nasce nas juntas e escorre para o beiral; mais forte nas águas voltadas para −y (o "norte" do mapa) e nos rincões. Cor do `mancha` do material, ou verde-musgo padrão.
2. **Sujeira** (`dirt`): escurece rincões, a base de chaminés e os últimos 30 cm do beiral; folhas secas soltas nos rincões quando `dirt > 0,5`.
3. **Dano** (`damage`): peças com `hash(id) < damage × 0,15` ficam faltando (aparecem as ripas e o escuro de baixo) ou tortas (normal girada e tom trocado); acima de 0,6, buracos maiores com bordas quebradas; remendos de peças de outro tom em manchas.
4. **Fuligem:** em volta da chaminé, na direção oposta ao vento (ou fixa para +x sem vento).
5. **Neve** (`snow`, ou o clima com `'auto'`): acumula mais onde a água é menos inclinada (nada acima de 55°), cobre rincões e cumeeiras, derrete num anel em volta da chaminé, deixa uma borda pendurada no beiral e esconde o musgo. A normal da neve é suave.
6. Tudo determinístico pela semente do telhado.
Não fazer: animação; neve caindo (já existe em partículas).
Testes: `damage = 0` não tira peça; a mesma semente dá o mesmo dano; a neve num telhado plano cobre mais que numa água íngreme.
Pronto quando: a prancha reproduz o espírito da delegacia (telha com fios de musgo) e da cabana (madeira manchada, peças faltando), e o usuário aprova lado a lado.
Nota: `src/procedural/desgaste-de-telhado.ts` exporta `prepararDesgaste` e `aplicarDesgasteDeTelhado` (sem alocação por pixel), integrado em `amostrarTelhado` após o acabamento de cumeeira/beiral e antes dos detalhes; diferencia a semente das peças por direção da água `(dvx, dvy)` para evitar espelhamento simétrico entre águas opostas. Prancha de validação visual (delegacia em L com musgo e puxado mais baixo, cabana de tábuas gasta com remendos e peças faltando, casa de tabuinhas com dano > 0,6 e fuligem de chaminé, e casa em L nevada com anel derretido ao redor da chaminé) gerada em `test-results/n5-desgaste.png`.
Commit: `roofs show moss, dirt, damage, soot and snow`

### N6 — Camada de telhados iluminada  ✅
Objetivo: o telhado responde à luz como o resto do mapa: sol, noite, lampiões da rua e a mesma curva de tom.
Depende de: N4, M2 (de preferência M5).
Ler: `src/render/telhados.ts` inteiro, `src/render/cena.ts:100-130` (ordem das camadas) e `sincronizar`, `src/render/composicao-de-luz.ts` (shader, exposição, curva de tom), `src/render/mapa-de-luz.ts` (`ambiente`, `direcao`, `mascaraInterior`, luzes), `src/render/passadas.ts`, `src/render/sombras-do-sol.ts`, `src/render/halos.ts` (`telhados.visivel`).
Arquivos: mudar `telhados.ts`, `cena.ts` e `mapa-de-luz.ts` (luzes externas); e2e em `tests/e2e/telhados.test.ts`.
Como:
1. Por edifício: pedir o assado (chave por `entradaDoTelhado`) e mostrar dois sprites alinhados (cor e normal), num `Container` com o fade de hoje. Enquanto o assado não chega, o desenho antigo (faces com véu) serve de prévia; ele sai quando chega o novo.
2. Luz dos telhados: a camada de cor é renderizada numa textura, e um filtro (ou passada própria, com o padrão de `passadas.ts`) calcula `albedo × (ambiente + sol × max(0, N·L) + luzExterna) × exposição`, com a mesma curva de tom. `luzExterna` vem de um alvo de luz a `RES_LUZ` só com as luzes **fora** de cômodos cobertos (a `mascaraInterior` diz quais), e as luzes `estrutura.*` altas contam como externas.
3. A sombra do telhado no chão usa a silhueta real (alfa do assado), deslocada pela altura da cumeeira do trecho (`h` máximo do campo) e não por constantes.
4. A interface `Telhados` (`visivel`, `chavesEmUso`, `diagnostico`, alvo, chave da sessão) não muda. A vista de telhados do assistente (B1) continua funcionando.
5. Apagar o véu e as cumeeiras em `Graphics` quando o assado estiver pronto.
Não fazer: fachada (N7); mudar o fade.
Testes: e2e ao meio-dia, as águas opostas de uma casa 4 × 3 diferem em mais de 10% de brilho (teste atual); à noite, um telhado longe de luz fica mais escuro que ao meio-dia, e um lampião na rua ao lado clareia a borda do telhado próxima; uma lamparina dentro da casa **não** clareia o telhado; o fade por edifício continua.
Pronto quando: o porto à noite mostra os telhados iluminados só pelos lampiões, e o entreposto de dia tem telhados com relevo, no mesmo tom do chão.
Nota: `MapaDeLuz` expõe `luzExterna` (`ehLuzExterna` exclui `janela:*`/`janela-fora:*` e luzes dentro de cômodos cobertos, mantendo luzes de rua e `estrutura.*`, com recorte só de cone sem paredes internas) renderizada em `brutaExtRT` → blur gaussiano → `luzExternaRT`. `Telhados` pede `{ tipo: 'telhado' }` (prioridade 2) usando o desenho vetorial apenas como prévia temporária, projeta sombra real pela silhueta de `texCor` deslocada pela `alturaMaxima` de `campoDoEdificio` e executa a passada GPU em Ilustrado (albedo + normal/AO + `luzExterna` + sol/lua + curva ACES com `finish.exposure`, custo zero quando nenhum telhado está visível), mantendo tinta por clima no Pixel. Validação visual comparativa em `test-results/n6-luz.png` (`porto-noturno` à noite + casa diurna às 14h30).
Commit: `roofs are lit by the scene lights with relief and tone curve`

### N7 — Fachada sob o beiral  ✅
Objetivo: a casa fechada mostra a parede da frente com porta e janelas, como nos mapas de O Segredo na Ilha.
Depende de: N6.
Ler: `src/procedural/faces-de-parede.ts` (como a face de parede é pintada), `src/domain/mapa.ts` (`Parede`, `Abertura`, `wallFace`), `src/render/cena.ts` (camada de peças), `docs/referencias/segredo-na-ilha-mansao.png` e `telhados/`.
Arquivos: mudar `assar-telhado.ts` (ou criar `fachada.ts` em `src/procedural/`), `telhados.ts` e `cena.ts`; e2e em `tests/e2e/telhados.test.ts`.
Como:
1. Para cada aresta de beiral do edifício voltada para +y (a normal da água aponta para baixo na tela), uma faixa de `ALTURA_DA_FACHADA = 0.9` m abaixo dela, com a largura da parede: material de fora da parede (`wallFace` ou o da parede), rodapé escuro, sombra do beiral no alto da faixa.
2. As aberturas daquela parede viram desenho na faixa: porta (folha de madeira com moldura), janela (vidro escuro com caixilho e peitoril), na posição da abertura.
3. A fachada é assada junto com o telhado, mas devolvida como **segundo bitmap** (`fachada`), e desenhada numa camada logo abaixo de `pecasC`, iluminada pelo mesmo cálculo do N6. Ela some com o fade do edifício.
4. `style.facades === false` desliga.
Não fazer: fachadas laterais; perspectiva além da faixa.
Testes: e2e, casa com porta na parede de baixo: com o telhado fechado, a faixa abaixo do beiral não tem a cor do chão; com `facades: false`, tem; uma peça na rua, logo abaixo da casa, aparece por cima da fachada.
Pronto quando: a delegacia refeita (N10) tem a porta e as janelas à vista com o telhado fechado.
Nota: `src/procedural/fachada.ts` exporta `ALTURA_DA_FACHADA = 0.9` e `assarFachada`, gerando o segundo bitmap `fachada` (mesma origem/resolução do telhado com altura expandida em baixo) para arestas externas frontais (`ny > 0.35`), com material externo resolvido em `entradaDoTelhado` (`wallFace` da sala adjacente → material da parede ≠ `'parede.topo'` → `'parede.tabuas'` em construções rústicas → `'parede.reboco'`), sombra sob o beiral, rodapé escuro, sombra de contato no chão e desenho de `door`, `window` e `arch` (com suporte a Ilustrado e Pixel). `Telhados` expõe `fachadaRaiz` inserida em `cena.ts` imediatamente antes de `pecasC`, acompanha o fade por edifício, atualiza ao mudar `walls`/`openings`, e no Ilustrado ilumina a fachada na GPU usando o mesmo `GlProgram`/uniformes do N6 com normal fixa `[0, 0.82, 0.57]` e `ao = 1.0` (custo zero sem fachadas visíveis). Validação visual comparativa em `test-results/n7-fachada.png`.
Commit: `closed houses show their front facade under the eave`

### N8a — Coberturas de todas as eras  ✅
Objetivo: cobrir de choupana a galpão industrial.
Depende de: N3.
Ler: `src/procedural/coberturas.ts`, `src/procedural/materiais.ts` (materiais `telha.*`), `docs/LICENCAS.md` (tudo procedural).
Arquivos: mudar `coberturas.ts` e `materiais.ts`; testes em `tests/unit/coberturas.test.ts`.
Como: padrões e materiais novos (`uso: 'telhado'`), cada um com capa de cumeeira própria:
- `tabuas-telhado` → `telha.tabuas` (tábuas na queda com mata-junta: a cabana da referência);
- `telha-francesa` → `telha.francesa` (Marselha, encaixe em losango);
- `telha-esmaltada` → `telha.esmaltada.verde`, `.azul` e `.amarela` (oriental, canal com capas redondas e brilho);
- `chapa-com-junta` → `telha.chapa.verde`, `.vermelha` e `.cinza` (metal com juntas em pé);
- `fibrocimento` → `telha.fibrocimento` (onda larga, cinza manchado);
- `bambu` → `telha.bambu` (meias-canas alternadas);
- `couro` → `telha.couro` (peles costuradas, para tenda e iurta);
- `chumbo` → `telha.chumbo` (placas com rolos, catedral).
Não fazer: os transparentes e nobres (N8b).
Testes: os do T5b/N3 para cada material novo.
Pronto quando: a prancha mostra os materiais novos distintos entre si, e o usuário aprova.
Nota: O padrão de `telha.couro` foi nomeado `'couro-telhado'` em `PADROES_DE_COBERTURA` para não colidir com o padrão `'couro'` já existente em `Padrao` (`couro.marrom`, objeto), seguindo a mesma convenção de `'tabuas-telhado'`, `'grama-telhado'` e `'lajes-telhado'`. Exportado também `CAPAS_DE_CUMEEIRA`, `CAPA_DA_COBERTURA` e `capaDaCobertura` em `src/procedural/coberturas.ts` para uso da N4. Prancha de validação visual (12 coberturas novas sombreadas por sol fixo + mapa `h`) em `test-results/n8a-eras.png`.
Commit: `added roof coverings for every era`

### N8b — Coberturas nobres e transparentes  ✅
Objetivo: palácio de mármore, cúpula dourada, estufa e vitral.
Depende de: N6, N8a.
Ler: `assar-telhado.ts`, `telhados.ts` (luz do N6), `src/render/mascara-de-comodos.ts` e `nevoa.ts` (o que o jogador vê embaixo).
Arquivos: mudar `coberturas.ts`, `materiais.ts`, `assar-telhado.ts` e `telhados.ts`; e2e em `tests/e2e/telhados.test.ts`.
Como:
1. `marmore` → `telha.marmore` (lajes lavradas com veios e frisos; branco, rosado e negro); `ouro` → `telha.ouro` (folha com escamas e brilho especular forte no N6); a capa de cumeeira em pedra lavrada.
2. `vidro` → `telha.vidro` (caixilho de ferro e vidro) e `vitral` → `telha.vitral` (chumbo e vidros coloridos): o assado põe alfa ≈ 0,35 no vidro e 1 no caixilho. Na luz do N6, o vidro ganha reflexo do céu (especular pelo N·L), e o que está embaixo aparece **já com a névoa** (a camada de telhados fica acima da névoa, então o jogador não vê através do vidro o que não explorou).
3. Material com `especular?: number` (0–1), lido pelo N6.
Não fazer: refração.
Testes: e2e, a estufa de vidro deixa ver o piso (o brilho embaixo muda quando o piso muda). O vitral tingir a luz no chão fica como pendência.
Pronto quando: um palácio com cúpula dourada e uma estufa ficam convincentes na prancha.
Nota: Para evitar colisão com `'marmore'` e `'vidro'` já existentes em `Padrao`, os 4 novos padrões foram registrados em `PADROES_DE_COBERTURA` como `'marmore-telhado'` (`pedra`), `'ouro-telhado'` (`pedra`), `'vidro-telhado'` (`chapa-dobrada`) e `'vitral-telhado'` (`chumbo`), com 6 materiais novos (`telha.marmore`, `.rosado`, `.negro`, `telha.ouro`, `telha.vidro`, `telha.vitral`) e `Material.especular` (também aplicado em `telha.esmaltada.*` e `telha.cobre`). `AmostraDeCobertura` ganhou `alfa`, `especular` e `cor` opcionais; `assarTelhado` escreve opacidade real em `cor.a` mantendo `normal.a = 255` (para recuperar `opac = c.a / n.a` na GPU) e só gera `Assado.altura` (mapa especular) quando algum trecho do edifício tem `especular > 0` (custo zero nos foscos). Em `telhados.ts`, o shader Blinn-Phong aplica brilho metálico/dielétrico e reflexo suave do céu nos vidros translúcidos preservando a transparência sobre o piso e a névoa. Prancha visual validada em `test-results/n8b-nobres.png`.
Commit: `added marble, gold, glass and stained glass roofs`

### N9 — Estilos, estado do telhado no Inspetor e ponte  ✅
Objetivo: o mestre escolhe "Palácio", "Pagode" ou "Estufa" e o estado "Abandonado" em dois cliques; o assistente faz o mesmo pelo MCP.
Depende de: N1, N5, N8a, N8b.
Ler: `src/domain/presets.ts` (`ESTILOS_DE_TELHADO`, `telhadoPadrao`), `src/ui/Inspetor.tsx` (seção Telhado), `src/app/ponte-escrita.ts` e `ponte-leitura.ts` (`atlas_comodos`, `atlas_catalogo`, `atlas_edificio`), `docs/assistente/guia/ferramentas-atlas.md`.
Arquivos: mudar `presets.ts`, `Inspetor.tsx`, `ponte-escrita.ts`, `ponte-leitura.ts`, o guia; testes em `tests/unit/presets.test.ts` e `tests/unit/ponte-escrita.test.ts`.
Como:
1. Estilos novos: Cabana de tábuas (`telha.tabuas`, duas águas), Casa colonial (`telha.barro`, quatro águas), Casa francesa (`telha.francesa`, quatro águas), Celeiro holandês (`telha.tabuinhas`, holandês), Sobrado de mansarda (`telha.ardosia`, mansarda), Puxado (`telha.zinco`, uma água), Galpão industrial (`telha.fibrocimento`, uma água), Pagode (`telha.esmaltada.verde`, pagode), Templo oriental (`telha.esmaltada.amarela`, quatro águas, íngreme), Palácio de mármore (`telha.marmore`, quatro águas), Cúpula dourada (`telha.ouro`, cúpula), Igreja ortodoxa (`telha.ouro`, bulbo, cruz), Catedral (`telha.chumbo`, duas águas íngreme, cruz), Observatório (`telha.chapa.cinza`, cúpula), Estufa (`telha.vidro`, duas águas), Capela de vitral (`telha.vitral`, duas águas íngreme), Iurta (`telha.couro`, cone), Casa de bambu (`telha.bambu`, duas águas), Galpão abobadado (`telha.chapa.cinza`, abóbada). "Casa velha" passa a ser barro + `wear` de casa velha.
2. `ESTADOS_DE_TELHADO`: Novo, Gasto, Velho, Abandonado e Em ruínas, cada um um `wear` (por exemplo, Abandonado = musgo 0,7, sujeira 0,6, dano 0,45). Neve: "Do clima", "Sem neve", "Coberto".
3. Inspetor: abaixo da grade de estilos, uma fileira com o estado e a neve; em "Ajustar", os quatro controles deslizantes do `wear`.
4. Ponte: `atlas_comodos` aceita `telhadoEstado` (id do estado) e `telhadoDesgaste` (objeto parcial); `atlas_catalogo { parte: 'telhado' }` lista estilos, coberturas, formas e estados. Descrições dentro do limite do PM4b. O guia ganha a tabela por era.
Não fazer: estado gravado como id (o documento guarda só o `wear`).
Testes: todo estilo e todo estado passam na validação; a ponte aceita estado e desgaste e recusa id desconhecido.
Pronto quando: no Inspetor, "Delegacia" vira telha velha com musgo em dois cliques.
Nota: `ESTILOS_DE_TELHADO` passou de 14 para 33 estilos (incluindo `casa-velha` convertida para `telha.barro` + `wear` e `clonarTelhado` preservando `wear`/`seed`), com `ESTADOS_DE_TELHADO` (`novo`, `gasto`, `velho`, `abandonado`, `em-ruinas`). `Inspetor.tsx` ganhou seletor de todas as 12 `FORMAS_DE_TELHADO`, fileiras compactas de Estado e Neve, 4 controles deslizantes de `wear` em "Ajustar", e `miniatura.ts` trata `cupula`/`bulbo` como circulares. `construcao.ts` e `ponte-escrita.ts` (`atlas_comodos`) aceitam as 12 formas, `telhadoEstado` e `telhadoDesgaste` (gravando só `roof.wear`), `ponte-leitura.ts` (`atlas_catalogo { parte: 'telhado' }`) expõe `estados`, e `catalogo-base.json` foi regenerado mantendo as ferramentas do Atlas em 29.935 bytes (< 30.000).
Commit: `added roof styles for every era and roof condition presets`

### N10 — Prancha, exemplos e guia  ✅
Objetivo: provar o resultado contra as referências e deixar o assistente usá-lo bem.
Depende de: N9.
Ler: `docs/referencias/telhados/`, `scripts/exemplos/gerar.ts`, `docs/assistente/guia/`.
Arquivos: script de prancha `scripts/dev/prancha-telhados.ts`; um exemplo novo (vila com as três casas das referências: cabana de tábuas, casa de tabuinhas e delegacia em L com puxado); ajustes nos exemplos existentes (porto, entreposto e aldeia ganham estado e fachadas); o guia.
Como:
1. A prancha renderiza todos os estilos × (novo, abandonado, nevado) × (meio-dia, noite com lampião) e salva em `docs/referencias/telhados/atlas-N10.png`.
2. Comparar lado a lado com as referências; o que ficar aquém por motor, dizer ao usuário antes de outra rodada.
3. Medir com a M1 a carga do exemplo novo e do entreposto (o telhado não pode somar mais de 0,5 s com a M5 ligada).
Pronto quando: o usuário aprova a prancha e o exemplo.
Nota: Criado o exemplo vitrine `vila-dos-telhados` (`scripts/exemplos/vila-dos-telhados.ts`, `miniatura: 'telhados'`, 0 achados em `revisarMapa`), enriquecido `porto-noturno` com variedade de formas/desgaste (`wear`) e fachadas frontais (`style.facades: true`, portas/janelas voltadas para `+y`), atualizados os guias (`docs/assistente/guia/lugares.md` e `projetar.md`) e gerada a prancha `docs/referencias/telhados/atlas-N10.png` via `scripts/dev/prancha-telhados.ts`. **Comparação visual com as referências:** (1) *Cabana de tábuas* (`cabana-de-tabuas.png`): fiéis as tábuas com mata-junta, cumeeira, buracos/ripas aparentes, manchas/remendos e fachada frontal (+y) com porta e janela; limite do motor: projeção ortogonal estrita sem perspectiva inclinada do oitão e dano procedural em buracos mais regulares que arranhões pintados à mão. (2) *Delegacia em L* (`delegacia-de-telha-com-musgo.png`): fiéis o encontro limpo com puxado lateral mais baixo em `uma-agua`, fios de musgo na queda, variação peça a peça do barro e fachada com porta + duas janelas; limite do motor: musgo procedural mais concentrado nos encontros/norte e mais suave no centro das águas. (3) *Casa de tabuinhas* (`casa-de-tabuinhas.png`): fiéis as tabuinhas desencontradas, desgaste/remendos, chaminé com sombra/fuligem e fachada frontal; limite do motor: capa de cumeeira acompanha o material (`tabua` em vez de telha-canal contrastante) e bordas das tabuinhas são mais regulares. Na grade 33 estilos × 3 estados × 2 luzes, todos os 33 estilos se distinguem com clareza, os lampiões aquecem fachadas e águas próximas à noite, e a neve respeita águas íngremes e derrete ao redor das chaminés. **Medição M1 + M5 (`npm run medir:carga` e cache persistente M5 em IndexedDB):** frio (`medir:carga`): `porto-noturno` editor `1,29 s` / pronto `12,16 s` (6 telhados, soma paralela nos workers `18,85 s`, maior `5,89 s`), `vila-dos-telhados` editor `0,89 s` / pronto `8,40 s` (3 telhados, soma paralela `6,88 s`, maior `3,10 s`); com cache M5 aquecido (`?cache=1`): `porto-noturno` editor `1,51 s` / pronto `1,55 s` (`+0,04 s`, `0` assados, `0 ms` de telhados) e `vila-dos-telhados` editor `1,18 s` / pronto `1,19 s` (`+0,01 s`, `0` assados, `0 ms` de telhados), cumprindo com folga o teto de `<= 0,5 s`.
Commit: `added roof showcase example and refreshed examples`

## Pendências conhecidas (fora deste plano)

- Vitral tingindo a luz no chão do interior.
- Fachadas laterais e de fundo (só a da frente, +y).
- Telhado em casas giradas fora da grade (continua via objeto da coleção).
- Calhas, rufos e para-raios como detalhes.
- Pixel com desenho próprio de desgaste (Pixel em espera).
