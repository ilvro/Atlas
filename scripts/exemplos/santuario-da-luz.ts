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

    // O salão inteiro é um cômodo de lajes; a nave da escadaria fica a leste, um degrau acima.
    const salao = k.comodo([[1, 1, 23, 17], [23, 2, 31, 16]], 'salao', { nome: 'Salão do relicário', piso: 'laje.pedra', papel: 'pedra.aparelhada', telhado: null });
    k.porta([46.5, 13.5], 'arch', { width: 3, state: 'open', material: 'pedra.escura' });
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 0.9, forma: { retangulo: [14.5, 8, 24.5, 18.5] } }], 3));
    k.objeto('laje-de-pedra', [19.5, 13.25], { params: { largura: 9.6, comprimento: 10.2, musgo: 0 }, rotation: 0, blocks: { move: false, sight: false } });
    for (const [x, y, r] of [[19.5, 7.8, 0], [19.5, 18.7, Math.PI], [14.2, 13.25, -Math.PI / 2], [24.8, 13.25, Math.PI / 2]] as const) k.objeto('escada.externa', [x, y], { params: { largura: 3.2 }, rotation: r, blocks: { move: false, sight: false } });

    // O relicário no tablado: o corpo do guardião, armas caídas, um baú arrombado e o altar.
    k.objeto('altar', [19.5, 11.2], { rotation: 0 });
    k.objeto('ossada', [19.2, 13.6], { rotation: 0.6, scale: 1.1 });
    k.objeto('armas-caidas', [21.6, 14.6], { rotation: 1.1 });
    k.objeto('bau', [17.0, 15.4], { rotation: -0.4 });
    k.objeto('relicario', [19.5, 10.6], { rotation: 0 });
    for (const [x, y] of [[15.6, 9.4], [23.4, 9.4], [15.6, 17.1], [23.4, 17.1]] as const) k.objeto('pilar', [x, y], { scale: 1.4 });
    k.presenca('ordem.sangue', { disco: [20.4, 16.6], raio: 0.45, irregular: 0.8 }, 0.45);

    // Braseiros sobre círculos rúnicos, dois de cada lado.
    for (const [x, y] of [[8.5, 5.0], [30.5, 5.0], [8.5, 21.5], [30.5, 21.5]] as const) {
      k.objeto('circulo-runico', [x, y], { params: { raio: 2.2, raios: 8 }, rotation: k.rng() });
      k.objeto('braseiro', [x, y], { rotation: 0, scale: 1.3 });
      k.luz('fogueira', [x, y], { radius: 7.5, intensity: 1.25, color: '#ff9a3c' });
    }

    // Escadaria monumental a leste, entre muros com tochas.
    k.objeto('escada.pedra', [40.5, 13.5], { params: { largura: 4, comprimento: 6 }, rotation: Math.PI / 2, scale: 1.6, blocks: { move: false, sight: false } });
    for (const y of [6.2, 20.8]) { k.objeto('pilar', [36.8, y], { scale: 1.8 }); k.objeto('estandarte', [38.8, y], { params: { cor: 1 }, rotation: Math.PI / 2 }); }
    k.luz('tocha', [36.8, 7.6]);
    k.luz('tocha', [36.8, 19.4]);
    k.luz('fogueira', [45, 13.5], { radius: 6, intensity: 0.8, color: '#ffae5a' });

    // Andaimes e tralha de obra a oeste; entulho e cordas.
    for (const y of [5, 10, 15, 20]) k.objeto('cais-segmento', [3.6, y], { params: { comprimento: 4.6, largura: 2.2 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('rolo-de-corda', [3.8, 6.6], { rotation: 0 });
    k.objeto('rolo-de-corda', [4.2, 18.4], { rotation: 1 });
    k.objeto('escada.de-mao', [6.2, 12.4], { params: { comprimento: 3.4 }, rotation: 0.1 });
    k.objeto('pilha-de-caixotes', [9.6, 25.2], { rotation: 0.3 });
    k.objeto('barril', [11.6, 24.6]);
    for (const [x, y, s] of [[27.4, 23.6, 1.6], [11.2, 2.2, 1.2], [33.2, 9.4, 1.0], [6.4, 24.2, 1.3]] as const) k.objeto('escombros', [x, y], { scale: s });
    for (const [x, y] of [[26.4, 2.4], [13.2, 22.8], [29.2, 13.2]] as const) k.objeto('seixos', [x, y], { scale: 1.3 });
    k.objeto('carrinho-de-mao', [12.6, 7.6], { rotation: 0.8 });
    k.objeto('pilha-de-ossos', [32.4, 2.6], { rotation: 0.2 });

    k.espalhar('bagunca', { poligono: [[6, 3], [13, 3], [13, 24], [6, 24]] }, { densidade: 0.08 });
    k.espalhar('caixotes', { poligono: [[26, 19], [34, 19], [34, 25], [26, 25]] }, { densidade: 0.1 });

    // A luz fria que desce sobre o tablado.
    k.luz('luar', [19.5, 13.2], { radius: 8, intensity: 2.0, color: '#d8ecff', flicker: 0, power: 'magic' });
    k.luz('vela', [17.2, 11.2]);
    k.luz('vela', [21.8, 11.2]);

    k.clima('apagao', { time: '23:30', ambient: { color: '#5d6f9e', intensity: 0.4 }, sun: null, tempo: { fog: 0.15, dust: 0.25 } });
    k.acabamento(null, { vignette: 0.55, saturation: 0.95, tint: '#e6ecff', edges: { kind: 'dark', amount: 0.45 }, glow: 0.75 });
    k.guardarClima('ritual', 'Ritual em curso', undefined, { tempo: { embers: 0.4, fog: 0.25 } });

    k.notaDeComodo(salao, {
      leitura: 'Um feixe de luz branca, sem origem, cai sobre o tablado. Em volta, quatro braseiros ardem sobre círculos gravados no chão.',
      notasMestre: 'Quem apagar os quatro braseiros apaga também a luz do relicário, e o guardião se levanta.',
    });
    k.notas('Santuário da luz — o relicário de uma ordem extinta, no fundo de uma mina. A escadaria leste leva à superfície; os andaimes oeste são dos saqueadores que chegaram primeiro.');
  },
};
