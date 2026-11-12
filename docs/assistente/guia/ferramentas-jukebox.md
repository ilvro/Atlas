> resumo: ajuda completa das ferramentas Jukebox (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Jukebox

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

## jukebox_cena_criar

Cria uma cena sonora (trilha) na Jukebox com músicas do preset aberto. A cena entra em `jukebox_listar` e toca com `jukebox_tocar`.

Parâmetros:

- `nome`: Nome da cena (1 a 80 caracteres). Cena de mesmo nome (sem diferenciar maiúsculas e acentos) é recusada, salvo `substituir`.
- `faixas`: De 1 a 12 músicas, cada uma `{ titulo, volume? }`. O `titulo` é o de uma música do preset aberto; `volume` vai de 0 a 1 (padrão: o volume atual da faixa). Título inexistente dá erro com a lista das músicas disponíveis.
- `substituir`: Se `true`, troca a cena de mesmo nome, mantendo o id (e o ref).

Sem preset aberto na Jukebox, a ferramenta dá erro: abra o preset primeiro.

Ordem de uso: `jukebox_preset_adicionar` (se a música ainda não está no preset) → `jukebox_cena_criar` → `jukebox_tocar`.

Exemplo de chamada:
```json
{
  "nome": "Pântano à noite",
  "faixas": [
    { "titulo": "Sombras no Lago", "volume": 0.5 },
    { "titulo": "Grilos" }
  ]
}
```

Devolve `{ criada, id, ref, nome, faixas }`; o `ref` é `mesa:jukebox/cena-sonora/<id>`.

## jukebox_efeito

Dispara um efeito sonoro avulso da Jukebox, por cima da música. Aceita o slug, o ref (mesa:jukebox/efeito/<slug>) ou o título, sem diferenciar maiúsculas e acentos. Pedido de novo, recomeça.

Parâmetros:

- `efeito`: Slug, ref ou título do efeito.

## jukebox_listar

Lista as cenas sonoras (trilhas) e os efeitos avulsos carregados na Jukebox, com o ref de cada um e qual cena está tocando.

## jukebox_parar

Para tudo o que toca na Jukebox (cena e efeitos) com um fade out. Padrão: 1000 ms.

Parâmetros:

- `ms`: Duração do fade out em milissegundos (padrão 1000).

## jukebox_preset_adicionar

Adiciona uma música MP3 a uma pasta de preset da Jukebox no disco. Se a pasta do preset já estiver aberta na Jukebox, a música é enviada na hora para o player.

Parâmetros:

- `pasta`: Caminho absoluto ou com `~` da pasta do preset no disco.
- `arquivo`: Caminho absoluto ou com `~` do arquivo MP3 no disco (até 200 MB; arquivo MP3 válido com ID3 ou sincronia de quadro).
- `titulo`: Título legível da música (1 a 120 caracteres).
- `generos`: Lista opcional com gêneros válidos: `fun`, `hopeful`, `mystery`, `suspense`, `horror`, `sfx` (`sfx` vira efeito avulso na mesa).
- `tags`: Lista opcional com tags válidas: `ambient`, `investigation`, `event`, `battle`, `emotional`.
- `grupo`: Nome opcional de subpasta/grupo organizador no preset.
- `capa`: Caminho opcional para imagem JPEG da capa. Se omitido, usa a capa padrão da Jukebox.
- `criar`: Se `true`, cria a pasta e o preset se a pasta estiver vazia.
- `substituir`: Se `true`, sobrescreve áudio/capa de música de mesmo título mantendo marcadores e atalhos.

Regras e boas práticas:
- Sempre execute `jukebox_preset_ler` antes de adicionar, para conferir o que já existe no preset e evitar duplicatas acidentais.
- Para anexos do chat: use o caminho em disco onde o cliente salvou o arquivo. Se não houver caminho local disponível, peça ao mestre para salvar o arquivo de áudio no computador e indicar onde ficou salvo.

Exemplo de chamada:
```json
{
  "pasta": "~/Música/Pântano",
  "arquivo": "~/Downloads/sombras-no-lago.mp3",
  "titulo": "Sombras no Lago",
  "generos": ["horror"],
  "tags": ["ambient"]
}
```

## jukebox_preset_ler

Lê todas as músicas e metadados de uma pasta de preset da Jukebox no disco. Devolve a lista de músicas com título legível, `currentTitle`, gêneros, tags, grupo e se possui arquivo de áudio e capa.

Parâmetros:

- `pasta`: Caminho absoluto ou com `~` da pasta do preset no disco.

Exemplo de chamada:
```json
{
  "pasta": "~/Música/Pântano"
}
```

## jukebox_tocar

Toca uma cena sonora da Jukebox (a trilha de uma cena). Aceita o id, o ref (mesa:jukebox/cena-sonora/<id>) ou o nome, sem diferenciar maiúsculas e acentos. Pedir a cena que já toca não a desliga.

Parâmetros:

- `cena`: Id, ref ou nome da cena sonora.

