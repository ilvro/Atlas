import { decodificar } from '../domain/celulas.ts';
import { caixaDasCelulas, comprimentoDaParede, pontoNaParede, projetarNaParede } from '../domain/geometria.ts';
import type { MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { camadaDoObjeto } from '../domain/camadas.ts';
import { COLECOES_LIVRES, type AlvoMovel, type ColecaoLivre } from '../state/comandos.ts';

/** O que o mestre pode selecionar: itens soltos (que também se movem) e a construção (cômodos, paredes, aberturas). */
export type ColecaoSelecionavel = ColecaoLivre | 'rooms' | 'walls' | 'openings';
export interface Alvo { colecao: ColecaoSelecionavel; id: string }
export const ehMovel = (a: Alvo): a is AlvoMovel => (COLECOES_LIVRES as readonly string[]).includes(a.colecao);
export interface Caixa { x0: number; y0: number; x1: number; y1: number }

/** Ordem de empilhamento, do fundo para o topo: o que está por cima é pego primeiro. */
const ORDEM: ColecaoSelecionavel[] = ['rooms', 'regions', 'presence', 'walls', 'props', 'openings', 'lights', 'tokens'];

export const mesmoAlvo = (a: Alvo, b: Alvo): boolean => a.colecao === b.colecao && a.id === b.id;
export const chaveDoAlvo = (a: Alvo): string => `${a.colecao}:${a.id}`;

const caixaDePontos = (pts: readonly Ponto[]): Caixa => ({ x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1])) });
const centrada = (p: Ponto, lado: number): Caixa => ({ x0: p[0] - lado / 2, y0: p[1] - lado / 2, x1: p[0] + lado / 2, y1: p[1] + lado / 2 });

/** Largura × profundidade de um objeto no mapa, já com a escala. */
export function tamanhoDoObjeto(o: Objeto): [number, number] {
  const [w, h] = ACERVO.pegadaDaFonte(o.source);
  return [w * o.scale, h * o.scale];
}

/** Caixa que o editor usa para pegar, desenhar o contorno e enquadrar o item. `null` para o que não tem posição (presença). */
export function caixaDe(mapa: MapaAtlas, alvo: Alvo): Caixa | null {
  switch (alvo.colecao) {
    case 'rooms': { const r = mapa.rooms[alvo.id]; return r ? caixaDasCelulas(mapa, decodificar(r.cells)) : null; }
    case 'walls': { const p = mapa.walls[alvo.id]; if (!p) return null; const c = caixaDePontos(p.path), f = p.thickness / 2 + 0.05; return { x0: c.x0 - f, y0: c.y0 - f, x1: c.x1 + f, y1: c.y1 + f }; }
    case 'openings': { const a = mapa.openings[alvo.id], p = a && mapa.walls[a.wallId]; return a && p ? centrada(pontoNaParede(p, a.at * comprimentoDaParede(p)).ponto, a.width + 0.2) : null; }
    case 'regions': { const r = mapa.regions[alvo.id]; return r ? caixaDePontos(r.polygon) : null; }
    case 'props': {
      const o = mapa.props[alvo.id]; if (!o) return null;
      const [w, h] = tamanhoDoObjeto(o), c = Math.abs(Math.cos(o.rotation)), s = Math.abs(Math.sin(o.rotation)), ex = (c * w + s * h) / 2, ey = (s * w + c * h) / 2;
      return { x0: o.position[0] - ex, y0: o.position[1] - ey, x1: o.position[0] + ex, y1: o.position[1] + ey };
    }
    case 'lights': { const l = mapa.lights[alvo.id]; return l ? centrada(l.position, 0.7) : null; }
    case 'tokens': { const t = mapa.tokens[alvo.id]; return t ? centrada(t.position, t.size * mapa.grid.size * 0.9) : null; }
    default: return null;
  }
}

export function todosOsAlvos(mapa: MapaAtlas): Alvo[] {
  const saida: Alvo[] = [];
  for (const colecao of COLECOES_LIVRES) for (const id of Object.keys(mapa[colecao])) if (caixaDe(mapa, { colecao, id })) saida.push({ colecao, id });
  return saida;
}

export function pontoNoPoligono(p: Ponto, poligono: readonly Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]!, [xj, yj] = poligono[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** O ponto cai dentro do objeto (retângulo girado), com `tolerancia` metros de folga? */
function pontoNoObjeto(o: Objeto, p: Ponto, tolerancia: number): boolean {
  const [w, h] = tamanhoDoObjeto(o), dx = p[0] - o.position[0], dy = p[1] - o.position[1], c = Math.cos(-o.rotation), s = Math.sin(-o.rotation);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= w / 2 + tolerancia && Math.abs(ly) <= h / 2 + tolerancia;
}

/** O alvo do topo sob `ponto`, com tolerância em metros (para o toque acertar em zoom afastado). */
export function alvoEm(mapa: MapaAtlas, ponto: Ponto, tolerancia = 0): Alvo | null {
  for (let i = ORDEM.length - 1; i >= 0; i--) {
    const colecao = ORDEM[i]!;
    const ids = colecao === 'props'
      ? Object.entries(mapa.props).map(([id, o], idx) => ({ id, camada: camadaDoObjeto(o), idx })).sort((a, b) => b.camada - a.camada || b.idx - a.idx).map(x => x.id)
      : Object.keys(mapa[colecao]).reverse();
    for (const id of ids) {
      const alvo: Alvo = { colecao, id };
      if (colecao === 'rooms') { const r = mapa.rooms[id]!, t = mapa.grid.size; if (decodificar(r.cells).some(([x, y]) => ponto[0] >= mapa.grid.offset[0] + x * t && ponto[0] < mapa.grid.offset[0] + (x + 1) * t && ponto[1] >= mapa.grid.offset[1] + y * t && ponto[1] < mapa.grid.offset[1] + (y + 1) * t)) return alvo; continue; }
      if (colecao === 'regions') { if (pontoNoPoligono(ponto, mapa.regions[id]!.polygon)) return alvo; continue; }
      if (colecao === 'walls') { const p = mapa.walls[id]!; if (projetarNaParede(p, ponto).distancia <= p.thickness / 2 + tolerancia) return alvo; continue; }
      if (colecao === 'props') { const o = mapa.props[id]!; if (o.elevation !== 'wall' && pontoNoObjeto(o, ponto, tolerancia)) return alvo; if (o.interaction && o.elevation === 'wall' && Math.hypot(ponto[0] - o.position[0], ponto[1] - o.position[1]) <= 0.35 + tolerancia) return alvo; continue; }
      if (colecao === 'openings') {
        const a = mapa.openings[id]!, p = mapa.walls[a.wallId]; if (!p) continue;
        const r = projetarNaParede(p, ponto), centro = a.at * comprimentoDaParede(p);
        if (Math.abs(r.dist - centro) <= a.width / 2 + tolerancia && r.distancia <= p.thickness / 2 + 0.1 + tolerancia) return alvo; continue;
      }
      const caixa = caixaDe(mapa, alvo);
      if (caixa && ponto[0] >= caixa.x0 - tolerancia && ponto[0] <= caixa.x1 + tolerancia && ponto[1] >= caixa.y0 - tolerancia && ponto[1] <= caixa.y1 + tolerancia) return alvo;
    }
  }
  return null;
}

const centroDa = (c: Caixa): Ponto => [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2];

/** Alvos cujo centro cai dentro da caixa (seleção por retângulo). */
export function alvosNaCaixa(mapa: MapaAtlas, area: Caixa): Alvo[] {
  const x0 = Math.min(area.x0, area.x1), x1 = Math.max(area.x0, area.x1), y0 = Math.min(area.y0, area.y1), y1 = Math.max(area.y0, area.y1);
  return todosOsAlvos(mapa).filter(a => { const [cx, cy] = centroDa(caixaDe(mapa, a)!); return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1; });
}

/** Alvos cujo centro cai dentro do laço desenhado à mão. */
export function alvosNoLaco(mapa: MapaAtlas, laco: readonly Ponto[]): Alvo[] {
  if (laco.length < 3) return [];
  return todosOsAlvos(mapa).filter(a => pontoNoPoligono(centroDa(caixaDe(mapa, a)!), laco));
}

export function caixaDaSelecao(mapa: MapaAtlas, alvos: readonly Alvo[]): Caixa | null {
  const caixas = alvos.map(a => caixaDe(mapa, a)).filter((c): c is Caixa => c !== null);
  if (!caixas.length) return null;
  return { x0: Math.min(...caixas.map(c => c.x0)), y0: Math.min(...caixas.map(c => c.y0)), x1: Math.max(...caixas.map(c => c.x1)), y1: Math.max(...caixas.map(c => c.y1)) };
}

/** Tira da seleção o que não existe mais no mapa (depois de remover ou desfazer). */
export const podarSelecao = (mapa: MapaAtlas, alvos: readonly Alvo[]): Alvo[] => alvos.filter(a => (mapa[a.colecao] as Record<string, unknown>)[a.id] !== undefined);

/** Soma ou alterna `novos` na seleção. */
export function combinarSelecao(atual: readonly Alvo[], novos: readonly Alvo[], modo: 'trocar' | 'somar' | 'alternar'): Alvo[] {
  if (modo === 'trocar') return [...novos];
  if (modo === 'somar') return [...atual, ...novos.filter(n => !atual.some(a => mesmoAlvo(a, n)))];
  const saem = novos.filter(n => atual.some(a => mesmoAlvo(a, n))), entram = novos.filter(n => !atual.some(a => mesmoAlvo(a, n)));
  return [...atual.filter(a => !saem.some(s => mesmoAlvo(a, s))), ...entram];
}
