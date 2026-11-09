import type { Exemplo } from './kit.ts';

/** 10.7g — Porto à noite (60 × 36 m). */
export const portoNoturno: Exemplo = {
  id: 'porto-noturno',
  nome: 'Porto à noite',
  descricao: 'Cidade portuária calçada em paralelepípedos, praça com fonte, barracas de feira, estalagem, oficina, armazém, guindastes e quatro navios sob lanternas e neblina.',
  largura: 60,
  altura: 36,
  semente: 1077,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#091622' });
    k.base('areia.molhada');

    // Calçamento de paralelepípedo nas ruas, praça e cais de pedra
    k.pintar('paralelepipedo', {
      poligono: [
        [-3, -3], [63, -3], [63, 15.6], [51.0, 15.6],
        [51.0, 24.8], [34.2, 24.8], [31.2, 20.8], [16.2, 20.8],
        [16.2, 34.5], [-3, 34.5],
      ],
      irregular: 0.1,
    });

    // Mar escuro na bacia portuária ao sul e a sudeste (estendendo além da borda sul/leste)
    k.pintar('agua.mar', {
      poligono: [
        [15.8, 20.5], [31.5, 20.5], [34.5, 24.5], [51.0, 24.5],
        [51.2, 15.2], [63.0, 15.2], [63.0, 39.0], [15.5, 39.0],
      ],
      irregular: 0.18,
    });
    k.correnteza('agua.mar', 0.25, 0.65);

    // Pátio de lajes da oficina central
    k.pintar('calcada', {
      poligono: [
        [31.5, 16.0], [45.8, 16.0], [45.8, 24.2], [34.5, 24.2], [30.0, 20.0],
      ],
      irregular: 0.08,
    });

    // Casas nas extremidades com telhado de telha de barro visível
    k.comodo([0, 1, 2, 5], 'sala', {
      id: 'telhado-oeste',
      nome: 'Sobrado oeste',
      telhado: 'telha.barro',
      telhadoVisivel: true,
    });
    k.comodo([38, 0, 40, 6], 'sala', {
      id: 'telhado-leste',
      nome: 'Sobrado leste',
      telhado: 'telha.barro',
      telhadoVisivel: true,
    });

    // 1. Estalagem a noroeste (quartos, átrio ajardinado e sala de jantar abertos)
    const quartoNO = k.comodo([3, 2, 7, 5], 'quarto', {
      id: 'estalagem-quarto-norte',
      nome: 'Quarto de hóspedes norte',
      piso: 'tabuas.claras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([3, 5, 7, 8], 'quarto', {
      id: 'estalagem-quarto-sul',
      nome: 'Dormitório dos marinheiros',
      piso: 'tabuas.claras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([7, 2, 9, 9], 'corredor', {
      id: 'estalagem-atrio',
      nome: 'Átrio da estalagem',
      piso: 'laje.pedra',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    const refeitorioId = k.comodo([9, 2, 15, 5], 'sala-de-jantar', {
      id: 'estalagem-jantar',
      nome: 'Salão de jantar',
      piso: 'tabuas.escuras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([9, 5, 12, 8], 'escritorio', {
      id: 'estalagem-gabinete',
      nome: 'Gabinete do estalajadeiro',
      piso: 'tabuas.escuras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([12, 5, 15, 8], 'quarto', {
      id: 'estalagem-quarto-leste',
      nome: 'Quarto do capitão',
      piso: 'tabuas.claras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });

    // 2. Mansão / Casa da Guilda a nordeste
    k.comodo([25, 2, 29, 5], 'quarto', {
      id: 'guilda-quarto-1',
      nome: 'Aposento norte',
      piso: 'tabuas.claras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([25, 5, 29, 8], 'quarto', {
      id: 'guilda-quarto-2',
      nome: 'Aposento sul',
      piso: 'tabuas.claras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([29, 2, 31, 8], 'corredor', {
      id: 'guilda-atrio',
      nome: 'Saguão da guilda',
      piso: 'laje.pedra',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    const salaoGuilda = k.comodo([31, 2, 36, 5], 'biblioteca', {
      id: 'guilda-cartografia',
      nome: 'Sala de cartografia',
      piso: 'tabuas.escuras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });
    k.comodo([31, 5, 36, 8], 'escritorio', {
      id: 'guilda-tesouraria',
      nome: 'Despensa e tesouraria',
      piso: 'tabuas.escuras',
      papel: 'pedra.escura',
      telhado: 'telha.barro',
      telhadoVisivel: false,
    });

    // 3. Armazém da Alfândega a sudoeste e Oficina naval no centro-sul
    const armazemId = k.comodo([2, 13, 10, 21], 'porao', {
      id: 'armazem-alfandega',
      nome: 'Armazém da Alfândega',
      piso: 'laje.pedra',
      papel: 'pedra.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });
    const oficinaId = k.comodo([24, 11, 30, 15], 'forja', {
      id: 'oficina-naval',
      nome: 'Oficina de cordoaria e reparos',
      piso: 'laje.pedra',
      papel: 'pedra.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });

    // Portas principais
    for (const p of [
      [11.25, 3.0], [11.25, 13.5], [10.5, 5.25], [10.5, 9.75],
      [13.5, 5.25], [13.5, 9.75], [18.0, 9.75],
      [45.0, 3.0], [45.0, 12.0], [43.5, 5.25], [43.5, 9.75],
      [46.5, 5.25], [46.5, 9.75],
      [9.0, 19.5], [15.0, 25.5], [40.5, 16.5], [36.0, 19.5],
    ] as const) {
      k.porta([p[0], p[1]], 'door', { state: 'open' });
    }

    // Mobiliário interno da Estalagem, da Guilda, do Armazém e da Oficina
    k.objeto('cama.solteiro', [5.8, 4.4], { rotation: 0.7 });
    k.objeto('cama.solteiro', [7.4, 5.8], { rotation: 0.7 });
    k.objeto('cama.solteiro', [5.5, 9.8], { rotation: 0 });
    k.objeto('cama.solteiro', [7.2, 9.8], { rotation: 0 });
    k.objeto('cama.solteiro', [8.9, 9.8], { rotation: 0 });
    k.objeto('canteiro', [12.0, 6.8], { rotation: Math.PI / 2, scale: 0.85 });
    k.objeto('mesa.retangular', [16.5, 4.8], { params: { largura: 3.4, profundidade: 1.0 }, rotation: 0 });
    k.objeto('mesa.redonda', [15.8, 9.8]);
    k.objeto('cama.solteiro', [19.2, 9.8], { rotation: Math.PI / 2 });
    k.objeto('cama.solteiro', [21.2, 9.8], { rotation: Math.PI / 2 });

    k.objeto('cama.casal', [39.2, 4.8], { rotation: 0 });
    k.objeto('cama.casal', [42.0, 4.8], { rotation: 0 });
    k.objeto('cama.casal', [39.2, 9.5], { rotation: Math.PI });
    k.objeto('mesa.redonda', [48.2, 4.8]);
    k.objeto('cama.casal', [52.0, 4.8], { rotation: 0.7 });
    k.objeto('escrivaninha', [48.2, 9.8], { rotation: 0 });

    // Armazém sudoeste e Oficina central
    for (const [item, pos, rot] of [
      ['pilha-de-caixotes', [5.0, 21.5], 0.1],
      ['pilha-de-caixotes', [8.5, 21.5], -0.1],
      ['pilha-de-caixotes', [12.5, 21.5], 0.2],
      ['pilha-de-caixotes', [5.2, 28.5], -0.15],
      ['pilha-de-caixotes', [12.5, 28.8], 0.05],
      ['pilha-de-barris', [8.8, 25.5], 0.4],
      ['sacos', [6.2, 25.2], -0.2],
      ['mesa.retangular', [11.2, 25.2], Math.PI / 2],
      ['pilha-de-caixotes', [37.5, 18.2], 0.1],
      ['pilha-de-barris', [43.2, 18.2], -0.2],
      ['mesa.retangular', [40.5, 20.5], 0],
      ['rolo-de-corda', [38.2, 21.2], 0],
      ['ancora', [43.2, 21.2], 0.4],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { rotation: rot });
    }

    // Praça da fonte: fonte circular, estátua em pedestal e escadarias
    k.objeto('fonte', [29.8, 6.4], { scale: 1.45 });
    k.objeto('estatua', [29.8, 12.2], { scale: 1.25 });
    k.objeto('escada.externa', [25.4, 11.2], { params: { largura: 3.0 }, rotation: 0, blocks: { move: false, sight: false } });
    k.objeto('escada.externa', [34.2, 11.2], { params: { largura: 3.0 }, rotation: 0, blocks: { move: false, sight: false } });

    // Barracas de feira com toldos listrados: poucas, nos cantos da praça, na rua do cais e no canto leste.
    for (const [pos, pal, rot] of [
      [[24.2, 3.6], 0, 1.35], [[35.4, 4.6], 1, -1.2], [[27.6, 13.6], 1, 0.12], [[32, 13.6], 0, -0.12], [[37.6, 14.2], 3, 0.05],
      [[51, 13.4], 2, -0.75], [[49.2, 17.6], 0, 0.3], [[49.6, 20.6], 1, 1.35], [[3.2, 11.2], 1, 1.1],
    ] as const) {
      k.objeto('barraca-de-feira', [pos[0], pos[1]], { params: { paleta: pal }, rotation: rot, scale: 0.78 });
    }

    // Passarelas e píeres de madeira ao longo da bacia portuária
    for (const [pos, comp, larg, rot] of [
      [[8.8, 33.8], 12.0, 2.4, 0],
      [[21.0, 19.8], 9.5, 2.2, 0],
      [[24.6, 27.5], 12.0, 2.0, Math.PI / 2],
      [[34.8, 29.5], 10.5, 2.2, Math.PI / 2],
      [[41.5, 24.8], 11.5, 2.2, 0],
      [[48.0, 28.5], 12.0, 2.4, Math.PI / 2],
      [[55.5, 14.8], 8.5, 2.2, 0],
    ] as const) {
      k.objeto('cais-segmento', [pos[0], pos[1]], {
        params: { comprimento: comp, largura: larg },
        rotation: rot,
        blocks: { move: false, sight: false },
      });
    }

    // Dois guindastes de cais, estacas, rolos de corda, redes e cargas nas docas
    k.objeto('guindaste-de-cais', [24.6, 19.2], { rotation: Math.PI / 2, scale: 1.15 });
    k.objeto('guindaste-de-cais', [48.0, 26.8], { rotation: Math.PI / 2, scale: 1.15 });
    for (const pos of [
      [17.5, 20.4], [20.5, 20.4], [28.5, 20.4],
      [35.5, 25.4], [44.5, 25.4], [51.5, 15.6],
    ] as const) {
      k.objeto('estaca', [pos[0], pos[1]]);
    }
    for (const [item, pos, rot] of [
      ['pilha-de-caixotes', [16.5, 19.5], 0.3],
      ['pilha-de-barris', [4.2, 18.2], 0.1],
      ['pilha-de-caixotes', [46.2, 23.8], -0.2],
      ['sacos', [47.5, 28.2], 0.4],
      ['rede-de-pesca', [34.8, 27.2], 0.2],
      ['rolo-de-corda', [24.6, 23.2], 0],
      ['ancora', [34.8, 32.5], 0.5],
      ['carrinho-de-carga', [36.5, 4.8], -0.4],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { rotation: rot });
    }

    // Quatro navios atracados e um barco a remo
    k.objeto('navio', [21.2, 26.8], {
      params: { comprimento: 15, mastros: 2 },
      rotation: Math.PI / 2,
      blocks: { move: false, sight: false },
    });
    k.objeto('navio', [28.0, 26.8], {
      params: { comprimento: 16, mastros: 2 },
      rotation: Math.PI / 2,
      blocks: { move: false, sight: false },
    });
    k.objeto('navio', [40.2, 30.0], {
      params: { comprimento: 18, mastros: 3 },
      rotation: -Math.PI / 2,
      blocks: { move: false, sight: false },
    });
    k.objeto('navio', [55.8, 26.0], {
      params: { comprimento: 22, mastros: 3 },
      rotation: -Math.PI / 2,
      blocks: { move: false, sight: false },
    });
    k.objeto('barco-a-remo', [48.0, 32.5], {
      rotation: 0.05,
      blocks: { move: false, sight: false },
    });

    // Postes de lanterna e poças quentes de luz pelas ruas, praça, cais e interiores
    for (const pos of [
      [7.8, 1.5], [15.8, 14.5], [24.8, 2.2], [24.8, 9.2],
      [34.8, 2.2], [35.2, 11.2], [29.8, 15.2], [10.2, 16.2],
      [19.8, 19.6], [34.6, 23.8], [45.2, 18.8], [50.4, 21.8],
      [54.5, 11.2], [4.5, 31.8], [14.8, 31.8],
    ] as const) {
      k.objeto('lanterna-de-poste', [pos[0], pos[1]]);
      k.luz('tocha', [pos[0], pos[1]], {
        radius: 8.5,
        color: '#ffc055',
        intensity: 1.25,
        flicker: 0.2,
      });
    }
    // Luzes internas aconchegantes nos quartos, salões e oficina
    for (const pos of [
      [6.5, 5.0], [6.5, 10.0], [16.5, 4.8], [20.2, 9.8],
      [39.5, 4.8], [39.5, 9.5], [48.5, 4.8], [48.5, 9.8],
      [40.5, 19.5], [8.5, 25.0],
    ] as const) {
      k.luz('lamparina', [pos[0], pos[1]], {
        radius: 6.0,
        color: '#ffb858',
        intensity: 1.1,
        flicker: 0.15,
      });
    }

    // Clima e acabamento: noite portuária com halos quentes e bruma suave nas bordas
    k.clima('noite', {
      time: '23:00',
      ambient: { color: '#7892b5', intensity: 0.74 },
      sun: { angle: 0.8, color: '#adc8f0', intensity: 0.45 },
      tempo: { fog: 0.3, wind: 0.15 },
    });
    k.acabamento('quente', {
      tint: '#f8f0e4',
      saturation: 1.12,
      vignette: 0.22,
      edges: { kind: 'fog', amount: 0.22 },
      glow: 0.9,
    });

    // Climas salvos do mapa
    k.guardarClima('noite-no-cais', 'Noite de lanternas no cais');
    k.guardarClima('amanhecer-no-porto', 'Amanhecer dourado', 'manha', {
      time: '07:30',
      tempo: { fog: 0.2, wind: 0.2 },
      finish: { tint: '#ffe8c8', saturation: 1.15, vignette: 0.28, edges: { kind: 'fog', amount: 0.25 }, glow: 0.45 },
    });
    k.guardarClima('cerimonia-de-nevoeiro', 'Nevoeiro cerrado', 'neblina', {
      time: '04:30',
      ambient: { color: '#425464', intensity: 0.38 },
      sun: null,
      tempo: { fog: 0.85, wind: 0.2 },
      finish: { tint: '#d8e4ec', saturation: 0.72, vignette: 0.5, edges: { kind: 'fog', amount: 0.65 }, glow: 0.92 },
    });

    // Notas de cômodo e regiões
    k.notaDeComodo(quartoNO, {
      leitura: 'Duas camas de campanha desalinhadas e uma janela voltada para o beco oeste.',
      notasMestre: 'Um passageiro clandestino do navio de três mastros escondeu sua mala sob a cama.',
    });
    k.notaDeComodo(refeitorioId, {
      leitura: 'Uma longa mesa posta para doze pessoas, com restos de ensopado e canecas de estanho.',
      notasMestre: 'Ponto de encontro dos capitães antes da abertura da alfândega.',
    });
    k.notaDeComodo(salaoGuilda, {
      leitura: 'Mapas náuticos presos com punhais sobre a mesa redonda e sextantes de latão.',
      notasMestre: 'A rota para a Gruta dos Contrabandistas está marcada a carvão num pergaminho solto.',
    });
    k.notaDeComodo(armazemId, {
      leitura: 'Um galpão frio de pedra, cheirando a alcatrão, canela e madeira molhada.',
      notasMestre: 'Guardas da alfândega fazem ronda pelo lado de fora a cada meia hora.',
    });
    k.notaDeComodo(oficinaId, {
      leitura: 'Rolos grossos de cânhamo, bigornas de reparo e cheiro forte de breu quente.',
      notasMestre: 'A porta sul dá direto para o píer do navio mercante.',
    });

    k.regiao([[3, 19.5], [15, 19.5], [15, 31.5], [3, 31.5]], 'reveal', {
      nome: 'Interior da Alfândega',
    });
    k.regiao([[22, 1], [37, 1], [37, 14], [22, 14]], 'trigger', {
      nome: 'Praça da Fonte',
      texto: 'Sob a luz amarela dos postes, feirantes recolhem os últimos fardos enquanto marinheiros discutem perto da estátua.',
    });
    k.regiao([[15, 18], [60, 18], [60, 36], [15, 36]], 'audio', {
      nome: 'Docas à noite',
      cenaJukebox: 'porto-noturno',
    });

    k.notas(
      'Porto à noite — Quatro navios disputam a maré da madrugada; entre a praça da fonte, a estalagem e o armazém da alfândega, cada beco iluminado por lanternas guarda um acordo ou uma tocaia.',
    );
  },
};

