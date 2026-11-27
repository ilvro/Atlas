import type { Exemplo } from './kit.ts';

/**
 * Oásis da caravana (45 × 33 m), o exemplo do deserto (Q17d): uma caravana acampada num oásis, ao entardecer.
 * Ao norte e a leste, as dunas; no meio, a lagoa com as tamareiras e o poço, onde os camelos bebem; ao sul da lagoa, o canto dos
 * mercadores (toldo, especiarias, tapetes); a leste, o acampamento: duas tendas beduínas (a de baixo sem o teto, para a cena lá dentro)
 * em volta da fogueira, os camelos deitados e o palanquim; a oeste, o depósito de adobe; a trilha chega pelo sudoeste, passando pela
 * ossada de camelo nas dunas. Grade de 1,5 m: o cômodo vai em células, o resto em metros.
 */
export const oasisDaCaravana: Exemplo = {
  id: 'oasis-da-caravana',
  nome: 'Oásis da caravana',
  descricao: 'Uma caravana acampada num oásis ao entardecer: a lagoa com tamareiras e o poço onde os camelos bebem, o canto dos mercadores com especiarias e tapetes, duas tendas beduínas em volta da fogueira, o depósito de adobe e as dunas em volta.',
  largura: 45,
  altura: 33,
  semente: 1717,
  construir(k) {
    k.estilo({ genre: 'deserto', palette: 'fantasia' });
    k.fundo({ kind: 'solid', color: '#3a2c1c' });
    k.base('areia');

    // ---------- Terreno ----------
    // As dunas: o mar de areia ao norte e a leste, e um braço no sudoeste, por onde vem a trilha.
    k.pintar('areia.duna', { poligono: [[-1, -1], [46, -1], [46, 30], [42.5, 28.5], [41.5, 22], [43, 15], [40, 7.6], [33, 5.4], [24, 5.6], [18, 7.2], [11, 6.2], [4, 7.8], [-1, 9]], irregular: 0.45 });
    k.pintar('areia.duna', { poligono: [[-1, 26], [5, 26.6], [10, 29.4], [13, 34], [-1, 34]], irregular: 0.45 });
    k.pintar('areia.duna', { poligono: [[27, 34], [29, 30.6], [35, 29.6], [41, 29.8], [46, 28.6], [46, 34]], irregular: 0.45 });
    // O chão de pedra do noroeste, rachado pelo sol.
    k.pintar('terra.rachada', { poligono: [[0.5, 6.4], [5, 5], [9.4, 6.6], [8.6, 10.2], [4, 11.4], [0.5, 10.6]], irregular: 0.5 });

    // A trilha da caravana, de chão batido, do sudoeste até o acampamento, e o atalho até o poço.
    k.pintar('chao.batido', { faixa: [[-1, 30.5], [6, 28.4], [12, 25.6], [19.6, 24.4], [25.4, 21.8], [30.2, 19.6]], largura: 2.6, irregular: 0.35 });
    k.pintar('chao.batido', { faixa: [[21, 23.6], [23, 18.6], [24.6, 15.2]], largura: 1.8, irregular: 0.35 });

    // O oásis: grama seca e grama em volta, a areia molhada da margem e a lagoa.
    k.pintar('grama.seca', { poligono: [[6.4, 9.6], [14, 8.2], [22.4, 9.4], [26, 13], [24.6, 19.4], [18, 22], [10.6, 21.6], [6, 18.4], [5.2, 13.4]], irregular: 0.5 });
    k.pintar('grama', { poligono: [[8.6, 10.6], [15, 9.6], [21, 10.8], [22.6, 14.4], [20.4, 18.8], [13.6, 20.2], [9, 18.2], [7.8, 14]], irregular: 0.45 });
    k.pintar('areia.molhada', { poligono: [[10, 11.6], [15.4, 10.6], [20, 11.8], [21.2, 15], [19.6, 18.2], [14.6, 19], [10.6, 17.6], [9.4, 14.4]], irregular: 0.35 });
    k.pintar('agua.jardim', { poligono: [[10.8, 12.4], [15.4, 11.4], [19.2, 12.6], [20.2, 15], [18.8, 17.4], [14.6, 18.1], [11.2, 16.9], [10.2, 14.4]], irregular: 0.35 });

    // ---------- O depósito de adobe ----------
    const deposito = k.comodo([1, 13, 5, 17], 'deposito', { nome: 'Depósito de adobe', piso: 'terracota.quadrada', papel: 'adobe', telhado: 'terraco-de-barro', telhadoVisivel: false });
    k.porta([7.5, 22.5], 'door', { width: 1.2, state: 'open', material: 'madeira.escura' });
    k.porta([4.5, 19.5], 'window', { width: 0.9 });
    k.objeto('cantaros-empilhados', [3.2, 21.6], { rotation: 0 });
    k.objeto('cantaros-empilhados', [3.0, 24.3], { rotation: Math.PI, scale: 0.9 });
    k.objeto('bau-pintado', [5.6, 20.3], { rotation: 0 });
    for (const [x, y] of [[6.6, 24.5], [5.8, 24.8]] as const) k.objeto('cesto', [x, y], { rotation: x });
    k.objeto('jarro-de-barro', [2.2, 20.4], { rotation: 0 });
    k.objeto('tapete-de-chao', [4.6, 22.6], { rotation: Math.PI / 2, params: { cor: 2, comprimento: 2.4, largura: 1.2 } });
    k.objeto('lanterna-marroquina', [6.5, 21.2], { rotation: 0, params: { pendurada: 0 } });

    // ---------- O oásis: tamareiras, juncos e o poço ----------
    for (const [item, x, y, s] of [
      ['casa:tamareira-5m', 9.0, 11.0, 1], ['casa:tamareira-5m', 12.6, 9.6, 1.1], ['casa:coqueiro-6m', 17.4, 9.8, 1], ['casa:tamareira-5m', 21.6, 11.2, 0.95],
      ['casa:tamareira-5m', 8.2, 16.4, 1.05], ['casa:coqueiro-4m', 10.6, 19.6, 1], ['casa:tamareira-5m', 15.6, 20.6, 0.9], ['casa:tamareira-5m', 22.2, 17.8, 1.0],
      ['casa:tamareira-5m', 6.6, 13.2, 0.9], ['casa:coqueiro-4m', 19.8, 8.4, 0.85],
    ] as const) k.objeto(item, [x, y], { rotation: x * 1.7 + y, scale: s });
    for (const [x, y] of [[10.6, 12.0], [12.6, 17.6], [19.4, 12.4], [20.4, 16.4], [16.6, 18.4], [10.0, 15.8]] as const) k.objeto('junco', [x, y], { rotation: (x * y) % 6.28 });
    for (const [x, y, s] of [[7.4, 18.6, 0.9], [23.8, 10.4, 0.8], [13.8, 21.4, 0.8]] as const) k.objeto('casa:arbusto-verde', [x, y], { scale: s });
    k.objeto('poco.oasis', [24.6, 12.8], { rotation: 0 });
    k.objeto('jarro-de-barro', [26.4, 15.2], { rotation: 0.4 });
    // Dois camelos bebendo no bebedouro e o cameleiro (só a carga dele, encostada).
    k.objeto('camelo', [23.4, 15.6], { rotation: -Math.PI / 2 - 0.25 });
    k.objeto('camelo', [26.0, 16.4], { rotation: -Math.PI / 2 + 0.35, params: { carga: 1 } });

    // ---------- O canto dos mercadores, ao sul da lagoa ----------
    k.objeto('toldo-listrado', [19.6, 21.4], { rotation: 0, params: { comprimento: 4, largura: 2.75 } });
    k.objeto('banca-de-especiarias', [15.0, 23.4], { rotation: 0 });
    k.objeto('tapetes-pendurados', [11.0, 22.8], { rotation: 0 });
    k.objeto('cesto', [17.2, 24.6], { rotation: 1 });
    k.objeto('cantaros-empilhados', [22.6, 24.0], { rotation: 0.6, scale: 0.85 });
    k.objeto('almofadas', [19.6, 23.6], { rotation: Math.PI });
    k.objeto('lanterna-marroquina', [21.8, 22.6], { rotation: 0, params: { pendurada: 1 } });

    // ---------- O acampamento ----------
    // A tenda grande, fechada, de frente para a fogueira; a de baixo, sem o teto, com a vida dentro.
    k.objeto('tenda-beduina', [32.2, 10.2], { rotation: 0, params: { largura: 7 } });
    k.objeto('tenda-beduina', [38.2, 22.4], { rotation: Math.PI / 2, params: { largura: 6, teto: 0 } });
    k.objeto('mesa-de-latao', [38.6, 22.2], { rotation: 0 });
    k.objeto('narguile', [37.4, 20.6], { rotation: 0 });
    k.objeto('bau-pintado', [40.4, 25.0], { rotation: -Math.PI / 2 });
    k.objeto('lanterna-marroquina', [37.2, 23.8], { rotation: 0, params: { pendurada: 0 } });
    k.objeto('tear-de-chao', [25.6, 7.6], { rotation: Math.PI / 2 });
    for (const [x, y] of [[28.8, 13.8], [35.6, 13.8]] as const) k.objeto('lanterna-marroquina', [x, y], { rotation: 0, params: { pendurada: 0 } });
    k.objeto('cantaros-empilhados', [36.8, 14.6], { rotation: -0.3 });
    k.objeto('cesto', [27.6, 12.0], { rotation: 0.5 });

    // A fogueira, com as almofadas e o chá em volta.
    k.objeto('fogueira-de-caravana', [31.2, 17.6], { rotation: 0 });
    k.objeto('almofadas', [31.2, 15.2], { rotation: 0 });
    k.objeto('almofadas', [28.6, 17.8], { rotation: Math.PI / 2 });
    k.objeto('mesa-de-latao', [33.4, 15.6], { rotation: 0 });
    k.objeto('tapete-de-chao', [31.2, 20.2], { rotation: 0, params: { cor: 1, comprimento: 3, largura: 1.6 } });

    // Os camelos deitados para a noite, o que acabou de chegar pela trilha, e o palanquim.
    k.objeto('camelo', [27.4, 23.6], { rotation: 0.4, params: { pose: 1, carga: 1 } });
    k.objeto('camelo', [30.4, 25.4], { rotation: -0.2, params: { pose: 1 } });
    k.objeto('camelo', [33.8, 27.2], { rotation: 2.8, params: { pose: 1, carga: 1 } });
    k.objeto('camelo', [24.2, 27.2], { rotation: 0.35, params: { carga: 1 } });
    k.objeto('palanquim', [41.4, 14.6], { rotation: Math.PI / 2 - 0.15 });

    // ---------- O deserto em volta ----------
    k.objeto('ossada-de-camelo', [7.6, 29.4], { rotation: 0.5 });
    for (const [item, x, y, s] of [
      ['casa:arbusto-seco-1m', 10.8, 27.2, 1], ['casa:arbusto-seco-2m', 3.4, 27.6, 1], ['casa:arbusto-seco-1m', 27.6, 30.4, 1], ['casa:arbusto-seco-2m', 41.2, 30.8, 0.9],
      ['casa:arbusto-seco-1m', 36.4, 6.2, 1], ['casa:arbusto-seco-1m', 15.8, 5.6, 0.9], ['casa:cacto-redondo-grupo', 42.8, 18.4, 0.9], ['casa:opuntia-a', 1.6, 12.6, 0.8],
    ] as const) k.objeto(item, [x, y], { rotation: x + y, scale: s });
    for (const [x, y, t] of [[3.2, 7.4, 2.4], [7.2, 5.6, 1.8], [1.6, 9.8, 1.4]] as const) k.objeto('rochedo', [x, y], { rotation: x * 2, params: { tamanho: t, cobertura: 0 } });
    for (const [item, x, y] of [['casa:arbusto-seco-1m', 18.4, 28.6], ['casa:arbusto-seco-2m', 22.8, 30.2], ['pedra.grande', 16.2, 30.8], ['casa:arbusto-seco-1m', 36.2, 31.0]] as const) k.objeto(item, [x, y], { rotation: x, scale: 0.9 });
    for (const [x, y] of [[5.4, 9.4], [9.0, 8.0], [20.6, 31.2], [44, 25]] as const) k.objeto('pedra.media', [x, y], { rotation: (x * y) % 6.28, scale: 0.9 });

    // Luz: o entardecer, sol baixo e quente; à noite, a fogueira e as lanternas acendem o acampamento sob o luar.
    k.clima('entardecer', { time: '17:15', tempo: { wind: 0.15 } });
    k.acabamento(null, { tint: '#ffe2bc', saturation: 1.08, vignette: 0.3, glow: 0.4, edges: { kind: 'none', amount: 0 } });
    k.guardarClima('noite', 'Noite no oásis', 'noite', { time: '22:00', ambient: { color: '#7a88b4', intensity: 0.5 }, sun: { angle: 2.2, color: '#b8c4e8', intensity: 0.4 }, tempo: { wind: 0.05 } });

    k.notaDeComodo(deposito, { leitura: 'Cheiro de barro úmido e de tâmaras. Os cântaros guardam a água da lagoa; o baú pintado tem o cadeado aberto.', notasMestre: 'Sob o tapete, uma tampa de madeira esconde a cisterna seca onde o chefe da caravana guarda o sal.' });
    k.notas('Oásis da caravana — uma caravana acampada no único poço em três dias de deserto. A trilha chega pelo sudoeste; a lagoa e as tamareiras ficam no meio, com o poço a leste e os mercadores ao sul; o acampamento, com as tendas e a fogueira, fica a leste; o depósito de adobe, a oeste.');
  },
};
