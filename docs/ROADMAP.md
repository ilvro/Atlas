# Atlas — roadmap

Data: 2 de novembro de 2026. Ordem de implementação em fases e etapas. Este documento diz **o quê**; o **como** fica em [plano/](plano/README.md), com cada etapa quebrada em tarefas do tamanho de um commit. Uma tarefa por vez; cada fase termina com resumo do que foi feito, validação e pendências em [progress.md](../progress.md). Sem commits: o usuário revisa.

Documentos: [VISAO.md](VISAO.md) · [ARQUITETURA.md](ARQUITETURA.md) · [INTERFACE.md](INTERFACE.md) · [PLATAFORMA.md](PLATAFORMA.md)

## Fase 0 — Planejamento ✅

Visão, arquitetura, interface e este roadmap.

## Fase 1 — Protótipo técnico

Protótipo descartável em `spikes/estilos/`, mas já com a cara da interface. Dois cômodos vizinhos (um retangular e um em L) com piso, papel de parede, porta entre eles, uma janela, um quadro e uma estante na parede, uma mesa com lampião, um tapete e um token com sprite.

| Etapa | Entrega |
| --- | --- |
| 1.1 | Projeto Vite + PixiJS 8; cena fixa em código; pan e zoom; grid |
| 1.2 | Descrição de desenho e renderizador Ilustrado: piso, papel de parede, mesa, tapete, estante, quadro |
| 1.3 | Paredes caixa e sólidas, com porta e janela recortando as faces |
| 1.4 | Engine de luz: luz ambiente, lampião com sombras das paredes, luz pela janela |
| 1.5 | Visão do token e névoa com memória em esboço; porta que abre e fecha |
| 1.6 | Climas: dia, noite, tempestade (chuva + relâmpago pela janela) e apagão; acabamento |
| 1.7 | Renderizador Pixel da mesma descrição; sprite paramétrico andando em 4 direções |
| 1.8 | Painel com o tema da Ficha para trocar renderizador, paredes e clima; medição e relatório |

Perguntas que o protótipo responde:

1. **Uma descrição, dois renderizadores:** os objetos, escritos uma vez, ficam bons no Ilustrado **e** no Pixel sem nenhum ajuste por estilo?
2. As paredes **caixa** convencem e mantêm o grid legível? Cantos, cômodo em L, porta vista dos dois lados.
3. A **névoa com memória** é legível e bonita?
4. O **sprite** convence no Pixel?
5. Os quatro climas mudam o momento de verdade só com luz, paleta, acabamento e partículas?
6. PixiJS 8 sustenta 60 fps com tudo ligado em 1080p?

**Pronto quando:** `npm run dev` abre o protótipo; renderizador, paredes e clima trocam ao vivo; o token anda (WASD ou clique), a visão acompanha e deixa esboço para trás; a porta abre e a luz muda; capturas e FPS medido no relatório.

## Fase 2 — Fundação ✅

Concluída em 2 de novembro de 2026; relatório em [progress.md](../progress.md). As ferramentas de adicionar (L, O, T, R) e o menu de contexto já criam luzes, objetos, peças e regiões com marcadores provisórios, só para exercitar seleção, mover, desfazer e inspetor; a Fase 3 as troca pelas ferramentas e renderizadores de verdade.

| Etapa | Entrega |
| --- | --- |
| 2.1 | Projeto definitivo em TypeScript + Preact (versões em ARQUITETURA §1), `tsc --noEmit` e testes, fontes OFL locais, temas Ordem/Prata/Neutro e casca da interface ([INTERFACE.md](INTERFACE.md) §5) |
| 2.2 | Documento `atlas.map` v1: criação, validação estrita, migrações; testes |
| 2.3 | Store com comandos, transações de gesto, undo/redo com rótulos, rascunho automático |
| 2.4 | Repositório IndexedDB, galeria de mapas, exportar e importar backup |
| 2.5 | Viewport definitivo: pan, zoom, grid configurável, seleção, laço |
| 2.6 | Efeitos de interface (adaptados de `src/fx/ui-fx.js` da Ficha), toasts com Desfazer, paleta de comandos, atalhos, menu radial |
| 2.7 | `mesa-core` v1 em TypeScript, publicado como JS + `.d.ts` (implementação de referência): Refs, envelope e catálogo de eventos, banco `mesa-campanha-v1`, manifesto, tema `mesa:tema`; testes de contrato |
| 2.8 | O Atlas na plataforma: `mesa.json`, rotas profundas (`#/mapa/{id}`), mapa ligado a uma campanha, tema compartilhado; `mesa-dev` para servir os projetos numa porta só em desenvolvimento |

**Pronto quando:** criar, salvar, reabrir, desfazer e exportar um mapa vazio; trocar de tema ao vivo (e ver outra aba mudar junto); abrir o mapa por link profundo; testes de domínio e de contrato passando.

## Fase 3 — Construir ✅

Concluída em 2 de novembro de 2026; relatório em [progress.md](../progress.md). Documento na **v2** (migração 1→2 testada). As pendências do primeiro fechamento (transições de terreno, cartela de título na interface, ligações do cômodo) foram feitas no mesmo dia.

| Etapa | Entrega |
| --- | --- |
| 3.1 | Pincel de terreno com materiais procedurais e transições automáticas |
| 3.2 | Ferramenta Cômodo: pintar células → piso + paredes derivadas; apagar, redimensionar, paredes compartilhadas |
| 3.3 | Portas e janelas com encaixe; parede manual; desanexar parede derivada |
| 3.4 | Paredes caixa e sólidas, papel de parede, objetos de parede |
| 3.5 | Descrição de desenho e renderizador Ilustrado completos; lote 1 de receitas (pisos, paredes, tapetes, mesas, cadeiras, camas, estantes, armários, papéis, livros) |
| 3.6 | Biblioteca buscável, fantasma, encaixe, rotação, pipeta, Alt + arrastar |
| 3.7 | Luzes: lamparinas e lâmpadas (círculo) e lanternas, holofotes e faróis (cone), com cor, intensidade, alcance, abertura do cone, tremulação e `power`; predefinições (vela, lamparina, tocha, lâmpada, neon, lanterna) e cor livre |
| 3.8 | Fundo do mapa, cartela de título, acabamento com predefinições |
| 3.9 | Cartão contextual com ações para cômodo, parede, abertura, objeto e luz |
| 3.10 | Por cômodo: texto para ler em voz alta, notas do mestre e ligações (`refs`) com a campanha |

**Pronto quando:** uma casa de três cômodos com portas, mobília colocada à mão e luz fica pronta em menos de dez minutos.

## Fase 4 — Climas e atmosfera

Tarefas: [plano/fase-4.md](plano/fase-4.md) (tarefas detalhadas).

"O mesmo mapa, vários momentos": a casa de dia, numa tempestade, à noite, sem energia.

| Etapa | Entrega |
| --- | --- |
| 4.1 ✅ | Engine de luz por horário: sol e lua com direção e cor, luz pelas janelas |
| 4.2 ✅ | Climas predefinidos: manhã, tarde, entardecer, noite, tempestade, neblina, neve, apagão, neon; clima do usuário |
| 4.3 ✅ | Reações automáticas: lâmpadas `grid` no apagão, `nightOnly`, relâmpagos pelas janelas, janelas acesas à noite |
| 4.4 ✅ | Partículas: chuva, neve, poeira, brasas, folhas, neblina; vento |
| 4.5 | Transição animada entre climas (comando com duração) |
| 4.6 | Pincéis de presença: naturais, sobrenaturais e pacote Ordem Paranormal |
| 4.7 | Áudio do clima: cada clima pode apontar para uma cena do Jukebox ("Tempestade" → "Chuva forte"), com troca por mapa; relâmpago com trovão |

**Pronto quando:** a casa da Fase 3 passa por dia → tempestade → noite → apagão ao vivo, sem editar nada, e cada momento parece outra cena.

## Fase 5 — Construção inteligente

Tarefas: [plano/fase-5.md](plano/fase-5.md) (tarefas detalhadas).

| Etapa | Entrega |
| --- | --- |
| 5.1 | Insight de cômodo: área, portas, janelas, circulação, objetos, função provável |
| 5.2 | Propostas: fantasma, aceitar como uma ação, pílula de sugestão no fluxo |
| 5.3 | Mobiliar pela função e pelo gênero, respeitando o que já existe; piso, papel de parede e paleta juntos |
| 5.4 | Espalhamento contextual por pincel |
| 5.5 | Sugestão de portas entre vizinhos; luzes sugeridas pela função do cômodo |

**Pronto quando:** pintar três cômodos, nomear as funções e aceitar as sugestões gera uma casa jogável que o mestre ajusta, não refaz.

## Fase 6 — Acervo da casa

Tarefas: [plano/fase-6.md](plano/fase-6.md) (tarefas detalhadas).

| Etapa | Entrega |
| --- | --- |
| 6.1 | Script de assar geradores pesados (estofados, plantas, tapetes ornamentados) para `public/colecao/` |
| 6.2 | Curadoria de assets livres (CC0 de preferência) com `docs/LICENCAS.md` |
| 6.3 | Harmonização no render para todas as fontes |
| 6.4 | Kits por gênero: casa moderna, investigação, fantasia, exterior |

**Pronto quando:** recriar um dos mapas de referência só com a coleção da casa fica no mesmo nível de detalhe, com cor coerente.

## Fase 7 — Sessão

Tarefas: [plano/fase-7.md](plano/fase-7.md) (detalhadas antes da hora; conferir ao começar).

| Etapa | Entrega |
| --- | --- |
| 7.1 | Tokens: retrato, sprite, tamanho, estado, lanterna; movimento com trilha |
| 7.2 | Visão e névoa com memória; revelação animada; telhados que somem |
| 7.3 | Portas na sessão (abrir, fechar, trancar, secreta revelada), por clique ou pelo token ao lado; régua em quadrados; iniciativa |
| 7.4 | Dock de sessão: clima, eventos de cena, presença, iniciativa |
| 7.5 | Janela de projetor com câmera publicada, moldura do tema e projeção filtrada |
| 7.6 | Interagíveis: portas, interruptores, objetos e pistas com ação e efeito sonoro próprio (ranger de porta, interruptor, gaveta); acender ou apagar luzes do cômodo pelo interruptor |

**Pronto quando:** jogar a casa com dois tokens no projetor, abrindo portas, trocando o clima e revelando cômodos, sem nada do mestre vazar.

## Fase 8 — Renderizador Pixel completo

Tarefas: [plano/fase-8.md](plano/fase-8.md) (detalhadas antes da hora; conferir ao começar).

| Etapa | Entrega |
| --- | --- |
| 8.1 | Pixel para todas as descrições, materiais, paredes, presença e memória |
| 8.2 | Gerador de sprites com painel, cores sugeridas pelo retrato ou pela ficha, estados da Ficha |
| 8.3 | Derivação automática de imagens; `pixelSrc` manual |
| 8.4 | Luz em faixas, transições em dithering, fonte pixel no projetor |

**Pronto quando:** o mapa da casa, sem nenhuma alteração, é jogado inteiro no Pixel e trocado ao vivo com o Ilustrado.

## Fase 9 — Plataforma e tutoriais

Tarefas: [plano/fase-9.md](plano/fase-9.md) (detalhadas antes da hora; conferir ao começar).

Cada etapa que muda outro projeto só começa com autorização do usuário. A ordem segue [PLATAFORMA.md](PLATAFORMA.md) §11.

| Etapa | Entrega |
| --- | --- |
| 9.1 | Mesa (hub) mínimo: campanhas, entidades, notas com `[[ligações]]`, inventário de aplicativos |
| 9.2 | Ficha no contrato: arrastar ficha → token; cartão com PV/PD em pips e rolagens; `ficha.rolagem` flutuando sobre o token |
| 9.3 | Ateliê: arrastar documento → pista; inspeção com luz UV; `atelie.abrir` para editar |
| 9.4 | Jukebox: cena sonora por mapa, região e clima; `jukebox.tocar` ao entrar numa região ou trocar de clima; efeitos da biblioteca do Jukebox nos interagíveis (se o Jukebox ganhar efeitos avulsos, com autorização) |
| 9.5 | Mesa em modo sessão: Atlas, fichas e Jukebox lado a lado; roteiro e registro da sessão |
| 9.6 | Tutoriais interativos das ferramentas principais |

## Depois

- Importação opcional de pacotes do mestre (privada, com harmonização e substituto procedural).
- Tabletop 3D no contrato da mesa (com autorização).
- Possibilidades em aberto: notas em Markdown compatíveis com Obsidian; importação ou exportação com quadros do Miro (exige credenciais, fora do site estático).
- Andares no mesmo mapa.
- Grid hexagonal.
- Mapas de região e mundo.
- Exportar para o Tabletop 3D.
- Jogadores em celular pela rede local.
