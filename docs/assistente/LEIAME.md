# Assistente da plataforma

Em desenvolvimento, o app de desktop do Claude pode operar a plataforma: ler a campanha, ver o mapa aberto, construir mapas e momentos no Atlas e preparar sessões na Mesa (entidades, cenas, roteiro), criar documentos no Ateliê, fichas e ameaças no Dossiê e tocar cenas sonoras na Jukebox. A conversa fica no app do Claude; o Atlas e a Mesa mostram o trabalho (selo "Assistente" e painel de atividade). Nada disso existe no build de produção.

A ponte de cada app só carrega em desenvolvimento: Atlas, Mesa, Ateliê e Dossiê com `import.meta.env.DEV`; a Jukebox, que não tem build, só quando a página roda em `127.0.0.1` ou `localhost`. O `npm run ponte:verificar` constrói Atlas, Mesa, Ateliê e Dossiê (caminhos por `--mesa`, `--atelie`, `--dossie` ou `MESA_DIR`, `ATELIE_DIR`, `DOSSIE_DIR`) e **não cobre a Jukebox**: lá, a regra do hostname é a trava.

## Passo a passo

1. **Registrar o servidor MCP `mesa`** no app do Claude: siga [`scripts/ponte/LEIAME.md`](../../scripts/ponte/LEIAME.md).
2. **Subir a plataforma.** Com o atalho do app de desktop aberto (sem o `mesa-dev`), a ponte já funciona: o atalho hospeda a ponte na porta 5100 e o app se identifica ao MCP como "app da Mesa". Para desenvolver, o `mesa-dev` continua valendo (`npm run mesa-dev`, no Atlas): se ele estiver rodando, o atalho só abre a janela e a ponte é a dele.
3. **Abrir a plataforma** no app de desktop ou em http://127.0.0.1:5100/ (Atlas ou Mesa). O selo "Assistente" no cabeçalho indica a conexão; `ponte_estado` confirma pelo lado do Claude.
   Depois de alterar o código da ponte, **reinicie o app do Claude** (o servidor MCP é um processo de longa vida e não recarrega sozinho) e rode `npm run desktop:prep` na Mesa para refazer o `dist-desktop`.
4. **Instruções em duas camadas (nada a colar):** o servidor MCP `mesa` envia [`nucleo.md`](nucleo.md) (até 6 KB) ao conectar e serve o resto sob demanda pela ferramenta `plataforma_guia`, que lê as seções de [`guia/`](guia/). Depois de editar o núcleo ou o guia, **reinicie o app do Claude** para o servidor reler os arquivos. Um projeto no app do Claude serve só para o conhecimento da campanha.
5. **Modelo:** use o Opus para o trabalho criativo (compor mapas e momentos).

## Conteúdo

- [`nucleo.md`](nucleo.md): o que vai sempre nas instruções: papel, o que ler antes de construir, regras de ouro condensadas, de quem é cada coisa, respeito ao que é do mestre e a regra de consultar o guia.
- [`guia/`](guia/): seções lidas sob demanda por `plataforma_guia` (qualquer `.md` novo na pasta vira seção; a primeira linha é `> resumo: …`):
  - `mapas`: o que ler antes, como compor um mapa em blocos conferidos com `atlas_ver_mapa`, as regras aprendidas na Fase 10 e o respeito ao que é do mestre.
  - `momentos`: criar e testar momentos.
  - `sessao`: planejar uma sessão (ler a campanha e a última sessão, plano aprovado, entidades, mapas e momentos, cenas, sessão com roteiro e notas, resumo), `mesa_abrir_apps`, falhas e regra de dono.
  - `documentos-fichas-trilha`: `atelie_*`, `dossie_*` (ameaças pelo VD) e `jukebox_*`, com os apps abertos.
  - `pedido-curto`: o ritmo de um pedido curto, em blocos.
- [`instrucoes.md`](instrucoes.md): aviso curto que aponta para o núcleo e o guia (o texto antigo foi dividido entre eles).
