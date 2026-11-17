import { caminho } from '../../src/authoring/caminho.ts';
import { terreno } from '../../src/authoring/construcao.ts';
import type { Exemplo } from './kit.ts';

/** Jardim do colosso (48 × 27 m): pátio de ruína tomado pelo mato, com o tablado rúnico, a arquibancada em arco e a estátua que lança sombra longa. */
export const jardimDoColosso: Exemplo = {
  id: 'jardim-do-colosso',
  nome: 'Jardim do colosso',
  descricao: 'Pátio de ruína tomado pelo mato: tablado rúnico sob a estátua de um herói, arquibancada em arco, colunata partida, terraço com escadaria e carvalhos antigos.',
  largura: 48,
  altura: 27,
  semente: 4211,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#1d2416' });
    k.base('grama.escura');

    // Chão: pátio de lajes gramadas, terra batida e lajes antigas na colunata.
    k.pintar('grama', { poligono: [[9, 2], [40, 1], [42, 26], [8, 27]], irregular: 0.9 });
    k.pintar('lajes.gramadas', { poligono: [[13, 3.5], [36, 3], [37.5, 25], [16, 27.5], [12.5, 18]], irregular: 0.55 });
    k.pintar('lajes.antigas', { poligono: [[13, -1], [33, -1], [32.5, 3.6], [13.5, 3.8]], irregular: 0.2 });
    k.pintar('terra', { poligono: [[0, 13], [9, 12], [14, 16], [13, 27], [0, 27]], irregular: 1.1 });
    k.pintar('pedregulho', { poligono: [[1, 15], [8, 14.5], [11, 21], [6, 26], [0.5, 24]], irregular: 1.2 });

    // Terraço leste, 2 m acima do pátio, com escadaria; a trilha de terra sobe do sul.
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 2, forma: { poligono: [[41, -1], [49, -1], [49, 28], [40.5, 28], [39.5, 18], [41.5, 10]], irregular: 0.25 } }], 11));
    k.pintar('lajes.antigas', { poligono: [[41.5, 4], [49, 4], [49, 22], [42, 22]], irregular: 0.3 });
    k.aplicar(m => caminho(m, { pontos: [[30, 27.5], [33, 23], [36.5, 17.5], [39.4, 14.6]], largura: [1.4, 2.2], material: 'terra', sulcos: false, irregular: 0.6 }, 5));
    k.objeto('escada.externa', [39.8, 13.4], { params: { largura: 3.2 }, rotation: -Math.PI / 2, blocks: { move: false, sight: false } });
    for (const y of [11.4, 15.4]) k.objeto('pilar', [40.6, y], { rotation: 0, scale: 1.3 });
    k.objeto('balaustrada', [41.4, 7.2], { params: { largura: 5 }, rotation: Math.PI / 2 - 0.02 });
    k.objeto('balaustrada', [41.2, 19.6], { params: { largura: 5 }, rotation: Math.PI / 2 + 0.04 });
    k.objeto('arco-de-pedra', [45.2, 13.4], { params: { largura: 3, flores: 1 }, rotation: Math.PI / 2 });
    k.objeto('urna.pedestal', [43.2, 9.6], { rotation: 0 });
    k.objeto('urna.pedestal', [43.2, 17.4], { rotation: 0 });

    // O tablado: roseta de pedra, círculo rúnico, a estátua do herói no meio e escombros da mureta que o cercava.
    k.objeto('roseta-de-calcamento', [25.5, 14.5], { params: { raio: 4.4 }, rotation: 0.2 });
    k.objeto('circulo-runico', [25.5, 14.5], { params: { raio: 3, raios: 8 }, rotation: 0 });
    k.objeto('estatua-heroica', [25.5, 14.2], { rotation: 0.35, scale: 1.9 });
    for (const [x, y, rot, falha] of [[21.2, 10.8, -0.8, 1], [29.8, 18.4, -0.8, 1], [20.8, 18.6, 0.75, 1]] as const) k.objeto('mureta-de-pedra', [x, y], { params: { largura: 2.5, falha }, rotation: rot });

    // Arquibancada em arco a nordeste, abrindo para o tablado.
    k.objeto('arquibancada', [32.6, 8.0], { params: { raio: 8.5, abertura: 105, degraus: 5 }, rotation: Math.PI / 4 + 0.1 });

    // Colunata partida ao norte.
    k.objeto('mureta-de-pedra', [17.5, 1.4], { params: { largura: 7, falha: 1 }, rotation: 0.02 });
    k.objeto('mureta-de-pedra', [27.2, 1.2], { params: { largura: 6, falha: 1 }, rotation: -0.03 });
    for (const [x, y] of [[14.4, 2.2], [21.6, 2.1], [24.4, 1.8], [30.6, 1.9]] as const) k.objeto('coluna-arruinada', [x, y], { rotation: 0, scale: 1.4 });
    k.objeto('coluna-caida', [18.6, 5.2], { rotation: 0.5, scale: 1.3 });
    k.objeto('coluna-caida', [34.6, 3.2], { rotation: -0.3, scale: 1.2 });

    // Ruína desmoronada a sudoeste: muretas tortas, escombros, colunas tombadas e o arco que sobrou.
    for (const [x, y, rot, l] of [[4.5, 13.6, 0.1, 5], [10.4, 16.8, 1.2, 4], [3.5, 21.2, -0.2, 4.5], [11.8, 23.4, 1.45, 3.5]] as const) k.objeto('mureta-de-pedra', [x, y], { params: { largura: l, falha: 1 }, rotation: rot });
    for (const [x, y, s, q] of [[6.4, 16.8, 2.8, 0], [3.2, 19.0, 2.4, 0], [8.8, 20.4, 2.6, 0], [5.2, 24.4, 3, 0], [14.2, 21.0, 1.8, 0], [10.2, 25.6, 2.2, 0], [1.6, 22.4, 2, 0], [12.0, 14.6, 1.6, 0]] as const) k.objeto('escombros', [x, y], { scale: s, params: { queimado: q } });
    k.objeto('coluna-caida', [7.4, 23.2], { rotation: 2.2, scale: 1.3 });
    k.objeto('arco-de-pedra', [15.2, 25.8], { params: { largura: 3.5, flores: 0 }, rotation: -0.25 });
    for (const [x, y] of [[2.2, 15.2], [12.6, 19.2], [9.4, 13.8]] as const) k.objeto('coluna-arruinada', [x, y], { scale: 1.3 });

    // Escombros e blocos soltos pelo pátio, sem cobrir o tablado.
    for (const [x, y, s] of [[17.4, 8.2, 1.5], [33.8, 21.6, 1.6], [21.6, 23.6, 1.2], [36.4, 12.6, 1.1], [19.2, 3.4, 1.3]] as const) k.objeto('escombros', [x, y], { scale: s });
    for (const [x, y] of [[19.6, 6.6], [16.4, 13.2], [31.4, 23.8], [35.4, 18.6], [22.6, 21.4]] as const) k.objeto('pedra.grande', [x, y], { scale: 0.8 });

    // Vegetação: carvalhos antigos a noroeste e a sudeste, mato e flores na beira, raízes saindo das lajes.
    k.objeto('casa:carvalho-grande-8m', [5.2, 4.6], { rotation: 0.4 });
    k.objeto('casa:carvalho-grande-7m', [11.6, 8.2], { rotation: 2.1 });
    k.objeto('casa:carvalho-grande-6m', [44.4, 25.2], { rotation: 1.2 });
    k.objeto('casa:arvore-5m', [1.6, 10.2], { rotation: 0.8 });
    k.objeto('casa:carvalho-grande-7m', [13.4, 0.6], { rotation: 1.4 });
    k.objeto('casa:arvore-7m', [0.4, 18.6], { rotation: 0.2 });
    k.objeto('casa:carvalho-grande-6m', [36.6, 26.4], { rotation: 2.8 });
    k.objeto('casa:arbusto-grande', [9.8, 1.6], { rotation: 0.3 });
    k.objeto('casa:arbusto-grande', [38.6, 5.4], { rotation: 1.9 });
    k.objeto('casa:arvore-7m', [45.6, 2.4], { rotation: 2.6 });
    k.objeto('raiz-exposta', [14.6, 10.4], { rotation: -0.4, scale: 1.4 });
    k.objeto('raiz-exposta', [8.6, 11.6], { rotation: 0.6, scale: 1.2 });
    k.espalhar('jardim', { poligono: [[36.5, 20], [41, 19], [42, 27], [34, 27]] }, { densidade: 0.18 });
    k.espalhar('mata', { poligono: [[0, 0], [12, 0], [13, 4], [9, 11], [0, 12]] }, { densidade: 0.08 });
    for (const [x, y] of [[38.2, 24.6], [36.8, 3.6], [12.4, 4.4], [16.8, 26.2], [42.4, 1.2], [1.8, 26]] as const) k.objeto('casa:arbusto-florido', [x, y], { scale: 0.9 + k.rng() * 0.4 });
    for (const [x, y] of [[20.6, 4.4], [30.6, 12.6], [18.4, 17.6], [27.2, 22.6], [33.2, 15.2]] as const) k.objeto('tufo-de-grama', [x, y], { scale: 1.2 });

    k.presenca('musgo', { poligono: [[13, 0], [33, 0], [33, 4], [13, 4.4]], irregular: 0.8 }, 0.35);
    k.presenca('musgo', { poligono: [[1, 13], [13, 14], [14, 26], [1, 26]], irregular: 1 }, 0.4);

    // Fim de tarde: o sol baixo estica a sombra do colosso pelo pátio.
    k.clima('tarde', { time: '16:40', ambient: { color: '#fff1da', intensity: 0.95 }, tempo: { leaves: 0.25, wind: 0.2, dust: 0.1 } });
    k.acabamento('quente', { vignette: 0.3, saturation: 1.12, tint: '#ffe9c4', edges: { kind: 'none', amount: 0 }, glow: 0.3 });
    k.guardarClima('entardecer', 'Entardecer dourado', 'entardecer', { time: '17:20' });
    k.guardarClima('lua-sobre-o-colosso', 'Lua sobre o colosso', 'noite', { time: '22:30' });

    k.regiao([[20, 9], [31, 9], [31, 20], [20, 20]], 'trigger', { nome: 'Tablado rúnico', texto: 'As runas do chão acendem quando alguém pisa na sombra da espada do herói.' });
    k.notas('Jardim do colosso — o pátio cerimonial de um reino esquecido. A estátua do herói guarda o tablado rúnico; da arquibancada, os espíritos assistem a quem ousar o desafio. O terraço a leste leva ao portão florido.');
  },
};
