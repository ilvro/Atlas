import { PAREDE_PADRAO, centroDaAbertura, contornoDoComodo, encaixarObjetoDeParede } from '../domain/geometria.ts';
import { novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import type { MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { mulberry32 } from '../procedural/ruido.ts';
import { pegadaDaReceita, receitaDe } from '../procedural/receitas.ts';
import { caixaDoObjeto, insightDoComodo, type Caixa, type InsightDoComodo } from './insight.ts';
import { circulacao, malhaDoComodo, marcarRetangulo, retanguloLivre, type Circulacao, type Malha } from './malha.ts';
import { reservasDePorta } from './portas.ts';
import { regrasPara, type ItemDeRegra } from './regras-mobilia.ts';

export interface PedidoDeLayout {
  roomId: string; funcao: string; genero: string; semente: number;
  gerarId?: (prefixo: string) => string;
  /** Parâmetros por receita (a paleta da 5.3c). */
  params?: (receita: string) => Record<string, unknown>;
}
export interface Layout {
  objetos: Objeto[];
  /** Ids de itens da regra que não couberam. */
  faltaram: string[];
}

const ESP = PAREDE_PADRAO.thickness, PASSO = 0.25;
/** Folga entre móveis que bloqueiam; ao redor de uma âncora (cadeira na mesa) é bem menor. */
const FOLGA = 0.1, FOLGA_JUNTO = 0.06;

/** Rotação de um móvel com o fundo (−y local) encostado na parede cuja normal para dentro é `n`: parede de cima → 0. */
export const rotacaoDeParede = (n: Ponto): number => Math.atan2(-n[0], n[1]) + 0;
/** Rotação de um móvel que, em `d` (direção que sai da âncora), olha de volta para a âncora. */
const rotacaoVoltadaPara = (d: Ponto): number => Math.atan2(d[0], -d[1]);

const hashTexto = (t: string): number => { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const distancia = (a: Ponto, b: Ponto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const intersecta = (a: Caixa, b: Caixa, margem: number) => a.x0 < b.x1 + margem && a.x1 > b.x0 - margem && a.y0 < b.y1 + margem && a.y1 > b.y0 - margem;
const todasAsReceitas = (r: ItemDeRegra): string[] => [...new Set([...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])])];

interface Candidato { pos: Ponto; rot: number; /** Maior primeiro. */ nota: number }
interface Ancora { pos: Ponto; rot: number; w: number; h: number }

/**
 * Onde pôr os móveis que faltam num cômodo: encostados na parede, sem tampar porta nem a passagem entre as portas,
 * contando o que já existe (não repete uma cama, e as cadeiras se juntam à mesa que o mestre já pôs). Determinístico: mesma semente, mesmo layout.
 */
export function gerarLayout(m: MapaAtlas, pedido: PedidoDeLayout): Layout {
  const ins = insightDoComodo(m, pedido.roomId); if (!ins) return { objetos: [], faltaram: [] };
  const malha = malhaDoComodo(m, ins);
  // Os vãos das portas que ainda vão entrar ficam livres, mesmo sem porta ainda.
  for (const caixa of reservasDePorta(m, pedido.roomId)) marcarRetangulo(malha, caixa, 'porta');
  const circ = circulacao(malha, ins), regras = regrasPara(pedido.funcao, pedido.genero);
  const gerarId = pedido.gerarId ?? novoIdEntidade, rng = mulberry32(Math.imul(pedido.semente | 0, 2654435761) ^ hashTexto(pedido.roomId));
  return new Gerador(m, ins, malha, circ, regras, pedido, gerarId, rng).gerar();
}

class Gerador {
  private readonly segmentos: { a: Ponto; b: Ponto; n: Ponto; comprimento: number; t: Ponto }[];
  private readonly existentes: Objeto[];
  private readonly novos: Objeto[] = [];
  private readonly porRegra = new Map<string, Objeto[]>();
  /** Caixas dos móveis que bloqueiam (os de agora e os novos), para a folga entre eles. */
  private readonly bloqueantes: Caixa[] = [];
  private readonly faltaram: string[] = [];
  private readonly centroide: Ponto;

  private readonly m: MapaAtlas; private readonly ins: InsightDoComodo; private readonly malha: Malha; private readonly circ: Circulacao;
  private readonly regras: ItemDeRegra[]; private readonly pedido: PedidoDeLayout; private readonly gerarId: (p: string) => string; private readonly rng: () => number;

  constructor(m: MapaAtlas, ins: InsightDoComodo, malha: Malha, circ: Circulacao, regras: ItemDeRegra[], pedido: PedidoDeLayout, gerarId: (p: string) => string, rng: () => number) {
    this.m = m; this.ins = ins; this.malha = malha; this.circ = circ; this.regras = regras; this.pedido = pedido; this.gerarId = gerarId; this.rng = rng;
    this.segmentos = contornoDoComodo(m, ins.celulas).flat().map(s => { const comprimento = distancia(s.a, s.b); return { a: s.a, b: s.b, n: s.n, comprimento, t: [(s.b[0] - s.a[0]) / comprimento, (s.b[1] - s.a[1]) / comprimento] as Ponto }; });
    this.existentes = Object.values(m.props).filter(o => o.roomId === ins.id);
    for (const o of this.existentes) if (o.elevation === 'floor' && o.blocks.move) this.bloqueantes.push(caixaDoObjeto(o));
    let sx = 0, sy = 0, n = 0;
    for (let l = 0; l < malha.linhas; l++) for (let c = 0; c < malha.colunas; c++) if (malha.dentro[l * malha.colunas + c]) { sx += malha.x0 + (c + 0.5) * malha.res; sy += malha.y0 + (l + 0.5) * malha.res; n++; }
    this.centroide = n ? [sx / n, sy / n] : [(ins.caixa.x0 + ins.caixa.x1) / 2, (ins.caixa.y0 + ins.caixa.y1) / 2];
  }

  gerar(): Layout {
    for (const regra of this.regras) {
      if (regra.areaMinima && this.ins.area < regra.areaMinima) continue;
      // O alvo de cada item vem de um sorteio só dele: o que já foi posto não muda a conta, e a sugestão não volta depois de aceita.
      const alvo = regra.quantos[0] + Math.floor(mulberry32(Math.imul(this.pedido.semente | 0, 2654435761) ^ hashTexto(`${this.pedido.roomId}/${regra.id}`))() * (regra.quantos[1] - regra.quantos[0] + 1));
      const receitas = todasAsReceitas(regra), ja = this.existentes.filter(o => o.source.kind === 'recipe' && receitas.includes(o.source.recipe)).length;
      for (let k = 0; k < alvo - ja; k++) {
        const obj = this.colocar(regra);
        if (!obj) { this.faltaram.push(regra.id); break; }
        this.novos.push(obj); this.porRegra.set(regra.id, [...(this.porRegra.get(regra.id) ?? []), obj]);
      }
    }
    return { objetos: this.novos, faltaram: this.faltaram };
  }

  private escolherReceita(regra: ItemDeRegra): string {
    const porArea = [...(regra.porArea ?? [])].filter(([a]) => this.ins.area >= a).sort((a, b) => b[0] - a[0])[0];
    return porArea ? porArea[1] : regra.receitas[Math.floor(this.rng() * regra.receitas.length)]!;
  }

  private ancorasDe(id: string): Ancora[] {
    const regra = this.regras.find(r => r.id === id); if (!regra) return [];
    const receitas = todasAsReceitas(regra);
    return [...this.existentes.filter(o => o.source.kind === 'recipe' && receitas.includes(o.source.recipe)), ...(this.porRegra.get(id) ?? [])].map(o => {
      const [w, h] = o.source.kind === 'recipe' ? pegadaDaReceita(o.source.recipe, o.source.params) : [0.8, 0.8];
      return { pos: o.position, rot: o.rotation, w: w * o.scale, h: h * o.scale };
    });
  }

  private colocar(regra: ItemDeRegra): Objeto | null {
    const receita = this.escolherReceita(regra), rec = receitaDe(receita); if (!rec) return null;
    const params = { ...(regra.params ?? {}), ...(this.pedido.params?.(receita) ?? {}) }, [w, h] = pegadaDaReceita(receita, params);
    if (regra.lugar === 'na-parede') return this.colocarNaParede(receita, params, w);
    const tapete = rec.categoria === 'tapetes', bloqueia = !tapete;
    const temDependentes = this.regras.some(r => r.junto?.de === regra.id);
    for (const c of this.candidatos(regra, w, h)) {
      const base = novoObjeto(c.pos, { rotation: c.rot, source: { kind: 'recipe', recipe: receita, seed: 1, params } }), caixa = caixaDoObjeto(base);
      if (!retanguloLivre(this.malha, caixa, tapete ? [this.malha.porta] : [this.malha.porta, this.circ.faixa])) continue;
      if (bloqueia) {
        const margem = regra.lugar === 'junto' ? FOLGA_JUNTO : regra.lugar === 'centro' ? (temDependentes ? 1.0 : 0.3) : FOLGA;
        if (this.bloqueantes.some(b => intersecta(caixa, b, regra.lugar === 'junto' ? 0 : margem))) continue;
        if (regra.alto && this.naFrenteDeJanela(caixa)) continue;
      }
      const obj = novoObjeto(c.pos, {
        id: this.gerarId('o'), source: { kind: 'recipe', recipe: receita, seed: Math.floor(this.rng() * 2 ** 31), params }, rotation: c.rot, roomId: this.ins.id,
        blocks: { move: bloqueia, sight: false }, castsShadow: bloqueia,
      });
      if (bloqueia) this.bloqueantes.push(caixa);
      return obj;
    }
    return null;
  }

  /** O móvel alto não fica na frente de uma janela. */
  private naFrenteDeJanela(caixa: Caixa): boolean {
    return this.ins.janelas.some(j => {
      const meio = j.largura / 2 + 0.1, [nx, ny] = j.normal, c = j.centro;
      // A zona da janela: ao longo da parede (meio de cada lado) e 0,7 m para dentro.
      const pts: Ponto[] = [[c[0] - ny * meio, c[1] + nx * meio], [c[0] + ny * meio, c[1] - nx * meio], [c[0] - ny * meio + nx * 0.7, c[1] + nx * meio + ny * 0.7], [c[0] + ny * meio + nx * 0.7, c[1] - nx * meio + ny * 0.7]];
      const zona = { x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1])) };
      return intersecta(caixa, zona, 0);
    });
  }

  private candidatos(regra: ItemDeRegra, w: number, h: number): Candidato[] {
    const lista = regra.lugar === 'parede' || regra.lugar === 'canto' ? this.deParede(w, h, regra.lugar === 'canto')
      : regra.lugar === 'centro' ? this.deCentro() : this.deJunto(regra, w, h);
    return lista.sort((a, b) => b.nota - a.nota);
  }

  private distanciaDaPorta = (p: Ponto): number => (this.ins.portas.length ? Math.min(...this.ins.portas.map(d => distancia(p, d.centro))) : 3);

  private deParede(w: number, h: number, soCanto: boolean): Candidato[] {
    const saida: Candidato[] = [], recuo = w / 2 + ESP / 2;
    for (const s of this.segmentos) {
      if (s.comprimento < w + ESP) continue;
      const rot = rotacaoDeParede(s.n);
      for (let d = recuo; d <= s.comprimento - recuo + 1e-9; d += PASSO) {
        if (soCanto && d - recuo > 0.3 && s.comprimento - recuo - d > 0.3) continue;
        const pos: Ponto = [s.a[0] + s.t[0] * d + s.n[0] * (h / 2 + ESP / 2), s.a[1] + s.t[1] * d + s.n[1] * (h / 2 + ESP / 2)];
        saida.push({ pos, rot, nota: this.distanciaDaPorta(pos) + this.rng() * 1.5 });
      }
    }
    return saida;
  }

  private deCentro(): Candidato[] {
    const saida: Candidato[] = [], { x0, y0, x1, y1 } = this.ins.caixa, rot = x1 - x0 >= y1 - y0 ? 0 : Math.PI / 2;
    for (let y = y0 + PASSO; y < y1; y += PASSO) for (let x = x0 + PASSO; x < x1; x += PASSO) saida.push({ pos: [x, y], rot, nota: -distancia([x, y], this.centroide) + this.rng() * 0.3 });
    return saida;
  }

  private deJunto(regra: ItemDeRegra, w: number, h: number): Candidato[] {
    const j = regra.junto; if (!j) return [];
    const ancoras = this.ancorasDe(j.de), porAncora: Candidato[][] = [];
    for (const a of ancoras) {
      const ex: Ponto = [Math.cos(a.rot), Math.sin(a.rot)], ey: Ponto = [-Math.sin(a.rot), Math.cos(a.rot)], lista: Candidato[] = [];
      const soma = (c: Ponto, v: Ponto, k: number): Ponto => [c[0] + v[0] * k, c[1] + v[1] * k];
      if (j.modo === 'ao-redor') {
        const lados: [Ponto, number, number][] = [[ey, a.h / 2, a.w], [[-ey[0], -ey[1]], a.h / 2, a.w], [ex, a.w / 2, a.h], [[-ex[0], -ex[1]], a.w / 2, a.h]];
        for (const [d, meio, extensao] of lados) {
          const lateral: Ponto = d === ex || (d[0] === -ex[0] && d[1] === -ex[1]) ? ey : ex, base = soma(a.pos, d, meio + h / 2 + 0.05), rot = rotacaoVoltadaPara(d);
          lista.push({ pos: base, rot, nota: 0 });
          if (extensao >= 1.4) for (const k of [-1, 1]) lista.push({ pos: soma(base, lateral, k * extensao / 4), rot, nota: 0 });
        }
      } else if (j.modo === 'ao-lado') {
        for (const k of [1, -1]) lista.push({ pos: soma(soma(a.pos, ex, k * (a.w / 2 + w / 2 + 0.04)), ey, -(a.h / 2 - h / 2)), rot: a.rot, nota: 0 });
      } else {
        lista.push({ pos: soma(a.pos, ey, a.h / 2 + (j.folga ?? 1.2) + h / 2), rot: rotacaoVoltadaPara(ey), nota: 0 });
      }
      porAncora.push(lista);
    }
    // Uma volta por âncora de cada vez: as cadeiras se espalham pelas mesas em vez de lotar a primeira.
    const saida: Candidato[] = [];
    for (let r = 0; porAncora.some(l => r < l.length); r++) for (const l of porAncora) if (l[r]) saida.push({ ...l[r]!, nota: 1000 - r * 10 - saida.length * 0.01 });
    return saida;
  }

  private colocarNaParede(receita: string, params: Record<string, unknown>, largura: number): Objeto | null {
    const lacos: { wallId: string; dist: number; ponto: Ponto; at: number; roomId: string; nota: number }[] = [];
    for (const s of this.segmentos) for (let d = largura / 2 + 0.1; d <= s.comprimento - largura / 2 - 0.1 + 1e-9; d += PASSO) {
      const sonda: Ponto = [s.a[0] + s.t[0] * d + s.n[0] * 0.25, s.a[1] + s.t[1] * d + s.n[1] * 0.25], e = encaixarObjetoDeParede(this.m, sonda, largura);
      if (!e || e.roomId !== this.ins.id) continue;
      lacos.push({ wallId: e.parede.id, dist: e.at, ponto: e.ponto, at: e.at, roomId: e.roomId, nota: this.distanciaDaPorta(e.ponto) + this.rng() * 1.5 });
    }
    lacos.sort((a, b) => b.nota - a.nota);
    for (const c of lacos) {
      const parede = this.m.walls[c.wallId]!, total = Math.hypot(...[0, 1].map(i => parede.path.at(-1)![i]! - parede.path[0]![i]!)), centro = c.at * total;
      // Longe de portas e janelas, e de outros objetos de parede (existentes ou novos), 0,2 m pelo menos.
      const livreDeAberturas = Object.values(this.m.openings).every(a => a.wallId !== c.wallId || Math.abs(centroDaAbertura(parede, a) - centro) >= largura / 2 + a.width / 2 + 0.2);
      if (!livreDeAberturas) continue;
      const outros = [...this.existentes, ...this.novos].filter(o => o.elevation === 'wall' && o.wall?.wallId === c.wallId);
      if (outros.some(o => Math.abs(o.wall!.at * total - centro) < ((o.source.kind === 'recipe' ? pegadaDaReceita(o.source.recipe, o.source.params)[0] : 0.8) + largura) / 2 + 0.2)) continue;
      return novoObjeto(c.ponto, {
        id: this.gerarId('o'), source: { kind: 'recipe', recipe: receita, seed: Math.floor(this.rng() * 2 ** 31), params }, elevation: 'wall', wall: { wallId: c.wallId, at: c.at, face: 'inner' },
        roomId: this.ins.id, blocks: { move: false, sight: false }, castsShadow: false, rotation: 0,
      });
    }
    return null;
  }
}
