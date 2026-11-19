import type { Exemplo } from './kit.ts';

/**
 * Santuário da luz (48 × 27 m), teste da Frente L. Salão subterrâneo de lajes escuras: andaimes de obra a oeste, o estrado
 * do relicário no meio com o fosso de luz fria, quatro braseiros sobre círculos rúnicos e a escadaria que sobe a leste entre
 * duas muralhas em patamares. Escadas descem ao norte e ao sul. As estruturas usam o material do piso e a altura real: o
 * volume vem da luz com relevo, não de sombra pintada.
 */
export const santuarioDaLuz: Exemplo = {
  id: 'santuario-da-luz',
  nome: 'Santuário da luz',
  descricao: 'Salão subterrâneo de lajes escuras: estrado do relicário com um fosso de luz fria, quatro braseiros sobre círculos rúnicos, escadaria entre muralhas a leste e andaimes de obra a oeste.',
  largura: 48,
  altura: 27,
  semente: 7741,
  construir(k) {
    const PISO = 'lajes.escuras';
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#06070a' });
    k.base(PISO);
    // Rocha viva na borda oeste, onde a escavação começou.
    k.pintar('rocha.caverna', { poligono: [[-1, -1], [1.6, -1], [1.3, 28], [-1, 28]], irregular: 0.6 });
    k.pintar('rocha.rachada', { poligono: [[1.4, 0], [3.2, 0], [3, 27], [1.2, 27]], irregular: 0.5 });

    // Andaimes de obra a oeste: duas plataformas de tábuas sobre vigas, escada de mão entre elas, cordas e ferramentas.
    k.objeto('estrutura.plataforma', [5.6, 7.2], { params: { comprimento: 12.5, largura: 4.2, altura: 0.9, guarda: 0 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('estrutura.plataforma', [5.6, 20.6], { params: { comprimento: 11, largura: 4.2, altura: 0.9, guarda: 0 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('escada.de-mao', [8.2, 14], { params: { comprimento: 3 }, rotation: Math.PI / 2 + 0.25 });
    for (const [item, x, y, r, s] of [['rolo-de-corda', 5, 4.2, 0, 1.4], ['rolo-de-corda', 4.6, 10.4, 1, 1.1], ['pilha-de-lenha', 9.8, 4.4, 1.5, 1], ['caixote', 9.6, 17.8, 0.3, 1], ['barril', 10.6, 23.4, 0, 1.1], ['carrinho-de-mao', 11.6, 22, 0.9, 1], ['tabua-solta', 16.4, 21.6, 0.3, 1.4], ['tabua-solta', 12.8, 6, 2.2, 1.3]] as const) k.objeto(item, [x, y], { rotation: r, scale: s });
    k.objeto('braseiro', [8.6, 23], { scale: 0.85 });
    k.luz('fogueira', [8.6, 23], { radius: 5.5, intensity: 1.6, color: '#ff8a3a' });

    // Escadas que descem ao norte e ao sul, com o piso em volta.
    k.objeto('estrutura.escadaria', [16.6, 2.5], { params: { largura: 7, comprimento: 5, desce: 1, muretas: 1, material: PISO }, rotation: 0, blocks: { move: false, sight: false } });
    k.objeto('estrutura.escadaria', [16.6, 24.5], { params: { largura: 7, comprimento: 5, desce: 1, muretas: 1, material: PISO }, rotation: Math.PI, blocks: { move: false, sight: false } });

    // O estrado do relicário: dois degraus em volta, o fosso de luz no topo, o guardião caído, armas e sangue.
    k.objeto('estrutura.estrado', [22.6, 13.4], { params: { largura: 9.6, profundidade: 9.6, altura: 0.55, degraus: 2, material: 'laje.pedra' }, rotation: 0, blocks: { move: false, sight: false } });
    k.objeto('fosso-de-luz', [22.6, 13.4], { params: { largura: 3.6, cor: 0 }, rotation: 0 });
    k.objeto('ossada', [22.4, 13], { rotation: 0.4, scale: 2.1 });
    k.objeto('armas-caidas', [24.4, 12], { rotation: 1.4, scale: 1.2 });
    k.objeto('armas-caidas', [20.6, 15.2], { rotation: -0.6, scale: 1.1 });
    k.objeto('bau', [21, 16.2], { rotation: -0.5 });
    k.objeto('viga-partida', [24.4, 15.2], { rotation: 2.4 });
    k.presenca('ordem.sangue', { disco: [21.4, 19.2], raio: 0.55, irregular: 0.8 }, 0.6);
    k.luz('feixe', [22.6, 13.4], { radius: 5.5, intensity: 1.4, color: '#dfeaff' });

    // A escadaria que sobe a leste, entre muralhas em patamares, com lanternas nos cantos.
    k.objeto('estrutura.escadaria', [41.5, 13.5], { params: { largura: 9.6, comprimento: 13, desce: 0, muretas: 0, material: PISO }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    k.objeto('estrutura.muralha', [40.8, 5.4], { params: { largura: 15, profundidade: 6.2, patamares: 3, material: 'parede.alvenaria' }, rotation: 0, blocks: { move: true, sight: true } });
    k.objeto('estrutura.muralha', [40.8, 21.6], { params: { largura: 15, profundidade: 6.2, patamares: 3, material: 'parede.alvenaria' }, rotation: Math.PI, blocks: { move: true, sight: true } });
    for (const y of [8.9, 18.1]) { k.objeto('lanterna-de-poste', [33.6, y]); k.luz('lanterna', [33.6, y], { radius: 5, intensity: 1.4, color: '#ffa04a' }); }
    k.objeto('estandarte', [34.6, 9], { params: { cor: 1 }, rotation: Math.PI / 2 });
    // O alto da escadaria: a luz quente da superfície descendo pelos degraus.
    k.luz('fogueira', [47.6, 13.5], { radius: 11, intensity: 1.1, color: '#ff9a50', flicker: 0.02 });

    // Quatro braseiros sobre círculos rúnicos.
    for (const [x, y] of [[29.6, 3], [30.2, 24.2], [42, 1.1], [42.4, 25.9]] as const) {
      k.objeto('circulo-runico', [x, y], { params: { raio: 2.4, raios: 8, brilho: 0.6 }, rotation: (x * 0.37) % 1 });
      k.objeto('braseiro', [x, y], { rotation: (y * 0.7) % 6, scale: 1.9 });
      k.luz('fogueira', [x, y], { radius: 8, intensity: 2.2, color: '#ff7a24' });
    }

    // Entulho grande ao sul do estrado e escombros pelo salão.
    for (const [x, y, s] of [[26.2, 21.4, 3.2], [28.2, 19.8, 1.5], [13.8, 9.2, 1.3], [35, 12.4, 1.1], [36.8, 26.2, 1.4], [31.2, 6.6, 1]] as const) k.objeto('escombros', [x, y], { scale: s, rotation: (x * 0.3) % 3 });
    for (const [x, y] of [[17.2, 6.4], [27.4, 8.4], [16.4, 19.6], [33.2, 15.8], [11.6, 13.6], [29, 15.4]] as const) k.objeto('seixos', [x, y], { scale: 1.5, rotation: x });
    k.objeto('pilha-de-ossos', [33.4, 3.6], { rotation: 0.2 });
    for (let i = 0; i < 24; i++) {
      const x = 10 + k.rng() * 22, y = 5 + k.rng() * 17;
      if (x > 16.6 && x < 28.6 && y > 7.4 && y < 19.4) continue;
      const item = ['seixos', 'seixos', 'tabua-solta', 'escombros', 'pedra.pequena', 'viga-partida'][Math.floor(k.rng() * 6)]!;
      k.objeto(item, [x, y], { rotation: k.rng() * 6.28, scale: item === 'escombros' ? 0.6 + k.rng() * 0.5 : 1 + k.rng() * 0.4 });
    }
    // Lamparinas dos saqueadores no andaime.
    for (const y of [5.4, 9.8, 18.6]) k.luz('lamparina', [5.6, y], { radius: 4, intensity: 1.1, color: '#ffb066' });

    k.clima('apagao', { time: '23:30', ambient: { color: '#8394bb', intensity: 0.6 }, sun: null, tempo: { fog: 0.18, dust: 0.12 } });
    k.acabamento('masmorra', { vignette: 0.4, glow: 0.9 });
    k.guardarClima('ritual', 'Ritual em curso', undefined, { tempo: { embers: 0.4, fog: 0.3 } });

    k.regiao([[17.8, 8.6], [27.4, 8.6], [27.4, 18.2], [17.8, 18.2]], 'trigger', { nome: 'Estrado do relicário', texto: 'Um feixe de luz branca, sem origem, sobe do fosso no alto do estrado. O guardião jaz na beira, ainda agarrado à espada.' });
    k.notas('Santuário da luz — o relicário de uma ordem extinta, no fundo de uma mina. A escadaria leste leva à superfície; os andaimes oeste são dos saqueadores que chegaram primeiro. Quem apagar os quatro braseiros apaga também a luz do relicário, e o guardião se levanta.');
  },
};
