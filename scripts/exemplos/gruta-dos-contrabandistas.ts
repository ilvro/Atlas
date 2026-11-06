import type { Exemplo } from './kit.ts';

/** 10.7e — Gruta dos contrabandistas (32 × 42 m). */
export const grutaDosContrabandistas: Exemplo = {
  id: 'gruta-dos-contrabandistas',
  nome: 'Gruta dos contrabandistas',
  descricao: 'Enseada subterrânea de água cristalina com cáusticas, corais e rochas submersas, passarelas de madeira, barcos com flutuador, navio e duas cabanas.',
  largura: 32,
  altura: 42,
  semente: 1075,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#070a0e' });
    k.base('areia');

    // Chão seco de rocha rachada no terraço norte (deixando a areia clara como leito sob a água da gruta)
    k.pintar('rocha.rachada', {
      retangulo: [-2, -2, 34, 11.8],
      irregular: 0.45,
    });

    // Água cristalina da gruta (com cáusticas animadas e transparência alta sobre o fundo de areia)
    k.pintar('agua.gruta', {
      poligono: [
        [2.8, 10.8], [29.2, 10.8], [29.5, 45.0], [2.5, 45.0],
      ],
      irregular: 0.45,
    });
    k.correnteza('agua.gruta', -Math.PI / 2, 0.35);

    // Paredões de rocha de caverna fechando a gruta a oeste, norte, leste e nos ombros da boca sul
    k.pintar('rocha.caverna', {
      poligono: [
        [-3, -3], [35, -3], [35, 4.5], [20.5, 2.2], [11.5, 2.2], [-3, 5.0],
      ],
      irregular: 0.45,
    });
    k.pintar('rocha.caverna', {
      poligono: [
        [-3, -3], [3.5, -3], [3.2, 18.0], [2.8, 30.0], [7.8, 38.5], [9.5, 45.0], [-3, 45.0],
      ],
      irregular: 0.45,
    });
    k.pintar('rocha.caverna', {
      poligono: [
        [28.8, -3], [35, -3], [35, 45.0], [23.5, 45.0], [25.8, 36.5], [29.2, 26.0], [29.2, 12.0],
      ],
      irregular: 0.45,
    });

    // Duas ilhotas de rocha dentro da lagoa a sudoeste
    k.pintar('rocha.caverna', { disco: [7.0, 24.5], raio: 2.3, irregular: 0.35 });
    k.pintar('rocha.caverna', {
      poligono: [
        [6.2, 29.2], [11.2, 28.5], [14.2, 32.2], [13.5, 35.0], [7.2, 35.5], [5.8, 32.5],
      ],
      irregular: 0.4,
    });

    // Presença submersa de algas no fundo da água
    k.presenca('algas', { disco: [14.5, 36.5], raio: 3.5, irregular: 0.6 });
    k.presenca('algas', { disco: [10.5, 27.5], raio: 2.8, irregular: 0.5 });

    // Duas cabanas de pedra com telhado visível no terraço norte
    const cabanaOeste = k.comodo([2, 2, 7, 7], 'taverna', {
      id: 'cabana-vigia',
      nome: 'Cabana da vigia',
      piso: 'tabuas.escuras',
      papel: 'pedra.escura',
      telhado: 'telha.palha',
      telhadoVisivel: true,
    });
    const cabanaLeste = k.comodo([14, 2, 19, 7], 'porao', {
      id: 'cabana-contrabando',
      nome: 'Cabana do contrabando',
      piso: 'tabuas.escuras',
      papel: 'pedra.escura',
      telhado: 'telha.palha',
      telhadoVisivel: true,
    });
    k.porta([6.75, 10.5], 'door', { state: 'closed' });
    k.porta([10.5, 6.75], 'door', { state: 'open' });
    k.porta([21.0, 6.75], 'door', { state: 'open' });
    k.porta([24.75, 10.5], 'door', { state: 'closed' });

    // Móveis nas cabanas (visíveis ao entrar ou ocultar o telhado)
    k.objeto('mesa.retangular', [6.5, 6.5], { rotation: 0.1 });
    k.objeto('cama.solteiro', [4.2, 5.0], { rotation: 0 });
    k.objeto('pilha-de-barris', [8.8, 4.5], { rotation: 0.3 });
    k.objeto('pilha-de-caixotes', [23.2, 5.2], { rotation: -0.2 });
    k.objeto('sacos', [26.2, 6.0], { rotation: 0.4 });
    k.objeto('mesa.redonda', [24.8, 8.2]);

    // Caixotes e barris do lado de fora das cabanas
    k.objeto('pilha-de-caixotes', [20.5, 5.5], { rotation: 0.4 });
    k.objeto('caixote', [21.5, 8.2], { rotation: -0.3 });
    k.objeto('barril', [9.8, 5.5]);

    // Passarelas de tábuas irregulares (segmentos de cais sobre a água)
    for (const [pos, comp, larg, rot] of [
      [[9.0, 11.2], 10.0, 2.0, -0.06],
      [[20.5, 11.2], 11.5, 2.0, 0.04],
      [[4.2, 13.8], 4.8, 1.8, 1.78],
      [[9.2, 14.5], 5.6, 1.8, 1.72],
      [[17.8, 15.0], 6.2, 2.0, 1.55],
      [[17.8, 19.0], 5.8, 1.9, 0.05],
      [[20.2, 21.0], 3.8, 1.8, 1.52],
      [[28.2, 16.5], 9.5, 1.9, 1.58],
      [[28.4, 25.5], 9.0, 1.9, 1.55],
      [[28.0, 32.0], 5.5, 1.8, 1.65],
    ] as const) {
      k.objeto('cais-segmento', [pos[0], pos[1]], {
        params: { comprimento: comp, largura: larg },
        rotation: rot,
        blocks: { move: false, sight: false },
      });
    }

    // Embarcações: botes a remo, dois barcos de vela com flutuador e o navio atracado a sudeste
    for (const [pos, rot] of [
      [[6.8, 14.6], -1.42],
      [[11.2, 14.6], -1.72],
      [[8.8, 18.0], -0.22],
      [[15.8, 13.8], -1.48],
      [[20.2, 13.8], -1.68],
      [[20.0, 23.2], -0.45],
      [[26.4, 18.8], -1.42],
    ] as const) {
      k.objeto('barco-a-remo', [pos[0], pos[1]], {
        rotation: rot,
        blocks: { move: false, sight: false },
      });
    }
    k.objeto('barco-de-vela', [15.5, 21.2], {
      rotation: -0.15,
      scale: 1.05,
      blocks: { move: false, sight: false },
    });
    k.objeto('barco-de-vela', [24.8, 14.8], {
      rotation: -2.65,
      scale: 1.05,
      blocks: { move: false, sight: false },
    });
    k.objeto('navio', [24.8, 30.2], {
      params: { comprimento: 15, mastros: 2 },
      rotation: -Math.PI / 2 + 0.08,
      blocks: { move: false, sight: false },
    });

    // Fundo da água: rochas submersas, corais rosados e lilases, ouriços, anêmonas e algas
    for (const [pos, rot, esc] of [
      [[4.5, 23.0], 0.4, 1.2],
      [[13.5, 28.0], 1.1, 1.6],
      [[21.8, 17.5], -0.5, 1.5],
      [[22.8, 23.5], 0.8, 1.3],
      [[13.0, 39.2], 0.2, 1.7],
    ] as const) {
      k.objeto('rocha-submersa', [pos[0], pos[1]], { rotation: rot, scale: esc });
    }
    for (const [pos, cor, esc] of [
      [[16.8, 30.2], 0, 1.25],
      [[21.8, 36.8], 0, 1.3],
      [[5.2, 36.8], 1, 1.15],
      [[6.2, 38.2], 1, 1.2],
      [[26.8, 36.5], 1, 1.2],
    ] as const) {
      k.objeto('coral', [pos[0], pos[1]], { params: { cor }, scale: esc });
    }
    for (const [pos, esc] of [
      [[15.2, 35.8], 1.35],
      [[16.2, 26.8], 1.1],
    ] as const) {
      k.objeto('anemona', [pos[0], pos[1]], { scale: esc });
    }
    for (const pos of [[11.8, 36.5], [18.5, 34.2], [19.8, 28.2]] as const) {
      k.objeto('ourico', [pos[0], pos[1]], { scale: 1.15 });
    }
    for (const [pos, rot] of [
      [[11.8, 39.8], -0.4], [[15.2, 40.5], 0.2], [[20.5, 39.5], -0.2],
      [[25.8, 39.2], -0.6], [[13.2, 26.0], 0.3], [[8.2, 35.8], -0.3],
    ] as const) {
      k.objeto('alga', [pos[0], pos[1]], { rotation: rot, scale: 1.15 });
    }

    // Vegetação costeira nas duas ilhotas e rochedos no terraço norte
    k.objeto('rochedo', [7.0, 24.5], { params: { tamanho: 3.4, cobertura: 1 }, rotation: 0.4 });
    k.objeto('rochedo', [10.0, 32.2], { params: { tamanho: 4.5, cobertura: 1 }, rotation: -0.3 });
    for (const pos of [
      [8.5, 25.5], [12.8, 31.5], [13.5, 33.8], [9.5, 34.8], [7.8, 35.2],
    ] as const) {
      k.objeto('tufo-de-grama', [pos[0], pos[1]], { scale: 1.2 });
    }
    k.objeto('casa:folhagem-tropical-1m', [8.8, 24.2], { scale: 0.9 });
    k.objeto('casa:folhagem-tropical-1m', [12.8, 32.8], { scale: 0.95 });
    k.objeto('pedra.grande', [10.5, 3.2], { rotation: 0.5 });
    k.objeto('pedra.grande', [20.5, 3.0], { rotation: -0.4 });

    // Luzes: lanternas quentes fora das cabanas e luz verde-dourada entrando pela boca da gruta ao sul
    k.luz('tocha', [6.8, 10.9], { radius: 6.5, color: '#ffb84d', intensity: 1.25, flicker: 0.22 });
    k.luz('lamparina', [11.0, 5.8], { radius: 5.5, color: '#ffb044', intensity: 1.1, flicker: 0.18 });
    k.luz('tocha', [23.8, 10.9], { radius: 6.5, color: '#ffb84d', intensity: 1.25, flicker: 0.22 });
    k.luz('lamparina', [20.4, 5.2], { radius: 5.5, color: '#ffb044', intensity: 1.1, flicker: 0.18 });
    k.luz('farol', [16.5, 40.2], {
      radius: 26,
      color: '#f2fca8',
      intensity: 1.45,
      flicker: 0,
      power: 'magic',
      direcao: -Math.PI / 2 - 0.08,
      cone: { angle: 1.05, direction: -Math.PI / 2 - 0.08 },
      rays: true,
    });
    k.luz('luar', [16.5, 32.5], {
      radius: 18,
      color: '#b8f2da',
      intensity: 0.78,
      flicker: 0,
    });

    // Clima e acabamento: penumbra clara de gruta com cáusticas acesas e bordas escuras
    k.clima('noite', {
      time: '21:00',
      ambient: { color: '#b4dce2', intensity: 0.78 },
      sun: null,
      tempo: { fog: 0 },
    });
    k.acabamento('neutro', {
      tint: '#f2fcf6',
      saturation: 1.08,
      vignette: 0.24,
      edges: { kind: 'dark', amount: 0.28 },
      glow: 0.85,
    });

    // Climas salvos do mapa
    k.guardarClima('mare-baixa-sol', 'Reflexo dourado na boca');
    k.guardarClima('noite-fechada', 'Noite sem luar', 'noite', {
      time: '01:00',
      ambient: { color: '#1e2c34', intensity: 0.22 },
      sun: null,
      tempo: { fog: 0.25 },
      finish: { tint: '#cde4ec', saturation: 0.9, vignette: 0.6, edges: { kind: 'dark', amount: 0.82 }, glow: 0.88 },
    });
    k.guardarClima('nevoeiro-marinho', 'Bruma da maré cheia', 'neblina', {
      time: '07:00',
      ambient: { color: '#587478', intensity: 0.55 },
      sun: null,
      tempo: { fog: 0.7, wind: 0.15 },
      finish: { tint: '#d8ece8', saturation: 0.82, vignette: 0.45, edges: { kind: 'fog', amount: 0.55 }, glow: 0.65 },
    });

    // Notas de cômodo e regiões
    k.notaDeComodo(cabanaOeste, {
      leitura: 'Redes penduradas nas vigas, lanternas a óleo e uma mesa com cartas náuticas da costa.',
      notasMestre: 'Os vigias revezam-se aqui de olho no canal de entrada.',
    });
    k.notaDeComodo(cabanaLeste, {
      leitura: 'Pilha de caixotes selados, barris de pólvora seca e sacas de especiarias.',
      notasMestre: 'O carregamento principal aguarda a maré da meia-noite.',
    });

    k.regiao([[20, 2], [29, 2], [29, 11], [20, 11]], 'reveal', {
      nome: 'Cabana do contrabando',
    });
    k.regiao([[10, 33], [23, 33], [23, 42], [10, 42]], 'trigger', {
      nome: 'Entrada da enseada',
      texto: 'A água verde-esmeralda deixa ver os corais e as rochas afiadas a poucos palmos sob o casco.',
    });
    k.regiao([[2, 10], [30, 10], [30, 42], [2, 42]], 'audio', {
      nome: 'Marolas na caverna',
      cenaJukebox: 'gruta-marinha',
    });

    k.notas(
      'Gruta dos contrabandistas — Só quem conhece o canal entre os recifes de coral consegue trazer um navio até a passarela leste sem rasgar o casco nas rochas submersas.',
    );
  },
};

