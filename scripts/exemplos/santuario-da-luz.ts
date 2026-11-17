import type { Exemplo } from './kit.ts';

/**
 * Santuário da luz (48 × 27 m): salão subterrâneo aberto, sem paredes de cômodo. Andaimes de obra a oeste, o tablado do
 * relicário no meio sob um feixe de luz fria, quatro braseiros sobre círculos rúnicos e a escadaria monumental a leste,
 * emoldurada por muralhas de alvenaria em degraus. Escadas descem ao norte e ao sul.
 */
export const santuarioDaLuz: Exemplo = {
  id: 'santuario-da-luz',
  nome: 'Santuário da luz',
  descricao: 'Salão subterrâneo de lajes escuras: tablado do relicário sob um feixe de luz fria, quatro braseiros sobre círculos rúnicos, escadaria monumental entre muralhas a leste e andaimes de obra a oeste.',
  largura: 48,
  altura: 27,
  semente: 7741,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#06070a' });
    k.base('lajes.escuras');
    // Rocha viva na borda oeste e o chão rachado onde a escavação começou.
    k.pintar('rocha.caverna', { poligono: [[-1, -1], [1.4, -1], [1.2, 28], [-1, 28]], irregular: 0.6 });
    k.pintar('rocha.rachada', { poligono: [[1.4, 0], [8, 0], [8, 27], [1.2, 27]], irregular: 0.4 });

    // Andaimes de obra encostados na rocha, a oeste, com cordas e ferramentas.
    k.objeto('andaime', [4.4, 7], { params: { comprimento: 12, largura: 4.4 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('andaime', [4.4, 20], { params: { comprimento: 11, largura: 4.4 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('escada.de-mao', [7.6, 13.4], { params: { comprimento: 3.4 }, rotation: Math.PI / 2 + 0.2 });
    k.objeto('braseiro', [8.4, 21.4], { scale: 0.9 });
    k.luz('fogueira', [8.4, 21.4], { radius: 5, intensity: 1.2, color: '#ff9440' });
    for (const [item, x, y, r, s] of [['rolo-de-corda', 9.4, 8.6, 0, 1.6], ['pilha-de-lenha', 9.6, 4.2, 1.5, 1], ['caixote', 9.2, 17.6, 0.3, 1], ['barril', 10.4, 23.4, 0, 1.1], ['carrinho-de-mao', 11.4, 22.4, 0.9, 1], ['tabua-solta', 16.2, 22.4, 0.3, 1.4], ['tabua-solta', 12.6, 4.6, 2.2, 1.3]] as const) k.objeto(item, [x, y], { rotation: r, scale: s });

    // O tablado do relicário: estrado de pedra em chanfro, o fosso de luz, o guardião caído, armas e o sangue.
    k.objeto('tablado', [21.8, 13.6], { params: { largura: 9.4 }, rotation: 0, blocks: { move: false, sight: false } });
    k.objeto('fosso-de-luz', [21.8, 13.2], { params: { largura: 2.6, cor: 0 }, rotation: 0 });
    k.objeto('ossada', [21.6, 13.4], { rotation: 0.4, scale: 1.8 });
    k.objeto('armas-caidas', [23.6, 12.4], { rotation: 1.4, scale: 1.3 });
    k.objeto('armas-caidas', [19.8, 15.2], { rotation: -0.6, scale: 1.1 });
    k.objeto('bau', [20.4, 16.4], { rotation: -0.5 });
    k.objeto('escudos-empilhados', [24.4, 15.6], { rotation: 0.8 });
    k.presenca('ordem.sangue', { disco: [20.8, 18.9], raio: 0.5, irregular: 0.8 }, 0.55);
    k.luz('feixe', [21.8, 13.4], { radius: 5.5, intensity: 1.25 });

    // Quatro braseiros sobre círculos rúnicos.
    for (const [x, y] of [[29.4, 2.8], [30, 24.4], [40.6, 1.4], [42, 25.6]] as const) {
      k.objeto('circulo-runico', [x, y], { params: { raio: 2.4, raios: 8 }, rotation: (x * 0.37) % 1 });
      k.objeto('braseiro', [x, y], { rotation: (y * 0.7) % 6, scale: 2.2 });
      k.luz('fogueira', [x, y], { radius: 7.5, intensity: 1.7, color: '#ff7a24' });
    }

    // A escadaria monumental a leste, entre muralhas de alvenaria em degraus, com lanternas nos cantos.
    k.objeto('escada.pedra', [39, 13.2], { params: { largura: 4, comprimento: 6 }, rotation: Math.PI / 2, scale: 1.8, blocks: { move: false, sight: false } });
    k.objeto('muralha-em-degraus', [40.6, 5.2], { params: { largura: 15, profundidade: 4.6, degraus: 3 }, rotation: 0 });
    k.objeto('muralha-em-degraus', [40.6, 21.4], { params: { largura: 15, profundidade: 4.6, degraus: 3 }, rotation: Math.PI });
    for (const y of [8.2, 18.6]) { k.objeto('lanterna-de-poste', [32.8, y]); k.luz('lanterna', [32.8, y], { radius: 4.5, intensity: 1.1, color: '#ff9a40' }); }
    k.objeto('estandarte', [34.2, 8.6], { params: { cor: 1 }, rotation: Math.PI / 2 });

    // Escadas que descem ao norte e ao sul.
    k.objeto('escada.pedra', [15, 1.6], { params: { largura: 4, comprimento: 3.2 }, rotation: 0, scale: 1.6, blocks: { move: false, sight: false } });
    k.objeto('escada.pedra', [15, 25.4], { params: { largura: 4, comprimento: 3.2 }, rotation: Math.PI, scale: 1.6, blocks: { move: false, sight: false } });

    // Entulho grande ao sul do tablado e escombros pelo salão.
    for (const [x, y, s] of [[25.6, 21.2, 3.4], [27.6, 19.6, 1.6], [13.8, 9.2, 1.4], [34.6, 12.2, 1.2], [36.8, 26.2, 1.6], [31, 6.4, 1.1]] as const) k.objeto('escombros', [x, y], { scale: s, rotation: (x * 0.3) % 3 });
    for (const [x, y] of [[17.2, 6.4], [27, 8.6], [16.4, 19.8], [33.2, 15.8], [11.6, 13.6], [28.6, 15.4]] as const) k.objeto('seixos', [x, y], { scale: 1.5, rotation: x });
    k.objeto('pilha-de-ossos', [33.6, 3.4], { rotation: 0.2 });

    k.clima('apagao', { time: '23:30', ambient: { color: '#6f80aa', intensity: 0.66 }, sun: null, tempo: { fog: 0.2, dust: 0.15 } });
    k.acabamento(null, { vignette: 0.5, saturation: 1.0, tint: '#dde6ff', edges: { kind: 'dark', amount: 0.35 }, glow: 0.95 });
    k.guardarClima('ritual', 'Ritual em curso', undefined, { tempo: { embers: 0.4, fog: 0.3 } });

    k.regiao([[17, 9], [26.6, 9], [26.6, 18.4], [17, 18.4]], 'trigger', { nome: 'Tablado do relicário', texto: 'Um feixe de luz branca, sem origem, cai sobre o tablado. O guardião jaz na beira do fosso, ainda agarrado à espada.' });
    k.notas('Santuário da luz — o relicário de uma ordem extinta, no fundo de uma mina. A escadaria leste leva à superfície; os andaimes oeste são dos saqueadores que chegaram primeiro. Quem apagar os quatro braseiros apaga também a luz do relicário, e o guardião se levanta.');
  },
};
