import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { Entidade } from '#mesa';
import { campanhaAtiva } from '../app/campanha.ts';
import { servicos, viewport } from '../app/app.ts';
import { adicionarPersonagem, personagensComFicha, recursosDasFichas } from '../app/fichas.ts';
import { refDaFicha } from '../domain/fichas.ts';
import { chaveDaRef } from '#mesa';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { tentar } from './campos.tsx';

const lista = signal<Entidade[]>([]);
export const TIPO_ARRASTE = 'application/x-atlas-personagem';

async function carregar(): Promise<void> {
  const c = campanhaAtiva.peek(), r = servicos.peek()?.campanhas;
  if (!c || !r) { lista.value = []; return; }
  try { lista.value = personagensComFicha(await r.listarEntidades(c.id, { tipo: 'personagem' })); } catch (erro) { console.warn('Atlas: não consegui listar os personagens', erro); lista.value = []; }
}

/** Os personagens da campanha que têm ficha: arrastar para o mapa (ou "Pôr no mapa") cria a peça ligada à ficha. */
export function Personagens({ s }: { s: SessaoDeEdicao }) {
  useEffect(() => { void carregar(); }, [campanhaAtiva.value?.id]);
  const campanha = campanhaAtiva.value, pecas = s.doc.value.tokens;
  if (!campanha) return <p class="dock-dica" data-testid="personagens-vazio">Escolha uma campanha na aba Mapa para ver os personagens.</p>;
  return (
    <div class="personagens" data-testid="personagens">
      {lista.value.length === 0 && <p class="dock-dica" data-testid="personagens-vazio">Nenhum personagem com ficha nesta campanha ainda.</p>}
      {lista.value.map(e => {
        const ref = refDaFicha(e.refs)!, noMapa = Object.values(pecas).some(t => t.refs.some(r => chaveDaRef(r) === chaveDaRef(ref))), rec = recursosDasFichas.value[chaveDaRef(ref)];
        return (
          <div key={e.id} class="personagem" draggable data-testid={`personagem-${e.id}`} title="Arraste para o mapa"
            onDragStart={ev => { ev.dataTransfer?.setData(TIPO_ARRASTE, e.id); ev.dataTransfer?.setData('text/plain', e.nome); }}>
            <span class="personagem-nome">{e.nome}</span>
            {rec && <span class="personagem-recursos" data-testid={`personagem-recursos-${e.id}`}>PV {rec.pv}/{rec.pvMax} · PD {rec.pd}/{rec.pdMax}</span>}
            <button type="button" class="botao-pilula" data-testid={`personagem-por-${e.id}`} onClick={() => tentar(() => { adicionarPersonagem(s, e, viewport.atual?.centro(), servicos.value?.repo); })}>{noMapa ? 'Selecionar' : 'Pôr no mapa'}</button>
          </div>
        );
      })}
      <button type="button" class="botao-pilula" data-testid="personagens-atualizar" onClick={() => void carregar()}>Atualizar</button>
    </div>
  );
}

/** Solta um personagem arrastado sobre o mapa: a peça nasce onde foi solto. */
export function soltarPersonagem(s: SessaoDeEdicao, evento: DragEvent): void {
  const id = evento.dataTransfer?.getData(TIPO_ARRASTE); if (!id) return;
  evento.preventDefault();
  const e = lista.peek().find(x => x.id === id), mundo = viewport.atual?.mundoDe(evento.clientX, evento.clientY);
  if (e) tentar(() => { adicionarPersonagem(s, e, mundo, servicos.value?.repo); });
}
