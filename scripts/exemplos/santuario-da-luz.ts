import { terreno } from '../../src/authoring/construcao.ts';
import type { Exemplo } from './kit.ts';

/** Santuário da luz (48 × 27 m): salão subterrâneo com o tablado do relicário sob uma luz fria, braseiros sobre círculos rúnicos e a escadaria que sobe a leste. */
export const santuarioDaLuz: Exemplo = {
  id: 'santuario-da-luz',
  nome: 'Santuário da luz',
  descricao: 'Salão subterrâneo de pedra: tablado do relicário banhado por uma luz fria, quatro braseiros sobre círculos rúnicos, escadaria monumental a leste e andaimes de madeira a oeste.',
  largura: 48,
  altura: 27,
  semente: 7741,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#06070a' });
    k.base('rocha.rachada');

    // O salão é um cômodo de lajes; a nave da escadaria abre a leste. O tablado fica 0,6 m acima do piso.
    const salao = k.comodo([[1, 1, 25, 17], [25, 4, 31, 14]], 'salao', { nome: 'Salão do relicário', piso: 'laje.pedra', papel: 'pedra.aparelhada', telhado: null });
    k.porta([46.5, 13.5], 'arch', { width: 3, state: 'open', material: 'pedra.escura' });
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 0.6, forma: { retangulo: [15, 8.5, 25, 18.5] } }], 3));
    for (const [x, y, r] of [[20, 7.6, Math.PI], [20, 19.4, 0], [14.1, 13.5, Math.PI / 2], [25.9, 13.5, -Math.PI / 2]] as const) k.objeto('escada.externa', [x, y], { params: { largura: 3 }, rotation: r, blocks: { move: false, sight: false } });

    // O relicário: o fosso de onde sobe a luz, o corpo do guardião caído na beira, armas e o baú arrombado.
    k.objeto('fosso-de-luz', [20, 13.5], { params: { largura: 2.8, cor: 0 }, rotation: 0, blocks: { move: true, sight: false } });
    k.objeto('ossada', [21.4, 15.6], { rotation: 0.5, scale: 1.2 });
    k.objeto('armas-caidas', [18.0, 16.2], { rotation: 1.1, scale: 1.2 });
    k.objeto('bau', [23.4, 10.4], { rotation: -0.5 });
    k.objeto('escudos-empilhados', [16.6, 10.6], { rotation: 0.4 });
    for (const [x, y] of [[15.8, 9.3], [24.2, 9.3], [15.8, 17.7], [24.2, 17.7]] as const) k.objeto('coluna-arruinada', [x, y], { scale: 1.3, rotation: 0 });
    k.presenca('ordem.sangue', { disco: [21.0, 17.2], raio: 0.45, irregular: 0.8 }, 0.45);

    // Braseiros sobre círculos rúnicos, dois de cada lado do tablado.
    for (const [x, y] of [[8, 5.5], [31, 5.5], [8, 21.5], [31, 21.5]] as const) {
      k.objeto('circulo-runico', [x, y], { params: { raio: 2.4, raios: 8 }, rotation: k.rng() });
      k.objeto('braseiro', [x, y], { rotation: k.rng() * 6, scale: 1.4 });
      k.luz('fogueira', [x, y], { radius: 7.5, intensity: 1.3, color: '#ff9a3c' });
    }

    // Escadaria monumental a leste, entre muralhas de alvenaria em degraus.
    k.objeto('escada.pedra', [42.2, 13.5], { params: { largura: 6.4, comprimento: 6 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('muralha-em-degraus', [42.0, 8.2], { params: { largura: 9, profundidade: 4, degraus: 3 }, rotation: 0 });
    k.objeto('muralha-em-degraus', [42.0, 18.8], { params: { largura: 9, profundidade: 4, degraus: 3 }, rotation: Math.PI });
    for (const y of [9.6, 17.4]) { k.objeto('braseiro', [38.6, y], { scale: 0.8 }); k.luz('tocha', [38.6, y], { radius: 6 }); }
    k.objeto('estandarte', [37.2, 11.2], { params: { cor: 1 }, rotation: Math.PI / 2 });
    k.objeto('estandarte', [37.2, 15.8], { params: { cor: 1 }, rotation: Math.PI / 2 });

    // Andaimes e tralha de obra a oeste; entulho e cordas.
    for (const y of [5, 10, 15, 20]) k.objeto('cais-segmento', [3.6, y], { params: { comprimento: 4.6, largura: 2.2 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('rolo-de-corda', [3.8, 6.6], { rotation: 0, scale: 1.5 });
    k.objeto('rolo-de-corda', [4.2, 18.4], { rotation: 1, scale: 1.4 });
    k.objeto('escada.de-mao', [6.4, 12.4], { params: { comprimento: 3.4 }, rotation: 0.1 });
    k.objeto('pilha-de-caixotes', [9.6, 24.4], { rotation: 0.3 });
    k.objeto('barril', [11.8, 24.6]); k.objeto('barril.deitado', [6.6, 2.8], { rotation: 0.4 });
    for (const [x, y, s] of [[27.6, 23.2, 2.4], [12.4, 2.8, 1.8], [33.8, 13.8, 1.4], [6.6, 16.2, 1.6]] as const) k.objeto('escombros', [x, y], { scale: s, rotation: 0 });
    for (const [x, y] of [[26.4, 2.6], [14.2, 22.8], [29.6, 16.2], [11.6, 9.4]] as const) k.objeto('seixos', [x, y], { scale: 1.5 });
    k.objeto('carrinho-de-mao', [12.8, 6.8], { rotation: 0.8 });
    k.objeto('pilha-de-ossos', [33.6, 2.8], { rotation: 0.2 });
    k.espalhar('bagunca', { poligono: [[6, 3], [13, 3], [13, 24], [6, 24]] }, { densidade: 0.1 });
    k.espalhar('caixotes', { poligono: [[25, 19], [36, 19], [36, 25], [25, 25]] }, { densidade: 0.12 });

    // A luz fria que desce de uma abertura no teto sobre o fosso, e duas velas no tablado.
    k.luz('feixe', [20, 13.5], { radius: 7.5, intensity: 1.6 });
    k.luz('vela', [17.4, 11.0]);
    k.luz('vela', [22.6, 16.0]);

    k.clima('apagao', { time: '23:30', ambient: { color: '#5f72a6', intensity: 0.46 }, sun: null, tempo: { fog: 0.12 } });
    k.acabamento(null, { vignette: 0.55, saturation: 0.95, tint: '#e6ecff', edges: { kind: 'dark', amount: 0.45 }, glow: 0.75 });
    k.guardarClima('ritual', 'Ritual em curso', undefined, { tempo: { embers: 0.4, fog: 0.25 } });

    k.notaDeComodo(salao, {
      leitura: 'Um feixe de luz branca, sem origem, cai sobre o tablado. Em volta, quatro braseiros ardem sobre círculos gravados no chão.',
      notasMestre: 'Quem apagar os quatro braseiros apaga também a luz do relicário, e o guardião se levanta.',
    });
    k.notas('Santuário da luz — o relicário de uma ordem extinta, no fundo de uma mina. A escadaria leste leva à superfície; os andaimes oeste são dos saqueadores que chegaram primeiro.');
  },
};
