import { materialDe, materiaisDo, type Material } from '../procedural/materiais.ts';
import { signal } from '@preact/signals';
import { carregarCatalogo } from '../procedural/texturas-carregadas.ts';
import type { CatalogoDeTexturas } from '../procedural/texturas.ts';
import { fundoDaAmostra } from './fundo-de-amostra.ts';
import { Linha } from './campos.tsx';

const catalogoDasAmostras = signal<CatalogoDeTexturas | null>(null);
let pedido = false;
function pedirCatalogo(): void {
  if (pedido) return; pedido = true;
  void carregarCatalogo().then(c => { catalogoDasAmostras.value = c; });
}

/** Uma amostra do material: a textura (quando o material tem uma e o catálogo já chegou) ou base, claro e escuro lado a lado. */
export function Amostra({ id, tamanho = 18 }: { id: string; tamanho?: number }) {
  const m = materialDe(id);
  if (m.textura) pedirCatalogo();
  const fundo = fundoDaAmostra(m, m.textura ? catalogoDasAmostras.value : null, tamanho);
  return <span class="amostra" style={{ width: `${tamanho}px`, height: `${tamanho}px`, ...fundo }} aria-hidden="true" />;
}

export function CampoMaterial({ rotulo, dica, valor, uso, aoMudar, comNenhum }: { rotulo: string; dica?: string; valor: string | null; uso: Material['uso']; aoMudar: (v: string | null) => void; comNenhum?: string }) {
  const lista = materiaisDo(uso);
  const temValor = valor ? lista.some(m => m.id === valor) : false;
  return (
    <Linha rotulo={rotulo} dica={dica}>
      {valor && <Amostra id={valor} />}
      <select value={valor ?? ''} onChange={e => aoMudar((e.target as HTMLSelectElement).value || null)}>
        {comNenhum && <option value="">{comNenhum}</option>}
        {valor && !temValor && <option value={valor}>{materialDe(valor).nome}</option>}
        {lista.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </Linha>
  );
}
