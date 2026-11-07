/** Sons sintetizados e discretos (Web Audio), como na Ficha. Opcionais: qualquer falha é ignorada. */
type SomSimples = 'pop' | 'remover' | 'desfazer' | 'refazer' | 'selecionar' | 'erro' | 'abrir' | 'salvar' | 'papel';
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
  papel: [{ f0: 440, f1: 320, dur: 0.08, tipo: 'triangle', ganho: 0.03 }],
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

let impulsoReverb: AudioBuffer | null = null;
function obterImpulsoReverb(ctx: AudioContext): AudioBuffer {
  if (impulsoReverb && impulsoReverb.sampleRate === ctx.sampleRate) return impulsoReverb;
  const dur = 3.2, taxa = ctx.sampleRate, total = Math.floor(taxa * dur);
  const buf = ctx.createBuffer(2, total, taxa);
  const ch0 = buf.getChannelData(0), ch1 = buf.getChannelData(1);
  let ult0 = 0, ult1 = 0;
  for (let i = 0; i < total; i++) {
    const t = i / taxa;
    const decaimento = Math.pow(Math.max(0, 1 - i / total), 2.6);
    const inicial = t < 0.18 ? 1.5 : 1.0;
    const r0 = (Math.random() * 2 - 1) * decaimento * inicial;
    const r1 = (Math.random() * 2 - 1) * decaimento * inicial;
    ult0 = ult0 * 0.7 + r0 * 0.3;
    ult1 = ult1 * 0.7 + r1 * 0.3;
    ch0[i] = ult0;
    ch1[i] = ult1;
  }
  impulsoReverb = buf;
  return buf;
}

/** Um trovão estéreo realista com reverberação convolutiva, onda de choque sub-grave e ecos nas nuvens. */
export function trovao(intensidade = 1): void {
  if (!ligado) return;
  try {
    if (typeof AudioContext === 'undefined' && typeof (window as unknown as { AudioContext?: unknown })?.AudioContext === 'undefined') return;
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    const ctx = contexto;
    const t0 = ctx.currentTime;
    const taxa = ctx.sampleRate;
    const dur = 3.6;

    // Master chain com compressor para conter picos sem distorção indesejada
    let saida: AudioNode = ctx.destination;
    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-14, t0);
        comp.knee.setValueAtTime(8, t0);
        comp.ratio.setValueAtTime(4, t0);
        comp.attack.setValueAtTime(0.003, t0);
        comp.release.setValueAtTime(0.25, t0);
        comp.connect(ctx.destination);
        saida = comp;
      } catch {
        saida = ctx.destination;
      }
    }

    // Barramento de saída direta (dry) e reverberada (wet)
    const ganhoDry = ctx.createGain();
    ganhoDry.gain.setValueAtTime(0.55 * Math.max(0.1, intensidade), t0);
    ganhoDry.connect(saida);

    let entradaReverb: AudioNode = ganhoDry;
    if (typeof ctx.createConvolver === 'function') {
      try {
        const conv = ctx.createConvolver();
        conv.buffer = obterImpulsoReverb(ctx);
        const ganhoWet = ctx.createGain();
        ganhoWet.gain.setValueAtTime(0.65 * Math.max(0.1, intensidade), t0);
        conv.connect(ganhoWet);
        ganhoWet.connect(saida);
        entradaReverb = conv;
      } catch {
        entradaReverb = ganhoDry;
      }
    }

    // Camada 1: Estalo elétrico e rasgo atmosférico (0 a 0.22s)
    const durCrack = 0.22;
    const amCrack = Math.floor(taxa * durCrack);
    const bufCrack = ctx.createBuffer(1, Math.max(1, amCrack), taxa);
    const dCrack = bufCrack.getChannelData(0);
    for (let i = 0; i < amCrack; i++) {
      const t = i / taxa;
      dCrack[i] = (Math.random() * 2 - 1) * Math.exp(-t * 18);
    }
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = bufCrack;
    const crackFil = ctx.createBiquadFilter();
    crackFil.type = 'bandpass';
    crackFil.frequency.setValueAtTime(900, t0);
    crackFil.frequency.exponentialRampToValueAtTime(220, t0 + durCrack);
    crackFil.Q.value = 0.9;

    let crackNoSaturado: AudioNode = crackFil;
    if (typeof ctx.createWaveShaper === 'function') {
      try {
        const shaper = ctx.createWaveShaper();
        const nCurva = 256;
        const curva = new Float32Array(nCurva);
        for (let i = 0; i < nCurva; i++) {
          const x = (i / (nCurva - 1)) * 2 - 1;
          curva[i] = Math.tanh(x * 2.5);
        }
        shaper.curve = curva;
        crackFil.connect(shaper);
        crackNoSaturado = shaper;
      } catch {
        crackNoSaturado = crackFil;
      }
    }

    let crackPanned: AudioNode = crackNoSaturado;
    if (typeof (ctx as any).createStereoPanner === 'function') {
      try {
        const panner = (ctx as any).createStereoPanner();
        panner.pan.setValueAtTime(Math.random() * 0.6 - 0.3, t0);
        crackNoSaturado.connect(panner);
        crackPanned = panner;
      } catch {
        crackPanned = crackNoSaturado;
      }
    }

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.6 * intensidade, t0);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + durCrack);
    crackPanned.connect(crackGain);
    crackGain.connect(ganhoDry);
    if (entradaReverb !== ganhoDry) crackGain.connect(entradaReverb);
    crackSrc.connect(crackFil);
    crackSrc.start(t0);
    crackSrc.stop(t0 + durCrack + 0.05);

    // Camada 2: Onda de choque sub-grave (0.02 a 0.95s, 88 Hz -> 26 Hz)
    const durSub = 0.95;
    const oscSubSine = ctx.createOscillator();
    const oscSubTri = ctx.createOscillator();
    oscSubSine.type = 'sine';
    oscSubTri.type = 'triangle';
    oscSubSine.frequency.setValueAtTime(88, t0 + 0.02);
    oscSubSine.frequency.exponentialRampToValueAtTime(26, t0 + durSub);
    oscSubTri.frequency.setValueAtTime(88, t0 + 0.02);
    oscSubTri.frequency.exponentialRampToValueAtTime(26, t0 + durSub);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.linearRampToValueAtTime(0.75 * intensidade, t0 + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSub);

    oscSubSine.connect(subGain);
    oscSubTri.connect(subGain);
    subGain.connect(ganhoDry);
    oscSubSine.start(t0 + 0.02);
    oscSubTri.start(t0 + 0.02);
    oscSubSine.stop(t0 + durSub + 0.02);
    oscSubTri.stop(t0 + durSub + 0.02);

    // Camada 3: Rolamento estéreo nas nuvens (0.05 a 3.6s, 2 canais ruído marrom, Q=0.85, swells em 0.12s, 0.55s, 1.25s)
    const totalAmostras = Math.floor(taxa * dur);
    const bufBrown = ctx.createBuffer(2, Math.max(1, totalAmostras), taxa);
    const chL = bufBrown.getChannelData(0);
    const chR = bufBrown.getChannelData(1);
    let brownL = 0, brownR = 0;
    for (let i = 0; i < totalAmostras; i++) {
      const t = i / taxa;
      const s0 = 1.1 * Math.exp(-((t - 0.12) ** 2) / 0.03);
      const s1 = 0.9 * Math.exp(-((t - 0.55) ** 2) / 0.08);
      const s2 = 0.65 * Math.exp(-((t - 1.25) ** 2) / 0.22);
      const decaimento = Math.max(0, (1 - t / dur) ** 1.9);
      const env = (s0 + s1 + s2 + 0.08) * decaimento;

      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;
      brownL = brownL * 0.94 + whiteL * 0.12;
      brownR = brownR * 0.94 + whiteR * 0.12;
      chL[i] = brownL * env;
      chR[i] = brownR * env;
    }

    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = bufBrown;
    const rumbleFil = ctx.createBiquadFilter();
    rumbleFil.type = 'lowpass';
    rumbleFil.frequency.setValueAtTime(210, t0);
    rumbleFil.frequency.exponentialRampToValueAtTime(38, t0 + dur);
    rumbleFil.Q.value = 0.85;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.01, t0);
    rumbleGain.gain.linearRampToValueAtTime(0.85 * intensidade, t0 + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    rumbleSrc.connect(rumbleFil);
    rumbleFil.connect(rumbleGain);
    rumbleGain.connect(ganhoDry);
    if (entradaReverb !== ganhoDry) rumbleGain.connect(entradaReverb);
    rumbleSrc.start(t0 + 0.05);
    rumbleSrc.stop(t0 + dur + 0.05);
  } catch {
    /* som opcional */
  }
}
