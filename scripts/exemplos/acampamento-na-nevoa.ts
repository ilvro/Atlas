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
    k.objeto('tronco.caido', [20.2, 6.3], { rotation: -0.6, params: { comprimento: 5 } });
    k.objeto('galhada', [18.6, 7.4], { rotation: 0.4 });

    // O chão em volta: manchas de musgo entre as árvores e os carimbos de chão (P7), sorteados fora da fogueira e dos abrigos.
    for (const [x, y, r] of [[4.6, 12.6, 0.9], [19.6, 17.2, 1.1], [8.6, 5.4, 0.8], [17.2, 3.4, 0.7], [5.6, 19.4, 0.8]] as const) k.pintar('musgo', { disco: [x, y], raio: r, irregular: 0.6 });
    const CENTRO = [12.3, 12.8] as const, livres: [number, number, number][] = [
      [12.5, 13.2, 2.4], [8.8, 9.3, 2.0], [15.6, 10.0, 1.4], [7.8, 15.6, 1.4], [15.3, 16.0, 1.9], [20.2, 6.3, 1.8], [18.3, 7.6, 1.2], [22.1, 4.9, 1.2],
      ...([[18.4, 11.6], [19.2, 12.8], [18.0, 13.6], [19.8, 14.2], [18.8, 15.2], [20.4, 11.2]] as const).map(([x, y]) => [x, y, 0.6] as [number, number, number]),
    ];
    /** Um ponto entre `r0` e `r1` m do meio da clareira, longe da fogueira, dos abrigos, das pedras e dos outros carimbos (`folga` m). */
    const ponto = (r0: number, r1: number, folga: number): [number, number] | null => {
      for (let t = 0; t < 40; t++) {
        const a = k.rng() * Math.PI * 2, d = r0 + k.rng() * (r1 - r0), x = CENTRO[0] + Math.cos(a) * d, y = CENTRO[1] + Math.sin(a) * d;
        if (x < 0.5 || y < 0.5 || x > 23.5 || y > 23.5 || livres.some(([lx, ly, lr]) => Math.hypot(x - lx, y - ly) < lr + folga)) continue;
        livres.push([x, y, folga]); return [x, y];
      }
      return null;
    };
    const carimbo = (receita: string, n: number, r0: number, r1: number, folga: number, params: () => Record<string, number> = () => ({}), escala: () => number = () => 1): void => {
      for (let i = 0; i < n; i++) { const p = ponto(r0, r1, folga); if (p) k.objeto(receita, p, { rotation: k.rng() * 6, scale: escala(), params: params() }); }
    };
    // Capim alto e macio na franja da clareira (tufos de 1 a 1,6 m), samambaias e folhiço sob a borda das copas.
    carimbo('tufo-de-capim', 24, 4.4, 9.5, 0.7, () => ({ seco: 0.3 + k.rng() * 0.5 }), () => 1.1 + k.rng() * 0.6);
    carimbo('moita-de-samambaia', 6, 6.5, 11, 0.7);
    carimbo('folhico', 7, 5.5, 11, 0.6, () => ({ raio: 0.5 + k.rng() * 0.4 }));
    carimbo('galhada', 3, 5, 10, 0.6);
    // Gravetos soltos (galhada pequena) e brotos por todo o chão fora do miolo da clareira.
    carimbo('galhada', 9, 4, 12, 0.6, () => ({}), () => 0.5 + k.rng() * 0.15);
    carimbo('brotos', 70, 4, 12.5, 0.25, () => ({ raio: 0.6 + k.rng() * 0.5 }));

    // Raízes que saem de debaixo das copas pequenas e de troncos fora do quadro, na borda da clareira.
    for (const [x, y, r] of [[21.0, 11.8, 2.4], [19.4, 4.4, 2.2], [0.0, 13.2, 2.4], [6.6, 1.0, 2.2], [17.8, 5.0, 1.4], [4.6, 17.6, 1.5]] as const) k.objeto('raizes', [x, y], { rotation: k.rng() * 6, params: { raio: r } });

    // A mata: copas grandes fechando o sul e os cantos, mais ralas no norte; atrás delas, a mata contínua.
    for (const [x, y, item] of [
      [10.4, 20.4, 'casa:arvore-da-mata-8m'], [4.4, 21.6, 'casa:arvore-da-mata-6m'], [16.8, 21.8, 'casa:arvore-da-mata-6m'], [21.6, 19.0, 'casa:arvore-da-mata-8m'], [22.6, 24.0, 'casa:arvore-da-mata-6m'],
      [0.4, 18.0, 'casa:arvore-da-mata-6m'], [0.6, 7.4, 'casa:arvore-da-mata-6m-rala'], [3.4, 4.2, 'casa:arvore-da-mata-5m-amarelada'], [0.4, 0.8, 'casa:arvore-da-mata-8m'],
      [10.6, 1.4, 'casa:arvore-da-mata-6m'], [15.4, 0.2, 'casa:arvore-da-mata-6m-rala'], [21.6, 1.0, 'casa:arvore-da-mata-8m'], [23.6, 8.8, 'casa:arvore-da-mata-6m'],
      [23.6, 14.0, 'casa:arvore-da-mata-6m-rala'], [0.0, 13.2, 'casa:arvore-da-mata-4m'], [6.6, 1.0, 'casa:arvore-da-mata-4m'], [19.4, 4.4, 'casa:arvore-da-mata-4m'], [1.2, 23.6, 'casa:arvore-da-mata-8m'],
      [2.6, 10.2, 'casa:arvore-da-mata-6m'], [3.2, 15.6, 'casa:arvore-da-mata-6m'], [7.0, 21.6, 'casa:arvore-da-mata-6m'], [13.6, 23.0, 'casa:arvore-da-mata-6m'],
      [20.2, 22.8, 'casa:arvore-da-mata-6m'], [22.4, 4.6, 'casa:arvore-da-mata-6m'], [13.6, 3.4, 'casa:arvore-da-mata-6m-rala'], [7.0, 4.0, 'casa:arvore-da-mata-6m-rala'],
      [21.0, 11.8, 'casa:arvore-da-mata-4m'], [18.6, 1.6, 'casa:arvore-da-mata-6m'],
    ] as const) k.objeto(item, [x, y], { rotation: k.rng() * 6 });

    k.clima('noite', { time: '23:10', ambient: { color: '#aab6b0', intensity: 0.8 }, sun: { angle: 2.4, color: '#a8b8d8', intensity: 0.9 }, tempo: { fog: 0.45, wind: 0.08 } });
    k.acabamento(null, { saturation: 0.85, vignette: 0.3, glow: 0.6, tint: '#f0f2ec', exposure: 0.95, edges: { kind: 'none', amount: 0 } });

    k.notas('Acampamento na névoa: quatro abrigos em volta da fogueira, no fundo de uma mata fechada. A névoa passa por cima das copas e esconde quem se aproxima.');
  },
};
