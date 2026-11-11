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

Edita um documento existente: renomeia, troca o texto dos campos e/ou o texto UV, e arquiva de novo. Se o documento não foi criado pelo assistente, o mestre precisa confirmar na aba do Ateliê (uma recusa volta como erro; não insista). Textos omitidos não mudam; textoUV vazio remove o texto UV.

Parâmetros:

- `id`: Id do documento (de atelie_documentos_listar).
- `campos`: Texto por campo: { "<rótulo do campo>": "texto" }. Os rótulos vêm de atelie_modelos_listar (ou de atelie_documento_ler).
- `textoUV`: Texto visível só sob a luz UV; "" remove o texto UV.

## atelie_documento_ler

Lê um documento: nome, categoria, tags, os campos com o texto atual, o texto UV (se houver) e a revisão.

## atelie_documentos_listar

Lista os documentos arquivados no Ateliê (mais recentes primeiro): id, nome, categoria, tags, se tem texto UV, revisão e se foi criado pelo assistente.

Parâmetros:

- `busca`: Filtra por nome, categoria ou tag.

## atelie_modelos_listar

Lista os modelos de documento do Ateliê (cartas, bilhetes, jornais…) com id, nome, categoria, época, tom e os CAMPOS que cada um aceita (os rótulos para atelie_documento_criar). No máximo 40 por resposta; "total" diz quantos casaram. Filtre por busca, categoria, era ou tom.

Parâmetros:

- `busca`: Texto livre (nome, categoria, campos, tags, época, tom), sem diferenciar maiúsculas e acentos.
- `era`: Uma de: 1890 (Anos 1890), 1920 (Anos 1920), 1950 (Anos 1950), 1980 (Anos 1980), medieval (Medieval), hoje (Hoje).
- `tom`: Um de: investigação (Investigação), horror (Horror), fantasia (Fantasia), cotidiano (Cotidiano), sci-fi (Ficção científica).

