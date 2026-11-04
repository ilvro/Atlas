/** Sons sintetizados e discretos (Web Audio), como na Ficha. Opcionais: qualquer falha é ignorada. */
type SomSimples = 'pop' | 'remover' | 'desfazer' | 'refazer' | 'selecionar' | 'erro' | 'abrir' | 'salvar';
/** Sons das ações de sessão, sintetizados à parte (rangido, batida, cliques e atrito de ruído). */
export const SONS_DE_INTERACAO = ['porta-abrir', 'porta-fechar', 'trancada', 'interruptor', 'gaveta'] as const;
export type SomDeInteracao = (typeof SONS_DE_INTERACAO)[number];
export type NomeDeSom = SomSimples | SomDeInteracao;

const CHAVE_SOM = 'atlas:som';
let ligado = true;
try { ligado = localStorage.getItem(CHAVE_SOM) !== '0'; } catch { /* padrão ligado */ }
export const somPreferido = (): boolean => ligado;
/** Cala o som só nesta janela, sem mexer na preferência gravada (o projetor não toca nada). */
export function silenciarNestaJanela(): void { ligado = false; }
export function definirSom(valor: boolean): void { ligado = valor; try { localStorage.setItem(CHAVE_SOM, valor ? '1' : '0'); } catch { /* ignora */ } }

let contexto: AudioContext | null = null;

interface Nota { f0: number; f1?: number; dur: number; tipo?: OscillatorType; ganho?: number; atraso?: number }
const SONS: Record<SomSimples, Nota[]> = {
  pop: [{ f0: 520, f1: 760, dur: 0.09, ganho: 0.05 }],
  remover: [{ f0: 300, f1: 120, dur: 0.14, tipo: 'triangle', ganho: 0.05 }],
  desfazer: [{ f0: 420, f1: 300, dur: 0.08, ganho: 0.04 }],
  refazer: [{ f0: 300, f1: 420, dur: 0.08, ganho: 0.04 }],
  selecionar: [{ f0: 880, dur: 0.035, tipo: 'square', ganho: 0.02 }],
  erro: [{ f0: 180, dur: 0.12, tipo: 'sawtooth', ganho: 0.04 }, { f0: 150, dur: 0.12, tipo: 'sawtooth', ganho: 0.04, atraso: 0.1 }],
  abrir: [{ f0: 392, dur: 0.07, ganho: 0.04 }, { f0: 523, dur: 0.1, ganho: 0.04, atraso: 0.07 }],
  salvar: [{ f0: 660, dur: 0.06, ganho: 0.04 }, { f0: 880, dur: 0.1, ganho: 0.04, atraso: 0.06 }],
};

/** Pequena variação a cada toque (altura ±5%), para não cansar. */
const variar = () => 0.95 + Math.random() * 0.1;

/** Ruído branco de `dur` segundos, filtrado e com envelope. */
function ruido(ctx: AudioContext, t0: number, dur: number, tipo: BiquadFilterType, f0: number, f1: number, ganho: number): void {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(), fil = ctx.createBiquadFilter(), g = ctx.createGain();
  fil.type = tipo; fil.frequency.setValueAtTime(f0, t0); fil.frequency.exponentialRampToValueAtTime(f1, t0 + dur); fil.Q.value = 2;
  g.gain.setValueAtTime(ganho, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.buffer = buf; src.connect(fil).connect(g).connect(ctx.destination); src.start(t0);
}
function tom(ctx: AudioContext, t0: number, tipo: OscillatorType, f0: number, f1: number, dur: number, ganho: number): void {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = tipo; osc.frequency.setValueAtTime(f0, t0); osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(ganho, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function sintetizar(ctx: AudioContext, nome: SomDeInteracao): void {
  const t0 = ctx.currentTime, v = variar();
  if (nome === 'porta-abrir') {
    // Rangido: uma serra grave cuja altura anda ao acaso por 0,7 s, passando por um filtro.
    const osc = ctx.createOscillator(), fil = ctx.createBiquadFilter(), g = ctx.createGain(), dur = 0.7;
    osc.type = 'sawtooth'; fil.type = 'lowpass'; fil.frequency.value = 900; fil.Q.value = 6;
    osc.frequency.setValueAtTime(130 * v, t0);
    for (let t = 0.05; t < dur; t += 0.05) osc.frequency.linearRampToValueAtTime((130 + Math.random() * 90 + t * 60) * v, t0 + t);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.035, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(fil).connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02);
  } else if (nome === 'porta-fechar') {
    tom(ctx, t0, 'sine', 110 * v, 40, 0.18, 0.2); ruido(ctx, t0, 0.07, 'lowpass', 600 * v, 200, 0.12);
  } else if (nome === 'trancada') {
    for (const atraso of [0, 0.1]) { tom(ctx, t0 + atraso, 'square', 1900 * v, 1500 * v, 0.03, 0.03); tom(ctx, t0 + atraso, 'triangle', 3100 * v, 2600 * v, 0.05, 0.015); }
  } else if (nome === 'interruptor') {
    tom(ctx, t0, 'square', 2600 * v, 1800 * v, 0.018, 0.04); ruido(ctx, t0, 0.02, 'highpass', 4000, 6000, 0.03);
  } else ruido(ctx, t0, 0.4, 'bandpass', 700 * v, 280, 0.16);   // gaveta: atrito
}

export function tocar(nome: NomeDeSom): void {
  if (!ligado || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && nome === 'selecionar')) return;
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    if ((SONS_DE_INTERACAO as readonly string[]).includes(nome)) { sintetizar(contexto, nome as SomDeInteracao); return; }
    for (const n of SONS[nome as SomSimples]) {
      const t0 = contexto.currentTime + (n.atraso ?? 0), osc = contexto.createOscillator(), g = contexto.createGain();
      osc.type = n.tipo ?? 'sine'; osc.frequency.setValueAtTime(n.f0, t0);
      if (n.f1) osc.frequency.exponentialRampToValueAtTime(n.f1, t0 + n.dur);
      g.gain.setValueAtTime(n.ganho ?? 0.04, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(g).connect(contexto.destination); osc.start(t0); osc.stop(t0 + n.dur + 0.02);
    }
  } catch { /* o som é opcional */ }
}

/** Um trovão: ruído marrom filtrado em graves, que decai em ~2,6 s. Respeita o interruptor de som. */
export function trovao(): void {
  if (!ligado) return;
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    const dur = 2.6, buf = contexto.createBuffer(1, Math.floor(contexto.sampleRate * dur), contexto.sampleRate), d = buf.getChannelData(0);
    let v = 0; for (let i = 0; i < d.length; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = v * (1 - i / d.length) ** 2; }
    const src = contexto.createBufferSource(), lp = contexto.createBiquadFilter(), g = contexto.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 180; g.gain.value = 0.5; src.buffer = buf; src.connect(lp).connect(g).connect(contexto.destination); src.start();
  } catch { /* o som é opcional */ }
}
