import assert from 'node:assert/strict';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { circulacao, malhaDoComodo } from '../../src/authoring/malha.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { recalcularParedes } from '../../src/domain/geometria.ts';
import { criarMapa, type Abertura, type Comodo, type MapaAtlas, type Parede } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

export const sala = (id: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Comodo> = {}): Comodo => {
  const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]);
  return { id, name: id, function: null, cells: codificar(c), floor: { material: 'piso.madeira-escura', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null, ...extra };
};
/** Mapa com os cômodos dados (grade de 1,5 m) e as paredes derivadas. */
export function mapaCom(...salas: Comodo[]): MapaAtlas {
  const m = criarMapa({ id: 'm', agora: 1 }); for (const s of salas) m.rooms[s.id] = s;
  recalcularParedes(m); return m;
}
export const abertura = (_m: MapaAtlas, id: string, wallId: string, at: number, kind: Abertura['kind'] = 'door'): Abertura => ({ id, wallId, at, width: 0.9, kind, state: 'closed', material: 'madeira.media', som: null, swing: 'a' });


/** Acha a parede (derivada) cujo caminho está todo na linha `x` (vertical) ou `y` (horizontal), com ao menos `min` metros. */
export const paredeEm = (m: MapaAtlas, eixo: 'x' | 'y', valor: number, min = 0): Parede | undefined =>
  Object.values(m.walls).find(w => w.path.every(p => Math.abs(p[eixo === 'x' ? 0 : 1] - valor) < 1e-9) && Math.hypot(w.path[0]![0] - w.path.at(-1)![0], w.path[0]![1] - w.path.at(-1)![1]) >= min - 1e-9);

/** O critério de "casa jogável" da Fase 5, em asserções: funções certas, todos os cômodos alcançáveis pelas portas, uma porta para fora, circulação, móveis sem sobreposição, luz em cada cômodo e mapa válido. */
export function verificarCasa(m: MapaAtlas, funcoes: Record<string, string>): void {
  validarMapa(m);
  const ids = Object.keys(m.rooms), porNome = Object.fromEntries(Object.values(m.rooms).map(r => [r.name, r]));
  for (const [nome, funcao] of Object.entries(funcoes)) assert.equal(porNome[nome]?.function, funcao, `${nome} deveria ser ${funcao}`);
  // Alcançáveis entre si pelas portas, e uma porta para fora.
  const grafo = new Map<string, Set<string>>(ids.map(i => [i, new Set()])); let paraFora = false;
  for (const id of ids) for (const p of insightDoComodo(m, id)!.portas) { if (p.outro) grafo.get(id)!.add(p.outro); else paraFora = true; }
  const vistos = new Set<string>([ids[0]!]), fila = [ids[0]!];
  while (fila.length) for (const v of grafo.get(fila.shift()!)!) if (!vistos.has(v)) { vistos.add(v); fila.push(v); }
  assert.equal(vistos.size, ids.length, 'todos os cômodos se alcançam pelas portas'); assert.ok(paraFora, 'há uma porta para fora');
  for (const id of ids) {
    const ins = insightDoComodo(m, id)!;
    assert.equal(circulacao(malhaDoComodo(m, ins), ins).ligada, true, `${m.rooms[id]!.name}: circulação ligada`);
    assert.ok(ins.luzes.length > 0, `${m.rooms[id]!.name} tem luz`);
    const caixas = ins.objetos.filter(o => m.props[o.id]!.elevation === 'floor' && m.props[o.id]!.blocks.move).map(o => o.caixa);
    for (const c of caixas) assert.ok(c.x0 >= ins.caixa.x0 - 1e-6 && c.y0 >= ins.caixa.y0 - 1e-6 && c.x1 <= ins.caixa.x1 + 1e-6 && c.y1 <= ins.caixa.y1 + 1e-6, `${m.rooms[id]!.name}: móvel dentro da caixa do cômodo`);
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i]!, b = caixas[j]!; assert.ok(!(a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6), `${m.rooms[id]!.name}: móveis ${i} e ${j} se sobrepõem`);
    }
  }
}
