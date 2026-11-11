> resumo: ajuda completa das ferramentas Jukebox (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Jukebox

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

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

## jukebox_tocar

Toca uma cena sonora da Jukebox (a trilha de uma cena). Aceita o id, o ref (mesa:jukebox/cena-sonora/<id>) ou o nome, sem diferenciar maiúsculas e acentos. Pedir a cena que já toca não a desliga.

Parâmetros:

- `cena`: Id, ref ou nome da cena sonora.

