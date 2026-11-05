# Atlas

Editor de mapas 2D de cena para a mesa: construa rápido, jogue com luz, clima e névoa. Faz parte da plataforma da campanha (Ficha, Ateliê, Jukebox, Tabletop): todos falam o [contrato da mesa](docs/PLATAFORMA.md).

> Estado: **Fase 6 (acervo da casa) concluída**, menos a importação de achados (espera decisão, ver [docs/curadoria.md](docs/curadoria.md)): 144 itens (109 receitas leves em kits de investigação, casa moderna, fantasia e exterior, e 35 imagens assadas por `npm run assar`: estofados capitonê, plantas, árvores e tapetes ornamentados), com harmonização de imagens e licenças em [docs/LICENCAS.md](docs/LICENCAS.md). Antes disso, a **Fase 5 (construção inteligente)** ([progress.md](progress.md)): o assistente lê o que você pintou e sugere, numa pílula junto do cômodo, a função, a porta, a mobília (com piso, papel e paleta) e as luzes, sempre como uma ação desfazível e com prévia; há também o pincel de espalhar (papelada, caixotes, plantas). Antes disso, a **Fase 4 (climas e atmosfera)** ([progress.md](progress.md)): luz com sombras, nove climas com transição animada, chuva, neve, neblina, presença (musgo, sangue, corrupção…) e som do clima. Antes disso, a **Fase 3 (construir)**: Já dá para pintar cômodos (as paredes nascem sozinhas), pôr portas e janelas, mobiliar com uma biblioteca de objetos procedurais, acender luzes e pintar terreno, com histórico, rascunho automático, galeria, backup, paleta de comandos, menu radial, três temas e ligação com a campanha. Sessão e névoa de guerra chegam nas próximas fases ([ROADMAP](docs/ROADMAP.md)).

## Usar

Requer Node.js 22.18 ou superior.

```bash
npm install
npm run dev          # http://127.0.0.1:5190/
npm run assar        # assa os geradores pesados em public/colecao/ (precisa do Chromium do Playwright)
npm run build        # confere os tipos e gera dist/ (funciona em qualquer caminho, inclusive no GitHub Pages)
```

Atalhos principais: `Ctrl+K` paleta · `?` todos os atalhos · `Ctrl+S` gravar · `Ctrl+Z` / `Ctrl+Shift+Z` · `V H C X W D O L T R N P S` ferramentas (ou `1`–`9`) · `B` biblioteca · `Q`/`E` giram · `Shift` + arrastar pinta retângulos · `Ctrl` + clique copia o pincel (pipeta) · `Ctrl` + arrastar duplica · `F` enquadrar · `G` grade · clique direito: menu radial.

## Testes

```bash
npm run typecheck    # TypeScript strict
npm test             # unitários: documento, comandos, store, dados, interface, plataforma, mesa-core
npm run test:e2e     # Playwright (Chromium com WebGL): cenários que cobrem os critérios das Fases 2 a 6
```

## Todos os projetos numa origem só (como no GitHub Pages)

```bash
npm run mesa-dev                       # sobe Atlas, Mesa, Ficha, Ateliê, Tabletop e Jukebox: http://127.0.0.1:5100/Mesa/
npm run mesa-dev -- --so Atlas,Mesa    # só alguns
node scripts/mesa-dev.ts Atlas=5190 Ficha=5173@raiz    # só o proxy, para o que você já subiu
```

Na mesma origem os aplicativos compartilham tema, campanha e eventos. Atlas, Mesa e Ficha rodam com o Vite de desenvolvimento sob o prefixo (`npm run dev:mesa`); Ateliê, Tabletop e Jukebox são servidos como arquivos estáticos, como no GitHub Pages (o `mesa-dev` gera o `dist-pages/` do Ateliê e do Tabletop quando falta ou está velho; nada em outro projeto é alterado). `Nome=porta@raiz` serve para projetos que rodam sem `base`, e `Nome=estatico:pasta` para uma pasta de arquivos.

## Mapa do código

| Pasta | O quê |
| --- | --- |
| `src/domain` | O documento `atlas.map` v1: tipos, validação estrita com caminho do erro, migrações, células em RLE. Não importa render nem interface |
| `src/state` | Comandos puros, rascunhos copy-on-write, store com histórico, gestos e transações |
| `src/data` | Repositório IndexedDB (`atlas-v1:<caminho>`), backup, autossalvamento |
| `src/render` | Viewport em PixiJS: câmera, grade, seleção. Sem Preact |
| `src/ui`, `src/app` | Componentes Preact com signals, ações (paleta, atalhos, menu radial), rotas, tema, campanha |
| `src/fx` | Efeitos e sons, adaptados da Ficha |
| `mesa-core` | O contrato da plataforma: referências, eventos, banco da campanha, manifesto, tema |
| `scripts/mesa-dev.ts`, `mesa-tudo.ts`, `mesa-estatico.ts` | O servidor de desenvolvimento único, o que sobe cada projeto e o servidor de arquivos estáticos |
| `spikes/estilos` | O protótipo descartável da Fase 1 |
