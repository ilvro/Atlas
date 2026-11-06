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

    // Massa externa de rocha de caverna (deixando o vazio negro nas bordas externas)
    k.pintar('rocha.caverna', {
      poligono: [
        [1.5, 0], [43.5, 0], [44.5, 8], [44, 26], [42.5, 33.2],
        [3, 33.5], [1, 27], [0.8, 12],
      ],
      irregular: 0.7,
    });

    // Salão principal e corredor de entrada a noroeste escavados em rocha rachada
    k.pintar('rocha.rachada', {
      poligono: [
        [4.5, 0], [10.5, 0], [14.5, 5.5], [18.5, 8.5],
        [20.5, 11.5], [27.5, 12.2], [31.5, 7.5], [37.5, 7.2],
        [39.5, 14.5], [39.0, 25.5], [35.0, 29.0], [20.0, 28.8],
        [16.5, 22.5], [7.5, 19.5], [5.5, 12.5], [4.0, 5.0],
      ],
      irregular: 0.55,
    });

    // Recesso de ossos no canto sudoeste
    k.pintar('rocha.rachada', {
      poligono: [
        [6.5, 22.0], [16.0, 22.5], [17.0, 29.2], [6.0, 29.0],
      ],
      irregular: 0.45,
    });

    // Saliência maciça de rocha no centro-norte (o grande promontório da referência)
    k.pintar('rocha.caverna', {
      poligono: [
        [18.0, 0], [32.0, 0], [30.5, 8.5], [27.5, 12.2],
        [21.5, 12.0], [18.2, 8.5],
      ],
      irregular: 0.5,
    });

    // Fenda escura no topo do promontório
    k.apagar({ poligono: [[21.2, 0], [24.8, 0], [24.2, 5.8], [21.5, 4.5]], irregular: 0.3 });

    // Manchas de cascalho junto às paredes e ao fosso central
    k.pintar('cascalho', { disco: [6.8, 5.2], raio: 2.2, irregular: 0.4 });
    k.pintar('cascalho', { disco: [23.5, 14.0], raio: 2.4, irregular: 0.5 });
    k.pintar('cascalho', { disco: [35.5, 23.5], raio: 2.6, irregular: 0.5 });
    k.pintar('cascalho', { disco: [11.5, 21.0], raio: 2.0, irregular: 0.4 });

    // Escarpa interna separando o terraço de ossadas a sudoeste
    k.parede([[6.0, 20.5], [12.5, 20.2], [16.8, 22.8], [17.2, 28.5]], {
      kind: 'cliff',
      height: 2.4,
      thickness: 0.45,
      material: 'rocha.caverna',
      drop: 'a',
      blocks: { move: true, sight: false, light: false },
    });

    // Rastro de sangue seco vindo da entrada até a pilha de peles e as ossadas
    k.presenca('sangue-seco', {
      faixa: [[6.5, 2.0], [9.5, 8.5], [15.0, 15.0], [22.5, 18.0], [29.5, 19.5]],
      largura: 2.2,
      irregular: 0.5,
    });
    k.presenca('sangue-seco', { disco: [31.0, 20.5], raio: 3.2, irregular: 0.6 });
    k.presenca('sangue-seco', { disco: [10.5, 26.0], raio: 2.5, irregular: 0.5 });
    k.presenca('fuligem', { disco: [34.5, 12.5], raio: 2.8, irregular: 0.5 });

    // Árvore morta caída na entrada iluminada
    k.objeto('arvore-morta-caida', [11.2, 4.2], { rotation: 0.58, scale: 1.15 });

    // Dois buracos no chão da caverna
    k.objeto('buraco', [19.8, 13.6], { params: { largura: 2.4 }, rotation: 0.3 });
    k.objeto('buraco', [30.8, 27.2], { params: { largura: 1.6 }, rotation: -0.4 });

    // Ninho de peles no covil à direita
    k.objeto('pilha-de-peles', [30.2, 19.6], { rotation: 0.25, scale: 1.35 });
    k.objeto('pilha-de-peles', [32.0, 21.0], { rotation: 1.85, scale: 1.15 });

    // Ossadas e pilhas de ossos no terraço sudoeste e pelo chão
    k.objeto('pilha-de-ossos', [8.8, 26.2], { rotation: 0.4, scale: 1.25 });
    k.objeto('pilha-de-ossos', [11.2, 27.4], { rotation: 2.1, scale: 1.15 });
    k.objeto('ossada', [10.2, 24.6], { rotation: -0.35, scale: 1.1 });
    k.objeto('ossada', [13.0, 26.8], { rotation: 1.2, scale: 1.05 });
    k.objeto('ossada', [21.2, 25.4], { rotation: 2.65, scale: 1.1 });
    k.objeto('ossada', [27.0, 25.2], { rotation: -1.1, scale: 1.15 });
    k.objeto('ossada', [28.8, 12.2], { rotation: 0.95, scale: 1.0 });
    k.objeto('ossada', [34.2, 22.8], { rotation: -0.7, scale: 0.95 });

    // Crânios espalhados
    k.objeto('cranio-animal', [8.1, 16.8], { params: { chifres: 1 }, rotation: 0.7, scale: 1.2 });
    k.objeto('cranio-animal', [13.9, 7.8], { params: { chifres: 0 }, rotation: 2.1, scale: 1.1 });
    k.objeto('cranio-animal', [25.2, 23.0], { params: { chifres: 1 }, rotation: -0.8, scale: 1.15 });
    k.objeto('cranio-animal', [33.5, 17.5], { params: { chifres: 0 }, rotation: 1.4, scale: 1.1 });

    // Estalagmites, rochedos e seixos junto às paredes
    for (const [pos, tam] of [
      [[3.8, 4.2], 0.75], [[3.5, 6.2], 0.6], [[15.8, 7.8], 0.7],
      [[17.0, 24.5], 0.65], [[37.2, 9.8], 0.75], [[38.0, 17.2], 0.6],
    ] as const) {
      k.objeto('estalagmite', [pos[0], pos[1]], { params: { tamanho: tam } });
    }
    for (const [pos, esc] of [
      [[4.5, 2.2], 1.0], [[12.0, 19.2], 1.1], [[23.2, 13.8], 1.2],
      [[36.0, 8.8], 1.0], [[35.8, 27.2], 1.1], [[15.2, 24.2], 0.9],
    ] as const) {
      k.objeto('seixos', [pos[0], pos[1]], { scale: esc });
    }
    k.objeto('pedra.grande', [15.5, 5.2], { rotation: 0.4 });
    k.objeto('pedra.media', [14.2, 23.2], { rotation: 1.1 });
    k.objeto('pedra.media', [37.5, 13.5], { rotation: 2.3 });

    // Luz: feixe frio entrando pela boca da caverna a noroeste, o resto na penumbra
    k.luz('farol', [7.5, 2.5], {
      radius: 26,
      color: '#e8f2ff',
      intensity: 1.4,
      flicker: 0,
      power: 'magic',
      direcao: 0.85,
      cone: { angle: 0.95, direction: 0.85 },
      rays: true,
    });
    k.luz('luar', [11.5, 9.5], {
      radius: 16,
      color: '#dceaff',
      intensity: 0.85,
      flicker: 0,
    });
    k.luz('luar', [18.5, 16.5], {
      radius: 14,
      color: '#bcd2ec',
      intensity: 0.55,
      flicker: 0,
    });

    // Clima e acabamento: penumbra subterrânea azulada com bordas negras e halo no feixe
    k.clima('noite', {
      time: '00:00',
      ambient: { color: '#9ab0c7', intensity: 0.62 },
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

