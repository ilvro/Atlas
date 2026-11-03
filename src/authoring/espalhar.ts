import { PAREDE_PADRAO, comodoEm, contornoDoComodo, indiceDeCelulas } from '../domain/geometria.ts';
import { decodificar } from '../domain/celulas.ts';
import { novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import type { MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { mulberry32 } from '../procedural/ruido.ts';
import { pegadaDaReceita, receitaDe } from '../procedural/receitas.ts';
import { caixaDoObjeto, insightDoComodo, type Caixa } from './insight.ts';
import { circulacao, malhaDoComodo, retanguloLivre, type Circulacao, type Malha } from './malha.ts';
import { rotacaoDeParede } from './layout.ts';

export interface ItemDeConjunto { receita: string; peso: number; contexto: 'parede' | 'mesa' | 'livre' }
export interface ConjuntoDeEspalhar {
  id: string; nome: string; descricao: string; itens: ItemDeConjunto[];
  /** Itens por m² no centro do pincel. */
  densidade: number;
}

export const CONJUNTOS_DE_ESPALHAR: readonly ConjuntoDeEspalhar[] = [
  { id: 'papelada', nome: 'Papelada', descricao: 'Papéis e livros soltos sobre as mesas', densidade: 1.2, itens: [{ receita: 'papeis', peso: 3, contexto: 'mesa' }, { receita: 'livros.pilha', peso: 2, contexto: 'mesa' }] },
  { id: 'caixotes', nome: 'Caixotes', descricao: 'Caixotes empilhados junto das paredes', densidade: 0.5, itens: [{ receita: 'caixa', peso: 1, contexto: 'parede' }] },
  { id: 'plantas', nome: 'Plantas', descricao: 'Vasos junto das paredes e soltos', densidade: 0.4, itens: [{ receita: 'vaso.planta', peso: 2, contexto: 'parede' }, { receita: 'vaso.planta', peso: 1, contexto: 'livre' }] },
];
export const conjuntoDeEspalhar = (id: string): ConjuntoDeEspalhar | undefined => CONJUNTOS_DE_ESPALHAR.find(c => c.id === id);

export interface PedidoDeEspalhar { centro: Ponto; raio: number; conjunto: string; semente: number; gerarId?: (prefixo: string) => string }

const ESP = PAREDE_PADRAO.thickness, DISTANCIA_DA_PAREDE = 0.6, DISTANCIA_DA_MESA = 0.8;
const distancia = (a: Ponto, b: Ponto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dentroDa = (c: Caixa, p: Ponto, folga = 0) => p[0] >= c.x0 - folga && p[0] <= c.x1 + folga && p[1] >= c.y0 - folga && p[1] <= c.y1 + folga;
const intersecta = (a: Caixa, b: Caixa, margem: number) => a.x0 < b.x1 + margem && a.x1 > b.x0 - margem && a.y0 < b.y1 + margem && a.y1 > b.y0 - margem;
const aprox90 = (r: number, jitter: number) => Math.round(r / (Math.PI / 2)) * (Math.PI / 2) + jitter;

interface Segmento { a: Ponto; n: Ponto; t: Ponto; comprimento: number; roomId: string }
interface Sala { malha: Malha; circ: Circulacao }

/**
 * Espalha pequenos objetos num círculo, de forma natural e conforme o contexto de cada item: papelada sobre as mesas, caixotes de costas para a parede,
 * vasos soltos ou encostados. Dentro de um cômodo nunca cai na frente de uma porta, sobre a passagem entre as portas nem sobre móvel que bloqueia.
 * Conta o que já existe no círculo: pincelar de novo no mesmo ponto não dobra a quantidade. Mesma semente, mesmo resultado.
 */
export function espalhar(m: MapaAtlas, o: PedidoDeEspalhar): Objeto[] {
  const conjunto = conjuntoDeEspalhar(o.conjunto); if (!conjunto || !(o.raio > 0)) return [];
  const rng = mulberry32(Math.imul(Math.floor(o.semente * 1000) | 0, 2654435761) ^ Math.floor(o.centro[0] * 37 + o.centro[1] * 91)), gerarId = o.gerarId ?? novoIdEntidade;
  const receitas = new Set(conjunto.itens.map(i => i.receita));
  const maior = Math.max(...conjunto.itens.map(i => Math.max(...pegadaDaReceita(i.receita))));
  const minima = 0.9 * maior;
  const existentes = Object.values(m.props).filter(p => p.source.kind === 'recipe' && receitas.has(p.source.recipe) && distancia(p.position, o.centro) <= o.raio + minima);
  const noCirculo = existentes.filter(p => distancia(p.position, o.centro) <= o.raio).length;
  const alvo = Math.max(0, Math.round(conjunto.densidade * Math.PI * o.raio * o.raio) - noCirculo);
  if (!alvo) return [];

  const indice = indiceDeCelulas(m), salas = new Map<string, Sala>();
  const salaDe = (id: string): Sala | null => {
    let s = salas.get(id); if (s) return s;
    const ins = insightDoComodo(m, id); if (!ins) return null;
    const malha = malhaDoComodo(m, ins); s = { malha, circ: circulacao(malha, ins) }; salas.set(id, s); return s;
  };
  // O que cabe em volta: segmentos de parede de cada cômodo e as mesas (de piso) do mapa.
  const segmentos: Segmento[] = [];
  for (const sala of Object.values(m.rooms)) for (const laco of contornoDoComodo(m, decodificar(sala.cells))) for (const s of laco) {
    const comprimento = distancia(s.a, s.b); if (comprimento > 0) segmentos.push({ a: s.a, n: s.n, t: [(s.b[0] - s.a[0]) / comprimento, (s.b[1] - s.a[1]) / comprimento], comprimento, roomId: sala.id });
  }
  const mesas = Object.values(m.props).filter(p => p.elevation === 'floor' && p.source.kind === 'recipe' && receitaDe(p.source.recipe)?.categoria === 'mesas').map(p => ({ obj: p, caixa: caixaDoObjeto(p) }));
  const bloqueantes: Caixa[] = Object.values(m.props).filter(p => p.elevation === 'floor' && p.blocks.move).map(caixaDoObjeto);
  const colocados: Ponto[] = existentes.map(p => p.position), novos: Objeto[] = [];

  const sorteio = (): ItemDeConjunto => { let r = rng() * conjunto.itens.reduce((s, i) => s + i.peso, 0); for (const i of conjunto.itens) { r -= i.peso; if (r <= 0) return i; } return conjunto.itens.at(-1)!; };
  const noDisco = (): Ponto => { const a = rng() * Math.PI * 2, d = o.raio * Math.sqrt(rng()); return [o.centro[0] + Math.cos(a) * d, o.centro[1] + Math.sin(a) * d]; };
  // A densidade cai para a borda do pincel.
  const aceitaPelaBorda = (p: Ponto) => rng() < 1 - 0.8 * (distancia(p, o.centro) / o.raio) ** 2;

  for (let tentativas = 0; novos.length < alvo && tentativas < alvo * 40; tentativas++) {
    const item = sorteio(), [w, h] = pegadaDaReceita(item.receita);
    let pos: Ponto | null = null, rot = rng() * Math.PI * 2, elevation: Objeto['elevation'] = 'floor', no: string | null = null;
    if (item.contexto === 'livre') {
      pos = noDisco(); if (!aceitaPelaBorda(pos)) continue;
    } else if (item.contexto === 'parede') {
      const noRaio = segmentos.filter(s => distancia([s.a[0] + s.t[0] * s.comprimento / 2, s.a[1] + s.t[1] * s.comprimento / 2], o.centro) <= o.raio + s.comprimento / 2 + DISTANCIA_DA_PAREDE);
      if (!noRaio.length) continue;
      const s = noRaio[Math.floor(rng() * noRaio.length)]!, d = rng() * (s.comprimento - w) + w / 2, base: Ponto = [s.a[0] + s.t[0] * d, s.a[1] + s.t[1] * d];
      if (s.comprimento < w + ESP || distancia(base, o.centro) > o.raio + 0.3 || !aceitaPelaBorda(base)) continue;
      pos = [base[0] + s.n[0] * (h / 2 + ESP / 2), base[1] + s.n[1] * (h / 2 + ESP / 2)];
      rot = receitaDe(item.receita)?.categoria === 'decoracao' && item.receita === 'caixa' ? aprox90(rotacaoDeParede(s.n), (rng() - 0.5) * 0.3) : rotacaoDeParede(s.n) + (rng() - 0.5) * 0.3;
      no = s.roomId;
    } else {
      // Sobre a mesa; se não há mesa no pincel, no chão até 0,8 m de uma.
      const perto = mesas.filter(t => intersecta(t.caixa, { x0: o.centro[0] - o.raio, y0: o.centro[1] - o.raio, x1: o.centro[0] + o.raio, y1: o.centro[1] + o.raio }, 0));
      if (perto.length) {
        const t = perto[Math.floor(rng() * perto.length)]!, c = t.caixa, p: Ponto = [c.x0 + 0.1 + rng() * (c.x1 - c.x0 - 0.2), c.y0 + 0.1 + rng() * (c.y1 - c.y0 - 0.2)];
        if (distancia(p, o.centro) > o.raio || !aceitaPelaBorda(p)) continue;
        pos = p; elevation = 'table';
      } else {
        const proximas = mesas.filter(t => dentroDa(t.caixa, o.centro, o.raio + DISTANCIA_DA_MESA)); if (!proximas.length) break;
        const p = noDisco(); if (!aceitaPelaBorda(p)) continue;
        const t = proximas.find(x => dentroDa(x.caixa, p, DISTANCIA_DA_MESA) && !dentroDa(x.caixa, p, 0.05)); if (!t) continue;
        pos = p;
      }
    }
    if (!pos) continue;
    // Espaçamento entre os itens (os que já existiam contam).
    if (elevation === 'floor' && colocados.some(q => distancia(q, pos!) < minima)) continue;
    if (elevation === 'table' && colocados.some(q => distancia(q, pos!) < minima * 0.7)) continue;
    const base = novoObjeto(pos, { rotation: rot, source: { kind: 'recipe', recipe: item.receita, seed: 1, params: {} } }), caixa = caixaDoObjeto(base);
    const sala = no ?? comodoEm(m, pos, indice);
    if (elevation === 'floor') {
      if (item.contexto !== 'mesa' && bloqueantes.some(b => intersecta(caixa, b, 0.03))) continue;
      if (sala) {
        // Dentro de um cômodo: fora da área das portas e da passagem, e dentro dele.
        const s = salaDe(sala); if (!s || !retanguloLivre(s.malha, caixa, [s.malha.porta, s.circ.faixa])) continue;
      } else if (item.contexto !== 'livre') continue;                      // fora de cômodos, só "livre"
    }
    const blocks = item.receita === 'caixa' || item.receita === 'vaso.planta';
    novos.push(novoObjeto(pos, {
      id: gerarId('o'), source: { kind: 'recipe', recipe: item.receita, seed: Math.floor(rng() * 2 ** 31), params: {} }, rotation: rot, elevation, roomId: sala ?? comodoEm(m, pos, indice),
      blocks: { move: blocks && elevation === 'floor', sight: false }, castsShadow: elevation === 'floor' && blocks,
    }));
    colocados.push(pos);
    if (elevation === 'floor' && blocks) bloqueantes.push(caixa);
  }
  return novos;
}
