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

/** Quais seções do dock estão abertas. */
const abertas = signal<Record<string, boolean>>({ clima: true, cena: true, presenca: false, iniciativa: false, projetor: false });
/** Os valores digitados antes de começar a iniciativa, por peça. */
const valoresIniciais = signal<Record<string, string>>({});

const DURACOES = [1, 3, 8, 20];

function Secao({ id, titulo, children }: { id: string; titulo: string; children: preact.ComponentChildren }) {
  const aberta = abertas.value[id] ?? false;
  return (
    <section class={`dock-secao ${aberta ? 'aberta' : ''}`} data-testid={`dock-secao-${id}`}>
      <button type="button" class="dock-titulo" aria-expanded={aberta} data-testid={`dock-titulo-${id}`} onClick={() => { abertas.value = { ...abertas.value, [id]: !aberta }; }}>{aberta ? '▾' : '▸'} {titulo}</button>
      {aberta && <div class="dock-corpo">{children}</div>}
    </section>
  );
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
    {conectado && caixaDoProjetor.value && <p class="dock-dica">Arraste o quadro azul no mapa (a borda move, os cantos redimensionam).</p>}
  </>);
}

/** O dock da sessão: pílulas flutuantes no pé do mapa, em seções que recolhem. Só existe no modo Sessão. */
export function Dock({ s }: { s: SessaoDeEdicao }) {
  return (
    <div class="dock" data-testid="dock" role="region" aria-label="Controles da sessão">
      <Secao id="clima" titulo="Clima"><SecaoDeClima s={s} /></Secao>
      <Secao id="cena" titulo="Cena"><SecaoDeCena /></Secao>
      <Secao id="presenca" titulo="Presença"><SecaoDePresenca s={s} /></Secao>
      <Secao id="iniciativa" titulo="Iniciativa"><SecaoDeIniciativa s={s} /></Secao>
      <Secao id="projetor" titulo="Projetor"><SecaoDoProjetor /></Secao>
    </div>
  );
}
