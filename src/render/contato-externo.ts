import { BlurFilter, Container, Graphics, type Renderer } from 'pixi.js';
import { criarCamadaEmTextura } from './camada-em-textura.ts';
import {
  comodoEm,
  comprimentoDaParede,
  indiceDeCelulas,
  pontoNaParede,
} from '../domain/geometria.ts';
import { ehEscarpaAvulsa } from './entradas.ts';
import { pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import type { MapaAtlas, Parede, Ponto } from '../domain/mapa.ts';

const LARGURA_CONTATO = 0.35;
const DESLOCAMENTO_FORA = 0.2;
const AMOSTRA_LADO = 0.4;
const ALFA_BASE = 0.28;
const ALFA_COM_SOL = 0.15;
/** Resolução (px/m) da textura do contato no Ilustrado. */
const RES_DO_CONTATO = 16;

/** Segmento de sombra de contato em coordenadas do mundo, já deslocado para o lado livre. */
export interface TracoDeContato {
  de: Ponto;
  para: Ponto;
}

function temComodoEm(
  m: Pick<MapaAtlas, 'rooms' | 'grid'>,
  indice: Map<number, string>,
  contornos: readonly Ponto[][],
  p: Ponto,
): boolean {
  if (comodoEm(m, p, indice) !== null) return true;
  for (const pol of contornos) if (pontoNoPoligono(p, pol)) return true;
  return false;
}

/**
 * Percorre os trechos retos da parede entre `d0` e `d1` (metros ao longo do caminho),
 * devolvendo pares consecutivos [início, fim] de cada subsegmento reto.
 */
function segmentosNoTrecho(p: Pick<Parede, 'path'>, d0: number, d1: number): Array<[Ponto, Ponto]> {
  if (d1 - d0 <= 1e-4) return [];
  const pts: Ponto[] = [pontoNaParede(p, d0).ponto];
  let acum = 0;
  for (let i = 0; i + 1 < p.path.length; i++) {
    const [ax, ay] = p.path[i]!, [bx, by] = p.path[i + 1]!;
    acum += Math.hypot(bx - ax, by - ay);
    if (acum > d0 + 1e-5 && acum < d1 - 1e-5) pts.push(p.path[i + 1]!);
  }
  pts.push(pontoNaParede(p, d1).ponto);
  const segs: Array<[Ponto, Ponto]> = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) segs.push([a, b]);
  }
  return segs;
}

/**
 * Calcula os traços de sombra de contato para paredes derivadas de cômodos cujo lado de fora está livre,
 * pulando vãos abertos (portas abertas, arcos e passagens secretas abertas).
 */
export function tracosDeContatoExterno(m: Pick<MapaAtlas, 'rooms' | 'walls' | 'openings' | 'grid'>): TracoDeContato[] {
  const indice = indiceDeCelulas(m);
  const contornos: Ponto[][] = [];
  for (const s of Object.values(m.rooms)) if (s.outline) contornos.push(s.outline);
  const tracos: TracoDeContato[] = [];

  for (const p of Object.values(m.walls)) {
    if (!p.source || !('roomId' in p.source) || ehEscarpaAvulsa(p)) continue;
    const comp = comprimentoDaParede(p);
    if (comp <= 1e-4) continue;

    const vaosAbertos = Object.values(m.openings)
      .filter(a => a.wallId === p.id && (a.kind === 'arch' || ((a.kind === 'door' || a.kind === 'secret') && a.state === 'open')))
      .map(a => [a.at * comp - a.width / 2, a.at * comp + a.width / 2] as const)
      .sort((a, b) => a[0] - b[0]);

    const intervalos: Array<[number, number]> = [];
    let pos = 0;
    for (const [a, b] of vaosAbertos) {
      if (a > pos) intervalos.push([pos, Math.min(comp, a)]);
      pos = Math.max(pos, b);
    }
    if (pos < comp) intervalos.push([pos, comp]);

    for (const [d0, d1] of intervalos) {
      for (const [a, b] of segmentosNoTrecho(p, d0, d1)) {
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        if (len <= 1e-4) continue;
        const tx = dx / len, ty = dy / len;
        const nA: Ponto = [-ty, tx], nB: Ponto = [ty, -tx];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const temA = temComodoEm(m, indice, contornos, [mx + nA[0] * AMOSTRA_LADO, my + nA[1] * AMOSTRA_LADO]);
        const temB = temComodoEm(m, indice, contornos, [mx + nB[0] * AMOSTRA_LADO, my + nB[1] * AMOSTRA_LADO]);
        if (temA === temB) continue;
        const fora = temA ? nB : nA;
        tracos.push({
          de: [a[0] + fora[0] * DESLOCAMENTO_FORA, a[1] + fora[1] * DESLOCAMENTO_FORA],
          para: [b[0] + fora[0] * DESLOCAMENTO_FORA, b[1] + fora[1] * DESLOCAMENTO_FORA],
        });
      }
    }
  }
  return tracos;
}

/** Cria o módulo de renderização da sombra de contato externa das paredes derivadas de cômodos. */
export function criarContatoExterno(renderer: Renderer) {
  // O traço desfocado vai para uma textura própria em metros (ver `camada-em-textura.ts`); a cena recebe só o sprite.
  const raiz = new Container();
  const g = new Graphics();
  const camada = criarCamadaEmTextura(renderer);
  const desfoque = new BlurFilter({ strength: 4, quality: 2 });
  raiz.addChild(camada.sprite);
  let atmosferaLigada = true;
  let ultimoMapa: MapaAtlas | null = null;

  function desenhar(m: MapaAtlas): void {
    ultimoMapa = m;
    g.clear();
    const tracos = tracosDeContatoExterno(m);
    if (!tracos.length) { g.filters = []; camada.sprite.visible = false; return; }
    camada.sprite.visible = true;
    for (const t of tracos) g.moveTo(t.de[0], t.de[1]).lineTo(t.para[0], t.para[1]);
    const pixelRes = m.style.renderer === 'pixel' ? m.style.pixel.pixelsPerCell / m.grid.size : 0;
    const largura = pixelRes > 0 ? Math.max(0.05, 2 / pixelRes) : LARGURA_CONTATO;
    g.stroke({ width: largura, color: 0x000000, alpha: 1, cap: 'butt' });
    g.filters = pixelRes > 0 ? [] : [desfoque];
    camada.sprite.alpha = atmosferaLigada && m.climate.sun !== null ? ALFA_COM_SOL : ALFA_BASE;
    camada.renderizar(g, m.bounds.width, m.bounds.height, pixelRes > 0 ? pixelRes : RES_DO_CONTATO, { pixel: pixelRes > 0 });
  }

  return {
    raiz,
    atualizar(m: MapaAtlas): void { desenhar(m); },
    definirLigado(ligado: boolean): void {
      atmosferaLigada = ligado;
      if (ultimoMapa) camada.sprite.alpha = atmosferaLigada && ultimoMapa.climate.sun !== null ? ALFA_COM_SOL : ALFA_BASE;
    },
    destruir(): void {
      desfoque.destroy();
      camada.destruir();
      g.destroy();
    },
  };
}
