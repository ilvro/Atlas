import { decodificar } from './celulas.ts';
import type { Edificio } from './edificios.ts';
import type { CumeeiraDeTelhado, DetalheDeTelhado, FormaDeTelhado, MapaAtlas, Telhado } from './mapa.ts';

export type Ret = [x0: number, y0: number, x1: number, y1: number];
export type Segmento = [[number, number], [number, number]];

export interface Face {
  pontos: [number, number][];
  normal: [number, number];
  queda: [number, number];
  platibanda?: boolean;
}

export interface Trecho {
  salas: string[];
  celulas: [number, number][];
  roof: Telhado;
}

export interface FormaResolvida {
  shape: FormaDeTelhado;
  ridge: CumeeiraDeTelhado;
  steep: boolean;
  details: DetalheDeTelhado[];
}

const VIZINHOS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const compararId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Resolve campos opcionais do telhado com os padrões do documento. */
export function formaDe(roof?: Partial<Telhado>): FormaResolvida {
  return {
    shape: roof?.shape ?? 'quatro-aguas',
    ridge: roof?.ridge ?? 'auto',
    steep: roof?.steep ?? false,
    details: roof?.details ? [...roof.details] : [],
  };
}

/** Ordem de desenho dos trechos: plano (0) por baixo, águas (1) no meio, pirâmide (2) por cima. */
export function ordemDoTrecho(roof?: Partial<Telhado>): number {
  const s = formaDe(roof).shape;
  if (s === 'plano') return 0;
  if (s === 'piramide') return 2;
  return 1;
}

/** Agrupa os cômodos vizinhos de um edifício que compartilham o mesmo `material` e `shape`. */
export function trechosDe(m: Pick<MapaAtlas, 'rooms'>, edificio: Edificio): Trecho[] {
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
  const chaveDaSala = new Map<string, string>();
  const dono = new Map<string, string>();

  for (const id of edificio.salas) {
    const sala = m.rooms[id];
    if (!sala || !sala.roof.material) continue;
    pai.set(id, id);
    const shape = formaDe(sala.roof).shape;
    chaveDaSala.set(id, `${sala.roof.material}\0${shape}`);
    const cels = decodificar(sala.cells).map(([x, y]): [number, number] => [x, y]);
    celulasPorSala.set(id, cels);
    for (const [x, y] of cels) dono.set(`${x},${y}`, id);
  }

  for (const id of celulasPorSala.keys()) {
    const chave = chaveDaSala.get(id)!;
    for (const [x, y] of celulasPorSala.get(id)!) {
      for (const [dx, dy] of VIZINHOS) {
        const outro = dono.get(`${x + dx},${y + dy}`);
        if (outro && outro !== id && chaveDaSala.get(outro) === chave) union(id, outro);
      }
    }
  }

  const grupos = new Map<string, string[]>();
  for (const id of celulasPorSala.keys()) {
    const r = find(id);
    const lista = grupos.get(r);
    if (lista) lista.push(id);
    else grupos.set(r, [id]);
  }

  const trechos: Trecho[] = [];
  for (const ids of grupos.values()) {
    ids.sort(compararId);
    const base = m.rooms[ids[0]!]!.roof;
    const detalhes = new Set<DetalheDeTelhado>();
    let steep = !!base.steep;
    let ridge = base.ridge;
    for (const id of ids) {
      const r = m.rooms[id]!.roof;
      if (r.steep) steep = true;
      if (!ridge && r.ridge) ridge = r.ridge;
      for (const d of r.details ?? []) detalhes.add(d);
    }

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
    const roof: Telhado = {
      material: base.material,
      visible: ids.some(id => m.rooms[id]!.roof.visible),
      ...(base.shape ? { shape: base.shape } : {}),
      ...(ridge ? { ridge } : {}),
      ...(steep ? { steep } : {}),
      ...(detalhes.size ? { details: [...detalhes] } : {}),
    };
    trechos.push({ salas: ids, celulas, roof });
  }

  trechos.sort((a, b) => ordemDoTrecho(a.roof) - ordemDoTrecho(b.roof) || compararId(a.salas[0]!, b.salas[0]!));
  return trechos;
}

/** Decomposição gulosa de células em retângulos maximais `[x0, y0, x1, y1]`, o de maior área primeiro. */
export function retangulosDe(celulas: readonly [number, number][]): Ret[] {
  if (!celulas.length) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of celulas) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const grade = new Uint8Array(w * h);
  let restantes = 0;
  for (const [x, y] of celulas) {
    const idx = (y - minY) * w + (x - minX);
    if (!grade[idx]) {
      grade[idx] = 1;
      restantes++;
    }
  }

  const rets: Ret[] = [];
  const alturas = new Int32Array(w);

  while (restantes > 0) {
    alturas.fill(0);
    let melhorArea = 0;
    let melhor: Ret = [0, 0, 0, 0];

    for (let ry = 0; ry < h; ry++) {
      for (let rx = 0; rx < w; rx++) {
        alturas[rx] = grade[ry * w + rx] ? alturas[rx]! + 1 : 0;
      }
      // Maior retângulo no histograma que termina na linha `ry`.
      const pilha: number[] = [];
      for (let rx = 0; rx <= w; rx++) {
        const atual = rx < w ? alturas[rx]! : 0;
        while (pilha.length && alturas[pilha[pilha.length - 1]!]! > atual) {
          const alt = alturas[pilha.pop()!]!;
          const esq = pilha.length ? pilha[pilha.length - 1]! + 1 : 0;
          const larg = rx - esq;
          const area = alt * larg;
          const x0 = minX + esq, y0 = minY + ry - alt + 1, x1 = minX + rx, y1 = minY + ry + 1;
          if (area > melhorArea || (area === melhorArea && (y0 < melhor[1] || (y0 === melhor[1] && x0 < melhor[0])))) {
            melhorArea = area;
            melhor = [x0, y0, x1, y1];
          }
        }
        pilha.push(rx);
      }
    }

    if (melhorArea <= 0) break;
    rets.push(melhor);
    for (let y = melhor[1]; y < melhor[3]; y++) {
      for (let x = melhor[0]; x < melhor[2]; x++) {
        const idx = (y - minY) * w + (x - minX);
        if (grade[idx]) {
          grade[idx] = 0;
          restantes--;
        }
      }
    }
  }

  return rets;
}

/** Calcula as faces (águas) e segmentos de cumeeira de um retângulo de células. */
export function aguasDe(
  ret: Ret,
  roof?: Partial<Telhado>,
  beiral = 0.25,
): { faces: Face[]; cumeeiras: Segmento[] } {
  const { shape, ridge } = formaDe(roof);
  const x0 = ret[0] - beiral;
  const y0 = ret[1] - beiral;
  const x1 = ret[2] + beiral;
  const y1 = ret[3] + beiral;
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  if (shape === 'plano') {
    const p = Math.min(0.14, w / 4, h / 4);
    const laje: Face = {
      pontos: [[x0 + p, y0 + p], [x1 - p, y0 + p], [x1 - p, y1 - p], [x0 + p, y1 - p]],
      normal: [0, 0],
      queda: [0, 1],
    };
    const platibanda: Face = {
      pontos: [
        [x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0],
        [x0 + p, y0 + p], [x0 + p, y1 - p], [x1 - p, y1 - p], [x1 - p, y0 + p], [x0 + p, y0 + p],
      ],
      normal: [0, 0],
      queda: [0, 1],
      platibanda: true,
    };
    return { faces: [laje, platibanda], cumeeiras: [] };
  }

  if (shape === 'piramide') {
    return {
      faces: [
        { pontos: [[x0, y0], [x1, y0], [cx, cy]], normal: [0, -1], queda: [0, -1] },
        { pontos: [[cx, cy], [x1, y1], [x0, y1]], normal: [0, 1], queda: [0, 1] },
        { pontos: [[x0, y0], [cx, cy], [x0, y1]], normal: [-1, 0], queda: [-1, 0] },
        { pontos: [[x1, y0], [x1, y1], [cx, cy]], normal: [1, 0], queda: [1, 0] },
      ],
      cumeeiras: [],
    };
  }

  if (shape === 'duas-aguas') {
    const horizontal = ridge === 'h' || (ridge === 'auto' && w >= h);
    if (horizontal) {
      return {
        faces: [
          { pontos: [[x0, y0], [x1, y0], [x1, cy], [x0, cy]], normal: [0, -1], queda: [0, -1] },
          { pontos: [[x0, cy], [x1, cy], [x1, y1], [x0, y1]], normal: [0, 1], queda: [0, 1] },
        ],
        cumeeiras: [[[x0, cy], [x1, cy]]],
      };
    }
    return {
      faces: [
        { pontos: [[x0, y0], [cx, y0], [cx, y1], [x0, y1]], normal: [-1, 0], queda: [-1, 0] },
        { pontos: [[cx, y0], [x1, y0], [x1, y1], [cx, y1]], normal: [1, 0], queda: [1, 0] },
      ],
      cumeeiras: [[[cx, y0], [cx, y1]]],
    };
  }

  // quatro-aguas
  const horizontal = ridge === 'h' || (ridge === 'auto' && w >= h);
  if (horizontal && w >= h) {
    const lx = x0 + h / 2;
    const rx = x1 - h / 2;
    const temCumeeira = rx - lx > 1e-6;
    const faces: Face[] = [
      { pontos: temCumeeira ? [[x0, y0], [x1, y0], [rx, cy], [lx, cy]] : [[x0, y0], [x1, y0], [cx, cy]], normal: [0, -1], queda: [0, -1] },
      { pontos: temCumeeira ? [[lx, cy], [rx, cy], [x1, y1], [x0, y1]] : [[cx, cy], [x1, y1], [x0, y1]], normal: [0, 1], queda: [0, 1] },
      { pontos: [[x0, y0], [lx, cy], [x0, y1]], normal: [-1, 0], queda: [-1, 0] },
      { pontos: [[x1, y0], [x1, y1], [rx, cy]], normal: [1, 0], queda: [1, 0] },
    ];
    return { faces, cumeeiras: temCumeeira ? [[[lx, cy], [rx, cy]]] : [] };
  }

  // Cumeeira vertical (ou caso em que `ridge: 'v'` foi pedido num retângulo mais largo ou mais alto).
  const recuo = Math.min(w, h) / 2;
  const ty = y0 + recuo;
  const by = y1 - recuo;
  const temCumeeira = by - ty > 1e-6;
  const faces: Face[] = [
    { pontos: temCumeeira ? [[x0, y0], [cx, ty], [cx, by], [x0, y1]] : [[x0, y0], [cx, cy], [x0, y1]], normal: [-1, 0], queda: [-1, 0] },
    { pontos: temCumeeira ? [[cx, ty], [x1, y0], [x1, y1], [cx, by]] : [[cx, cy], [x1, y0], [x1, y1]], normal: [1, 0], queda: [1, 0] },
    { pontos: [[x0, y0], [x1, y0], [cx, ty]], normal: [0, -1], queda: [0, -1] },
    { pontos: [[cx, by], [x1, y1], [x0, y1]], normal: [0, 1], queda: [0, 1] },
  ];
  return { faces, cumeeiras: temCumeeira ? [[[cx, ty], [cx, by]]] : [] };
}

/** Junta as faces e cumeeiras de todos os retângulos que compõem um trecho. */
export function aguasDoTrecho(trecho: Trecho, beiral = 0.25): { faces: Face[]; cumeeiras: Segmento[] } {
  const faces: Face[] = [];
  const cumeeiras: Segmento[] = [];
  for (const ret of retangulosDe(trecho.celulas)) {
    const a = aguasDe(ret, trecho.roof, beiral);
    faces.push(...a.faces);
    cumeeiras.push(...a.cumeeiras);
  }
  return { faces, cumeeiras };
}
