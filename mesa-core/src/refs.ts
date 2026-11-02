/**
 * Referências: como qualquer aplicativo da mesa aponta para uma coisa de outro aplicativo.
 * Forma em texto, para links e notas: `mesa:ficha/ficha/sheet-1730…`, `mesa:atlas/comodo/<mapa>/<comodo>`.
 */

export const APPS = ['atlas', 'ficha', 'atelie', 'jukebox', 'tabletop', 'mesa'] as const;
export type AppId = (typeof APPS)[number];

export interface Ref {
  app: AppId;
  tipo: string;
  /** Estável e nunca reaproveitado. Tipos compostos usam `<pai>/<filho>` (ex.: cômodo de um mapa). */
  id: string;
  /** Só quando importa a versão exata (como os documentos assados do Ateliê). */
  rev?: number;
}

const TIPO = /^[a-z][a-z0-9-]{0,39}$/;
const FORMA = /^mesa:([a-z]+)\/([a-z][a-z0-9-]{0,39})\/(.+?)(?:@(\d+))?$/;

export const ehApp = (valor: unknown): valor is AppId => typeof valor === 'string' && (APPS as readonly string[]).includes(valor);

export function ehRef(valor: unknown): valor is Ref {
  if (!valor || typeof valor !== 'object') return false;
  const r = valor as Record<string, unknown>;
  const chaves = Object.keys(r);
  if (chaves.some(k => !['app', 'tipo', 'id', 'rev'].includes(k))) return false;
  return ehApp(r.app) && typeof r.tipo === 'string' && TIPO.test(r.tipo)
    && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 300 && !/\s/.test(r.id)
    && (r.rev === undefined || (Number.isInteger(r.rev) && (r.rev as number) >= 0));
}

export function criarRef(app: AppId, tipo: string, id: string, rev?: number): Ref {
  const ref: Ref = rev === undefined ? { app, tipo, id } : { app, tipo, id, rev };
  if (!ehRef(ref)) throw new Error(`Referência inválida: ${app}/${tipo}/${id}`);
  return ref;
}

/** `mesa:atlas/mapa/abc` ou `mesa:ateliê…@7` (revisão depois do arroba). */
export function formatarRef(ref: Ref): string {
  if (!ehRef(ref)) throw new Error('Referência inválida.');
  return `mesa:${ref.app}/${ref.tipo}/${ref.id}${ref.rev === undefined ? '' : `@${ref.rev}`}`;
}

/** Devolve `null` quando o texto não é uma referência da mesa. */
export function lerRef(texto: string): Ref | null {
  const m = FORMA.exec(texto.trim());
  if (!m) return null;
  const [, app, tipo, id, rev] = m;
  if (!app || !tipo || !id) return null;
  const ref: Ref = rev === undefined ? { app: app as AppId, tipo, id } : { app: app as AppId, tipo, id, rev: Number(rev) };
  return ehRef(ref) ? ref : null;
}

export const mesmaRef = (a: Ref, b: Ref, comRev = false): boolean =>
  a.app === b.app && a.tipo === b.tipo && a.id === b.id && (!comRev || a.rev === b.rev);

/** Chave estável para mapas e índices (sem revisão). */
export const chaveDaRef = (ref: Ref): string => `${ref.app}/${ref.tipo}/${ref.id}`;

/** Tipos compostos: `<pai>/<filho>`. `filho` é tudo depois da primeira barra. */
export function partesDoId(id: string): { id: string; pai: string; filho: string } {
  const i = id.indexOf('/');
  return i < 0 ? { id, pai: id, filho: '' } : { id, pai: id.slice(0, i), filho: id.slice(i + 1) };
}

/** Acha referências `mesa:…` dentro de um texto (notas), em ordem e sem repetir. */
export function acharRefs(texto: string): Ref[] {
  const vistos = new Set<string>(), saida: Ref[] = [];
  for (const m of texto.matchAll(/mesa:[a-z]+\/[a-z][a-z0-9-]{0,39}\/[^\s\])]+/g)) {
    // A pontuação do fim da frase não faz parte do id.
    const ref = lerRef(m[0].replace(/[.,;:!?]+$/, ''));
    if (ref && !vistos.has(formatarRef(ref))) { vistos.add(formatarRef(ref)); saida.push(ref); }
  }
  return saida;
}
