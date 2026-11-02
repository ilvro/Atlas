/** Cores determinísticas por nome, para marcadores provisórios de cômodos, peças e materiais. */
function hash(texto: string): number { let h = 2166136261; for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function hslParaNumero(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

export const corDoNome = (nome: string, s = 0.45, l = 0.42): number => hslParaNumero(hash(nome) % 360, s, l);
export const hexParaNumero = (hex: string): number => parseInt(hex.replace('#', '').slice(0, 6), 16);
export const numeroParaHex = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
