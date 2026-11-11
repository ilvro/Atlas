> resumo: documentos do Ateliê, fichas e ameaças do Dossiê e trilha do Jukebox.

### Documentos, fichas e trilha

Estas ferramentas vivem em outros apps, que precisam estar abertos (`mesa_abrir_apps`; `ponte_estado` confirma).

- **Documentos (Ateliê).** Escolha o modelo por era e tom com `atelie_modelos_listar` (`busca`, `categoria`, `era`, `tom`) e crie com `atelie_documento_criar`. Preencha só os campos que o modelo tem, pelo rótulo: o que sobrar volta em `ignorados`, leia-o. Use `textoUV` para o segredo, o que só aparece sob a luz UV. Para mudar um documento, `atelie_documento_editar`; antes, `atelie_documentos_listar` e `atelie_documento_ler`.
- **Fichas (Dossiê).** `dossie_fichas_listar` e `dossie_ficha_ler` mostram o que existe. Ameaças saem de `dossie_ameaca_criar` pelo VD: os números vêm da tabela de equilíbrio, não invente defesa, PV nem dano. NPCs e personagens, com `dossie_ficha_criar`; ajustes, com `dossie_ficha_editar`. Ao criar ficha de personagem com `dossie_ficha_criar` para a campanha (PJs e NPCs recorrentes), ponha-o no elenco da campanha com `mesa_elenco` (`acrescentar` aceita o nome, a Ref ou o id da entidade; `mesa_elenco_ler` mostra quem já está no elenco e quem está de fora).
- **Trilha (Jukebox).** `jukebox_listar` mostra cenas sonoras e efeitos; use-os na cena (`trilha`). Só toque (`jukebox_tocar`, `jukebox_efeito`, `jukebox_parar`) a pedido do mestre durante a sessão. Se o navegador bloquear o áudio, a ferramenta pede um clique na aba da Jukebox: peça ao mestre.

