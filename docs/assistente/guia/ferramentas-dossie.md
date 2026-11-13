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
- `numeros`: Números diretos, para ameaças de outro sistema (ex.: Ordem 2 / OP2), cuja tabela não é a do VD. O que vier aqui substitui o calculado pelo VD; o que for omitido continua vindo do VD. Campos (todos opcionais, inteiros, com limites; fora da faixa vira erro com a mensagem do campo):
  - `pv` (1 a 99999; vale para PV atuais e máximos), `defesa` (0 a 200), `deslocamento` (metros, 0 a 300), `dtPresenca` (0 a 100; erro se a ameaça não tem presença perturbadora, como a mundana).
  - `fortitude`, `reflexos`, `vontade`: bônus da salvaguarda (0 a 200). Os dados do teste seguem o atributo (Vigor, Agilidade, Presença).
  - `atributos`: objeto com `for`, `agi`, `int`, `pre`, `vig` (0 a 20); só troca os informados e atualiza os dados das salvaguardas e sentidos.
  - `pericias`: lista de `{ nome, dados, bonus }` (substitui a lista).
  - `resistencias`: lista de `{ tipo, valor }`; `vulnerabilidades` e `imunidades`: listas de textos (cada uma substitui a lista).

A resposta traz o resumo da ficha com os números finais (PV, defesa, salvaguardas, deslocamento, perícias, resistências). Exemplo para uma criatura do OP2: `numeros: { pv: 10, defesa: 14, fortitude: 4, reflexos: 6, vontade: 2 }`.

## dossie_ficha_criar

Cria uma ficha de personagem mínima e coerente (os números derivados vêm das regras do sistema) e a abre na tela. Devolve o id. Ameaças usam dossie_ameaca_criar.

Parâmetros:

- `classe`: Só "original". Padrão: combatente.
- `nex`: Só "original". Padrão: 5 (sobrevivente: estágio 1).
- `atributos`: original: for, agi, vig, int, pre (0 a 7; padrão 1). ordem2: Físico, Mente, Emoção.
- `conceito`: Vai para a história da ficha.

## dossie_ficha_editar

Edita campos simples de uma ficha (texto e números; veja a lista em "campos"). Se a ficha não foi criada pelo assistente, o mestre confirma na aba do Dossiê. Não apaga fichas nem mexe em retrato, licença do bestiário ou pastas.

A ferramenta nunca responde sucesso sem o campo ter mudado: depois de salvar, ela relê a ficha, e se algum campo voltou ao valor anterior a resposta é erro, dizendo quais campos não ficaram (os demais foram gravados). Na resposta de sucesso, `gravado` mostra o valor que ficou em cada campo pedido. A ocupação (`ocupacao`) é texto livre, sem lista fixa: o que o assistente enviar é o que a ficha exibe, e não há bônus ligados a ela.

Parâmetros:

- `campos`: Campos por tipo de ficha. Ameaça: nome, subtitulo, vd, pv, pvMax, defesa, fortitude, reflexos, vontade, deslocamento, dtPresenca, atributos, pericias, resistencias, vulnerabilidades, imunidades, tipo, tamanho, notas. ordem2: nome, ocupacao, historia, pv, pvMax, pd, pdMax. original: nome, jogador, historia, pv, pe, san.
- `campos.nome`: Nome da ameaça.
- `campos.subtitulo`: Subtítulo (ex.: "SANGUE").
- `campos.vd`: Valor de Desafio (só o rótulo; não recalcula os números).
- `campos.pv`: PV atuais.
- `campos.pvMax`: PV máximos (1 ou mais; se baixar abaixo dos PV atuais, os atuais acompanham).
- `campos.defesa`: Defesa.
- `campos.fortitude`, `campos.reflexos`, `campos.vontade`: Bônus da salvaguarda (0 a 200); os dados seguem o atributo.
- `campos.deslocamento`: Deslocamento em metros (0 a 300).
- `campos.dtPresenca`: DT da presença perturbadora (0 a 100); erro se a ameaça não tem presença.
- `campos.atributos`: Atributos { for, agi, int, pre, vig } (0 a 20); troca só os informados.
- `campos.pericias`: Perícias [{ nome, dados, bonus }]; substitui a lista.
- `campos.resistencias`: Resistências a dano [{ tipo, valor }]; substitui a lista.
- `campos.vulnerabilidades`, `campos.imunidades`: Listas de textos; substituem a lista.
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

