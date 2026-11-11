> resumo: ajuda completa das ferramentas Dossiê (descrição longa e parâmetros), uma seção por ferramenta.

# Ferramentas do Dossiê

O texto abaixo saiu das descrições do catálogo para o catálogo ficar enxuto. Consulte a seção da ferramenta antes de usá-la pela primeira vez.

## dossie_ameaca_criar

Cria uma ficha de ameaça (monstro) no Dossiê com os números do VD, como o wizard: defesa, PV, salvaguardas, presença e dano vêm da tabela de balanceamento. A ficha abre na tela e entra na campanha como "ameaca". Devolve o id.

Parâmetros:

- `vd`: Valor de Desafio (20, 40, 60, 80, 100... até 400).
- `elementos`: Obrigatório se paranormal; o primeiro é o principal.
- `categoria`: Padrão: paranormal.
- `tipo`: Paranormal: Criatura, Relíquia. Mundana: Humano, Animal, Veículo.
- `tamanho`: Padrão: Médio.
- `preset`: Dureza dos números: editora (tabela do livro), equilibrada (padrão) ou leve.
- `arquetipo`: Opcional: ajusta atributos, PV e Defesa como no wizard. Sem ele, PV e Defesa saem exatamente da tabela.
- `descricao`: Vai para as notas do mestre da ficha.
- `acoes`: Substitui a ação padrão ("Agredir"). Com "dano", a ação leva um ataque com o teste da tabela.

## dossie_ficha_criar

Cria uma ficha de personagem mínima e coerente (os números derivados vêm das regras do sistema) e a abre na tela. Devolve o id. Ameaças usam dossie_ameaca_criar.

Parâmetros:

- `classe`: Só "original". Padrão: combatente.
- `nex`: Só "original". Padrão: 5 (sobrevivente: estágio 1).
- `atributos`: original: for, agi, vig, int, pre (0 a 7; padrão 1). ordem2: Físico, Mente, Emoção.
- `conceito`: Vai para a história da ficha.

## dossie_ficha_editar

Edita campos simples de uma ficha (texto e números; veja a lista em "campos"). Se a ficha não foi criada pelo assistente, o mestre confirma na aba do Dossiê. Não apaga fichas nem mexe em retrato, licença do bestiário ou pastas.

Parâmetros:

- `campos`: Campos por tipo de ficha. Ameaça: nome, subtitulo, vd, pv, pvMax, defesa, tipo, tamanho, notas. ordem2: nome, ocupacao, historia, pv, pvMax, pd, pdMax. original: nome, jogador, historia, pv, pe, san.
- `campos.nome`: Nome da ameaça.
- `campos.subtitulo`: Subtítulo (ex.: "SANGUE").
- `campos.vd`: Valor de Desafio (só o rótulo; não recalcula os números).
- `campos.pv`: PV atuais.
- `campos.pvMax`: PV máximos.
- `campos.defesa`: Defesa.
- `campos.tipo`: Tipo da criatura (Criatura, Relíquia, Humano, Animal, Veículo).
- `campos.tamanho`: Tamanho: Minúsculo, Pequeno, Médio, Grande, Enorme, Colossal.
- `campos.notas`: Notas do mestre (texto livre).
- `campos.ocupacao`: Ocupação.
- `campos.historia`: História / anotações.
- `campos.pd`: PD (Pontos de Determinação) atuais.
- `campos.pdMax`: PD máximos.
- `campos.jogador`: Nome do jogador.
- `campos.pe`: PE atuais.
- `campos.san`: Sanidade atual.

## dossie_ficha_ler

Lê uma ficha em resumo legível: nome, sistema, atributos, PV/PD e, para ameaça, VD, elementos, defesa, salvaguardas e ações.

Parâmetros:

- `id`: Id da ficha (de dossie_fichas_listar).

## dossie_fichas_listar

Lista as fichas do Dossiê (personagens e ameaças): id, ref, nome, tipo, sistema. Filtre por tipo ou por parte do nome.

Parâmetros:

- `busca`: Parte do nome, sem diferenciar maiúsculas e acentos.

