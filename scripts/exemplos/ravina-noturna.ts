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

    // Manchas de grama escura sobre as lajes rachadas do patamar.
    for (const [c, r] of [[[16.5, 15.5], 4.2], [[22, 17], 2.4], [[38, 22.5], 3.6], [[44, 16.8], 2], [[3.5, 12], 2.6]] as const) k.pintar('grama.escura', { disco: [c[0], c[1]], raio: r, irregular: 1.1 });

    // Paredões de rocha cobertos de mata: ao norte (descendo em patamar no canto oeste) e ao sul; o rio passa por uma fenda nos dois.
    k.pintar('rocha.caverna', { poligono: [[-3, -3], [53, -3], [53, 14], [47.6, 12.6], [46, 9], [41, 8.6], [39.6, 6.4], [36, 6.6], [33.4, 9], [27, 8.4], [21, 9.4], [15, 9.8], [10, 9], [6, 7.6], [0, 8.4], [-3, 8.6]], irregular: 0.7 });
    k.pintar('rocha.caverna', { poligono: [[-3, 16.4], [3, 15.6], [6.4, 18.4], [9, 21], [16, 21.6], [22, 23], [26, 23.6], [27.4, 26], [26, 36], [-3, 36]], irregular: 0.7 });
    k.pintar('rocha.caverna', { poligono: [[31.2, 25.4], [33.4, 23.6], [38, 25.8], [44, 27.2], [47.6, 24.6], [53, 22], [53, 36], [29.6, 36]], irregular: 0.7 });
    k.apagar({ poligono: [[34.6, -3], [39.2, -3], [38.6, 7.4], [35.4, 7.6]], irregular: 0.4 });

    // O rio: cai da fenda norte num poço, desce em diagonal sob a ponte e cai de novo pela fenda sul.
    k.pintar('agua.rio', { poligono: [[34.8, -3], [39, -3], [39.6, 6.6], [40.8, 9.6], [39.4, 12.4], [34, 13.4], [31.2, 15.4], [30, 20.4], [29.6, 25], [28.8, 36], [25.8, 36], [26.6, 25], [27.4, 19.4], [28.6, 14.4], [30.4, 11], [33.6, 8.4]], irregular: 0.35 });
    k.correnteza('agua.rio', 1.95, 1.2);

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

    // Mata densa e escura sobre os paredões: muita folhagem tropical, poucas copas grandes.
    const MATA: [number, number, number][] = [
      [2, 2, 1], [5.6, 4.6, 0.9], [9.4, 2.4, 1], [12.4, 5.6, 0.8], [16, 2, 1], [19.4, 5.8, 0.9], [23, 2.6, 1], [26.6, 6, 0.85], [29.4, 3, 1], [32.4, 6.4, 0.8],
      [42, 2.4, 1], [45.4, 5.6, 0.9], [48.6, 2.6, 1], [44, 9.6, 0.7], [48.8, 9.4, 0.85],
      [1.6, 19.6, 1], [4.4, 23.8, 1], [8.6, 26, 0.9], [12.6, 24, 1], [16.4, 27.4, 1], [20.6, 24.8, 0.9], [23.2, 29.6, 0.9], [2.6, 29.4, 1], [10.4, 30.6, 0.9],
      [34.6, 27.6, 0.9], [38.2, 30.2, 1], [42.4, 28.6, 0.9], [46.2, 26.6, 1], [49, 30.4, 0.9], [33.6, 31.6, 0.8], [47.4, 21.4, 0.9],
      [14.6, 18.2, 0.7], [18.6, 19.4, 0.8], [21.4, 20.6, 0.75], [36.4, 21.6, 0.7], [40.6, 22.6, 0.75],
    ];
    MATA.forEach(([x, y, e], i) => {
      if (i % 2 === 0) k.objeto('casa:carvalho-grande-6m', [x, y], { scale: e * 0.62, rotation: i * 1.7 });
      else k.objeto('casa:folhagem-tropical-2m', [x, y], { scale: e * 1.9, rotation: i * 1.7 });
      // Uma folhagem menor ao lado de cada touceira, para a mata não ter vãos.
      k.objeto('casa:folhagem-tropical-1m', [x + ((i * 1.37) % 2.4) - 1.2, y + ((i * 2.11) % 2.4) - 1.2], { scale: 1.5, rotation: i * 2.3 });
    });
    for (const [item, pos, esc] of [['casa:carvalho-grande-6m', [5, 3.4], 0.8], ['casa:carvalho-grande-6m', [46.6, 3.4], 0.85], ['casa:carvalho-grande-7m', [6, 27.6], 0.8], ['casa:carvalho-grande-6m', [44.6, 30.4], 0.8]] as const) k.objeto(item, [pos[0], pos[1]], { scale: esc });

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
        radius: 5.5,
        color: '#ffa842',
        intensity: 1.05,
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

