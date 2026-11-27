import type { Ponto } from '../../src/domain/mapa.ts';
import type { Exemplo } from './kit.ts';

/**
 * Vila do átrio (48 × 36 m), o exemplo da Antiguidade (Q15d): uma domus romana à tarde, aberta para a rua ao sul.
 * Da rua para dentro: taberna e fauces, o átrio com o impluvio, o tablino e a biblioteca, o peristilo (jardim com colunata),
 * o triclínio a leste do jardim, e as termas da casa (vestiário, frigidário, caldário e a fornalha). A leste, a horta com a pérgola.
 * Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const vilaDoAtrio: Exemplo = {
  id: 'vila-do-atrio',
  nome: 'Vila do átrio',
  descricao: 'Domus romana à tarde: taberna na rua, átrio com impluvio, peristilo com colunata e jardim, triclínio posto para o banquete e as termas da casa, com o tanque frio e o quente, ao lado da horta com a pérgola.',
  largura: 48,
  altura: 36,
  semente: 1531,
  construir(k) {
    k.estilo({ genre: 'antiguidade', palette: 'fantasia' });
    k.fundo({ kind: 'solid', color: '#2a2418' });
    k.base('grama.seca');

    // ---------- Terreno: a rua de lajes ao sul, a calçada, o beco a oeste e a horta a leste ----------
    k.pintar('lajes.antigas', { retangulo: [-1, 31.4, 49, 37] });
    k.pintar('calcada', { retangulo: [-1, 30, 49, 31.6], irregular: 0.15 });
    k.pintar('terra', { poligono: [[-1, -1], [3.6, -1], [4.2, 30], [-1, 30]], irregular: 0.5 });
    k.pintar('chao.batido', { poligono: [[0.6, 4], [3.8, 3], [4.1, 29.8], [1.2, 29.8]], irregular: 0.6 });
    k.pintar('terra.sulcos', { retangulo: [39.5, 1.5, 46.5, 9], irregular: 0.25 });
    k.pintar('cascalho', { poligono: [[37.5, 10.5], [44, 10.5], [43.5, 16.5], [37.5, 17]], irregular: 0.35 });
    k.pintar('terra', { faixa: [[34, 30], [36, 24.5], [39.5, 18], [41, 12]], largura: 1.6, irregular: 0.35 });

    // O peristilo: o pórtico de lajes em volta e o jardim de grama no meio (terreno, sem cômodo: a colunata é de objetos).
    k.pintar('lajes.antigas', { retangulo: [4.5, 1.5, 22.5, 10.5] });
    k.pintar('grama', { retangulo: [7.6, 4.2, 19.4, 8.0], irregular: 0.05 });
    k.pintar('cascalho', { faixa: [[7.8, 6.1], [19.2, 6.1]], largura: 0.9 });
    k.pintar('cascalho', { faixa: [[13.5, 4.3], [13.5, 7.9]], largura: 0.9 });

    // ---------- A casa ----------
    const taberna = k.comodo([3, 16, 8, 20], 'taberna', { nome: 'Taberna', piso: 'terracota.quadrada', papel: 'alvenaria.arenito', telhado: 'casa-romana', telhadoVisivel: false });
    k.comodo([8, 16, 10, 20], 'corredor', { nome: 'Fauces', piso: 'mosaico.romano', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    const cubiculo = k.comodo([10, 16, 15, 20], 'quarto', { nome: 'Cubículo', piso: 'mosaico.romano', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    const atrio = k.comodo([3, 10, 15, 16], 'atrio', { nome: 'Átrio', piso: 'mosaico.romano', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    k.comodo([3, 7, 7, 10], 'cozinha', { nome: 'Culina', piso: 'terracota.quadrada', papel: 'alvenaria.arenito', telhado: 'casa-romana', telhadoVisivel: false });
    const tablino = k.comodo([7, 7, 11, 10], 'escritorio', { nome: 'Tablino', piso: 'mosaico.romano', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    k.comodo([11, 7, 15, 10], 'biblioteca', { nome: 'Biblioteca', piso: 'mosaico.romano', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    const triclinio = k.comodo([15, 2, 20, 8], 'triclinio', { nome: 'Triclínio', piso: 'mosaico.medalhao', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    k.comodo([15, 8, 20, 10], 'corredor', { nome: 'Pórtico das termas', piso: 'lajes.arenito', papel: 'alvenaria.arenito', telhado: 'casa-romana', telhadoVisivel: false });
    const frigidario = k.comodo([15, 10, 20, 16], 'termas', { nome: 'Frigidário', piso: 'mosaico.romano', papel: 'alvenaria.arenito', telhado: 'casa-romana', telhadoVisivel: false });
    const caldario = k.comodo([20, 10, 25, 16], 'termas', { nome: 'Caldário', piso: 'mosaico.romano', papel: 'estuque.pompeiano', telhado: 'casa-romana', telhadoVisivel: false });
    k.comodo([15, 16, 20, 20], 'sala', { nome: 'Vestiário', piso: 'lajes.arenito', papel: 'alvenaria.arenito', telhado: 'casa-romana', telhadoVisivel: false });
    k.comodo([25, 12, 28, 16], 'deposito', { nome: 'Fornalha', piso: 'lajes.arenito', papel: 'alvenaria.arenito', telhado: 'casa-romana', telhadoVisivel: false });

    // O muro do peristilo (oeste e norte) e o da horta.
    k.parede([[4.5, 10.5], [4.5, 1.5], [22.5, 1.5], [22.5, 3]], { material: 'alvenaria.arenito', thickness: 0.3 });

    // Portas: da rua ao fundo, no eixo; a taberna abre larga para a calçada.
    k.porta([13.5, 30], 'door', { width: 2.4, state: 'closed', material: 'madeira.escura' });
    k.porta([13.5, 24], 'arch', { width: 3 });
    k.porta([8.25, 30], 'arch', { width: 3 });
    k.porta([12, 27], 'door', { state: 'open' });
    k.porta([18.75, 24], 'door', { state: 'closed' });
    k.porta([13.5, 15], 'arch', { width: 3 });
    k.porta([13.5, 10.5], 'arch', { width: 3 });
    k.porta([6.75, 15], 'door', { state: 'open' });
    k.porta([19.5, 15], 'door', { state: 'open' });
    k.porta([22.5, 6.75], 'arch', { width: 3 });
    k.porta([22.5, 12.75], 'arch', { width: 1.5 });
    k.porta([23.25, 15], 'arch', { width: 1.5 });
    k.porta([26.25, 12], 'door', { state: 'open' });
    k.porta([26.25, 24], 'door', { state: 'open' });
    k.porta([26.25, 30], 'door', { state: 'closed' });
    k.porta([30, 17.25], 'arch', { width: 1.5 });
    k.porta([37.5, 19.5], 'door', { state: 'closed', material: 'madeira.escura' });
    k.porta([42, 21.75], 'door', { state: 'open' });
    for (const p of [[26.25, 3], [30, 7.5], [33.75, 24]] as const) k.porta(p as Ponto, 'window', { width: 1.2 });

    // ---------- Átrio: o impluvio no eixo, lucernas, o lararium e os bustos dos antepassados ----------
    k.objeto('impluvio', [13.5, 19.5], { rotation: 0, params: { comprimento: 4.6, largura: 3.2 } });
    for (const [x, y] of [[9.6, 17.4], [17.4, 17.4], [9.6, 21.6], [17.4, 21.6]] as const) k.objeto('lucerna', [x, y], { rotation: 0, params: { pe: 1 } });
    k.objeto('altar-de-sacrificio', [6.1, 19.5], { rotation: Math.PI / 2, scale: 0.7 });
    k.objeto('busto-em-pedestal', [5.4, 16.4], { rotation: 0 });
    k.objeto('busto-em-pedestal', [5.4, 22.6], { rotation: 0 });
    k.objeto('busto-em-pedestal', [21.6, 16.4], { rotation: Math.PI });
    k.objeto('tear-vertical', [19.6, 23.2], { rotation: Math.PI });
    k.objeto('anfora', [21.7, 21.1], { rotation: 0.4 });
    k.objeto('vaso.planta', [21.6, 18.2], { rotation: 0 });

    // ---------- Tablino, biblioteca e culina ----------
    k.objeto('escrivaninha', [13.5, 12.4], { rotation: Math.PI });
    k.objeto('cadeira.espaldar', [13.5, 13.4], { rotation: Math.PI });
    k.objeto('lucerna', [11.4, 11.4], { rotation: 0, params: { pe: 1 } });
    k.objeto('lira', [15.6, 14.4], { rotation: 0.6 });
    k.objeto('estante-de-rolos', [19.5, 11.0], { rotation: 0 });
    k.objeto('estante-de-rolos', [19.5, 14.3], { rotation: Math.PI });
    k.objeto('busto-em-pedestal', [21.8, 12.6], { rotation: Math.PI });
    k.objeto('lucerna', [17.4, 12.6], { rotation: 0, params: { pe: 1 } });
    k.objeto('lareira.pedra', [6.75, 11.2], { rotation: 0, scale: 0.9 });
    k.objeto('mesa.cavalete', [6.6, 13.6], { rotation: 0, params: { largura: 2 } });
    k.objeto('anforas-empilhadas', [9.2, 13.8], { rotation: Math.PI / 2, scale: 0.8 });
    k.objeto('pilha-de-lenha', [5.4, 13.4], { rotation: Math.PI / 2, scale: 0.8 });
    k.objeto('caldeirao', [8.4, 11.6], { rotation: 0 });

    // ---------- Peristilo: a colunata em volta do jardim, a fonte no cruzamento, estátua e canteiros ----------
    // A coluna dórica é simétrica no quarto de volta: girar cada uma tira a cara de carimbo sem mudar a colunata.
    for (let x = 7.2, i = 0; x <= 19.9; x += 3.15, i++) for (const y of [3.6, 8.6]) k.objeto('coluna.dorica', [x, y], { rotation: ((i + (y > 5 ? 1 : 0)) % 4) * Math.PI / 2, scale: 1.3, params: { altura: 4 } });
    for (const y of [6.1]) for (const x of [7.2, 19.8]) k.objeto('coluna.dorica', [x, y], { rotation: x < 10 ? Math.PI / 2 : Math.PI, scale: 1.3, params: { altura: 4 } });
    k.objeto('fonte', [13.5, 6.1], { rotation: 0, scale: 0.8 });
    k.objeto('estatua-classica', [21.0, 3.6], { rotation: Math.PI, params: { pose: 2 }, scale: 0.7 });
    k.objeto('fonte-com-mascara', [5.4, 6.1], { rotation: -Math.PI / 2 });
    for (const [x, y, r] of [[9.6, 5.0, 0], [17.4, 5.0, Math.PI], [9.6, 7.2, Math.PI], [17.4, 7.2, 0]] as const) k.objeto('canteiro', [x, y], { rotation: r, scale: 0.9 });
    for (const [x, y, s] of [[11.1, 4.7, 1], [15.9, 7.5, 1.1], [8.4, 7.6, 0.9], [18.6, 4.6, 0.9]] as const) k.objeto('casa:arbusto-florido', [x, y], { scale: s });
    k.objeto('tripe-de-bronze', [13.5, 2.5], { rotation: 0, scale: 0.8 });
    k.luz('fogueira', [13.5, 2.5], { radius: 6.5, intensity: 0.9, color: '#ffa452' });
    k.objeto('banco.jardim', [10.5, 2.4], { rotation: 0 });
    k.objeto('banco.jardim', [16.5, 2.4], { rotation: 0 });
    k.objeto('vaso.flores', [5.4, 2.4], { rotation: 0 });
    k.objeto('vaso.flores', [5.4, 9.6], { rotation: 0 });

    // ---------- Triclínio: o U de leitos com a mesa posta, lucernas, ânforas de vinho, a lira ----------
    k.objeto('triclinio', [26.25, 7.4], { rotation: Math.PI, params: { leitos: 3 } });
    k.objeto('mesa-romana', [26.25, 7.6], { rotation: 0 });
    k.objeto('lucerna', [24.0, 10.6], { rotation: 0, params: { pe: 1 } });
    k.objeto('lucerna', [28.6, 10.6], { rotation: 0, params: { pe: 1 } });
    k.objeto('anfora', [29.1, 3.8], { rotation: 0.3 });
    k.objeto('anfora', [29.1, 4.6], { rotation: 1.1 });
    k.objeto('lira', [23.6, 4.0], { rotation: -0.4 });
    k.objeto('busto-em-pedestal', [23.4, 11.2], { rotation: 0 });

    // Pórtico das termas.
    k.objeto('banco', [26.25, 12.6], { rotation: 0 });
    k.objeto('vaso.planta', [29.2, 13.6], { rotation: 0 });

    // ---------- Termas: vestiário, frigidário (tanque frio) e caldário (tanque quente, vapor), e a fornalha ----------
    k.objeto('banco.longo', [23.6, 27], { rotation: Math.PI / 2, params: { largura: 3.4 } });
    k.objeto('banco.longo', [28.9, 27], { rotation: Math.PI / 2, params: { largura: 3.4 } });
    k.objeto('cesto.roupa', [24.0, 29.0], { rotation: 0 });
    k.objeto('anfora', [28.9, 29.1], { rotation: 0.2 });
    k.objeto('tanque-de-banho', [26.25, 19.2], { rotation: 0, params: { comprimento: 5, largura: 3.6, quente: 0 } });
    k.objeto('fonte-com-mascara', [26.25, 15.5], { rotation: 0 });
    k.objeto('lucerna', [23.4, 16.2], { rotation: 0, params: { pe: 1 } });
    k.objeto('lucerna', [29.1, 16.2], { rotation: 0, params: { pe: 1 } });
    k.objeto('banco', [23.4, 22.8], { rotation: 0 });
    k.objeto('estatua-classica', [29.0, 22.9], { rotation: 0, params: { pose: 0 }, scale: 0.55 });
    k.objeto('tanque-de-banho', [33.75, 19.6], { rotation: 0, params: { comprimento: 5.4, largura: 4.2, quente: 1 } });
    k.objeto('lucerna', [31.2, 16.2], { rotation: 0, params: { pe: 1 } });
    k.objeto('lucerna', [36.4, 23.0], { rotation: 0, params: { pe: 1 } });
    k.objeto('anfora', [36.6, 16.2], { rotation: 0 });
    k.objeto('braseiro', [39.75, 21.6], { scale: 1.6 });
    k.luz('fogueira', [39.75, 21.6], { radius: 5, intensity: 1.1, color: '#ff9a48' });
    k.objeto('pilha-de-lenha', [39.75, 18.9], { rotation: 0 });

    // ---------- Taberna e cubículo ----------
    k.objeto('banca-de-mercado.toldo', [8.25, 31.9], { rotation: 0, params: { paleta: 0 } });
    k.objeto('mesa-romana', [6.4, 26.4], { rotation: 0 });
    k.objeto('banco', [6.4, 27.5], { rotation: 0 });
    k.objeto('anforas-empilhadas', [10.4, 25.4], { rotation: 0 });
    k.objeto('pithos', [5.8, 28.9], { rotation: 0, scale: 0.8 });
    k.objeto('lucerna', [9.4, 27.3], { rotation: 0, params: { pe: 0 } });
    k.objeto('cama.solteiro', [19.9, 26.8], { rotation: Math.PI / 2 });
    k.objeto('bau', [16.2, 25.0], { rotation: 0 });
    k.objeto('lucerna', [16.2, 28.9], { rotation: 0, params: { pe: 1 } });

    // ---------- Horta e jardim a leste ----------
    k.objeto('pergolado-com-videira', [41.2, 13.6], { rotation: 0 });
    k.objeto('mesa-romana', [40.6, 13.9], { rotation: 0, scale: 0.9 });
    k.objeto('banco.jardim', [42.4, 15.6], { rotation: Math.PI });
    // Os canteiros da horta, feitos à mão: cada um um pouco fora do alinhamento e virado para um lado.
    [[40.4, 2.6], [43.1, 2.7], [45.5, 2.5], [40.6, 5.3], [42.9, 5.1], [45.6, 5.3], [40.5, 7.9], [43.0, 7.7], [45.4, 7.8]].forEach(([x, y], i) => k.objeto('canteiro', [x!, y!], { rotation: (i % 2 ? Math.PI : 0) + (i % 3 - 1) * 0.03, scale: 0.95 }));
    k.objeto('poco', [36.4, 7.6], { rotation: 0 });
    k.objeto('pithos', [34.2, 10.4], { rotation: 0 });
    k.objeto('pithos', [35.6, 11.4], { rotation: 0, scale: 0.85 });
    for (const [x, y, s] of [[33.2, 2.4, 1.15], [46.6, 12.8, 1], [46.2, 19.4, 1.1], [32.6, 27.4, 0.9]] as const) k.objeto('casa:pinheiro-4m', [x, y], { scale: s });
    for (const [x, y] of [[44.6, 25.6], [47, 27.4], [38.2, 27.8]] as const) k.objeto('casa:arvore-3m', [x, y], { scale: 1 });
    for (const [x, y, s] of [[31.6, 13.6, 0.9], [44.8, 21.8, 1], [2.2, 8.6, 0.8], [2.4, 18.4, 0.8], [36.4, 3.6, 0.9]] as const) k.objeto('casa:arbusto-verde', [x, y], { scale: s });
    for (const [x, y] of [[38.6, 25.3], [47, 23], [2.4, 26.4], [1.6, 13]] as const) k.objeto('tufo-de-capim', [x, y], { scale: 1.2 });

    // ---------- A rua: a fonte da esquina, a biga com o cavalo e a carga de ânforas ----------
    k.objeto('fonte', [42.6, 32.9], { rotation: 0, scale: 0.9 });
    k.objeto('biga', [31.4, 34.0], { rotation: 0 });
    k.objeto('cavalo', [28.4, 34.0], { rotation: Math.PI, scale: 1.3 });
    k.objeto('anforas-empilhadas', [19.6, 31.9], { rotation: 0, scale: 0.9 });
    k.objeto('anfora', [17.8, 32.2], { rotation: 0.6 });
    k.objeto('carroca', [4.4, 34.2], { rotation: 0 });

    // Luz: a tarde de verão, quente e baixa; dentro, a meia-luz das casas romanas.
    k.clima('tarde', { time: '16:40', interiorLight: 0.62, tempo: { rain: 0, snow: 0, fog: 0, wind: 0.1, dust: 0.08 } });
    k.acabamento('quente', { vignette: 0.2, edges: { kind: 'none', amount: 0 } });
    k.guardarClima('ceia', 'Ceia à luz das lucernas', 'noite', { time: '21:30' });

    k.notaDeComodo(atrio, { leitura: 'A luz entra pelo compluvio e cai no tanque. Os bustos dos antepassados olham da penumbra; no lararium, ainda fuma o incenso da manhã.', notasMestre: 'Sob a laje solta ao pé do lararium, o dono guarda as tabuinhas do testamento.' });
    k.notaDeComodo(triclinio, { leitura: 'Três leitos em U, almofadas de púrpura e a mesa posta: uvas, pão e uma jarra de vinho ainda cheia.' });
    k.notaDeComodo(caldario, { leitura: 'O ar é quente e úmido; o vapor sobe do tanque e embaça as pinturas da parede.', notasMestre: 'A fornalha ao lado dá acesso aos túneis do hipocausto, por onde se chega à adega sem passar pela casa.' });
    k.notaDeComodo(frigidario, { leitura: 'Água fria e limpa sobre golfinhos de mosaico; a bica de leão verte sem parar.' });
    k.notaDeComodo(tablino, { leitura: 'O escritório do dono, aberto para o átrio e para o jardim: a mesa, os rolos de contas e uma lira encostada.' });
    k.notaDeComodo(taberna, { leitura: 'O balcão dá para a rua; dos dólios vem cheiro de azeitona e vinho resinado.' });
    k.notaDeComodo(cubiculo, { leitura: 'Um quarto estreito, com a cama, o baú e a lucerna apagada.' });
    k.notas('Vila do átrio — a casa de um mercador de vinho na cidade. Entra-se pela rua ao sul; o jardim do peristilo e as termas ficam no fundo, longe do barulho.');
  },
};
