> resumo: ajuda completa das ferramentas Ateliê (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Ateliê

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

## atelie_documento_criar

Cria um documento (pista) a partir de um modelo do Ateliê: preenche os campos, acrescenta um texto que só aparece sob a luz UV (textoUV), arquiva (publica para o Atlas e o Tabletop) e registra a pista na campanha ativa da Mesa. O documento abre numa aba do Ateliê. Use atelie_modelos_listar para achar o modelo e os rótulos dos campos; campos que o modelo não tem voltam em "ignorados".

Parâmetros:

- `modelo`: Id do modelo (de atelie_modelos_listar).
- `nome`: Nome do documento, ex.: "Carta do informante".
- `campos`: Texto por campo: { "<rótulo do campo>": "texto" }. Os rótulos vêm de atelie_modelos_listar (ou de atelie_documento_ler).
- `textoUV`: Texto escondido, visível só sob a luz UV (o segredo do documento).

## atelie_documento_editar

Edita um documento existente: renomeia, troca o texto dos campos e/ou o texto UV, e arquiva de novo. Textos omitidos não mudam; textoUV vazio remove o texto UV.

Parâmetros:

- `id`: Id do documento (de atelie_documentos_listar).
- `campos`: Texto por campo: { "<rótulo do campo>": "texto" }. Os rótulos vêm de atelie_modelos_listar (ou de atelie_documento_ler).
- `textoUV`: Texto visível só sob a luz UV; "" remove o texto UV.

## atelie_documento_ler

Lê um documento: nome, categoria, tags, os campos com o texto atual, os campos de imagem (`camposDeImagem`: `{ rotulo, layerId, temImagem }`), o texto UV (se houver) e a revisão.

## atelie_documentos_listar

Lista os documentos arquivados no Ateliê (mais recentes primeiro): id, nome, categoria, tags, se tem texto UV, revisão e se foi criado pelo assistente.

Parâmetros:

- `busca`: Filtra por nome, categoria ou tag.

## atelie_imagem_definir

Define a imagem de um campo de imagem (por exemplo "Ilustração" ou "Mapa") de um documento do Ateliê, a partir de um arquivo no disco, e arquiva o documento. A imagem nunca passa pelo contexto: a ferramenta lê o arquivo e o envia ao Ateliê.

Parâmetros:

- `id`: Id do documento (de `atelie_documentos_listar` ou `atelie_documento_criar`).
- `campo`: Rótulo do campo de imagem (sem diferenciar maiúsculas e acentos) ou `layerId`. Os campos de imagem vêm em `camposDeImagem` de `atelie_documento_ler`; campo inexistente dá erro com a lista.
- `arquivo`: Caminho absoluto ou com `~` de um PNG, JPEG ou WebP de até 15 MB (o formato é conferido pelos bytes, não pela extensão).

Como usar: passe o caminho de um arquivo que já está no disco, ou o de um anexo que o cliente salvou. Se não houver imagem (nem caminho local), deixe o campo vazio, termine o documento só com os textos e diga ao mestre que a imagem falta e em que campo.

O Ateliê precisa estar aberto e conectado; se não estiver, abra-o pela Mesa com `mesa_abrir_apps`.

Devolve `{ definido, campo, id, revisao }`.

Exemplo de chamada:
```json
{ "id": "3f1c0b2e-0000-4000-8000-000000000000", "campo": "Ilustração", "arquivo": "~/Downloads/retrato.png" }
```

## atelie_modelos_listar

Lista os modelos de documento do Ateliê (cartas, bilhetes, jornais…) com id, nome, categoria, época, tom e os CAMPOS que cada um aceita (os rótulos para atelie_documento_criar). No máximo 40 por resposta; "total" diz quantos casaram. Filtre por busca, categoria, era ou tom.

Parâmetros:

- `busca`: Texto livre (nome, categoria, campos, tags, época, tom), sem diferenciar maiúsculas e acentos.
- `era`: Uma de: 1890 (Anos 1890), 1920 (Anos 1920), 1950 (Anos 1950), 1980 (Anos 1980), medieval (Medieval), hoje (Hoje).
- `tom`: Um de: investigação (Investigação), horror (Horror), fantasia (Fantasia), cotidiano (Cotidiano), sci-fi (Ficção científica).

