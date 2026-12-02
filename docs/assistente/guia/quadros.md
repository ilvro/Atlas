> resumo: transcrever material (legenda, imagens do PDF e extras, cartões e linhas); ler os quadros da Mesa do jeito barato (mapa, busca, seção em títulos, completa, imagem só se precisar); gravar resumos e descrições de imagem; citar itens pelo id curto; o vocabulário do mestre; montar ou continuar material no estilo dele (quadro_estilo, quadro_inserir, conferir com quadro_ver_regiao) e propor ideias soltas (quadro_propor).

# Ler os quadros da Mesa

Os quadros do mestre são enormes (dezenas de milhares de tokens). Nunca leia tudo: leia em camadas, do barato ao caro, e pare quando já souber o bastante. As ferramentas `quadros_listar`, `quadro_mapa`, `quadro_secao`, `quadro_buscar`, `quadro_imagem`, `quadro_estilo` e `quadro_ver_regiao` (leitura), `quadro_resumir` e `quadro_descrever_imagem` (notas sobre o quadro), `quadro_inserir` e `quadro_propor` (itens novos, para revisão) são sob demanda: carregue-as com `plataforma_ferramentas`. Só `quadro_inserir` e `quadro_propor` acrescentam itens ao quadro, sempre marcados para revisão.

## A ordem

1. **`quadros_listar`**: os quadros da campanha, com seções, itens e tokens estimados. Escolha o quadro (por nome ou id).
2. **`quadro_mapa`**: uma linha por seção (id, título, itens por tipo, tokens, vizinhas e setas entre seções), mais os resumos já gravados. Custa poucas centenas a 6 mil tokens. **Leia sempre antes de abrir uma seção.** A posição importa: "ao lado de", "acima de" e as setas dizem o que o mestre entende como parte do mesmo assunto.
3. **`quadro_buscar`**: se a pergunta cita um nome, lugar ou objeto, busque o termo (sem acento nem caixa; até 20 ocorrências, com a seção e o id curto). Sem `quadro`, busca em todos. Muitas vezes isso responde sem abrir seção nenhuma.
4. **`quadro_secao` com `nivel: "titulos"`** (padrão): só a primeira linha de cada item. Serve para saber o que há na seção e decidir se vale ler mais.
5. **`quadro_secao` com `nivel: "completo"`**: o texto inteiro, em páginas de cerca de 2,5 mil tokens (`pagina: 2`, 3…). Peça só das seções que importam e só as páginas que precisar.
6. **`quadro_secao` com `nivel: "estrutura"`**: o *visual* de cada item (formato, posição relativa à seção, fonte, tamanho, cores, destaques por trecho) e os blocos internos (`▸ bloco "COMBATE"`). Use quando for escrever no quadro, não para ler o conteúdo.
7. **`quadro_imagem`**: por último, e só se o texto não bastar. Handouts são texto dentro de imagem e só se leem assim, mas cada imagem custa bem mais que uma seção de texto. Use `lado` pequeno (o padrão, 768 px, serve para quase tudo; 1568 só para letras miúdas).

## Regras de custo

- **Não peça todas as imagens** de uma seção. Escolha pela legenda (`[imagem #id: legenda, LxA]`) e pelo que a pergunta exige; diga ao mestre quais deixou de ver, se importar.
- **Não abra seções "por garantia"**. Se o mapa e a busca bastam, responda com eles.
- Uma seção tem `(item longo)` quando um item sozinho passa do limite da página; não é erro.
- A seção de uma moldura lista as molduras filhas como `§ título (seção id, N itens)`: abra a filha pelo id, se precisar.

## Citar itens

Cada linha da seção começa com `#id` (os 6 primeiros caracteres do id do item, mais longo se houver colisão). Cite assim ao mestre ("na nota #a3f9c1 da seção \"Capítulo 2\""), e use o mesmo `#id` em `quadro_imagem(item)`. Cite também a seção pelo título, para o mestre achar no quadro.

## Resumos e descrições

Depois de ler uma seção a fundo, grave um resumo de duas ou três linhas (até 400 caracteres) com `quadro_resumir(quadro, secao, texto)`: o que há ali e para que serve na campanha, não a lista dos itens. Para as imagens importantes que você viu com `quadro_imagem` (handouts, mapas, retratos), grave uma descrição (até 600 caracteres) com `quadro_descrever_imagem(quadro, item, texto)`; dali em diante ela aparece no lugar da legenda, e ninguém precisa ver a imagem de novo. As duas ferramentas são de escrita (não destrutivas) e não mudam o quadro, só as notas sobre ele.

Assim a próxima conversa já começa com os resumos no mapa e lê menos. Regras:

- Resuma só o que leu de verdade; não resuma pelo título.
- Um resumo marcado `(resumo desatualizado)` ficou para trás do quadro: releia a seção e grave um novo.
- Um resumo marcado `(escrito pelo mestre: não troque sem pedir)` é do mestre: a ferramenta recusa sobrescrever, e você não deve pedir para trocar sem motivo.
- O mestre vê e corrige os resumos no navegador de molduras do quadro.

## O vocabulário do mestre

- **Marcadores** entre colchetes no texto, preservados como estão: `[PERCEPÇÃO 13]` e outros testes (perícias + dificuldade), `[LOOT …]`, `[EVENTO]`, `[TAREFA]`, `[REVER]`, `[MÚSICA nome]`, `[DATA …]`, `[SEGREDO]`, falas como `[SINDRE]` ou `[KARL PARA OLE]` (nome em maiúsculas, sem número) e rótulos como `[DESAFIO DE ACESSO - CADEADO]`. Um sufixo `se:poeira` (condição sobre os fatos do mundo) fica dentro do marcador. `(segredo)` na linha vem do marcador `[SEGREDO]`.
- **Tipos semânticos** de cada item, na linha como `[tipo]`: `leitura` (texto lido aos jogadores), `teste`, `segredo`, `loot`, `evento`, `fala`, `tarefa`, `rever` e `titulo`. Nas contagens do mapa aparecem por tipo.
- **`(só mestre)`**: o jogador não vê. Você fala com o mestre, então pode ler e usar, mas lembre disso ao sugerir algo que os jogadores vão receber.
- **`✓`** marca o que o mestre já fez em jogo.
- **`[[Nome]]`** é uma ligação com uma entidade da campanha (personagem, lugar, pista…). Para saber mais, procure a entidade com `campanha_ler` / `campanha_entidade_ler`; cartões de entidade aparecem como `[entidade: Nome (tipo)]`.
- **Setas** aparecem no fim da seção: `"começo" #id → "começo" #id: rótulo`. Elas costumam ser ordem, causa ou consequência.
- **Ilhas e "Soltos"**: o que não está numa moldura é agrupado por proximidade; o título é detectado (fonte maior, cabeçalho). Se o título da ilha parecer errado, diga ao mestre em vez de supor.

## Montar, transcrever ou continuar material

Quando o mestre pede para **montar** algo no quadro (uma missão, uma cena, a transcrição de um PDF) ou **continuar** o que ele começou, o resultado tem que parecer escrito por ele. Não é uma lista de ideias soltas.

1. **Leia o estilo antes de escrever.** `quadro_estilo(quadro, secao?)` resume como o mestre escreve: estilos de título e de corpo, cores de destaque (com um palpite de uso, como narração, regra ou fala), fluxo (coluna, espaço entre itens), de que lado ficam as imagens e se ele usa tipos. Cada estilo vem com um `#id` de exemplo. Depois, `quadro_secao` com `nivel: "estrutura"` da seção-alvo mostra os blocos e onde continuar. Se precisar, use `quadro_ver_regiao(quadro, secao)` para ver a seção como o mestre a vê.
2. **Imite o formato e o fluxo** com `quadro_inserir(quadro, itens, abaixo_de | ao_lado_de, abrir_espaco?, setas?)`:
   - `formato: "titulo"` e `formato: "texto"` saem no estilo detectado de título e de corpo. `estilo_como: "#id"` copia o estilo de um item específico do mestre.
   - Texto com destaques: `paragrafos: [{ texto, como: "#id" }]`, em que cada parágrafo copia o destaque predominante do item indicado (a narração com o fundo amarelo dele, a regra com o fundo escuro…). Use os `#id` de exemplo do `quadro_estilo`.
   - `abaixo_de: "#id"` continua a coluna no fim do bloco daquele título (ou logo abaixo do item). `abaixo_de: <seção>` continua no fim da coluna. Se o bloco seguinte estiver no caminho, a ferramenta recusa e diz o que bloqueia: só use `abrir_espaco: true` (a coluna e as imagens ao lado descem) se o mestre pediu para inserir no meio. `ao_lado_de: <seção>` abre uma coluna nova.
   - Imagens que já estão na campanha: `formato: "imagem"` com `de: "#id"`; `lado: "direita"` a põe ao lado do texto anterior, como o mestre faz.
   - `setas: [{ de, para, rotulo? }]` liga itens novos (pelo índice) ou existentes (`#id`).
   - `tipo` (leitura, segredo…) grava só a semântica, para o modo sessão, e não muda a cor quando há estilo.
3. **Se o estilo não puder ser reproduzido**, por exemplo porque o mestre usa algo que `quadro_inserir` não cria, **avise o mestre e pergunte antes** de criar qualquer coisa. Não troque o estilo dele pelo seu em silêncio.
4. **Confira ao terminar.** A resposta traz os `criados`. Chame `quadro_ver_regiao(quadro, itens: criados)` (ou a seção inteira) e compare com a parte do mestre: fonte, destaques, largura, espaço e alinhamento. Corrija antes de responder, ou diga o que ficou diferente.

Se `quadro_estilo` diz que o mestre **não usa post-its tipados**, não use `quadro_propor` nem cores por tipo para material: o vocabulário de cores (leitura amarela, segredo rosa…) é da Mesa, não dele.

Tudo entra na fila de revisão ("Do assistente"), sem moldura, com um contorno tracejado e uma estrela até o mestre aceitar. No quadro aberto, um Ctrl+Z desfaz a inserção inteira, inclusive o que desceu com `abrir_espaco`.

## Transcrever um material (PDF, extras)

Quando o mestre pede para pôr no quadro uma missão pronta, um capítulo ou um suplemento, a fonte tem estrutura e imagens. Elas entram também, não só o texto.

1. **Leia a legenda.** O `quadro_estilo` mostra a legenda do mestre, que é fixa na Mesa (o quadro pode sobrescrever com uma seção "LEGENDA"). Cada papel (`ponto`, `narracao`, `teste`, `loot`, `segredo`, `evento`, `transicao`, `gancho`, `condicao`, `fala`) tem cor e negrito próprios. Escreva por papel, não por cópia de item. O negrito da legenda vai só nos rótulos `[…]`; narração e regra corridas levam só o destaque. Num quadro novo, sem texto do mestre para copiar (só o título, por exemplo), `quadro_inserir` já escreve no estilo fixo do mestre, o do Pântano: não peça itens de exemplo.
2. **Procure as imagens antes de escrever.** `arquivo_imagens(caminho)` lista as imagens de um PDF por página (sem os fundos repetidos) e de uma pasta, por exemplo a de extras ao lado do PDF, com handouts, tokens e mapas. `arquivo_imagens(caminho, ver: id)` mostra a miniatura de uma delas. Para uma ficha ou tabela que não é imagem no PDF, recorte a página: `pdf:<caminho>#p=<página>&recorte=x,y,l,a` (frações da página).
3. **Mapeie a estrutura da fonte para a do mestre:**
   - Caixa de narração vira texto com `papel: "narracao"`.
   - Tabela de perícias vira uma linha por teste, com `trechos: [{ papel: "teste", texto: "[PERCEPÇÃO] [6]" }, { texto: " o que se descobre" }]`. Não enfie os testes dentro do texto de regra.
   - Itens e loot recebem `papel: "loot"`; o que é só do mestre, `segredo`; condições `[SE …]`, `condicao`; falas `[NOME] "…"`, `fala`.
   - Ponto de interesse vira um **cartão** dentro de uma `grade`: o handout ou o recorte em cima, `{ formato: "rotulo", papel: "ponto", texto: "[ARBUSTO]" }`, a narração curta e os testes. Se a fonte tem um mapa numerado, ponha o mapa e a grade de cartões logo abaixo, na ordem dos números.
   - Boxes paralelos (regras da perseguição, fôlego, ações) vão numa `linha`, e não um embaixo do outro.
   - Criatura ou NPC vira a ficha (imagem ou recorte da página) com `lado: "direita"` ao lado do bloco em que ela entra, como o mestre fez com a ficha do afogado.
   - Tabela-resumo de rodadas vira uma linha de texto por rodada ou uma `grade` de duas colunas.
   - A arte de página pode servir de referência visual da cena, ao lado do título dela.
4. **Antes de inserir, liste ao mestre o que não dá para reproduzir** (uma tabela complexa, uma imagem que não está no PDF nem nos extras) **e pergunte.** Não troque por texto em silêncio.
5. **O princípio do layout: sequência na vertical, mesma área na horizontal.** O que acontece em ordem (cenas, fases, rodadas, "depois disso") desce na coluna. O que existe ao mesmo tempo, no mesmo lugar ou como alternativa (pontos de interesse de uma sala, boxes de regras da mesma fase, finais bom e ruim, duas narrações da mesma cena) fica lado a lado, em `linha` ou `grade`. Uma missão transcrita só na vertical está errada.
6. **Erros que o mestre já apontou (não repita):**
   - Tudo numa tira vertical de texto (veja o item 5).
   - Testes sem cor, enfiados no meio das regras: cada teste é um trecho `papel: "teste"` (`[PERÍCIA] [DT]`) seguido do resultado.
   - Nenhuma imagem: mapa, arte das páginas, handouts dos extras e a ficha da criatura (recorte) sempre entram.
   - Pontos de interesse como texto corrido: são cartões numa `grade`, abaixo do mapa numerado.
   - Ficha da criatura de fora: vai ao lado do bloco em que ela entra.
7. **Detalhes que o motor cobra:**
   - Imagem com `lado` ao lado de um texto curto bate no que vem logo abaixo, e a ferramenta recusa: ponha o texto e a imagem numa `linha` própria.
   - Narração lida aos jogadores usa o destaque de narração; o resultado de um teste também (é o que os jogadores ouvem). Regra e instrução ao mestre, o fundo escuro.
   - Transições (`[AVANCE PARA …]`) com `papel: "transicao"`; rodadas e gatilhos de tempo com `papel: "evento"`.
8. **Insira cena por cena e confira cada uma** com `quadro_ver_regiao(itens: criados)` antes de seguir para a próxima. Corrija o que destoar da parte do mestre (largura, espaço, alinhamento, cor).

## Propor ideias no quadro

Quando o mestre pedir **ideias soltas** para avaliar ("me dê ganchos para…", "sugira testes para esta cena"), e não material montado, use `quadro_propor(quadro, titulo, notas, perto?)`: ela cria uma moldura "✦ título" no primeiro espaço livre ao lado da seção `perto` (ou à direita de tudo), com até 30 notas `{ texto, tipo? }`. O `tipo` é um dos tipos semânticos (`leitura`, `teste`, `segredo`, `loot`, `evento`, `fala`, `tarefa`, `rever`, `titulo`) e dá a cor da nota. Escreva no vocabulário do mestre: marcadores como `[PERCEPÇÃO 13]` e `[[Nome]]` para entidades.

Tudo entra marcado para revisão, no grupo "Do assistente" da fila: o mestre aceita, edita ou descarta. No quadro aberto, um Ctrl+Z desfaz a proposta inteira; num quadro fechado, ela é gravada direto e se desfaz pela fila ("Descartar todas"). Prefira uma proposta por pedido, com notas curtas, a várias molduras soltas.

## Respeito ao que é do mestre

O quadro é material do mestre: leia, resuma e comente, mas não o reescreva. Itens novos vão por `quadro_inserir` (no estilo dele) ou `quadro_propor` (ideias numa moldura própria), sempre pela fila de revisão; nada fica no material dele sem aceite.
