> resumo: ajuda completa das ferramentas Atlas (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Atlas

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

## atlas_abrir

Abre um mapa no Atlas (pela rota, como na galeria) e espera o editor aparecer na tela, até 10 s. Se a resposta trouxer `aviso`, o mapa abriu mas o editor ainda não está na tela (aba em segundo plano): `atlas_ver_mapa` e `atlas_o_que_vejo` esperam mais um pouco; se falharem, peça ao mestre para trazer a aba do Atlas para a frente.

## atlas_ambiente

Ajusta clima e acabamento do mapa aberto (um passo de desfazer). Presets em `atlas_catalogo { parte: "climas" }`. `"guardarClima"` `{ id, nome }` salva no mapa.
- Presets atmosféricos (`neve`, `neblina`, `tempestade`, `noite`, `apagao`, `neon`) já trazem `glow`, `vignette`, `edges` (`clouds`/`fog`/`dark`) e — em `neve` — `sol.angle` rasante (`0.75`); `acabamento.preset` também oferece `'inverno-nevado'` e `'sombrio-cinematografico'`.
- Em exteriores e cenas personalizadas, ajuste `acabamento` com `glow` (`0.35–0.8`), `vignette` (`0.3–0.5`), `edges` (`{ kind: "clouds" | "fog" | "dark", amount }`) e `grade` opcional, além de `sol.angle` baixo/rasante (`0.65–0.85`) para sombras longas e leitura de relevo dramática.

## atlas_andares

Cria ou renomeia andares do mapa aberto e devolve a lista ordenada de andares com ids (um passo de desfazer). O térreo já existe sempre como `null`; sem parâmetros, apenas lista os andares.

Parâmetros:
- `criar`: lista de `{ nome, order }`, com `order` inteiro diferente de `0` (`-1` porão, `1` 1º andar, `2` 2º andar...).
- `renomear`: lista de `{ id, nome }` (`id` de andar ou `null` para renomear o térreo).

Exemplos:
`atlas_andares { criar: [{ nome: "Porão", order: -1 }, { nome: "1º andar", order: 1 }] }`
`atlas_andares { renomear: [{ id: null, nome: "Térreo" }] }`

## atlas_arranjo

Dispõe até 300 objetos em padrões geométricos com variação controlada (`fileiras`, `grade-solta`, `aglomerado`, `ao-longo`, `circulo`, `bordas`), desviando de paredes, cômodos (quando fora), portas e objetos que bloqueiam (um passo de desfazer). Devolve quantos itens entraram e quantas posições não couberam.

Parâmetros principais:
- `padrao`: `'fileiras' | 'grade-solta' | 'aglomerado' | 'ao-longo' | 'circulo' | 'bordas'`. Em `'ao-longo'`, `area` deve ser `{ faixa, largura }`.
- `itens[]`: `{ item, peso?, escala?: [min, max], params? }` (confira ids com `atlas_catalogo`).
- `espacamento`: `[dx, dy]` em metros (ou `[passoAoLongo, afastamentoLateral]` em `ao-longo`).
- `angulo`, `desalinho`, `giro`, `falhas` (`0..0.6`), `encarar` (`fileira | centro | caminho | livre`), `grupos` (`{ tamanho: [cols, rows], vazio }`), `andar` (id de andar ou `null` para o térreo).

Exemplos:

Cemitério com cruzes, lápides e túmulos em quadras:
`atlas_arranjo { padrao: "fileiras", area: { retangulo: [8, 8, 23, 18] }, itens: [{ item: "lapide", peso: 3, escala: [0.9, 1.1] }, { item: "cruz.pedra", peso: 2 }, { item: "tumulo", peso: 1 }], espacamento: [1.6, 2.2], grupos: { tamanho: [4, 2], vazio: 1.8 } }`

Tendas de acampamento em aglomerado:
`atlas_arranjo { padrao: "aglomerado", area: { disco: [24, 18], raio: 8 }, itens: [{ item: "tenda", peso: 3 }, { item: "fogueira", peso: 1 }], espacamento: [3.2, 3.2] }`

Caixotes numa baia de carga em fileiras com corredor:
`atlas_arranjo { padrao: "fileiras", area: { retangulo: [4, 4, 14, 11] }, itens: [{ item: "caixote", peso: 2 }, { item: "pilha-de-caixotes", peso: 1 }], espacamento: [1.5, 1.5], grupos: { tamanho: [3, 2], vazio: 1.6 } }`

Bancos de igreja em fileiras olhando o altar (ângulo 0):
`atlas_arranjo { padrao: "fileiras", area: { retangulo: [7, 6, 14, 13] }, itens: [{ item: "banco.igreja" }], espacamento: [2.4, 1.4], angulo: 0, encarar: "fileira", falhas: 0.05, grupos: { tamanho: [1, 4], vazio: 1.6 } }`

## atlas_caminho

Traça de 1 a 20 trilhas ou estradas orgânicas em METROS num único passo de desfazer: suaviza curvas, varia a largura ao longo do percurso, cria bordas irregulares com faixa marginal opcional e acrescenta sulcos de carroça em trechos largos (`sulcos: true`, quando largura > 2 m).

Parâmetros por item em `caminhos[]`:
- `pontos`: `[x, y][]` em metros (mínimo 2 pontos).
- `largura`: número fixo ou intervalo `[min, max]` em metros.
- `material`: id de terreno (ex.: `terra`, `paralelepipedo`, `cascalho`).
- `borda`: opcional `{ material, largura }` que envolve o caminho antes do miolo.
- `sulcos`: opcional `boolean` para marcas paralelas de roda.
- `irregular`: opcional (padrão `0.35`) controla a sinuosidade da borda em metros.

Exemplos:

Trilha de terra na neve com borda de neve suja:
`atlas_caminho { caminhos: [{ pontos: [[4, 28], [14, 20], [26, 22], [38, 12]], largura: [1.5, 2.8], material: "terra", borda: { material: "neve.pisada", largura: 0.8 }, irregular: 0.45 }] }`

Estrada de paralelepípedo com sulcos:
`atlas_caminho { caminhos: [{ pontos: [[2, 16], [18, 15], [34, 18]], largura: [3.2, 4.2], material: "paralelepipedo", borda: { material: "lama", largura: 0.6 }, sulcos: true }] }`

Corredor de cascalho entre túmulos:
`atlas_caminho { caminhos: [{ pontos: [[15, 4], [15, 16], [22, 22]], largura: [1.2, 1.8], material: "cascalho", irregular: 0.2 }] }`

## atlas_catalogo

Catálogo de opções: `receitas`, `colecao`, `conjuntos`, `comodos`, `materiais`, `telhado`, `climas`, `luzes`, `presenca` ou `momentos`. Sem `parte`, traz contagens. Com `busca` (texto de até 60 caracteres), filtra por id, nome, tags e funções (sem `parte`, procura em receitas, coleção, conjuntos e materiais, até 40 de cada). Use para não inventar ids.

## atlas_comodos

Cria cômodos (piso, paredes e telhado; um passo de desfazer). Escolha **exatamente uma** forma por cômodo:
- `rets`: retângulos em **CÉLULAS do grid de 1,5 m** com `x1` e `y1` exclusivos (ex.: `[2,3,5,6]` = 3×3 células).
- `circulo`: `{ centro: [x, y], raio, lados? }` em **METROS** (`raio >= 0,8`, `lados` opcional de `8` a `48`, padrão `24`).
- `poligono`: lista de vértices `[[x, y], ...]` em **METROS** (polígono simples, mínimo 3 pontos, área >= 2 m²).

> **Unidades:** `rets` usa células (1,5 m); `circulo` e `poligono` usam **metros**. Não misture `rets` com `circulo`/`poligono` no mesmo cômodo.

Tipo dos cômodos: ver `atlas_catalogo`.

- `telhado`: omitido = estilo pela função/gênero (contorno circular >= 8 lados escolhe `torre-redonda`; ou herdado do cômodo vizinho; varandas ficam sem); `null` = sem telhado; ou id de um **estilo de telhado** (ver tabela ou `atlas_catalogo { parte: "telhado" }`) ou id de uma cobertura avulsa (`telha.barro`, etc.).
- `telhadoForma`, `telhadoCumeeira`, `telhadoDetalhes`: sobrescritas opcionais sobre o telhado resolvido (`quatro-aguas`, `duas-aguas`, `plano`, `piramide`, `cone`; `auto`, `h`, `v`; `chamine`, `cruz`, `sino`, `catavento`, `claraboia`, `caixa-dagua`).
- `andar`: id de andar opcional (`null` ou omitido = térreo; crie o andar antes em `atlas_andares`).

| Estilo | Cobertura | Forma | Íngreme | Detalhes |
| --- | --- | --- | --- | --- |
| `casa-de-telha` | `telha.barro` | `quatro-aguas` | não | `chamine` |
| `casa-velha` | `telha.velha` | `duas-aguas` | não | `chamine` |
| `choupana` | `telha.palha` | `quatro-aguas` | não | — |
| `casa-de-pedra` | `telha.pedra` | `duas-aguas` | não | `chamine` |
| `celeiro` | `telha.tabuinhas` | `duas-aguas` | sim | `catavento` |
| `igreja` | `telha.ardosia` | `duas-aguas` | sim | `cruz` |
| `torre` | `telha.escamas` | `piramide` | sim | `sino` |
| `torre-redonda` | `telha.escamas` | `cone` | sim | — |
| `torre-conica-de-palha` | `telha.palha` | `cone` | sim | — |
| `templo-de-cobre` | `telha.cobre` | `quatro-aguas` | sim | — |
| `galpao-de-zinco` | `telha.zinco` | `duas-aguas` | não | — |
| `laje-moderna` | `telha.concreto` | `plano` | não | `caixa-dagua` |
| `casa-nordica` | `telha.grama` | `duas-aguas` | não | `chamine` |
| `tenda` | `telha.lona` | `piramide` | não | — |

Exemplos:
- **Igreja com nave e campanário colado:**
  `atlas_comodos { comodos: [{ rets: [[6, 6, 12, 9]], tipo: "capela", nome: "Nave", telhado: "igreja" }, { rets: [[12, 6, 14, 9]], tipo: "capela", nome: "Campanário", telhado: "torre" }] }`
- **Farol redondo (círculo de raio 3 m em [15, 15], depois porta na base):**
  `atlas_comodos { comodos: [{ circulo: { centro: [15, 15], raio: 3 }, tipo: "salao", nome: "Farol", telhado: "torre-redonda" }] }`
  `atlas_portas { portas: [{ perto: [15, 18] }] }`
- **Igreja com abside semicircular encostada na nave:**
  `atlas_comodos { comodos: [{ rets: [[4, 4, 10, 8]], tipo: "capela", nome: "Nave", telhado: "igreja" }, { poligono: [[15, 6], [16.5, 6.4], [17.6, 7.5], [18, 9], [17.6, 10.5], [16.5, 11.6], [15, 12]], tipo: "capela", nome: "Abside", telhado: "igreja" }] }`
- **Módulo de estação em octógono com quatro corredores:**
  `atlas_comodos { comodos: [{ circulo: { centro: [15, 15], raio: 4.5, lados: 8 }, tipo: "oficina", nome: "Núcleo" }, { rets: [[9, 3, 11, 7], [9, 13, 11, 17], [3, 9, 7, 11], [13, 9, 17, 11]], tipo: "corredor", nome: "Corredores" }] }`

## atlas_desfazer

Desfaz as últimas entradas do histórico do mapa aberto (a mesma pilha do Ctrl+Z, inclusive edições do mestre). Parâmetro opcional `passos`: de 1 a 20, padrão 1. Devolve os rótulos desfeitos; com o histórico vazio, é erro. Um momento inteiro é um passo de desfazer (todos os seus passos de água, luz, objeto, revelar e interagir se fundem), desde que ninguém faça outro comando no meio; use para testar um momento que altera o mapa e voltar ao estado anterior com `passos: 1`. Desfazer não grava: depois, `atlas_salvar` se quiser fixar.

## atlas_edificio

Constrói de 1 a 12 edifícios completos por programa (planta baixa composta, portas internas e externa, janelas na fachada, telhado, mobília e luzes) numa só transação (`Ctrl+Z` desfaz tudo). Falha em um edifício não derruba os demais: a resposta lista os edifícios inseridos e os motivos dos que falharam.

Parâmetros por item em `edificios[]`:
- `nome`: nome do edifício.
- `origem`: `[x, y]` em CÉLULAS do grid (1,5 m) do canto superior esquerdo do lote.
- `lote`: `[largura, altura]` opcionais em células (padrão: `3 × √(área total)`).
- `frente`: `'n' | 's' | 'l' | 'o'`.
- `forma`: `'auto' | 'compacta' | 'L' | 'T' | 'U' | 'linear' | 'patio'`.
- `alpendre`: `true` cria varanda frontal sem telhado.
- `rotacao`: ângulo opcional em radianos ao redor do centro da planta (ex.: `0.26` ≈ 15°, `-0.35` ≈ -20°), quebrando alinhamentos rígidos na grade.
- `telhado`, `piso`, `mobiliar` (padrão `true`), `luzes` (padrão `true`), `andar` (id de andar ou `null` para o térreo).
- `comodos[]`: `{ tipo, area (m²), nome?, principal? }` (1 a 12 cômodos).

Dica de composição: **varie `forma`, porte e `frente` entre edifícios vizinhos** para evitar casas iguais em fila.

Exemplos:

Casa de camponês em L com alpendre:
```json
{
  "edificios": [{
    "nome": "Casa do Lenhador", "origem": [6, 8], "frente": "s", "forma": "L", "alpendre": true, "telhado": "choupana",
    "comodos": [
      { "tipo": "sala", "area": 18, "principal": true },
      { "tipo": "cozinha", "area": 10 },
      { "tipo": "quarto", "area": 10 }
    ]
  }]
}
```

Igreja (nave principal grande + sacristia + torre):
```json
{
  "edificios": [{
    "nome": "Capela de São Bento", "origem": [20, 6], "frente": "o", "forma": "T", "telhado": "igreja",
    "comodos": [
      { "tipo": "capela", "area": 36, "nome": "Nave", "principal": true },
      { "tipo": "oficina", "area": 12, "nome": "Sacristia" },
      { "tipo": "capela", "area": 9, "nome": "Campanário" }
    ]
  }]
}
```

Módulo de alojamento (corredor linear com cabines):
```json
{
  "edificios": [{
    "nome": "Ala da Guarnição", "origem": [8, 22], "frente": "n", "forma": "linear", "telhado": "galpao-de-zinco",
    "comodos": [
      { "tipo": "salao", "area": 18, "principal": true },
      { "tipo": "dormitorio", "area": 12 },
      { "tipo": "dormitorio", "area": 12 },
      { "tipo": "dormitorio", "area": 12 },
      { "tipo": "cozinha", "area": 10 },
      { "tipo": "deposito", "area": 9 }
    ]
  }]
}
```

## atlas_espalhar

Espalha conjunto de objetos numa região em metros (um passo de desfazer). Conjuntos em `atlas_catalogo { parte: "conjuntos" }`:
- Internos: `papelada`, `caixotes`, `bibelos`, `refeicao`, `bagunca`, `plantas`.
- Exteriores por bioma: `mata` (temperado), `jardim`, `cemiterio`, `mata-nevada` (neve/inverno), `bosque-morto` (pântano/maldito/inverno seco), `encosta-rochosa` (serra/montanha) e `costa-rochosa` (litoral/margem). Objetos ficam comuns e editáveis.

Parâmetros:

- `forma`: Forma em metros: disco, poligono, faixa, retangulo ou celulas. irregular opcional (m).
- `andar`: id de andar opcional (`null` ou omitido = térreo).

## atlas_luzes

Acende luzes no mapa aberto em metros (um passo de desfazer). Presets em atlas_catalogo { parte: "luzes" }. Luzes aparecem em clima escuro (atlas_ambiente). Aceita `andar` opcional por luz (`null` = térreo).

## atlas_mapa_criar

Cria e abre mapa novo em metros (padrão 45×30; grid 1,5 m). "base": atlas_catalogo { parte: "materiais" }. Gênero e estilo: atlas_catalogo { parte: "climas" }.

## atlas_mapa_ler

Resume o mapa (aberto ou por `id`): `andares` (lista ordenada `{ id, nome, ordem }`), `resumo` (contagem de edifícios, área média/mín/máx em m², `comodosSemTelhado` e `retangulares`), `edificios` (`id`, `nome`, `salas`, `area` em m², `caixa` `[x, y, largura, altura]` em m e `telhados`), `comodos` (`andar`, `rets` em células `[x0, y0, x1, y1]` com fim exclusivo, `area` em m², `telhado` como `{ estilo }` ou `{ cobertura, forma, ingreme, detalhes }`, `edificio` e `retangulo` em m), além de terreno, objetos (com `andar`), luzes (com `andar`), regiões, peças (com `andar`), clima, acabamento, momentos e notas.

- `comodos`: lista opcional de ids de cômodos para detalhar só aqueles cômodos (útil quando o JSON do mapa grande troca `rets` por `retsResumidos`).

O mapa aberto (com ou sem `id`) e os mapas que estão em abas de segundo plano (o Atlas guarda até 3) vêm do documento vivo, com as edições ainda não gravadas, e trazem `naoSalvo`. `atlas_mapas_listar` e `atlas_o_que_vejo` marcam `naoSalvo: true` quando há edições não gravadas. Os outros mapas vêm do disco.

## atlas_mobiliar

Mobília e ilumina cômodos prontos pela função e pelo gênero com o mesmo gerador da interface (`propostaDeMobilia` e `propostaDeLuzes`), tudo num só passo de desfazer. Use logo depois de criar cômodos (e abrir suas portas) para preencher o interior base; depois, ajuste à mão com `atlas_objetos`, `atlas_mover` ou `atlas_remover` o que conta a história singular daquele lugar.

Parâmetros:
- `comodos`: lista de 1 a 60 ids de cômodos do mapa aberto (em ordem: cada cômodo vê os anteriores).
- `luzes`: booleano opcional (`true` por padrão; passe `false` para mobiliar sem criar luzes).
- `semente`: número opcional para variar o sorteio de móveis e paleta.

A resposta traz o relatório por cômodo (ex.: `"Casa Falk · sala: 9 objetos, 1 luz"`). Cômodos sem regras, pequenos demais ou com id inexistente não abortam o lote: entram no relatório com o motivo.

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
- Objetos de parede (`quadro`, `retrato.oval`, `cortina.janela`, `arandela`, `espelho.grande`, `tapecaria`… ou qualquer item com `camada: 'wall'`) ficam presos à face do cômodo mais próxima de `pos`: aponte para um ponto a até ~1 m da parede, do lado de dentro do cômodo. Sem parede perto, a ferramenta recusa.
- `submerso`: booleano (opcional; fica sob a água).
- `oculto`: booleano (opcional; `true` esconde o objeto e suas luzes dos jogadores/projetor até ser mostrado por um momento).
- `params`: objeto com parâmetros da receita (opcional).
- `andar`: id de andar opcional (`null` ou omitido = térreo).
- `escada`: opcional para receitas de escada/alçapão (`escada`, `escada.caracol`, `escada.pedra`, `escada.madeira`, `alcapao`); `{ leva: string | null, posicao?: [x, y] }` define a ligação entre andares (`leva: null` aponta para o térreo).

## atlas_paredes

Cria paredes, muros, cercas ou escarpas avulsas em metros (um passo de desfazer). Para salas e interiores use `atlas_comodos`.

Parâmetros de cada parede:
- `path`: lista de pontos `[x, y]` em metros (mínimo 2 pontos).
- `kind`: `'wall'` (parede cheia que bloqueia movimento, visão e luz), `'low'` (muro baixo com borda destacada: bloqueia passo, visão livre), `'fence'` (cerca de madeira com postes e travessas para pastos/jardins) ou `'cliff'` (escarpa / barranco). Para paliçada defensiva pesada de toras, prefira a receita `palicada` com `atlas_arranjo` (`padrao: "ao-longo"`, `espacamento: [2.0, 0]`).
- `drop`: `'a' | 'b'` (qual lado desce na escarpa; `'a'` = lado esquerdo do sentido do traçado, `'b'` = lado direito).
- `altura`, `espessura`, `material`: opcionais. Na escarpa o material padrão é `rocha.cinza` (aceita qualquer material de uso `macico`).
- `andar`: id de andar opcional (`null` ou omitido = térreo).

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

Abre portas, janelas, arcos ou passagens secretas na parede mais próxima (metros, até ~0,75 m da parede; um passo de desfazer). Aceita `andar` opcional (`null` = térreo). Crie cômodo/parede antes.

## atlas_presenca

Pinta presença (musgo, sangue, mofo, fuligem...) em metros (um passo de desfazer). Pincéis em atlas_catalogo { parte: "presenca" }. Aceita `andar` opcional (`null` = térreo).

- `apagar: true`: apaga a presença na forma. Sem `pincel`, apaga todos os pincéis; com `pincel`, só aquele.
- `intensidade` (0 a 1): vale para a camada inteira daquele pincel, mesmo que ela já exista (padrão 0,6 ao criar). A resposta diz qual intensidade ficou.

Parâmetros:

- `forma`: Forma em metros: disco, poligono, faixa, retangulo ou celulas. irregular opcional (m).

## atlas_regioes

Cria regiões funcionais no mapa aberto em metros (um passo de desfazer): reveal, trigger, audio ou note. Aceita `andar` opcional (`null` = térreo).

## atlas_remover

Remove entidades do mapa aberto pelos ids (atlas_mapa_ler). Age na hora, sem confirmação. Um passo de desfazer.

## atlas_revisar

Revisa o mapa aberto (ou por `id`) e devolve `{ achados, resumo: { erros, avisos, dicas } }`, com até 15 achados ordenados por gravidade (`erro`, `aviso`, `dica`), cada um com `regra`, `gravidade`, `mensagem`, `sugestao`, `ids` e `caixa` opcional em metros.

- `id`: opcional; sem `id`, revisa o mapa aberto.
- `regras`: lista opcional de regras para filtrar (`comodo-sem-acesso`, `edificio-sem-telhado`, `interior-vazio`, `porta-bloqueada`, `objeto-fora`, `escala-suspeita`, `casas-iguais`, `fileiras-mecanicas`, `repeticao`, `mancha-em-disco`, `composicao-centralizada`, `noite-sem-luz`).

Rode sempre antes de entregar o mapa ao mestre e corrija os erros e avisos apontados.

## atlas_salvar

Grava o mapa aberto, pelo mesmo caminho do botão Gravar. Sem parâmetros. Devolve `{ salvo, revisao }`; se o mapa já estava gravado, responde que não havia nada a gravar. Se o mapa foi alterado em outra aba, volta erro e nada é gravado: avise o mestre. As escritas do assistente ficam só como rascunho até esta chamada.

## atlas_terreno

Pinta terreno, apaga terreno ou define patamares de altitude (`acao: "relevo"`) no mapa aberto (um passo de desfazer), em METROS. Operações: `{ acao, material?, altura?, forma }`. Materiais: `atlas_catalogo { parte: "materiais" }`.

Parâmetros:

- `operacoes[].acao`: `'pintar'`, `'apagar'` ou `'relevo'` (exige `altura` de −200 a 200 m; bordas >= 1 m geram penhascos automaticamente e degraus < 1 m viram degraus transponíveis).
- `operacoes[].forma`: Forma em metros: disco, poligono, faixa, retangulo ou celulas. `irregular` opcional (m).

**Patamar vs. maciço vs. escarpa avulsa:** Use patamar (`acao: "relevo"`) quando há níveis distintos de terreno com sombra de penhasco e névoa de altitude entre eles. Use maciço (`pintar` com material `macico`, como `rocha.caverna`) para massas volumétricas de rocha, paredes de caverna ou afloramentos sobre um mesmo nível; em grandes escarpas de contorno ou em bordas do mapa, prefira `macico` (`rocha.*`) + `cliff` em vez de patamares gigantes encostados na margem do mapa. Use escarpa avulsa (`atlas_paredes` `kind: "cliff"`) apenas para ressaltos pontuais ou margens lineares onde não interessa dividir a altitude da área inteira.

Exemplo de platô com vale (vila a 0 m, mata a −25 m com `irregular: 1.5`, trilha descendo em degraus de 0,8 m):
```json
{
  "operacoes": [
    { "acao": "relevo", "altura": -25, "forma": { "retangulo": [0, 35, 60, 60], "irregular": 1.5 } },
    { "acao": "relevo", "altura": -0.8, "forma": { "faixa": [[28, 30], [28, 33]], "largura": 3 } },
    { "acao": "relevo", "altura": -1.6, "forma": { "faixa": [[28, 33], [28, 36]], "largura": 3 } }
  ]
}
```
O que está em patamares baixos também recebe árvores e objetos em escala real — o tom de profundidade e a sombra do penhasco cuidam da sensação de distância.

## atlas_ver_mapa

Captura imagem JPEG do mapa aberto. Sem `caixa`, mostra o mapa todo; com `caixa` `[x0,y0,x1,y1]` em metros, mostra o recorte. Retorna escala e caixa.

- `vista`: `'planta'` (padrão: interiores, paredes e mobília) ou `'telhados'` (telhados fechados, como os jogadores veem as construções por fora). Depois de construir casas, confira as duas vistas: `planta` para validar portas, circulação e mobília; `telhados` para validar a cobertura, cumeeiras, sombras e silhueta dos edifícios na paisagem.
- `andar`: id de andar opcional (`null` para o térreo) para capturar outro andar sem perder a vista ativa depois.

