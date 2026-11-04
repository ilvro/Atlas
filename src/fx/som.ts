/** Sons sintetizados e discretos (Web Audio), como na Ficha. Opcionais: qualquer falha é ignorada. */
export type NomeDeSom = 'pop' | 'remover' | 'desfazer' | 'refazer' | 'selecionar' | 'erro' | 'abrir' | 'salvar';

const CHAVE_SOM = 'atlas:som';
let ligado = true;
try { ligado = localStorage.getItem(CHAVE_SOM) !== '0'; } catch { /* padrão ligado */ }
export const somPreferido = (): boolean => ligado;
/** Cala o som só nesta janela, sem mexer na preferência gravada (o projetor não toca nada). */
export function silenciarNestaJanela(): void { ligado = false; }
export function definirSom(valor: boolean): void { ligado = valor; try { localStorage.setItem(CHAVE_SOM, valor ? '1' : '0'); } catch { /* ignora */ } }

let contexto: AudioContext | null = null;

interface Nota { f0: number; f1?: number; dur: number; tipo?: OscillatorType; ganho?: number; atraso?: number }
const SONS: Record<NomeDeSom, Nota[]> = {
  pop: [{ f0: 520, f1: 760, dur: 0.09, ganho: 0.05 }],
  remover: [{ f0: 300, f1: 120, dur: 0.14, tipo: 'triangle', ganho: 0.05 }],
  desfazer: [{ f0: 420, f1: 300, dur: 0.08, ganho: 0.04 }],
  refazer: [{ f0: 300, f1: 420, dur: 0.08, ganho: 0.04 }],
  selecionar: [{ f0: 880, dur: 0.035, tipo: 'square', ganho: 0.02 }],
  erro: [{ f0: 180, dur: 0.12, tipo: 'sawtooth', ganho: 0.04 }, { f0: 150, dur: 0.12, tipo: 'sawtooth', ganho: 0.04, atraso: 0.1 }],
  abrir: [{ f0: 392, dur: 0.07, ganho: 0.04 }, { f0: 523, dur: 0.1, ganho: 0.04, atraso: 0.07 }],
  salvar: [{ f0: 660, dur: 0.06, ganho: 0.04 }, { f0: 880, dur: 0.1, ganho: 0.04, atraso: 0.06 }],
};

export function tocar(nome: NomeDeSom): void {
  if (!ligado || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && nome === 'selecionar')) return;
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    for (const n of SONS[nome]) {
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
