import type { Ponto } from './mapa.ts';
import { camposDoPincel, type CamposDoPincel, type PincelDeObjeto } from './pincel-de-objeto.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { sortearVariante, type Familia } from '../procedural/familias.ts';

/** O que já ocupa o chão: centro e raio da pegada, em metros. */
export interface Ocupado { pos: Ponto; raio: number }
export interface Carimbo { item: string; posicao: Ponto; campos: CamposDoPincel }

/** Quanto duas pegadas podem se tocar sem contar como sobreposição (copas de árvore se encostam; fração da soma dos raios). */
const FOLGA = 0.75, TENTATIVAS_POR_ITEM = 30;

const raioDoItem = (id: string, escala: number): number => { const p = ACERVO.item(id)?.pegada; return p ? (Math.max(p[0], p[1]) * escala) / 2 : 0.25 * escala; };
const areaDoItem = (id: string): number => { const p = ACERVO.item(id)?.pegada; return p ? p[0] * p[1] : 0.25; };

/**
 * Um carimbo do pincel de objeto no modo Vários. Sem `area`, sai um objeto no centro. Com `area` (raio do círculo, em metros), saem
 * `max(1, round(densidade × área do círculo ÷ pegada média))` objetos espalhados no círculo, sem sobrepor o que já existe nem uns aos outros
 * (um lugar sem espaço fica de fora: pode sair menos que o pedido). Cada objeto é uma variante (sorteada, com o dado ligado) com as variações do pincel.
 * Pura e determinística para o mesmo `rand`. `primeiro` são os campos já sorteados do fantasma, usados no objeto do centro.
 */
export function carimbar(centro: Ponto, pincel: PincelDeObjeto, familia: Familia | null, existentes: readonly Ocupado[], rand: () => number, primeiro?: CamposDoPincel): Carimbo[] {
  const variantes = familia?.itens ?? [pincel.item];
  const escolher = (anterior: string): string => (pincel.varianteAleatoria && familia ? sortearVariante(familia, anterior, rand) : pincel.item);
  if (!(pincel.area > 0)) return [{ item: pincel.item, posicao: centro, campos: primeiro ?? camposDoPincel(pincel, rand) }];

  const pegadaMedia = variantes.reduce((s, id) => s + areaDoItem(id), 0) / variantes.length * pincel.escala ** 2;
  const alvo = Math.max(1, Math.round((Math.max(0.1, pincel.densidade) * Math.PI * pincel.area ** 2) / Math.max(0.01, pegadaMedia)));
  const ocupados: Ocupado[] = existentes.filter(o => Math.hypot(o.pos[0] - centro[0], o.pos[1] - centro[1]) <= pincel.area + o.raio + 12);
  const novos: Carimbo[] = [];
  let atual = pincel.item;
  for (let tentativas = 0; novos.length < alvo && tentativas < alvo * TENTATIVAS_POR_ITEM; tentativas++) {
    const item = novos.length === 0 && tentativas === 0 ? pincel.item : escolher(atual);
    const campos = novos.length === 0 && primeiro ? primeiro : camposDoPincel(pincel, rand);
    const a = rand() * Math.PI * 2, d = pincel.area * Math.sqrt(rand()), posicao: Ponto = [centro[0] + Math.cos(a) * d, centro[1] + Math.sin(a) * d];
    const raio = raioDoItem(item, campos.scale);
    if (ocupados.some(o => Math.hypot(o.pos[0] - posicao[0], o.pos[1] - posicao[1]) < (o.raio + raio) * FOLGA)) continue;
    ocupados.push({ pos: posicao, raio }); novos.push({ item, posicao, campos }); atual = item;
  }
  return novos;
}
