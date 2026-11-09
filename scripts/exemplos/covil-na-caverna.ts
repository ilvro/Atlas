import type { Exemplo } from './kit.ts';

/** 10.7a — Covil na caverna (45 × 34 m). */
export const covilNaCaverna: Exemplo = {
  id: 'covil-na-caverna',
  nome: 'Covil na caverna',
  descricao: 'Garganta subterrânea cercada de rocha viva, rastro de sangue seco sob um feixe de luz fria, ossadas e ninho de peles no escuro.',
  largura: 45,
  altura: 34,
  semente: 1071,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#050608' });
    k.base('vazio');

    // Rocha viva cobrindo tudo, com mordidas do vazio nas bordas esquerda e direita.
    k.pintar('rocha.caverna', { retangulo: [0.9, 0, 44.2, 34], irregular: 0.9 });
    k.apagar({ disco: [21.6, 1.8], raio: 1.3, irregular: 0.5 });   // poço negro no alto do promontório

    // O salão: entrada clara a noroeste, o promontório descendo do alto até y ≈ 14, o fundo escuro a leste.
    k.pintar('rocha.rachada', {
      poligono: [
        [5.2, 0], [14.2, 0], [15.2, 3.2], [17.6, 5.6], [17.8, 9.5], [17.2, 12.4], [18.6, 14.8], [22.2, 14.6], [24.6, 12], [25.6, 7.2],
        [27.6, 4.6], [33, 4.2], [38.6, 4.8], [39.8, 9], [39.4, 15], [40, 21], [39.6, 27], [36.5, 29.2], [29, 29.6], [20, 29.2],
        [17.6, 28.8], [5.8, 29.2], [4.6, 24], [4.6, 18], [5.4, 12.5], [4.4, 6], [4.8, 2],
      ],
      irregular: 0.6,
    });
    // Patamar de pedras ao sul do salão (rochas soltas em faixa), com o ninho de esqueletos atrás dele.
    for (const [c, r] of [[[5.6, 20.6], 1.7], [[8.4, 20.2], 1.5], [[10.8, 21.2], 1.2], [[13.2, 21.0], 1.5], [[15.4, 22], 1.3], [[17.4, 23.2], 1.1]] as const) k.pintar('rocha.caverna', { disco: [c[0], c[1]], raio: r, irregular: 0.6 });
    k.pintar('rocha.caverna', { disco: [35.5, 9.8], raio: 1.6, irregular: 0.5 });
    k.pintar('rocha.caverna', { disco: [37.2, 15.6], raio: 1.3, irregular: 0.5 });

    // Dois rastros finos e paralelos de sangue seco: algo foi arrastado da entrada até as peles.
    k.presenca('sangue-seco', { faixa: [[6, 0.6], [6.4, 5], [8, 9], [11, 12], [14.2, 14.4], [18, 16.4], [22, 17.2], [26, 18], [29, 19.2]], largura: 0.5, irregular: 0.2 }, 0.42);
    k.presenca('sangue-seco', { faixa: [[7.6, 0.6], [8, 4.4], [9.6, 8], [12.6, 10.8], [15.6, 13], [19.2, 15.3], [23.2, 16.3], [27, 17.4], [29.6, 18.6]], largura: 0.4, irregular: 0.15 });
    k.presenca('sangue-seco', { disco: [29.6, 19.4], raio: 0.7, irregular: 0.5 });
    k.presenca('sangue-seco', { disco: [11.2, 7.6], raio: 0.55, irregular: 0.4 });
    k.presenca('sangue-seco', { disco: [6.2, 21], raio: 0.7, irregular: 0.5 });

    // Árvore morta caída na boca da caverna, seixos e pedras soltas.
    k.objeto('arvore-morta-caida', [10.6, 2.6], { rotation: 0.42, scale: 1.25 });
    for (const [pos, esc] of [[[2.9, 2.6], 1.2], [[16.2, 8], 1.1], [[21.4, 14.2], 1], [[23.6, 15.3], 1.1], [[11.2, 20.4], 1], [[34.2, 7.4], 0.9], [[25.6, 21.8], 0.8]] as const) k.objeto('seixos', [pos[0], pos[1]], { scale: esc });
    k.objeto('pedra.grande', [3.2, 4.4], { rotation: 0.4 });
    k.objeto('rochedo', [16.6, 22.2], { params: { tamanho: 2.2 }, rotation: 0.6 });
    k.objeto('rochedo', [9.4, 22.4], { params: { tamanho: 1.6 }, rotation: 2.1 });

    // Os dois buracos: na ponta do promontório e no chão a sudeste.
    k.objeto('buraco', [19.6, 13.6], { params: { largura: 1.9 }, rotation: 0.3 });
    k.objeto('buraco', [30.8, 26.8], { params: { largura: 1.3 }, rotation: -0.5 });

    // O ninho: peles e ossos no fundo à direita.
    k.objeto('pilha-de-peles', [31.8, 20.6], { rotation: 0.3, scale: 2.3 });
    k.objeto('pilha-de-peles', [33.8, 22.4], { rotation: 1.9, scale: 1.7 });
    k.objeto('pilha-de-ossos', [34.6, 19.2], { rotation: 0.8, scale: 1.5 });

    // Esqueletos atrás do patamar ao sul, pelo chão e no escuro a leste.
    for (const [pos, rot, esc] of [
      [[8.2, 25.4], 1.4, 1.2], [[11, 26.8], 0.3, 1.15], [[7.2, 27.8], -0.4, 1.1], [[13.4, 25.2], 2.0, 1.1],
      [[22.2, 25], -0.6, 1.2], [[27.6, 25.6], 1.9, 1.2], [[30.6, 9.2], 1.3, 0.85], [[27.4, 12.6], 2.5, 0.8],
    ] as const) k.objeto('ossada', [pos[0], pos[1]], { rotation: rot, scale: esc * 1.35 });
    k.objeto('pilha-de-ossos', [9.8, 28], { rotation: 1.1, scale: 1.8 });
    for (const [pos, chifres, rot] of [[[8, 16.4], 0, 0.7], [[12.6, 23.6], 1, 2.1], [[36.2, 25], 0, -0.8], [[29, 16], 1, 1.4]] as const) k.objeto('cranio-animal', [pos[0], pos[1]], { params: { chifres }, rotation: rot, scale: 1.8 });

    // Luz: feixe frio entrando pela boca da caverna a noroeste, o resto na penumbra
    k.luz('farol', [5.5, -0.5], { radius: 26, color: '#e8f2ff', intensity: 1.5, flicker: 0, power: 'magic', cone: { angle: 0.85, direction: 1.0 }, rays: true });
    k.luz('luar', [10, 8.5], { radius: 14, color: '#dceaff', intensity: 0.8, flicker: 0 });
    k.luz('luar', [22, 20], { radius: 16, color: '#9fb6d2', intensity: 0.35, flicker: 0 });

    // Clima e acabamento: penumbra subterrânea azulada com bordas negras e halo no feixe
    k.clima('noite', {
      time: '00:00',
      ambient: { color: '#9ab0c7', intensity: 0.72 },
      sun: null,
      tempo: { fog: 0, dust: 0.15 },
    });
    k.acabamento('frio', {
      tint: '#e4eeff',
      saturation: 0.88,
      vignette: 0.36,
      edges: { kind: 'dark', amount: 0.42 },
      glow: 0.75,
    });

    // Climas salvos do mapa
    k.guardarClima('fresta-fria', 'Fresta de luz fria');
    k.guardarClima('exploracao-tochas', 'Exploradores com tochas', 'noite', {
      ambient: { color: '#3b342c', intensity: 0.34 },
      sun: null,
      tempo: { dust: 0.25, embers: 0.15 },
      finish: { tint: '#ffe6c8', saturation: 0.92, vignette: 0.5, edges: { kind: 'dark', amount: 0.65 }, glow: 0.75 },
    });
    k.guardarClima('breu-total', 'Breu absoluto', 'apagao', {
      ambient: { color: '#141920', intensity: 0.1 },
      sun: null,
      finish: { tint: '#c8d8f0', saturation: 0.6, vignette: 0.7, edges: { kind: 'dark', amount: 0.92 }, glow: 0.8 },
    });

    // Regiões de revelação, gatilho e áudio
    k.regiao([[24, 6], [41, 6], [41, 30], [24, 30]], 'reveal', {
      nome: 'Ninho da fera',
    });
    k.regiao([[5, 2], [17, 2], [17, 15], [5, 15]], 'trigger', {
      nome: 'Rastro na entrada',
      texto: 'O sangue seco nas lajes de calcário ainda cheira a ferro; algo pesado foi arrastado para o escuro a leste.',
    });
    k.regiao([[4, 2], [41, 2], [41, 31], [4, 31]], 'audio', {
      nome: 'Eco da caverna',
      cenaJukebox: 'caverna-profunda',
    });

    k.notas(
      'Covil na caverna — A fresta a noroeste é a única entrada natural; quem desce pelo feixe de luz fria fica visível antes de enxergar o que dorme sobre as peles no fundo escuro.',
    );
  },
};

