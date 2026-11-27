import { caminho } from '../../src/authoring/caminho.ts';
import type { Exemplo } from './kit.ts';

/**
 * Enseada dos piratas (52 × 36 m), o exemplo do colonial e pirata (Q19d): uma enseada de água tropical à tarde. O navio pirata está
 * fundeado no meio da baía, com os canhões nas bordas, o timão e a bandeira na popa; na praia de coqueiros, o acampamento com as
 * cabanas de palha, a fogueira e o tesouro sendo contado, as canoas puxadas na areia e o cais de tábuas com o sino; a noroeste, a
 * taverna de tábuas; no promontório a nordeste, o fortim tomado, com a bateria de canhões virada para a baía e a forca no caminho.
 * Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const enseadaDosPiratas: Exemplo = {
  id: 'enseada-dos-piratas',
  nome: 'Enseada dos piratas',
  descricao: 'Uma enseada de água tropical à tarde: o navio pirata fundeado na baía, a praia de coqueiros com o acampamento, as cabanas de palha e o tesouro, o cais com o sino, a taverna e, no promontório, o fortim com a bateria de canhões.',
  largura: 52,
  altura: 36,
  semente: 1919,
  construir(k) {
    k.estilo({ genre: 'colonial', palette: 'fantasia' });
    k.fundo({ kind: 'solid', color: '#0e4a5a' });
    k.base('areia');

    // ---------- Terreno: a mata, a praia, a baía e o promontório ----------
    k.pintar('chao.de.selva', { poligono: [[-2, -2], [33, -2], [32.5, 2.5], [28, 3.5], [26.5, 8], [25.5, 13], [22, 17], [15, 18.6], [8, 19.4], [-2, 20]], irregular: 0.6 });
    k.pintar('chao.batido', { poligono: [[36, -2], [54, -2], [54, 11.5], [48, 11.8], [43, 9.8], [39.5, 6.8], [37, 3.6]], irregular: 0.35 });
    k.pintar('lajes.escuras', { retangulo: [42.6, 0.8, 50.4, 8.2], irregular: 0.05 });
    // A areia molhada na linha d'água e a baía de água tropical, aberta para o sudeste.
    const costa: [number, number][] = [[-2, 28], [2, 27.5], [9, 26.5], [17, 25.5], [24, 23], [29, 19], [31.5, 14], [31, 9], [33, 5.5], [37, 4.8], [39.5, 8.2], [43.5, 11.8], [48, 13.2], [54, 13]];
    k.pintar('areia.molhada', { faixa: costa, largura: 3.2, irregular: 0.5 });
    k.pintar('agua.tropical', { poligono: [...costa.map(([x, y]) => [x + 0.6, y + 0.8] as [number, number]), [54, 38], [-2, 38]], irregular: 0.45 });
    k.correnteza('agua.tropical', 2.4, 0.35);
    k.pintar('pedregulho', { faixa: [[39, 7.2], [43, 10.8], [48, 12.3], [54, 12.2]], largura: 1.6, irregular: 0.6 });
    // A trilha da praia até o fortim, passando pela taverna e pela forca.
    k.aplicar(m => caminho(m, { pontos: [[12, 15.5], [16, 11], [22, 6.5], [30, 3.2], [37, 2.2], [42.6, 4.5]], largura: [1.8, 2.4], material: 'chao.batido', irregular: 0.4 }, 191));
    k.aplicar(m => caminho(m, { pontos: [[7.5, 10.2], [9, 13], [12, 15.5]], largura: [1.6, 2], material: 'chao.batido', irregular: 0.4 }, 192));

    // ---------- O navio fundeado na baía ----------
    const nx = 40.6, ny = 27.0, th = -0.32, L = 22;
    const no = (u: number, v: number): [number, number] => [nx + u * Math.cos(th) - v * Math.sin(th), ny + u * Math.sin(th) + v * Math.cos(th)];
    k.objeto('navio', [nx, ny], { rotation: th, params: { comprimento: L, mastros: 3 } });
    for (const u of [-5.6, -1.2, 4.6]) { k.objeto('canhao-naval', no(u, 1.55), { rotation: th }); k.objeto('canhao-naval', no(u, -1.55), { rotation: th + Math.PI }); }
    k.objeto('timao', no(-6.2, 0), { rotation: th - Math.PI / 2 });
    k.objeto('bandeira-pirata', no(-10.2, 0.6), { rotation: th });
    for (const [u, v, item] of [[0.4, -1.9, 'barril'], [1.2, 1.9, 'barril-de-rum'], [8.6, 1.2, 'rolo-de-corda'], [-2.6, 0.3, 'pilha-de-balas']] as const) k.objeto(item, no(u, v), { rotation: th + u });
    k.luz('lamparina', no(-8.8, 0), { radius: 5, intensity: 0.8 });
    k.luz('lamparina', no(8.4, 0), { radius: 4, intensity: 0.6 });
    // O bote que leva o tesouro à praia.
    k.objeto('barco-a-remo', [33.2, 22.2], { rotation: 2.5 });

    // ---------- O cais de tábuas com o sino ----------
    k.objeto('cais-segmento', [27.2, 22.6], { rotation: 0.62, params: { comprimento: 5.5, largura: 2 } });
    k.objeto('sino-de-cais', [24.1, 20.2], { rotation: 0.62 });
    k.objeto('estaca', [29.6, 24.6], {});
    k.objeto('rolo-de-corda', [25.4, 21.0], { rotation: 0.4 });

    // ---------- O acampamento na praia ----------
    k.objeto('cabana-de-palha', [5.6, 16.8], { rotation: 0.4 });
    k.objeto('cabana-de-palha', [12.8, 13.8], { rotation: 1.3 });
    k.objeto('fogueira', [14.6, 20.6], { rotation: 0 });
    k.luz('fogueira', [14.6, 20.6], { radius: 7, intensity: 1.1 });
    k.objeto('bau-de-tesouro', [17.6, 21.6], { rotation: 0.35, params: { aberto: 1 } });
    k.objeto('moedas-espalhadas', [18.4, 23.0], { rotation: 0.2 });
    k.objeto('bau-de-tesouro', [11.8, 21.4], { rotation: -0.4 });
    k.objeto('barril.em-pe', [16.4, 18.6], {});
    k.objeto('mapa-do-tesouro', [16.4, 18.6], { rotation: 0.3 });
    k.objeto('barril-de-rum', [20.6, 19.6], { rotation: -0.5 });
    k.objeto('bandeira-pirata', [19.4, 17.4], { rotation: 0 });
    k.objeto('rede-de-dormir', [4.6, 22.6], { rotation: -0.1 });
    k.objeto('canoa', [10.8, 24.4], { rotation: 0.12 });
    k.objeto('canoa', [20.6, 23.6], { rotation: -0.42 });
    k.objeto('fardos-de-acucar', [23.4, 18.0], { rotation: 0.6 });
    k.objeto('pilha-de-barris', [21.8, 15.8], { rotation: 0.3 });
    for (const [x, y] of [[13.0, 22.2], [15.8, 22.4], [13.2, 19.0]] as const) k.objeto('caixote', [x, y], { rotation: x });

    // ---------- A taverna de tábuas, a noroeste ----------
    const taverna = k.comodo([2, 2, 8, 6], 'taverna-do-porto', { nome: 'Taverna do Papagaio', telhado: 'telha.tabuas', telhadoForma: 'duas-aguas', telhadoDetalhes: ['chamine'], telhadoVisivel: false });
    k.porta([7.5, 9], 'door', { width: 1.5, state: 'open' });
    k.porta([4.5, 9], 'window', { width: 1.2 });
    k.porta([3, 6], 'window', { width: 1.2 });
    k.objeto('barril-de-rum', [10.4, 4.3], { rotation: Math.PI });
    k.objeto('pilha-de-barris', [10.6, 7.6], { rotation: 0.2 });
    for (const [x, y] of [[5.2, 5.0], [7.0, 7.4]] as const) {
      k.objeto('mesa.taverna', [x, y], { rotation: 0 });
      for (const s of [-1, 1]) k.objeto('banco.longo', [x, y + s * 0.85], { rotation: 0 });
    }
    k.objeto('mapa-do-tesouro', [5.2, 5.0], { rotation: -0.2 });
    k.objeto('rede-de-dormir', [8.4, 4.2], { rotation: Math.PI / 2 });
    k.luz('lamparina', [6.5, 6], { radius: 5.5, intensity: 0.9 });

    // ---------- O fortim no promontório ----------
    const fortim = k.comodo([29, 1, 33, 5], 'fortim', { nome: 'Fortim de São Brás', piso: 'laje.pedra', telhado: null, telhadoVisivel: false });
    k.porta([43.5, 4.5], 'door', { width: 1.5, state: 'open', material: 'madeira.escura' });
    k.porta([46.5, 7.5], 'window', { width: 0.9 });
    k.objeto('mesa-de-cartografo', [46.6, 3.0], { rotation: 0 });
    k.objeto('bau-de-tesouro', [48.6, 6.4], { rotation: Math.PI / 2 });
    k.objeto('barril', [44.4, 2.4], {});
    k.objeto('pilha-de-balas', [44.6, 6.6], {});
    k.objeto('catre', [48.7, 2.6], { rotation: 0 });
    // A bateria de canhões virada para a baía e o canhão do flanco, virado para a enseada.
    for (const x of [42.2, 44.9, 47.6, 50.3]) k.objeto('canhao-de-forte', [x, 9.4], { rotation: 0 });
    k.objeto('canhao-de-forte', [38.9, 5.6], { rotation: Math.PI / 2 });
    k.objeto('pilha-de-balas', [40.6, 8.2], {});
    k.objeto('barril', [51.2, 6.4], {});
    k.objeto('sino-de-cais', [41.6, 2.8], { rotation: Math.PI / 2 });
    k.objeto('bandeira-pirata', [51.0, 1.6], { rotation: 0 });
    k.objeto('forca', [35.4, 1.8], { rotation: Math.PI });
    for (const [x, y] of [[41.6, 6.4], [50.8, 8.0]] as const) k.luz('tocha', [x, y], { radius: 5, intensity: 0.8 });

    // ---------- Coqueiros na praia, a mata atrás e as pedras na água ----------
    for (const [item, x, y, s] of [
      ['casa:coqueiro-6m', 2.4, 21.2, 1], ['casa:coqueiro-4m', 7.0, 21.0, 1], ['casa:coqueiro-6m', 9.4, 17.8, 0.95], ['casa:coqueiro-4m', 16.4, 15.6, 1],
      ['casa:coqueiro-6m', 22.8, 20.8, 1.05], ['casa:coqueiro-4m', 25.6, 16.2, 1], ['casa:coqueiro-6m', 27.6, 11.4, 0.95], ['casa:coqueiro-4m', 28.4, 6.6, 1],
      ['casa:coqueiro-6m', 0.8, 25.4, 0.9], ['casa:coqueiro-4m', 19.0, 13.0, 0.9], ['casa:coqueiro-6m', 33.6, 3.2, 0.9], ['casa:coqueiro-4m', 13.6, 24.0, 0.85],
      ['casa:arvore-de-selva-5m', 1.0, 1.0, 0.7], ['casa:arvore-de-selva-5m', 15.2, 2.0, 1], ['casa:arvore-de-selva-8m', 21.0, 1.0, 0.9], ['casa:arvore-de-selva-5m', 1.2, 12.6, 1],
      ['casa:arvore-de-selva-5m', 26.6, 1.2, 0.9], ['casa:bambuzal-4m', 14.8, 6.8, 1], ['casa:bambuzal-2m', 0.8, 8.2, 1],
      ['casa:folhagem-tropical-2m', 3.0, 14.2, 1], ['casa:folhagem-tropical-1m', 17.6, 8.6, 1], ['casa:folhagem-tropical-2m', 23.2, 9.8, 1], ['casa:folhagem-tropical-1m', 10.6, 11.0, 1],
      ['casa:folhagem-tropical-1m', 31.0, 0.8, 1], ['casa:folhagem-tropical-2m', 8.4, 0.8, 1],
    ] as const) k.objeto(item, [x, y], { rotation: x + y, scale: s });
    for (const [x, y, t] of [[52.4, 16.6, 1.6], [46.2, 15.4, 1.1], [3.6, 32.6, 1.3], [35.6, 7.6, 1.0]] as const) k.objeto('rochedo', [x, y], { rotation: x, params: { tamanho: t, cobertura: 0 } });

    // Luz: a tarde tropical, sol alto e quente; à noite, a fogueira da praia, as lanternas do navio e as tochas do fortim.
    k.clima('tarde', { time: '13:30', tempo: { wind: 0.35 } });
    k.acabamento(null, { tint: '#f2fbff', saturation: 1.18, vignette: 0.24, glow: 0.35, edges: { kind: 'none', amount: 0 } });
    k.guardarClima('noite', 'Noite do saque', 'noite', { time: '22:30', ambient: { color: '#6a88b8', intensity: 0.5 }, sun: { angle: 2.4, color: '#b8cce8', intensity: 0.45 }, tempo: { wind: 0.2 } });

    k.notaDeComodo(taverna, { leitura: 'Rum aguado, um papagaio que xinga em três línguas e um mapa pregado na mesa com um punhal.', notasMestre: 'O taverneiro vende aos piratas a hora da ronda do fortim; vende o contrário aos soldados.' });
    k.notaDeComodo(fortim, { leitura: 'A bandeira do reino foi arriada; a caveira tremula no mastro. Na mesa do comandante, as cartas da costa estão marcadas a tinta vermelha.', notasMestre: 'O baú do fortim guarda o soldo da guarnição e a carta de corso falsificada do capitão.' });
    k.notas('Enseada dos piratas — a baía de água tropical abre para o sudeste, com o navio fundeado no meio. A praia de coqueiros faz o arco do oeste ao norte, com o acampamento, o cais e as canoas; a taverna fica a noroeste, na mata; o fortim tomado ocupa o promontório a nordeste, com a bateria de canhões virada para a baía e a forca na trilha.');
  },
};
