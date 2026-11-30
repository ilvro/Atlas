import type { Exemplo } from './kit.ts';

/**
 * Posto na estrada (48 × 34 m), o exemplo do moderno urbano (Q21d): um posto de beira de rodovia numa noite de chuva. No meio, a cobertura
 * das bombas, acesa, com um carro abastecendo; atrás dela, a loja de conveniência; a oeste, a lanchonete, com a viatura e o táxi parados
 * na frente; a leste, a borracharia e o estacionamento. A rodovia corta o mapa ao sul, de leste a oeste, com os postes de luz de sódio.
 * Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const postoNaEstrada: Exemplo = {
  id: 'posto-na-estrada',
  nome: 'Posto na estrada',
  descricao: 'Um posto de beira de rodovia numa noite de chuva: a cobertura acesa sobre as bombas, a loja de conveniência, a lanchonete com a viatura parada na frente, a borracharia e a estrada molhada sob os postes de sódio.',
  largura: 48,
  altura: 34,
  semente: 1994,
  construir(k) {
    k.estilo({ genre: 'moderno', palette: 'moderno' });
    k.fundo({ kind: 'solid', color: '#16181c' });
    k.base('grama.seca');

    // ---------- Terreno: o mato, o pátio, a rodovia ----------
    k.pintar('terra', { poligono: [[-2, -2], [50, -2], [50, 2.2], [-2, 3.6]], irregular: 0.6 });
    k.pintar('asfalto.rachado', { retangulo: [-2, 18.6, 14, 24.6], irregular: 0.05 });
    k.pintar('asfalto', { retangulo: [14, 9.4, 50, 24.6], irregular: 0.05 });
    k.pintar('concreto.placas', { retangulo: [13.4, 11.8, 28.6, 21.2], irregular: 0 });
    k.pintar('concreto.calcada', { retangulo: [23.2, 9, 38.5, 10.6], irregular: 0 });
    k.pintar('concreto.calcada', { retangulo: [0.6, 18, 14.2, 19.2], irregular: 0 });
    k.pintar('asfalto', { retangulo: [-2, 24.6, 50, 32.2], irregular: 0.02 });
    k.pintar('cascalho', { retangulo: [-2, 32.2, 50, 33.4], irregular: 0.4 });
    k.pintar('terra', { poligono: [[39, 12.2], [47.6, 12.2], [47.6, 13.4], [39, 13.4]], irregular: 0.3 });
    // As poças da chuva no asfalto e no pátio.
    k.presenca('poca', { retangulo: [2, 25, 46, 32] }, 0.35);
    k.presenca('poca', { retangulo: [14, 9.6, 47, 24] }, 0.3);

    // ---------- A rodovia ----------
    for (const x of [8.5, 25.5, 42.5]) {
      k.objeto('faixa-continua', [x, 28.35], { rotation: 0, params: { comprimento: 17, amarela: 1, desgaste: 0.5 } });
      k.objeto('faixa-continua', [x, 25.05], { rotation: 0, params: { comprimento: 17, amarela: 0, desgaste: 0.6 } });
      k.objeto('faixa-continua', [x, 31.7], { rotation: 0, params: { comprimento: 17, amarela: 0, desgaste: 0.6 } });
    }
    k.objeto('carro.sedan', [9.5, 30.2], { rotation: 0, params: { cor: 2, farois: 1 } });
    k.objeto('onibus', [37.0, 26.6], { rotation: Math.PI, params: { cor: 1 } });
    k.objeto('mancha-de-oleo', [28.0, 30.0], { rotation: 0.4, params: { raio: 0.9 } });
    k.objeto('bueiro', [16.0, 24.9], { rotation: 0, params: { grelha: 1 } });
    k.objeto('bueiro', [34.0, 24.9], { rotation: 0, params: { grelha: 1 } });
    // Os postes de sódio dos dois lados, com a cabeça sobre a pista.
    for (const x of [4.0, 19.0, 33.5, 46.0]) k.objeto('poste-de-rua', [x, 23.8], { rotation: Math.PI / 2 });
    for (const x of [12.0, 27.0, 41.0]) k.objeto('poste-de-rua', [x, 32.9], { rotation: -Math.PI / 2 });
    k.objeto('ponto-de-onibus', [43.2, 33.3], { rotation: Math.PI });

    // ---------- A cobertura das bombas ----------
    k.objeto('cobertura-de-posto', [21, 16.5], { rotation: 0, params: { comprimento: 14, profundidade: 8, acesa: 1 } });
    for (const [x, y] of [[18.8, 14.5], [23.2, 14.5], [18.8, 18.5], [23.2, 18.5]] as const) k.objeto('bomba-de-gasolina', [x, y], { rotation: 0 });
    k.objeto('carro.hatch', [21.2, 16.5], { rotation: 0, params: { cor: 0, farois: 1 } });
    k.objeto('carro.van', [20.2, 22.4], { rotation: Math.PI, params: { cor: 3 } });
    for (const [x, y, r] of [[16.2, 16.6, 0.7], [25.6, 12.9, 0.5], [22.4, 21.6, 0.6]] as const) k.objeto('mancha-de-oleo', [x, y], { rotation: x, params: { raio: r } });
    k.objeto('lixeira', [15.4, 14.0], { rotation: 0 });
    k.objeto('lixeira', [26.6, 19.0], { rotation: Math.PI });
    k.objeto('hidrante', [13.6, 23.2], { rotation: 0 });
    k.objeto('meio-fio', [7.2, 24.4], { rotation: 0, params: { comprimento: 13 } });
    k.objeto('meio-fio', [44.4, 24.4], { rotation: 0, params: { comprimento: 7 } });

    // ---------- A loja de conveniência ----------
    const loja = k.comodo([16, 1, 25, 6], 'posto', { nome: 'Conveniência 24h' });
    k.porta([30.75, 9], 'door', { width: 1.5, state: 'open', material: 'vidro' });
    for (const x of [26.25, 27.75, 33.75, 35.25]) k.porta([x, 9], 'window', { width: 1.2 });
    k.porta([37.5, 3.75], 'door', { width: 0.9, state: 'closed', material: 'ferro' });
    k.objeto('caixa-registradora', [27.4, 7.6], { rotation: 0 });
    for (const y of [4.3, 6.4]) k.objeto('gondola', [31.6, y], { rotation: 0, params: { comprimento: 5 } });
    k.objeto('gondola', [36.6, 5.4], { rotation: Math.PI / 2, params: { comprimento: 4 } });
    for (const x of [25.6, 27.6]) k.objeto('freezer', [x, 2.3], { rotation: 0 });
    k.objeto('maquina-de-venda', [36.6, 8.2], { rotation: Math.PI });
    k.objeto('extintor', [24.6, 4.6], { rotation: 0 });
    k.luz('lampada', [30.75, 5.2], { radius: 8, intensity: 0.85, color: '#eef2ff' });
    // Por fora: o freezer de gelo, o orelhão e a lixeira.
    k.objeto('freezer', [25.2, 9.9], { rotation: 0 });
    k.objeto('lixeira', [29.0, 9.8], { rotation: 0, params: { conteiner: 0 } });
    k.objeto('orelhao', [38.6, 10.2], { rotation: 0 });
    k.objeto('maquina-de-venda', [33.0, 9.9], { rotation: 0 });

    // ---------- A lanchonete ----------
    const lanchonete = k.comodo([1, 4, 9, 12], 'lanchonete', { nome: 'Lanchonete Parada Certa' });
    k.porta([11.25, 18], 'door', { width: 1.5, state: 'open', material: 'vidro' });
    for (const x of [3.75, 6.75, 8.25]) k.porta([x, 18], 'window', { width: 1.2 });
    for (const y of [12.75, 15.75]) k.porta([13.5, y], 'window', { width: 1.2 });
    k.porta([13.5, 7.5], 'door', { width: 0.9, state: 'closed', material: 'ferro' });
    // A cozinha no fundo e o balcão com as banquetas.
    k.objeto('fogao', [2.8, 7.0], { rotation: 0 });
    k.objeto('balcao', [5.0, 7.0], { rotation: 0 });
    k.objeto('geladeira', [7.2, 7.0], { rotation: 0 });
    k.objeto('balcao', [9.4, 7.0], { rotation: 0 });
    for (const x of [4.0, 6.2, 8.4]) k.objeto('balcao', [x, 10.0], { rotation: Math.PI });
    for (const x of [3.6, 4.8, 6.0, 7.2, 8.4, 9.6]) k.objeto('banqueta', [x, 11.3], { rotation: x });
    k.objeto('caixa-registradora', [12.4, 10.0], { rotation: Math.PI / 2 });
    // As mesas com assento estofado junto às janelas.
    for (const x of [4.4, 6.6, 8.8]) k.objeto('mesa-de-lanchonete', [x, 16.9], { rotation: Math.PI });
    for (const y of [13.0, 14.9]) k.objeto('mesa-de-lanchonete', [2.5, y], { rotation: -Math.PI / 2 });
    k.objeto('maquina-de-venda', [12.9, 16.8], { rotation: Math.PI });
    for (const y of [9.0, 14.5]) k.luz('lampada', [7.5, y], { radius: 7, intensity: 0.8 });
    // O letreiro aceso sobre a porta e a caçamba nos fundos.
    k.luz('neon-rosa', [11.25, 18.8], { radius: 4.5, intensity: 0.85 });
    k.objeto('cacamba', [4.5, 4.4], { rotation: 0.05 });
    k.objeto('lixeira', [8.6, 4.8], { rotation: 0, params: { conteiner: 1 } });

    // ---------- Na frente da lanchonete ----------
    for (const x of [2.6, 5.2, 7.8, 10.4]) k.objeto('vaga-pintada', [x, 21.6], { rotation: Math.PI / 2, params: { desgaste: 0.6 } });
    k.objeto('carro.viatura', [2.6, 21.6], { rotation: -Math.PI / 2, params: { giroflex: 0 } });
    k.objeto('carro.taxi', [7.8, 21.7], { rotation: -Math.PI / 2 });
    k.objeto('moto', [10.4, 21.4], { rotation: -Math.PI / 2 + 0.15 });

    // ---------- A borracharia ----------
    const borracharia = k.comodo([27, 2, 31, 8], 'garagem', { nome: 'Borracharia do Neno' });
    k.porta([43.5, 12], 'door', { width: 3, state: 'open', material: 'ferro' });
    k.objeto('carro.picape', [43.5, 7.6], { rotation: Math.PI / 2, params: { cor: 5 } });
    k.objeto('bancada.ferramentas', [45.7, 4.6], { rotation: Math.PI / 2 });
    k.objeto('armario-de-vestiario', [41.2, 9.6], { rotation: -Math.PI / 2, params: { portas: 3 } });
    for (const [x, y] of [[41.3, 3.9], [42.2, 4.1]] as const) k.objeto('barril', [x, y], { rotation: x });
    k.objeto('extintor', [45.9, 11.2], { rotation: 0 });
    k.objeto('caixa', [41.4, 5.6], { rotation: 0.2 });
    k.objeto('mancha-de-oleo', [43.4, 9.6], { rotation: 0.3, params: { raio: 0.8 } });
    k.luz('lampada', [43.5, 7.0], { radius: 6, intensity: 0.7 });

    // ---------- O estacionamento ----------
    for (const x of [33.4, 36.0, 38.6, 41.2, 43.8, 46.4]) k.objeto('vaga-pintada', [x, 16.8], { rotation: Math.PI / 2, params: { desgaste: 0.4 } });
    k.objeto('carro.sedan', [36.0, 16.9], { rotation: -Math.PI / 2, params: { cor: 4 } });
    k.objeto('carro.picape', [41.2, 16.7], { rotation: Math.PI / 2, params: { cor: 6 } });
    k.objeto('carro.hatch', [46.4, 16.9], { rotation: -Math.PI / 2, params: { cor: 1 } });
    k.objeto('barreira', [40.0, 13.0], { rotation: 0, params: { comprimento: 8, plastica: 0 } });
    for (const [x, y] of [[31.8, 20.6], [32.4, 21.4], [31.4, 22.0]] as const) k.objeto('cone', [x, y], { rotation: x });
    k.objeto('poste-de-rua', [38.6, 20.8], { rotation: -Math.PI / 2, params: { sodio: 0 } });

    // ---------- O mato em volta ----------
    for (const [x, y, s] of [[1.4, 1.6, 1], [15.6, 3.2, 0.9], [46.6, 1.6, 1.1], [0.8, 30.0, 0.8], [2.0, 33.2, 0.9], [46.8, 33.0, 0.8]] as const) k.objeto(s > 0.95 ? 'casa:arvore-5m' : 'casa:arvore-3m', [x, y], { rotation: x, scale: s });

    // Luz: madrugada de chuva; a cobertura, os postes de sódio e as janelas fazem as ilhas de luz.
    k.clima('noite', { time: '02:20', ambient: { color: '#5e6a80', intensity: 0.55 }, sun: { angle: 2.1, color: '#98a8c4', intensity: 0.35 }, tempo: { rain: 0.75, wind: 0.25, fog: 0.12 } });
    k.acabamento(null, { tint: '#e8eef4', saturation: 0.9, vignette: 0.3, glow: 0.65, edges: { kind: 'dark', amount: 0.25 } });
    k.guardarClima('tarde', 'Fim de tarde seco', 'tarde', { time: '17:30', tempo: { rain: 0, wind: 0.1 }, finish: { tint: '#f6ead8', saturation: 0.95, vignette: 0.22, glow: 0.3, edges: { kind: 'none', amount: 0 } } });

    k.notaDeComodo(loja, { leitura: 'Luz fria, prateleiras meio vazias e o zumbido dos freezers. O rádio atrás do caixa toca baixinho.', notasMestre: 'O caixa da madrugada viu a picape verde entrar na borracharia às duas em ponto, e ninguém saiu dela.' });
    k.notaDeComodo(lanchonete, { leitura: 'Cheiro de café requentado e fritura. Dois policiais comem em silêncio perto da janela; a chuva escorre no vidro.', notasMestre: 'Os policiais esperam alguém que vem pela rodovia; a viatura está com o rádio ligado.' });
    k.notaDeComodo(borracharia, { leitura: 'A porta de enrolar está aberta. Ferramentas espalhadas, óleo no chão, uma picape verde no elevador.', notasMestre: 'O Neno esconde na caçamba da picape o que veio no ônibus das duas.' });
    k.notas('Posto na estrada: a cobertura das bombas fica no centro, a loja de conveniência atrás dela, a lanchonete a oeste e a borracharia com o estacionamento a leste. A rodovia atravessa o sul do mapa de leste a oeste.');
  },
};
