# Frente C — Guia de projeto (o ofício)

> Parte de [mapas-melhores.md](mapas-melhores.md). Quem faz: **Opus** (Claude Code), diretamente. É conteúdo e julgamento, não código. O Gemini não implementa esta frente.

## O que estamos tentando fazer

O guia de hoje (`docs/assistente/guia/mapas.md`) ensina a **ordem das chamadas** e algumas regras da Fase 10 (escala, presença fina, maciço e escarpa). Ele não ensina a **projetar**: decidir o que o lugar precisa, que porte cada parte tem, como as partes se relacionam, o que dá identidade e o que conta história. Por isso o Claude do app produziu 40 casas iguais: ele seguiu a ordem certa, sem método de projeto.

O guia novo precisa servir para **qualquer lugar e qualquer gênero**: vila, mansão, igreja com cemitério, masmorra, caverna, pântano, porto, hospital, laboratório, nave e estação espacial. O método é um só. O que muda por lugar é o **repertório**: tamanhos típicos, programa, arranjos e o que dá vida.

## Princípios do texto

- Curto e acionável. Cada seção tem menos de ~6 KB, porque o Claude lê sob demanda.
- Números concretos em vez de adjetivos ("casa de camponês: 25 a 45 m², 1 a 3 cômodos", não "casas variadas").
- Cada repertório termina com **armadilhas**, os erros que o Claude comete naquele lugar.
- Sempre amarrado às ferramentas reais (ids de receitas, conjuntos, estilos de telhado e tipos de cômodo que existem).

## Fichas

### C1 — Método de projeto, leitura de referências e repertório  ✅ **[Opus]**
Depende de: B4 (para citar `busca` e `conjuntos`); pode começar antes e ajustar depois.
Arquivos: criar `docs/assistente/guia/projetar.md`, `docs/assistente/guia/referencias.md` e `docs/assistente/guia/lugares.md`; reescrever `docs/assistente/guia/mapas.md` (fica com a ordem de construção, as regras de ouro e o respeito ao mestre, e manda ler `projetar` antes de compor).
Conteúdo:
- **`projetar`**, o método em passos, cada um com o que sai dele:
  1. *Brief*: o que é o lugar, que cena vai acontecer, quantos jogadores e o tom. O Atlas faz mapas táticos (célula de 1,5 m). Um mapa regional ilustrado em perspectiva vira um recorte jogável, ou vários.
  2. *Programa*: a lista de espaços, cada um com função, porte (m²) e o que precisa ter.
  3. *Zoneamento e circulação*: eixos, praça, portões, gargalos, onde a cena acontece.
  4. *Massa e silhueta*: hierarquia de porte (1 dominante, 2 ou 3 médios, o resto pequeno), plantas compostas (L, T, anexo, alpendre), orientação variada, frente para a rua.
  5. *Identidade*: um traço por edifício (telhado, anexo, cerca, horta, chaminé, material).
  6. *Vida e história*: objetos que contam o que aconteceu, desgaste, presença com economia.
  7. *Luz e clima*.
  8. *Conferir*: as vistas planta e telhados, `atlas_revisar`, e a referência lado a lado, defeito por defeito.
- **`referencias`**: como ler uma imagem do mestre. Tirar massas, eixos, desníveis e pontos focais. Medir a escala pelo que tem tamanho conhecido (porta ≈ 1 m, cama ≈ 2 m, casa de vila 6 a 10 m). Traduzir perspectiva em planta: penhasco vira desnível e não muro, torre vira cômodo redondo e não cruz. Separar o que o motor faz do que não faz, e dizer isso ao mestre antes de construir.
- **`lugares`**: um repertório por tipo (assentamento rural, cidade, conjunto religioso com cemitério, casa grande e mansão, masmorra, caverna, natureza, costa e porto, instalação moderna, nave e estação espacial, acampamento). Cada um com: tamanhos típicos, programa mínimo, arranjos, o que dá vida, materiais e telhados que combinam, conjuntos e receitas úteis, e armadilhas.
Pronto quando: as três seções aparecem em `plataforma_guia`, o `mapas.md` aponta para elas, e o Opus testa com o Claude do app pedindo "uma vila de montanha nevada" e "a ponte de comando de um cargueiro espacial", comparando com o resultado antigo.
Nota: o repertório virou duas seções (`lugares` para exteriores e `interiores`), para cada uma ficar abaixo de 6 KB. Todos os ids citados foram conferidos por script contra o catálogo. Falta o teste com o Claude do app (o mestre roda; o guia é lido na partida do servidor MCP até a B3, então reinicie o app do Claude antes).

### C2 — O guia ensina as ferramentas e o motor novos  ✅ **[Opus]**
Depende de: D, E, F, G e H prontos (ou cada um, à medida que ficar pronto).
Arquivos: `projetar.md`, `lugares.md`, `mapas.md`, `ferramentas-atlas.md`.
Conteúdo: `atlas_edificio`, `atlas_mobiliar`, `atlas_caminho` e `atlas_arranjo` dentro do método (o passo 4 vira "edifício por programa"); patamares no passo 3; cômodos redondos e andares no repertório (torre, farol, moinho, mansão de dois andares, deques de nave). Exemplos completos de chamadas para um lugar pequeno de cada tipo.
Pronto quando: o guia não menciona nenhum contorno manual que uma ferramenta nova resolve melhor.
Nota (conferida em 2026-11-21): `mapas.md`, `ferramentas-atlas.md`, `projetar.md`, `referencias.md` e `nucleo.md` já documentam `atlas_edificio`, `atlas_mobiliar`, `atlas_caminho`, `atlas_arranjo`, `atlas_revisar`, `vista: "telhados"` e `atlas_andares`.

### C3 — Núcleo enxuto atualizado  ✅ **[Opus]**
Depende de: C1.
Arquivos: `docs/assistente/nucleo.md` (até 6 KB, enviado no `initialize`).
Conteúdo: a regra "antes de compor qualquer lugar, `plataforma_guia ['projetar', 'lugares']`"; "ao receber uma imagem de referência, `plataforma_guia referencias`"; "antes de entregar, `atlas_revisar` e as duas vistas". Conferir o tamanho com `wc -c`.
Pronto quando: o núcleo cabe em 6 KB e manda ler o método.
Nota: feito junto da C1 (4,2 KB). A menção a `atlas_revisar` e às duas vistas entra na C2, quando a B1 e a B5c existirem.
