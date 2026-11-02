import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { COLECOES_LIVRES, type AlvoMovel, type ColecaoLivre } from '../state/comandos.ts';

export type Alvo = AlvoMovel;
export interface Caixa { x0: number; y0: number; x1: number; y1: number }

/** Ordem de empilhamento, do fundo para o topo: o que está por cima é pego primeiro. */
const ORDEM: ColecaoLivre[] = ['regions', 'presence', 'props', 'lights', 'tokens'];

export const mesmoAlvo = (a: Alvo, b: Alvo): boolean => a.colecao === b.colecao && a.id === b.id;
export const chaveDoAlvo = (a: Alvo): string => `${a.colecao}:${a.id}`;

const caixaDePontos = (pts: readonly Ponto[]): Caixa => ({ x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1])) });

/** Caixa que o editor usa para pegar, desenhar o contorno e enquadrar o item. `null` para o que não tem posição (presença). */
export function caixaDe(mapa: MapaAtlas, alvo: Alvo): Caixa | null {
  if (alvo.colecao === 'regions') { const r = mapa.regions[alvo.id]; return r ? caixaDePontos(r.polygon) : null; }
  if (alvo.colecao === 'props') { const o = mapa.props[alvo.id]; return o ? centrada(o.position, 0.8 * o.scale) : null; }
  if (alvo.colecao === 'lights') { const l = mapa.lights[alvo.id]; return l ? centrada(l.position, 0.7) : null; }
  if (alvo.colecao === 'tokens') { const t = mapa.tokens[alvo.id]; return t ? centrada(t.position, t.size * mapa.grid.size * 0.9) : null; }
  return null;
}
const centrada = (p: Ponto, lado: number): Caixa => ({ x0: p[0] - lado / 2, y0: p[1] - lado / 2, x1: p[0] + lado / 2, y1: p[1] + lado / 2 });

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

/** O alvo do topo sob `ponto`, com tolerância em metros (para o toque acertar em zoom afastado). */
export function alvoEm(mapa: MapaAtlas, ponto: Ponto, tolerancia = 0): Alvo | null {
  for (let i = ORDEM.length - 1; i >= 0; i--) {
    const colecao = ORDEM[i]!;
    const ids = Object.keys(mapa[colecao]).reverse();
    for (const id of ids) {
      const caixa = caixaDe(mapa, { colecao, id });
      if (!caixa) continue;
      // Regiões só são pegas pelo interior; o resto, pela caixa (com tolerância).
      if (colecao === 'regions') { if (pontoNoPoligono(ponto, mapa.regions[id]!.polygon)) return { colecao, id }; continue; }
      if (ponto[0] >= caixa.x0 - tolerancia && ponto[0] <= caixa.x1 + tolerancia && ponto[1] >= caixa.y0 - tolerancia && ponto[1] <= caixa.y1 + tolerancia) return { colecao, id };
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
