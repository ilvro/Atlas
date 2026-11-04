import type { Ponto } from '../domain/mapa.ts';
import type { Acao, Licao, Passo } from './tutor.ts';

/** As pastas da lista de tutoriais, em ordem; uma lição escolhe a sua com `pasta`. */
export const PASTAS_DE_LICOES = [
  { id: 'comecar', nome: 'Primeiros passos', sobre: 'A casa, o assistente e o terreno em volta.' },
  { id: 'cena', nome: 'Luz e clima', sobre: 'A mesma casa de dia, na tempestade e no apagão.' },
  { id: 'mesa', nome: 'Na mesa', sobre: 'Conduzir a sessão: peças, portas, o que mostrar e o projetor.' },
];

// ---------- Os lugares do mapa de treino (em metros; a grade é de 1,5 m e os pontos caem no meio das células) ----------
type Retangulo = readonly [Ponto, Ponto];
/** Três cômodos que se tocam: a sala e a cozinha lado a lado, o quarto embaixo da sala. */
export const SALA: Retangulo = [[3.75, 3.75], [8.25, 8.25]], COZINHA: Retangulo = [[9.75, 3.75], [14.25, 8.25]], QUARTO: Retangulo = [[3.75, 9.75], [8.25, 12.75]];
/** Onde as paredes se tocam: aí cabe uma porta. */
export const PAREDE_SALA_COZINHA: Ponto = [9, 6], PAREDE_SALA_QUARTO: Ponto = [6, 9];
/** A casa das lições de terreno e clima, no meio do mapa de 45 × 30 m. */
export const CASA: Retangulo = [[18.75, 11.25], [26.25, 17.25]];

const tid = (id: string) => `[data-testid="${id}"]`;
const campo = (rotulo: string, tipo = 'input') => `[data-campo="${rotulo}"] ${tipo}`;
const clicar = (id: string): Acao => ['clicar', tid(id)];

/** Pega a ferramenta pela barra (o passo termina quando a ferramenta está na mão). */
const ferramenta = (nome: string, diga: string, porque?: string, aprendeu?: Passo['aprendeu']): Passo => ({ diga, ...(porque ? { porque } : {}), alvo: tid(`ferramenta-${nome}`), feito: ['ferramenta', nome], acao: clicar(`ferramenta-${nome}`), ...(aprendeu ? { aprendeu } : {}) });
/** Escolhe o tipo do cômodo e pinta um retângulo (Shift + arrasto). */
const comodo = (tipo: string, funcao: string, [a, b]: Retangulo, diga: string, porque?: string): Passo => ({ diga, ...(porque ? { porque } : {}), alvo: tid(`comodo-${tipo}`), ponto: [a, b], feito: ['comodoComFuncao', funcao], acao: [clicar(`comodo-${tipo}`), ['retangulo', a, b]] });
const porta = (nome: string, ponto: Ponto, n: number): Passo => ({ diga: `Clique na parede entre ${nome}, no ponto marcado: ali nasce uma porta.`, alvo: tid('abertura-door'), ponto, feito: ['aberturas', 'door', n], acao: ['mapa', ponto] });
const ler = (diga: string, porque?: string): Passo => ({ diga, ...(porque ? { porque } : {}), feito: ['ler'] });

/** Uma lição de dois passos só para os testes do motor: pegar a ferramenta e pintar um cômodo, com cliques de verdade. */
const TESTE: Licao = {
  id: 'teste-do-motor', titulo: 'Teste do motor', minutos: 1, oculta: true,
  passos: [
    { diga: 'Pegue a ferramenta <b>Cômodo</b>.', alvo: tid('ferramenta-comodo'), feito: ['ferramenta', 'comodo'], acao: clicar('ferramenta-comodo') },
    { diga: 'Pinte um cômodo arrastando <b>com Shift</b> no ponto marcado.', ponto: [[3.75, 3.75], [8.25, 8.25]], feito: ['comodos', 1], acao: ['retangulo', [3.75, 3.75], [8.25, 8.25]], aprendeu: ['Shift', 'arrasta um retângulo de cômodo'] },
  ],
};

const PRIMEIRA_CASA: Licao = {
  id: 'primeira-casa', titulo: 'Primeira casa', minutos: 6, mapa: { largura: 18, altura: 15 }, pasta: 'comecar', proxima: 'assistente',
  resumo: 'Três cômodos, duas portas, um sofá e uma lamparina, cada valor escolhido por você.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'A barra da esquerda tem tudo o que se põe no mapa. A gaveta ao lado mostra as opções da ferramenta.', ['C', 'ferramenta de cômodo']), etapa: 'Os cômodos' },
    comodo('sala', 'sala', SALA, 'Escolha <b>Sala</b> e pinte, segurando <b>Shift</b>, do primeiro ao segundo ponto marcado.', 'O tipo já traz um piso e um papel de parede que combinam. Shift pinta um retângulo de uma vez.'),
    comodo('cozinha', 'cozinha', COZINHA, 'Agora a <b>Cozinha</b>, ao lado da sala.'),
    comodo('quarto', 'quarto', QUARTO, 'E o <b>Quarto</b>, embaixo da sala.'),
    { ...ferramenta('abertura', 'Pegue a ferramenta <b>Abertura</b>.'), etapa: 'As portas' },
    porta('a sala e a cozinha', PAREDE_SALA_COZINHA, 1),
    porta('a sala e o quarto', PAREDE_SALA_QUARTO, 2),
    { ...ferramenta('objeto', 'Pegue a ferramenta <b>Objeto</b>.'), etapa: 'Os móveis' },
    { diga: 'Escolha o <b>Sofá</b> e clique dentro da sala, no ponto marcado.', alvo: tid('receita-sofa'), ponto: [6, 7.5], feito: ['objetoDe', 'sofa'], acao: [clicar('receita-sofa'), ['mapa', [6, 7.5]]], porque: 'O móvel vira um objeto comum: dá para mover, girar e trocar depois.' },
    { diga: 'Ponha uma <b>cama de casal</b> no quarto.', alvo: tid('receita-cama.casal'), ponto: [6, 11.25], feito: ['objetoDe', 'cama.casal'], acao: [clicar('receita-cama.casal'), ['mapa', [6, 11.25]]] },
    { ...ferramenta('luz', 'Pegue a ferramenta <b>Luz</b>.'), etapa: 'A luz' },
    { diga: 'Escolha a <b>Lamparina</b> e clique na sala, no ponto marcado.', alvo: tid('luz-lamparina'), ponto: [6, 5.25], feito: ['luzComPreset', 'lamparina'], acao: [clicar('luz-lamparina'), ['mapa', [6, 5.25]]] },
    { ...ferramenta('selecionar', 'Pegue a ferramenta <b>Selecionar</b> e clique na luz que você pôs.', 'O que está posto se ajusta no inspetor, na coluna da direita.', ['1', 'seleciona']), etapa: 'Os valores', feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'lights', [6, 5.25]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [6, 5.25]]], ponto: [6, 5.25] },
    { diga: 'Abra a aba <b>Seleção</b> e ponha o <b>Alcance</b> em <b>7</b> metros.', alvo: campo('Alcance'), feito: ['valor', 'lights.*.radius', 7], aba: 'selecao', acao: [clicar('aba-selecao'), ['preencher', campo('Alcance'), '7']], porque: 'O alcance é quanto a luz chega, em metros, antes de as paredes pararem a sombra.' },
    { diga: 'Baixe a <b>Intensidade</b> para <b>0,9</b>.', alvo: campo('Intensidade'), feito: ['valor', 'lights.*.intensity', 0.9], acao: ['preencher', campo('Intensidade'), '0.9'] },
    ler('A sua primeira casa está pronta: três cômodos, duas portas, móveis e uma luz. Grave com <b>Ctrl+S</b> se quiser guardar este mapa de treino.'),
  ],
};

const ASSISTENTE: Licao = {
  id: 'assistente', titulo: 'O assistente', assistente: true, mapa: { largura: 18, altura: 12 }, minutos: 5, pasta: 'comecar', proxima: 'terreno-e-espalhar',
  resumo: 'Dar nome aos cômodos, aceitar as sugestões do assistente e ajustar o que não gostou.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.'), etapa: 'Dois cômodos' },
    comodo('sala', 'sala', SALA, 'Pinte uma <b>Sala</b> (Shift + arrasto) entre os pontos marcados.'),
    comodo('cozinha', 'cozinha', COZINHA, 'E uma <b>Cozinha</b> ao lado.'),
    { ...ferramenta('selecionar', 'Pegue <b>Selecionar</b> e clique no meio da sala.'), etapa: 'O assistente', feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'rooms', [6, 6]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [6, 6]]], ponto: [6, 6] },
    { diga: 'Abra a aba <b>Seleção</b> e dê o nome <b>Sala</b> ao cômodo.', alvo: campo('Nome'), feito: ['comodoNomeado', 'Sala'], aba: 'selecao', acao: [clicar('aba-selecao'), ['preencher', campo('Nome'), 'Sala']], porque: 'Com o nome (e o tipo) o assistente entende para que serve o cômodo e passa a sugerir o que falta nele.' },
    { diga: 'Uma <b>pílula</b> sugere o próximo passo. <b>Aceite</b> as sugestões até a sala ter pelo menos três objetos.', alvo: tid('pilula-aceitar'), feito: ['objetos', 3], acao: [clicar('pilula-aceitar'), clicar('pilula-aceitar'), clicar('pilula-aceitar'), clicar('pilula-aceitar')], porque: 'Cada sugestão aparece primeiro em verde, como prévia. Nada entra antes de você aceitar, e Ctrl+Z desfaz.', aprendeu: ['Ctrl+Z', 'desfaz a última sugestão aceita'] },
    { ...ferramenta('selecionar', 'Clique no meio da <b>cozinha</b>.'), etapa: 'Ajustar', feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'rooms', [12, 6]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [12, 6]]], ponto: [12, 6] },
    { diga: 'Dê o nome <b>Cozinha</b> a este cômodo.', alvo: campo('Nome'), feito: ['comodoNomeado', 'Cozinha'], acao: ['preencher', campo('Nome'), 'Cozinha'] },
    { diga: 'Não gostou do piso? No cartão acima do cômodo, troque o <b>Piso</b> para <b>Ladrilho azul</b>.', alvo: '[aria-label="Piso"]', feito: ['comodoComPiso', 'ladrilho.azul'], acao: ['escolher', '[aria-label="Piso"]', 'ladrilho.azul'], valores: '<b>Piso</b>: Ladrilho azul', porque: 'O assistente propõe, você decide: tudo o que ele faz são objetos e valores comuns, editáveis como os que você põe à mão.' },
    ler('Pronto: o assistente monta o que faz sentido para o cômodo, e você muda o que quiser.'),
  ],
};

const TERRENO_E_ESPALHAR: Licao = {
  id: 'terreno-e-espalhar', titulo: 'Espalhar e terreno', minutos: 5, pasta: 'comecar', proxima: 'climas',
  resumo: 'Um jardim e um bosque em volta da casa: terreno pintado e objetos espalhados com um pincel.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.'), etapa: 'A casa' },
    comodo('sala', 'sala', CASA, 'Pinte uma <b>Sala</b> no meio do mapa, entre os pontos marcados.'),
    { ...ferramenta('terreno', 'Pegue a ferramenta <b>Terreno</b>.'), etapa: 'O chão' },
    { diga: 'Em <b>Base do mapa</b>, escolha <b>Grama</b>: ela cobre o mapa todo, por baixo de tudo.', alvo: campo('Base do mapa', 'select'), feito: ['terrenoBase', 'grama'], acao: ['escolher', campo('Base do mapa', 'select'), 'grama'] },
    { diga: 'Escolha <b>Terra</b> e arraste do ponto marcado até o outro: é o caminho da porta.', alvo: tid('terreno-terra'), ponto: [[22.5, 18.75], [22.5, 25.5]], feito: ['terrenoCom', 'terra'], acao: [clicar('terreno-terra'), ['arrastar', [22.5, 18.75], [22.5, 25.5]]], porque: 'As bordas se misturam sozinhas, e cada pincelada é uma ação que se desfaz.' },
    { ...ferramenta('espalhar', 'Pegue a ferramenta <b>Espalhar</b>.'), etapa: 'O bosque' },
    { diga: 'Escolha a <b>Mata</b> e ponha o <b>Pincel</b> em <b>4</b> metros.', alvo: tid('espalhar-mata'), feito: ['espalhar', 'mata', 4], acao: [clicar('espalhar-mata'), ['preencher', campo('Pincel'), '4']], valores: '<b>Pincel</b>: 4' },
    { diga: 'Arraste ao longo do alto do mapa, do primeiro ao segundo ponto, para plantar o bosque.', ponto: [[3, 3], [42, 3]], feito: ['objetos', 8], acao: ['arrastar', [3, 3], [42, 3]], porque: 'Cada pincelada espalha árvores, arbustos e pedras no conjunto, longe das portas.' },
    { diga: 'Troque para o <b>Jardim</b> e arraste junto da casa, nos pontos marcados.', alvo: tid('espalhar-jardim'), ponto: [[18, 19.5], [27, 19.5]], feito: ['objetos', 14], acao: [clicar('espalhar-jardim'), ['arrastar', [18, 19.5], [27, 19.5]], ['arrastar', [18, 21], [27, 21]]] },
    ler('A casa agora tem chão e vizinhança. Cada árvore é um objeto comum: dá para selecionar, mover ou apagar.'),
  ],
};

const CLIMAS: Licao = {
  id: 'climas', titulo: 'Climas', minutos: 6, pasta: 'cena', proxima: 'sessao',
  resumo: 'A mesma casa de dia, na tempestade e no apagão, com luz quente por dentro e fria por fora.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.'), etapa: 'A casa' },
    comodo('sala', 'sala', CASA, 'Pinte uma <b>Sala</b> entre os pontos marcados.'),
    { ...ferramenta('luz', 'Pegue a ferramenta <b>Luz</b>.') },
    { diga: 'Escolha a <b>Lamparina</b> e clique dentro da casa, no ponto marcado.', alvo: tid('luz-lamparina'), ponto: [22.5, 14.25], feito: ['luzComPreset', 'lamparina'], acao: [clicar('luz-lamparina'), ['mapa', [22.5, 14.25]]], porque: 'A luz da lamparina é quente. A do ambiente, lá fora, vai ser fria: é isso que faz a casa parecer habitada.' },
    { ...ferramenta('selecionar', 'Selecione a lamparina: clique nela.'), feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'lights', [22.5, 14.25]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [22.5, 14.25]]], ponto: [22.5, 14.25] },
    { diga: 'Na aba <b>Seleção</b>, ponha o <b>Alcance</b> em <b>8</b> metros.', alvo: campo('Alcance'), feito: ['valor', 'lights.*.radius', 8], aba: 'selecao', acao: [clicar('aba-selecao'), ['preencher', campo('Alcance'), '8']] },
    { diga: 'Deixe a <b>Intensidade</b> em <b>1,2</b>.', alvo: campo('Intensidade'), feito: ['valor', 'lights.*.intensity', 1.2], acao: ['preencher', campo('Intensidade'), '1.2'] },
    { diga: 'Abra a aba <b>Mapa</b>: os climas ficam lá.', alvo: tid('aba-mapa'), feito: ['aba', 'mapa'], acao: clicar('aba-mapa'), etapa: 'Os climas' },
    { diga: 'Escolha o clima <b>Tarde</b>: a casa de dia.', alvo: tid('clima-tarde'), feito: ['climaE', 'tarde'], acao: clicar('clima-tarde') },
    { diga: 'Agora a <b>Tempestade</b>, e ponha a <b>Chuva</b> em <b>0,8</b>.', alvo: tid('clima-tempestade'), feito: ['valor', 'climate.weather.rain', 0.8], acao: [clicar('clima-tempestade'), ['preencher', campo('Chuva'), '0.8']], valores: '<b>Chuva</b>: 0,8', porque: 'Um clima é um conjunto de valores: luz do ambiente, chuva, vento, neblina. Mudar um deles muda a cena ao vivo.' },
    { diga: 'Termine com a <b>Noite</b>.', alvo: tid('clima-noite'), feito: ['climaE', 'noite'], acao: clicar('clima-noite') },
    { diga: 'Corte a <b>Energia da rede</b>: é o apagão.', alvo: campo('Energia da rede'), feito: ['valor', 'climate.gridPower', false], acao: clicar_campo('Energia da rede'), porque: 'A lamparina é de fogo e continua acesa; só as luzes de rede elétrica apagam.' },
    { diga: 'No <b>Acabamento</b>, ponha a <b>Vinheta</b> em <b>0,4</b>.', alvo: campo('Vinheta'), feito: ['valor', 'finish.vignette', 0.4], acao: ['preencher', campo('Vinheta'), '0.4'], etapa: 'O acabamento' },
    { diga: 'E o <b>Grão</b> em <b>0,05</b>.', alvo: campo('Grão'), feito: ['valor', 'finish.grain', 0.05], acao: ['preencher', campo('Grão'), '0.05'] },
    ler('A mesma casa de dia, na tempestade e no apagão. Para ir de um clima a outro na sessão, use o dock (Sessão → Clima).'),
  ],
};

function clicar_campo(rotulo: string): Acao { return ['clicar', campo(rotulo)]; }

const SESSAO: Licao = {
  id: 'sessao', titulo: 'Sessão', minutos: 6, pasta: 'mesa',
  resumo: 'Duas peças de jogador, uma porta aberta, a vista dos jogadores e o projetor.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.'), etapa: 'A casa' },
    comodo('sala', 'sala', SALA, 'Pinte uma <b>Sala</b> entre os pontos marcados.'),
    comodo('cozinha', 'cozinha', COZINHA, 'E uma <b>Cozinha</b> ao lado.'),
    { ...ferramenta('abertura', 'Pegue a ferramenta <b>Abertura</b>.') },
    porta('a sala e a cozinha', PAREDE_SALA_COZINHA, 1),
    { ...ferramenta('peca', 'Pegue a ferramenta <b>Peça</b>.'), etapa: 'Os jogadores' },
    { diga: 'Clique duas vezes na sala, nos pontos marcados: são as duas peças.', ponto: [[4.5, 6.75], [7.5, 6.75]], feito: ['pecas', 2], acao: [['mapa', [4.5, 6.75]], ['mapa', [7.5, 6.75]]], porque: 'Uma peça é um personagem no mapa. Deixe espaço entre elas: o cartão de ações aparece em cima da peça selecionada.' },
    { ...ferramenta('selecionar', 'Pegue <b>Selecionar</b> e clique na primeira peça.'), feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'tokens', [4.5, 6.75]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [4.5, 6.75]]], ponto: [4.5, 6.75] },
    { diga: 'Na aba <b>Seleção</b>, marque <b>Jogador</b>: a névoa e a visão da sessão vêm das peças de jogador.', alvo: campo('Jogador'), feito: ['pecasDeJogador', 1], aba: 'selecao', acao: [clicar('aba-selecao'), ['clicar', campo('Jogador')]] },
    { diga: 'Clique na segunda peça e marque <b>Jogador</b> também.', alvo: campo('Jogador'), ponto: [7.5, 6.75], feito: ['pecasDeJogador', 2], acao: [['mapa', [7.5, 6.75]], ['clicar', campo('Jogador')]] },
    { diga: 'Entre na <b>Sessão</b>.', alvo: tid('modo-sessao'), feito: ['modo', 'sessao'], acao: clicar('modo-sessao'), etapa: 'A sessão', porque: 'Na Sessão o mapa deixa de se editar: peças andam, portas abrem, e o dock tem clima, cena e projetor.', aprendeu: ['M', 'alterna Construir e Sessão'] },
    { diga: 'Clique na porta, no ponto marcado, para abri-la.', ponto: PAREDE_SALA_COZINHA, feito: ['portaAberta', 1], acao: ['mapa', PAREDE_SALA_COZINHA] },
    { diga: 'Veja pelos olhos dos jogadores: clique em <b>Ver como jogador</b>.', alvo: tid('vista-jogador'), feito: ['vista', 'jogador'], acao: clicar('vista-jogador'), porque: 'Só aparece o que as peças de jogador enxergam; o resto fica escuro. A porta aberta deixa ver a cozinha.' },
    { diga: 'Abra a seção <b>Projetor</b> do dock e clique em <b>Abrir o projetor</b>: é a janela para a TV ou o monitor da mesa.', alvo: tid('dock-titulo-projetor'), feito: ['projetor'], acao: [clicar('dock-titulo-projetor'), clicar('dock-projetor-abrir')], porque: 'O projetor mostra só o que os jogadores podem ver: nada de notas, regiões do mestre ou peças escondidas.' },
    ler('Pronto: o mestre vê tudo, o projetor mostra o que os jogadores veem, e você conduz a cena sem sair do mapa.'),
  ],
};

export const LICOES: readonly Licao[] = [TESTE, PRIMEIRA_CASA, ASSISTENTE, TERRENO_E_ESPALHAR, CLIMAS, SESSAO];
