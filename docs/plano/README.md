# Atlas — plano de tarefas

O [ROADMAP](../ROADMAP.md) diz **o quê** e em que ordem. Esta pasta diz **como**, em tarefas do tamanho de um commit.

## Fluxo

1. **Planejar (Opus):** antes de uma fase começar, o arquivo `fase-N.md` é detalhado em fichas, conferidas contra o código do momento. Fases futuras ficam só com a lista de tarefas, porque o código ainda vai mudar. Exceção: as Fases 7 a 9 foram detalhadas antes da hora, a pedido do usuário; ao começar cada uma, o Opus confere as fichas contra o código (e o Sonnet, se não bater, para e reporta).
2. **Implementar (Sonnet):** uma tarefa por sessão. Pedido típico: *"Implemente a tarefa 4.1a de docs/plano/fase-4.md."* Leia a ficha, os arquivos de "Ler" e o [AGENTS.md](../../AGENTS.md); não é preciso reler VISAO e ARQUITETURA inteiros.
3. **Fechar a tarefa:**
   - `npm run typecheck` e `npm test` passando (e `npm run test:e2e` quando a ficha pedir);
   - marcar a ficha com ✅ (⬜ → ✅) e anotar desvios, se houve, numa linha "Nota:" dentro da ficha;
   - acrescentar uma linha na fase em andamento do [progress.md](../../progress.md);
   - sugerir a mensagem de commit (a da ficha, ajustada se preciso). **Não commitar:** o usuário revisa e commita.
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
