import { terreno } from '../../src/authoring/construcao.ts';
import type { Exemplo } from './kit.ts';

/** Sala da guarda (48 × 27 m): posto subterrâneo com duas mesas de jogo sobre tapetes, palha nos cantos, balista desmontada e o abismo ao sul. */
export const salaDaGuarda: Exemplo = {
  id: 'sala-da-guarda',
  nome: 'Sala da guarda',
  descricao: 'Posto de guarda subterrâneo: duas mesas de jogo à luz de velas sobre tapetes, montes de palha, balista desmontada, braseiro, nicho com fogo, estandarte azul e o abismo que se abre ao sul.',
  largura: 48,
  altura: 27,
  semente: 9157,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#050505' });
    k.base('rocha.rachada');

    // A rocha viva em volta e o abismo ao sudeste, 12 m abaixo.
    k.pintar('rocha.caverna', { poligono: [[-1, -1], [11.4, -1], [10.6, 28], [-1, 28]], irregular: 0.5 });
    k.pintar('rocha.caverna', { poligono: [[40.2, -1], [49, -1], [49, 19], [40.4, 19.2]], irregular: 0.5 });
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: -12, forma: { poligono: [[33, 23], [49, 21], [49, 28], [31, 28]], irregular: 0.6 } }], 5));

    // A sala e a passagem que sai ao sul.
    const sala = k.comodo([[8, 2, 26, 13]], 'salao', { nome: 'Sala da guarda', piso: 'pedra.rustica', papel: 'pedra.aparelhada', telhado: null });
    const passagem = k.comodo([[12, 13, 21, 16]], 'corredor', { nome: 'Galeria sul', piso: 'pedra.rustica', papel: 'pedra.aparelhada', telhado: null });
    k.porta([24.75, 19.5], 'arch', { width: 3, state: 'open', material: 'pedra.escura' });
    k.porta([21.75, 24], 'door', { state: 'closed', material: 'ferro' });
    k.porta([31.5, 21.75], 'arch', { width: 1.5, state: 'open' });

    // Duas mesas de jogo sobre tapetes, com velas, dados e moedas.
    for (const [x, y, r] of [[20.6, 8.8, 0.04], [31.4, 9.0, -0.05]] as const) {
      k.objeto('tapete.persa', [x, y], { params: { largura: 5.6, altura: 4.2, material: 'tapete.verde' }, rotation: r });
      k.objeto('mesa.cavalete', [x, y], { params: { largura: 3.4 }, rotation: r + 0.08, scale: 1.2 });
      k.objeto('banco.longo', [x - 0.4, y - 2.0], { params: { largura: 3 }, rotation: r - 0.1 });
      k.objeto('banco.longo', [x + 0.5, y + 2.0], { params: { largura: 3 }, rotation: r + 0.15 });
      k.objeto('castical.mesa', [x - 0.8, y - 0.2], { rotation: 0 });
      k.objeto('castical.mesa', [x + 1.0, y + 0.1], { rotation: 0 });
      k.objeto('garrafa.tacas', [x + 0.2, y + 0.2], { rotation: 1 });
      k.luz('vela', [x, y], { radius: 5, intensity: 0.9, color: '#ffb35c' });
    }
    k.objeto('caixote', [25.4, 11.4], { rotation: 0.5 });
    k.objeto('caixote', [34.6, 5.2], { rotation: -0.3 });

    // Palha nos cantos, balista desmontada, braseiro, barril e entulho.
    k.objeto('monte-de-palha', [14.2, 5.0], { rotation: 0.3, scale: 2 });
    k.objeto('monte-de-palha', [37.0, 5.2], { rotation: 1.8, scale: 2.1 });
    k.objeto('enxergao', [37.8, 10.2], { rotation: 0.1 });
    k.objeto('balista', [16.2, 15.6], { rotation: 2.4, scale: 1.5 });
    k.objeto('pilha-de-balas', [13.6, 17.8], { scale: 1.3 });
    k.objeto('viga-partida', [19.4, 18.0], { rotation: 0.9 });
    k.objeto('braseiro', [34.4, 16.8], { scale: 1.5 });
    k.luz('fogueira', [34.4, 16.8], { radius: 7, intensity: 1.3, color: '#ffa04a' });
    k.objeto('barril', [37.8, 17.8], { scale: 1.2 });
    k.objeto('barril.deitado', [37.6, 15.0], { rotation: 0.6 });
    k.objeto('suporte-de-armas', [12.6, 9.8], { params: { largura: 2 }, rotation: Math.PI / 2 });
    k.objeto('mesa-de-armas', [13.4, 12.6], { rotation: Math.PI / 2 });
    for (const [x, y, s] of [[27.4, 16.6, 2.2], [23.8, 17.8, 1.4], [38.0, 12.6, 1.4]] as const) k.objeto('escombros', [x, y], { scale: s, rotation: 0 });
    k.espalhar('bagunca', { poligono: [[13, 4], [38, 4], [38, 18.5], [13, 18.5]] }, { densidade: 0.03 });

    // Nicho com fogo a nordeste e o estandarte azul na parede leste.
    k.objeto('tocha.parede', [38.8, 3.4], { rotation: Math.PI / 2 });
    k.luz('tocha', [38.2, 3.8], { radius: 5.5 });
    k.objeto('tapecaria', [38.8, 10.6], { params: { largura: 2 }, rotation: Math.PI / 2 });
    k.objeto('escudo.parede', [12.2, 6.6], { params: { cor: 1 }, rotation: -Math.PI / 2 });

    k.objeto('tocha.parede', [27.6, 19.8], { rotation: 0 });
    k.luz('tocha', [27.6, 20.8], { radius: 5 });
    for (const [x, y] of [[19.6, 21.8], [22.0, 22.0], [29.6, 21.6]] as const) k.objeto('catre', [x, y], { rotation: Math.PI / 2 });

    // O brilho vermelho que sobe do abismo.
    k.luz('fogueira', [40, 25.5], { radius: 8, intensity: 0.9, color: '#ff5a2a', flicker: 0.1 });
    k.presenca('ordem.sangue', { disco: [36.6, 13.0], raio: 0.45, irregular: 0.9 }, 0.45);

    k.clima('apagao', { time: '23:30', ambient: { color: '#6676a0', intensity: 0.52 }, sun: null, tempo: { dust: 0.2 } });
    k.acabamento(null, { vignette: 0.55, saturation: 0.9, edges: { kind: 'dark', amount: 0.4 }, glow: 0.8 });
    k.guardarClima('alarme', 'Alarme soado', undefined, { tempo: { embers: 0.3, fog: 0.2 } });

    k.notaDeComodo(sala, { leitura: 'Moedas e dados ainda em cima das mesas; as velas queimam pela metade. Quem jogava saiu às pressas.', notasMestre: 'Seis guardas dormem na galeria sul. O estandarte azul esconde uma alavanca que fecha a porta de ferro.' });
    k.notaDeComodo(passagem, { leitura: 'Um corredor frio, com o rumor do abismo ao fundo.' });
    k.notas('Sala da guarda — o último posto antes das minas profundas. A porta de ferro a sudeste leva à beira do abismo, onde algo sobe à noite.');
  },
};
