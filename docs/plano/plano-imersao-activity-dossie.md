# Plano de Melhorias e Correções — Imersão na Activity, Saguão e Rolagens (Atlas + Mesa + Dossiê)

> **Direcionado ao Sonnet.** Implementar uma tarefa por vez, com **um commit atômico por tarefa** (seguindo `AGENTS.md` da raiz e dos respectivos projetos, sem `Co-authored-by`, respeitando o limite diário de 45 commits). Validar `typecheck` e `test` após cada tarefa e rodar `npm --prefix Mesa run desktop:prep` ao fim do lote.

---

## Mapa rápido dos 5 pontos → Tarefas

| # | Ponto relatado | Projeto(s) | Tarefa |
| :-: | :--- | :---: | :---: |
| 1 | Bug de reset dos efeitos de PV/PD baixo ao fazer ações na ficha (pavor, lesão, trauma, trocar modo Vigília/Cinematográfica/Tradicional) | `Dossie` | **Tarefa 1** |
| 2 | Aplicar efeitos de PV e PD baixo na tela da própria Activity / sobre o mapa | `Dossie` + `Mesa` | **Tarefa 2** |
| 3 | Sumiço do card e falta de fade-in/fade-out perceptível ao expandir ficha e voltar ao mapa | `Dossie` + `Mesa` | **Tarefa 3** |
| 4 | Rolagem 3D abrindo como padrão em cards/ameaças (em vez da 2.5D) e 3D auto-rolando sem deixar mexer os dados | `Dossie` | **Tarefa 4** |
| 5 | Escolher fichas no Saguão direto por uma view do Dossiê em vez de importar JSON | `Dossie` + `Mesa` *(+ Worker)* | **Tarefa 5 (5A e 5B)** |

---

## Tarefa 1 (Dossiê) — Corrigir reset dos efeitos críticos de PV/PD ao re-renderizar a ficha

**Causa raiz:**
- Em [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L1781-L1819):
  1. `render()` substitui todo o conteúdo via `app.innerHTML = ...` e inclui `${(isCinematic || state.viewMode === 'vigilia') ? renderCriticalAtmosphere() : ''}` (L1798) **dentro** de `#app`.
  2. Qualquer ação que chama `render()` (adicionar/remover dado de pavor, lesão, trauma, alternar Vigília ↔ Cinematográfica ↔ Tradicional, fim de rolagem 2.5D na L5669, etc.) destrói `<div data-critical-atmosphere>` e `<canvas data-critical-tendrils>` e cria elementos novos.
  3. Logo após, `syncCriticalAtmosphere()` ([`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L5925-L5941)) detecta `criticalTendrilCanvas !== canvas` (L5929), chama `stopCriticalTendrils()`, zera `criticalTendrilIntensity` para `0.02` e recria todos os tentáculos com `presence: 0`. As transições e animações CSS da vinheta também reiniciam de `opacity: 0`.
  4. Além disso, L1798 e L5935 (`cinematic = state.viewMode === 'cinematic' || isVigilia`) desligam atmosfera e áudio ao trocar para o modo **Tradicional**, religando do zero ao voltar.

**Arquivos:**
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)
- [`Dossie/src/styles.css`](file:///home/ilvro/Documents/Projects/Dossie/src/styles.css)

**O que implementar:**
1. **Mover `.critical-atmosphere` para fora de `#app`:**
   - Criar helper `ensureCriticalAtmosphereEl()` que busca ou cria um único `<div class="critical-atmosphere" data-critical-atmosphere aria-hidden="true">...</div>` como filho persistente de `document.body` (fora de `#app`).
   - Remover `${renderCriticalAtmosphere()}` do template de `app.innerHTML` em `render()` (L1798).
2. **Preservar continuidade entre ações e modos de visualização:**
   - Em `syncCriticalAtmosphere()` (L5934–L5941), habilitar atmosfera e áudio em **todos** os `viewMode` de personagem (`vigilia`, `cinematic` e `traditional`), desabilitando apenas para ameaças (`state.systemMode === 'threat'`, já coberto por `getCriticalState()`), projeção de outra ficha ou quando desativado em `criticalEffects`.
   - Só resetar os tentáculos (`stopCriticalTendrils()`) quando o recurso sair do estado crítico ou quando `state.id` mudar para outra ficha sem PD crítico. Em `render()` na mesma ficha, o `<canvas>` é o mesmo nó DOM, então `startCriticalTendrils` apenas atualiza `criticalTendrilTargetIntensity` sem interromper o rAF nem zerar `presence`.
   - Em `emitCriticalHeartbeat()` (L5821), usar o nó persistente.
3. **CSS ([`Dossie/src/styles.css`](file:///home/ilvro/Documents/Projects/Dossie/src/styles.css#L3441-L3493)):**
   - Confirmar que `.critical-atmosphere` fora de `#app` mantém `position: fixed; inset: 0; pointer-events: none;` e `z-index` acima do conteúdo da ficha e abaixo de modais/palco de dados.

**Validação:**
- Com PV ≤ 25% e/ou PD ≤ 25%, adicionar dado de pavor, marcar lesão/trauma, alternar Vigília ↔ Cinematográfica ↔ Tradicional e fazer uma rolagem: vinheta, tentáculos e batimento devem permanecer contínuos, sem piscar nem reiniciar.

---

## Tarefa 2 (Dossiê + Mesa) — Aplicar efeitos críticos de PV e PD baixo na tela da Activity / Mapa

**Contexto:**
- Na Activity do Discord e na rota do jogador ([`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx)), a tela inteira é `.casca`: `.casca-mapa` envolve o projetor remoto do Atlas e `.casca-ficha` contém o Dossiê (360 px lateral no modo `card`, ou recolhido).
- Como cada jogador vê seu próprio PV/PD enquanto o mapa é compartilhado, a camada visual sobre o mapa deve viver na `Casca` da Mesa — sem afetar outros jogadores no Atlas.

**Arquivos:**
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)
- [`Dossie/src/styles.css`](file:///home/ilvro/Documents/Projects/Dossie/src/styles.css)
- [`Mesa/src/jogar/atmosfera-critica.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/atmosfera-critica.ts) *(novo)*
- [`Mesa/src/jogar/AtmosferaCritica.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/AtmosferaCritica.tsx) *(novo)*
- [`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx)
- [`Mesa/src/jogar/casca.css`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/casca.css)
- `Mesa/tests/unit/jogar/atmosfera-critica.test.ts` *(novo)*

**O que implementar:**
1. **Emissão no Dossiê ([`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)):**
   - Quando `modoJogador && window.parent !== window` (e `!projecaoDaMesa`), em `syncCriticalAtmosphere()` enviar via `postMessage` para `window.parent` (na `location.origin`, com deduplicação por assinatura):
     ```js
     {
       tipo: 'dossie.atmosfera-critica',
       fichaId: state.id,
       pv: critical.pv,
       pd: critical.pd,
       efeitos: { pv: Boolean(criticalEffects.pv), pd: Boolean(criticalEffects.pd) }
     }
     ```
   - Em `emitCriticalHeartbeat()`, quando `modoJogador && window.parent !== window`, enviar `{ tipo: 'dossie.batimento-critico' }` para sincronizar o pulso visual da vinheta no mapa exatamente com o som do batimento (sem duplicar áudio na `Casca`).
   - **Evitar duplicação visual:** em `body[data-modo-jogador="1"][data-vista="card"] .critical-atmosphere { display: none; }` (ou em todo `modoJogador` caso a `Casca` mantenha a camada sempre visível acima da ficha expandida, garantindo continuidade absoluta ao expandir/voltar). O áudio do batimento e de PD segue centralizado no Dossiê.
2. **Módulo puro na Mesa (`Mesa/src/jogar/atmosfera-critica.ts`):**
   - Validação de `dossie.atmosfera-critica` e `dossie.batimento-critico` conferindo `ev.source === janelaDoDossie && ev.origin === origemLocal` (mesmo padrão de [`vista-ficha.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/vista-ficha.ts)).
   - Fallback puro `estadoCriticoDaFicha(ficha)` calculado direto de `FichaDaSala` com os mesmos limiares do Dossiê (`<= 0.50` aviso, `<= 0.35` vinheta, `<= 0.25` crítico/tentáculos; Ordem 1 usando `usaPD ? pe : san`; ignorando `threat`), usado enquanto o Dossiê ainda carrega ou se o card estiver recolhido.
3. **Overlay persistente na `Casca` (`Mesa/src/jogar/AtmosferaCritica.tsx`, `Casca.tsx`, `casca.css`):**
   - Renderizar `.casca-atmosfera-critica` com `pointer-events: none` contendo `pd-darkness`, `pv-vignette`, `pd-vignette`, `distortion` e `<canvas>` com a mesma animação orgânica de tentáculos (respeitando `prefers-reduced-motion` e limpando rAF/timers no unmount).
   - Ocultar quando `espectador` (mestre), `mostrarSaguao` ou `projetandoFicha` (projeção de outra ficha pelo mestre).
   - Se a opção escolhida for renderizar dentro de `.casca-mapa` (apenas no mapa), desativar quando `cobre` for `true`; se renderizar sobre `.casca` inteira (com Dossiê ocultando a sua em `modoJogador`), posicionar `z-index` acima de `.casca-ficha` e abaixo de `.casca-voltar`/`.saguao`, mantendo continuidade total entre mapa e ficha expandida.
4. **Testes:** cobrir `estadoCriticoDaFicha` (Ordem 2, Ordem 1 com SAN e com `usaPD`, ameaça) e validação das mensagens `postMessage`.

---

## Tarefa 3 (Dossiê + Mesa) — Corrigir sumiço do card e tornar fade-in/fade-out perceptível

**Causa raiz:**
1. **Sumiço do card ao expandir** ([`Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx#L490-L506), [`casca.css`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/casca.css#L14-L17)):
   - Existe um único `<iframe class="casca-ficha">`. Ao clicar "Expandir ficha", `expandidaVisivel = true` e `faseExpandida = 'preparando'` entram no mesmo frame → o iframe salta imediatamente para `position: fixed; inset: 0; opacity: 0`, fazendo o card de 360 px desaparecer de golpe enquanto aguarda até 180 ms pelo Dossiê.
2. **Sumiço do card ao voltar ao mapa** ([`Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx#L518-L526)):
   - `setFaseExpandida('saindo')` anima `opacity: 1 → 0` (220 ms). Só após 220 ms `setExpandidaVisivel(false)` troca `vista` para `'card'` e envia `postMessage('dossie.vista', 'card')`, ativando `retornoPainel` (`opacity: 0 → 1`) **antes** de o Dossiê re-renderizar o `card`. O card fica invisível/piscando por ~1 s.
3. **Fade imperceptível:**
   - Duração curta (`220 ms`), sem backdrop/véu sobre o mapa.
   - Em [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L6702-L6705), `avisarVistaAplicada` usa apenas 1 `requestAnimationFrame`, disparando antes de o navegador concluir o paint do layout completo da ficha.

**Arquivos:**
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)
- [`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx)
- [`Mesa/src/jogar/fase-ficha.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/fase-ficha.ts)
- [`Mesa/src/jogar/vista-ficha.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/vista-ficha.ts)
- [`Mesa/src/jogar/casca.css`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/casca.css)
- Testes em `Mesa/tests/unit/jogar/` (`fase-ficha.test.ts`, `vista-ficha.test.ts`)

**O que implementar:**
1. **No Dossiê ([`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L6702-L6715)):**
   - Em `avisarVistaAplicada(vista)`, aguardar **dois `requestAnimationFrame` consecutivos** (`requestAnimationFrame(() => requestAnimationFrame(...))`) antes de enviar `{ tipo: 'dossie.vista-aplicada', vista }`.
2. **Backdrop dedicado + duração perceptível na `Casca` (`Casca.tsx`, `casca.css`):**
   - Adicionar `<div class="casca-ficha-backdrop" aria-hidden="true" />` entre `.casca-mapa` e `.casca-ficha` expandida (`z-index: 15` para backdrop, `16` para ficha expandida), com `background: rgba(8, 7, 14, 0.72); backdrop-filter: blur(6px);` animando suavemente em `320 ms` (`DURACAO_FADE_FICHA_MS = 320`) tanto na entrada quanto na saída.
   - Na entrada (`preparando`), o backdrop já começa a escurecer imediatamente cobrindo o mapa enquanto o iframe aplica `vista: 'completa'`, evitando o "buraco" brusco no lugar do card; assim que `dossie.vista-aplicada` (`vista === 'completa'`) chega, a ficha completa entra com `casca-ficha-fade-in` (`320 ms`, `opacity: 0 → 1`, `scale(0.985 → 1)`).
3. **Fase explícita `retornando` na volta (`completa → card`)** ([`fase-ficha.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/fase-ficha.ts), [`Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx)):
   - `ativa → saindo` (`320 ms`): ficha completa + backdrop fazem fade-out suave sobre o mapa.
   - Ao concluir `saindo`, passar para `retornando`: o iframe volta ao slot lateral de 360 px **ainda em `opacity: 0`**, dispara `dossie.vista = 'card'` e aguarda `dossie.vista-aplicada` (`vista === 'card'`, fallback de `180 ms` via `agendarEntradaDaFicha`).
   - Só depois que o `card` está pintado, transicionar para `inativa` + `retornoPainel` (`opacity: 0 → 1`, `translateX(12px → 0)` em `240 ms`).
4. **Evitar `render()` redundante:** revisar `useEffect` de `mandarFichaAtiva` ([`Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx#L529)) para não disparar reabertura da mesma ficha durante a troca de vista.
5. **Testes:** atualizar testes de `fase-ficha` e `vista-ficha` para cobrir o campo `vista` em `dossie.vista-aplicada` e o ciclo completo `inativa → preparando → ativa → saindo → retornando → inativa`.

---

## Tarefa 4 (Dossiê) — Garantir rolagem 2.5D como padrão e corrigir arremesso manual no 3D (Ameaças e Cards)

**Causa raiz (3 bugs combinados):**
1. **Default 2.5D sobrescrito por `localStorage` antigo:**
   - Em [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L1024-L1046), o default em memória foi mudado para `cinematicAltRoll: true`, mas `localStorage['ordem-ii-app-settings-v1']` de sessões anteriores ainda guarda `cinematicAltRoll: false`, sobrescrevendo o default na L1046. Em `?compacto=1` ([`Atlas/src/ui/PreviaDaFicha.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/PreviaDaFicha.tsx#L224-L229)), a `.nav-rail` com o botão de configurações fica oculta.
2. **Testes de ameaça nunca ativam arremesso manual no 3D:**
   - Em [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L2040-L2121), todos os 5 handlers de teste de ameaça (`data-threat-roll-attr`, `data-threat-roll-save`, `data-threat-roll-sense`, `data-threat-roll-atk-test`, `data-threat-roll-pericia`) chamam `roll(...)` **sem** `{ scene: 'full' }`.
   - `roll()` cai em `scene: meta?.scene || 'quick'` (L5662) e [`Dossie/src/dice3d.js`](file:///home/ilvro/Documents/Projects/Dossie/src/dice3d.js#L602) exige `options.scene === 'full' && manualThrowEnabled() && !options.throw` → `createDiceHand` nunca é criado.
3. **Acoplamento quebrado entre `cinematicAltRoll`, `rollScene` e `manualThrow`:**
   - Em [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L1027-L1028) e L6107, `manualThrow` virou `false` por padrão; ao desligar `cinematicAltRoll`, o modo 3D abre com `manualThrow: false` (auto-roll) ou `rollScene: false` (ignorando `manualThrow` em `dice3d.js` L593).

**Arquivos:**
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)
- [`Dossie/src/dice3d.js`](file:///home/ilvro/Documents/Projects/Dossie/src/dice3d.js) *(verificação do drag em `?compacto=1`)*

**O que implementar:**
1. **Migração única de preferência de rolagem** ([`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L1023-L1047)):
   - Ao ler `localStorage[APP_SETTINGS_KEY]`, se `!saved.rollModeMigratedV2`, aplicar `cinematicAltRoll: true`, `rollScene: false`, `manualThrow: false`, `rollModeMigratedV2: true` e chamar `saveAppSettings()`. Trocas manuais posteriores continuam respeitadas.
2. **Passar `{ scene: 'full' }` nos 5 testes de ameaça** ([`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L2040-L2121)):
   - `data-threat-roll-attr` (L2048), `data-threat-roll-save` (L2061), `data-threat-roll-sense` (L2074), `data-threat-roll-atk-test` (L2096) e `data-threat-roll-pericia` (L2119).
   - Manter `rollExpression` (presença perturbadora e dano) como `'quick'`.
3. **Corrigir toggles das configurações de rolagem** ([`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js#L6105-L6108)):
   - Ao desligar `cinematicAltRoll`, se `rollScene` e `manualThrow` estiverem ambos `false`, ativar ambos (`rollScene = true`, `manualThrow = true`).
   - Ao ativar `manualThrow`, ativar automaticamente `rollScene = true` (dependência de `createDiceHand`).
   - Conferir em `dice3d.js` se o pointer/drag de `createDiceHand` funciona corretamente dentro do `iframe` estreito de `?compacto=1`.

**Validação:**
- Com um `localStorage` antigo (`cinematicAltRoll: false`, sem `rollModeMigratedV2`), abrir um card de ameaça e de personagem (`?compacto=1`): os testes devem abrir direto na rolagem **2.5D**.
- Desligar a rolagem 2.5D nas configurações e rolar um teste de ameaça: a cena 3D deve segurar os dados na mão e permitir arrastar/arremessar ou clicar para rolar.

---

## Tarefa 5 (Dossiê + Mesa [+ Worker]) — Seletor visual do Dossiê no Saguão

**Restrição técnica (Navegador vs Discord Activity):**
- As fichas criadas no site do Dossiê moram no IndexedDB (`ordem-ii-db`) / `localStorage` da origem do site (`https://ilvro.github.io` ou `http://127.0.0.1:5100`) em [`Dossie/src/armazenamento.js`](file:///home/ilvro/Documents/Projects/Dossie/src/armazenamento.js#L59-L135).
- **No navegador** (mesma origem): um `<iframe>` do Dossiê no Saguão lê `armazenamentoLocal()` diretamente.
- **Na Discord Activity** (`https://<client_id>.discordsays.com/.proxy/...`): é **outra origem** — o navegador/Electron do Discord isola o IndexedDB/localStorage de `ilvro.github.io`, e o CSP bloqueia iframes externos fora do proxy.
- Por isso, a tarefa é dividida em **5A** (seletor visual no Dossiê + Saguão) e **5B** (cofre pessoal por conta Discord no Worker para funcionar também dentro da Discord Activity).

### Etapa 5A — View de Seletor do Dossiê no Saguão (`Dossie` + `Mesa`)

**Arquivos:**
- `Dossie/src/seletor-saguao.js` *(novo)*
- [`Dossie/src/app.js`](file:///home/ilvro/Documents/Projects/Dossie/src/app.js)
- [`Dossie/src/styles.css`](file:///home/ilvro/Documents/Projects/Dossie/src/styles.css)
- [`Mesa/src/jogar/Saguao.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Saguao.tsx)
- [`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx)
- [`Mesa/src/jogar/casca.css`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/casca.css)

**O que implementar:**
1. **Modo `?modo=seletor` no Dossiê:**
   - Quando a URL tiver `?modo=seletor`, pular `iniciarMesa` / barra lateral / edição, carregar fichas de personagem (`systemMode !== 'threat'`) via `armazenamentoLocal()` e renderizar uma galeria visual no estilo do Dossiê (retratos em destaque com cor tema da ficha, nome, perfil/classe, ocupação/nível, busca rápida, filtro por pasta e resumo de PV/PD).
   - Ao escolher uma ficha, enviar ao `window.parent` (na `location.origin`):
     `{ tipo: 'dossie.seletor-escolheu', ficha: fichaParaSala(sheet) }`.
   - Expor também ações de atalho: `"Criar nova ficha"` (`{ tipo: 'dossie.seletor-nova' }`) e, caso não haja fichas locais (ex.: primeira vez na Activity), botão discreto `"Importar JSON"` (`{ tipo: 'dossie.seletor-importar-json' }`).
   - Emitir `{ tipo: 'dossie.seletor-pronto' }` ao concluir a montagem.
2. **Integração no Saguão ([`Saguao.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Saguao.tsx#L276-L330)):**
   - Promover **"Escolher do Dossiê"** como botão principal no bloco "Seu personagem" (ao lado de "Nova ficha"), deixando **"Importar JSON"** como opção secundária.
   - Ao abrir, exibir modal/overlay sobre o Saguão com `<iframe src="${baseDossie}?modo=seletor" />`.
   - Ao receber `dossie.seletor-escolheu` (validando `origin` e `source`), se a ficha já existir na sala com o mesmo `id` (e pertencer ao jogador), selecionar com `aoEscolher(id)`; senão, normalizar com `prepararFichasImportadas` e chamar `aoImportar([pronta])`, fechando o modal.

### Etapa 5B — Cofre de Fichas da Conta Discord no Worker (Cross-Origin / Discord Activity)

**Arquivos:**
- `Mesa/sala/cofre-jogador.ts` *(novo Durable Object)*
- [`Mesa/sala/index.ts`](file:///home/ilvro/Documents/Projects/Mesa/sala/index.ts) e [`Mesa/sala/wrangler.toml`](file:///home/ilvro/Documents/Projects/Mesa/sala/wrangler.toml)
- `Mesa/tests/unit/sala/cofre-jogador.test.ts` *(novo)*
- [`Dossie/src/armazenamento.js`](file:///home/ilvro/Documents/Projects/Dossie/src/armazenamento.js) e `Dossie/src/seletor-saguao.js`
- [`Mesa/src/jogar/Casca.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Casca.tsx) / [`Saguao.tsx`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/Saguao.tsx)

**O que implementar:**
1. **Worker Cloudflare (`Mesa/sala/`):**
   - Criar Durable Object `CofreJogador` (instanciado por `discordId`, SQLite com `fichas (id TEXT PRIMARY KEY, json TEXT, updated_at INTEGER)`).
   - Rotas autenticadas com `Authorization: Bearer <sessao>` (mesmo HMAC já usado em `/sala/minhas`):
     - `GET /sala/minhas-fichas`
     - `PUT /sala/minhas-fichas/:id`
     - `DELETE /sala/minhas-fichas/:id`
2. **Sincronização e leitura no Seletor (`Dossie` + `Mesa`):**
   - No site standalone do Dossiê, permitir login opcional com Discord para sincronizar as fichas locais com `/sala/minhas-fichas`.
   - Na `Casca`/`Saguao`, quando o iframe `?modo=seletor` enviar `dossie.seletor-pronto`, enviar via `postMessage` `{ tipo: 'mesa.seletor-sessao', sessao, baseSala }` (nunca na URL).
   - O seletor busca `GET ${baseSala}/minhas-fichas` e mescla com `armazenamentoLocal()` (deduplicando por `id` e mantendo a versão mais recente por `updatedAt`), permitindo escolher fichas criadas no site diretamente dentro da Discord Activity.

---

## Resumo de Commits Atômicos Previstos

| # | Repositório | Mensagem sugerida |
| :-: | :--- | :--- |
| 1 | `Dossie` | `(bug fix) manter atmosfera critica fora do app para nao resetar ao re-renderizar` |
| 2 | `Dossie` | `(feature) enviar estado e batimento critico de pv e pd para a casca da mesa` |
| 3 | `Mesa` | `(feature) apply low pv and pd critical atmosphere overlay to player activity map` |
| 4 | `Dossie` | `(bug fix) aguardar dois quadros pintados antes de avisar vista aplicada` |
| 5 | `Mesa` | `(visual) smooth compact-to-expanded sheet fade with backdrop and zero card flash` |
| 6 | `Dossie` | `(bug fix) migrar padrao para rolagem 2.5d e corrigir arremesso manual 3d em ameacas` |
| 7 | `Dossie` | `(feature) adicionar modo seletor visual de fichas para o saguao da mesa` |
| 8 | `Mesa` | `(feature) add dossie sheet picker modal in lobby as primary character selector` |
| 9 | `Mesa` *(5B)* | `(feature) add per-user discord sheet vault endpoints to room worker` |
| 10 | `Dossie` *(5B)* | `(feature) sincronizar fichas locais com cofre discord e listar no seletor do saguao` |

---

## Desvios e limites registrados (implementação 2026-11-22)

- **Tarefas 1–2:** a atmosfera na Activity é desenhada pela `Casca` (porte dos tentáculos em `Mesa/src/jogar/atmosfera-tentaculos.ts`, arquivo extra); o Dossiê esconde a sua em todo iframe de jogador (não só no card). Limite: o Dossiê da Activity roda o áudio; a Casca só desenha.
- **Tarefa 3:** ao expandir, o card some de golpe atrás do véu (o iframe único troca de layout). Mantê-lo visível exigiria dois layouts do mesmo iframe.
- **Tarefa 4:** não verificado manualmente o arrastar dos dados em `?compacto=1`.
- **Tarefa 5A:** `Dossie/src/entrada.js` virou o ponto de entrada (decide `?modo=seletor` ou o app); "Importar JSON" no seletor só aparece sem fichas locais.
- **Tarefa 5B:** o login com Discord foi feito no site do Dossiê (`Dossie/src/conta-discord.js`, botão em Configurações → Conta Discord). A sessão usa a chave `mesa:online-sessao`, a mesma da Mesa. Cada salvamento envia ao cofre as fichas novas ou alteradas; o seletor também sincroniza quando a Mesa lhe manda a sessão. Limites: fichas apagadas no Dossiê continuam no cofre; máx. 200 fichas por conta e 2 MB por ficha. Exige `wrangler deploy` (migração v3 e novos `REDIRECTS_PERMITIDOS`) e os redirects `https://ilvro.github.io/Dossie/` e `http://127.0.0.1:5100/Dossie/` no portal do Discord.
- **Plano:** não havia "Tarefa 6"; foram feitas 5A e 5B.
