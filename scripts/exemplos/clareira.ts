import type { Exemplo } from './kit.ts';

/** Exemplo-semente: pequeno de propósito, só para provar a cadeia (script, JSON, galeria, "Usar este exemplo"). */
export const clareira: Exemplo = {
  id: 'clareira', nome: 'Clareira', descricao: 'Uma clareira com trilha de terra, seis árvores e uma fogueira.', largura: 30, altura: 20, semente: 11,
  construir(k) {
    k.base('grama');
    k.pintar('terra', { faixa: [[0, 14], [9, 12], [18, 10], [30, 11]], largura: 2, irregular: 0.3 });
    k.pintar('terra', { disco: [15, 10], raio: 2.2, irregular: 0.4 });
    for (const [item, pos] of [['casa:arvore-5m', [4, 4]], ['casa:arvore-7m', [10, 3]], ['casa:arvore-3m', [24, 4]], ['casa:arvore-5m', [27, 15]], ['casa:pinheiro-4m', [6, 17]], ['casa:pinheiro-3m', [21, 17]]] as const) k.objeto(item, [pos[0], pos[1]]);
    k.luz('fogueira', [15, 10]);
    k.clima('tarde');
  },
};
