# Fase 12 — Refinamento de Peças, Fichas Flutuantes, Rolagens, Objetos Interativos, Som e Tutoriais

Esta fase aborda os refinamentos visuais, de usabilidade e de imersão no **Atlas** e no **Dossiê**, divididos em cartões atômicos para execução por subagentes (**Gemini 3.8 Flash Medium/High**).

---

## Regras para o Agente Executor (Gemini 3.8 Flash)

1. **Escopo estrito por cartão:** implemente apenas os arquivos listados no cartão atribuído.
2. **Qualidade obrigatória antes do commit:**
   - No `Atlas/`: rode `npm run typecheck` e `npm test`.
   - No `Dossie/`: rode `npm test` e `npm run build`.
3. **Compatibilidade de dados:** todos os novos campos em `MapaAtlas` (`Peca`, `Interacao`) devem ser opcionais ou possuir fallback seguro na validação/migração (`Atlas/src/domain/validacao.ts` e `Atlas/src/domain/mapa.ts`) para não quebrar mapas já salvos.
4. **Estilo de commits:** mensagens curtas em inglês minúsculo no `Atlas` (ex.: `replaced token square pips with continuous hp and pd bars`) e em português no `Dossie` (ex.: `ajustado layout das rolagens de dados no modo compacto`).

---

## Onda 1 — Peças no Mapa: Barras Contínuas, Modos de Token ("Moeda" vs. "Token Imersivo") e Escala

### Cartão `12.1a` (Concluído) — Barras Contínuas de PV e PD nas Miniaturas do Mapa

- **Objetivo:** Substituir os 10 quadradinhos discretos (`pips`) desenhados abaixo da peça no canvas PixiJS por **barras de progresso contínuas** (uma para PV em vermelho/pulso crítico e, se `pdMax > 0`, uma para PD em azul logo abaixo).
- **Arquivos a modificar:**
  - `Atlas/src/render/pecas.ts`
- **Especificação técnica:**
  1. Em `Atlas/src/render/pecas.ts`, na função `desenharPips(r: number,grade: number)` (linhas 99–111):
     - Mantenha o objeto `ultimoRecursos` e o retorno `estado().pips` intactos (com `pvCheios` e `pdCheios` calculados via `pipsCheios(pv, pvMax, 10)`) para preservar 100% de compatibilidade com os testes unitários existentes de estado (`tests/unit/fichas.test.ts`).
     - No desenho gráfico (`pips.clear()`), em vez do laço `for (let i = 0; i < N; i++)` que desenha quadrados separados:
       - Defina `largura = Math.min(2 * r * 1.05, Math.max(grade * 0.86, 2 * r * 0.92))` e `altura = Math.max(0.095 * grade, 0.115 * r)`.
       - Defina `x0 = -largura / 2`, `y0 = r + 0.09 * grade`, `raioBorda = altura * 0.45`.
       - Crie uma função auxiliar interna `barra(y: number, valor: number, maximo: number, cor: number)`:
         - Calcula a fração `f = maximo > 0 ? Math.max(0, Math.min(1, valor / maximo)) : 0`.
         - Desenha a trilha escura de fundo: `pips.roundRect(x0, y, largura, altura, raioBorda).fill({ color: 0x0b0d13, alpha: 0.88 }).stroke({ color: 0x000000, alpha: 0.9, width: 0.02 * grade })`.
         - Se `f > 0`, desenha o preenchimento contínuo: `pips.roundRect(x0, y, Math.max(altura * 0.6, largura * f), altura, raioBorda).fill({ color: cor, alpha: 0.96 })`.
         - Desenha um brilho sutil superior (`highlight`): `pips.roundRect(x0 + 0.01 * grade, y + 0.01 * grade, Math.max(0, largura * f - 0.02 * grade), altura * 0.35, raioBorda * 0.5).fill({ color: 0xffffff, alpha: 0.18 })`.
       - Chame `barra(y0, pv, pvMax, corPv)` e, se `pdMax > 0`, `barra(y0 + altura + 0.035 * grade, pd ?? 0, pdMax, 0x3e8fe0)`.
  2. Ajuste a posição vertical do `rotulo` (`nome`) em `sincronizar` para ficar logo abaixo das barras (`r + 0.12 * grade + (ultimoRecursos ? (ultimoRecursos.pdMax > 0 ? 0.28 : 0.15) * grade : 0)`).
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`.

---

### Cartão `12.1b` (Concluído) — Modo "Moeda" (Sem Corte) vs. "Token Imersivo" (Retrato Real) + Escala Visual

- **Objetivo:**
  1. Corrigir o aspecto "cortado" do retrato no modo atual (**Moeda / Circular**).
  2. Adicionar o novo modo **"Token Imersivo"** (`tokenStyle: 'immersive'`), que renderiza o retrato completo da ficha/imagem mantendo sua proporção original sem máscara circular de moeda (estilo miniatura/standee em pé sobre o mapa).
  3. Permitir escalar visualmente o tamanho da arte da peça (`portraitScale?: number`, de `0.5` a `3.0`, padrão `1.0`) além do tamanho em células (`size`).
- **Arquivos a modificar:**
  - `Atlas/src/domain/mapa.ts`
  - `Atlas/src/domain/validacao.ts`
  - `Atlas/src/render/pecas.ts`
  - `Atlas/src/ui/Inspetor.tsx`
  - `Atlas/src/ui/CartaoContextual.tsx`
- **Especificação técnica:**
  1. **Modelo e Validação (`Atlas/src/domain/mapa.ts` e `Atlas/src/domain/validacao.ts`):**
     - Em `Peca` (`mapa.ts`), adicione os campos opcionais:
       - `tokenStyle?: 'coin' | 'immersive'` (padrão `'coin'`)
       - `portraitScale?: number` (padrão `1`, intervalo `0.5` a `3.0`)
     - Em `validacao.ts`, aceite `tokenStyle` (`'coin'` ou `'immersive'`) e `portraitScale` (número finito entre `0.5` e `3.0`) na validação de `tokens`.
  2. **Preservar Proporção no Upload (`Atlas/src/ui/Inspetor.tsx`):**
     - Na função `reduzirParaRetrato(arquivo: File)` (`Inspetor.tsx`, linhas 317–326), **não recorte a imagem em um quadrado** (`Math.min(bitmap.width, bitmap.height)`).
     - Em vez disso, redimensione mantendo a proporção original com dimensão máxima `MAX = 512`:
       ```ts
       const escala = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
       const w = Math.max(1, Math.round(bitmap.width * escala));
       const h = Math.max(1, Math.round(bitmap.height * escala));
       ```
       Desenhe o `bitmap` inteiro `(0, 0, bitmap.width, bitmap.height)` em `(0, 0, w, h)`. Assim, retratos verticais servem perfeitamente tanto ao modo Moeda quanto ao modo Token Imersivo.
  3. **Renderização nos Dois Modos (`Atlas/src/render/pecas.ts`):**
     - Leia `const estiloToken = t.tokenStyle ?? 'coin'` e `const escalaVisual = t.portraitScale ?? 1`.
     - Defina o raio base da célula `rBase = (t.size * grade * 0.88) / 2` e o raio escalado `r = rBase * escalaVisual`.
     - **Modo `'coin'` (Moeda / Circular corrigido):**
       - Mantenha a moeda circular com raio `r`.
       - No anel interno (`anel.circle(0, 0, ...)`), aumente de `r * 0.82` para `r * 0.92` com `alpha: 0.35`, evitando que o anel interno cubra 18% da borda do retrato e dê aparência de cortado.
       - Quando um retrato (`tex`) for carregado:
         - A máscara circular do retrato deve usar raio `r * 0.93` (cobrindo quase toda a face interna da moeda).
         - Ao posicionar o sprite `sp`: se a imagem for vertical (`tex.height > tex.width * 1.12`), use `sp.anchor.set(0.5, 0.36)` (em vez de `0.5, 0.5`) para centralizar o rosto/busto do personagem dentro do círculo sem decapitar o topo da cabeça; caso contrário, `sp.anchor.set(0.5, 0.5)`.
     - **Modo `'immersive'` (Token Imersivo / Retrato Completo):**
       - Quando `estiloToken === 'immersive'` e houver `tex` (ou `t.sprite`):
         - **Não aplique máscara circular** (`sp.mask = null`; `mascara.visible = false`) e **não desenhe o disco de fundo da moeda** (`fundo.clear()`).
         - No `fundo`, desenhe apenas uma **sombra/base elíptica sutil aos pés da miniatura** (`fundo.ellipse(0, rBase * 0.65, rBase * 0.85, rBase * 0.32).fill({ color: 0x000000, alpha: 0.45 })`).
         - No `anel`, desenhe apenas um **aro elíptico no chão** quando selecionado, na vez da iniciativa ou com borda discreta da cor da peça (`anel.ellipse(0, rBase * 0.65, rBase * 0.88, rBase * 0.34).stroke({ color: vez ? 0xffd24a : selecionado ? corAcento : cor, width: (vez || selecionado ? 0.07 : 0.035) * grade, alpha: vez || selecionado ? 0.95 : 0.55 })`).
         - Dimensione o sprite `sp` preservando a proporção real da imagem:
           ```ts
           const ladoAlvo = 2 * rBase * 1.35 * escalaVisual;
           const esc = ladoAlvo / Math.max(tex.width, tex.height);
           sp.scale.set(esc);
           sp.anchor.set(0.5, 0.72);
           sp.position.set(0, rBase * 0.65);
           ```
           Assim o retrato fica apoiado na base da célula e se projeta de corpo inteiro, sem corte!
  4. **Controles na UI (`Atlas/src/ui/Inspetor.tsx` e `Atlas/src/ui/CartaoContextual.tsx`):**
     - Em `CamposDaPeca` (`Inspetor.tsx`), adicione:
       - Seletor `CampoEscolha` **Modo do token** (`data-campo="Modo do token"`, `data-testid="peca-estilo-token"`): `[['coin', 'Moeda (Círculo)'], ['immersive', 'Token Imersivo (Retrato)']]`.
       - Controle numérico/slider **Escala visual** (`data-campo="Escala visual"`, `data-testid="peca-escala-visual"`, `min={0.5}`, `max={3}`, `step={0.1}`, valor `t.portraitScale ?? 1`).
     - Em `CartaoContextual.tsx` (quando uma única peça está selecionada), adicione um botão rápido (`data-testid="cartao-alternar-estilo-token"`) para alternar entre `Moeda` (`◯`) e `Imersivo` (`🧍`) com 1 clique.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`, incluindo teste unitário para `tokenStyle: 'immersive'` e `portraitScale`.

---

## Onda 2 — Fichas Flutuantes Arrastáveis e Rolagens de Múltiplas Criaturas

### Cartão `12.2a` (Concluído) — Janela de Prévia da Ficha (`PreviaDaFicha`) Arrastável pela Tela

- **Objetivo:** Permitir que a janela flutuante da ficha (`PreviaDaFicha.tsx`) seja arrastada livremente pela tela pelo seu cabeçalho (assim como os painéis do `Dock.tsx`), com bloqueio de `pointer-events` no `iframe` durante o arrasto para o cursor não travar.
- **Arquivos a modificar:**
  - `Atlas/src/app/previa-ficha.ts`
  - `Atlas/src/ui/PreviaDaFicha.tsx`
  - `Atlas/src/ui/estilo.css`
- **Especificação técnica:**
  1. Em `Atlas/src/app/previa-ficha.ts`:
     - Adicione `export const posicaoManualPrevia = signal<{ x: number; y: number } | null>(null);` e `export const arrastandoPrevia = signal(false);`.
     - Em `fecharPreviaFicha()`, mantenha ou limpe `arrastandoPrevia.value = false`.
  2. Em `Atlas/src/ui/PreviaDaFicha.tsx`:
     - No `<header class="previa-cabecalho">`, adicione uma alça visual `<span class="dock-alca" aria-hidden="true">⠿</span>` antes do título e trate `onPointerDown` para iniciar o arrasto da janela:
       - Ignore cliques em `button` (`if ((e.target as HTMLElement).closest('button')) return;`).
       - Calcule o `rect` atual de `.previa-da-ficha` relativo ao container `.area-com-cartao` (ou `window` com `position: fixed`).
       - Defina `arrastandoPrevia.value = true` e atualize `posicaoManualPrevia.value = { x, y }` em `window.addEventListener('pointermove', ...)`, limitando aos limites visíveis da janela (`10px` a `window.innerWidth - largura - 10`, `52px` a `window.innerHeight - 60`).
       - Ao soltar (`pointerup` / `pointercancel`), defina `arrastandoPrevia.value = false`.
       - Duplo clique no cabeçalho (`onDblClick`) ou clicar no botão `📌` reseta `posicaoManualPrevia.value = null` e alterna `previaFixada`.
     - Quando `posicaoManualPrevia.value` não for `null`, aplique `style={{ position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px` }}`.
  3. Em `Atlas/src/ui/estilo.css`:
     - Adicione `cursor: grab;` em `.previa-cabecalho` (`cursor: grabbing` quando `.previa-da-ficha.arrastando`).
     - Adicione `.previa-da-ficha.arrastando .previa-iframe { pointer-events: none; user-select: none; }` para que o `iframe` do Dossiê não capture os eventos de ponteiro durante o movimento.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`.

---

### Cartão `12.2b` (Concluído) — Rolagens de Múltiplas Criaturas Flutuando sobre a Criatura Correta

- **Objetivo:** Quando houver múltiplas peças da mesma ameaça/ficha no mapa (ex.: *Zumbi 1*, *Zumbi 2*, *Zumbi 3*), fazer com que o texto flutuante e o pulso de rolagem apareçam sobre a **peça selecionada no momento** (ou a da vez na iniciativa), em vez de sempre aparecerem sobre a primeira peça encontrada em `Object.values(m.tokens)`.
- **Arquivos a modificar:**
  - `Atlas/src/app/fichas.ts`
  - `Atlas/src/app/app.ts`
  - `Atlas/tests/unit/fichas.test.ts`
- **Especificação técnica:**
  1. Em `Atlas/src/app/fichas.ts`, atualize a assinatura de `pecaDaFicha`:
     ```ts
     export function pecaDaFicha(
       m: Pick<MapaAtlas, 'tokens'> & { session?: MapaAtlas['session'] },
       ref: Ref,
       preferidasIds?: readonly string[],
     ): Peca | undefined
     ```
     - Primeiro, se `preferidasIds?.length`, procure se alguma peça com `id` em `preferidasIds` existe em `m.tokens` e possui `t.refs.some(r => chaveDaRef(r) === chave)`. Se encontrar, retorne-a imediatamente!
     - Segundo, se `m.session?.initiative`, verifique a peça da vez atual na iniciativa (`ini.order[ini.current]?.tokenId`); se ela referenciar `ref`, retorne-a.
     - Caso contrário, faça o fallback para `Object.values(m.tokens).find(t => t.refs.some(r => chaveDaRef(r) === chave))`.
  2. Em `Atlas/src/app/app.ts` (linhas 772–779, dentro de `aoRolar`):
     - Passe os IDs das peças selecionadas:
       ```ts
       const selecionadas = s.selecao.peek().filter(a => a.colecao === 'tokens').map(a => a.id);
       const peca = pecaDaFicha(s.doc.value, r.ficha, selecionadas);
       ```
  3. Adicione um teste unitário em `Atlas/tests/unit/fichas.test.ts` comprovando que, com 2 tokens apontando para a mesma `Ref` de ameaça, `pecaDaFicha(mapa, ref, [token2.id])` retorna `token2`.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`.

---

## Onda 3 — UI de Rolagem de Dados Sem Cortes no Dossiê Compacto

### Cartão `12.3a` — Responsividade Completa das Rolagens dentro do Modo Compacto (`Dossiê`)

- **Objetivo:** Impedir que a animação/interface de rolagem de dados do Dossiê (`.bg3-stage`, `.roll-hud` e `#dice-stage-result`) fique cortada nas bordas superior, inferior ou laterais quando a ficha está aberta numa janela pequena/compacta (`PreviaDaFicha` 380×460 ou painel lateral do Modo Sessão da Mesa).
- **Arquivos a modificar:**
  - `Dossie/src/fx/dice-cinematic-alt.css`
  - `Dossie/src/fx/fx.css`
  - `Dossie/src/fx/dice-sum-fx.js`
  - `Dossie/src/styles.css`
- **Especificação técnica:**
  1. **Palco Cinemático BG3 (`Dossie/src/fx/dice-cinematic-alt.css`):**
     - Atualmente `.bg3-board` usa `--board-w: clamp(300px, 25vw, 360px)` com `aspect-ratio: 340 / 496` (~450–520px de altura), mais `.bg3-head` e `.bg3-mods`, totalizando ~580px, o que estoura os ~450px de altura do `PreviaDaFicha`.
     - Adicione regras responsivas para viewports compactos (`@media (max-height: 680px), (max-width: 480px)` e `body[data-compacto="1"] .bg3-stage`):
       - Reduza `--board-w: min(230px, 64vw, 46vh);`
       - Permita scroll vertical suave caso necessário em `.bg3-panel`: `max-height: 98vh; overflow-y: auto; overflow-x: hidden; gap: 4px; padding: 6px 8px;`
       - Reduza fontes e paddings de `.bg3-head` (`gap: 2px`), `.bg3-skill` (`font-size: clamp(14px, 4vw, 20px)`), `.bg3-mods` e `.bg3-confirm-done-btn` para caberem inteiramente na tela sem cortar nenhum botão de rerolar/confirmar.
  2. **HUD de Soma e Bandeja 3D (`Dossie/src/fx/fx.css` e `Dossie/src/fx/dice-sum-fx.js`):**
     - Em `Dossie/src/fx/dice-sum-fx.js` (função `positionHud`, linhas 189–205):
       - Quando `h < 560 || w < 460 || document.body.dataset.compacto === '1'`:
         - Ajuste `headBottom` e `totalTop` proporcionalmente à altura real `h` (`--rh-head-bottom: ${Math.round(h - Math.max(76, h * 0.22))}px` e `--rh-total-top: ${Math.round(Math.min(h - 145, Math.max(h * 0.44, totalTop)))}px`).
     - Em `Dossie/src/fx/fx.css`:
       - Adicione `@media (max-height: 580px), (max-width: 460px)` e `body[data-compacto="1"] .roll-hud`:
         - `.rh-title { font-size: clamp(16px, 4.5vw, 24px); }`
         - `.rh-formula { font-size: 11px; }`
         - `.rh-total { font-size: clamp(38px, 9vh, 58px); }`
         - `.rh-breakdown { max-width: 92vw; flex-wrap: wrap; gap: 6px; }`
         - `.rh-die { width: 32px; height: 32px; font-size: 14px; }`
         - `.rh-verdict { font-size: 12px; letter-spacing: 0.14em; padding: 4px 12px; }`
         - `.rh-foot { bottom: 8px; }`
  3. **Banner de Resultado (`Dossie/src/styles.css`):**
     - Em `#dice-stage-result`, adicione `max-width: calc(100vw - 20px); flex-wrap: wrap; justify-content: center; box-sizing: border-box;` para que fórmulas longas nunca sejam cortadas horizontalmente.
- **Verificação:** `npm test && npm run build` em `Dossie/`.

---

## Onda 4 — Busca de Personagens no Modo Sessão e Notas Interativas em Objetos

### Cartão `12.4a` (Concluído) — Barra de Pesquisa de Personagens no Modo Sessão (`Atlas`)

- **Objetivo:** Adicionar uma barra de pesquisa por nome para os **Personagens** no painel `Personagens` do Modo Sessão no `Atlas` (atualmente só a seção de Ameaças possui busca). *(O equivalente na `Mesa` será feito no Cartão `M3.1a`).*
- **Arquivos a modificar:**
  - `Atlas/src/ui/Personagens.tsx`
  - `Atlas/src/ui/estilo.css`
- **Especificação técnica:**
  1. Em `Atlas/src/ui/Personagens.tsx`:
     - Crie um signal `const buscaPersonagem = signal('');`.
     - Quando `lista.value.length > 0`, renderize um `<input type="search" class="busca-personagens" data-testid="busca-personagens" placeholder="Buscar personagem…" value={buscaPersonagem.value} onInput={e => { buscaPersonagem.value = (e.target as HTMLInputElement).value; }} />` logo acima da lista de personagens.
     - Filtre `lista.value` por `p.nome.toLowerCase().includes(buscaPersonagem.value.trim().toLowerCase())` (usando normalização sem acento ou `toLowerCase()`).
     - Se a busca não retornar nenhum personagem, exiba `<p class="dock-dica">Nenhum personagem com “{buscaPersonagem.value}”.</p>`.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`.

---

### Cartão `12.5a` (Concluído) — Interação de Nota / Descrição em Objetos Específicos (`Atlas`)

- **Objetivo:** Permitir que o mestre adicione uma **Nota / Descrição inspecionável** a qualquer objeto do mapa (similar às interações de interruptor de luz, gaveta ou pista do Ateliê), para que clicar/interagir com aquele objeto exiba uma nota detalhada (com opção de ser secreta do mestre ou revelável aos jogadores no projetor).
- **Arquivos a modificar:**
  - `Atlas/src/domain/mapa.ts`
  - `Atlas/src/domain/interagiveis.ts`
  - `Atlas/src/domain/validacao.ts`
  - `Atlas/src/ui/Inspetor.tsx`
  - `Atlas/src/ui/CartaoContextual.tsx`
  - `Atlas/src/app/app.ts`
  - `Atlas/src/ui/Editor.tsx`
  - `Atlas/src/ui/estilo.css`
- **Especificação técnica:**
  1. **Domínio (`Atlas/src/domain/mapa.ts`, `interagiveis.ts`, `validacao.ts`):**
     - Em `Interacao` (`mapa.ts` linha 100):
       ```ts
       export interface Interacao {
         kind: 'switch' | 'drawer' | 'clue' | 'note';
         on: boolean;
         targets: string[];
         sound: Ref | null;
         clue: Ref | null;
         note?: string;
         noteTitle?: string;
         gmOnly?: boolean;
       }
       ```
     - Em `validacao.ts`: aceite `kind === 'note'` e valide `note` (`string` opcional), `noteTitle` (`string` opcional) e `gmOnly` (`boolean` opcional).
     - Em `interagiveis.ts`:
       - Adicione `note: 'Nota'` em `ROTULO_DA_INTERACAO`.
       - Em `acaoDoInterativo(o)`: se `i.kind === 'note'`, retorne `'Ler nota'`.
  2. **Inspetor (`Atlas/src/ui/Inspetor.tsx`):**
     - Em `InteracaoDoObjeto` (linhas 390–410):
       - Adicione `['note', 'Nota / Descrição']` nas opções de `CampoEscolha` (`rotulo="Interação"`).
       - Quando `i?.kind === 'note'`, renderize:
         - `CampoTexto` **Título da nota** (`data-campo="Título da nota"`, `valor={i.noteTitle ?? ''}`, placeholder com o nome do objeto, salvando `{ noteTitle: v }`).
         - `<label class="campo" data-campo="Texto da nota"><span class="campo-rotulo">Texto da nota</span><textarea rows={4} data-testid="objeto-nota-texto" placeholder="O que há escrito, escondido ou perceptível neste objeto…" value={i.note ?? ''} onInput={...} /></label>`
         - `CampoCaixa` **Só o mestre vê** (`data-campo="Só o mestre vê"`, `valor={i.gmOnly ?? false}`, salvando `{ gmOnly: v }`).
         - `EscolherCena` (`rotulo="Som ao ler"`, `tipo="efeito"`, `valor={i.sound}`, salvando `{ sound: ref }`).
  3. **Exibição da Nota ao Interagir (`Atlas/src/app/app.ts`, `Atlas/src/ui/Editor.tsx`, `Atlas/src/ui/CartaoContextual.tsx`):**
     - Em `Atlas/src/app/app.ts`, crie um signal `export const notaDeObjetoAberta = signal<{ id: string; titulo: string; texto: string; gmOnly: boolean } | null>(null);`.
     - Em `usarObjeto(id: string)` (`app.ts` linhas 472–495):
       - Quando `inter.kind === 'note'`:
         - Defina `notaDeObjetoAberta.value = { id, titulo: inter.noteTitle?.trim() || o.name || 'Nota', texto: inter.note?.trim() || 'Sem anotações.', gmOnly: inter.gmOnly ?? false }`.
         - Toque o som `inter.sound` (se configurado) e `tocar('papel')`.
         - Se `!inter.gmOnly`, publique também no diário/sessão (`publicarNoCanal` / aviso).
     - Em `Atlas/src/ui/Editor.tsx` (ou num componente leve embutido), quando `notaDeObjetoAberta.value` não for `null`, renderize um cartão/modal elegante `.modal-nota-objeto` (`data-testid="modal-nota-objeto"`) com o título, o texto formatado (preservando quebras de linha), selo `"Só o mestre vê"` (se `gmOnly`), e botão `Fechar (Esc)`.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`, incluindo teste unitário para `interaction.kind === 'note'`.

---

## Onda 5 — Som de Trovão Realista, Botão de Atalhos e Novos Tutoriais

### Cartão `12.6a` — Síntese de Trovão com Reverberação Estéreo (`ConvolverNode`) e Sub-Grave

- **Objetivo:** Substituir a síntese seca de ruído mono em `trovao()` (`Atlas/src/fx/som.ts`) por um trovão atmosférico estéreo com **reverberação acústica real (`ConvolverNode`)**, onda de impacto sub-grave (`30–90 Hz`), saturação elétrica (`WaveShaperNode`) e ecos secundários no céu.
- **Arquivos a modificar:**
  - `Atlas/src/fx/som.ts`
- **Especificação técnica:**
  1. Em `Atlas/src/fx/som.ts`:
     - Crie um gerador de resposta ao impulso estéreo em cache (`obterImpulsoReverb(ctx: AudioContext): AudioBuffer`):
       - `2` canais, duração `3.2` segundos.
       - Preencha os dois canais com reflexões iniciais densas (`0–0.18s`) e decaimento exponencial suave (`Math.pow(1 - i / total, 2.6)`) filtrado por média móvel (absorção de ar nas altas frequências) e descorrelação estéreo entre L e R.
     - Reescreva `trovao(intensidade = 1)`:
       - Crie um `ConvolverNode` com o buffer de reverb estéreo (`ganhoWet = 0.65`) em paralelo com o sinal direto (`ganhoDry = 0.55`), passando por um `DynamicsCompressorNode` suave antes de `contexto.destination`.
       - **Camada 1 — Estalo elétrico e rasgo atmosférico (`0–0.22s`):** ruído rosa/branco filtrado em passa-banda (`900 Hz → 220 Hz`, `Q = 0.9`) com leve saturação (`WaveShaperNode` `Math.tanh(x * 2.5)`) e `StereoPannerNode` levemente deslocado, alimentando forte o reverb.
       - **Camada 2 — Onda de choque sub-grave (`0.02–0.95s`):** oscilador `sine` + `triangle` caindo de `88 Hz` para `26 Hz` (`exponentialRampToValueAtTime`) para dar peso físico ao trovão (sem parecer estática seca).
       - **Camada 3 — Rolamento estéreo nas nuvens (`0.05–3.6s`):** buffer estéreo de 2 canais de ruído marrom profundo (integração dupla suave) passando por filtro passa-baixa com `Q = 0.85` (em vez de `Q = 3.5`, que deixava o som anasalado e seco) varrendo de `210 Hz` a `38 Hz`, com 3 ondulações de envelope (`swells` em `0.12s`, `0.55s` e `1.25s`) simulando os ecos entre as nuvens e o relevo.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`.

---

### Cartão `12.7a` — Correção do Botão e Tecla de Atalhos (`?`) em Todos os Modos

- **Objetivo:** Garantir que o botão e a tecla de **Atalhos (`?`)** funcionem sempre (no cabeçalho normal, no cabeçalho embutido da Mesa, na barra inferior de ferramentas e pelo teclado inclusive em layouts ABNT2), que o modal apareça acima de todos os painéis (`z-index: 220`), feche com `Esc` e permita clicar em qualquer atalho para executá-lo.
- **Arquivos a modificar:**
  - `Atlas/src/app/atalhos.ts`
  - `Atlas/src/ui/Ajuda.tsx`
  - `Atlas/src/ui/Cabecalho.tsx`
  - `Atlas/src/ui/BarraInferior.tsx`
  - `Atlas/src/ui/estilo.css`
- **Especificação técnica:**
  1. **Teclado ABNT2 (`Atlas/src/app/atalhos.ts`):**
     - Em `combina(atalho: string, e: EventoDeTecla)`: quando `c.tecla === '?'` e `tecla === '?'` (ou `e.key === '?'`), se `!c.ctrl && !c.alt`, aceite mesmo que `e.altKey && e.ctrlKey` estejam ativos por causa do `AltGr` (ex.: `AltGr + W` em teclados ABNT2 no Linux/Windows gera `key: '?'` com `ctrlKey + altKey` ou `altKey`!).
  2. **Modal Reativo, Clicável e com `Escape` Global (`Atlas/src/ui/Ajuda.tsx`):**
     - Adicione um `useEffect` em `Ajuda.tsx` que escuta `window.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); ajudaAberta.value = false; } }, true)` enquanto `ajudaAberta.value === true`.
     - Torne cada item `<li>` da lista de atalhos clicável (`onClick={() => { ajudaAberta.value = false; executarAcao(a); }}`), com cursor pointer e efeito hover, para que o usuário possa disparar qualquer atalho diretamente da janela de Atalhos.
     - No cabeçalho de `Ajuda.tsx`, adicione também um botão `"Abrir Tutoriais (Aprender)"` (`data-testid="ajuda-abrir-tutoriais"`) que fecha os atalhos, abre a lista de tutoriais ou navega para a galeria com `aprenderAberto.value = true`.
  3. **Botão Visível no Cabeçalho Embutido e na Barra Inferior (`Cabecalho.tsx` e `BarraInferior.tsx`):**
     - Em `CabecalhoEmbutido` (`Cabecalho.tsx`), adicione o botão `Atalhos (?)` (`data-testid="ajuda-botao"`) ao lado do botão de som.
     - Em `Cabecalho` normal (`Cabecalho.tsx`), adicione o rótulo curto ou mantenha o botão sempre visível (`flex-shrink: 0` em `.cabecalho .grupo`).
     - Em `BarraInferior.tsx` (bloco direito, ao lado do botão de vista de jogador), adicione o botão de atalhos `?` / `⌘` (`data-testid="barra-atalhos"`, `title="Atalhos do teclado (?)"`, `onClick={() => executar('ajuda')}`).
  4. **Camada CSS (`Atlas/src/ui/estilo.css`):**
     - Eleve `.ajuda-fundo` de `z-index: 48` para `z-index: 220` para que nunca fique atrás de popovers (`z-index: 100`), inspeção (`60`) ou painéis flutuantes.
- **Verificação:** `npm run typecheck && npm test` em `Atlas/`.

---

### Cartão `12.8a` — Tutoriais Interativos: "Presença e Corrupção" e "Climas Próprios"

- **Objetivo:** Adicionar dois novos tutoriais guiados passo a passo na seção **Aprender** (`Atlas/src/tutorial/licoes.ts`):
  1. **`presenca` ("Presença e corrupção"):** ensina o que é a ferramenta **Presença (`P`)**, como pintar manchas dinâmicas no chão (sangue, mofo, corrupção paranormal), como ocultá-las dos jogadores (*Só o mestre vê*) e como aumentar/diminuir sua **Intensidade (`0%`–`100%`) ao vivo durante a Sessão** para fazer a corrupção crescer na frente dos jogadores.
  2. **`climas-proprios` ("Criando seu próprio clima"):** ensina como criar uma atmosfera personalizada (ajustando horário, chuva, neblina, vento, frequência de relâmpagos e acabamento), salvá-la com **"+ Salvar este clima…"** (`data-testid="salvar-clima"`) e acioná-la com 1 clique no Dock da Sessão.
- **Arquivos a modificar:**
  - `Atlas/src/tutorial/condicoes.ts`
  - `Atlas/src/tutorial/licoes.ts`
  - `Atlas/tests/unit/tutor.test.ts` (se validar contagem/lista de lições)
- **Especificação técnica:**
  1. Em `Atlas/src/tutorial/condicoes.ts`, adicione as condições:
     - ` ['presencaPintada', pincel?: string]`: verifica se `Object.values(e.doc.presence).some(p => !pincel || p.brush === pincel)`.
     - `['climaSalvo', n = 1]`: verifica se `Object.keys(e.doc.customClimates).length >= n`.
  2. Em `Atlas/src/tutorial/licoes.ts`:
     - Crie a lição `PRESENCA` (`id: 'presenca'`, `titulo: 'Presença e corrupção'`, `pasta: 'cena'`, `minutos: 4`):
       - Passo 1: Explicação (`ler`) do que é **Presença** (camadas procedurais como sangue, mofo, teias ou membrana paranormal cuja intensidade de `0%` a `100%` pode crescer ao vivo na sessão).
       - Passo 2: Pintar uma Sala (`comodo('sala', 'sala', SALA, ...)`).
       - Passo 3: Pegar a ferramenta **Presença** (`ferramenta('presenca', ...)`).
       - Passo 4: Escolher **Corrupção** (`tid('presenca-corrupcao')`) ou **Sangue** e arrastar dentro da sala (`feito: ['presencaPintada', 'corrupcao']`).
       - Passo 5: Entrar no modo **Sessão** (`tid('modo-sessao')`), abrir o painel **Presença** no Dock (`tid('dock-titulo-presenca')`) e ajustar o controle deslizante de intensidade (`ler` final explicando o uso dramático em mesa).
     - Crie a lição `CLIMAS_PROPRIOS` (`id: 'climas-proprios'`, `titulo: 'Criando seu próprio clima'`, `pasta: 'cena'`, `minutos: 4`):
       - Passo 1: Abrir a aba **Mapa** (`tid('aba-mapa')`).
       - Passo 2: Escolher um clima base (`tid('clima-noite')`), ajustar a **Neblina** (`campo('Neblina')`) para `0.6` e a **Chuva** (`campo('Chuva')`) para `0.4`.
       - Passo 3: Clicar em **"+ Salvar este clima…"** (`tid('salvar-clima')`), digitar o nome `Névoa Carmesim` em `[data-testid="nome-clima"]` e confirmar em `[data-testid="confirmar-salvar-clima"]` (`feito: ['climaSalvo', 1]`).
       - Passo 4: Explicação final mostrando que o clima salvo aparece tanto no Inspetor quanto no painel **Clima** do Dock da Sessão e pode ter uma trilha própria do Jukebox.
     - Inclua `PRESENCA` e `CLIMAS_PROPRIOS` em `LICOES` e encadeie `proxima` (`CLIMAS -> PRESENCA -> CLIMAS_PROPRIOS -> SESSAO`).
- **Verificação:** `npm run typecheck && npm test` em `Atlas/` (o teste unitário de tutoriais simula e valida automaticamente os passos e ações de todas as `LICOES`!).
