import { useEffect, useState } from 'preact/hooks';
import type { Iniciativa } from '../domain/iniciativa.ts';
import type { RefAsset } from '../domain/mapa.ts';

export interface PecaDaFaixa { name: string; portrait: RefAsset | null }

/** Retratos já lidos, por id de asset (a faixa é redesenhada a cada passo e não deve reler o banco). */
const retratos = new Map<string, Promise<string | null>>();
function urlDoRetrato(id: string, ler: (id: string) => Promise<Blob | null>): Promise<string | null> {
  let p = retratos.get(id);
  if (!p) { p = ler(id).then(b => { if (!b) retratos.delete(id); return b ? URL.createObjectURL(b) : null; }).catch(() => { retratos.delete(id); return null; }); retratos.set(id, p); }
  return p;
}

function Retrato({ peca, ler }: { peca: PecaDaFaixa; ler?: (id: string) => Promise<Blob | null> }) {
  const [url, definirUrl] = useState<string | null>(null), id = peca.portrait?.id ?? null;
  useEffect(() => { let vivo = true; if (id && ler) void urlDoRetrato(id, ler).then(u => { if (vivo) definirUrl(u); }); else definirUrl(null); return () => { vivo = false; }; }, [id, ler]);
  return url ? <img class="ini-retrato" src={url} alt="" /> : <span class="ini-retrato ini-inicial" aria-hidden="true">{(peca.name.trim()[0] ?? '?').toUpperCase()}</span>;
}

/**
 * A faixa de retratos da iniciativa: a ordem, quem joga agora e a rodada. O dock (com `aoEditarValor`) e o projetor (sem) usam este componente.
 */
export function FaixaDeIniciativa({ ini, pecas, lerRetrato, aoEditarValor }: { ini: Iniciativa; pecas: Record<string, PecaDaFaixa>; lerRetrato?: (id: string) => Promise<Blob | null>; aoEditarValor?: (tokenId: string, valor: number) => void }) {
  return (
    <div class="faixa-iniciativa" data-testid="faixa-iniciativa" role="list" aria-label="Ordem de iniciativa">
      <span class="ini-rodada" data-testid="iniciativa-rodada">Rodada {ini.round}</span>
      {ini.order.map((x, i) => {
        const p = pecas[x.tokenId]; if (!p) return null;
        return (
          <div key={x.tokenId} role="listitem" class={`ini-entrada ${i === ini.current ? 'atual' : ''}`} data-atual={i === ini.current} data-testid={`iniciativa-entrada-${x.tokenId}`} title={p.name}>
            <Retrato peca={p} ler={lerRetrato} />
            <span class="ini-nome">{p.name}</span>
            {aoEditarValor
              ? <input class="ini-valor" type="number" min={-999} max={999} aria-label={`Iniciativa de ${p.name}`} value={x.value} data-testid={`iniciativa-valor-${x.tokenId}`}
                  onChange={e => { const v = Number((e.target as HTMLInputElement).value); if (Number.isFinite(v)) aoEditarValor(x.tokenId, Math.max(-999, Math.min(999, v))); }} />
              : <span class="ini-valor">{x.value}</span>}
          </div>
        );
      })}
    </div>
  );
}
