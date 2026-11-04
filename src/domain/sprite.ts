import type { Peca } from './mapa.ts';

/** O que descreve o sprite de uma peça (`Peca.sprite`): ids dos catálogos, as cores e a semente. */
export type SpriteDaPeca = NonNullable<Peca['sprite']>;

export interface OpcaoDeSprite { id: string; nome: string }

export const CORPOS: readonly OpcaoDeSprite[] = [
  { id: 'padrao', nome: 'Médio' }, { id: 'esguio', nome: 'Esguio' }, { id: 'robusto', nome: 'Robusto' },
];
export const CABELOS: readonly OpcaoDeSprite[] = [
  { id: 'curto', nome: 'Curto' }, { id: 'longo', nome: 'Longo' }, { id: 'coque', nome: 'Coque' }, { id: 'careca', nome: 'Careca' },
];
export const ROUPAS: readonly OpcaoDeSprite[] = [
  { id: 'casaco', nome: 'Casaco' }, { id: 'vestido', nome: 'Vestido' }, { id: 'armadura', nome: 'Armadura' }, { id: 'manto', nome: 'Manto' },
];
export const ACESSORIOS: readonly OpcaoDeSprite[] = [
  { id: 'galhada', nome: 'Tiara com galhada' }, { id: 'chapeu', nome: 'Chapéu' }, { id: 'oculos', nome: 'Óculos' },
  { id: 'capa', nome: 'Capa' }, { id: 'mochila', nome: 'Mochila' }, { id: 'lanterna', nome: 'Lanterna na mão' },
];

/** As quatro cores editáveis do sprite. As outras (calça, olhos, sombras) saem destas. */
export const CAMPOS_DE_COR = [['pele', 'Pele'], ['cabelo', 'Cabelo'], ['roupa', 'Roupa'], ['detalhe', 'Detalhe']] as const;
export type CampoDeCor = typeof CAMPOS_DE_COR[number][0];
export const CORES_PADRAO: Readonly<Record<CampoDeCor, string>> = { pele: '#e8c4a0', cabelo: '#3a2a1e', roupa: '#2a3f6b', detalhe: '#d9a75e' };

/** Tons de pele de referência: o sorteio usa estes, e a sugestão pelas cores do retrato procura o mais parecido. */
export const TONS_DE_PELE = ['#f3d2b3', '#e8c4a0', '#d9a77e', '#b9825a', '#8d5a3c', '#5e3b26'];
const TONS_DE_CABELO = ['#16131c', '#3a2a1e', '#6b4024', '#a46a36', '#d9b46a', '#b2312e', '#8a8f9a', '#e6e0d0'];
const TONS_DE_ROUPA = ['#2a3f6b', '#7a1f24', '#2f4a32', '#4a4a5c', '#6b3d74', '#93592c', '#1a2440', '#c9bb98'];
const TONS_DE_DETALHE = ['#d9a75e', '#e6d3a8', '#b2312e', '#7fb0d8', '#86a35a', '#e0573f'];

/** Sorteador pequeno e determinístico (mulberry32): o domínio não depende do `procedural`. */
function sorteador(seed: number): () => number {
  let s = (Math.floor(seed) || 1) >>> 0;
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
}

/** Um sprite sorteado: a mesma semente dá sempre o mesmo personagem, e todo id existe nos catálogos. */
export function spriteAleatorio(seed: number): SpriteDaPeca {
  const r = sorteador(seed), escolher = <T,>(l: readonly T[]): T => l[Math.min(l.length - 1, Math.floor(r() * l.length))]!;
  const acessorios = ACESSORIOS.filter(() => r() < 0.22).map(a => a.id);
  return {
    body: escolher(CORPOS).id, hair: escolher(CABELOS).id, outfit: escolher(ROUPAS).id, accessories: acessorios,
    colors: { pele: escolher(TONS_DE_PELE), cabelo: escolher(TONS_DE_CABELO), roupa: escolher(TONS_DE_ROUPA), detalhe: escolher(TONS_DE_DETALHE) },
    seed: Math.floor(seed) >>> 0 & 0x7fffffff,
  };
}

/** A cor de um campo do sprite, caindo na padrão se o documento não a tem (ou não é um #rrggbb). */
export const corDoSprite = (s: Pick<SpriteDaPeca, 'colors'>, campo: CampoDeCor): string => (/^#[0-9a-f]{6}$/i.test(s.colors[campo] ?? '') ? s.colors[campo]! : CORES_PADRAO[campo]);
