import type { Exemplo } from './kit.ts';

/**
 * Posto avançado (48 × 34 m), o exemplo do pós-apocalíptico (Q22d): o Posto na estrada (Q21d) anos depois, abandonado, cercado e habitado.
 * A planta é a mesma: a cobertura das bombas no meio, agora apagada e com o fogo do acampamento embaixo; a loja de conveniência virou o
 * armazém; a lanchonete, a enfermaria; a borracharia, a oficina de sucata; o estacionamento, a horta e as barracas. Uma cerca de arame
 * fecha tudo, com a guarita no portão e a torre de vigia na quina. Na rodovia, ao sul, o ônibus tombado e as carcaças.
 * Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const postoAvancado: Exemplo = {
  id: 'posto-avancado',
  nome: 'Posto avançado',
  descricao: 'O posto da rodovia, anos depois: cercado de arame, com a guarita no portão, o fogo do acampamento sob a cobertura apagada, a enfermaria na velha lanchonete, a horta em pneus no estacionamento e o ônibus tombado na estrada.',
  largura: 48,
  altura: 34,
  semente: 2031,
  construir(k) {
    k.estilo({ genre: 'pos-apocaliptico', palette: 'moderno' });
    k.fundo({ kind: 'solid', color: '#17150f' });
    k.base('grama.seca');

    // ---------- Terreno: o asfalto rachado que o mato come ----------
    k.pintar('terra', { poligono: [[-2, -2], [50, -2], [50, 2.6], [-2, 4]], irregular: 0.7 });
    k.pintar('asfalto.rachado', { retangulo: [-2, 18.6, 14, 24.6], irregular: 0.15 });
    k.pintar('asfalto.rachado', { retangulo: [14, 9.4, 50, 24.6], irregular: 0.15 });
    k.pintar('concreto.rachado', { retangulo: [13.4, 11.8, 28.6, 21.2], irregular: 0.05 });
    k.pintar('concreto.rachado', { retangulo: [23.2, 9, 38.5, 10.6], irregular: 0.1 });
    k.pintar('asfalto.rachado', { retangulo: [-2, 24.6, 50, 32.2], irregular: 0.1 });
    k.pintar('cascalho', { retangulo: [-2, 32.2, 50, 33.4], irregular: 0.5 });
    // A terra batida do acampamento, sob a cobertura e no estacionamento, e o entulho junto das paredes.
    k.pintar('terra.batida', { poligono: [[15, 13], [27, 13], [28, 20.5], [14.5, 20.5]], irregular: 0.5 });
    k.pintar('terra.batida', { poligono: [[31.5, 13.6], [47.6, 13.4], [47.6, 23.4], [31, 23.4]], irregular: 0.6 });
    k.pintar('entulho', { poligono: [[0.8, 3.4], [10, 3.2], [10, 5.6], [0.8, 5.8]], irregular: 0.6 });
    k.pintar('entulho', { poligono: [[38.6, 1.4], [47.6, 1.4], [47.6, 2.8], [38.6, 3]], irregular: 0.6 });
    // O mato que rompe o asfalto: faixas e ilhas de grama.
    for (const [x0, y0, x1, y1] of [[-2, 23.4, 14, 25.2], [6, 27.2, 22, 28.6], [34, 30.4, 50, 32.6], [28, 9.6, 32, 11.4], [-2, 30.8, 6, 32.4], [44, 24.2, 50, 26]] as const) {
      k.pintar('grama.seca', { retangulo: [x0, y0, x1, y1], irregular: 0.9 });
    }
    k.presenca('fuligem', { retangulo: [18.5, 14, 23.5, 19] }, 0.6);
    k.presenca('fuligem', { retangulo: [1.5, 15.5, 6, 18] }, 0.4);
    k.presenca('poca', { retangulo: [10, 25, 30, 32] }, 0.15);

    // ---------- A rodovia, morta ----------
    for (const x of [8.5, 25.5, 42.5]) {
      k.objeto('faixa-continua', [x, 28.35], { rotation: 0, params: { comprimento: 17, amarela: 1, desgaste: 0.9 } });
      k.objeto('faixa-continua', [x, 31.7], { rotation: 0, params: { comprimento: 17, amarela: 0, desgaste: 0.95 } });
    }
    // O ônibus das duas, tombado de través na pista; as carcaças que ficaram.
    k.objeto('onibus-tombado', [33.5, 27.6], { rotation: 0.12 });
    k.objeto('carro.enferrujado', [9.8, 30.0], { rotation: 0.35, params: { modelo: 0, cor: 2 } });
    k.objeto('carro.enferrujado', [44.2, 30.2], { rotation: Math.PI - 0.5, params: { modelo: 3, cor: 3 } });
    k.objeto('carro.enferrujado', [22.6, 31.2], { rotation: Math.PI + 0.15, params: { modelo: 1, cor: 4 } });
    k.objeto('pneus-empilhados', [26.6, 26.4], { rotation: 0.4 });
    k.objeto('barricada', [5.0, 27.0], { rotation: 0.08, params: { comprimento: 6 } });
    k.objeto('mancha-de-oleo', [28.0, 30.0], { rotation: 0.4, params: { raio: 1.1 } });
    k.objeto('bueiro', [16.0, 24.9], { rotation: 0, params: { grelha: 0 } });
    // Os postes do lado sul, apagados; um caído.
    for (const x of [12.0, 41.0]) k.objeto('poste-de-rua', [x, 32.9], { rotation: -Math.PI / 2, params: { acesa: 0 } });
    k.objeto('poste-de-rua', [27.6, 31.6], { rotation: -Math.PI / 2 + 0.55, params: { acesa: 0 } });
    k.objeto('ponto-de-onibus', [43.2, 33.3], { rotation: Math.PI, params: { aceso: 0 } });
    k.objeto('placa-pichada', [3.2, 25.6], { rotation: 0, params: { desenho: 2 } });

    // ---------- A cerca e o portão ----------
    // Ao norte, a oeste e a leste, a cerca de arame com concertina; ao sul, voltada para a rodovia, com o portão diante da cobertura.
    for (const x of [8.4, 24, 39.6]) k.objeto('cerca-de-arame-farpado', [x, 0.7], { rotation: Math.PI, params: { comprimento: 15.6 } });
    k.objeto('cerca-de-arame-farpado', [0.5, 12.2], { rotation: -Math.PI / 2, params: { comprimento: 20 } });
    k.objeto('cerca-de-arame-farpado', [47.5, 12.2], { rotation: Math.PI / 2, params: { comprimento: 20 } });
    k.objeto('cerca-de-arame-farpado', [6.9, 24.1], { rotation: 0, params: { comprimento: 13 } });
    k.objeto('cerca-de-arame-farpado', [34.4, 24.1], { rotation: 0, params: { comprimento: 26 } });
    // O portão: a guarita a oeste, a barricada de correr meio aberta e os sacos de areia.
    const guarita = k.comodo([9, 14, 11, 16], 'posto-de-guarda', { nome: 'Guarita' });
    k.porta([15.0, 24], 'door', { width: 0.9, state: 'open', material: 'ferro' });
    k.porta([16.5, 22.5], 'window', { width: 1.2 });
    k.objeto('caixa-de-suprimentos', [15.6, 21.0], { rotation: 0.1, params: { aberta: 0 } });
    k.objeto('cadeira', [15.4, 22.8], { rotation: Math.PI / 2 });
    k.objeto('barricada', [19.6, 25.0], { rotation: 0.06, params: { comprimento: 4 } });
    k.objeto('sacos-de-areia', [17.6, 23.0], { rotation: Math.PI / 2, params: { comprimento: 2.4 } });
    k.objeto('sacos-de-areia', [22.6, 23.0], { rotation: Math.PI / 2, params: { comprimento: 2.4 } });
    k.objeto('tonel-com-fogo', [18.6, 21.8], { rotation: 0 });
    k.objeto('placa-pichada', [22.8, 25.6], { rotation: 0, params: { desenho: 0 } });
    k.luz('lampada', [15.0, 22.4], { radius: 3.5, intensity: 0.45, color: '#ffcf8a' });
    // A torre de vigia na quina sudeste, sobre a rodovia.
    k.objeto('torre-de-vigia', [45.6, 21.8], { rotation: Math.PI });

    // ---------- Sob a cobertura: o fogo do acampamento ----------
    k.objeto('cobertura-de-posto', [21, 16.5], { rotation: 0, params: { comprimento: 14, profundidade: 8, acesa: 0 } });
    for (const [x, y] of [[18.8, 14.5], [23.2, 14.5], [18.8, 18.5], [23.2, 18.5]] as const) k.objeto('bomba-de-gasolina', [x, y], { rotation: 0, params: { acesa: 0 } });
    k.objeto('tonel-com-fogo', [21.0, 16.5], { rotation: 0 });
    for (const [x, y, r] of [[19.6, 16.0, 1.2], [22.4, 17.1, -1.9]] as const) k.objeto('colchao-no-chao', [x, y], { rotation: r, scale: 0.8 });
    k.objeto('fogareiro', [21.2, 20.0], { rotation: 0 });
    k.objeto('caixa-de-suprimentos', [24.6, 16.6], { rotation: Math.PI / 2 });
    k.objeto('barraca-improvisada', [15.4, 16.5], { rotation: -Math.PI / 2, params: { lona: 0 } });
    k.objeto('barraca-improvisada', [26.6, 16.5], { rotation: Math.PI / 2, params: { lona: 2 } });

    // ---------- O armazém (a loja de conveniência) ----------
    const armazem = k.comodo([16, 1, 25, 6], 'abrigo', { nome: 'Armazém', piso: 'vinil.industrial' });
    k.porta([30.75, 9], 'door', { width: 1.5, state: 'open', material: 'ferro' });
    for (const x of [26.25, 35.25]) k.porta([x, 9], 'window', { width: 1.2 });
    k.porta([37.5, 3.75], 'door', { width: 0.9, state: 'locked', material: 'ferro' });
    k.objeto('gondola', [31.6, 4.3], { rotation: 0, params: { comprimento: 5 } });
    for (const [x, y, r] of [[28.6, 6.6, 0.1], [30.2, 6.8, -0.2], [32.8, 6.5, 0.3], [34.4, 6.9, 0]] as const) k.objeto('caixa-de-suprimentos', [x, y], { rotation: r, params: { aberta: x > 32 ? 1 : 0 } });
    k.objeto('pilha-de-caixotes', [36.4, 2.6], { rotation: 0.1 });
    k.objeto('caixote', [36.6, 4.4], { rotation: 0.4 });
    k.objeto('tanque-de-agua', [25.6, 3.0], { rotation: 0, params: { modelo: 1 } });
    k.objeto('estante.piso', [36.8, 6.8], { rotation: Math.PI / 2 });
    k.objeto('colchao-no-chao', [26.4, 7.4], { rotation: 0 });
    k.objeto('extintor', [24.6, 4.6], { rotation: 0 });
    k.luz('lampada', [31.0, 5.4], { radius: 6.5, intensity: 0.55, color: '#ffd8a0' });
    // Na porta do armazém: a chicana de sacos, o gerador com o cabo e a caixa d'água.
    k.objeto('sacos-de-areia', [30.8, 11.4], { rotation: 0, params: { comprimento: 3.6 } });
    k.objeto('gerador-a-diesel', [33.6, 10.2], { rotation: 0, params: { ligado: 1 } });
    k.objeto('tanque-de-agua', [38.4, 10.8], { rotation: 0, params: { modelo: 0 } });
    k.objeto('freezer', [25.2, 9.9], { rotation: 0.1 });

    // ---------- A enfermaria (a lanchonete) ----------
    const enfermaria = k.comodo([1, 4, 9, 12], 'enfermaria-improvisada', { nome: 'Enfermaria', piso: 'ladrilho.xadrez' });
    k.porta([11.25, 18], 'door', { width: 1.5, state: 'open', material: 'vidro' });
    for (const x of [3.75, 8.25]) k.porta([x, 18], 'window', { width: 1.2 });
    k.porta([13.5, 12.75], 'window', { width: 1.2 });
    k.porta([13.5, 7.5], 'door', { width: 0.9, state: 'closed', material: 'ferro' });
    // O velho balcão virou bancada de remédios; as camas onde ficavam as mesas.
    k.objeto('fogao', [2.8, 7.0], { rotation: 0 });
    k.objeto('balcao', [5.0, 7.0], { rotation: 0 });
    k.objeto('geladeira', [7.2, 7.0], { rotation: 0 });
    for (const x of [4.0, 6.2]) k.objeto('balcao', [x, 10.0], { rotation: Math.PI });
    k.objeto('caixa-de-suprimentos', [8.6, 10.0], { rotation: 0.05 });
    k.objeto('banqueta', [4.6, 11.3], { rotation: 0.6 });
    for (const x of [3.4, 6.6, 9.8]) k.objeto('cama-hospitalar', [x, 15.9], { rotation: Math.PI });
    k.objeto('colchao-no-chao', [2.6, 12.9], { rotation: Math.PI / 2 });
    k.objeto('mesa.retangular', [10.6, 12.6], { rotation: 0 });
    k.objeto('cadeira', [10.6, 13.9], { rotation: Math.PI });
    k.objeto('armario-de-vestiario', [12.9, 15.6], { rotation: -Math.PI / 2, params: { portas: 2 } });
    k.luz('lampada', [6.5, 13.8], { radius: 6, intensity: 0.5, color: '#ffe2b0' });
    k.objeto('cacamba', [4.5, 4.4], { rotation: 0.05 });
    k.objeto('pneus-empilhados', [8.8, 4.6], { rotation: 0.3 });
    // As carcaças nas vagas da frente: a viatura e o táxi que nunca saíram.
    k.objeto('carro.enferrujado', [2.6, 21.4], { rotation: -Math.PI / 2 + 0.06, params: { modelo: 0, cor: 3 } });
    k.objeto('carro.enferrujado', [7.6, 21.6], { rotation: -Math.PI / 2 - 0.1, params: { modelo: 1, cor: 6 } });
    k.objeto('placa-pichada', [11.4, 19.8], { rotation: 0, params: { desenho: 1 } });

    // ---------- A oficina de sucata (a borracharia) ----------
    const oficina = k.comodo([27, 2, 31, 8], 'oficina-de-sucata', { nome: 'Oficina' });
    k.porta([43.5, 12], 'door', { width: 3, state: 'open', material: 'ferro' });
    k.objeto('carro.enferrujado', [43.5, 7.4], { rotation: Math.PI / 2, params: { modelo: 2, cor: 5 } });
    k.objeto('bancada.ferramentas', [45.7, 4.6], { rotation: Math.PI / 2 });
    k.objeto('pneus-empilhados', [41.6, 10.4], { rotation: 0.2 });
    for (const [x, y] of [[41.3, 3.9], [42.2, 4.1]] as const) k.objeto('barril', [x, y], { rotation: x });
    k.objeto('caixa', [41.4, 5.6], { rotation: 0.2 });
    k.objeto('mancha-de-oleo', [45.2, 13.7], { rotation: 0.3, params: { raio: 1.0 } });
    k.luz('lampada', [43.5, 7.0], { radius: 5.5, intensity: 0.5, color: '#ffd8a0' });

    // ---------- O acampamento no estacionamento ----------
    k.objeto('barreira', [40.0, 13.0], { rotation: 0, params: { comprimento: 8, plastica: 0 } });
    k.objeto('barraca-improvisada', [34.0, 16.0], { rotation: 0.1, params: { lona: 1 } });
    k.objeto('barraca-improvisada', [34.4, 20.6], { rotation: -0.08, params: { lona: 3 } });
    k.objeto('fogareiro', [37.6, 18.4], { rotation: 0 });
    for (const [x, y, r] of [[37.4, 16.6, 0.2], [37.2, 20.4, -0.15]] as const) k.objeto('caixa-de-suprimentos', [x, y], { rotation: r, params: { aberta: 0 } });
    for (const [x, y] of [[41.0, 15.6], [44.4, 15.6], [41.2, 18.6]] as const) k.objeto('horta-em-pneus', [x, y], { rotation: x * 0.3 });
    k.objeto('tanque-de-agua', [45.6, 18.0], { rotation: 0, params: { modelo: 0 } });
    k.objeto('carro.enferrujado', [40.8, 21.6], { rotation: Math.PI / 2 + 0.08, params: { modelo: 3, cor: 1 } });

    // ---------- O mato: as árvores cresceram e o capim rompe o chão ----------
    for (const [x, y, s] of [[1.6, 1.8, 1.1], [14.6, 2.6, 1], [22.0, 0.4, 0.8], [19.4, 2.6, 1.1], [0.8, 29.8, 1], [2.4, 33.0, 0.9], [46.8, 33.0, 1], [19.0, 33.4, 0.8]] as const) k.objeto(s > 0.95 ? 'casa:arvore-5m' : 'casa:arvore-3m', [x, y], { rotation: x, scale: s });
    for (let i = 0; i < 36; i++) {
      const x = 1 + ((i * 13.37) % 46), y = 9.5 + ((i * 7.91) % 23.5);
      const dentro = (x > 1 && x < 14 && y > 5.5 && y < 18.5) || (x > 23.5 && x < 38 && y < 9.5) || (x > 40 && x < 47 && y < 12.5);
      if (!dentro) k.objeto('tufo-de-capim', [x, y], { rotation: i, scale: 0.7 + (i % 5) * 0.12 });
    }

    // Luz: fim de tarde de poeira; à noite, só os fogos, as lâmpadas do gerador e a lua.
    k.clima('tarde', { time: '17:40', ambient: { color: '#d8bc94', intensity: 0.95 }, sun: { angle: 2.7, color: '#ffbc80', intensity: 1.0 }, tempo: { rain: 0, wind: 0.35, fog: 0.1 } });
    k.acabamento(null, { tint: '#f2dcb8', saturation: 0.8, vignette: 0.24, glow: 0.4, edges: { kind: 'dark', amount: 0.15 } });
    k.guardarClima('vigilia', 'Noite de vigília', 'noite', { time: '23:40', ambient: { color: '#4e5e7e', intensity: 0.5 }, sun: { angle: 2.2, color: '#a8b8d8', intensity: 0.35 }, tempo: { rain: 0, wind: 0.2, fog: 0.08 }, finish: { tint: '#dfe6f0', saturation: 0.8, vignette: 0.35, glow: 0.7, edges: { kind: 'dark', amount: 0.3 } } });

    k.notaDeComodo(guarita, { leitura: 'Uma cadeira de plástico, uma lata de café frio e o rádio de pilha mudo. Pela janela, a rodovia e o ônibus tombado.', notasMestre: 'O vigia anota num caderno cada farol que passa na estrada; o último foi há três noites, e voltou.' });
    k.notaDeComodo(armazem, { leitura: 'As prateleiras da loja guardam agora latas contadas e caixas do exército. O gerador ronca lá fora e a lâmpada pisca com ele.', notasMestre: 'O inventário na parede não bate: faltam duas caixas de antibióticos, e só três pessoas têm a chave.' });
    k.notaDeComodo(enfermaria, { leitura: 'O xadrez da lanchonete ainda aparece sob a poeira. Três camas de hospital onde ficavam as mesas, e cheiro de álcool e fumaça.', notasMestre: 'O ferido da cama do meio chegou pelo ônibus e não diz de onde veio; a mordida no braço não é de cachorro.' });
    k.notaDeComodo(oficina, { leitura: 'A picape verde ainda está no elevador, sem rodas e sem motor. Peças de carro em toda parte, e uma bancada que alguém mantém limpa.', notasMestre: 'O Neno ainda vive aqui. Na caçamba da picape, sob a lona, está o que veio no ônibus das duas, intacto.' });
    k.notas('Posto avançado: o Posto na estrada anos depois. A cobertura das bombas fica no centro, com o fogo do acampamento; o armazém (a velha loja) atrás dela, a enfermaria (a lanchonete) a oeste e a oficina (a borracharia) a leste, com a horta e as barracas no estacionamento. A cerca de arame fecha o terreno; o portão, com a guarita, dá para a rodovia ao sul, onde o ônibus tombou.');
  },
};
