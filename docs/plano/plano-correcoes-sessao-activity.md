# Plano de Correções e Melhorias — Sessão, Iluminação e Activity (Atlas + Mesa + Dossiê)

> **Direcionado ao Sonnet.** Implementar uma tarefa por vez, com **um commit atômico por tarefa** (seguindo `AGENTS.md` da raiz e dos respectivos projetos, sem `Co-authored-by`, respeitando o limite diário de 45 commits). Validar `typecheck` e `test` após cada tarefa e rodar `npm --prefix Mesa run desktop:prep` ao fim do lote.

---

## Mapa rápido dos 11 pontos → Tarefas

| # | Ponto relatado | Projeto(s) | Tarefa |
| :-: | :--- | :---: | :---: |
| 1 | Fade in/out de expandir e projetar ficha não funciona | `Mesa` (+ `Dossie`) | **Tarefa 1** |
| 2 | Free form em tempo real na Activity só funciona em players (não em ameaças) | `Atlas` | **Tarefa 2** |
| 3 | Mover token (grid/free form) faz token escuro acender por ~0,5 s | `Atlas` | **Tarefa 3** |
| 4 | Ameaça na sala escura sob lanterna do jogador fica completamente preta | `Atlas` | **Tarefa 3** |
| 5 | Aviso vermelho `"Não deu: Outro mapa está aberto."` ao mover personagem como player | `Atlas` | **Tarefa 4** |
| 6 | Zoom in/out na Activity instantâneo em vez de fluido/animado | `Atlas` | **Tarefa 5** |
| 7 | Mudar iniciativa deve selecionar o personagem automaticamente (e mover câmera em "Seguindo") | `Atlas` | **Tarefa 6** |
| 8 | Customizar alcance (range) e cor da fonte de luz da peça (lanterna, lamparina, vela...) | `Atlas` | **Tarefa 7** |
| 9 | Apagar luzes e deletar objetos no modo sessão | `Atlas` | **Tarefa 8** |
| 10 | Cards de ficha cortados (redimensionar) + remover barra `"FICHAS / AGENTE / STATS..."` em ameaças | `Atlas` + `Dossie` | **Tarefa 9** |
| 11 | Ficha de ameaça no Mesa pede upload do livro de regras sem opção (já feito no navegador) | `Dossie` (+ `Mesa`) | **Tarefa 10** |

---

## Tarefa 1 (Mesa + Dossiê) — Corrigir fade in/fade out ao expandir e projetar ficha

**Causa raiz:**
- Em [`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx#L448-L532) e [`Mesa/src/jogar/casca.css`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/casca.css#L5-L15):
  1. Quando o usuário expande ou projeta a ficha, `ATRASO_PREPARO_FICHA_MS = 50` ms é curto demais para o `iframe` do Dossiê trocar de layout (`vista=card` ↔ `vista=completa` / `dossie:projetar-ficha`) — e no modo `espectador` (`Casca.tsx:756`) o `iframe` é montado do zero só quando `projetandoFicha` vira `true`, então os `220 ms` de transição já terminaram antes de o documento do `iframe` carregar e pintar.
  2. Ao trocar `preparando` (`transition: none; opacity: 0`) → `ativa` (`opacity: 1`), um único `requestAnimationFrame` + `setTimeout(50)` nem sempre garante commit do frame `opacity: 0` no compositor do Chromium/Electron (Discord Activity), fazendo o elemento saltar direto para `opacity: 1`.
  3. Ao fechar (`saindo` → `inativa`), após `220 ms` o `data-ficha` volta de `'completa'` para `'painel'`, mas a transição de volta do painel lateral não anima `opacity: 0 → 1`, causando um pop brusco.

**Arquivos:**
- [`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx)
- [`Mesa/src/jogar/casca.css`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/casca.css)
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js) (ou onde trata `dossie:vista` / `dossie:projetar-ficha`)

**O que implementar:**
1. **Sincronizar entrada com prontidão do `iframe`:**
   - No `Dossie`, logo após aplicar `dossie:vista` ou `dossie:projetar-ficha` e concluir o `render()`, emitir `window.parent.postMessage({ tipo: 'dossie:vista-aplicada' }, location.origin)` no próximo `requestAnimationFrame`.
   - Em `Casca.tsx`: na fase `'preparando'` (tanto para `faseProjecao` quanto para `faseExpandida`), aguardar **dois `requestAnimationFrame` consecutivos** (garantindo commit do `opacity: 0` no compositor) **e** o sinal `dossie:vista-aplicada` (ou `onLoad` caso o iframe tenha acabado de montar no modo `espectador`), com um fallback máximo de `180 ms` para não travar caso o Dossiê esteja lento.
2. **Transição garantida via CSS (`casca.css`):**
   - Manter `transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)` ativo também na entrada, usando um estado inicial explícito em `preparando` (`opacity: 0; transform: scale(0.985); transition: none;`) e em `ativa` (`opacity: 1; transform: scale(1);`), e em `saindo` (`opacity: 0; transform: scale(0.985); pointer-events: none;`).
   - Verificar que nenhuma regra posterior com mesma especificidade sobrescreva `opacity` ou `transition` (conferir interação com `.casca[data-ficha-recolhida='1'] .casca-ficha` e `.casca[data-projetando-ficha='1'] .casca-ficha` — se necessário, usar `@keyframes casca-ficha-entra` / `casca-ficha-sai` em `data-*-fase='ativa'` e `data-*-fase='saindo'`, que não dependem de timing de reflow do `transition: none`!).
   - **Recomendação forte:** `@keyframes` com `animation: casca-ficha-fade-in 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards` (em `ativa`) e `animation: casca-ficha-fade-out 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards` (em `saindo`) é imune ao bug de colapso de estilo do Chromium em `iframe`s!
   - No `saindo` de expandir ficha, quando `!fichaRecolhida`, ao voltar para `'painel'`, fazer a barra lateral reaparecer suavemente (ou usar uma fase breve de retorno) sem flash.
3. **Testes:** atualizar/adicionar teste em `Mesa/tests/` validando a sequência `preparando` → `ativa` → `saindo` → `inativa` tanto para expandir ficha quanto para projetar ficha (inclusive com `espectador = true`).

---

## Tarefa 2 (Atlas) — Movimento free form em tempo real na Activity para ameaças / NPCs

**Causa raiz:**
- Em [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts#L379):
  ```ts
  if (algum() && !parado && t && t.player && andarDe(t) === andarDoProjetor.peek()) {
  ```
  O filtro `&& t.player` impede o envio de `peca-gesto` durante o arrasto de qualquer ficha que não seja de jogador (ameaças/NPCs). Por isso, a ameaça só atualiza na Activity quando o mestre solta o mouse e `enviarEstado()` dispara.

**Arquivos:**
- [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts)
- [`Atlas/tests/unit/projetor.test.ts`](file:///home/ilvro/Documents/Projects/Atlas/tests/unit/projetor.test.ts) (ou arquivo de testes do projetor)

**O que implementar:**
1. Em `Atlas/src/app/projetor.ts:379-396`:
   - Remover a exigência `t.player` da condição geral de `peca-gesto`.
   - Preservar anti-spoiler para ameaças/NPCs (`!t.player`):
     - Calcular `const filtro = filtroDeVisao.peek(); const filtroFoco = filtro.tipo === 'foco' ? filtro : undefined;`
     - `const visivel = t.player || pontoVisivelAgora(e.documento, t.position, t.size * e.documento.grid.size * 0.35, filtroFoco);`
     - Enviar `peca-gesto` para `'local'` e `'remoto'` apenas se `visivel` (ou `e.documento.session.explored === null` no caso sem névoa).
   - **Caso de borda (ameaça saindo da sombra durante o arrasto):** se `!t.player && visivel`, mas a ameaça ainda não estava visível no último `estado` enviado (`!ameacasVisiveisNoUltimoEstado.has(tokenId)`), disparar `agendar(80)` para enviar um `estado` contendo a ameaça (já que `Projetor.tsx:254-255` ignora `peca-gesto` se o token ainda não existir em `store.documento.tokens`). Se `!t.player && !visivel` e ela *estava* visível antes, também agendar `estado` para removê-la da tela dos jogadores.
   - Nota: só enviar `caixa` / `seguir: true` em `peca-gesto` quando `seguir` estiver ativo e `t` for o alvo seguido (ou `t.player`).
2. **Testes:** adicionar teste unitário garantindo que arrastar um token `!t.player` visível envia `peca-gesto` para `'remoto'`, e que arrastar um token `!t.player` fora da visão **não** envia `peca-gesto` (anti-spoiler).

---

## Tarefa 3 (Atlas) — Corrigir iluminação e shadowcast em tokens (ameaça preta sob lanterna + flash aceso ao mover)

**Causa raiz (explica os pontos 3 e 9 de uma vez):**
1. **Ameaça preta sob a lanterna (Print 2):**
   - Em [`Atlas/src/render/mapa-de-luz.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/mapa-de-luz.ts#L289), `oclusoresDeTokens(m, nivel)` cria um polígono oclusor centrado na posição de **cada token** (para projetar sombra no chão atrás dele).
   - O polígono iluminado `g.poligono` da lanterna para na **borda frontal** desse oclusor, deixando o centro `t.position` da ameaça **fora** de `g.poligono`.
   - Em [`Atlas/src/render/cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts#L644) → [`mapa-de-luz.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/mapa-de-luz.ts#L198), `amostrarPonto([v.c.x, v.c.y])` testa `pontoNoPoligonoPlano(ponto, poligono)` no **centro exato** da ameaça → retorna `false` → a ameaça recebe luz `0` (só `piso = 0.02`), ficando completamente preta!
2. **Token escuro acendendo por ~0,5 s ao mover (grid ou free form):**
   - Enquanto o token desliza (`desliza` de `160–600 ms` em `pecas.ts:245`), `oclusoresDeTokens` já pulou para o destino `t.position` do documento, deixando `[v.c.x, v.c.y]` fora do próprio oclusor durante o deslize → acende por meio segundo e apaga ao chegar!
   - Além disso, em [`mapa-de-luz.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/mapa-de-luz.ts#L782), `luz.sincronizar` marca `g.versaoGeo = -1` sem reconstruir `g.poligono` imediatamente, e `cena.ts:856` chama `atualizarLuzDasPecas()` logo em seguida. Em [`mapa-de-luz.ts:198`](file:///home/ilvro/Documents/Projects/Atlas/src/render/mapa-de-luz.ts#L198), quando `poligono` é `null` (`g.poligono.length < 6`), o teste de oclusão é **pulado**, fazendo a luz atravessar paredes e iluminar o token no escuro até o próximo `quadro()`!
   - Por fim, [`mapa-de-luz.ts:881`](file:///home/ilvro/Documents/Projects/Atlas/src/render/mapa-de-luz.ts#L881) monta `luz: { ...g.luz, position: g.posVisual }` sem atualizar `cone.direction` com `g.dirVisual`.

**Arquivos:**
- [`Atlas/src/render/mapa-de-luz.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/mapa-de-luz.ts)
- [`Atlas/src/render/cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts)
- [`Atlas/src/domain/visibilidade.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/domain/visibilidade.ts) (consultar o raio exato usado em `oclusoresDeTokens`)
- Testes unitários de `mapa-de-luz` / `calcularLuzNoPonto`

**O que implementar:**
1. **Assinatura de `amostrarPonto` e `calcularLuzNoPonto`:**
   - Adicionar parâmetro opcional `raioToken = 0` em `amostrarPonto(ponto: Ponto, raioToken?: number)` e em `opcoes` de `calcularLuzNoPonto`.
   - Em `calcularLuzNoPonto` (`mapa-de-luz.ts:188-205`):
     - Se `poligono === null` (ou `poligono.length < 6`) para uma luz que exige oclusão (ou seja, não está no mesmo ponto e `exigePoligono !== false`), **não iluminar** (em vez de ignorar oclusão!).
     - Se `luz.cone` existe, validar também que o ponto (ou `pontoFace`) está dentro do cone de direção `luz.cone.direction` e abertura `luz.cone.angle` (além do polígono).
     - **Amostragem na face voltada para a luz (resolve o auto-sombreamento sem atravessar paredes):**
       - Quando `raioToken > 0` e `!noMesmoPonto`:
         ```ts
         const desloc = Math.min(dist * 0.85, raioToken + 0.08);
         const pontoFace: Ponto = [ponto[0] - (dx / dist) * desloc, ponto[1] - (dy / dist) * desloc];
         ```
       - Testar `pontoNoPoligonoPlano(pontoFace, poligono)` (ou `pontoNoPoligonoPlano(ponto, poligono)` como fallback quando `raioToken === 0`).
       - Usar `Math.max(0, dist - desloc * 0.5)` (ou `dist`) para a queda radial, garantindo que um token na frente da lanterna receba a luz plena, enquanto um token atrás de uma parede ou em sala escura continue 100% fora do polígono (tanto parado quanto em movimento!).
2. **Garantir geometria atualizada antes de amostrar:**
   - Em `amostrarPonto` (`mapa-de-luz.ts:875-894`):
     - Se `oclusao` existir e algum `g` com `g.alfa > 0.01` tiver `g.versaoGeo !== oclusao.versaoEstatica` (incluindo `-1`), chamar `atualizarGeometria(g, g.luz, g.posVisual, g.dirVisual)` antes de testar `g.poligono`.
     - Atualizar `cone` com `g.dirVisual`:
       `const luzComVisual = g.luz.cone && g.dirVisual !== null ? { ...g.luz, position: g.posVisual, cone: { ...g.luz.cone, direction: g.dirVisual } } : { ...g.luz, position: g.posVisual };`
3. **Passar o raio do oclusor do token em `cena.ts:634-650`:**
   - Em `atualizarLuzDasPecas()`: calcular `const raioOclusor = t.size * mapa.grid.size * 0.32;` (conferir o fator exato em `oclusoresDeTokens` em `visibilidade.ts` e usar exatamente esse raio + folga de `0.08 m`) e chamar `const rgb = luz.amostrarPonto(pos, raioOclusor);`.
4. **Testes:**
   - Testar que um token posicionado dentro do cone de uma lanterna (com `oclusoresDeTokens` ativo) recebe iluminação > 0 em `amostrarPonto(pos, raioOclusor)`.
   - Testar que um token atrás de uma parede fechada recebe apenas luz ambiente (sem flash), mesmo quando `g.versaoGeo === -1` ou `poligono === null`.

---

## Tarefa 4 (Atlas) — Corrigir aviso `"Não deu: Outro mapa está aberto."` ao mover peça como player

**Causa raiz:**
- Em [`Atlas/src/app/app.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/app.ts#L182-L196), toda instância do Atlas na origem registra `s.barramento?.atender('atlas.mover-peca', ...)` usando apenas `obterSessaoParaProjetor()?.store ?? sessao.value?.store ?? null`.
- Dois problemas acontecem:
  1. Em [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts#L328), quando o projetor remoto conecta (`ehOla`), `projetorRemotoConectado.value = true` é ligado, mas `mapaNoProjetorId.value` não é fixado para `id`. Se o mestre trocar de aba ou abrir outro mapa no editor, `obterSessaoParaProjetor()` aponta para o mapa errado e devolve `{ ok: false, motivo: 'Outro mapa está aberto.' }`!
  2. Se o mestre tiver **duas** instâncias do Atlas abertas na mesma origem (ex.: iframe do Atlas no `ModoSessao` do Mesa + outra aba do Atlas no navegador/desktop), a instância que está na galeria ou com outro mapa aberto **responde imediatamente** `{ ok: false, motivo: 'Outro mapa está aberto.' }` no `BroadcastChannel('mesa:eventos')`, vencendo a corrida antes da instância certa responder `{ ok: true }`!

**Arquivos:**
- [`Atlas/src/app/app.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/app.ts)
- [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts)
- [`Atlas/src/app/mover-peca-remota.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/mover-peca-remota.ts)
- [`Atlas/mesa-core/`](file:///home/ilvro/Documents/Projects/Atlas/mesa-core/) (apenas verificar se `barramento.atender` suporta ignorar / retornar `undefined` sem enviar resposta — não quebrar contrato!)

**O que implementar:**
1. Em `Atlas/src/app/projetor.ts:328`: ao receber `ola` no `canalRemoto`, se `mapaNoProjetorId.peek() === null`, definir `mapaNoProjetorId.value = id`.
2. Em `Atlas/src/app/app.ts`:
   - Criar helper `obterStorePorMapaId(mapaId: string): Store | null` que procura, nesta ordem:
     1. `obterSessaoParaProjetor()` (se o `doc.id === mapaId`),
     2. `sessao.value` (se o `doc.id === mapaId`),
     3. `cacheDeSessoes.get(mapaId)` (qualquer aba aberta no editor).
   - No handler de `'atlas.mover-peca'` (`app.ts:182-196`):
     - Primeiro tentar `obterStorePorMapaId(d.mapa)`.
     - Se esta instância **não** tem `d.mapa` aberto **e** `!projetorRemotoConectado.peek()` (ou seja, esta aba/janela nem é a que está projetando para a sala), **não responder erro falso** (verificar em `mesa-core` como `atender` trata resposta omitida; se `atender` sempre exige retorno, registrar o listener apenas na instância ativa/publicadora ou ouvir o pedido bruto e só enviar `mesa.resposta` quando tiver o mapa ou quando for o publicador remoto ativo!).
     - Se esta instância *é* o publicador remoto ativo (`projetorRemotoConectado.peek()`) e `d.mapa` realmente não bate com nenhuma aba aberta, aí sim retornar `{ ok: false, motivo: 'Outro mapa está aberto.' }`.
3. **Testes:** testar em `mover-peca-remota.test.ts` (ou `app.test.ts`) o lookup em `cacheDeSessoes` quando o mestre está visualizando outra aba enquanto projeta o mapa A, e que instâncias não-publicadoras com outro mapa não respondem erro.

---

## Tarefa 5 (Atlas) — Zoom in/out fluido (animado) na Activity

**Causa raiz:**
- Em [`Atlas/src/ui/Projetor.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Projetor.tsx#L358-L372), `aoRolarJanela` aplica `vp.definirCamera(zoomEm(vp.camera, [mx, my], fator))` instantaneamente a cada evento `wheel`, sem suavização.

**Arquivos:**
- [`Atlas/src/render/viewport.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/viewport.ts)
- [`Atlas/src/ui/Projetor.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Projetor.tsx)

**O que implementar:**
1. Em `Atlas/src/render/viewport.ts`:
   - Expor `zoomSuaveEm(pontoTela: Ponto, fator: number): void` na interface `Viewport`.
   - Manter estado `zoomAnim: { alvo: Camera; ultimoMs: number } | null = null`.
   - Ao chamar `zoomSuaveEm(pontoTela, fator)`:
     - Se `movimentoReduzido()`, chamar `definirCamera(zoomEm(camera, pontoTela, fator))` direto.
     - Caso contrário, cancelar `camAnim = null` e calcular o novo alvo acumulando sobre o alvo atual (se `zoomAnim` já estiver ativo) ou sobre `camera`: `const base = zoomAnim ? zoomAnim.alvo : camera; zoomAnim = { alvo: zoomEm(base, pontoTela, fator), ultimoMs: performance.now() };`.
   - No ticker (`viewport.ts:1440`), quando `zoomAnim` estiver ativo:
     - Interpolar exponencialmente (`const f = 1 - Math.exp(-dt / 85);` — suave e responsivo, ~85 ms de constante de tempo) `x`, `y` e `zoom` (idealmente interpolando `Math.log(zoom)` para sensação linear no zoom in/out!).
     - Quando a diferença for desprezível (`Math.abs(alvo.zoom - camera.zoom) / camera.zoom < 1e-3 && Math.hypot(alvo.x - camera.x, alvo.y - camera.y) < 0.5`), cravar `definirCamera(alvo)` e limpar `zoomAnim = null`.
   - Limpar `zoomAnim = null` quando o usuário iniciar `pan`, `pinça` ou `enquadrarCaixa`.
2. Em `Atlas/src/ui/Projetor.tsx:367`:
   - Trocar `vp.definirCamera(zoomEm(vp.camera, [e.clientX - r.left, e.clientY - r.top], fator))` por `vp.zoomSuaveEm([e.clientX - r.left, e.clientY - r.top], fator)`.
   - No projetor local (L370), também usar `enquadrarCaixa(caixaComZoom(caixaDoMestre), true)` ou `zoomSuaveEm` quando solto.
3. **Testes:** teste unitário verificando que `zoomSuaveEm` converge suavemente para o zoom alvo e acumula múltiplos eventos `wheel` consecutivos sem saltar.

---

## Tarefa 6 (Atlas) — Seleção automática do personagem ao mudar a iniciativa (integrado com "Seguindo")

**Causa raiz:**
- Em [`Atlas/src/ui/Dock.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Dock.tsx#L216-L217) e [`Atlas/src/app/ponte-iniciativa.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/ponte-iniciativa.ts#L150), avançar/voltar a iniciativa executa `iniciativa.passo`, mas não seleciona o token atual no mapa nem atualiza `jogadorSeguido`.
- Além disso, [`SeletorDeJogadorSeguido.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/SeletorDeJogadorSeguido.tsx#L6) e [`caixaDosJogadores`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts#L131-L137) filtram apenas `t.player`, ignorando combatentes não-jogadores (ameaças) que estejam na iniciativa.

**Arquivos:**
- [`Atlas/src/ui/Dock.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Dock.tsx)
- [`Atlas/src/ui/SeletorDeJogadorSeguido.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/SeletorDeJogadorSeguido.tsx)
- [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts)
- [`Atlas/src/app/ponte-iniciativa.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/ponte-iniciativa.ts)

**O que implementar:**
1. Criar helper `focarTurnoAtualDaIniciativa(s: SessaoDeEdicao)`:
   - Lê `const ini = s.store.documento.session.initiative; const tokenId = ini?.order[ini.current]?.tokenId;`.
   - Se `tokenId && s.store.documento.tokens[tokenId]`:
     - Seleciona o token na sessão: `s.selecao.value = [{ colecao: 'tokens', id: tokenId }];`.
     - Atualiza `jogadorSeguido.value = tokenId;` (assim o seletor no menu de iniciativa já muda automaticamente para o personagem do turno atual!).
     - Se `seguirJogadores.peek()` estiver ativo, chama `forcarCameraRemota()` para enquadrar a câmera da Activity imediatamente nesse personagem.
2. Chamar `focarTurnoAtualDaIniciativa(s)` após:
   - `iniciativa.iniciar` (`Dock.tsx:241` e `ponte-iniciativa.ts:138`),
   - `iniciativa.passo` (`+1` e `-1`, `Dock.tsx:216-217` e `ponte-iniciativa.ts:150`).
3. Em `SeletorDeJogadorSeguido.tsx` e `projetor.ts` (`caixaDosJogadores`, L131-137, e `andarAtual`, L201):
   - Permitir que `jogadorSeguido` aponte tanto para `t.player` quanto para qualquer token presente na iniciativa ativa (em `caixaDosJogadores`: aceitar `alvo` se `alvo.player || m.session.initiative?.order.some(e => e.tokenId === alvo.id)`).
   - No `SeletorDeJogadorSeguido.tsx`, quando houver iniciativa ativa, listar os combatentes da iniciativa (ou jogadores + ameaça do turno atual) para que o `<select>` reflita corretamente o personagem selecionado.
   - **Anti-spoiler:** se `alvo` for uma ameaça (`!alvo.player`) que não está visível aos jogadores na projeção remota, `caixaRemota` não deve revelar a posição oculta dela (manter enquadre nos jogadores).
4. **Testes:** testar que avançar iniciativa seleciona o token atual, atualiza `jogadorSeguido` e, com `seguirJogadores = true`, atualiza `caixaDoProjetor` para o novo turno.

---

## Tarefa 7 (Atlas) — Customizar alcance (range) e cor da fonte de luz da peça

**Causa raiz:**
- [`Atlas/src/app/luz-da-peca.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/luz-da-peca.ts) e [`Atlas/src/ui/CartaoContextual.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/CartaoContextual.tsx#L276-L303) só permitem ligar/desligar a luz e trocar o preset (`lanterna`, `lamparina`, `tocha`, `vela`), sem controles para editar `radius` e `color` da luz vinculada (`m.lights[token.lightId]`).

**Arquivos:**
- [`Atlas/src/app/luz-da-peca.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/luz-da-peca.ts)
- [`Atlas/src/ui/CartaoContextual.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/CartaoContextual.tsx)
- [`Atlas/src/ui/Inspetor.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Inspetor.tsx) (onde edita propriedades de token)
- [`Atlas/src/ui/estilo.css`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/estilo.css)

**O que implementar:**
1. Em `Atlas/src/app/luz-da-peca.ts`:
   - Exportar `atualizarLuzDaPeca(store: Store, pecaId: string, patch: { radius?: number; color?: string }): boolean`:
     - Busca `t = store.documento.tokens[pecaId]` e `luz = t?.lightId ? store.documento.lights[t.lightId] : undefined`.
     - Se existir, normaliza `radius` (clamp `1` a `40` m) e `color` (`#rrggbb`), e executa `{ tipo: 'item.atualizar', colecao: 'lights', id: luz.id, patch }` com `{ rotulo: 'Ajustar luz da peça', fusao: \`luz-peca:${luz.id}\` }`.
   - Exportar `restaurarPadraoLuzDaPeca(store: Store, pecaId: string): boolean` que reaplica `radius` e `color` do preset original da luz.
2. Em `CartaoContextual.tsx` (seção `emSessao && a.colecao === 'tokens'`, logo após o botão/select de luz) e no `Inspetor.tsx` (quando um token tem `token.lightId`):
   - Quando a luz da peça existir e estiver ligada (`luzAtual?.on`), mostrar um controle compacto (ou popover/linha extra limpa):
     - Slider/input de **alcance** (`1` a `30` m, passo `0.5`, exibindo ex. `8m`),
     - Seletor de **cor** (`<input type="color" value={luzAtual.color} />`),
     - Opcionalmente um botão compacto `↺` para restaurar alcance/cor padrão do preset.
   - Garantir que `onInput` atualize em tempo real (com `fusao` para não poluir o histórico de Ctrl+Z).
3. **Testes:** testar `atualizarLuzDaPeca` (clamp de raio, cor válida, fusão no histórico) e renderização dos controles no `CartaoContextual`.

---

## Tarefa 8 (Atlas) — Permitir apagar luzes e deletar objetos no modo sessão

**Causa raiz:**
- Em [`Atlas/src/ui/CartaoContextual.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/CartaoContextual.tsx#L257-L267) e [`L359`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/CartaoContextual.tsx#L359):
  - No `emSessao`, para `props` sem interação/transição retorna `null` (sem botão de remover).
  - Para `lights`, a linha `else if (emSessao && a.colecao !== 'openings') return null;` bloqueia totalmente o cartão contextual!
- Em [`Atlas/src/app/acoes.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/acoes.ts#L112-L118), verificar se `comSelecao` bloqueia `remover` (`Delete`/`Backspace`) e `luz-acesa` (`I`) no modo sessão.

**Arquivos:**
- [`Atlas/src/ui/CartaoContextual.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/CartaoContextual.tsx)
- [`Atlas/src/app/acoes.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/acoes.ts)
- [`Atlas/src/app/app.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/app.ts) (`removerSelecao` / `alternarLuzes`)

**O que implementar:**
1. Em `Atlas/src/ui/CartaoContextual.tsx`:
   - Em `emSessao && a.colecao === 'props'` (L257-267): não retornar `null` quando não há interação/transição; incluir sempre o botão de remover objeto (`<Acao icone="lixeira" rotulo="Remover objeto (Del)" aoClicar={removerSelecao} perigo id="cartao-remover" />`).
   - Adicionar ramo `else if (emSessao && a.colecao === 'lights')`:
     - Ler `const l = m.lights[a.id]!;`
     - Exibir botão de **acender/apagar** (`<Acao icone="luz" rotulo={l.on ? 'Apagar luz (I)' : 'Acender luz (I)'} ativo={l.on} aoClicar={alternarLuzes} id="cartao-luz" />`),
     - Exibir botão de **remover luz** (`<Acao icone="lixeira" rotulo="Remover luz (Del)" aoClicar={removerSelecao} perigo id="cartao-remover" />`).
2. Em `Atlas/src/app/acoes.ts`:
   - Verificar a definição de `comSelecao`: se ela bloqueia `modo.value === 'sessao'`, permitir:
     - `remover` (`Delete`/`Backspace`) no modo sessão quando a seleção contiver apenas `props` e/ou `lights` (evitando deletar cômodos/paredes/tokens por acidente no modo sessão, ou permitindo conforme a seleção de `props`/`lights`).
     - `luz-acesa` (`I`) no modo sessão quando a seleção contiver `lights`.
3. **Testes:** testar no modo sessão que selecionar um `prop` mostra botão de remover e responde a `Delete`, e selecionar uma `light` mostra acender/apagar + remover e responde a `I` e `Delete`.

---

## Tarefa 9 (Atlas + Dossiê) — Redimensionar cards de ficha + corrigir corte e remover barra inferior em ameaças

**Causa raiz (Print 1):**
- Em [`Atlas/src/ui/PreviaDaFicha.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/PreviaDaFicha.tsx) e [`Atlas/src/ui/estilo.css`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/estilo.css#L322), `.previa-da-ficha` tem tamanho fixo (~`380×500 px`), sem opção de redimensionar, cortando o atributo `VIG` e o texto à direita.
- Em [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L1506-L1539), `renderBottomNav()` renderiza a barra mobile `"FICHAS / AGENTE / STATS / CARTAS / HISTÓRIA / MODELO / ROLAGENS"` mesmo quando `state.systemMode === 'threat'` (ficha de ameaça), onde essas abas não existem nem funcionam!

**Arquivos:**
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)
- [`Dossie/src/styles.css`](file:///home/ilvro/Documents/Projects/Dossie/src/styles.css) (regras responsivas da ficha de ameaça)
- [`Atlas/src/app/previa-ficha.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/previa-ficha.ts)
- [`Atlas/src/ui/PreviaDaFicha.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/PreviaDaFicha.tsx)
- [`Atlas/src/ui/estilo.css`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/estilo.css)

**O que implementar:**
1. **Remover barra inferior em fichas de ameaça (`Dossie/src/app.js:1506`):**
   - No início de `renderBottomNav()`, retornar `''` quando `state?.systemMode === 'threat'` (e também remover o `padding-bottom` reservado à bottom-nav no CSS quando a página for de ameaça, para liberar espaço útil no card!).
2. **Evitar corte horizontal em fichas de ameaça em largura estreita (`Dossie/src/styles.css`):**
   - Em `@media (max-width: 520px)` (ou container query / classe de card compacto):
     - Fazer a barra de atributos (`AGI / FOR / INT / PRE / VIG`) usar `flex-wrap: wrap` ou `grid-template-columns: repeat(5, minmax(0, 1fr))` com gap e fonte reduzidos para caber confortavelmente em `360–420 px` sem cortar `VIG`.
     - Garantir `max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere;` nas descrições de ações e cabeçalhos de resistência/vulnerabilidade.
3. **Cards redimensionáveis no Atlas (`PreviaDaFicha.tsx` + `previa-ficha.ts` + `estilo.css`):**
   - Criar signal `tamanhoPrevia = signal<{ largura: number; altura: number }>` em `previa-ficha.ts`, inicializado a partir de `localStorage` (`atlas:previa-ficha-tamanho`) com padrão um pouco mais confortável (ex.: `440 × 540 px`, respeitando limites `min: 320×320`, `max: Math.min(900, innerWidth - 24) × Math.min(900, innerHeight - 72)`).
   - Adicionar alças de redimensionamento discretas na borda direita, borda inferior e canto inferior-direito (`nwse-resize`, `ew-resize`, `ns-resize`) de `.previa-da-ficha`.
   - Durante o resize, ativar `.arrastando` (que já aplica `pointer-events: none` no `iframe`, evitando que o iframe roube eventos de mouse!), atualizar `tamanhoPrevia` e salvar no `localStorage` ao soltar.
   - Atualizar `calcularPosicaoDaPrevia` para receber a `largura` e `altura` atuais em vez de constantes fixas.
4. **Testes:** testar `calcularPosicaoDaPrevia` com tamanhos customizados e testar que `renderBottomNav` retorna vazio para fichas de ameaça.

---

## Tarefa 10 (Dossiê + Mesa) — Permitir desbloqueio do livro de regras dentro do Mesa e compartilhar licença localmente

**Causa raiz:**
- [`Dossie/src/services/bestiary-license.js`](file:///home/ilvro/Documents/Projects/Dossie/src/services/bestiary-license.js#L31-L49) guarda a validação do PDF apenas em `localStorage.getItem('ordem_bestiary_license')`.
- No app desktop da Mesa (WebView com origem própria, diferente do navegador externo onde o usuário já validou o PDF), esse `localStorage` vem vazio.
- Além disso, quando uma ameaça é aberta embutida no Mesa (ex.: `ModoSessao` ou card), o usuário vê o bloqueio (`renderLockedThreatDossier`), mas não consegue acionar o upload do PDF de forma clara/direta (ou o botão não está ligado ao modal naquela vista embutida).

**Arquivos:**
- [`Dossie/src/systems/threat/threat-license-ui.js`](file:///home/ilvro/Documents/Projects/Dossie/src/systems/threat/threat-license-ui.js)
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js) (`data-open-bestiary-unlock` / `data-open-bestiary-license-modal`)
- [`Dossie/src/services/bestiary-license.js`](file:///home/ilvro/Documents/Projects/Dossie/src/services/bestiary-license.js)
- [`Dossie/src/styles.css`](file:///home/ilvro/Documents/Projects/Dossie/src/styles.css)

**O que implementar:**
1. **Garantir que o botão de upload na tela bloqueada funcione em qualquer vista do mestre (incluindo embutido no Mesa e card):**
   - Auditar `renderLockedThreatDossier` em `threat-license-ui.js` e os listeners em `Dossie/src/app.js:5007`!
   - Note que `threat-license-ui.js:43` usa `data-open-bestiary-unlock`, enquanto `Dossie/src/app.js:5007` escuta `data-open-bestiary-license-modal` — verificar se **todos** os botões da tela de ficha bloqueada disparam o modal de upload de PDF (ou incluir um `<input type="file" accept=".pdf,application/pdf">` direto na tela de bloqueio caso o modal não abra em vista compacta!).
   - Garantir que `body[data-modo-jogador="1"]` continue ocultando o botão para jogadores, mas que no modo embutido do mestre (`?embutido=1` / `Mesa` desktop) o botão fique **sempre visível e clicável**.
2. **Sincronizar desbloqueio entre abas/iframes na mesma origem (`Mesa` desktop):**
   - Em `bestiary-license.js`: ouvir `window.addEventListener('storage', ...)` para a chave `ordem_bestiary_license` e disparar `bestiary-license-changed`, para que validar o PDF em uma aba/card do Dossiê dentro do Mesa **desbloqueie instantaneamente todas as outras abas e cards abertos** sem precisar recarregar!
3. **Verificação no desktop:** conferir que `<input type="file" accept="application/pdf">` abre o seletor de arquivos normalmente dentro do WebView do Mesa desktop (sem bloqueio de sandbox no `<iframe>` de `ModoSessao.tsx:120` e `PreviaDaFicha.tsx:195`).

---

## Checklist final (após concluir todas as tarefas)

- [ ] `npm --prefix Atlas run typecheck && npm --prefix Atlas test`
- [ ] `npm --prefix Mesa run typecheck && npm --prefix Mesa test`
- [ ] `npm --prefix Dossie run build` (se houver build/testes no Dossiê)
- [ ] `npm --prefix Mesa run desktop:prep`
- [ ] Conferir manualmente na Activity e no modo sessão:
  - Fade in/out de expandir e projetar ficha;
  - Arrasto free form em tempo real de ameaça na Activity;
  - Ameaça iluminada sob a lanterna + sem flash aceso ao mover no escuro;
  - Movimento de player na Activity sem aviso `"Outro mapa está aberto."`;
  - Zoom suave com scroll na Activity;
  - Avançar iniciativa seleciona token e move câmera em "Seguindo";
  - Customizar alcance/cor de luz da peça;
  - Apagar luzes e deletar objetos em sessão;
  - Card de ficha redimensionável, sem corte e sem barra mobile em ameaças;
  - Upload/desbloqueio do livro de regras funcionando dentro do Mesa.
