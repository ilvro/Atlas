/**
 * Validador declarativo mínimo. O esquema do documento é a documentação executável do formato:
 * campo desconhecido, tipo errado ou valor fora do limite sempre vira um erro com o caminho exato.
 */
export class ErroDeValidacao extends Error {
  readonly caminho: string;
  constructor(mensagem: string, caminho = '') {
    super(caminho ? `${caminho}: ${mensagem}` : mensagem);
    this.name = 'ErroDeValidacao';
    this.caminho = caminho;
  }
}

export interface Esq { verificar(valor: unknown, caminho: string): void; readonly opcional?: boolean }

const falha = (msg: string, caminho: string): never => { throw new ErroDeValidacao(msg, caminho); };
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export const e = {
  num: (o: { min?: number; max?: number; inteiro?: boolean } = {}): Esq => ({
    verificar(v, c) {
      if (typeof v !== 'number' || !Number.isFinite(v)) falha('Deve ser um número.', c);
      const n = v as number;
      if (o.inteiro && !Number.isInteger(n)) falha('Deve ser inteiro.', c);
      if (o.min !== undefined && n < o.min) falha(`Deve ser pelo menos ${o.min}.`, c);
      if (o.max !== undefined && n > o.max) falha(`Deve ser no máximo ${o.max}.`, c);
    },
  }),
  texto: (o: { min?: number; max?: number; padrao?: RegExp } = {}): Esq => ({
    verificar(v, c) {
      if (typeof v !== 'string') falha('Deve ser texto.', c);
      const s = v as string;
      if (s.length < (o.min ?? 0)) falha(`Deve ter pelo menos ${o.min} caractere(s).`, c);
      if (s.length > (o.max ?? 200)) falha(`Deve ter no máximo ${o.max ?? 200} caracteres.`, c);
      if (o.padrao && !o.padrao.test(s)) falha('Formato inválido.', c);
    },
  }),
  bool: (): Esq => ({ verificar(v, c) { if (typeof v !== 'boolean') falha('Deve ser verdadeiro ou falso.', c); } }),
  /** Um destes valores literais. */
  um: (...valores: (string | number | boolean | null)[]): Esq => ({
    verificar(v, c) { if (!valores.includes(v as never)) falha(`Valor inválido; opções: ${valores.map(String).join(', ')}.`, c); },
  }),
  nulo: (esq: Esq): Esq => ({ verificar(v, c) { if (v !== null) esq.verificar(v, c); } }),
  opt: (esq: Esq): Esq => ({ verificar: esq.verificar, opcional: true }),
  lista: (item: Esq, o: { min?: number; max?: number } = {}): Esq => ({
    verificar(v, c) {
      if (!Array.isArray(v)) return falha('Deve ser uma lista.', c);
      if (v.length < (o.min ?? 0)) falha(`Deve ter pelo menos ${o.min} item(ns).`, c);
      if (v.length > (o.max ?? 100_000)) falha(`Deve ter no máximo ${o.max ?? 100_000} itens.`, c);
      v.forEach((x, i) => item.verificar(x, `${c}[${i}]`));
    },
  }),
  tupla: (...itens: Esq[]): Esq => ({
    verificar(v, c) {
      if (!Array.isArray(v) || v.length !== itens.length) return falha(`Deve ter exatamente ${itens.length} itens.`, c);
      itens.forEach((esq, i) => esq.verificar(v[i], `${c}[${i}]`));
    },
  }),
  obj: (campos: Record<string, Esq>): Esq => ({
    verificar(v, c) {
      if (!ehObjeto(v)) return falha('Deve ser um objeto.', c);
      for (const k of Object.keys(v)) if (!(k in campos)) falha('Campo desconhecido.', c ? `${c}.${k}` : k);
      for (const [k, esq] of Object.entries(campos)) {
        if (!(k in v) || v[k] === undefined) { if (!esq.opcional) falha('Campo obrigatório ausente.', c ? `${c}.${k}` : k); continue; }
        esq.verificar(v[k], c ? `${c}.${k}` : k);
      }
    },
  }),
  /** Dicionário por identificador; a chave tem de ser igual ao `id` guardado no registro. */
  porId: (item: Esq, o: { max?: number } = {}): Esq => ({
    verificar(v, c) {
      if (!ehObjeto(v)) return falha('Deve ser um dicionário.', c);
      const chaves = Object.keys(v);
      if (chaves.length > (o.max ?? 50_000)) falha(`Deve ter no máximo ${o.max ?? 50_000} itens.`, c);
      for (const k of chaves) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(k)) falha('Identificador inválido.', `${c}.${k}`);
        item.verificar(v[k], `${c}.${k}`);
        if ((v[k] as { id?: unknown }).id !== k) falha('O campo “id” deve ser igual à chave.', `${c}.${k}.id`);
      }
    },
  }),
  /** Valor JSON livre (carga de uma região, parâmetros de uma receita), limitado em tamanho. */
  json: (maxBytes = 20_000): Esq => ({
    verificar(v, c) {
      let s: string | undefined;
      try { s = JSON.stringify(v); } catch { falha('Deve ser JSON.', c); }
      if (s === undefined) falha('Deve ser JSON.', c);
      if ((s as string).length > maxBytes) falha(`Grande demais (máximo ${maxBytes} caracteres).`, c);
    },
  }),
  /** Esquema escolhido por um campo do próprio objeto (união discriminada). */
  uniao: (campo: string, casos: Record<string, Esq>): Esq => ({
    verificar(v, c) {
      if (!ehObjeto(v)) return falha('Deve ser um objeto.', c);
      const esq = casos[String(v[campo])];
      if (!esq) return falha(`Valor inválido; opções: ${Object.keys(casos).join(', ')}.`, c ? `${c}.${campo}` : campo);
      esq.verificar(v, c);
    },
  }),
  /** Esquema escrito à mão, para casos que não cabem nos outros. */
  proprio: (f: (v: unknown, c: string) => void): Esq => ({ verificar: f }),
};

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const IDENT = /^[A-Za-z0-9_-]{1,64}$/;
