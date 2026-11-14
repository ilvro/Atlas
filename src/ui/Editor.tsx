import { recursosDaPeca } from '../app/fichas.ts';
import { TIPO_ARRASTE, soltarPersonagem } from './Personagens.tsx';
import { Inspecao } from './Inspecao.tsx';
import { TIPO_ARRASTE_PISTA, soltarPista } from './Pistas.tsx';
import { useEffect, useRef } from 'preact/hooks';
import { signal, useSignalEffect } from '@preact/signals';
import { acaoPorId, executarAcao, itensDoMenuRadial } from '../app/acoes.ts';
import { FERRAMENTAS_DA_SESSAO, alinhandoGrade, duracaoDoClima, modo, regraDaRegua, vistaAtual } from '../app/modo.ts';
import { acabamentoLigado, adicionarEm, alternarPorta, usarObjeto, aoColocar, focarNoComodo, focoPendente, menuRadial, notaDeObjetoAberta, servicos, sessao, viewport as viewportAtual } from '../app/app.ts';
import { obterCameraDaAba } from '../app/abas.ts';
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
import { Dock } from './Dock.tsx';
import { aspectoDoProjetor, caixaDoProjetor, mostrarQuadroDoProjetor, projetorConectado, seguirJogadores } from '../app/projetor.ts';
import { Inspetor } from './Inspetor.tsx';
import { PilulaDeSugestao } from './PilulaDeSugestao.tsx';
import { BarraInferior } from './BarraInferior.tsx';
import { BarraDeEfeitos } from './BarraDeEfeitos.tsx';
import { WidgetsDeTopo } from './WidgetsDeTopo.tsx';
import { PreviaDaFicha } from './PreviaDaFicha.tsx';
import { EditorDeMomento, momentoEmEdicao } from './Momentos.tsx';

const zoomPct = signal(100), cursorMundo = signal<[number, number] | null>(null), pintando = signal(0);

function ponteDa(s: SessaoDeEdicao): PonteViewport {
  const camSalva = !focoPendente.peek() ? obterCameraDaAba(s.doc.value.id) : undefined;
  return {
    store: s.store,
    cameraInicial: camSalva,
    selecao: () => s.selecao.peek(),
    definirSelecao: alvos => { s.selecao.value = alvos; tocar('selecionar'); },
    ferramenta: () => s.ferramenta.peek(),
    definirFerramenta: f => { s.ferramenta.value = f; s.biblioteca.value = ['comodo', 'parede', 'abertura', 'objeto', 'luz', 'terreno', 'presenca', 'espalhar'].includes(f); },
    pincel: () => s.pincel.peek(),
    definirPincel: p => { s.pincel.value = { ...s.pincel.peek(), ...p }; },
    adicionar: (colecao, mundo) => adicionarEm(colecao, mundo),
    aoColocar: (rotulo, mundo) => aoColocar(rotulo, mundo),
    aviso: texto => { avisar(texto, { tipo: 'erro', duracao: 3200 }); tocar('erro'); },
    aoMenuContexto: ({ tela, mundo, alvo }) => {
      if (modo.peek() === 'sessao') {
        if (!itensDoMenuRadial(alvo, mundo).length) return;
        menuRadial.value = { x: tela[0], y: tela[1], mundo, alvo, aberto: Date.now() };
        return;
      }
      // O clique direito sobre um item o seleciona (a menos que já faça parte da seleção).
      if (alvo && !s.selecao.peek().some(a => a.colecao === alvo.colecao && a.id === alvo.id)) s.selecao.value = [alvo];
      menuRadial.value = { x: tela[0], y: tela[1], mundo, alvo, aberto: Date.now() };
    },
    aoCamera: c => { zoomPct.value = Math.round((c.zoom / 20) * 100); },
    acabamento: () => acabamentoLigado.peek(),
    emSessao: () => modo.value === 'sessao',
    vista: vistaAtual,
    regraDaRegua: () => regraDaRegua.peek(),
    duracaoDaTransicao: () => duracaoDoClima.peek(),
    caixaDoProjetor: () => (mostrarQuadroDoProjetor.peek() && projetorConectado.peek() ? caixaDoProjetor.peek() : null),
    aspectoDoProjetor: () => aspectoDoProjetor.peek(),
    aoMudarCaixaDoProjetor: c => { seguirJogadores.value = false; caixaDoProjetor.value = c; },
    aoInteragir: alvo => { if (alvo.colecao === 'openings') alternarPorta(alvo.id); else if (alvo.colecao === 'props') usarObjeto(alvo.id); },
    lerRetrato: async id => (await servicos.peek()?.repo.obterAsset(id))?.blob ?? null,
    recursosDaPeca: t => recursosDaPeca(t),
    alinhandoGrade: () => alinhandoGrade.value,
  };
}

function AreaDoMapa({ s }: { s: SessaoDeEdicao }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vp: Viewport | null = null, morto = false;
    void criarViewport(ref.current!, ponteDa(s)).then(v => {
      if (morto) { v.destruir(); return; }
      vp = v; viewportAtual.atual = v; v.atualizarSobreposicoes(); focarNoComodo();
    }).catch(erro => { console.error('Atlas: o viewport não abriu', erro); avisar('Não consegui abrir o mapa na tela. Recarregue a página.', { tipo: 'erro', duracao: 8000 }); });
    return () => { morto = true; vp?.destruir(); if (viewportAtual.atual === vp) viewportAtual.atual = null; };
  }, [s]);
  // A seleção, a ferramenta e o pincel vivem em signals; o viewport só precisa saber que deve redesenhar as sobreposições.
  useSignalEffect(() => { s.selecao.value; s.ferramenta.value; s.pincel.value; acabamentoLigado.value; vistaAtual(); regraDaRegua.value; caixaDoProjetor.value; projetorConectado.value; mostrarQuadroDoProjetor.value; alinhandoGrade.value; viewportAtual.atual?.atualizarSobreposicoes(); });
  useSignalEffect(() => { const d = duracaoDoClima.value; if (d) viewportAtual.atual?.definirDuracaoDaTransicao(d); });
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
  return <div class="area-do-mapa" ref={ref} data-testid="area-do-mapa" data-ferramenta={s.ferramenta.value} onDragOver={e => { if (e.dataTransfer?.types.includes(TIPO_ARRASTE) || e.dataTransfer?.types.includes(TIPO_ARRASTE_PISTA)) e.preventDefault(); }} onDrop={e => { soltarPersonagem(s, e); soltarPista(s, e); }} />;
}

function BarraDeEstado({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, p = cursorMundo.value, n = s.selecao.value.length;
  const celula = p ? `${Math.floor((p[0] - m.grid.offset[0]) / m.grid.size)}, ${Math.floor((p[1] - m.grid.offset[1]) / m.grid.size)}` : '—';
  return (
    <footer class="barra-de-estado" data-testid="barra-de-estado">
      <span>{p ? `${encaixar(p[0], m.grid, 0, 0.5, !m.grid.snap).toFixed(2)} m, ${encaixar(p[1], m.grid, 1, 0.5, !m.grid.snap).toFixed(2)} m` : '— m'}</span>
      <span>célula {celula}</span>
      <span>{m.grid.size} m por célula · {m.bounds.width}×{m.bounds.height} m</span>
      <span class="espaco" />
      {pintando.value > 0 && <span class="pintando" data-testid="pintando" title="Pintando texturas em segundo plano"><i /> pintando…</span>}
      <span data-testid="contagem-selecao">{n ? `${n} selecionado(s)` : 'nada selecionado'}</span>
      <span data-testid="zoom">{zoomPct.value}%</span>
    </footer>
  );
}

function ModalNotaDeObjeto() {
  const nota = notaDeObjetoAberta.value;
  useEffect(() => {
    if (!nota) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        notaDeObjetoAberta.value = null;
      }
    };
    window.addEventListener('keydown', aoTecla, true);
    return () => window.removeEventListener('keydown', aoTecla, true);
  }, [nota]);

  if (!nota) return null;
  return (
    <div class="modal-nota-objeto-fundo" onClick={() => { notaDeObjetoAberta.value = null; }}>
      <div
        class="modal-nota-objeto"
        data-testid="modal-nota-objeto"
        onClick={e => e.stopPropagation()}
      >
        <header class="modal-nota-cabecalho">
          <div class="modal-nota-titulo-linha">
            <h3 class="modal-nota-titulo">{nota.titulo}</h3>
            {nota.gmOnly && <span class="selo-mestre" data-testid="selo-mestre">Só o mestre vê</span>}
          </div>
          <button
            type="button"
            class="modal-nota-fechar"
            data-testid="modal-nota-fechar"
            title="Fechar (Esc)"
            onClick={() => { notaDeObjetoAberta.value = null; }}
          >
            ✕
          </button>
        </header>
        <div class="modal-nota-corpo">
          <p class="modal-nota-texto">{nota.texto}</p>
        </div>
      </div>
    </div>
  );
}

export function Editor() {
  const s = sessao.value;
  if (!s) return null;
  return (
    <div class="editor" data-testid="editor">
      <Biblioteca s={s} />
      <div class="area-com-cartao">
        <AreaDoMapa s={s} />
        <WidgetsDeTopo s={s} />
        <CartaoContextual s={s} />
        <PreviaDaFicha s={s} />
        <BarraInferior s={s} />
        {modo.value === 'sessao' && <BarraDeEfeitos s={s} />}
        {modo.value === 'sessao' && <Dock s={s} />}
        {modo.value === 'sessao' && <Inspecao />}
        {modo.value === 'construir' && <PilulaDeSugestao s={s} />}
        <ModalNotaDeObjeto />
        {momentoEmEdicao.value && (
          <EditorDeMomento
            s={s}
            momento={momentoEmEdicao.value}
            aoFechar={() => { momentoEmEdicao.value = null; }}
          />
        )}
      </div>
      <Inspetor />
      <BarraDeEstado s={s} />
    </div>
  );
}
