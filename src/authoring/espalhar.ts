import { PAREDE_PADRAO, comodoEm, contornoDoComodo, indiceDeCelulas } from '../domain/geometria.ts';
import { ehArvore } from '../domain/camadas.ts';
import { decodificar } from '../domain/celulas.ts';
import { novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import type { MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { mulberry32 } from '../procedural/ruido.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { caixaDoObjeto, insightDoComodo, type Caixa } from './insight.ts';
import { circulacao, malhaDoComodo, retanguloLivre, type Circulacao, type Malha } from './malha.ts';
import { rotacaoDeParede } from './layout.ts';

/** `sob-arvore`: dentro da copa de uma árvore do mapa (objeto com a tag `arvore`), as que já existem e as que este mesmo pincel põe. */
export interface ItemDeConjunto { receita: string; peso: number; contexto: 'parede' | 'mesa' | 'livre' | 'sob-arvore' }
export interface ConjuntoDeEspalhar {
  id: string; nome: string; descricao: string; itens: ItemDeConjunto[];
  /** Itens por m² no centro do pincel. */
  densidade: number;
  /** Põe os itens em fileiras: posições encaixadas nesta grade (m), com um leve tremor (cemitério). */
  grade?: [number, number];
}

export const CONJUNTOS_DE_ESPALHAR: readonly ConjuntoDeEspalhar[] = [
  { id: 'papelada', nome: 'Papelada', descricao: 'Papéis e livros soltos sobre as mesas', densidade: 1.2, itens: [{ receita: 'papeis', peso: 3, contexto: 'mesa' }, { receita: 'livros.pilha', peso: 2, contexto: 'mesa' }] },
  { id: 'caixotes', nome: 'Caixotes', descricao: 'Caixotes empilhados junto das paredes', densidade: 0.5, itens: [{ receita: 'caixa', peso: 1, contexto: 'parede' }] },
  { id: 'bibelos', nome: 'Bibelôs', descricao: 'Castiçais, flores, relógios e livros sobre as mesas', densidade: 1.0, itens: [{ receita: 'castical.mesa', peso: 2, contexto: 'mesa' }, { receita: 'vaso.flores', peso: 2, contexto: 'mesa' }, { receita: 'relogio.mesa', peso: 1, contexto: 'mesa' }, { receita: 'livro.aberto', peso: 2, contexto: 'mesa' }, { receita: 'abajur.mesa', peso: 1, contexto: 'mesa' }, { receita: 'bule.xicaras', peso: 1, contexto: 'mesa' }] },
  { id: 'refeicao', nome: 'Mesa posta', descricao: 'Pratos, taças, frutas e velas sobre as mesas', densidade: 1.1, itens: [{ receita: 'pratos.servico', peso: 3, contexto: 'mesa' }, { receita: 'garrafa.tacas', peso: 2, contexto: 'mesa' }, { receita: 'fruteira', peso: 1, contexto: 'mesa' }, { receita: 'candelabro', peso: 1, contexto: 'mesa' }, { receita: 'castical.mesa', peso: 1, contexto: 'mesa' }] },
  { id: 'bagunca', nome: 'Bagunça', descricao: 'Jornais, sapatos, cestos, papéis e livros pelo chão', densidade: 0.45, itens: [{ receita: 'jornais', peso: 2, contexto: 'livre' }, { receita: 'sapatos', peso: 2, contexto: 'livre' }, { receita: 'cesto.roupa', peso: 1, contexto: 'livre' }, { receita: 'papeis', peso: 2, contexto: 'livre' }, { receita: 'livros.pilha', peso: 2, contexto: 'livre' }] },
  { id: 'plantas', nome: 'Plantas', descricao: 'Vasos junto das paredes e soltos', densidade: 0.4, itens: [{ receita: 'vaso.planta', peso: 2, contexto: 'parede' }, { receita: 'vaso.planta', peso: 1, contexto: 'livre' }] },
];
export const CONJUNTOS_EXTERIORES: readonly ConjuntoDeEspalhar[] = [
  { id: 'mata', nome: 'Mata', descricao: 'Árvores e arbustos, com pedras e tocos sob a copa', densidade: 0.1, itens: [
    { receita: 'casa:arvore-3m', peso: 2, contexto: 'livre' }, { receita: 'casa:arvore-5m', peso: 3, contexto: 'livre' }, { receita: 'casa:arvore-7m', peso: 1, contexto: 'livre' }, { receita: 'casa:pinheiro-3m', peso: 2, contexto: 'livre' }, { receita: 'casa:pinheiro-4m', peso: 1, contexto: 'livre' },
    { receita: 'casa:arbusto-verde', peso: 2, contexto: 'livre' }, { receita: 'casa:arbusto-grande', peso: 1, contexto: 'livre' },
    { receita: 'pedra.pequena', peso: 2, contexto: 'sob-arvore' }, { receita: 'pedra.media', peso: 1, contexto: 'sob-arvore' }, { receita: 'toco', peso: 1, contexto: 'sob-arvore' }, { receita: 'tronco.caido', peso: 1, contexto: 'sob-arvore' }] },
  { id: 'jardim', nome: 'Jardim', descricao: 'Canteiros, arbustos, vasos e um banco', densidade: 0.18, itens: [
    { receita: 'canteiro', peso: 3, contexto: 'livre' }, { receita: 'casa:arbusto-verde', peso: 2, contexto: 'livre' }, { receita: 'casa:arbusto-florido', peso: 2, contexto: 'livre' }, { receita: 'vaso.planta', peso: 1, contexto: 'livre' }, { receita: 'banco.jardim', peso: 1, contexto: 'livre' }, { receita: 'pedra.pequena', peso: 1, contexto: 'livre' }] },
  { id: 'cemiterio', nome: 'Cemitério', descricao: 'Lápides em fileiras, com árvores esparsas', densidade: 0.12, grade: [1.3, 1.9], itens: [
    { receita: 'lapide', peso: 10, contexto: 'livre' }, { receita: 'casa:pinheiro-3m', peso: 1, contexto: 'livre' }, { receita: 'casa:arvore-3m', peso: 1, contexto: 'livre' }] },
];
export const TODOS_OS_CONJUNTOS: readonly ConjuntoDeEspalhar[] = [...CONJUNTOS_DE_ESPALHAR, ...CONJUNTOS_EXTERIORES];
export const conjuntoDeEspalhar = (id: string): ConjuntoDeEspalhar | undefined => TODOS_OS_CONJUNTOS.find(c => c.id === id);

export interface PedidoDeEspalhar { centro: Ponto; raio: number; conjunto: string; semente: number; gerarId?: (prefixo: string) => string; /** Itens por m² no centro; ausente, vale a do conjunto (usado pelos scripts de exemplo). */ densidade?: number }

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
  const lado = (id: string, escala = 1) => Math.max(...ACERVO.pegadaDaFonte(ACERVO.fonte(id, 1))) * escala, maior = Math.max(...conjunto.itens.map(i => lado(i.receita)));
  const existentes = Object.values(m.props).filter(p => receitas.has(ACERVO.idDaFonte(p.source)) && distancia(p.position, o.centro) <= o.raio + maior);
  const noCirculo = existentes.filter(p => distancia(p.position, o.centro) <= o.raio).length;
  const alvo = Math.max(0, Math.round((o.densidade ?? conjunto.densidade) * Math.PI * o.raio * o.raio) - noCirculo);
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
  const mesas = Object.values(m.props).filter(p => p.elevation === 'floor' && ACERVO.item(ACERVO.idDaFonte(p.source))?.categoria === 'mesas').map(p => ({ obj: p, caixa: caixaDoObjeto(p) }));
  const bloqueantes: Caixa[] = Object.values(m.props).filter(p => p.elevation === 'floor' && p.blocks.move).map(caixaDoObjeto);
  const colocados: { pos: Ponto; lado: number; arvore: boolean }[] = existentes.map(p => ({ pos: p.position, lado: lado(ACERVO.idDaFonte(p.source), p.scale), arvore: ehArvore(ACERVO.idDaFonte(p.source)) })), novos: Objeto[] = [];
  // As árvores do mapa (todas, não só as do círculo: a copa pode entrar nele) e as portas para fora, com o lado de fora de cada uma.
  const arvores = Object.values(m.props).filter(p => ehArvore(ACERVO.idDaFonte(p.source))).map(p => ({ pos: p.position, raio: ACERVO.pegadaDaFonte(p.source)[0] * p.scale / 2 }));
  const portasExternas: { c: Ponto; fora: Ponto }[] = [];
  for (const sala of Object.values(m.rooms)) for (const pt of insightDoComodo(m, sala.id)?.portas ?? []) if (pt.outro === null) portasExternas.push({ c: pt.centro, fora: [-pt.normal[0], -pt.normal[1]] });
  const naFrenteDePortaExterna = (p: Ponto, raio: number) => portasExternas.some(d => distancia(p, d.c) < 1.5 + raio && (p[0] - d.c[0]) * d.fora[0] + (p[1] - d.c[1]) * d.fora[1] >= -0.2);

  const sorteio = (): ItemDeConjunto => { let r = rng() * conjunto.itens.reduce((s, i) => s + i.peso, 0); for (const i of conjunto.itens) { r -= i.peso; if (r <= 0) return i; } return conjunto.itens.at(-1)!; };
  const noDisco = (): Ponto => { const a = rng() * Math.PI * 2, d = o.raio * Math.sqrt(rng()); return [o.centro[0] + Math.cos(a) * d, o.centro[1] + Math.sin(a) * d]; };
  // A densidade cai para a borda do pincel.
  const aceitaPelaBorda = (p: Ponto) => rng() < 1 - 0.8 * (distancia(p, o.centro) / o.raio) ** 2;

  for (let tentativas = 0; novos.length < alvo && tentativas < alvo * 40; tentativas++) {
    const item = sorteio(), [w, h] = ACERVO.pegadaDaFonte(ACERVO.fonte(item.receita, 1));
    let pos: Ponto | null = null, rot = rng() * Math.PI * 2, elevation: Objeto['elevation'] = 'floor', no: string | null = null;
    if (item.contexto === 'livre') {
      pos = noDisco(); if (!aceitaPelaBorda(pos)) continue;
      if (conjunto.grade) {
        // Em fileiras: encaixa na grade do conjunto (a partir do centro do pincel), com um leve tremor, todos voltados para o mesmo lado.
        const [gx, gy] = conjunto.grade;
        pos = [o.centro[0] + Math.round((pos[0] - o.centro[0]) / gx) * gx + (rng() - 0.5) * 0.16, o.centro[1] + Math.round((pos[1] - o.centro[1]) / gy) * gy + (rng() - 0.5) * 0.16];
        if (distancia(pos, o.centro) > o.raio) continue;
        rot = (rng() - 0.5) * 0.12;
      }
    } else if (item.contexto === 'sob-arvore') {
      // Dentro da copa de uma árvore que já existe ou que este pincel acabou de pôr.
      const todas = [...arvores, ...novos.filter(n => ehArvore(ACERVO.idDaFonte(n.source))).map(n => ({ pos: n.position, raio: ACERVO.pegadaDaFonte(n.source)[0] * n.scale / 2 }))].filter(t => distancia(t.pos, o.centro) <= o.raio + t.raio);
      if (!todas.length) continue;
      const t = todas[Math.floor(rng() * todas.length)]!, a = rng() * Math.PI * 2, d = t.raio * (0.25 + 0.7 * Math.sqrt(rng()));
      pos = [t.pos[0] + Math.cos(a) * d, t.pos[1] + Math.sin(a) * d];
    } else if (item.contexto === 'parede') {
      const noRaio = segmentos.filter(s => distancia([s.a[0] + s.t[0] * s.comprimento / 2, s.a[1] + s.t[1] * s.comprimento / 2], o.centro) <= o.raio + s.comprimento / 2 + DISTANCIA_DA_PAREDE);
      if (!noRaio.length) continue;
      const s = noRaio[Math.floor(rng() * noRaio.length)]!, d = rng() * (s.comprimento - w) + w / 2, base: Ponto = [s.a[0] + s.t[0] * d, s.a[1] + s.t[1] * d];
      if (s.comprimento < w + ESP || distancia(base, o.centro) > o.raio + 0.3 || !aceitaPelaBorda(base)) continue;
      pos = [base[0] + s.n[0] * (h / 2 + ESP / 2), base[1] + s.n[1] * (h / 2 + ESP / 2)];
      rot = item.receita === 'caixa' ? aprox90(rotacaoDeParede(s.n), (rng() - 0.5) * 0.3) : rotacaoDeParede(s.n) + (rng() - 0.5) * 0.3;
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
    if (!pos || pos[0] < 0 || pos[1] < 0 || pos[0] > m.bounds.width || pos[1] > m.bounds.height) continue;
    // Espaçamento entre os itens (os que já existiam contam): 0,9 do maior lado; entre árvores a copa pode se encostar; sob uma árvore, a copa não conta.
    const meu = Math.max(w, h), ehMinhaArvore = ehArvore(item.receita);
    const apertado = colocados.some(q => {
      if (item.contexto === 'sob-arvore' && q.arvore) return false;
      const fator = ehMinhaArvore && q.arvore ? 0.3 : elevation === 'table' ? 0.32 : 0.45;
      return distancia(q.pos, pos!) < fator * (meu + q.lado);
    });
    if (apertado) continue;
    const base = novoObjeto(pos, { rotation: rot, source: ACERVO.fonte(item.receita, 1) }), caixa = caixaDoObjeto(base);
    const sala = no ?? comodoEm(m, pos, indice);
    if (elevation === 'floor') {
      if (item.contexto !== 'mesa' && bloqueantes.some(b => intersecta(caixa, b, 0.03))) continue;
      if (sala) {
        // Dentro de um cômodo: fora da área das portas e da passagem, e dentro dele.
        const s = salaDe(sala); if (!s || !retanguloLivre(s.malha, caixa, [s.malha.porta, s.circ.faixa])) continue;
      } else if (item.contexto !== 'livre' && item.contexto !== 'sob-arvore') continue;     // fora de cômodos, só "livre" e sob árvore
      if (!sala && naFrenteDePortaExterna(pos, Math.max(w, h) / 2)) continue;              // a frente de uma porta para fora fica livre (semicírculo de 1,5 m)
    }
    const blocks = ['caixa', 'vaso.planta', 'pedra.media', 'poco', 'banco.jardim'].includes(item.receita);
    novos.push(novoObjeto(pos, {
      id: gerarId('o'), source: ACERVO.fonte(item.receita, Math.floor(rng() * 2 ** 31)), rotation: rot, elevation, roomId: sala ?? comodoEm(m, pos, indice),
      blocks: { move: blocks && elevation === 'floor', sight: false }, castsShadow: elevation === 'floor' && blocks,
    }));
    colocados.push({ pos, lado: Math.max(w, h), arvore: ehMinhaArvore });
    if (elevation === 'floor' && blocks) bloqueantes.push(caixa);
  }
  return novos;
}
