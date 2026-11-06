import type { Exemplo } from './kit.ts';

/** 10.7f — Ravina noturna (50 × 33 m). */
export const ravinaNoturna: Exemplo = {
  id: 'ravina-noturna',
  nome: 'Ravina noturna',
  descricao: 'Platôs de lajes antigas entre escarpas em degraus, fenda cortada por rio com duas cachoeiras animadas, ponte de tábuas e tochas na noite azulada.',
  largura: 50,
  altura: 33,
  semente: 1076,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#141c2c' });
    k.base('rocha.rachada');

    // Manchas de grama e lajes antigas nos terraços
    k.pintar('lajes.gramadas', { disco: [20.5, 13.5], raio: 6.5, irregular: 0.8 });
    k.pintar('lajes.gramadas', { disco: [38.5, 17.5], raio: 5.5, irregular: 0.8 });
    k.pintar('grama', { disco: [4.5, 6.5], raio: 4.0, irregular: 0.7 });
    k.pintar('grama', { disco: [16.5, 16.5], raio: 4.8, irregular: 0.8 });
    k.pintar('grama', { disco: [39.5, 22.5], raio: 4.2, irregular: 0.7 });

    // Paredões de rocha ao norte e ao sul formando os patamares da ravina
    k.pintar('rocha.caverna', {
      poligono: [
        [16.0, -3], [53, -3], [53, 14.5], [44.5, 11.5],
        [41.0, 9.5], [34.5, 8.5], [30.0, 4.5], [20.0, 3.5],
      ],
      irregular: 0.55,
    });
    k.pintar('rocha.caverna', {
      poligono: [
        [-3, 24.5], [10.5, 25.0], [18.5, 28.0], [53, 28.5],
        [53, 36], [-3, 36],
      ],
      irregular: 0.55,
    });

    // Rio cortando a ravina de nordeste para o sul-centro
    k.pintar('agua.rio', {
      poligono: [
        [36.5, -3], [41.5, -3], [39.8, 9.5], [40.8, 12.2],
        [34.5, 14.2], [31.2, 16.8], [30.5, 23.5], [29.2, 36.0],
        [25.2, 36.0], [26.8, 22.5], [28.0, 15.0], [32.0, 10.2], [35.0, 6.5],
      ],
      irregular: 0.35,
    });
    k.correnteza('agua.rio', 1.85, 1.45);

    // Escarpas em degraus acompanhando os terraços e a fenda do rio
    k.parede([[8.5, 13.5], [13.5, 7.2], [20.5, 3.8], [31.5, 4.8]], {
      kind: 'cliff',
      height: 3.8,
      thickness: 0.45,
      material: 'rocha.caverna',
      drop: 'a',
      blocks: { move: true, sight: false, light: false },
    });
    k.parede([[1.0, 24.2], [11.0, 24.8], [19.0, 27.8], [25.5, 28.2]], {
      kind: 'cliff',
      height: 4.0,
      thickness: 0.45,
      material: 'rocha.caverna',
      drop: 'a',
      blocks: { move: true, sight: false, light: false },
    });
    k.parede([[30.5, 28.2], [41.0, 28.0], [49.0, 28.5]], {
      kind: 'cliff',
      height: 4.0,
      thickness: 0.45,
      material: 'rocha.caverna',
      drop: 'a',
      blocks: { move: true, sight: false, light: false },
    });
    k.parede([[31.8, 9.8], [28.2, 14.2], [26.8, 22.5], [25.8, 28.0]], {
      kind: 'cliff',
      height: 2.8,
      thickness: 0.38,
      material: 'rocha.caverna',
      drop: 'a',
      blocks: { move: true, sight: false, light: false },
    });
    k.parede([[40.5, 12.2], [34.2, 14.5], [31.2, 17.5], [30.2, 26.5]], {
      kind: 'cliff',
      height: 2.8,
      thickness: 0.38,
      material: 'rocha.caverna',
      drop: 'b',
      blocks: { move: true, sight: false, light: false },
    });

    // Duas cachoeiras animadas: a grande no alto à direita e a segunda caindo no abismo ao sul
    k.objeto('cachoeira', [37.4, 5.2], {
      params: { largura: 4.5, queda: 8.5 },
      rotation: 0.22,
      blocks: { move: true, sight: false },
    });
    k.objeto('cachoeira', [27.6, 28.0], {
      params: { largura: 3.8, queda: 8.0 },
      rotation: 0.16,
      blocks: { move: true, sight: false },
    });

    // Ponte de tábuas sobre a garganta do rio, tábua solta e passarela menor a sudeste
    k.objeto('cais-segmento', [29.2, 15.6], {
      params: { comprimento: 5.4, largura: 2.4 },
      rotation: 0.44,
      layer: 4,
      blocks: { move: false, sight: false },
    });
    k.objeto('tabua-solta', [27.8, 17.4], { rotation: 0.52 });
    k.objeto('cais-segmento', [38.6, 24.6], {
      params: { comprimento: 3.6, largura: 1.2 },
      rotation: 0.78,
      blocks: { move: false, sight: false },
    });
    k.objeto('tabua-solta', [37.2, 25.4], { rotation: 0.85 });

    // Rochedos e pedras ao longo das escarpas e junto às tochas
    for (const [pos, tam, cob, rot] of [
      [[9.8, 11.8], 3.0, 1, 0.4],
      [[17.2, 21.5], 2.8, 1, -0.5],
      [[35.8, 15.2], 2.4, 1, 0.2],
      [[43.5, 14.2], 2.6, 1, 1.1],
      [[26.0, 8.8], 2.2, 1, -0.3],
      [[32.8, 23.8], 2.2, 1, 0.7],
    ] as const) {
      k.objeto('rochedo', [pos[0], pos[1]], { params: { tamanho: tam, cobertura: cob }, rotation: rot });
    }
    for (const pos of [
      [23.6, 16.8], [28.4, 11.2], [43.8, 20.5], [14.2, 22.8], [29.2, 9.8],
    ] as const) {
      k.objeto('seixos', [pos[0], pos[1]]);
    }

    // Mata densa e escura: carvalhos grandes, folhagem tropical e arbustos
    for (const [item, pos, esc] of [
      ['casa:carvalho-grande-7m', [21.0, 5.8], 1.0],
      ['casa:carvalho-grande-8m', [5.2, 18.8], 1.0],
      ['casa:carvalho-grande-7m', [47.2, 21.5], 1.0],
      ['casa:carvalho-grande-6m', [46.5, 4.2], 0.95],
      ['casa:arvore-5m', [18.5, 29.8], 0.95],
      ['casa:arvore-5m', [2.2, 2.5], 0.9],
      ['casa:folhagem-tropical-2m', [16.0, 2.2], 1.0],
      ['casa:folhagem-tropical-2m', [10.8, 1.8], 0.95],
      ['casa:folhagem-tropical-2m', [23.8, 22.2], 1.1],
      ['casa:folhagem-tropical-2m', [12.5, 21.5], 0.95],
      ['casa:folhagem-tropical-2m', [1.8, 9.2], 1.0],
      ['casa:folhagem-tropical-2m', [40.2, 26.8], 1.0],
      ['casa:folhagem-tropical-1m', [32.8, 24.5], 1.0],
      ['casa:folhagem-tropical-1m', [30.2, 8.2], 0.95],
      ['casa:folhagem-tropical-1m', [25.2, 9.5], 0.95],
      ['casa:arbusto-grande', [14.2, 16.5], 1.0],
      ['casa:arbusto-grande', [17.2, 17.5], 1.0],
      ['casa:arbusto-verde', [39.2, 21.8], 1.0],
      ['casa:arbusto-verde', [34.2, 21.5], 0.95],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { scale: esc });
    }

    // Sete tochas em estaca criando poças de luz quente sobre as lajes na noite azulada
    for (const pos of [
      [14.8, 12.8],
      [23.6, 16.2],
      [28.2, 10.6],
      [36.6, 14.8],
      [32.0, 20.8],
      [43.2, 12.8],
      [43.8, 19.2],
    ] as const) {
      k.objeto('poste.luz', [pos[0], pos[1]]);
      k.luz('tocha', [pos[0], pos[1]], {
        radius: 7.5,
        color: '#ffa842',
        intensity: 1.3,
        flicker: 0.28,
      });
    }

    // Clima e acabamento: noite azulada límpida com halo quente nas tochas
    k.clima('noite', {
      time: '22:30',
      ambient: { color: '#9ab4dc', intensity: 0.72 },
      sun: { angle: 0.75, color: '#b4ccfc', intensity: 0.55 },
      tempo: { fog: 0, wind: 0.15 },
    });
    k.acabamento('frio', {
      tint: '#e4eeff',
      saturation: 0.98,
      vignette: 0.2,
      edges: { kind: 'dark', amount: 0.2 },
      glow: 0.88,
    });

    // Climas salvos do mapa
    k.guardarClima('noite-azulada', 'Noite azulada na ravina');
    k.guardarClima('alvorada-umida', 'Alvorada de neblina', 'neblina', {
      time: '06:30',
      ambient: { color: '#7a8ea0', intensity: 0.62 },
      sun: { angle: 0.4, color: '#ffe4b8', intensity: 0.55 },
      tempo: { fog: 0.65, wind: 0.15 },
      finish: { tint: '#e4eef5', saturation: 0.85, vignette: 0.35, edges: { kind: 'fog', amount: 0.55 }, glow: 0.6 },
    });
    k.guardarClima('temporal-na-fenda', 'Temporal na ravina', 'tempestade', {
      tempo: { rain: 1, wind: 0.6, lightning: 0.75, fog: 0.3 },
      finish: { tint: '#c8daf2', saturation: 0.7, vignette: 0.55, edges: { kind: 'dark', amount: 0.5 }, glow: 0.9 },
    });

    // Regiões de revelação, gatilho e áudio
    k.regiao([[31, 11], [49, 11], [49, 28], [31, 28]], 'reveal', {
      nome: 'Margem leste da ravina',
    });
    k.regiao([[26, 13], [33, 13], [33, 19], [26, 19]], 'trigger', {
      nome: 'Ponte sobre a fenda',
      texto: 'As tábuas molhadas pela névoa da cachoeira rangem sobre a correnteza; uma delas está solta na beirada sul.',
    });
    k.regiao([[24, 0], [44, 0], [44, 33], [24, 33]], 'audio', {
      nome: 'Estrondo das cachoeiras',
      cenaJukebox: 'cachoeira-noturna',
    });

    k.notas(
      'Ravina noturna — A ponte estreita é a única travessia seca entre as duas escarpas; o barulho das duas cachoeiras abafa qualquer passo ou grito.',
    );
  },
};

