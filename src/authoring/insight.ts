import { decodificar, type Celula } from '../domain/celulas.ts';
import { areaDoPoligono, pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import { arestasDeParede, caixaDasCelulas, centroDaAbertura, comodoEm, indiceDeCelulas, normalParaDentro, pontoNaParede, salasDaAbertura, type ArestaUnitaria } from '../domain/geometria.ts';
import type { Abertura, MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { ACERVO } from '../procedural/acervo.ts';

export interface Caixa { x0: number; y0: number; x1: number; y1: number }
export interface AberturaDoComodo { id: string; kind: Abertura['kind']; wallId: string; at: number; centro: Ponto; largura: number; /** Aponta para dentro do cômodo. */ normal: Ponto; /** Cômodo do outro lado, ou null (lado de fora). */ outro: string | null }
export interface VizinhoDoComodo { id: string; /** Metros de parede em comum. */ comprimento: number; /** Há porta, arco ou passagem secreta entre os dois? */ ligado: boolean }
export interface ObjetoDoComodo { id: string; receita: string | null; elevation: Objeto['elevation']; caixa: Caixa }
export interface InsightDoComodo {
  id: string; nome: string; funcao: string | null; celulas: Celula[];
  /** Metros quadrados e metros. */
  area: number; perimetro: number; caixa: Caixa;
  portas: AberturaDoComodo[];   // door, arch, secret
  janelas: AberturaDoComodo[];
  vizinhos: VizinhoDoComodo[]; /** Metros de parede para o lado de fora. */ externo: number;
  objetos: ObjetoDoComodo[];
  luzes: string[];
}

/** Largura × profundidade de um objeto no mapa, já com a escala. */
export function tamanhoDoObjeto(o: Objeto): [number, number] {
  const [w, h] = ACERVO.pegadaDaFonte(o.source);
  return [w * o.scale, h * o.scale];
}

/** A caixa que envolve a pegada do objeto, já girada. */
export function caixaDoObjeto(o: Objeto): Caixa {
  const [w, h] = tamanhoDoObjeto(o), c = Math.abs(Math.cos(o.rotation)), s = Math.abs(Math.sin(o.rotation)), ex = (c * w + s * h) / 2, ey = (s * w + c * h) / 2;
  return { x0: o.position[0] - ex, y0: o.position[1] - ey, x1: o.position[0] + ex, y1: o.position[1] + ey };
}

const LIGACOES: readonly Abertura['kind'][] = ['door', 'arch', 'secret'];

/** O que se sabe de um cômodo olhando o documento: tamanho, aberturas, vizinhos, objetos e luzes. `null` se o cômodo não existe. */
export function insightDoComodo(m: MapaAtlas, roomId: string, arestas: Map<string, ArestaUnitaria> = arestasDeParede(m)): InsightDoComodo | null {
  const sala = m.rooms[roomId]; if (!sala) return null;
  const nivel = sala.levelId ?? null;
  const celulas = decodificar(sala.cells), t = m.grid.size;
  const outline = sala.outline && sala.outline.length >= 3 ? sala.outline : null;
  let caixa: Caixa | null;
  let area: number;
  if (outline) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of outline) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    caixa = { x0, y0, x1, y1 };
    area = areaDoPoligono(outline);
  } else {
    caixa = caixaDasCelulas(m, celulas);
    if (!caixa) return null;
    area = celulas.length * t * t;
  }
  const indice = indiceDeCelulas(m, nivel);
  // Perímetro, lado de fora e vizinhos, pelas arestas unitárias do mesmo andar (ou pelo contorno livre).
  let perimetro = 0, externo = 0; const compartilhado = new Map<string, number>();
  if (outline) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
      perimetro += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    externo = perimetro;
  } else {
    for (const a of arestas.values()) {
      if ((a.levelId ?? null) !== nivel || !a.salas.includes(roomId)) continue;
      perimetro += t;
      const outro = a.salas.find(x => x !== roomId) ?? null;
      if (outro === null) externo += t; else compartilhado.set(outro, (compartilhado.get(outro) ?? 0) + t);
    }
  }
  const portas: AberturaDoComodo[] = [], janelas: AberturaDoComodo[] = [], ligados = new Set<string>();
  for (const a of Object.values(m.openings)) {
    const parede = m.walls[a.wallId]; if (!parede || (parede.levelId ?? null) !== nivel) continue;
    const salas = salasDaAbertura(m, a, arestas); if (!salas.includes(roomId)) continue;
    const outro = salas.find(x => x !== roomId) ?? null, dist = centroDaAbertura(parede, a), normal = normalParaDentro(m, parede, dist, roomId, indice); if (!normal) continue;
    const item: AberturaDoComodo = { id: a.id, kind: a.kind, wallId: a.wallId, at: a.at, centro: pontoNaParede(parede, dist).ponto, largura: a.width, normal, outro };
    if (a.kind === 'window') janelas.push(item); else { portas.push(item); if (outro && LIGACOES.includes(a.kind)) ligados.add(outro); }
  }
  const objetos = Object.values(m.props).filter(o => (o.levelId ?? null) === nivel && o.roomId === roomId).map(o => ({ id: o.id, receita: ACERVO.idDaFonte(o.source), elevation: o.elevation, caixa: caixaDoObjeto(o) }));
  const luzes = Object.values(m.lights).filter(l => {
    if ((l.levelId ?? null) !== nivel) return false;
    return outline ? pontoNoPoligono(l.position, outline) : comodoEm(m, l.position, indice) === roomId;
  }).map(l => l.id);
  return {
    id: roomId, nome: sala.name, funcao: sala.function, celulas, area, perimetro, caixa, portas, janelas,
    vizinhos: [...compartilhado].map(([id, comprimento]) => ({ id, comprimento, ligado: ligados.has(id) })), externo, objetos, luzes,
  };
}
