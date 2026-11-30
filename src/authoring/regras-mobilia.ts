import { ACERVO } from '../procedural/acervo.ts';
import { generoDe, generosVisiveis } from '../domain/presets.ts';

/**
 * Que móveis um cômodo costuma ter, onde ficam e quantos, por função. Dados puros: o gerador de layout (layout.ts) é que posiciona.
 * Só receitas que existem. O gênero muda sobretudo o que é trocado ou tirado; com poucas receitas, a variedade maior vem com o acervo da Fase 6.
 */
/** `sobre`: em cima do móvel âncora (`junto.de`), com `elevation: 'table'`: enfeites de mesa. */
export type Lugar = 'parede' | 'canto' | 'centro' | 'junto' | 'na-parede' | 'sobre';

export interface ItemDeRegra {
  id: string;
  /** Alternativas; o gerador sorteia pela semente. */
  receitas: string[];
  lugar: Lugar;
  quantos: [min: number, max: number];
  /** Abaixo disso (m²), o item não entra. */
  areaMinima?: number;
  /** A partir de qual área (m²) cada receita passa a valer no lugar do sorteio: a última que cabe vence. */
  porArea?: [areaMinima: number, receita: string][];
  /** Os menores números entram primeiro. */
  prioridade: number;
  /** Para 'junto' e 'sobre': ao redor de que item (id da regra) e como (o modo só vale para 'junto'). */
  junto?: { de: string; modo: 'ao-redor' | 'ao-lado' | 'em-frente' | 'ladeando'; /** Para 'em-frente': a distância (m) entre a âncora e o móvel; padrão 1,2. */ folga?: number };
  /** Não fica na frente de janela. */
  alto?: boolean;
  /** Cópias a mais a cada 10 m² de área acima de 12 m² (cômodo grande ganha mais estantes, quadros, vasos…). */
  escala?: number;
  /** Para 'junto': se não couber junto da âncora (ou ela não existir), tenta o centro ou as paredes do cômodo. */
  senao?: 'centro' | 'parede';
  /** Parâmetros que crescem com a área: a partir de cada área (m²), estes valem por cima de `params` (a mesa de jantar fica mais comprida). */
  paramsPorArea?: [areaMinima: number, params: Record<string, unknown>][];
  params?: Record<string, unknown>;
}

const item = (id: string, receitas: string[], lugar: Lugar, quantos: [number, number], prioridade: number, extra: Partial<ItemDeRegra> = {}): ItemDeRegra => ({ id, receitas, lugar, quantos, prioridade, ...extra });

export const REGRAS_DE_MOBILIA: Readonly<Record<string, ItemDeRegra[]>> = {
  quarto: [
    item('cama', ['cama.solteiro'], 'parede', [1, 1], 1, { porArea: [[12, 'cama.casal']] }),
    item('mesinha', ['mesinha'], 'junto', [1, 2], 2, { junto: { de: 'cama', modo: 'ao-lado' } }),
    item('armario', ['armario'], 'parede', [1, 1], 3, { alto: true, areaMinima: 8 }),
    item('comoda', ['comoda'], 'parede', [0, 1], 4, { areaMinima: 10 }),
    item('tapete', ['tapete.persa', 'tapete.redondo', 'tapete.liso', 'casa:tapete-persa-p-vinho', 'casa:tapete-persa-p-verde', 'casa:tapete-persa-p-creme', 'casa:tapete-oval-vinho', 'casa:tapete-oval-verde', 'casa:tapete-oval-creme'], 'centro', [1, 1], 5, { areaMinima: 10 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [1, 3], 6),
    item('espelho', ['espelho'], 'na-parede', [0, 1], 7),
    item('luminaria', ['luminaria.franja', 'luminaria.chao'], 'canto', [0, 1], 9),
    item('estante', ['estante'], 'na-parede', [0, 1], 8, { areaMinima: 14 }),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 10),
    item('cortina', ['cortina.janela'], 'na-parede', [0, 1], 10.5, { areaMinima: 10 }),
    item('enfeite-mesinha', ['abajur.mesa', 'relogio.mesa', 'vaso.flores', 'livro.aberto', 'notebook'], 'sobre', [1, 2], 11, { junto: { de: 'mesinha', modo: 'ao-lado' } }),
    item('cesto', ['cesto.roupa'], 'canto', [0, 1], 12),
    item('sapatos', ['sapatos'], 'parede', [0, 1], 13),
    item('roca', ['roca-de-fiar'], 'canto', [0, 1], 14, { areaMinima: 10 }),
    item('tear', ['tear'], 'parede', [0, 1], 15, { areaMinima: 14 }),

  ],
  sala: [
    item('lareira', ['lareira.nobre', 'lareira.marmore'], 'parede', [1, 1], 1, { alto: true, areaMinima: 12 }),
    item('sofa', ['sofa.capitone', 'sofa', 'casa:chesterfield-vinho', 'casa:chesterfield-verde', 'casa:chesterfield-couro'], 'junto', [1, 1], 2, { areaMinima: 9, junto: { de: 'lareira', modo: 'em-frente', folga: 2.6 }, senao: 'parede' }),
    item('mesa-centro', ['mesa.centro'], 'junto', [1, 1], 2.5, { areaMinima: 9, junto: { de: 'sofa', modo: 'em-frente', folga: 0.45 } }),
    item('poltrona', ['poltrona.capitone', 'poltrona', 'casa:poltrona-capitone-vinho', 'casa:poltrona-capitone-verde', 'casa:poltrona-capitone-couro'], 'junto', [1, 2], 3, { areaMinima: 12, junto: { de: 'mesa-centro', modo: 'ladeando' }, senao: 'parede' }),
    item('mesinha', ['mesinha'], 'junto', [1, 1], 4, { junto: { de: 'sofa', modo: 'ao-lado' } }),
    item('tapete', ['tapete.persa', 'tapete.oval', 'tapete.redondo', 'tapete.liso', 'casa:tapete-persa-p-vinho', 'casa:tapete-persa-p-verde', 'casa:tapete-persa-p-creme', 'casa:tapete-oval-vinho', 'casa:tapete-oval-verde', 'casa:tapete-oval-creme', 'casa:tapete-persa-g-vinho', 'casa:tapete-persa-g-verde', 'casa:tapete-persa-g-creme'], 'junto', [1, 1], 2.2, { areaMinima: 9, junto: { de: 'sofa', modo: 'em-frente', folga: -0.55 }, senao: 'centro', params: { largura: 3.6, altura: 2.6, diametro: 3 } }),
    item('aparador', ['aparador', 'estante.piso', 'cristaleira'], 'parede', [1, 1], 6, { alto: true, escala: 0.4 }),
    item('vaso', ['vaso.planta'], 'canto', [1, 2], 7, { escala: 0.3 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [2, 4], 8, { escala: 0.6 }),
    item('espelho', ['espelho', 'espelho.grande'], 'na-parede', [0, 1], 8.5),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 8.6),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 8.7, { escala: 0.3 }),
    item('cortina', ['cortina.janela'], 'na-parede', [0, 1], 8.8, { areaMinima: 12 }),
    item('prateleira-flutuante', ['prateleira.flutuante'], 'na-parede', [0, 1], 8.9),
    item('recanto', ['poltrona.capitone', 'poltrona'], 'canto', [0, 1], 9, { areaMinima: 24, escala: 0.25 }),
    item('mesinha-recanto', ['mesinha'], 'junto', [1, 1], 9.2, { junto: { de: 'recanto', modo: 'ao-lado' } }),
    item('piano', ['piano.cauda'], 'parede', [0, 1], 10, { areaMinima: 20 }),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 11),
    item('tv', ['rack.tv'], 'parede', [0, 1], 12, { alto: true }),
    item('luminaria', ['luminaria.franja', 'luminaria.chao'], 'canto', [0, 1], 13),
    item('enfeite-mesinha', ['vaso.flores', 'castical.mesa', 'abajur.mesa', 'relogio.mesa', 'bule.xicaras'], 'sobre', [1, 2], 14, { junto: { de: 'mesinha', modo: 'ao-lado' } }),
    item('enfeite-aparador', ['castical.mesa', 'vaso.flores', 'relogio.mesa', 'garrafa.tacas', 'tabuleiro.xadrez'], 'sobre', [1, 2], 15, { junto: { de: 'aparador', modo: 'ao-lado' } }),
    item('estandarte', ['estandarte'], 'canto', [0, 2], 16, { areaMinima: 16 }),
    item('armadura', ['manequim-de-armadura'], 'canto', [0, 1], 17, { areaMinima: 16 }),
    item('tocheiro', ['tocheiro'], 'canto', [0, 1], 18),
  ],
  cozinha: [
    item('balcao', ['balcao'], 'parede', [1, 2], 1, { params: { largura: 2.6 } }),
    item('mesa', ['mesa.retangular', 'mesa.redonda'], 'centro', [1, 1], 2, { areaMinima: 9 }),
    item('cadeira', ['cadeira'], 'junto', [2, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('aparador', ['aparador'], 'parede', [0, 1], 4, { areaMinima: 12, alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 5),
    item('lareira', ['lareira.pedra'], 'parede', [1, 1], 1, { alto: true, areaMinima: 8 }),
    item('geladeira', ['geladeira'], 'parede', [1, 1], 6, { alto: true }),
    item('fogao', ['fogao'], 'parede', [1, 1], 7, { alto: true }),
    item('prateleira', ['prateleira.parede'], 'na-parede', [1, 2], 9),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 9.5),
    item('painel', ['painel.azulejo'], 'na-parede', [0, 1], 9.6),
    item('servico', ['fruteira', 'bule.xicaras', 'pratos.servico', 'garrafa.tacas'], 'sobre', [1, 3], 10, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('caldeirao', ['caldeirao'], 'canto', [0, 1], 11),
    item('espeto', ['espeto-de-assar'], 'parede', [0, 1], 12, { areaMinima: 14 }),
    item('tina', ['tina-de-agua'], 'canto', [0, 1], 13),
  ],
  biblioteca: [
    item('estante', ['estante'], 'na-parede', [2, 3], 1, { escala: 0.5 }),
    item('estante-baixa', ['estante.piso'], 'parede', [1, 2], 2, { alto: true, escala: 1.2, params: { largura: 1.8 } }),
    item('poltrona', ['poltrona.capitone', 'poltrona', 'casa:poltrona-capitone-vinho', 'casa:poltrona-capitone-verde', 'casa:poltrona-capitone-couro'], 'canto', [1, 2], 3, { areaMinima: 10 }),
    item('mesa', ['mesa.retangular', 'mesa.redonda'], 'centro', [1, 1], 4, { areaMinima: 14, paramsPorArea: [[30, { largura: 2.6 }]] }),
    item('cadeira-leitura', ['cadeira.espaldar', 'cadeira'], 'junto', [2, 4], 4.2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('tapete', ['tapete.persa', 'tapete.oval'], 'centro', [0, 1], 4.4, { areaMinima: 16, params: { largura: 4, altura: 2.8 } }),
    item('luminaria', ['luminaria.franja'], 'canto', [0, 1], 4.6),
    item('livros', ['livros.pilha'], 'canto', [1, 2], 5),
    item('escrivaninha', ['escrivaninha', 'escrivaninha.verde'], 'parede', [0, 1], 6, { areaMinima: 12 }),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 7),
    item('mapa', ['mapa.mundi'], 'na-parede', [0, 1], 8),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 8.5),
    item('prateleira', ['prateleira.parede'], 'na-parede', [0, 2], 9),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [0, 2], 9.5),
    item('enfeite-mesa', ['livro.aberto', 'abajur.mesa', 'tabuleiro.xadrez', 'tinteiro.pena'], 'sobre', [1, 2], 10, { junto: { de: 'escrivaninha', modo: 'ao-lado' } }),
  ],
  escritorio: [
    item('escrivaninha', ['escrivaninha', 'escrivaninha.verde'], 'parede', [1, 1], 1),
    item('cadeira', ['cadeira'], 'junto', [1, 1], 2, { junto: { de: 'escrivaninha', modo: 'em-frente', folga: 0.1 } }),
    item('estante', ['estante'], 'na-parede', [1, 2], 3, { escala: 0.4 }),
    item('poltrona', ['poltrona.capitone', 'poltrona'], 'canto', [0, 1], 4, { areaMinima: 10 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [1, 2], 5),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 6),
    item('mapa', ['mapa.mundi'], 'na-parede', [0, 1], 7),
    item('arandela', ['arandela'], 'na-parede', [0, 1], 8),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 8.5),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 9),
    item('enfeite-mesa', ['tinteiro.pena', 'abajur.mesa', 'livro.aberto', 'telefone.antigo', 'papeis', 'notebook'], 'sobre', [2, 3], 10, { junto: { de: 'escrivaninha', modo: 'ao-lado' } }),
    item('jornais', ['jornais'], 'parede', [0, 1], 11),
  ],
  banheiro: [
    item('banheira', ['banheira.pes'], 'parede', [1, 1], 1, { areaMinima: 6 }),
    item('vaso', ['vaso.sanitario'], 'parede', [1, 1], 2),
    item('pia', ['pia.pedestal'], 'parede', [1, 1], 3),
    item('espelho', ['espelho'], 'na-parede', [1, 1], 4),
    item('box', ['box.banheiro'], 'parede', [1, 1], 5, { areaMinima: 4 }),
    item('painel', ['painel.azulejo'], 'na-parede', [0, 1], 6),
    item('prateleira', ['prateleira.parede'], 'na-parede', [0, 1], 7),
    item('cesto', ['cesto.roupa'], 'canto', [0, 1], 8),
    item('espelho-grande', ['espelho.grande'], 'na-parede', [0, 1], 9),
  ],
  corredor: [
    item('aparador', ['aparador'], 'parede', [0, 2], 1, { alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [0, 2], 2),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [2, 5], 3),
    item('cabideiro', ['cabideiro'], 'canto', [0, 1], 5),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 6),
    item('passadeira', ['casa:passadeira-vinho', 'casa:passadeira-verde', 'casa:passadeira-creme'], 'centro', [1, 1], 4, { areaMinima: 6 }),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 3.5),
    item('espelho', ['espelho', 'espelho.grande'], 'na-parede', [0, 1], 3.6),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 3.7),
    item('enfeite-aparador', ['vaso.flores', 'castical.mesa', 'relogio.mesa', 'telefone.antigo'], 'sobre', [1, 2], 7, { junto: { de: 'aparador', modo: 'ao-lado' } }),
    item('tocha', ['tocha.parede'], 'na-parede', [0, 2], 8),
    item('armadura', ['manequim-de-armadura'], 'canto', [0, 1], 9),
    item('estandarte', ['estandarte'], 'canto', [0, 1], 10),
    item('armas-parede', ['escudo.parede', 'lancas.parede'], 'na-parede', [0, 1], 11),
  ],
  'sala-de-jantar': [
    item('mesa', ['mesa.oval'], 'centro', [1, 1], 1, { areaMinima: 10, paramsPorArea: [[18, { largura: 3.4 }], [26, { largura: 4.2 }]] }),
    item('cadeira', ['cadeira'], 'junto', [6, 8], 2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('louca', ['pratos.servico', 'castical.mesa', 'fruteira', 'garrafa.tacas', 'candelabro'], 'sobre', [2, 4], 2.5, { junto: { de: 'mesa', modo: 'ao-lado' } }),
    item('cristaleira', ['cristaleira'], 'parede', [1, 1], 3, { alto: true }),
    item('aparador', ['aparador'], 'parede', [0, 1], 4, { alto: true }),
    item('lareira', ['lareira.nobre', 'lareira.marmore'], 'parede', [0, 1], 5, { alto: true, areaMinima: 16 }),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 6, { escala: 0.3 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [2, 3], 7, { escala: 0.4 }),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 7.5),
    item('cortina', ['cortina.janela'], 'na-parede', [0, 1], 7.6, { areaMinima: 10 }),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 7.7),
    item('servico', ['bule.xicaras', 'candelabro', 'castical.mesa', 'fruteira', 'garrafa.tacas', 'pratos.servico'], 'sobre', [2, 4], 8, { junto: { de: 'mesa', modo: 'ao-redor' } }),

  ],
  'sala-de-jogos': [
    item('bilhar', ['mesa.bilhar'], 'centro', [1, 1], 1, { areaMinima: 14 }),
    item('poltrona', ['poltrona'], 'canto', [1, 2], 2, { areaMinima: 10 }),
    item('aparador', ['aparador'], 'parede', [1, 1], 3, { alto: true }),
    item('banco', ['banco'], 'parede', [0, 2], 4),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [1, 3], 5),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 6),
    item('trofeu', ['trofeu.cervo'], 'na-parede', [0, 1], 7),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 7.5),
    item('enfeite-aparador', ['garrafa.tacas', 'tabuleiro.xadrez', 'castical.mesa'], 'sobre', [1, 2], 8, { junto: { de: 'aparador', modo: 'ao-lado' } }),
  ],
  capela: [
    item('altar', ['altar'], 'parede', [1, 1], 1, { alto: true }),
    item('banco', ['banco.igreja'], 'centro', [2, 4], 2, { areaMinima: 12 }),
    item('banco-lateral', ['banco.longo'], 'parede', [0, 2], 3),
    item('tapecaria', ['tapecaria'], 'na-parede', [1, 2], 4),
    item('bau', ['bau'], 'canto', [0, 1], 5),
    item('arandela', ['arandela'], 'na-parede', [2, 4], 6),
    item('brasao', ['brasao'], 'na-parede', [0, 1], 7),
    item('altar-velas', ['candelabro', 'castical.mesa'], 'sobre', [1, 2], 8, { junto: { de: 'altar', modo: 'ao-lado' } }),
    item('pulpito', ['pulpito'], 'canto', [0, 1], 9, { areaMinima: 16 }),
    item('pia-batismal', ['pia-batismal'], 'canto', [0, 1], 10, { areaMinima: 14 }),
    item('tocheiro', ['tocheiro'], 'junto', [1, 2], 11, { junto: { de: 'altar', modo: 'ao-lado' } }),
    item('velas', ['velas-votivas'], 'parede', [0, 1], 12),
    item('confessionario', ['confessionario'], 'parede', [0, 1], 13, { areaMinima: 24, alto: true }),
    item('imagem', ['imagem-de-santo'], 'canto', [0, 2], 14, { areaMinima: 12 }),
    item('orgao', ['orgao-de-tubos'], 'parede', [0, 1], 15, { areaMinima: 30, alto: true }),
    item('vitral', ['vitral'], 'na-parede', [1, 2], 16),
    item('crucifixo', ['crucifixo', 'icone.parede'], 'na-parede', [0, 2], 17),
    item('agua-benta', ['pia-de-agua-benta'], 'na-parede', [0, 1], 18),
  ],
  forja: [
    item('bigorna', ['bigorna'], 'centro', [1, 1], 1, { areaMinima: 8 }),
    item('lareira', ['lareira.pedra'], 'parede', [1, 1], 2, { alto: true }),
    item('barril', ['barril.em-pe', 'barril.deitado'], 'canto', [1, 3], 3),
    item('prateleira', ['prateleira.pocoes'], 'parede', [0, 1], 4, { alto: true }),
    item('bau', ['bau'], 'parede', [0, 1], 5),
    item('amolar', ['pedra-de-amolar'], 'parede', [0, 1], 6),
    item('tina', ['tina-de-agua'], 'junto', [0, 1], 7, { junto: { de: 'bigorna', modo: 'ao-lado' } }),
    item('suporte-armas', ['suporte-de-armas', 'suporte-de-lancas'], 'parede', [0, 1], 8, { alto: true }),
    item('mesa-armas', ['mesa-de-armas', 'bancada.trabalho'], 'parede', [0, 1], 9, { areaMinima: 14 }),
    item('armadura', ['manequim-de-armadura'], 'canto', [0, 1], 10, { areaMinima: 12 }),
    item('flechas', ['barril-de-flechas'], 'canto', [0, 1], 11),
    item('tocha', ['tocha.parede'], 'na-parede', [1, 2], 12),
    item('armas-parede', ['escudo.parede', 'machados.cruzados', 'lancas.parede'], 'na-parede', [0, 2], 13),
  ],
  varanda: [
    item('escada', ['escada.externa'], 'parede', [1, 1], 1, { areaMinima: 8 }),
    item('urna', ['urna.pedestal'], 'canto', [2, 4], 1.5),
    item('pilar', ['pilar'], 'canto', [0, 4], 1.6, { areaMinima: 12 }),
    item('balaustrada', ['balaustrada'], 'parede', [3, 6], 2),
    item('banco', ['banco.jardim'], 'parede', [0, 2], 5),
    item('fonte', ['fonte'], 'centro', [0, 1], 6, { areaMinima: 30 }),
    item('estatua', ['estatua'], 'canto', [0, 2], 7, { areaMinima: 14 }),
    item('vaso', ['vaso.planta'], 'canto', [0, 2], 8),
  ],
  hospital: [
    item('cama', ['cama.solteiro'], 'parede', [2, 4], 1),
    item('mesinha', ['mesinha'], 'junto', [1, 3], 2, { junto: { de: 'cama', modo: 'ao-lado' } }),
    item('balcao', ['balcao'], 'parede', [0, 1], 3, { areaMinima: 10 }),
    item('cadeira', ['cadeira'], 'canto', [0, 1], 4),
  ],
  taverna: [
    item('balcao', ['balcao'], 'parede', [1, 1], 1, { areaMinima: 12, params: { largura: 3 } }),
    item('mesa', ['mesa.redonda'], 'centro', [1, 3], 2),
    item('cadeira', ['cadeira'], 'junto', [3, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('banco', ['banco'], 'parede', [0, 2], 4),
    item('barril', ['barril.em-pe', 'barril.deitado'], 'canto', [1, 3], 5),
    item('lareira', ['lareira.pedra'], 'parede', [0, 1], 6, { alto: true, areaMinima: 14 }),
    item('trofeu', ['trofeu.cervo'], 'na-parede', [0, 1], 7),
    item('tapecaria', ['tapecaria'], 'na-parede', [0, 2], 7.5),
    item('espadas', ['espadas.cruzadas', 'machados.cruzados', 'escudo.parede', 'arco.parede'], 'na-parede', [0, 1], 7.6),
    item('brasao', ['brasao'], 'na-parede', [0, 1], 7.7),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 7.8),
    item('servico', ['garrafa.tacas', 'castical.mesa', 'pratos.servico', 'candelabro'], 'sobre', [2, 4], 8, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('tocha', ['tocha.parede'], 'na-parede', [0, 2], 9),
    item('espeto', ['espeto-de-assar'], 'parede', [0, 1], 10, { areaMinima: 20 }),
  ],
  porao: [
    item('caixote-canto', ['caixa'], 'canto', [2, 4], 1),
    item('caixote-parede', ['caixa'], 'parede', [2, 5], 2),
    item('escada', ['escada.madeira', 'escada.pedra'], 'parede', [0, 1], 3, { areaMinima: 10, alto: true }),
    item('tocha', ['tocha.parede'], 'na-parede', [0, 2], 4),
  ],
  estabulo: [
    item('fardo', ['fardo-de-feno'], 'parede', [2, 4], 1),
    item('bebedouro', ['bebedouro'], 'parede', [1, 2], 2),
    item('palha', ['monte-de-palha'], 'canto', [1, 2], 3),
    item('cavalo', ['cavalo'], 'centro', [0, 2], 4, { areaMinima: 12 }),
    item('tina', ['tina-de-agua'], 'junto', [0, 1], 5, { junto: { de: 'bebedouro', modo: 'ao-lado' } }),
  ],
  celeiro: [
    item('fardo', ['fardo-de-feno'], 'parede', [3, 6], 1),
    item('sacos', ['sacos'], 'canto', [1, 3], 2),
    item('carroca', ['carroca'], 'centro', [0, 1], 3, { areaMinima: 20 }),
    item('carrinho', ['carrinho-de-mao'], 'parede', [0, 1], 4),
    item('barris', ['pilha-de-barris'], 'canto', [0, 2], 5),
  ],
  deposito: [
    item('caixotes', ['pilha-de-caixotes'], 'canto', [1, 3], 1),
    item('caixote', ['caixote'], 'parede', [2, 5], 2),
    item('barril', ['barril', 'pilha-de-barris'], 'parede', [1, 3], 3),
    item('sacos', ['sacos'], 'canto', [1, 2], 4),
    item('estante-piso', ['estante.piso'], 'parede', [1, 2], 5, { alto: true }),
  ],
  loja: [
    item('balcao', ['balcao'], 'parede', [1, 1], 1),
    item('estante-piso', ['estante.piso'], 'parede', [2, 4], 2, { alto: true }),
    item('prateleira', ['prateleira.parede'], 'na-parede', [1, 3], 3),
    item('caixote', ['caixote'], 'canto', [0, 2], 4),
    item('barril', ['barril'], 'canto', [0, 2], 5),
  ],
  oficina: [
    item('bancada', ['bancada.trabalho', 'mesa.retangular'], 'parede', [1, 2], 1),
    item('estante', ['estante'], 'na-parede', [1, 2], 2),
    item('caixote', ['caixote'], 'canto', [1, 3], 3),
    item('amolar', ['pedra-de-amolar'], 'parede', [0, 1], 4),
    item('banqueta', ['banqueta', 'cadeira'], 'junto', [1, 2], 5, { junto: { de: 'bancada', modo: 'em-frente', folga: 0.1 } }),
  ],
  cela: [
    item('cama', ['catre', 'enxergao', 'cama.solteiro'], 'parede', [1, 1], 1),
    item('grilhoes', ['grilhoes.parede'], 'na-parede', [0, 1], 2),
    item('palha', ['monte-de-palha'], 'canto', [0, 1], 3),
    item('banco', ['banco'], 'parede', [0, 1], 4),
  ],
  dormitorio: [
    item('cama', ['beliche', 'cama.solteiro'], 'parede', [2, 6], 1),
    item('bau', ['bau', 'comoda'], 'junto', [1, 3], 2, { junto: { de: 'cama', modo: 'ao-lado' } }),
    item('suporte-armas', ['suporte-de-armas'], 'parede', [0, 1], 3, { alto: true }),
    item('assento', ['banqueta', 'banco'], 'canto', [1, 1], 4),
  ],
  refeitorio: [
    item('mesa', ['mesa.banquete', 'mesa.taverna', 'mesa.retangular'], 'centro', [1, 3], 1, { areaMinima: 9 }),
    item('banco', ['banco.longo', 'banco', 'cadeira'], 'junto', [2, 6], 2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('lareira', ['lareira.pedra', 'lareira.marmore'], 'parede', [0, 1], 3, { alto: true, areaMinima: 12 }),
    item('caldeirao', ['caldeirao'], 'canto', [0, 1], 4),
    item('servico', ['pratos.servico', 'fruteira', 'garrafa.tacas'], 'sobre', [1, 3], 5, { junto: { de: 'mesa', modo: 'ao-redor' } }),
  ],
  salao: [
    item('mesa', ['mesa.banquete', 'mesa.oval', 'mesa.retangular'], 'centro', [1, 2], 1, { areaMinima: 12 }),
    item('banco', ['banco.longo', 'cadeira', 'banco'], 'junto', [2, 6], 2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('lareira', ['lareira.pedra', 'lareira.marmore'], 'parede', [0, 1], 3, { alto: true }),
    item('estandarte', ['estandarte'], 'canto', [0, 2], 4),
    item('trono', ['trono'], 'parede', [0, 1], 5, { alto: true }),
    item('quadro', ['quadro', 'paisagem.grande', 'retrato.oval'], 'na-parede', [1, 3], 6),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 7),
  ],
  patio: [
    item('banco', ['banco.jardim'], 'parede', [0, 2], 1),
    item('vaso', ['vaso.planta'], 'canto', [1, 3], 2),
    item('poco', ['poco', 'fonte'], 'centro', [0, 1], 3, { areaMinima: 20 }),
  ],
  // Antiguidade (Q15c). Fora do gênero, os itens exclusivos da época saem das alternativas (`regrasPara`); sobram os atemporais (banco, vaso, arbusto, caixote).
  atrio: [
    item('impluvio', ['impluvio'], 'centro', [1, 1], 1, { areaMinima: 14, paramsPorArea: [[30, { comprimento: 4.2, largura: 3 }]] }),
    item('lucerna', ['lucerna'], 'canto', [2, 3], 2, { params: { pe: 1 } }),
    item('busto', ['busto-em-pedestal'], 'parede', [1, 2], 3),
    item('rolos', ['estante-de-rolos'], 'parede', [0, 1], 4, { areaMinima: 18, alto: true }),
    item('tear', ['tear-vertical'], 'parede', [0, 1], 5, { areaMinima: 20, alto: true }),
    item('anfora', ['anfora'], 'canto', [1, 2], 6),
    item('banco', ['banco'], 'parede', [0, 2], 7),
    item('vaso', ['vaso.planta', 'urna.pedestal'], 'canto', [1, 2], 8),
    item('coluna', ['coluna.jonica', 'coluna.dorica'], 'canto', [0, 4], 9, { areaMinima: 24, params: { altura: 4 } }),
  ],
  peristilo: [
    item('impluvio', ['impluvio'], 'centro', [0, 1], 1, { areaMinima: 30, params: { comprimento: 4.5, largura: 3 } }),
    item('pergola', ['pergolado-com-videira'], 'parede', [0, 2], 2, { areaMinima: 24 }),
    item('fonte', ['fonte-com-mascara'], 'parede', [0, 1], 3),
    item('estatua', ['estatua-classica', 'busto-em-pedestal'], 'canto', [1, 2], 4),
    item('coluna', ['coluna.dorica', 'coluna.jonica'], 'canto', [2, 6], 5, { escala: 0.5, params: { altura: 5 } }),
    item('banco', ['banco.jardim'], 'parede', [1, 3], 6),
    item('arbusto', ['casa:arbusto-verde', 'casa:arbusto-florido'], 'canto', [1, 3], 7),
    item('vaso', ['vaso.planta', 'urna.pedestal'], 'canto', [0, 2], 8),
  ],
  triclinio: [
    item('mesa', ['mesa-romana'], 'centro', [1, 1], 1),
    // Um leito de cada lado da mesa (o `triclinio` em U não cabe em volta dela): três leitos de um lugar só.
    item('leito', ['triclinio'], 'junto', [3, 3], 2, { junto: { de: 'mesa', modo: 'ao-redor' }, senao: 'parede', params: { leitos: 1 } }),
    item('louca', ['pratos.servico', 'fruteira', 'garrafa.tacas'], 'sobre', [1, 2], 3, { junto: { de: 'mesa', modo: 'ao-lado' } }),
    item('lucerna', ['lucerna'], 'canto', [2, 3], 4, { params: { pe: 1 } }),
    item('anfora', ['anfora'], 'canto', [1, 2], 5),
    item('lira', ['lira'], 'canto', [0, 1], 6),
    item('busto', ['busto-em-pedestal'], 'parede', [0, 1], 7),
    item('vaso', ['vaso.planta', 'urna.pedestal'], 'canto', [0, 2], 8),
  ],
  termas: [
    item('tanque', ['tanque-de-banho'], 'centro', [1, 1], 1, { areaMinima: 14, params: { comprimento: 4.2, largura: 3 }, paramsPorArea: [[30, { comprimento: 5, largura: 3.6 }], [48, { comprimento: 6.4, largura: 4.2 }]] }),
    item('banco', ['banco', 'banco.jardim'], 'parede', [2, 4], 2),
    item('anfora', ['anfora'], 'canto', [1, 3], 3),
    item('fonte', ['fonte-com-mascara'], 'parede', [0, 1], 4),
    item('lucerna', ['lucerna'], 'canto', [2, 3], 5, { params: { pe: 1 } }),
    item('estatua', ['busto-em-pedestal', 'estatua-classica'], 'canto', [0, 2], 6),
    item('vaso', ['vaso.planta', 'urna.pedestal'], 'canto', [1, 2], 7),
    item('coluna', ['coluna.dorica', 'coluna.jonica'], 'canto', [0, 4], 8, { areaMinima: 30, params: { altura: 4 } }),
  ],
  templo: [
    item('estatua', ['estatua-classica'], 'parede', [1, 1], 1, { alto: true }),
    item('altar', ['altar-de-sacrificio'], 'centro', [1, 1], 2, { areaMinima: 14 }),
    item('tripe', ['tripe-de-bronze'], 'junto', [2, 2], 3, { junto: { de: 'altar', modo: 'ladeando' }, senao: 'parede' }),
    item('coluna', ['coluna.dorica', 'coluna.jonica', 'coluna.corintia'], 'canto', [2, 4], 4, { params: { altura: 4 } }),
    item('painel', ['painel-de-hieroglifos'], 'na-parede', [0, 2], 5, { areaMinima: 16 }),
    item('busto', ['busto-em-pedestal'], 'parede', [0, 2], 6),
    item('lucerna', ['lucerna'], 'canto', [1, 2], 7, { params: { pe: 1 } }),
    item('rolos', ['estante-de-rolos'], 'parede', [0, 1], 8, { areaMinima: 24, alto: true }),
    item('urna', ['urna.pedestal'], 'canto', [0, 2], 9),
  ],
  forum: [
    item('obelisco', ['obelisco'], 'centro', [0, 1], 1, { areaMinima: 60 }),
    item('estatua', ['estatua-classica', 'busto-em-pedestal'], 'canto', [1, 3], 2, { escala: 0.5 }),
    item('coluna', ['coluna.dorica', 'coluna.jonica', 'coluna.corintia'], 'canto', [2, 6], 3, { escala: 0.5, params: { altura: 6 } }),
    item('aquila', ['aquila'], 'canto', [0, 2], 4),
    item('banca', ['banca-de-mercado.toldo'], 'parede', [1, 3], 5, { areaMinima: 30, escala: 0.5 }),
    item('altar', ['altar-de-sacrificio'], 'parede', [0, 1], 6, { areaMinima: 40 }),
    item('biga', ['biga'], 'parede', [0, 1], 7, { areaMinima: 50 }),
    item('fonte', ['fonte-com-mascara'], 'parede', [0, 1], 8),
    item('anfora', ['anfora'], 'canto', [1, 3], 9),
    item('banco', ['banco.jardim'], 'parede', [1, 3], 10),
    item('arbusto', ['casa:arbusto-verde'], 'canto', [0, 2], 11),
  ],
  taberna: [
    item('mesa', ['mesa-romana'], 'centro', [1, 3], 1),
    item('banco', ['banco', 'banqueta'], 'junto', [2, 6], 2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('anforas', ['anforas-empilhadas'], 'canto', [1, 2], 3),
    item('pithos', ['pithos'], 'parede', [1, 2], 4),
    item('anfora', ['anfora'], 'canto', [1, 3], 5),
    item('lucerna', ['lucerna'], 'sobre', [1, 2], 6, { junto: { de: 'mesa', modo: 'ao-lado' }, params: { pe: 0 } }),
    item('barril', ['barril.em-pe'], 'canto', [0, 2], 7),
    item('caixa', ['caixa'], 'canto', [0, 2], 8),
  ],
  // Oriental (Q16c). Fora do gênero, os itens exclusivos da época saem das alternativas (`regrasPara`); os que são só `oriental`/`fantasia` ainda servem à fantasia.
  'sala-de-tatami': [
    item('mesa', ['mesa-baixa'], 'centro', [1, 1], 1),
    item('zabuton', ['zabuton'], 'junto', [4, 4], 2, { junto: { de: 'mesa', modo: 'ao-redor' }, senao: 'parede' }),
    item('tansu', ['tansu'], 'parede', [0, 1], 3, { areaMinima: 10, alto: true }),
    item('biombo', ['biombo'], 'parede', [0, 1], 4, { areaMinima: 12 }),
    item('pergaminho', ['pergaminho-de-parede'], 'na-parede', [1, 1], 5),
    item('ikebana', ['ikebana'], 'canto', [1, 1], 6),
    item('andon', ['andon'], 'canto', [1, 2], 7),
  ],
  'casa-de-cha': [
    item('mesa', ['irori', 'mesa-baixa'], 'centro', [1, 1], 1),
    item('servico', ['bule-e-xicaras.oriental'], 'sobre', [1, 1], 2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('zabuton', ['zabuton'], 'junto', [3, 5], 3, { junto: { de: 'mesa', modo: 'ao-redor' }, senao: 'parede' }),
    item('pergaminho', ['pergaminho-de-parede'], 'na-parede', [1, 1], 4),
    item('ikebana', ['ikebana'], 'canto', [1, 1], 5),
    item('andon', ['andon'], 'canto', [1, 2], 6),
    item('bonsai', ['bonsai'], 'canto', [0, 1], 7),
  ],
  dojo: [
    item('suporte', ['suporte-de-espadas'], 'parede', [1, 1], 1),
    item('armadura', ['armadura-oriental'], 'parede', [1, 2], 2, { escala: 0.5 }),
    item('pergaminho', ['pergaminho-de-parede'], 'na-parede', [1, 2], 3),
    item('zabuton', ['zabuton'], 'parede', [1, 3], 4),
    item('andon', ['andon'], 'canto', [2, 4], 5),
  ],
  santuario: [
    item('estatua', ['estatua-sentada'], 'parede', [1, 1], 1, { alto: true }),
    item('incensario', ['incensario'], 'junto', [1, 1], 2, { junto: { de: 'estatua', modo: 'em-frente', folga: 1.4 }, senao: 'centro' }),
    item('lanterna', ['andon', 'lanterna-de-papel'], 'canto', [2, 3], 3),
    item('zabuton', ['zabuton'], 'parede', [1, 3], 4),
    item('ikebana', ['ikebana'], 'canto', [1, 2], 5),
  ],
  jardim: [
    item('rastelado', ['rastelado'], 'centro', [1, 1], 1, { areaMinima: 20 }),
    item('lanterna', ['lanterna-de-pedra'], 'canto', [1, 3], 2),
    item('bacia', ['bacia-de-pedra'], 'parede', [1, 1], 3),
    item('cerejeira', ['casa:cerejeira-4m', 'casa:cerejeira-5m-rala', 'casa:cerejeira-6m'], 'canto', [1, 2], 4, { areaMinima: 30 }),
    item('bambuzal', ['casa:bambuzal-2m'], 'parede', [1, 3], 5),
    item('bonsai', ['bonsai'], 'canto', [1, 2], 6),
    item('pedra', ['pedra.grande', 'pedra.media', 'pedra.pequena'], 'canto', [2, 4], 7, { escala: 0.5 }),
    item('banco', ['banco.jardim'], 'parede', [0, 1], 8),
  ],
  // Deserto (Q17c). Os itens só do gênero saem fora dele (`regrasPara`); o `deposito` já existe e o gênero troca o que ele guarda (`VARIACOES_DE_GENERO.deserto`).
  tenda: [
    item('mesa', ['mesa-de-latao'], 'centro', [1, 1], 1),
    item('tapete', ['tapete-de-chao'], 'junto', [1, 1], 2, { junto: { de: 'mesa', modo: 'em-frente', folga: -1.2 }, senao: 'centro', paramsPorArea: [[14, { comprimento: 3.4, largura: 2.4 }]] }),
    item('almofadas', ['almofadas'], 'junto', [2, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' }, senao: 'parede' }),
    item('narguile', ['narguile'], 'junto', [0, 1], 4, { junto: { de: 'mesa', modo: 'ao-lado' }, senao: 'parede' }),
    item('bau', ['bau-pintado'], 'parede', [1, 1], 5),
    item('jarro', ['jarro-de-barro'], 'canto', [1, 2], 6),
    item('cesto', ['cesto'], 'canto', [0, 2], 7),
    item('lanterna', ['lanterna-marroquina'], 'canto', [1, 2], 8),
    item('tear', ['tear-de-chao'], 'parede', [0, 1], 9, { areaMinima: 16 }),
  ],
  'patio-com-fonte': [
    item('fonte', ['fonte', 'poco.oasis'], 'centro', [1, 1], 1, { areaMinima: 16 }),
    item('palmeira', ['casa:tamareira-5m', 'casa:coqueiro-4m'], 'canto', [1, 3], 2, { areaMinima: 20 }),
    item('arbusto', ['casa:arbusto-verde', 'casa:cacto-redondo-grupo', 'casa:cacto-redondo-um'], 'canto', [1, 2], 3),
    item('banco', ['banco.jardim'], 'parede', [0, 2], 4),
    item('jarro', ['jarro-de-barro', 'cantaros-empilhados'], 'parede', [1, 2], 5),
    item('lanterna', ['lanterna-marroquina'], 'parede', [1, 3], 6),
    item('toldo', ['toldo-listrado'], 'parede', [0, 1], 7, { areaMinima: 24 }),
    item('tear', ['tear-de-chao'], 'parede', [0, 1], 8, { areaMinima: 30 }),
    item('palanquim', ['palanquim'], 'parede', [0, 1], 9, { areaMinima: 40 }),
  ],
  bazar: [
    item('banca', ['banca-de-especiarias'], 'parede', [2, 4], 1, { escala: 0.5 }),
    item('tapetes', ['tapetes-pendurados'], 'parede', [1, 3], 2, { escala: 0.3 }),
    item('tapete', ['tapete-de-chao'], 'centro', [1, 1], 3, { areaMinima: 10 }),
    item('cesto', ['cesto'], 'canto', [1, 3], 4),
    item('cantaros', ['cantaros-empilhados'], 'canto', [1, 2], 5),
    item('jarro', ['jarro-de-barro'], 'parede', [0, 2], 6),
    item('mesa', ['mesa-de-latao'], 'parede', [0, 1], 7, { areaMinima: 14 }),
    item('lanterna', ['lanterna-marroquina'], 'canto', [1, 2], 8),
    item('toldo', ['toldo-listrado'], 'parede', [0, 1], 9, { areaMinima: 30 }),
  ],
  'salao-de-cha': [
    item('mesa', ['mesa-de-latao'], 'centro', [1, 1], 1),
    item('tapete', ['tapete-de-chao'], 'junto', [1, 1], 2, { junto: { de: 'mesa', modo: 'em-frente', folga: -1.2 }, senao: 'centro', paramsPorArea: [[16, { comprimento: 3.6, largura: 2.6 }]] }),
    item('almofadas', ['almofadas'], 'junto', [2, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' }, senao: 'parede' }),
    item('narguile', ['narguile'], 'junto', [1, 2], 4, { junto: { de: 'mesa', modo: 'ao-lado' }, senao: 'parede' }),
    item('mesa-parede', ['mesa-de-latao'], 'parede', [1, 3], 5, { areaMinima: 14, escala: 0.4 }),
    item('almofadas-parede', ['almofadas'], 'parede', [1, 3], 6, { areaMinima: 14 }),
    item('lanterna', ['lanterna-marroquina'], 'canto', [2, 3], 7),
    item('jarro', ['jarro-de-barro'], 'canto', [0, 1], 8),
    item('cesto', ['cesto'], 'canto', [0, 1], 9),
  ],
  // Faroeste (Q18c). O `estabulo` já existe e o gênero só troca o que ele guarda (`VARIACOES_DE_GENERO.faroeste`). A porta de vaivém não entra: ver o limite da ficha.
  saloon: [
    item('balcao', ['balcao-de-saloon'], 'parede', [1, 1], 1, { areaMinima: 14, params: { comprimento: 3.6 }, paramsPorArea: [[24, { comprimento: 5 }]] }),
    item('mesa', ['mesa-de-poquer'], 'centro', [1, 3], 2),
    item('cadeira', ['cadeira'], 'junto', [3, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('piano', ['piano-de-armario'], 'parede', [0, 1], 4, { areaMinima: 18 }),
    item('escarradeira', ['escarradeira'], 'canto', [1, 2], 5),
    item('barril', ['barril.em-pe', 'barril.deitado'], 'canto', [0, 2], 6),
    item('cabeca', ['cabeca-de-bufalo'], 'na-parede', [0, 1], 7),
    item('procurado', ['placa-de-procurado'], 'na-parede', [1, 2], 8),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 8.5),
    item('banco', ['banco'], 'parede', [0, 2], 9),
  ],
  xerifado: [
    item('mesa', ['mesa-de-xerife'], 'parede', [1, 1], 1),
    item('cadeira', ['cadeira'], 'junto', [1, 2], 2, { junto: { de: 'mesa', modo: 'em-frente', folga: 0.1 } }),
    item('cela', ['cela-de-xerife'], 'parede', [0, 1], 3, { areaMinima: 18 }),
    item('cofre', ['cofre'], 'canto', [0, 1], 4),
    item('procurado', ['placa-de-procurado'], 'na-parede', [2, 4], 5, { escala: 0.5 }),
    item('estante', ['estante'], 'na-parede', [0, 1], 6),
    item('escarradeira', ['escarradeira'], 'canto', [1, 1], 7),
    item('banco', ['banco'], 'parede', [0, 1], 8),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 9),
  ],
  'armazem-geral': [
    item('balcao', ['balcao'], 'parede', [1, 1], 1),
    item('estante-piso', ['estante.piso'], 'parede', [2, 4], 2, { alto: true }),
    item('prateleira', ['prateleira.parede'], 'na-parede', [1, 3], 3),
    item('sacos', ['sacos'], 'canto', [1, 3], 4),
    item('barril', ['barril', 'pilha-de-barris'], 'canto', [1, 3], 5),
    item('caixote', ['caixote', 'pilha-de-caixotes'], 'parede', [1, 4], 6),
    item('procurado', ['placa-de-procurado'], 'na-parede', [0, 1], 7),
    item('carrinho', ['carrinho-de-mao'], 'parede', [0, 1], 8, { areaMinima: 20 }),
  ],
  banco: [
    item('balcao', ['balcao'], 'parede', [1, 1], 1, { params: { largura: 3 } }),
    item('cofre', ['cofre'], 'parede', [1, 1], 2),
    item('escrivaninha', ['escrivaninha', 'mesa-de-xerife'], 'parede', [1, 1], 3, { areaMinima: 12 }),
    item('cadeira', ['cadeira'], 'junto', [1, 1], 4, { junto: { de: 'escrivaninha', modo: 'em-frente', folga: 0.1 } }),
    item('banco', ['banco'], 'parede', [0, 2], 5),
    item('procurado', ['placa-de-procurado'], 'na-parede', [1, 2], 6),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 7),
    item('escarradeira', ['escarradeira'], 'canto', [0, 1], 8),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 9),
  ],
  estacao: [
    item('balcao', ['balcao'], 'parede', [1, 1], 1),
    item('mesa', ['mesa-de-xerife'], 'parede', [0, 1], 2, { areaMinima: 16 }),
    item('banco', ['banco.longo', 'banco'], 'parede', [2, 4], 3),
    item('caixote', ['caixote', 'pilha-de-caixotes'], 'canto', [1, 3], 4),
    item('sacos', ['sacos'], 'canto', [0, 2], 5),
    item('cofre', ['cofre'], 'canto', [0, 1], 6, { areaMinima: 14 }),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [1, 1], 7),
    item('procurado', ['placa-de-procurado'], 'na-parede', [1, 2], 8),
    item('escarradeira', ['escarradeira'], 'canto', [1, 1], 9),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 10),
  ],
  // Colonial e pirata (Q19c). O `porao` já existe e o gênero só troca o que ele guarda (`VARIACOES_DE_GENERO.colonial`). Convés e fortim são ao ar livre: canhões nas bordas, sem luz interna.
  conves: [
    item('timao', ['timao'], 'parede', [1, 1], 1, { areaMinima: 10 }),
    item('mastro', ['mastro'], 'centro', [1, 1], 2, { areaMinima: 18 }),
    item('canhao', ['canhao-naval'], 'parede', [2, 4], 3, { areaMinima: 12 }),
    item('barril', ['barril-de-rum', 'barril.em-pe', 'pilha-de-barris'], 'canto', [1, 3], 4),
    item('corda', ['rolo-de-corda'], 'canto', [1, 2], 5),
    item('caixote', ['caixote', 'caixa'], 'parede', [0, 2], 6),
    item('bandeira', ['bandeira-pirata'], 'canto', [0, 1], 7, { areaMinima: 16 }),
    item('luneta', ['luneta-e-sextante'], 'parede', [0, 1], 8, { areaMinima: 16 }),
    item('rede', ['rede-de-dormir'], 'parede', [0, 1], 9, { areaMinima: 20 }),
  ],
  'cabine-do-capitao': [
    item('mesa', ['mesa-de-cartografo'], 'centro', [1, 1], 1, { areaMinima: 8 }),
    item('cadeira', ['cadeira'], 'junto', [1, 2], 2, { junto: { de: 'mesa', modo: 'em-frente', folga: 0.1 }, senao: 'parede' }),
    item('bau', ['bau-de-tesouro'], 'parede', [1, 1], 3),
    item('mapa', ['mapa-do-tesouro'], 'sobre', [1, 1], 4, { junto: { de: 'mesa', modo: 'ao-lado' } }),
    item('luneta', ['luneta-e-sextante'], 'sobre', [1, 1], 4.5, { junto: { de: 'mesa', modo: 'ao-lado' } }),
    item('cama', ['rede-de-dormir', 'cama.solteiro'], 'parede', [1, 1], 5, { porArea: [[16, 'cama.casal']] }),
    item('estante', ['estante'], 'na-parede', [0, 1], 6, { areaMinima: 12 }),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 7),
    item('moedas', ['moedas-espalhadas'], 'canto', [0, 1], 8),
    item('quadro', ['mapa.mundi', 'quadro'], 'na-parede', [1, 2], 9),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 10),
  ],
  'taverna-do-porto': [
    item('balcao', ['balcao'], 'parede', [1, 1], 1, { areaMinima: 12, params: { largura: 3 } }),
    item('barril', ['barril-de-rum'], 'parede', [1, 2], 2),
    item('mesa', ['mesa.taverna', 'mesa.redonda-rustica'], 'centro', [1, 3], 3),
    item('banco', ['banco', 'banqueta'], 'junto', [2, 4], 4, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('mapa', ['mapa-do-tesouro'], 'sobre', [0, 1], 5, { junto: { de: 'mesa', modo: 'ao-lado' } }),
    item('barris', ['pilha-de-barris', 'barril.em-pe'], 'canto', [0, 2], 6),
    item('corda', ['rolo-de-corda'], 'canto', [0, 1], 7),
    item('bandeira', ['bandeira-pirata'], 'canto', [0, 1], 8, { areaMinima: 24 }),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 9),
  ],
  fortim: [
    item('canhao', ['canhao-de-forte'], 'parede', [2, 4], 1, { areaMinima: 14 }),
    item('balas', ['pilha-de-balas'], 'canto', [1, 3], 2),
    item('barril', ['barril', 'barril-de-rum'], 'canto', [1, 2], 3),
    item('sino', ['sino-de-cais'], 'canto', [0, 1], 4, { areaMinima: 16 }),
    item('bandeira', ['bandeira-pirata'], 'canto', [0, 1], 5),
    item('caixote', ['caixote', 'caixa'], 'parede', [0, 2], 6),
    item('mesa', ['mesa-de-cartografo'], 'parede', [0, 1], 7, { areaMinima: 30 }),
    item('forca', ['forca'], 'centro', [0, 1], 8, { areaMinima: 36 }),
  ],
  'casa-colonial': [
    item('oratorio', ['oratorio'], 'parede', [1, 1], 1),
    item('mesa', ['mesa.retangular', 'mesa.redonda-rustica'], 'centro', [1, 1], 2, { areaMinima: 9 }),
    item('cadeira', ['cadeira'], 'junto', [2, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('rede', ['rede-de-dormir'], 'parede', [1, 1], 4, { areaMinima: 10 }),
    item('botica', ['botica'], 'parede', [0, 1], 5, { areaMinima: 18, alto: true }),
    item('bau', ['bau', 'bau-de-tesouro'], 'parede', [1, 1], 6),
    item('aparador', ['aparador', 'cristaleira'], 'parede', [0, 1], 7, { alto: true, areaMinima: 12 }),
    item('crucifixo', ['crucifixo'], 'na-parede', [0, 1], 8),
    item('vaso', ['vaso.planta'], 'canto', [1, 2], 9),
    item('quadro', ['quadro'], 'na-parede', [0, 2], 10),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 11),
  ],
  // Vitoriano e steampunk (Q20c). Máquinas só nas áreas maiores; as peças de parede (manômetros, engrenagens) e a luz da caldeira, da bancada e da bobina vêm dos próprios objetos.
  fabrica: [
    item('caldeira', ['caldeira'], 'parede', [1, 1], 1, { areaMinima: 18 }),
    item('maquina', ['maquina-a-vapor'], 'centro', [1, 1], 2, { areaMinima: 30 }),
    item('tear', ['tear-mecanico'], 'parede', [1, 3], 3, { areaMinima: 20 }),
    item('prensa', ['prensa'], 'parede', [1, 2], 4, { areaMinima: 14 }),
    item('esteira', ['esteira'], 'parede', [0, 1], 5, { areaMinima: 24 }),
    item('engrenagens', ['engrenagens'], 'canto', [1, 2], 6, { areaMinima: 10 }),
    item('tubulacao', ['tubulacao.cobre'], 'parede', [1, 2], 7),
    item('manometros', ['painel-de-manometros'], 'na-parede', [1, 2], 8),
    item('engrenagens-parede', ['engrenagens.parede'], 'na-parede', [0, 2], 9),
    item('caixote', ['caixote', 'pilha-de-caixotes'], 'canto', [1, 3], 10),
    item('sacos', ['sacos'], 'canto', [0, 2], 11),
    item('barril', ['barril'], 'canto', [0, 1], 12),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 13),
  ],
  'oficina-de-inventor': [
    item('bancada', ['bancada-de-inventor'], 'parede', [1, 2], 1, { areaMinima: 8 }),
    item('banqueta', ['banqueta', 'cadeira'], 'junto', [1, 2], 2, { junto: { de: 'bancada', modo: 'em-frente', folga: 0.1 } }),
    item('automato', ['automato'], 'canto', [1, 1], 3),
    item('bobina', ['bobina-de-tesla'], 'centro', [1, 1], 4, { areaMinima: 16 }),
    item('prensa', ['prensa'], 'parede', [0, 1], 5, { areaMinima: 14 }),
    item('engrenagens-parede', ['engrenagens.parede'], 'na-parede', [1, 2], 6),
    item('estante', ['estante'], 'na-parede', [1, 2], 7, { escala: 0.4 }),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 8),
    item('gramofone', ['gramofone'], 'canto', [0, 1], 9),
    item('caixote', ['caixote'], 'canto', [0, 2], 10),
    item('quadro', ['mapa.mundi', 'quadros.grupo'], 'na-parede', [0, 1], 11),
  ],
  clube: [
    item('lareira', ['lareira.nobre', 'lareira.marmore'], 'parede', [1, 1], 1, { alto: true, areaMinima: 12 }),
    item('poltrona', ['poltrona.capitone', 'casa:poltrona-capitone-couro'], 'junto', [2, 4], 2, { junto: { de: 'lareira', modo: 'em-frente', folga: 2.2 }, senao: 'parede' }),
    item('sofa', ['sofa.capitone', 'casa:chesterfield-couro'], 'parede', [0, 1], 3, { areaMinima: 20 }),
    item('mesa-centro', ['mesa.centro'], 'centro', [0, 1], 4, { areaMinima: 16 }),
    item('bilhar', ['mesa.bilhar', 'mesa.carteado'], 'centro', [0, 1], 5, { areaMinima: 30 }),
    item('tapete', ['tapete.persa', 'tapete.oval', 'casa:tapete-persa-p-vinho', 'casa:tapete-persa-p-verde'], 'centro', [0, 1], 6, { areaMinima: 14 }),
    item('estante', ['estante'], 'na-parede', [1, 2], 7, { escala: 0.4 }),
    item('aparador', ['aparador'], 'parede', [1, 1], 8, { alto: true, escala: 0.4 }),
    item('gramofone', ['gramofone'], 'canto', [0, 1], 9),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 10),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 11, { areaMinima: 16 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande'], 'na-parede', [1, 3], 12),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 13),
  ],
  // O salão de embarque: o dirigível ancora fora (conjunto ou exemplo), não entra na mobília interior.
  'estacao-de-dirigivel': [
    item('banco', ['banco.longo', 'banco'], 'parede', [2, 4], 1),
    item('banca', ['banca-de-jornal'], 'parede', [0, 1], 2, { areaMinima: 20 }),
    item('relogio', ['relogio-de-rua'], 'canto', [1, 1], 3),
    item('esteira', ['esteira'], 'parede', [0, 1], 4, { areaMinima: 24 }),
    item('malas', ['caixote', 'pilha-de-caixotes'], 'canto', [1, 3], 5),
    item('sacos', ['sacos'], 'canto', [0, 2], 6),
    item('manometros', ['painel-de-manometros'], 'na-parede', [1, 1], 7),
    item('lampiao', ['lampiao-a-gas'], 'canto', [0, 2], 8, { areaMinima: 20 }),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 9),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 10),
  ],
};

/**
 * Como o gênero muda as regras: `trocar` e `sem` usam chaves `funcao:chave`. Em `trocar`, a chave é um item ou uma receita
 * (as receitas do item, ou a receita citada, passam a ser as dadas); `sem` tira o item (e o que dependia dele). `investigacao` não muda nada.
 */
const VARIACOES_BASE: Readonly<Record<string, { trocar?: Record<string, string[]>; sem?: string[] }>> = {
  investigacao: {},
  moderno: {
    sem: ['quarto:estante'],
    trocar: {
      'sala:sofa': ['sofa.canto'], 'quarto:cama': ['cama.box'], 'quarto:cama.casal': ['cama.box'], 'quarto:armario': ['guarda-roupa.liso'], 'banheiro:vaso': ['vaso.moderno'], 'banheiro:pia': ['balcao'],
      'escritorio:escrivaninha': ['escrivaninha.computador'], 'sala-de-jantar:mesa': ['mesa.vidro'], 'cozinha:mesa': ['mesa.vidro'],
      'oficina:bancada': ['bancada.ferramentas'], 'oficina:banqueta': ['cadeira'], 'dormitorio:bau': ['comoda'], 'cela:cama': ['cama.solteiro'],
      'refeitorio:mesa': ['mesa.retangular'], 'refeitorio:banco': ['cadeira', 'banco'], 'salao:mesa': ['mesa.retangular'], 'salao:banco': ['cadeira'],
    },
  },
  fantasia: {
    sem: ['cozinha:balcao'],
    trocar: {
      'taverna:cadeira': ['banco', 'banqueta'], 'cozinha:cadeira': ['banco', 'banqueta'], 'sala:sofa': ['banco'], 'taverna:mesa': ['mesa.taverna', 'mesa.redonda-rustica'], 'taverna:banco': ['banco.longo'], 'cozinha:mesa': ['mesa.taverna', 'mesa.cavalete'],
      'quarto:cama': ['catre', 'enxergao'], 'quarto:cama.casal': ['cama.dossel'], 'quarto:armario': ['bau'], 'quarto:comoda': ['bau'], 'porao:caixote-canto': ['barril.em-pe'], 'porao:caixote-parede': ['barril.deitado', 'caixa'], 'sala:lareira': ['lareira.pedra'],
      'forja:lareira': ['fornalha'], 'sala-de-jantar:mesa': ['mesa.cavalete', 'mesa.banquete'], 'sala-de-jantar:cadeira': ['cadeira.espaldar'], 'hospital:cama': ['catre', 'enxergao'],
      'oficina:bancada': ['bancada.trabalho'], 'oficina:banqueta': ['banqueta'], 'cela:cama': ['catre', 'enxergao'], 'dormitorio:bau': ['bau'],
      'refeitorio:mesa': ['mesa.banquete', 'mesa.taverna'], 'refeitorio:banco': ['banco.longo'], 'refeitorio:lareira': ['lareira.pedra'],
      'salao:mesa': ['mesa.banquete'], 'salao:banco': ['banco.longo'], 'salao:lareira': ['lareira.pedra'],
    },
  },
};

/** Antiguidade: parte do que a fantasia troca (banco no lugar de cadeira, catre, lareira de pedra) e põe a mesa romana nas salas de comer. */
export const VARIACOES_DE_GENERO: Readonly<Record<string, { trocar?: Record<string, string[]>; sem?: string[] }>> = {
  ...VARIACOES_BASE,
  antiguidade: {
    sem: VARIACOES_BASE.fantasia!.sem,
    trocar: { ...VARIACOES_BASE.fantasia!.trocar, 'sala-de-jantar:mesa': ['mesa-romana'], 'sala-de-jantar:cadeira': ['banco'], 'salao:mesa': ['mesa-romana'], 'taverna:mesa': ['mesa-romana'] },
  },
  /** Oriental: a cozinha tem irori no lugar da lareira, mesa baixa com zabutons, tansu e serviço de chá; sem geladeira nem fogão. */
  oriental: {
    sem: ['cozinha:geladeira', 'cozinha:fogao', 'cozinha:balcao', 'cozinha:painel'],
    trocar: { ...VARIACOES_BASE.fantasia!.trocar, 'cozinha:mesa': ['mesa-baixa'], 'cozinha:cadeira': ['zabuton'], 'cozinha:lareira': ['irori'], 'cozinha:aparador': ['tansu'], 'cozinha:servico': ['bule-e-xicaras.oriental'] },
  },
  /** Deserto: almofadas e mesas de latão no lugar de sofás, cadeiras e mesas; tapete de kilim, baús pintados, cântaros e cestos; a cozinha sem geladeira nem fogão e o depósito com cântaros, cestos e baús. */
  deserto: {
    sem: ['cozinha:geladeira', 'cozinha:fogao', 'cozinha:balcao', 'cozinha:painel'],
    trocar: {
      ...VARIACOES_BASE.fantasia!.trocar,
      'sala:sofa': ['almofadas'], 'sala:poltrona': ['almofadas'], 'sala:mesa-centro': ['mesa-de-latao'], 'sala:tapete': ['tapete-de-chao'], 'sala:mesinha': ['mesa-de-latao'], 'sala:recanto': ['almofadas'],
      'quarto:tapete': ['tapete-de-chao'], 'quarto:armario': ['bau-pintado'], 'quarto:comoda': ['bau-pintado'],
      'sala-de-jantar:mesa': ['mesa-de-latao'], 'sala-de-jantar:cadeira': ['almofadas'], 'salao:mesa': ['mesa-de-latao'], 'salao:banco': ['almofadas'], 'taverna:mesa': ['mesa-de-latao'], 'taverna:banco': ['almofadas'], 'taverna:cadeira': ['almofadas'],
      'cozinha:mesa': ['mesa-de-latao'], 'cozinha:cadeira': ['almofadas'],
      'deposito:barril': ['cantaros-empilhados', 'jarro-de-barro'], 'deposito:caixote': ['cesto', 'bau-pintado'], 'deposito:sacos': ['sacos', 'cesto'],
    },
  },
  /** Faroeste: a taverna ganha balcão de saloon, mesas de pôquer e cabeça de bisão; o estábulo guarda poste com cocho e bomba de manivela; escritório com a mesa do xerife. */
  faroeste: {
    sem: VARIACOES_BASE.fantasia!.sem,
    trocar: {
      ...VARIACOES_BASE.fantasia!.trocar,
      'taverna:balcao': ['balcao-de-saloon'], 'taverna:mesa': ['mesa-de-poquer', 'mesa.redonda-rustica'], 'taverna:cadeira': ['cadeira'], 'taverna:banco': ['banco'], 'taverna:trofeu': ['cabeca-de-bufalo'],
      'salao:mesa': ['mesa-de-poquer', 'mesa.taverna'], 'salao:banco': ['banco'],
      'estabulo:bebedouro': ['bebedouro', 'poste-de-amarrar'], 'estabulo:tina': ['bomba-de-manivela', 'tina-de-agua'],
      'escritorio:escrivaninha': ['mesa-de-xerife', 'escrivaninha'], 'cela:cama': ['catre'],
    },
  },
  /** Colonial: o porão guarda barris de rum e fardos de açúcar; a taverna, barril de rum; o quarto, rede de dormir; o escritório, a mesa de cartógrafo; o depósito, fardos; a loja, botica. */
  colonial: {
    sem: VARIACOES_BASE.fantasia!.sem,
    trocar: {
      ...VARIACOES_BASE.fantasia!.trocar,
      'porao:caixote-canto': ['barril-de-rum', 'fardos-de-acucar'], 'porao:caixote-parede': ['fardos-de-acucar', 'barril-de-rum', 'caixa'],
      'taverna:barril': ['barril-de-rum'], 'quarto:cama': ['rede-de-dormir', 'catre'], 'escritorio:escrivaninha': ['mesa-de-cartografo', 'escrivaninha'],
      'deposito:barril': ['barril-de-rum', 'pilha-de-barris'], 'deposito:caixote': ['fardos-de-acucar', 'caixote'], 'loja:estante-piso': ['botica', 'estante.piso'],
    },
  },
  /** Vitoriano: parte da investigação (a casa burguesa, sem as trocas rústicas da fantasia), com gramofone na sala, autômato e engrenagens de parede no escritório, bancada de inventor na oficina comum, caixotes e sacos no porão. */
  vitoriano: {
    trocar: {
      'sala:relogio': ['gramofone', 'relogio.pe'], 'escritorio:globo': ['globo.terrestre', 'automato'], 'escritorio:mapa': ['engrenagens.parede', 'mapa.mundi'],
      'oficina:bancada': ['bancada-de-inventor', 'bancada.trabalho'], 'oficina:amolar': ['engrenagens', 'pedra-de-amolar'],
      'porao:caixote-canto': ['caixote', 'sacos'], 'porao:caixote-parede': ['pilha-de-caixotes', 'caixote'],
    },
  },
};

/** As regras de uma função para um gênero (id desconhecido vale como `investigacao`). Uma função sem regra devolve lista vazia. */
export function regrasPara(funcao: string, genero: string): ItemDeRegra[] {
  const base = REGRAS_DE_MOBILIA[funcao] ?? [], v = VARIACOES_DE_GENERO[genero] ?? {}, id = generoDe(genero).id;
  // Itens do acervo que servem só a certos gêneros (`generos` não vazio) saem das alternativas dos outros; um gênero aceita também os que herda.
  const aceitos = generosVisiveis(id), serve = (r: string) => { const g = ACERVO.item(r)?.generos ?? []; return !g.length || g.some(x => aceitos.includes(x)); };
  const tirados = new Set((v.sem ?? []).filter(k => k.startsWith(`${funcao}:`)).map(k => k.slice(funcao.length + 1)));
  // Quem dependia de um item tirado sai junto, em cascata.
  // Quem tem alternativa (`senao`) fica: sem a âncora, vai para o centro ou para a parede.
  let mudou = true; while (mudou) { mudou = false; for (const r of base) if (!tirados.has(r.id) && r.junto && !r.senao && tirados.has(r.junto.de)) { tirados.add(r.id); mudou = true; } }
  const lista = base.filter(r => !tirados.has(r.id)).map(r => {
    const troca = v.trocar?.[`${funcao}:${r.id}`] ?? null;
    const porReceita = (alternativas: string[]) => alternativas.flatMap(x => v.trocar?.[`${funcao}:${x}`] ?? [x]);
    const receitas = (troca ?? porReceita(r.receitas)).filter(serve);
    return { ...r, receitas: [...new Set(receitas)], ...(r.porArea ? { porArea: r.porArea.map(([a, rec]) => [a, (v.trocar?.[`${funcao}:${rec}`] ?? [rec])[0]!] as [number, string]) } : {}) };
  }).filter(r => r.receitas.length > 0);
  // Quem depende de um item que ficou sem nenhuma alternativa para este gênero sai também (em cascata).
  let restantes = lista;
  for (let mudou = true; mudou;) { const ids = new Set(restantes.map(r => r.id)), antes = restantes.length; restantes = restantes.filter(r => !r.junto || r.senao || ids.has(r.junto.de)); mudou = restantes.length !== antes; }
  return restantes.sort((a, b) => a.prioridade - b.prioridade);
}
