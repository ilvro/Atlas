# Mesa — tutoriais ("Aprender")

A Mesa cresceu (Quadro, Modo Sessão, cenas, mesa online) e só tem a faixa de 3 passos do Modo Sessão (`GuiaDaSessao`) e o guia estático do Miro. O Atlas já ensina com o tutor interativo (`Atlas/src/tutorial/`, `src/app/tutoriais.ts`, `src/ui/Tutor.tsx`, `src/ui/Aprender.tsx`): uma lição aponta o controle, a pessoa faz e o passo avança quando o **resultado** aparece.

Esta frente leva o mesmo modelo à Mesa.

## Decisões

- **Mesmo motor, cópia própria.** A Mesa não importa código do Atlas (repositórios separados). `src/tutorial/tutor.ts` é a cópia do motor genérico do Atlas sem os pontos do mapa; `src/tutorial/condicoes.ts` é da Mesa (lê campanha, quadro, sessão, projeção).
- **Campanha de treino.** Cada lição cria uma campanha `Treino · <título>` com a semente que ela precisa (entidades da própria Mesa, um quadro, itens com revisão pendente) e a torna ativa. A campanha do mestre nunca é tocada. No fim, o cartão oferece **Apagar o treino** (apaga a campanha, os quadros, as sessões e os modelos de escopo da campanha) e **Voltar à minha campanha** (reativa a que estava ativa antes).
- **Condições leem resultado, não clique.** Ex.: `molduras ≥ 1`, um texto com marcador `segredo`, `projetando != null`, sessão gravando. Estado que hoje é local da UI (a ferramenta e o modo Ler do quadro) passa a ser espelhado em signals de `src/app/quadro-ui.ts`.
- **Entrada:** aba **Aprender** no cabeçalho (`Tela = 'aprender'`), com a lista de lições em pastas, como no Atlas.
- **Lições:** Quadro I (notas e marcadores), Quadro II (ligações, setas, modelos, revisão, Ler e projeção), Modo Sessão, Preparar uma cena (campanha, Ctrl+K, botão direito) e Mesa online (o caminho, só leitura).
- **Nomes reais.** As lições usam os rótulos da tela de hoje (presets `Padrão`, `Mapa grande`, `Mapa e fichas`, `Com diário`, `Com quadro`, `Só o mapa`; o seletor `Foco:`; `▶ Ativar Cena`), não os da conversa que originou a frente.

## Limites (o que a lição não exercita de verdade)

- **Combate** e o **mapa** do Modo Sessão precisam do Atlas aberto com um mapa e peças; a campanha de treino não tem mapa do Atlas. A lição da Sessão explica a faixa de combate com passos de leitura (anel no `combate-iniciar`), sem exigir o combate.
- **Ativar Cena** sem Atlas/Jukebox abertos só anota no Diário e marca a cena como ativada; os pedidos aos outros apps falham em silêncio. A lição avisa isso.
- **Mesa online** exige login no Discord e a sala na Cloudflare: a lição só mostra o caminho (navega até `#/online` e aponta os controles), sem criar sala.
- Ficam de fora: importação do Miro (já tem guia), cofre e exportação.

## Fichas

### MT1 — motor do tutor e condições da Mesa  ⬜
Objetivo: o motor (`criarTutor`) e as condições, puros e testados, sem UI.
Depende de: —
Ler: `Atlas/src/tutorial/tutor.ts`, `Atlas/src/tutorial/condicoes.ts`, `Atlas/tests/unit/tutor.test.ts`; na Mesa, `src/app/quadros.ts` (signals `itens`, `quadroAberto`, `selecao`), `src/app/rotas.ts` (`tela`), `src/app/registro.ts` (`sessaoAtiva`, `gravando`, `linhas`), `src/app/sessao.ts` (`layout`, `cenaAtivadaNestaVisita`), `src/dominio/layout.ts` (`presetDe`), `src/app/foco-do-quadro.ts` (`modoFocoSessao`), `src/app/projecao.ts` (`projetando`), `src/app/modelos.ts`, `src/dominio/marcadores.ts` (`analisarMarcadores`), `src/dominio/quadro.ts` (`Item`, `textoPuro`).
Arquivos: criar `src/tutorial/tutor.ts`, `src/tutorial/condicoes.ts`, `src/app/quadro-ui.ts`, `tests/unit/tutorial/tutor.test.ts`, `tests/unit/tutorial/condicoes.test.ts`; mudar `src/ui/quadro/Quadro.tsx` (só espelhar `ferramenta` e `modoQuadro`).
Como:
- `tutor.ts`: copiar o motor do Atlas tirando `Ponto`, `ponto`, `mapa` da `Licao`, o `assistente`, e as ações `mapa`/`retangulo`/`arrastar`/`cor` (fica `clicar`, `preencher`, `escolher`, `tecla`). Chaves `mesa-tutoriais-v1` e `mesa-tutoriais-registro-v1`. Manter `porPasta`.
- `condicoes.ts`: `EstadoDoTutor` = `{ tela, itens: readonly Item[], quadroAbertoId, ferramenta, modoQuadro: 'quadro'|'ler', selecao: readonly string[], entidades: readonly Entidade[], ligacoes: readonly Ligacao[], sessaoGravando: boolean, temSessao: boolean, linhasDoRegistro: number, preset: string | null, paineisVisiveis: readonly string[], modoFoco: string, cenaAtivada: boolean, projetando: boolean, buscaRapidaAberta: boolean, menuContextoAberto: boolean, modelosDesde: number }` (`modelosDesde` = modelos criados depois do início da lição). Condições: `ler`, `e`, `tela`, `ferramenta`, `modoQuadro`, `itens(tipo, n)`, `molduraComTitulo(titulo)`, `marcador(tipo, n=1)` (texto/forma cujo `textoPuro` tem um `analisarMarcadores` daquele tipo), `ligacaoNoTexto(nome)` (texto com `[[nome]]`), `refDe(tipoEntidade?)` (item `ref`), `setaLigada(n=1)` (as duas pontas com `itemId`), `dentroDeMoldura(tipo, n)` (item com `molduraId`), `selecionados(n)`, `semRevisao` (nenhum item com `revisao`), `modelos(n)` (`modelosDesde >= n`), `projetando`, `naoProjetando`, `sessaoGravando`, `sessaoParada` (tem sessão e não grava), `registro(n)`, `preset(id)`, `painel(id)`, `modoFoco(m)`, `cenaAtivada`, `entidadeDe(tipo, n)`, `entidadeNomeada(nome)`, `cenaCom(tipoLigado)` (uma cena com ligação a entidade daquele tipo; conferir os tipos de ligação em `vincular*NaCena`), `buscaRapida`, `menuContexto`. `atendida()` igual ao Atlas.
- `quadro-ui.ts`: `export const ferramentaDoQuadro = signal('selecionar'); export const modoDoQuadro = signal<'quadro'|'ler'>('quadro');`. No `Quadro.tsx`, um `useEffect`/`effect` que copia `ferramenta.value` e `modoQuadro.value` para eles (e volta a `'selecionar'`/`'quadro'` ao desmontar). Nada mais muda no `Quadro.tsx`.
Não fazer: UI, lições, campanha de treino.
Testes: motor (iniciar, avançar por `tique`, `ler` espera `continuar`, voltar retém, pular, progresso gravado, `porPasta`) e cada condição com um estado montado à mão.
Pronto quando: typecheck e testes passam; `src/tutorial` não importa UI nem DOM.
Commit: `(feature) tutorial engine and board/session conditions for mesa`

### MT2 — campanha de treino, tela Aprender e cartão do tutor  ⬜
Objetivo: a pessoa abre **Aprender**, começa uma lição (a lição oculta de teste) e o cartão aparece sobre a tela de verdade.
Depende de: MT1.
Ler: `Atlas/src/app/tutoriais.ts`, `Atlas/src/ui/Tutor.tsx`, `Atlas/src/ui/Aprender.tsx`, o CSS `.tutor*` e `.aprender*` de `Atlas/src/ui/*.css`; na Mesa, `src/app/campanha.ts` (`criarCampanha`, `escolherCampanha`, `removerCampanha`, `criarEntidade`, `alterarEntidade`), `src/app/quadros.ts` (`criarQuadro`, `abrirQuadro`), `src/app/banco-quadros.ts` (`gravarItens`), `src/app/registro.ts` (`removerSessao`, `sessoes`), `src/app/modelos.ts` (`apagarModelo`), `src/ui/App.tsx`, `src/ui/Cabecalho.tsx`, `src/app/rotas.ts`, `src/ui/BuscaRapida.tsx` (`buscaRapidaAberta`), `src/ui/MenuDeContexto.tsx` (o signal do menu aberto).
Arquivos: criar `src/app/tutoriais.ts`, `src/ui/Aprender.tsx`, `src/ui/Tutor.tsx`, `src/ui/tutor.css`, `src/tutorial/licoes.ts` (só `PASTAS_DE_LICOES`, a lição oculta `teste-do-motor` e `LICOES`); mudar `src/app/rotas.ts` (`'aprender'` na `Tela` e `#/aprender`), `src/ui/Cabecalho.tsx` (botão **Aprender**, `data-testid="aba-aprender"`), `src/ui/App.tsx` (rota e `<Tutor />` sempre montado no app do mestre).
Como:
- `Licao` ganha `semente?: Semente` = `{ entidades?: { tipo, nome, notas? }[]; quadro?: { nome; itens?: ItemDaSemente[] }; tela?: Tela; abrirQuadro?: boolean }`; `ItemDaSemente` monta itens com `novaMoldura`/`novaNotaAdesiva`/`novaRef` e pode trazer `revisao`.
- `iniciarLicao(id, de)`: guarda a campanha ativa anterior (`campanhaAnterior`, também em `localStorage` para sobreviver a recarga), cria `Treino · <título>` com `criarCampanha(..., { selecionar: true })`, planta a semente, navega (`tela.value`, `navegarParaQuadro`) e chama `tutor.iniciar`. `campanhaDeTreino` signal `{ id, nome }`. Começar outra lição com um treino ativo reaproveita? Não: cria outro (simples); o cartão final oferece apagar.
- `apagarTreino()`: remove sessões da campanha de treino (se `removerCampanha` não as levar), modelos com `campanhaId` do treino, a campanha (`removerCampanha`) e volta à anterior. `voltarACampanha()`: só reativa a anterior.
- `estadoDoTutor()` monta o `EstadoDoTutor` dos signals reais; `modelosDesde` conta `todosOsModelos` com `criadoEm >= inicioDaLicao`.
- `Tutor.tsx`: o do Atlas sem marcas do mapa nem "Focar nos pontos", sem "quase lá"; anel no `alvo`, cartão que evita cobrir o alvo, ajuda em degraus, cartão final com **Apagar o treino** / **Voltar à minha campanha** / **Próxima**. `Aprender.tsx`: lista em pastas, progresso, Começar/Continuar do passo N.
- CSS: copiar as regras `.tutor*` e `.aprender*` do Atlas para `tutor.css`, nos tokens da Mesa (conferir os nomes em `src/ui/estilo.css`), importado pelo `App.tsx` ou `main.tsx`.
- A lição oculta `teste-do-motor`: ir para a aba Quadros (`tela('quadros')`) e pegar a ferramenta Nota (`ferramenta('nota')`).
Não fazer: lições reais (MT3–MT5); mexer em `ModoSessao.tsx` (outra sessão está nele).
Testes: unitário de `estadoDoTutor` não é preciso; e2e em `tests/e2e/tutoriais.test.ts` (ver `tests/e2e/apoio.ts`): abre Aprender, começa a lição oculta por `iniciarLicao` exposto em `window` só em dev, ou pela lista se a oculta for mostrada com `?tutor-teste`, faz os dois passos pela interface e vê o cartão final; apagar o treino volta à campanha anterior.
Pronto quando: a aba Aprender lista as pastas; a lição de teste roda de ponta a ponta numa campanha de treino e apagar o treino não deixa rastro.
Commit: `(feature) learn tab with training campaign and tutor card`

### MT3 — lições do Quadro  ⬜
Objetivo: duas lições reais do Quadro, numa campanha de treino com Joana (personagem), Casa abandonada (lugar), Carta rasgada (pista) e um quadro "Preparação".
Depende de: MT2.
Ler: `src/ui/quadro/BarraDeFerramentas.tsx`, `src/ui/quadro/Quadro.tsx` (criar moldura, renomear moldura, nota, seta, `seletor-entidade`, menu de contexto do item), `src/ui/quadro/MenuDoItem.tsx` (`menu-salvar-modelo`, `modelo-*`, `menu-mostrar-aos-jogadores`), `src/ui/quadro/FilaDeRevisao.tsx`, `src/dominio/marcadores.ts` (sintaxe exata de teste, segredo, loot e fala).
Arquivos: mudar `src/tutorial/licoes.ts`; criar `tests/unit/tutorial/licoes.test.ts`.
Como:
- Pasta `quadro` ("Quadro"). Lição `quadro-notas` ("Quadro I · notas que viram jogo", ~6 min): ferramenta Moldura → desenhar uma moldura → título "Casa abandonada" → ferramenta Nota dentro da moldura → nota com `[PERCEPÇÃO 13] marcas de unha na porta` (marcador `teste`) → nota `[SEGREDO] o caseiro está no porão` (`segredo`) → nota de fala na sintaxe de `marcadores.ts` (`fala`) → nota com `[LOOT] chave enferrujada` (`loot`) → leitura sobre as cores e etiquetas automáticas. `proxima: 'quadro-ligacoes'`.
- Lição `quadro-ligacoes` ("Quadro II · ligações, modelos e projeção", ~7 min), semente com a moldura "Casa abandonada" e duas notas já feitas, mais três notas com `revisao` (origem `miro`): `[[Joana]]` numa nota (`ligacaoNoTexto`) → ferramenta Entidade e pôr a Carta rasgada (`refDe('pista')`) → ferramenta Seta ligando duas notas (`setaLigada`) → selecionar a moldura e botão direito → Salvar como modelo (`modelos(1)`) → abrir a fila de revisão e aceitar tudo (`semRevisao`) → aba Ler (`modoQuadro('ler')`) → voltar ao Quadro → botão direito na moldura → Mostrar aos jogadores (`projetando`) → Parar projeção (`naoProjetando`). Uma leitura explica que `[SEGREDO]` e "só mestre" não vão para a projeção.
- Cada passo com `alvo` (data-testid que exista), `porque` curto e, onde for atalho, `aprendeu` com a tecla.
- Onde um controle certo não tem `data-testid`, acrescentar um (só o atributo) no componente.
Não fazer: lições de sessão e campanha.
Testes: `licoes.test.ts`: todo `feito` usa uma condição de `CONDICOES`; todo texto de nota sugerido nas lições passa por `analisarMarcadores` e dá o tipo que o passo espera; todo `alvo` `[data-testid="x"]` aparece em algum `src/ui/**/*.tsx` (busca textual, aceitando os prefixos montados com template). E2e: `quadro-notas` de ponta a ponta pela interface.
Pronto quando: as duas lições rodam sem pular passo num navegador.
Commit: `(feature) board tutorials: notes, markers, links, templates and projection`

### MT4 — lição do Modo Sessão  ⬜
Objetivo: a lição "Modo Sessão · seu escudo ao vivo" (~5 min).
Depende de: MT2 (MT3 pela pasta e pelo teste das lições).
Ler: `src/ui/ModoSessao.tsx` (só ler; não editar), `src/dominio/layout.ts`, `src/ui/FaixaDeCombateSessao.tsx`, `src/ui/Diario.tsx`.
Arquivos: mudar `src/tutorial/licoes.ts`, `tests/unit/tutorial/licoes.test.ts`.
Como: pasta `sessao`. Semente: personagem Joana, cena "Chegada à casa" ligada à Casa abandonada, quadro "Preparação" com a moldura "Casa abandonada". Passos: aba Sessão (`tela('sessao')`) → Painéis ▾ (`abrir-menu-paineis`) → preset **Com quadro** (`preset('com-quadro')`) → nome e ▶ Iniciar sessão (`sessaoGravando`; o Diário abre) → anotar no Diário (`registro(1)`) → escolher o quadro no painel (`sessao-quadro-select`; condição `quadroAbertoId` definido) → Foco: **Seguir** (`modoFoco('seguir')`) → leitura: o que o Foco faz quando o Atlas abre um cômodo → ▶ Ativar cena… (`sessao-cena`, `cenaAtivada`) com o aviso de que sem o Atlas aberto só o Diário registra → leitura com anel em `combate-iniciar` (precisa do Atlas com peças) → Parar (`sessaoParada`).
Não fazer: editar `ModoSessao.tsx`; exigir o combate.
Testes: os de `licoes.test.ts` passam a cobrir a lição.
Pronto quando: a lição roda inteira sem o Atlas aberto.
Commit: `(feature) session mode tutorial`

### MT5 — lições da campanha e da mesa online  ⬜
Objetivo: "Preparar uma cena" (~4 min) e "Mesa online · o caminho" (~3 min, só leitura).
Depende de: MT2.
Ler: `src/ui/Entidades.tsx` (criador), `src/ui/EditorDeCena.tsx`, `src/ui/BuscaRapida.tsx`, `src/ui/MenuDeContexto.tsx`, `src/ui/MesaOnline.tsx`.
Arquivos: mudar `src/tutorial/licoes.ts`, `tests/unit/tutorial/licoes.test.ts`.
Como: pasta `campanha`. "Preparar uma cena": semente Joana, Casa abandonada, Carta rasgada; aba Campanha → criar uma **Cena** "Chegada à casa" (`entidadeDe('cena', 1)`) → ligar a pista e o participante no editor de cena (`cenaCom('pista')`, `cenaCom('personagem')`) → Ctrl+K (`buscaRapida`, `aprendeu: ['Ctrl+K', 'busca rápida']`) → abrir a Joana pelo resultado → botão direito num cartão (`menuContexto`) → leitura: abrir no app dono, ativar cena, deletar. "Mesa online": aba Online (`tela('online')`) → leituras com anel em `online-entrar`, `online-criar`, `online-guild`/`online-servidores`, `online-copiar-convite`, e a dica de testar o link de jogador numa aba anônima.
Não fazer: criar sala ou login de verdade.
Testes: `licoes.test.ts` cobre as duas.
Pronto quando: as duas lições rodam inteiras numa campanha de treino.
Commit: `(feature) campaign prep and online table tutorials`
