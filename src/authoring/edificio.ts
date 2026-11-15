/**
 * Planta baixa de um edifício a partir de um programa de cômodos: funções puras em células do grid.
 * Transforma cômodos pedidos (tipo, área, frente, forma, alpendre) numa árvore conectada de retângulos
 * que respeita limites do lote, cômodos e paredes existentes do mapa.
 */
import { decodificar } from '../domain/celulas.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE, tipoDeComodo } from '../domain/presets.ts';
import { mulberry32 } from '../procedural/ruido.ts';
import { ErroDeConstrucao, type PedidoDePorta, type Ret } from './construcao.ts';

export type Frente = 'n' | 's' | 'l' | 'o';
export type FormaDoEdificio = 'auto' | 'compacta' | 'L' | 'T' | 'U' | 'linear' | 'patio';

export interface ComodoDoPrograma {
  tipo: string;
  area: number;
  nome?: string;
  principal?: boolean;
}

export interface ProgramaDeEdificio {
  nome: string;
  /** Célula do canto superior esquerdo do lote. */
  origem: [number, number];
  /** Largura × altura máximas em células (padrão: 3 × √(área total em células)). */
  lote?: [number, number];
  frente: Frente;
  forma?: FormaDoEdificio;
  alpendre?: boolean;
  /** De 1 a 12 cômodos. */
  comodos: ComodoDoPrograma[];
}

export interface ComodoDaPlanta {
  tipo: string;
  nome: string;
  rets: Ret[];
  principal: boolean;
  ligadoA: number | null;
}

export interface PlantaDoEdificio {
  comodos: ComodoDaPlanta[];
  forma: FormaDoEdificio;
  caixa: Ret;
  entrada: { comodo: number; lado: Frente };
}

const FRENTES: readonly Frente[] = ['n', 's', 'l', 'o'];
const FORMAS: readonly FormaDoEdificio[] = ['auto', 'compacta', 'L', 'T', 'U', 'linear', 'patio'];

interface ComodoAlocado {
  indiceOriginal: number;
  tipo: string;
  nome: string;
  rets: Ret[];
  principal: boolean;
  ligadoA: number | null;
}

interface LimitesLote {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function caixaDeRets(rets: readonly Ret[]): Ret {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rets) {
    x0 = Math.min(x0, r[0]);
    y0 = Math.min(y0, r[1]);
    x1 = Math.max(x1, r[2]);
    y1 = Math.max(y1, r[3]);
  }
  return [x0, y0, x1, y1];
}

function retsSobrepoem(a: Ret, b: Ret): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function sobrepoeAlgum(r: Ret, colocados: readonly ComodoAlocado[]): boolean {
  for (const c of colocados) {
    for (const cr of c.rets) if (retsSobrepoem(r, cr)) return true;
  }
  return false;
}

/** Comprimento da borda compartilhada (em células) se dois retângulos encostam lado a lado. */
function bordaCompartilhada(a: Ret, b: Ret): number {
  if (a[2] === b[0] || a[0] === b[2]) return Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  if (a[3] === b[1] || a[1] === b[3]) return Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  return 0;
}

function paredesBloqueiam(m: MapaAtlas, r: Ret): boolean {
  const g = m.grid.size || 1.5;
  const rx0 = r[0] * g + 0.05, ry0 = r[1] * g + 0.05, rx1 = r[2] * g - 0.05, ry1 = r[3] * g - 0.05;
  if (rx1 <= rx0 || ry1 <= ry0) return false;
  for (const p of Object.values(m.walls)) {
    for (let i = 0; i + 1 < p.path.length; i++) {
      const a = p.path[i]!, b = p.path[i + 1]!;
      if (segmentoTocaCaixa(a[0], a[1], b[0], b[1], rx0, ry0, rx1, ry1)) return true;
    }
  }
  return false;
}

function segmentoTocaCaixa(x1: number, y1: number, x2: number, y2: number, rx0: number, ry0: number, rx1: number, ry1: number): boolean {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const checks: [number, number][] = [
    [-dx, x1 - rx0],
    [dx, rx1 - x1],
    [-dy, y1 - ry0],
    [dy, ry1 - y1],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

function conjuntoDeCelulasOcupadas(m: MapaAtlas): Set<string> {
  const s = new Set<string>();
  for (const c of Object.values(m.rooms)) {
    for (const [x, y] of decodificar(c.cells)) s.add(`${x},${y}`);
  }
  return s;
}

function colideMapa(m: MapaAtlas, ocupadas: ReadonlySet<string>, r: Ret, limites: LimitesLote, faixaAlpendre?: Ret | null): boolean {
  if (r[0] < limites.x0 || r[1] < limites.y0 || r[2] > limites.x1 || r[3] > limites.y1) return true;
  if (faixaAlpendre && retsSobrepoem(r, faixaAlpendre)) return true;
  for (let y = r[1]; y < r[3]; y++) {
    for (let x = r[0]; x < r[2]; x++) {
      if (ocupadas.has(`${x},${y}`)) return true;
    }
  }
  return paredesBloqueiam(m, r);
}

/** Pares `[w, h]` com proporção entre 1:1 e 1:2, ordenados por proximidade da área pedida em células. */
function dimensoesPara(celulasAlvo: number, sementeOffset: number): [number, number][] {
  const alvo = Math.max(2, celulasAlvo);
  const pares: { w: number; h: number; erro: number }[] = [];
  const visto = new Set<string>();
  const maxLado = Math.max(3, Math.ceil(Math.sqrt(alvo * 2)) + 1);
  for (let w = 1; w <= maxLado; w++) {
    for (let h = 1; h <= maxLado; h++) {
      if (alvo >= 3 && (w < 2 || h < 2)) continue;
      if (Math.max(w, h) > 2 * Math.min(w, h)) continue;
      const area = w * h;
      if (area < Math.max(2, Math.ceil(alvo * 0.6)) || area > Math.floor(alvo * 1.4)) continue;
      const chave = `${w}x${h}`;
      if (visto.has(chave)) continue;
      visto.add(chave);
      pares.push({ w, h, erro: Math.abs(area - alvo) + (w === h ? 0 : 0.05) });
    }
  }
  if (!pares.length) {
    const lado = Math.max(2, Math.round(Math.sqrt(alvo)));
    pares.push({ w: lado, h: lado, erro: Math.abs(lado * lado - alvo) });
  }
  pares.sort((a, b) => a.erro - b.erro || (((a.w - a.h) * (sementeOffset % 2 === 0 ? 1 : -1)) - (b.w - b.h)));
  return pares.map(p => [p.w, p.h]);
}

function retDoAlpendre(principal: Ret, frente: Frente): Ret {
  if (frente === 'n') return [principal[0], principal[1] - 1, principal[2], principal[1]];
  if (frente === 's') return [principal[0], principal[3], principal[2], principal[3] + 1];
  if (frente === 'o') return [principal[0] - 1, principal[1], principal[0], principal[3]];
  return [principal[2], principal[1], principal[2] + 1, principal[3]];
}

function escolheFormaAuto(qtd: number, rng: () => number): FormaDoEdificio {
  if (qtd <= 1) return 'compacta';
  if (qtd <= 3) return rng() < 0.5 ? 'compacta' : 'L';
  if (qtd <= 6) {
    const r = rng();
    return r < 0.34 ? 'L' : r < 0.67 ? 'T' : 'linear';
  }
  return rng() < 0.55 ? 'linear' : 'patio';
}

function frentePrincipalLivre(principal: Ret, frente: Frente, candidato: Ret): boolean {
  if (frente === 'n') return !(candidato[1] < principal[1] && candidato[0] < principal[2] && candidato[2] > principal[0]);
  if (frente === 's') return !(candidato[3] > principal[3] && candidato[0] < principal[2] && candidato[2] > principal[0]);
  if (frente === 'o') return !(candidato[0] < principal[0] && candidato[1] < principal[3] && candidato[3] > principal[1]);
  return !(candidato[2] > principal[2] && candidato[1] < principal[3] && candidato[3] > principal[1]);
}

function cantosVazios(rets: readonly Ret[], caixa: Ret): number {
  const [x0, y0, x1, y1] = caixa;
  const cantos: [number, number][] = [[x0, y0], [x1 - 1, y0], [x0, y1 - 1], [x1 - 1, y1 - 1]];
  let vazios = 0;
  for (const [cx, cy] of cantos) {
    const ocupado = rets.some(r => cx >= r[0] && cx < r[2] && cy >= r[1] && cy < r[3]);
    if (!ocupado) vazios++;
  }
  return vazios;
}

function avaliarCandidato(
  cand: Ret,
  forma: FormaDoEdificio,
  frente: Frente,
  colocados: readonly ComodoAlocado[],
  principal: Ret,
  paiIdx: number,
  passo: number,
  qtdTotal: number,
  rng: () => number,
): number {
  const todosRets = [...colocados.flatMap(c => c.rets), cand];
  const caixa = caixaDeRets(todosRets);
  const areaRets = todosRets.reduce((s, r) => s + (r[2] - r[0]) * (r[3] - r[1]), 0);
  const bw = caixa[2] - caixa[0], bh = caixa[3] - caixa[1];
  const areaCaixa = bw * bh;
  const preenchimento = areaRets / Math.max(1, areaCaixa);
  const frenteHorizontal = frente === 'n' || frente === 's';
  let vizinhos = 0;
  for (const c of colocados) {
    for (const r of c.rets) if (bordaCompartilhada(cand, r) > 0) vizinhos++;
  }
  let nota = vizinhos * 2 + (rng() - 0.5) * 1.5;

  if (forma === 'compacta') {
    const proporcao = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
    nota += preenchimento * 40 - proporcao * 6;
  } else if (forma === 'linear') {
    const eixoLongo = frenteHorizontal ? bw : bh;
    const eixoCurto = frenteHorizontal ? bh : bw;
    nota += eixoLongo * 8 - eixoCurto * 14 + preenchimento * 10;
  } else if (forma === 'L') {
    const vazios = cantosVazios(todosRets, caixa);
    nota += vazios === 1 ? 30 : vazios === 2 ? 12 : -25;
    if (preenchimento >= 0.99 && todosRets.length >= 3) nota -= 35;
    // Favorece estender dois braços em ângulo reto em torno do principal
    const alinhadoPrincipalX = cand[0] === principal[0] || cand[2] === principal[2];
    const alinhadoPrincipalY = cand[1] === principal[1] || cand[3] === principal[3];
    if (alinhadoPrincipalX || alinhadoPrincipalY) nota += 6;
  } else if (forma === 'T') {
    // Primeiros 2 filhos flanqueiam o principal na barra do T; o restante estende a haste oposta à frente
    const pCx = (principal[0] + principal[2]) / 2, pCy = (principal[1] + principal[3]) / 2;
    const cCx = (cand[0] + cand[2]) / 2, cCy = (cand[1] + cand[3]) / 2;
    const naBarra = frenteHorizontal ? (cand[1] < principal[3] && cand[3] > principal[1]) : (cand[0] < principal[2] && cand[2] > principal[0]);
    const naHaste = frenteHorizontal ? Math.abs(cCx - pCx) <= Math.max(2, (principal[2] - principal[0]) * 0.6) : Math.abs(cCy - pCy) <= Math.max(2, (principal[3] - principal[1]) * 0.6);
    if (passo <= 2) {
      nota += naBarra ? 28 : -10;
    } else {
      nota += naHaste && !naBarra ? 26 : naBarra ? 4 : -15;
    }
    if (paiIdx === 0) nota += 4;
  } else if (forma === 'U') {
    const pCx = (principal[0] + principal[2]) / 2, pCy = (principal[1] + principal[3]) / 2;
    const cCx = (cand[0] + cand[2]) / 2, cCy = (cand[1] + cand[3]) / 2;
    const atras = frente === 'n' ? cand[1] >= principal[3] : frente === 's' ? cand[3] <= principal[1] : frente === 'o' ? cand[0] >= principal[2] : cand[2] <= principal[0];
    const afastadoDoMeio = frenteHorizontal ? Math.abs(cCx - pCx) : Math.abs(cCy - pCy);
    if (passo <= 2) {
      nota += !atras ? 22 : 5;
    } else {
      nota += atras ? afastadoDoMeio * 6 : -6;
    }
    if (preenchimento >= 0.99 && todosRets.length >= 4) nota -= 25;
  } else if (forma === 'patio') {
    // Favorece anel em torno de um pátio central sem preencher o miolo nem escapar em diagonal
    const raioAlvo = Math.max(2.5, Math.sqrt(qtdTotal) * 1.1);
    const pCx = (principal[0] + principal[2]) / 2, pCy = (principal[1] + principal[3]) / 2;
    const dxFrente = frente === 'o' ? raioAlvo : frente === 'l' ? -raioAlvo : 0;
    const dyFrente = frente === 'n' ? raioAlvo : frente === 's' ? -raioAlvo : 0;
    const patioX = pCx + dxFrente, patioY = pCy + dyFrente;
    const cCx = (cand[0] + cand[2]) / 2, cCy = (cand[1] + cand[3]) / 2;
    const distPatio = Math.hypot(cCx - patioX, cCy - patioY);
    const dentroDoMiolo = Math.abs(cCx - patioX) < 1.3 && Math.abs(cCy - patioY) < 1.3;
    nota += -Math.abs(distPatio - raioAlvo) * 6 + (dentroDoMiolo ? -30 : 8) + (1 - preenchimento) * 12;
  }

  return nota;
}

function gerarCandidatosAoRedor(pai: Ret, w: number, h: number): Ret[] {
  const saida: Ret[] = [];
  const xs = new Set([pai[0], pai[2] - w, Math.floor((pai[0] + pai[2] - w) / 2), pai[0] - 1, pai[2] - w + 1]);
  const ys = new Set([pai[1], pai[3] - h, Math.floor((pai[1] + pai[3] - h) / 2), pai[1] - 1, pai[3] - h + 1]);
  for (const x of xs) {
    saida.push([x, pai[1] - h, x + w, pai[1]]); // norte
    saida.push([x, pai[3], x + w, pai[3] + h]); // sul
  }
  for (const y of ys) {
    saida.push([pai[0] - w, y, pai[0], y + h]); // oeste
    saida.push([pai[2], y, pai[2] + w, y + h]); // leste
  }
  return saida;
}

/** Constrói planta linear/T com corredor central de 1 célula quando há 5 ou mais cômodos. */
function tentarComCorredor(
  m: MapaAtlas,
  ocupadas: ReadonlySet<string>,
  limites: LimitesLote,
  forma: 'linear' | 'T',
  frente: Frente,
  itens: readonly { indiceOriginal: number; tipo: string; nome: string; celulas: number; principal: boolean }[],
  principalBase: Ret,
  alpendre: boolean,
  rng: () => number,
): ComodoAlocado[] | null {
  const pItem = itens[0]!;
  const alpendreRet = alpendre ? retDoAlpendre(principalBase, frente) : null;
  if (colideMapa(m, ocupadas, principalBase, limites) || (alpendreRet && colideMapa(m, ocupadas, alpendreRet, limites))) {
    return null;
  }

  const frenteHorizontal = frente === 'n' || frente === 's';
  const pw = principalBase[2] - principalBase[0], ph = principalBase[3] - principalBase[1];

  if (forma === 'linear') {
    // Corredor de 1 célula encostado atrás do principal ao longo do eixo paralelo à frente
    const faixaCorrY = frente === 'n' ? principalBase[3] : frente === 's' ? principalBase[1] - 1 : -1;
    const faixaCorrX = frente === 'o' ? principalBase[2] : frente === 'l' ? principalBase[0] - 1 : -1;
    const cInit: Ret = frenteHorizontal
      ? [principalBase[0], faixaCorrY, principalBase[2], faixaCorrY + 1]
      : [faixaCorrX, principalBase[1], faixaCorrX + 1, principalBase[3]];
    if (colideMapa(m, ocupadas, cInit, limites, alpendreRet)) return null;

    const colocados: ComodoAlocado[] = [
      { indiceOriginal: pItem.indiceOriginal, tipo: pItem.tipo, nome: pItem.nome, rets: [principalBase], principal: true, ligadoA: null },
      { indiceOriginal: -1, tipo: 'corredor', nome: 'Corredor', rets: [cInit], principal: false, ligadoA: 0 },
    ];
    let corr = cInit;
    const demais = itens.slice(1);

    for (let i = 0; i < demais.length; i++) {
      const it = demais[i]!;
      const dims = dimensoesPara(it.celulas, Math.floor(rng() * 10));
      let melhor: { rect: Ret; novoCorr: Ret; pai: number; nota: number } | null = null;

      for (const [w, h] of dims) {
        if (frenteHorizontal) {
          // Posições acima (lado frente, esquerda/direita do principal) ou abaixo (lado fundo ao longo do corredor)
          const candYs = frente === 'n'
            ? [corr[3], corr[1] - h]
            : [corr[1] - h, corr[3]];
          const minX = Math.max(limites.x0, corr[0] - w - 8);
          const maxX = Math.min(limites.x1 - w, corr[2] + 8);
          for (const cy of candYs) {
            for (let cx = minX; cx <= maxX; cx++) {
              const cand: Ret = [cx, cy, cx + w, cy + h];
              if (!frentePrincipalLivre(principalBase, frente, cand)) continue;
              if (colideMapa(m, ocupadas, cand, limites, alpendreRet) || sobrepoeAlgum(cand, colocados)) continue;
              const novoCorr: Ret = [Math.min(corr[0], cand[0]), corr[1], Math.max(corr[2], cand[2]), corr[3]];
              // O corredor expandido não pode colidir com nada já colocado nem com o mapa
              const corrLivre = !colideMapa(m, ocupadas, novoCorr, limites, alpendreRet)
                && !colocados.some((c, idx) => idx !== 1 && c.rets.some(cr => retsSobrepoem(novoCorr, cr)));
              if (!corrLivre) continue;
              if (bordaCompartilhada(cand, novoCorr) < 2) continue;
              const dist = Math.abs((cand[0] + cand[2]) / 2 - (principalBase[0] + principalBase[2]) / 2);
              const naFrente = (frente === 'n' && cy === corr[1] - h) || (frente === 's' && cy === corr[3]);
              const nota = -dist * 3 - (novoCorr[2] - novoCorr[0]) * 1.5 + (naFrente ? 4 : 0) + (rng() - 0.5) * 2;
              if (!melhor || nota > melhor.nota) melhor = { rect: cand, novoCorr, pai: 1, nota };
            }
          }
        } else {
          const candXs = frente === 'o'
            ? [corr[2], corr[0] - w]
            : [corr[0] - w, corr[2]];
          const minY = Math.max(limites.y0, corr[1] - h - 8);
          const maxY = Math.min(limites.y1 - h, corr[3] + 8);
          for (const cx of candXs) {
            for (let cy = minY; cy <= maxY; cy++) {
              const cand: Ret = [cx, cy, cx + w, cy + h];
              if (!frentePrincipalLivre(principalBase, frente, cand)) continue;
              if (colideMapa(m, ocupadas, cand, limites, alpendreRet) || sobrepoeAlgum(cand, colocados)) continue;
              const novoCorr: Ret = [corr[0], Math.min(corr[1], cand[1]), corr[2], Math.max(corr[3], cand[3])];
              const corrLivre = !colideMapa(m, ocupadas, novoCorr, limites, alpendreRet)
                && !colocados.some((c, idx) => idx !== 1 && c.rets.some(cr => retsSobrepoem(novoCorr, cr)));
              if (!corrLivre) continue;
              if (bordaCompartilhada(cand, novoCorr) < 2) continue;
              const dist = Math.abs((cand[1] + cand[3]) / 2 - (principalBase[1] + principalBase[3]) / 2);
              const nota = -dist * 3 - (novoCorr[3] - novoCorr[1]) * 1.5 + (rng() - 0.5) * 2;
              if (!melhor || nota > melhor.nota) melhor = { rect: cand, novoCorr, pai: 1, nota };
            }
          }
        }
      }
      if (!melhor) return null;
      corr = melhor.novoCorr;
      colocados[1]!.rets = [corr];
      colocados.push({
        indiceOriginal: it.indiceOriginal,
        tipo: it.tipo,
        nome: it.nome,
        rets: [melhor.rect],
        principal: false,
        ligadoA: melhor.pai,
      });
    }
    return colocados;
  }

  // forma === 'T': barra frontal (principal + flancos laterais) + corredor em haste perpendicular
  const cxCentro = Math.floor((principalBase[0] + principalBase[2]) / 2);
  const cyCentro = Math.floor((principalBase[1] + principalBase[3]) / 2);
  const cInit: Ret = frente === 'n'
    ? [cxCentro, principalBase[3], cxCentro + 1, principalBase[3] + 2]
    : frente === 's'
      ? [cxCentro, principalBase[1] - 2, cxCentro + 1, principalBase[1]]
      : frente === 'o'
        ? [principalBase[2], cyCentro, principalBase[2] + 2, cyCentro + 1]
        : [principalBase[0] - 2, cyCentro, principalBase[0], cyCentro + 1];
  if (colideMapa(m, ocupadas, cInit, limites, alpendreRet)) return null;

  const colocados: ComodoAlocado[] = [
    { indiceOriginal: pItem.indiceOriginal, tipo: pItem.tipo, nome: pItem.nome, rets: [principalBase], principal: true, ligadoA: null },
    { indiceOriginal: -1, tipo: 'corredor', nome: 'Corredor', rets: [cInit], principal: false, ligadoA: 0 },
  ];
  let corr = cInit;
  const demais = itens.slice(1);
  // Até 2 cômodos flanqueiam o principal na barra horizontal/vertical; os restantes alinham na haste do corredor
  for (let i = 0; i < demais.length; i++) {
    const it = demais[i]!;
    const dims = dimensoesPara(it.celulas, Math.floor(rng() * 10));
    let melhor: { rect: Ret; novoCorr: Ret; pai: number; nota: number } | null = null;

    if (i < 2) {
      for (const [w, h] of dims) {
        for (const cand of gerarCandidatosAoRedor(principalBase, w, h)) {
          if (!frentePrincipalLivre(principalBase, frente, cand)) continue;
          if (bordaCompartilhada(cand, principalBase) < 2) continue;
          if (colideMapa(m, ocupadas, cand, limites, alpendreRet) || sobrepoeAlgum(cand, colocados)) continue;
          const naBarra = frenteHorizontal
            ? (cand[3] <= principalBase[3] && cand[1] >= principalBase[1] - 1)
            : (cand[2] <= principalBase[2] && cand[0] >= principalBase[0] - 1);
          const alinhado = frenteHorizontal ? cand[1] === principalBase[1] : cand[0] === principalBase[0];
          const nota = (naBarra ? 20 : -20) + (alinhado ? 10 : 0) + (rng() - 0.5) * 2;
          if (!melhor || nota > melhor.nota) melhor = { rect: cand, novoCorr: corr, pai: 0, nota };
        }
      }
    }

    if (!melhor) {
      for (const [w, h] of dims) {
        if (frenteHorizontal) {
          const candXs = [corr[0] - w, corr[2]];
          const minY = frente === 'n' ? corr[1] : Math.max(limites.y0, corr[1] - 8);
          const maxY = frente === 'n' ? Math.min(limites.y1 - h, corr[3] + 8) : corr[3] - h;
          for (const cx of candXs) {
            for (let cy = minY; cy <= maxY; cy++) {
              const cand: Ret = [cx, cy, cx + w, cy + h];
              if (!frentePrincipalLivre(principalBase, frente, cand)) continue;
              if (colideMapa(m, ocupadas, cand, limites, alpendreRet) || sobrepoeAlgum(cand, colocados)) continue;
              const novoCorr: Ret = [corr[0], Math.min(corr[1], cand[1]), corr[2], Math.max(corr[3], cand[3])];
              const corrLivre = !colideMapa(m, ocupadas, novoCorr, limites, alpendreRet)
                && !colocados.some((c, idx) => idx !== 1 && c.rets.some(cr => retsSobrepoem(novoCorr, cr)));
              if (!corrLivre || bordaCompartilhada(cand, novoCorr) < 2) continue;
              const dist = Math.abs((cand[1] + cand[3]) / 2 - (principalBase[1] + principalBase[3]) / 2);
              const nota = -dist * 2 - ((novoCorr[3] - novoCorr[1]) - ph) + (rng() - 0.5) * 2;
              if (!melhor || nota > melhor.nota) melhor = { rect: cand, novoCorr, pai: 1, nota };
            }
          }
        } else {
          const candYs = [corr[1] - h, corr[3]];
          const minX = frente === 'o' ? corr[0] : Math.max(limites.x0, corr[0] - 8);
          const maxX = frente === 'o' ? Math.min(limites.x1 - w, corr[2] + 8) : corr[2] - w;
          for (const cy of candYs) {
            for (let cx = minX; cx <= maxX; cx++) {
              const cand: Ret = [cx, cy, cx + w, cy + h];
              if (!frentePrincipalLivre(principalBase, frente, cand)) continue;
              if (colideMapa(m, ocupadas, cand, limites, alpendreRet) || sobrepoeAlgum(cand, colocados)) continue;
              const novoCorr: Ret = [Math.min(corr[0], cand[0]), corr[1], Math.max(corr[2], cand[2]), corr[3]];
              const corrLivre = !colideMapa(m, ocupadas, novoCorr, limites, alpendreRet)
                && !colocados.some((c, idx) => idx !== 1 && c.rets.some(cr => retsSobrepoem(novoCorr, cr)));
              if (!corrLivre || bordaCompartilhada(cand, novoCorr) < 2) continue;
              const dist = Math.abs((cand[0] + cand[2]) / 2 - (principalBase[0] + principalBase[2]) / 2);
              const nota = -dist * 2 - ((novoCorr[2] - novoCorr[0]) - pw) + (rng() - 0.5) * 2;
              if (!melhor || nota > melhor.nota) melhor = { rect: cand, novoCorr, pai: 1, nota };
            }
          }
        }
      }
    }

    if (!melhor) return null;
    corr = melhor.novoCorr;
    colocados[1]!.rets = [corr];
    colocados.push({
      indiceOriginal: it.indiceOriginal,
      tipo: it.tipo,
      nome: it.nome,
      rets: [melhor.rect],
      principal: false,
      ligadoA: melhor.pai,
    });
  }
  return colocados;
}

/** Calcula a planta baixa de um edifício sem tocar no mapa. */
export function plantaDoEdificio(m: MapaAtlas, p: ProgramaDeEdificio, semente: number): PlantaDoEdificio {
  if (!FRENTES.includes(p.frente)) {
    throw new ErroDeConstrucao(`frente “${String(p.frente)}” não existe; valores: n, s, l, o`);
  }
  const formaPedida = p.forma ?? 'auto';
  if (!FORMAS.includes(formaPedida)) {
    throw new ErroDeConstrucao(`forma “${String(formaPedida)}” não existe; valores: ${FORMAS.join(', ')}`);
  }
  if (!Array.isArray(p.comodos) || p.comodos.length < 1 || p.comodos.length > 12) {
    throw new ErroDeConstrucao('o programa precisa ter de 1 a 12 cômodos');
  }
  const grade = m.grid.size || 1.5;
  const maxX = Math.floor(m.bounds.width / grade);
  const maxY = Math.floor(m.bounds.height / grade);
  const [ox, oy] = p.origem;
  if (!Number.isInteger(ox) || !Number.isInteger(oy) || ox < 0 || oy < 0 || ox >= maxX || oy >= maxY) {
    throw new ErroDeConstrucao(`origem [${ox}, ${oy}] fora do mapa (0..${maxX - 1}, 0..${maxY - 1})`);
  }

  let totalCelulas = 0;
  const itens = p.comodos.map((c, idx) => {
    const t = tipoDeComodo(c.tipo);
    if (!t) throw new ErroDeConstrucao(`tipo de cômodo “${c.tipo}” não existe`);
    if (!Number.isFinite(c.area) || c.area <= 0) {
      throw new ErroDeConstrucao(`área inválida (${c.area}) no cômodo “${c.nome ?? t.nome}”`);
    }
    const celulas = Math.max(2, Math.round(c.area / (grade * grade)));
    totalCelulas += celulas;
    return {
      indiceOriginal: idx,
      tipo: c.tipo,
      nome: c.nome ?? t.nome,
      area: c.area,
      celulas,
      principal: Boolean(c.principal),
    };
  });

  const padraoLote = Math.max(6, Math.ceil(3 * Math.sqrt(totalCelulas)));
  const [lw, lh] = p.lote ?? [padraoLote, padraoLote];
  if (!Number.isFinite(lw) || !Number.isFinite(lh) || lw <= 0 || lh <= 0) {
    throw new ErroDeConstrucao(`lote [${lw}, ${lh}] inválido`);
  }
  const limites: LimitesLote = {
    x0: ox,
    y0: oy,
    x1: Math.min(maxX, ox + Math.floor(lw)),
    y1: Math.min(maxY, oy + Math.floor(lh)),
  };

  const ocupadas = conjuntoDeCelulasOcupadas(m);
  let celulasLivres = 0;
  for (let y = limites.y0; y < limites.y1; y++) {
    for (let x = limites.x0; x < limites.x1; x++) {
      if (!ocupadas.has(`${x},${y}`)) celulasLivres++;
    }
  }
  if (celulasLivres < totalCelulas) {
    const faltam = totalCelulas - celulasLivres;
    const areaFalta = (faltam * grade * grade).toFixed(1);
    throw new ErroDeConstrucao(
      `lote em [${ox}, ${oy}] (${limites.x1 - limites.x0}×${limites.y1 - limites.y0} células) não comporta os ${totalCelulas} blocos pedidos: faltaram ${faltam} células livres (${areaFalta} m²). Escolha outra origem ou aumente o lote.`,
    );
  }

  const rng = mulberry32(Math.floor(semente) || 1);
  const forma = formaPedida === 'auto' ? escolheFormaAuto(itens.length, rng) : formaPedida;

  // Escolhe cômodo principal (explícito ou o de maior área)
  let pPos = itens.findIndex(it => it.principal);
  if (pPos < 0) {
    pPos = 0;
    for (let i = 1; i < itens.length; i++) if (itens[i]!.area > itens[pPos]!.area) pPos = i;
  }
  const principalItem = { ...itens[pPos]!, principal: true };
  const restantes = itens
    .filter((_, i) => i !== pPos)
    .sort((a, b) => b.area - a.area || a.indiceOriginal - b.indiceOriginal);
  const ordenados = [principalItem, ...restantes];

  const usaAlpendre = Boolean(p.alpendre);

  // Caso 1 cômodo: na origem (ou recuado 1 célula se o alpendre ficar na borda n/o da origem)
  if (ordenados.length === 1) {
    const dims = dimensoesPara(principalItem.celulas, Math.floor(rng() * 10));
    const dxAlp = usaAlpendre && p.frente === 'o' ? 1 : 0;
    const dyAlp = usaAlpendre && p.frente === 'n' ? 1 : 0;
    for (const [w, h] of dims) {
      const r: Ret = [ox + dxAlp, oy + dyAlp, ox + dxAlp + w, oy + dyAlp + h];
      const alp = usaAlpendre ? retDoAlpendre(r, p.frente) : null;
      if (!colideMapa(m, ocupadas, r, limites) && (!alp || !colideMapa(m, ocupadas, alp, limites))) {
        const comodos: ComodoDaPlanta[] = [
          { tipo: principalItem.tipo, nome: principalItem.nome, rets: [r], principal: true, ligadoA: null },
        ];
        if (alp) comodos.push({ tipo: 'varanda', nome: 'Varanda', rets: [alp], principal: false, ligadoA: 0 });
        return {
          comodos,
          forma,
          caixa: caixaDeRets(comodos.flatMap(c => c.rets)),
          entrada: { comodo: 0, lado: p.frente },
        };
      }
    }
    throw new ErroDeConstrucao(
      `não coube “${principalItem.nome}” na origem [${ox}, ${oy}] sem colidir com o lote ou obstáculos (faltaram ${principalItem.celulas} células livres em bloco). Tente outra origem.`,
    );
  }

  // Gera âncoras candidatas para o cômodo principal conforme a frente e a semente
  const dimsPrincipal = dimensoesPara(principalItem.celulas, Math.floor(rng() * 10));
  const estLado = Math.ceil(Math.sqrt(totalCelulas + 4));
  const candPrincipais: Ret[] = [];
  for (const [pw, ph] of dimsPrincipal.slice(0, 3)) {
    const padN = usaAlpendre && p.frente === 'n' ? 1 : 0;
    const padS = usaAlpendre && p.frente === 's' ? 1 : 0;
    const padO = usaAlpendre && p.frente === 'o' ? 1 : 0;
    const padL = usaAlpendre && p.frente === 'l' ? 1 : 0;

    const minX = limites.x0 + padO, maxPx = limites.x1 - pw - padL;
    const minY = limites.y0 + padN, maxPy = limites.y1 - ph - padS;
    if (maxPx < minX || maxPy < minY) continue;

    const meioX = Math.min(maxPx, Math.max(minX, Math.floor(limites.x0 + Math.min(lw, estLado * 2) / 2 - pw / 2)));
    const meioY = Math.min(maxPy, Math.max(minY, Math.floor(limites.y0 + Math.min(lh, estLado * 2) / 2 - ph / 2)));
    const fundoS = Math.min(maxPy, Math.max(minY, limites.y0 + Math.min(lh - ph - padS, estLado)));
    const fundoL = Math.min(maxPx, Math.max(minX, limites.x0 + Math.min(lw - pw - padL, estLado)));

    const xs = p.frente === 'o' ? [minX, minX + 1] : p.frente === 'l' ? [fundoL, maxPx, minX + 2] : [meioX, minX, minX + 2, maxPx];
    const ys = p.frente === 'n' ? [minY, minY + 1] : p.frente === 's' ? [fundoS, maxPy, minY + 2] : [meioY, minY, minY + 2, maxPy];

    const vistos = new Set<string>();
    for (const x of xs) {
      for (const y of ys) {
        if (x < minX || x > maxPx || y < minY || y > maxPy) continue;
        const k = `${x},${y},${pw},${ph}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        candPrincipais.push([x, y, x + pw, y + ph]);
      }
    }
  }
  // Embaralha levemente as duas primeiras âncoras equivalentes pela semente para variar plantas
  if (candPrincipais.length > 2 && rng() > 0.5) {
    const tmp = candPrincipais[0]!;
    candPrincipais[0] = candPrincipais[1]!;
    candPrincipais[1] = tmp;
  }

  let resultado: ComodoAlocado[] | null = null;
  const usaCorredor = ordenados.length >= 5 && (forma === 'linear' || forma === 'T');

  for (const pRect of candPrincipais) {
    const alpRet = usaAlpendre ? retDoAlpendre(pRect, p.frente) : null;
    if (colideMapa(m, ocupadas, pRect, limites)) continue;
    if (alpRet && colideMapa(m, ocupadas, alpRet, limites)) continue;

    if (usaCorredor) {
      const comCorredor = tentarComCorredor(m, ocupadas, limites, forma, p.frente, ordenados, pRect, usaAlpendre, rng);
      if (comCorredor) {
        resultado = comCorredor;
        break;
      }
    }

    // Posicionamento incremental com feixe (até 3 ramos) por nota da forma
    let estados: ComodoAlocado[][] = [[{
      indiceOriginal: principalItem.indiceOriginal,
      tipo: principalItem.tipo,
      nome: principalItem.nome,
      rets: [pRect],
      principal: true,
      ligadoA: null,
    }]];

    let falhou = false;
    for (let passo = 1; passo < ordenados.length; passo++) {
      const it = ordenados[passo]!;
      const dims = dimensoesPara(it.celulas, Math.floor(rng() * 10));
      const prox: { estado: ComodoAlocado[]; nota: number }[] = [];

      for (const estado of estados) {
        for (let paiIdx = 0; paiIdx < estado.length; paiIdx++) {
          const pai = estado[paiIdx]!;
          for (const paiRet of pai.rets) {
            for (const [w, h] of dims) {
              for (const cand of gerarCandidatosAoRedor(paiRet, w, h)) {
                if (bordaCompartilhada(cand, paiRet) < 2) continue;
                if (!frentePrincipalLivre(pRect, p.frente, cand)) continue;
                if (colideMapa(m, ocupadas, cand, limites, alpRet) || sobrepoeAlgum(cand, estado)) continue;
                const nota = avaliarCandidato(cand, forma, p.frente, estado, pRect, paiIdx, passo, ordenados.length, rng);
                prox.push({
                  estado: [...estado, {
                    indiceOriginal: it.indiceOriginal,
                    tipo: it.tipo,
                    nome: it.nome,
                    rets: [cand],
                    principal: false,
                    ligadoA: paiIdx,
                  }],
                  nota,
                });
              }
            }
          }
        }
      }
      if (!prox.length) {
        falhou = true;
        break;
      }
      prox.sort((a, b) => b.nota - a.nota);
      estados = prox.slice(0, 3).map(x => x.estado);
    }

    if (!falhou && estados[0]) {
      resultado = estados[0];
      break;
    }
  }

  if (!resultado) {
    const areaFalta = ((totalCelulas - Math.min(totalCelulas - 2, celulasLivres)) * grade * grade).toFixed(1);
    throw new ErroDeConstrucao(
      `não foi possível encaixar todos os ${ordenados.length} cômodos de “${p.nome}” no lote em [${ox}, ${oy}] (faltaram cerca de ${areaFalta} m² livres sem obstáculos ou colisões). Tente outro ponto de origem ou amplie o lote.`,
    );
  }

  if (usaAlpendre) {
    const alpRet = retDoAlpendre(resultado[0]!.rets[0]!, p.frente);
    resultado.push({
      indiceOriginal: -2,
      tipo: 'varanda',
      nome: 'Varanda',
      rets: [alpRet],
      principal: false,
      ligadoA: 0,
    });
  }

  // Reordena mantendo o principal e a árvore de ligadoA consistente
  const comodosSaida: ComodoDaPlanta[] = resultado.map(c => ({
    tipo: c.tipo,
    nome: c.nome,
    rets: c.rets,
    principal: c.principal,
    ligadoA: c.ligadoA,
  }));

  return {
    comodos: comodosSaida,
    forma,
    caixa: caixaDeRets(comodosSaida.flatMap(c => c.rets)),
    entrada: { comodo: 0, lado: p.frente },
  };
}

// ---------- D3b — Portas e janelas do edifício ----------

export interface AberturasDoEdificio {
  portas: PedidoDePorta[];
  janelas: PedidoDePorta[];
}

interface ArestaDaPlanta {
  /** Posição do centro da aresta em células (meio-inteiro na direção da parede). */
  cx: number;
  cy: number;
  lado: Frente;
  /** Coordenada fixa ao longo da normal (para agrupar arestas colineares). */
  coordFixa: number;
  /** Índice ao longo da direção da face. */
  passo: number;
  salaA: number;
  salaB: number | null;
}

const TIPOS_ENTRADA_LARGA = new Set(['salao', 'celeiro', 'capela', 'taverna', 'igreja']);
const TIPOS_SERVICO = new Set(['cozinha', 'deposito', 'oficina', 'estabulo']);
const SEM_JANELAS = new Set(['porao', 'deposito', 'cela', 'corredor', ...FUNCOES_AO_AR_LIVRE]);
const OPOSTA: Record<Frente, Frente> = { n: 's', s: 'n', l: 'o', o: 'l' };

function mapaDeCelulasDaPlanta(planta: PlantaDoEdificio): Map<string, number> {
  const mapa = new Map<string, number>();
  planta.comodos.forEach((c, idx) => {
    for (const [x0, y0, x1, y1] of c.rets) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) mapa.set(`${x},${y}`, idx);
      }
    }
  });
  return mapa;
}

function arestasDaPlanta(planta: PlantaDoEdificio): ArestaDaPlanta[] {
  const celulas = mapaDeCelulasDaPlanta(planta);
  const saida: ArestaDaPlanta[] = [];
  const dirs: { lado: Frente; dx: number; dy: number; ox: number; oy: number }[] = [
    { lado: 'n', dx: 0, dy: -1, ox: 0.5, oy: 0 },
    { lado: 's', dx: 0, dy: 1, ox: 0.5, oy: 1 },
    { lado: 'o', dx: -1, dy: 0, ox: 0, oy: 0.5 },
    { lado: 'l', dx: 1, dy: 0, ox: 1, oy: 0.5 },
  ];
  planta.comodos.forEach((c, idx) => {
    for (const [x0, y0, x1, y1] of c.rets) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          for (const d of dirs) {
            const viz = celulas.get(`${x + d.dx},${y + d.dy}`) ?? null;
            if (viz === idx) continue;
            const horiz = d.lado === 'n' || d.lado === 's';
            saida.push({
              cx: x + d.ox,
              cy: y + d.oy,
              lado: d.lado,
              coordFixa: horiz ? y + d.oy : x + d.ox,
              passo: horiz ? x : y,
              salaA: idx,
              salaB: viz,
            });
          }
        }
      }
    }
  });
  return saida;
}

/** Agrupa arestas externas contíguas e colineares de um cômodo numa mesma face. */
function agruparTrechos(arestas: readonly ArestaDaPlanta[]): ArestaDaPlanta[][] {
  if (!arestas.length) return [];
  const ord = [...arestas].sort((a, b) => a.coordFixa - b.coordFixa || a.passo - b.passo);
  const grupos: ArestaDaPlanta[][] = [];
  let atual: ArestaDaPlanta[] = [ord[0]!];
  for (let i = 1; i < ord.length; i++) {
    const prev = ord[i - 1]!, cur = ord[i]!;
    if (cur.coordFixa === prev.coordFixa && cur.passo === prev.passo + 1) {
      atual.push(cur);
    } else {
      grupos.push(atual);
      atual = [cur];
    }
  }
  grupos.push(atual);
  return grupos;
}

function pontoDaAresta(a: ArestaDaPlanta, grade: number): Ponto {
  return [a.cx * grade, a.cy * grade];
}

function arestaDoMeio(trecho: readonly ArestaDaPlanta[]): ArestaDaPlanta {
  return trecho[Math.floor(trecho.length / 2)]!;
}

/**
 * Gera portas e janelas (em metros) para uma `PlantaDoEdificio`:
 * entrada na frente (do alpendre ou do principal), portas internas segundo `ligadoA`/corredor,
 * porta de fundos opcional e janelas nas fachadas longas longe das portas.
 */
export function aberturasDoEdificio(planta: PlantaDoEdificio, grade = 1.5): AberturasDoEdificio {
  const arestas = arestasDaPlanta(planta);
  const portas: PedidoDePorta[] = [];
  const janelas: PedidoDePorta[] = [];
  const pertoDeAlgumaPorta = (p: Ponto, minDist: number) =>
    portas.some(d => Math.hypot(d.perto[0] - p[0], d.perto[1] - p[1]) < minDist);

  // 1. Entrada na face `frente` do alpendre (se houver) ou do cômodo principal
  const varandaIdx = planta.comodos.findIndex(c => c.tipo === 'varanda');
  const alvoEntradaIdx = varandaIdx >= 0 ? varandaIdx : planta.entrada.comodo;
  const ladoEntrada = planta.entrada.lado;
  const principalComodo = planta.comodos[planta.entrada.comodo]!;
  const larguraEntrada = TIPOS_ENTRADA_LARGA.has(principalComodo.tipo) ? 1.5 : 1.2;

  let trechoEntrada = agruparTrechos(
    arestas.filter(a => a.salaA === alvoEntradaIdx && a.salaB === null && a.lado === ladoEntrada),
  ).sort((a, b) => b.length - a.length)[0];
  if (!trechoEntrada) {
    trechoEntrada = agruparTrechos(
      arestas.filter(a => a.salaA === alvoEntradaIdx && a.salaB === null),
    ).sort((a, b) => b.length - a.length)[0];
  }
  if (trechoEntrada) {
    portas.push({
      perto: pontoDaAresta(arestaDoMeio(trechoEntrada), grade),
      tipo: 'door',
      largura: larguraEntrada,
    });
  }

  // 2. Portas internas entre cada cômodo e seu ligadoA (ou para o corredor se encostar nele)
  const paresComPorta = new Set<string>();
  const chavePar = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const corredorIdx = planta.comodos.findIndex(c => c.tipo === 'corredor');

  planta.comodos.forEach((c, idx) => {
    if (c.ligadoA === null) return;
    let alvo = c.ligadoA;
    // Para o corredor: se o cômodo encosta no corredor e ainda não liga nele, prefira ligar no corredor quando o pai é corredor
    if (corredorIdx >= 0 && idx !== corredorIdx && alvo !== corredorIdx) {
      const tocaCorredor = arestas.some(a => a.salaA === idx && a.salaB === corredorIdx);
      if (tocaCorredor && c.tipo !== 'varanda') alvo = corredorIdx;
    }
    const par = chavePar(idx, alvo);
    if (paresComPorta.has(par)) return;

    let trechos = agruparTrechos(arestas.filter(a => a.salaA === idx && a.salaB === alvo))
      .sort((a, b) => b.length - a.length);
    if (!trechos.length && alvo !== c.ligadoA) {
      alvo = c.ligadoA;
      trechos = agruparTrechos(arestas.filter(a => a.salaA === idx && a.salaB === alvo))
        .sort((a, b) => b.length - a.length);
    }
    if (!trechos.length) return;

    paresComPorta.add(chavePar(idx, alvo));
    const trecho = trechos[0]!;
    portas.push({
      perto: pontoDaAresta(arestaDoMeio(trecho), grade),
      tipo: 'door',
      largura: 0.9,
    });
  });

  // Se houver algum cômodo ainda sem ligação ao grafo (ex.: fallback), garante conexão com qualquer vizinho compartilhado
  planta.comodos.forEach((_c, idx) => {
    if (idx === planta.entrada.comodo) return;
    const temAlguma = planta.comodos.some((_, j) => j !== idx && paresComPorta.has(chavePar(idx, j)));
    if (temAlguma) return;
    const vizinhos = agruparTrechos(arestas.filter(a => a.salaA === idx && a.salaB !== null))
      .sort((a, b) => b.length - a.length);
    if (vizinhos[0]) {
      const alvo = vizinhos[0][0]!.salaB!;
      paresComPorta.add(chavePar(idx, alvo));
      portas.push({
        perto: pontoDaAresta(arestaDoMeio(vizinhos[0]), grade),
        tipo: 'door',
        largura: 0.9,
      });
    }
  });

  // 3. Porta de fundos no cômodo de serviço em face externa oposta à frente (plantas com 3+ cômodos)
  if (planta.comodos.length >= 3) {
    const oposta = OPOSTA[ladoEntrada];
    for (let idx = 0; idx < planta.comodos.length; idx++) {
      if (!TIPOS_SERVICO.has(planta.comodos[idx]!.tipo)) continue;
      const trechosOpostos = agruparTrechos(
        arestas.filter(a => a.salaA === idx && a.salaB === null && a.lado === oposta),
      ).sort((a, b) => b.length - a.length);
      if (!trechosOpostos.length) continue;
      const meio = pontoDaAresta(arestaDoMeio(trechosOpostos[0]!), grade);
      if (!pertoDeAlgumaPorta(meio, grade * 0.99)) {
        portas.push({ perto: meio, tipo: 'door', largura: 0.9 });
        break;
      }
    }
  }

  // 4. Janelas: 1 por face externa com 3+ células (2 se 6+), fora de porao/deposito/cela/corredor/ar livre
  planta.comodos.forEach((c, idx) => {
    if (SEM_JANELAS.has(c.tipo)) return;
    for (const lado of FRENTES) {
      const trechos = agruparTrechos(arestas.filter(a => a.salaA === idx && a.salaB === null && a.lado === lado));
      for (const trecho of trechos) {
        if (trecho.length < 3) continue;
        const qtd = trecho.length >= 6 ? 2 : 1;
        const alvosIndices = qtd === 2
          ? [Math.floor(trecho.length / 4), Math.floor((trecho.length * 3) / 4)]
          : [Math.floor(trecho.length / 2)];
        const usadasNesteTrecho: Ponto[] = [];

        for (const alvoIdx of alvosIndices) {
          // Busca a posição válida mais próxima do alvoIdx e longe (>= 1 célula) das portas e de outras janelas
          const candidatos = trecho
            .map((a, i) => ({ a, distIdx: Math.abs(i - alvoIdx) }))
            .sort((x, y) => x.distIdx - y.distIdx);
          for (const { a } of candidatos) {
            const p = pontoDaAresta(a, grade);
            if (pertoDeAlgumaPorta(p, grade - 1e-6)) continue;
            if (usadasNesteTrecho.some(u => Math.hypot(u[0] - p[0], u[1] - p[1]) < grade * 1.5)) continue;
            janelas.push({ perto: p, tipo: 'window', largura: 0.9 });
            usadasNesteTrecho.push(p);
            break;
          }
        }
      }
    }
  });

  return { portas, janelas };
}

/** Verifica por busca em largura a partir da entrada se todos os cômodos da planta têm acesso por porta. */
export function acessivel(planta: PlantaDoEdificio, aberturas: AberturasDoEdificio, grade = 1.5): boolean {
  if (!planta.comodos.length) return false;
  const arestas = arestasDaPlanta(planta);
  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < planta.comodos.length; i++) adj.set(i, new Set());
  const inicios = new Set<number>();
  const tol = grade * 0.55;

  for (const d of aberturas.portas) {
    for (const a of arestas) {
      const [ax, ay] = pontoDaAresta(a, grade);
      if (Math.hypot(ax - d.perto[0], ay - d.perto[1]) <= tol) {
        if (a.salaB === null) inicios.add(a.salaA);
        else {
          adj.get(a.salaA)!.add(a.salaB);
          adj.get(a.salaB)!.add(a.salaA);
        }
      }
    }
  }

  if (!inicios.size) return false;
  const visitados = new Set<number>(inicios);
  const fila = [...inicios];
  while (fila.length) {
    const cur = fila.shift()!;
    for (const v of adj.get(cur)!) {
      if (!visitados.has(v)) {
        visitados.add(v);
        fila.push(v);
      }
    }
  }
  return visitados.size === planta.comodos.length;
}

