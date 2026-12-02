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
  const dur = 4.2, taxa = ctx.sampleRate, total = Math.floor(taxa * dur);
  const buf = ctx.createBuffer(2, total, taxa);
  const ch0 = buf.getChannelData(0), ch1 = buf.getChannelData(1);
  // Ruído de cauda filtrada bem grave (ecos difusos em nuvens e vale)
  let lp0a = 0, lp0b = 0, lp1a = 0, lp1b = 0;
  for (let i = 0; i < total; i++) {
    const t = i / taxa;
    const decaimento = Math.pow(Math.max(0, 1 - i / total), 2.1);
    const ataque = Math.min(1, t / 0.04);
    const w0 = (Math.random() * 2 - 1) * decaimento * ataque;
    const w1 = (Math.random() * 2 - 1) * decaimento * ataque;
    lp0a = lp0a * 0.84 + w0 * 0.16;
    lp0b = lp0b * 0.88 + lp0a * 0.12;
    lp1a = lp1a * 0.84 + w1 * 0.16;
    lp1b = lp1b * 0.88 + lp1a * 0.12;
    ch0[i] = lp0b * 2.4;
    ch1[i] = lp1b * 2.4;
  }
  impulsoReverb = buf;
  return buf;
}

/** Envelope assimétrico (ataque rápido, cauda longa) para cada eco/estrondo de trovão. */
function picoAssimetrico(t: number, centro: number, ataque: number, cauda: number): number {
  const dt = t - centro;
  if (dt < 0) return Math.exp(-((dt / ataque) ** 2));
  return Math.exp(-dt / cauda);
}

/** Um trovão estéreo orgânico: estalo seco de descarga + estrondo caótico de nuvens + sub-grave de ruído (sem osciladores sintéticos). */
export function trovao(intensidade = 1): void {
  if (!ligado) return;
  try {
    if (typeof AudioContext === 'undefined' && typeof (window as unknown as { AudioContext?: unknown })?.AudioContext === 'undefined') return;
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    const ctx = contexto;
    const t0 = ctx.currentTime;
    const taxa = ctx.sampleRate;
    const forca = Math.max(0.15, Math.min(2.5, intensidade));
    const dur = 4.6 + Math.random() * 0.8;

    // Master chain com compressor suave para impacto sem distorção digital
    let saida: AudioNode = ctx.destination;
    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-16, t0);
        comp.knee.setValueAtTime(12, t0);
        comp.ratio.setValueAtTime(5, t0);
        comp.attack.setValueAtTime(0.004, t0);
        comp.release.setValueAtTime(0.3, t0);
        comp.connect(ctx.destination);
        saida = comp;
      } catch {
        saida = ctx.destination;
      }
    }

    const ganhoDry = ctx.createGain();
    ganhoDry.gain.setValueAtTime(0.65 * forca, t0);
    ganhoDry.connect(saida);

    let entradaReverb: AudioNode = ganhoDry;
    if (typeof ctx.createConvolver === 'function') {
      try {
        const conv = ctx.createConvolver();
        conv.buffer = obterImpulsoReverb(ctx);
        const ganhoWet = ctx.createGain();
        ganhoWet.gain.setValueAtTime(0.75 * forca, t0);
        conv.connect(ganhoWet);
        ganhoWet.connect(saida);
        entradaReverb = conv;
      } catch {
        entradaReverb = ganhoDry;
      }
    }

    // Sequência orgânica de ecos irregulares (canais do raio em distâncias distintas)
    const ecos = [
      { t: 0.03, amp: 1.0, at: 0.012, cauda: 0.28 },
      { t: 0.16 + Math.random() * 0.08, amp: 0.85, at: 0.025, cauda: 0.35 },
      { t: 0.42 + Math.random() * 0.14, amp: 0.95, at: 0.04, cauda: 0.55 },
      { t: 0.95 + Math.random() * 0.25, amp: 0.72, at: 0.07, cauda: 0.75 },
      { t: 1.65 + Math.random() * 0.35, amp: 0.52, at: 0.12, cauda: 0.95 },
      { t: 2.55 + Math.random() * 0.45, amp: 0.32, at: 0.18, cauda: 1.15 },
    ];

    // Camada 1: Rachadura / estalo seco inicial (múltiplos micro-estalos de ruído saturado)
    const durCrack = 0.42;
    const amCrack = Math.max(1, Math.floor(taxa * durCrack));
    const bufCrack = ctx.createBuffer(2, amCrack, taxa);
    const cL = bufCrack.getChannelData(0);
    const cR = bufCrack.getChannelData(1);
    const estalos = [
      { t: 0.008, amp: 1.0, d: 0.035 },
      { t: 0.055 + Math.random() * 0.03, amp: 0.75, d: 0.05 },
      { t: 0.13 + Math.random() * 0.05, amp: 0.55, d: 0.08 },
    ];
    for (let i = 0; i < amCrack; i++) {
      const t = i / taxa;
      let env = 0;
      for (const e of estalos) env += e.amp * picoAssimetrico(t, e.t, 0.003, e.d);
      // Pequena crepitação granular
      const crep = 0.65 + 0.35 * Math.sin(t * 95 + Math.sin(t * 230));
      cL[i] = (Math.random() * 2 - 1) * env * crep;
      cR[i] = (Math.random() * 2 - 1) * env * crep;
    }
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = bufCrack;

    const crackHp = ctx.createBiquadFilter();
    crackHp.type = 'highpass';
    crackHp.frequency.setValueAtTime(140, t0);

    const crackLp = ctx.createBiquadFilter();
    crackLp.type = 'lowpass';
    crackLp.frequency.setValueAtTime(2600, t0);
    crackLp.frequency.exponentialRampToValueAtTime(260, t0 + durCrack);
    crackLp.Q.value = 0.7;

    let crackOut: AudioNode = crackLp;
    if (typeof ctx.createWaveShaper === 'function') {
      try {
        const shaper = ctx.createWaveShaper();
        const curva = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * 2 - 1;
          curva[i] = Math.tanh(x * 2.2);
        }
        shaper.curve = curva;
        crackLp.connect(shaper);
        crackOut = shaper;
      } catch {
        crackOut = crackLp;
      }
    }

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.42 * forca, t0);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + durCrack);
    crackSrc.connect(crackHp);
    crackHp.connect(crackLp);
    crackOut.connect(crackGain);
    crackGain.connect(ganhoDry);
    if (entradaReverb !== ganhoDry) crackGain.connect(entradaReverb);
    crackSrc.start(t0);
    crackSrc.stop(t0 + durCrack + 0.05);

    // Camada 2: Corpo principal do estrondo e ribombo nas nuvens (ruído marrom/rosa estéreo descorrelacionado)
    const totalAmostras = Math.max(1, Math.floor(taxa * dur));
    const bufRumble = ctx.createBuffer(2, totalAmostras, taxa);
    const rL = bufRumble.getChannelData(0);
    const rR = bufRumble.getChannelData(1);
    let b0L = 0, b1L = 0, b0R = 0, b1R = 0;
    // Pequeno atraso estéreo entre L e R para espacialidade natural no céu
    const defasagemR = 0.018 + Math.random() * 0.025;
    for (let i = 0; i < totalAmostras; i++) {
      const t = i / taxa;
      const tR = Math.max(0, t - defasagemR);
      let envL = 0, envR = 0;
      for (const e of ecos) {
        envL += e.amp * picoAssimetrico(t, e.t, e.at, e.cauda);
        envR += e.amp * picoAssimetrico(tR, e.t, e.at, e.cauda);
      }
      const fim = Math.pow(Math.max(0, 1 - t / dur), 1.6);
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      // Filtro de 2 polos para ruído marrom rico em graves sem soar "abafado demais"
      b0L = b0L * 0.965 + wL * 0.14;
      b1L = b1L * 0.91 + b0L * 0.22;
      b0R = b0R * 0.965 + wR * 0.14;
      b1R = b1R * 0.91 + b0R * 0.22;
      rL[i] = Math.tanh((b1L * 1.4 + b0L * 0.45) * envL * fim);
      rR[i] = Math.tanh((b1R * 1.4 + b0R * 0.45) * envR * fim);
    }

    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = bufRumble;

    const rumbleLp1 = ctx.createBiquadFilter();
    rumbleLp1.type = 'lowpass';
    rumbleLp1.frequency.setValueAtTime(340, t0);
    rumbleLp1.frequency.exponentialRampToValueAtTime(75, t0 + dur * 0.85);
    rumbleLp1.Q.value = 0.7;

    const rumbleLp2 = ctx.createBiquadFilter();
    rumbleLp2.type = 'lowpass';
    rumbleLp2.frequency.setValueAtTime(220, t0);
    rumbleLp2.frequency.exponentialRampToValueAtTime(55, t0 + dur);
    rumbleLp2.Q.value = 0.6;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, t0);
    rumbleGain.gain.linearRampToValueAtTime(0.95 * forca, t0 + 0.035);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    rumbleSrc.connect(rumbleLp1);
    rumbleLp1.connect(rumbleLp2);
    rumbleLp2.connect(rumbleGain);
    rumbleGain.connect(ganhoDry);
    if (entradaReverb !== ganhoDry) rumbleGain.connect(entradaReverb);
    rumbleSrc.start(t0 + 0.015);
    rumbleSrc.stop(t0 + dur + 0.05);

    // Camada 3: Sub-grave orgânico (apenas ruído ultra-filtrado em 30-75 Hz, sem tom de sintetizador)
    const subSrc = ctx.createBufferSource();
    subSrc.buffer = bufRumble;
    const subLp = ctx.createBiquadFilter();
    subLp.type = 'lowpass';
    subLp.frequency.setValueAtTime(78, t0);
    subLp.frequency.exponentialRampToValueAtTime(34, t0 + dur * 0.7);
    subLp.Q.value = 0.7;

    const subHp = ctx.createBiquadFilter();
    subHp.type = 'highpass';
    subHp.frequency.setValueAtTime(26, t0);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, t0);
    subGain.gain.linearRampToValueAtTime(0.85 * forca, t0 + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.8);

    subSrc.connect(subLp);
    subLp.connect(subHp);
    subHp.connect(subGain);
    subGain.connect(ganhoDry);
    subSrc.start(t0 + 0.02);
    subSrc.stop(t0 + dur * 0.85);
  } catch {
    /* som opcional */
  }
}
