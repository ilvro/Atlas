> resumo: repertório de interiores (casa e mansão, taverna, masmorra e cripta, caverna, instalação moderna, nave e estação espacial): programa, portes, móveis e armadilhas. Use com `projetar`.

# Lugares: interiores

Tipos de cômodo e gêneros: `atlas_catalogo { parte: "climas" }` (`tiposDeComodo`, `generos`). Pisos e paredes: `atlas_catalogo { parte: "materiais" }`. Ids conferidos; confirme se algum for recusado.

## Regras para qualquer interior

- **Cômodos com porte certo:** quarto de 9 a 16 m², sala de 16 a 30 m², cozinha de 9 a 16 m², banheiro de 3 a 6 m², corredor de 1 célula (1,5 m) de largura. Um corredor de 3 m é um salão.
- **Circulação:** desenhe primeiro o caminho (entrada → corredor ou sala → cômodos). Todo cômodo precisa de porta; os de serviço (cozinha, depósito) têm porta para fora ou para os fundos.
- **Móveis contra as paredes, centro livre**, a não ser a mesa de jantar e o tapete. Cama com a cabeceira na parede; mesa com cadeiras em volta; nada na frente da porta.
- **Proporção e densidade:** prefira cômodos compactos de 3 a 5 m por lado. Salão amplo de centro vazio é o defeito mais visível: divida-o com tapete, lareira ou pilares no meio (que também dão sombra às luzes) e agrupe os móveis em conjuntos alinhados às paredes. Interior cheio e próximo lê melhor que um galpão esparso.
- **Interiores de trabalho cheios** (armazém, oficina, cozinha, laboratório), com fileiras e corredores. Um interior vazio parece inacabado.
- Janelas nas paredes externas dos cômodos de estar; nenhuma no porão nem no depósito.

## Casa e mansão

- **Casa de vila:** sala com lareira (`lareira.pedra`), cozinha, 1 ou 2 quartos; pisos `tabuas.rusticas`, `tabuas.escuras`, `pedra.rustica`; paredes `toras`, `reboco.sujo`, `pedra.aparelhada`.
- **Mansão:** hall de entrada com escada, salão, sala de jantar, biblioteca, escritório, sala de jogos, cozinha e despensa nos fundos, quartos em cima (outro mapa). Pisos `parquet.espinha`, `marmore.*`; papéis `papel.damasco-*`, `boiserie.*`. Simetria na fachada, assimetria nos fundos.
- **Terror e abandono:** móveis tombados, `escombros`, `viga-partida`, poeira e mofo com economia, um cômodo destruído que conta história.

## Taverna e estalagem

- Salão de 60 a 100 m² com `mesa.taverna`, `banco.longo`, `banqueta`, `balcao` junto de uma parede, `lareira.pedra`, `barril` atrás do balcão; cozinha anexa com `fornalha`, `caldeirao`, `mesa.cavalete`; depósito com `pilha-de-barris` e `sacos`; quartos em cima.

## Masmorra, cripta e prisão

- Corredores de 1,5 a 3 m, salas irregulares, becos sem saída; pisos `laje.pedra`, `pedra.rustica`; paredes `tijolo`, `pedra.aparelhada`. Sem telhado (`telhado: null`) se for subterrâneo.
- **Cela:** `catre` ou `enxergao`, `grilhoes.parede`, `monte-de-palha`, piso `palha.chao`. **Cripta:** `sarcofago`, `caixao`, `velas-votivas`, `ossada`, `pilha-de-ossos`, `cranio-animal`.
- **Armadilhas:** salas todas retangulares do mesmo tamanho; corredores sem destino.

## Caverna e gruta

- Maciço `rocha.caverna` dando a forma (paredes irregulares), câmaras ligadas por passagens estreitas, água parada (`agua.gruta`), `estalagmite`, `rochedo`, `seixos`, `pedra.*`. Luz de tochas ou de uma abertura.

## Instalação moderna (hospital, laboratório, delegacia)

- Gênero `moderno`. Corredor central com salas dos dois lados; pisos `vinil.industrial`, `azulejo.branco`, `concreto.placas`; paredes `reboco.branco`, `reboco.sujo`, `painel.acolchoado` (isolamento).
- **Peças:** `maca.medica`, `scanner.corpo`, `mesa.laboratorio`, `armario.amostras`, `bancada.ferramentas`, `extintor`, `cabos`, `escrivaninha.computador`, `geladeira`. Luz `lampada` e `holofote`; um `apagao` no clima para o terror.

## Nave e estação espacial

- Use o gênero `ficcao-cientifica` se ele aparecer em `generos`; senão, `moderno`. Interior de nave **não tem telhado** (`telhado: null` em todos os cômodos) e o lado de fora é vazio: `base: "vazio"` no mapa.
- **Programa:** ponte de comando (`console` em arco, `cadeira.piloto`, `mesa.navegacao`), corredores técnicos estreitos (1 célula) com `tubulacao`, `grade.ventilacao`, `cabos`, `escotilha`; alojamento em cabines pequenas (`beliche.capsula`, `armario.metal`); refeitório (`mesa.refeitorio`); enfermaria (`maca.medica`, `scanner.corpo`, `armario.amostras`); sala de máquinas (`gerador`, `painel.eletrico`, `tubulacao`, `bancada.ferramentas`); criogenia (`criotubo` em fileira, campo `estado`); baia de carga (`caixa.carga`, `conteiner`, piso `piso.hangar` ou `metal.chapa`); eclusas nas pontas.
- **Pisos e paredes:** `metal.chapa` (técnico), `metal.grade` (passarelas), `vinil.industrial` (alojamento), `painel.metalico` e `painel.acolchoado`.
- **Luz:** `lampada` fria e baixa, telas que brilham, um `holofote` no hangar; `apagao` e luzes `neon` vermelhas para o alerta. Pouca luz: o terror vem do escuro entre as poças.
- **Armadilhas:** cômodos grandes e vazios; corredores largos (perde a claustrofobia); tudo limpo (falta `cabos`, painel aberto, `criotubo` quebrado, marcas de luta).
