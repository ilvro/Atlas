import { caminho } from '../../src/authoring/caminho.ts';
import { terreno } from '../../src/authoring/construcao.ts';
import type { Exemplo, Kit } from './kit.ts';

type P = [number, number];

/**
 * A arquibancada desenha o arco voltado para cima e centra a caixa dele na pegada. Aqui ela é posta pelo centro do círculo
 * (`c`) e pela direção do meio do arco (`meio`, rad no mapa), para abraçar o tablado de fora.
 */
function arquibancadaEm(k: Kit, c: P, R: number, aberturaGraus: number, degraus: number, meio: number): void {
  const ab = (aberturaGraus * Math.PI) / 180, r0 = Math.max(1, R - Math.min(degraus, Math.floor((R - 1) / 0.8)) * 0.8);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= 48; i++) { const a = -Math.PI / 2 - ab / 2 + (ab * i) / 48; for (const rr of [r0, R]) { const y = Math.sin(a) * rr; y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  const cy = -(y0 + y1) / 2, rot = meio + Math.PI / 2;
  // Centro local do círculo = (0, cy); no mapa, o objeto fica onde esse ponto girado cai sobre `c`.
  k.objeto('arquibancada', [c[0] + Math.sin(rot) * cy, c[1] - Math.cos(rot) * cy], { params: { raio: R, abertura: aberturaGraus, degraus }, rotation: rot });
}

/** Contas de mureta ao longo de um arco (centro, raio, ângulos em rad), com falhas. */
function muretaEmArco(k: Kit, c: P, R: number, a0: number, a1: number, pedaco = 2.6): void {
  const n = Math.max(1, Math.round((Math.abs(a1 - a0) * R) / pedaco));
  for (let i = 0; i < n; i++) {
    if (k.rng() < 0.18) continue;
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    k.objeto('mureta-de-pedra', [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R], { params: { largura: pedaco * 0.92, falha: 1 }, rotation: a + Math.PI / 2 });
  }
}

/**
 * Jardim do colosso (60 × 34 m): pátio cerimonial de um reino esquecido numa manhã dourada. Um colosso fora do mapa, a nordeste,
 * deita a sombra pelo pátio inteiro; a arquibancada abraça o tablado rúnico; à esquerda, um carvalho imenso e a ruína desmoronada.
 */
export const jardimDoColosso: Exemplo = {
  id: 'jardim-do-colosso',
  nome: 'Jardim do colosso',
  descricao: 'Pátio cerimonial em ruína numa manhã dourada: a sombra de um colosso atravessa o tablado rúnico, arquibancada em arco, colunata ao norte, galeria coberta a leste, carvalho imenso e ruína desmoronada a oeste.',
  largura: 60,
  altura: 34,
  semente: 7319,
  construir(k) {
    const T: P = [31, 17.5];   // o tablado
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#141a10' });
    k.base('grama.escura');

    // ---------- Chão ----------
    // Pátio de grama alta e lajes gramadas; terra pisada onde a sombra do carvalho mata o mato.
    k.pintar('grama', { poligono: [[18, 3], [48, 2], [52, 33], [20, 34], [16, 18]], irregular: 1.1 });
    k.pintar('lajes.gramadas', { poligono: [[24, 10], [33, 8.5], [37, 14], [35, 26], [28, 29], [22.5, 21]], irregular: 1.3 });
    k.pintar('lajes.gramadas', { poligono: [[36, 25], [41, 24], [42, 31], [36.5, 32]], irregular: 1.2 });
    k.pintar('lajes.antigas', { poligono: [[27, 13], [35, 13], [36, 22], [27, 22]], irregular: 0.6 });
    k.pintar('lajes.antigas', { poligono: [[18, -1], [42, -1], [41.5, 4.2], [18.5, 4.6]], irregular: 0.25 });
    k.pintar('terra', { poligono: [[0, 4], [16, 3], [21, 9], [19, 17], [0, 17]], irregular: 1.4 });
    k.pintar('grama', { poligono: [[44, 22], [54, 21], [55, 34], [43, 34]], irregular: 1 });

    // Plataforma desmoronada a sudoeste, 1,2 m acima do pátio: lajes velhas partidas e pedregulho.
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 1.2, forma: { poligono: [[-1, 18], [14, 17.5], [19.5, 22], [20, 35], [-1, 35]], irregular: 0.45 } }], 13));
    k.pintar('lajes.antigas', { poligono: [[0, 18.5], [13.5, 18], [19, 22.5], [19, 34], [0, 34]], irregular: 0.6 });
    k.pintar('pedregulho', { poligono: [[1, 21], [8, 20], [12, 26], [7, 31], [1, 29]], irregular: 1.3 });

    // Terraço leste, 1,8 m acima, sob a galeria coberta; a trilha sobe do sul até a escadaria.
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 1.8, forma: { poligono: [[52, -1], [61, -1], [61, 35], [56, 35], [53.5, 22], [51, 12]], irregular: 0.3 } }], 17));
    k.pintar('lajes.antigas', { poligono: [[53, 3], [61, 3], [61, 26], [55, 26], [52.6, 14]], irregular: 0.3 });
    k.aplicar(m => caminho(m, { pontos: [[40, 34.5], [44, 29], [48, 24], [50.8, 19.6]], largura: [1.5, 2.4], material: 'terra', sulcos: false, irregular: 0.7 }, 5));

    // ---------- O tablado ----------
    // Camadas explícitas: a roseta é chão, o círculo é entalhado nela.
    k.objeto('roseta-de-calcamento', T, { params: { raio: 5.2 }, rotation: 0.3, layer: -2 });
    k.objeto('circulo-runico', T, { params: { raio: 3.6, raios: 8 }, rotation: 0, layer: -1 });
    // Anel de pedra baixo em volta do círculo, com falhas, e o pedestal com a estátua pequena no meio.
    muretaEmArco(k, T, 4.4, 0, Math.PI * 2, 2.2);
    k.objeto('estatua-heroica', T, { rotation: 0.9, scale: 1.05 });

    // Arquibancada em arco a leste, abraçando o tablado (o colosso deita a sombra pelo norte, por onde ela não passa).
    arquibancadaEm(k, T, 13.5, 120, 7, 0.08);
    // Mureta curva a oeste do pátio, a borda da antiga praça.
    muretaEmArco(k, T, 12.5, Math.PI * 0.62, Math.PI * 1.22, 2.8);

    // ---------- Colunata ao norte ----------
    for (const [x, l, rot] of [[23, 9, 0.02], [34.5, 9.5, -0.02]] as const) k.objeto('mureta-de-pedra', [x, 1.6], { params: { largura: l, falha: 1 }, rotation: rot });
    for (const x of [18.6, 24.6, 29.0, 33.0, 38.8, 42.4]) k.objeto('coluna-arruinada', [x, 2.0 + k.rng() * 0.4], { rotation: k.rng() * 6, scale: 1.6 });
    for (const x of [27, 36]) k.objeto('urna.pedestal', [x, 4.6], { rotation: 0, scale: 1.4 });
    k.objeto('coluna-caida', [23.6, 6.6], { rotation: 0.6, scale: 1.5 });
    k.objeto('escombros', [25.4, 5.6], { scale: 2 });
    k.objeto('pedra.grande', [26.2, 7.4], { scale: 1.1 });

    // ---------- Galeria coberta a leste ----------
    // Balaustrada na beira do terraço, pilares altos e o portal florido; a escadaria desce para a trilha.
    k.objeto('escada.externa', [51.6, 18.6], { params: { largura: 3.4 }, rotation: -Math.PI / 2 - 0.3, blocks: { move: false, sight: false } });
    k.objeto('balaustrada', [52.4, 9.5], { params: { largura: 6 }, rotation: Math.PI / 2 - 0.42 });
    k.objeto('balaustrada', [54.6, 26.5], { params: { largura: 5.5 }, rotation: Math.PI / 2 - 0.2 });
    for (const [x, y] of [[50.4, 5.0], [53.6, 13.6], [54.2, 22.8], [55.6, 30.2], [57.8, 4.4], [59.2, 13.4]] as const) k.objeto('pilar', [x, y], { rotation: 0.3, scale: 1.8 });
    k.objeto('arco-de-pedra', [56.8, 18.4], { params: { largura: 3.4, flores: 1 }, rotation: Math.PI / 2 - 0.3 });
    for (const [x, y] of [[56, 9], [57.4, 25]] as const) k.objeto('urna.pedestal', [x, y], { scale: 1.3 });
    k.objeto('escombros', [47.4, 13.6], { scale: 1.6 });
    k.objeto('pedra.grande', [45.6, 22.6], { scale: 1.3 });

    // ---------- Ruína desmoronada a sudoeste ----------
    for (const [x, y, rot, l] of [[6, 18.4, 0.04, 9], [15.6, 19.6, 0.8, 4.5], [1.2, 26, Math.PI / 2, 6], [17.8, 27.5, 1.5, 5]] as const) k.objeto('mureta-de-pedra', [x, y], { params: { largura: l, falha: 1 }, rotation: rot });
    for (const [x, y, s] of [[4.4, 21.6, 3.2], [9.4, 23.6, 2.8], [3.4, 28.2, 3], [12.8, 28.6, 2.4], [7.4, 31.4, 2.6], [15.6, 23.2, 1.8], [10.2, 20.2, 2], [1.6, 32.4, 2.2]] as const) k.objeto('escombros', [x, y], { scale: s });
    k.objeto('coluna-caida', [6.8, 26.2], { rotation: 2.4, scale: 1.6 });
    k.objeto('coluna-caida', [14.2, 31.6], { rotation: 0.2, scale: 1.4 });
    for (const [x, y] of [[1.6, 19.4], [12.6, 19.0], [18.6, 31.0]] as const) k.objeto('coluna-arruinada', [x, y], { rotation: k.rng() * 6, scale: 1.5 });
    // O portal que sobrou, com brasa velha atrás (a luz rubra ao sul).
    k.objeto('arco-de-pedra', [11.6, 33.2], { params: { largura: 4, flores: 0 }, rotation: -0.08 });
    k.objeto('fosso-de-luz', [11.6, 34.2], { params: { largura: 2.4, cor: 3 }, rotation: 0 });

    // ---------- Pátio: entulho, blocos soltos, raízes ----------
    for (const [x, y, s] of [[22.2, 25.6, 1.4], [37.8, 27.4, 1.5], [43.2, 9.6, 1.2], [20.4, 12.8, 1.3]] as const) k.objeto('escombros', [x, y], { scale: s });
    for (const [x, y] of [[24.6, 10.6], [41.2, 25.2], [35.8, 30.6], [21.4, 20.8], [44.6, 18.2]] as const) k.objeto('pedra.grande', [x, y], { scale: 0.9 + k.rng() * 0.4 });
    for (const [x, y, r] of [[19.6, 9.6, -0.4], [23.4, 29.4, 0.9], [44.2, 27.2, 2.2], [16.4, 6.8, 0.3]] as const) k.objeto('raiz-exposta', [x, y], { rotation: r, scale: 1.6 });

    // ---------- Vegetação ----------
    // O carvalho imenso a noroeste, copa por cima da colunata; mata fechada e escura na borda oeste.
    k.objeto('casa:carvalho-grande-8m', [8.6, 5.4], { rotation: 0.4, scale: 1.9 });
    k.objeto('casa:carvalho-grande-7m', [18.6, 4.2], { rotation: 2.1, scale: 1.5 });
    k.objeto('casa:carvalho-grande-6m', [1.2, 13.2], { rotation: 1.1, scale: 1.4 });
    k.objeto('casa:arvore-da-mata-6m', [24.4, 0.4], { rotation: 0.7, scale: 1.2 });
    k.objeto('casa:arvore-da-mata-8m', [58.4, 0.6], { rotation: 2.6, scale: 1.1 });
    k.objeto('casa:arvore-da-mata-6m', [46.6, 33.6], { rotation: 1.6, scale: 1.1 });
    for (const [x, y] of [[13.6, 11.4], [44.4, 3.6], [48.2, 31.2], [20.4, 16.2], [0.8, 3]] as const) k.objeto('casa:arbusto-grande', [x, y], { rotation: k.rng() * 6, scale: 1.1 + k.rng() * 0.3 });
    // Canteiro florido a sudeste, junto da galeria.
    k.espalhar('jardim', { poligono: [[46, 23], [54, 24], [56, 34], [44, 34]] }, { densidade: 0.22 });
    for (const [x, y] of [[49.6, 27.6], [52.2, 32.4], [47.4, 30], [42.6, 31.8], [51, 2.2], [39.2, 5.6]] as const) k.objeto('casa:arbusto-florido', [x, y], { scale: 1 + k.rng() * 0.4 });
    for (const [x, y] of [[26.4, 26.6], [39.2, 21], [28.6, 9.8], [37.2, 11.4], [24, 16], [33.6, 27.2], [41.6, 14]] as const) k.objeto('tufo-de-grama', [x, y], { scale: 1.3 + k.rng() * 0.4 });
    for (const [x, y] of [[22.6, 14.8], [25.2, 25.6], [37.4, 19.6], [29.4, 27.2], [23.4, 18.4], [34.6, 9.4], [27.8, 8.8], [38.8, 28.8]] as const) k.objeto('tufo-de-grama', [x, y], { scale: 1.5 + k.rng() * 0.5 });
    for (const [x, y, r] of [[27.2, 24.4, 1.2], [36.2, 12.2, -0.6], [22.8, 9.4, 0.4]] as const) k.objeto('raiz-exposta', [x, y], { rotation: r, scale: 1.3 });
    k.presenca('musgo', { poligono: [[18, 0], [42, 0], [42, 5], [18, 5.4]], irregular: 0.8 }, 0.45);
    k.presenca('musgo', { poligono: [[0, 18], [19, 18], [19, 34], [0, 34]], irregular: 1 }, 0.5);
    k.presenca('musgo', { poligono: [[26, 12], [37, 12], [37, 23], [26, 23]], irregular: 1 }, 0.3);

    // ---------- Luz ----------
    // A sombra do colosso: ele está fora do mapa, ao norte; o sol baixo da manhã a deita pelo pátio, pés na colunata e a espada no portal ao sul.
    // O sol (ângulo 1,35) faz a sombra cair em (−0,22; 0,98); a silhueta tem a ponta em −y local, daí a rotação π + 0,222.
    k.objeto('sombra-de-colosso', [29.1, 16.5], { params: { comprimento: 40, forca: 1 }, rotation: Math.PI + 0.222, castsShadow: false, blocks: { move: false, sight: false } });
    // Manhã baixa: luz dourada forte e sombras fundas (sol acima de 1 escurece a sombra), com um facho de raios que lava o pátio.
    k.clima('manha', { time: '08:10', ambient: { color: '#ffe4b4', intensity: 1 }, sun: { angle: 1.35, color: '#ffd38a', intensity: 2 }, tempo: { leaves: 0.3, wind: 0.15, dust: 0.25 } });
    k.luz('farol', [50, -4], { radius: 44, color: '#ffc978', intensity: 0.7, flicker: 0, power: 'magic', cone: { angle: 0.95, direction: 2.2 }, rays: true });
        k.luz('luar', [11.6, 33], { radius: 4.5, color: '#ff6a3a', intensity: 0.9, flicker: 0.1 });
    k.acabamento('dia-dourado', { vignette: 0.42, saturation: 1.08, tint: '#fff0d4', edges: { kind: 'none', amount: 0 }, glow: 0.35 });
    k.guardarClima('entardecer', 'Entardecer dourado', 'entardecer', { time: '17:20' });
    k.guardarClima('lua-sobre-o-colosso', 'Lua sobre o colosso', 'noite', { time: '22:30' });

    k.regiao([[25, 11], [37, 11], [37, 24], [25, 24]], 'trigger', { nome: 'Tablado rúnico', texto: 'As runas do chão acendem quando a sombra da espada do colosso cai sobre o círculo.' });
    k.notas('Jardim do colosso — o pátio cerimonial de um reino esquecido. O colosso que guarda o vale fica a nordeste, fora do mapa; de manhã a sombra dele atravessa o pátio e a espada aponta o tablado rúnico. Da arquibancada, os espíritos assistem a quem ousar o desafio. A galeria leste leva ao portão florido; ao sul da ruína, uma brasa que nunca apaga.');
  },
};
