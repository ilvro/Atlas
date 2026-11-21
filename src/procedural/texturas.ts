import { ErroDeValidacao } from '../domain/esquema.ts';

/** Uma textura de chão CC0, em ladrilho. Os arquivos ficam em `public/colecao/texturas/`. */
export interface TexturaDoCatalogo {
  /** Nome da pasta da fonte, em minúsculas (`ground068`). */
  id: string; nome: string;
  /** Relativo a `public/colecao/texturas/`. */
  arquivo: string;
  /** Mapa de deslocamento em tons de cinza (relativo à mesma pasta). */
  deslocamento?: string;
  /** Lado do ladrilho no mundo (m). */
  metros: number;
  /** Pixels por metro do arquivo (128). */
  pxPorMetro: number;
  fonte: string; autor: string; licenca: 'CC0'; url: string;
}

export interface CatalogoDeTexturas { versao: 1; hash: string; texturas: TexturaDoCatalogo[] }

const ehObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const falha = (m: string, c: string): never => { throw new ErroDeValidacao(m, c); };
const ARQUIVO = /^[A-Za-z0-9._-]+\.webp$/;

/** Confere o catálogo de texturas (puro). Devolve-o tipado ou lança `ErroDeValidacao`. */
export function validarCatalogo(bruto: unknown): CatalogoDeTexturas {
  if (!ehObj(bruto) || bruto.versao !== 1 || !Array.isArray(bruto.texturas)) return falha('O catálogo deve ser { versao: 1, hash, texturas: [...] }.', '');
  if (typeof bruto.hash !== 'string' || !bruto.hash) falha('Falta o hash.', 'hash');
  const ids = new Set<string>();
  (bruto.texturas as unknown[]).forEach((x, i) => {
    const c = `texturas[${i}]`;
    if (!ehObj(x)) return falha('Deve ser um objeto.', c);
    if (typeof x.id !== 'string' || !/^[a-z0-9][a-z0-9_.-]*$/.test(x.id)) falha('O id deve usar minúsculas, números, ponto, hífen e sublinhado.', `${c}.id`);
    if (ids.has(x.id as string)) falha(`Id repetido: ${String(x.id)}.`, `${c}.id`); ids.add(x.id as string);
    if (typeof x.nome !== 'string' || !x.nome) falha('Falta o nome.', `${c}.nome`);
    if (typeof x.arquivo !== 'string' || !ARQUIVO.test(x.arquivo)) falha('O arquivo deve ser um .webp relativo a public/colecao/texturas/.', `${c}.arquivo`);
    if (x.deslocamento !== undefined && (typeof x.deslocamento !== 'string' || !ARQUIVO.test(x.deslocamento))) falha('O deslocamento deve ser um .webp relativo a public/colecao/texturas/.', `${c}.deslocamento`);
    if (typeof x.metros !== 'number' || !Number.isFinite(x.metros) || x.metros <= 0) falha('Os metros devem ser um número maior que zero.', `${c}.metros`);
    if (typeof x.pxPorMetro !== 'number' || !Number.isFinite(x.pxPorMetro) || x.pxPorMetro <= 0) falha('pxPorMetro deve ser maior que zero.', `${c}.pxPorMetro`);
    if (x.licenca !== 'CC0') falha('Licença não aceita: só CC0.', `${c}.licenca`);
    for (const k of ['fonte', 'autor', 'url'] as const) if (typeof x[k] !== 'string' || !x[k]) falha(`Falta ${k}.`, `${c}.${k}`);
  });
  return bruto as unknown as CatalogoDeTexturas;
}
