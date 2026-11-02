/* eslint-disable @typescript-eslint/no-explicit-any */
// Rascunhos JSON copy-on-write, adaptados de Tabletop/src/state/immutable.js. Um rascunho é um Proxy que
// só copia o que for alterado; `finalizar` devolve um documento novo que compartilha o resto com o anterior.
// Os alvos do Proxy são vazios para que os descritores de objetos congelados não violem as invariantes.

interface Estado { base: any; copia: any; filhos: Map<string | symbol, any> }
const estados = new WeakMap<object, Estado>();
const ehObjeto = (v: unknown): v is object => v !== null && typeof v === 'object';

export function congelar<T>(valor: T): T {
  if (!ehObjeto(valor) || Object.isFrozen(valor)) return valor;
  for (const filho of Object.values(valor)) congelar(filho);
  return Object.freeze(valor);
}

/** Cópia profunda de JSON, aceitando rascunhos (lê o estado atual deles). */
export function clonar<T>(valor: T): T {
  if (!ehObjeto(valor)) return (valor === 0 ? 0 : valor) as T;
  const estado = estados.get(valor), fonte: any = estado ? estado.copia ?? estado.base : valor;
  if (Array.isArray(fonte)) return Array.from({ length: fonte.length }, (_, i) => clonar(estado?.filhos.get(String(i)) ?? fonte[i])) as T;
  if (Object.getPrototypeOf(fonte) !== Object.prototype) return structuredClone(fonte);
  return Object.fromEntries(Object.keys(fonte).map(k => [k, clonar(estado?.filhos.get(k) ?? fonte[k])])) as T;
}

export function criarRascunho<T extends object>(base: T): T {
  if (estados.has(base)) base = finalizar(base);
  const estado: Estado = { base, copia: null, filhos: new Map() };
  const copiar = () => (estado.copia ??= Array.isArray(base) ? base.slice() : { ...base });
  const proxy = new Proxy(Array.isArray(base) ? [] : {}, {
    get(_, chave) {
      const valor = (estado.copia ?? base as any)[chave];
      if (!ehObjeto(valor)) return valor;
      if (estados.has(valor)) return valor;
      if (!estado.filhos.has(chave)) estado.filhos.set(chave, criarRascunho(valor));
      return estado.filhos.get(chave);
    },
    set(_, chave, valor) {
      if (Object.is((estado.copia ?? base as any)[chave], valor)) return true;
      copiar()[chave] = valor; estado.filhos.delete(chave); return true;
    },
    deleteProperty(_, chave) {
      if (Object.hasOwn(estado.copia ?? base, chave)) { delete copiar()[chave]; estado.filhos.delete(chave); }
      return true;
    },
    has: (_, chave) => chave in (estado.copia ?? base),
    ownKeys: () => Reflect.ownKeys(estado.copia ?? base),
    getPrototypeOf: () => Object.getPrototypeOf(base),
    getOwnPropertyDescriptor(_, chave) {
      const d = Object.getOwnPropertyDescriptor(estado.copia ?? base, chave);
      return d && { value: d.value, writable: true, enumerable: d.enumerable, configurable: chave === 'length' && Array.isArray(base) ? false : true };
    },
  });
  estados.set(proxy, estado);
  return proxy as T;
}

export function finalizar<T>(valor: T): T {
  if (!ehObjeto(valor)) return valor;
  const estado = estados.get(valor);
  if (!estado && Object.isFrozen(valor)) return valor;
  const fonte: any = estado ? estado.copia ?? estado.base : valor;
  let resultado = fonte;
  const mudar = (chave: string, novo: unknown) => {
    if (Object.is(fonte[chave], novo)) return;
    if (resultado === fonte) resultado = Array.isArray(fonte) ? fonte.slice() : { ...fonte };
    resultado[chave] = novo;
  };
  if (estado) {
    for (const [chave, filho] of estado.filhos) if (Object.hasOwn(fonte, chave)) mudar(chave as string, finalizar(filho));
    if (estado.copia || !Object.isFrozen(estado.base)) for (const chave of Object.keys(fonte)) if (!estado.filhos.has(chave)) mudar(chave, finalizar(fonte[chave]));
    // Atribuições iguais não podem virar entrada de histórico.
    if (resultado !== estado.base && Object.keys(resultado).length === Object.keys(estado.base).length && Object.keys(resultado).every(k => Object.hasOwn(estado.base, k) && Object.is(resultado[k], estado.base[k]))) return estado.base;
  } else for (const chave of Object.keys(fonte)) mudar(chave, finalizar(fonte[chave]));
  return (estado ? compartilharIguais(estado.base, resultado) : resultado) as T;
}

/** Reaproveita do documento anterior tudo que ficou igual por valor, para a comparação por referência valer. */
function compartilharIguais(antes: any, depois: any): any {
  if (ehObjeto(antes) && estados.has(antes)) antes = finalizar(antes);
  if (ehObjeto(depois) && estados.has(depois)) depois = finalizar(depois);
  if (antes === depois || !ehObjeto(antes) || !ehObjeto(depois) || Array.isArray(antes) !== Array.isArray(depois)) return depois;
  antes = antes as Record<string, any>; depois = depois as Record<string, any>;
  const chaves = Object.keys(depois);
  let igual = chaves.length === Object.keys(antes).length, resultado = depois;
  for (const chave of chaves) {
    if (!Object.hasOwn(antes, chave)) { igual = false; continue; }
    const novo = compartilharIguais(antes[chave], depois[chave]);
    if (novo !== depois[chave]) { if (resultado === depois) resultado = Array.isArray(depois) ? depois.slice() : { ...depois }; resultado[chave] = novo; }
    igual &&= antes[chave] === novo;
  }
  return igual ? antes : resultado;
}

/** Aplica `fn` a um rascunho de `base` e devolve o documento novo, congelado. Se nada mudou, devolve `base`. */
export function produzir<T extends object>(base: T, fn: (rascunho: T) => void): T {
  const r = criarRascunho(base);
  fn(r);
  return congelar(finalizar(r));
}
