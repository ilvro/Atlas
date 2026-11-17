import type { Exemplo } from './kit.ts';

/** Pântano das brumas (40 × 30 m): canais de água escura entre bancos de lama e cristas de pedra, casulos de criaturas e um círculo que brilha na névoa. */
export const pantanoDasBrumas: Exemplo = {
  id: 'pantano-das-brumas',
  nome: 'Pântano das brumas',
  descricao: 'Canais de água negra entre bancos de lama rachada e cristas de pedra com musgo, casulos de criaturas, raízes, um círculo de pedras que brilha e névoa fechando as bordas.',
  largura: 40,
  altura: 30,
  semente: 10433,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#0b1214' });
    k.base('grama.escura');

    // Bancos de lama e cascalho, depois os canais em diagonal (de noroeste para sudeste).
    k.pintar('lama', { poligono: [[0, 2], [24, 4], [36, 14], [30, 17], [14, 13], [0, 12]], irregular: 0.8 });
    k.pintar('lama', { poligono: [[0, 19], [16, 20], [30, 26], [28, 31], [0, 31]], irregular: 0.8 });
    k.pintar('terra', { poligono: [[6, 7.5], [18, 8], [22, 11], [12, 12.4], [5, 11]], irregular: 1 });
    k.pintar('agua.turfa', { faixa: [[-1, 4], [8, 5], [18, 4.4], [27, 7.4], [33, 10]], largura: 3.6, irregular: 0.6 });
    k.pintar('agua.turfa', { faixa: [[-1, 15.8], [8, 16.4], [18, 15.6], [26, 18.6], [34, 21], [41, 22]], largura: 4.6, irregular: 0.7 });
    k.pintar('agua.turfa', { faixa: [[10, 28], [18, 26.4], [24, 28.6], [27, 31]], largura: 3.4, irregular: 0.6 });
    k.correnteza('agua.turfa', 0.3, 0.12);
    k.pintar('cascalho', { faixa: [[0, 14], [10, 14.2], [20, 13.4], [30, 16.4], [40, 19.4]], largura: 0.9, irregular: 0.9 });
    k.pintar('cascalho', { faixa: [[0, 18], [12, 18.6], [24, 21], [36, 24.6]], largura: 0.8, irregular: 0.9 });

    // Cristas de pedra com musgo ao longo dos canais.
    for (const [x, y, t, r] of [[6.4, 9.6, 2.6, 0.3], [10.4, 10.4, 3.2, 1.1], [14.2, 9.6, 2.2, 2], [33.4, 4.2, 1.8, 0.6], [36.6, 12.4, 1.4, 2.4], [3.2, 24.6, 1.6, 1.4], [33.6, 27.4, 1.7, 0.2], [24.2, 23.2, 1.2, 2.9]] as const) {
      k.objeto('rochedo', [x, y], { params: { tamanho: t, cobertura: 1, tom: 1 }, rotation: r });
    }
    k.espalhar('encosta-rochosa', { poligono: [[0, 12.4], [22, 12.2], [34, 15.6], [40, 18.4], [40, 19.6], [33, 17.4], [20, 14.4], [0, 14.6]] }, { densidade: 0.18 });
    k.espalhar('encosta-rochosa', { poligono: [[0, 18.6], [14, 19], [26, 22], [38, 25.8], [38, 27], [24, 23.6], [12, 20.8], [0, 20.8]] }, { densidade: 0.16 });

    // Casulos: o ninho que dá nome ao lugar.
    for (const [x, y, t, r] of [[9.2, 1.8, 2.2, 0.2], [19.8, 10.0, 3, -0.5], [27.8, 12.0, 2.0, 0.8], [31.0, 6.4, 3.2, 1.6], [26.4, 24.0, 3.4, -0.3], [18.6, 21.8, 2.2, 0.4]] as const) {
      k.objeto('casulo', [x, y], { params: { tamanho: t }, rotation: r });
    }
    k.objeto('pilha-de-ossos', [24.4, 13.4], { rotation: 0.4 });
    k.objeto('cranio-animal', [22.6, 15.2], { params: { chifres: 1 }, rotation: 2.2 });

    // O círculo de pedras que brilha, com uma carcaça presa em raízes.
    k.objeto('circulo-runico', [29.4, 20.2], { params: { raio: 1.4, raios: 6 }, rotation: 0 });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.objeto('pedra.pequena', [29.4 + Math.cos(a) * 1.7, 20.2 + Math.sin(a) * 1.7], { rotation: a }); }
    k.luz('luar', [29.4, 20.2], { radius: 6, intensity: 1.4, color: '#c8ff9a', flicker: 0.15 });
    k.objeto('raiz-exposta', [26.6, 17.4], { rotation: 2.6, scale: 1.4 });
    k.objeto('arvore-morta-caida', [25.4, 18.2], { rotation: 0.5 });

    // Mata morta e juncos nas margens.
    for (const [x, y, s] of [[2.2, 28.0, 1.2], [37.4, 1.6, 1.4], [38.0, 28.4, 1]] as const) k.objeto('arvore-morta', [x, y], { params: { tamanho: s }, rotation: k.rng() * 6 });
    k.espalhar('bosque-morto', { poligono: [[0, 0], [8, 0], [6, 3], [0, 3]] }, { densidade: 0.08 });
    for (const [x, y] of [[6.2, 5.6], [14.4, 3.2], [22.2, 5.6], [7.4, 17.8], [15.6, 17.4], [31.8, 19.6], [14.4, 27.6], [21.2, 25.4]] as const) k.objeto('junco', [x, y], { scale: 1.3, rotation: k.rng() * 6 });
    for (const [x, y] of [[12.2, 6], [3.4, 15.2], [36.4, 23.4]] as const) k.objeto('vitoria-regia', [x, y], { params: { flor: 0 }, rotation: k.rng() * 6 });
    k.presenca('musgo', { poligono: [[0, 12], [40, 17], [40, 20], [0, 15]], irregular: 1 }, 0.4);
    k.presenca('algas', { faixa: [[-1, 15.8], [18, 15.6], [34, 21]], largura: 1.2, irregular: 1 }, 0.4);

    k.clima('neblina', { time: '21:40', ambient: { color: '#9cb6bc', intensity: 0.78 }, sun: null, tempo: { fog: 0.3, wind: 0.1 } });
    k.acabamento(null, { tint: '#d6e6e4', saturation: 0.78, vignette: 0.42, edges: { kind: 'fog', amount: 0.28 }, glow: 0.65 });
    k.guardarClima('manha-palida', 'Manhã pálida', 'neblina');

    k.regiao([[26, 17], [33, 17], [33, 23.5], [26, 23.5]], 'trigger', { nome: 'Círculo de pedras', texto: 'A luz verde pulsa como um coração; os casulos respondem estalando.' });
    k.notas('Pântano das brumas — o ninho de uma rainha que ninguém viu. Os casulos eclodem quando o círculo de pedras brilha; quem atravessar pelos bancos de cascalho evita a água, mas não o ninho.');
  },
};
