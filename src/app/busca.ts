/** Busca da paleta de comandos: sem acento, sem maiúsculas, por palavras e por letras em sequência. */
export const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Nota de 0 (não bate) em diante; maior é melhor. Início de palavra e correspondência exata valem mais. */
export function pontuar(consulta: string, alvo: string): number {
  const q = normalizar(consulta), t = normalizar(alvo);
  if (!q) return 1;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500 - t.length;
  const palavras = q.split(/\s+/);
  if (palavras.every(p => t.includes(p))) return 300 - t.indexOf(palavras[0]!) - t.length / 10;
  // Letras em sequência ("lzp" acha "luz pontual"), só para consultas curtas e sem espaço.
  if (q.length >= 2 && !/\s/.test(q)) {
    let i = 0, saltos = 0, ultimo = -1;
    for (const ch of q) { const j = t.indexOf(ch, i); if (j < 0) return 0; if (ultimo >= 0 && j !== ultimo + 1) saltos++; ultimo = j; i = j + 1; }
    return Math.max(1, 100 - saltos * 10 - t.length / 10);
  }
  return 0;
}

export function filtrar<T>(itens: readonly T[], consulta: string, texto: (item: T) => string): T[] {
  if (!normalizar(consulta)) return [...itens];
  return itens.map((item, i) => ({ item, i, nota: pontuar(consulta, texto(item)) })).filter(x => x.nota > 0).sort((a, b) => b.nota - a.nota || a.i - b.i).map(x => x.item);
}
