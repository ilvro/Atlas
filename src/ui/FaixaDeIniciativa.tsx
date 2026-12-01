import { useEffect, useState } from 'preact/hooks';
import type { Iniciativa } from '../domain/iniciativa.ts';
import type { RefAsset } from '../domain/mapa.ts';
import { Icone } from './Icone.tsx';

export interface PecaDaFaixa { name: string; portrait: RefAsset | null; player?: boolean }

export const MAX_RETRATOS = 100;

/** Retratos já lidos, por id de asset (a faixa é redesenhada a cada passo e não deve reler o banco). */
const retratos = new Map<string, Promise<string | null>>();

function revogarSeExistir(p: Promise<string | null> | undefined): void {
  p?.then(u => { if (u && typeof URL !== 'undefined') URL.revokeObjectURL?.(u); }).catch(() => {});
}

export function limparRetratos(): void {
  for (const p of retratos.values()) revogarSeExistir(p);
  retratos.clear();
}

export function urlDoRetrato(id: string, ler: (id: string) => Promise<Blob | null>): Promise<string | null> {
  let p = retratos.get(id);
  if (p) {
    retratos.delete(id);
    retratos.set(id, p);
  } else {
    p = ler(id)
      .then(b => {
        if (!b) {
          if (retratos.get(id) === p) retratos.delete(id);
          return null;
        }
        return URL.createObjectURL(b);
      })
      .catch(() => {
        if (retratos.get(id) === p) retratos.delete(id);
        return null;
      });
    retratos.set(id, p);
    while (retratos.size > MAX_RETRATOS) {
      const maisAntigo = retratos.keys().next().value;
      if (maisAntigo === undefined) break;
      const evitado = retratos.get(maisAntigo);
      retratos.delete(maisAntigo);
      revogarSeExistir(evitado);
    }
  }
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
export function FaixaDeIniciativa({
  ini,
  pecas,
  lerRetrato,
  aoEditarValor,
  aoFocarPeca,
}: {
  ini: Iniciativa;
  pecas: Record<string, PecaDaFaixa>;
  lerRetrato?: (id: string) => Promise<Blob | null>;
  aoEditarValor?: (tokenId: string, valor: number) => void;
  aoFocarPeca?: (tokenId: string) => void;
}) {
  return (
    <div class="faixa-iniciativa" data-testid="faixa-iniciativa" role="list" aria-label="Ordem de iniciativa">
      <span class="ini-rodada" data-testid="iniciativa-rodada">Rodada {ini.round}</span>
      {ini.order.map((x, i) => {
        const p = pecas[x.tokenId]; if (!p) return null;
        return (
          <div key={x.tokenId} role="listitem" class={`ini-entrada ${i === ini.current ? 'atual' : ''}`} data-atual={i === ini.current} data-testid={`iniciativa-entrada-${x.tokenId}`} title={p.name}>
            {aoFocarPeca && p.player && (
              <button
                type="button"
                class="ini-focar"
                aria-label={`Focar câmera em ${p.name}`}
                title={`Focar câmera da Activity em ${p.name}`}
                data-testid={`iniciativa-focar-${x.tokenId}`}
                onClick={e => { e.stopPropagation(); aoFocarPeca(x.tokenId); }}
              >
                <Icone nome="enquadrar" tamanho={11} />
              </button>
            )}
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
