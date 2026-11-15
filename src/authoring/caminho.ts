/**
 * Caminhos orgânicos: suaviza polilinhas com Catmull-Rom centrípeta, varia a largura com ruído suave,
 * forma união de discos com borda irregular, pinta margem opcional e acrescenta sulcos em faixas largas.
 */
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { MATERIAIS, materiaisDo, type Material } from '../procedural/materiais.ts';
import { fbm, valueNoise2D } from '../procedural/ruido.ts';
import type { Comando } from '../state/comandos.ts';
import { ErroDeConstrucao, type Construcao } from './construcao.ts';

export interface PedidoDeCaminho {
  pontos: Ponto[];
  largura: number | [number, number];
  material: string;
  borda?: { material: string; largura: number };
  sulcos?: boolean;
  irregular?: number;
}

interface Amostra {
  ponto: Ponto;
  raio: number;
  tangente: Ponto;
}

const USOS_TERRENO: readonly Material['uso'][] = ['terreno', 'macico', 'agua'];

function validarMaterialDeTerreno(id: string, papel: string): void {
  if (id.startsWith('#') || id.startsWith('grama#') || id.startsWith('grama:')) return;
  const m = MATERIAIS[id];
  if (m && USOS_TERRENO.includes(m.uso)) return;
  const validos = USOS_TERRENO.flatMap(u => materiaisDo(u)).map(x => x.id);
  throw new ErroDeConstrucao(`material “${id}” de ${papel} inválido; materiais válidos: ${validos.join(', ')}`);
}

function catmullRomCentripeta(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: number, t0: number, t1: number, t2: number, t3: number): Ponto {
  const interp = (a: Ponto, b: Ponto, ta: number, tb: number, tc: number): Ponto => {
    const den = tb - ta;
    if (Math.abs(den) < 1e-9) return a;
    const w1 = (tb - tc) / den, w2 = (tc - ta) / den;
    return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2];
  };
  const a1 = interp(p0, p1, t0, t1, t);
  const a2 = interp(p1, p2, t1, t2, t);
  const a3 = interp(p2, p3, t2, t3, t);
  const b1 = interp(a1, a2, t0, t2, t);
  const b2 = interp(a2, a3, t1, t3, t);
  return interp(b1, b2, t1, t2, t);
}

/** Suaviza a polilinha em pontos espaçados ~0,5 m via Catmull-Rom centrípeta (alpha = 0,5). */
function amostrarCurva(pontos: readonly Ponto[]): Ponto[] {
  const n = pontos.length;
  if (n < 2) return [...pontos];
  const ext: Ponto[] = [
    [2 * pontos[0]![0] - pontos[1]![0], 2 * pontos[0]![1] - pontos[1]![1]],
    ...pontos,
    [2 * pontos[n - 1]![0] - pontos[n - 2]![0], 2 * pontos[n - 1]![1] - pontos[n - 2]![1]],
  ];
  const saida: Ponto[] = [];
  const knot = (a: Ponto, b: Ponto) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));

  for (let i = 1; i + 2 < ext.length; i++) {
    const p0 = ext[i - 1]!, p1 = ext[i]!, p2 = ext[i + 1]!, p3 = ext[i + 2]!;
    const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (dist < 1e-6) continue;
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const passos = Math.max(2, Math.ceil(dist / 0.5));
    for (let s = 0; s < passos; s++) {
      const tc = t1 + (s / passos) * (t2 - t1);
      saida.push(catmullRomCentripeta(p0, p1, p2, p3, tc, t0, t1, t2, t3));
    }
  }
  saida.push([...pontos[n - 1]!] as Ponto);
  return saida;
}

/** Gera comandos `terreno.pintar` (borda e miolo) e `presenca.pintar` (`sulcos`) para um caminho orgânico. */
export function caminho(m: MapaAtlas, p: PedidoDeCaminho, semente = 1): Construcao {
  if (!Array.isArray(p.pontos) || p.pontos.length < 2) {
    throw new ErroDeConstrucao('um caminho precisa de ao menos 2 pontos');
  }
  for (const pt of p.pontos) {
    if (!Array.isArray(pt) || pt.length !== 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
      throw new ErroDeConstrucao('todos os pontos do caminho devem ser [x, y] finitos em metros');
    }
  }
  validarMaterialDeTerreno(p.material, 'caminho');
  if (p.borda) {
    validarMaterialDeTerreno(p.borda.material, 'borda');
    if (!Number.isFinite(p.borda.largura) || p.borda.largura <= 0) {
      throw new ErroDeConstrucao(`largura da borda inválida (${p.borda.largura})`);
    }
  }

  let lMin: number, lMax: number;
  if (typeof p.largura === 'number') {
    if (!Number.isFinite(p.largura) || p.largura <= 0) throw new ErroDeConstrucao(`largura inválida (${p.largura})`);
    lMin = lMax = p.largura;
  } else {
    [lMin, lMax] = p.largura;
    if (!Number.isFinite(lMin) || !Number.isFinite(lMax) || lMin <= 0 || lMax < lMin) {
      throw new ErroDeConstrucao(`faixa de largura [${lMin}, ${lMax}] inválida`);
    }
  }

  const sementeInt = Math.floor(semente) || 1;
  const irr = Math.max(0, p.irregular ?? 0.35);
  const res = m.terrain.resolution || 0.5;
  const cols = Math.ceil(m.bounds.width / res);
  const lins = Math.ceil(m.bounds.height / res);

  const pts = amostrarCurva(p.pontos);
  const ruidoLarg = valueNoise2D(sementeInt * 31 + 17);
  const ruidoBorda = valueNoise2D(sementeInt * 31 + 7919);

  // Calcula comprimento acumulado, largura local com ruído e tangente
  const amostras: Amostra[] = [];
  let accDist = 0;
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i]!;
    if (i > 0) accDist += Math.hypot(cur[0] - pts[i - 1]![0], cur[1] - pts[i - 1]![1]);
    const ant = pts[Math.max(0, i - 1)]!, prox = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = prox[0] - ant[0], dy = prox[1] - ant[1];
    const len = Math.hypot(dx, dy) || 1;
    const tNoise = lMin === lMax ? 0.5 : ruidoLarg(accDist * 0.22, 0.5);
    const largLocal = lMin + (lMax - lMin) * tNoise;
    amostras.push({
      ponto: cur,
      raio: largLocal / 2,
      tangente: [dx / len, dy / len],
    });
  }

  const tremorCache = new Map<number, number>();
  const tremor = (i: number, j: number): number => {
    if (irr <= 0) return 0;
    const chave = j * 65_536 + i;
    const salvo = tremorCache.get(chave);
    if (salvo !== undefined) return salvo;
    const wx = (i + 0.5) * res, wy = (j + 0.5) * res;
    const val = irr * (fbm(ruidoBorda, wx / 1.5, wy / 1.5, 3) * 2 - 1) * 1.6;
    tremorCache.set(chave, val);
    return val;
  };

  const mioloMap = new Map<number, [number, number]>();
  const bordaMap = new Map<number, [number, number]>();
  const bordaLarg = p.borda?.largura ?? 0;

  for (const a of amostras) {
    const rAlcance = a.raio + bordaLarg + irr * 1.6;
    const i0 = Math.max(0, Math.floor((a.ponto[0] - rAlcance) / res));
    const i1 = Math.min(cols - 1, Math.floor((a.ponto[0] + rAlcance) / res));
    const j0 = Math.max(0, Math.floor((a.ponto[1] - rAlcance) / res));
    const j1 = Math.min(lins - 1, Math.floor((a.ponto[1] + rAlcance) / res));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = (i + 0.5) * res, cy = (j + 0.5) * res;
        const dEfetiva = Math.hypot(cx - a.ponto[0], cy - a.ponto[1]) + tremor(i, j);
        const chave = j * 65_536 + i;
        if (dEfetiva <= a.raio) mioloMap.set(chave, [i, j]);
        if (p.borda && dEfetiva <= a.raio + bordaLarg) bordaMap.set(chave, [i, j]);
      }
    }
  }

  const comandos: Comando[] = [];
  if (p.borda && bordaMap.size > 0) {
    comandos.push({ tipo: 'terreno.pintar', material: p.borda.material, celulas: [...bordaMap.values()] });
  }
  if (mioloMap.size > 0) {
    comandos.push({ tipo: 'terreno.pintar', material: p.material, celulas: [...mioloMap.values()] });
  }

  if (p.sulcos) {
    const sulcosMap = new Map<number, [number, number]>();
    const rSulco = Math.max(res * 0.55, 0.25);
    for (const a of amostras) {
      if (a.raio * 2 <= 2) continue;
      const nx = -a.tangente[1], ny = a.tangente[0];
      for (const lado of [-0.6, 0.6] as const) {
        const sx = a.ponto[0] + nx * lado, sy = a.ponto[1] + ny * lado;
        const i0 = Math.max(0, Math.floor((sx - rSulco) / res));
        const i1 = Math.min(cols - 1, Math.floor((sx + rSulco) / res));
        const j0 = Math.max(0, Math.floor((sy - rSulco) / res));
        const j1 = Math.min(lins - 1, Math.floor((sy + rSulco) / res));
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const cx = (i + 0.5) * res, cy = (j + 0.5) * res;
            if (Math.hypot(cx - sx, cy - sy) <= rSulco) {
              sulcosMap.set(j * 65_536 + i, [i, j]);
            }
          }
        }
      }
    }
    if (sulcosMap.size > 0) {
      comandos.push({ tipo: 'presenca.pintar', brush: 'sulcos', celulas: [...sulcosMap.values()], intensidade: 0.4 });
    }
  }

  return { comandos, ids: [] };
}
