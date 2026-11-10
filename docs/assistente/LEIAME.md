# Assistente do Atlas e da Mesa

Em desenvolvimento, o app de desktop do Claude pode operar a plataforma: ler a campanha, ver o mapa aberto, construir mapas e momentos no Atlas e preparar sessões na Mesa (entidades, cenas, roteiro). A conversa fica no app do Claude; o Atlas e a Mesa mostram o trabalho (selo "Assistente" e painel de atividade). Nada disso existe no build de produção.

## Passo a passo

1. **Registrar o servidor MCP `mesa`** no app do Claude: siga [`scripts/ponte/LEIAME.md`](../../scripts/ponte/LEIAME.md).
2. **Subir o `mesa-dev`**, no Atlas: `npm run mesa-dev`.
3. **Abrir a plataforma** em http://127.0.0.1:5100/ (Atlas ou Mesa). O selo "Assistente" no cabeçalho indica a conexão; `ponte_estado` confirma pelo lado do Claude.
4. **Colar as instruções:** crie um projeto no app do Claude e cole o conteúdo de [`instrucoes.md`](instrucoes.md) no campo de instruções dele. As notas da campanha podem ir no conhecimento do projeto.
5. **Modelo:** use o Opus para o trabalho criativo (compor mapas e momentos).

## Conteúdo

- [`instrucoes.md`](instrucoes.md): papel do assistente, o que ler antes de construir, como compor um mapa em blocos conferidos com `atlas_ver_mapa`, as regras aprendidas na Fase 10, momentos e o respeito ao que é do mestre. Genérico para qualquer campanha. Inclui o fluxo de planejar uma sessão (ler a campanha e a última sessão, combinar o plano com o mestre, registrar entidades, criar mapas e momentos, montar cenas e criar a sessão com roteiro e notas, terminando com um resumo), com `mesa_abrir_apps` e a regra de dono.
