# Assistente da plataforma

Em desenvolvimento, o app de desktop do Claude pode operar a plataforma: ler a campanha, ver o mapa aberto, construir mapas e momentos no Atlas e preparar sessões na Mesa (entidades, cenas, roteiro), criar documentos no Ateliê, fichas e ameaças no Dossiê e tocar cenas sonoras na Jukebox. A conversa fica no app do Claude; o Atlas e a Mesa mostram o trabalho (selo "Assistente" e painel de atividade). Nada disso existe no build de produção.

A ponte de cada app só carrega em desenvolvimento: Atlas, Mesa, Ateliê e Dossiê com `import.meta.env.DEV`; a Jukebox, que não tem build, só quando a página roda em `127.0.0.1` ou `localhost`. O `npm run ponte:verificar` constrói Atlas, Mesa, Ateliê e Dossiê (caminhos por `--mesa`, `--atelie`, `--dossie` ou `MESA_DIR`, `ATELIE_DIR`, `DOSSIE_DIR`) e **não cobre a Jukebox**: lá, a regra do hostname é a trava.

## Passo a passo

1. **Registrar o servidor MCP `mesa`** no app do Claude: siga [`scripts/ponte/LEIAME.md`](../../scripts/ponte/LEIAME.md).
2. **Subir o `mesa-dev`**, no Atlas: `npm run mesa-dev`.
3. **Abrir a plataforma** em http://127.0.0.1:5100/ (Atlas ou Mesa). O selo "Assistente" no cabeçalho indica a conexão; `ponte_estado` confirma pelo lado do Claude.
4. **Colar as instruções:** crie um projeto no app do Claude e cole o conteúdo de [`instrucoes.md`](instrucoes.md) no campo de instruções dele. As notas da campanha podem ir no conhecimento do projeto.
5. **Modelo:** use o Opus para o trabalho criativo (compor mapas e momentos).

## Conteúdo

- [`instrucoes.md`](instrucoes.md): papel do assistente, o que ler antes de construir, como compor um mapa em blocos conferidos com `atlas_ver_mapa`, as regras aprendidas na Fase 10, momentos e o respeito ao que é do mestre. Genérico para qualquer campanha. Inclui o fluxo de planejar uma sessão (ler a campanha e a última sessão, combinar o plano com o mestre, registrar entidades, criar mapas e momentos, montar cenas e criar a sessão com roteiro e notas, terminando com um resumo), com `mesa_abrir_apps` e a regra de dono. Documentos, fichas e trilha: `atelie_*` (modelos, documentos), `dossie_*` (fichas e ameaças pelo VD) e `jukebox_*` (listar, tocar, efeito, parar), com os apps abertos.
