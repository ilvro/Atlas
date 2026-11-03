# Fase 7 — Sessão

Só a lista de tarefas (revisada em 3 de novembro de 2026, depois da Fase 5). **Detalhar com o Opus antes de começar** (fichas no modelo do [README](README.md)), conferindo o código do momento. Critério de pronto da fase: ver o [ROADMAP](../ROADMAP.md).

| # | Tarefa |
| --- | --- |
| 7.0a | Modos Construir e Sessão na mesma janela: na Sessão somem pílula de sugestão, fantasmas, cartão de construção, biblioteca e ferramentas de construir |
| 7.0b | Documento v5: interagíveis (`Objeto.interaction`: interruptor, gaveta, pista; alvo e som `Ref`), com migração |
| 7.1a | Token com retrato, tamanho e estado (render) |
| 7.1b | Movimento com trilha e interpolação entre células |
| 7.1c | Lanterna do token (luz `ownerId` seguindo direção) |
| 7.2a | Visão dos tokens com `poligonoIluminado` (de 4.1a) e máscara de visível |
| 7.2b | Explorado acumulado (`session.explored`) e névoa com memória em esboço |
| 7.2c | Revelação animada e telhados que somem |
| 7.3a | Portas na sessão: abrir, fechar, trancar, secreta revelada, por clique ou pelo token ao lado; luz e visão refazem |
| 7.3b | Régua em quadrados |
| 7.3c | Iniciativa (adaptar `Tabletop/src/domain/initiative.js`) |
| 7.4a | Dock de sessão: clima com duração da transição, relâmpago na hora |
| 7.4b | Dock: eventos de cena e intensidade da presença ao vivo (arrastar, não campo numérico: pendência da 4.6) |
| 7.4c | Dock: iniciativa (a da 7.3c) |
| 7.5a | Projeção filtrada pura (o que o jogador pode ver) |
| 7.5b | Janela de projetor por `BroadcastChannel`, câmera publicada, moldura do tema |
| 7.6a | Interagíveis: interruptor que acende e apaga as luzes do cômodo |
| 7.6b | Efeitos sonoros dos interagíveis (porta, interruptor, gaveta): sintetizados em `fx/som.ts` até a 9.4d; o `som: Ref` do item, quando houver, vai por `jukebox.tocar` |
| 7.7 | E2E do critério de pronto (nada do mestre vaza) e relatório |

Para lembrar ao detalhar: a visão e a névoa usam `poligonoIluminado` com `'visao'` (janela não deixa ver, deixa a luz passar); árvores da coleção (6.1d) talvez precisem bloquear visão; a presença ainda não se seleciona no mapa (pendência da 4.6); o assistente da Fase 5 fica desligado no modo Sessão.
