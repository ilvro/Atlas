import { ambienteDaCor, ceuNoHorario } from './clima.ts';
import type { Acabamento, Clima, Luz, Ponto, Tempo } from './mapa.ts';

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

// ---------- Climas: o mesmo mapa, vários momentos ----------
/** Um clima pronto: o céu, o tempo e o acabamento de um momento. `climate.preset` e `finish.preset` são preenchidos ao aplicar. */
export interface PresetDeClima { id: string; nome: string; descricao: string; climate: Omit<Clima, 'preset'>; finish: Acabamento }

const SEM_TEMPO: Tempo = { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0 };
const acab = (preset: string, v: Omit<Acabamento, 'preset'>): Acabamento => ({ preset, ...v });
const acabDe = (id: string): Acabamento => { const p = presetDeAcabamento(id)!; return { preset: p.id, ...p.valores }; };

/** O céu de `time`, com o sol (ou a lua) ajustado e, se quiser, o ambiente trocado por uma cor efetiva. */
function ceu(time: string, o: { sol?: number; corDoSol?: string; ambiente?: readonly [number, number, number]; semSol?: boolean } = {}): Pick<Clima, 'time' | 'sun' | 'ambient'> {
  const c = ceuNoHorario(time);
  return {
    time, ambient: o.ambiente ? ambienteDaCor(o.ambiente) : c.ambient,
    sun: o.semSol ? null : { ...c.sun, intensity: Math.round(c.sun.intensity * (o.sol ?? 1) * 1000) / 1000, color: o.corDoSol ?? c.sun.color },
  };
}

export const PRESETS_DE_CLIMA: readonly PresetDeClima[] = [
  { id: 'manha', nome: 'Manhã', descricao: 'Sol baixo e dourado entrando pelas janelas', climate: { ...ceu('08:00'), weather: SEM_TEMPO, gridPower: true }, finish: acabDe('quente') },
  { id: 'tarde', nome: 'Tarde', descricao: 'Luz clara e neutra do meio do dia', climate: { ...ceu('14:30'), weather: SEM_TEMPO, gridPower: true }, finish: acabDe('neutro') },
  { id: 'entardecer', nome: 'Entardecer', descricao: 'Sol laranja, quase no horizonte', climate: { ...ceu('17:30', { sol: 0.9 }), weather: { ...SEM_TEMPO, dust: 0.25 }, gridPower: true },
    finish: acab('personalizado', { texture: 0.2, vignette: 0.4, saturation: 1.15, grain: 0.03, tint: '#ffd9b0', grade: grade(0, 1.05, 1) }) },
  { id: 'noite', nome: 'Noite', descricao: 'Luar azulado; só as luzes do mapa iluminam de verdade', climate: { ...ceu('23:00'), weather: SEM_TEMPO, gridPower: true }, finish: acabDe('frio') },
  { id: 'tempestade', nome: 'Tempestade', descricao: 'Chuva forte, vento e relâmpagos pelas janelas', climate: { ...ceu('16:00', { sol: 0.5, corDoSol: '#8c9fc7', ambiente: [0.22, 0.25, 0.31] }), weather: { ...SEM_TEMPO, rain: 1, wind: 0.5, lightning: 0.7, fog: 0.15 }, gridPower: true },
    finish: acab('personalizado', { texture: 0.3, vignette: 0.5, saturation: 0.6, grain: 0.06, tint: '#e3eeff', grade: grade(0, 1.05, 1) }) },
  { id: 'neblina', nome: 'Neblina', descricao: 'Manhã de névoa espessa, sem sombras duras', climate: { ...ceu('07:30', { sol: 0.35, ambiente: [0.46, 0.5, 0.52] }), weather: { ...SEM_TEMPO, fog: 0.85, wind: 0.1 }, gridPower: true },
    finish: acab('personalizado', { texture: 0.25, vignette: 0.45, saturation: 0.55, grain: 0.05, tint: '#dde4e8', grade: grade() }) },
  { id: 'neve', nome: 'Neve', descricao: 'Dia claro e frio com neve caindo', climate: { ...ceu('11:00', { sol: 0.6, corDoSol: '#e6efff', ambiente: [0.72, 0.77, 0.85] }), weather: { ...SEM_TEMPO, snow: 0.8, wind: 0.2 }, gridPower: true },
    finish: acab('personalizado', { texture: 0.2, vignette: 0.3, saturation: 0.7, grain: 0.03, tint: '#e8f0ff', grade: grade() }) },
  { id: 'apagao', nome: 'Apagão', descricao: 'A rede elétrica caiu: só fogo, pilha e luar', climate: { ...ceu('23:30', { sol: 0.85, ambiente: [0.022, 0.022, 0.035] }), weather: SEM_TEMPO, gridPower: false },
    finish: acab('personalizado', { texture: 0.35, vignette: 0.65, saturation: 0.7, grain: 0.09, tint: '#ffe6e6', grade: grade(0, 1.1, 1) }) },
  { id: 'neon', nome: 'Neon', descricao: 'Noite molhada e saturada, de letreiros magenta e ciano', climate: { ...ceu('23:00', { sol: 0.8, ambiente: [0.07, 0.05, 0.13] }), weather: { ...SEM_TEMPO, rain: 0.3 }, gridPower: true },
    finish: acab('personalizado', { texture: 0.15, vignette: 0.45, saturation: 1.45, grain: 0.04, tint: '#d6a8ff', grade: grade(0, 1, 1.1) }) },
];

/** Mapas antigos chamam a tarde de "dia". */
const APELIDOS_DE_CLIMA: Readonly<Record<string, string>> = { dia: 'tarde' };
export const presetDeClima = (id: string): PresetDeClima | undefined => PRESETS_DE_CLIMA.find(p => p.id === (APELIDOS_DE_CLIMA[id] ?? id));

// ---------- Presença ----------
export type PacoteDePresenca = 'natural' | 'sobrenatural' | 'ordem';
/** Um pincel de presença: o que ele pinta e como parece (cor, se brilha acima da luz, ritmo da pulsação e escala do ruído). */
export interface PincelDePresenca { id: string; nome: string; pacote: PacoteDePresenca; cor: string; brilho: boolean; pulso: number; escala: number }
export const PACOTES_DE_PRESENCA: readonly { id: PacoteDePresenca; nome: string }[] = [{ id: 'natural', nome: 'Natural' }, { id: 'sobrenatural', nome: 'Sobrenatural' }, { id: 'ordem', nome: 'Ordem Paranormal' }];
// As cores dos cinco elementos são as da Ficha (ELEMENT_COLORS).
export const PINCEIS_DE_PRESENCA: readonly PincelDePresenca[] = [
  { id: 'musgo', nome: 'Musgo', pacote: 'natural', cor: '#4f7a34', brilho: false, pulso: 0, escala: 1 },
  { id: 'mofo', nome: 'Mofo', pacote: 'natural', cor: '#5b6a4a', brilho: false, pulso: 0, escala: 1.6 },
  { id: 'poca', nome: 'Poça', pacote: 'natural', cor: '#3a5a78', brilho: false, pulso: 0, escala: 0.6 },
  { id: 'corrupcao', nome: 'Corrupção', pacote: 'sobrenatural', cor: '#7a2a8a', brilho: true, pulso: 0.5, escala: 1.2 },
  { id: 'sombra', nome: 'Sombra', pacote: 'sobrenatural', cor: '#0a0710', brilho: false, pulso: 0.25, escala: 0.8 },
  { id: 'ordem.sangue', nome: 'Sangue', pacote: 'ordem', cor: '#e0150d', brilho: true, pulso: 0.7, escala: 1 },
  { id: 'ordem.morte', nome: 'Morte', pacote: 'ordem', cor: '#70707a', brilho: false, pulso: 0.2, escala: 1.4 },
  { id: 'ordem.conhecimento', nome: 'Conhecimento', pacote: 'ordem', cor: '#e5a11c', brilho: true, pulso: 0.4, escala: 0.7 },
  { id: 'ordem.energia', nome: 'Energia', pacote: 'ordem', cor: '#a230ed', brilho: true, pulso: 1.2, escala: 0.9 },
  { id: 'ordem.medo', nome: 'Medo', pacote: 'ordem', cor: '#d5d7e0', brilho: true, pulso: 0.3, escala: 1.5 },
];
export const pincelDePresenca = (id: string): PincelDePresenca | undefined => PINCEIS_DE_PRESENCA.find(p => p.id === id);

// ---------- Gênero ----------
/** O gênero guia o que o assistente sugere (materiais, paleta, luzes). Um id desconhecido vale como `investigacao`. */
export interface Genero { id: string; nome: string; descricao: string }
export const GENEROS: readonly Genero[] = [
  { id: 'investigacao', nome: 'Investigação', descricao: 'Casa antiga, lamparinas, damasco' },
  { id: 'moderno', nome: 'Moderno', descricao: 'Lâmpadas, cores claras' },
  { id: 'fantasia', nome: 'Fantasia', descricao: 'Velas, tochas, pedra e madeira' },
];
export const generoDe = (id: string): Genero => GENEROS.find(g => g.id === id) ?? GENEROS[0]!;
