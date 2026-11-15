> resumo: ajuda completa das ferramentas Atlas (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Atlas

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

## atlas_abrir

Abre um mapa no Atlas (pela rota, como na galeria) e espera o editor aparecer na tela, até 10 s. Se a resposta trouxer `aviso`, o mapa abriu mas o editor ainda não está na tela (aba em segundo plano): `atlas_ver_mapa` e `atlas_o_que_vejo` esperam mais um pouco; se falharem, peça ao mestre para trazer a aba do Atlas para a frente.

## atlas_ambiente

Ajusta clima e acabamento do mapa aberto (um passo de desfazer). Presets em atlas_catalogo { parte: "climas" }. "guardarClima" { id, nome } salva no mapa.

## atlas_catalogo

Catálogo de opções: receitas, colecao, materiais, telhado, climas, luzes, presenca ou momentos. Sem parte, traz contagens. Use para não inventar ids.

## atlas_comodos

Cria cômodos (piso, paredes e telhado; um passo de desfazer). ATENÇÃO: rets em CÉLULAS do grid de 1,5 m com x1 e y1 exclusivos (ex.: [2,3,5,6] = 3×3 células). Tipo: atlas_catalogo.

- `telhado`: omitido = estilo pela função/gênero (ou herdado do cômodo vizinho; varandas ficam sem); `null` = sem telhado; ou id de um **estilo de telhado** (ver tabela ou `atlas_catalogo { parte: "telhado" }`) ou id de uma cobertura avulsa (`telha.barro`, etc.).
- `telhadoForma`, `telhadoCumeeira`, `telhadoDetalhes`: sobrescritas opcionais sobre o telhado resolvido (`quatro-aguas`, `duas-aguas`, `plano`, `piramide`; `auto`, `h`, `v`; `chamine`, `cruz`, `sino`, `catavento`, `claraboia`, `caixa-dagua`).

| Estilo | Cobertura | Forma | Íngreme | Detalhes |
| --- | --- | --- | --- | --- |
| `casa-de-telha` | `telha.barro` | `quatro-aguas` | não | `chamine` |
| `casa-velha` | `telha.velha` | `duas-aguas` | não | `chamine` |
| `choupana` | `telha.palha` | `quatro-aguas` | não | — |
| `casa-de-pedra` | `telha.pedra` | `duas-aguas` | não | `chamine` |
| `celeiro` | `telha.tabuinhas` | `duas-aguas` | sim | `catavento` |
| `igreja` | `telha.ardosia` | `duas-aguas` | sim | `cruz` |
| `torre` | `telha.escamas` | `piramide` | sim | `sino` |
| `templo-de-cobre` | `telha.cobre` | `quatro-aguas` | sim | — |
| `galpao-de-zinco` | `telha.zinco` | `duas-aguas` | não | — |
| `laje-moderna` | `telha.concreto` | `plano` | não | `caixa-dagua` |
| `casa-nordica` | `telha.grama` | `duas-aguas` | não | `chamine` |
| `tenda` | `telha.lona` | `piramide` | não | — |

Exemplo — igreja com nave e campanário colado:
`atlas_comodos { comodos: [{ rets: [[6, 6, 12, 9]], tipo: "capela", nome: "Nave", telhado: "igreja" }, { rets: [[12, 6, 14, 9]], tipo: "capela", nome: "Campanário", telhado: "torre" }] }`

## atlas_desfazer

Desfaz as últimas entradas do histórico do mapa aberto (a mesma pilha do Ctrl+Z, inclusive edições do mestre). Parâmetro opcional `passos`: de 1 a 20, padrão 1. Devolve os rótulos desfeitos; com o histórico vazio, é erro. Um momento inteiro é um passo de desfazer (todos os seus passos de água, luz, objeto, revelar e interagir se fundem), desde que ninguém faça outro comando no meio; use para testar um momento que altera o mapa e voltar ao estado anterior com `passos: 1`. Desfazer não grava: depois, `atlas_salvar` se quiser fixar.

## atlas_espalhar

Espalha conjunto de objetos numa região em metros (um passo de desfazer). Conjuntos em atlas_catalogo { parte: "receitas" }. Objetos ficam comuns e editáveis.

Parâmetros:

- `forma`: Forma em metros: disco, poligono, faixa, retangulo ou celulas. irregular opcional (m).

## atlas_luzes

Acende luzes no mapa aberto em metros (um passo de desfazer). Presets em atlas_catalogo { parte: "luzes" }. Luzes aparecem em clima escuro (atlas_ambiente).

## atlas_mapa_criar

Cria e abre mapa novo em metros (padrão 45×30; grid 1,5 m). "base": atlas_catalogo { parte: "materiais" }. Gênero e estilo: atlas_catalogo { parte: "climas" }.

## atlas_mapa_ler

Resume o mapa (aberto ou por id): tamanho, terreno, cômodos (rets em m), objetos, luzes, regiões, peças, clima, acabamento, momentos e notas.

O mapa aberto (com ou sem `id`) e os mapas que estão em abas de segundo plano (o Atlas guarda até 3) vêm do documento vivo, com as edições ainda não gravadas, e trazem `naoSalvo`. `atlas_mapas_listar` e `atlas_o_que_vejo` marcam `naoSalvo: true` quando há edições não gravadas. Os outros mapas vêm do disco.

## atlas_momento

Cria ou refaz momento no mapa aberto (um passo de desfazer). Sem "id" cria novo; com "id" refaz o existente (inclusive um do mestre; prefira criar outro a menos que ele peça a troca). Tipos de passo em atlas_catalogo { parte: "momentos" }.

Parâmetros:

- `passos[]`: Passo do momento. Tipos em atlas_catalogo { parte: "momentos" }.

## atlas_momento_testar

Toca na aba um momento do mapa aberto e espera terminar. Devolve passos e resultado ("fim", "cancelado", "tempo esgotado"). Máximo 2 min.

## atlas_mover

Move objetos, luzes, peças e regiões por [dx, dy] em metros (um passo de desfazer). Age na hora, sem confirmação.

## atlas_notas

Escreve notas no mapa aberto (um passo de desfazer), substituindo o campo anterior. "mapa": nota geral. "comodos": notas por cômodo (atlas_mapa_ler).

## atlas_objetos

Coloca até 200 objetos no mapa aberto em metros (um passo de desfazer). "item": receita (atlas_catalogo { parte: "receitas" }) ou colecao.

Parâmetros de cada objeto:
- `item`: id da receita (ex.: `"arvore-morta"`, `"carroca-tombada"`, `"laje-de-pedra"`) ou `"casa:<assetId>"`.
- `pos`: `[x, y]` em metros.
- `rotacao`: em radianos (opcional; sorteado pela semente se omitido).
- `escala`: fator de escala (0.05 a 50, opcional).
- `camada`: `'floor'` | `'table'` | `'wall'` | `'ceiling'` | `'underwater'` (opcional).
- `submerso`: booleano (opcional; fica sob a água).
- `oculto`: booleano (opcional; `true` esconde o objeto e suas luzes dos jogadores/projetor até ser mostrado por um momento).
- `params`: objeto com parâmetros da receita (opcional).

## atlas_paredes

Cria paredes, muros, cercas ou escarpas avulsas em metros (um passo de desfazer). Para salas e interiores use `atlas_comodos`.

Parâmetros de cada parede:
- `path`: lista de pontos `[x, y]` em metros (mínimo 2 pontos).
- `kind`: `'wall'` (parede cheia que bloqueia movimento, visão e luz), `'low'` (muro baixo: bloqueia passo, visão livre), `'fence'` (cerca) ou `'cliff'` (escarpa / barranco).
- `drop`: `'a' | 'b'` (qual lado desce na escarpa; `'a'` = lado esquerdo do sentido do traçado, `'b'` = lado direito).
- `altura`, `espessura`, `material`: opcionais. Na escarpa o material padrão é `rocha.cinza` (aceita qualquer material de uso `macico`).

**Escarpa vs. maciço de terreno:**
- Use `atlas_terreno` com materiais de uso `macico` (`rocha.caverna`, `rocha.arenito`, etc.) para massas volumétricas de pedra, montanhas, platôs ou interiores de cavernas que cobrem uma área.
- Use `atlas_paredes` com `kind: 'cliff'` para desníveis lineares: barrancos, margens altas de rios/lagos e degraus de relevo. A escarpa bloqueia o passo (`move: true`), mas não a visão nem a luz, e assa a face de rocha descendo para o lado baixo indicado por `drop`.

Exemplo:
```json
{
  "paredes": [
    {
      "path": [[5, 10], [25, 10]],
      "kind": "cliff",
      "drop": "b",
      "material": "rocha.cinza"
    }
  ]
}
```

## atlas_portas

Abre portas, janelas, arcos ou passagens secretas na parede mais próxima (metros, até ~0,75 m da parede; um passo de desfazer). Crie cômodo/parede antes.

## atlas_presenca

Pinta presença (musgo, sangue, mofo, fuligem...) em metros (um passo de desfazer). Pincéis em atlas_catalogo { parte: "presenca" }.

- `apagar: true`: apaga a presença na forma. Sem `pincel`, apaga todos os pincéis; com `pincel`, só aquele.
- `intensidade` (0 a 1): vale para a camada inteira daquele pincel, mesmo que ela já exista (padrão 0,6 ao criar). A resposta diz qual intensidade ficou.

Parâmetros:

- `forma`: Forma em metros: disco, poligono, faixa, retangulo ou celulas. irregular opcional (m).

## atlas_regioes

Cria regiões funcionais no mapa aberto em metros (um passo de desfazer): reveal, trigger, audio ou note.

## atlas_remover

Remove entidades do mapa aberto pelos ids (atlas_mapa_ler). Age na hora, sem confirmação. Um passo de desfazer.

## atlas_salvar

Grava o mapa aberto, pelo mesmo caminho do botão Gravar. Sem parâmetros. Devolve `{ salvo, revisao }`; se o mapa já estava gravado, responde que não havia nada a gravar. Se o mapa foi alterado em outra aba, volta erro e nada é gravado: avise o mestre. As escritas do assistente ficam só como rascunho até esta chamada.

## atlas_terreno

Pinta ou apaga terreno no mapa aberto (um passo de desfazer), em METROS. Operações: { acao, material, forma }. Materiais: atlas_catalogo { parte: "materiais" }.

Parâmetros:

- `operacoes[].forma`: Forma em metros: disco, poligono, faixa, retangulo ou celulas. irregular opcional (m).

## atlas_ver_mapa

Captura imagem JPEG do mapa aberto. Sem caixa, mostra o mapa todo; com caixa [x0,y0,x1,y1] em metros, mostra recorte. Retorna escala e caixa.

