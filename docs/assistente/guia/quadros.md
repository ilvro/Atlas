> resumo: ler os quadros da Mesa do jeito barato: mapa, busca, seção em títulos, seção completa, imagem só se precisar; gravar resumos e descrições de imagem; citar itens pelo id curto, não pedir todas as imagens e o vocabulário do mestre (marcadores, tipos, [[ligações]]).

# Ler os quadros da Mesa

Os quadros do mestre são enormes (dezenas de milhares de tokens). Nunca leia tudo: leia em camadas, do barato ao caro, e pare quando já souber o bastante. As ferramentas `quadros_listar`, `quadro_mapa`, `quadro_secao`, `quadro_buscar` e `quadro_imagem` (leitura) `quadro_resumir` e `quadro_descrever_imagem` (notas sobre o quadro) e `quadro_propor` (propostas para revisão) são sob demanda: carregue-as com `plataforma_ferramentas`. Só `quadro_propor` acrescenta itens ao quadro, e sempre marcados para revisão.

## A ordem

1. **`quadros_listar`**: os quadros da campanha, com seções, itens e tokens estimados. Escolha o quadro (por nome ou id).
2. **`quadro_mapa`**: uma linha por seção (id, título, itens por tipo, tokens, vizinhas e setas entre seções), mais os resumos já gravados. Custa poucas centenas a 6 mil tokens. **Leia sempre antes de abrir uma seção.** A posição importa: "ao lado de", "acima de" e as setas dizem o que o mestre entende como parte do mesmo assunto.
3. **`quadro_buscar`**: se a pergunta cita um nome, lugar ou objeto, busque o termo (sem acento nem caixa; até 20 ocorrências, com a seção e o id curto). Sem `quadro`, busca em todos. Muitas vezes isso responde sem abrir seção nenhuma.
4. **`quadro_secao` com `nivel: "titulos"`** (padrão): só a primeira linha de cada item. Serve para saber o que há na seção e decidir se vale ler mais.
5. **`quadro_secao` com `nivel: "completo"`**: o texto inteiro, em páginas de cerca de 2,5 mil tokens (`pagina: 2`, 3…). Peça só das seções que importam e só as páginas que precisar.
6. **`quadro_imagem`**: por último, e só se o texto não bastar. Handouts são texto dentro de imagem e só se leem assim, mas cada imagem custa bem mais que uma seção de texto. Use `lado` pequeno (o padrão, 768 px, serve para quase tudo; 1568 só para letras miúdas).

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

## Propor ideias no quadro

Quando o mestre pedir ideias para pôr no quadro (ganchos, testes, falas, segredos, uma cena), use `quadro_propor(quadro, titulo, notas, perto?)`: ela cria uma moldura "✦ título" no primeiro espaço livre ao lado da seção `perto` (ou à direita de tudo), com até 30 notas `{ texto, tipo? }`. O `tipo` é um dos tipos semânticos (`leitura`, `teste`, `segredo`, `loot`, `evento`, `fala`, `tarefa`, `rever`, `titulo`) e dá a cor da nota. Escreva no vocabulário do mestre: marcadores como `[PERCEPÇÃO 13]` e `[[Nome]]` para entidades.

Tudo entra marcado para revisão, no grupo "Do assistente" da fila: o mestre aceita, edita ou descarta. No quadro aberto, um Ctrl+Z desfaz a proposta inteira; num quadro fechado, ela é gravada direto e se desfaz pela fila ("Descartar todas"). Prefira uma proposta por pedido, com notas curtas, a várias molduras soltas.

## Respeito ao que é do mestre

O quadro é material do mestre: leia, resuma e comente, mas não o reescreva. Propostas novas vão por `quadro_propor`, para uma moldura própria e a fila de revisão; nada se mistura ao material dele sem aceite.
