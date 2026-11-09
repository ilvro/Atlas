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

    // Calçamento antigo de lajes grandes com grama, gasto: manchas de terra e grama seca entre as lajes.
    k.pintar('lajes.gramadas', { retangulo: [-3, -3, 40, 40], irregular: 0.25 });
    for (const [c, r] of [[[17, 3.5], 2.6], [[3.5, 29.5], 1.8], [[10.5, 9], 1.4]] as const) k.pintar('terra', { disco: [c[0], c[1]], raio: r, irregular: 1.4 });
    // O planalto de pedra clara em volta da ruína (a falésia o sustenta) e a passarela oeste.
    k.pintar('lajes.antigas', { poligono: [[17, 9.5], [21.5, 6.5], [31, 6], [35, 9.5], [36.5, 15], [37, 23], [35, 29.5], [30, 31.5], [22.5, 31], [18.5, 27.5], [17, 22.6], [17, 15.4]], irregular: 0.5 });
    k.pintar('calcada', { retangulo: [-2, 16.0, 17.2, 22.0], irregular: 0.08 });

    // A falésia: rocha de arenito do planalto até o mar, coberta de rochedos (abaixo).
    k.pintar('rocha.arenito', { poligono: [[32.5, -3], [39.5, -3], [41, 6], [40.2, 14], [41.2, 22], [40, 30], [41, 40], [30, 40], [33.5, 31], [36.6, 25.5], [37.6, 18], [36.2, 11], [33, 6]], irregular: 0.7 });

    // Mar largo e agitado a leste, com duas ilhotas de rocha.
    k.pintar('agua.mar', { poligono: [[40.2, -3], [53, -3], [53, 40], [40.4, 40], [39.6, 31], [40.8, 22], [39.6, 14], [40.4, 6]], irregular: 0.8 });
    k.correnteza('agua.mar', Math.PI, 0.95);
    k.pintar('rocha.arenito', { disco: [44.4, 4.4], raio: 4.4, irregular: 0.7 });
    k.pintar('rocha.arenito', { disco: [43.4, 33.4], raio: 3, irregular: 0.6 });

    // Escombros queimados na passarela destruída.
    k.presenca('fuligem', { faixa: [[3.5, 19], [8, 18.8], [13.5, 19.4]], largura: 3.4, irregular: 0.9 }, 0.35);

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

    // Trilha de escombros na passarela quebrada.
    for (let n = 0; n < 22; n++) {
      const x = 3 + (n / 21) * 11.5 + Math.sin(n * 2.3) * 0.8, y = 16.8 + ((n * 0.618) % 1) * 4.6;
      k.objeto('escombros', [x, y], { params: { queimado: 1 }, rotation: n * 1.7, scale: 1.3 + ((n * 0.37) % 0.6), layer: 3 });
    }

    // Rochedos de arenito com musgo empilhados ao longo da falésia, em volta do planalto e nas ilhotas.
    for (const [pos, tam, rot] of [
      [[33.8, 3.2], 4.2, 0.3], [[37.4, 8.4], 4.6, 1.1], [[34.2, 9.8], 3.4, 2.2], [[38.6, 14.6], 4.4, 0.6], [[37.2, 20.8], 4.2, 1.6], [[38.8, 26.2], 4.8, 0.2],
      [[35.2, 25.6], 3.6, 2.6], [[36.2, 31.6], 4.4, 1.2], [[32.4, 34.4], 4.2, 0.4], [[27.2, 33.2], 3.8, 2], [[38.8, 35.8], 3.6, 0.9], [[39.6, 2.6], 4, 2.4], [[40, 19.4], 3.6, 0.3], [[36.4, 14.2], 3, 1.8], [[33.6, 29.4], 3.2, 2.9],
      [[20.4, 10.6], 2.8, -0.4], [[24.2, 7.4], 2.4, 0.8], [[30.6, 4.6], 3.2, 1.9], [[21.2, 27.4], 2.6, 0.5],
      [[44.4, 4.4], 4.4, 0.5], [[46.4, 7.2], 3, 2.1], [[43.4, 33.4], 3.4, 1.4],
    ] as const) k.objeto('rochedo', [pos[0], pos[1]], { params: { tamanho: Math.min(5, tam * 1.15), cobertura: 1, tom: 1 }, rotation: rot, scale: 1.35 });
    for (const [pos, esc] of [[[17.5, 7.6], 1.2], [[22.6, 12.4], 1], [[19, 25.5], 1.1], [[12.8, 2.6], 1]] as const) k.objeto('seixos', [pos[0], pos[1]], { scale: esc });

    // Copas densas de carvalho grande, raízes expostas, tocos e tufos de grama
    for (const [item, pos, esc] of [
      ['casa:carvalho-grande-8m', [25.0, 3.8], 1.05],
      ['casa:carvalho-grande-7m', [15.2, 28.2], 1.0],
      ['casa:carvalho-grande-8m', [20.5, 33.2], 1.05],
      ['casa:carvalho-grande-6m', [0.6, 7.6], 1.1],
      ['casa:carvalho-grande-6m', [11.4, 31.2], 1.0],
      ['casa:carvalho-grande-7m', [24.6, 35.8], 0.95],
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

