import type { Exemplo } from './kit.ts';

/** 10.7c — Ruína à beira-mar (50 × 37 m). */
export const ruinaCosteira: Exemplo = {
  id: 'ruina-costeira',
  nome: 'Ruína à beira-mar',
  descricao: 'Plataforma octogonal com círculo rúnico sobre falésia de arenito, passarela destroçada por fuligem e escombros, carvalhos antigos e mar batendo nas rochas.',
  largura: 50,
  altura: 37,
  semente: 1073,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#0c2436' });
    k.base('areia.molhada');

    // Calçamento antigo de lajes com grama na parte oeste e central
    k.pintar('lajes.gramadas', { retangulo: [-3, -3, 39.5, 40], irregular: 0.25 });

    // Clareiras de terra junto aos tocos de árvore cortados
    k.pintar('terra', { disco: [15.5, 5.5], raio: 4.5, irregular: 0.8 });
    k.pintar('terra', { disco: [3.5, 28.5], raio: 3.2, irregular: 0.6 });

    // Mar agitado na costa leste (estendendo além da borda direita para não criar espuma de margem ali)
    k.pintar('agua.mar', {
      poligono: [
        [37.5, -3], [53, -3], [53, 40], [37.0, 40],
        [38.5, 30.0], [41.5, 23.0], [42.0, 15.0], [39.0, 7.0],
      ],
      irregular: 0.65,
    });
    k.correnteza('agua.mar', Math.PI, 0.95);

    // Falésia costeira de arenito sustentando a plataforma e duas ilhotas no mar
    k.pintar('rocha.arenito', {
      poligono: [
        [27.0, -3], [38.5, -3], [40.5, 8.5], [43.0, 16.5],
        [42.2, 23.5], [39.5, 31.0], [38.0, 40.0], [26.5, 40.0],
        [22.0, 30.0], [16.5, 24.0], [16.5, 13.5], [23.0, 7.5],
      ],
      irregular: 0.6,
    });
    // Ilhota norte e ilhota sul no mar
    k.pintar('rocha.arenito', { disco: [44.2, 5.5], raio: 4.2, irregular: 0.55 });
    k.pintar('rocha.arenito', { disco: [43.2, 32.2], raio: 3.2, irregular: 0.45 });

    // Plataforma octogonal de lajes claras e passarela oeste
    k.pintar('calcada', {
      poligono: [
        [20.5, 15.2], [25.2, 11.2], [31.8, 11.2], [36.2, 15.2],
        [36.2, 22.8], [31.8, 26.8], [25.2, 26.8], [20.5, 22.8],
      ],
      irregular: 0.08,
    });
    k.pintar('calcada', { retangulo: [-2, 16.0, 21.0, 22.0], irregular: 0.1 });
    // Terraços norte e sul da ruína
    k.pintar('calcada', { retangulo: [22.0, 8.2, 31.5, 12.0], irregular: 0.12 });
    k.pintar('calcada', { retangulo: [21.5, 26.0, 31.5, 31.2], irregular: 0.12 });

    // Fuligem leve onde a passarela oeste foi destruída
    k.presenca('fuligem', { disco: [8.8, 19.0], raio: 2.2, irregular: 0.65 });

    // Círculo rúnico entalhado no centro da plataforma octogonal
    k.objeto('circulo-runico', [28.5, 19.0], {
      params: { raio: 4.4, raios: 8 },
      rotation: 0.25,
      blocks: { move: false, sight: false },
      castsShadow: false,
    });

    // Escada externa na entrada oeste da plataforma
    k.objeto('escada.externa', [18.2, 19.0], {
      params: { largura: 4.2 },
      rotation: Math.PI / 2,
      blocks: { move: false, sight: false },
    });

    // Muretas de pedra cercando a passarela e as faces do octógono
    for (const [pos, larg, rot, falha] of [
      [[2.2, 16.0], 4.2, 0, 0],
      [[2.2, 22.0], 4.2, 0, 0],
      [[15.8, 16.0], 5.0, 0, 1],
      [[15.8, 22.0], 5.0, 0, 1],
      [[28.5, 11.2], 5.4, 0, 0],
      [[28.5, 26.8], 5.4, 0, 1],
      [[23.0, 13.3], 4.6, -0.72, 0],
      [[23.0, 24.7], 4.6, 0.72, 1],
      [[34.0, 13.3], 4.6, 0.72, 1],
    ] as const) {
      k.objeto('mureta-de-pedra', [pos[0], pos[1]], { params: { largura: larg, falha }, rotation: rot });
    }

    // Colunas arruinadas com esfera nos vértices do octógono
    for (const pos of [
      [21.0, 15.4], [21.0, 22.6],
      [25.4, 11.4], [31.6, 11.4],
      [33.8, 19.8], [36.0, 22.4],
      [31.6, 26.6], [25.4, 26.6],
      [21.6, 9.8],
    ] as const) {
      k.objeto('coluna-arruinada', [pos[0], pos[1]]);
    }

    // Coluna caída sobre o círculo rúnico e vigas partidas (com camada alta para ficarem sobre os escombros)
    k.objeto('coluna-caida', [26.8, 23.6], { rotation: -1.18, scale: 1.2, layer: 4 });
    k.objeto('viga-partida', [10.6, 19.0], { rotation: 0.24, scale: 1.45, layer: 4 });
    k.objeto('viga-partida', [34.4, 18.4], { rotation: 0.02, scale: 1.4, layer: 4 });

    // Trilha de escombros na passarela quebrada
    for (const [pos, rot, esc] of [
      [[5.8, 18.2], 0.3, 1.35],
      [[7.5, 19.8], 1.4, 1.45],
      [[9.2, 18.5], 2.2, 1.4],
      [[10.8, 20.2], 0.8, 1.3],
      [[12.6, 17.8], 1.9, 1.25],
      [[8.2, 16.5], 0.5, 1.15],
      [[8.5, 21.6], 2.6, 1.15],
    ] as const) {
      k.objeto('escombros', [pos[0], pos[1]], { rotation: rot, scale: esc });
    }

    // Rochedos com musgo nas falésias e nas ilhotas
    for (const [pos, tam, cob, rot] of [
      [[31.5, 7.2], 3.8, 1, 0.3],
      [[35.5, 15.5], 3.2, 1, 1.1],
      [[34.2, 24.5], 3.6, 1, -0.6],
      [[26.8, 31.8], 3.4, 1, 0.8],
      [[18.2, 11.2], 2.8, 1, -0.4],
      [[44.2, 5.5], 4.2, 1, 0.5],
      [[43.2, 32.2], 3.0, 1, 1.4],
    ] as const) {
      k.objeto('rochedo', [pos[0], pos[1]], { params: { tamanho: tam, cobertura: cob }, rotation: rot });
    }

    // Copas densas de carvalho grande, raízes expostas, tocos e tufos de grama
    for (const [item, pos, esc] of [
      ['casa:carvalho-grande-8m', [25.0, 3.8], 1.05],
      ['casa:carvalho-grande-7m', [15.2, 28.2], 1.0],
      ['casa:carvalho-grande-8m', [20.5, 33.2], 1.05],
      ['casa:carvalho-grande-6m', [1.8, 7.2], 1.0],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { scale: esc });
    }
    k.objeto('raiz-exposta', [12.2, 27.5], { rotation: 2.8, scale: 1.1 });
    k.objeto('raiz-exposta', [15.5, 34.8], { rotation: 2.4, scale: 1.1 });

    for (const pos of [
      [11.8, 6.8], [14.0, 6.2], [14.2, 1.2], [17.8, 1.8],
      [0.8, 27.8], [1.8, 30.2], [16.2, 33.8],
    ] as const) {
      k.objeto('toco', [pos[0], pos[1]]);
    }
    for (const pos of [
      [6.2, 5.2], [8.5, 3.2], [16.5, 8.2], [18.2, 6.5],
      [5.5, 26.5], [8.2, 31.5], [11.5, 13.5], [14.5, 12.2],
    ] as const) {
      k.objeto('tufo-de-grama', [pos[0], pos[1]]);
    }
    for (const pos of [[16.2, 5.0], [26.5, 9.5], [38.2, 11.5], [38.5, 27.5]] as const) {
      k.objeto('seixos', [pos[0], pos[1]]);
    }

    // Clima: tarde costeira dourada com vento do mar e sombra longa
    k.clima('tarde', {
      time: '15:30',
      ambient: { color: '#fffdf8', intensity: 1.0 },
      sun: { angle: 0.65, color: '#fff4d8', intensity: 1.1 },
      tempo: { wind: -0.35, leaves: 0.2, fog: 0 },
    });
    k.acabamento('quente', {
      tint: '#fffaf0',
      saturation: 1.06,
      vignette: 0.14,
      glow: 0.4,
    });

    // Climas salvos do mapa
    k.guardarClima('sol-da-costa', 'Tarde de vento na costa');
    k.guardarClima('ritual-noturno', 'Noite de ritual', 'noite', {
      time: '23:30',
      ambient: { color: '#2b3e58', intensity: 0.36 },
      sun: { angle: 0.7, color: '#9ec0f0', intensity: 0.5 },
      tempo: { wind: -0.45, fog: 0.25 },
      finish: { tint: '#cde0ff', saturation: 0.9, vignette: 0.5, edges: { kind: 'fog', amount: 0.4 }, glow: 0.8 },
    });
    k.guardarClima('borrasca', 'Tempestade no penhasco', 'tempestade', {
      tempo: { rain: 1, wind: -0.8, lightning: 0.8, fog: 0.25 },
      finish: { tint: '#dbe6f5', saturation: 0.65, vignette: 0.55, edges: { kind: 'clouds', amount: 0.5 }, glow: 0.5 },
    });

    // Regiões de revelação, gatilho e áudio
    k.regiao([[20, 11], [37, 11], [37, 27], [20, 27]], 'reveal', {
      nome: 'Altar octogonal',
    });
    k.regiao([[4, 16], [15, 16], [15, 22], [4, 22]], 'trigger', {
      nome: 'Passarela estilhaçada',
      texto: 'As pedras enegrecidas de fuligem mostram que a ponte de acesso ruiu de dentro para fora.',
    });
    k.regiao([[34, 0], [50, 0], [50, 37], [34, 37]], 'audio', {
      nome: 'Ressaca nas falésias',
      cenaJukebox: 'mar-nas-rochas',
    });

    k.notas(
      'Ruína à beira-mar — O círculo rúnico no alto do penhasco desperta quando a maré bate nas ilhotas; a passarela oeste foi rompida por uma explosão antiga, restando saltar pelos escombros ou escalar pelas raízes.',
    );
  },
};

