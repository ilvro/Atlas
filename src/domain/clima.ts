import { ErroDeValidacao } from './esquema.ts';
import { arestasDeParede, centroDaAbertura, comodoEm, indiceDeCelulas, normalParaDentro, pontoNaParede, salasDaAbertura } from './geometria.ts';
import type { Acabamento, Clima, Luz, MapaAtlas } from './mapa.ts';

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
const canaisDe = (c: string): Cor => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255) as Cor;
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

/**
 * O quanto a luz está ligada neste momento do mapa, 0 ou 1: apagada, sem energia (rede elétrica caída) ou só-noturna de dia valem 0.
 * `opcoes` deixa o render perguntar "e se a rede estivesse ligada?" durante o piscar da queda de energia.
 */
export function nivelDaLuz(l: Pick<Luz, 'on' | 'power' | 'nightOnly'>, m: Pick<MapaAtlas, 'climate'>, opcoes: { redeLigada?: boolean; noite?: boolean } = {}): 0 | 1 {
  if (!l.on) return 0;
  if (l.power === 'grid' && !(opcoes.redeLigada ?? m.climate.gridPower)) return 0;
  if (l.nightOnly && !(opcoes.noite ?? ehNoite(m))) return 0;
  return 1;
}

// ---------- Relâmpago ----------
/** Segundos até o próximo relâmpago: de 4 a 11 s, mais curto quanto mais forte a tempestade; `Infinity` sem relâmpagos. `sorteio` é um número de 0 a 1. */
export const intervaloDoRelampago = (lightning: number, sorteio: number): number => (lightning > 0 ? 4 + (sorteio * 7) / lightning : Infinity);
/** A força do clarão (0 a 1) quando o relâmpago está em `f` (1 no estouro, decaindo a 0): pisca duas ou três vezes. `reduzido`: metade da força e sem tremer. */
export const curvaDoClarao = (f: number, reduzido = false): number => (f <= 0 ? 0 : reduzido ? 0.5 * Math.min(1, f) : Math.max(0, Math.sin(f * Math.PI * 3)) * Math.min(1, f));
/** Como a queda de energia pisca: de 1,1 s até 0, a luz tremula e, no último quarto de segundo, apaga. Devolve o fator de 0 a 1 das luzes de rede. */
export const piscarDaQueda = (restante: number): number => (restante <= 0.25 ? 0 : Math.sin(restante * 38) > 0.2 ? 1 : 0.15);
/** O piscar curto de quando a energia volta (`restante` de 0,5 s até 0). */
export const piscarDaVolta = (restante: number): number => (restante <= 0 ? 1 : Math.sin(restante * 30) > 0 ? 1 : 0.2);
export const DURACAO_DA_QUEDA = 1.1, DURACAO_DA_VOLTA = 0.5;

/** Largura do facho que a janela derrama e o quanto ele alcança, em metros. */
export const JANELA_ABERTURA = 2.1, JANELA_ALCANCE = 9.5, JANELA_FORA_ALCANCE = 4;

/**
 * As luzes que o clima faz nascer, sem gravar nada no documento: o sol ou a lua entrando por cada janela
 * entre um cômodo e o lado de fora e, à noite, o brilho das luzes acesas saindo pela janela. Janela entre dois cômodos, ou fora de qualquer cômodo, não derrama nada.
 */
export function luzesDerivadas(m: MapaAtlas): Luz[] {
  const sun = m.climate.sun;
  const saida: Luz[] = [], arestas = arestasDeParede(m), indice = indiceDeCelulas(m), noite = ehNoite(m);
  // Cômodos com ao menos uma luz acesa dentro: as cores delas (para a janela acesa à noite).
  const acesas = new Map<string, Cor[]>();
  if (noite) for (const l of Object.values(m.lights)) {
    if (nivelDaLuz(l, m, { noite }) === 0) continue;
    const sala = comodoEm(m, l.position, indice); if (sala) acesas.set(sala, [...(acesas.get(sala) ?? []), canaisDe(l.color)]);
  }
  for (const a of Object.values(m.openings)) {
    if (a.kind !== 'window') continue;
    const parede = m.walls[a.wallId]; if (!parede) continue;
    const salas = salasDaAbertura(m, a, arestas); if (salas.length !== 1) continue;
    const { ponto } = pontoNaParede(parede, centroDaAbertura(parede, a));
    const para = normalParaDentro(m, parede, centroDaAbertura(parede, a), salas[0]!, indice); if (!para) continue;
    const direcao = Math.atan2(para[1], para[0]);
    if (sun) saida.push({
      id: `janela:${a.id}`, position: [ponto[0] + para[0] * 0.3, ponto[1] + para[1] * 0.3], radius: JANELA_ALCANCE, color: sun.color, intensity: sun.intensity, flicker: 0,
      cone: { angle: JANELA_ABERTURA, direction: direcao }, ownerId: a.id, power: 'magic', on: true, nightOnly: false, preset: null,
    });
    // À noite, a janela de um cômodo com luz acesa brilha para fora, na cor média das luzes de dentro.
    const cores = acesas.get(salas[0]!);
    if (cores?.length) {
      const media = hex(cores.reduce<Cor>((acc, c) => [acc[0] + c[0] / cores.length, acc[1] + c[1] / cores.length, acc[2] + c[2] / cores.length], [0, 0, 0]));
      saida.push({
        id: `janela-fora:${a.id}`, position: [ponto[0] - para[0] * 0.3, ponto[1] - para[1] * 0.3], radius: JANELA_FORA_ALCANCE, color: media, intensity: 0.6, flicker: 0,
        cone: { angle: JANELA_ABERTURA, direction: Math.atan2(-para[1], -para[0]) }, ownerId: a.id, power: 'magic', on: true, nightOnly: false, preset: null,
      });
    }
  }
  return saida;
}

// ---------- Mistura de climas ----------
/** O clima e o acabamento de um momento: o que a transição interpola. */
export interface EstadoDeClima { climate: Clima; finish: Acabamento }
/** O resultado de `misturar`: igual ao estado, mas a energia da rede é um número de 0 a 1 (`rede`), para a luz poder esmaecer. */
export interface MisturaDeClima { climate: Omit<Clima, 'gridPower'> & { rede: number }; finish: Acabamento }

const mistura = (a: Cor, b: Cor, t: number) => lerpCor(a, b, t);
const corMisturada = (a: string, b: string, t: number): string => hex(mistura(canaisDe(a), canaisDe(b), t));
const efetiva = (a: Clima['ambient']): Cor => canaisDe(a.color).map(v => v * a.intensity) as Cor;

/**
 * Interpola dois estados: de `a` (t = 0) a `b` (t = 1). Números por `lerp`, cores por canal (o ambiente pela cor efetiva, que já embute a intensidade),
 * sol que aparece ou some só muda de intensidade (com a cor do lado que tem sol), `rede` vai de 0 a 1; `preset` e `time` já são os do destino.
 */
export function misturar(a: EstadoDeClima, b: EstadoDeClima, t: number): MisturaDeClima {
  t = Math.min(1, Math.max(0, t));
  const ca = a.climate, cb = b.climate, fa = a.finish, fb = b.finish;
  const sun: Clima['sun'] = !ca.sun && !cb.sun ? null
    : !ca.sun ? { ...cb.sun!, intensity: lerp(0, cb.sun!.intensity, t) }
    : !cb.sun ? { ...ca.sun, intensity: lerp(ca.sun.intensity, 0, t) }
    : { angle: lerp(ca.sun.angle, cb.sun.angle, t), color: corMisturada(ca.sun.color, cb.sun.color, t), intensity: lerp(ca.sun.intensity, cb.sun.intensity, t) };
  const weather = Object.fromEntries((Object.keys(cb.weather) as (keyof Clima['weather'])[]).map(k => [k, lerp(ca.weather[k], cb.weather[k], t)])) as unknown as Clima['weather'];
  return {
    climate: { preset: cb.preset, ambient: ambienteDaCor(mistura(efetiva(ca.ambient), efetiva(cb.ambient), t)), sun, time: cb.time, weather, rede: lerp(ca.gridPower ? 1 : 0, cb.gridPower ? 1 : 0, t) },
    finish: {
      preset: fb.preset, texture: lerp(fa.texture, fb.texture, t), vignette: lerp(fa.vignette, fb.vignette, t), saturation: lerp(fa.saturation, fb.saturation, t), grain: lerp(fa.grain, fb.grain, t),
      tint: corMisturada(fa.tint, fb.tint, t), grade: { lift: lerp(fa.grade.lift, fb.grade.lift, t), gamma: lerp(fa.grade.gamma, fb.grade.gamma, t), gain: lerp(fa.grade.gain, fb.grade.gain, t) },
    },
  };
}
