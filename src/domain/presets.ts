import type { Acabamento, Luz, Ponto } from './mapa.ts';

/** Um tipo de cômodo: o piso e o papel de parede que combinam, e a função que a construção inteligente (Fase 5) vai usar. */
export interface TipoDeComodo { id: string; nome: string; funcao: string; piso: string; papel: string; descricao: string }

export const TIPOS_DE_COMODO: readonly TipoDeComodo[] = [
  { id: 'sala', nome: 'Sala', funcao: 'sala', piso: 'tabuas.carvalho', papel: 'papel.damasco-vinho', descricao: 'Tábuas de carvalho e damasco vinho' },
  { id: 'cozinha', nome: 'Cozinha', funcao: 'cozinha', piso: 'ladrilho.cozinha', papel: 'papel.listras-creme', descricao: 'Ladrilho claro e listras creme' },
  { id: 'quarto', nome: 'Quarto', funcao: 'quarto', piso: 'tabuas.claras', papel: 'papel.damasco-azul', descricao: 'Tábuas claras e damasco azul' },
  { id: 'biblioteca', nome: 'Biblioteca', funcao: 'biblioteca', piso: 'ladrilho.xadrez', papel: 'papel.listras-musgo', descricao: 'Xadrez e verde-musgo' },
  { id: 'escritorio', nome: 'Escritório', funcao: 'escritorio', piso: 'tabuas.escuras', papel: 'papel.liso-escuro', descricao: 'Tábuas escuras e parede lisa' },
  { id: 'banheiro', nome: 'Banheiro', funcao: 'banheiro', piso: 'azulejo.branco', papel: 'reboco.branco', descricao: 'Azulejo e reboco branco' },
  { id: 'corredor', nome: 'Corredor', funcao: 'corredor', piso: 'carpete.vinho', papel: 'papel.liso-claro', descricao: 'Carpete vinho' },
  { id: 'enfermaria', nome: 'Enfermaria', funcao: 'hospital', piso: 'ladrilho.azul', papel: 'reboco.branco', descricao: 'Ladrilho azul e reboco' },
  { id: 'taverna', nome: 'Taverna', funcao: 'taverna', piso: 'tabuas.escuras', papel: 'tijolo', descricao: 'Tábuas escuras e tijolo' },
  { id: 'porao', nome: 'Porão', funcao: 'porao', piso: 'laje.pedra', papel: 'tijolo', descricao: 'Lajes de pedra e tijolo' },
];
export const tipoDeComodo = (id: string): TipoDeComodo | undefined => TIPOS_DE_COMODO.find(t => t.id === id);

/** Uma predefinição de luz: círculo (lamparina, vela, lâmpada…) ou cone (lanterna, holofote, farol). */
export interface PresetDeLuz { id: string; nome: string; descricao: string; radius: number; color: string; intensity: number; flicker: number; power: Luz['power']; /** Abertura do cone, em graus; `null` ilumina em círculo. */ cone: number | null }

export const PRESETS_DE_LUZ: readonly PresetDeLuz[] = [
  { id: 'vela', nome: 'Vela', descricao: 'Luz pequena e trêmula', radius: 3, color: '#ffcf8a', intensity: 0.7, flicker: 0.25, power: 'fire', cone: null },
  { id: 'lamparina', nome: 'Lamparina', descricao: 'Chama quente em círculo', radius: 5, color: '#ffb36b', intensity: 1, flicker: 0.12, power: 'fire', cone: null },
  { id: 'tocha', nome: 'Tocha', descricao: 'Luz forte e inquieta', radius: 7, color: '#ff9a4a', intensity: 1.1, flicker: 0.3, power: 'fire', cone: null },
  { id: 'fogueira', nome: 'Fogueira', descricao: 'Chama grande ao ar livre', radius: 8, color: '#ff8a3a', intensity: 1.2, flicker: 0.35, power: 'fire', cone: null },
  { id: 'lampada', nome: 'Lâmpada', descricao: 'Luz elétrica estável', radius: 6, color: '#fff1d0', intensity: 1, flicker: 0, power: 'grid', cone: null },
  { id: 'neon', nome: 'Néon', descricao: 'Luz azulada de letreiro', radius: 5, color: '#7af0ff', intensity: 1.1, flicker: 0.08, power: 'grid', cone: null },
  { id: 'luar', nome: 'Luz mágica', descricao: 'Brilho frio e suave', radius: 10, color: '#9fb7ff', intensity: 0.6, flicker: 0, power: 'magic', cone: null },
  { id: 'lanterna', nome: 'Lanterna', descricao: 'Facho de bateria', radius: 9, color: '#fff0cc', intensity: 1, flicker: 0, power: 'battery', cone: 60 },
  { id: 'holofote', nome: 'Holofote', descricao: 'Facho fechado e longo', radius: 14, color: '#ffffff', intensity: 1.4, flicker: 0, power: 'grid', cone: 30 },
  { id: 'farol', nome: 'Farol', descricao: 'Facho aberto, de longe', radius: 16, color: '#fff7d6', intensity: 1.2, flicker: 0, power: 'grid', cone: 45 },
];
export const presetDeLuz = (id: string): PresetDeLuz | undefined => PRESETS_DE_LUZ.find(p => p.id === id);

/** Os campos de uma luz a partir de uma predefinição. `direcao` (rad) só vale para cones. */
export function camposDoPreset(p: PresetDeLuz, direcao = 0): Pick<Luz, 'radius' | 'color' | 'intensity' | 'flicker' | 'power' | 'cone' | 'preset'> {
  return { radius: p.radius, color: p.color, intensity: p.intensity, flicker: p.flicker, power: p.power, cone: p.cone === null ? null : { angle: (p.cone * Math.PI) / 180, direction: direcao }, preset: p.id };
}

export const posicaoDeTitulo = (largura: number, altura: number, onde: 'inferior-direito' | 'inferior-esquerdo' | 'superior-direito' | 'superior-esquerdo' | 'topo', comprimento = 7): Ponto =>
  onde === 'inferior-direito' ? [largura - comprimento - 1.5, altura - 2] : onde === 'inferior-esquerdo' ? [1.5, altura - 2] : onde === 'superior-direito' ? [largura - comprimento - 1.5, 2] : onde === 'superior-esquerdo' ? [1.5, 2] : [(largura - comprimento) / 2, 2];

/** Predefinições do acabamento final da cena. */
export interface PresetDeAcabamento { id: string; nome: string; valores: Omit<Acabamento, 'preset'> }
const grade = (lift = 0, gamma = 1, gain = 1) => ({ lift, gamma, gain });
export const PRESETS_DE_ACABAMENTO: readonly PresetDeAcabamento[] = [
  { id: 'nenhum', nome: 'Nenhum', valores: { texture: 0, vignette: 0, saturation: 1, grain: 0, tint: '#ffffff', grade: grade() } },
  { id: 'neutro', nome: 'Neutro', valores: { texture: 0.2, vignette: 0.28, saturation: 1, grain: 0.03, tint: '#ffffff', grade: grade() } },
  { id: 'sujo', nome: 'Sujo e gasto', valores: { texture: 0.55, vignette: 0.5, saturation: 0.78, grain: 0.1, tint: '#f1e6d4', grade: grade(0, 1.05, 1) } },
  { id: 'sepia', nome: 'Sépia de investigação', valores: { texture: 0.35, vignette: 0.45, saturation: 0.45, grain: 0.07, tint: '#ffe2b8', grade: grade() } },
  { id: 'frio', nome: 'Frio e pálido', valores: { texture: 0.25, vignette: 0.4, saturation: 0.7, grain: 0.05, tint: '#cfe0ff', grade: grade(0, 1, 1) } },
  { id: 'quente', nome: 'Quente e vivo', valores: { texture: 0.15, vignette: 0.25, saturation: 1.25, grain: 0.02, tint: '#fff0d8', grade: grade() } },
];
export const presetDeAcabamento = (id: string): PresetDeAcabamento | undefined => PRESETS_DE_ACABAMENTO.find(p => p.id === id);
