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

    // Lago congelado arredondado, encaixado nas rochas do canto leste.
    k.pintar('gelo', { poligono: [[33.8, -1], [40.2, -1], [41, 3], [39.8, 7], [42.4, 10.2], [44.8, 12.8], [45.2, 17], [43, 20.6], [38.6, 21.6], [35.4, 19.2], [34, 14], [33.4, 6]], irregular: 0.6 });

    // A crista: barra no alto, braço descendo à direita até y ≈ 15,5 e tronco descendo à esquerda até a borda sul.
    k.pintar('rocha.nevada', { poligono: [[3, 0.4], [10, 0.2], [14, 0.8], [16.6, 2], [18.6, 5], [19.6, 9], [19.6, 13], [18.6, 15.8], [16.8, 15.6], [16.2, 12], [15.8, 8], [14.6, 4.6], [11, 4], [7.6, 4.6], [4, 4]], irregular: 0.45 });
    k.pintar('rocha.nevada', { poligono: [[7.4, 3.8], [10, 6], [11.6, 9.6], [12.6, 13], [14.6, 16.6], [14.8, 19], [13.2, 22], [12.6, 27.6], [7, 27.6], [8.2, 23], [10, 19], [9.6, 15], [8.4, 10], [7.4, 7]], irregular: 0.45 });

    // Paredão de rocha nevada no canto leste: bloco no alto, parede à direita do lago e rochas ao sul dele.
    k.pintar('rocha.nevada', { poligono: [[40.6, -1], [49, -1], [49, 28], [36.4, 28], [37, 23.6], [40.6, 22.2], [44.2, 20.8], [45.8, 17], [46, 11.6], [43.6, 9.4], [41.8, 8], [40.6, 4.6]], irregular: 0.55 });

    // Trenó deixado na margem do gelo.
    k.objeto('treno', [39, 5.8], { rotation: 1.4, scale: 1.1 });

    // Rochedos: no alto à esquerda, ao pé da crista, na margem do lago e ao sul.
    for (const [pos, tam, cob, rot] of [
      [[3.6, 2.6], 2.4, 2, 0.4], [[13.4, 14.4], 1.6, 2, 1.1], [[14.6, 21.8], 2, 2, -0.5], [[17.6, 25.6], 3, 2, 0.2], [[16.4, 4.6], 1.6, 0, 0.6],
      [[39.4, 4], 1.6, 0, 0.8], [[42.6, 8.8], 2.8, 2, -0.4], [[38.4, 22.4], 2.6, 2, 1.5], [[41.8, 23.6], 3, 2, 0.4], [[38.8, 25.6], 2.2, 0, 0.3], [[32.6, 26.2], 1.8, 2, 2],
    ] as const) k.objeto('rochedo', [pos[0], pos[1]], { params: { tamanho: tam, cobertura: cob }, rotation: rot });

    // Árvores nevadas em três manchas: no alto junto à crista, no meio do vale e espalhadas ao sul; e as do lado oeste.
    for (const [item, pos, esc] of [
      ['casa:arvore-nevada-3m', [18, 1.4], 1], ['casa:arvore-nevada-3m', [21.2, 3.6], 0.9], ['casa:arvore-nevada-3m', [20.6, 6], 0.95], ['casa:arvore-nevada-3m', [24.6, 1.6], 0.6],
      ['casa:arvore-nevada-3m', [25.6, 2.6], 0.55], ['casa:arvore-nevada-3m', [26.6, 6.6], 0.5], ['casa:arvore-nevada-3m', [27.4, 8.4], 0.85], ['casa:arvore-nevada-3m', [26.2, 9.4], 0.65],
      ['casa:arvore-nevada-3m', [28.4, 9.6], 0.6], ['casa:arvore-nevada-3m', [27.4, 11.4], 0.55], ['casa:arvore-nevada-3m', [28.6, 12.4], 0.5],
      ['casa:arvore-nevada-3m', [22.6, 13.8], 0.6], ['casa:arvore-nevada-3m', [21.8, 15.6], 0.85], ['casa:arvore-nevada-3m', [24, 16.4], 0.7], ['casa:arvore-nevada-3m', [26.4, 13.6], 0.75], ['casa:arvore-nevada-3m', [28, 14.2], 0.5],
      ['casa:arvore-nevada-3m', [29, 19.6], 0.45], ['casa:arvore-nevada-3m', [27.6, 20.8], 0.55], ['casa:arvore-nevada-3m', [26.4, 22.8], 0.5], ['casa:arvore-nevada-3m', [25.8, 24.4], 0.45], ['casa:arvore-nevada-3m', [27.2, 25], 0.4],
      ['casa:arvore-nevada-3m', [6.8, 18], 0.75], ['casa:arvore-nevada-3m', [6.4, 21.2], 0.65], ['casa:arvore-nevada-3m', [1, 21.4], 0.6], ['casa:arvore-nevada-3m', [14.6, 25.4], 0.5],
    ] as const) k.objeto(item, [pos[0], pos[1]], { scale: esc });

    // Arbustos secos, galhos caídos e seixos na neve.
    for (const [item, pos, rot] of [
      ['casa:arbusto-seco-2m-neve', [12.6, 1.2], 0.3], ['casa:arbusto-seco-2m', [8.8, 21.6], 1.2], ['casa:arbusto-seco-1m', [7.2, 23.4], 2.1], ['casa:arbusto-seco-2m-neve', [21.6, 25.6], 0.8],
      ['casa:arbusto-seco-1m', [37.6, 23.4], 1.7], ['casa:arbusto-seco-1m', [35.6, 23.2], 0.4], ['casa:arbusto-seco-1m', [21, 8.6], 2.6], ['galho-seco', [24.6, 1.4], 1.8], ['galho-seco', [14.2, 25.8], 0.6],
    ] as const) k.objeto(item, [pos[0], pos[1]], { rotation: rot });
    for (const pos of [[13.6, 16.8], [15.8, 20.6], [20.2, 25.4], [31.6, 25.8], [40.8, 7.6], [43.4, 11.2], [35.6, 24.6], [3.6, 5.4], [14.6, 10.6], [20.4, 9.6]] as const) k.objeto('seixos', [pos[0], pos[1]]);

    // Clima: manhã fria e ensolarada de inverno (sol a noroeste projetando sombras longas azuladas para sudeste)
    k.clima('neve', {
      time: '09:30',
      ambient: { color: '#e4eeff', intensity: 1 },
      sun: { angle: 0.72, color: '#fbfdff', intensity: 1.15 },
      tempo: { snow: 0.45, wind: 0.25, fog: 0 },
    });
    k.acabamento('frio', {
      tint: '#eef5ff',
      saturation: 1.12,
      vignette: 0.1,
      edges: { kind: 'clouds', amount: 0.2 },
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

