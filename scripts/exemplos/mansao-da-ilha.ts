import { comodos, portas } from '../../src/authoring/construcao.ts';
import type { Interacao, Ponto } from '../../src/domain/mapa.ts';
import type { Exemplo, Kit } from './kit.ts';

/**
 * Mansão da ilha (33 × 34,5 m): casarão vitoriano em dois andares, montado com as mesmas ferramentas do assistente.
 * Térreo: terraço com escadaria dupla, hall de pé-direito duplo com a escadaria nobre, salão da lareira, biblioteca,
 * sala de jogos, lavabo, escritório, salinha de música, sala de visitas e sala de jantar. 1º andar: galeria em volta do
 * vão do hall, suíte com banho, saleta, segunda biblioteca, quartos, sala íntima e rouparia.
 * Paredes ficam do lado −y dos móveis; para encostar numa parede: norte 0, sul π, oeste −π/2, leste π/2.
 */
const N = 0, S = Math.PI, O = -Math.PI / 2, L = Math.PI / 2;
const CIMA = 'andar-1';
const escada = (para: string | null, pos: Ponto): Interacao => ({ kind: 'stairs', on: false, targets: [], sound: null, clue: null, toLevel: para, toPosition: pos });

/** Estantes em fila ao longo de uma parede, com pequenas variações. */
function estantes(k: Kit, pontos: readonly Ponto[], rot: number, andar: string | null = null): void {
  for (const p of pontos) k.objeto('estante.piso', p, { rotation: rot, params: { largura: 1.6 }, ...(andar ? { levelId: andar } : {}) });
}

export const mansaoDaIlha: Exemplo = {
  id: 'mansao-da-ilha',
  nome: 'Mansão da ilha',
  descricao: 'Casarão vitoriano em dois andares: hall de pé-direito duplo com escadaria nobre, salão da lareira com piano, biblioteca, sala de jogos, sala de jantar posta e, em cima, galeria, suíte e quartos.',
  largura: 33,
  altura: 34.5,
  semente: 13331,
  construir(k) {
    k.estilo({ genre: 'investigacao', palette: 'investigacao-sepia' });
    k.fundo({ kind: 'solid', color: '#0c1f23' });
    k.base('vazio');

    // ---------- Terraço de entrada com escadaria dupla ----------
    k.pintar('lajes.antigas', { poligono: [[1.2, 27], [31.8, 27], [31.8, 30.6], [20.4, 30.6], [20.4, 34.5], [12.6, 34.5], [12.6, 30.6], [1.2, 30.6]], irregular: 0 });
    k.objeto('escada.externa', [16.5, 32.6], { params: { largura: 7.2 }, rotation: N, blocks: { move: false, sight: false } });
    for (const [x, y, r, w] of [[6.9, 30.4, N, 11], [26.1, 30.4, N, 11], [12.5, 32.6, L, 3.8], [20.5, 32.6, L, 3.8]] as const) k.objeto('balaustrada', [x, y], { params: { largura: w }, rotation: r });
    for (const x of [2.2, 12.2, 20.8, 30.8]) k.objeto('urna.pedestal', [x, 29.2], { rotation: 0, scale: 1.3 });
    for (const x of [13.4, 19.6]) { k.objeto('lanterna-de-poste', [x, 30.0]); k.luz('lanterna', [x, 30.0], { cone: null, radius: 5, color: '#ffcc80', intensity: 1, rays: false }); }

    // ---------- Térreo ----------
    const hall = k.comodo([6, 9, 15, 18], 'salao', { nome: 'Hall de entrada', piso: 'marmore.branco', papel: 'papel.verde-esmeralda', telhado: null });
    const salao = k.comodo([6, 1, 15, 9], 'sala', { nome: 'Salão da lareira', piso: 'tabuas.escuras', papel: 'papel.damasco-azul', telhado: null });
    const biblio = k.comodo([15, 1, 21, 8], 'biblioteca', { nome: 'Biblioteca', piso: 'marmore.incrustado', papel: 'boiserie.escura', telhado: null });
    k.comodo([15, 8, 21, 11], 'sala-de-jogos', { nome: 'Sala de jogos', piso: 'tabuas.escuras', papel: 'papel.listras-musgo', telhado: null });
    k.comodo([15, 11, 21, 13], 'banheiro', { nome: 'Lavabo', piso: 'marmore.branco', papel: 'papel.liso-claro', telhado: null });
    const escrit = k.comodo([15, 13, 21, 18], 'escritorio', { nome: 'Escritório', piso: 'tabuas.escuras', papel: 'boiserie.escura', telhado: null });
    k.comodo([1, 4, 6, 7], 'sala', { nome: 'Salinha de música', piso: 'parquet.espinha', papel: 'papel.listras-creme', telhado: null });
    k.comodo([1, 7, 6, 12], 'sala', { nome: 'Sala de visitas', piso: 'marmore.branco', papel: 'papel.damasco-vinho', telhado: null });
    const jantar = k.comodo([1, 12, 6, 18], 'sala-de-jantar', { nome: 'Sala de jantar', piso: 'tabuas.carvalho', papel: 'papel.bordo-listras', telhado: null });
    for (const [p, tipo, w] of [
      [[16.5, 27], 'door', 2], [[16.5, 13.5], 'arch', 2.4], [[9, 16.5], 'door', 0.9], [[5.25, 18], 'door', 0.9], [[5.25, 10.5], 'door', 0.9],
      [[22.5, 6.75], 'door', 0.9], [[22.5, 14.25], 'door', 0.9], [[27.75, 16.5], 'door', 0.9], [[22.5, 23.25], 'door', 0.9], [[9, 8.25], 'door', 0.9],
    ] as const) k.porta([p[0], p[1]], tipo, { width: w, state: tipo === 'door' && w > 1 ? 'closed' : 'open' });
    for (const p of [[3.75, 6], [12.75, 1.5], [18.75, 1.5], [1.5, 15], [1.5, 22.5], [31.5, 4.5], [31.5, 23.25], [12, 27], [21, 27]] as const) k.porta([p[0], p[1]], 'window', { width: 1.4 });

    // Hall: tapete grande, sofá e poltronas em volta da mesa de centro, a escadaria nobre subindo para a galeria.
    k.objeto('tapete.persa', [17.2, 21.6], { params: { largura: 5.2, altura: 7, material: 'tapete.creme', desenho: 1 }, rotation: 0 });
    k.objeto('mesa.centro', [17.2, 21.8], { params: { largura: 1.8 }, rotation: 0 });
    k.objeto('sofa.capitone', [17.2, 19.2], { params: { largura: 2.4, estofado: 'couro.marrom' }, rotation: N });
    for (const [x, y, r] of [[14.9, 20.9, O], [19.5, 20.9, L], [14.9, 23.0, O], [19.5, 23.0, L]] as const) k.objeto('poltrona.capitone', [x, y], { params: { estofado: 'tecido.veludo-azul' }, rotation: r });
    k.objeto('escadaria.nobre', [10.6, 17.7], { params: { largura: 2.4, comprimento: 8 }, rotation: N, blocks: { move: false, sight: false }, interaction: escada(CIMA, [10.6, 10.8]) });
    k.objeto('lustre', [17.2, 21.6], { params: { diametro: 2.4, bracos: 10 }, rotation: 0, blocks: { move: false, sight: false } });
    for (const [x, y] of [[13.1, 25.9], [21.4, 25.9]] as const) k.objeto('casa:palmeira-pedra', [x, y], { rotation: 0 });
    for (const [x, y] of [[21.8, 14.4], [9.8, 26.2]] as const) k.objeto('candelabro.pe', [x, y]);
    k.objeto('relogio.pe', [21.9, 18.6], { rotation: L });
    k.objeto('aparador', [21.8, 22.2], { rotation: L });

    // Salão da lareira: lareira nobre, roda de sofás no tapete redondo, piano e estantes.
    k.objeto('lareira.nobre', [15.75, 2.1], { params: { largura: 3, fogo: 1 }, rotation: N });
    k.objeto('tapete.redondo', [15.75, 6.4], { params: { diametro: 4.6, material: 'tapete.marinho' }, rotation: 0 });
    k.objeto('mesa.centro', [15.75, 6.4], { params: { largura: 1.5 }, rotation: 0 });
    k.objeto('sofa.capitone', [15.75, 8.3], { params: { largura: 2.6, estofado: 'tecido.veludo-vinho' }, rotation: S });
    k.objeto('poltrona.capitone', [13.2, 5.8], { params: { estofado: 'couro.marrom' }, rotation: O });
    k.objeto('poltrona.capitone', [18.3, 5.8], { params: { estofado: 'couro.marrom' }, rotation: L });
    k.objeto('tapete.persa', [17.6, 11.4], { params: { largura: 4.4, altura: 2.8, material: 'tapete.persa', desenho: 1 }, rotation: 0 });
    k.objeto('piano.cauda', [12.2, 11.0], { rotation: 0.35 });
    k.objeto('banqueta', [12.9, 12.6], { rotation: 0.35 });
    estantes(k, [[9.45, 4.2], [9.45, 6.4]], O);
    k.objeto('cristaleira', [22.05, 10.0], { rotation: L });
    for (const [x, y] of [[10.0, 2.4], [21.5, 2.4]] as const) k.objeto('luminaria.franja', [x, y]);
    k.objeto('candelabro.pe', [21.6, 12.6]);

    // Biblioteca: mesa longa de leitura, estantes nas paredes, globo e a escada em caracol do mezanino.
    estantes(k, [[24.6, 1.95], [26.9, 1.95], [29.2, 1.95]], N);
    estantes(k, [[31.05, 4.6], [31.05, 7.2]], L);
    estantes(k, [[22.95, 3.6]], O);
    k.objeto('mesa.retangular', [26.8, 6.4], { params: { largura: 2.8, profundidade: 1.1, madeira: 'madeira.escura' }, rotation: L });
    for (const [x, y, r] of [[25.8, 5.4, O], [25.8, 7.4, O], [27.8, 5.4, L], [27.8, 7.4, L]] as const) k.objeto('cadeira.espaldar', [x, y], { rotation: r });
    k.objeto('castical.mesa', [26.8, 6.0]); k.objeto('livro.aberto', [26.7, 6.9], { rotation: 0.3 });
    k.objeto('escada.caracol', [30.2, 10.4], { params: { diametro: 2 }, rotation: 0 });
    k.objeto('globo.terrestre', [23.6, 10.8]);
    k.objeto('luminaria.franja', [23.4, 2.4], { params: { cupula: 'tecido.verde' } });

    // Sala de jogos: bilhar e carteado.
    k.objeto('mesa.bilhar', [25.6, 14.2], { rotation: L, params: { feltro: 'tecido.verde' } });
    k.objeto('mesa.carteado', [29.8, 14.25], { params: { estofado: 'tecido.veludo-vinho' }, rotation: 0 });
    k.objeto('cabideiro', [23.2, 12.6]);

    // Lavabo.
    k.objeto('banheira.pes', [24.5, 18.0], { rotation: L });
    k.objeto('pia.pedestal', [27.6, 17.0], { rotation: N });
    k.objeto('vaso.sanitario', [30.6, 17.1], { rotation: N });

    // Escritório: tapete creme, escrivaninha, poltronas, estantes e sofá.
    k.objeto('tapete.persa', [26.9, 23.2], { params: { largura: 4.8, altura: 3.6, material: 'tapete.desbotado', desenho: 2 }, rotation: 0 });
    k.objeto('escrivaninha.verde', [29.6, 23.2], { rotation: L, params: { largura: 1.8 } });
    k.objeto('cadeira.espaldar', [30.5, 23.2], { rotation: L });
    k.objeto('poltrona.capitone', [27.6, 22.2], { params: { estofado: 'couro.marrom' }, rotation: O - 0.3 });
    k.objeto('poltrona.capitone', [27.6, 24.3], { params: { estofado: 'couro.marrom' }, rotation: O + 0.3 });
    estantes(k, [[24.6, 20.0], [27.0, 20.0], [29.4, 20.0]], N);
    k.objeto('sofa.capitone', [25.2, 26.4], { params: { largura: 2.2, estofado: 'tecido.verde' }, rotation: S });
    k.objeto('luminaria.franja', [31.0, 26.4]); k.objeto('globo.terrestre', [23.3, 26.2]);

    // Salinha de música, sala de visitas e sala de jantar.
    k.objeto('sofa.capitone', [5.25, 9.9], { params: { largura: 2.2, estofado: 'tecido.veludo-azul' }, rotation: S });
    k.objeto('atril', [3.0, 7.3], { rotation: 0.4 });
    k.objeto('mesinha', [7.6, 7.4]); k.objeto('luminaria.franja', [2.2, 6.8]);
    k.objeto('tapete.persa', [5.25, 14.25], { params: { largura: 3.4, altura: 4.6, material: 'tapete.areia', desenho: 3 }, rotation: 0 });
    k.objeto('sofa.capitone', [2.25, 14.25], { params: { largura: 2.6, estofado: 'tecido.veludo-vinho' }, rotation: O });
    k.objeto('mesa.centro', [4.4, 14.25], { params: { largura: 1.4 }, rotation: L });
    k.objeto('poltrona.capitone', [7.2, 13.1], { params: { estofado: 'tecido.veludo-vinho' }, rotation: L });
    k.objeto('poltrona.capitone', [7.2, 15.4], { params: { estofado: 'tecido.veludo-vinho' }, rotation: L });
    k.objeto('lareira.marmore', [5.25, 11.0], { rotation: N, params: { largura: 1.6 } });
    k.objeto('tapete.oval', [5.25, 22.5], { params: { largura: 4, altura: 6.4, material: 'tapete.desbotado' }, rotation: 0 });
    k.objeto('jantar.posto', [5.25, 22.5], { params: { largura: 3.8, estofado: 'tecido.veludo-vinho', toalha: 'tecido.linho' }, rotation: L });
    k.objeto('aparador', [1.95, 19.8], { rotation: O }); k.objeto('aparador', [1.95, 25.2], { rotation: O });
    k.objeto('cristaleira', [8.55, 22.5], { rotation: L });
    k.objeto('lustre', [5.25, 22.5], { params: { diametro: 1.6, bracos: 8 }, rotation: 0, blocks: { move: false, sight: false } });

    // Mais vida nos cômodos sociais: mesinhas, plantas, cadeiras avulsas e aparadores.
    for (const [item, x, y, r] of [
      ['mesinha', 12.4, 4.6, 0], ['mesinha', 19.1, 4.6, 0], ['casa:palmeira-madeira', 10.0, 12.6, 0], ['casa:samambaia-a', 21.6, 4.6, 0], ['cadeira.espaldar', 20.2, 9.8, S + 0.4], ['cadeira.espaldar', 19.0, 12.8, -0.5],
      ['aparador', 13.6, 13.0, S], ['vaso.flores', 13.6, 13.0, 0], ['casa:samambaia-b', 9.9, 14.6, 0], ['banco.longo', 21.9, 16.4, L], ['vaso.planta', 9.8, 24.4, 0], ['mesinha', 21.8, 24.4, 0],
      ['cabideiro', 23.2, 15.8, 0], ['aparador', 27.0, 12.45, N], ['poltrona.capitone', 31.0, 12.9, L], ['vaso.planta', 23.2, 18.9, 0],
      ['aparador', 5.25, 7.95, S], ['vaso.planta', 8.4, 9.9, 0], ['casa:palmeira-pedra', 2.2, 11.2, 0], ['mesinha', 2.3, 16.7, 0], ['casa:samambaia-a', 8.3, 17.3, 0],
      ['casa:palmeira-madeira', 2.2, 26.3, 0], ['casa:palmeira-madeira', 8.3, 26.3, 0], ['vaso.flores', 1.95, 19.8, 0],
    ] as const) k.objeto(item, [x, y], { rotation: r });

    // Paredes vestidas: retratos, quadros, espelho, cortinas nas janelas e arandelas (presos à face do cômodo).
    for (const [item, x, y, params] of [
      ['retrato.oval', 16.5, 14.0, {}], ['quadro', 13.4, 14.0, { largura: 1.2 }], ['quadro', 19.6, 14.0, { largura: 1.2 }], ['paisagem.grande', 9.5, 21.6, { largura: 2.2 }], ['espelho.grande', 22.0, 20.6, { largura: 1.4 }],
      ['arandela', 9.5, 18.9, {}], ['arandela', 9.5, 24.4, {}], ['arandela', 22.0, 17.6, {}], ['arandela', 22.0, 24.4, {}],
      ['cortina.janela', 12.75, 2.0, { largura: 2, tecido: 'tecido.veludo-azul' }], ['cortina.janela', 18.75, 2.0, { largura: 2, tecido: 'tecido.veludo-azul' }], ['quadros.grupo', 22.0, 6.0, {}], ['retrato.oval', 9.5, 10.8, {}],
      ['mapa.mundi', 26.8, 11.5, { largura: 2 }], ['trofeu.cervo', 22.95, 8.6, {}],
      ['paisagem.grande', 26.8, 20.0, { largura: 2.4 }], ['cortina.janela', 31.0, 23.25, { largura: 2, tecido: 'tecido.verde' }], ['brasao', 22.95, 23.25, {}],
      ['espelho', 27.6, 16.9, {}], ['quadro', 3.75, 6.5, { largura: 1 }], ['cortina.janela', 2.0, 15.0, { largura: 2, tecido: 'tecido.veludo-vinho' }],
      ['quadro', 5.25, 18.5, { largura: 1.4 }], ['cortina.janela', 2.0, 22.5, { largura: 2, tecido: 'tecido.veludo-vinho' }], ['retrato.oval', 8.5, 25.4, {}], ['arandela', 8.5, 19.6, {}],
    ] as const) k.objeto(item, [x, y], { params: params as Record<string, unknown> });

    // Luzes do térreo.
    k.luz('fogueira', [15.75, 2.9], { radius: 6, intensity: 1.1, color: '#ff9a4a' });
    for (const [x, y, r] of [[17.2, 21.6, 9], [5.25, 22.5, 6], [15.75, 7, 6], [26.8, 6.4, 6], [27.6, 14.2, 5.5], [27, 23.2, 6], [5.25, 14.25, 5.5], [5.25, 8.5, 4], [27, 18, 3.5]] as const) k.luz('lamparina', [x, y], { radius: r * 1.2, intensity: 0.45, color: '#ffd9a8', flicker: 0.04 });

    // ---------- 1º andar ----------
    k.aplicar(() => ({ comandos: [{ tipo: 'andar.criar', andar: { id: CIMA, name: '1º andar', order: 1 } }], ids: [CIMA] }));
    k.aplicar((m, id) => comodos(m, [
      { rets: [[6, 1, 12, 6]], tipo: 'quarto', nome: 'Suíte principal', piso: 'tabuas.marchetadas', papel: 'papel.damasco-vinho', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[12, 1, 15, 3]], tipo: 'banheiro', nome: 'Banho da suíte', piso: 'marmore.branco', papel: 'papel.liso-claro', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[12, 3, 15, 6]], tipo: 'sala', nome: 'Saleta', piso: 'tabuas.escuras', papel: 'papel.listras-creme', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[6, 6, 15, 8], [6, 8, 7, 18], [14, 8, 15, 18]], tipo: 'corredor', nome: 'Galeria', piso: 'marmore.branco', papel: 'papel.verde-esmeralda', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[15, 1, 21, 7]], tipo: 'biblioteca', nome: 'Biblioteca de cima', piso: 'marmore.incrustado', papel: 'boiserie.escura', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[15, 7, 21, 10]], tipo: 'quarto', nome: 'Quarto do leste', piso: 'tabuas.marchetadas', papel: 'papel.floral-azul', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[15, 10, 21, 13]], tipo: 'sala', nome: 'Sala íntima', piso: 'parquet.espinha', papel: 'papel.damasco-azul', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[15, 13, 21, 18]], tipo: 'quarto', nome: 'Quarto de hóspedes', piso: 'tabuas.marchetadas', papel: 'papel.floral-rosa', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[1, 4, 6, 6]], tipo: 'banheiro', nome: 'Banheiro', piso: 'marmore.branco', papel: 'papel.liso-claro', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[1, 6, 6, 10]], tipo: 'quarto', nome: 'Quarto da filha', piso: 'tabuas.claras', papel: 'papel.floral-rosa', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[1, 10, 6, 13]], tipo: 'quarto', nome: 'Quarto do filho', piso: 'tabuas.marchetadas', papel: 'papel.azul-listras', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[1, 13, 6, 16]], tipo: 'quarto', nome: 'Quarto da governanta', piso: 'tabuas.rusticas', papel: 'papel.listras-musgo', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
      { rets: [[1, 16, 6, 18]], tipo: 'deposito', nome: 'Rouparia', piso: 'tabuas.rusticas', papel: 'reboco.branco', telhado: 'telha.ardosia', telhadoVisivel: false, andar: CIMA },
    ], 17, id));
    const portaEmCima = (p: Ponto, tipo: 'door' | 'arch' = 'door', largura = 0.9) => k.aplicar((m, id) => portas(m, [{ perto: p, tipo, estado: 'open', largura, andar: CIMA }], 1, id));
    for (const p of [[13.5, 9], [20.25, 9], [20.25, 4.5], [22.5, 9.75], [22.5, 12.75], [22.5, 17.25], [22.5, 23.25], [9, 12], [9, 17.25], [9, 21.75], [9, 25.5], [4.5, 9]] as const) portaEmCima([p[0], p[1]]);
    const em = { levelId: CIMA } as const;

    // Galeria: balaustrada em volta do vão do hall, passadeira e o patamar da escadaria.
    k.objeto('balaustrada', [15.75, 12.15], { params: { largura: 10.4 }, rotation: N, ...em });
    k.objeto('balaustrada', [10.65, 19.6], { params: { largura: 14.6 }, rotation: L, ...em });
    k.objeto('balaustrada', [20.85, 19.6], { params: { largura: 14.6 }, rotation: L, ...em });
    k.objeto('passadeira', [15.75, 10.5], { params: { largura: 1.2, comprimento: 11 }, rotation: L, ...em });
    k.objeto('passadeira', [10.6, 10.8], { params: { largura: 1.3, comprimento: 2.2 }, rotation: N, ...em, interaction: escada(null, [10.6, 19.5]) });
    for (const [x, y] of [[9.8, 9.8], [21.7, 9.8], [9.8, 26.2], [21.7, 26.2]] as const) k.objeto('candelabro.pe', [x, y], em);
    k.objeto('lustre', [15.75, 19.6], { params: { diametro: 2.4, bracos: 10 }, rotation: 0, blocks: { move: false, sight: false }, ...em });

    // Suíte, banho e saleta.
    k.objeto('tapete.persa', [13.5, 5.6], { params: { largura: 4.2, altura: 3, material: 'tapete.marinho', desenho: 2 }, rotation: 0, ...em });
    k.objeto('cama.dossel', [13.5, 3.3], { params: { tecido: 'tecido.veludo-vinho' }, rotation: N, ...em });
    k.objeto('comoda', [11.2, 1.95], { rotation: N, ...em }); k.objeto('comoda', [15.8, 1.95], { rotation: N, ...em });
    k.objeto('guarda-roupa.liso', [9.45, 5.0], { rotation: O, params: { largura: 1.8 }, ...em });
    k.objeto('poltrona.capitone', [16.6, 7.6], { params: { estofado: 'tecido.veludo-vinho' }, rotation: S + 0.4, ...em });
    k.objeto('luminaria.franja', [10.0, 8.2], em);
    k.objeto('banheira.pes', [20.25, 2.4], { rotation: N, ...em }); k.objeto('pia.pedestal', [18.6, 3.9], { rotation: S, ...em }); k.objeto('vaso.sanitario', [22.0, 3.9], { rotation: L, ...em });
    k.objeto('tapete.redondo', [20.25, 6.9], { params: { diametro: 2.6, material: 'tapete.creme' }, rotation: 0, ...em });
    k.objeto('mesinha', [20.25, 6.9], em); k.objeto('poltrona.capitone', [19.0, 7.8], { rotation: S - 0.6, ...em }); k.objeto('poltrona.capitone', [21.5, 7.8], { rotation: S + 0.6, ...em });

    // Biblioteca de cima.
    estantes(k, [[24.6, 1.95], [26.9, 1.95], [29.2, 1.95]], N, CIMA);
    estantes(k, [[31.05, 4.6], [31.05, 7.4]], L, CIMA);
    k.objeto('mesa.retangular', [26.6, 6.0], { params: { largura: 2.6, profundidade: 1.1, madeira: 'madeira.escura' }, rotation: L, ...em });
    for (const [x, y, r] of [[25.6, 5.1, O], [25.6, 6.9, O], [27.6, 5.1, L], [27.6, 6.9, L]] as const) k.objeto('cadeira', [x, y], { rotation: r, params: { estofado: 'tecido.veludo-azul' }, ...em });
    k.objeto('luminaria.franja', [23.4, 9.6], em);

    // Quartos e sala íntima do leste.
    k.objeto('tapete.redondo', [27.4, 12.75], { params: { diametro: 2.2, material: 'tapete.persa' }, rotation: 0, ...em });
    k.objeto('cama.casal', [30.3, 12.75], { rotation: L, params: { cobertor: 'tecido.veludo-azul' }, ...em });
    k.objeto('comoda', [24.6, 11.0], { rotation: N, ...em }); k.objeto('luminaria.franja', [23.4, 14.4], em);
    k.objeto('tapete.persa', [27.0, 17.25], { params: { largura: 3.8, altura: 2.6, material: 'tapete.verde', desenho: 4 }, rotation: 0, ...em });
    k.objeto('sofa.capitone', [27.0, 18.9], { params: { largura: 2.4, estofado: 'tecido.verde' }, rotation: S, ...em });
    k.objeto('mesa.centro', [27.0, 17.2], { params: { largura: 1.3 }, rotation: 0, ...em });
    k.objeto('poltrona.capitone', [24.6, 16.4], { rotation: O, params: { estofado: 'tecido.mostarda' }, ...em });
    k.objeto('lareira.marmore', [30.9, 17.25], { rotation: L, params: { largura: 1.6 }, ...em });
    k.objeto('tapete.redondo', [27.2, 23.2], { params: { diametro: 2.4, material: 'tapete.creme' }, rotation: 0, ...em });
    k.objeto('cama.casal', [30.3, 23.2], { rotation: L, params: { cobertor: 'tecido.veludo-vinho' }, ...em });
    k.objeto('guarda-roupa.liso', [26.6, 26.55], { rotation: S, params: { largura: 1.8 }, ...em });
    k.objeto('escrivaninha', [23.4, 21.2], { rotation: O, ...em });

    // Banheiro, quartos do oeste e rouparia.
    k.objeto('banheira.pes', [3.0, 7.5], { rotation: O, ...em }); k.objeto('pia.pedestal', [6.6, 6.6], { rotation: N, ...em }); k.objeto('vaso.sanitario', [8.3, 6.8], { rotation: N, ...em });
    k.objeto('cama.casal', [2.6, 12.0], { rotation: O, params: { cobertor: 'tecido.salvia' }, ...em });
    k.objeto('tapete.redondo', [5.2, 12.0], { params: { diametro: 2, material: 'tapete.creme' }, rotation: 0, ...em });
    k.objeto('comoda', [7.4, 9.75], { rotation: N, ...em }); k.objeto('luminaria.franja', [8.2, 14.2], { params: { cupula: 'tecido.veludo-vinho' }, ...em });
    k.objeto('cama.solteiro', [2.4, 17.25], { rotation: O, params: { cobertor: 'tecido.veludo-azul' }, ...em });
    k.objeto('tapete.redondo', [5.0, 17.25], { params: { diametro: 1.8, material: 'tapete.azul' }, rotation: 0, ...em });
    k.objeto('bau', [7.8, 18.6], { rotation: L, ...em });
    k.objeto('cama.solteiro', [2.4, 21.6], { rotation: O, params: { cobertor: 'tecido.cinza' }, ...em });
    k.objeto('armario', [7.9, 20.4], { rotation: L, ...em }); k.objeto('cadeira', [5.6, 22.6], { rotation: 0.6, ...em });
    for (const [item, x, y, r] of [['armario', 2.2, 25.5, O], ['cesto.roupa', 5.0, 24.8, 0], ['bau', 5.4, 26.2, S], ['caixote', 7.8, 24.9, 0.3]] as const) k.objeto(item, [x, y], { rotation: r, ...em });

    // Mais vida nos quartos de cima.
    for (const [item, x, y, r] of [
      ['mesinha', 11.6, 3.2, 0], ['mesinha', 15.4, 3.2, 0], ['bau', 13.5, 5.1, S], ['casa:samambaia-a', 17.4, 2.4, 0],
      ['poltrona.capitone', 24.4, 13.6, O], ['mesinha', 30.8, 11.1, 0], ['escrivaninha', 24.0, 9.9, S],
      ['poltrona.capitone', 24.6, 24.2, O], ['mesinha', 30.9, 21.6, 0], ['mesinha', 30.9, 24.8, 0], ['comoda', 24.0, 19.95, N], ['vaso.planta', 31.0, 26.4, 0],
      ['comoda', 2.1, 9.6, O], ['mesinha', 2.4, 13.9, 0], ['casa:samambaia-b', 8.1, 10.2, 0],
      ['comoda', 2.1, 15.6, O], ['estante.piso', 7.9, 16.8, L], ['cadeira', 6.8, 18.2, 0.4],
      ['mesinha', 2.4, 23.1, 0], ['bau', 4.6, 20.0, N], ['tapete.redondo', 5.2, 21.6, 0],
    ] as const) k.objeto(item, [x, y], { rotation: r, ...em, ...(item === 'tapete.redondo' ? { params: { diametro: 1.6, material: 'tapete.verde' } } : {}) });

    // Paredes de cima.
    for (const [item, x, y, params] of [
      ['retrato.oval', 13.5, 2.0, {}], ['quadro', 9.5, 3.0, { largura: 1 }], ['espelho.grande', 17.5, 6.6, { largura: 1 }],
      ['quadros.grupo', 15.75, 9.4, {}], ['retrato.oval', 9.5, 16.0, {}], ['retrato.oval', 22.0, 16.0, {}], ['arandela', 9.5, 21.0, {}], ['arandela', 22.0, 21.0, {}],
      ['mapa.mundi', 26.6, 10.0, { largura: 1.8 }], ['quadro', 27.4, 10.9, { largura: 1.2 }], ['quadro', 27.0, 14.6, { largura: 1.4 }], ['paisagem.grande', 27.2, 26.6, { largura: 2 }],
      ['quadro', 4.0, 9.4, { largura: 1 }], ['quadro', 4.0, 15.4, { largura: 1 }], ['quadro', 4.5, 19.9, { largura: 1 }],
    ] as const) k.objeto(item, [x, y], { params: params as Record<string, unknown>, levelId: CIMA });

    // Luzes de cima.
    for (const [x, y, r] of [[15.75, 19.6, 9], [13.5, 4.5, 6], [20.25, 6.6, 4], [20.25, 2.6, 3], [4.5, 25.5, 3.5], [26.6, 6, 6], [27.4, 12.75, 5], [27, 17.25, 5], [27.2, 23.2, 5.5], [4, 7.5, 3.5], [4, 12, 4.5], [4, 17.25, 4], [4, 21.6, 4], [15.75, 10.5, 6]] as const) k.luz('lamparina', [x, y], { radius: r * 1.2, intensity: 0.45, color: '#ffd9a8', flicker: 0.04, levelId: CIMA });

    // ---------- Clima, notas ----------
    k.clima('noite', { time: '22:30', ambient: { color: '#c2cbcc', intensity: 0.92 }, interiorLight: 1, tempo: { rain: 0.35, wind: 0.3 } });
    k.acabamento(null, { vignette: 0.28, saturation: 0.82, tint: '#e8f0ee', edges: { kind: 'dark', amount: 0.25 }, glow: 0.3 });
    k.guardarClima('tarde-de-chuva', 'Tarde de chuva', 'tempestade', { time: '16:30' });
    k.notaDeComodo(hall, { leitura: 'O hall sobe dois andares. Do alto da galeria, retratos de família olham para quem entra; o lustre balança com o vento que vem da porta.', notasMestre: 'O retrato acima da escadaria esconde um cofre.' });
    k.notaDeComodo(salao, { leitura: 'O fogo estala na lareira de mármore. O piano está aberto, com uma partitura pela metade.' });
    k.notaDeComodo(biblio, { leitura: 'Estantes do chão ao teto e uma escada em caracol para o mezanino.' });
    k.notaDeComodo(escrit, { notasMestre: 'Na gaveta trancada da escrivaninha, as cartas do falecido dono da ilha.' });
    k.notaDeComodo(jantar, { leitura: 'A mesa está posta para doze, mas só onze cadeiras foram usadas.' });
    k.notas('Mansão da ilha — a família reúne os herdeiros para a leitura do testamento numa noite de tempestade. Térreo social; em cima, a galeria em volta do hall leva aos quartos.');
  },
};
