import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import type { Exemplo } from './kit.ts';

/** Praça saqueada (48 × 27 m): o largo da fonte em estrela depois do ataque — casa em chamas, telhado desabado, sangue e armas pelo chão. */
export const pracaSaqueada: Exemplo = {
  id: 'praca-saqueada',
  nome: 'Praça saqueada',
  descricao: 'Largo calçado com fonte em estrela depois do saque: casa ainda em chamas, telhado de telhas desabado, entulho, carroça tombada, armas caídas e manchas de sangue.',
  largura: 48,
  altura: 27,
  semente: 8803,
  miniatura: 'telhados',
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#1c1a16' });
    k.base('paralelepipedo');
    k.pintar('lajes.antigas', { poligono: [[15, 5], [24, 4], [32, 6], [33, 15], [30, 23], [20, 23.5], [14, 17]], irregular: 1.1 });
    k.pintar('grama.seca', { poligono: [[19, 15], [22, 16], [20, 19], [17, 18]], irregular: 1.2 });
    k.pintar('grama', { poligono: [[0, 20], [10, 21], [12, 27], [0, 27]], irregular: 1.1 });
    k.pintar('terra', { poligono: [[0, 13], [9, 13], [10, 20], [0, 21]], irregular: 1 });

    // A fonte em estrela no meio do largo.
    k.objeto('roseta-de-calcamento', [24, 12.5], { params: { raio: 4.6 }, rotation: 0 });
    k.objeto('fonte', [24, 12.5], { params: { diametro: 5.6, forma: 2 }, rotation: 0.39 });
    for (const [x, y] of [[20.6, 16.2], [27.4, 8.8], [21.2, 8.6]] as const) k.objeto('tufo-de-grama', [x, y], { scale: 1.3 });

    // Casas de telha que sobraram em pé: o sobrado a oeste e o quarteirão leste.
    k.aplicar((m, id) => construirEdificios(m, [
      { nome: 'Sobrado do boticário', origem: [0, 0], lote: [5, 8], frente: 'l', forma: 'L', telhado: 'telha.barro', comodos: [{ tipo: 'loja', area: 24, principal: true }, { tipo: 'quarto', area: 14 }, { tipo: 'cozinha', area: 12 }] },
      { nome: 'Casa do mercador', origem: [23, 0], lote: [9, 7], frente: 'o', forma: 'T', telhado: 'telha.barro', comodos: [{ tipo: 'sala', area: 34, principal: true }, { tipo: 'quarto', area: 18 }, { tipo: 'escritorio', area: 12 }, { tipo: 'cozinha', area: 14 }] },
      { nome: 'Estalagem', origem: [23, 9], lote: [9, 9], frente: 'o', forma: 'U', telhado: 'telha.velha', comodos: [{ tipo: 'taverna', area: 48, principal: true }, { tipo: 'cozinha', area: 16 }, { tipo: 'dormitorio', area: 22 }, { tipo: 'deposito', area: 12 }] },
    ], 17, id));

    k.tirarExternosDosInteriores();

    // A casa queimada ao norte: sem telhado, paredes de pé, vigas partidas e brasas.
    const queimada = k.comodo([[11, 0, 20, 3]], 'patio', { nome: 'Casa queimada', funcao: 'ruina', piso: 'tabuas.escuras', papel: 'tijolo', telhado: null });
    k.porta([22.5, 4.5], 'door', { state: 'open' });
    for (const [x, y, r] of [[19.4, 2.0, 0.4], [24.6, 1.6, -0.3], [27.2, 3.2, 1.2]] as const) k.objeto('viga-partida', [x, y], { rotation: r, scale: 1.4 });
    for (const [x, y] of [[21.2, 2.2], [26.0, 3.0]] as const) k.objeto('fogueira', [x, y], { scale: 1.2 });
    k.luz('fogueira', [21.2, 2.2], { radius: 8, intensity: 1.4 });
    k.luz('fogueira', [26.0, 3.0], { radius: 7, intensity: 1.2 });
    k.presenca('fuligem', { poligono: [[16, 0], [31, 0], [31, 6.5], [16, 6.5]], irregular: 0.8 }, 0.5);

    // Telhado desabado do lado de fora, entulho, carroça tombada.
    for (const [x, y, s, q] of [[31.0, 8.8, 1.8, 1], [17.0, 6.6, 2, 1], [6.4, 16.6, 3, 0], [3.2, 18.6, 2.6, 0], [9.2, 18.8, 2.4, 0], [12.8, 22.0, 2.2, 1], [15.2, 25.6, 1.8, 0]] as const) k.objeto('escombros', [x, y], { scale: s, rotation: (x * 0.37) % 0.6 - 0.3, params: { queimado: q } });
    k.objeto('carroca-tombada', [11.2, 10.6], { params: { carga: 1 }, rotation: 0.6 });
    for (const [x, y, r] of [[15.6, 21.6, 0.9], [18.2, 24.4, 1.7], [11.6, 13.4, 2.6], [13.6, 25.4, 0.2]] as const) k.objeto('viga-partida', [x, y], { rotation: r });
    for (const [x, y, r] of [[14.2, 9.4, 0.3], [19.4, 21.2, 2.1], [29.4, 19.4, 1.2], [16.8, 16.4, 0.7]] as const) k.objeto('tabua-solta', [x, y], { rotation: r });
    for (const [x, y, r] of [[18.4, 11.6, 0.4], [27.6, 16.6, 2.2], [13.6, 18.2, 1.3]] as const) k.objeto('armas-caidas', [x, y], { rotation: r });
    for (const [x, y] of [[16.6, 8.2], [29.8, 21.8], [12.2, 6.2]] as const) k.objeto('caixote', [x, y], { rotation: k.rng() * 6 });
    k.objeto('barril.deitado', [31.4, 7.8], { rotation: 0.8 });
    k.objeto('estandarte', [20.4, 22.6], { params: { cor: 0 }, rotation: 1.3 });

    // Sangue: poucas manchas, pequenas, onde houve luta.
    for (const [x, y, r] of [[17.6, 10.4, 0.5], [19.8, 14.6, 0.45], [28.8, 9.6, 0.5], [27.6, 18.6, 0.6], [16.2, 19.6, 0.45], [22.2, 21.8, 0.55], [12.8, 11.6, 0.5]] as const) k.presenca('ordem.sangue', { disco: [x, y], raio: r, irregular: 0.9 }, 0.55);

    // Uma árvore seca e mato no canto sudoeste.
    k.objeto('arvore-morta', [3.4, 23.6], { params: { tamanho: 1 }, rotation: 0.6 });
    k.objeto('casa:arbusto-seco-2m', [9.8, 25.4], { rotation: 1.4 });
    k.objeto('casa:arbusto-verde', [1.2, 20.4], { rotation: 0.2 });

    k.clima('tarde', { time: '15:20', ambient: { color: '#f2e6d2', intensity: 0.92 }, tempo: { embers: 0.6, dust: 0.3, wind: 0.25 } });
    k.acabamento('quente', { vignette: 0.35, saturation: 1.05, edges: { kind: 'none', amount: 0 }, glow: 0.55 });
    k.guardarClima('noite-do-saque', 'Noite do saque', 'noite', { tempo: { embers: 0.8, fog: 0.15 } });

    k.notaDeComodo(queimada, { leitura: 'Só as paredes de tijolo ficaram de pé. As vigas do telhado ainda estalam e soltam brasas.', notasMestre: 'Debaixo das tábuas há um alçapão: a família do mercador escondeu-se no porão.' });
    k.regiao([[14, 4], [33, 4], [33, 23], [14, 23]], 'trigger', { nome: 'O largo', texto: 'Fumaça, sangue e silêncio. Um cão late em algum lugar; ninguém responde.' });
    k.notas('Praça saqueada — os saqueadores levaram o que puderam e incendiaram o resto. Há sobreviventes escondidos na estalagem e um saqueador ferido no sobrado do boticário.');
  },
};
