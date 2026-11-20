# Frente P — Terreno com textura e carimbos de chão

Planejada em 2026-11-20. As fichas de infraestrutura (P2, P3, P4, P6) são do Sonnet, uma por subagente. As visuais (P1, P5, P7, P8) são do Opus, que implementa direto.

## Problema

No mapa `acampamento-na-nevoa`, o chão continua longe da referência do Inkarnate, mesmo depois de cinco rodadas no pintor procedural. Comparando na mesma escala (~32 px/m):

- **Na referência**, cada pixel do chão tem alguma coisa: lâmina de capim, folhinha, terra, pedrisco. A variação é natural e não se repete. Por cima ficam os carimbos: tronco caído, raízes e moitas.
- **No Atlas**, o chão é uma base lisa com detalhes esparsos (folha, seixo, tufo) que vêm de fórmulas. Cada tipo de detalhe a mais melhora um pouco, mas o resultado continua com cara vetorial. Esse caminho não converge, porque a distância é do motor.

## Como o Inkarnate faz

- **Pincel de textura.** O pincel desenha só uma máscara (dureza, opacidade, borda irregular), e a máscara revela uma textura de imagem em ladrilho ("Forest Floor", "Dirt", "Moss"). Traços sobrepostos misturam as texturas.
- **Carimbos.** Capim, samambaia, pedra, raiz e tronco, postos um a um ou espalhados com área e densidade.

## Como isso vira Atlas

| Inkarnate | Atlas |
| --- | --- |
| Pincel com máscara | **Já existe:** camadas de terreno pintadas por célula, com borda suavizada e `franja` |
| Textura revelada pelo pincel | **Novo:** o material de terreno pode ter `textura` (receita de camadas de imagem), em vez da fórmula do `padrao` |
| Textura sem repetição visível | **Novo:** amostragem dupla com giro e deslocamento, misturada por ruído largo, e variação de tom em escala de metros |
| Catálogo de texturas | Os mesmos ids de material, agrupados pela O2 da [Frente O](biblioteca-por-familias.md) |
| Carimbos | **Novo:** receitas de chão desenhadas (tronco caído, raízes, moita de samambaia, tufo de capim, galhada, folhiço) |
| Pincel de carimbo com área e densidade | A O9 da [Frente O](biblioteca-por-familias.md); para a automação e o assistente, os conjuntos de `espalhar.ts` |

## Decisões

1. **Os ids de material não mudam.** `chao.de.mata`, `chao.batido`, `terra` e os demais ganham `textura`, e todo mapa que já os usa melhora sem migração. Material novo só entra quando não houver equivalente (ex.: `musgo`).
2. **O `padrao` procedural continua existindo.** Ele é a reserva quando a textura não carrega, e é o que o estilo Pixel usa. O Pixel não usa textura nesta frente (ver a memória "Pixel em espera").
3. **Só texturas CC0**, de fontes que permitem redistribuir (Poly Haven, ambientCG). Os arquivos ficam em `public/colecao/texturas/` e entram no `docs/LICENCAS.md`, como a coleção. Os originais baixados ficam em `data-private/texturas-fonte/`, fora do git.
4. **A textura é puxada para a paleta do material.** Um mapa de gradiente por luminância leva a textura para `escuro → base → claro`, com força `tingir` (0 a 1). Assim a direção de cor do Atlas continua mandando, e o clima (luz, acabamento) age por cima como hoje.
5. **Relevo da textura:** usa o mapa de deslocamento da fonte, com no máximo ~2 cm de amplitude, ou fica plano. **Nunca** usa a altura por luminância: com a luz HDR, ela vira escamas (ver a memória do acampamento). A Frente L lembra que o mapa de altura tem 8 bits, então só cabe micro-relevo pequeno e constante.
6. **O assado continua síncrono.** O executor carrega as texturas necessárias antes (`garantirTexturas`), no worker e na página, e o pintor só lê pixels já carregados. A chave do cache do terreno inclui a versão do catálogo de texturas.
7. **Resolução:** o terreno segue a 32 px/m. Os ladrilhos são guardados a 128 px/m (WebP), o que deixa margem para aumentar a resolução do terreno no futuro. A P5 mede se 32 px/m preserva a textura; se não preservar, propõe mudar `resolucao('terreno')` numa ficha à parte, por causa do custo (Frente M).

## Pontos de contato com a Frente O

- **O2 (terreno em grupos):** todo material novo desta frente (ex.: `musgo`) entra em `GRUPOS_DE_TERRENO`. Se a O2 ainda não tiver sido feita, ela deve incluí-lo. A amostra de 40 px da O2 passa a mostrar a textura (P6), e a O2 não deve criar outra amostra.
- **O1 (famílias):** cada carimbo da P7 entra numa família de `src/procedural/familias.ts`, porque o teste da O1 exige que todo item tenha uma. Proposta: `tronco-caido` em "Tronco e toco" (com `tora-assento`), `moita-de-samambaia` em "Folhagem", `tufo-de-capim` em "Capim e junco", e uma família nova "Folhiço e galhos" (`folhico`, `galhada`, `raizes`) no grupo `natureza`. Se a O1 ainda não existir, a P7 deixa essa tabela na própria ficha para a O1 aplicar.
- **O9 (pôr vários com área e densidade):** é o pincel de carimbo do usuário. Esta frente não cria outro.
- **O10 (famílias na automação):** o conjunto `mata-fechada` ganha os carimbos na P7. Quando a O10 chegar, eles passam a ser referidos por família, sem mudar os pesos.

## Lotes de material

- **Lote 1 (esta frente):** `chao.de.mata`, `chao.batido`, `terra`, `grama`, `grama.seca` e `musgo` (novo).
- **Lote 2 (frente futura, mesma infraestrutura):** `grama.escura`, `grama.acinzentada`, `lama`, `areia`, `areia.molhada`, `cascalho`, `pedregulho`, `neve`, `neve.funda`, `neve.pisada` e `terra.congelada`. Calçamentos, rocha rachada, maciço e água continuam procedurais: neles a fórmula já funciona e a forma importa mais que a textura.

---

### P1 — Curadoria das texturas (Opus)  ⬜
Objetivo: escolher, com aprovação do usuário, as texturas CC0 do lote 1.
Depende de: —.
Ler: `docs/LICENCAS.md` (regras); a referência `docs/referencias/exemplos/acampamento-na-nevoa.png`.
Arquivos: criar a seção "Curadoria" no fim deste arquivo; baixar os candidatos para `data-private/texturas-fonte/` (fora do git).
Como:
- Para cada material do lote 1, levantar de 2 a 3 candidatas no Poly Haven e no ambientCG (cor e deslocamento, 2K), anotando o tamanho real (m), o autor e o link.
- Montar a prancha `test-results/p1-texturas.png`: cada candidata reduzida a 32 px/m sobre 4 × 4 m, ao lado de um recorte da referência na mesma escala.
- Mostrar a prancha ao usuário. **Nada vai para `public/` sem aprovação.**
Pronto quando: a seção "Curadoria" lista a textura escolhida por material, com fonte, licença, autor e tamanho real.
Commit: `curated cc0 ground textures for the first terrain batch`

### P2 — Catálogo de texturas e preparo (Sonnet)  ⬜
Objetivo: as texturas aprovadas viram ladrilhos WebP com catálogo, licença e versão.
Depende de: P1.
Ler: `scripts/assar-colecao.ts` (estilo dos scripts e escrita no `LICENCAS.md`); `src/procedural/colecao.ts:1-40` (tipos do catálogo); `tests/unit/colecao.test.ts`.
Arquivos: criar `scripts/preparar-texturas.ts`, `src/procedural/texturas.ts` (tipos e validação puros), `public/colecao/texturas/texturas.json` e `tests/unit/texturas.test.ts`; mudar `docs/LICENCAS.md` e `package.json` (script `texturas`).
Como:
- `interface TexturaDoCatalogo { id: string; nome: string; arquivo: string; deslocamento?: string; metros: number; pxPorMetro: number; fonte: string; autor: string; licenca: 'CC0'; url: string }` e `interface CatalogoDeTexturas { versao: 1; hash: string; texturas: TexturaDoCatalogo[] }`. `validarCatalogo(c)` é pura.
- O script lê `data-private/texturas-fonte/<id>/` e a lista aprovada (copiada da Curadoria para `scripts/texturas-aprovadas.json`). Ele reduz cada textura para 128 px/m, conferindo que continua em ladrilho (o redimensionamento tem de fechar a borda). Grava `public/colecao/texturas/<id>.webp` (e `<id>-alt.webp` para o deslocamento, em tons de cinza). Escreve o catálogo com `hash` igual ao SHA-1 dos arquivos e acrescenta as linhas no `LICENCAS.md`. Use `sharp`, se já estiver nas dependências; senão, o Chromium do Playwright, como o `assar`.
- O teste de coleção passa a exigir que todo arquivo de `public/colecao/texturas/` esteja no `LICENCAS.md`.
Não fazer: carregar ou desenhar textura.
Testes: `validarCatalogo` recusa licença diferente de CC0, `metros <= 0` e id repetido; o catálogo real é válido; todo arquivo listado existe.
Pronto quando: `npm run texturas` gera os ladrilhos e o catálogo, e os testes passam.
Commit: `ground textures are prepared as tiles with catalog and licenses`

### P3 — Amostragem sem repetição e mapa de gradiente (Sonnet)  ⬜
Objetivo: as funções puras que leem uma textura em metros, escondem a repetição e puxam a cor para a paleta.
Depende de: —.
Ler: `src/procedural/ruido.ts` (`valueNoise2D`, `fbm`, `campoDeRuido`); `src/procedural/materiais.ts:380-435` (`porPixel`, `mez`, `rumo`).
Arquivos: criar `src/procedural/textura-de-terreno.ts` e `tests/unit/textura-de-terreno.test.ts`.
Como:
- `interface Pixels { dados: Uint8ClampedArray; largura: number; altura: number }` (RGBA).
- `amostrar(t: Pixels, u: number, v: number, o: number[])`: bilinear, com volta nas bordas, `u` e `v` em pixels.
- `amostrarSemRepeticao(t, pxPorMetro, x, y, ruido, o)`: duas leituras da mesma textura, uma direta e outra girada (~37°) e deslocada por um valor da semente, misturadas por `passo(0.35, 0.65, ruido(x / 3.5, y / 3.5))`. Depois aplica uma variação de brilho de ±8% em escala de ~6 m.
- `interface CamadaDeTextura { textura: string; escala?: number; mascara?: { freq: number; limiar: number; suave: number; semente: number } }` e `interface ReceitaDeTextura { camadas: CamadaDeTextura[]; tingir: number }`. A primeira camada cobre tudo; cada camada seguinte entra onde o ruído da máscara passa do limiar, com borda `suave`. É o "pincel" dentro do material: folhiço com manchas de musgo, por exemplo.
- `mapaDeGradiente(o, escuro, base, claro, forca)`: a luminância de `o` (0 a 1) escolhe a cor entre escuro → base → claro, e `forca` mistura o resultado com a cor original.
Não fazer: carregar arquivo nem ligar ao material.
Testes: `amostrar` volta nas bordas e interpola; uma textura de cor única sai igual por `amostrarSemRepeticao` (a menos da variação de brilho, que fica dentro de ±8%); a máscara com limiar 1 nunca entra; `mapaDeGradiente` com força 0 não muda a cor e com força 1 leva o preto ao `escuro` e o branco ao `claro`; tudo é determinístico.
Pronto quando: os testes passam.
Commit: `pure sampler hides texture tiling and maps tones to the palette`

### P4 — Texturas carregadas no assado (Sonnet)  ⬜
Objetivo: o worker e a página carregam as texturas que um terreno precisa antes de assar, e o cache sabe quando elas mudam.
Depende de: P2.
Ler: `src/procedural/executar.ts` (inteiro; `assarImagem` mostra o `fetch` com `createImageBitmap`); `src/procedural/bake.worker.ts`; `src/procedural/baker.ts:180-210`; `src/render/entradas.ts:433` (`chaveDoTerreno`); `src/procedural/assar.ts:427-445`.
Arquivos: criar `src/procedural/texturas-carregadas.ts`; mudar `src/procedural/executar.ts`, `src/render/entradas.ts` e `src/procedural/materiais.ts` (só o tipo `Material`).
Como:
- `Material` ganha `textura?: ReceitaDeTextura` (tipo da P3), sem mudar nenhum material ainda.
- Em `texturas-carregadas.ts`: um `Map<string, Pixels>` do módulo; `garantirTexturas(ids, base = '/colecao/texturas/')`, que busca o catálogo uma vez, depois cada WebP (`fetch` → `createImageBitmap` → `OffscreenCanvas` → `getImageData`) e guarda; `texturaCarregada(id): Pixels | undefined`, síncrona; `texturasDoTerreno(e: EntradaDeTerreno): string[]`, pura, com as texturas de `e.base` e das camadas.
- Em `executarBake`, no ramo do terreno no Ilustrado: `await garantirTexturas(texturasDoTerreno(p.entrada))` antes de `assarTerreno`. Uma falha de rede só avisa no console; o pintor cai no `padrao`.
- `chaveDoTerreno` acrescenta `|tx<hash>` quando a entrada usa algum material com textura. O hash vem do catálogo, lido junto com a cena.
Não fazer: pintar com a textura (P5).
Testes: `texturasDoTerreno` lista sem repetir; `chaveDoTerreno` muda com o hash quando há textura e não muda quando não há.
Pronto quando: typecheck e testes passam; no navegador, um terreno com um material de teste com `textura` carrega o WebP no worker (dá para ver na aba de rede).
Commit: `terrain bakes preload the textures they use`

### P5 — Pintar o terreno com textura, lote 1 (Opus)  ⬜
Objetivo: os materiais do lote 1 são pintados pela textura, e o acampamento chega perto da referência no chão.
Depende de: P3, P4.
Ler: `src/procedural/materiais.ts` (`pintarMaterial`, `porPixel`, `PINTORES_DE_ALTURA`); `src/procedural/assar.ts:427-600`; `src/procedural/estilos/ilustrado.ts`.
Arquivos: mudar `src/procedural/materiais.ts` (ramo da textura e as receitas do lote 1, mais o material `musgo`) e `src/procedural/assar.ts`, se o relevo pedir.
Como:
- No Ilustrado, `pintarMaterial` pinta pela receita de textura quando o material tem `textura` e todas as texturas estão carregadas. Usa `porPixel` com `amostrarSemRepeticao`, as máscaras de camada e o `mapaDeGradiente`, e mantém o grão e a sombra de contato que já existem. Sem textura carregada, pinta o `padrao`.
- Altura: um pintor de altura `textura` que lê o deslocamento da camada dominante (no máximo ~2 cm) ou devolve plano. Nada de luminância.
- Receitas do lote 1: folhiço + musgo + terra para `chao.de.mata`; terra seca + terra pisada + folhiço ralo para `chao.batido`; e as demais pela curadoria. Ajustar o `tingir` olhando o mapa sob luar e sob a fogueira.
- Medir se 32 px/m preserva a textura: comparar com a referência na mesma escala.
Não fazer: carimbos (P7) nem lote 2.
Testes: os existentes; o visual vem do gerador de exemplos.
Pronto quando: `npm run exemplos -- --so acampamento-na-nevoa` dá um chão com densidade e variação comparáveis às da referência (prancha `test-results/fase10-acampamento-na-nevoa.png`), sem repetição visível em 24 m e sem escamas sob a luz.
Commit: `first terrain batch is painted from cc0 textures`

### P6 — Amostra do material com textura na interface (Sonnet)  ⬜
Objetivo: as amostras de material mostram a textura de verdade, e não o degradê de três cores.
Depende de: P4.
Ler: `src/ui/campos-material.tsx` (`Amostra`); a ficha O2 da [Frente O](biblioteca-por-familias.md) (amostra de 40 px nos grupos de terreno).
Arquivos: mudar `src/ui/campos-material.tsx` e `src/ui/estilo.css`.
Como:
- Quando o material tem `textura`, a `Amostra` usa `background-image: url(/colecao/texturas/<primeira camada>.webp)` com `background-size` igual a ~2 m da textura no tamanho da amostra, mais um filtro CSS leve que lembre o `tingir`. Sem textura, o degradê continua.
- Se a O2 já tiver sido feita, as amostras grandes dos grupos usam a mesma `Amostra`. Se não, a O2 é que vai usá-la.
Não fazer: um pintor de miniatura no worker.
Testes: um unitário, se a regra que escolhe o fundo for extraída para uma função pura.
Pronto quando: a gaveta de Terreno mostra a textura no `chao.de.mata`.
Commit: `material swatches show their ground texture`

### P7 — Carimbos de chão (Opus)  ⬜
Objetivo: as receitas de chão que dão a variedade desenhada da referência.
Depende de: —. Pode ser feita antes da P5.
Ler: `src/procedural/receitas/exterior.ts` (`pedra`, `tora-assento`); `src/procedural/pesados/plantas.ts` (o raminho com nanquim da `arvore-da-mata`); `src/authoring/espalhar.ts:35` (`mata-fechada`); a seção "Pontos de contato com a Frente O" acima.
Arquivos: mudar `src/procedural/receitas/exterior.ts` (ou criar `receitas/chao.ts`), `src/authoring/espalhar.ts`; `src/procedural/familias.ts`, se a O1 já existir.
Como:
- Receitas no traço das copas (nanquim, poucos tons chapados, luz a noroeste, z baixo, sem bloquear): `tronco-caido` (casca, ponta quebrada, musgo; parâmetro `comprimento`), `raizes` (raízes que saem de um ponto e afundam no chão), `moita-de-samambaia`, `tufo-de-capim`, `galhada` e `folhico` (mancha de folhas sem contorno, para quebrar a textura).
- Conjunto `mata-fechada`: acrescentar os carimbos com pesos baixos e contexto `livre`.
- Famílias: as da tabela de pontos de contato, em `familias.ts` se a O1 já tiver sido feita; senão, a tabela fica nesta ficha para a O1 aplicar.
Testes: os de receitas e de espalhar; o da O1, se existir.
Pronto quando: a prancha dos carimbos (`test-results/p7-carimbos.png`) passa na comparação com os carimbos da referência.
Commit: `added drawn ground stamps for forest floors`

### P8 — Acampamento refeito e guia do assistente (Opus)  ⬜
Objetivo: o exemplo usa o chão novo e os carimbos, e o assistente sabe usar os dois.
Depende de: P5, P7.
Ler: `scripts/exemplos/acampamento-na-nevoa.ts`; `docs/assistente/guia/lugares.md` (trecho do acampamento e da mata).
Arquivos: mudar `scripts/exemplos/acampamento-na-nevoa.ts`, `docs/assistente/guia/lugares.md` e `progress.md`.
Como: recompor o chão (material base, manchas de `musgo`, clareira) e espalhar os carimbos como na referência; comparar lado a lado. No guia: quando usar `musgo` e os carimbos, e que o chão de mata dispensa espalhar detrito miúdo.
Pronto quando: a comparação não tem mais distância de chão que seja do motor. Se ainda houver, ela é anotada aqui com a causa.
Commit: `misty camp uses textured ground and stamps`

## Ordem sugerida

P1 → P2 → P3 (pode ir junto com a P2) → P4 → P5 → P6, com a P7 em paralelo a qualquer momento, e a P8 no fim. A P1 depende do usuário aprovar a prancha.
