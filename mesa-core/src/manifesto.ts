import { CATALOGO, CONTRATO } from './eventos.ts';
import { ehApp, partesDoId, type AppId, type Ref } from './refs.ts';

/**
 * `mesa.json`, na raiz de cada aplicativo: quem é, que links profundos aceita e o que emite e atende.
 * Os outros aplicativos o descobrem com `fetch('../Dossie/mesa.json')`.
 */
export interface Manifesto {
  app: AppId;
  nome: string;
  contrato: number;
  icone: string;
  /** Modelos de rota por tipo. Marcadores: `{id}` (tudo), `{pai}` e `{filho}` (id composto `<pai>/<filho>`). */
  rotas: Record<string, string>;
  oferece: string[];
  emite: string[];
  atende: string[];
}

export function validarManifesto(valor: unknown): { ok: true; manifesto: Manifesto } | { ok: false; erro: string } {
  if (!valor || typeof valor !== 'object') return { ok: false, erro: 'Manifesto não é um objeto.' };
  const m = valor as Record<string, unknown>;
  const permitidos = ['app', 'nome', 'contrato', 'icone', 'rotas', 'oferece', 'emite', 'atende'];
  const extra = Object.keys(m).find(k => !permitidos.includes(k));
  if (extra) return { ok: false, erro: `Campo desconhecido: ${extra}.` };
  if (!ehApp(m.app)) return { ok: false, erro: 'Aplicativo desconhecido.' };
  if (typeof m.nome !== 'string' || !m.nome.trim()) return { ok: false, erro: 'Falta o nome.' };
  if (m.contrato !== CONTRATO) return { ok: false, erro: `Contrato ${String(m.contrato)}; este entende ${CONTRATO}.` };
  if (typeof m.icone !== 'string') return { ok: false, erro: 'Falta o ícone.' };
  if (!m.rotas || typeof m.rotas !== 'object' || Array.isArray(m.rotas) || !Object.values(m.rotas).every(r => typeof r === 'string' && r.includes('{'))) return { ok: false, erro: 'Rotas inválidas: cada modelo precisa de um marcador.' };
  const lista = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
  if (!lista(m.oferece) || !lista(m.emite) || !lista(m.atende)) return { ok: false, erro: 'Listas inválidas.' };
  // Quem declara emitir ou atender precisa usar tipos do catálogo (e ser o dono, no caso de fatos).
  for (const tipo of m.emite as string[]) { const e = CATALOGO[tipo]; if (!e || e.natureza !== 'fato' || (e.dono !== m.app && tipo !== 'mesa.resposta')) return { ok: false, erro: `“${tipo}” não é um fato de ${m.app}.` }; }
  for (const tipo of m.atende as string[]) { const e = CATALOGO[tipo]; if (!e || e.natureza !== 'pedido' || e.dono !== m.app) return { ok: false, erro: `“${tipo}” não é um pedido de ${m.app}.` }; }
  return { ok: true, manifesto: m as unknown as Manifesto };
}

/** Preenche o modelo de rota; falta de marcador ou valor vazio é erro, nunca um link quebrado. */
export function resolverRota(modelo: string, id: string): string {
  const { pai, filho } = partesDoId(id), valores: Record<string, string> = { id, pai, filho };
  return modelo.replace(/\{([a-z]+)\}/g, (_, nome: string) => {
    const valor = valores[nome];
    if (!valor) throw new Error(`A rota “${modelo}” precisa de “${nome}”, ausente em “${id}”.`);
    return encodeURIComponent(valor).replace(/%2F/g, '/');
  });
}

/** Endereço absoluto de uma referência no aplicativo dono, ou `null` se ele não tem rota para o tipo. */
export function enderecoDaRef(manifesto: Manifesto, ref: Ref, base: string | URL): string | null {
  if (ref.app !== manifesto.app) return null;
  const modelo = manifesto.rotas[ref.tipo];
  return modelo ? new URL(resolverRota(modelo, ref.id), base).href : null;
}

/** `new URL('mesa.json', base)` do aplicativo vizinho, na mesma origem. */
export async function descobrir(base: string | URL, buscar: typeof fetch = fetch): Promise<Manifesto | null> {
  try {
    const resposta = await buscar(new URL('mesa.json', base));
    if (!resposta.ok) return null;
    const v = validarManifesto(await resposta.json());
    return v.ok ? v.manifesto : null;
  } catch { return null; }
}
