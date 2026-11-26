import type { Exemplo } from './kit.ts';

/**
 * Templo na encosta (42 × 30 m), o exemplo do Oriente (Q16d): um santuário na manhã de neblina, subindo a encosta ao norte.
 * De baixo para cima: o torii na entrada (sul), o caminho de lajes entre lanternas de pedra, o lago de carpas com a ilha e a ponte
 * a oeste, a casa de chá no jardim cercado de bambu a leste, a escada no muro de arrimo, e no terraço de cima o pátio com os
 * guardiões, o incensário, o salão do santuário, o sino e o jardim seco, encostados no paredão de pedra.
 * Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const temploNaEncosta: Exemplo = {
  id: 'templo-na-encosta',
  nome: 'Templo na encosta',
  descricao: 'Santuário na encosta, numa manhã de neblina: torii na entrada, caminho de lanternas de pedra, lago de carpas com ilha e ponte vermelha, casa de chá no jardim de bambu e, no terraço de cima, o salão com o Buda, o incensário, o sino e o jardim seco.',
  largura: 42,
  altura: 30,
  semente: 1641,
  construir(k) {
    k.estilo({ genre: 'oriental', palette: 'fantasia' });
    k.fundo({ kind: 'solid', color: '#26302a' });
    k.base('grama');

    // ---------- Terreno ----------
    // O paredão da encosta ao norte e as pedras que descem pelos lados.
    k.pintar('rocha.cinza', { poligono: [[-1, -1], [43, -1], [43, 4.5], [38.5, 5], [35, 3.4], [30, 2.6], [25, 2.2], [18, 2.4], [13, 3], [8.5, 4.6], [4, 6.4], [-1, 7.4]], irregular: 0.5 });
    k.pintar('rocha.cinza', { poligono: [[-1, 7], [2.4, 6.6], [3.2, 9.6], [1.8, 13], [-1, 14]], irregular: 0.5 });
    k.pintar('musgo', { poligono: [[3, 6.8], [8.6, 5.2], [10, 8], [6, 9.6], [3.4, 9.4]], irregular: 0.6 });
    k.pintar('musgo', { poligono: [[33.6, 4.2], [38.4, 5.6], [37.6, 8], [34, 7.4]], irregular: 0.6 });

    // O terraço de cima: o pátio de cascalho diante do salão.
    k.pintar('cascalho', { poligono: [[10.5, 9.8], [31.5, 9.8], [32, 15.2], [10, 15.2]], irregular: 0.15 });
    k.pintar('lajes.antigas', { faixa: [[21, 10.4], [21, 15.4]], largura: 2.4 });

    // O terraço de baixo: o caminho de lajes do torii até a escada, e o atalho até a ponte do lago.
    k.pintar('lajes.antigas', { faixa: [[21, 31], [21, 17.2]], largura: 2.2, irregular: 0.1 });
    k.pintar('cascalho', { faixa: [[19.8, 24], [17.2, 24.2], [15.6, 24]], largura: 1.4, irregular: 0.2 });
    k.pintar('terra', { faixa: [[22.2, 23], [26, 23.2], [29, 23]], largura: 1.2, irregular: 0.3 });

    // O lago de carpas, com a ilha da lanterna.
    // A margem de pedregulho e, por cima, a água.
    k.pintar('pedregulho', { poligono: [[1.4, 17.8], [7, 16.8], [12.4, 17.4], [16.4, 19.6], [17, 23.6], [15.8, 27.6], [11.2, 29.4], [5.4, 29.6], [1.2, 27.4], [0.4, 22.2]], irregular: 0.35 });
    k.pintar('agua.jardim', { poligono: [[2.2, 18.6], [7, 17.6], [12, 18.2], [15.6, 20.2], [16.2, 23.6], [15, 27], [11, 28.6], [5.6, 28.8], [2, 26.6], [1.2, 22.4]], irregular: 0.35 });
    k.pintar('pedregulho', { disco: [6.4, 23.8], raio: 2.3, irregular: 0.3 });
    k.pintar('grama', { disco: [6.4, 23.8], raio: 1.7, irregular: 0.3 });
    k.pintar('musgo', { disco: [6.2, 23.6], raio: 1.0, irregular: 0.4 });

    // O jardim da casa de chá: musgo e o caminho de pedras.
    k.pintar('musgo', { poligono: [[30, 18.2], [41.6, 18.2], [41.6, 29.6], [30, 29.6]], irregular: 0.2 });
    k.pintar('cascalho', { faixa: [[29.4, 23], [31.4, 24.6], [34.5, 26]], largura: 1, irregular: 0.2 });

    // ---------- O salão do santuário e a casa de chá ----------
    const salao = k.comodo([11, 3, 17, 7], 'santuario', { nome: 'Salão do santuário', piso: 'tabuas.laqueadas', papel: 'madeira.laqueada', telhadoVisivel: false });
    const casaDeCha = k.comodo([22, 13, 26, 17], 'casa-de-cha', { nome: 'Casa de chá', piso: 'tatami', papel: 'shoji', telhadoVisivel: false });
    k.porta([21, 10.5], 'door', { width: 2.4, state: 'open', material: 'madeira.escura' });
    k.porta([33, 23.25], 'door', { width: 1.2, state: 'open' });
    k.porta([39, 21.75], 'window', { width: 1.2 });

    // ---------- Salão: o Buda no fundo, o incensário diante dele, lanternas, almofadas e as oferendas ----------
    k.objeto('estatua-sentada', [21, 6.6], { rotation: 0, scale: 0.9 });
    k.objeto('incensario', [21, 8.7], { rotation: 0, scale: 0.6 });
    for (const [x, y] of [[17.6, 5.4], [24.4, 5.4]] as const) k.objeto('andon', [x, y], { rotation: 0 });
    for (const [x, y] of [[17.4, 9.6], [24.6, 9.6]] as const) k.objeto('lanterna-de-papel', [x, y], { rotation: 0, params: { cor: 1 } });
    for (const x of [19.2, 20.4, 21.6, 22.8]) k.objeto('zabuton', [x, 9.7], { rotation: 0, scale: 0.85 });
    k.objeto('ikebana', [17.6, 7.6], { rotation: 0.4, scale: 0.8 });
    k.objeto('ikebana', [24.4, 7.6], { rotation: -0.4, scale: 0.8 });
    k.objeto('pergaminho-de-parede', [17.2, 7.6], { params: {} });
    k.objeto('pergaminho-de-parede', [24.8, 7.6], { params: {} });

    // ---------- Terraço de cima: guardiões, incensário do pátio, o sino, o jardim seco ----------
    k.objeto('guardiao-de-pedra', [21, 13.6], { rotation: 0, params: { distancia: 4.6 } });
    k.objeto('incensario', [21, 12.2], { rotation: 0, scale: 0.85 });
    k.objeto('sino-de-templo', [13, 11.8], { rotation: 0 });
    k.objeto('lanterna-de-pedra', [16.4, 13.8], { rotation: 0.3, scale: 0.9, params: { acesa: 1 } });
    k.objeto('lanterna-de-pedra', [25.6, 13.8], { rotation: -0.2, scale: 0.9, params: { acesa: 1 } });
    k.objeto('rastelado', [29.2, 12.4], { rotation: 0, params: { comprimento: 4.6, largura: 4, circulo: 1 } });
    k.objeto('rochedo', [29.2, 12.4], { rotation: 0.8, scale: 0.42, params: { tamanho: 2, cobertura: 1 } });
    k.objeto('pedra.grande', [30.6, 11.1], { rotation: 1.4, scale: 0.6 });
    k.objeto('bonsai', [27, 10.4], { rotation: 0 });

    // O muro de arrimo entre os terraços, com a escada no meio.
    for (const [x, l] of [[13.2, 6.4], [28.8, 6.4]] as const) k.objeto('mureta-de-pedra', [x, 15.6], { rotation: 0, params: { largura: l, falha: 0 } });
    k.objeto('mureta-de-pedra', [8.6, 15.4], { rotation: -0.12, params: { largura: 3, falha: 1 } });
    k.objeto('mureta-de-pedra', [33.4, 15.4], { rotation: 0.1, params: { largura: 3, falha: 1 } });
    k.objeto('escada.pedra', [21, 16.6], { rotation: 0, params: { largura: 2.4, comprimento: 2.4 } });

    // ---------- Terraço de baixo: o torii, o caminho de lanternas ----------
    k.objeto('torii', [21, 27.4], { rotation: 0 });
    for (const y of [20.4, 23.8]) for (const x of [19.1, 22.9]) k.objeto('lanterna-de-pedra', [x, y], { rotation: (x + y) * 0.7, scale: 0.75, params: { acesa: 1 } });
    k.objeto('bacia-de-pedra', [24.8, 18.6], { rotation: 0.2, scale: 0.85 });
    // As lanternas vermelhas do festival, penduradas ao longo do caminho e diante do torii.
    for (const [x, y] of [[19.2, 18.6], [22.8, 18.6], [18.8, 22.1], [23.2, 22.1], [19.2, 26.0], [22.8, 26.0]] as const) k.objeto('lanterna-de-papel', [x, y], { rotation: 0, scale: 0.9, params: { cor: 1 } });

    // ---------- O lago: carpas, a ilha com a lanterna, a ponte vermelha ----------
    k.objeto('carpas', [9.6, 21.2], { rotation: 0 });
    k.objeto('carpas', [9.2, 26.6], { rotation: 1.2, scale: 0.9 });
    k.objeto('carpas', [3.6, 21.2], { rotation: 2.4, scale: 0.7 });
    k.objeto('ponte-arqueada', [11.8, 23.9], { rotation: 0, params: { vao: 5.4 } });
    k.objeto('lanterna-de-pedra', [5.8, 23.2], { rotation: 0.5, scale: 0.7, params: { acesa: 1 } });
    k.objeto('casa:cerejeira-4m', [6.6, 24.8], { rotation: 1.1, scale: 0.7 });
    for (const [x, y] of [[2.6, 19.6], [14.6, 19.4], [2.2, 27.4], [13.8, 27.8], [16.2, 21.6]] as const) k.objeto('pedra.media', [x, y], { rotation: x * y, scale: 0.9 });
    for (const [x, y] of [[4.4, 18.6], [11.4, 18.4], [3.2, 25.4]] as const) k.objeto('tufo-de-capim', [x, y], { scale: 1 });

    // ---------- A casa de chá e o jardim de bambu ----------
    k.objeto('irori', [36, 22.5], { rotation: 0 });
    for (const [x, y, r] of [[34.4, 22.5, Math.PI / 2], [37.6, 22.5, -Math.PI / 2], [36, 24.1, 0]] as const) k.objeto('zabuton', [x, y], { rotation: r });
    k.objeto('bule-e-xicaras.oriental', [34.6, 20.8], { rotation: 0 });
    k.objeto('tansu', [38.7, 20.6], { rotation: Math.PI / 2, scale: 0.8 });
    k.objeto('ikebana', [33.6, 20.3], { rotation: 0, scale: 0.8 });
    k.objeto('pergaminho-de-parede', [36, 19.6], { params: {} });
    k.objeto('andon', [38.6, 24.6], { rotation: 0 });
    k.objeto('muro-de-bambu', [29.6, 21.2], { rotation: Math.PI / 2, params: { comprimento: 5.4 } });
    k.objeto('muro-de-bambu', [29.6, 27.6], { rotation: Math.PI / 2, params: { comprimento: 3.6 } });
    k.objeto('portao-de-madeira', [29.6, 24.9], { rotation: Math.PI / 2, scale: 0.6 });
    k.objeto('bacia-de-pedra', [32, 27.6], { rotation: -0.4, scale: 0.85 });
    k.objeto('lanterna-de-pedra', [31.2, 19.4], { rotation: 0.2, scale: 0.7, params: { acesa: 1 } });
    k.objeto('bonsai', [40.6, 27.8], { rotation: 0 });
    for (const [x, y] of [[33.2, 28.8], [39, 28.6], [41, 19.4]] as const) k.objeto('pedra.media', [x, y], { rotation: x, scale: 0.8 });
    k.espalhar('bosque-de-bambu', { poligono: [[34.6, 5.2], [42.5, 4.6], [42.5, 18], [36.4, 17.6], [35, 12]] }, { densidade: 0.22 });

    // ---------- Árvores: cerejeiras em flor em volta do lago e dos terraços, pinheiros no alto do paredão ----------
    for (const [item, x, y, s] of [
      ['casa:cerejeira-6m', 2.6, 15.8, 1], ['casa:cerejeira-5m-rala', 15.8, 17.6, 0.9], ['casa:cerejeira-4m', 1.4, 29, 1], ['casa:cerejeira-6m', 16.8, 29.2, 0.95],
      ['casa:cerejeira-4m', 9.8, 12.4, 0.8], ['casa:cerejeira-5m-rala', 33.2, 9.4, 0.85], ['casa:cerejeira-4m', 26.4, 29, 0.9], ['casa:cerejeira-6m', 7, 9.6, 0.8],
    ] as const) k.objeto(item, [x, y], { rotation: x + y, scale: s });
    for (const [x, y, s] of [[4.6, 2.2, 1], [10.6, 0.8, 0.9], [36.4, 1.4, 1.1], [41, 2.8, 0.9], [27.6, 0.6, 0.8]] as const) k.objeto('casa:pinheiro-4m', [x, y], { scale: s });
    for (const [x, y] of [[4, 17], [16.6, 25.6], [19.2, 29.2], [25.2, 26.4], [11.4, 14.2], [30.6, 17.2], [24.6, 21.4]] as const) k.objeto('petalas-de-cerejeira', [x, y], { rotation: x * 1.3 });
    for (const [x, y, s] of [[26.8, 19.6, 0.9], [18, 18.4, 0.8], [33.4, 14.4, 0.8], [9.6, 16.8, 0.9]] as const) k.objeto('casa:arbusto-verde', [x, y], { scale: s });
    for (const [x, y, t] of [[3.4, 8.6, 2], [33.6, 6.2, 1.6], [2.4, 12.6, 1.8]] as const) k.objeto('rochedo', [x, y], { rotation: x, params: { tamanho: t, cobertura: 1 } });

    // Luz: a manhã cedo, com neblina baixa; à noite, as lanternas de pedra e de papel acendem o caminho.
    k.clima('neblina', { time: '06:50', ambient: { color: '#d8e2e4', intensity: 0.92 }, sun: { angle: 2.5, color: '#ffe8cc', intensity: 0.7 }, tempo: { fog: 0.32, wind: 0.08 } });
    k.acabamento(null, { tint: '#eef2ee', saturation: 0.9, vignette: 0.25, glow: 0.45, edges: { kind: 'fog', amount: 0.22 } });
    k.guardarClima('festival', 'Noite das lanternas', 'noite', { time: '21:00', ambient: { color: '#7a8cb0', intensity: 0.42 }, sun: { angle: 2.3, color: '#b8c8e8', intensity: 0.45 }, tempo: { fog: 0.12, wind: 0.05 } });

    k.notaDeComodo(salao, { leitura: 'O Buda de bronze, verde de pátina, olha para a porta aberta. O incenso da manhã ainda sobe em fios; as lanternas vermelhas balançam sem vento.', notasMestre: 'Sob o estrado do Buda, um alçapão leva a uma gruta escavada no paredão, onde o monge guarda os pergaminhos do templo.' });
    k.notaDeComodo(casaDeCha, { leitura: 'Tatami, um pergaminho de caligrafia e o irori aceso; a chaleira de ferro chia baixinho.' });
    k.notas('Templo na encosta — um santuário de montanha. Entra-se pelo torii ao sul; o caminho de lanternas sobe pela escada do muro até o pátio e o salão, encostado no paredão. A oeste, o lago de carpas e a ilha; a leste, a casa de chá e o bambuzal.');
  },
};
