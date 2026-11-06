import type { Ponto } from '../domain/mapa.ts';
import type { Acao, Licao, Passo } from './tutor.ts';

/** As pastas da lista de tutoriais, em ordem; uma lição escolhe a sua com `pasta`. */
export const PASTAS_DE_LICOES = [
  { id: 'comecar', nome: 'Primeiros passos', sobre: 'A casa, o assistente inteligente e o terreno em volta.' },
  { id: 'cena', nome: 'Luz e clima', sobre: 'A mesma casa de dia, na tempestade e no apagão.' },
  { id: 'mesa', nome: 'Na mesa e campanha', sobre: 'Conduzir a sessão, projetor, regiões/gatilhos e a plataforma Mesa.' },
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
const porta = (nome: string, ponto: Ponto, n: number): Passo => ({ diga: `Clique na parede entre ${nome}, no ponto marcado: ali nasce uma porta.`, alvo: tid('abertura-door'), ponto, feito: ['aberturas', 'door', n], acao: ['mapa', ponto], porque: 'Portas posicionadas na divisória separam os ambientes. Na sessão, elas bloqueiam visão e iluminação quando fechadas.' });
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
  resumo: 'Três cômodos, duas portas, um sofá e uma lamparina: aprenda os 5 pilares de construção do Atlas.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'O cômodo é a unidade estrutural do Atlas: você desenha a área interna e o sistema ergue as paredes e o piso automaticamente.', ['C', 'ferramenta de cômodo']), etapa: 'Os cômodos' },
    comodo('sala', 'sala', SALA, 'Escolha <b>Sala</b> e pinte, segurando <b>Shift</b>, do primeiro ao segundo ponto marcado.', 'O tipo Sala já define o piso de madeira e o papel de parede adequados. Shift permite arrastar um retângulo perfeito de uma só vez.'),
    comodo('cozinha', 'cozinha', COZINHA, 'Agora a <b>Cozinha</b>, desenhada encostada na sala.', 'Quando dois cômodos se encostam, a parede entre eles vira uma divisória interna compartilhada, pronta para receber portas.'),
    comodo('quarto', 'quarto', QUARTO, 'E o <b>Quarto</b>, embaixo da sala.', 'Cada novo cômodo conecta sua estrutura à planta existente de forma limpa, sem frestas ou paredes duplicadas.'),
    { ...ferramenta('abertura', 'Pegue a ferramenta <b>Abertura</b>.', 'Aberturas recortam as paredes para criar portas, janelas e arcos que interagem com o sistema de visão e luz.', ['D', 'aberturas']), etapa: 'As portas' },
    porta('a sala e a cozinha', PAREDE_SALA_COZINHA, 1),
    porta('a sala e o quarto', PAREDE_SALA_QUARTO, 2),
    { ...ferramenta('objeto', 'Pegue a ferramenta <b>Objeto</b>.', 'A ferramenta Objeto acessa a biblioteca de móveis procedurais e adereços da cena.', ['O', 'objeto']), etapa: 'Os móveis' },
    { diga: 'Escolha o <b>Sofá</b> e clique dentro da sala, no ponto marcado.', alvo: tid('receita-sofa'), ponto: [6, 7.5], feito: ['objetoDe', 'sofa'], acao: [clicar('receita-sofa'), ['mapa', [6, 7.5]]], porque: 'O sofá é criado como um objeto comum: você pode girar (Q e E), duplicar (Ctrl+arrastar) ou reposicionar quando quiser.' },
    { diga: 'Ponha uma <b>cama de casal</b> no quarto.', alvo: tid('receita-cama.casal'), ponto: [6, 11.25], feito: ['objetoDe', 'cama.casal'], acao: [clicar('receita-cama.casal'), ['mapa', [6, 11.25]]], porque: 'As receitas procedurais geram variações temáticas ricas que respeitam a escala em metros da grade.' },
    { ...ferramenta('luz', 'Pegue a ferramenta <b>Luz</b>.', 'O Atlas calcula iluminação 2D dinâmica em tempo real: raios de luz colidem com paredes e portas projetando sombras.', ['L', 'luz']), etapa: 'A iluminação' },
    { diga: 'Escolha a <b>Lamparina</b> e clique na sala, no ponto marcado.', alvo: tid('luz-lamparina'), ponto: [6, 5.25], feito: ['luzComPreset', 'lamparina'], acao: [clicar('luz-lamparina'), ['mapa', [6, 5.25]]], porque: 'A lamparina emite luz viva e quente de fogo, que permanece acesa mesmo durante tempestades ou apagões na rede elétrica.' },
    { ...ferramenta('selecionar', 'Pegue a ferramenta <b>Selecionar</b> e clique na luz que você pôs.', 'A ferramenta Selecionar permite inspecionar qualquer entidade para ajuste fino no Inspetor à direita.', ['1', 'seleciona']), etapa: 'Ajuste fino no inspetor', feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'lights', [6, 5.25]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [6, 5.25]]], ponto: [6, 5.25] },
    { diga: 'Abra a aba <b>Seleção</b> e ponha o <b>Alcance</b> em <b>7</b> metros.', alvo: campo('Alcance'), feito: ['valor', 'lights.*.radius', 7], aba: 'selecao', acao: [clicar('aba-selecao'), ['preencher', campo('Alcance'), '7']], porque: 'O alcance define o raio máximo de propagação da luz em metros antes de se dissipar completamente.' },
    { diga: 'Baixe a <b>Intensidade</b> para <b>0,9</b>.', alvo: campo('Intensidade'), feito: ['valor', 'lights.*.intensity', 0.9], acao: ['preencher', campo('Intensidade'), '0.9'], porque: 'A intensidade regula o brilho central e o contraste da iluminação sobre os móveis e o piso.' },
    ler('Sua primeira casa está pronta: três cômodos com paredes automáticas, duas portas táticas, móveis procedurais e iluminação com sombra dinâmica. Pressione Ctrl+S para gravar se quiser guardar este mapa.'),
  ],
};

const ASSISTENTE: Licao = {
  id: 'assistente', titulo: 'O assistente', assistente: true, mapa: { largura: 18, altura: 12 }, minutos: 5, pasta: 'comecar', proxima: 'terreno-e-espalhar',
  resumo: 'Construção assistida: como o assistente lê o nome do cômodo e sugere portas, mobília, piso e luzes.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'O assistente inteligente acelera a construção: ele analisa a geometria e a função do cômodo para sugerir mobília e aberturas.', ['C', 'cômodo']), etapa: 'Dois cômodos' },
    comodo('sala', 'sala', SALA, 'Pinte uma <b>Sala</b> (Shift + arrasto) entre os pontos marcados.', 'Começamos desenhando os dois espaços que serão decorados com o auxílio do assistente.'),
    comodo('cozinha', 'cozinha', COZINHA, 'E uma <b>Cozinha</b> ao lado.', 'As paredes compartilhadas serão usadas pelo assistente para sugerir portas de passagem.'),
    { ...ferramenta('selecionar', 'Pegue <b>Selecionar</b> e clique no meio da sala.', 'Para o assistente entender o cômodo, selecione-o para inspecionar suas propriedades.', ['V', 'selecionar']), etapa: 'Construção assistida', feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'rooms', [6, 6]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [6, 6]]], ponto: [6, 6] },
    { diga: 'Abra a aba <b>Seleção</b> e dê o nome <b>Sala</b> ao cômodo.', alvo: campo('Nome'), feito: ['comodoNomeado', 'Sala'], aba: 'selecao', acao: [clicar('aba-selecao'), ['preencher', campo('Nome'), 'Sala']], porque: 'O segredo da construção assistida: o nome informa a intenção do espaço (Sala, Quarto, Cozinha, etc.), guiando as receitas que o assistente seleciona.' },
    { diga: 'Uma <b>pílula flutuante</b> sugere o próximo passo. <b>Aceite</b> as sugestões clicando nela até a sala ter pelo menos três objetos.', alvo: tid('pilula-aceitar'), feito: ['objetos', 3], acao: [clicar('pilula-aceitar'), clicar('pilula-aceitar'), clicar('pilula-aceitar'), clicar('pilula-aceitar')], porque: 'A pílula mostra uma prévia verde translúcida. O texto aceita a proposta; o botão ↻ gera uma alternativa; o botão ✕ descarta; e Ctrl+Z desfaz com facilidade.', aprendeu: ['Ctrl+Z', 'desfaz a última sugestão aceita'] },
    { ...ferramenta('selecionar', 'Clique no meio da <b>cozinha</b>.', 'Vamos agora orientar o assistente no segundo cômodo.'), etapa: 'Ajuste manual e controle', feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'rooms', [12, 6]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [12, 6]]], ponto: [12, 6] },
    { diga: 'Dê o nome <b>Cozinha</b> a este cômodo.', alvo: campo('Nome'), feito: ['comodoNomeado', 'Cozinha'], acao: ['preencher', campo('Nome'), 'Cozinha'], porque: 'Ao identificar a Cozinha, o assistente atualiza a função do espaço e passa a sugerir itens culinários, pias e armários.' },
    { diga: 'Não gostou do piso? No cartão acima do cômodo, troque o <b>Piso</b> para <b>Ladrilho azul</b>.', alvo: '[aria-label="Piso"]', feito: ['comodoComPiso', 'ladrilho.azul'], acao: ['escolher', '[aria-label="Piso"]', 'ladrilho.azul'], valores: '<b>Piso</b>: Ladrilho azul', porque: 'O assistente propõe um ponto de partida, mas você mantém controle total: tudo o que ele gera são objetos comuns editáveis no Inspetor.' },
    ler('Construção assistida concluída! O assistente sugere mobília, portas e luzes de acordo com o gênero do mapa e o nome do cômodo. Para ligar ou desligar as sugestões durante edições livres, use o Inspetor (Mapa → Acabamento → Sugestões do assistente) ou a paleta Ctrl+K.'),
  ],
};

const TERRENO_E_ESPALHAR: Licao = {
  id: 'terreno-e-espalhar', titulo: 'Espalhar e terreno', minutos: 5, pasta: 'comecar', proxima: 'climas',
  resumo: 'Pintura de terreno orgânico e distribuição rápida de vegetação e rochas com o pincel de espalhar.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'Vamos posicionar uma residência isolada para criar a vizinhança e o terreno ao redor dela.', ['C', 'cômodo']), etapa: 'A casa' },
    comodo('sala', 'sala', CASA, 'Pinte uma <b>Sala</b> no meio do mapa, entre os pontos marcados.', 'A casa centralizada deixa espaço livre ao redor para jardins, caminhos de terra e floresta.'),
    { ...ferramenta('terreno', 'Pegue a ferramenta <b>Terreno</b>.', 'A ferramenta Terreno pinta superfícies no solo (grama, terra, cascalho, água) com bordas orgânicas que se misturam sozinhas.', ['T', 'terreno']), etapa: 'O chão' },
    { diga: 'Em <b>Base do mapa</b>, escolha <b>Grama</b>: ela cobre o mapa todo, por baixo de tudo.', alvo: campo('Base do mapa', 'select'), feito: ['terrenoBase', 'grama'], acao: ['escolher', campo('Base do mapa', 'select'), 'grama'], porque: 'A Base do mapa é o substrato infinito sobre o qual todas as outras camadas de terreno e construções se apoiam.' },
    { diga: 'Escolha <b>Terra</b> e arraste do ponto marcado até o outro: é o caminho da porta.', alvo: tid('terreno-terra'), ponto: [[22.5, 18.75], [22.5, 25.5]], feito: ['terrenoCom', 'terra'], acao: [clicar('terreno-terra'), ['arrastar', [22.5, 18.75], [22.5, 25.5]]], porque: 'As bordas das pinceladas de terreno calculam transições celulares suaves. Se errar um traço, Ctrl+Z desfaz a pincelada inteira.' },
    { ...ferramenta('espalhar', 'Pegue a ferramenta <b>Espalhar</b>.', 'O pincel Espalhar (Scatter) distribui conjuntos de objetos procedurais com rotações e escalas variadas com uma única passada.', ['S', 'espalhar']), etapa: 'O bosque' },
    { diga: 'Escolha a <b>Mata</b> e ponha o <b>Pincel</b> em <b>4</b> metros.', alvo: tid('espalhar-mata'), feito: ['espalhar', 'mata', 4], acao: [clicar('espalhar-mata'), ['preencher', campo('Pincel'), '4']], valores: '<b>Pincel</b>: 4', porque: 'O raio de 4 metros cobre uma faixa ampla com árvores altas, arbustos densos e rochas musgosas.' },
    { diga: 'Arraste ao longo do alto do mapa, do primeiro ao segundo ponto, para plantar o bosque.', ponto: [[3, 3], [42, 3]], feito: ['objetos', 8], acao: ['arrastar', [3, 3], [42, 3]], porque: 'O gerador espalha os elementos com ruído natural, evitando alinhamentos artificiais e respeitando construções.' },
    { diga: 'Troque para o <b>Jardim</b> e arraste junto da casa, nos pontos marcados.', alvo: tid('espalhar-jardim'), ponto: [[18, 19.5], [27, 19.5]], feito: ['objetos', 14], acao: [clicar('espalhar-jardim'), ['arrastar', [18, 19.5], [27, 19.5]], ['arrastar', [18, 21], [27, 21]]], porque: 'O conjunto Jardim traz flores ornamentais e arbustos decorativos, ideais para o perímetro imediato de construções.' },
    ler('A casa agora tem chão vivo e vizinhança natural. Cada árvore e arbusto gerado continua sendo um objeto comum: você pode selecioná-lo para reposicionar, girar ou apagar.'),
  ],
};

const CLIMAS: Licao = {
  id: 'climas', titulo: 'Climas', minutos: 6, pasta: 'cena', proxima: 'sessao',
  resumo: 'Atmosfera, luz dinâmica, clima com partículas e acabamento cinematográfico.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'Vamos preparar um cenário para entender como luzes e clima trabalham juntos.', ['C', 'cômodo']), etapa: 'A casa' },
    comodo('sala', 'sala', CASA, 'Pinte uma <b>Sala</b> entre os pontos marcados.', 'A casa dividirá o ambiente interno do ambiente externo exposto ao clima.'),
    { ...ferramenta('luz', 'Pegue a ferramenta <b>Luz</b>.', 'Iluminação dinâmica cria contraste e atmosfera imersiva.', ['L', 'luz']) },
    { diga: 'Escolha a <b>Lamparina</b> e clique dentro da casa, no ponto marcado.', alvo: tid('luz-lamparina'), ponto: [22.5, 14.25], feito: ['luzComPreset', 'lamparina'], acao: [clicar('luz-lamparina'), ['mapa', [22.5, 14.25]]], porque: 'A lamparina emite luz quente de fogo. O ambiente externo receberá luz fria do clima: esse contraste transmite sensação de acolhimento e abrigo.' },
    { ...ferramenta('selecionar', 'Selecione a lamparina: clique nela.', 'Vamos ajustar o raio de alcance da luz no interior.', ['V', 'selecionar']), feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'lights', [22.5, 14.25]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [22.5, 14.25]]], ponto: [22.5, 14.25] },
    { diga: 'Na aba <b>Seleção</b>, ponha o <b>Alcance</b> em <b>8</b> metros.', alvo: campo('Alcance'), feito: ['valor', 'lights.*.radius', 8], aba: 'selecao', acao: [clicar('aba-selecao'), ['preencher', campo('Alcance'), '8']], porque: 'Com 8 metros de alcance, a luz preenche toda a sala e é ocluída pelas paredes externas.' },
    { diga: 'Deixe a <b>Intensidade</b> em <b>1,2</b>.', alvo: campo('Intensidade'), feito: ['valor', 'lights.*.intensity', 1.2], acao: ['preencher', campo('Intensidade'), '1.2'], porque: 'Uma intensidade ligeiramente maior projeta sombras mais dramáticas sobre os móveis.' },
    { diga: 'Abra a aba <b>Mapa</b>: os climas ficam lá.', alvo: tid('aba-mapa'), feito: ['aba', 'mapa'], acao: clicar('aba-mapa'), etapa: 'Os climas' },
    { diga: 'Escolha o clima <b>Tarde</b>: a casa de dia.', alvo: tid('clima-tarde'), feito: ['climaE', 'tarde'], acao: clicar('clima-tarde'), porque: 'O clima Tarde aplica luz ambiente solar amarelada e sombras projetadas em direção ao leste.' },
    { diga: 'Agora a <b>Tempestade</b>, e ponha a <b>Chuva</b> em <b>0,8</b>.', alvo: tid('clima-tempestade'), feito: ['valor', 'climate.weather.rain', 0.8], acao: [clicar('clima-tempestade'), ['preencher', campo('Chuva'), '0.8']], valores: '<b>Chuva</b>: 0,8', porque: 'O clima Tempestade ativa partículas dinâmicas de chuva e vento que correm pelo mapa, reduzindo a visibilidade geral.' },
    { diga: 'Termine com a <b>Noite</b>.', alvo: tid('clima-noite'), feito: ['climaE', 'noite'], acao: clicar('clima-noite'), porque: 'A Noite mergulha o mapa na escuridão, tornando a lamparina a única fonte segura de visibilidade.' },
    { diga: 'Corte a <b>Energia da rede</b>: é o apagão.', alvo: campo('Energia da rede'), feito: ['valor', 'climate.gridPower', false], acao: clicar_campo('Energia da rede'), porque: 'Cortar a energia da rede apaga lâmpadas elétricas, mas fontes de fogo e tochas continuam acesas.' },
    { diga: 'No <b>Acabamento</b>, ponha a <b>Vinheta</b> em <b>0,4</b>.', alvo: campo('Vinheta'), feito: ['valor', 'finish.vignette', 0.4], acao: ['preencher', campo('Vinheta'), '0.4'], etapa: 'O acabamento', porque: 'A vinheta escurece gradualmente os cantos da tela, focando o olhar na ação central do mapa.' },
    { diga: 'E o <b>Grão</b> em <b>0,05</b>.', alvo: campo('Grão'), feito: ['valor', 'finish.grain', 0.05], acao: ['preencher', campo('Grão'), '0.05'], porque: 'O grão cinematográfico quebra a nitidez digital, adicionando textura orgânica à atmosfera.' },
    ler('A mesma casa de dia, na tempestade e no apagão. Durante a partida, você pode transicionar suavemente entre esses climas pelo dock inferior (Sessão → Clima) sem perder tempo reconfigurando luzes.'),
  ],
};

function clicar_campo(rotulo: string): Acao { return ['clicar', campo(rotulo)]; }

const SESSAO: Licao = {
  id: 'sessao', titulo: 'Sessão', minutos: 6, pasta: 'mesa', proxima: 'regioes',
  resumo: 'Modo Sessão: como conduzir o jogo, névoa de guerra das peças de jogador, portas e projetor.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'Vamos preparar o cenário tático da sessão.', ['C', 'cômodo']), etapa: 'A casa' },
    comodo('sala', 'sala', SALA, 'Pinte uma <b>Sala</b> entre os pontos marcados.', 'A sala será a posição inicial do grupo.'),
    comodo('cozinha', 'cozinha', COZINHA, 'E uma <b>Cozinha</b> ao lado.', 'A cozinha representará o cômodo ainda inexplorado atrás da porta.'),
    { ...ferramenta('abertura', 'Pegue a ferramenta <b>Abertura</b>.', 'Portas controlam a passagem e o campo de visão.') },
    porta('a sala e a cozinha', PAREDE_SALA_COZINHA, 1),
    { ...ferramenta('peca', 'Pegue a ferramenta <b>Peça</b>.', 'Peças (tokens) representam os investigadores e monstros no mapa tático.', ['P', 'peça']), etapa: 'Os jogadores' },
    { diga: 'Clique duas vezes na sala, nos pontos marcados: são as duas peças.', ponto: [[4.5, 6.75], [7.5, 6.75]], feito: ['pecas', 2], acao: [['mapa', [4.5, 6.75]], ['mapa', [7.5, 6.75]]], porque: 'Uma peça é um personagem no mapa. Deixe espaço entre elas: o cartão de ações aparece em cima da peça selecionada.' },
    { ...ferramenta('selecionar', 'Pegue <b>Selecionar</b> e clique na primeira peça.', 'Vamos configurá-la como personagem dos jogadores.', ['V', 'selecionar']), feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'tokens', [4.5, 6.75]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [4.5, 6.75]]], ponto: [4.5, 6.75] },
    { diga: 'Na aba <b>Seleção</b>, marque <b>Jogador</b>: a névoa e a visão da sessão vêm das peças de jogador.', alvo: campo('Jogador'), feito: ['pecasDeJogador', 1], aba: 'selecao', acao: [clicar('aba-selecao'), ['clicar', campo('Jogador')]], porque: 'No Atlas, a névoa de guerra calcula o campo de visão estritamente a partir das peças marcadas como Jogador.' },
    { diga: 'Clique na segunda peça e marque <b>Jogador</b> também.', alvo: campo('Jogador'), ponto: [7.5, 6.75], feito: ['pecasDeJogador', 2], acao: [['mapa', [7.5, 6.75]], ['clicar', campo('Jogador')]], porque: 'Com dois jogadores, suas visões combinadas iluminam o ambiente explorado em conjunto.' },
    { diga: 'Entre na <b>Sessão</b>.', alvo: tid('modo-sessao'), feito: ['modo', 'sessao'], acao: clicar('modo-sessao'), etapa: 'A sessão', porque: 'Na Sessão o mapa fica protegido contra edições acidentais: o mouse passa a arrastar peças, abrir portas e inspecionar cômodos.', aprendeu: ['M', 'alterna Construir e Sessão'] },
    { diga: 'Clique na porta, no ponto marcado, para abri-la.', ponto: PAREDE_SALA_COZINHA, feito: ['portaAberta', 1], acao: ['mapa', PAREDE_SALA_COZINHA], porque: 'Na sessão, clicar em portas e gavetas interage com elas imediatamente, atualizando a linha de visão do grupo.' },
    { diga: 'Veja pelos olhos dos jogadores: clique em <b>Ver como jogador</b>.', alvo: tid('vista-jogador'), feito: ['vista', 'jogador'], acao: clicar('vista-jogador'), porque: 'A vista do jogador escurece tudo o que está fora da visão das peças. A porta aberta permite enxergar o interior da cozinha.' },
    { diga: 'Abra a seção <b>Projetor</b> do dock e clique em <b>Abrir o projetor</b>: é a janela para a TV ou o monitor da mesa.', alvo: tid('dock-titulo-projetor'), feito: ['projetor'], acao: [clicar('dock-titulo-projetor'), clicar('dock-projetor-abrir')], porque: 'O projetor abre uma janela limpa para você mover para a TV ou segundo monitor da sua mesa física, mostrando apenas a visão dos jogadores sem notas de mestre.' },
    ler('Pronto: o mestre tem controle total com anotações e bastidores, o projetor mostra a visão limpa aos jogadores na TV, e a sessão flui sem sair do mapa.'),
  ],
};

const REGIOES: Licao = {
  id: 'regioes', titulo: 'Regiões e gatilhos', minutos: 5, pasta: 'mesa', proxima: 'campanha',
  mapa: { largura: 18, altura: 15 },
  resumo: 'Zonas interativas: crie gatilhos de armadilha com avisos ao mestre e áreas sonoras que disparam o Jukebox.',
  passos: [
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'Vamos preparar duas salas para criar uma zona de gatilho espacial.', ['C', 'cômodo']), etapa: 'O cenário' },
    comodo('sala', 'sala', SALA, 'Pinte uma <b>Sala</b> entre os pontos marcados.', 'A sala será o ponto de partida do investigador.'),
    comodo('cozinha', 'cozinha', COZINHA, 'E a <b>Cozinha</b> ao lado.', 'Na cozinha posicionaremos a nossa região de gatilho.'),
    { ...ferramenta('abertura', 'Pegue a ferramenta <b>Abertura</b>.', 'Portas delimitam a passagem entre os ambientes.') },
    porta('a sala e a cozinha', PAREDE_SALA_COZINHA, 1),
    { ...ferramenta('regiao', 'Pegue a ferramenta <b>Região</b>.', 'Regiões são polígonos que monitoram quando um personagem entra em sua área para disparar avisos ao mestre ou trocar sons.', ['R', 'ferramenta de região']), etapa: 'A região' },
    { diga: 'Clique no meio da cozinha, no ponto marcado: ali nasce uma região.', alvo: tid('ferramenta-regiao'), ponto: [12, 6], feito: ['regioes', 1], acao: ['mapa', [12, 6]], porque: 'Ao clicar com a ferramenta Região, uma área de 3 × 3 metros é delimitada sobre a grade.' },
    { ...ferramenta('selecionar', 'Pegue <b>Selecionar</b> e clique no centro da região para ajustá-la.', 'A aba Seleção revela os 4 tipos de região: Anotação, Gatilho, Revelação e Áudio.', ['V', 'selecionar']), etapa: 'Configurar o gatilho', feito: ['e', ['ferramenta', 'selecionar'], ['selecionado', 'regions']], acao: [clicar('ferramenta-selecionar'), ['mapa', [12, 6]]], ponto: [12, 6] },
    { diga: 'Na aba <b>Seleção</b>, troque o <b>Tipo</b> para <b>Gatilho</b>.', alvo: campo('Tipo', 'select'), feito: ['valor', 'regions.*.kind', 'trigger'], aba: 'selecao', acao: [clicar('aba-selecao'), ['escolher', campo('Tipo', 'select'), 'trigger']], porque: 'Regiões de Gatilho alertam o mestre na tela assim que uma peça de jogador pisa na área demarcada.' },
    { diga: 'No campo <b>Texto do gatilho</b>, escreva o aviso para o mestre.', alvo: campo('Texto do gatilho'), feito: ['valor', 'regions.*.payload.texto', 'Armadilha! Piso falso desabando.'], acao: ['preencher', campo('Texto do gatilho'), 'Armadilha! Piso falso desabando.'], porque: 'Este texto será mostrado exclusivamente para você durante a partida e ficará registrado no diário da Mesa.' },
    { diga: 'Confira <b>Só o mestre vê</b>: a região já nasce oculta dos jogadores.', alvo: campo('Só o mestre vê', 'input'), feito: ['valor', 'regions.*.gmOnly', true], porque: 'Com isso marcado, a área fica visível apenas para você no editor e no modo mestre; o projetor e a visão dos jogadores não mostram a borda.' },
    { ...ferramenta('peca', 'Pegue a ferramenta <b>Peça</b> para pôr um personagem.', 'Vamos posicionar um token para testar a ativação do gatilho.', ['P', 'peça']), etapa: 'Testando o gatilho' },
    { diga: 'Clique na sala, no ponto marcado: é a peça do investigador.', ponto: [6, 6], feito: ['pecas', 1], acao: [['mapa', [6, 6]]], porque: 'Colocamos a peça dentro da sala, em segurança antes da armadilha.' },
    { ...ferramenta('selecionar', 'Selecione a peça que você acabou de colocar.'), feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'tokens', [6, 6]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [6, 6]]], ponto: [6, 6] },
    { diga: 'Na aba <b>Seleção</b>, marque <b>Jogador</b>: apenas peças de jogador ativam regiões e visão.', alvo: campo('Jogador'), feito: ['pecasDeJogador', 1], aba: 'selecao', acao: [clicar('aba-selecao'), ['clicar', campo('Jogador')]], porque: 'Gatilhos ignoram monstros e NPCs neutros; apenas peças com "Jogador" ativo disparam eventos espaciais.' },
    { diga: 'Entre na <b>Sessão</b>.', alvo: tid('modo-sessao'), feito: ['modo', 'sessao'], acao: clicar('modo-sessao'), porque: 'Na Sessão, as regiões ficam ativas para detectar a movimentação dos tokens.' },
    { diga: 'Abra a porta entre a sala e a cozinha clicando nela.', ponto: PAREDE_SALA_COZINHA, feito: ['portaAberta', 1], acao: ['mapa', PAREDE_SALA_COZINHA] },
    { diga: 'Arraste a peça do jogador para dentro da cozinha, onde a região está armada.', ponto: [[6, 6], [12, 6]], feito: ['regiaoOcupada', 'trigger'], acao: ['arrastar', [6, 6], [12, 6]], porque: 'Ao pisar na região, o alerta do gatilho é exibido no topo da tela do mestre e registrado no diário!' },
    ler('Região testada com sucesso! Além de Gatilhos com aviso na tela, regiões podem ser do tipo <b>Áudio</b> (trocam automaticamente a música do Jukebox ao entrar), <b>Revelação</b> (revelam segredos na névoa) ou <b>Anotação</b> (notas de área do mestre).'),
  ],
};

const CAMPANHA: Licao = {
  id: 'campanha', titulo: 'Atlas na campanha', minutos: 5, pasta: 'mesa',
  mapa: { largura: 18, altura: 15 },
  resumo: 'Como o Atlas se conecta ao Dossiê, Ateliê e Jukebox através da plataforma Mesa.',
  passos: [
    ler('O Atlas faz parte de uma plataforma integrada.', 'O Atlas foca na cena tática 2D. O Dossiê gerencia fichas de personagens e ameaças; o Ateliê cria pistas e cartas; o Jukebox comanda a sonoplastia; e a Mesa orquestra tudo lado a lado em um diário de campanha unificado.'),
    { ...ferramenta('comodo', 'Pegue a ferramenta <b>Cômodo</b>.', 'Vamos preparar um cômodo para ver como notas e ligações da campanha funcionam.', ['C', 'cômodo']), etapa: 'Cômodo e narrativa' },
    comodo('sala', 'sala', SALA, 'Pinte uma <b>Sala</b> entre os pontos marcados.', 'A sala servirá de exemplo para associar pistas e descrições narrativas.'),
    { ...ferramenta('selecionar', 'Pegue <b>Selecionar</b> e clique no meio da sala.', 'Vamos inspecionar as propriedades do cômodo no painel direito.', ['V', 'selecionar']), feito: ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'rooms', [6, 6]]], acao: [clicar('ferramenta-selecionar'), ['mapa', [6, 6]]], ponto: [6, 6] },
    { diga: 'Em <b>Texto de leitura</b>, digite a descrição do que os jogadores percebem ao entrar.', alvo: 'textarea[aria-label="Texto de leitura do cômodo"]', feito: ['comodoComLeitura'], acao: ['preencher', 'textarea[aria-label="Texto de leitura do cômodo"]', 'Papéis espalhados e cheiro forte de mofo e cinzas.'], porque: 'O texto de leitura guarda a narrativa sensorial (visão, sons, cheiros). Na sessão, o mestre tem o texto à mão ao inspecionar o cômodo.' },
    { diga: 'Veja a seção <b>Ligações</b>: aqui você associa pistas do Ateliê e fichas do Dossiê a este cômodo.', alvo: tid('copiar-ref'), feito: ['ler'], etapa: 'Ligações da campanha', porque: 'Ao colar referências da mesa (ex: mesa:atelie/documento/... ou mesa:ficha/personagem/...), qualquer documento ou ficha fica acessível com um clique direto daquele cômodo na Mesa.' },
    { diga: 'Abra a aba <b>Mapa</b> para ver os sons da campanha.', alvo: tid('aba-mapa'), feito: ['aba', 'mapa'], acao: clicar('aba-mapa'), etapa: 'Sonoplastia e Jukebox' },
    { diga: 'Os campos de som conectam o cenário ao <b>Jukebox</b> da sua campanha.', alvo: '[aria-label="Campanha deste mapa"]', feito: ['ler'], porque: 'Quando este mapa está vinculado a uma campanha ativa, o Atlas lista as cenas sonoras do Jukebox para tocar a trilha do mapa ou de cada clima automaticamente.' },
    ler('Conduzindo no Modo Sessão da Mesa: para mestrar com tudo sincronizado, abra o hub <b>Mesa</b> (pelo navegador ou com npm run mesa-dev). Na aba <b>Sessão</b>, o Atlas divide a tela com as fichas do Dossiê e o player do Jukebox, registrando rolagens, entradas em regiões e trilhas em tempo real no seu diário de campanha.'),
  ],
};

export const LICOES: readonly Licao[] = [TESTE, PRIMEIRA_CASA, ASSISTENTE, TERRENO_E_ESPALHAR, CLIMAS, SESSAO, REGIOES, CAMPANHA];
