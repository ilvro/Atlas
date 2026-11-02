import { useEffect, useRef } from 'preact/hooks';
import { signal, useSignalEffect } from '@preact/signals';
import { acaoPorId, executarAcao } from '../app/acoes.ts';
import { focarNoComodo, menuRadial, sessao, viewport as viewportAtual } from '../app/app.ts';
import { mostrarAtalho } from '../app/atalhos.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { tema } from '../app/tema.ts';
import { encaixar } from '../render/grade.ts';
import { criarViewport, type Ferramenta, type PonteViewport, type Viewport } from '../render/viewport.ts';
import { adicionarEm } from '../app/app.ts';
import { tocar } from '../fx/som.ts';
import { Icone } from './Icone.tsx';
import { Inspetor } from './Inspetor.tsx';

const FERRAMENTAS: { id: Ferramenta; nome: string; icone: string; acao: string }[] = [
  { id: 'selecionar', nome: 'Selecionar', icone: 'selecionar', acao: 'ferr-selecionar' },
  { id: 'mao', nome: 'Mover a vista', icone: 'mao', acao: 'ferr-mao' },
  { id: 'luz', nome: 'Adicionar luz', icone: 'luz', acao: 'ferr-luz' },
  { id: 'objeto', nome: 'Adicionar objeto', icone: 'objeto', acao: 'ferr-objeto' },
  { id: 'peca', nome: 'Adicionar peça', icone: 'peca', acao: 'ferr-peca' },
  { id: 'regiao', nome: 'Adicionar região', icone: 'regiao', acao: 'ferr-regiao' },
];

const zoomPct = signal(100), cursorMundo = signal<[number, number] | null>(null);

function Ferramentas({ s }: { s: SessaoDeEdicao }) {
  return (
    <nav class="ferramentas" aria-label="Ferramentas">
      {FERRAMENTAS.map((f, i) => {
        const atalho = acaoPorId(f.acao)?.atalhos?.[0];
        return <button type="button" key={f.id} class={`ferramenta ${s.ferramenta.value === f.id ? 'ativa' : ''}`} aria-pressed={s.ferramenta.value === f.id} title={`${f.nome}${atalho ? ` (${mostrarAtalho(atalho)} ou ${i + 1})` : ''}`} data-testid={`ferramenta-${f.id}`} onClick={() => { const a = acaoPorId(f.acao); if (a) executarAcao(a); }}><Icone nome={f.icone} tamanho={20} /><span class="numero-ferramenta">{i + 1}</span></button>;
      })}
      <span class="espaco" />
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
    definirFerramenta: f => { s.ferramenta.value = f; },
    adicionar: (colecao, mundo) => adicionarEm(colecao, mundo),
    aoMenuContexto: ({ tela, mundo, alvo }) => {
      // O clique direito sobre um item o seleciona (a menos que já faça parte da seleção).
      if (alvo && !s.selecao.peek().some(a => a.colecao === alvo.colecao && a.id === alvo.id)) s.selecao.value = [alvo];
      menuRadial.value = { x: tela[0], y: tela[1], mundo, alvo, aberto: Date.now() }; },
    aoCamera: c => { zoomPct.value = Math.round((c.zoom / 20) * 100); },
  };
}

function AreaDoMapa({ s }: { s: SessaoDeEdicao }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vp: Viewport | null = null, morto = false;
    void criarViewport(ref.current!, ponteDa(s)).then(v => {
      if (morto) { v.destruir(); return; }
      vp = v; viewportAtual.atual = v; focarNoComodo();
    });
    return () => { morto = true; vp?.destruir(); if (viewportAtual.atual === vp) viewportAtual.atual = null; };
  }, [s]);
  // A seleção e a ferramenta vivem em signals; o viewport só precisa saber que deve redesenhar as sobreposições.
  useSignalEffect(() => { s.selecao.value; s.ferramenta.value; viewportAtual.atual?.atualizarSobreposicoes(); });
  useSignalEffect(() => { tema.value; requestAnimationFrame(() => viewportAtual.atual?.redesenhar()); });
  useEffect(() => {
    let quadro = 0;
    const laco = () => {
      const p = viewportAtual.atual?.ponteiro() ?? null, atual = cursorMundo.peek();
      if ((p?.[0] ?? null) !== (atual?.[0] ?? null) || (p?.[1] ?? null) !== (atual?.[1] ?? null)) cursorMundo.value = p ? [p[0], p[1]] : null;
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
      <AreaDoMapa s={s} />
      <Inspetor />
      <BarraDeEstado s={s} />
    </div>
  );
}
