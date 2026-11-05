# Fase 9 — Plataforma e tutoriais

"O Atlas na mesa." Critério de pronto: não há um no ROADMAP. Proposta: **numa sessão de verdade sob o `mesa-dev`, a ficha de um personagem vira peça no mapa, a rolagem dele aparece sobre a peça, uma pista do Ateliê é inspecionada no projetor e o Jukebox troca a música quando o clima muda, sem copiar nada à mão.** Confirmar com o usuário ao começar a fase.

Detalhado em 3 de novembro de 2026, **antes das Fases 6 a 8**. **Ao começar a fase, o Opus confere as fichas de novo**, sobretudo as que dependem da Fase 7 (peças de jogador, interagíveis, sessão, projetor).

**🔒 = muda outro projeto.** A tarefa só começa com autorização explícita do usuário para aquele projeto, e o primeiro passo dela é **ler o projeto** e reportar como ele está antes de mudar qualquer coisa. Contratos existentes (como o do Ateliê com o Tabletop) não mudam sem mudar os dois lados (AGENTS.md). 👤 = decisão do usuário no meio da tarefa.

## Como as coisas estão hoje

- **Atlas:** fala o contrato da mesa desde a Fase 2 (`mesa-core` em `Atlas/mesa-core/`, compilado por `npm run build:core`): Refs, banco `mesa-campanha-v1`, barramento `mesa:eventos` com o catálogo em `mesa-core/src/eventos.ts`, manifesto `public/mesa.json`, tema `mesa:tema`, `scripts/mesa-dev.ts` (todos os projetos numa origem; **só testado com o Atlas e uma página falsa**). Pede `jukebox.tocar` ao trocar de clima (4.7a, campo provisório; nunca conferido com o Jukebox).
- **Ficha** (`Projects/Ficha teste - Ordem II`): JavaScript sem framework, Vite; quase tudo em `src/app.js` (estado da ficha com `pv`, `maxPv`, `pd`, `maxPd`, `tokenImage`; rolagens por `rollDice3d` em `src/dice3d.js`); persistência em `sheets.json` no desenvolvimento e IndexedDB/localStorage no Pages. Análise antiga em `Tabletop/docs/INTEGRACAO_FICHA.md`. Não conhece o contrato da mesa. Atenção: o catálogo diz `pvMax`/`pdMax`; a Ficha diz `maxPv`/`maxPd`.
- **Ateliê:** já oferece pistas pelo contrato v1 com o Tabletop (`Atelie/docs/plano/CONTRATO-TABLETOP.md`): banco `mesa-handouts-v1` (`handouts`, `bakes` normal e UV) e canal `mesa:handout`. **O Atlas pode consumir isso sem mudar o Ateliê.** Manifesto e `atelie.abrir` exigem mudar o Ateliê.
- **Jukebox:** JavaScript sem bundler (`index.html`, `player.js`, `scenes.js`); as cenas ficam no localStorage (`scenes.js`, `loadScenes`); tem um `server.js` opcional. Não conhece o contrato.
- **Mesa (hub):** não existe.
- **Tabletop** tem o motor de tutoriais para adaptar: `src/tutorial/tutor.js`, `conditions.js`, `lessons.js` (20 lições).

## Decisões já tomadas (não rediscutir na implementação)

- **Cada aplicativo usa uma cópia compilada e fixa** do `mesa-core` em `vendor/mesa-core/` (PLATAFORMA §7). A fonte continua no Atlas até o usuário decidir mudá-la para o repositório da Mesa (👤 na 9.1a).
- **A Mesa usa a mesma pilha do Atlas** (TypeScript, Preact com signals, Vite, CSS próprio, a identidade de `docs/INTERFACE.md`), em `Projects/Mesa`, publicada em `/Mesa/`.
- **O Atlas não guarda dados de outro aplicativo no documento**, só `Ref`. PV, PD e rolagens chegam pelo barramento e vivem na memória da sessão; pistas são lidas do `mesa-handouts-v1` na hora.
- **Ponto de encontro de uma pista no mapa:** um objeto com `interaction.kind === 'clue'` e `interaction.clue = Ref` do documento do Ateliê (o campo existe desde a 7.0b).
- **Tutoriais seguem a lição do Tabletop:** o resultado da lição é desenhado primeiro e precisa ficar bonito; a pessoa **define** cada valor que faz o visual, com condição conferindo o valor exato; o tutor marca onde clicar; a lição termina comparando o resultado com o original.

## Tarefas

| # | Tarefa | Tipo |
| --- | --- | --- |
| 9.1a | 🔒 Mesa: projeto, campanhas e entidades | projeto novo |
| 9.1b | 🔒 Mesa: notas com `[[ligações]]` | Mesa |
| 9.1c | 🔒 Mesa: inventário de aplicativos e o `mesa-dev` com todos | Mesa + scripts |
| 9.2a | 🔒 Ficha no contrato | Ficha |
| 9.2b | Ficha → peça; cartão com PV e PD | Atlas |
| 9.2c | Rolagem sobre a peça | Atlas |
| 9.3a | Pistas do Ateliê no mapa | Atlas |
| 9.3b | Inspeção com luz UV, no projetor | Atlas |
| 9.3c | 🔒 Ateliê: manifesto e `atelie.abrir` | Ateliê |
| 9.4a | 🔒 Jukebox no contrato | Jukebox |
| 9.4b | Cena sonora por mapa, região e clima | Atlas |
| 9.4c | Entrar numa região | Atlas |
| 9.4d | 🔒 Efeitos avulsos do Jukebox nos interagíveis | Jukebox + Atlas |
| 9.5a | 🔒 Mesa em modo sessão | Mesa + Atlas |
| 9.5b | 🔒 Roteiro e registro da sessão | Mesa |
| 9.6a | Motor de tutoriais | Atlas |
| 9.6b | Lições | Atlas |
| 9.7 | Validação da fase | e2e + relatório |

---

### 9.1a — 🔒 Mesa: projeto, campanhas e entidades  ✅
Objetivo: o hub existe, abre no `mesa-dev` e cria campanhas e entidades no banco comum.
Depende de: autorização para criar `Projects/Mesa`.
Ler: `Atlas/docs/PLATAFORMA.md` inteiro; `Atlas/mesa-core/src/campanha.ts` (`abrirRepositorioCampanha`, `Entidade`, `TIPOS_ENTIDADE`); `Atlas/package.json`, `vite.config.ts`, `src/app/tema.ts`, `src/ui/estilo.css` (pilha e identidade); `Atlas/scripts/mesa-dev.ts`.
Arquivos: criar `Projects/Mesa/` (package.json, vite.config.ts com `base: '/Mesa/'`, tsconfig, `index.html`, `src/`, `public/mesa.json`, `vendor/mesa-core/`, `AGENTS.md`, `docs/`, `tests/`).
Como:
1. 👤 Antes de começar: perguntar se a fonte do `mesa-core` muda para a Mesa agora (PLATAFORMA §7) ou continua no Atlas. A ficha segue igual nos dois casos; muda só de onde vem o `vendor/`.
2. Telas: campanha ativa (lista, criar, renomear, sistema, tema; `mesa:campanha-ativa`); entidades por tipo (personagem, lugar, pista, cena, sessão, facção, nota), com busca sem acento, criar, editar nome, tags e notas; cada entidade mostra os seus `refs` com o nome do aplicativo e um link "Abrir" (por manifesto, na 9.1c).
3. Respeitar a regra de dono do repositório (quem criou altera; os outros só os próprios refs).
4. Tema pelo `mesa:tema`, igual aos outros aplicativos.
Não fazer: notas ricas (9.1b); modo sessão (9.5a).
Testes: unitários do que for puro (filtros, ordenação); e2e com o Atlas sob o `mesa-dev`: criar uma campanha na Mesa e ver a campanha no Atlas (aba Mapa → campanha), e o "lugar" que o Atlas cria aparecer na Mesa.
Pronto quando: a Mesa abre em `/Mesa/` sob o `mesa-dev` e compartilha a campanha com o Atlas.
Nota: autorizada pelo usuário ("sim, pode seguir"). A pergunta da fonte do `mesa-core` ficou sem resposta explícita: seguiu a sugestão de **manter a fonte no Atlas**; `Mesa/vendor/mesa-core/` é cópia de `Atlas/mesa-core/dist` (atualizar com `cp -r`). Criado `Projects/Mesa` (pilha do Atlas; `base: './'` com `MESA_DEV_PREFIX` para o `mesa-dev`, como o Atlas, em vez de `/Mesa/` fixo, para servir também no Pages): `dominio/entidades.ts` (busca sem acento, filtros, contagem, regra de dono, etiquetas), `app/campanha.ts` (campanhas e entidades pelo `mesa-core`, relê ao focar a aba e a cada 3 s porque os outros apps escrevem por fora), telas Campanhas e Entidades. Cada entidade mostra os `refs` com o nome do aplicativo e um "Abrir" que já usa o manifesto do aplicativo (`../<App>/mesa.json`); sem manifesto aparece "sem link" (o inventário completo é da 9.1c). Escolher uma campanha com tema próprio veste a mesa inteira com ele. Entidades de outros aplicativos são só leitura. Testes: 7 unitários e 2 e2e com Mesa e Atlas de verdade sob o proxy do `mesa-dev` (campanha criada na Mesa aparece no Atlas; o lugar criado pelo Atlas aparece na Mesa; tema propaga). O e2e achou um bug real (`currentTarget` nulo depois de um `await`), já corrigido.
Commit (no repositório da Mesa): first hub with campaigns and entities

### 9.1b — 🔒 Mesa: notas com `[[ligações]]`  ✅
Objetivo: notas da campanha que ligam a qualquer entidade ou Ref, abrindo o que está ligado.
Depende de: 9.1a
Ler: `Atlas/mesa-core/src/refs.ts` (formato `mesa:app/tipo/id`); `Atlas/mesa-core/src/campanha.ts` (`ligacoes`).
Arquivos: na Mesa, `src/dominio/notas.ts`, `src/ui/EditorDeNota.tsx`, testes.
Como:
1. Sintaxe: `[[Nome da entidade]]` e `[[mesa:app/tipo/id|rótulo]]`. Parser puro que devolve trechos de texto e ligações; ligação a nome inexistente fica marcada "sem destino", com ação "Criar entidade".
2. Editor de texto simples com autocompletar ao digitar `[[`; ao salvar, as ligações viram `ligacoes` do tipo `menciona` (apaga as que saíram).
3. Na leitura, ligação clicável: entidade abre na Mesa; Ref abre no aplicativo dono (manifesto) ou pede `atlas.focar`/`ficha.abrir`/`atelie.abrir` pelo barramento, se o aplicativo estiver aberto.
Não fazer: Markdown completo; exportação para Obsidian (fora do plano).
Testes: parser por tabela (aninhamento, colchetes soltos, acento, Ref com rótulo); salvar uma nota cria e apaga ligações.
Pronto quando: uma nota com `[[Casa dos Salgueiros]]` abre o mapa no Atlas.
Nota: `dominio/notas.ts` (puro): `analisarNota` (trechos de texto e ligações; aninhamento vale a de dentro; colchetes soltos, vazios ou com quebra de linha são texto), `resolver`, `refsMencionados`, `autocompletarEm`, `sugerirEntidades`; 35 testes unitários no total (parser por tabela, inclusive reconstruir o texto pelos trechos). `[[Nome|rótulo]]` também vale para nomes. `ui/EditorDeNota.tsx`: Editar (com autocompletar ao digitar `[[`, setas e Enter) e Ler (ligação clicável). Ao gravar, as ligações viram `menciona` de `mesa:mesa/entidade/<nota>` para o destino (apaga as que saíram; só nota da Mesa; sincronizações em fila, uma de cada vez). Para as ligações identificarem entidades, a Mesa acrescenta às entidades envolvidas o próprio Ref `mesa:mesa/entidade/<id>` (é o único Ref que ela pode pôr nas entidades dos outros) e o esconde na lista "Onde aparece"; assim remover a entidade leva as ligações. Leitura: ligação a entidade abre a entidade na Mesa e mostra "Atlas ↗" (um por Ref do aplicativo) que pede `atlas.focar`/`ficha.abrir`/`atelie.abrir` pelo barramento e, sem resposta em 1,5 s, abre a rota do manifesto; ligação a Ref abre direto no aplicativo dono; nome sem destino mostra "Criar entidade" (escolhe o tipo). Renomear uma entidade não reescreve notas que a citam por nome (as ligações por Ref seguem). e2e: nota com `[[Casa dos Salgueiros]]` leva o Atlas (aberto noutra aba) para o mapa sem abrir aba nova.
Commit (Mesa): campaign notes with links

### 9.1c — 🔒 Mesa: inventário de aplicativos e o `mesa-dev` com todos  ✅
Objetivo: a Mesa lista os aplicativos pelos manifestos, e o `mesa-dev` roda os projetos de verdade numa origem só.
Depende de: 9.1a; autorização para mexer na configuração de base (`base` do Vite ou equivalente) de cada projeto que precisar.
Ler: `Atlas/scripts/mesa-dev.ts`; `Atlas/mesa-core/src/manifesto.ts` (`descobrir`, `enderecoDaRef`); o `vite.config` (ou o servidor) de Ficha, Ateliê, Jukebox e Tabletop.
Arquivos: Mesa (`src/ui/Aplicativos.tsx`); `Atlas/scripts/mesa-dev.ts`; nos outros projetos, só o necessário para servirem num subcaminho.
Como:
1. Inventário: `descobrir('../<App>/')` para Atlas, Ficha, Atelie, Jukebox e Tabletop; cartão por aplicativo com ícone, nome, o que oferece e atende, e estado (achado, sem manifesto, fora do ar).
2. `mesa-dev`: rotas para os cinco, com o modo de cada um (dev server com `base`, ou arquivos estáticos para o Jukebox). Documentar no README da Mesa como subir tudo com um comando.
3. Rodar e anotar o que quebrou em cada projeto sob subcaminho; consertar só configuração, nunca lógica de outro projeto nesta tarefa.
Não fazer: manifestos dos outros projetos (são das tarefas deles).
Testes: e2e na Mesa: o inventário mostra Atlas e Mesa como "achado" e os outros como "sem manifesto" até as tarefas deles.
Pronto quando: `npm run mesa-dev` sobe os cinco projetos e a Mesa numa origem.
Nota: autorizada junto com o resto ("siga para o restante da fase"); **nenhum arquivo de outro projeto foi alterado** (a ficha previa mexer na `base` de cada um, mas não foi preciso). `npm run mesa-dev` (sem argumentos) sobe, por `scripts/mesa-tudo.ts`: Atlas, Mesa e Ficha com o Vite de desenvolvimento sob o prefixo (`npm run dev:mesa` de cada um; o da Mesa é novo, o da Ficha já existia) e **Ateliê, Tabletop e Jukebox como arquivos estáticos**, servidos pelo próprio proxy (`Nome=estatico:pasta`, com `Range`, HEAD e proteção contra sair da pasta, em `scripts/mesa-estatico.ts`). Motivo: o `dev` do Ateliê e do Tabletop depende de um servidor de API que não existe atrás do proxy, e o `define` de `import.meta.env` não pega no `dev` do Vite deles; a versão `--mode pages` guarda no navegador e usa caminhos relativos, como o GitHub Pages. O `mesa-dev` gera o `dist-pages/` deles (ignorado pelo git) quando falta ou está mais velho que as fontes; porta já ocupada é reaproveitada; `--so Atlas,Mesa` sobe só alguns. O que quebrou sob subcaminho: nada, depois dessa escolha (os seis carregam sem erro de console nem requisição falha). Na Mesa: aba **Aplicativos** (`dominio/aplicativos.ts`, `app/inventario.ts`, `ui/Aplicativos.tsx`): sonda `../<App>/mesa.json` (e a página, se faltar) ao abrir a aba e a cada 5 s, e classifica em achado, sem manifesto ou fora do ar, com ícone, o que oferece, atende e avisa, e "Abrir". Hoje só o Tabletop está "sem manifesto" (não há tarefa para ele no plano). Testes: 6 unitários do `mesa-dev` (plano, build velho, estático) e 4 da classificação; e2e na Mesa com Atlas, Mesa, Jukebox real, um Tabletop falso e Ficha e Ateliê ausentes.
Commit (Atlas): run all apps under mesa-dev; (Mesa): app inventory

### 9.2a — Ficha no contrato  ✅
Objetivo: a Ficha emite rolagens e recursos, atende `ficha.abrir` e se anuncia por manifesto.
Depende de: 9.1c; autorização para mudar a Ficha.
Ler: na Ficha, `src/app.js` (estado, `defaults`, onde PV e PD mudam, onde as rolagens terminam), `src/dice3d.js` (`rollDice3d`), `vite.config.js`, `package.json`; `Tabletop/docs/INTEGRACAO_FICHA.md`; `Atlas/mesa-core/src/eventos.ts` (`ficha.rolagem`, `ficha.recursos`, `ficha.abrir`).
Arquivos: na Ficha, `vendor/mesa-core/`, `public/mesa.json`, um módulo novo `src/mesa.js` e o mínimo de ganchos em `app.js`.
Como:
1. Primeiro passo: relatório de como a Ficha identifica cada ficha (id estável?), onde termina uma rolagem e onde PV/PD mudam. Pare se a ficha não tiver id estável e proponha como dar um.
2. `src/mesa.js`: cria o barramento (`app: 'ficha'`); `emitirRolagem({ ficha, titulo, total, modificador })` no fim de cada rolagem; `emitirRecursos({ ficha, pv, pvMax, pd, pdMax })` quando mudam (mapeando `maxPv` → `pvMax`); atende `ficha.abrir { ref }` trazendo a ficha à frente.
3. Ao entrar numa campanha ativa (`mesa:campanha-ativa`), a Ficha cria ou atualiza a entidade "personagem" dela com o seu Ref (`mesa:ficha/ficha/<id>`).
4. Retrato: se o usuário autorizar, a Ficha publica o retrato no banco da campanha como asset da entidade (campo novo no `mesa-core`, contrato v1 com tipo novo, sem quebrar nada); senão, o Atlas não tem retrato da Ficha. 👤
5. Tudo desligável: sem `BroadcastChannel`, a Ficha funciona como antes.
Não fazer: a Ficha ler nada do Atlas.
Testes: na Ficha, um teste do módulo `mesa.js` com um barramento falso; e2e no Atlas sob o `mesa-dev`: rolar na Ficha chega como `ficha.rolagem` no Atlas.
Pronto quando: rolagens e recursos saem da Ficha pelo barramento e a ficha aparece como personagem na Mesa.
Commit (Ficha): join the table contract

Nota: autorizada pelo usuário ("pode seguir com ficha"). Feita na Ficha: `src/mesa.js` (módulo sem DOM, testável), `vendor/mesa-core/` (cópia de `mesa-core/dist`), `public/mesa.json` (rota `./?ficha={id}`), `tests/mesa.test.mjs`, script `dev:mesa` (Vite com `--base /Ficha/`, porque o `index.html` usa `/src/…` absoluto e o proxy não o alcançaria na raiz) e quatro ganchos em `app.js` (import, `roll()` antes de `addRollLogEntry`, `save()`, inicialização depois do `render()` final; `?ficha=<id>` abre a ficha).
- Ids: cada ficha tem `id` estável (`sheet.id`); o Ref é `mesa:ficha/ficha/<id>`.
- As fichas de personagem (`systemMode` ≠ `threat`) viram entidades `personagem` (16 de 114). *Atualizado depois:* as 98 fichas de ameaça agora viram entidades `ameaca` (tipo novo e aditivo do contrato), ver o fim da nota da 9.7.
- PV/PD por modo: Ordem 2 usa `pd/maxPd`; Ordem 1 usa Sanidade (ou PE com a regra opcional de PD). `ficha.recursos` só sai quando os valores mudam (e para todas as personagens ao sincronizar).
- Retrato: campo opcional `retrato?: Blob` na entidade (aditivo, contrato continua v1, até 512 KB, validado no `mesa-core`); a Ficha reduz para 256 px (WebP) se passar do limite. No Atlas, `adicionarPersonagem` guarda o retrato como asset e o põe em `portrait` da peça.
- Teste e2e `tests/e2e/ficha.test.ts` com a Ficha de verdade sob o `mesa-dev`: publica as personagens com retrato, o retrato chega à peça, rolar na Ficha chega como `ficha.rolagem`, `ficha.abrir` atende (e recusa ficha inexistente).
- Ainda não fiz: avisar `ficha.recursos` ao trocar de ficha sem salvar (só ao salvar/sincronizar). (A publicação de ameaças foi feita depois, como `ameaca`.)

### 9.2b — Ficha → peça; cartão com PV e PD  ✅
Objetivo: arrastar um personagem da campanha para o mapa cria a peça ligada à ficha; a peça mostra PV e PD em pips.
Depende de: 9.2a (para dados reais; dá para desenvolver com um barramento falso); (depois da 7) peças de jogador.
Ler: `src/app/campanha.ts`; `src/render/pecas.ts`; `src/ui/Dock.tsx`; `mesa-core` (`listarEntidades`).
Arquivos: criar `src/app/fichas.ts`, `src/ui/Personagens.tsx`; mudar `pecas.ts`, `Dock.tsx`, `Inspetor.tsx`.
Como:
1. Seção "Personagens" no dock da sessão (e na biblioteca de peças em Construir): entidades `personagem` da campanha com Ref da Ficha. Arrastar para o mapa cria a peça (`player: true`, nome, `refs: [ref da ficha]`, retrato se a 9.2a publicar).
2. `fichas.ts`: escuta `ficha.recursos` e guarda o último por Ref (memória, não documento); signal por peça.
3. Na peça: dois arcos ou fileiras de pips (PV vermelho, PD azul), só para o mestre e, se ele quiser, no projetor ("Mostrar PV no projetor", preferência local). Pip piscando quando o valor cai; estado crítico (PV ≤ 25%) muda o estado da peça para "ferido" só na tela, sem mexer no documento.
4. Cartão contextual da peça na sessão: PV x/y, PD x/y, "Abrir ficha" (`ficha.abrir`; sem resposta, oferece abrir a Ficha pelo manifesto).
Não fazer: escrever na Ficha.
Testes: unitário de `fichas.ts` com barramento falso; e2e: um `ficha.recursos` falso atualiza os pips da peça ligada.
Pronto quando: os testes passam.
Nota: feito contra um barramento falso (a Ficha ainda não fala o contrato, 9.2a 🔒). `domain/fichas.ts` (pips, estado crítico), `app/fichas.ts` (memória por Ref, `ficha.recursos`, `adicionarPersonagem`, `abrirFicha`), `ui/Personagens.tsx` (dock e aba Mapa; arrastar ou "Pôr no mapa"), pips em `render/pecas.ts` (piscam quando o valor cai), cartão e inspetor com PV e PD, e "Mostrar PV no projetor" (preferência local; o mestre manda os valores por peça pelo canal do projetor). O estado "ferido" por PV ≤ 25% é só da tela. A biblioteca de peças em Construir não existe, então a lista vive na aba Mapa.
Commit: sheet tokens with health pips

### 9.2c — Rolagem sobre a peça  ✅
Objetivo: quando o personagem rola na Ficha, o resultado flutua sobre a peça dele no mapa e no projetor.
Depende de: 9.2b
Ler: `src/fx/fx.ts` (número flutuante, faíscas); `src/app/fichas.ts`; `src/app/projetor.ts` (7.5b).
Arquivos: mudar `fichas.ts`, `src/fx/fx.ts`, `projetor.ts`.
Como:
1. `ficha.rolagem` de um Ref ligado a uma peça no mapa aberto: número flutuante grande sobre a peça (título pequeno embaixo), com faíscas no acento; total alto ou baixo muda a cor (sem decidir sucesso: o Atlas não conhece a regra).
2. O projetor recebe o mesmo efeito (mensagem `evento` da 7.5b) quando a peça está visível.
3. Uma rolagem de quem não tem peça no mapa vira um toast discreto.
Não fazer: histórico de rolagens (é o registro da 9.5b).
Testes: e2e com barramento falso: a rolagem aparece sobre a peça certa e no projetor.
Pronto quando: o teste passa.
Nota: `fx.flutuarRolagem` (número grande, título embaixo, faíscas no acento; aparece mesmo com os efeitos desligados), o projetor recebe a mensagem `rolagem` e desenha igual quando a peça está na projeção; sem peça no mapa, aviso "Rolagem: título total". O tom (alto a partir de 19 no dado sem o modificador, baixo até 2) é só cor: o Atlas não decide sucesso.
Commit: roll results over tokens

### 9.3a — Pistas do Ateliê no mapa  ✅
Objetivo: os documentos entregues pelo Ateliê aparecem numa lista e viram pistas no mapa.
Depende de: (depois da 7) `interaction.clue`.
Ler: `Atelie/docs/plano/CONTRATO-TABLETOP.md` inteiro (banco `mesa-handouts-v1`, `Summary`, `bakes`, canal `mesa:handout`); `src/ui/Biblioteca.tsx`.
Arquivos: criar `src/data/pistas.ts`, `src/ui/Pistas.tsx`, `tests/unit/pistas.test.ts`; mudar `Biblioteca.tsx` (ou o dock), `src/state/comandos.ts` se precisar.
Como:
1. `pistas.ts`: lê `handouts` do `mesa-handouts-v1` (só leitura, seguindo o contrato v1 à risca) e escuta `mesa:handout` para atualizar a lista.
2. Lista "Pistas" (em Construir, na biblioteca de objetos; na Sessão, no dock) com a prévia de cada documento. Arrastar para o mapa cria um objeto `papeis` (ou outra receita de papel) com `interaction: { kind: 'clue', clue: mesa:atelie/documento/<id> }`; também dá para ligar um objeto existente pelo inspetor.
3. A pista cria a ligação `esta-em` (pista → cômodo) no banco da campanha, se houver campanha ativa.
4. Pista cujo documento sumiu do banco: o objeto fica, com o aviso "documento não encontrado" no inspetor.
Não fazer: mudar o Ateliê; inspeção (9.3b).
Testes: unitário de `pistas.ts` com `fake-indexeddb` (já é dependência de desenvolvimento) seguindo o formato do contrato; e2e: gravar um handout falso no banco e ele aparecer na lista e virar pista.
Pronto quando: os testes passam.
Nota: `data/pistas.ts` lê `mesa-handouts-v1` só se o banco já existe (abrir um banco inexistente o criaria vazio e o Ateliê nunca faria o upgrade), escuta `mesa:handout`; `app/pistas.ts` põe o objeto "papéis soltos" com `interaction.clue = mesa:atelie/documento/<id>` e liga `esta-em` ao cômodo; lista em Construir (biblioteca de objetos) e no dock; o inspetor escolhe o documento e avisa "documento não encontrado". Testado com `fake-indexeddb` no formato do contrato v1.
Commit: Atelie handouts as clues

### 9.3b — Inspeção com luz UV, no projetor  ✅
Objetivo: na sessão, abrir a pista mostra o documento grande, com a luz UV quando houver, e o mestre pode mostrar aos jogadores.
Depende de: 9.3a, (depois da 7) projetor.
Ler: `Tabletop/src/ui/inspection-overlay.js` e a parte de inspeção de `presentation-window.js` (como o projetor segue a inspeção); `src/data/pistas.ts`.
Arquivos: criar `src/ui/Inspecao.tsx`; mudar `src/app/projetor.ts`, `src/ui/Projetor.tsx`, `src/app/acoes.ts`.
Como:
1. Clicar na pista na sessão (ou `Enter` com a peça ao lado) abre a inspeção: o `bake` normal em tela grande, zoom e arrasto, "Luz UV" (quando `hasUv`) com uma lanterna que segue o ponteiro revelando o `bake` UV num círculo; Esc fecha.
2. "Mostrar aos jogadores": o projetor abre a mesma inspeção e segue a posição da lanterna UV do mestre (suavizado). A pista entra em `session.revealed` (e emite `atlas.revelado`).
3. "Editar no Ateliê": pede `atelie.abrir { ref }`; sem resposta (antes da 9.3c), abre o Ateliê pela URL base do `source` do handout.
Não fazer: anotar sobre o documento.
Testes: e2e com handout falso com UV: abrir, ligar UV, mostrar aos jogadores e o projetor receber.
Pronto quando: o teste passa e a lanterna UV é fluida.
Nota: `domain/inspecao.ts` (matemática de zoom, arrasto e lanterna em frações da imagem), `ui/VisorDeDocumento.tsx` (o visor, no mestre e no projetor), `ui/Inspecao.tsx`, mensagens `inspecao`, `inspecao-estado` e `inspecao-fim` pelo canal do projetor (a lanterna do projetor é suavizada). Clicar na pista (ou Enter com a peça ao lado, que agora alcança pistas) abre; "Mostrar aos jogadores" revela o objeto-pista (`session.revealed` e `atlas.revelado`). "Editar no Ateliê" pede `atelie.abrir` e, sem resposta, abre `<source>?handout=<id>` numa aba.
Commit: clue inspection with UV light

### 9.3c — 🔒 Ateliê: manifesto e `atelie.abrir`  ✅
Objetivo: o Ateliê se anuncia e abre um documento quando pedido.
Depende de: 9.1c; autorização para mudar o Ateliê.
Ler: `Atelie/AGENTS.md`, `Atelie/docs/plano/CONTRATO-TABLETOP.md`, `etapa-28-integracao-tabletop.md`; as rotas do Ateliê.
Arquivos: no Ateliê, `vendor/mesa-core/`, `public/mesa.json`, um módulo de barramento e o gancho que abre um documento por id.
Como: primeiro, relatório de como o Ateliê abre um documento por id. Depois: manifesto (`oferece: ['documento']`, `atende: ['atelie.abrir']`), atender `atelie.abrir { ref }` abrindo o documento e respondendo; emitir `atelie.documento-salvo` ao salvar. O contrato v1 com o Tabletop não muda.
Não fazer: mudar o banco `mesa-handouts-v1`.
Testes: no Ateliê, teste do módulo com barramento falso; e2e no Atlas sob o `mesa-dev`: "Editar no Ateliê" abre o documento.
Pronto quando: o pedido é atendido.
Nota: autorizada pelo usuário ("pode seguir"). Relatório do primeiro passo: o Ateliê já tinha `openDocumentById(id)` no editor (ativa a aba se já aberta; senão lê `api.handouts.read` e abre) e abre `?handout=<id>` na partida; o id é um uuid estável; faltava só o barramento. Feito no Ateliê: `vendor/mesa-core/` (cópia compilada), `public/mesa.json` (rota `./?handout={id}`), `src/mesa.js` (atende `atelie.abrir` e emite `atelie.documento-salvo` com `revisao` opcional ao arquivar, mesmo sem "Compartilhar com o Tabletop"), `onArchived` em `createEditor` e a ligação em `main.js`. O contrato v1 com o Tabletop e o banco `mesa-handouts-v1` não mudaram. Testes: 7 unitários no Ateliê (275 no total) e e2e do Ateliê (`exchange`, `handoff`, `shell`, `document-tabs`) sem regressão; no Atlas, `tests/e2e/atelie.test.ts` com o Ateliê de verdade sob o `mesa-dev`. Achado para a 9.1c: o Vite de desenvolvimento do Ateliê não aplica `VITE_ATELIE_STORAGE` (precisa de `?storage=browser` ou `window.__ATELIE_STORAGE`), então não há `dev:mesa` simples para ele ainda.
Commit (Ateliê): join the table contract

### 9.4a — 🔒 Jukebox no contrato  ✅
Objetivo: o Jukebox publica as cenas na campanha, toca uma cena quando pedido e avisa o que está tocando.
Depende de: 9.1c; autorização para mudar o Jukebox.
Ler: `Jukebox/index.html`, `scenes.js` (`loadScenes`, ids das cenas, aplicar uma cena), `player.js`, `README.md`.
Arquivos: no Jukebox, `vendor/mesa-core/` (o JS compilado, importado por `<script type="module">`, sem bundler), `mesa.json`, `mesa.js`.
Como:
1. Primeiro, relatório: como uma cena é aplicada (função), se o id é estável, o que acontece quando faltam faixas (`countMissingTracks`).
2. `mesa.js`: com campanha ativa, cria ou atualiza uma entidade `cena` por cena do Jukebox, com Ref `mesa:jukebox/cena-sonora/<id>`; atende `jukebox.tocar { ref }` aplicando a cena (resposta `ok: false, motivo` se faltam faixas); emite `jukebox.tocando { cena | null }`.
3. Navegador sem `BroadcastChannel`: nada muda.
Não fazer: efeitos avulsos (9.4d).
Testes: e2e no Atlas sob o `mesa-dev` com o Jukebox: trocar o clima no Atlas toca a cena escolhida (confere `jukebox.tocando`). É a primeira vez que a 4.7a roda contra o Jukebox de verdade.
Pronto quando: o pedido do Atlas toca a cena no Jukebox.
Nota: autorizado pelo usuário em 4 de novembro de 2026 (só o Jukebox). No Jukebox: `mesa.json`, `mesa.js`, `vendor/mesa-core/` (cópia compilada), duas exportações em `scenes.js` (`activateSceneById`, `getActiveSceneId`) e o evento `sceneActivated`. Cada cena vira uma entidade `cena` (`mesa:jukebox/cena-sonora/<id>`), `jukebox.tocar` ativa a cena sem alternar (se faltam faixas, as que existem tocam e a resposta é `ok: false` com o motivo) e `jukebox.tocando` avisa a cena ativa. Testado contra o Jukebox de verdade sob o `mesa-dev` (`tests/e2e/jukebox.test.ts`): é a primeira vez que a 4.7a roda contra ele.
Commit (Jukebox): join the table contract

### 9.4b — Cena sonora por mapa, região e clima  ✅
Objetivo: escolher a cena do Jukebox para o mapa, para cada região de áudio e para cada clima, a partir das cenas da campanha.
Depende de: 9.4a (para dados reais).
Ler: `src/app/audio-do-clima.ts` e o campo "Som deste clima" (4.7a); `src/domain/mapa.ts` (`audioCue`, `climateAudio`, `Regiao.kind === 'audio'`, `refs`); `src/ui/Inspetor.tsx`.
Arquivos: criar `src/ui/EscolherCena.tsx`; mudar `Inspetor.tsx`, `audio-do-clima.ts`, `src/app/app.ts`.
Como:
1. `EscolherCena`: lista as entidades `cena` com Ref do Jukebox da campanha ativa, com busca, "Ouvir" (pede `jukebox.tocar`) e "Nenhuma". Substitui o campo provisório da 4.7a e é usado em três lugares: aba Mapa ("Som do mapa" → `audioCue`), seção Clima ("Som deste clima" → `climateAudio`) e inspetor da região `audio` (→ o primeiro `refs` da região).
2. Abrir o mapa na sessão pede a cena do mapa; trocar o clima pede a do clima (como hoje).
Não fazer: entrar em região (9.4c).
Testes: e2e com barramento falso: escolher uma cena para "Noite" e trocar para Noite pede aquela cena.
Pronto quando: o teste passa e o campo provisório sumiu.
Nota: `ui/EscolherCena.tsx` (busca, "Ouvir", "Nenhuma") substituiu o campo provisório; serve ao clima, ao mapa (comando novo `mapa.audio`, aba Mapa → Som) e à região de áudio. Abrir o mapa na sessão pede a cena do mapa. As cenas vêm das entidades `cena` da campanha (a 9.4a, 🔒, é quem as publica).
Commit: pick sound scenes from the campaign

### 9.4c — Entrar numa região  ✅
Objetivo: quando uma peça de jogador entra numa região, o Atlas avisa e, se for região de áudio, pede a cena.
Depende de: 9.4b; (depois da 7) movimento e peças de jogador.
Ler: `src/state/comandos.ts` (`peca.mover`); `src/render/selecao.ts` (`pontoNoPoligono`); `mesa-core` (`atlas.regiao-entrou`).
Arquivos: criar `src/domain/regioes.ts`, `tests/unit/regioes.test.ts`; mudar `src/app/app.ts` (ou `src/app/sessao.ts`).
Como:
1. `regioesEntradas(antes: MapaAtlas, depois: MapaAtlas): { regiao: string; peca: string }[]`, pura: regiões em que alguma peça de jogador passou a estar.
2. Depois de cada `peca.mover` na sessão: emite `atlas.regiao-entrou { mapa, regiao }`; região `audio` com Ref pede `jukebox.tocar`; região `trigger` mostra ao mestre o `payload` (toast com o texto, se houver).
3. Sair da região de áudio volta à cena do clima (ou do mapa).
Não fazer: regiões que disparam efeitos de cena (pode ser pendência).
Testes: unitários de `regioesEntradas` (entrar, já estar dentro, peça que não é de jogador); e2e com barramento falso.
Pronto quando: os testes passam.
Nota: `domain/regioes.ts` (`regioesEntradas`, `regioesOcupadas`), `app/regioes.ts` (`reagirAoMovimento`): emite `atlas.regiao-entrou`, a região de áudio pede a cena, o gatilho mostra o texto (campo novo "Texto do gatilho"), e sair da última região de áudio volta à cena do clima (ou do mapa).
Commit: region enter events

### 9.4d — 🔒 Efeitos avulsos do Jukebox nos interagíveis  ✅
Objetivo: portas e interagíveis podem tocar um efeito da biblioteca do Jukebox no lugar do som sintetizado.
Depende de: 9.4a, 7.6b; autorização; **só se o Jukebox tiver ou ganhar efeitos avulsos** (hoje os "efeitos" dele são filtros sobre trechos de música).
Ler: ARQUITETURA §8.1; o Jukebox inteiro, de novo.
Arquivos: Jukebox (efeitos avulsos e pedido `jukebox.efeito`); `mesa-core` (tipo novo no catálogo, sem subir o contrato); Atlas (`som: Ref` de aberturas e interagíveis tocado por `jukebox.efeito`, com o sintetizado como reserva).
Como: 👤 Primeiro, mostrar ao usuário o que seria preciso no Jukebox e decidir se vale. Se não valer, a alternativa é uma biblioteca de efeitos do próprio Atlas em `public/colecao/sons/` (arquivos CC0 registrados em `LICENCAS.md`), e esta tarefa vira isso, sem 🔒.
Não fazer: nada antes da decisão.
Testes: definidos depois da decisão.
Pronto quando: a decisão está tomada e implementada.
Nota: decisão do usuário: o Atlas usa só os efeitos que estão no Jukebox. No Jukebox um efeito avulso é uma faixa com o gênero `sfx`; ele os publica como entidades `efeito` (`mesa:jukebox/efeito/<título sem acento>`, id estável porque os ids das faixas mudam a cada carga do preset) e atende `jukebox.efeito` (toca uma vez por cima da música; pedido de novo, recomeça). No `mesa-core`: pedido novo `jukebox.efeito` e tipo de entidade `efeito` (sem subir o contrato). No Atlas: `EscolherCena` com `tipo="efeito"` na porta (`som`) e nos interagíveis (`sound`); `tocarSomEscolhido` pede o efeito e, se o Jukebox não atende em 0,4 s, toca o sintetizado (a reserva).
Commit: (conforme a decisão)

### 9.5a — 🔒 Mesa em modo sessão  ✅
Objetivo: a Mesa mostra Atlas, fichas e Jukebox lado a lado durante a sessão.
Depende de: 9.1c, 9.2a, 9.4a.
Ler: PLATAFORMA §9; `Atlas/src/app/rotas.ts`; `Atlas/src/ui/App.tsx`.
Arquivos: Mesa (`src/ui/ModoSessao.tsx`); Atlas (modo embutido); nos outros, só se precisarem de modo embutido (autorização por projeto).
Como:
1. Mesa: layout em colunas redimensionáveis com `iframe` de mesma origem (Atlas grande; fichas dos personagens da sessão em abas; Jukebox estreito), presets de layout, tela cheia por painel.
2. Atlas: `?embutido=1` esconde galeria e cabeçalho grande, abre direto em Sessão e deixa o projetor como botão. Os outros aplicativos ganham o mesmo parâmetro só se quebrarem dentro do `iframe`.
3. O tema e a campanha já se propagam pelo `mesa-core`.
Não fazer: roteiro (9.5b).
Testes: e2e na Mesa: os três `iframe` carregam sob o `mesa-dev`, e uma rolagem na Ficha embutida aparece no Atlas embutido.
Pronto quando: o teste passa.
Nota: **Atlas:** `?embutido=1` (`src/app/embutido.ts`) esconde a galeria (sem mapa, mostra "Sem mapa: escolha um mapa na Mesa") e o cabeçalho grande (fica o compacto: nome do mapa, "Jogador", "Projetor" a um botão, animações e sons), abre cada mapa direto em Sessão e `alternarModo` não faz nada (não há como voltar a Construir); a janela do projetor sai sem o parâmetro. **Mesa:** aba Sessão (`dominio/layout.ts`, `dominio/sessao.ts`, `app/sessao.ts`, `ui/ModoSessao.tsx`): `iframe`s de mesma origem (Atlas em `?embutido=1#/mapa/<id>`, Ficha pela rota do manifesto, Jukebox), fichas das personagens em abas (cada `iframe` só carrega ao abrir a aba e fica vivo), divisores por arrasto (com mínimo de 200 px) e por setas, cinco presets (Padrão, Mapa grande, Mapa e fichas, Com diário, Só o mapa), painéis que se escondem, tela cheia por painel (`requestFullscreen`); o layout é lembrado por navegador, e o mapa e as fichas escolhidos, por campanha. Nenhum outro aplicativo precisou do parâmetro de modo embutido: a Ficha e o Jukebox funcionam dentro do `iframe` (o Jukebox é estreito: o preset "Mapa grande" e a tela cheia ajudam). Painel de aplicativo fora do ar mostra um aviso em vez do erro do navegador. Testes: 8 unitários do layout, 6 da seleção de mapa e fichas, e e2e com a Ficha de verdade (os três `iframe` carregam, o Atlas embutido não tem galeria nem alterna modo, uma rolagem na Ficha embutida chega ao Atlas embutido, layout, divisor, setas, tela cheia e fichas em abas).
Commit (Mesa): session mode; (Atlas): embedded mode

### 9.5b — 🔒 Roteiro e registro da sessão  ✅
Objetivo: a sessão tem um roteiro (mapas, cenas, documentos) e um registro automático do que aconteceu.
Depende de: 9.5a.
Ler: `Atlas/mesa-core/src/campanha.ts` (`Sessao`); `mesa-core/src/eventos.ts` (fatos).
Arquivos: Mesa (`src/ui/Roteiro.tsx`, `src/dominio/registro.ts`, testes).
Como:
1. Roteiro: lista ordenada de Refs com notas; clicar abre no painel certo (pede `atlas.focar` etc.).
2. Registro: a Mesa escuta os fatos do barramento durante a sessão ativa e grava entradas legíveis ("Muirenn rolou Investigação: 17", "Cômodo Biblioteca revelado", "Tocando: Chuva forte") com hora; o mestre acrescenta notas; exportar em Markdown.
3. `mesa.sessao-iniciada` ao começar.
Não fazer: sincronizar entre computadores.
Testes: unitário de `registro.ts` (fato → texto) por tabela; e2e: três fatos falsos viram três linhas.
Pronto quando: os testes passam.
Nota: um quarto painel, **Diário** (`ui/Diario.tsx`, `app/registro.ts`, `dominio/registro.ts`, `dominio/roteiro.ts`), com o preset "Com diário". **Sessão:** "Iniciar sessão" cria a `Sessao` no banco da campanha, liga a escuta e emite `mesa.sessao-iniciada` com o Ref `mesa:mesa/sessao/<id>`; a sessão aberta e se está gravando são lembradas por campanha (recarregar retoma e continua gravando); "Parar" e "Gravar", "Fechar" e "Abrir" pela lista de sessões anteriores. **Registro:** uma linha por fato (`[19:42] Muirenn rolou Investigação: 17`): rolagem, mapa aberto, região em que uma peça entrou, revelado aos jogadores, documento do Ateliê salvo e música tocando; `ficha.recursos` fica de fora (ruído), fato de outra campanha e o mesmo texto em 1,5 s são ignorados; o mestre anota (`[19:50] > A porta rangeu`, vale mesmo parado). Para o registro ter nomes, o Atlas passou a mandar `nome` em `atlas.revelado` e `nome` e `peca` em `atlas.regiao-entrou` (acréscimos opcionais; o catálogo e o `mesa-core` não mudaram). **Roteiro:** lista ordenada de Refs abríveis (mapa, cômodo, ficha, documento, cena e efeito), sem repetir, até 64, com subir, descer e tirar; clicar abre no aplicativo dono (`atlas.focar`, `ficha.abrir`, `atelie.abrir`, e `jukebox.tocar`/`jukebox.efeito` no Jukebox) depois de garantir que o painel dele está à vista. **Limite do contrato:** `Sessao.roteiro` guarda só Refs, então a **nota de cada item** do roteiro fica no `localStorage` da sessão (não no banco); se quiser notas no banco, o `mesa-core` precisa de um campo novo (aditivo, a copiar nos quatro `vendor/`), e isso é decisão sua. **Exportar:** `.md` com título, data, roteiro numerado (com as notas) e registro com as anotações em destaque. Testes: 31 unitários (fato → texto por tabela, linhas, limite, repetição, Markdown, roteiro) e e2e com o Atlas real (início avisado, os fatos certos viram linhas e os errados não, anotação, roteiro abre o mapa no Atlas, exportar, banco, recarregar, parar). O e2e achou um bug real (a lista de sessões guardava o registro velho), já corrigido. Nota: o Atlas embutido no painel também abre o mapa e por isso registra "Mapa aberto" ao carregar.
Commit (Mesa): session script and log

### 9.6a — Motor de tutoriais  ✅
Objetivo: um tutor que aponta, espera a pessoa fazer e confere o resultado, sobre a interface real do Atlas.
Depende de: —
Ler: `Tabletop/src/tutorial/tutor.js` e `conditions.js` inteiros; `Tabletop/src/tutorial/lessons.js` (duas lições, para ver o formato); `src/app/sessao.ts`; `src/ui/App.tsx`.
Arquivos: criar `src/tutorial/tutor.ts`, `src/tutorial/condicoes.ts`, `src/ui/Tutor.tsx`, `tests/unit/condicoes.test.ts`; mudar `src/app/acoes.ts`, `src/ui/estilo.css`.
Como:
1. Porte para TypeScript e Preact: lição = passos `{ texto; alvo: seletor | ponto do mapa; condicao(estado): boolean; valores?: Record<string, string>; tentar?: boolean }`; anel no alvo, mancha no ponto do mapa (`viewport.clientDe`), cartão com o passo; ajuda em degraus (o anel insiste aos 20 s, oferece os valores aos 35 s); nunca faz o passo pela pessoa.
2. `condicoes.ts`: ajudantes puros sobre o documento e a sessão (`temComodoComFuncao`, `luzComPreset`, `climaE`, `valorIgual(caminho, valor, tolerancia)`…).
3. Progresso e registro local (`atlas-tutoriais-v1`), como no Tabletop; "Exportar relatório" na paleta.
4. As lições rodam num mapa de treino criado pela lição (o mapa do mestre não é tocado).
Não fazer: as lições (9.6b).
Testes: unitários das condições; e2e com uma lição de dois passos de teste.
Pronto quando: a lição de teste completa só com cliques reais.
Nota: `tutorial/condicoes.ts` (verificações puras sobre o resultado, `e`, `selecionadoEm`, "quase lá"), `tutorial/tutor.ts` (controlador com progresso e registro em `atlas-tutoriais-v1`, ajuda em degraus, voltar e pular), `ui/Tutor.tsx` (anel, marcas no mapa, cartão que se afasta do alvo e dos pontos a clicar, cartão final), `app/tutoriais.ts` (mapa de treino criado pela lição, sugestões caladas fora da lição do assistente) e "Aprender" na galeria. Exportar o relatório está na galeria e na paleta. Os campos do inspetor ganharam `data-campo` para o tutor apontar.
Commit: tutorial engine

### 9.6b — Lições  ✅
Objetivo: cinco lições que terminam num resultado bonito e ensinam o Atlas de verdade.
Depende de: 9.6a
Ler: `src/tutorial/`; a decisão sobre tutoriais no topo deste arquivo; as capturas das validações das fases 5 a 8.
Arquivos: criar `src/tutorial/licoes.ts`, `tests/e2e/tutoriais.test.ts`; mudar `src/ui/Galeria.tsx` (entrada "Aprender").
Como:
1. Para cada lição, **primeiro** monte o resultado final à mão e capture (`test-results/licao-<id>-alvo.png`); só depois escreva os passos.
2. Lições: **Primeira casa** (pintar três cômodos, portas, um objeto, uma luz; cada valor definido); **O assistente** (nomear cômodos e aceitar pílulas, ajustar o que não gostou); **Espalhar e terreno** (jardim e bosque em volta da casa); **Climas** (a mesma casa de dia, na tempestade e no apagão; os valores de luz e acabamento definidos, com paleta coerente: quente por dentro, frio por fora); **Sessão** (duas peças, portas, revelar, projetor).
3. Cada passo que define o visual confere o valor exato (com tolerância pequena) e o encaixe na grade é desligado quando a posição importa.
4. Cada lição termina mostrando o resultado ao lado da captura-alvo.
Não fazer: lições de integração com outros aplicativos.
Testes: e2e que percorre cada lição fazendo os passos pela interface e compara a captura final com a alvo (diferença média baixa).
Pronto quando: as cinco lições passam no e2e e a captura final de cada uma fica bonita.
Nota: cinco lições (`tutorial/licoes.ts`): Primeira casa, O assistente, Espalhar e terreno, Climas e Sessão, cada uma com os valores escolhidos e o resultado conferido. O e2e (`tests/e2e/tutoriais.test.ts`) monta o gabarito com os mesmos gestos, percorre cada lição com o tutor, confere que nenhum passo avança antes da hora e compara o mapa final com o gabarito (`test-results/licao-*-alvo.png` e `-final.png`). O cartão final mostra `public/tutoriais/<id>.jpg` (gerado com `ATUALIZAR_ALVOS=1`). O "gabarito" é montado pela interface, não por comandos: o resultado é o mesmo, sem escrever os dados duas vezes.
Commit: tutorial lessons

### 9.7 — Validação da fase  ✅
Objetivo: provar o critério de pronto (confirmado com o usuário no começo da fase) e registrar o relatório.
Depende de: todas as que foram autorizadas.
Ler: os e2e das fases 7 e 8.
Arquivos: criar `tests/e2e/fase9.test.ts` (no Atlas; e o equivalente na Mesa, se ela existir); mudar `progress.md`.
Como:
1. Sob o `mesa-dev` com todos os aplicativos autorizados: campanha na Mesa; personagem da Ficha vira peça; rolagem aparece sobre a peça e no projetor; pista do Ateliê é inspecionada com UV no projetor; trocar o clima toca a cena no Jukebox; entrar numa região troca a música; registro da sessão tem tudo isso.
2. O que não foi autorizado fica fora do e2e e entra no relatório como "não feito por decisão".
3. progress.md: resumo da fase e o estado de cada integração.
Não fazer: consertar outro projeto sem autorização.
Testes: os acima, mais os testes de cada projeto tocado.
Pronto quando: tudo passa e o relatório está no progress.md.
Nota: só a parte do Atlas foi feita, com Ficha, Ateliê e Jukebox falsos no barramento (`fase 9 (parte do Atlas…)` em `tests/e2e/fase9.test.ts`): a ficha vira peça, a rolagem aparece sobre ela e no projetor, a pista é inspecionada com UV no projetor, o clima e a região trocam a cena. Falta tudo o que depende de outro projeto (🔒): a Mesa, o registro da sessão e os testes contra os aplicativos de verdade.
Nota (fechamento): com Mesa, Ficha, Ateliê e Jukebox autorizados e integrados, o e2e **encadeado com os aplicativos de verdade** está em `Mesa/tests/e2e/fase9.test.ts` (o e2e do Atlas com aplicativos falsos continua, como teste do Atlas sozinho). Numa origem só: a Mesa cria a campanha e inicia a sessão; o Jukebox real carrega o preset e publica as cenas; a Ficha real publica as personagens; o Ateliê real arquiva um bilhete com camada UV; no Atlas a personagem vira peça (a Ficha abre a ficha pedida por `ficha.abrir`), a pista entra no cômodo, o clima e uma região de áudio ficam ligados às cenas reais; a rolagem na Ficha aparece sobre a peça e no projetor; a pista é inspecionada com UV no projetor e revelada; trocar o clima, entrar na região e sair tocam no Jukebox real `[aurora, batalha, aurora]`; e o diário da Mesa registra a rolagem, a revelação, a entrada na região, as duas músicas e o documento salvo. Passou em três rodadas seguidas. O e2e achou que, no layout cinemático da Ficha, o primeiro botão de rolagem fica sob o retrato (o teste clica num botão descoberto); vale um olhar seu se isso também acontece com o mouse. Fichas de ameaça ligadas às peças (a pedido do usuário, depois da validação): o contrato ganhou o tipo de entidade `ameaca` (aditivo; cópia nos quatro `vendor/`); a Ficha publica as fichas de ameaça (98, 65 com retrato) como `ameaca`, com `ficha.recursos` só de PV (PD zero) e `ficha.rolagem`, relê só o que mudou (assinaturas guardadas por campanha) e tira da campanha as entidades de fichas apagadas (lista vazia nunca apaga); o Atlas lista as ameaças na seção Personagens (busca, 40 por vez) e põe no mapa uma peça de inimigo (`player: false`) ligada à ficha, com só a fileira de PV (sem PD) e sem nunca mandar a vida de um inimigo ao projetor; a Mesa mostra o tipo "Ameaça". Uma peça por ficha: dois monstros iguais pedem duas fichas (duplicar na Ficha). Tudo vem das fichas que existem na Ficha agora, inclusive as que forem criadas depois. Depois da validação, a pedido do usuário: notas do roteiro no banco (`Sessao.roteiroNotas`, opcional), `mesa.json` do Tabletop, painéis do modo sessão com largura lógica mínima e escala, Ateliê e Tabletop com `dev:mesa` (Vite com `base`, armazenamento no navegador) no `mesa-dev` e `node_modules` fora do git da Ficha. Validação da fase: Atlas `tsc` limpo, 502 unitários, 100 e2e (suíte completa); Mesa `tsc` limpo, 84 unitários, 7 e2e; Ateliê 275 unitários e os e2e de troca, janela, shell e abas.
Commit: validate phase 9
