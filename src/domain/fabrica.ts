import { ACERVO } from '../procedural/acervo.ts';
import type { Luz, MapaAtlas, Objeto, Peca, Ponto, Regiao } from './mapa.ts';
import type { ColecaoLivre } from '../state/comandos.ts';

/** Identificador curto e único o bastante para uma entidade criada no editor. */
export const novoIdEntidade = (prefixo = 'x'): string => `${prefixo}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

export const novaLuz = (position: Ponto, extra: Partial<Luz> = {}): Luz => ({
  id: novoIdEntidade('l'), position, radius: 5, color: '#ffb36b', intensity: 1, flicker: 0.1, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null, rays: false, ...extra,
});

export const novoObjeto = (position: Ponto, extra: Partial<Objeto> = {}): Objeto => ({
  id: novoIdEntidade('o'), source: { kind: 'recipe', recipe: 'caixa', seed: Math.floor(Math.random() * 2 ** 31), params: {} }, position, rotation: 0, scale: 1,
  elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null, ...extra,
});

export const novaPeca = (position: Ponto, name = 'Peça', extra: Partial<Peca> = {}): Peca => ({
  id: novoIdEntidade('t'), name, portrait: null, sprite: null, facing: 'down', position, size: 1, player: false, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], hp: null, ...extra,
});

export const novaRegiao = (centro: Ponto, lado = 3, extra: Partial<Regiao> = {}): Regiao => ({
  id: novoIdEntidade('r'),
  polygon: [[centro[0] - lado / 2, centro[1] - lado / 2], [centro[0] + lado / 2, centro[1] - lado / 2], [centro[0] + lado / 2, centro[1] + lado / 2], [centro[0] - lado / 2, centro[1] + lado / 2]],
  kind: 'note', gmOnly: true, payload: {}, refs: [], ...extra,
});

/** Nome de um item para listas e dicas: o que o mestre deu, ou o tipo. */
export function nomeDoAlvo(colecao: string, entidade: { id: string }): string {
  const item = entidade as { id: string } & Record<string, unknown>;
  if (colecao === 'rooms') return String(item.name ?? 'Cômodo');
  if (colecao === 'walls') return item.source ? 'Parede do cômodo' : 'Parede';
  if (colecao === 'openings') return ({ door: 'Porta', window: 'Janela', arch: 'Arco', secret: 'Porta secreta' } as Record<string, string>)[String(item.kind)] ?? 'Abertura';
  if (colecao === 'tokens') return String(item.name ?? 'Peça');
  if (colecao === 'lights') return item.cone ? 'Lanterna' : 'Luz';
  if (colecao === 'props') { const s = item.source as { kind?: string; recipe?: string; assetId?: string } | undefined; const id = s?.kind === 'recipe' ? String(s.recipe) : s?.kind === 'asset' ? String(s.assetId) : null; return id ? (ACERVO.item(id)?.nome ?? id) : 'Objeto'; }
  if (colecao === 'regions') { const p = item.payload as Record<string, unknown> | undefined; return (typeof p?.nome === 'string' && p.nome.trim()) ? p.nome.trim() : `Região (${String(item.kind ?? '')})`; }
  return item.id;
}

/**
 * Cópias dos itens `alvos`, deslocadas de `delta`, como comandos prontos e os alvos novos. Luzes não levam o dono e peças
 * não levam a luz, para a cópia não dividir nada com o original. Itens de construção não se copiam assim.
 */
export function copiasDe(mapa: MapaAtlas, alvos: readonly { colecao: string; id: string }[], delta: Ponto): { comandos: { tipo: 'item.adicionar'; colecao: ColecaoLivre; item: { id: string } & Record<string, unknown> }[]; alvos: { colecao: ColecaoLivre; id: string }[] } {
  const comandos: { tipo: 'item.adicionar'; colecao: ColecaoLivre; item: { id: string } & Record<string, unknown> }[] = [], novos: { colecao: ColecaoLivre; id: string }[] = [];
  for (const a of alvos) {
    if (!(['props', 'lights', 'tokens', 'regions'] as string[]).includes(a.colecao)) continue;
    const colecao = a.colecao as ColecaoLivre, original = ((mapa[colecao] as unknown) as Record<string, Record<string, unknown>>)[a.id]; if (!original) continue;
    if (colecao === 'props' && (original as unknown as Objeto).elevation === 'wall') continue;
    const copia = structuredClone(original) as { id: string } & Record<string, unknown>;
    copia.id = novoIdEntidade(colecao[0]);
    if (colecao === 'regions') copia.polygon = (copia.polygon as Ponto[]).map(([x, y]) => [x + delta[0], y + delta[1]]);
    else copia.position = [(copia.position as Ponto)[0] + delta[0], (copia.position as Ponto)[1] + delta[1]];
    if (colecao === 'tokens') { copia.name = `${String(copia.name)} (cópia)`; copia.lightId = null; }
    if (colecao === 'lights') copia.ownerId = null;
    if (colecao === 'props') copia.roomId = null;
    comandos.push({ tipo: 'item.adicionar', colecao, item: copia }); novos.push({ colecao, id: copia.id });
  }
  return { comandos, alvos: novos };
}
