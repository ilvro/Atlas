import type { Exemplo } from './kit.ts';

/**
 * Doca do dirigível (48 × 34 m), o exemplo do vitoriano e steampunk (Q20d): um bairro fabril numa noite de névoa. A noroeste, a
 * tecelagem a vapor, com a caldeira acesa, a máquina, os teares e a esteira; no pátio, as chaminés e a carroça de carga; a nordeste, o
 * campo de pouso com o dirigível amarrado ao mastro e, na frente dele, a estação de passageiros. A rua de paralelepípedo corta o mapa
 * de leste a oeste, com os lampiões a gás e as carruagens; ao sul, a oficina do inventor (a bobina ligada), o clube e a pracinha das
 * carruagens de aluguel. Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const docaDoDirigivel: Exemplo = {
  id: 'doca-do-dirigivel',
  nome: 'Doca do dirigível',
  descricao: 'Um bairro fabril numa noite de névoa: a tecelagem a vapor com a caldeira acesa e as chaminés, o dirigível amarrado ao mastro diante da estação, a rua de paralelepípedo com lampiões a gás e carruagens, a oficina do inventor com a bobina ligada e o clube.',
  largura: 48,
  altura: 34,
  semente: 1887,
  construir(k) {
    k.estilo({ genre: 'vitoriano', palette: 'fantasia' });
    k.fundo({ kind: 'solid', color: '#1c1f24' });
    k.base('calcada');

    // ---------- Terreno: o pátio, o campo de pouso, a rua e a pracinha ----------
    k.pintar('lajes.escuras', { poligono: [[21, -2], [29.6, -2], [29.6, 19.2], [21, 19.2]], irregular: 0.15 });
    k.pintar('piso.hangar', { poligono: [[29.6, -2], [50, -2], [50, 13.2], [29.6, 13.2]], irregular: 0.05 });
    k.pintar('paralelepipedo', { retangulo: [-2, 20.6, 50, 25.4], irregular: 0.08 });
    k.pintar('lajes.antigas', { retangulo: [30.2, 27.2, 48.5, 34.5], irregular: 0.2 });
    // Um trilho de terra batida e graxa por onde a carroça entra no pátio.
    k.pintar('terra', { faixa: [[24.2, 20.4], [25.2, 16.8], [25.4, 13.2]], largura: 1.6, irregular: 0.5 });

    // ---------- A tecelagem a vapor ----------
    const fabrica = k.comodo([1, 1, 14, 8], 'fabrica', { nome: 'Tecelagem Ashcombe & Filhos', piso: 'tabuas.gastas', papel: 'tijolo.fuligem', telhado: 'galpao-industrial' });
    k.porta([10.5, 12], 'door', { width: 3, state: 'open', material: 'madeira.escura' });
    k.porta([21, 6.75], 'door', { width: 3, state: 'open', material: 'madeira.escura' });
    for (const x of [3.75, 6.75, 15.75, 18.75]) k.porta([x, 12], 'window', { width: 1.2 });
    for (const x of [5.25, 14.25]) k.porta([x, 1.5], 'window', { width: 1.2 });
    // A casa das caldeiras no fundo: a caldeira, o cano de cobre até a máquina, a máquina e o trem de engrenagens.
    k.objeto('caldeira', [3.5, 6.4], { rotation: 0 });
    k.objeto('tubulacao.cobre', [5.9, 4.4], { rotation: 0, params: { comprimento: 2.4 } });
    k.objeto('maquina-a-vapor', [9.3, 4.3], { rotation: 0 });
    k.objeto('engrenagens', [13.4, 4.2], { rotation: 0 });
    k.objeto('prensa', [17.6, 3.9], { rotation: 0.3 });
    k.objeto('esteira', [14.6, 7.2], { rotation: 0, params: { comprimento: 7 } });
    for (const [x, y] of [[6.2, 9.9], [14.0, 10.0], [17.8, 10.0]] as const) k.objeto('tear-mecanico', [x, y], { rotation: 0 });
    k.objeto('painel-de-manometros', [9.3, 1.6], {});
    k.objeto('engrenagens.parede', [17.4, 1.6], {});
    k.objeto('painel-de-manometros', [1.6, 10.2], {});
    k.objeto('pilha-de-caixotes', [19.6, 3.2], { rotation: 0.1 });
    k.objeto('sacos', [19.7, 10.6], { rotation: 0.2 });
    k.objeto('caixote', [11.8, 10.6], { rotation: 0.4 });
    for (const [x, y] of [[7.5, 7.4], [16.0, 5.2]] as const) k.luz('lampiao-a-gas', [x, y], { radius: 6, intensity: 0.7 });
    // O gradil de ferro na frente da fábrica, com o portão diante da porta grande, e a carroça descarregando fardos no pátio da frente.
    for (const x of [2.5, 4.5, 6.5, 17.5, 19.5]) k.objeto('grade.ferro', [x, 18.4], { rotation: 0 });
    k.objeto('portao.ferro', [10.5, 18.4], { rotation: 0 });
    for (const x of [8.0, 13.0, 15.5]) k.objeto('grade.ferro', [x, 18.4], { rotation: 0, scale: x === 8.0 ? 0.5 : 1 });
    k.objeto('carroca', [14.4, 14.6], { rotation: 0.05 });
    k.objeto('cavalo', [18.0, 14.8], { rotation: 0.05 });
    k.objeto('sacos', [11.4, 14.0], { rotation: 0.4 });
    k.objeto('sacos', [4.6, 14.6], { rotation: -0.2 });
    k.objeto('pilha-de-caixotes', [3.2, 16.2], { rotation: 0.15 });
    k.objeto('barril', [6.6, 13.6], { rotation: 0 });

    // ---------- O pátio da fábrica ----------
    k.objeto('chamine-industrial', [23.6, 2.6], { rotation: 0, params: { fumaca: 1 } });
    k.objeto('chamine-industrial', [27.2, 9.6], { rotation: 0, params: { fumaca: 1 } });
    k.objeto('tubulacao.cobre', [22.6, 9.8], { rotation: Math.PI / 2, params: { comprimento: 3 } });
    k.objeto('carroca', [25.6, 16.2], { rotation: Math.PI / 2 + 0.08 });
    k.objeto('pilha-de-caixotes', [22.6, 13.8], { rotation: 0.2 });
    for (const [x, y] of [[27.8, 14.8], [28.1, 16.0]] as const) k.objeto('barril', [x, y], { rotation: x });
    k.objeto('sacos', [22.8, 16.6], { rotation: -0.3 });
    k.objeto('caixote', [27.6, 4.6], { rotation: 0.5 });
    k.objeto('lampiao-a-gas', [22.0, 18.8], { rotation: 0 });

    // ---------- O campo de pouso e o dirigível ----------
    k.objeto('dirigivel', [38.0, 6.4], { rotation: 0 });
    k.objeto('pilha-de-caixotes', [31.4, 11.6], { rotation: 0 });
    k.objeto('sacos', [33.4, 11.8], { rotation: 0.1 });
    k.objeto('rolo-de-corda', [30.8, 2.0], { rotation: 0 });
    k.objeto('caixa.carga', [46.6, 11.6], { rotation: 0.2 });
    for (const [x, y] of [[30.4, 0.8], [47.2, 0.8], [30.4, 12.6], [47.2, 12.6]] as const) k.objeto('lampiao-a-gas', [x, y], { rotation: 0 });

    // ---------- A estação de passageiros ----------
    const estacao = k.comodo([21, 9, 30, 13], 'estacao-de-dirigivel', { nome: 'Estação Aérea de Ashcombe', piso: 'ladrilho.xadrez', papel: 'papel.verde-esmeralda', telhado: 'galpao-abobadado' });
    k.porta([38.25, 13.5], 'door', { width: 3, state: 'open', material: 'madeira.escura' });
    k.porta([38.25, 19.5], 'door', { width: 1.5, state: 'open', material: 'madeira.escura' });
    for (const x of [33.75, 42.75]) { k.porta([x, 13.5], 'window', { width: 1.2 }); k.porta([x, 19.5], 'window', { width: 1.2 }); }
    k.objeto('relogio-de-rua', [38.25, 16.5], { rotation: 0 });
    for (const y of [15.4, 17.6]) for (const x of [33.6, 35.4]) k.objeto('banco', [x, y], { rotation: 0 });
    k.objeto('banca-de-jornal', [43.6, 18.2], { rotation: Math.PI });
    k.objeto('esteira', [42.8, 15.0], { rotation: 0, params: { comprimento: 3.5 } });
    for (const [x, y] of [[41.2, 16.4], [44.6, 16.3]] as const) k.objeto('caixote', [x, y], { rotation: x });
    k.objeto('painel-de-manometros', [32.0, 16.5], {});
    k.luz('lampiao-a-gas', [38.25, 15.0], { radius: 6.5, intensity: 0.75 });

    // ---------- A rua de paralelepípedo ----------
    for (const x of [4.5, 14.5, 29.6, 46.6]) k.objeto('lampiao-a-gas', [x, 20.1], { rotation: 0 });
    for (const x of [9.5, 15.2, 30.0, 40.5]) k.objeto('lampiao-a-gas', [x, 26.0], { rotation: 0 });
    k.objeto('relogio-de-rua', [26.4, 20.0], { rotation: 0 });
    k.objeto('carruagem-fechada', [17.6, 22.2], { rotation: 0 });
    k.objeto('carruagem-fechada', [36.4, 24.0], { rotation: Math.PI });
    for (const x of [11.0, 33.0]) k.objeto('bueiro', [x, 23.0], { rotation: 0 });

    // ---------- A oficina do inventor ----------
    const oficina = k.comodo([2, 18, 9, 22], 'oficina-de-inventor', { nome: 'Oficina do dr. Pell', piso: 'tabuas.gastas', papel: 'tijolo', telhado: 'telha.ardosia', telhadoForma: 'duas-aguas', telhadoDetalhes: ['chamine'] });
    k.porta([8.25, 27], 'door', { width: 1.2, state: 'open' });
    for (const x of [4.75, 11.25]) k.porta([x, 27], 'window', { width: 1.2 });
    k.objeto('bobina-de-tesla', [10.9, 30.6], { rotation: 0, params: { arcos: 1 } });
    k.objeto('bancada-de-inventor', [5.0, 27.8], { rotation: 0 });
    k.objeto('banqueta', [5.0, 28.9], { rotation: 0 });
    k.objeto('automato', [7.4, 31.4], { rotation: 0.6 });
    k.objeto('engrenagens', [5.0, 31.6], { rotation: 0.2 });
    k.objeto('estante', [3.3, 30.4], { rotation: Math.PI / 2 });
    k.objeto('engrenagens.parede', [9.5, 32.9], {});
    k.objeto('globo.terrestre', [8.0, 29.4], { rotation: 0 });

    // ---------- O clube ----------
    const clube = k.comodo([11, 18, 19, 22], 'clube', { nome: 'Clube dos Aeronautas', piso: 'tabuas.marchetadas', papel: 'papel.damasco-vinho', telhado: 'sobrado-de-mansarda' });
    k.porta([22.5, 27], 'door', { width: 1.5, state: 'open', material: 'madeira.escura' });
    for (const x of [18.75, 26.25]) k.porta([x, 27], 'window', { width: 1.2 });
    k.objeto('lareira.nobre', [22.5, 32.4], { rotation: Math.PI });
    k.objeto('casa:tapete-persa-g-vinho', [22.5, 30.4], { rotation: 0 });
    for (const x of [21.3, 23.7]) k.objeto('poltrona.capitone', [x, 30.6], { rotation: Math.PI });
    k.objeto('mesa.centro', [22.5, 29.4], { rotation: 0 });
    k.objeto('mesa.bilhar', [19.0, 30.4], { rotation: 0 });
    k.objeto('mesa.carteado', [26.3, 30.6], { rotation: 0 });
    k.objeto('estante', [16.85, 30.2], { rotation: -Math.PI / 2 });
    k.objeto('relogio.pe', [27.9, 27.6], { rotation: 0 });
    k.objeto('gramofone', [17.3, 32.4], { rotation: 0 });
    k.objeto('aparador', [25.6, 27.45], { rotation: 0 });
    k.luz('lampiao-a-gas', [22.5, 29.4], { radius: 6, intensity: 0.7 });

    // ---------- A pracinha das carruagens de aluguel ----------
    k.objeto('banca-de-jornal', [32.6, 28.8], { rotation: 0 });
    k.objeto('carruagem-fechada', [40.0, 29.8], { rotation: 0.05 });
    k.objeto('carruagem-fechada', [40.4, 32.6], { rotation: -0.04 });
    k.objeto('banco.jardim', [34.4, 32.8], { rotation: Math.PI });
    k.objeto('lampiao-a-gas', [46.0, 28.6], { rotation: 0 });
    k.objeto('casa:arvore-5m', [45.4, 32.2], { rotation: 1.2, scale: 0.9 });
    k.objeto('casa:arvore-3m', [31.2, 32.6], { rotation: 2.1 });

    // Luz: meia-noite com névoa de fuligem; os lampiões, a fornalha, a bobina e a lareira fazem as ilhas de luz.
    k.clima('noite', { time: '23:40', ambient: { color: '#6e7c94', intensity: 0.62 }, sun: { angle: 2.3, color: '#aab8d0', intensity: 0.45 }, tempo: { fog: 0.36, wind: 0.1 } });
    k.acabamento(null, { tint: '#eef0ee', saturation: 0.85, vignette: 0.28, glow: 0.6, edges: { kind: 'fog', amount: 0.26 } });
    k.guardarClima('manha', 'Manhã de fuligem', 'manha', { time: '08:30', tempo: { fog: 0.3, wind: 0.15 }, finish: { tint: '#f4ead8', saturation: 0.9, vignette: 0.26, glow: 0.35, edges: { kind: 'fog', amount: 0.2 } } });

    k.notaDeComodo(fabrica, { leitura: 'O chão treme com a máquina. A caldeira ronca, os teares batem em compasso e o ar tem gosto de carvão e de óleo quente.', notasMestre: 'O contramestre desvia carvão para a caldeira do dirigível; a fábrica não aguenta outra noite com a pressão no vermelho.' });
    k.notaDeComodo(estacao, { leitura: 'O relógio da estação marca a partida das duas da madrugada. Malas empilhadas na esteira; o jornaleiro dorme sobre os jornais.', notasMestre: 'Entre a bagagem do voo das duas, um caixote sem etiqueta pesa demais para ser roupa.' });
    k.notaDeComodo(oficina, { leitura: 'Faíscas violetas estalam da bobina; um autômato inacabado olha para a porta. Plantas de motores cobrem a bancada.', notasMestre: 'O dr. Pell construiu o motor do dirigível e quer impedir o voo desta noite, mas não sabe em quem confiar.' });
    k.notaDeComodo(clube, { leitura: 'Couro, conhaque e fumaça de charuto. Os retratos dos sócios mortos em voo olham da parede.', notasMestre: 'O dono da tecelagem joga carteado aqui até o dirigível partir; ele sabe o que vai no caixote.' });
    k.notas('Doca do dirigível — a tecelagem ocupa o noroeste, com o pátio e as chaminés a leste dela; o campo de pouso com o dirigível amarrado fica no nordeste, e a estação de passageiros na frente dele. A rua de paralelepípedo atravessa o mapa de leste a oeste; ao sul, a oficina do inventor, o clube e a pracinha das carruagens.');
  },
};
