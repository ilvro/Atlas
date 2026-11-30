# Frente S — Modo construção colaborativo (Activity e Sala)

Planejada em 2026-11-21. O objetivo é permitir que, ao abrir o saguão da Activity (ou `#/jogar/<sala>`), o mestre escolha entre **Modo Sessão** (jogar no projetor + Dossiê) e **Modo Construção**, no qual todos os participantes colaboram em tempo real para construir um mapa no editor completo do Atlas.

## Decisões

1. **Modo da sala no servidor (`config.modo`).** A sala passa a guardar `modo: 'sessao' | 'construcao'` em `ConfigSala` (padrão `'sessao'`). Só o mestre alterna o modo pelo saguão (`sala.modo`), e a sala espalha a mudança imediatamente para todos os conectados (`config`). O estado da sessão e o mapa da construção permanecem preservados separadamente no SQLite da sala: alternar entre modos não apaga nem fichas nem o mapa em construção.
2. **A Sala é a fonte de verdade na construção.** O mapa em construção mora no Durable Object SQLite (`Mesa/sala/`), sem depender da ponte `#/online` nem do navegador do mestre aberto no fundo. Assim, o mestre pode iniciar e editar o mapa diretamente de dentro da Activity do Discord junto com os jogadores.
3. **Sincronização por comandos do Atlas (`Comando`) + snapshot periódico.** O Atlas já isola todas as edições em objetos `Comando` serializáveis aplicados por `aplicarComando(mapa, comando)` (`Atlas/src/state/comandos.ts` e `comandos-construir.ts`), função pura e determinística.
   - O cliente envia `construcao.comando { baseRev, opId, comandos, rotulo }` à sala;
   - A sala serializa na ordem de chegada, atribui `rev` monotônico (`1, 2, 3…`), grava na tabela `construcao_ops` e espalha `construcao.aplicada { rev, opId, autor, comandos, rotulo }` a todos;
   - Cada cliente mantém `mapaConfirmado` na última `rev` aplicada e re-aplica suas operações locais ainda não confirmadas por cima. Se um comando concorrente falhar (`ErroDeComando`, ex.: dois usuários apagaram o mesmo item), todos ignoram o comando inválido no mesmo ponto da sequência `rev`, garantindo convergência idêntica sem precisar duplicar a lógica do Atlas no Worker;
   - A cada N operações (ex.: 40) ou na troca/limpeza de mapa, o cliente envia `construcao.snapshot { rev, mapa }` (ou via blob gzip se passar de 256 KB, reutilizando a mecânica da R6) para compactar as ops antigas e acelerar quem entra depois.
4. **Gestos contínuos e cursores ao vivo.** Durante um arraste ou pincelada (`store.iniciarGesto`), as alterações correm localmente sem inundar a rede; ao concluir o gesto, o lote consolidado sai como uma única operação (`construcao.comando`). Em paralelo, `construcao.cursor` (efêmero, sem gravar no SQLite, limitado a ~15/s) mostra a posição, ferramenta e cor de cada colega no mesmo andar.
5. **Desfazer por autor.** Em edição colaborativa, `Ctrl+Z` não deve desfazer o trabalho de outro participante. O modo remoto mantém uma pilha local apenas das operações confirmadas do próprio autor e envia um comando compensatório à sala.
6. **Interface na Activity (`Casca.tsx`).**
   - No **Saguão (`Saguao.tsx`)**: quando `eu.papel === 'mestre'`, exibe o seletor **Modo Sessão** | **Modo Construção** e, no modo construção, os controles para abrir um mapa novo (nome, largura × altura, estilo/gênero) ou importar um arquivo `.json` / `.atlas` (`atlas.map` / `atlas.backup`). No modo construção, o jogador não precisa escolher ficha de personagem para entrar no mapa (`deveMostrarSaguao` libera assim que houver mapa de construção aberto).
   - Na **Casca (`Casca.tsx`) em Modo Construção**: exibe à esquerda o `iframe` do Atlas em `#/construir-remoto/<salaId>` (editor completo com ferramentas de construção, bibliotecas, camadas, andares, clima/estilo e inspetor, sem galeria nem botões de sessão/projetor) e à direita o painel lateral de 360 px (recolhível) com abas de **Participantes & Atividade** (presença, andar, feed recente de edições), **Notas / Chat** (notas do mapa e recados rápidos) e **Fichas** (consulta das fichas da sala como referência) além das ações do mestre (trocar/exportar mapa e alternar modo).
7. **Retorno para a campanha do mestre.** O mapa construído na sala pode ser baixado a qualquer momento como `.json` (`atlas.map` / `atlas.backup`) pela Activity ou pela `#/online`, e também importado direto para o Atlas local do mestre via `#/online` (quando o mestre abrir a Mesa no navegador), sem exigir que o navegador esteja aberto durante a construção.
8. **Escopo de acesso.** No modo construção, todos os participantes da sala (`mestre` e `jogador`) podem construir; só o `mestre` troca o modo da sala, cria/substitui o mapa ativo da construção ou o encerra.

## Protocolo novo (resumo; detalhado na S1)

| Tipo | Direção | Quem pode | O que faz |
| --- | --- | --- | --- |
| `sala.modo { modo }` | cliente → sala | mestre | Alterna `'sessao'` ↔ `'construcao'`; a sala grava em `config` e espalha `config` a todos. |
| `construcao.abrir { mapa }` (ou `{ blobId }`) | cliente → sala | mestre | Define o mapa inicial da construção (`rev = 0`, limpa ops antigas) e espalha `construcao.estado`. |
| `construcao.comando { baseRev, opId, comandos, rotulo? }` | cliente → sala | todos (em `'construcao'`) | Registra a operação com `rev` sequencial, carimba `autor` e espalha `construcao.aplicada`. |
| `construcao.snapshot { rev, mapa }` (ou `{ rev, blobId }`) | cliente → sala | todos (em `'construcao'`) | Compacta o estado até `rev`, atualiza o snapshot guardado e poda ops ≤ `rev`. |
| `construcao.cursor { x, y, levelId, ferramenta, pintando? }` | cliente → sala | todos (em `'construcao'`) | Presença efêmera de cursor/pincel no editor (não vai ao SQLite). |
| `construcao.nota { id, texto }` (ou mensagem de atividade) | cliente → sala | todos (em `'construcao'`) | Recado rápido no painel lateral de construção (memória/últimas N no SQLite). |
| `construcao.estado { mapa \| blobId, rev, ops }` | sala → cliente | — | Estado inicial ao entrar ou ao trocar de mapa na construção. |
| `construcao.aplicada { rev, opId, autor, comandos, rotulo? }` | sala → cliente | — | Confirmação ordenada de uma operação para todos os clientes. |

---

## Bloco 1 — Sala, protocolo e saguão (Mesa)

### S1 — Protocolo, estado SQLite e permissões de construção na sala  ✅
Objetivo: a sala guarda o modo (`'sessao' | 'construcao'`), armazena o mapa em construção com suas operações ordenadas por `rev` e valida permissões e limites.
Depende de: R4 e R6 (infraestrutura de sala e blobs).
Ler: `Mesa/src/online/protocolo.ts`, `Mesa/sala/estado.ts`, `Mesa/sala/mensagens.ts`, `Mesa/sala/permissoes.ts` e `Mesa/tests/unit/sala/`.
Arquivos: mudar `Mesa/src/online/protocolo.ts`, `Mesa/sala/estado.ts`, `Mesa/sala/mensagens.ts`, `Mesa/sala/permissoes.ts`; criar testes em `Mesa/tests/unit/sala/construcao.test.ts` e `Mesa/tests/unit/online/`.
Como:
1. Em `protocolo.ts`:
   - `ModoDaSala = 'sessao' | 'construcao'`; acrescentar `modo?: ModoDaSala` em `ConfigSala` e `construcao?: { temMapa: boolean; nome?: string; rev: number }` em `MsgBemVindo`.
   - Tipos e validadores em `lerMensagemParaSala` / `lerMensagemDaSala`: `sala.modo`, `construcao.abrir`, `construcao.fechar`, `construcao.comando`, `construcao.snapshot`, `construcao.cursor`, `construcao.estado`, `construcao.aplicada`.
   - `MAX_COMANDOS_POR_OP` (ex.: 100) e limite de tamanho do JSON da operação para não estourar SQLite.
2. Em `estado.ts`:
   - `modo` persistido em `config` (padrão `'sessao'`).
   - Tabelas `construcao_mapa (id INTEGER PRIMARY KEY, rev INTEGER NOT NULL, snapshot_json TEXT, snapshot_blob_id TEXT, mapa_nome TEXT)` e `construcao_ops (rev INTEGER PRIMARY KEY, autor_json TEXT NOT NULL, op_id TEXT NOT NULL, comandos_json TEXT NOT NULL, rotulo TEXT, em INTEGER NOT NULL)`.
   - Métodos `definirModo`, `abrirConstrucao`, `registrarOpConstrucao`, `salvarSnapshotConstrucao`, `estadoConstrucao`, `fecharConstrucao`. Se o snapshot passar de `LIMITE_ESTADO_BYTES`, usa `blob` gzip (`construcao:<rev>`) e limpa snapshots antigos (como `apagarBlobsComPrefixo`).
3. Em `permissoes.ts`:
   - Só o `mestre` pode mandar `sala.modo`, `construcao.abrir` e `construcao.fechar`.
   - Só quando `modo === 'construcao'` (e há mapa aberto) qualquer membro pode mandar `construcao.comando`, `construcao.snapshot` e `construcao.cursor`. Fora disso, `erro { motivo: 'permissao' }`.
   - Em `mensagens.ts`: `construcao.cursor` usa limitador leve (~15/s por conexão) e nunca vai ao SQLite; `tratarBinario` continua aceitando blobs do mestre em sessão, e em construção aceita blobs de snapshot/asset com limite de tamanho.
Não fazer: interface do saguão (S2) nem editor do Atlas (S3).
Testes: `mestre` alterna modo; jogador não alterna modo nem abre mapa; em `'construcao'`, dois clientes mandam `construcao.comando` e recebem `rev = 1, 2` ordenados com `autor` carimbado; snapshot até `rev = 2` poda `construcao_ops`; em `'sessao'`, `construcao.comando` é recusado.
Pronto quando: `npm run typecheck` e `npm test` passam na Mesa com os testes da sala e protocolo.
Commit: `(feature) add collaborative build mode protocol and room state`

### S2 — Saguão com escolha de modo e criação/abertura de mapa  ✅
Objetivo: ao abrir o saguão da Activity, o mestre escolhe entre "Modo Sessão" e "Modo Construção", podendo iniciar um mapa em branco ou importar um existente.
Depende de: S1.
Ler: `Mesa/src/online/saguao.ts`, `Mesa/src/jogar/Saguao.tsx`, `Mesa/src/jogar/Casca.tsx`, `Mesa/src/jogar/casca.css`, `Atlas/src/domain/mapa.ts` (`criarMapa`).
Arquivos: mudar `Mesa/src/online/saguao.ts`, `Mesa/src/jogar/Saguao.tsx`, `Mesa/src/jogar/Casca.tsx`, `Mesa/src/jogar/casca.css` e criar testes em `Mesa/tests/unit/online/saguao.test.ts`.
Como:
1. Em `saguao.ts`: atualizar `deveMostrarSaguao({ modo, temMapa, temMapaConstrucao, papel, personagem })`:
   - Em `'sessao'`: comportamento atual (`!temMapa || (papel === 'jogador' && personagem === null)`).
   - Em `'construcao'`: mostra saguão apenas enquanto `!temMapaConstrucao` (não exige personagem escolhido).
2. Em `Saguao.tsx`:
   - Mostrar o selo do modo atual para todos ("Modo Sessão" ou "Modo Construção").
   - Para o mestre (`eu?.papel === 'mestre'`): controle segmentado **Modo Sessão** | **Modo Construção** (`sala.modo`), visível tanto na chegada quanto ao reabrir o saguão pelo botão do topo.
   - Quando `modo === 'construcao'` e for o mestre: bloco "Mapa da construção" com:
     - **Novo mapa em branco**: nome, dimensões em células/metros (ex.: `30×20` / `45×30 m`), estilo (`Ilustrado` / `Pixel`) e gênero (`investigacao`, `fantasia`, etc.), gerando um `MapaAtlas` mínimo válido (helper puro em `Mesa/src/online/mapa-inicial.ts` compatível com `SCHEMA_MAPA` e `VERSAO_MAPA`, ou criado pelo próprio Atlas).
     - **Importar arquivo (`.json`)**: lê um `atlas.map` ou `atlas.backup` (1º mapa) e envia `construcao.abrir`.
     - Se já houver mapa de construção aberto: botões **Entrar na construção** e **Novo / Trocar mapa** (com confirmação).
   - Para jogadores em `'construcao'` sem mapa aberto: "Aguardando o mestre abrir um mapa para construir".
Não fazer: o `iframe` do editor no Atlas (S3) nem o painel lateral (S7).
Testes: `deveMostrarSaguao` nos dois modos para mestre e jogador; render/estado da escolha de modo e criação de mapa inicial válido.
Pronto quando: no saguão, o mestre alterna entre os dois modos e o estado da sala atualiza para os demais membros em tempo real.
Commit: `(feature) add session vs build mode selector in activity lobby`

---

## Bloco 2 — Editor colaborativo no Atlas (`Atlas`)

### S3 — Rota `#/construir-remoto/<salaId>` e ponte de sessão no Atlas  ✅
Objetivo: o Atlas abre em modo de construção remoto dentro de um `iframe`, recebendo e enviando operações pelo `BroadcastChannel` prefixado da sala sem gravar no IndexedDB local.
Depende de: S1.
Ler: `Atlas/src/app/rotas.ts`, `Atlas/src/ui/App.tsx`, `Atlas/src/app/app.ts`, `Atlas/src/app/servicos.ts`, `Atlas/src/app/embutido.ts`, `Atlas/src/ui/Cabecalho.tsx`, `Atlas/src/ui/Editor.tsx`, `Atlas/src/app/projetor.ts`.
Arquivos: criar `Atlas/src/app/construcao-remota.ts` e teste; mudar `Atlas/src/app/rotas.ts`, `Atlas/src/ui/App.tsx`, `Atlas/src/ui/Cabecalho.tsx`, `Atlas/src/app/app.ts`.
Como:
1. Em `rotas.ts`: nova rota `{ tipo: 'construir-remoto'; sala: string }` (`#/construir-remoto/<salaId>`).
2. Em `App.tsx` / `app.ts`:
   - Em `construir-remoto`: carrega apenas o necessário para renderizar e editar (texturas, acervo procedural, tema), **sem** `abrirRepositorioMapas` de gravação local (usa um `RepositorioMapas` nulo/em memória para `criarSessao` nunca sobrescrever mapas locais do navegador nem abrir diálogo de rascunho/conflito).
   - Trava `modo.value = 'construir'` (sem troca para `'sessao'`).
   - Em `Cabecalho.tsx`: esconde controles de Galeria, botão Sessão, botão Projetor, Abas de Mapas locais e status de gravação local; mantém desfazer/refazer (ligado ao S6 na frente seguinte), telhados no editor, tema e ajuda.
3. Em `construcao-remota.ts`:
   - Abre o canal `sala:<salaId>:atlas:construcao` (mesma convenção de prefixo da R7, nunca escrevendo em canais globais do mestre).
   - Manda `{ tipo: 'atlas-construcao.pronto' }` ao montar (e `postMessage` ao `parent`, como `projetor.pronto`), recebe `{ tipo: 'construcao.estado', mapa, rev, ops }` e inicia a `SessaoDeEdicao` no `Store`.
Não fazer: reconciliação otimista avançada (S4), cursores (S5) nem desfazer colaborativo (S6).
Testes: `lerRota('#/construir-remoto/sala-1')`, inicialização do `construir-remoto` com canal falso abrindo o mapa recebido no `Store` sem tocar no IndexedDB.
Pronto quando: `#/construir-remoto/<sala>` abre o editor do Atlas carregando o mapa enviado pelo canal local.
Commit: `(feature) add remote collaborative build route in Atlas`

### S4 — Reconciliação determinística de comandos, gestos e snapshots  ✅
Objetivo: múltiplos participantes editam o mesmo mapa ao mesmo tempo mantendo convergência de estado entre todos os clientes e compactação por snapshot.
Depende de: S3.
Ler: `Atlas/src/state/store.ts`, `Atlas/src/state/comandos.ts`, `Atlas/src/state/comandos-construir.ts`, `Atlas/src/app/construcao-remota.ts`.
Arquivos: criar `Atlas/src/app/reconciliacao.ts` (puro) e `Atlas/tests/unit/reconciliacao.test.ts`; mudar `Atlas/src/state/store.ts` (ou envoltório de ponte) e `Atlas/src/app/construcao-remota.ts`.
Como:
1. Em `reconciliacao.ts` (puro, sem DOM/Pixi):
   - Estado: `{ baseRev, mapaConfirmado, pendentes: Array<{ opId, comandos, rotulo }>, enviadas: Map<opId, ...> }`.
   - `aoEditarLocal(comandos, rotulo)` → gera `opId`, enfileira em `pendentes`, aplica otimisticamente sobre o estado visível e devolve a mensagem `construcao.comando` a enviar.
   - `aoReceberAplicada({ rev, opId, comandos })`:
     - Garante sequência contínua (`rev === baseRev + 1`; se faltar alguma `rev`, pede ressincronização `construcao.ressincronizar`);
     - Aplica `comandos` sobre `mapaConfirmado` dentro de `try/catch (ErroDeComando)` (conflito inválido na ordem canônica é ignorado deterministicamente por todos);
     - Se `opId` pertencia a `pendentes`, remove de `pendentes`;
     - Recalcula o estado visível aplicando os `pendentes` restantes sobre `mapaConfirmado` (também tolerando `ErroDeComando`, removendo pendentes que ficaram impossíveis) e atualiza o `Store` via `store.projetar(proximo, { pularValidacao: false })` sem gerar novo evento de saída.
2. Em `construcao-remota.ts` + `store`:
   - Ao concluir `executar` ou `gesto.concluir()`, captura a lista exata de `Comando` executada (via gancho no `Store` ou interceptação de comandos no `construir-remoto`) e chama `aoEditarLocal`. Durante um `Gesto` ativo, apenas a prévia local roda; o envio ocorre em `concluir()`.
   - Compactação: quando `baseRev - ultimaRevSnapshot >= 40` (escolhendo um participante determinístico ou o primeiro a atingir + `rev` maior vence na sala), envia `construcao.snapshot { rev: baseRev, mapa: mapaConfirmado }`.
Não fazer: cursores (S5) e desfazer por autor (S6).
Testes: dois clientes virtuais com `reconciliacao.ts` editando em paralelo (um pinta terreno e cria cômodo enquanto outro coloca objetos e apaga parede em conflito) convergem para exatamente o mesmo `MapaAtlas` após aplicar a mesma ordem `rev`.
Pronto quando: testes de convergência/conflito passam e dois clientes no navegador editam o mapa juntos sem dessincronizar.
Commit: `(feature) deterministic command reconciliation for collaborative map building`

### S5 — Cursores colaborativos sobre o mapa  ✅
Objetivo: cada participante vê onde os colegas estão apontando ou desenhando sobre o canvas do Atlas, com nome, cor e indicação de andar.
Depende de: S3.
Ler: `Atlas/src/domain/pings.ts`, `Atlas/src/render/pings-camada.ts`, `Atlas/src/render/viewport.ts`, `Atlas/src/ui/Editor.tsx`.
Arquivos: criar `Atlas/src/domain/cursores-remotos.ts` (puro) + teste, `Atlas/src/render/cursores-camada.ts`; mudar `Atlas/src/render/viewport.ts` e `Atlas/src/app/construcao-remota.ts`.
Como:
1. `cursores-remotos.ts`: guarda `{ discordId, nome, cor, x, y, levelId, ferramenta, pintando, atualizadoEm }`, expira cursores parados após 5 s (reutilizando a função de cor estável por `discordId` usada nos pings da R15b).
2. `construcao-remota.ts`: envia `construcao.cursor` (throttled a 15/s) quando o ponteiro move no `viewport` e aplica cursores recebidos (filtrados pelo mesmo `levelId` ativo de quem vê).
3. `cursores-camada.ts`: camada leve no Pixi desenhando um cursor discreto + etiqueta com o nome do colega e um pulso sutil enquanto `pintando === true`.
Não fazer: bloqueio de região/célula por usuário.
Testes: `cursoresAtivos` filtra por `levelId`, expira após 5 s e ignora o próprio `discordId`.
Pronto quando: ao mover o mouse ou pintar em um cliente, o outro vê o cursor identificado em tempo real.
Commit: `(feature) remote collaborator cursors on Atlas canvas`

### S6 — Desfazer por autor no modo colaborativo  ✅
Objetivo: `Ctrl+Z` / botão Desfazer no modo construção reverte apenas a última operação do próprio usuário, sem apagar edições de outros participantes.
Depende de: S4.
Ler: `Atlas/src/state/store.ts`, `Atlas/src/state/comandos.ts`, `Atlas/src/state/comandos-construir.ts`, `Atlas/src/app/acoes.ts`.
Arquivos: criar `Atlas/src/app/desfazer-colaborativo.ts` + teste; mudar `Atlas/src/app/construcao-remota.ts` e `Atlas/src/ui/Cabecalho.tsx` / `acoes.ts`.
Como:
1. Para cada operação própria confirmada (`opId`), registrar o conjunto mínimo de dados necessários para compensar a ação (ou gerar comandos inversos puros sobre o `MapaAtlas` antes/depois: ex. `item.adicionar` ↔ `item.remover`, `item.atualizar` ↔ `item.atualizar` com patch anterior, `comodo.criar` ↔ `comodo.remover`, `terreno.pintar` ↔ restaurar células alteradas das camadas tocadas, etc.).
2. Ao acionar Desfazer (`Ctrl+Z` ou botão): em vez de `store.desfazer()`, calcula os comandos compensatórios sobre o `mapaConfirmado` atual e envia como uma nova operação `construcao.comando` (com suporte a Refazer local enquanto novas edições próprias não forem feitas).
3. Atualiza os signals `podeDesfazer`, `rotuloDesfazer`, `podeRefazer` e `rotuloRefazer` usados pelo `Cabecalho.tsx` para refletir apenas a pilha do autor.
Não fazer: histórico compartilhado global ou merge 3-way de texto em notas.
Testes: usuário A cria cômodo, usuário B coloca mesa dentro dele; usuário A desfaz sua própria ação anterior sem apagar a mesa de B (ou compensando apenas o que pertence à ação de A).
Pronto quando: dois usuários editam em sequência e cada um desfaz apenas as próprias ações via `Ctrl+Z`.
Commit: `(feature) per-author undo for collaborative map building`

---

## Bloco 3 — Casca, painel lateral e retorno para a campanha (`Mesa` + `mesa-core`)

### S7 — Casca em modo construção com ponte, painel lateral e troca em tempo real  ✅
Objetivo: a `Casca` alterna automaticamente entre Sessão e Construção quando o mestre muda o modo no saguão, conectando o editor do Atlas e o painel lateral colaborativo.
Depende de: S2, S4, S5 e S6.
Ler: `Mesa/src/jogar/Casca.tsx`, `Mesa/src/jogar/ponte-jogador.ts`, `Mesa/src/jogar/casca.css`, `Mesa/src/online/feed.ts`.
Arquivos: criar `Mesa/src/jogar/ponte-construcao.ts`, `Mesa/src/jogar/PainelConstrucao.tsx`, `Mesa/tests/unit/jogar/ponte-construcao.test.ts`; mudar `Mesa/src/jogar/Casca.tsx` e `Mesa/src/jogar/casca.css`.
Como:
1. `ponte-construcao.ts`:
   - Ouve `sala:<salaId>:atlas:construcao` e faz a ponte com o `ClienteDaSala`:
     - `construcao.estado` (descomprimindo blob gzip se vier `blobId`) → entrega ao `iframe` do Atlas;
     - `construcao.comando` do `iframe` → manda à sala;
     - `construcao.aplicada` da sala → entrega ao `iframe` e alimenta uma lista local das últimas ações (autor, rótulo, hora) para o painel lateral;
     - `construcao.cursor` ↔ `iframe`;
     - `construcao.snapshot` do `iframe` → se passar de 256 KB, comprime via `comprimirEstado` e sobe como blob `construcao:<rev>` antes de mandar `construcao.snapshot`.
   - Nunca escreve nos canais do mestre (`atlas:projetor:*` ou `mesa:eventos` sem prefixo).
2. `Casca.tsx`:
   - Observa `config.modo` (`'sessao' | 'construcao'`). Quando muda para `'construcao'`, troca o `iframe` principal para `#/construir-remoto/<salaId>` e mostra o `PainelConstrucao` na coluna de `360 px` (inclusive para o mestre, com botão discreto para recolher/expandir o painel lateral e dar tela cheia ao editor; em celular vertical, abas `Editor | Painel`).
   - Quando volta para `'sessao'`, fecha a ponte de construção e restaura o fluxo de `projetor-remoto` + Dossiê sem perder conexão com a sala.
3. `PainelConstrucao.tsx`:
   - Aba **Mesa** (padrão): lista de participantes conectados (avatar, cor do cursor, papel), histórico ao vivo das últimas edições colaborativas e notas rápidas/chat leve da sessão de construção.
   - Aba **Fichas**: visualização/consulta rápida das fichas da sala (útil para conferir tamanhos/grupos enquanto desenham).
   - No topo/rodapé do painel (só para `eu.papel === 'mestre'`): nome do mapa, revisão atual, botão **Baixar mapa (.json)**, **Saguão / Trocar modo**.
Não fazer: edição de ficha dentro do painel de construção.
Testes: `ponte-construcao.ts` com falsos (ida e volta de comandos, descompressão de estado grande, sem eco); troca de `config.modo` na `Casca` alternando entre `projetor-remoto` e `construir-remoto`.
Pronto quando: mestre e jogadores entram juntos no editor colaborativo pela Activity, veem o painel lateral e alternam para Sessão sem desconectar.
Commit: `(feature) collaborative build shell, bridge and side panel in Mesa`

### S8 — Salvar e importar o mapa construído na campanha do mestre  ⬜
Objetivo: o mestre consegue levar o mapa construído na sala para a sua campanha local no Atlas (e também subir um mapa da campanha para a sala antes de construir).
Depende de: S7 (e pode aproveitar `mesa-core`).
Ler: `Mesa/src/ui/MesaOnline.tsx`, `Mesa/src/app/online.ts`, `Atlas/mesa-core/src/eventos.ts`, `Atlas/src/app/app.ts`, `Atlas/src/data/repositorio.ts`.
Arquivos: mudar `Atlas/mesa-core/src/eventos.ts` (e sincronizar `vendor/mesa-core/` em `Mesa`, `Dossie`, `Jukebox`, `Atelie` conforme decisão 14 da Frente R), `Atlas/src/app/app.ts`, `Mesa/src/app/online.ts`, `Mesa/src/ui/MesaOnline.tsx`, `Mesa/sala/index.ts` (ou protocolo WS/HTTP para leitura do mapa da construção).
Como:
1. No `mesa-core` (`eventos.ts`): acrescentar o pedido `atlas.importar-mapa { mapa, vincularCampanha?: boolean }` (dono `'atlas'`), atendido pelo `Atlas/src/app/app.ts` usando `repo.salvar(mapa, { forcar: ... })` (ou criando cópia se já existir com revisão diferente), vinculando à campanha ativa quando pedido e abrindo o mapa. Atualizar as 4 cópias `vendor/mesa-core/`.
2. Na ponte do mestre (`Mesa/src/app/online.ts`) e em `MesaOnline.tsx`:
   - Se a sala tem um mapa em `construcao`, expor na tela `#/online` o cartão "Mapa em construção: <nome> (rev N)" com os botões:
     - **Baixar mapa (.json)** (sempre disponível, inclusive na Activity);
     - **Salvar no meu Atlas** (manda `atlas.importar-mapa` pelo barramento `mesa:eventos` para o Atlas aberto no navegador).
   - E botão **Enviar mapa do Atlas para construir na sala** (pede ao Atlas ou lê arquivo `.json` e chama `construcao.abrir`), caso o mestre queira começar a construção colaborativa a partir de um rascunho da campanha.
Não fazer: sincronia automática contínua entre IndexedDB local e sala fora do pedido explícito.
Testes: contrato de `atlas.importar-mapa` no `mesa-core`; atendente no Atlas salvando no repositório; fluxo de `#/online` recebendo `construcao.estado` da sala.
Pronto quando: após construir um mapa na Activity do Discord, o mestre abre a Mesa no navegador, clica "Salvar no meu Atlas" e o mapa aparece salvo na campanha e pronto para a sessão.
Commit:
- `Atlas`: `(feature) handle atlas.importar-mapa contract event`
- `Mesa`, `Dossie`, `Jukebox`, `Atelie`: sync `vendor/mesa-core/` and import/export built map in MesaOnline

### S9 — Assets customizados (imagens importadas) na construção colaborativa  ⬜
Objetivo: imagens importadas por participantes (fundos, objetos customizados) durante o modo construção sobem para a sala por hash e chegam aos demais colegas e ao download/exportação final.
Depende de: S7 e S8.
Ler: `Atlas/src/domain/assets.ts`, `Atlas/src/data/repositorio.ts` (`salvarAsset`), `Mesa/sala/mensagens.ts`, `Mesa/src/jogar/ponte-construcao.ts`.
Arquivos: mudar `Mesa/sala/permissoes.ts`, `Mesa/sala/mensagens.ts`, `Mesa/src/jogar/ponte-construcao.ts`, `Atlas/src/app/construcao-remota.ts`, `Atlas/src/data/backup.ts` (se exportar `PacoteBackup` com assets).
Como:
1. Quando um participante importa uma imagem em `#/construir-remoto/<salaId>`, o repositório em memória calcula `sha256` e anuncia `construcao.asset` + quadro binário (limite de 5 MB por asset e só aceito quando `modo === 'construcao'`).
2. `blob.pedir` passa a entregar também os `RefAsset` citados no mapa de construção atual.
3. Ao baixar `.atlas` / exportar para o Atlas do mestre, se o mapa citar `assets`, o pacote vai no formato `atlas.backup` (`PacoteBackup` com `assets` em base64), que `lerPacote` / `importarBackup` do Atlas já importa nativamente.
Não fazer: biblioteca compartilhada persistente de imagens fora do mapa atual.
Testes: upload de asset em modo construção por jogador, bloqueio acima de 5 MB ou em modo sessão, montagem do `PacoteBackup` com asset embutido.
Pronto quando: um jogador coloca uma imagem customizada no mapa em construção, todos a veem na Activity e o mestre a recebe ao importar no Atlas.
Commit: `(feature) custom image assets in collaborative build mode`

---

## Ordem sugerida

| Bloco | Fichas | Foco |
| --- | --- | --- |
| 1. Sala e Saguão | S1 → S2 | Protocolo, estado SQLite da sala, seletor de modo e abertura de mapa no saguão (`Mesa`) |
| 2. Editor colaborativo | S3 → S4 → S5 → S6 | Rota remota, reconciliação determinística de comandos, cursores e desfazer por autor (`Atlas`) |
| 3. Casca, painel e retorno | S7 → S8 → S9 | Painel lateral colaborativo na Activity, troca em tempo real, importação para a campanha e assets (`Mesa`, `Atlas` e `mesa-core`) |
