import type { Exemplo } from './kit.ts';

/**
 * Beco de néon (36 × 30 m), o exemplo do cyberpunk (Q23d): um beco molhado entre dois quarteirões, aberto para a avenida ao sul.
 * A oeste, o hotel de cápsulas e o bar; a leste, o covil do hacker e a clínica clandestina, que só se entra pelo beco.
 * No meio do beco, a barraca de lámen; letreiros de fachada dos dois lados, o drone de vigia, a caçamba no fundo e o pátio das
 * antenas atrás do covil. Na avenida, o táxi parado de faróis acesos, os postes de telas e o holograma da carpa na boca do beco.
 * Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const becoDeNeon: Exemplo = {
  id: 'beco-de-neon',
  nome: 'Beco de néon',
  descricao: 'Um beco molhado de chuva entre o bar e o hotel de cápsulas, com a barraca de lámen acesa no meio, letreiros dos dois lados, um drone de vigia e a porta dos fundos da clínica clandestina.',
  largura: 36,
  altura: 30,
  semente: 2077,
  construir(k) {
    k.estilo({ genre: 'cyberpunk', palette: 'moderno' });
    k.fundo({ kind: 'solid', color: '#0d0c14' });
    k.base('asfalto');

    // ---------- Terreno: a avenida, a calçada, o beco e o pátio ----------
    k.pintar('concreto.calcada', { retangulo: [-2, 20.6, 38, 24], irregular: 0 });
    k.pintar('asfalto.rachado', { retangulo: [15, -2, 21, 20.6], irregular: 0.04 });
    k.pintar('concreto.placas', { retangulo: [28.5, -2, 38, 12], irregular: 0 });
    k.pintar('asfalto.rachado', { retangulo: [-2, 10.5, 15, 12], irregular: 0.04 });
    k.pintar('asfalto.rachado', { retangulo: [21, 9, 38, 12], irregular: 0.04 });
    k.presenca('poca', { retangulo: [15.2, 0, 20.8, 21] }, 0.5);
    k.presenca('poca', { retangulo: [0, 24.2, 36, 30] }, 0.4);
    k.presenca('poca', { retangulo: [21, 0, 36, 12] }, 0.3);

    // ---------- A avenida ----------
    for (const x of [6, 18, 30]) k.objeto('faixa-continua', [x, 27.1], { rotation: 0, params: { comprimento: 12, amarela: 1, desgaste: 0.4 } });
    k.objeto('meio-fio', [7.5, 24.1], { rotation: 0, params: { comprimento: 15 } });
    k.objeto('meio-fio', [28.5, 24.1], { rotation: 0, params: { comprimento: 15 } });
    k.objeto('carro.taxi', [9.2, 25.6], { rotation: 0, params: { farois: 1 } });
    k.objeto('carro.sedan', [27.5, 28.6], { rotation: Math.PI, params: { cor: 0, farois: 1 } });
    k.objeto('moto', [23.4, 25.2], { rotation: -0.3, params: { cor: 1 } });
    k.objeto('bueiro', [14.2, 24.5], { rotation: 0, params: { grelha: 1 } });
    k.objeto('bueiro', [31.0, 24.5], { rotation: 0, params: { grelha: 1 } });
    k.objeto('mancha-de-oleo', [20.0, 26.0], { rotation: 0.6, params: { raio: 0.8 } });
    // Os postes de telas na calçada e o holograma da carpa na boca do beco.
    k.objeto('poste-com-telas', [12.6, 23.2], { rotation: 0, params: { cor: 0 } });
    k.objeto('poste-com-telas', [33.0, 23.2], { rotation: 0, params: { cor: 1 } });
    k.objeto('holograma', [18.0, 22.4], { rotation: 0, params: { cor: 0, forma: 2 } });
    k.objeto('hidrante', [21.6, 23.4], { rotation: 0 });
    k.objeto('lixeira', [3.0, 23.5], { rotation: 0 });

    // ---------- O hotel de cápsulas (noroeste) ----------
    const hotel = k.comodo([1, 1, 10, 7], 'hotel-capsula', { nome: 'Hotel Colmeia' });
    k.porta([15, 6.75], 'door', { width: 1.5, state: 'open', material: 'vidro' });
    for (const [x, n] of [[4.4, 4], [9.6, 4]] as const) k.objeto('capsula-de-hotel', [x, 2.85], { rotation: 0, params: { colunas: n } });
    k.objeto('capsula-de-hotel', [5.6, 9.15], { rotation: Math.PI, params: { colunas: 3 } });
    k.objeto('capsula-de-hotel', [9.6, 9.15], { rotation: Math.PI, params: { colunas: 2, aceso: 0 } });
    for (const y of [5.0, 6.2, 7.4]) k.objeto('armario-de-vestiario', [1.95, y], { rotation: -Math.PI / 2, params: { portas: 2 } });
    k.objeto('maquina-de-venda.neon', [13.0, 9.9], { rotation: Math.PI, params: { cor: 5 } });
    k.objeto('bebedouro.galao', [14.4, 4.4], { rotation: Math.PI / 2 });
    for (const x of [5.4, 9.0]) k.objeto('banco', [x, 6.0], { rotation: 0 });
    k.objeto('extintor', [14.5, 2.0], { rotation: 0 });
    k.objeto('armario-de-vestiario', [1.95, 8.6], { rotation: -Math.PI / 2, params: { portas: 2 } });
    k.objeto('caixa', [13.6, 7.6], { rotation: 0.3 });
    k.objeto('banco', [3.8, 7.2], { rotation: Math.PI / 2 });
    k.objeto('letreiro-neon', [8.25, 10.2], { rotation: Math.PI, params: { cor: 5, forma: 0 } });

    // ---------- O bar (sudoeste) ----------
    const bar = k.comodo([1, 8, 10, 14], 'bar', { nome: 'Bar Carpa Elétrica', piso: 'grade.cyber' });
    k.porta([6.75, 21], 'door', { width: 1.5, state: 'open', material: 'vidro' });
    for (const x of [3.0, 11.25]) k.porta([x, 21], 'window', { width: 1.5 });
    k.porta([15, 18.75], 'door', { width: 0.9, state: 'closed', material: 'ferro' });
    k.objeto('balcao-luminoso', [7.2, 12.85], { rotation: 0, params: { cor: 1, comprimento: 6 } });
    for (const x of [5.0, 6.5, 8.0, 9.5]) k.objeto('banqueta', [x, 14.4], { rotation: 0 });
    for (const y of [15.6, 18.4]) k.objeto('mesa-de-lanchonete', [2.6, y], { rotation: -Math.PI / 2 });
    k.objeto('mesa.redonda', [8.6, 17.6], { rotation: 0, scale: 0.8 });
    for (const [cx, cy] of [[8.6, 17.6], [11.4, 18.8], [6.0, 18.8]] as const) {
      if (cx !== 8.6) k.objeto('mesa.redonda', [cx, cy], { rotation: 0, scale: 0.8 });
      for (const a of [0.4, 2.5, 4.6]) k.objeto('cadeira', [cx + Math.cos(a) * 0.9, cy + Math.sin(a) * 0.9], { rotation: a + Math.PI / 2 });
    }
    k.objeto('sofa.canto', [12.8, 15.2], { rotation: Math.PI / 2 });
    for (const x of [12.6, 13.8]) k.objeto('fliperama', [x, 12.65], { rotation: 0, params: { cor: x > 13 ? 0 : 1 } });
    k.objeto('fliperama', [14.45, 15.0], { rotation: Math.PI / 2, params: { cor: 2 } });
    k.objeto('maquina-de-venda.neon', [14.45, 16.4], { rotation: Math.PI / 2, params: { cor: 0 } });
    k.objeto('letreiro-neon', [3.0, 12.3], { rotation: 0, params: { cor: 0, forma: 4 } });
    k.objeto('letreiro-neon.rua', [6.75, 21.6], { rotation: 0, params: { cor: 1, forma: 4 } });

    // ---------- O beco ----------
    // O fundo: um muro, a caçamba e os sacos de lixo; a barraca de lámen no meio, encostada no bar.
    k.parede([[15, 1.5], [21, 1.5]], { height: 3 });
    k.objeto('cacamba', [17.4, 2.6], { rotation: 0.05 });
    k.objeto('lixeira', [19.8, 2.4], { rotation: 0.1, params: { conteiner: 1 } });
    k.objeto('lixeira', [15.9, 11.2], { rotation: -Math.PI / 2, params: { conteiner: 1 } });
    for (const [x, y, r] of [[19.9, 13.9, 0.2], [20.3, 14.8, 0.6]] as const) k.objeto('caixote', [x, y], { rotation: r });
    k.objeto('barraca-de-lamen', [16.25, 16.4], { rotation: -Math.PI / 2 });
    for (const y of [15.6, 17.2]) k.objeto('banqueta', [18.2, y], { rotation: 0 });
    k.objeto('drone', [18.6, 8.2], { rotation: 0.7, params: { holofote: 1 } });
    k.objeto('quadro-de-cabos', [21.45, 4.4], { rotation: Math.PI / 2 });
    k.objeto('maquina-de-venda.neon', [15.6, 8.6], { rotation: -Math.PI / 2, params: { cor: 2 } });
    // Os letreiros de fachada, dos dois lados do beco.
    k.objeto('letreiro-neon.rua', [15.55, 4.4], { rotation: -Math.PI / 2, params: { cor: 5, forma: 0 } });
    k.objeto('letreiro-neon.rua', [15.55, 13.2], { rotation: -Math.PI / 2, params: { cor: 1, forma: 2 } });
    k.objeto('letreiro-neon.rua', [20.45, 7.6], { rotation: Math.PI / 2, params: { cor: 0, forma: 3 } });
    k.objeto('letreiro-neon.rua', [20.45, 16.8], { rotation: Math.PI / 2, params: { cor: 2, forma: 5 } });

    // ---------- O covil do hacker (nordeste) ----------
    const covil = k.comodo([14, 1, 19, 6], 'sala-de-servidores', { nome: 'Covil da Lâmina' });
    k.porta([21, 7.5], 'door', { width: 0.9, state: 'locked', material: 'ferro' });
    for (const x of [22.8, 25.0]) k.objeto('rack-de-servidores', [x, 2.3], { rotation: 0, params: { racks: 3 } });
    k.objeto('gaiola-de-cabos', [27.0, 7.4], { rotation: Math.PI / 2, params: { comprimento: 2.4, profundidade: 1.6 } });
    k.objeto('estacao-hacker', [24.4, 7.95], { rotation: Math.PI, params: { cor: 0, telas: 6 } });
    k.objeto('colchao-no-chao', [27.4, 3.4], { rotation: Math.PI / 2 });
    k.luz('neon', [25.0, 5.0], { radius: 5.5, intensity: 0.45 });
    k.objeto('extintor', [21.5, 2.0], { rotation: 0 });
    for (const [x, y, r] of [[22.2, 5.4, 0.2], [22.4, 6.6, 0.9]] as const) k.objeto('caixa', [x, y], { rotation: r });

    // ---------- O pátio das antenas ----------
    k.objeto('antena-parabolica', [31.6, 4.2], { rotation: 0.6, params: { diametro: 2.4 } });
    k.objeto('antena-parabolica', [34.4, 8.6], { rotation: 2.4, params: { diametro: 1.2 } });
    k.objeto('gaiola-de-cabos', [32.6, 9.6], { rotation: 0, params: { comprimento: 3, profundidade: 1.6 } });
    k.objeto('cacamba', [25.6, 10.4], { rotation: 0 });
    k.objeto('pilha-de-caixotes', [29.6, 10.6], { rotation: 0.2 });
    k.objeto('poste-de-rua', [34.4, 6.0], { rotation: Math.PI, params: { sodio: 0 } });

    // ---------- A clínica clandestina (sudeste): a frente fechada, a entrada pelo beco ----------
    const clinica = k.comodo([14, 8, 23, 14], 'clinica-clandestina', { nome: 'Clínica da Doutora Vex' });
    k.porta([21, 14.25], 'door', { width: 0.9, state: 'closed', material: 'ferro' });
    k.porta([27.75, 21], 'door', { width: 1.5, state: 'locked', material: 'ferro' });
    k.objeto('cadeira-de-implante', [28.2, 16.0], { rotation: 0 });
    k.objeto('cama-hospitalar', [32.6, 14.2], { rotation: 0 });
    k.objeto('cama-hospitalar', [32.6, 18.6], { rotation: Math.PI });
    k.objeto('rack-de-servidores', [24.2, 12.8], { rotation: 0, params: { racks: 1 } });
    k.objeto('estacao-hacker', [24.6, 19.6], { rotation: Math.PI, params: { cor: 2, telas: 3 } });
    k.objeto('armario.metal', [26.4, 12.6], { rotation: 0 });
    k.objeto('mesa.laboratorio', [29.8, 12.9], { rotation: 0 });
    k.luz('lampada', [30.0, 16.5], { radius: 7, intensity: 0.5, color: '#d8ecff' });
    k.objeto('armario.amostras', [22.0, 15.0], { rotation: -Math.PI / 2 });
    k.objeto('bancada.ferramentas', [22.0, 17.6], { rotation: -Math.PI / 2 });
    k.objeto('cadeira', [26.4, 16.6], { rotation: Math.PI / 2 });
    k.objeto('extintor', [34.0, 12.5], { rotation: 0 });
    for (const x of [28.6, 30.0, 31.4]) k.objeto('cadeira', [x, 20.4], { rotation: Math.PI });
    k.objeto('caixa', [33.8, 16.4], { rotation: 0.2 });
    k.objeto('armario.metal', [27.8, 12.6], { rotation: 0 });
    k.objeto('letreiro-neon', [33.0, 20.7], { rotation: Math.PI, params: { cor: 2, forma: 5 } });
    k.objeto('letreiro-neon.rua', [24.0, 21.6], { rotation: 0, params: { cor: 3, forma: 0, aceso: 0 } });

    // Luz: madrugada de chuva; de tarde, o smog amarelo.
    k.clima('neon', { time: '01:40', ambient: { color: '#3c3a66', intensity: 0.45 }, sun: { angle: 2.2, color: '#8c92cc', intensity: 0.25 }, tempo: { rain: 0.8, wind: 0.3, fog: 0.14 }, interiorLight: 0.3 });
    k.acabamento(null, { tint: '#e2dcf2', saturation: 1.05, vignette: 0.32, glow: 0.9, edges: { kind: 'dark', amount: 0.25 } });
    k.guardarClima('smog', 'Tarde de smog', 'tarde', { time: '16:40', ambient: { color: '#c8bc8e', intensity: 0.85 }, sun: { angle: 2.5, color: '#e8c88a', intensity: 0.7 }, tempo: { rain: 0, wind: 0.1, fog: 0.3 }, finish: { tint: '#efe4c4', saturation: 0.85, vignette: 0.25, glow: 0.35, edges: { kind: 'dark', amount: 0.15 } } });

    k.notaDeComodo(hotel, { leitura: 'Corredor estreito, cheiro de desinfetante e o zumbido das cápsulas. Cada boca tem uma cortina de enrolar e um número que ninguém lê.', notasMestre: 'A cápsula 41 está paga por um ano e nunca abriu. Dentro, um corpo em coma ligado a um cabo que sai pela parede para o covil do outro lado do beco.' });
    k.notaDeComodo(bar, { leitura: 'O balcão acende em magenta sob os copos; os fliperamas piscam no canto e a chuva escorre pela vitrine.', notasMestre: 'O barman Okoye vende acesso à clínica: quem pede “o prato do dia” recebe um cartão com o horário da porta dos fundos.' });
    k.notaDeComodo(covil, { leitura: 'Racks do chão ao teto, um colchão no canto e seis telas sobre a mesa. O ar condicionado ruge mais alto que a chuva.', notasMestre: 'A Lâmina vigia o beco pelo drone e pelas câmeras dos postes. Ela sabe quem entrou na clínica esta noite, e cobra pela informação.' });
    k.notaDeComodo(clinica, { leitura: 'Azulejo branco, luz fria e a cadeira no meio, com o braço mecânico dobrado sobre ela. A frente para a avenida está trancada há meses.', notasMestre: 'A Doutora Vex instala qualquer coisa, sem perguntas. A peça de cromo na bandeja é de um policial desaparecido, e o número de série ainda está nela.' });
    k.notas('Beco de néon: um beco molhado entre dois quarteirões, aberto para a avenida ao sul. A oeste, o Hotel Colmeia (cápsulas) e o Bar Carpa Elétrica; a leste, o covil da Lâmina e a clínica clandestina da Doutora Vex, que se entra pela porta de ferro do beco. A barraca de lámen fica no meio do beco; o drone ronda o fundo, onde está a caçamba.');
  },
};
