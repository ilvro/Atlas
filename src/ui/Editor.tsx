import { useEffect, useRef } from 'preact/hooks';
import { signal, useSignalEffect } from '@preact/signals';
import { acaoPorId, executarAcao } from '../app/acoes.ts';
import { acabamentoLigado, adicionarEm, aoColocar, focarNoComodo, menuRadial, sessao, viewport as viewportAtual } from '../app/app.ts';
import { mostrarAtalho } from '../app/atalhos.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { tema } from '../app/tema.ts';
import { avisar } from '../app/toasts.ts';
import { tocar } from '../fx/som.ts';
import { encaixar } from '../render/grade.ts';
import { ROTULO_DA_FERRAMENTA, type Ferramenta } from '../render/pincel.ts';
import { criarViewport, type PonteViewport, type Viewport } from '../render/viewport.ts';
import { Biblioteca } from './Biblioteca.tsx';
import { CartaoContextual } from './CartaoContextual.tsx';
import { Icone } from './Icone.tsx';
import { Inspetor } from './Inspetor.tsx';

const FERRAMENTAS: { id: Ferramenta; icone: string }[] = [
  { id: 'selecionar', icone: 'selecionar' }, { id: 'mao', icone: 'mao' }, { id: 'comodo', icone: 'comodo' }, { id: 'borracha', icone: 'borracha' }, { id: 'parede', icone: 'parede' },
  { id: 'abertura', icone: 'porta' }, { id: 'objeto', icone: 'objeto' }, { id: 'luz', icone: 'luz' }, { id: 'peca', icone: 'peca' }, { id: 'regiao', icone: 'regiao' }, { id: 'terreno', icone: 'terreno' }, { id: 'presenca', icone: 'presenca' },
];

const zoomPct = signal(100), cursorMundo = signal<[number, number] | null>(null), pintando = signal(0);

function Ferramentas({ s }: { s: SessaoDeEdicao }) {
  return (
    <nav class="ferramentas" aria-label="Ferramentas">
      {FERRAMENTAS.map((f, i) => {
        const atalhos = acaoPorId(`ferr-${f.id}`)?.atalhos ?? [], letra = atalhos[0];
        return <button type="button" key={f.id} class={`ferramenta ${s.ferramenta.value === f.id ? 'ativa' : ''}`} aria-pressed={s.ferramenta.value === f.id} title={`${ROTULO_DA_FERRAMENTA[f.id]}${letra ? ` (${atalhos.map(mostrarAtalho).join(' ou ')})` : ''}`} data-testid={`ferramenta-${f.id}`}
          onClick={() => { const a = acaoPorId(`ferr-${f.id}`); if (a) executarAcao(a); }}><Icone nome={f.icone} tamanho={20} />{i < 9 && <span class="numero-ferramenta">{i + 1}</span>}</button>;
      })}
      <span class="espaco" />
      <button type="button" class={`ferramenta ${s.biblioteca.value ? 'ativa' : ''}`} aria-pressed={s.biblioteca.value} title="Biblioteca (B)" onClick={() => { s.biblioteca.value = !s.biblioteca.value; }} data-testid="alternar-biblioteca"><Icone nome="gaveta" tamanho={20} /></button>
      <button type="button" class="ferramenta" title="Enquadrar o mapa (F)" onClick={() => { const a = acaoPorId('enquadrar'); if (a) executarAcao(a); }} data-testid="enquadrar"><Icone nome="enquadrar" tamanho={20} /></button>
      <button type="button" class={`ferramenta ${s.doc.value.grid.visible ? 'ativa' : ''}`} aria-pressed={s.doc.value.grid.visible} title="Grade (G)" onClick={() => { const a = acaoPorId('grade'); if (a) executarAcao(a); }} data-testid="alternar-grade"><Icone nome="grade" tamanho={20} /></button>
    </nav>
  );
}

function ponteDa(s: SessaoDeEdicao): PonteViewport {
  return {
    store: s.store,
    selecao: () => s.selecao.peek(),
    definirSelecao: alvos => { s.selecao.value = alvos; tocar('selecionar'); },
    ferramenta: () => s.ferramenta.peek(),
    definirFerramenta: f => { s.ferramenta.value = f; s.biblioteca.value = ['comodo', 'parede', 'abertura', 'objeto', 'luz', 'terreno', 'presenca'].includes(f); },
    pincel: () => s.pincel.peek(),
    definirPincel: p => { s.pincel.value = { ...s.pincel.peek(), ...p }; },
    adicionar: (colecao, mundo) => adicionarEm(colecao, mundo),
    aoColocar: (rotulo, mundo) => aoColocar(rotulo, mundo),
    aviso: texto => { avisar(texto, { tipo: 'erro', duracao: 3200 }); tocar('erro'); },
    aoMenuContexto: ({ tela, mundo, alvo }) => {
      // O clique direito sobre um item o seleciona (a menos que já faça parte da seleção).
      if (alvo && !s.selecao.peek().some(a => a.colecao === alvo.colecao && a.id === alvo.id)) s.selecao.value = [alvo];
      menuRadial.value = { x: tela[0], y: tela[1], mundo, alvo, aberto: Date.now() };
    },
    aoCamera: c => { zoomPct.value = Math.round((c.zoom / 20) * 100); },
    acabamento: () => acabamentoLigado.peek(),
  };
}

function AreaDoMapa({ s }: { s: SessaoDeEdicao }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vp: Viewport | null = null, morto = false;
    void criarViewport(ref.current!, ponteDa(s)).then(v => {
      if (morto) { v.destruir(); return; }
      vp = v; viewportAtual.atual = v; focarNoComodo();
    }).catch(erro => { console.error('Atlas: o viewport não abriu', erro); avisar('Não consegui abrir o mapa na tela. Recarregue a página.', { tipo: 'erro', duracao: 8000 }); });
    return () => { morto = true; vp?.destruir(); if (viewportAtual.atual === vp) viewportAtual.atual = null; };
  }, [s]);
  // A seleção, a ferramenta e o pincel vivem em signals; o viewport só precisa saber que deve redesenhar as sobreposições.
  useSignalEffect(() => { s.selecao.value; s.ferramenta.value; s.pincel.value; acabamentoLigado.value; viewportAtual.atual?.atualizarSobreposicoes(); });
  useSignalEffect(() => { tema.value; requestAnimationFrame(() => viewportAtual.atual?.redesenhar()); });
  useEffect(() => {
    let quadro = 0;
    const laco = () => {
      const v = viewportAtual.atual, p = v?.ponteiro() ?? null, atual = cursorMundo.peek();
      if ((p?.[0] ?? null) !== (atual?.[0] ?? null) || (p?.[1] ?? null) !== (atual?.[1] ?? null)) cursorMundo.value = p ? [p[0], p[1]] : null;
      const n = v?.pintando ?? 0; if (n !== pintando.peek()) pintando.value = n;
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, []);
  return <div class="area-do-mapa" ref={ref} data-testid="area-do-mapa" data-ferramenta={s.ferramenta.value} />;
}

function BarraDeEstado({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, p = cursorMundo.value, n = s.selecao.value.length;
  const celula = p ? `${Math.floor((p[0] - m.grid.offset[0]) / m.grid.size)}, ${Math.floor((p[1] - m.grid.offset[1]) / m.grid.size)}` : '—';
  return (
    <footer class="barra-de-estado" data-testid="barra-de-estado">
      <span>{p ? `${encaixar(p[0], m.grid, 0, 0.5).toFixed(2)} m, ${encaixar(p[1], m.grid, 1, 0.5).toFixed(2)} m` : '— m'}</span>
      <span>célula {celula}</span>
      <span>{m.grid.size} m por célula · {m.bounds.width}×{m.bounds.height} m</span>
      <span class="espaco" />
      {pintando.value > 0 && <span class="pintando" data-testid="pintando" title="Pintando texturas em segundo plano"><i /> pintando…</span>}
      <span data-testid="contagem-selecao">{n ? `${n} selecionado(s)` : 'nada selecionado'}</span>
      <span data-testid="zoom">{zoomPct.value}%</span>
    </footer>
  );
}

export function Editor() {
  const s = sessao.value;
  if (!s) return null;
  return (
    <div class="editor" data-testid="editor">
      <Ferramentas s={s} />
      <Biblioteca s={s} />
      <div class="area-com-cartao"><AreaDoMapa s={s} /><CartaoContextual s={s} /></div>
      <Inspetor />
      <BarraDeEstado s={s} />
    </div>
  );
}
