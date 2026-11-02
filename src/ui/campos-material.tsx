import { materialDe, materiaisDo, type Material } from '../procedural/materiais.ts';
import { Linha } from './campos.tsx';

/** Uma amostra do material: base, claro e escuro lado a lado. */
export function Amostra({ id, tamanho = 18 }: { id: string; tamanho?: number }) {
  const m = materialDe(id);
  return <span class="amostra" style={{ width: `${tamanho}px`, height: `${tamanho}px`, background: `linear-gradient(135deg, ${m.claro} 0%, ${m.base} 50%, ${m.escuro} 100%)` }} aria-hidden="true" />;
}

export function CampoMaterial({ rotulo, dica, valor, uso, aoMudar, comNenhum }: { rotulo: string; dica?: string; valor: string | null; uso: Material['uso']; aoMudar: (v: string | null) => void; comNenhum?: string }) {
  return (
    <Linha rotulo={rotulo} dica={dica}>
      {valor && <Amostra id={valor} />}
      <select value={valor ?? ''} onChange={e => aoMudar((e.target as HTMLSelectElement).value || null)}>
        {comNenhum && <option value="">{comNenhum}</option>}
        {materiaisDo(uso).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </Linha>
  );
}
