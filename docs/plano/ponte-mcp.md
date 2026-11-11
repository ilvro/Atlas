# Ponte MCP: correções e melhorias depois da Fase 14

"O Claude vê sempre as mesmas ferramentas, todas, e nunca repete uma escrita sem saber." Planejado em 10 de novembro de 2026, conferido contra o código desse dia (`6fdfdd2`).

**Problema:** a revisão do servidor MCP `mesa` (`scripts/ponte/mcp.ts`), da ponte (`scripts/ponte/servidor.ts`) e do catálogo `.ponte/ferramentas.json` encontrou:
- **Catálogo que oscila:** as `campanha_*` são registradas pelo Atlas e pela Mesa. A assinatura do catálogo inclui o app, então a ferramenta troca de dono conforme a ordem das abas, o cache é regravado e sai um `list_changed` à toa.
- **Ferramentas invisíveis:** o catálogo só aprende uma ferramenta quando o app dela abre com o MCP rodando. O cache de hoje não tem nenhuma `jukebox_*` nem `mesa_elenco`/`mesa_elenco_ler`.
- **Prazos maiores que os do cliente:** a ponte pode esperar 60 s (Mesa) + 20 s (registro) + 60 s (chamada). Os clientes MCP costumam desistir em ~60 s; se o Claude repete, a escrita é feita duas vezes.
- **Anotações por palpite de nome:** `atlas_catalogo` não sai como leitura; `atlas_remover` não sai como destrutiva; `atlas_abrir` e `mesa_abrir_apps` caem no padrão "destrutivo".
- **Textos velhos:** `SEM_PONTE` só fala do `mesa-dev`, não do atalho do desktop; token inválido e servidor desligado dão a mesma mensagem.
- **Peso:** o catálogo tem ~66 KB (~17 mil tokens) em toda conversa; só `atlas_momento` tem 6 KB. As instruções precisam ser coladas à mão num projeto do Claude.

## Decisões (não rediscutir na implementação)

- **Dono estável de ferramenta repetida:** quando o mesmo nome vem de mais de um app, o dono no catálogo é o app do prefixo (`PREFIXOS`, que ganha `campanha_ → mesa`); sem prefixo conhecido, fica o dono que já estava no catálogo. `PREFIXOS` e `appDoPrefixo` passam para `protocolo.ts`, usados pelo MCP e pela ponte.
- **Catálogo base versionado:** `scripts/ponte/catalogo-base.json` entra no git. É a foto do catálogo completo, gerada por `npm run ponte:catalogo` a partir do `.ponte/ferramentas.json`. O MCP parte dele e o cache local por cima: o que as abas registram vence. Não é um manifesto escrito à mão e não muda os apps.
- **Anotações declaradas pelo app:** campo opcional `anotacoes?: { leitura?: boolean; destrutiva?: boolean; idempotente?: boolean }` na ferramenta, no protocolo e no `FerramentaDaPonte` do `mesa-core`. O MCP traduz para `readOnlyHint`/`destructiveHint`/`idempotentHint`. Sem o campo, vale o palpite por nome de hoje, corrigido. **Muda o contrato da ponte:** o `mesa-core` vai para o `vendor/` de Mesa, Ateliê, Dossiê e Jukebox (autorizado pelo usuário em 10/11/2026). Só o Atlas e a Mesa declaram nesta etapa; Ateliê, Dossiê e Jukebox continuam no palpite.
- **Orçamento de tempo:** o MCP dá a cada chamada um prazo único de **50 s**, abertura do app incluída. Estourado, devolve um erro que diz que a operação **pode ter acontecido** e manda conferir com a ferramenta de leitura antes de repetir. A resposta que chega depois é descartada. Se o cliente mandou `progressToken`, o MCP envia `notifications/progress` a cada 5 s enquanto espera. `atlas_momento_testar` é a exceção: prazo de 120 s, porque espera o momento terminar.
- **Instruções pelo servidor:** o MCP envia `docs/assistente/instrucoes.md` no campo `instructions` do `initialize`, lido na partida. Colar no projeto do Claude vira opcional (o LEIAME diz isso).
- **Descrições curtas:** cada descrição diz o quê e quando usar, em até ~600 caracteres. Listas longas (receitas, terrenos, efeitos) e explicações de composição saem para `atlas_catalogo` ou para `instrucoes.md`. Nesta etapa, só as ferramentas `atlas_*`.

## Tarefas

### PM1 — Catálogo estável e mensagens certas  ✅
Objetivo: a ferramenta repetida não troca de dono, e os erros falam do atalho do desktop e de token inválido.
Depende de: —
Ler: `scripts/ponte/mcp.ts` (`conectarNaPonte`, `assinaturaDoCatalogo`, `SEM_PONTE`, `textoDoEstado`, `chamarFerramenta`, `listarFerramentas`, `FERRAMENTA_ESTADO`), `scripts/ponte/servidor.ts` (`PREFIXOS`, `appDoPrefixo`, `ligarMcp`), `scripts/ponte/protocolo.ts`, `tests/unit/ponte-mcp.test.ts`, `tests/unit/ponte.test.ts`.
Arquivos: mudar `scripts/ponte/protocolo.ts`, `scripts/ponte/mcp.ts`, `scripts/ponte/servidor.ts`, `tests/unit/ponte-mcp.test.ts`, `tests/unit/ponte.test.ts`.
Como:
- **Prefixos:** mover `PREFIXOS` e `appDoPrefixo` para `protocolo.ts`, acrescentando `campanha_: 'mesa'`. `servidor.ts` importa de lá.
- **Dono estável:** em `conectarNaPonte`, ao incorporar `m.lista`, agrupar por nome. Se um nome vem de mais de um app, escolher `appDoPrefixo(nome)` quando ele está entre os que registram; senão, o app que já estava no catálogo; senão, o primeiro. Só então `catalogo.set`. A remoção de ferramenta sumida continua igual.
- **Token inválido:** guardar `motivo: 'sem-servidor' | 'token-invalido' | null`. O `close` com código 4401 vira `token-invalido`; os outros fechamentos e o erro de conexão viram `sem-servidor`. Expor `motivo()` na `Ponta`. Com token inválido, `textoDoEstado` diz: "A ponte respondeu, mas recusou o token: outro `mesa-dev` ou outro atalho do desktop está rodando, ou o token mudou. Feche as cópias extras e reinicie o app do Claude se persistir."
- **`SEM_PONTE`:** "A ponte não está conectada. Abra a Mesa pelo atalho do app de desktop, ou rode `npm run mesa-dev` no Atlas e abra http://127.0.0.1:5100/."
- **Logs em stderr** (`[mesa-mcp] …`), só quando o estado muda: conectou (com o número de apps), token recusado, caiu.
- **Token:** comparar com `crypto.timingSafeEqual`, conferindo antes o tamanho.
- **Limpeza:**
  - tirar `readOnlyHint` da raiz de `FERRAMENTA_ESTADO` e o `...anotacoes` da raiz em `listarFerramentas` (fica só `annotations`);
  - remover o apelido `ferramentas()` da `Ponta` e os `ponta.x ? … : …` de `chamarFerramenta`, que nunca falham porque os campos são obrigatórios;
  - versão do servidor `0.2.0`.
- **Palpite por nome corrigido**, em `anotacoesDaFerramenta`:
  - `atlas_catalogo` → leitura;
  - `atlas_remover` → `{ destructiveHint: true }`;
  - `atlas_abrir`, `mesa_abrir_apps` e `atlas_momento_testar` → `{ readOnlyHint: false, destructiveHint: false }`.
Não fazer: catálogo base nem anotações declaradas (PM3); prazos (PM2).
Testes:
- Atlas e Mesa registram `campanha_listar` em ordens diferentes: o dono no `tools/list` é sempre `mesa` e não sai `list_changed`.
- Token errado: `ponte_estado` cita o token; sem servidor, cita o atalho do desktop.
- Novos casos em `anotacoesDaFerramenta`.
- Em `ponte.test.ts`, chamar `campanha_ler` sem abas devolve `fechado`.
Pronto quando: abrir e fechar Atlas e Mesa em qualquer ordem não regrava `.ponte/ferramentas.json` nem notifica, e os 55 testes atuais continuam passando.
Commit: stable mcp catalog and clearer bridge errors

### PM2 — Prazo único e progresso  ✅
Objetivo: nenhuma chamada passa do prazo do cliente sem dizer que a escrita pode ter acontecido.
Depende de: PM1
Ler: `scripts/ponte/mcp.ts` (`Ponta.chamar`, `chamarFerramenta`, `criarServidorMcp`), `scripts/ponte/servidor.ts` (`chamar`, `abrirApp`, `TEMPO_DA_CHAMADA_MS`), o tipo `RequestHandlerExtra` em `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts`.
Arquivos: mudar `scripts/ponte/mcp.ts`, `tests/unit/ponte-mcp.test.ts`; `scripts/ponte/servidor.ts` só se precisar descartar o resultado tardio.
Como:
- `export const PRAZO_DA_CHAMADA_MS = 50_000` e `PRAZOS_ESPECIAIS_MS: Record<string, number> = { atlas_momento_testar: 120_000 }`. `McpOpcoes` ganha `prazoMs?` e `intervaloDeProgressoMs?` (padrão 5000), só para testes.
- `Ponta.chamar(ferramenta, args, prazoMs)`: um temporizador por pendente. Estourado, remove o pendente e resolve com o erro abaixo; a resposta que chegar depois é ignorada (`pendentes.get` já não acha).
- Erro do prazo (`isError`): "\"<nome>\" não respondeu em <s> s. A operação pode ter sido feita mesmo assim: confira com a ferramenta de leitura (ex.: atlas_mapa_ler, campanha_ler) antes de repetir." Para ferramentas de leitura (`readOnlyHint`), só "não respondeu em <s> s; tente de novo."
- **Progresso:** no `CallToolRequestSchema`, se `req.params._meta?.progressToken` existe, enviar `notifications/progress` (`{ progressToken, progress: n, message: 'esperando a aba…' }`, com `n` crescente) por `extra.sendNotification` a cada intervalo, e parar quando a chamada resolve.
- O prazo interno da ponte (`TEMPO_DA_CHAMADA_MS`, 60 s) fica como está: o do MCP é o que vale para o Claude.
Não fazer: retentativa automática; deduplicação de escritas pelo lado dos apps.
Testes:
- Uma aba falsa que não responde: o erro chega no prazo de teste, citando "pode ter sido feita"; a resposta tardia não quebra nada.
- Uma aba lenta com `progressToken` (`client.callTool(…, { onprogress })` do SDK): chega ao menos uma notificação.
- Leitura que estoura recebe a mensagem curta.
Pronto quando: uma chamada que exige abrir o app e demora mais de 50 s devolve o erro explicativo em 50 s, em vez de o cliente cortar sem aviso.
Commit: single deadline and progress for bridge calls

### PM3a — Catálogo base versionado  ✅
Objetivo: numa instalação nova o Claude já vê todas as ferramentas, Jukebox incluída, sem abrir cada app antes.
Depende de: PM1
Ler: `scripts/ponte/mcp.ts` (`carregarCache`, `salvarCache`, `conectarNaPonte`), `scripts/ponte/LEIAME.md`, `package.json` (scripts `ponte:*`), `.gitignore`.
Arquivos: criar `scripts/ponte/catalogo.ts` e `scripts/ponte/catalogo-base.json`; mudar `scripts/ponte/mcp.ts`, `package.json`, `scripts/ponte/LEIAME.md`, `tests/unit/ponte-mcp.test.ts`.
Como:
- `McpOpcoes`/`PontaOpcoes` ganham `arquivoDoCatalogoBase?` (padrão `scripts/ponte/catalogo-base.json`). Em `conectarNaPonte`: catálogo = base, depois o cache por cima (mesmo nome: cache vence). A assinatura inicial é a dessa união.
- A remoção de ferramenta sumida vale também para as que vieram da base: quando o app registra sem ela, sai.
- O `salvarCache` continua gravando só `.ponte/ferramentas.json`; a base não é escrita pelo MCP.
- `scripts/ponte/catalogo.ts` (`npm run ponte:catalogo`): lê `.ponte/ferramentas.json` e grava `catalogo-base.json` ordenado por nome, com os campos `nome`, `descricao`, `esquema`, `app` e, depois de PM3b, `anotacoes`, sem `armazenamento`/`onde`. Se faltar algum app conhecido (`atlas`, `mesa`, `ficha`, `atelie`, `jukebox`), avisa em stderr e lista quais faltam.
- Gerar a base com os cinco apps abertos (quem implementa abre a plataforma, roda `ponte_estado` e depois `ponte:catalogo`). Se não der para abrir no ambiente, parar e pedir ao usuário que rode os dois passos.
- LEIAME: seção "Catálogo base": quando regenerar (ferramenta nova ou removida em qualquer app) e o comando.
Não fazer: manifesto escrito à mão; mudar os apps.
Testes:
- Base com `jukebox_listar` e cache vazio: `tools/list` contém a ferramenta sem aba aberta.
- Cache com uma descrição nova vence a base.
- Aba do Atlas registrando sem uma ferramenta da base: ela sai.
- `ponte:catalogo` sobre um cache de teste gera o JSON esperado e avisa do app que falta.
Pronto quando: com `.ponte/` apagado, `tools/list` traz as 4 `jukebox_*` e `mesa_elenco`.
Commit: versioned base catalog for the mcp server

### PM3b — Anotações declaradas pelo app  ✅
Objetivo: cada ferramenta diz se lê, altera ou destrói, em vez de o MCP adivinhar pelo nome.
Depende de: PM3a
Ler: `mesa-core/src/ponte.ts` (`FerramentaDaPonte`, `registrar`), `scripts/ponte/protocolo.ts` (`Ferramenta`, `ferramentaValida`), `scripts/ponte/mcp.ts` (`anotacoesDaFerramenta`, `listarFerramentas`, `assinaturaDoCatalogo`), `src/app/ponte.ts`, `src/app/ponte-leitura.ts`, `src/app/ponte-escrita.ts`, `../Mesa/src/app/ponte.ts`, `../Mesa/src/app/ponte-escrita.ts`, `docs/PLATAFORMA.md` (seção da ponte, se houver).
Arquivos:
- **Atlas:** `mesa-core/src/ponte.ts` e `mesa-core/tests/ponte.test.ts`; `scripts/ponte/protocolo.ts`, `scripts/ponte/mcp.ts`, `scripts/ponte/catalogo.ts`; `src/app/ponte*.ts`; `tests/unit/ponte*.test.ts`.
- **Mesa:** `src/app/ponte*.ts` e os testes.
- **Vendor:** `npm run build:core` e a cópia para o `vendor/` de Mesa, Ateliê, Dossiê e Jukebox.
Como:
- `export interface AnotacoesDaFerramenta { leitura?: boolean; destrutiva?: boolean; idempotente?: boolean }`, nas duas pontas. `FerramentaDaPonte.anotacoes?` e `Ferramenta.anotacoes?`.
- `registrar` passa `anotacoes` quando existe. `ferramentaValida` aceita o campo ausente, ou como objeto com booleanos, e descarta chaves desconhecidas.
- MCP: `anotacoesDaFerramenta(nome, declaradas?)`. Com as declaradas, traduz (`leitura` → `readOnlyHint`, `destrutiva` → `destructiveHint`, `idempotente` → `idempotentHint`); sem elas, cai no palpite da PM1. A assinatura do catálogo inclui `anotacoes`.
- **Declarar no Atlas e na Mesa**, todas as ferramentas deles:
  - leitura: `_ler`, `_listar`, `atlas_catalogo`, `atlas_ver_mapa`, `_o_que_vejo`, `campanha_*`;
  - destrutiva: `atlas_remover` e as que substituem dados (conferir `atlas_terreno` e `mesa_sessao_editar`; na dúvida, `destrutiva: true`);
  - criação: `_criar` com `destrutiva: false`;
  - abrir: `atlas_abrir` e `mesa_abrir_apps` com `destrutiva: false, idempotente: true`.
- Ateliê, Dossiê e Jukebox ficam com o palpite. Não editar o código desses projetos, só copiar o `vendor/`.
- Regenerar `catalogo-base.json` (como na PM3a).
- PLATAFORMA: documentar o campo opcional na seção da ponte (criar a subseção, se não houver).
Não fazer: declarar anotações em Ateliê, Dossiê ou Jukebox; tirar o palpite por nome.
Testes:
- `mesa-core`: `registrar` envia `anotacoes`.
- `protocolo`: aceita, descarta chave estranha, recusa tipo errado (a ferramenta continua válida, sem `anotacoes`).
- MCP: as declaradas vencem o palpite (ex.: `atlas_terreno` declarada destrutiva).
- Atlas e Mesa: toda ferramenta registrada tem `anotacoes`.
Pronto quando: no `tools/list`, todas as ferramentas do Atlas e da Mesa trazem `annotations` vindas da declaração, e os testes de Mesa, Ateliê, Dossiê e Jukebox passam com o `vendor/` novo.
Commit: tools declare their own mcp annotations

### PM4a — Instruções enviadas pelo servidor  ✅
Objetivo: o Claude recebe as instruções da plataforma ao conectar, sem colar nada num projeto.
Depende de: PM1
Ler: `scripts/ponte/mcp.ts` (`criarServidorMcp`, `principal`), `docs/assistente/instrucoes.md`, `docs/assistente/LEIAME.md`, `scripts/ponte/LEIAME.md`.
Arquivos: mudar `scripts/ponte/mcp.ts`, `docs/assistente/LEIAME.md`, `scripts/ponte/LEIAME.md`, `tests/unit/ponte-mcp.test.ts`.
Como:
- `McpOpcoes.instrucoes?: string`, passada ao `new Server(…, { capabilities, instructions })`.
- `principal()` lê `docs/assistente/instrucoes.md` a partir de `raiz`. Se o arquivo não existe, segue sem instruções e avisa em stderr.
- No LEIAME do assistente, o passo "Colar as instruções" vira opcional: o servidor já as envia; o projeto serve para o conhecimento da campanha. Repetir o aviso de reiniciar o app do Claude depois de editar `instrucoes.md`.
Não fazer: reescrever `instrucoes.md` (isso é da PM4b).
Testes: um cliente do SDK conecta e `client.getInstructions()` devolve o texto passado; sem `instrucoes`, `undefined`.
Pronto quando: o teste de fumaça do `scripts/ponte/LEIAME.md` mostra `instructions` na resposta do `initialize`.
Commit: mcp server sends the assistant instructions

### PM4b — Descrições das ferramentas do Atlas mais curtas  ✅
Objetivo: cortar ao menos metade do peso das `atlas_*` no catálogo sem perder o que o Claude precisa para não errar.
Depende de: PM3b, PM4a
Ler: `src/app/ponte-escrita.ts` e `src/app/ponte-leitura.ts` (descrições e `description` dos esquemas), `docs/assistente/instrucoes.md` (§ "Compor um mapa", "Regras que valem ouro", "Momentos"), `scripts/ponte/catalogo-base.json` (para medir).
Arquivos: mudar `src/app/ponte-escrita.ts`, `src/app/ponte-leitura.ts`, `docs/assistente/instrucoes.md`, `scripts/ponte/catalogo-base.json` (regenerado), um teste novo em `tests/unit/ponte-escrita.test.ts`.
Como:
- Medir antes: somar `JSON.stringify` das `atlas_*` na base (hoje ~40 KB) e anotar na Nota da ficha.
- Cada descrição: o quê, quando usar e qual ferramenta de leitura dá os ids, em até ~600 caracteres. As `description` de campo ficam em uma linha.
- **O que sai das descrições:**
  - enumerações longas (ids de receitas, terrenos, gêneros, efeitos) passam a "veja `atlas_catalogo` parte X", desde que o catálogo já tenha essa parte (se não tiver, acrescentar à `atlas_catalogo`);
  - conselhos de composição e ordem vão para `instrucoes.md`, sem duplicar o que já está lá.
- **O que fica:** `enum` e `required` dos esquemas (o validador depende deles), unidades (metros, células de 1,5 m), limites numéricos e avisos que evitam erro de gravação.
- Prioridade: `atlas_momento`, `atlas_terreno`, `atlas_espalhar`, `atlas_presenca`, `atlas_ambiente`, `atlas_comodos`.
- Regenerar a base e medir depois.
Não fazer: mudar comportamento ou esquema das ferramentas; mexer nas descrições de Mesa, Ateliê, Dossiê ou Jukebox.
Testes: um teste que monta as ferramentas do Atlas e confere que nenhuma descrição passa de 800 caracteres e que a soma das `atlas_*` caiu para menos de 20 KB. Os testes atuais de `ponte-escrita` continuam passando.
Pronto quando: as `atlas_*` somam menos de 20 KB na base, e um mapa pequeno composto pelo assistente (cômodos, portas, objetos, um momento) sai sem erros de id inventado. Essa última verificação é manual: anotar na Nota.
Nota: medição antes: 38.625 bytes (~38,6 KB) no total das 22 ferramentas `atlas_*` no catálogo base. Medição depois: 19.823 bytes (corte de ~48,7%, abaixo de 20 KB) com todas as 22 descrições abaixo de 180 caracteres (máximo de 800). Esquemas e validações preservados (required, enum, min/max). Regras de ouro e composição reforçadas em `docs/assistente/instrucoes.md`. Verificação manual realizada com sucesso compondo mapa pequeno com cômodo (`atlas_comodos`), porta (`atlas_portas`), objeto com receita do catálogo (`atlas_objetos`) e momento de abertura (`atlas_momento`).
Commit: shorter atlas tool descriptions

## Etapa 5: ajuda sob demanda (11/11/2026)

**Medição de 11/11:**
- O catálogo base tem 45 KB (~13 mil tokens): Atlas 21,5 KB, Mesa 12,6 KB, Dossiê 5,9 KB, Ateliê 3,7 KB, Jukebox 1,5 KB.
- As instruções têm 16 KB (~4,7 mil tokens).
- Tudo isso vai em toda mensagem de uma conversa com o conector ligado.
- No uso real, o cache tinha 66 KB, porque o `dist-desktop` era anterior ao PM4b e a aba velha registrou as descrições longas por cima da base. Depois de mudar descrições, rodar `npm run desktop:prep` na Mesa.

**Meta:** catálogo abaixo de 25 KB e instruções sempre enviadas abaixo de 6 KB, ou seja, de ~18 mil para menos de ~9 mil tokens fixos.

**Decisão:**
- **Um guia só, servido pelo próprio MCP**, e não pelas abas. Assim funciona com qualquer app fechado e não entra no `list_changed`. O guia é a ferramenta `plataforma_guia { secao?: string }`, que lê arquivos Markdown de `docs/assistente/guia/`.
- **Sem `secao`,** devolve o índice: cada seção com uma linha de resumo, tirada da primeira linha do arquivo.
- **O que vai para o guia:**
  - os detalhes de composição e de fluxo que hoje estão em `instrucoes.md`;
  - a explicação longa das ferramentas que hoje está nas descrições e nos esquemas.
- **O que fica sempre no `instructions`:** um núcleo curto, com papel, regras de ouro, de quem é cada coisa e a regra "consulte o guia antes de usar uma parte que você não conhece". O núcleo cita as seções pelo nome.

### PM5a — Guia sob demanda e instruções em duas camadas  ✅
Objetivo: as instruções enviadas no `initialize` caem para um núcleo de no máximo 6 KB, e o resto vira seções do guia, que o Claude consulta quando precisa.
Ler: `scripts/ponte/mcp.ts` (`criarServidorMcp`, `listarFerramentas`, `chamarFerramenta`, `principal`, o tratamento da `ponte_estado`, que é a única ferramenta local hoje), `scripts/ponte/catalogo.ts`, `docs/assistente/instrucoes.md` (inteiro), `docs/assistente/LEIAME.md`, `tests/unit/ponte-mcp.test.ts`.
Arquivos: criar `docs/assistente/guia/*.md` e `docs/assistente/nucleo.md`; mudar `scripts/ponte/mcp.ts`, os dois LEIAME e os testes. Manter `docs/assistente/instrucoes.md` só como um aviso que aponta para `nucleo.md` e `guia/` (ou removê-lo, atualizando todas as referências; `grep -rn instrucoes.md` no Atlas e na Mesa).
Como:
- **Dividir o `instrucoes.md` atual sem perder conteúdo:**
  - `nucleo.md` (até 6 KB): seu papel; antes de construir (`ponte_estado`, `mesa_o_que_vejo`/`atlas_o_que_vejo`); regras que valem ouro, condensadas; de quem é cada coisa; respeito ao que é do mestre; quando uma ferramenta falha; e a regra do guia: "Antes de compor um mapa, criar um momento, planejar uma sessão ou criar documentos e fichas pela primeira vez na conversa, chame `plataforma_guia` com a seção correspondente." No fim, a lista das seções do guia com uma linha cada.
  - `guia/mapas.md` (compor um mapa: composição, ordem de construção, conferir com os olhos), `guia/momentos.md`, `guia/sessao.md` (planejar uma sessão, passos 1 a 4, abrir apps), `guia/documentos-fichas-trilha.md`, `guia/pedido-curto.md`.
  - Cada arquivo começa com uma linha `> resumo: …` (usada no índice) e depois o texto.
- **`plataforma_guia`** é uma ferramenta local do MCP, como a `ponte_estado`:
  - não passa pela ponte e está sempre no `tools/list`;
  - anotações: `readOnlyHint: true`, `idempotentHint: true`;
  - esquema `{ secao?: string }`, com o `enum` dos nomes de arquivo sem `.md`, gerado da pasta na partida;
  - sem `secao`, devolve o índice; com uma seção inexistente, devolve erro com a lista;
  - a pasta é lida na partida (`McpOpcoes.pastaDoGuia?`, padrão `docs/assistente/guia`) e guardada em memória.
- **`principal()`** passa a enviar `nucleo.md` no `instructions`.
- **Preparar para a PM5b:** a seção de ajuda das ferramentas, `guia/ferramentas-<app>.md`, entra lá. Esta ficha só garante que qualquer arquivo novo na pasta vira seção.
Não fazer: mudar descrições ou esquemas das ferramentas (é a PM5b); mudar a ponte ou os apps.
Testes:
- `tools/list` tem `plataforma_guia`, com o `enum` das seções da pasta de teste;
- sem `secao`, devolve o índice com os resumos; com `secao`, o texto; com uma seção desconhecida, erro com a lista;
- `getInstructions()` devolve o núcleo, com menos de 6 KB no `nucleo.md` real;
- nenhum título de seção do `instrucoes.md` antigo se perde: um teste que lista os títulos `##`/`###` antigos (fixos no teste) e confere que cada um aparece no núcleo ou em algum arquivo do guia.
Pronto quando: o núcleo tem menos de 6 KB e as instruções completas continuam acessíveis pelo guia.
Commit: assistant guide on demand and a short instructions core
Nota: `nucleo.md` tem 3,4 KB (era 16 KB no `instrucoes.md`) e vai no `initialize`. O texto completo foi movido, sem resumir, para `guia/mapas.md` (7,5 KB), `sessao.md` (5,7 KB), `documentos-fichas-trilha.md`, `momentos.md` e `pedido-curto.md`, servidos por `plataforma_guia { secao? }`, ferramenta local do MCP logo depois de `ponte_estado`, com `enum` lido da pasta na partida. `instrucoes.md` virou um aviso que aponta para os dois. Um teste garante que os 19 títulos antigos continuam no núcleo ou no guia. Editou o núcleo ou o guia: reinicie o app do Claude.

### PM5b — Esquemas e descrições enxutos em todos os apps  ✅
Objetivo: o catálogo base fica abaixo de 25 KB, e a explicação longa de cada ferramenta passa para `guia/ferramentas-<app>.md`.
Depende de: PM5a
Ler:
- **Atlas:** `src/app/ponte-escrita.ts`, `src/app/ponte-leitura.ts`.
- **Mesa:** `../Mesa/src/app/ponte-escrita.ts`, `../Mesa/src/app/ponte.ts`.
- **Dossiê:** `../Dossie/src/ponte.js`.
- **Ateliê:** `../Atelie/src/ponte.js`.
- **Jukebox:** `../Jukebox/ponte.js`.
- **Para medir:** `scripts/ponte/catalogo-base.json` e `scripts/ponte/catalogo.ts`.
Arquivos: os de ferramentas acima; criar `docs/assistente/guia/ferramentas-atlas.md`, `-mesa.md`, `-dossie.md`, `-atelie.md` e `-jukebox.md`; regenerar `scripts/ponte/catalogo-base.json`; e um teste de orçamento em `tests/unit/ponte-mcp.test.ts` (sobre a base) mais um por app onde já há testes de ponte.
Como:
- **Medir antes, por app**, somando o `JSON.stringify` de cada ferramenta na base, e anotar na Nota.
- **Descrição:** até ~300 caracteres. Diz o quê, quando usar e de onde vêm os ids, e termina com "Detalhes: plataforma_guia ferramentas-<app>." só quando há detalhe no guia.
- **`description` de campo:** até ~80 caracteres, ou nenhuma quando o nome do campo e o tipo já dizem tudo. Explicações e exemplos vão para o guia.
- **Fica no esquema:** `type`, `enum`, `required`, `minimum`/`maximum`, `additionalProperties`, porque o validador e o modelo dependem deles. **Não mude** nomes, tipos nem comportamento.
- **O guia `ferramentas-<app>.md`:** uma seção `##` por ferramenta, com o texto que saiu (parâmetros explicados, exemplos, armadilhas). Mantenha o português e o tom das instruções.
- **Prioridade pelo peso:** as `atlas_*` (21,5 KB), depois as `mesa_*` (12,6 KB), as `dossie_*` (5,9 KB), as `atelie_*` (3,7 KB) e as `jukebox_*`.
- **Regenerar a base com todos os apps abertos**, a partir dos builds novos. Se o ambiente não permitir abrir a plataforma, pare e peça ao usuário para rodar `npm run desktop:prep` na Mesa, abrir o atalho com os cinco apps e então rodar `npm run ponte:catalogo` no Atlas.
- **Vendor:** os arquivos de ponte dos apps JS não estão no `vendor/`, então só os apps mudam. Depois, rodar `npm run desktop:prep` na Mesa.
Não fazer: mudar esquemas além de encurtar `description`; mudar nomes de ferramenta (isso quebraria as permissões já dadas no app do Claude).
Testes: na base, a soma de todas as ferramentas fica abaixo de 25 KB; nenhuma descrição passa de 400 caracteres; toda descrição que cita `plataforma_guia ferramentas-X` tem o arquivo e uma seção `##` com o nome da ferramenta. Os testes atuais de cada app continuam passando.
Pronto quando: a base está abaixo de 25 KB, e um pedido real (um mapa pequeno com momento, uma ameaça, um documento) sai sem erros de parâmetro. A verificação real é manual: anotar na Nota.
Commit: lean tool schemas with details in the guide
Nota: descrições com até 200 caracteres e campos com até 80, nos cinco apps. O texto que saiu foi movido, literal, para `guia/ferramentas-{atlas,mesa,dossie,atelie,jukebox}.md`, com uma seção por ferramenta. A base caiu de 40.567 para 33.644 bytes: Atlas 18,8→18,1 KB, Mesa 11,3→8,2, Dossiê 5,6→3,9, Ateliê 3,5→2,4, Jukebox 1,4→1,1. **A meta de 25 KB não fecha só com texto:** a estrutura dos esquemas, sem texto nenhum, já soma ~25 KB (só o Atlas tem ~16 KB). O teste de orçamento usa teto de 34.000 bytes; uma ferramenta nova vai exigir subir o teto de propósito. A base foi atualizada por script (os apps não foram abertos), e `mesa_campanha_atual` ficou como estava. O próximo corte possível é enxugar a estrutura dos esquemas do Atlas, numa ficha à parte, porque mudar esquema pode quebrar chamadas. Pendente: `npm run desktop:prep` na Mesa e a verificação manual com um pedido real.
