import type { Exemplo } from './kit.ts';

/** 10.7d — Entreposto do rio (58 × 36 m). */
export const entrepostoDoRio: Exemplo = {
  id: 'entreposto-do-rio',
  nome: 'Entreposto do rio',
  descricao: 'Estrada barrenta com carroça e cavalos, armazém portuário com depósito e escritório, deque de madeira e píer com barcaça sobre águas rasas.',
  largura: 58,
  altura: 36,
  semente: 1074,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#0c2430' });
    k.base('terra');

    // Mata ao norte e manchas de grama nas bordas oeste e sul; o resto é terra batida.
    k.pintar('grama.escura', { poligono: [[13, -3], [31, -3], [31.5, 6], [29, 9.2], [24, 9.6], [19, 8.6], [14.5, 6.5]], irregular: 0.9 });
    k.pintar('grama', { retangulo: [-3, -3, 3.6, 12.0], irregular: 0.9 });
    k.pintar('grama', { retangulo: [-3, 27, 5, 39], irregular: 0.9 });
    k.pintar('grama.seca', { disco: [3, 20], raio: 2.6, irregular: 1.2 });
    k.pintar('grama.seca', { disco: [8.6, 3.4], raio: 2.2, irregular: 1.2 });

    // Sulcos das rodas: a carroça veio do norte pela terra e fez a curva até o deque.
    k.presenca('sulcos', { faixa: [[7.8, -1], [7, 8], [6.6, 14], [8.2, 18], [12, 18.4]], largura: 2.0, irregular: 0.3 }, 0.55);
    k.presenca('sulcos', { faixa: [[10.6, 6], [14.6, 9.6], [19.4, 11.6], [21.6, 13.6]], largura: 1.8, irregular: 0.3 });

    // Praia de areia molhada na beira da água, sob o deque e ao sul dele.
    k.pintar('areia', { poligono: [[34.6, 17.6], [37.6, 18.4], [39.6, 23], [40.6, 29], [38, 29.6], [35.4, 25], [34.6, 20]], irregular: 0.5 });
    k.pintar('areia.molhada', { faixa: [[37.2, 18.6], [38.8, 23], [40, 28.6]], largura: 1.6, irregular: 0.4 });

    // Lago largo a leste; as margens norte e sul têm mato.
    k.pintar('agua.lago', { poligono: [[31.5, -3], [61, -3], [61, 39], [41, 39], [41.4, 30], [40.6, 24], [38.8, 19.4], [36, 18], [35.6, 9.5], [32, 6.5]], irregular: 0.55 });
    k.correnteza('agua.lago', Math.PI / 2, 0.12);
    k.pintar('grama.escura', { poligono: [[34.6, 29.6], [40.8, 29.4], [41.6, 33], [42.6, 39], [34, 39]], irregular: 0.8 });
    k.presenca('algas', { disco: [35.5, 4.5], raio: 3.5, irregular: 0.6 }, 0.35);
    k.presenca('algas', { disco: [42.0, 31.5], raio: 3.2, irregular: 0.6 });

    // Deque de carga aberto ao norte do armazém: tábuas lado a lado, sem paredes.
    for (const [y, w] of [[10.9, 2.8], [13.6, 2.8], [16.3, 2.8]] as const) for (const [x, c] of [[24.8, 7.4], [32, 7.2]] as const) k.objeto('cais-segmento', [x, y], { params: { comprimento: c, largura: w }, rotation: 0, blocks: { move: false, sight: false }, castsShadow: false });

    // Cômodos do armazém (telhados abertos para mostrar o interior detalhado como na referência)
    const quartoId = k.comodo([9, 14, 15, 17], 'quarto', {
      id: 'alojamento',
      nome: 'Alojamento do capataz',
      piso: 'tabuas.escuras',
      papel: 'madeira.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });
    const despensaId = k.comodo([9, 17, 12, 20], 'porao', {
      id: 'despensa',
      nome: 'Depósito trancado',
      piso: 'tabuas.escuras',
      papel: 'madeira.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });
    k.comodo([9, 20, 12, 22], 'banheiro', {
      id: 'lavabo',
      nome: 'Lavabo',
      piso: 'tabuas.escuras',
      papel: 'madeira.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });
    k.comodo([12, 17, 15, 22], 'corredor', {
      id: 'corredor-armazem',
      nome: 'Corredor interno',
      piso: 'tabuas.carvalho',
      papel: 'madeira.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });
    const escritorioId = k.comodo([9, 22, 15, 24], 'escritorio', {
      id: 'escritorio-feitor',
      nome: 'Escritório do feitor',
      piso: 'tabuas.carvalho',
      papel: 'madeira.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });
    const galpaoId = k.comodo([15, 13, 23, 24], 'porao', {
      id: 'galpao-principal',
      nome: 'Galpão de mercadorias',
      piso: 'tabuas.escuras',
      papel: 'madeira.escura',
      telhado: 'telha.ardosia',
      telhadoVisivel: false,
    });

    // Portas e aberturas do armazém
    k.porta([27.75, 19.5], 'arch', { state: 'open', width: 1.6 });
    k.porta([20.25, 25.5], 'door', { state: 'closed' });
    k.porta([18.0, 27.75], 'door', { state: 'open' });
    k.porta([18.0, 31.5], 'door', { state: 'closed' });
    k.porta([20.25, 33.0], 'door', { state: 'closed' });
    k.porta([22.5, 29.25], 'door', { state: 'open' });

    // Píer longo avançando sobre a água e passarela para a barcaça
    k.objeto('cais-segmento', [43.0, 11.2], {
      params: { comprimento: 12, largura: 2.6 },
      rotation: 0,
      blocks: { move: false, sight: false },
    });
    k.objeto('cais-segmento', [34.8, 16.2], {
      params: { comprimento: 4.5, largura: 1.6 },
      rotation: 0,
      blocks: { move: false, sight: false },
    });

    // Barcaça atracada ao píer com um cavalo malhado a bordo
    k.objeto('barcaca', [43.2, 16.2], {
      rotation: 0,
      scale: 1.5,
      blocks: { move: false, sight: false },
    });
    k.objeto('cavalo', [44.8, 16.0], {
      params: { pelagem: 3 },
      rotation: -0.25,
      layer: 5,
      blocks: { move: false, sight: false },
    });

    // Lanterna de poste no fim do píer
    k.objeto('lanterna-de-poste', [49.4, 10.2]);

    // Carroça carregada na estrada puxada por dois cavalos
    k.objeto('carroca', [8.6, 15.2], {
      params: { carga: 1 },
      rotation: -1.18,
      scale: 1.3,
    });
    k.objeto('cavalo', [10.2, 10.2], { params: { pelagem: 2 }, rotation: -1.18, scale: 1.15 });
    k.objeto('cavalo', [11.6, 10.8], { params: { pelagem: 3 }, rotation: -1.18, scale: 1.15 });

    // Cavalos nos bebedouros e fardos de feno junto à parede oeste
    k.objeto('bebedouro', [11.2, 22.2], { rotation: Math.PI / 2 });
    k.objeto('bebedouro', [11.2, 27.2], { rotation: Math.PI / 2 });
    k.objeto('cavalo', [9.2, 21.4], { params: { pelagem: 1 }, rotation: 0.05 });
    k.objeto('cavalo', [9.2, 22.8], { params: { pelagem: 3 }, rotation: -0.08 });
    k.objeto('cavalo', [9.2, 26.4], { params: { pelagem: 0 }, rotation: 0.04 });
    k.objeto('cavalo', [9.2, 27.8], { params: { pelagem: 3 }, rotation: -0.05 });
    k.objeto('fardo-de-feno', [10.8, 30.2], { rotation: Math.PI / 2 });
    k.objeto('fardo-de-feno', [10.8, 31.4], { rotation: Math.PI / 2 + 0.08 });

    // Deque de carga: carrinho de carga, pilhas de caixotes e barris
    k.objeto('carrinho-de-carga', [27.8, 14.2], { params: { carga: 1 }, rotation: -0.12, scale: 1.25 });
    k.objeto('pilha-de-caixotes', [27.8, 17.8], { rotation: 0.05, scale: 1.15 });
    k.objeto('pilha-de-caixotes', [31.5, 10.4], { rotation: -0.05, scale: 1.15 });
    k.objeto('pilha-de-caixotes', [14.8, 18.2], { rotation: 0.1, scale: 1.1 });
    k.objeto('pilha-de-barris', [33.8, 13.8], { rotation: 0.4 });
    k.objeto('pilha-de-caixotes', [46.5, 11.4], { rotation: 0.1, scale: 0.95 });

    // Interior do Alojamento, Depósito, Corredor e Escritório
    k.objeto('cama.casal', [19.8, 22.5], { rotation: Math.PI });
    k.objeto('caixote', [16.2, 22.5], { rotation: 0.2 });
    k.objeto('sacos', [15.2, 24.2], { rotation: -0.3 });
    k.objeto('pilha-de-caixotes', [15.0, 27.5], { rotation: 0.15 });
    k.objeto('pilha-de-caixotes', [16.5, 29.8], { rotation: -0.2 });
    k.objeto('pia.pedestal', [15.2, 32.1], { rotation: 0 });
    k.objeto('mesa.retangular', [20.2, 26.8], { params: { largura: 1.6, profundidade: 0.8 }, rotation: 0 });
    k.objeto('mesa.retangular', [20.2, 30.2], { params: { largura: 1.6, profundidade: 0.8 }, rotation: 0 });
    k.objeto('tapete.persa', [17.2, 34.4], { rotation: 0.4 });
    k.objeto('escrivaninha.verde', [15.5, 34.5], { rotation: 0.35 });
    k.objeto('poltrona', [18.8, 34.5], { rotation: -2.4 });

    // Interior do Galpão de Mercadorias: fileiras de caixotes, barris e sacas com corredores entre elas.
    k.objeto('carrinho-de-mao', [27.0, 21.4], { rotation: 1.35, scale: 1.1 });
    const PILHAS = ['pilha-de-caixotes', 'pilha-de-caixotes', 'caixote', 'pilha-de-barris', 'sacos', 'caixote', 'barril'] as const;
    let n = 0;
    for (const x of [24.2, 26.4, 29.6, 31.8, 33.6]) for (let y = 23.2; y <= 34.6; y += 1.9) {
      if ((x === 29.6 && y > 30) || (x === 26.4 && y < 25)) continue;
      const item = PILHAS[(n * 5 + Math.round(y * 3)) % PILHAS.length]!;
      k.objeto(item, [x + ((n * 0.37) % 0.4) - 0.2, y], { rotation: ((n * 1.3) % 0.6) - 0.3, scale: item === 'barril' ? 1 : 0.9 });
      n++;
    }
    for (const [item, pos, rot] of [
      ['sacos', [23.4, 20.8], 0.2], ['caixote', [33.6, 20.6], 0.1], ['barril', [34, 21.8], 0], ['pilha-de-caixotes', [16.6, 26.8], 0.1], ['caixote', [14.6, 29.4], 0.4],
      ['sacos', [14.4, 30.8], -0.2], ['pilha-de-barris', [21.2, 33.8], 0.6], ['caixote', [19.6, 21.6], 0.3], ['pilha-de-caixotes', [14.6, 21.4], -0.1], ['barril', [16.4, 31.8], 0],
    ] as const) k.objeto(item, [pos[0], pos[1]], { rotation: rot });

    // Caixotes e barris pelo deque e encostados no armazém por fora.
    for (const [item, pos, rot] of [
      ['pilha-de-caixotes', [17.4, 18.4], 0.1], ['pilha-de-caixotes', [19.4, 18.2], -0.1], ['caixote', [21, 18.6], 0.3], ['pilha-de-caixotes', [30.4, 16.4], 0.05],
      ['pilha-de-caixotes', [32.4, 16.6], -0.05], ['pilha-de-barris', [31.4, 13.2], 0.4], ['barril', [33.8, 12.2], 0], ['barril', [34.4, 13.2], 0], ['caixote', [26, 10.4], 0.2], ['sacos', [28.8, 10.6], 0.5],
    ] as const) k.objeto(item, [pos[0], pos[1]], { rotation: rot });

    // Margem do rio: rochedo, vitórias-régias, juncos e tronco caído
    k.objeto('rochedo', [28.8, 8.2], { params: { tamanho: 3.4, cobertura: 1 }, rotation: 0.25 });
    k.objeto('tronco.caido', [40.8, 33.8], { rotation: 0.72, scale: 1.2 });
    for (const [pos, flor] of [
      [[32.8, 6.2], 1], [[35.5, 6.8], 1], [[36.8, 4.8], 0],
      [[34.2, 2.5], 0], [[38.0, 2.2], 0], [[38.8, 30.2], 1],
      [[42.8, 32.8], 1], [[40.2, 28.8], 0], [[43.5, 34.8], 0],
    ] as const) {
      k.objeto('vitoria-regia', [pos[0], pos[1]], {
        params: { flor },
        blocks: { move: false, sight: false },
        castsShadow: false,
      });
    }
    for (const pos of [
      [31.8, 3.2], [35.2, 3.8], [32.5, 8.2],
      [37.2, 26.5], [38.5, 32.5], [44.2, 35.0],
    ] as const) {
      k.objeto('junco', [pos[0], pos[1]]);
    }

    // Mata ao norte e a oeste
    for (const [item, pos, esc] of [
      ['casa:carvalho-grande-7m', [18.5, 4.2], 1.0],
      ['casa:carvalho-grande-6m', [23.8, 3.2], 1.0],
      ['casa:arvore-5m', [25.5, 6.5], 0.95],
      ['casa:arvore-5m', [20.2, 6.8], 0.9],
      ['casa:arvore-5m', [1.8, 2.2], 0.95],
      ['casa:arvore-5m', [1.5, 7.5], 0.95],
      ['casa:arvore-7m', [3.2, 33.2], 1.0],
      ['casa:arvore-5m', [7.2, 34.5], 0.9],
      ['casa:carvalho-grande-6m', [28.4, 3.4], 0.9],
      ['casa:arvore-5m', [15.6, 2.4], 1.0],
      ['casa:arvore-3m', [30.4, 7.2], 1.0],
      ['casa:arbusto-grande', [14.5, 5.2], 1.0],
      ['casa:arbusto-verde', [22.8, 9.2], 1.0],
      ['casa:arbusto-verde', [25.2, 9.2], 1.0],
    ] as const) {
      k.objeto(item, [pos[0], pos[1]], { scale: esc });
    }

    // Luzes: lanterna esverdeada na ponta do píer, arandela quente no deque e lamparinas internas
    k.luz('tocha', [50.2, 10.4], {
      radius: 9.5,
      color: '#d8f088',
      intensity: 1.25,
      flicker: 0.18,
    });
    k.luz('tocha', [22.8, 9.8], {
      radius: 7.5,
      color: '#ffaa55',
      intensity: 1.1,
      flicker: 0.25,
    });
    k.luz('lamparina', [28.2, 26.5], { radius: 6, color: '#ffb36b', intensity: 0.85 });
    k.luz('vela', [16.2, 34.2], { radius: 4.5, color: '#ffcf8a', intensity: 0.8 });

    // Clima e acabamento: tarde ensolarada com halo nas lanternas
    k.clima('tarde', {
      time: '15:30',
      ambient: { color: '#fffdf8', intensity: 1.0 },
      sun: { angle: 0.58, color: '#fff2d6', intensity: 1.05 },
      tempo: { wind: 0.2, dust: 0.1, fog: 0 },
    });
    k.acabamento('quente', {
      tint: '#fffaf0',
      saturation: 1.08,
      vignette: 0.14,
      glow: 0.75,
    });

    // Climas salvos do mapa
    k.guardarClima('tarde-mercante', 'Tarde de embarque');
    k.guardarClima('noite-no-pier', 'Calada da noite', 'noite', {
      time: '23:00',
      ambient: { color: '#243448', intensity: 0.34 },
      sun: { angle: 0.7, color: '#8fb4e8', intensity: 0.4 },
      tempo: { fog: 0.35, wind: 0.15 },
      finish: { tint: '#cde0ff', saturation: 0.9, vignette: 0.5, edges: { kind: 'fog', amount: 0.45 }, glow: 0.85 },
    });
    k.guardarClima('neblina-do-rio', 'Neblina da alvorada', 'neblina', {
      time: '06:30',
      tempo: { fog: 0.85, wind: 0.1 },
      finish: { tint: '#dce6ec', saturation: 0.65, vignette: 0.4, edges: { kind: 'fog', amount: 0.6 }, glow: 0.7 },
    });

    // Notas de cômodo e regiões
    k.notaDeComodo(quartoId, {
      leitura: 'Um quarto abafado com cheiro de fumo e couro molhado; sobre o baú há chaves reservas do cais.',
      notasMestre: 'O capataz guarda aqui o manifesto verdadeiro da barcaça.',
    });
    k.notaDeComodo(despensaId, {
      leitura: 'Caixotes lacrados com cera vermelha empilhados até o teto.',
      notasMestre: 'Trancado; contém as encomendas que não constam no livro do feitor.',
    });
    k.notaDeComodo(escritorioId, {
      leitura: 'Uma escrivaninha forrada de feltro verde, livros-razão abertos e uma balança de latão.',
      notasMestre: 'O livro de registros tem duas páginas arrancadas da última semana.',
    });
    k.notaDeComodo(galpaoId, {
      leitura: 'Corredores estreitos entre pilhas altas de caixotes, barris de salmoura e sacas de grãos.',
      notasMestre: 'Ótimo terreno para furtividade e cobertura.',
    });

    k.regiao([[22.5, 19.5], [34.5, 19.5], [34.5, 36.0], [22.5, 36.0]], 'reveal', {
      nome: 'Galpão de mercadorias',
    });
    k.regiao([[36.0, 13.0], [50.5, 13.0], [50.5, 19.5], [36.0, 19.5]], 'trigger', {
      nome: 'Embarque na barcaça',
      texto: 'As amarras da barcaça já estão frouxas e o cavalo a bordo bate o casco nas tábuas ocas.',
    });
    k.regiao([[31.0, 0], [58.0, 0], [58.0, 36.0], [31.0, 36.0]], 'audio', {
      nome: 'Marolas do rio',
      cenaJukebox: 'rio-calmo',
    });

    k.notas(
      'Entreposto do rio — A última carroça do dia acabou de encostar, mas a barcaça no píer prepara-se para partir antes da inspeção do feitor.',
    );
  },
};
