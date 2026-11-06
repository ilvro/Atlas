import { poli, type Descricao, type DescricaoDeParede, type DescricaoDePiso, type Parte } from '../descricao.ts';

export type Categoria = 'mesas' | 'assentos' | 'camas' | 'armazenamento' | 'tapetes' | 'cozinha' | 'decoracao' | 'parede' | 'banheiro' | 'lareira-e-luz' | 'exterior';
export const CATEGORIAS: readonly (readonly [Categoria, string])[] = [['mesas', 'Mesas'], ['assentos', 'Assentos'], ['camas', 'Camas'], ['armazenamento', 'Armários e estantes'], ['tapetes', 'Tapetes'], ['cozinha', 'Cozinha'], ['decoracao', 'Decoração'], ['parede', 'De parede'], ['banheiro', 'Banheiro'], ['lareira-e-luz', 'Lareiras e luz'], ['exterior', 'Exterior']];

export interface CampoDeReceita { id: string; rotulo: string; tipo: 'numero' | 'material'; padrao: number | string; min?: number; max?: number; passo?: number; /** Para `material`: que uso de material oferecer. */ uso?: 'piso' | 'papel' | 'objeto' | 'terreno' }
export interface PedidoDeReceita { seed: number; params: Record<string, unknown> }

export interface Receita {
  id: string; nome: string; categoria: Categoria; tipo: 'piso' | 'parede';
  /** Para que cômodos serve (a construção inteligente da Fase 5 usa isto). */
  funcoes: string[]; tags: string[];
  /** A que gêneros serve (`GENEROS`); vazio ou ausente serve a todos. */
  generos?: string[];
  /** O kit a que pertence (`investigacao`, `moderno`…), para a biblioteca agrupar; ausente = acervo básico da casa. */
  kit?: string;
  /** Tamanho padrão (m): largura × profundidade; para objetos de parede, largura × espessura. */
  pegada: [number, number];
  /** Altura (m) para a sombra do sol; ausente vale o maior `z` das partes (no máximo 12). */
  altura?: number;
  /** Objeto de fundo de água: ao pôr no mapa nasce `elevation: 'underwater'`, sem sombra e sem bloquear. */
  submerso?: boolean;
  /** Animação própria acrescentada pela cena por cima da parte assada. */
  animacao?: 'cachoeira';
  campos?: CampoDeReceita[];
  gerar(p: PedidoDeReceita): Descricao;
}

export const num = (p: PedidoDeReceita, id: string, padrao: number, min = 0.05, max = 20): number => { const v = p.params[id]; return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : padrao; };
export const mat = (p: PedidoDeReceita, id: string, padrao: string): string => (typeof p.params[id] === 'string' ? (p.params[id] as string) : padrao);
export const LOMBADAS = ['#7a1f24', '#2a3f6b', '#2f4a32', '#93592c', '#3a2244', '#b97d3d', '#1a2440', '#4a1418', '#d9a75e', '#46291b'];
export const piso = (pegada: [number, number], partes: Parte[]): DescricaoDePiso => ({ tipo: 'piso', pegada, partes });
export const parede = (largura: number, face: Parte[], topo: Parte[]): DescricaoDeParede => ({ tipo: 'parede', largura, face, topo });

export function folhas(r: () => number, cx: number, cy: number, n: number, esp: number, w: number): Parte[] {
  const saida: Parte[] = [];
  for (let i = 0; i < n; i++) { const x = cx + (r() - 0.5) * esp, y = cy + (r() - 0.5) * esp * 0.7, a = (r() - 0.5) * 1.2, h = 0.29, c = Math.cos(a), s = Math.sin(a); saida.push(poli([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([u, v]) => [x + u! * c - v! * s, y + u! * s + v! * c]), 'papel.folha', 0.78 + i * 0.002, { detalhe: 2, sombraLeve: true })); }
  return saida;
}
