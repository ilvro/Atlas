# M — Carregamento rápido

## Diagnóstico (2026-11-19)

Medido com Playwright (Chromium com GPU, 16 núcleos), da hora do clique em "Usar este exemplo" até o `viewport.pintando` chegar a zero:

| Exemplo | Editor aberto | Mapa pronto | Pedidos de assado (pico) |
| --- | --- | --- | --- |
| Clareira | 1,1 s | 2,0 s | 13 |
| Entreposto do rio | 1,1 s | **12,5 s** | 252 |
| Mansão da ilha | 1,1 s | **11,6 s** | 243 |

Quase todo o tempo cai nos workers de assado. A página fica quase livre: só 0,6 s de tarefas longas no total. Tempo de cada assado, medido dentro do worker:

| Entreposto | n | soma | maior |
| --- | --- | --- | --- |
| terreno | 1 | 8,5 s | 8,5 s (1856 × 1152 px, 32 px/m) |
| objetos | 108 | 2,8 s | 0,49 s |
| cômodos | 6 | 1,7 s | 0,52 s |
| imagens | 7 | ? | ficam presas na fila atrás do terreno |

| Mansão | n | soma | maior |
| --- | --- | --- | --- |
| terreno | 1 | 5,0 s | 5,0 s (1 camada só) |
| cômodos | 9 | 6,3 s | 2,2 s (916 × 916 px, 64 px/m) |
| objetos | 105 | 1,9 s | 0,24 s |

Causas, em ordem de peso:

1. **O terreno é um assado único e enorme.** Para cada camada, `assarTerreno` (`src/procedural/assar.ts:339`) pinta o material **no mapa inteiro** e só depois recorta pela máscara. Também roda `fbm` por pixel no mapa todo e o `alturaPorLuminancia` (passa-alta com média móvel) na tela inteira. No Entreposto, com 6 camadas, isso vira seis passadas sobre 2,1 milhões de pixels. Além disso, qualquer pincelada no terreno reassa tudo, então o problema também pesa durante a edição.
2. **`pintarMaterial` pinta uma área 2,2 vezes maior que a pedida.** Ela amplia a área para um quadrado com lado igual à diagonal, para poder girar (`materiais.ts:203`), mesmo quando `dir` é 0. Num mapa de 58 × 36 m, pinta 68 × 68 m.
3. **Ruído por pixel.** No perfil, `fbm`, `hash2D` e `valueNoise2D` somam de 50% a 60% do tempo do terreno e dos cômodos. Os pintores por pixel (`porPixel`, `materiais.ts:367`) chamam de 4 a 6 `fbm` por pixel, quase todos de baixa frequência (de 0,3 a 1,3 ciclo por metro), calculados em resolução cheia.
4. **Só dois workers, e a fila é empurrada.** `criarBaker()` usa `workers ?? 2` (`baker.ts:19`) numa máquina de 16 núcleos. O pedido vai para o worker com menos pedidos **na fila**, não para o que está livre. Assim, metade dos 250 pedidos fica atrás do terreno de 8,5 s, e o mapa leva 12,5 s em vez de 8,5 s.
5. **Nada sobrevive a recarregar a página.** O cache do baker é um `Map` em memória. Reabrir o mesmo mapa, ou o mesmo mapa depois de um F5, assa tudo de novo, embora a chave (`chaveDoTerreno`, `chaveDoComodo`, `chaveDoObjeto`) já descreva o assado por inteiro.
6. **Não há primeira imagem.** O chão só aparece quando o assado em resolução cheia fica pronto.

## Decisões

- **Nenhuma mudança visual.** As tarefas M3 e M4 devem dar o mesmo resultado, pixel a pixel, dentro de uma tolerância (teste de comparação). A M6 pode mudar o ruído por interpolação, mas só com comparação lado a lado aprovada.
- **O terreno passa a ser feito de ladrilhos** de 16 × 16 m, cada um um assado com margem. Isso vale para carregar (em paralelo) e para editar (só os ladrilhos tocados são reassados).
- **Cache persistente por chave e versão dos pintores.** A versão sai de um hash do código de `src/procedural/` gerado no build, então mudar um pintor invalida o cache sozinho. No `npm run dev`, o cache fica desligado (os pintores mudam sem recompilar), a não ser com `?cache=1`.
- Meta: Entreposto e Mansão prontos em **menos de 3 s** na primeira abertura e em **menos de 1 s** ao reabrir; chão visível (em baixa resolução) em **menos de 1,5 s**.

## Tarefas

| # | Tarefa | Quem |
| --- | --- | --- |
| M1 | Medidor de carregamento | Sonnet |
| M2 | Fila puxada, mais workers e prioridade | Sonnet |
| M3 | Terreno: cada camada só na caixa dela; `pintarMaterial` sem quadrado inútil | Opus |
| M4 | Terreno em ladrilhos | Opus |
| M5 | Cache persistente de assados (IndexedDB) | Sonnet |
| M6 | Ruído de baixa frequência numa grade reduzida | Opus |
| M7 | Primeira imagem em baixa resolução | Sonnet |

Ordem: M1 → M2 → M3 → M4; M5 e M7 depois de M2, em qualquer ordem; M6 por último (é a única que pode mudar a imagem).

---

### M1 — Medidor de carregamento  ✅
Objetivo: um comando que mede o tempo de abrir um exemplo e o custo de cada tipo de assado, para comparar antes e depois de cada tarefa.
Depende de: —.
Ler: `tests/e2e/apoio.ts` (`iniciarAmbiente`, `abrir`, `esperarEditor`), `src/procedural/bake.worker.ts`, `src/render/viewport.ts` (`pintando`).
Arquivos: criar `scripts/dev/medir-carga.ts`; mudar `src/procedural/bake.worker.ts` e `package.json` (script `medir:carga`).
Como:
1. `node scripts/dev/medir-carga.ts entreposto-do-rio mansao-da-ilha …`: para cada exemplo, abre um contexto novo, clica em `usar-<id>`, mede o tempo até o editor e até `__atlas.viewport().pintando === 0` (`polling: 50`), e soma as tarefas longas da página (`PerformanceObserver` do tipo `longtask`).
2. O worker passa a medir cada assado (`performance.now()` em volta de `executarBake`) e devolve `ms` junto com o resultado. O baker guarda, só quando `globalThis.__atlasMedirAssados` é verdadeiro, uma lista `{ tipo, ms, px }`, que o medidor lê pela página. Não usar `console.log`, porque o Playwright duplica as mensagens do worker.
3. Saída: uma linha por exemplo e uma tabela por tipo (n, soma, maior).
Não fazer: otimizar nada.
Testes: rodar o medidor nos dois exemplos e colar a tabela na nota da ficha (a base de comparação).
Pronto quando: `npm run medir:carga -- entreposto-do-rio` imprime a tabela.
Commit: `added a load time probe for example maps`
Nota: medição base (`npm run medir:carga -- entreposto-do-rio mansao-da-ilha`):
```
entreposto-do-rio: editor 1.76 s | pronto 12.52 s | longtasks 1430 ms (5) | assados 123
  tipo                  n    soma (ms)   maior (ms)  maior (Mpx)
  imagem                7      33759.3       8380.8         0.54
  terreno               1       8356.3       8356.3         2.14
  objeto              108       2112.0        386.6         0.38
  comodo                6       1459.5        463.3         0.91
  cobertura             1         82.3         82.3         0.03

mansao-da-ilha: editor 1.03 s | pronto 10.08 s | longtasks 588 ms (3) | assados 119
  tipo                  n    soma (ms)   maior (ms)  maior (Mpx)
  imagem                4       8965.7       4210.9         0.03
  comodo                9       6226.3       2253.0         0.84
  terreno               1       4047.7       4047.7         1.17
  objeto              105       1507.4        209.5         0.41
```

### M2 — Fila puxada, mais workers e prioridade  ✅
Objetivo: nenhum worker fica parado enquanto há trabalho, e um assado longo não segura os curtos atrás dele.
Depende de: M1.
Ler: `src/procedural/baker.ts` inteiro, `src/render/cena.ts` (onde `pintar` pede terreno, cômodo e objeto), `src/ui/previa.ts`.
Arquivos: mudar `baker.ts` e `cena.ts`; criar `tests/unit/baker-fila.test.ts`.
Como:
1. `n = clamp(hardwareConcurrency − 1, 2, 6)`.
2. A fila fica no baker: `pedir` empilha o pedido e um worker **livre** pega o próximo. Cada worker tem no máximo 1 pedido em execução.
3. `pedir(chave, pedido, prioridade = 1)`: terreno, cômodo e escarpa recebem 0 (o chão primeiro); objetos e imagens, 1; coberturas e detalhes de telhado, 2. Na mesma prioridade, vale a ordem de chegada.
4. Separar a lógica da fila (pura, sem `Worker`) para testá-la com executores falsos.
Não fazer: mudar o que cada assado faz.
Testes: com 2 executores falsos, um pedido de 100 ms e quatro de 10 ms, os quatro curtos terminam antes do longo; a prioridade 0 passa na frente da 1; chaves iguais compartilham o mesmo trabalho (comportamento atual).
Pronto quando: o medidor mostra o Entreposto pronto em ~8,5 s (o terreno virou o limite).
Commit: `bake queue now feeds idle workers first, with priorities`
Nota: medição no worktree (`npm run medir:carga -- entreposto-do-rio mansao-da-ilha`, 6 workers, com outros agentes rodando em paralelo no host; o terreno segue sendo o limite do Entreposto: `editor 1,28 s` + debounce de `140 ms` + `terreno 8,74 s` = `10,93 s`, enquanto objetos/imagens/cômodos terminam antes nos demais workers; Mansão caiu de `10,08 s` para `6,91–7,40 s`; os 5 erros 403 são apenas do symlink `node_modules` fora do root do Vite no worktree):
```
entreposto-do-rio: editor 1.28 s | pronto 10.93 s | longtasks 842 ms (4) | assados 123
  tipo                  n    soma (ms)   maior (ms)  maior (Mpx)
  terreno               1       8743.9       8743.9         2.14
  objeto              108       3838.6        566.7         0.38
  comodo                6       3511.4        901.3         0.91
  imagem                7        158.0         35.7         0.54
  cobertura             1         98.2         98.2         0.03

mansao-da-ilha: editor 1.04 s | pronto 6.91 s | longtasks 489 ms (2) | assados 119
  tipo                  n    soma (ms)   maior (ms)  maior (Mpx)
  comodo                9       9615.0       2595.6         0.84
  terreno               1       4058.9       4058.9         1.17
  objeto              105       2669.5        381.2         0.41
  imagem                4         36.3          9.7         0.03
```

### M3 — Cada camada do terreno só na caixa dela  ⬜
Objetivo: o custo de uma camada passa a ser proporcional à área dela, não à do mapa.
Depende de: M1.
Ler: `src/procedural/assar.ts:339-460` (`assarTerreno`), `mascaraSuavizada`, `src/procedural/materiais.ts:198-210` (`pintarMaterial`, área girada) e `:367` (`porPixel`), `src/procedural/altura.ts` (`alturaPorLuminancia`, `RAIO_PASSA_ALTA`).
Arquivos: mudar `assar.ts` e `materiais.ts`; criar `tests/unit/terreno-caixa.test.ts` (ou e2e de comparação, se o assado precisar de `OffscreenCanvas`).
Como:
1. Para cada camada: a caixa das células em pixels, mais uma margem de `max(alcance do ruído de borda, RAIO_PASSA_ALTA, raio do aro) + 1 m`, cortada no mapa. Corpo, aro, tela pintada, altura e `comAlfa` passam a ser alocados no tamanho da caixa e desenhados em `(x0, y0)`.
2. O material é pintado com `area = caixa` (em metros). O ruído usa coordenadas do mundo, então o resultado é o mesmo. Água e maciço precisam de distância à margem: a caixa deles ganha mais `PROFUNDIDADE_MAXIMA` de margem.
3. Em `pintarMaterial`, a área só vira o quadrado da diagonal quando `dir ≠ 0`. Exceção: os padrões montados por layout (`tabuas` e outros que sorteiam a partir de `A.x`) continuam com `A`, para o desenho não mudar. Listar na nota quais ficaram.
Não fazer: ladrilhos (M4); mexer no ruído.
Testes: o terreno do Entreposto assado antes e depois difere em no máximo 1/255 por canal em 99,9% dos pixels (salvar a referência no teste a partir do código antigo, ou comparar contra um PNG gerado antes da mudança).
Pronto quando: o medidor mostra o terreno do Entreposto pelo menos 2 vezes mais rápido, sem diferença visível.
Commit: `terrain layers are painted only inside their own bounds`

### M4 — Terreno em ladrilhos  ⬜
Objetivo: o terreno é assado em pedaços paralelos, e uma pincelada reassa só os pedaços tocados.
Depende de: M2, M3.
Ler: `src/render/cena.ts:175-200` (terreno: chave, `pintar`, água, `cenaDeAltura.definirTerreno`), `src/render/entradas.ts` (`entradaDoTerreno`, `chaveDoTerreno`), `src/render/cena-de-altura.ts`, `src/render/agua.ts` (`aplicar`), `assarTerreno` depois da M3.
Arquivos: mudar `entradas.ts`, `cena.ts`, `assar.ts`, `cena-de-altura.ts`, `agua.ts`; testes em `tests/unit/entradas.test.ts` e um e2e de emenda.
Como:
1. `LADO_DO_LADRILHO = 16` m. `ladrilhosDoTerreno(e): { i, j, caixa, entrada }[]`: a entrada de cada ladrilho só leva as células das camadas que tocam a caixa mais a margem (a da M3). A chave do ladrilho é a dessa entrada recortada, então pintar longe dele não muda a chave.
2. `assarTerreno` ganha `recorte: { x, y, w, h }` (m) e assa a caixa com margem, mas devolve só o recorte. O relevo (`comporMascaraDeRelevo`) e o assentamento também recebem o recorte.
3. Na cena, um `Sprite` por ladrilho (cor) e um por ladrilho na cena de altura. A água passa a ser composta por ladrilho, ou um atlas montado na página a partir dos pedaços: escolher o que exigir menos mudança em `agua.ts` e anotar.
4. Enquanto um ladrilho não chega, o antigo continua na tela (como hoje com o terreno inteiro).
Não fazer: mudar pintores.
Testes: unit, a chave de um ladrilho não muda quando se pinta uma célula a 20 m dele; e2e, captura do Entreposto com e sem ladrilhos difere em menos de 1% dos pixels, sem costura visível (compare uma faixa de 4 px em cada emenda).
Pronto quando: o Entreposto fica pronto em menos de 3 s, e pintar uma célula de grama reassa 1 ou 2 ladrilhos.
Commit: `terrain is baked in parallel tiles`

### M5 — Cache persistente de assados  ✅
Objetivo: reabrir um mapa (ou abrir outro com os mesmos objetos) não assa de novo o que já foi assado.
Depende de: M2.
Ler: `src/procedural/baker.ts`, `src/procedural/executar.ts` (`ResultadoDeBake`), `src/data/repositorio.ts` e `mesa-core/src/idb.ts` (como o app abre o IndexedDB), `vite.config.ts`.
Arquivos: criar `src/procedural/cache-de-assados.ts` e `tests/unit/cache-de-assados.test.ts`; mudar `baker.ts` e `vite.config.ts` (a declaração da constante vai num `.d.ts` novo em `src/`).
Como:
1. `vite.config.ts` calcula, ao iniciar, o SHA-1 do conteúdo de `src/procedural/**` e o expõe como `__VERSAO_DOS_PINTORES__` (`define`).
2. Banco `atlas-assados-v1`, store `assados`: chave `sha1(versao + '|' + chave)`, valor `{ cor: Blob, altura: Blob | null, agua: { blob, res } | null, origem, res, bytes, usadoEm }`. Blobs em PNG (`convertToBlob`), feitos **no worker** depois de entregar o resultado, sem atrasar a entrega.
3. `pedir` olha o cache persistente antes de mandar ao worker. Se achar, decodifica com `createImageBitmap(blob)`.
4. Limite de 400 MB: ao gravar, se passar, apaga os de `usadoEm` mais antigo. Os pedidos `sprite` e `imagem` com `pixelManual` ficam fora (já são baratos).
5. No `dev`, desligado, a não ser com `?cache=1`. Falha de IndexedDB (aba privada, cota) cai no comportamento atual, sem erro na tela.
Não fazer: guardar assados no documento ou no `public/`.
Testes: unit (com `fake-indexeddb`, que já é dependência): acerto, erro de versão, despejo por tamanho. E2e no `build` (ou com `?cache=1`): abrir o Entreposto, recarregar e medir.
Pronto quando: reabrir o Entreposto leva menos de 1,5 s.
Commit: `baked images persist across reloads in indexeddb`
Nota: implementado também `src/procedural/bake.worker.ts` (clonagem dos bitmaps antes da transferência via `postMessage` e gravação PNG assíncrona no worker) e `src/versao-pintores.d.ts`, com inicialização sob demanda dos workers em `baker.ts` e atualização em lote de `usadoEm` sem bloquear a entrega do cache. Medição em `tests/e2e/cache-assados.test.ts` (build de produção + `vite preview`, usando `porto-noturno` no lugar do `entreposto-do-rio` removido em `1883b38`): frio `13,64 s` (`103` assados) → reabertura `1,40 s` (editor `1,29 s` + pintura `0,11 s`, `0` cacheáveis reassados, `103` registros em `atlas-assados-v1`).

### M6 — Ruído de baixa frequência numa grade reduzida  ⬜
Objetivo: cortar o custo dos pintores por pixel sem mudar o desenho a olho.
Depende de: M3.
Ler: `src/procedural/ruido.ts` (`valueNoise2D`, `fbm`), `src/procedural/materiais.ts` (os pintores com `porPixel`; o perfil apontou o de `:680` e os de `:1006`, `:1268` e `:1516`), `assar.ts:367-376` (ruído de borda das camadas).
Arquivos: mudar `ruido.ts` e `materiais.ts`; testes em `tests/unit/ruido.test.ts`.
Como:
1. `campoDeRuido(ruido, area, freq, oitavas, passo): (x, y) => number`: amostra o `fbm` numa grade com `passo = 1 / (4 × freq)` m e interpola de forma bicúbica (ou bilinear, se a comparação passar). Vale para `freq × 2^(oitavas−1) ≤ 2` ciclos/m; acima disso, continua direto.
2. Trocar, pintor por pintor, as chamadas de baixa frequência pelo campo. Começar pelos que aparecem no perfil.
3. Medir com a M1 e anotar o ganho na ficha.
Não fazer: mudar frequências, cores ou sementes.
Testes: o campo difere do `fbm` direto em menos de 0,01 (máximo) numa área de teste; prancha com antes e depois dos materiais trocados, aprovada pelo usuário.
Pronto quando: o tempo do terreno e dos cômodos cai à metade, e o usuário não vê diferença na prancha.
Commit: `low frequency noise is sampled on a coarse grid`

### M7 — Primeira imagem em baixa resolução  ⬜
Objetivo: o chão aparece em menos de 1,5 s, ainda borrado, e ganha nitidez quando o assado cheio chega.
Depende de: M2.
Ler: `src/render/cena.ts` (`pintar`, terreno e cômodos), `src/render/entradas.ts` (`resolucaoDe`).
Arquivos: mudar `cena.ts`; e2e em `tests/e2e/carga.test.ts` (novo).
Como:
1. Na **primeira** pintura de um terreno (ou ladrilho) ou cômodo sem nada na tela, pedir antes o mesmo assado com `res / 4` e prioridade 0. O assado cheio vem em seguida, com prioridade 1.
2. Quando o cheio chega, troca. O prévio é descartado (`coletar`).
3. Edições depois da carga não usam a prévia (o antigo continua na tela, como hoje).
4. Não vale para o Pixel (a resolução lá é a da grade).
Não fazer: prévia de objetos.
Testes: e2e, 1,5 s depois de abrir o Entreposto, o centro do mapa não está vazio (brilho diferente do fundo); quando `pintando` chega a 0, a textura do terreno tem a resolução cheia.
Pronto quando: abrir a Mansão mostra o chão quase de imediato.
Commit: `ground shows a low resolution preview while baking`
