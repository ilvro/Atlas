import { useEffect, useMemo } from 'preact/hooks';
import { servicos, viewport } from '../app/app.ts';
import { adicionarPista, pistas, pistasCarregadas, recarregarPistas } from '../app/pistas.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import type { Pista } from '../data/pistas.ts';
import { tentar } from './campos.tsx';

export const TIPO_ARRASTE_PISTA = 'application/x-atlas-pista';

/** A miniatura de um documento: uma URL de objeto da prévia, solta quando a lista muda. */
function Miniatura({ pista }: { pista: Pista }) {
  const url = useMemo(() => (pista.preview ? URL.createObjectURL(pista.preview) : null), [pista.preview]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url ? <img class="pista-miniatura" src={url} alt="" /> : <span class="pista-miniatura vazia" aria-hidden="true">📄</span>;
}

/** Os documentos do Ateliê: arrastar para o mapa (ou "Pôr no mapa") cria um objeto-pista ligado ao documento. */
export function Pistas({ s }: { s: SessaoDeEdicao }) {
  useEffect(() => { void recarregarPistas(); }, []);
  const lista = pistas.value;
  return (
    <div class="pistas" data-testid="pistas">
      {lista.length === 0 && <p class="dica" data-testid="pistas-vazio">{pistasCarregadas.value ? 'Nenhum documento do Ateliê neste navegador. Entregue um pelo Ateliê (Compartilhar com o Tabletop).' : 'Procurando os documentos do Ateliê…'}</p>}
      {lista.map(p => (
        <div key={p.id} class="pista" draggable data-testid={`pista-${p.id}`} title="Arraste para o mapa" onDragStart={ev => { ev.dataTransfer?.setData(TIPO_ARRASTE_PISTA, p.id); ev.dataTransfer?.setData('text/plain', p.name); }}>
          <Miniatura pista={p} />
          <span class="pista-nome">{p.name}{p.hasUv && <b class="pista-uv" title="Tem camada de luz UV"> UV</b>}</span>
          <button type="button" class="botao-pilula" data-testid={`pista-por-${p.id}`} onClick={() => tentar(() => { adicionarPista(s, p, servicos.peek(), viewport.atual?.centro()); })}>Pôr no mapa</button>
        </div>
      ))}
    </div>
  );
}

/** Solta uma pista arrastada sobre o mapa: o objeto nasce onde foi solto. */
export function soltarPista(s: SessaoDeEdicao, evento: DragEvent): void {
  const id = evento.dataTransfer?.getData(TIPO_ARRASTE_PISTA); if (!id) return;
  evento.preventDefault();
  const p = pistas.peek().find(x => x.id === id), mundo = viewport.atual?.mundoDe(evento.clientX, evento.clientY);
  if (p) tentar(() => { adicionarPista(s, p, servicos.peek(), mundo); });
}
