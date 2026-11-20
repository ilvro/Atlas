import type { Exemplo } from './kit.ts';

/** Acampamento na névoa (24 × 24 m): clareira de terra batida no meio da mata fechada, quatro abrigos em volta da fogueira e bancos de névoa sobre as copas. */
export const acampamentoNaNevoa: Exemplo = {
  id: 'acampamento-na-nevoa',
  nome: 'Acampamento na névoa',
  descricao: 'Clareira de terra batida na mata fechada, à noite: fogueira entre troncos, quatro abrigos de lona e peles, pedras e galhos, e bancos de névoa passando por cima das copas.',
  largura: 24,
  altura: 24,
  semente: 52817,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#0c100d' });
    k.base('chao.de.mata');

    // A clareira: chão batido, mais funda para o sul e para o leste.
    k.pintar('chao.batido', { poligono: [[7.4, 7.8], [12.4, 7.0], [16.8, 8.6], [17.8, 12.4], [17.0, 16.6], [14.6, 18.4], [10.6, 18.2], [7.0, 16.4], [6.2, 12.2]], irregular: 0.8 });

    // A fogueira e o círculo de troncos.
    k.objeto('fogueira', [12.5, 13.2]);
    k.luz('fogueira', [12.5, 13.2], { radius: 7, intensity: 0.9 });
    k.objeto('tora-assento', [12.4, 11.5], { rotation: 0, params: { comprimento: 1.5 } });
    k.objeto('tora-assento', [10.7, 13.2], { rotation: Math.PI / 2, params: { comprimento: 1.2 } });
    k.objeto('tora-assento', [14.2, 13.1], { rotation: -Math.PI / 2, params: { comprimento: 1.1 } });
    k.objeto('tora-assento', [12.8, 14.8], { rotation: 0.02, params: { comprimento: 1.6 } });
    k.objeto('pedra.media', [11.4, 14.8], { scale: 0.7 });
    k.objeto('bau', [13.7, 12.0], { rotation: 0.3, scale: 0.45 });

    // Os abrigos: lona cinza a noroeste, peles a nordeste, catre de peles a sudoeste e lona verde a sudeste.
    k.objeto('tenda', [8.8, 9.3], { rotation: -0.55, params: { lona: 'tecido.cinza' } });
    k.objeto('catre-de-peles', [15.6, 10.0], { rotation: 0.55 + Math.PI / 2, params: { estilo: 0 } });
    k.objeto('catre-de-peles', [7.8, 15.6], { rotation: 0, params: { estilo: 1 } });
    k.objeto('tenda', [15.3, 16.0], { rotation: Math.PI / 2, params: { lona: 'tecido.salvia' } });

    // Pedras e galhos espalhados na franja leste.
    for (const [x, y, s] of [[18.4, 11.6, 0.7], [19.2, 12.8, 0.5], [18.0, 13.6, 0.6], [19.8, 14.2, 0.8], [18.8, 15.2, 0.5], [20.4, 11.2, 0.45]] as const) k.objeto('pedra.media', [x, y], { scale: s, rotation: k.rng() * 6 });
    k.objeto('tora-assento', [21.0, 5.8], { rotation: -0.6, params: { comprimento: 3.2, casca: 1 } });

    // A mata: copas grandes fechando o sul e os cantos, mais ralas no norte; atrás delas, a mata contínua.
    for (const [x, y, item] of [
      [10.4, 20.4, 'casa:arvore-da-mata-8m'], [4.4, 21.6, 'casa:arvore-da-mata-6m'], [16.8, 21.8, 'casa:arvore-da-mata-6m'], [21.6, 19.0, 'casa:arvore-da-mata-8m'], [22.6, 24.0, 'casa:arvore-da-mata-6m'],
      [0.4, 18.0, 'casa:arvore-da-mata-6m'], [0.6, 7.4, 'casa:arvore-da-mata-6m-rala'], [3.4, 4.2, 'casa:arvore-da-mata-5m-amarelada'], [0.4, 0.8, 'casa:arvore-da-mata-8m'],
      [10.6, 1.4, 'casa:arvore-da-mata-6m'], [15.4, 0.2, 'casa:arvore-da-mata-6m-rala'], [21.6, 1.0, 'casa:arvore-da-mata-8m'], [23.6, 8.8, 'casa:arvore-da-mata-6m'],
      [23.6, 14.0, 'casa:arvore-da-mata-6m-rala'], [0.0, 13.2, 'casa:arvore-da-mata-4m'], [6.6, 1.0, 'casa:arvore-da-mata-4m'], [19.4, 4.4, 'casa:arvore-da-mata-4m'], [1.2, 23.6, 'casa:arvore-da-mata-8m'],
      [2.6, 10.2, 'casa:arvore-da-mata-6m'], [3.2, 15.6, 'casa:arvore-da-mata-5m-amarelada'], [7.0, 21.6, 'casa:arvore-da-mata-6m'], [13.6, 23.0, 'casa:arvore-da-mata-6m'],
      [20.2, 22.8, 'casa:arvore-da-mata-6m'], [22.4, 4.6, 'casa:arvore-da-mata-6m'], [13.6, 3.4, 'casa:arvore-da-mata-5m-amarelada'], [7.0, 4.0, 'casa:arvore-da-mata-6m-rala'],
      [21.0, 11.8, 'casa:arvore-da-mata-4m'], [18.6, 1.6, 'casa:arvore-da-mata-6m'],
    ] as const) k.objeto(item, [x, y], { rotation: k.rng() * 6 });

    k.clima('noite', { time: '23:10', ambient: { color: '#aab6b0', intensity: 0.8 }, sun: { angle: 2.4, color: '#a8b8d8', intensity: 0.9 }, tempo: { fog: 0.45, wind: 0.08 } });
    k.acabamento(null, { saturation: 0.85, vignette: 0.3, glow: 0.6, tint: '#f0f2ec', exposure: 0.95, edges: { kind: 'none', amount: 0 } });

    k.notas('Acampamento na névoa: quatro abrigos em volta da fogueira, no fundo de uma mata fechada. A névoa passa por cima das copas e esconde quem se aproxima.');
  },
};
