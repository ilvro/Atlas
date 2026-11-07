import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { Entidade } from '#mesa';
import { campanhaAtiva, escolherCampanha } from '../app/campanha.ts';
import { servicos, viewport } from '../app/app.ts';
import { adicionarPersonagem, ameacasComFicha, personagensComFicha, recursosDasFichas } from '../app/fichas.ts';
import { refDaFicha, textoDeRecursos } from '../domain/fichas.ts';
import { chaveDaRef } from '#mesa';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { tentar } from './campos.tsx';

const lista = signal<Entidade[]>([]);
const ameacas = signal<Entidade[]>([]);
const busca = signal('');
/** Quantas ameaças a lista mostra de uma vez: a campanha pode ter centenas (a Ficha traz as dela e as que você criar). A busca acha as outras. */
const LIMITE_DE_AMEACAS = 40;
const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
export const TIPO_ARRASTE = 'application/x-atlas-personagem';

async function carregar(): Promise<void> {
  const c = campanhaAtiva.peek(), r = servicos.peek()?.campanhas;
  if (!c || !r) { lista.value = []; ameacas.value = []; return; }
  try {
    lista.value = personagensComFicha(await r.listarEntidades(c.id, { tipo: 'personagem' }));
    ameacas.value = ameacasComFicha(await r.listarEntidades(c.id, { tipo: 'ameaca' }));
  } catch (erro) { console.warn('Atlas: não consegui listar os personagens', erro); lista.value = []; ameacas.value = []; }
}

/** Os personagens da campanha que têm ficha: arrastar para o mapa (ou "Pôr no mapa") cria a peça ligada à ficha. */
function Item({ s, e, pecas }: { s: SessaoDeEdicao; e: Entidade; pecas: SessaoDeEdicao['doc']['value']['tokens'] }) {
  const ameaca = e.tipo === 'ameaca', pref = ameaca ? 'ameaca' : 'personagem';
  const ref = refDaFicha(e.refs)!;
  const pecasDaEntidade = Object.values(pecas).filter(t => t.refs.some(r => chaveDaRef(r) === chaveDaRef(ref)));
  const noMapa = pecasDaEntidade.length > 0;
  const rec = recursosDasFichas.value[chaveDaRef(ref)];
  const textoBotao = ameaca
    ? (noMapa ? `+1 no mapa (×${pecasDaEntidade.length})` : 'Pôr no mapa')
    : (noMapa ? 'Selecionar' : 'Pôr no mapa');
  return (
    <div class={`personagem${ameaca ? ' ameaca' : ''}`} draggable data-testid={`${pref}-${e.id}`} title="Arraste para o mapa"
      onDragStart={ev => { ev.dataTransfer?.setData(TIPO_ARRASTE, e.id); ev.dataTransfer?.setData('text/plain', e.nome); }}>
      <span class="personagem-nome">{e.nome}</span>
      {rec && <span class="personagem-recursos" data-testid={`${pref}-recursos-${e.id}`}>{textoDeRecursos(rec)}</span>}
      <button type="button" class="botao-pilula" data-testid={`${pref}-por-${e.id}`} onClick={() => tentar(() => { adicionarPersonagem(s, e, viewport.atual?.centro(), servicos.value?.repo); })}>{textoBotao}</button>
    </div>
  );
}

/**
 * Os personagens da campanha que têm ficha e, abaixo, as ameaças (monstros) que a Ficha publicou: arrastar para o mapa (ou "Pôr no mapa") cria a peça
 * ligada à ficha. Tudo vem da campanha, ou seja, das fichas que existem na Ficha agora, inclusive as que você criar depois.
 */
export function Personagens({ s }: { s: SessaoDeEdicao }) {
  useEffect(() => {
    if (s.doc.value.campanhaId && s.doc.value.campanhaId !== campanhaAtiva.value?.id) {
      escolherCampanha(s.doc.value.campanhaId, servicos.value ?? undefined);
    }
  }, [s.doc.value.campanhaId]);

  useEffect(() => { void carregar(); }, [campanhaAtiva.value?.id]);
  const campanha = campanhaAtiva.value, pecas = s.doc.value.tokens;
  if (!campanha) return <p class="dock-dica" data-testid="personagens-vazio">Escolha uma campanha na aba Mapa para ver os personagens.</p>;
  const termo = semAcento(busca.value).trim(), achadas = ameacas.value.filter(e => !termo || semAcento(e.nome).includes(termo)), mostradas = achadas.slice(0, LIMITE_DE_AMEACAS);
  const vazio = lista.value.length === 0 && ameacas.value.length === 0;

  const aoCarregarIframe = () => {
    const t1 = setTimeout(() => void carregar(), 600);
    const t2 = setTimeout(() => void carregar(), 1500);
    if (typeof t1 === 'object' && t1 && 'unref' in t1) (t1 as any).unref();
    if (typeof t2 === 'object' && t2 && 'unref' in t2) (t2 as any).unref();
  };

  return (
    <div class="personagens" data-testid="personagens">
      {vazio ? (
        <>
          <p class="dock-dica" data-testid="personagens-vazio">Nenhum personagem com ficha nesta campanha ainda.</p>
          <iframe
            src="../Dossie/?compacto=1"
            title="Sincronização em segundo plano"
            style={{ display: 'none', width: 0, height: 0, border: 'none' }}
            onLoad={aoCarregarIframe}
          />
          <button
            type="button"
            class="botao-pilula"
            data-testid="abrir-dossie-btn"
            onClick={() => window.open('../Dossie/', '_blank')}
          >
            Abrir Dossiê
          </button>
        </>
      ) : (
        lista.value.length === 0 && <p class="dock-dica" data-testid="personagens-vazio">Nenhum personagem com ficha nesta campanha ainda.</p>
      )}
      {lista.value.map(e => <Item key={e.id} s={s} e={e} pecas={pecas} />)}
      {ameacas.value.length > 0 && (
        <section class="ameacas" data-testid="ameacas">
          <h4 class="dock-subtitulo">Ameaças <span class="meta">({ameacas.value.length})</span></h4>
          <input type="search" class="busca-ameacas" placeholder="Buscar ameaça" aria-label="Buscar ameaça" data-testid="ameacas-busca" value={busca.value} onInput={ev => { busca.value = (ev.target as HTMLInputElement).value; }} />
          {mostradas.map(e => <Item key={e.id} s={s} e={e} pecas={pecas} />)}
          {achadas.length === 0 && <p class="dock-dica" data-testid="ameacas-nenhuma">Nenhuma ameaça com esse nome.</p>}
          {achadas.length > mostradas.length && <p class="dock-dica" data-testid="ameacas-mais">Mostrando {mostradas.length} de {achadas.length}: use a busca.</p>}
        </section>
      )}
      <button type="button" class="botao-pilula" data-testid="personagens-atualizar" onClick={() => void carregar()}>Atualizar</button>
    </div>
  );
}

/** Solta um personagem arrastado sobre o mapa: a peça nasce onde foi solto. */
export function soltarPersonagem(s: SessaoDeEdicao, evento: DragEvent): void {
  const id = evento.dataTransfer?.getData(TIPO_ARRASTE); if (!id) return;
  evento.preventDefault();
  const e = [...lista.peek(), ...ameacas.peek()].find(x => x.id === id), mundo = viewport.atual?.mundoDe(evento.clientX, evento.clientY);
  if (e) tentar(() => { adicionarPersonagem(s, e, mundo, servicos.value?.repo); });
}
