import type { Luz, Objeto, Peca, Ponto, Regiao } from './mapa.ts';

/** Identificador curto e único o bastante para uma entidade criada no editor. */
export const novoIdEntidade = (prefixo = 'x'): string => `${prefixo}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

export const novaLuz = (position: Ponto, extra: Partial<Luz> = {}): Luz => ({
  id: novoIdEntidade('l'), position, radius: 5, color: '#ffb36b', intensity: 1, flicker: 0.1, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, ...extra,
});

export const novoObjeto = (position: Ponto, extra: Partial<Objeto> = {}): Objeto => ({
  id: novoIdEntidade('o'), source: { kind: 'recipe', recipe: 'caixa', seed: Math.floor(Math.random() * 2 ** 31), params: {} }, position, rotation: 0, scale: 1,
  elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, ...extra,
});

export const novaPeca = (position: Ponto, name = 'Peça', extra: Partial<Peca> = {}): Peca => ({
  id: novoIdEntidade('t'), name, portrait: null, sprite: null, facing: 'down', position, size: 1, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], ...extra,
});

export const novaRegiao = (centro: Ponto, lado = 3, extra: Partial<Regiao> = {}): Regiao => ({
  id: novoIdEntidade('r'),
  polygon: [[centro[0] - lado / 2, centro[1] - lado / 2], [centro[0] + lado / 2, centro[1] - lado / 2], [centro[0] + lado / 2, centro[1] + lado / 2], [centro[0] - lado / 2, centro[1] + lado / 2]],
  kind: 'note', gmOnly: true, payload: {}, refs: [], ...extra,
});

/** Nome de um item para listas e dicas: o que o mestre deu, ou o tipo. */
export function nomeDoAlvo(colecao: string, entidade: { id: string }): string {
  const item = entidade as { id: string } & Record<string, unknown>;
  if (colecao === 'tokens') return String(item.name ?? 'Peça');
  if (colecao === 'lights') return item.cone ? 'Lanterna' : 'Luz';
  if (colecao === 'props') { const s = item.source as { kind?: string; recipe?: string; assetId?: string } | undefined; return s?.kind === 'recipe' ? String(s.recipe) : String(s?.assetId ?? 'Objeto'); }
  if (colecao === 'regions') return `Região (${String(item.kind ?? '')})`;
  return item.id;
}
