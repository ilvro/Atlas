import { arestasCobertas, arestasDeParede, comprimentoDaParede, motivoDeNaoCaber, projetarNaParede, segmentoDaAresta, type ArestaUnitaria } from '../domain/geometria.ts';
import { novoIdEntidade } from '../domain/fabrica.ts';
import type { Abertura, MapaAtlas, Parede, Ponto } from '../domain/mapa.ts';
import { caixaDoObjeto, insightDoComodo, type Caixa } from './insight.ts';
import { novaProposta, type Proposta } from './proposta.ts';
import type { Contexto } from './sugestoes.ts';

const LARGURA = 0.9, FRENTE = 0.9;

interface Plano { texto: string; rotulo: string; abertura: Abertura }

/** Onde uma porta cabe numa parede: o centro (em metros do início), já escolhido do meio de um trecho de arestas. */
interface Posicao { parede: Parede; dist: number; ponto: Ponto }

/** As posições possíveis ao longo das arestas dadas (centros de célula), das mais ao meio do trecho para as pontas. */
function posicoes(m: MapaAtlas, arestas: ArestaUnitaria[]): Posicao[] {
  const chaves = new Set(arestas.map(a => a.chave)), saida: Posicao[] = [];
  const paredes = Object.values(m.walls).filter(p => arestasCobertas(m, p).some(k => chaves.has(k)));
  const meios: Ponto[] = arestas.map(a => { const [p, q] = segmentoDaAresta(m, a); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
  const cx = meios.reduce((s, p) => s + p[0], 0) / (meios.length || 1), cy = meios.reduce((s, p) => s + p[1], 0) / (meios.length || 1);
  for (const parede of paredes) {
    const cobertas = new Set(arestasCobertas(m, parede));
    for (const a of arestas) {
      if (!cobertas.has(a.chave)) continue;
      const [p, q] = segmentoDaAresta(m, a), meio: Ponto = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], proj = projetarNaParede(parede, meio);
      if (proj.distancia > 1e-6) continue;
      saida.push({ parede, dist: proj.dist, ponto: meio });
    }
  }
  return saida.sort((a, b) => Math.hypot(a.ponto[0] - cx, a.ponto[1] - cy) - Math.hypot(b.ponto[0] - cx, b.ponto[1] - cy));
}

/** Há móvel que bloqueia na frente da porta (nos dois lados) ou o passo dela fica tampado? */
function frenteLivre(m: MapaAtlas, pos: Posicao, salas: string[]): boolean {
  const horizontal = pos.parede.path.every(p => Math.abs(p[1] - pos.parede.path[0]![1]) < 1e-6), meio = LARGURA / 2 + 0.1;
  const zona: Caixa = horizontal ? { x0: pos.ponto[0] - meio, x1: pos.ponto[0] + meio, y0: pos.ponto[1] - FRENTE, y1: pos.ponto[1] + FRENTE } : { x0: pos.ponto[0] - FRENTE, x1: pos.ponto[0] + FRENTE, y0: pos.ponto[1] - meio, y1: pos.ponto[1] + meio };
  return !Object.values(m.props).some(o => o.roomId !== null && salas.includes(o.roomId) && o.elevation === 'floor' && o.blocks.move
    && ((c: Caixa) => c.x0 < zona.x1 && c.x1 > zona.x0 && c.y0 < zona.y1 && c.y1 > zona.y0)(caixaDoObjeto(o)));
}

/** Para onde a porta abre: para dentro do cômodo dado (o lado em que o centro dele está em relação à parede). */
function aberturaPara(m: MapaAtlas, pos: Posicao, abreParaRoomId: string, id: string): Abertura {
  const ins = insightDoComodo(m, abreParaRoomId), centro: Ponto = ins ? [(ins.caixa.x0 + ins.caixa.x1) / 2, (ins.caixa.y0 + ins.caixa.y1) / 2] : pos.ponto;
  const lado = projetarNaParede(pos.parede, centro).lado, total = comprimentoDaParede(pos.parede);
  return { id, wallId: pos.parede.id, at: Math.round((pos.dist / total) * 1e6) / 1e6, width: LARGURA, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: lado === 1 ? 'a' : 'b' };
}

const PREFERENCIA: Record<string, number> = { corredor: 0, sala: 1 };
const ehCorredorOuSala = (funcao: string | null) => funcao === 'corredor' || funcao === 'sala';

/**
 * A porta que falta: para um cômodo que não se liga a nada, a porta para o vizinho (corredor, depois sala, depois quem tem mais parede em comum);
 * e, se a casa não tem porta para fora, a porta de entrada num corredor ou sala (ou no único cômodo). `semente` anda pelas posições e depois pelos vizinhos.
 */
interface Candidata { pos: Posicao; plano: Omit<Plano, 'abertura'>; abre: string; /** O outro lado da porta: o vizinho, ou null para a porta de entrada. */ alvo: string | null }

/** Todas as posições possíveis para a porta que falta neste cômodo, na ordem de preferência. `verificarFrente: false` ignora os móveis (para reservar o vão). */
function candidatas(c: Contexto, roomId: string, verificarFrente: boolean): Candidata[] {
  const m = c.m, ins = insightDoComodo(m, roomId), sala = m.rooms[roomId], saida: Candidata[] = []; if (!ins || !sala) return saida;
  const arestas = [...arestasDeParede(m).values()], livre = (pos: Posicao, salas: string[]) => !verificarFrente || frenteLivre(m, pos, salas);
  const semLigacao = ins.vizinhos.length > 0 && ins.vizinhos.every(v => !v.ligado);
  if (semLigacao) {
    const nota = (f: string | null) => (sala.function === 'cozinha' && f === 'sala' ? -1 : (PREFERENCIA[f ?? ''] ?? 9));
    const ordem = [...ins.vizinhos].sort((a, b) => nota(m.rooms[a.id]?.function ?? null) - nota(m.rooms[b.id]?.function ?? null) || b.comprimento - a.comprimento);
    for (const v of ordem) {
      const vizinho = m.rooms[v.id]!, compartilhadas = arestas.filter(a => a.salas.includes(roomId) && a.salas.includes(v.id));
      const maior = (insightDoComodo(m, v.id)?.area ?? 0) > ins.area ? v.id : roomId;
      for (const pos of posicoes(m, compartilhadas)) if (livre(pos, [roomId, v.id])) saida.push({ pos, abre: maior, alvo: v.id, plano: { texto: `Pôr uma porta para a ${vizinho.name}?`, rotulo: `Pôr porta: ${sala.name} e ${vizinho.name}` } });
    }
    return saida;
  }
  // Porta de entrada: a casa não tem nenhuma para fora.
  const temEntrada = Object.values(m.rooms).some(r => insightDoComodo(m, r.id)?.portas.some(p => p.outro === null));
  if (temEntrada || !(ehCorredorOuSala(sala.function) || Object.keys(m.rooms).length === 1)) return saida;
  const externas = arestas.filter(a => a.salas.includes(roomId) && a.salas.some(s => s === null));
  // A parede externa mais longa: a que cobre mais arestas externas deste cômodo.
  const porParede = new Map<string, ArestaUnitaria[]>();
  for (const p of Object.values(m.walls)) { const cobertas = new Set(arestasCobertas(m, p)), dela = externas.filter(a => cobertas.has(a.chave)); if (dela.length) porParede.set(p.id, dela); }
  const mais = [...porParede.values()].sort((a, b) => b.length - a.length)[0];
  if (mais) for (const pos of posicoes(m, mais)) if (livre(pos, [roomId])) saida.push({ pos, abre: roomId, alvo: null, plano: { texto: 'Pôr a porta de entrada?', rotulo: 'Pôr a porta de entrada' } });
  return saida;
}

function planejar(c: Contexto, roomId: string): Plano | null {
  const m = c.m, gerarId = c.gerarId ?? novoIdEntidade;
  const validas = candidatas(c, roomId, true).filter(x => motivoDeNaoCaber(m, aberturaPara(m, x.pos, x.abre, 'teste')) === null);
  if (!validas.length) return null;
  // `semente` anda pelas posições do primeiro vizinho e, no fim delas, segue para o próximo.
  const escolhida = validas[c.semente % validas.length]!;
  return { ...escolhida.plano, abertura: aberturaPara(m, escolhida.pos, escolhida.abre, gerarId('a')) };
}

/**
 * Os vãos onde a porta que falta ainda vai entrar (um por vizinho sem ligação, e a porta de entrada), para o gerador de mobília deixá-los livres:
 * mobiliar antes de pôr a porta não pode tampar a única parede por onde ela passaria.
 */
export function reservasDePorta(m: MapaAtlas, roomId: string): Caixa[] {
  const vistos = new Set<string>(), saida: Caixa[] = [], meio = LARGURA / 2 + 0.15, ins = insightDoComodo(m, roomId);
  const reservar = (x: Candidata) => {
    const chave = `${x.pos.parede.id}:${x.pos.dist}`; if (vistos.has(chave)) return; vistos.add(chave);
    const [px, py] = x.pos.ponto, horizontal = x.pos.parede.path.every(q => Math.abs(q[1] - x.pos.parede.path[0]![1]) < 1e-6);
    saida.push(horizontal ? { x0: px - meio, x1: px + meio, y0: py - FRENTE - 0.1, y1: py + FRENTE + 0.1 } : { x0: px - FRENTE - 0.1, x1: px + FRENTE + 0.1, y0: py - meio, y1: py + meio });
  };
  const primeirosPorAlvo = (lista: Candidata[]) => { const porAlvo = new Map<string, Candidata>(); for (const x of lista) if (!porAlvo.has(String(x.alvo))) porAlvo.set(String(x.alvo), x); return [...porAlvo.values()]; };
  // As portas deste cômodo (para vizinhos ainda sem ligação, ou a de entrada)…
  for (const x of primeirosPorAlvo(candidatas({ m, versao: 0, semente: 0 }, roomId, false))) reservar(x);
  // …e as dos vizinhos sem ligação nenhuma que vão abrir para cá.
  for (const v of ins?.vizinhos ?? []) for (const x of primeirosPorAlvo(candidatas({ m, versao: 0, semente: 0 }, v.id, false).filter(y => y.alvo === roomId))) reservar(x);
  return saida;
}

/** O texto da pílula ("Pôr uma porta para a Sala?"), ou `null` se não há porta a sugerir. */
export const textoDaPorta = (c: Contexto, roomId: string): string | null => planejar(c, roomId)?.texto ?? null;

export function propostaDePorta(c: Contexto, roomId: string): Proposta | null {
  const plano = planejar(c, roomId); if (!plano) return null;
  return novaProposta({ tipo: 'porta', rotulo: plano.rotulo, comandos: [{ tipo: 'abertura.adicionar', abertura: plano.abertura }], versaoEsperada: c.versao, roomId, semente: c.semente });
}
