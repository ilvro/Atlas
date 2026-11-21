# Frente R — Mesa online (sala e atividade do Discord)

Planejada em 2026-11-20. O objetivo é mestrar online: os jogadores entram numa chamada de voz do Discord, abrem a atividade da Mesa e veem o mapa projetado com a ficha deles ao lado. Eles rolam dados, as rolagens aparecem para todos, e cada um move a própria peça. O mestre continua mestrando pelo navegador, com o Atlas, a Mesa e o Dossiê como hoje.

Divisão do trabalho, como manda o `CLAUDE.md`: as fichas vão ao **Sonnet** com esforço medium, uma ficha por subagente, e o Opus revisa. As fichas **[Usuário]** são passos em contas externas que só o usuário pode dar. A R19 é feita pelo Opus junto com o usuário.

## Problema

- **O site é estático.** Tudo roda no GitHub Pages, e os aplicativos conversam por `BroadcastChannel` e IndexedDB na mesma origem (`PLATAFORMA.md` §2 e §5). Nada disso sai do computador do mestre. A seção 10 do contrato deixou "vários jogadores" fora do escopo justamente porque exige servidor.
- **Mesmo assim, quase tudo já existe.**
  - O **projetor** do Atlas (`src/app/projetor.ts`) é uma janela que só recebe. O mestre publica nela a projeção já filtrada por `projetarParaJogadores` (névoa, `gmOnly`, `CAMPOS_DO_MESTRE`), a câmera, os eventos de cena, os retratos, os letreiros, a inspeção, os PV e as rolagens.
  - O **barramento** `mesa:eventos` tem um envelope único e separa fatos de pedidos. O `criarBarramento` já aceita um `CanalLike` injetável.
  - O **Dossiê** emite `ficha.rolagem` e `ficha.recursos`.
  - A **peça** liga-se à ficha por `Peca.refs`, e a projeção mantém essas `refs`.
- **Dentro do Discord, a origem é outra.** A atividade roda em `https://<id-do-app>.discordsays.com`, um proxy do Discord. Ali não se enxerga o IndexedDB nem o `localStorage` de `ilvro.github.io`, e o Discord bloqueia qualquer endereço que não esteja nos *URL mappings*.

## Decisões

1. **Uma sala no Cloudflare.** É um Worker com um Durable Object (SQLite) por sala, no plano gratuito. O site continua no GitHub Pages. O código da sala vive num projeto novo, `Projects/Sala/` (TypeScript `strict`, com repositório git próprio), e é publicado com `wrangler`.
2. **A sala é da campanha, não da chamada.** O `instanceId` da atividade muda a cada chamada, mas as fichas e o registro precisam durar entre sessões. Por isso a sala tem um id fixo, e um **diretório** (outro Durable Object, único) liga o servidor do Discord (`guildId`) à sala da campanha. Cada servidor tem uma sala ativa, escolhida pelo mestre na Mesa.
3. **Identidade pelo Discord, para todos.** Dentro da atividade, a identidade vem do Embedded App SDK. No navegador, o mestre (e o jogador que abrir por link) entra pelo OAuth2 web do Discord. Nos dois casos, o Worker troca o `code` pelo token com o segredo do app, lê `/users/@me` e emite uma **sessão assinada** (HMAC, com validade de 12 h): `{ discordId, nome, avatar, papel }`. Quem decide o papel é o servidor: `papel = 'mestre'` quando `discordId === MESTRE_DISCORD_ID` (um segredo do Worker).
4. **O mestre fica no navegador, e a Mesa faz a ponte.** O Atlas e o Dossiê do mestre não mudam de transporte. Uma tela da Mesa (`#/online`) faz a ponte entre o `BroadcastChannel` e a sala, repassando só o que pode sair:
   - as mensagens do projetor;
   - uma lista fechada de eventos.
   Na volta, ela traz os pedidos dos jogadores. O mestre não precisa entrar na atividade, mas pode, como espectador.
5. **O jogador usa uma casca, com a mesma ponte invertida.** Na atividade, a Mesa abre a **casca do jogador**: o projetor do Atlas num `iframe` e o Dossiê em modo jogador noutro. A casca leva o que chega da sala para o `BroadcastChannel` local (a origem `discordsays.com` é a mesma para os três) e manda à sala o que sai deles. O projetor quase não muda.
6. **As fichas dos jogadores moram na sala.** Cada ficha tem `dono = discordId` e `rev`. O Dossiê ganha um armazenamento trocável: `local` (como hoje) e `sala` (pela casca). O mestre vê e edita as fichas da sala no Dossiê dele, numa pasta "Sala", também pela ponte. Em conflito, ganha a última gravação, com aviso.
7. **A peça própria é livre.** O jogador arrasta a peça ligada a uma ficha dele. A casca manda o pedido `atlas.mover-peca`, a sala carimba o autor, e o Atlas do mestre confere a ligação e aplica o movimento como um arraste do mestre, com desfazer. Não pede aprovação.
8. **A sala é a única que carimba o autor.** Todo envelope que chega da sala traz `autor: { discordId, nome, papel, fichas: string[] }`. Quem recebe confia no carimbo e nunca num campo vindo do cliente.
9. **As rolagens começam no cliente.** Num primeiro momento, o Dossiê do jogador rola como hoje e a sala só espalha o resultado. Rolar na sala, para ninguém poder mexer no resultado, fica para a R20, porque depende de como os dados 3D decidem o valor.
10. **Funcionar sem sala continua sendo a regra.** Sem login, nada muda. O online é um modo a mais. O §2 e o §10 do `PLATAFORMA.md` são atualizados na R3.

## Arquitetura

```
 Navegador do mestre (ilvro.github.io)                   Cloudflare                    Discord (por jogador)
 ┌──────────────────────────────────────┐   wss    ┌─────────────────────────┐  wss  ┌───────────────────────────────┐
 │ Atlas ─┐ BroadcastChannel            │◄────────►│ Worker /sala            │◄─────►│ <app>.discordsays.com          │
 │ Dossiê ┼─ projetor + mesa:eventos    │          │  /token (OAuth)         │       │  Mesa (casca do jogador)       │
 │ Mesa #/online (ponte) ───────────────┘          │  DO Diretório guild→sala│       │   ├ iframe Atlas #/projetor    │
 └──────────────────────────────────────┘          │  DO Sala (SQLite)       │       │   └ iframe Dossiê ?sala=1      │
                                                   │   fichas, rolagens,     │       │  BroadcastChannel local        │
                                                   │   último estado, blobs  │       └───────────────────────────────┘
                                                   └─────────────────────────┘
```

**URL mappings da atividade:** `/` → `ilvro.github.io/Mesa`, `/Atlas` → `ilvro.github.io/Atlas`, `/Dossie` → `ilvro.github.io/Dossie` e `/sala` → `mesa-sala.<subdominio>.workers.dev`. Na R17, confira na documentação atual do Discord se os caminhos mapeados precisam do prefixo `/.proxy/`. O SDK tem `patchUrlMappings` para isso.

## Protocolo da sala (resumo; a R3 fixa os tipos)

Cliente → sala, em quadros de texto JSON, a não ser os blobs:

| Tipo | Quem pode | O que faz |
| --- | --- | --- |
| `ola { sessao }` | todos | Primeira mensagem. A sala valida a assinatura e responde `bem-vindo { eu, membros, fichas, ultimoEstado }`. |
| `canal { nome, msg }` | mestre | Uma mensagem de `atlas:projetor:*`. Se for `estado`, a sala guarda como o último. |
| `evento { envelope }` | mestre: a lista `EVENTOS_DO_MESTRE`; jogador: `ficha.rolagem` e `ficha.recursos` só das fichas dele, e `atlas.mover-peca` | Espalha a todos com o `autor` carimbado. |
| `ficha.salvar { ficha, rev }` | o dono da ficha, ou o mestre | Grava e espalha `ficha.atualizada`. Com `rev` velho, grava assim mesmo e marca `conflito: true`. |
| `ficha.entregar { fichaId, dono }` | mestre | Muda o dono. |
| `blob { id, tipo }` + quadro binário | mestre | Guarda um retrato ou asset em pedaços de 512 KB, sem repetir id. |

Sala → cliente: `bem-vindo`, `membros`, `canal`, `evento`, `ficha.atualizada`, `blob`, `erro { motivo }`.

---

## Bloco 0 — Contas

### R0 — Discord Developer Portal e Cloudflare  [Usuário]  ⬜
Objetivo: deixar prontos o app do Discord, a conta do Cloudflare e os quatro valores de que o código precisa.
Depende de: —.
Como:
1. **Cloudflare:** criar a conta em `dash.cloudflare.com/sign-up`. O plano Workers Free não pede cartão. Na primeira publicação, escolher o subdomínio `<algo>.workers.dev`.
2. **Discord, app:** em `discord.com/developers/applications` → *New Application*, com o nome "Mesa". Copiar o **Application ID** (público).
3. **Discord, OAuth2:**
   - em *Client Secret* → *Reset Secret*, copiar o valor. Ele é segredo: vai só para o Cloudflare, nunca para o código nem para o GitHub;
   - em *Redirects*, acrescentar `https://127.0.0.1` (exigido para atividades) e `https://ilvro.github.io/Mesa/`.
4. **Discord, seu id:** em *Configurações* → *Avançado* → *Modo de desenvolvedor*. Depois, clicar com o botão direito no próprio nome → *Copiar ID do usuário*. Esse é o `MESTRE_DISCORD_ID`.
5. **Discord, Activities** (só depois da R17):
   - em *Settings*, ligar *Enable Activities* e marcar as plataformas (computador, Android, iOS);
   - em *URL Mappings*, cadastrar os quatro da seção Arquitetura;
   - em *Installation*, ligar *Guild Install* e instalar o app no servidor da mesa pelo link.
   - Se um jogador não vir a atividade no botão de Atividades (foguete) da chamada, acrescente-o em *App Testers*.
Pronto quando: o usuário tem o Application ID, o Client Secret, o `MESTRE_DISCORD_ID` e a conta do Cloudflare logada (`npx wrangler login`).
Nota: o Application ID (que também é o client id), a public key e o `MESTRE_DISCORD_ID` estão em `Projects/.mesa-online.env`, fora de qualquer repositório. Leia de lá, sem copiar os valores para este plano nem para arquivos versionados. A exceção é o client id, que é público e vai no código da Mesa (R17) e no `[vars]` do `wrangler.toml`. O Client Secret não está em arquivo nenhum: o usuário digita direto no `wrangler secret put`. Antes de cada commit no `Sala/`, confira que `.dev.vars` está no `.gitignore` e que o `git diff --cached` não tem o id do mestre nem o segredo.

## Bloco 1 — Sala

### R1 — Projeto Sala: Worker, Durable Object e WebSocket  ⬜
Objetivo: uma sala que aceita conexões e repete mensagens para os outros conectados.
Depende de: R0 (só para publicar; dá para desenvolver com `wrangler dev`).
Ler: a documentação de Durable Objects com SQLite e da *WebSocket Hibernation API* (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`); `Atlas/AGENTS.md` (convenções de TypeScript).
Arquivos: criar `Sala/` com `package.json`, `tsconfig.json` (`strict`), `wrangler.toml`, `src/index.ts` (rotas), `src/sala.ts` (classe `Sala`), `tests/sala.test.ts`, `AGENTS.md` curto e `.gitignore`; rodar `git init`.
Como:
1. No `wrangler.toml`: `name = "mesa-sala"`, um binding `SALA` para a classe `Sala` e a migração `new_sqlite_classes = ["Sala"]` (no plano gratuito, só o backend SQLite é aceito).
2. A rota `GET /sala/:id/ws` faz o upgrade e repassa ao Durable Object `idFromName(id)`.
3. Por enquanto, a `Sala` aceita com hibernação e repete cada mensagem de texto aos outros. Guarda `{ discordId, papel }` em `serializeAttachment` (fica vazio nesta ficha).
4. A rota `GET /sala/saude` devolve `ok`.
5. CORS: só `https://ilvro.github.io`, `https://*.discordsays.com` e `http://127.0.0.1:5100`.
6. Scripts: `dev` (`wrangler dev`), `deploy`, `test` (vitest com `@cloudflare/vitest-pool-workers`) e `typecheck`.
Não fazer: login (R2), estado (R4).
Testes: dois clientes na mesma sala recebem a mensagem um do outro; em salas diferentes, não recebem.
Pronto quando: `npm test` e `npm run typecheck` passam no `Sala/`, e `wrangler dev` responde `/sala/saude`.
Commit: `room worker with durable object relay`

### R2 — Login pelo Discord e sessão assinada  ⬜
Objetivo: o Worker sabe quem é cada conexão e quem é o mestre.
Depende de: R1.
Ler: o fluxo OAuth2 do Discord (troca do `code` em `https://discord.com/api/oauth2/token`, `GET /users/@me`); o exemplo de autenticação do Embedded App SDK.
Arquivos: criar `Sala/src/sessao.ts` e `Sala/tests/sessao.test.ts`; mudar `src/index.ts`, `src/sala.ts` e `wrangler.toml`.
Como:
1. Segredos via `wrangler secret put` (no `.dev.vars` em dev, que fica no `.gitignore`): `DISCORD_CLIENT_SECRET`, `MESTRE_DISCORD_ID` e `SEGREDO_SESSAO` (32 bytes aleatórios). `DISCORD_CLIENT_ID` vai em `[vars]`.
2. `POST /sala/token { code, redirectUri? }`: troca o `code` (com `redirect_uri` só no fluxo web) e lê `/users/@me`. Devolve `{ access_token, sessao }`; o `access_token` é o que o SDK usa no `authenticate`. A sessão é `base64url(json).base64url(hmacSha256)`, com `{ discordId, nome, avatar, papel, exp }`.
3. `verificarSessao(token, segredo, agora)` → `Sessao | null`, com tempo constante na comparação.
4. O WebSocket exige que a primeira mensagem seja `ola { sessao }` e fecha com 4001 se for inválida. A sessão verificada vai para o attachment.
Não fazer: o diretório (R4) nem o cliente (R5, R17).
Testes: assinar e verificar; sessão vencida, adulterada ou com outro segredo é rejeitada; `papel` sai `mestre` só para o id configurado; o WebSocket sem `ola` válido é fechado. A troca com o Discord vai com `fetch` falso.
Pronto quando: os testes passam e nenhum segredo aparece no código.
Commit: `discord login and signed sessions in room worker`

### R3 — Protocolo da sala no mesa-core  ⬜
Objetivo: os tipos e o cliente da sala, iguais para a Mesa do mestre e para a casca do jogador.
Depende de: R2.
Ler: `Atlas/mesa-core/src/eventos.ts` (`Evento`, `CanalLike`, `validarEvento`, `CATALOGO`), `Atlas/src/app/projetor.ts` (`MensagemDoMestre`, `MensagemDoProjetor`), `Atlas/docs/PLATAFORMA.md` §5 e §10.
Arquivos: criar `Atlas/mesa-core/src/sala.ts` e o teste dele; mudar `eventos.ts` (campo `autor?` no `Evento`, entrada `atlas.mover-peca` no `CATALOGO` como pedido de `atlas`, fatos `sala.*`), `index.ts` e `PLATAFORMA.md`.
Como:
1. Os tipos `MensagemParaSala` e `MensagemDaSala` da tabela do protocolo. `Autor = { discordId; nome; papel: 'mestre' | 'jogador'; fichas: string[] }`.
2. `conectarSala({ url, sessao, WebSocket? }) → ClienteDaSala`, com `enviar`, `ouvir(tipo, f)`, `estado: 'conectando' | 'aberta' | 'caiu'` e `fechar`. Reconecta com espera crescente (1, 2, 4… até 30 s), refaz o `ola` e repete o `bem-vindo`.
3. Blobs: `enviarBlob(id, blob)` divide em pedaços de 512 KB num quadro binário com cabeçalho `{ id, i, n, tipo }`; `ouvirBlob` remonta.
4. `EVENTOS_DO_MESTRE`: a lista fechada do que a ponte do mestre pode repassar. Por enquanto, `ficha.rolagem` de personagens e `atlas.cena-aberta`.
5. No `PLATAFORMA.md`: em §2, um parágrafo "Modo online (Frente R)"; em §5, o campo `autor`; em §10, trocar "fora do escopo" por um link para esta frente.
6. `npm run build:core` e copiar o `dist/` para `Mesa/vendor/mesa-core/` e `Dossie/vendor/mesa-core/`.
Não fazer: a ponte (R5) nem a lógica de permissões (R4, no servidor).
Testes: reconexão com um WebSocket falso; divisão e remontagem de um blob de 1,3 MB; `validarEvento` aceita `autor` e recusa `autor` malformado.
Pronto quando: os testes do mesa-core passam e as cópias em `vendor/` batem com o `dist/`.
Commit: `room protocol and client in mesa-core`
Nota: o `Sala/` importa os tipos de `mesa-core/src/sala.ts` por caminho relativo ou por cópia em `Sala/vendor/`. Escolha a cópia se o `wrangler` reclamar.

### R4 — Estado e permissões da sala  ⬜
Objetivo: a sala guarda o que dura entre sessões e recusa o que cada papel não pode mandar.
Depende de: R3.
Ler: `Sala/src/sala.ts`, `mesa-core/src/sala.ts` e a API SQL do Durable Object (`ctx.storage.sql.exec`).
Arquivos: criar `Sala/src/estado.ts`, `Sala/src/permissoes.ts`, `Sala/src/diretorio.ts` e os testes; mudar `sala.ts`, `index.ts` e `wrangler.toml` (classe `Diretorio`).
Como:
1. Tabelas da sala:
   - `fichas(id, dono, rev, json, atualizada_em)`;
   - `rolagens(id, em, autor, json)`, mantendo as 200 últimas;
   - `ultimo(canal, json)`;
   - `blobs(id, i, n, tipo, dados)`;
   - `config(chave, valor)`, com o nome da sala e a campanha.
   Limite de 1,5 MB por ficha.
2. `permitido(msg, sessao, fichasDoAutor) → boolean`, em código puro, conforme a tabela do protocolo.
3. Carimbar `autor` em todo `evento` que sai.
4. Se um `canal` chega com `msg.tipo === 'estado'`, guardar como o último daquele canal, para quem chegar atrasado.
5. Presença: `membros` a cada entrada e saída.
6. `Diretorio` (Durable Object `idFromName('diretorio')`):
   - `POST /sala/diretorio/ligar { guildId, salaId }` (só o mestre);
   - `GET /sala/diretorio/:guildId` → `{ salaId }`.
   - `POST /sala/nova` (só o mestre) cria um id aleatório e um nome.
7. Um limite simples de mensagens por conexão: 60 por segundo, acima disso descarta e avisa uma vez.
Não fazer: clientes.
Testes: um jogador não consegue mandar `canal` nem salvar a ficha de outro; o mestre consegue; quem entra atrasado recebe o último `estado` e as fichas; o diretório liga e consulta.
Pronto quando: os testes passam e o `wrangler deploy` publica (com o usuário logado).
Commit: `room state, permissions and guild directory`

## Bloco 2 — O mestre publica

### R5 — Ponte do mestre na Mesa  ⬜
Objetivo: com a tela "Mesa online" aberta, o mapa projetado e os eventos permitidos saem para a sala.
Depende de: R4.
Ler: `Mesa/src/app/barramento.ts`, `Mesa/src/app/rotas.ts`, `Mesa/src/ui/ModoSessao.tsx` (como abre o Atlas) e, em `Atlas/src/app/projetor.ts`, `iniciarPublicacao` (o publicador só trabalha depois de um `ola` de projetor) e `MensagemDoProjetor`.
Arquivos: criar `Mesa/src/app/online.ts`, `Mesa/src/ui/MesaOnline.tsx` e o teste da ponte; mudar `rotas.ts` e a navegação.
Como:
1. A rota `#/online` traz o botão "Entrar com o Discord". Ele usa o OAuth2 web: redireciona para `discord.com/oauth2/authorize?client_id…&response_type=code&scope=identify&redirect_uri=https://ilvro.github.io/Mesa/&state=<aleatório>`. Na volta, `main.tsx` vê `?code=`, confere o `state`, chama `/sala/token` e guarda a sessão no `localStorage['mesa:online-sessao']`, com `try/catch`.
2. Com a sessão de mestre:
   - criar ou escolher a sala da campanha ativa (o id fica na campanha, em `localStorage['mesa:sala:<campanhaId>']`);
   - ligar a um servidor do Discord, colando o id do servidor;
   - ver quem está conectado.
3. Ponte de ida:
   - ouvir `atlas:projetor:ativo` e repassar como `canal`;
   - os blobs das mensagens `retrato` e `inspecao` vão por `enviarBlob`, e a mensagem segue com `blobId` no lugar do `Blob`;
   - no `mesa:eventos`, repassar só o que está em `EVENTOS_DO_MESTRE`.
4. Ponte de volta: os eventos dos jogadores vão para o `BroadcastChannel('mesa:eventos')` local, com o `autor`.
5. Enquanto houver jogador na sala, a ponte manda ao Atlas um `{ tipo: 'ola' }` no canal do projetor, com 16:9, para o publicador acordar mesmo sem projetor local. Um `tchau` sai quando o último jogador vai embora.
Não fazer: compressão e divisão do `estado` (R6), fichas (R13).
Testes: a ponte com um cliente da sala falso e um `BroadcastChannel` falso; um evento fora da lista não sai; um `Blob` vira `blobId`.
Pronto quando: com o Atlas aberto e a Mesa em `#/online`, um cliente de teste conectado na sala recebe o `estado` do mapa.
Commit: `mesa online bridge publishes projector to the room`

### R6 — Mapas grandes e assets  ⬜
Objetivo: o `estado` de um mapa grande chega inteiro e sem estourar o limite de mensagem.
Depende de: R5.
Ler: o tamanho do `estado` nos mapas de `Atlas/public/exemplos/` (meça); `online.ts`; e `lerAsset` em `iniciarPublicacao`.
Arquivos: mudar `Mesa/src/app/online.ts` e `mesa-core/src/sala.ts` (e as cópias em `vendor/`), mais testes.
Como:
1. Um `estado` acima de 256 KB vai comprimido (`CompressionStream('gzip')`) como blob `estado:<mapa>:<versao>`. A mensagem `canal` leva só `{ tipo: 'estado', blobId, versao }`, e o receptor descomprime.
2. Durante um gesto, `emGesto` e `peca-gesto` vão sem compressão e limitados a 15 por segundo.
3. Assets e retratos são enviados uma vez por id por sessão da ponte. A sala já guarda e entrega a quem chega.
Não fazer: diferenças entre versões (só se a medição mostrar necessidade; nesse caso, anote).
Testes: um `estado` de 3 MB atravessa e volta igual; o gesto é limitado.
Pronto quando: o maior mapa de exemplo abre num cliente de teste em menos de 5 s.
Commit: `compressed map state and asset dedup for the room`

## Bloco 3 — O jogador vê

### R7 — Casca do jogador, entrando por link  ⬜
Objetivo: um jogador abre `ilvro.github.io/Mesa/#/jogar/<sala>`, entra com o Discord e vê o mapa.
Depende de: R6.
Ler: `ModoSessao.tsx` (o `Escalado` e os `iframe`), `aplicativos.ts` (`baseDoApp`), `Atlas/src/app/rotas.ts` (`#/projetor/{id}`) e `Atlas/src/app/projetor.ts` (o lado receptor).
Arquivos: criar `Mesa/src/jogar/Casca.tsx`, `Mesa/src/jogar/ponte-jogador.ts` e o teste; mudar `rotas.ts` e `main.tsx` (com `import()` sob demanda, para a casca não pesar no hub).
Como:
1. A casca ocupa a tela toda, sem a navegação da Mesa. O mapa fica à esquerda e o painel da ficha (reservado, vazio até a R12) à direita, com 360 px. Em telas estreitas na vertical, abas embaixo: Mapa | Ficha.
2. Ponte de volta: o `canal` da sala vai para o `BroadcastChannel` local `atlas:projetor:<mapa>` e `atlas:projetor:ativo`, já com os blobs remontados e o `estado` descomprimido. O `evento` vai para o `mesa:eventos`.
3. Ponte de ida: `MensagemDoProjetor` não sai (o mestre não precisa do tamanho de cada jogador), e os eventos permitidos a jogador saem.
4. O `iframe` do Atlas abre em `../Atlas/#/projetor/<mapa>?remoto=1`. O mapa vem do último `estado`, e a casca troca o `src` quando o mestre muda de mapa.
5. O projetor com `?remoto=1` só esconde o que é do mestre (o aviso "feche esta janela" e afins). Se a ficha não bater com o código do projetor, pare e reporte.
6. Um selo de conexão mostra o estado do cliente (`aberta`, ou "reconectando…").
Não fazer: o Discord (R17), as fichas (R11 e R12) e o arraste (R15).
Testes: a ponte do jogador com falsos; um e2e com dois contextos do Playwright (mestre e jogador) e a sala em `wrangler dev`, se for viável. Se não for, anote e faça só o teste unitário.
Pronto quando: em dois navegadores, o mestre move uma peça e o jogador vê o movimento.
Commit: `player shell shows the projected map from the room`

### R8 — Câmera própria no projetor remoto  ⬜
Objetivo: o jogador pode olhar o mapa por conta própria e voltar à câmera do mestre.
Depende de: R7.
Ler: o tratamento de `camera` e de `seguir` no lado receptor do projetor; os controles de câmera do Atlas.
Arquivos: mudar o receptor do projetor e a casca (o botão).
Como: com `?remoto=1`, arrastar com o botão do meio ou com dois dedos e usar a roda ou a pinça move a câmera local, e a partir daí as mensagens `camera` são ignoradas. O botão "Seguir o mestre" volta ao comportamento atual, e `camera` com `imediata` (um momento de cena) sempre ganha.
Não fazer: o arraste de peça (R15).
Testes: a lógica de "câmera livre ou seguindo" como função pura.
Pronto quando: o jogador dá zoom num canto, o mestre muda a câmera e nada acontece; ao clicar "Seguir o mestre", a câmera volta.
Commit: `free camera for remote projector`

### R9 — Rolagens para todos  ⬜
Objetivo: toda rolagem de ficha de jogador aparece para a mesa inteira.
Depende de: R7.
Ler: `Dossie/src/mesa.js` (onde emite `ficha.rolagem`), a mensagem `rolagem` do projetor e a parte do Atlas que traduz `ficha.rolagem` em `rolagem` sobre a peça.
Arquivos: mudar `Casca.tsx` (o feed) e o `online.ts` da Mesa (o repasse ao Atlas do mestre).
Como:
1. Na casca, um feed pequeno no canto do mapa com as cinco últimas rolagens (retrato, nome, título e total), que somem em 8 s, e um histórico abrível com as 200 da sala.
2. Do lado do mestre, a rolagem de um jogador entra no `mesa:eventos` local. O Atlas já mostra na peça, o que confirma o caminho.
3. Cada rolagem que entra na sala fica guardada nela.
Não fazer: rolar na sala (R20).
Testes: o feed recebe, ordena e expira.
Pronto quando: um jogador rola, e o mestre e os outros jogadores veem.
Commit: `shared roll feed for the online table`

## Bloco 4 — Fichas na sala

### R10 — Dossiê: armazenamento trocável  ⬜
Objetivo: separar onde as fichas moram do resto do `app.js`, sem mudar o comportamento.
Depende de: —, e pode andar em paralelo com os blocos 1 a 3.
Ler: `Dossie/src/app.js`: o IndexedDB (~linha 797), `SHEETS_KEY` e a carga (~827–880), `persistedSheet` e `persistSheetsNow` (~1753–1860), e o plugin de API local em `vite.config.js`.
Arquivos: criar `Dossie/src/armazenamento.js` e um teste em `Dossie/tests/`; mudar `app.js`.
Como: definir a interface `{ carregar(): Promise<{ fichas, ativaId }>, salvar(fichas, { forcar }), salvarAtiva(id), aoMudarFora(f) }` e mover a lógica atual para `armazenamentoLocal()`. O `app.js` só conversa com essa interface. É uma refatoração pura.
Não fazer: o adaptador da sala (R11).
Testes: os testes atuais do Dossiê passam; um teste carrega, salva e carrega de novo com um IndexedDB falso.
Pronto quando: o Dossiê funciona igual no navegador e no app de desktop.
Commit: `extrair o armazenamento das fichas` (em português, no estilo do Dossiê)

### R11 — Dossiê em modo jogador  ⬜
Objetivo: dentro da casca, o Dossiê mostra e grava só as fichas do jogador, na sala.
Depende de: R10 e R7.
Ler: `armazenamento.js`, `mesa.js` e a barra lateral (`nav-rail`, pastas, compêndio, ameaças, licença do bestiário) e as vistas (`viewMode`, `presentationMode`) em `app.js`.
Arquivos: criar `armazenamentoSala()` em `armazenamento.js`; mudar `app.js` e `mesa.js`; do lado da casca, `ponte-jogador.ts`.
Como:
1. Com `?sala=1` na URL, o armazenamento é `armazenamentoSala()`:
   - `carregar` pede `sala.fichas` pelo barramento, e a casca responde com as fichas do `bem-vindo`;
   - `salvar` emite `sala.salvar-ficha`, com `debounce` de 800 ms, e a casca repassa como `ficha.salvar`;
   - `aoMudarFora` ouve `sala.ficha-atualizada` e redesenha, com o aviso "atualizada pelo mestre" quando o autor não é o jogador.
2. No modo jogador, esconder as pastas, as ameaças, o bestiário, o compêndio de licença, "Levar para a campanha" e a publicação na campanha (o `mesa.js` não abre o IndexedDB da campanha). Manter as vistas, os dados, o histórico de rolagens, o importar e exportar JSON e o "nova ficha".
3. "Nova ficha" e "Importar JSON" criam a ficha na sala com `dono` igual ao jogador.
4. `?vista=card` mostra só o card (a vista compacta que o Dossiê já usa em telas estreitas, sem a barra lateral). `?vista=completa` mostra a ficha inteira. A casca troca a vista por `postMessage` (`{ tipo: 'dossie.vista', vista }`) para não recarregar.
Não fazer: o lado do mestre (R13).
Testes: o adaptador da sala com um barramento falso, cobrindo carga, gravação com `debounce` e atualização vinda de fora.
Pronto quando: na casca, o jogador cria uma ficha, recarrega a página e ela continua lá.
Commit: `modo jogador do dossiê com fichas na sala`

### R12 — Card e ficha completa na casca  ⬜
Objetivo: a ficha fica à mão sem tapar o mapa, e a completa abre por cima.
Depende de: R11.
Ler: `Casca.tsx` e as vistas do Dossiê.
Arquivos: mudar `Casca.tsx` e o CSS da casca.
Como:
1. Um único `iframe` do Dossiê em `../Dossie/?sala=1&vista=card`, no painel. O botão "Ficha completa" leva o `iframe` para a tela toda (sobreposto ao mapa, que continua vivo por trás) e manda `vista=completa`. "Voltar ao mapa" faz o inverso.
2. Em celular na vertical, a aba Ficha mostra a completa direto.
3. Um jogador com mais de uma ficha escolhe a ativa no card.
Não fazer: estilo novo do Dossiê; o card é o que já existe.
Testes: e2e curto da troca de vista, se o e2e da R7 existir.
Pronto quando: o jogador rola pelo card, abre a completa, edita um item e volta ao mapa sem recarregar.
Commit: `sheet card and full sheet in player shell`
Nota: o Opus revisa o resultado visual (proporções, legibilidade no celular) antes de fechar.

### R13 — Fichas da sala no Dossiê do mestre  ⬜
Objetivo: o mestre vê, edita e entrega as fichas da sala pelo Dossiê dele.
Depende de: R11 e R5.
Ler: `armazenamento.js`, as pastas do Dossiê (`src/workspace/folders.js`) e o `online.ts` da Mesa.
Arquivos: mudar `Dossie/src/app.js` (a pasta virtual), `armazenamento.js` (a combinação) e `Mesa/src/app/online.ts` (atender `sala.fichas`, repassar `sala.salvar-ficha` e `ficha.entregar`).
Como:
1. Com a Mesa online conectada, o Dossiê do mestre mostra uma pasta virtual "Sala: <nome>" com as fichas da sala, com o dono no rótulo. Editar uma delas grava na sala, e não no local.
2. Uma ficha local ganha, no menu, "Entregar a um jogador…", que lista os membros conhecidos. A ficha é copiada para a sala com `dono` igual ao jogador; a local fica como está.
3. Conflito: se chegar uma `ficha.atualizada` com `rev` maior enquanto o mestre edita, aparece o aviso "<nome> mexeu nesta ficha" com "Ver a versão dele" e "Manter a minha".
Não fazer: fusão campo a campo.
Testes: a combinação de local com sala no armazenamento; a entrega com uma ponte falsa.
Pronto quando: o mestre muda o PV de um jogador e o card do jogador atualiza.
Commit: `fichas da sala no dossiê do mestre`

## Bloco 5 — A peça própria

### R14 — Projetor sabe quais peças são do jogador  ⬜
Objetivo: o projetor remoto destaca e libera a peça do jogador.
Depende de: R7 e R11.
Ler: o receptor do projetor; `Peca.refs` em `Atlas/src/domain/mapa.ts`; `projetarParaJogadores` (que mantém `tokens.*.refs`).
Arquivos: mudar o receptor do projetor e a ponte do jogador.
Como: a casca manda ao `iframe` `{ tipo: 'jogador', fichas: string[] }` por `postMessage`. As peças de jogador cujas `refs` contêm `mesa:ficha/ficha/<id>` de uma dessas fichas ganham um anel discreto e o cursor de mão.
Não fazer: o arraste (R15).
Testes: uma função pura `pecasDoJogador(doc, fichas)`.
Pronto quando: o jogador vê a própria peça marcada e as outras não.
Commit: `remote projector marks the player's own tokens`

### R15 — Arrastar a própria peça  ⬜
Objetivo: o jogador move a peça dele, e todos veem.
Depende de: R14.
Ler: o arraste de peça no editor do Atlas (o comando de mover e o desfazer) e o lado receptor do projetor.
Arquivos: mudar o receptor do projetor (o gesto) e criar o atendente no Atlas (`src/app/` junto de onde o Atlas atende os outros pedidos do barramento); mudar o catálogo, se a R3 não tiver deixado `atlas.mover-peca` completo.
Como:
1. No projetor remoto, arrastar a própria peça mostra uma prévia local (fantasma) e, ao soltar, pede `atlas.mover-peca { mapa, peca, position, levelId? }` pelo barramento.
2. O Atlas do mestre atende:
   - recusa se o mapa aberto não for o mesmo;
   - recusa se `evento.autor` faltar;
   - recusa se a peça não for `player` ou se nenhuma `ref` dela apontar para uma ficha em `autor.fichas`.
   Se passar, aplica com o mesmo comando de um arraste do mestre (com desfazer e encaixe na grade, se ligado), e a projeção nova sai sozinha.
3. A resposta recusada aparece no projetor como um toque de "não deu", e a prévia volta.
4. O mestre recebe um toast "<nome> moveu <peça>" (desligável).
Não fazer: colisão com paredes nem limite de deslocamento por turno.
Testes: o atendente com documento de teste (aceita a própria peça, recusa a dos outros, recusa sem autor e recusa mapa errado).
Pronto quando: em dois navegadores, o jogador arrasta a peça dele, o mestre vê mover e pode desfazer.
Commit: `players move their own tokens online`

## Bloco 6 — Discord

### R16 — Fontes locais no Dossiê  ⬜
Objetivo: o Dossiê não depende do Google Fonts, que o Discord bloqueia.
Depende de: —.
Ler: `Dossie/index.html` (linhas 14–16: Barlow, Cinzel, Cinzel Decorative e Hanken Grotesk).
Arquivos: criar `Dossie/public/fontes/` com os `woff2` (fontes OFL, com a licença junto) e `fontes.css`; mudar `index.html`.
Como: baixar só os pesos usados, servir localmente com `font-display: swap` e remover os `preconnect`. Procure no Atlas e na Mesa outras dependências externas (`grep -r "https://"` em `index.html` e `src/`) e liste-as numa linha "Nota:".
Pronto quando: o Dossiê abre igual com a rede bloqueada para `fonts.googleapis.com`.
Commit: `fontes servidas localmente`

### R17 — Atividade do Discord  ⬜
Objetivo: dentro de uma chamada, a atividade abre a casca na sala do servidor, já com o jogador identificado.
Depende de: R12, R15, R16 e R0 (passo 5).
Ler: a documentação atual do Embedded App SDK (`DiscordSDK`, `ready`, `commands.authorize`, `commands.authenticate`, `guildId`, `channelId`, `instanceId`, `patchUrlMappings`, o prefixo `/.proxy/`) e `Mesa/src/main.tsx`.
Arquivos: acrescentar `@discord/embedded-app-sdk` na Mesa; criar `Mesa/src/jogar/discord.ts`; mudar `main.tsx` e `Casca.tsx`.
Como:
1. `main.tsx`: se a URL tem `frame_id` (a atividade sempre passa), carregar a casca em modo Discord por `import()`.
2. `discord.ts`:
   - `new DiscordSDK(CLIENT_ID)` e `await ready()`;
   - `authorize({ client_id, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'guilds'] })`;
   - `POST /sala/token { code }` (sem `redirect_uri`) e `authenticate({ access_token })`.
   - A sessão fica em memória, não no `localStorage`.
3. Sala: `GET /sala/diretorio/<guildId>`. Se não houver sala ligada, mostrar "O mestre ainda não ligou uma sala a este servidor"; e, se quem abriu for o mestre, um seletor das salas dele.
4. Todas as URLs do Worker usam o caminho mapeado (`/sala/...`), nunca o `workers.dev` direto. Chamar `patchUrlMappings` com os mapeamentos, para algum `fetch` absoluto que tenha escapado.
5. O mestre que abrir a atividade entra como espectador: vê o projetor e o feed e não tem ficha.
6. Conferir que os `iframe` de `/Atlas/` e `/Dossie/` carregam pelo mapeamento e que o `BroadcastChannel` entre a casca e eles funciona dentro do Discord. Se não funcionar, troque por `postMessage` com a casca como centro e anote.
Não fazer: comandos de barra, convites nem outros recursos do Discord.
Testes: unitários da escolha do modo (`frame_id`) e do caminho sem sala ligada; o resto é a R19.
Pronto quando: o build passa e a casca em modo Discord funciona com um SDK falso.
Commit: `mesa as a discord activity`

### R18 — Mestre liga a sala ao servidor  ⬜
Objetivo: o mestre liga a sala ao servidor sem copiar ids à mão.
Depende de: R17.
Ler: `MesaOnline.tsx` e `diretorio.ts`.
Arquivos: mudar `MesaOnline.tsx` e `Sala/src/index.ts`.
Como: com o escopo `guilds` no login web do mestre, listar os servidores em que ele está e em que o app está instalado (`GET /users/@me/guilds` pelo Worker, cruzando com uma lista mantida pelo diretório das guildas já vistas pela atividade). Um clique liga. Manter o campo de colar o id como alternativa.
Pronto quando: o mestre escolhe o servidor numa lista.
Commit: `pick discord server for the room from a list`

### R19 — Teste de verdade no Discord  [Opus + Usuário]  ⬜
Objetivo: uma sessão curta de ponta a ponta, com pelo menos duas contas.
Depende de: R17 e R0 (passo 5).
Como: o usuário cadastra os URL mappings, instala o app no servidor e abre a atividade numa chamada com uma segunda conta (outro aparelho ou um amigo). Roteiro:
- entrar;
- ver o mapa;
- câmera própria;
- criar ficha;
- rolar (o mestre vê);
- mover a peça (o mestre vê e desfaz);
- o mestre muda o PV;
- o mestre troca de mapa;
- um jogador sai e volta (recebe o estado);
- celular na vertical.
Anotar o que falhar no `progress.md` e abrir fichas de correção aqui.
Pronto quando: o roteiro passa no computador e no celular.

## Depois (opcional)

### R20 — Rolagem feita na sala  ⬜
Objetivo: o resultado vem do servidor, e ninguém mexe nele.
Depende de: R9.
Ler: `Dossie/src/dice3d.js` e `src/fx/dice-*.js`: **antes de tudo**, descobrir se o valor sai da física ou é sorteado antes e animado. Se a física decide e não dá para forçar a face, pare e reporte.
Como: `sala.rolar { fichaId, expressao, titulo }`. A sala sorteia com `crypto.getRandomValues`, guarda e espalha. O Dossiê anima até o resultado recebido. Uma rolagem marcada "secreta" pelo mestre vai só para ele.
Commit: `server-side dice rolls`

## Fora do escopo

- Voz e vídeo: são da chamada do Discord.
- Jogador mexendo em outra coisa que não a própria peça e as próprias fichas: portas, névoa, desenho no mapa.
- Mestrar de dentro da atividade.
- Jukebox tocando para os jogadores. O áudio de cena é do computador do mestre; se um dia for para a atividade, é outra frente.
- Fusão de fichas campo a campo; vale a última gravação, com aviso.

## Ordem

| Bloco | Fichas | Quem | Depende de |
| --- | --- | --- | --- |
| 0. Contas | R0 | Usuário | — |
| 1. Sala | R1 → R2 → R3 → R4 | Sonnet | R0 só para publicar |
| 2. O mestre publica | R5 → R6 | Sonnet | R4 |
| 3. O jogador vê | R7 → R8, R9 | Sonnet | R6 |
| 4. Fichas | R10 (já), R11 → R12, R13 | Sonnet (o Opus revisa a R12) | R7 para a R11 |
| 5. Peça própria | R14 → R15 | Sonnet | R11 |
| 6. Discord | R16 (já), R17 → R18, R19 | Sonnet; R19 com o usuário | blocos 3 a 5 |
| Depois | R20 | Sonnet | R9 |

Os blocos 1 a 5 já permitem jogar online por link, entrando com o Discord no navegador. A atividade (bloco 6) entra por cima sem refazer nada. A R10 e a R16 não dependem de nada e podem começar já.
