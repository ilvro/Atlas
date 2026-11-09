import { signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { abrirProjetor, aplicarClima, dispararEventoDeCena, servicos } from '../app/app.ts';
import { caixaDoProjetor, mostrarQuadroDoProjetor, projetorConectado, seguirJogadores } from '../app/projetor.ts';
import { acaoPorId, executarAcao } from '../app/acoes.ts';
import { definirDuracaoDoClima, duracaoDoClima } from '../app/modo.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { PRESETS_DE_CLIMA } from '../domain/presets.ts';
import { EVENTOS_DE_CENA, ROTULO_DO_EVENTO } from '../render/eventos-de-cena.ts';
import { tocar } from '../fx/som.ts';
import { tentar } from './campos.tsx';
import { FaixaDeIniciativa } from './FaixaDeIniciativa.tsx';
import { amostraDoClima } from './Inspetor.tsx';
import { Personagens } from './Personagens.tsx';
import { Pistas } from './Pistas.tsx';
import { SecaoDeMomentos } from './Momentos.tsx';
import { embutido } from '../app/embutido.ts';
import { definirMostrarPvNoProjetor, mostrarPvNoProjetor } from '../app/fichas.ts';
import { Icone } from './Icone.tsx';

import { secoesAbertasNoDock, abrirSecaoNoDock, alternarSecaoNoDock } from '../app/dock.ts';
export { secoesAbertasNoDock, abrirSecaoNoDock, alternarSecaoNoDock };
const abertas = secoesAbertasNoDock;
/** Os valores digitados antes de começar a iniciativa, por peça. */
const valoresIniciais = signal<Record<string, string>>({});

const DURACOES = [1, 3, 8, 20];

const CHAVE_POSICOES = 'atlas:dock:posicoes';
function carregarPosicoes(): Record<string, { x: number; y: number }> {
  try {
    const s = localStorage.getItem(CHAVE_POSICOES);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}
function salvarPosicoes(p: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(CHAVE_POSICOES, JSON.stringify(p));
  } catch { /* ignora */ }
}

const posicoes = signal<Record<string, { x: number; y: number }>>(carregarPosicoes());
const zIndices = signal<Record<string, number>>({});
let topoZ = 25;

function trazerParaFrente(id: string) {
  topoZ += 1;
  zIndices.value = { ...zIndices.value, [id]: topoZ };
}

function redefinirPosicao(id: string) {
  const p = { ...posicoes.value };
  delete p[id];
  posicoes.value = p;
  salvarPosicoes(p);
  tocar('pop');
}

function obterDimensoesDoPai(): { largura: number; altura: number } {
  const dock = typeof document !== 'undefined' ? document.querySelector('.dock') : null;
  const ret = dock?.getBoundingClientRect();
  return {
    largura: ret?.width || (typeof window !== 'undefined' ? window.innerWidth - 370 : 800),
    altura: ret?.height || (typeof window !== 'undefined' ? window.innerHeight - 80 : 600),
  };
}

function posicaoPadrao(id: string): { x: number; y: number } {
  const { largura, altura } = obterDimensoesDoPai();
  switch (id) {
    case 'clima':
      return { x: Math.max(16, Math.round((largura - 680) / 2)), y: Math.max(16, altura - 230) };
    case 'cena':
      return { x: Math.max(16, Math.round((largura - 680) / 2) + 380), y: Math.max(16, altura - 150) };
    case 'presenca':
      return { x: 20, y: Math.max(16, altura - 250) };
    case 'iniciativa':
      return { x: Math.max(16, largura - 380), y: 20 };
    case 'personagens':
      return { x: Math.max(16, largura - 320), y: 140 };
    case 'pistas':
      return { x: 20, y: 30 };
    case 'momentos':
      return { x: 24, y: Math.max(20, altura - 380) };
    case 'editor-momento':
      return { x: Math.max(16, Math.round((largura - 460) / 2)), y: 40 };
    case 'projetor':
      return { x: Math.max(16, largura - 320), y: Math.max(16, altura - 220) };
    default:
      return { x: Math.max(16, Math.round((largura - 320) / 2)), y: Math.max(16, altura - 250) };
  }
}

function iniciarArrasto(id: string, ev: PointerEvent) {
  if ((ev.target as HTMLElement).closest('button, input, select, textarea, .dock-fechar')) return;
  ev.preventDefault();
  const alvo = ev.currentTarget as HTMLElement;
  const painel = alvo.closest('.dock-painel') as HTMLElement;
  if (!painel) return;

  trazerParaFrente(id);

  const dock = painel.closest('.dock') as HTMLElement;
  const retDock = dock ? dock.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const retPainel = painel.getBoundingClientRect();

  const deslX = ev.clientX - retPainel.left;
  const deslY = ev.clientY - retPainel.top;

  painel.classList.add('arrastando');

  const aoMover = (e: PointerEvent) => {
    const maxX = Math.max(10, retDock.width - retPainel.width - 10);
    const maxY = Math.max(10, retDock.height - retPainel.height - 10);
    const x = Math.max(10, Math.min(maxX, e.clientX - retDock.left - deslX));
    const y = Math.max(10, Math.min(maxY, e.clientY - retDock.top - deslY));
    posicoes.value = { ...posicoes.value, [id]: { x: Math.round(x), y: Math.round(y) } };
    salvarPosicoes(posicoes.value);
  };

  const aoSoltar = () => {
    painel.classList.remove('arrastando');
    window.removeEventListener('pointermove', aoMover);
    window.removeEventListener('pointerup', aoSoltar);
    window.removeEventListener('pointercancel', aoSoltar);
  };

  window.addEventListener('pointermove', aoMover);
  window.addEventListener('pointerup', aoSoltar);
  window.addEventListener('pointercancel', aoSoltar);
}

function SecaoDeClima({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, ativo = m.climate.preset, salvos = Object.values(m.customClimates), duracao = duracaoDoClima.value;
  const chip = (id: string, nome: string, c: Parameters<typeof amostraDoClima>[0], f: Parameters<typeof amostraDoClima>[1]) => (
    <button type="button" key={id} class={`dock-pilula ${ativo === id ? 'ativa' : ''}`} aria-pressed={ativo === id} data-testid={`dock-clima-${id}`} onClick={() => aplicarClima(id)}>
      <i class="amostra-clima" style={{ background: amostraDoClima(c, f) }} aria-hidden="true" />{nome}</button>
  );
  return (<>
    <div class="dock-linha">
      {PRESETS_DE_CLIMA.map(p => chip(p.id, p.nome, p.climate, p.finish))}
      {salvos.map(c => chip(c.id, c.name, c.climate, c.finish))}
    </div>
    <div class="dock-linha">
      <button type="button" class="dock-pilula" data-testid="dock-relampago" onClick={() => { const a = acaoPorId('relampago'); if (a) executarAcao(a); }}>⚡ Relâmpago</button>
      <span class="dock-rotulo">Frequência</span>
      {[
        { rotulo: 'Off', v: 0 },
        { rotulo: 'Raro', v: 0.25 },
        { rotulo: 'Médio', v: 0.55 },
        { rotulo: 'Intenso', v: 1.0 },
      ].map(opt => {
        const ativo = Math.abs(m.climate.weather.lightning - opt.v) < 0.1;
        return (
          <button
            type="button"
            key={opt.v}
            class={`dock-pilula ${ativo ? 'ativa' : ''}`}
            aria-pressed={ativo}
            data-testid={`dock-frequencia-relampago-${opt.v}`}
            onClick={() => s.store.executar({ tipo: 'clima.aplicar', patch: { weather: { lightning: opt.v } } }, { rotulo: `Relâmpagos: ${opt.rotulo}` })}
          >
            {opt.rotulo}
          </button>
        );
      })}
    </div>
    <div class="dock-linha">
      <span class="dock-rotulo">Transição</span>
      {DURACOES.map(d => <button type="button" key={d} class={`dock-pilula ${duracao === d * 1000 ? 'ativa' : ''}`} aria-pressed={duracao === d * 1000} data-testid={`dock-duracao-${d}`} onClick={() => definirDuracaoDoClima(d * 1000)}>{d} s</button>)}
    </div>
  </>);
}

function SecaoDeCena() {
  return (
    <div class="dock-linha">
      {EVENTOS_DE_CENA.map(e => <button type="button" key={e} class="dock-pilula" data-testid={`dock-evento-${e}`} onClick={() => dispararEventoDeCena(e)}>{ROTULO_DO_EVENTO[e]}</button>)}
    </div>
  );
}

/** Um controle de intensidade: arrastar é UM gesto (uma entrada de histórico), e a presença cresce ou recolhe ao vivo enquanto se arrasta. */
function ControleDePresenca({ s, id }: { s: SessaoDeEdicao; id: string }) {
  const p = s.doc.value.presence[id]; const gesto = useRef<ReturnType<SessaoDeEdicao['store']['iniciarGesto']> | null>(null);
  if (!p) return null;
  const aplicar = (v: number) => {
    if (!gesto.current) gesto.current = s.store.iniciarGesto(`Intensidade de ${p.brush}`);
    try { gesto.current.aplicar({ tipo: 'item.atualizar', colecao: 'presence', id, patch: { intensity: v } }); } catch { /* valor recusado */ }
  };
  const fechar = () => { const g = gesto.current; gesto.current = null; if (g?.ativo) g.concluir(); };
  return (
    <label class="dock-presenca"><span class="dock-rotulo">{p.brush}</span>
      <input type="range" min={0} max={1} step={0.05} value={p.intensity} data-testid={`dock-presenca-${id}`} aria-label={`Intensidade de ${p.brush}`}
        onInput={e => aplicar(Number((e.target as HTMLInputElement).value))} onPointerUp={fechar} onKeyUp={fechar} onBlur={fechar} onChange={fechar} />
      <span class="dock-valor">{Math.round(p.intensity * 100)}%</span></label>
  );
}

function SecaoDePresenca({ s }: { s: SessaoDeEdicao }) {
  const ids = Object.keys(s.doc.value.presence);
  return ids.length ? <div class="dock-coluna">{ids.map(id => <ControleDePresenca key={id} s={s} id={id} />)}</div> : <p class="dock-dica">Este mapa não tem presenças pintadas.</p>;
}

function SecaoDeIniciativa({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, ini = m.session.initiative, pecas = m.tokens;
  const lerRetrato = async (id: string) => (await servicos.peek()?.repo.obterAsset(id))?.blob ?? null;
  if (ini) {
    return (<>
      <FaixaDeIniciativa ini={ini} pecas={pecas} lerRetrato={lerRetrato} aoEditarValor={(tokenId, value) => tentar(() => s.store.executar({ tipo: 'iniciativa.valor', tokenId, value }))} />
      <div class="dock-linha">
        <button type="button" class="dock-pilula" aria-label="Vez anterior" data-testid="iniciativa-anterior" onClick={() => tentar(() => s.store.executar({ tipo: 'iniciativa.passo', passo: -1 }))}>‹</button>
        <button type="button" class="dock-pilula destaque" aria-label="Próxima vez" data-testid="iniciativa-proxima" onClick={() => { if (tentar(() => s.store.executar({ tipo: 'iniciativa.passo', passo: 1 }))) tocar('selecionar'); }}>›</button>
        <button type="button" class="dock-pilula" data-testid="iniciativa-encerrar" onClick={() => tentar(() => s.store.executar({ tipo: 'iniciativa.encerrar' }))}>Encerrar</button>
      </div>
    </>);
  }
  const selecionadas = s.selecao.value.filter(a => a.colecao === 'tokens' && pecas[a.id]).map(a => a.id), candidatas = selecionadas.length ? selecionadas : Object.keys(pecas);
  if (!candidatas.length) return <p class="dock-dica">Ponha peças no mapa (em Construir) para montar a iniciativa.</p>;
  const comecar = () => tentar(() => s.store.executar({ tipo: 'iniciativa.iniciar', entradas: candidatas.map(id => ({ tokenId: id, value: Number(valoresIniciais.value[id]) || 0 })) }, { rotulo: 'Começar a iniciativa' }));
  return (<>
    <p class="dock-dica">{selecionadas.length ? 'Peças selecionadas:' : 'Todas as peças (ou selecione algumas):'}</p>
    <div class="dock-linha">
      {candidatas.map(id => (
        <label key={id} class="dock-valor-ini"><span>{pecas[id]!.name}</span>
          <input type="number" min={-999} max={999} placeholder="0" aria-label={`Iniciativa de ${pecas[id]!.name}`} data-testid={`dock-iniciativa-valor-${id}`} value={valoresIniciais.value[id] ?? ''}
            onInput={e => { valoresIniciais.value = { ...valoresIniciais.value, [id]: (e.target as HTMLInputElement).value }; }} /></label>
      ))}
      <button type="button" class="dock-pilula destaque" data-testid="dock-iniciativa-comecar" onClick={comecar}>Começar</button>
    </div>
  </>);
}

function SecaoDoProjetor() {
  const conectado = projetorConectado.value;
  return (<>
    <div class="dock-linha">
      <button type="button" class="dock-pilula destaque" data-testid="dock-projetor-abrir" onClick={abrirProjetor}>Abrir o projetor</button>
      <span class="dock-rotulo" data-testid="dock-projetor-estado">{conectado ? 'Conectado' : 'Nenhum projetor aberto'}</span>
    </div>
    <div class="dock-linha">
      <button type="button" class={`dock-pilula ${seguirJogadores.value ? 'ativa' : ''}`} aria-pressed={seguirJogadores.value} data-testid="dock-projetor-seguir" onClick={() => { seguirJogadores.value = !seguirJogadores.value; }}>Seguir os jogadores</button>
      <button type="button" class={`dock-pilula ${mostrarQuadroDoProjetor.value ? 'ativa' : ''}`} aria-pressed={mostrarQuadroDoProjetor.value} data-testid="dock-projetor-quadro" onClick={() => { mostrarQuadroDoProjetor.value = !mostrarQuadroDoProjetor.value; }}>Mostrar o quadro</button>
    </div>
    <div class="dock-linha">
      <button type="button" class={`dock-pilula ${mostrarPvNoProjetor.value ? 'ativa' : ''}`} aria-pressed={mostrarPvNoProjetor.value} data-testid="dock-projetor-pv" title="Mostrar PV e PD das peças aos jogadores" onClick={() => definirMostrarPvNoProjetor(!mostrarPvNoProjetor.value)}>Mostrar PV no projetor</button>
    </div>
    {conectado && caixaDoProjetor.value && <p class="dock-dica">Arraste o quadro azul no mapa (a borda move, os cantos redimensionam).</p>}
  </>);
}

const SECOES = [
  { id: 'clima', titulo: 'Clima', icone: 'luz' },
  { id: 'cena', titulo: 'Cena', icone: 'anim' },
  { id: 'presenca', titulo: 'Presença', icone: 'presenca' },
  { id: 'momentos', titulo: 'Momentos', icone: 'anim' },
  { id: 'iniciativa', titulo: 'Iniciativa', icone: 'alvo' },
  { id: 'personagens', titulo: 'Personagens', icone: 'peca' },
  { id: 'pistas', titulo: 'Pistas', icone: 'olho' },
  { id: 'projetor', titulo: 'Projetor', icone: 'enquadrar' },
] as const;

export function PainelFlutuante({
  id,
  titulo,
  icone,
  onFechar,
  children,
}: {
  id: string;
  titulo: string;
  icone: string;
  onFechar: () => void;
  children: preact.ComponentChildren;
}) {
  const pos = posicoes.value[id] ?? posicaoPadrao(id);
  const padraoZ = id === 'editor-momento' ? 40 : 20;
  const z = zIndices.value[id] ?? padraoZ;

  return (
    <section
      class={`dock-painel dock-painel-${id} dock-secao aberta`}
      data-testid={`dock-secao-${id}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, zIndex: z }}
      onPointerDown={() => trazerParaFrente(id)}
    >
      <header
        class="dock-painel-cabecalho"
        onPointerDown={e => iniciarArrasto(id, e)}
        onDblClick={() => redefinirPosicao(id)}
        title="Arraste pelo cabeçalho para mover pelo mapa · Clique duplo restaura posição inicial"
      >
        <div class="dock-painel-titulo-grupo">
          <span class="dock-alca" aria-hidden="true">⠿</span>
          <Icone nome={icone} tamanho={13} />
          <span>{titulo}</span>
        </div>
        <div class="dock-painel-acoes">
          <button
            type="button"
            class="dock-painel-botao"
            title="Restaurar posição padrão"
            aria-label="Restaurar posição padrão"
            onClick={e => { e.stopPropagation(); redefinirPosicao(id); }}
          >
            ↺
          </button>
          <button
            type="button"
            class="dock-painel-botao dock-fechar"
            title="Fechar painel"
            aria-label={`Fechar ${titulo}`}
            onClick={e => { e.stopPropagation(); onFechar(); }}
          >
            <Icone nome="fechar" tamanho={12} />
          </button>
        </div>
      </header>
      <div class="dock-corpo">
        {children}
      </div>
    </section>
  );
}

/** O dock da sessão: barra de navegação no pé do mapa com painéis flutuantes móveis. Só existe no modo Sessão. */
export function Dock({ s }: { s: SessaoDeEdicao }) {
  const algumaAberta = Object.values(abertas.value).some(Boolean);

  const recolherTodos = () => {
    const fechadas: Record<string, boolean> = {};
    for (const k of Object.keys(abertas.value)) fechadas[k] = false;
    abertas.value = fechadas;
    tocar('pop');
  };

  const alternar = (id: string) => {
    const aberta = abertas.value[id] ?? false;
    abertas.value = { ...abertas.value, [id]: !aberta };
    if (!aberta) trazerParaFrente(id);
    tocar('selecionar');
  };

  return (
    <div class="dock" data-testid="dock" role="region" aria-label="Controles da sessão">
      {/* Barra de controle inferior (Dock Bar) */}
      <nav class="dock-barra" aria-label="Painéis da sessão">
        {SECOES.map(({ id, titulo, icone }) => {
          const aberta = abertas.value[id] ?? false;
          return (
            <button
              type="button"
              key={id}
              class={`dock-aba ${aberta ? 'ativa' : ''}`}
              aria-expanded={aberta}
              aria-pressed={aberta}
              title={`${titulo} (clique para abrir/fechar; arraste pelo cabeçalho)`}
              data-testid={`dock-titulo-${id}`}
              onClick={() => alternar(id)}
            >
              <Icone nome={icone} tamanho={14} />
              <span>{titulo}</span>
            </button>
          );
        })}
        {algumaAberta && (
          <button
            type="button"
            class="dock-aba dock-aba-recolher"
            title="Recolher todos os painéis abertos"
            aria-label="Recolher todos os painéis"
            onClick={recolherTodos}
          >
            <Icone nome="fechar" tamanho={12} />
            <span>Recolher</span>
          </button>
        )}
      </nav>

      {/* Painéis flutuantes móveis e independentes */}
      {SECOES.map(({ id, titulo, icone }) => {
        const aberta = abertas.value[id] ?? false;
        if (!aberta) return null;
        return (
          <PainelFlutuante key={id} id={id} titulo={titulo} icone={icone} onFechar={() => alternar(id)}>
            {id === 'clima' && <SecaoDeClima s={s} />}
            {id === 'cena' && <SecaoDeCena />}
            {id === 'presenca' && <SecaoDePresenca s={s} />}
            {id === 'momentos' && <SecaoDeMomentos s={s} />}
            {id === 'iniciativa' && <SecaoDeIniciativa s={s} />}
            {id === 'personagens' && <Personagens s={s} />}
            {id === 'pistas' && <Pistas s={s} />}
            {id === 'projetor' && <SecaoDoProjetor />}
          </PainelFlutuante>
        );
      })}
    </div>
  );
}
