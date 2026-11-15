# Frente E — Acervo ampliado e gênero de ficção científica

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas** (`src/procedural/`). Os desenhos (receitas e materiais) são feitos **pelo Opus**, diretamente. Os dados que ligam tudo (gênero, tipos de cômodo, regras, conjuntos) são do **Gemini**.

## O que estamos tentando fazer

O acervo tem 234 receitas e 47 itens da coleção, quase todos de casa, taverna, igreja, porto e masmorra. Faltam peças que dão identidade aos lugares que o mestre pede:

- **Cemitério:** só existe uma lápide (0,5 × 0,2 m, sempre igual). Não há cruz de madeira, cruz de pedra, túmulo, jazigo, grade de ferro, portão nem cova aberta.
- **Vida rural e de montanha:** não há pás de moinho, pilha de lenha, varal, galinheiro, espantalho, monte de neve nem lanterna de farol.
- **Pisos e paredes rústicos:** não há terra batida, palha no chão, toras de madeira nem pedra aparelhada. Estábulo e celeiro saem com tábua de casa.
- **Ficção científica:** não há nada. Uma nave no estilo *Alien Isolation* precisa de chapa de metal, grade de piso, painéis, consoles, beliches-cápsula, criotubos, tubulação, armários de metal, contêineres e luz fluorescente e de alerta.

**Meta:** um acervo que cubra os lugares comuns de terror e investigação em quatro épocas (medieval, vitoriano, moderno, ficção científica), com variação dentro de cada peça (`campos` da receita), para que repetir uma peça não pareça cópia.

## Regras para os desenhos (Opus)

- Receitas vetoriais no formato de `src/procedural/receitas/*.ts` (`Receita`, `piso`, `ret`, `elipse`, `poli`), com `pegada` em metros reais, `tags`, `funcoes`, `generos` e `campos` quando houver variação útil (modelo, largura, estado, cor).
- Cada receita sai boa no **Ilustrado e no Pixel** (o Pixel deriva da mesma descrição: confira os dois).
- Variação por semente: lápides, cruzes e caixas variam em desgaste, musgo, inclinação e rachadura pelo `seed`.
- Conferir numa prancha (como na Fase 10, `docs/curadoria.md`) ao lado das peças vizinhas, para escala e paleta coerentes.
- Nada de propriedade intelectual reconhecível: "terminal de nave", não "terminal da Nostromo".

## Tarefas

| # | Tarefa | Quem |
| --- | --- | --- |
| E1 | Materiais novos: pisos, paredes e terrenos rústicos e industriais | **Opus** |
| E2 | Kit rural, de montanha e de cemitério | **Opus** |
| E3 | Kit de ficção científica | **Opus** |
| E4 | Gênero `ficcao-cientifica`: tipos, regras, luzes e paleta | Gemini |
| E5 | Conjuntos novos de espalhar e tipos rústicos com os pisos novos | Gemini |

Ordem: E1 → E2 e E3 (paralelos) → E4 → E5.

---

### E1 — Materiais novos  ⬜ **[Opus]**
Objetivo: pisos, paredes e terrenos que faltam para o rústico e o industrial.
Arquivos: `src/procedural/materiais.ts`, `src/procedural/estilos/materiais-pixel.ts` e testes de materiais.
Lista:
- **Piso:** `terra.batida`, `palha.chao` (palha espalhada sobre terra), `pedra.rustica` (lajes irregulares grossas), `tabuas.rusticas` (largas, gastas, com frestas), `metal.chapa` (chapa xadrez antiderrapante), `metal.grade` (grade de piso com o vão escuro embaixo), `vinil.industrial` (placas com junta e sujeira), `borracha.faixas` (faixas de segurança gastas).
- **Papel (parede):** `toras` (cabana de toras), `pedra.aparelhada`, `reboco.sujo`, `painel.metalico` (painéis com rebites e juntas), `painel.acolchoado` (acolchoado de nave e hospital).
- **Terreno:** `neve.pisada` (neve suja com marcas), `terra.congelada`, `grama.alta`, `piso.hangar` (concreto industrial com faixas; serve de base de nave e estacionamento).
Pronto quando: os materiais aparecem no catálogo e na Biblioteca, nas duas estéticas, e a prancha mostra cada um ao lado de um vizinho.

### E2 — Kit rural, de montanha e de cemitério  ⬜ **[Opus]**
Objetivo: cemitérios, vilas e lugares de montanha com identidade.
Arquivos: `src/procedural/receitas/exterior.ts` (ou um kit novo, `rural.ts`, registrado em `receitas/index.ts`).
Lista:
- **Cemitério:** `lapide` ganha `campos.modelo` (`reta`, `arredondada`, `gotica`, `quebrada`, `inclinada`) e tamanho real (0,6 × 0,25 m); `cruz.madeira` (com o pano ou a guirlanda opcional), `cruz.pedra` (celta, com o anel), `tumulo` (laje sobre a cova, 1 × 2,2 m), `cova.aberta` (com o monte de terra), `jazigo` (mausoléu pequeno de 2,5 × 3,5 m com porta e telhadinho), `anjo` (estátua de túmulo), `grade.ferro` (`campos.largura`), `portao.ferro`.
- **Rural e montanha:** `pas.moinho` (quatro pás com lona, `campos.raio`, camada de teto), `pilha-de-lenha` (em pé e deitada), `varal`, `galinheiro`, `espantalho`, `barril-de-chuva`, `poste-de-amarracao`, `monte-de-neve` (`campos.tamanho`), `carroca-de-feno`, `lanterna.farol` (a lente grande do topo do farol, com luz própria).
Pronto quando: um cemitério de teste com 6 tipos de peça e um quintal rural ficam convincentes na prancha e no mapa.

### E3 — Kit de ficção científica  ⬜ **[Opus]**
Objetivo: dá para montar a ponte de comando, os corredores, a enfermaria, a sala de máquinas e o alojamento de uma nave ou estação.
Arquivos: criar `src/procedural/receitas/ficcao.ts` e registrar em `receitas/index.ts`.
Lista (todas com `generos: ['ficcao-cientifica']`):
- **Comando:** `console` (`campos.largura`, telas acesas), `cadeira.piloto`, `mesa.navegacao` (mapa estelar), `terminal.crt` (monitor de tubo, verde ou âmbar).
- **Alojamento:** `beliche.capsula`, `armario.metal` (`campos.portas`), `mesa.refeitorio` (com bancos presos), `criotubo` (`campos.estado`: aberto, fechado, quebrado).
- **Técnico:** `tubulacao` (`campos.largura`, `campos.curva`), `grade.ventilacao`, `painel.eletrico` (aberto ou fechado), `gerador` (núcleo com anel), `caixa.carga` (`campos.cor`, marcações), `conteiner` (6 × 2,4 m), `bancada.ferramentas`, `extintor`, `cabos` (feixe no chão), `escada.marinheiro`.
- **Médico e laboratório:** `maca.medica`, `scanner.corpo`, `mesa.laboratorio` (vidraria), `armario.amostras`.
Pronto quando: um cômodo de teste de cada tipo fica convincente na prancha, no Ilustrado e no Pixel.

### E4 — Gênero `ficcao-cientifica`  ⬜
Objetivo: o Atlas entende nave e estação como gênero: cômodos, mobília automática, luzes e paleta.
Depende de: E1, E3 e D2.
Ler: `src/domain/presets.ts` (`GENEROS`, `Genero`, `TIPOS_DE_COMODO`, `PRESETS_DE_LUZ`, `telhadoPadrao`), `src/authoring/regras-mobilia.ts` (`REGRAS_DE_MOBILIA`, `VARIACOES_DE_GENERO`, `regrasPara`), `src/authoring/mobiliar.ts` (`MATERIAIS_POR_GENERO`, `PALETAS_POR_GENERO`), `src/authoring/luzes.ts` (`LUZES_POR_GENERO`, `LUZES_POR_FUNCAO`), `src/domain/paletas.ts`, a interface de escolha de gênero (procure `GENEROS.map` em `src/ui/`) e o catálogo de receitas com `generos` (para saber o que o E3 criou).
Arquivos: mudar `presets.ts`, `regras-mobilia.ts`, `mobiliar.ts`, `luzes.ts`, `funcao.ts`, e `paletas.ts` se as paletas forem por gênero; testes em `tests/unit/presets.test.ts` e no teste de regras.
Como:
1. `GENEROS`: `{ id: 'ficcao-cientifica', nome: 'Ficção científica', descricao: 'Metal, fluorescente, alerta', alvoDeCor: { saturacao: 0.38, luminancia: 0.4, tinta: '#d8e6e4' } }`.
2. Luzes novas em `PRESETS_DE_LUZ`: `fluorescente` (raio 6, `#e6f4ff`, intensidade 1, tremor 0,04, `grid`), `alerta` (raio 7, `#ff3b2f`, intensidade 1,1, tremor 0,5, `grid`), `monitor` (raio 2,5, `#7af0c8`, intensidade 0,6, `grid`). `LUZES_POR_GENERO['ficcao-cientifica']`: principal `fluorescente`, pequena `monitor`.
3. Tipos de cômodo: `ponte-de-comando`, `corredor-tecnico`, `sala-de-maquinas`, `laboratorio`, `cabine` (alojamento individual), `eclusa`, `baia-de-carga`, `criogenia`. Pisos e paredes com os materiais da E1 (`metal.chapa`, `metal.grade`, `vinil.industrial`, `painel.metalico`, `painel.acolchoado`). `refeitorio`, `dormitorio`, `hospital`, `deposito` e `banheiro` ganham versões do gênero em `MATERIAIS_POR_GENERO`.
4. Regras de mobília para os tipos novos com as receitas do E3 (console e cadeira na ponte; tubulação, gerador e painel na sala de máquinas; beliche e armário na cabine; criotubos em fileira na criogenia; contêineres e caixas na baia). `VARIACOES_DE_GENERO['ficcao-cientifica']` troca `cama.solteiro` por `beliche.capsula`, `armario` por `armario.metal`, `lareira.*` por nada e `estante` por `armario.metal`.
5. Telhado: no gênero `ficcao-cientifica`, `telhadoPadrao` devolve `null` (interior de nave não tem telhado; o casco é o limite do mapa).
6. `funcao.ts`: palavras (ponte, comando, cockpit; máquinas, reator, motor; laboratório; cabine, camarote; eclusa, câmara de descompressão; baia, hangar, porão de carga; criogenia, hibernação).
Testes: o gênero existe e é escolhível; cada tipo novo tem regras e só cita receitas que existem; `telhadoPadrao` dá `null` no gênero; as luzes novas estão no catálogo.
Pronto quando: pelo MCP, um mapa `genero: 'ficcao-cientifica'` com uma ponte, um corredor técnico e duas cabines, mobiliado com `atlas_mobiliar`, já parece interior de nave.
Commit: `added science fiction genre with rooms, furnishing and lights`

### E5 — Conjuntos novos e tipos rústicos com os pisos novos  ⬜
Objetivo: o `atlas_espalhar` e a mobília automática usam o acervo novo.
Depende de: E2, E3, E4, D2.
Ler: `src/authoring/espalhar.ts` (formato de conjunto, `grade`, `contexto`), `src/domain/presets.ts` (tipos da D2).
Arquivos: mudar `espalhar.ts` e `presets.ts`; testes.
Como:
1. Conjuntos: `cemiterio` passa a misturar `lapide` (modelos variados), `cruz.madeira`, `cruz.pedra`, `tumulo` e `anjo` raro; novo `cemiterio-abandonado` (inclinadas, quebradas, covas abertas, arbustos); `quintal-rural` (lenha, varal, barril de chuva, galinheiro, carrinho de mão); `neve-acumulada` (montes de neve, toco, lenha); `destrocos-de-nave` (caixas de carga tombadas, cabos, painéis soltos, extintor); `sala-tecnica` (cabos, tubulação curta, painel elétrico, grade de ventilação).
2. Tipos da D2: `estabulo` e `celeiro` com piso `palha.chao` ou `terra.batida`; `cela` com `pedra.rustica`; `oficina` com `tabuas.rusticas`; papéis `toras` e `pedra.aparelhada` como alternativas no gênero fantasia (`MATERIAIS_POR_GENERO`).
Testes: todo conjunto só cita receitas que existem; os pisos dos tipos existem.
Pronto quando: `atlas_espalhar { conjunto: 'cemiterio' }` produz um cemitério variado.
Commit: `scatter sets and rustic room types use the new kit`
