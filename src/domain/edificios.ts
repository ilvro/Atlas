import { decodificar } from './celulas.ts';
import type { Comodo, MapaAtlas } from './mapa.ts';

export interface Edificio {
  id: string;
  salas: string[];
  celulas: [number, number][];
}

const cache = new WeakMap<MapaAtlas['rooms'], Edificio[]>();
const VIZINHOS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function compararId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function agruparNivel(salas: Comodo[]): Edificio[] {
  const pai = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (pai.get(r) !== r) r = pai.get(r)!;
    while (pai.get(x) !== r) {
      const p = pai.get(x)!;
      pai.set(x, r);
      x = p;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (compararId(ra, rb) < 0) pai.set(rb, ra);
    else pai.set(ra, rb);
  };

  const celulasPorSala = new Map<string, [number, number][]>();
  const dono = new Map<string, string>();

  for (const s of salas) {
    pai.set(s.id, s.id);
    const lista = decodificar(s.cells).map(([x, y]): [number, number] => [x, y]);
    celulasPorSala.set(s.id, lista);
    for (const [x, y] of lista) dono.set(`${x},${y}`, s.id);
  }

  for (const s of salas) {
    for (const [x, y] of celulasPorSala.get(s.id)!) {
      for (const [dx, dy] of VIZINHOS) {
        const outro = dono.get(`${x + dx},${y + dy}`);
        if (outro && outro !== s.id) union(s.id, outro);
      }
    }
  }

  const grupos = new Map<string, string[]>();
  for (const s of salas) {
    const r = find(s.id);
    const lista = grupos.get(r);
    if (lista) lista.push(s.id);
    else grupos.set(r, [s.id]);
  }

  const saida: Edificio[] = [];
  for (const ids of grupos.values()) {
    ids.sort(compararId);
    const vistas = new Set<string>();
    const celulas: [number, number][] = [];
    for (const id of ids) {
      for (const [x, y] of celulasPorSala.get(id)!) {
        const k = `${x},${y}`;
        if (!vistas.has(k)) {
          vistas.add(k);
          celulas.push([x, y]);
        }
      }
    }
    celulas.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    saida.push({ id: ids[0]!, salas: ids, celulas });
  }
  return saida;
}

/** Agrupa os cômodos com telhado (`roof.material !== null`) em edifícios conectados em 4 direções por nível. */
export function edificiosDe(m: Pick<MapaAtlas, 'rooms'>): Edificio[] {
  const guardado = cache.get(m.rooms);
  if (guardado) return guardado;

  const porNivel = new Map<string | null, Comodo[]>();
  for (const sala of Object.values(m.rooms)) {
    if (!sala.roof.material) continue;
    const chave = sala.levelId ?? null;
    const lista = porNivel.get(chave);
    if (lista) lista.push(sala);
    else porNivel.set(chave, [sala]);
  }

  const resultado: Edificio[] = [];
  for (const salas of porNivel.values()) {
    resultado.push(...agruparNivel(salas));
  }
  resultado.sort((a, b) => compararId(a.id, b.id));
  cache.set(m.rooms, resultado);
  return resultado;
}

export function edificioDaSala(m: Pick<MapaAtlas, 'rooms'>, salaId: string): Edificio | null {
  for (const ed of edificiosDe(m)) {
    if (ed.salas.includes(salaId)) return ed;
  }
  return null;
}
