# Ajustes do teste do Pântano (11/11/2026)

No primeiro uso real do assistente pelo app de desktop, montando "O Pântano dos Afogados", apareceram defeitos e faltas. Este plano foi conferido contra o código de 11/11.

## Diagnóstico

| Relato | Causa | Onde |
| --- | --- | --- |
| `atlas_ver_mapa` falha ("a imagem não voltou") | `capturar` espera quadros com `requestAnimationFrame`. Numa aba que não está visível (o Atlas atrás da Mesa nas abas do app), o navegador não entrega quadros: o laço para no primeiro `await` e o prazo de 20 s nunca é conferido, porque só é checado entre quadros. O MCP desiste em 50 s. O "travou no clima noturno" é o mesmo caso. Confirmar também se `cena.pintando` fica acima de 0 com as luzes tremulando à noite. | `src/render/viewport.ts`, `capturar` (linha ~1015) |
| A Jukebox "não registrada / sem mesa.json" | 1) O `mesa.json` da Jukebox atende `jukebox.prontidao` (ficha P1 da Mesa), mas o pedido **não está no `CATALOGO` do `mesa-core`**. `validarManifesto` recusa o manifesto, e a Mesa a classifica como "sem manifesto", não a abre e as `jukebox_*` falham. 2) O build de desktop copia a Jukebox por uma lista fixa (`JUKEBOX_ESSENCIAIS`) que **não tem o `ponte.js`**. Como o servidor do atalho devolve o `index.html` para arquivo inexistente, a Jukebox importa HTML e a ponte falha em silêncio. | `mesa-core/src/eventos.ts` (`CATALOGO`), `Mesa/scripts/build-desktop.ts`, `Mesa/scripts/launch-desktop.mjs` (`iniciarServidorEstatico`) |
| "Não tem ferramenta de altura ou barranco" | **Já existe em parte:** a escarpa é uma parede `kind: 'cliff'` com `drop: 'a' \| 'b'` (o lado que desce), aceita por `atlas_paredes`. O guia não explica isso. Altura de verdade (mapa de elevação) não existe e fica fora deste plano. | `src/domain/mapa.ts` (`Parede`), `docs/assistente/guia/` |
| Os momentos não apagam luz, não escondem objeto, não revelam região, não sobem a água | Os passos de hoje são `esperar`, `som`, `silencio`, `efeito`, `clima`, `tela`, `letreiro`, `camera`, `revelar` (só cômodos e aberturas), `interagir`, `pista` e `nota`. | `src/domain/momentos.ts`, `src/app/momentos.ts`, `src/app/ponte-escrita.ts` (`TIPOS_DE_PASSO_ESQUEMA`) |
| Bordas de terreno serrilhadas e quadradas | O terreno é uma grade de células de 25 cm. Maciço e água têm a borda suavizada no assado (`procedural/assar.ts`), mas os materiais de chão comuns são cortados célula por célula, e um polígono vindo do MCP vira uma escada. | `src/procedural/assar.ts` |
| Faltam no acervo: árvore morta em pé, carroça tombada, laje de pedra grande | Receitas que não existem. | `src/procedural/receitas/` |
| Importar música pelo conector | Não existe. A Jukebox não guarda músicas: elas vêm de pastas de preset no disco (`preset_metadata.json` mais os arquivos). | `Jukebox/upload-song.js` |

## Etapas e tarefas

Ordem: A antes de tudo (destrava o uso), depois B, C e D. E é decisão do usuário.

### Etapa A — Defeitos

#### A1 — Captura que não depende de a aba estar visível  ✅
Ler: `src/render/viewport.ts` (`capturar`, `aoQuadro`, `app.ticker`), `src/app/ponte-leitura.ts` (`atlas_ver_mapa`), `src/render/cena.ts` (`pintando`).
Como:
- Troque a espera por quadro por `esperarQuadro()`: uma corrida entre `requestAnimationFrame` e `setTimeout(…, 50)`. Quando `document.visibilityState !== 'visible'`, cada volta do laço também chama `app.ticker.update()`, para a cena avançar sem quadros do navegador.
- O prazo vale em todas as voltas: no máximo 8 s esperando a cena "acalmar". Depois disso, captura assim mesmo e devolve `aviso: 'a cena ainda estava pintando; a imagem pode estar incompleta'`.
- Investigue se, no clima noturno, `cena.pintando` fica acima de 0 sem parar por causa das animações (tremulação, partículas). Se ficar, `pintando` deve contar só o assado de texturas e não as animações. Anote a causa na Nota.
- Em `atlas_ver_mapa`, um erro de captura volta como texto claro ("não consegui capturar: …"), nunca como espera até o prazo.
Nota da investigação: `cena.pintando` já conta estritamente o assado assíncrono de texturas (`pintandoAgora + op.baker.pendentes`) e não é afetado pelas animações (tremulação, partículas). A causa da trava no clima noturno foi unicamente a falta de disparos de `requestAnimationFrame` em abas de fundo.
Testes: com `requestAnimationFrame` que nunca dispara (simulado) e `visibilityState = 'hidden'`, a captura termina em menos de 10 s; com `pintando` sempre acima de 0, termina com o aviso.
Pronto quando: com o Atlas numa aba de fundo do app e o clima noturno, `atlas_ver_mapa` devolve a imagem.
Commit: map capture works in background tabs

#### A2 — Jukebox na ponte do app de desktop  ✅
Ler: `mesa-core/src/eventos.ts` (`CATALOGO`), `mesa-core/src/manifesto.ts` (`validarManifesto`), `../Jukebox/mesa.json`, `../Mesa/scripts/build-desktop.ts` (`JUKEBOX_ESSENCIAIS`), `../Mesa/scripts/launch-desktop.mjs` (`iniciarServidorEstatico`, o fallback SPA).
Como:
1. Ponha `jukebox.prontidao` no `CATALOGO` (natureza `pedido`, dono `jukebox`, com os dados `{ ref }`), igual aos outros pedidos da Jukebox. Rode `npm run build:core` e copie para o `vendor/mesa-core/` de Mesa, Ateliê, Dossiê e Jukebox.
2. **Teste de contrato:** em `mesa-core/tests/`, um teste que lê o `mesa.json` de cada app irmão que existir (`../Mesa/public/mesa.json` ou onde estiver, `../Jukebox/mesa.json`, `../Dossie/public/mesa.json`, `../Atelie/public/mesa.json`; ache os caminhos certos) e confere que `validarManifesto` aceita cada um. Esse teste teria pegado o defeito.
3. `build-desktop.ts`: troque a lista fixa da Jukebox por "a pasta inteira, menos" `tests`, `.git`, `node_modules`, `sample` (conferir se o `sample` é usado em produção antes de excluir) e `*.md`. Teste no `desktop.test.ts` da Mesa.
4. `launch-desktop.mjs`: o fallback SPA só vale para caminhos **sem extensão**. Um `.js`, `.css`, `.json` ou `.png` inexistente devolve 404. Assim, arquivo faltando falha alto.
Testes: os itens 2 e 3, mais um teste do servidor estático (404 para `/Jukebox/naoexiste.js`, `index.html` para `/Mesa/rota`).
Pronto quando: `npm run desktop:prep`, abrir o atalho, Aplicativos mostra a Jukebox "Achado" e `jukebox_listar` responde.
Commit: jukebox reachable from the desktop app

### Etapa B — Passos novos nos momentos

#### B1 — Passos de luz, objeto e região  ✅
Ler: `src/domain/momentos.ts` (`PassoDeMomento`, `descreverPasso`, validação), `src/app/momentos.ts` (`executarPasso`, `saidas`), `src/app/app.ts` (como `revelar` e `interagir` viram comandos da sessão), `src/ui/Momentos.tsx` (o editor de passos), `src/app/ponte-escrita.ts` (`TIPOS_DE_PASSO_ESQUEMA`, `passo(...)`), `src/domain/mapa.ts` (`Luz.on`, `Objeto`, `Regiao.kind`).
Passos novos (domínio, execução, editor de momentos e esquema do MCP):
- `{ tipo: 'luz'; ids: string[]; acao: 'ligar' | 'desligar' | 'alternar' }`, com ids de luzes **ou** de objetos. Um id de objeto vale pelas luzes cujo `ownerId` é aquele objeto (a tocha ou o lampião).
- `{ tipo: 'objeto'; ids: string[]; acao: 'mostrar' | 'esconder' }`. Antes, verifique se `Objeto` já tem um campo de visibilidade. Se não tiver, acrescente `oculto?: boolean` ao modelo e à validação, escondido no projetor e mostrado em meia opacidade no editor, e documente em `docs/MODELO*.md` se existir.
- `revelar` passa a aceitar também ids de **regiões** `kind: 'reveal'`: revela a área do polígono, com o mesmo efeito de névoa da revelação de cômodos. Ver como a névoa trata cômodos e reaproveitar.
- Tudo durante a sessão vira comando do store com rótulo do momento, desfeito pelo mesmo caminho dos outros passos.
- No editor de momentos, os seletores mostram nomes, não ids.
Testes: cada passo no domínio (validação e descrição), na execução (comandos certos) e no esquema do MCP; o id de objeto para luz acha as luzes por `ownerId`.
Commit: light, object and region steps in moments

#### B2 — Água que sobe  ⬜
Depende de: B1
Como: `{ tipo: 'agua'; poligono: Ponto[]; material: string; ms: number; etapas?: number }` (padrão de 6 etapas). Durante `ms`, pinta o material de água em anéis do centro do polígono para a borda (ou da borda mais próxima da água que já existe, se for fácil), um comando por etapa, usando a mesma rotina do pincel com `suavizar: true` (`src/render/pincel.ts`, `domain/agua.ts`: `suavizarMargem`). O passo inteiro se desfaz de uma vez.
Testes: `ms` dividido nas etapas; a última etapa cobre o polígono; o desfazer volta o terreno.
Commit: rising water step in moments

### Etapa C — Acervo e terreno

#### C1 — Três receitas novas  ⬜
Ler: `docs/plano/acervo-medieval.md` (como foram feitas M1 a M6), `src/procedural/receitas/` (o padrão das receitas e as de árvore, carroça e pedra que já existem), a prancha de conferência usada no acervo medieval.
Receitas: `arvore-morta` (em pé: tronco escuro sem folhas, galhos secos em leque, 3 a 6 m), `carroca-tombada` (carroça de lado com uma roda solta e carga espalhada) e `laje-de-pedra` (laje grande solta, 2 a 4 m, com rachaduras e musgo de borda opcional). Ilustrado e Pixel, conferidas na prancha ao lado das receitas vizinhas. Ponha as três no `atlas_catalogo` e nas regras de espalhar do pântano e do campo, se houver.
Commit: dead tree, overturned cart and stone slab recipes

#### C2 — Borda suave entre materiais de chão  ⬜
Ler: `src/procedural/assar.ts` (como maciço e água ganham `cobertura` e borda com ruído), `src/domain/agua.ts`.
Como: estenda aos materiais de chão (`uso` diferente de maciço e água) uma faixa de transição de ~0,5 a 1 m na borda entre materiais, com ruído, como já é feito para maciço e água: o material de cima se mistura ao de baixo em vez de cortar na célula. Só no estilo Ilustrado; o Pixel mantém a borda dura. Compare antes e depois na mesma cena (`atlas_ver_mapa`, ou captura manual) e anote na Nota.
Cuidado: a ordem das camadas e o custo do assado; meça o tempo de assar um mapa grande antes e depois.
Commit: soft edges between ground materials

#### C3 — Escarpa no guia  ⬜
Como: em `docs/assistente/guia/mapas.md` e `ferramentas-atlas.md`, explique a escarpa (`atlas_paredes` com `kind: 'cliff'` e `drop`: qual lado desce), quando usá-la (barranco, margem alta, desnível) e a diferença para o maciço de `atlas_terreno`. Um exemplo de chamada.
Commit: document cliffs in the assistant guide

### Etapa D — Música pelo conector (decidir antes)

As músicas vivem em pastas de preset no HD (`preset_metadata.json` mais os arquivos). Importar pelo conector seria uma **ferramenta local do MCP** (que roda no seu computador e lê e escreve arquivos), e não da aba:
- `jukebox_preset_adicionar { pasta, arquivo, titulo, generos?, capa? }` copia o arquivo para a pasta do preset e atualiza o `preset_metadata.json` no formato que `upload-song.js` grava;
- a Jukebox recarrega o preset (pedido novo `jukebox.recarregar`, ou o mestre recarrega).

**Decisões pendentes:**
- Quais pastas o MCP pode escrever? Proposta: uma lista fixa num arquivo de configuração (`Atlas/.ponte/pastas-de-musica.json`), nunca qualquer caminho.
- O arquivo vem de onde? Hoje um anexo no app do Claude não chega ao MCP. Só funciona com um caminho no seu disco ("adicione `~/Downloads/x.mp3` ao preset Vaesen").

Ficha a escrever depois dessas decisões.
