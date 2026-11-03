import { ErroDeValidacao } from './esquema.ts';
import { arestasDeParede, centroDaAbertura, comodoEm, indiceDeCelulas, pontoNaParede, salasDaAbertura } from './geometria.ts';
import type { Clima, Luz, MapaAtlas } from './mapa.ts';

/** O céu de um horário: de onde vem a luz (sol ou lua), o ambiente sugerido e se é noite. Tudo derivado, nunca gravado. */
export interface Ceu { sun: NonNullable<Clima['sun']>; ambient: Clima['ambient']; noite: boolean }

/** Lê `HH:MM` e devolve as horas em decimal (14:30 → 14,5). */
export function lerHorario(time: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new ErroDeValidacao('O horário deve ser HH:MM, de 00:00 a 23:59.', 'climate.time');
  return Number(m[1]) + Number(m[2]) / 60;
}

type Cor = [number, number, number];
const NASCER = 6, POR = 18;

// Âncoras do ambiente: hora → cor efetiva (já multiplicada pela intensidade). As do meio-dia e da noite são as do protótipo.
const ANCORAS: readonly [number, Cor][] = [
  [0, [0.05, 0.06, 0.12]], [5, [0.07, 0.08, 0.15]], [6, [0.3, 0.28, 0.32]], [7, [0.62, 0.6, 0.58]], [9, [0.78, 0.78, 0.76]], [12, [0.86, 0.85, 0.8]],
  [15, [0.82, 0.8, 0.75]], [17, [0.78, 0.68, 0.58]], [18, [0.5, 0.38, 0.38]], [19, [0.16, 0.14, 0.22]], [21, [0.06, 0.07, 0.13]], [24, [0.05, 0.06, 0.12]],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex = (c: Cor) => `#${c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const lerpCor = (a: Cor, b: Cor, t: number): Cor => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** O ambiente que dá a cor efetiva `rgb` (0 a 1): `color × intensity` é essa cor, então a cor guarda o matiz no brilho máximo e a intensidade, o quanto. */
export function ambienteDaCor(rgb: readonly [number, number, number]): Clima['ambient'] {
  const forca = Math.min(1, Math.max(...rgb, 1e-6));
  return { color: hex(rgb.map(v => v / forca) as Cor), intensity: Math.round(forca * 1000) / 1000 };
}

function ambienteEm(h: number): Clima['ambient'] {
  let i = 0; while (i < ANCORAS.length - 2 && h >= ANCORAS[i + 1]![0]) i++;
  const [h0, c0] = ANCORAS[i]!, [h1, c1] = ANCORAS[i + 1]!;
  return ambienteDaCor(lerpCor(c0, c1, (h - h0) / (h1 - h0)));
}

/** Sol entre 06:00 e 18:00 (nasce a leste, põe a oeste); fora disso, a lua. */
export function ceuNoHorario(time: string): Ceu {
  const h = lerHorario(time), noite = h < NASCER || h >= POR, ambient = ambienteEm(h);
  if (!noite) {
    const t = (h - NASCER) / (POR - NASCER), alto = Math.sin(Math.PI * t);     // 0 no horizonte, 1 ao meio-dia
    return { noite, ambient, sun: { angle: Math.round(Math.PI * t * 1000) / 1000, color: hex(lerpCor([1, 0.69, 0.44], [1, 0.95, 0.84], Math.sqrt(alto))), intensity: Math.round((0.3 + 0.7 * alto) * 1000) / 1000 } };
  }
  const desdePorDoSol = h >= POR ? h - POR : h + 24 - POR, t = desdePorDoSol / (24 - POR + NASCER);
  return { noite, ambient, sun: { angle: Math.round(Math.PI * t * 1000) / 1000, color: '#9fb3e8', intensity: 0.35 } };
}

export const ehNoite = (m: Pick<MapaAtlas, 'climate'>): boolean => ceuNoHorario(m.climate.time).noite;

/** Largura do facho que a janela derrama e o quanto ele alcança, em metros. */
export const JANELA_ABERTURA = 2.1, JANELA_ALCANCE = 9.5;

/**
 * As luzes que o clima faz nascer, sem gravar nada no documento: hoje, o sol ou a lua entrando por cada janela
 * entre um cômodo e o lado de fora. Janela entre dois cômodos, ou fora de qualquer cômodo, não derrama nada.
 */
export function luzesDerivadas(m: MapaAtlas): Luz[] {
  const sun = m.climate.sun; if (!sun) return [];
  const saida: Luz[] = [], arestas = arestasDeParede(m), indice = indiceDeCelulas(m);
  for (const a of Object.values(m.openings)) {
    if (a.kind !== 'window') continue;
    const parede = m.walls[a.wallId]; if (!parede) continue;
    const salas = salasDaAbertura(m, a, arestas); if (salas.length !== 1) continue;
    const { ponto, tangente } = pontoNaParede(parede, centroDaAbertura(parede, a));
    // A normal que aponta para dentro é a que, um passo adiante, cai no cômodo.
    const candidatas: [number, number][] = [[-tangente[1], tangente[0]], [tangente[1], -tangente[0]]];
    const para = candidatas.find(n => comodoEm(m, [ponto[0] + n[0] * 0.4, ponto[1] + n[1] * 0.4], indice) === salas[0]); if (!para) continue;
    saida.push({
      id: `janela:${a.id}`, position: [ponto[0] + para[0] * 0.3, ponto[1] + para[1] * 0.3], radius: JANELA_ALCANCE, color: sun.color, intensity: sun.intensity, flicker: 0,
      cone: { angle: JANELA_ABERTURA, direction: Math.atan2(para[1], para[0]) }, ownerId: a.id, power: 'magic', on: true, nightOnly: false, preset: null,
    });
  }
  return saida;
}
