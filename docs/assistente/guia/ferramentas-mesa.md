> resumo: ajuda completa das ferramentas Mesa (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Mesa

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

## mesa_abrir_apps

Abre outros aplicativos da plataforma em abas novas (pelo manifesto de cada um, ao lado da Mesa). O navegador pode bloquear a aba quando o mestre não clicou; nesse caso a Mesa mostra um aviso com o botão "Abrir" e a resposta diz que ficou pendente do clique do mestre.

## mesa_cena_ler

Lê o que está montado numa cena: mapa, trilha, participantes (personagens e ameaças), pistas, momento de abertura e se é encontro, com os nomes.

Parâmetros:

- `cenaId`: Id da entidade cena.

## mesa_cena_montar

Monta uma cena da campanha (entidade do tipo "cena"): mapa, trilha sonora, participantes, pistas, momento de abertura e marca de encontro. Todos os ids são de ENTIDADES da campanha (campanha_ler lista as entidades; mapas e cômodos do Atlas aparecem como "lugar", cenas sonoras do Jukebox como cena/efeito do Jukebox, fichas como personagem/ameaça, documentos do Ateliê como pista). "mapa" e "trilha" trocam o anterior; participantes e pistas acrescentam. Tudo é conferido antes de gravar. Devolve o pacote resultante com nomes. O ativar da cena (Modo Sessão) usa esse pacote.

Parâmetros:

- `cenaId`: Id da entidade cena.
- `mapa`: Id da entidade lugar (mapa ou cômodo do Atlas).
- `trilha`: Id da entidade da cena sonora/efeito do Jukebox.
- `participantes`: Ids de personagens e ameaças.
- `pistas`: Ids de pistas (documentos do Ateliê).
- `momento`: Nome (ou id) de um momento do mapa da cena, criado no Atlas (atlas_momento). Vira a etiqueta "momento:<texto>"; ao ativar a cena a Mesa pede ao Atlas que toque esse momento NO MAPA vinculado (o Atlas procura por id ou nome, sem diferenciar maiúsculas). Só funciona com mapa vinculado. Texto vazio remove o momento.
- `encontro`: true marca a cena como encontro de combate (etiqueta "encontro"); false desmarca.

## mesa_elenco

Escolhe quem faz parte do elenco recorrente da campanha (os PJs e NPCs que aparecem no painel Personagens do Atlas). Aceita IDs de entidades da Mesa, Refs (ex.: "mesa:ficha/ficha/...") ou nomes de personagens. Se ambos acrescentar e remover forem omitidos, define o elenco vazio []. Devolve o elenco com nomes e quem ficou de fora.

Parâmetros:

- `acrescentar`: IDs de entidades, Refs ou nomes de personagens a incluir no elenco (na ordem informada).
- `remover`: IDs de entidades, Refs ou nomes de personagens a tirar do elenco.

## mesa_entidade_criar

Cria uma entidade na campanha ativa (aparece na coleção da Mesa, sem mudar o que o mestre está vendo). Tipos: personagem, lugar, pista, faccao, sessao, nota, cena, ameaca. As notas aceitam [[Nome]] para citar outra entidade (cria a ligação "menciona"; o nome tem de existir). As entidades da Mesa têm a referência "mesa:mesa/entidade/<id>" (o id vem de mesa_entidade_criar, de campanha_ler (que lista as entidades) ou de campanha_entidade_ler).

Parâmetros:

- `tags`: Etiquetas sem "#" (ex.: ["ferreiro"]). Use "encontro" em cenas de combate.
- `notas`: Texto livre; [[Nome]] liga a outra entidade.

## mesa_entidade_editar

Edita uma entidade criada pela Mesa (nome, tags, notas). As de outros aplicativos (ex.: fichas do Dossiê) são recusadas. "notas" troca o texto; "acrescentarNotas" soma ao fim (se os dois vierem, troca e depois soma). As [[ligações]] das notas são refeitas. Não remove entidades. As entidades da Mesa têm a referência "mesa:mesa/entidade/<id>" (o id vem de mesa_entidade_criar, de campanha_ler (que lista as entidades) ou de campanha_entidade_ler).

Parâmetros:

- `id`: Id da entidade (sem o prefixo "mesa:mesa/entidade/").
- `tags`: Troca todas as etiquetas.
- `notas`: Troca o texto das notas.
- `acrescentarNotas`: Texto somado ao fim das notas.

## mesa_ligar

Liga duas coisas da campanha (ex.: um NPC a um lugar). "de" e "para" são referências: objeto {app, tipo, id} ou texto "mesa:app/tipo/id". As entidades da Mesa têm a referência "mesa:mesa/entidade/<id>" (o id vem de mesa_entidade_criar, de campanha_ler (que lista as entidades) ou de campanha_entidade_ler). Tipos de ligação: aparece-em, esta-em, revela, toca-em, pertence-a, menciona. Ex.: personagem "esta-em" lugar; pista "revela" personagem.

Parâmetros:

- `de`: Referência: objeto {app, tipo, id} ou texto "mesa:app/tipo/id" (ex.: "mesa:atlas/mapa/abc123").
- `para`: Referência: objeto {app, tipo, id} ou texto "mesa:app/tipo/id" (ex.: "mesa:atlas/mapa/abc123").

## mesa_o_que_vejo

O que o mestre tem na tela da Mesa agora: a campanha, a tela atual (coleção, sessão, campanhas, aplicativos) e o item aberto (a entidade selecionada). Use para entender "esta sessão", "este personagem".

## mesa_sessao_criar

Planeja uma sessão da campanha ativa para a próxima mesa. NÃO abre nem começa a gravar o registro; ela aparece no Diário da Mesa. Devolve o id para usar em mesa_sessao_editar.

Parâmetros:

- `nome`: Ex.: "Sessão 12".
- `data`: Data prevista, "AAAA-MM-DD". Omitida, vale hoje.

## mesa_sessao_editar

Edita uma sessão (qualquer uma, aberta ou não): renomeia, monta o roteiro e anota itens. Ordem de aplicação: remover, acrescentar, ordem, notas. O roteiro tem no máximo 64 itens e não repete; o que não coube vem em "ignorados". Nota de item que não está no roteiro é ignorada; texto vazio apaga a nota.

Parâmetros:

- `id`: Id da sessão (de mesa_sessoes_listar ou mesa_sessao_criar).
- `roteiro.acrescentar`: Itens a pôr no fim do roteiro (mapas, cenas sonoras, documentos, fichas).
- `roteiro.acrescentar[]`: Referência: objeto {app, tipo, id} ou texto "mesa:app/tipo/id" (ex.: "mesa:atlas/mapa/abc123").
- `roteiro.remover`: Itens a tirar (a nota deles sai junto).
- `roteiro.remover[]`: Referência: objeto {app, tipo, id} ou texto "mesa:app/tipo/id" (ex.: "mesa:atlas/mapa/abc123").
- `roteiro.ordem`: Nova ordem: estes itens vão para o começo, nesta ordem; os demais ficam depois.
- `roteiro.ordem[]`: Referência: objeto {app, tipo, id} ou texto "mesa:app/tipo/id" (ex.: "mesa:atlas/mapa/abc123").
- `notas[].ref`: Referência: objeto {app, tipo, id} ou texto "mesa:app/tipo/id" (ex.: "mesa:atlas/mapa/abc123").

