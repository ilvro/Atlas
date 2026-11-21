# Atlas — plano de tarefas

O [ROADMAP](../ROADMAP.md) diz **o quê** e em que ordem. Esta pasta diz **como**, em tarefas do tamanho de um commit.

## Fluxo

1. **Planejar (Opus):** antes de uma fase começar, o arquivo `fase-N.md` é detalhado em fichas, conferidas contra o código do momento. Fases futuras ficam só com a lista de tarefas, porque o código ainda vai mudar. Exceção: as Fases 7 a 9 foram detalhadas antes da hora, a pedido do usuário; ao começar cada uma, o Opus confere as fichas contra o código (e o Sonnet, se não bater, para e reporta).
2. **Implementar (Sonnet):** uma tarefa por sessão. Pedido típico: *"Implemente a tarefa 4.1a de docs/plano/fase-4.md."* Leia a ficha, os arquivos de "Ler" e o [AGENTS.md](../../AGENTS.md); não é preciso reler VISAO e ARQUITETURA inteiros.
3. **Fechar a tarefa:**
   - `npm run typecheck` e `npm test` passando (e `npm run test:e2e` quando a ficha pedir);
   - marcar a ficha com ✅ (⬜ → ✅) e anotar desvios, se houve, numa linha "Nota:" dentro da ficha;
   - acrescentar uma linha na fase em andamento do [progress.md](../../progress.md);
   - fazer **um commit atômico por tarefa** (usando a mensagem da ficha, ajustada se preciso, seguindo o estilo do histórico do repositório).
4. **Fechar a fase:** depois da última tarefa, o resumo completo da fase vai para o progress.md (implementado, validação, pendências reais) e o Opus detalha a próxima.

## Regras de tamanho

- Uma preocupação por tarefa. Alvo: diff de até ~400 linhas e ~6 arquivos.
- Toda tarefa deixa o app funcionando e os testes passando: nada de "metade agora, conserta na próxima".
- Código puro (domínio) e render ficam em tarefas separadas sempre que der: o puro vem antes, com testes.

## Quando a ficha não bate com o código

Pare e reporte: o que a ficha pede, o que o código tem, duas saídas possíveis. Não invente arquitetura nem estique a tarefa para caber. Uma ficha errada é corrigida pelo planejamento, não no meio da implementação.

## Modelo de ficha

```
### 4.1a — Título curto  ⬜
Objetivo: uma frase.
Depende de: tarefas anteriores (ou —).
Ler: arquivos e trechos para consultar.
Arquivos: criar …; mudar …
Como: passos técnicos (tipos, assinaturas, onde ligar).
Não fazer: o que fica para outra tarefa.
Testes: o que testar e onde.
Pronto quando: critério observável.
Commit: mensagem curta em inglês
```

## Arquivos

| Arquivo | Estado |
| --- | --- |
| [fase-3-pendencias.md](fase-3-pendencias.md) | Detalhado — só a P3c aberta (independente) |
| [fase-4.md](fase-4.md) | Detalhado — concluída |
| [fase-5.md](fase-5.md) | Detalhado — concluída |
| [fase-6.md](fase-6.md) | Concluída, menos 6.2b (espera aprovação da curadoria) |
| [fase-7.md](fase-7.md) | Concluída (Sessão, visão, névoa, portas, projetor, interagíveis) |
| [fase-8.md](fase-8.md) | Detalhado — concluída |
| [fase-9.md](fase-9.md) | Concluída (Mesa, Ficha, Ateliê e Jukebox integrados; pendências reais no progress.md) |
| [fase-10.md](fase-10.md) | Concluída, menos a validação 10.8 (lotes de exemplos e acervo gerados) |
| [fase-11.md](fase-11.md) | Concluída (abas, prévia do Dossiê, barra inferior, grade) |
| [fase-12.md](fase-12.md) | Peças, fichas flutuantes, gatilhos e tutoriais; 12.11 corrigiu os gatilhos |
| [fase-13.md](fase-13.md) | Concluída (Momentos, projetor, painel, gatilhos, barra de efeitos) |
| [fase-14.md](fase-14.md) | Concluída (ponte MCP, leitura, escrita, momentos, Mesa, Ateliê, Dossiê, Jukebox) |
| [ponte-mcp.md](ponte-mcp.md) | Detalhado — catálogo estável, prazos, catálogo base, anotações, instruções, descrições; Etapa 6 (ferramentas em dois níveis, PM6a–c) a fazer |
| [telhados.md](telhados.md) | Detalhado — telhado por edifício, padrão ao criar, estilos (coberturas, formas, detalhes), penumbra, chave na sessão |
| [mapas-melhores.md](mapas-melhores.md) | **Documento-mestre** da iniciativa "mapas melhores pelo assistente": problema, diagnóstico, ordem e frentes A–I (implementação pelo Gemini; guia e acervo pelo Opus) |
| [app-atualizado.md](app-atualizado.md) | A — app de desktop se remonta ao abrir e enquanto está aberto (Mesa) |
| [olhos-do-assistente.md](olhos-do-assistente.md) | B — vista de telhados, leitura de edifícios, guia relido, catálogo com busca, `atlas_revisar` |
| [guia-de-projeto.md](guia-de-projeto.md) | C — método de projeto e repertório de lugares (Opus) |
| [construcao-de-alto-nivel.md](construcao-de-alto-nivel.md) | D — `atlas_mobiliar`, tipos genéricos, `atlas_edificio`, `atlas_arranjo`, `atlas_caminho` |
| [acervo-ampliado.md](acervo-ampliado.md) | E — materiais, kits rural, cemitério e ficção científica (Opus); gênero ficção científica |
| [patamares.md](patamares.md) | F — relevo em patamares com escarpas derivadas, névoa de profundidade e sombra |
| [comodos-livres.md](comodos-livres.md) | G — cômodos redondos e em polígono, telhado em cone |
| [andares.md](andares.md) | H — andares, escadas e sessão por andar |
| [acabamento-do-terreno.md](acabamento-do-terreno.md) | I — edifícios assentados, contato externo, maciço como serra, tempo ao ar livre |
| [realismo-e-composicao.md](realismo-e-composicao.md) | J — Realismo, rotação, composição e guias (`J1`–`J10`, concluída) |
| [profundidade-luz-e-assets.md](profundidade-luz-e-assets.md) | K — Profundidade, luz dinâmica, consistência e salto visual 2.5D (`K1`–`K10`, planejada) |
| [fidelidade-de-render.md](fidelidade-de-render.md) | L — Luz HDR com relevo, altura dos assados, AO, bloom, curva de tom, paredes com face; estruturas e santuário pelo Opus (`L1`–`L12`, planejada) |
| [carregamento.md](carregamento.md) | M — carregamento rápido: medidor, fila puxada, terreno por caixa e em ladrilhos, cache persistente, ruído barato, prévia (`M1`–`M7`, planejada) |
| [telhados-detalhados.md](telhados-detalhados.md) | N — telhados detalhados: campo de altura com rincões, coberturas com relevo, desgaste e neve, luz da cena, fachada, coberturas e formas de todas as eras (`N1`–`N10`, planejada) |
| [biblioteca-por-familias.md](biblioteca-por-familias.md) | O — biblioteca por grupo → família → variante, terreno em grupos, recentes e favoritos, objetos livres da grade por padrão, espelho e opacidade, painel de propriedades antes e depois de pôr, pôr vários, famílias no assistente (`O1`–`O10`, planejada) |
| [terreno-com-textura.md](terreno-com-textura.md) | P — terreno pintado com textura CC0 (pincel como o do Inkarnate), amostragem sem repetição, carimbos de chão desenhados; toca a O1, O2, O9 e O10 (`P1`–`P8`, planejada) |
| [epocas-e-cenarios.md](epocas-e-cenarios.md) | Q — épocas e cenários: época como gênero e bioma nas famílias, filtro na biblioteca, oito gêneros novos, brilho próprio (lava, néon, cristal), terrenos de deserto, selva, outono, cidade e vulcão, materiais por época, plantas dos biomas e kits de Antiguidade, Oriente, deserto, faroeste, colonial, vitoriano, moderno, pós-apocalíptico e cyberpunk (`Q1`–`Q23`, planejada) |
| [mesa-online.md](mesa-online.md) | R — mesa online: sala no Cloudflare (Worker + Durable Object), login pelo Discord, ponte do mestre na Mesa, casca do jogador com projetor e Dossiê em modo jogador, fichas na sala, peça própria, atividade do Discord (`R0`–`R20`, planejada) |
