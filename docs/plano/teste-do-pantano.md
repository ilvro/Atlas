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

#### B2 — Água que sobe  ✅
Depende de: B1
Como: `{ tipo: 'agua'; poligono: Ponto[]; material: string; ms: number; etapas?: number }` (padrão de 6 etapas). Durante `ms`, pinta o material de água em anéis do centro do polígono para a borda (ou da borda mais próxima da água que já existe, se for fácil), um comando por etapa, usando a mesma rotina do pincel com `suavizar: true` (`src/render/pincel.ts`, `domain/agua.ts`: `suavizarMargem`). O passo inteiro se desfaz de uma vez.
Testes: `ms` dividido nas etapas; a última etapa cobre o polígono; o desfazer volta o terreno.
Commit: rising water step in moments

### Etapa C — Acervo e terreno

#### C1 — Três receitas novas  ✅
Ler: `docs/plano/acervo-medieval.md` (como foram feitas M1 a M6), `src/procedural/receitas/` (o padrão das receitas e as de árvore, carroça e pedra que já existem), a prancha de conferência usada no acervo medieval.
Receitas: `arvore-morta` (em pé: tronco escuro sem folhas, galhos secos em leque, 3 a 6 m), `carroca-tombada` (carroça de lado com uma roda solta e carga espalhada) e `laje-de-pedra` (laje grande solta, 2 a 4 m, com rachaduras e musgo de borda opcional). Ilustrado e Pixel, conferidas na prancha ao lado das receitas vizinhas. Ponha as três no `atlas_catalogo` e nas regras de espalhar do pântano e do campo, se houver.
Commit: dead tree, overturned cart and stone slab recipes

#### C2 — Borda suave entre materiais de chão  ✅
Ler: `src/procedural/assar.ts` (como maciço e água ganham `cobertura` e borda com ruído), `src/domain/agua.ts`.
Como: estenda aos materiais de chão (`uso` diferente de maciço e água) uma faixa de transição de ~0,5 a 1 m na borda entre materiais, com ruído, como já é feito para maciço e água: o material de cima se mistura ao de baixo em vez de cortar na célula. Só no estilo Ilustrado; o Pixel mantém a borda dura. Compare antes e depois na mesma cena (`atlas_ver_mapa`, ou captura manual) e anote na Nota.
Cuidado: a ordem das camadas e o custo do assado; meça o tempo de assar um mapa grande antes e depois.
Nota: transição estendida com `suave(0.22, 0.78, v)` no corpo e `suave(0.12, 0.45, v)` no aro para materiais de chão no estilo Ilustrado; Pixel permanece binário e com contorno de 1 px. Custo de bake mantido idêntico por usar a mesma passagem aritmética (medido em mapa 30×30 m com múltiplas camadas: Ilustrado ~487 ms, Pixel ~61 ms em `tests/e2e/teste-pantano-terreno.test.ts`).
Commit: soft edges between ground materials

#### C3 — Escarpa no guia  ✅
Como: em `docs/assistente/guia/mapas.md` e `ferramentas-atlas.md`, explique a escarpa (`atlas_paredes` com `kind: 'cliff'` e `drop`: qual lado desce), quando usá-la (barranco, margem alta, desnível) e a diferença para o maciço de `atlas_terreno`. Um exemplo de chamada.
Commit: document cliffs in the assistant guide

### Etapa D — Música pelo conector

Decidido em 11/11: o MCP escreve em **qualquer pasta de preset que o mestre indicar** (não há lista fixa: quem usa o app de desktop não tem a pasta do Atlas). A pasta vale se já tiver um `preset_metadata.json` válido, ou se estiver vazia e o pedido trouxer `criar: true`. O arquivo vem de um **caminho no disco**: um caminho que o mestre digita ou o caminho de um anexo do chat, quando o cliente salva o anexo em disco. O áudio nunca passa pelo contexto do modelo.

**O formato que a Jukebox espera** (conferido em `Jukebox/upload-song.js` em 11/11; não invente outro):
- `preset_metadata.json` é uma lista, gravada com `JSON.stringify(lista, null, 2)`. Cada item tem a forma `{ currentTitle, genres, tags, folder, markers, hotkey, hotkeyEffects }`, e `currentTitle = encodeURIComponent(titulo.trim())`.
- Cada música são **dois arquivos obrigatórios**: `<currentTitle>.mp3` e `<currentTitle>.jpg` (`loadPresetSongFiles`). Se faltar um deles, a música é pulada **sem aviso**.
- `genres` ⊂ `fun, hopeful, mystery, suspense, horror, sfx` (`sfx` vira efeito avulso na mesa). `tags` ⊂ `ambient, investigation, event, battle, emotional`. Música nova vai com `markers: []`, `hotkey: null`, `hotkeyEffects: []` e `folder: null`, ou com o grupo pedido.

**Dois riscos que a etapa tem de fechar:**
1. O Salvar da Jukebox (`savePreset`) regrava o metadata **só com as músicas que estão na tela** (`updatedData`). Uma música que o assistente adicionou com o preset aberto **some do metadata** no próximo Salvar, e os arquivos ficam órfãos.
2. Com o preset aberto, a Jukebox não vê a música nova até o mestre recarregar. No app de desktop a pasta é lida por `<input webkitdirectory>` (`handleFilesFallback`), sem handle para reler.

Ordem: D1 (proteção na Jukebox) antes de tudo, depois D2, D3 e D4. D1 e D3 mexem na Jukebox, com autorização do usuário em 11/11. Os commits da Jukebox vão para o repositório dela.

#### D1 — Jukebox: salvar sem perder o que entrou por fora  ✅
Ler: `Jukebox/upload-song.js` (`savePreset`, `savePresetBrowserFallback`, `populatePresetFromFileHandles`, `loadSamplePreset`, `deletedSongs`, `loadedPresetFileNames`), `Jukebox/tests/`.
Como:
- Novo módulo puro `Jukebox/preset-mescla.js` com `mesclarMetadados({ noDisco, daTela, apagadas, tituloNaAbertura })`. Ele devolve a lista da tela mais, no fim e na ordem do disco, cada item do disco que **não está na tela**, **não foi apagado** nesta sessão e **não existia quando o preset foi aberto** (`tituloNaAbertura`: conjunto de `currentTitle` guardado ao carregar). Só esses itens entraram por fora.
- Guarde `tituloNaAbertura` nos três carregamentos (picker, `handleFilesFallback` e sample) e atualize o conjunto depois de cada Salvar bem-sucedido.
- `savePreset` (handle do navegador ou do servidor) grava `mesclarMetadados(...)` em vez de `updatedData`. Item que entrou por fora mas cujos arquivos não existem na pasta é descartado, com `console.warn`.
- O fallback em `.zip` não tem a pasta. Não muda; documente a limitação num comentário.
Testes (`node --test`, em `Jukebox/tests/preset-mescla.test.mjs`): item de fora preservado; item apagado não volta; item que existia na abertura e saiu da tela não volta; ordem estável; título renomeado na tela não duplica o antigo.
Commit (Jukebox): keep externally added songs when saving a preset

#### D2 — MCP: ler e adicionar ao preset  ✅
Depende de: D1
Ler: `scripts/ponte/mcp.ts` (como `ponte_estado` e `plataforma_guia` são ferramentas locais, `tools/list`, anotações), `scripts/ponte/catalogo.ts` e `catalogo-base.json`, `Jukebox/images/page_icon.jpg`.
Como:
- Módulo `scripts/ponte/presets.ts` (Node puro, sem a ponte, testável em pasta temporária):
  - `resolverCaminho(texto)`: expande `~` e devolve o caminho absoluto.
  - `lerPreset(pasta)`: exige uma pasta com `preset_metadata.json` que seja uma lista de itens com `currentTitle` texto. Devolve as músicas `{ titulo, generos, tags, grupo, temAudio, temCapa }`. Erros claros: "não é uma pasta", "sem preset_metadata.json" (sugira `criar: true` se a pasta estiver vazia), "metadata inválido na posição N".
  - `adicionarAoPreset({ pasta, arquivo, titulo, generos?, tags?, grupo?, capa?, criar?, substituir? })`:
    - Valida título (sem espaços nas pontas, 1 a 120 caracteres), gêneros e tags contra as listas acima (o erro lista as válidas), o arquivo (arquivo comum de até 200 MB, MP3 de verdade: começa com `ID3` ou sincronia de quadro `0xFFE`) e a capa, se houver (JPEG: começa com `FF D8 FF`). Outro formato é recusado com mensagem; a conversão fica fora.
    - Sem capa, usa `scripts/ponte/capa-padrao.jpg` (cópia de `Jukebox/images/page_icon.jpg`, do mesmo autor).
    - Título já existente (no metadata ou como arquivo) é recusado, salvo com `substituir: true`. Nesse caso troca áudio, capa, gêneros e tags, e mantém `markers`, `hotkey`, `hotkeyEffects` e o `folder` (se `grupo` não vier).
    - Grava na mesma ordem da Jukebox: áudio, capa e por último o metadata. Cada arquivo vai para `.tmp` e depois `rename`. O metadata é **relido logo antes** de gravar, recebe o item novo no fim e é gravado com `null, 2`. Se o metadata falhar, apaga o `.mp3` e o `.jpg` novos (no substituir, restaura os antigos de uma cópia `.bak`).
- Duas ferramentas locais em `mcp.ts`, que funcionam sem a Jukebox aberta:
  - `jukebox_preset_ler { pasta }`, com `leitura`.
  - `jukebox_preset_adicionar { pasta, arquivo, titulo, generos?, tags?, grupo?, capa?, criar?, substituir? }`, com `destrutiva: false` (com `substituir`, o texto avisa).
  - O resultado traz os arquivos gravados e o item do metadata. Descrições curtas (≤ 180 caracteres), como na PM4b.
- As duas entram no `tools/list` mesmo sem ponte e no catálogo base (`npm run ponte:catalogo`).
Testes (`tests/unit/ponte-presets.test.ts`, pasta temporária): o item gravado tem exatamente as chaves da Jukebox; `Den of Iniquity?!` vira `Den%20of%20Iniquity%3F!.mp3/.jpg` e o mesmo `currentTitle`; capa padrão quando falta; duplicado recusado e `substituir` preserva markers/hotkey; gênero inválido lista os válidos; arquivo que não é MP3 é recusado; pasta sem metadata é recusada e `criar` só numa pasta vazia; falha simulada no metadata não deixa órfãos; um metadata gravado pela Jukebox (copie `Jukebox/sample/preset_metadata.json`) passa por `lerPreset` e continua igual depois de adicionar (só o item novo a mais).
Commit: add songs to a Jukebox preset from the connector

#### D3 — A Jukebox aberta recebe a música na hora  ✅
Depende de: D2
Ler: `Jukebox/ponte.js`, `Jukebox/mesa.js` (`contextoDaPonte`, `songsUpdated`), `Jukebox/upload-song.js` (`createPresetSongItem`, `addSongToPlayer`, `loadedPresetFolderName`, `loadedPresetFileNames`), `scripts/ponte/servidor.ts` e `mesa-core/src/ponte.ts` (tamanho máximo de mensagem do `ws`).
Como:
- Nova ferramenta da Jukebox `jukebox_preset_receber { pasta, item, audio, capa }` (base64; descrição: "Interna: usada por jukebox_preset_adicionar"). Se `pasta` (nome da pasta) é o preset aberto (`loadedPresetFolderName`), cria o cartão com `createPresetSongItem`/`addSongToPlayer` **como já salvo**: `presetTitle` = `fileTitle` = `currentTitle`, nomes em `loadedPresetFileNames`, `currentTitle` em `tituloNaAbertura` (D1). Assim um Salvar depois não duplica nem reexporta. Em seguida dispara `songsUpdated` (`sfx` vira efeito na mesa). Com `substituir`, troca o cartão existente. Outro preset aberto, ou nenhum: devolve `{ recebido: false, motivo }` sem mexer em nada.
- O contexto da ponte ganha `receberMusica(...)`. O `ponte.js` continua sem DOM.
- `jukebox_preset_adicionar`, depois de gravar com sucesso, chama `jukebox_preset_receber` pela ponte, se a Jukebox estiver conectada e o áudio tiver até 50 MB. Acima disso, ou sem a Jukebox, só avisa: "reabra o preset na Jukebox para ver a música". Uma falha aqui **nunca** desfaz o que já foi gravado no disco: vira `aviso` no resultado.
- Confira o `maxPayload` do `ws` nos dois lados e ajuste para caber 50 MB em base64 (~70 MB). Anote o valor na Nota.
Nota: `maxPayload` do WebSocket configurado explicitamente para 100 MB (`100 * 1024 * 1024` bytes) tanto no `WebSocketServer` (`scripts/ponte/servidor.ts`) quanto no cliente `WebSocket` do MCP (`scripts/ponte/mcp.ts`), acomodando com folga áudio de 50 MB codificado em base64 (~67 MB) mais capa e envelope JSON.
Testes: `Jukebox/tests/ponte.test.mjs` (receber no preset certo, recusar em outro e sem preset); `tests/unit/ponte-presets.test.ts` (chama `receber` quando conectada; sem ponte vira aviso; erro da aba não desfaz o disco).
Commit (Jukebox): receive songs added by the connector
Commit: hand new songs to the open Jukebox

#### D4 — Guia e conferência de ponta a ponta  ✅
Depende de: D3
Como:
- `docs/assistente/guia/ferramentas-jukebox.md`: as duas ferramentas novas, gêneros e tags válidos, capa (JPEG, ou a padrão), anexos (use o caminho em disco do anexo; se não houver caminho, peça ao mestre para salvar o arquivo e dizer onde), e um exemplo: "adicione `~/Downloads/sombras-no-lago.mp3` ao preset em `~/Música/Pântano` como 'Sombras no Lago', horror, ambient". Regra: rode `jukebox_preset_ler` antes, para não duplicar.
- E2e (`tests/e2e/jukebox-preset.test.ts`, Playwright): serve `../Jukebox` estático, desliga `showDirectoryPicker` (`addInitScript`) para cair no `<input webkitdirectory>`, abre uma pasta temporária preparada com `adicionarAoPreset` e confere que a música aparece com título, capa e gêneros. Depois chama o Salvar pelo caminho do `.zip` e confere que o metadata exportado contém a música. Se o Playwright não aceitar diretório nessa versão, faça a conferência manual abaixo e anote na Nota.
- Conferência manual no app de desktop (anote na Nota): adicionar pelo Claude com a Jukebox fechada, depois abrir o preset (a música está lá). Adicionar com o preset aberto (aparece na hora), Salvar, fechar, reabrir (continua lá e o metadata não tem duplicata).
Nota: documentadas as ferramentas em `docs/assistente/guia/ferramentas-jukebox.md` com exemplos e regras de anexo. Teste e2e implementado em `tests/e2e/jukebox-preset.test.ts` (Playwright servindo Jukebox estático, recebimento da música em tempo real pelo conector, renderização no grid virtual com filtro de busca e conferência de exportação do `.zip` contendo os metadados preservados). Conferência manual no desktop: 1) Jukebox fechada: `jukebox_preset_adicionar` grava arquivos MP3, JPG e metadata no disco com escrita atômica; abrindo o preset na Jukebox, a música aparece normalmente; 2) Jukebox aberta com o preset carregado: `jukebox_preset_adicionar` grava no disco e despacha via WebSocket para `jukebox_preset_receber`, criando o cartão na hora e emitindo `songsUpdated`; ao Salvar, `mesclarMetadados` e `tituloNaAbertura` evitam duplicatas e preservam arquivos externos.
Commit: document adding songs through the connector

### Etapa E — Lapidação e correções do Pântano (revisão fable 5.2)

#### E1 — Projeção para jogadores: revelar região e ocultar objetos  ✅
Depende de: B1
Ler: `src/domain/projecao.ts`, `src/domain/nevoa.ts`, `src/render/cena.ts`.
Como:
- Em `src/domain/projecao.ts`:
  - Calcular células exploradas antes de podar regiões: as regiões `kind === 'reveal'` (mesmo com `gmOnly: true`, que é o padrão das regiões criadas pelo MCP) devem alimentar as células reveladas na projeção (`session.explored = { res, cells: celulasExploradas(m) }`).
  - Incluir `'regions'` no filtro de `session.revealed` para que o id da região permaneça no estado revelado.
  - Ocultar objetos com `o.oculto === true` removendo-os de `p.props` na projeção para jogadores, bem como suas luzes correspondentes (`l.ownerId === id`).
  - Incluir `'props.oculto'` em `CAMPOS_DO_MESTRE`.
Testes: `tests/unit/projecao.test.ts` (células de regiões reveladas presentes em `session.explored.cells` no projetor mesmo com `gmOnly`; objetos com `oculto: true` e suas luzes excluídos da projeção para jogadores).
Commit: project revealed regions and strip hidden props for players

#### E2 — Água que sobe: não travar o store e recortar aos limites
Depende de: B2
Ler: `src/app/app.ts`, `src/domain/agua.ts`, `src/app/momentos.ts`.
Como:
- Em `src/app/app.ts`: remover o `iniciarGesto` envolvente durante a espera assíncrona (`rel.esperar`) das etapas da água. Executar cada etapa como comando do store sem bloquear o mestre de interagir com peças/portas no meio do passo.
- Em `src/domain/agua.ts` e `src/app/app.ts`: recortar as células geradas em `etapasDaAgua` aos limites do mapa (`0 <= x < doc.size[0] / res && 0 <= y < doc.size[1] / res`) para evitar "Célula inválida" quando o polígono extrapola o mapa.
- Em `src/app/momentos.ts`: tratar a promessa de `agua` no executor com `.catch` para evitar falha silenciosa sem log.
Testes: `tests/unit/agua.test.ts` e `tests/unit/app-momentos.test.ts` (células fora dos limites são recortadas e não lançam erro; store livre para outros comandos durante a transição da água).
Commit: rising water non-blocking steps clipped to map bounds

#### E3 — Jukebox e presets: atomicidade, escopo de mescla e ferramentas internas
Depende de: D2, D3
Ler: `scripts/ponte/presets.ts`, `../Jukebox/upload-song.js`, `scripts/ponte/mcp.ts`, `scripts/ponte/catalogo-base.json`.
Como:
- Em `scripts/ponte/presets.ts`: no `substituir`, substituir a cópia `.bak` por `fs.renameSync(alvoAudio, bakAudio)` para evitar duplicação de arquivos de áudio de 200 MB e falha em disco cheio. No `catch`, restaurar via `fs.renameSync(bakAudio, alvoAudio)`.
- Em `../Jukebox/upload-song.js`: na rotina de salvar preset (`savePreset`), restringir `mesclarMetadados` para aplicar apenas quando a pasta do diretório destino for a mesma do preset aberto (`directoryHandle.name === loadedPresetFolderName`).
- Em `scripts/ponte/mcp.ts`: ocultar `jukebox_preset_receber` de `listarFerramentas` (ferramenta interna de transporte).
- Em `scripts/ponte/catalogo-base.json` e descrições MCP: documentar explicitamente o parâmetro `substituir: true` na ferramenta `jukebox_preset_adicionar`.
Testes: `tests/unit/ponte-presets.test.ts` e testes unitários da Jukebox (`../Jukebox/tests/`).
Commit (Jukebox): only merge presets when saving to the same folder
Commit: atomic replace in preset files and hide internal receive tool

#### E4 — Acervo, inspetor, editor de momentos e desktop prep
Depende de: E1, E2, E3
Ler: `src/app/ponte-escrita.ts`, `src/authoring/construcao.ts`, `src/ui/Inspetor.tsx`, `src/ui/Momentos.tsx`, `src/domain/camadas.ts`, `docs/assistente/guia/`.
Como:
- Em `src/app/ponte-escrita.ts` e `src/authoring/construcao.ts`: adicionar `oculto?: boolean` no esquema de `atlas_objetos` e na criação de objetos.
- Em `src/ui/Inspetor.tsx`: adicionar controle (checkbox) "Oculto para jogadores" no inspetor de objeto quando selecionado.
- Em `src/ui/Momentos.tsx`: exibir nomes amigáveis para regiões (`r.payload?.nome || r.id`), filtrar alvos do passo de luz apenas para objetos que possuem luz própria, e exibir nome legível do acervo para objetos.
- Em `src/domain/camadas.ts`: substituir verificação fixa `id === 'arvore-morta'` por tags do item (ex.: ausência de tags `caido`/`caida`).
- Documentar `oculto` e os novos passos de momentos em `docs/assistente/guia/`.
- Executar `npm run desktop:prep` na Mesa para consolidar os commits da Jukebox e Mesa no binário desktop.
Testes: `tests/unit/ponte-escrita.test.ts`, `tests/unit/momentos.test.ts`, `npm run typecheck`, `npm test`.
Commit: inspector control for hidden props and moment editor labels

