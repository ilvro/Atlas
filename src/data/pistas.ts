import { criarRef, type Ref } from '#mesa';

/**
 * Os documentos que o Ateliê entrega, lidos do banco de troca `mesa-handouts-v1` (contrato v1 do Ateliê com o Tabletop, só leitura):
 * `handouts` (resumos com a prévia) e `bakes` (o PNG assado em luz normal e sob luz UV). O Atlas nunca escreve ali.
 */
export const BANCO_DE_PISTAS = 'mesa-handouts-v1', CANAL_DE_PISTAS = 'mesa:handout';

export interface Pista {
  id: string; name: string; category: string; tags: string[]; revision: number; updatedAt: number; hasUv: boolean;
  /** O endereço base do Ateliê que gerou (para abrir o documento para editar). */
  source: string;
  preview: Blob | null;
}
export interface Assado { id: string; light: 'normal' | 'uv'; revision: number; blob: Blob; width: number; height: number }

/** O Ref de um documento do Ateliê (`mesa:atelie/documento/<id>`) e o caminho de volta. */
export const refDaPista = (id: string): Ref => criarRef('atelie', 'documento', id);
export const idDaPista = (ref: Ref | null | undefined): string | null => (ref && ref.app === 'atelie' && ref.tipo === 'documento' ? ref.id : null);

const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Aceita um registro do banco como `Pista`, ou `null` se não tem o mínimo (o banco é de outro aplicativo: nada é de se confiar). */
export function pistaDoRegistro(v: unknown): Pista | null {
  if (!ehObj(v) || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string') return null;
  return {
    id: v.id, name: v.name, category: typeof v.category === 'string' ? v.category : '', tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : [],
    revision: Number.isFinite(v.revision) ? v.revision as number : 0, updatedAt: Number.isFinite(v.updatedAt) ? v.updatedAt as number : 0, hasUv: v.hasUv === true,
    source: typeof v.source === 'string' ? v.source : '', preview: v.preview instanceof Blob ? v.preview : null,
  };
}

/**
 * Abre o banco de troca só se ele já existe: abrir um banco que não existe o criaria vazio, e o Ateliê (que o cria com as suas *stores*)
 * nunca mais passaria pelo upgrade. Devolve `null` se não existe ou se não tem as stores do contrato.
 */
async function abrir(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  if (typeof indexedDB.databases === 'function' && !(await indexedDB.databases()).some(d => d.name === BANCO_DE_PISTAS)) return null;
  return new Promise(resolver => {
    const pedido = indexedDB.open(BANCO_DE_PISTAS);
    pedido.onerror = () => resolver(null); pedido.onblocked = () => resolver(null);
    pedido.onsuccess = () => { const db = pedido.result; if (db.objectStoreNames.contains('handouts') && db.objectStoreNames.contains('bakes')) resolver(db); else { db.close(); resolver(null); } };
  });
}

const pedir = <T,>(p: IDBRequest<T>): Promise<T> => new Promise((ok, erro) => { p.onsuccess = () => ok(p.result); p.onerror = () => erro(p.error); });

/** Os documentos entregues, do mais recente para o mais antigo. Sem banco (ou sem o Ateliê neste navegador), lista vazia. */
export async function listarPistas(): Promise<Pista[]> {
  const db = await abrir(); if (!db) return [];
  try {
    const todos = await pedir(db.transaction('handouts', 'readonly').objectStore('handouts').getAll());
    return todos.map(pistaDoRegistro).filter((p): p is Pista => p !== null).sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  } catch (erro) { console.warn('Atlas: não consegui ler os documentos do Ateliê', erro); return []; }
  finally { db.close(); }
}

/** O PNG assado de um documento (luz normal ou UV), ou `undefined` se não existe. */
export async function lerAssado(id: string, light: 'normal' | 'uv'): Promise<Assado | undefined> {
  const db = await abrir(); if (!db) return undefined;
  try {
    const v = await pedir(db.transaction('bakes', 'readonly').objectStore('bakes').get([id, light]));
    return ehObj(v) && v.blob instanceof Blob ? { id, light, revision: Number.isFinite(v.revision) ? v.revision as number : 0, blob: v.blob, width: Number(v.width) || 0, height: Number(v.height) || 0 } : undefined;
  } catch { return undefined; } finally { db.close(); }
}

/** Avisa quando o Ateliê grava ou remove um documento (`BroadcastChannel('mesa:handout')`, contrato 1). Devolve o cancelamento. */
export function escutarPistas(aoMudar: (m: { tipo: 'handout-saved' | 'handout-removed'; id: string }) => void): () => void {
  if (typeof BroadcastChannel !== 'function') return () => {};
  const canal = new BroadcastChannel(CANAL_DE_PISTAS);
  canal.onmessage = e => { const m = e.data as unknown; if (ehObj(m) && m.app === 'atelie' && m.contract === 1 && (m.type === 'handout-saved' || m.type === 'handout-removed') && typeof m.id === 'string') aoMudar({ tipo: m.type, id: m.id }); };
  return () => canal.close();
}
