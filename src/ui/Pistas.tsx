import { useEffect, useMemo } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { servicos, viewport } from '../app/app.ts';
import { campanhaAtiva } from '../app/campanha.ts';
import {
  abrirDocumentoNoAtelie,
  acrescentarDocumentoNaCampanha,
  adicionarPista,
  documentosDaCampanhaAtiva,
  idsNaCampanha,
  pistas,
  pistasCarregadas,
  recarregarDocumentosDaCampanha,
  recarregarPistas,
} from '../app/pistas.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { refDaPista, type Pista } from '../data/pistas.ts';
import { tentar } from './campos.tsx';

export const TIPO_ARRASTE_PISTA = 'application/x-atlas-pista';

const aba = signal<'campanha' | 'todos'>('campanha');

/** A miniatura de um documento: uma URL de objeto da prévia, solta quando a lista muda. */
function Miniatura({ pista }: { pista: Pista }) {
  const url = useMemo(() => (pista.preview ? URL.createObjectURL(pista.preview) : null), [pista.preview]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url ? <img class="pista-miniatura" src={url} alt="" /> : <span class="pista-miniatura vazia" aria-hidden="true">📄</span>;
}

/** Item de documento com prévia, arrastável para o mapa. */
function ItemDePista({
  s,
  p,
  testId,
  extra,
}: {
  s: SessaoDeEdicao;
  p: Pista;
  testId?: string;
  extra?: ComponentChildren;
}) {
  return (
    <div
      class="pista"
      draggable
      data-testid={testId ?? `pista-${p.id}`}
      title="Arraste para o mapa"
      onDragStart={ev => {
        ev.dataTransfer?.setData(TIPO_ARRASTE_PISTA, p.id);
        ev.dataTransfer?.setData('text/plain', p.name);
      }}
    >
      <Miniatura pista={p} />
      <span class="pista-nome">
        {p.name}
        {p.hasUv && <b class="pista-uv" title="Tem camada de luz UV"> UV</b>}
      </span>
      {extra}
      <button
        type="button"
        class="botao-pilula"
        data-testid={`pista-por-${p.id}`}
        onClick={() => tentar(() => { adicionarPista(s, p, servicos.peek(), viewport.atual?.centro()); })}
      >
        Pôr no mapa
      </button>
    </div>
  );
}

/** Os documentos do Ateliê: arrastar para o mapa (ou "Pôr no mapa") cria um objeto-pista ligado ao documento. */
export function Pistas({ s }: { s: SessaoDeEdicao }) {
  useEffect(() => { void recarregarPistas(); }, []);
  useEffect(() => { void recarregarDocumentosDaCampanha(servicos.peek()); }, [campanhaAtiva.value?.id]);

  const campanha = campanhaAtiva.value;
  const abaAtual = campanha ? aba.value : 'todos';
  const lista = pistas.value;
  const docsCampanha = documentosDaCampanhaAtiva.value;
  const naCampanha = idsNaCampanha(docsCampanha);

  return (
    <div class="pistas" data-testid="pistas">
      {campanha && (
        <div class="pistas-abas" role="tablist" aria-label="Abas de documentos">
          <button
            type="button"
            class="botao-pilula"
            data-testid="documentos-aba-campanha"
            aria-pressed={abaAtual === 'campanha'}
            onClick={() => { aba.value = 'campanha'; }}
          >
            Da campanha
          </button>
          <button
            type="button"
            class="botao-pilula"
            data-testid="documentos-aba-todos"
            aria-pressed={abaAtual === 'todos'}
            onClick={() => { aba.value = 'todos'; }}
          >
            Todos
          </button>
        </div>
      )}

      {abaAtual === 'campanha' && (
        <>
          {docsCampanha.length === 0 && (
            <p class="dica" data-testid="documentos-campanha-vazio">
              Nenhum documento nesta campanha. Na aba Todos, use “+ Campanha”, ou ponha um documento no mapa.
            </p>
          )}
          {docsCampanha.map(doc => (
            doc.pista ? (
              <ItemDePista
                key={doc.idDoDocumento}
                s={s}
                p={doc.pista}
                testId={`documento-campanha-${doc.idDoDocumento}`}
              />
            ) : (
              <div
                key={doc.idDoDocumento}
                class="pista pista-pendente"
                data-testid={`documento-campanha-${doc.idDoDocumento}`}
              >
                <span class="pista-miniatura vazia" aria-hidden="true">📄</span>
                <span class="pista-nome">
                  {doc.entidade.nome}
                  <small>Ainda não entregue ao Atlas</small>
                </span>
                <button
                  type="button"
                  class="botao-pilula"
                  data-testid={`documento-abrir-${doc.idDoDocumento}`}
                  onClick={() => {
                    void abrirDocumentoNoAtelie(servicos.peek()?.barramento, refDaPista(doc.idDoDocumento));
                  }}
                >
                  Abrir no Ateliê
                </button>
              </div>
            )
          ))}
        </>
      )}

      {abaAtual === 'todos' && (
        <>
          {lista.length === 0 && (
            <p class="dica" data-testid="pistas-vazio">
              {pistasCarregadas.value
                ? 'Nenhum documento do Ateliê neste aparelho. Entregue um pelo Ateliê (Compartilhar com o Tabletop).'
                : 'Procurando os documentos do Ateliê…'}
            </p>
          )}
          {lista.map(p => (
            <ItemDePista
              key={p.id}
              s={s}
              p={p}
              extra={
                naCampanha.has(p.id) ? (
                  <b class="pista-na-campanha">Na campanha</b>
                ) : campanha ? (
                  <button
                    type="button"
                    class="botao-pilula"
                    data-testid={`pista-campanha-${p.id}`}
                    onClick={() => { void acrescentarDocumentoNaCampanha(servicos.peek(), p); }}
                  >
                    + Campanha
                  </button>
                ) : null
              }
            />
          ))}
        </>
      )}
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
