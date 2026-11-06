import { signal } from '@preact/signals';
export { mapaNoProjetorId } from './projetor.ts';

export interface AbaMapa {
  id: string;
  nome: string;
  camera?: { x: number; y: number; zoom: number };
}

export const CHAVE_ABAS = 'atlas:abas-abertas';

export function carregarAbasDoStorage(): AbaMapa[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const bruto = localStorage.getItem(CHAVE_ABAS) ?? (localStorage as Record<string, string | undefined>)[CHAVE_ABAS];
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) return [];
    return dados.filter((item): item is AbaMapa => Boolean(item && typeof item.id === 'string' && typeof item.nome === 'string'));
  } catch {
    return [];
  }
}

function persistir(abas: AbaMapa[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const serializado = JSON.stringify(abas);
      localStorage.setItem(CHAVE_ABAS, serializado);
      try {
        (localStorage as Record<string, string>)[CHAVE_ABAS] = serializado;
      } catch {
        /* ignora */
      }
    }
  } catch {
    /* ignora */
  }
}

export const abasAbertas = signal<AbaMapa[]>(carregarAbasDoStorage());

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === CHAVE_ABAS) {
      abasAbertas.value = carregarAbasDoStorage();
    }
  });
}

export function registrarAbaAberta(id: string, nome: string): void {
  const lista = [...abasAbertas.value];
  const idx = lista.findIndex(a => a.id === id);
  if (idx >= 0) {
    const existente = lista[idx];
    if (existente && existente.nome !== nome) {
      lista[idx] = { ...existente, nome };
      abasAbertas.value = lista;
      persistir(lista);
    }
    return;
  }
  const nova: AbaMapa = { id, nome };
  lista.push(nova);
  abasAbertas.value = lista;
  persistir(lista);
}

export function atualizarNomeDaAba(id: string, nome: string): void {
  const lista = [...abasAbertas.value];
  const idx = lista.findIndex(a => a.id === id);
  if (idx < 0) return;
  const existente = lista[idx];
  if (!existente || existente.nome === nome) return;
  lista[idx] = { ...existente, nome };
  abasAbertas.value = lista;
  persistir(lista);
}

export function lembrarCameraDaAba(id: string, camera: { x: number; y: number; zoom: number }): void {
  const lista = [...abasAbertas.value];
  const idx = lista.findIndex(a => a.id === id);
  if (idx < 0) return;
  const existente = lista[idx];
  if (!existente) return;
  lista[idx] = { ...existente, camera: { x: camera.x, y: camera.y, zoom: camera.zoom } };
  abasAbertas.value = lista;
  persistir(lista);
}

export function obterCameraDaAba(id: string): { x: number; y: number; zoom: number } | undefined {
  const aba = abasAbertas.value.find(a => a.id === id);
  return aba?.camera ? { ...aba.camera } : undefined;
}

export function fecharAba(id: string): string | null {
  const lista = abasAbertas.value;
  const idx = lista.findIndex(a => a.id === id);
  if (idx < 0) return null;
  const novaLista = lista.filter(a => a.id !== id);
  abasAbertas.value = novaLista;
  persistir(novaLista);
  if (novaLista.length === 0) return null;
  const vizinhoIdx = Math.min(idx, novaLista.length - 1);
  const vizinho = novaLista[vizinhoIdx];
  return vizinho ? vizinho.id : null;
}
