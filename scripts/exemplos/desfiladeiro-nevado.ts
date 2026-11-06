import type { Exemplo } from './kit.ts';

/** 10.7b — Desfiladeiro nevado (48 × 27 m). */
export const desfiladeiroNevado: Exemplo = {
  id: 'desfiladeiro-nevado',
  nome: 'Desfiladeiro nevado',
  descricao: 'Crista de rocha em arco sobre neve funda com dunas de vento, árvores cobertas de neve, lago congelado à direita e nuvens nas bordas.',
  largura: 48,
  altura: 27,
  semente: 1072,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#cfe0f0' });
    k.base('neve.funda');

    // Faixas suaves de neve batida pelo vento ao longo do vale central
    k.pintar('neve', {
      faixa: [[20, -2], [26, 7], [29, 14], [27, 21], [23, 29]],
      largura: 6.5,
      irregular: 0.7,
    });
    k.pintar('neve', {
      faixa: [[16.5, 16.8], [22.0, 18.2], [29.0, 16.5], [33.5, 10.5], [38.0, 6.0]],
      largura: 2.2,
      irregular: 0.35,
    });

    // Lago congelado à direita com rachaduras no gelo
    k.pintar('gelo', {
      poligono: [
        [34.5, -2.0], [45.5, -2.0], [46.0, 9.0], [46.5, 19.5],
        [43.5, 25.5], [38.0, 23.5], [35.5, 16.5], [34.0, 7.5],
      ],
      irregular: 0.55,
    });

    // Crista de rocha nevada em "C" à esquerda
    k.pintar('rocha.nevada', {
      poligono: [
        [2.5, 1.5], [11.5, 1.8], [16.8, 5.5], [19.8, 10.8],
        [18.8, 16.0], [16.2, 15.5], [15.5, 10.5], [11.2, 7.2],
        [9.8, 11.5], [12.0, 17.2], [14.5, 20.5], [13.5, 29.0],
        [6.8, 29.0], [7.8, 18.5], [7.2, 10.5], [2.8, 5.0],
      ],
      irregular: 0.45,
    });

    // Paredão rochoso nevado fechando a margem leste do lago congelado
    k.pintar('rocha.nevada', {
      poligono: [
        [36.5, -3.0], [51.0, -3.0], [51.0, 30.0], [38.0, 30.0],
        [42.5, 23.0], [45.2, 18.0], [44.8, 10.0], [41.5, 5.5], [39.5, 2.0],
      ],
      irregular: 0.45,
    });

    // Escarpa suplementar na encosta do arco rochoso para reforçar a sombra longa do sol
    k.parede([[10.5, 2.5], [16.5, 6.2], [19.0, 11.2], [17.8, 15.8]], {
      kind: 'cliff',
      height: 4.5,
      thickness: 0.4,
      material: 'rocha.nevada',
      drop: 'a',
      blocks: { move: true, sight: false, light: false },
    });

    // Trenó deixado na borda do lago congelado
    k.objeto('treno', [39.4, 5.6], { rotation: 1.32, scale: 1.1 });

    // Rochedos com neve (cobertura 2) e rocha limpa (cobertura 0) nas encostas e na margem do gelo
    for (const [pos, tam, cob, rot] of [
      [[15.8, 4.2], 2.4, 0, 0.4],
      [[9.2, 12.2], 2.2, 2, 1.1],
      [[11.2, 19.2], 2.8, 2, -0.5],
      [[17.8, 25.2], 3.2, 2, 0.2],
      [[41.0, 3.8], 2.0, 0, 0.8],
      [[42.5, 8.8], 2.6, 2, -0.4],
      [[40.2, 22.2], 2.8, 2, 1.5],
      [[37.2, 25.0], 2.2, 0, 0.3],
    ] as const) {
      k.objeto('rochedo', [pos[0], pos[1]], { params: { tamanho: tam, cobertura: cob }, rotation: rot });
    }

    // Árvores nevadas (pompons brancos em vários tamanhos) com sombra longa
    for (const [item, pos, esc] of [
      ['casa:arvore-nevada-5m', [18.0, 1.8], 0.95],
      ['casa:arvore-nevada-5m', [21.8, 4.2], 1.0],
      ['casa:arvore-nevada-5m', [20.5, 6.2], 1.05],
      ['casa:arvore-nevada-3m', [25.5, 2.2], 1.0],
      ['casa:arvore-nevada-5m', [27.2, 8.8], 0.95],
      ['casa:arvore-nevada-3m', [28.8, 9.8], 0.65],
      ['casa:arvore-nevada-3m', [26.8, 6.8], 0.85],
      ['casa:arvore-nevada-3m', [22.8, 14.2], 0.95],
      ['casa:arvore-nevada-5m', [21.5, 16.0], 0.9],
      ['casa:arvore-nevada-3m', [24.0, 16.2], 0.9],
      ['casa:arvore-nevada-3m', [26.8, 14.2], 0.95],
      ['casa:arvore-nevada-3m', [28.8, 19.5], 0.65],
      ['casa:arvore-nevada-3m', [29.8, 21.2], 0.55],
      ['casa:arvore-nevada-3m', [25.5, 23.8], 0.9],
      ['casa:arvore-nevada-3m', [22.5, 25.2], 0.95],
      ['casa:arvore-nevada-3m', [15.0, 24.5], 0.9],
      ['casa:arvore-nevada-3m', [6.5, 17.8], 0.95],
      ['casa:arvore-nevada-3m', [6.2, 20.8], 0.9],
      ['casa:arvore-nevada-3m', [2.2, 21.8], 0.85],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { scale: esc });
    }

    // Arbustos secos, galhos caídos e seixos na neve
    for (const [item, pos, rot] of [
      ['casa:arbusto-seco-2m-neve', [12.8, 1.5], 0.3],
      ['casa:arbusto-seco-2m', [8.5, 22.8], 1.2],
      ['casa:arbusto-seco-1m', [9.0, 20.5], 2.1],
      ['casa:arbusto-seco-2m-neve', [21.5, 25.8], 0.8],
      ['casa:arbusto-seco-1m', [37.8, 23.5], 1.7],
      ['galho-seco', [24.8, 1.5], 1.8],
      ['galho-seco', [14.2, 25.8], 0.6],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { rotation: rot });
    }
    for (const pos of [
      [13.2, 15.2], [15.5, 20.8], [20.2, 25.5], [32.0, 25.8],
      [40.8, 6.8], [43.2, 11.2], [35.5, 24.8],
    ] as const) {
      k.objeto('seixos', [pos[0], pos[1]]);
    }

    // Clima: manhã fria e ensolarada de inverno (sol a noroeste projetando sombras longas azuladas para sudeste)
    k.clima('neve', {
      time: '09:30',
      ambient: { color: '#ffffff', intensity: 1.0 },
      sun: { angle: 0.72, color: '#f5f9ff', intensity: 1.15 },
      tempo: { snow: 0.45, wind: 0.25, fog: 0 },
    });
    k.acabamento('frio', {
      tint: '#ffffff',
      saturation: 0.96,
      vignette: 0.1,
      edges: { kind: 'clouds', amount: 0.36 },
      glow: 0.35,
    });

    // Climas salvos do mapa
    k.guardarClima('manha-gelada', 'Manhã fria de sol');
    k.guardarClima('nevasca', 'Nevasca fechada', 'neve', {
      time: '15:30',
      ambient: { color: '#9ab0c8', intensity: 0.58 },
      sun: { angle: 2.3, color: '#cad8ea', intensity: 0.35 },
      tempo: { snow: 1, wind: 0.85, fog: 0.65 },
      finish: { tint: '#dbe8f8', saturation: 0.65, vignette: 0.45, edges: { kind: 'clouds', amount: 0.88 }, glow: 0.3 },
    });
    k.guardarClima('noite-polar', 'Noite polar', 'noite', {
      time: '23:00',
      ambient: { color: '#486288', intensity: 0.38 },
      sun: { angle: 0.8, color: '#9ec0f0', intensity: 0.55 },
      tempo: { snow: 0.3, wind: 0.2 },
      finish: { tint: '#c4dcff', saturation: 0.75, vignette: 0.45, edges: { kind: 'clouds', amount: 0.65 }, glow: 0.6 },
    });

    // Regiões de revelação, gatilho e áudio
    k.regiao([[3, 2], [19, 2], [19, 17], [3, 17]], 'reveal', {
      nome: 'Crista da emboscada',
    });
    k.regiao([[34, 2], [45, 2], [45, 24], [34, 24]], 'trigger', {
      nome: 'Gelo fino do lago',
      texto: 'O gelo estala sob as botas perto do trenó abandonado; rachaduras brancas correm em direção ao fundo escuro.',
    });
    k.regiao([[0, 0], [48, 0], [48, 27], [0, 27]], 'audio', {
      nome: 'Vento na garganta',
      cenaJukebox: 'vento-inverno',
    });

    k.notas(
      'Desfiladeiro nevado — Vigias no alto da crista em "C" dominam o vale; quem tentar contornar pela direita precisa atravessar o gelo rachado ao lado do trenó abandonado.',
    );
  },
};

