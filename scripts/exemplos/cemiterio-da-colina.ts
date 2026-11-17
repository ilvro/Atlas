import { caminho } from '../../src/authoring/caminho.ts';
import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import type { Exemplo } from './kit.ts';

/** Cemitério da colina (48 × 27 m): o topo de uma colina no escuro, com capela, jazigo, lápides tortas, túmulos que brilham e o portão da roseira. */
export const cemiterioDaColina: Exemplo = {
  id: 'cemiterio-da-colina',
  nome: 'Cemitério da colina',
  descricao: 'Topo de colina cercado de escuro: capela de pedra com telhado de telha, jazigo, lápides tortas, sarcófagos que brilham, anjos, árvores mortas, muro de pedra e o portão da roseira.',
  largura: 48,
  altura: 27,
  semente: 11887,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#030202' });
    k.base('vazio');

    // A colina: uma ilha de terra no escuro, com lajes velhas no meio e capim seco na borda.
    const colina: [number, number][] = [[6, 9], [12, 5], [20, 2], [30, 1], [36, 3], [41, 9], [44, 15], [42, 21], [36, 25], [26, 26.5], [16, 25], [8, 21], [4, 15]];
    k.pintar('grama.seca', { poligono: colina, irregular: 0.45 });
    k.pintar('terra', { poligono: [[9, 10], [17, 6], [30, 4.5], [38, 9], [40, 16], [35, 22], [24, 24], [13, 21], [8, 15]], irregular: 0.9 });
    k.pintar('lajes.antigas', { poligono: [[14, 10], [26, 7], [34, 10], [35, 17], [27, 21], [17, 19]], irregular: 1 });
    k.aplicar(m => caminho(m, { pontos: [[41.6, 12.6], [36, 13.4], [29, 13], [22, 15], [14, 15.6]], largura: [1.2, 1.8], material: 'calcada', irregular: 0.6 }, 4));

    // A capela ao norte e o jazigo da família a oeste.
    k.aplicar((m, id) => construirEdificios(m, [
      { nome: 'Capela', origem: [20, 1], lote: [5, 5], frente: 's', forma: 'linear', telhado: 'telha.barro', comodos: [{ tipo: 'capela', area: 40, principal: true }] },
      { nome: 'Jazigo da família', origem: [6, 6], lote: [3, 3], frente: 'l', forma: 'compacta', telhado: 'telha.velha', comodos: [{ tipo: 'capela', area: 12, nome: 'Jazigo', principal: true }] },
    ], 7, id));
    k.tirarExternosDosInteriores();

    // Lápides, túmulos e covas, sem fila mecânica.
    k.espalhar('cemiterio', { poligono: [[12, 11], [20, 8.5], [24, 12], [20, 18], [13, 18]] }, { densidade: 0.12, escala: 1.6 });
    k.espalhar('cemiterio', { poligono: [[26, 15], [34, 14.5], [38, 18], [32, 22], [25, 21]] }, { densidade: 0.11, escala: 1.6 });
    k.espalhar('cemiterio', { poligono: [[33, 8], [39, 8.5], [40, 11.5], [34, 11.2]] }, { densidade: 0.14, escala: 1.6 });
    for (const [x, y, r] of [[15.4, 9.6, 0.2], [22.2, 11.4, -0.3], [28.6, 20.6, 0.4], [35.2, 19.2, -0.2], [12.4, 15.2, 0.1], [24.8, 16.4, 0.5]] as const) k.objeto(x > 24 ? 'cruz.pedra' : 'cruz.madeira', [x, y], { rotation: r, scale: 1.5 });
    for (const [x, y, r] of [[17.2, 13.6, 0.3], [30.4, 18.6, -0.4], [36.6, 7.6, 0.9]] as const) k.objeto('sarcofago', [x, y], { rotation: r, scale: 1.1 });
    k.objeto('tumulo', [24.6, 19.2], { rotation: 1.2 });
    k.objeto('cova.aberta', [20.6, 20.8], { rotation: 0.2 });
    k.objeto('cova', [13.4, 19.4], { params: { fresca: 1 }, rotation: -0.5 });
    k.objeto('caixao', [22.6, 21.8], { rotation: 1.4 });

    // Anjos e estátuas, o poço dos desejos, árvores mortas.
    for (const [x, y, r] of [[13.6, 8.2, 0.4], [27.4, 10.8, -0.2], [38.2, 15.8, 2.6]] as const) k.objeto('anjo', [x, y], { rotation: r, scale: 1.2 });
    k.objeto('estatua', [9.4, 16.4], { rotation: 0, scale: 1.3 });
    k.objeto('circulo-runico', [19.4, 16.4], { params: { raio: 1.2, raios: 0 }, rotation: 0 });
    k.objeto('urna.pedestal', [19.4, 16.4], { rotation: 0, scale: 1.4 });
    for (const [x, y, s, r] of [[18.4, 4.6, 1.6, 0.4], [11.6, 6.6, 1.2, 1.8], [26, 23.6, 1.3, 2.6], [7.2, 19.2, 1, 0.9]] as const) k.objeto('arvore-morta', [x, y], { params: { tamanho: s }, rotation: r });
    k.objeto('arvore-morta', [6.6, 12.4], { params: { tamanho: 1.4 }, rotation: 2.2 });
    for (const [x, y] of [[29.6, 16.4], [15.2, 11.2], [33.4, 20.4], [28.8, 8.6]] as const) k.objeto('casa:arbusto-seco-1m', [x, y], { rotation: k.rng() * 6 });

    // O muro de pedra seca no leste e o portão da roseira.
    k.objeto('mureta-de-pedra', [41.6, 18.6], { params: { largura: 7, falha: 1 }, rotation: 2.05 });
    k.objeto('mureta-de-pedra', [38.8, 23.0], { params: { largura: 5, falha: 1 }, rotation: 2.6 });
    k.objeto('mureta-de-pedra', [40.4, 6.6], { params: { largura: 6, falha: 1 }, rotation: 1.0 });
    k.objeto('arco-de-pedra', [42.4, 12.6], { params: { largura: 2.5, flores: 1 }, rotation: Math.PI / 2 + 0.15 });
    k.objeto('portao.ferro', [43.2, 12.8], { rotation: Math.PI / 2 + 0.15 });
    k.objeto('mureta-de-pedra', [8.4, 22.6], { params: { largura: 5, falha: 1 }, rotation: 0.75 });

    // Luzes: os sarcófagos que brilham, o poço e duas lanternas.
    k.luz('vela', [17.2, 13.6], { radius: 4.5, intensity: 1.5, color: '#ffd27a' });
    k.luz('vela', [30.4, 18.6], { radius: 4.5, intensity: 1.4, color: '#ffd27a' });
    k.luz('vela', [36.6, 7.6], { radius: 4, intensity: 1.3, color: '#ffe1a0' });
    k.luz('lamparina', [19.4, 16.4], { radius: 4.5, intensity: 1.2, color: '#ffbe5a' });
    k.luz('lanterna', [42, 15.2], { radius: 5.5 });
    k.luz('lanterna', [31.6, 6.0], { radius: 5 });
    k.presenca('musgo', { poligono: colina, irregular: 0.6 }, 0.3);

    k.clima('noite', { time: '23:40', ambient: { color: '#9a6a52', intensity: 0.58 }, tempo: { fog: 0.15, leaves: 0.1, wind: 0.1 } });
    k.acabamento(null, { tint: '#ffc8a8', saturation: 1.05, vignette: 0.55, edges: { kind: 'dark', amount: 0.55 }, glow: 0.75 });
    k.guardarClima('enterro-ao-entardecer', 'Enterro ao entardecer', 'entardecer', { finish: { edges: { kind: 'dark', amount: 0.4 } } });
    k.guardarClima('nevoeiro-dos-mortos', 'Nevoeiro dos mortos', 'neblina', { time: '03:00', sun: null, ambient: { color: '#56606a', intensity: 0.3 } });

    k.regiao([[14, 12], [22, 12], [22, 19], [14, 19]], 'trigger', { nome: 'Túmulos acesos', texto: 'As tampas dos sarcófagos brilham por dentro, como se alguém tivesse acendido velas lá embaixo.' });
    k.notas('Cemitério da colina — à meia-noite os sarcófagos se acendem. O coveiro jura que não é ele; o jazigo da família guarda a cripta, e o portão da roseira só abre por dentro.');
  },
};
