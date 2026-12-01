import { caminho } from '../../src/authoring/caminho.ts';
import type { Exemplo } from './kit.ts';

/**
 * Cidade da fronteira (48 × 33 m), o exemplo do faroeste (Q18d): a rua de terra de uma cidade de fronteira ao meio-dia.
 * Ao norte da rua, o saloon, o armazém e o banco, com o passeio de tábuas na frente; ao sul, o xerifado com as celas, o estábulo e a
 * estação; a leste, a linha do trem com a locomotiva, o tênder e o vagão de passageiros parados, e a caixa-d'água; no nordeste, o
 * curral com o cata-vento. Grade de 1,5 m: os cômodos vão em células, o resto em metros.
 */
export const cidadeDaFronteira: Exemplo = {
  id: 'cidade-da-fronteira',
  nome: 'Cidade da fronteira',
  descricao: 'A rua de terra de uma cidade de fronteira ao meio-dia: saloon, armazém e banco de um lado, xerifado com as celas, estábulo e estação do outro, o trem parado na linha, a caixa-d\'água e o curral com o cata-vento.',
  largura: 48,
  altura: 33,
  semente: 1818,
  construir(k) {
    k.estilo({ genre: 'faroeste', palette: 'fantasia' });
    k.fundo({ kind: 'solid', color: '#3a2c1e' });
    k.base('areia');

    // ---------- Terreno ----------
    k.pintar('terra.rachada', { poligono: [[-1, 26], [4, 30.5], [10, 34], [-1, 34]], irregular: 0.5 });
    k.pintar('terra.rachada', { poligono: [[30, 29.5], [36, 30], [40, 34], [28, 34]], irregular: 0.5 });
    k.pintar('grama.seca', { poligono: [[33.5, 1], [41.5, 1], [41.5, 11.5], [33.5, 11.5]], irregular: 0.4 });
    k.pintar('terra', { poligono: [[34.5, 2.2], [40.5, 2.2], [40.5, 10.8], [34.5, 10.8]], irregular: 0.3 });
    k.pintar('grama.seca', { poligono: [[-1, -1], [3, -1], [2.5, 12], [-1, 13]], irregular: 0.5 });
    // A rua principal, com os sulcos das rodas, e o atalho até a estação.
    k.aplicar(m => caminho(m, { pontos: [[-2, 17.2], [10, 16.8], [24, 17.3], [36, 16.9], [50, 17.1]], largura: [6.2, 7], material: 'chao.batido', borda: { material: 'terra', largura: 0.8 }, sulcos: true, irregular: 0.4 }, 181));
    k.aplicar(m => caminho(m, { pontos: [[34, 19.8], [36.6, 22.4]], largura: [2, 2.4], material: 'chao.batido', irregular: 0.3 }, 182));

    // ---------- Os prédios ----------
    const saloon = k.comodo([[2, 2, 10, 8], [3, 1, 7, 2]], 'saloon', { nome: 'Saloon Ferradura', piso: 'tabuas.gastas', papel: 'tabuas.descascadas', telhado: 'telha.tabuas', telhadoForma: 'duas-aguas', telhadoCumeeira: 'h' });
    const armazem = k.comodo([11, 3, 16, 8], 'armazem-geral', { nome: 'Armazém geral', piso: 'tabuas.gastas', papel: 'tabuas.descascadas', telhado: 'telha.tabuinhas', telhadoForma: 'duas-aguas', telhadoCumeeira: 'h' });
    const banco = k.comodo([17, 4, 22, 8], 'banco', { nome: 'Banco', piso: 'ladrilho.hidraulico', papel: 'tijolo.fuligem', telhado: 'telha.ardosia', telhadoForma: 'plano' });
    const xerifado = k.comodo([3, 15, 10, 20], 'xerifado', { nome: 'Xerifado', piso: 'tabuas.gastas', papel: 'tabuas.descascadas', telhado: 'telha.tabuas', telhadoForma: 'duas-aguas', telhadoCumeeira: 'h' });
    k.comodo([12, 15, 17, 20], 'estabulo', { nome: 'Estábulo', telhado: 'celeiro' });
    const estacao = k.comodo([[18, 15, 25, 19], [22, 19, 25, 20]], 'estacao', { nome: 'Estação', piso: 'tabuas.gastas', papel: 'caiado', telhado: 'telha.tabuinhas', telhadoForma: 'duas-aguas', telhadoCumeeira: 'h', telhadoDetalhes: ['chamine'] });
    k.porta([9, 12], 'door', { width: 1.5, state: 'open' });
    for (const x of [5.25, 12.75]) k.porta([x, 12], 'window', { width: 1.2 });
    k.porta([20.25, 12], 'door', { width: 1.2, state: 'open' });
    k.porta([18, 12], 'window', { width: 1.2 });
    k.porta([29.25, 12], 'door', { width: 1.2, state: 'closed' });
    k.porta([32.25, 9], 'window', { width: 0.9 });
    k.porta([9.75, 22.5], 'door', { width: 1.2, state: 'open' });
    k.porta([6, 22.5], 'window', { width: 1.2 });
    k.porta([21.75, 22.5], 'door', { width: 3, state: 'open', material: 'madeira.escura' });
    k.porta([31.5, 22.5], 'door', { width: 1.2, state: 'open' });
    k.porta([37.5, 25.5], 'door', { width: 1.5, state: 'open' });

    // ---------- Saloon: o balcão no fundo, as mesas de pôquer, o piano, o bisão ----------
    k.objeto('balcao-de-saloon', [9.4, 4.25], { rotation: 0, params: { comprimento: 7.5 } });
    k.objeto('piano-de-armario', [4.1, 5.0], { rotation: Math.PI / 2 });
    for (const [x, y] of [[6.2, 8.6], [10.2, 8.2], [13.2, 9.6]] as const) {
      k.objeto('mesa-de-poquer', [x, y], { rotation: x });
      for (let i = 0; i < 4; i++) { const a = x + (i * Math.PI) / 2; k.objeto('cadeira', [x + Math.cos(a) * 1.05, y + Math.sin(a) * 1.05], { rotation: a + Math.PI / 2 }); }
    }
    for (const [x, y] of [[4.0, 10.8], [14.2, 6.4]] as const) k.objeto('escarradeira', [x, y], { rotation: x });
    k.objeto('cabeca-de-bufalo', [3.1, 8.4], {});
    k.objeto('placa-de-procurado', [14.9, 10.6], {});
    k.objeto('porta-de-vaivem', [9, 11.65], { rotation: 0 });
    for (const [x, y] of [[6, 7], [11, 7]] as const) k.luz('lamparina', [x, y], { radius: 6, intensity: 1 });

    // ---------- Armazém: prateleiras, balcão, sacos, barris e caixotes ----------
    k.objeto('estante.piso', [17.2, 8], { rotation: Math.PI / 2 });
    k.objeto('estante.piso', [23.3, 8], { rotation: -Math.PI / 2 });
    k.objeto('mesa.retangular', [20.25, 6.4], { rotation: 0, params: { largura: 2.4, profundidade: 0.8 } });
    for (const [item, x, y, rot] of [['sacos', 18.3, 5.4, 0.3], ['barril', 22.6, 5.2, 0], ['barril', 23.2, 5.9, 0], ['caixote', 18.0, 10.6, 0.2], ['caixote', 18.6, 11.0, -0.3], ['sacos', 22.8, 10.6, 1.2], ['cesto', 21.6, 10.9, 0]] as const) k.objeto(item, [x, y], { rotation: rot });
    k.luz('lamparina', [20.25, 8.6], { radius: 4.5, intensity: 0.8 });

    // ---------- Banco: o guichê, o cofre e a mesa do gerente ----------
    k.objeto('mesa.retangular', [29.25, 8.4], { rotation: 0, params: { largura: 4.4, profundidade: 0.7 } });
    k.objeto('cofre', [27, 6.8], { rotation: 0 });
    k.objeto('cofre', [31.6, 6.8], { rotation: 0, params: { aberto: 1 } });
    k.objeto('placa-de-procurado', [25.6, 10.2], {});
    k.objeto('escarradeira', [32.4, 11.2], {});
    k.objeto('relogio.parede', [29.25, 6.1], {});
    k.luz('lamparina', [29.25, 10.2], { radius: 4.5, intensity: 0.75 });

    // ---------- Xerifado: a mesa de frente para a porta, as celas no fundo, o cofre de armas ----------
    k.objeto('mesa-de-xerife', [9.0, 24.8], { rotation: Math.PI });
    k.objeto('cela-de-xerife', [6.0, 28.7], { rotation: Math.PI, params: { aberta: 0 } });
    k.objeto('cela-de-xerife', [8.75, 28.7], { rotation: Math.PI, params: { aberta: 1 } });
    k.objeto('cofre', [14.1, 23.6], { rotation: -Math.PI / 2 });
    k.objeto('escarradeira', [12.2, 25.4], {});
    for (const x of [5.6, 12.6]) k.objeto('placa-de-procurado', [x, 22.6], {});
    k.objeto('estante.piso', [14.4, 27.6], { rotation: -Math.PI / 2 });

    // ---------- Estábulo: feno, cavalos e o cocho ----------
    k.objeto('cavalo', [20.1, 26.0], { rotation: Math.PI / 2, params: { pelagem: 0 } });
    k.objeto('cavalo', [23.6, 26.4], { rotation: Math.PI / 2 - 0.2, params: { pelagem: 2 } });
    for (const [x, y] of [[19.0, 29.2], [20.4, 29.4], [24.8, 29.0]] as const) k.objeto('fardo-de-feno', [x, y], { rotation: x });
    k.objeto('bebedouro', [21.9, 29.4], { rotation: 0 });
    k.luz('lamparina', [21.75, 24.0], { radius: 4.5, intensity: 0.7 });

    // ---------- Estação: bancos, o guichê, o relógio, malas; a plataforma e a linha ----------
    k.objeto('mesa.retangular', [35.6, 23.6], { rotation: 0, params: { largura: 2.2, profundidade: 0.7 } });
    for (const y of [25.4, 27.2]) k.objeto('banco', [30.4, y], { rotation: 0 });
    k.objeto('relogio.parede', [32.25, 22.6], {});
    k.objeto('placa-de-procurado', [27.1, 25.0], {});
    k.objeto('bau', [36.2, 27.4], { rotation: 0.2 });
    k.objeto('passeio-de-tabuas', [39.7, 25.5], { rotation: -Math.PI / 2, params: { comprimento: 8, largura: 3 } });
    for (const y of [5.5, 16.5, 27.5]) k.objeto('trilho', [42.8, y], { rotation: Math.PI / 2, params: { comprimento: 11 } });
    k.objeto('locomotiva', [42.8, 7.6], { rotation: -Math.PI / 2 });
    k.objeto('vagao', [42.8, 16.2], { rotation: -Math.PI / 2, params: { tipo: 2 } });
    k.objeto('vagao', [42.8, 24.0], { rotation: -Math.PI / 2, params: { tipo: 1 } });
    k.objeto('caixa-dagua-de-ferrovia', [46.0, 4.4], { rotation: Math.PI / 2 });
    for (const [x, y] of [[40.2, 22.8], [40.6, 23.6]] as const) k.objeto('caixote', [x, y], { rotation: x });
    k.luz('lamparina', [33, 25], { radius: 5, intensity: 0.8 });

    // ---------- Os passeios de tábuas na frente dos prédios ----------
    k.objeto('passeio-de-tabuas', [9, 12.9], { rotation: 0, params: { comprimento: 12, largura: 1.8 } });
    k.objeto('passeio-de-tabuas', [24.75, 12.9], { rotation: 0, params: { comprimento: 16.5, largura: 1.8 } });
    k.objeto('passeio-de-tabuas', [9.75, 21.6], { rotation: Math.PI, params: { comprimento: 10.5, largura: 1.8 } });
    k.objeto('passeio-de-tabuas', [31.5, 21.6], { rotation: Math.PI, params: { comprimento: 10.5, largura: 1.8 } });

    // ---------- A rua ----------
    k.objeto('poste-de-amarrar', [9, 14.9], { rotation: 0 });
    k.objeto('cavalo', [7.9, 16.5], { rotation: -Math.PI / 2 - 0.1, params: { pelagem: 3 } });
    k.objeto('cavalo', [10.3, 16.6], { rotation: -Math.PI / 2 + 0.15, params: { pelagem: 1 } });
    k.objeto('poste-de-amarrar', [29.2, 14.9], { rotation: 0 });
    k.objeto('diligencia', [26.4, 17.6], { rotation: 0.04 });
    k.objeto('cavalo', [30.4, 17.1], { rotation: 0, params: { pelagem: 0 } });
    k.objeto('cavalo', [30.4, 18.4], { rotation: 0, params: { pelagem: 2 } });
    k.objeto('carroca-coberta', [2.8, 18.6], { rotation: 0.08 });
    k.objeto('bomba-de-manivela', [15.75, 14.6], { rotation: 0 });
    for (const [item, x, y, rot] of [['barril', 15.4, 10.8, 0], ['barril', 16.0, 11.3, 0], ['caixote', 15.7, 9.6, 0.3], ['barril.em-pe', 3.6, 21.4, 0], ['caixote', 16.6, 21.6, 0.4], ['barril', 26.0, 21.2, 0]] as const) k.objeto(item, [x, y], { rotation: rot });
    for (const [x, y] of [[3.4, 13.2], [14.6, 13.4], [17, 13.4], [32.6, 13.4], [4.8, 20.6], [36.4, 20.6]] as const) k.luz('lamparina', [x, y], { radius: 4.5, intensity: 0.8 });

    // ---------- O curral e o cata-vento no nordeste ----------
    k.objeto('cerca-de-tabuas', [37.5, 2.2], { rotation: 0, params: { comprimento: 6 } });
    k.objeto('cerca-de-tabuas', [34.5, 6.5], { rotation: Math.PI / 2, params: { comprimento: 8.6 } });
    k.objeto('cerca-de-tabuas', [40.5, 6.5], { rotation: Math.PI / 2, params: { comprimento: 8.6 } });
    k.objeto('cerca-de-tabuas', [35.9, 10.8], { rotation: 0, params: { comprimento: 2.8 } });
    k.objeto('cerca-de-tabuas', [39.1, 10.8], { rotation: 0, params: { comprimento: 2.8 } });
    k.objeto('cata-vento', [38.6, 4.8], { rotation: 0.3 });
    k.objeto('bebedouro', [36.4, 6.6], { rotation: Math.PI / 2 });
    k.objeto('cavalo', [37.6, 8.6], { rotation: 0.6, params: { pelagem: 1 } });

    // ---------- O deserto em volta: cactos, arbustos secos, pedras, o crânio ----------
    for (const [item, x, y, s] of [
      ['casa:saguaro-a', 1.4, 3.0, 1], ['casa:saguaro-b', 44.6, 30.8, 1], ['casa:opuntia-a', 2.0, 30.2, 1], ['casa:opuntia-b', 26.8, 31.6, 0.9],
      ['casa:cacto-redondo-grupo', 16.4, 31.4, 1], ['casa:saguaro-a', 46.6, 13.2, 0.9], ['casa:cacto-redondo-um', 0.9, 25.0, 1], ['casa:opuntia-a', 33.0, 1.4, 0.8],
      ['casa:arbusto-seco-1m', 13.2, 1.2, 1], ['casa:arbusto-seco-2m', 17.6, 15.0, 0.6], ['casa:arbusto-seco-1m', 46.8, 22.0, 1], ['casa:arbusto-seco-1m', 11.8, 32.2, 1],
    ] as const) k.objeto(item, [x, y], { rotation: x + y, scale: s });
    k.objeto('cranio-de-boi', [1.8, 22.6], { rotation: 0.7 });
    for (const [x, y, t] of [[0.8, 28.0, 1.6], [37.6, 31.6, 1.4]] as const) k.objeto('rochedo', [x, y], { rotation: x, params: { tamanho: t, cobertura: 0 } });

    // Luz: o meio-dia, sol a pino e duro; à noite, os lampiões do passeio, do saloon e da estação.
    k.clima('tarde', { time: '12:30', tempo: { wind: 0.2 } });
    k.acabamento(null, { tint: '#fff0d8', saturation: 1.02, vignette: 0.22, glow: 0.3, edges: { kind: 'none', amount: 0 } });
    k.guardarClima('noite', 'Noite de pagamento', 'noite', { time: '22:00', ambient: { color: '#7a88b0', intensity: 0.45 }, sun: { angle: 2.2, color: '#b8c4e8', intensity: 0.4 }, tempo: { wind: 0.05 } });

    k.notaDeComodo(saloon, { leitura: 'Fumaça de charuto, um piano desafinado e o barulho das fichas. O bisão na parede tem uma bala no chifre.', notasMestre: 'O dono do saloon guarda no fundo falso da prateleira o mapa da mina que todos procuram.' });
    k.notaDeComodo(xerifado, { leitura: 'Cartazes de procurado nas paredes, o lampião aceso na mesa e duas celas no fundo, uma com a porta aberta.' });
    k.notaDeComodo(banco, { leitura: 'Ladrilhos limpos, o guichê de madeira e dois cofres; um deles está aberto.' });
    k.notaDeComodo(armazem, { leitura: 'Sacos de farinha, barris de pregos, caixotes de munição e o cheiro de couro novo.' });
    k.notaDeComodo(estacao, { leitura: 'O relógio da estação marca a hora do trem do meio-dia, que já está parado na plataforma.' });
    k.notas('Cidade da fronteira — uma rua de terra de leste a oeste. Ao norte, o saloon, o armazém e o banco; ao sul, o xerifado, o estábulo e a estação; a leste, a linha do trem com a caixa-d\'água; no nordeste, o curral com o cata-vento.');
  },
};
