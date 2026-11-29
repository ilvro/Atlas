import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { acaoDoInterativo } from '../domain/interagiveis.ts';
import { alternarLuzes, alternarPorta, usarObjeto, desfazer, revelarPorta, trancarPorta, duplicarSelecao, removerSelecao, viewport, servicos } from '../app/app.ts';
import { modo } from '../app/modo.ts';
import { fichaProjetadaId, projetarFicha } from '../app/projetor.ts';
import { abrirFicha, ajustarRecursos, ajustarRecursosDaPeca, recursosDaPeca, recursosDasFichas } from '../app/fichas.ts';
import { previaDaFichaAberta } from './PreviaDaFicha.tsx';
import { emEstadoCritico, fracao, interpretarAjusteDeRecurso, luzesDisponiveisParaPeca, refDaFicha, temPd, textoDeRecursos, type Recursos } from '../domain/fichas.ts';
import { ALCANCE_MIN_LUZ_PECA, alternarLuzDaPeca, atualizarLuzDaPeca, restaurarPadraoLuzDaPeca, rotuloDaLuz } from '../app/luz-da-peca.ts';
import type { Ref } from '#mesa';
import { chaveDaRef } from '#mesa';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import type { Peca } from '../domain/mapa.ts';
import { avisar } from '../app/toasts.ts';
import { tocar } from '../fx/som.ts';
import { caixaDe } from '../render/selecao.ts';
import { tentar } from './campos.tsx';
import { Amostra } from './campos-material.tsx';
import { Icone } from './Icone.tsx';
import { materiaisDo } from '../procedural/materiais.ts';
import { nomeDoAlvo } from '../domain/fabrica.ts';
import { secretaOculta } from '../domain/nevoa.ts';
import type { TransicaoDeMapa } from '../domain/mapa.ts';
import { transicaoDaAbertura, transicaoDoObjeto, transicaoPertoDaPeca } from '../domain/transicao-mapa.ts';
import { nomeDoMapaDestino, viajarParaMapa } from '../app/transicao-mapa.ts';

const posicao = signal<{ x: number; y: number; abaixo: boolean } | null>(null);

/** Segue a seleção na tela: o cartão fica colado ao item, onde o olho já está. */
function useSeguirSelecao(s: SessaoDeEdicao): void {
  useEffect(() => {
    let quadro = 0, ultimo = '';
    const laco = () => {
      const v = viewport.atual, alvo = s.selecao.peek()[0], m = s.store.documento, c = v && s.selecao.peek().length === 1 && alvo ? caixaDe(m, alvo) : null;
      if (!v || !c) { if (posicao.peek()) posicao.value = null; ultimo = ''; }
      else {
        const [x, y] = v.clientDe([(c.x0 + c.x1) / 2, c.y0]), [, y2] = v.clientDe([0, c.y1]), caixa = document.querySelector('[data-testid="area-do-mapa"]')?.getBoundingClientRect();
        const abaixo = !!caixa && y < caixa.top + 92, chave = `${Math.round(x)}|${Math.round(abaixo ? y2 : y)}|${abaixo}`;
        if (chave !== ultimo && caixa) { ultimo = chave; posicao.value = { x: Math.max(caixa.left + 150, Math.min(caixa.right - 150, x)), y: Math.max(caixa.top + 8, Math.min(caixa.bottom - 8, abaixo ? y2 : y)), abaixo }; }
      }
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => { cancelAnimationFrame(quadro); posicao.value = null; };
  }, [s]);
}

function ControlesDeRecursosToken({ s, peca, refFicha }: { s: SessaoDeEdicao; peca: Peca; refFicha: Ref }) {
  const [editandoPv, setEditandoPv] = useState(false);
  const [editandoPd, setEditandoPd] = useState(false);
  const b = servicos.peek()?.barramento;
  const tokenAtual = s.doc.value.tokens[peca.id] ?? peca;
  const rec = recursosDaPeca(tokenAtual);
  if (!rec) return null;

  const aplicarPv = (str: string) => {
    const res = interpretarAjusteDeRecurso(str);
    if (res) {
      ajustarRecursosDaPeca(s, tokenAtual, res.delta !== undefined ? { deltaPv: res.delta } : { pv: res.absoluto }, b);
      tocar('pop');
    }
    setEditandoPv(false);
  };

  const aplicarPd = (str: string) => {
    const res = interpretarAjusteDeRecurso(str);
    if (res) {
      ajustarRecursos(b, refFicha, res.delta !== undefined ? { deltaPd: res.delta } : { pd: res.absoluto });
      tocar('pop');
    }
    setEditandoPd(false);
  };

  const pctPv = Math.round(fracao(rec.pv, rec.pvMax) * 100);
  const critico = emEstadoCritico(rec);

  return (
    <div class="cartao-recursos-bloco" data-testid="cartao-recursos">
      <span class="cartao-recursos-resumo-oculto" style={{ display: 'none' }}>
        {textoDeRecursos(rec)}
      </span>
      {/* Linha de PV */}
      <div class="cartao-recurso-linha pv">
        <button
          type="button"
          class="cartao-btn-delta"
          title="Diminuir PV (-1, Shift: -5)"
          aria-label="Diminuir PV"
          data-testid="cartao-pv-menos"
          onClick={e => {
            e.stopPropagation();
            ajustarRecursosDaPeca(s, tokenAtual, { deltaPv: e.shiftKey ? -5 : -1 }, b);
            tocar('pop');
          }}
        >
          −
        </button>
        <div class="cartao-barra-trilho" title={`PV: ${rec.pv}/${rec.pvMax}`}>
          <div
            class={`cartao-barra-preenchimento pv ${critico ? 'critico' : ''}`}
            style={{ width: `${pctPv}%` }}
          />
          {editandoPv ? (
            <input
              type="text"
              class="cartao-input-recurso"
              data-testid="cartao-pv-input"
              autoFocus
              defaultValue={`${rec.pv}`}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter') aplicarPv((e.target as HTMLInputElement).value);
                else if (e.key === 'Escape') setEditandoPv(false);
              }}
              onBlur={e => aplicarPv((e.target as HTMLInputElement).value)}
            />
          ) : (
            <span
              class="cartao-barra-rotulo"
              onClick={e => {
                e.stopPropagation();
                setEditandoPv(true);
              }}
              title="Clique para ajustar PV (ex.: -5, +3 ou 18)"
            >
              PV {rec.pv}/{rec.pvMax}
            </span>
          )}
        </div>
        <button
          type="button"
          class="cartao-btn-delta"
          title="Aumentar PV (+1, Shift: +5)"
          aria-label="Aumentar PV"
          data-testid="cartao-pv-mais"
          onClick={e => {
            e.stopPropagation();
            ajustarRecursosDaPeca(s, tokenAtual, { deltaPv: e.shiftKey ? 5 : 1 }, b);
            tocar('pop');
          }}
        >
          +
        </button>
      </div>

      {/* Linha de PD (se houver) */}
      {temPd(rec) && (
        <div class="cartao-recurso-linha pd">
          <button
            type="button"
            class="cartao-btn-delta"
            title="Diminuir PD (-1, Shift: -5)"
            aria-label="Diminuir PD"
            data-testid="cartao-pd-menos"
            onClick={e => {
              e.stopPropagation();
              ajustarRecursos(b, refFicha, { deltaPd: e.shiftKey ? -5 : -1 });
              tocar('pop');
            }}
          >
            −
          </button>
          <div class="cartao-barra-trilho" title={`PD: ${rec.pd}/${rec.pdMax}`}>
            <div
              class="cartao-barra-preenchimento pd"
              style={{ width: `${Math.round(fracao(rec.pd, rec.pdMax) * 100)}%` }}
            />
            {editandoPd ? (
              <input
                type="text"
                class="cartao-input-recurso"
                data-testid="cartao-pd-input"
                autoFocus
                defaultValue={`${rec.pd}`}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') aplicarPd((e.target as HTMLInputElement).value);
                  else if (e.key === 'Escape') setEditandoPd(false);
                }}
                onBlur={e => aplicarPd((e.target as HTMLInputElement).value)}
              />
            ) : (
              <span
                class="cartao-barra-rotulo"
                onClick={e => {
                  e.stopPropagation();
                  setEditandoPd(true);
                }}
                title="Clique para ajustar PD (ex.: -2, +3 ou 10)"
              >
                PD {rec.pd}/{rec.pdMax}
              </span>
            )}
          </div>
          <button
            type="button"
            class="cartao-btn-delta"
            title="Aumentar PD (+1, Shift: +5)"
            aria-label="Aumentar PD"
            data-testid="cartao-pd-mais"
            onClick={e => {
              e.stopPropagation();
              ajustarRecursos(b, refFicha, { deltaPd: e.shiftKey ? 5 : 1 });
              tocar('pop');
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

const Acao = ({ icone, rotulo, aoClicar, perigo, id, ativo }: { icone: string; rotulo: string; aoClicar: () => void; perigo?: boolean; id?: string; ativo?: boolean }) => (
  <button type="button" class={`cartao-acao ${perigo ? 'perigo' : ''} ${ativo ? 'ativo' : ''}`} aria-pressed={ativo} title={rotulo} aria-label={rotulo} onClick={aoClicar} data-testid={id}><Icone nome={icone} tamanho={16} /></button>
);

function BotoesDeTransicaoDeMapa({ transicao, temJogadores, pecaId }: { transicao: TransicaoDeMapa; temJogadores: boolean; pecaId?: string }) {
  const destinoNome = nomeDoMapaDestino(transicao.toMapId, transicao.label);
  return (
    <>
      <button
        type="button"
        class="cartao-texto"
        data-testid="cartao-ir-mapa"
        onClick={() => void viajarParaMapa(transicao, { levarJogadores: false })}
      >
        ↗ Ir para {destinoNome}
      </button>
      {(temJogadores || pecaId) && (
        <button
          type="button"
          class="cartao-texto"
          data-testid="cartao-levar-grupo-mapa"
          onClick={() => void viajarParaMapa(transicao, { levarJogadores: true, ...(pecaId ? { pecaId } : {}) })}
        >
          👥 Levar grupo para {destinoNome}
        </button>
      )}
    </>
  );
}

/** O cartão contextual: nome do que está selecionado e as ações que fazem sentido ali, sem abrir painel. */
export function CartaoContextual({ s }: { s: SessaoDeEdicao }) {
  useSeguirSelecao(s);
  const a = s.selecao.value.length === 1 ? s.selecao.value[0]! : null, p = posicao.value, m = s.doc.value;
  // Com uma ferramenta de construção na mão, o cartão só atrapalharia os cliques de quem está pondo coisas.
  if (!a || !p || s.ferramenta.value !== 'selecionar') return null;
  const st = s.store, item = ((m[a.colecao] as unknown) as Record<string, { id: string }>)[a.id]; if (!item) return null;
  const editar = (fn: () => void) => { if (tentar(fn)) tocar('selecionar'); };
  let acoes = null;
  const emSessao = modo.value === 'sessao';
  const temJogadores = Object.values(m.tokens).some(t => t.player);
  if (emSessao && a.colecao === 'props') {
    const o = m.props[a.id]!;
    const transicao = transicaoDoObjeto(o);
    const interativo = o.interaction && o.interaction.kind !== 'stairs';
    acoes = (
      <>
        {interativo && <button type="button" class="cartao-texto" onClick={() => usarObjeto(o.id)} data-testid="cartao-usar">{acaoDoInterativo(o)}</button>}
        {transicao && <BotoesDeTransicaoDeMapa transicao={transicao} temJogadores={temJogadores} />}
        <Acao icone="lixeira" rotulo="Remover objeto (Del)" aoClicar={removerSelecao} perigo id="cartao-remover" />
      </>
    );
  } else if (emSessao && a.colecao === 'lights') {
    const l = m.lights[a.id]!;
    acoes = (<>
      <Acao icone="luz" rotulo={l.on ? 'Apagar luz (I)' : 'Acender luz (I)'} ativo={l.on} aoClicar={alternarLuzes} id="cartao-luz" />
      <Acao icone="lixeira" rotulo="Remover luz (Del)" aoClicar={removerSelecao} perigo id="cartao-remover" />
    </>);
  } else if (emSessao && a.colecao === 'tokens') {
    const token = m.tokens[a.id]!;
    const ref = refDaFicha(token.refs);
    const prox = transicaoPertoDaPeca(m, token);
    const rec = ref ? recursosDaPeca(token) : null;
    const infoLuz = luzesDisponiveisParaPeca(m, token, rec);
    const presetAtual = infoLuz.presetAtivo ?? infoLuz.presets[0] ?? 'lanterna';
    const nomeLuz = rotuloDaLuz(presetAtual);
    const luzDaPeca = token.lightId ? m.lights[token.lightId] : undefined;
    acoes = (<>
      <button
        type="button"
        class={`cartao-texto ${infoLuz.ativa ? 'ativo' : ''}`}
        data-testid="cartao-luz-peca"
        aria-pressed={infoLuz.ativa}
        title={infoLuz.ativa ? `Apagar ${nomeLuz} (L) · Q/E giram o facho` : `Acender ${nomeLuz} (L) · Q/E giram o facho`}
        onClick={() => {
          editar(() => { alternarLuzDaPeca(st, token.id, { recursos: rec }); });
        }}
      >
        🔦 {nomeLuz}
      </button>
      {luzDaPeca?.on && (
        <span class="cartao-luz-ajuste" data-testid="cartao-luz-ajuste">
          <label class="cartao-luz-alcance" title="Alcance da luz">
            <input
              type="range"
              data-testid="cartao-luz-alcance"
              aria-label="Alcance da luz"
              min={ALCANCE_MIN_LUZ_PECA}
              max={30}
              step={0.5}
              value={Math.min(30, luzDaPeca.radius)}
              onInput={e => { atualizarLuzDaPeca(st, token.id, { radius: Number((e.target as HTMLInputElement).value) }); }}
            />
            <output>{`${Number(luzDaPeca.radius.toFixed(1))}m`}</output>
          </label>
          <input
            type="color"
            class="cartao-luz-cor"
            data-testid="cartao-luz-cor"
            aria-label="Cor da luz"
            title="Cor da luz"
            value={luzDaPeca.color}
            onInput={e => { atualizarLuzDaPeca(st, token.id, { color: (e.target as HTMLInputElement).value }); }}
          />
          {luzDaPeca.preset && (
            <button type="button" class="cartao-texto" data-testid="cartao-luz-restaurar" title="Restaurar alcance e cor do item" aria-label="Restaurar alcance e cor padrão" onClick={() => { restaurarPadraoLuzDaPeca(st, token.id); }}>↺</button>
          )}
        </span>
      )}
      {rec?.luzes && rec.luzes.length > 1 && (
        <select
          class="cartao-select"
          data-testid="cartao-luz-preset"
          aria-label="Item de luz da ficha"
          title="Trocar item de luz da ficha"
          value={presetAtual}
          onChange={e => {
            const valor = (e.target as HTMLSelectElement).value;
            editar(() => { alternarLuzDaPeca(st, token.id, { preset: valor, recursos: rec }); });
          }}
        >
          {infoLuz.presets.map(id => <option key={id} value={id}>{rotuloDaLuz(id)}</option>)}
        </select>
      )}
      {ref && (rec ? (
        <ControlesDeRecursosToken s={s} peca={token} refFicha={ref} />
      ) : (
        <span class="cartao-texto" data-testid="cartao-recursos">Sem dados da ficha</span>
      ))}
      {ref && (
        <>
          <button
            type="button"
            class="cartao-texto"
            data-testid="cartao-alternar-estilo-token"
            title="Alternar estilo do token (Moeda / Imersivo)"
            onClick={() => {
              const estilo = (token.tokenStyle ?? 'coin') === 'coin' ? 'immersive' : 'coin';
              editar(() => st.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: token.id, patch: { tokenStyle: estilo } }, { rotulo: `Estilo do token: ${estilo}` }));
            }}
          >
            {(token.tokenStyle ?? 'coin') === 'coin' ? '◯' : '🧍'}
          </button>
          <button
            type="button"
            class={`cartao-texto cartao-espiar-btn ${previaDaFichaAberta.value ? 'ativo' : ''}`}
            data-testid="cartao-espiar-ficha"
            aria-pressed={previaDaFichaAberta.value}
            title="Espiar ficha ao lado do token"
            onClick={() => {
              previaDaFichaAberta.value = !previaDaFichaAberta.value;
              tocar('pop');
            }}
          >
            ▸ Ficha
          </button>
          <button type="button" class="cartao-texto" data-testid="cartao-abrir-ficha" onClick={() => void abrirFicha(servicos.peek()?.barramento, ref)}>Abrir ficha</button>
          {token.player && (() => {
            const jaProjetada = fichaProjetadaId.value === ref.id;
            return (
              <button
                type="button"
                class={`cartao-texto cartao-projetar-btn ${jaProjetada ? 'ativa' : ''}`}
                data-testid="cartao-projetar-ficha"
                aria-pressed={jaProjetada}
                title={jaProjetada ? 'Parar projeção da ficha na tela dos jogadores' : 'Projetar ficha em tela cheia na Activity'}
                onClick={() => {
                  projetarFicha(jaProjetada ? null : ref.id);
                  tocar('pop');
                }}
              >
                {jaProjetada ? 'Parar projeção' : 'Projetar Ficha'}
              </button>
            );
          })()}
        </>
      )}
      {prox && <BotoesDeTransicaoDeMapa transicao={prox.transicao} temJogadores={temJogadores} pecaId={token.id} />}
    </>);
  } else if (emSessao && a.colecao !== 'openings') return null;       // na sessão o cartão só tem ações de porta (a 7.6a acrescenta as dos interativos)
  else if (emSessao) {
    const o = m.openings[a.id]!, porta = o.kind === 'door' || o.kind === 'secret';
    const transicao = transicaoDaAbertura(o);
    acoes = (<>
      {porta ? (<>
        <Acao icone="porta" rotulo={o.state === 'open' ? 'Fechar a porta' : 'Abrir a porta'} aoClicar={() => alternarPorta(o.id)} id="cartao-abrir" />
        <Acao icone="secreta" rotulo={o.state === 'locked' ? 'Destrancar' : 'Trancar'} aoClicar={() => trancarPorta(o.id)} id="cartao-trancar" />
        {secretaOculta(m, o) && <button type="button" class="cartao-texto" title="Mostrar esta porta secreta aos jogadores" onClick={() => revelarPorta(o.id)} data-testid="cartao-revelar">Revelar aos jogadores</button>}
      </>) : (!transicao && <span class="cartao-texto">Sem folha para abrir</span>)}
      {transicao && <BotoesDeTransicaoDeMapa transicao={transicao} temJogadores={temJogadores} />}
    </>);
  } else if (a.colecao === 'rooms') {
    const r = m.rooms[a.id]!;
    acoes = (<>
      <label class="cartao-select" title="Piso"><Amostra id={r.floor.material} /><select aria-label="Piso" value={r.floor.material} onChange={e => editar(() => st.executar({ tipo: 'comodo.atualizar', id: r.id, patch: { floor: { material: (e.target as HTMLSelectElement).value } } }, { rotulo: 'Trocar o piso' }))}>{materiaisDo('piso').map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label class="cartao-select" title="Papel de parede">{r.wallpaper && <Amostra id={r.wallpaper.material} />}<select aria-label="Papel de parede" value={r.wallpaper?.material ?? ''} onChange={e => { const v = (e.target as HTMLSelectElement).value; editar(() => st.executar({ tipo: 'comodo.atualizar', id: r.id, patch: { wallpaper: v ? { material: v, seed: r.wallpaper?.seed ?? 1 } : null } }, { rotulo: 'Trocar o papel de parede' })); }}><option value="">Sem papel</option>{materiaisDo('papel').map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <Acao icone={(r.wallStyle ?? m.style.walls) === 'box' ? 'janela' : 'parede'} rotulo={(r.wallStyle ?? m.style.walls) === 'box' ? 'Paredes: caixa (clique para sólida)' : 'Paredes: sólidas (clique para caixa)'} aoClicar={() => editar(() => st.executar({ tipo: 'comodo.atualizar', id: r.id, patch: { wallStyle: (r.wallStyle ?? m.style.walls) === 'box' ? 'solid' : 'box' } }, { rotulo: 'Estilo das paredes' }))} id="cartao-estilo" />
      <Acao icone="lixeira" rotulo="Remover o cômodo" aoClicar={removerSelecao} perigo id="cartao-remover" />
    </>);
  } else if (a.colecao === 'openings') {
    const o = m.openings[a.id]!;
    const mudar = (patch: Record<string, unknown>, rotulo: string) => editar(() => st.executar({ tipo: 'abertura.atualizar', id: o.id, patch: patch as never }, { rotulo }));
    acoes = (<>
      {(o.kind === 'door' || o.kind === 'secret') && <Acao icone="porta" rotulo={o.state === 'open' ? 'Fechar a porta' : 'Abrir a porta'} aoClicar={() => mudar({ state: o.state === 'open' ? 'closed' : 'open' }, o.state === 'open' ? 'Fechar a porta' : 'Abrir a porta')} id="cartao-abrir" />}
      {(o.kind === 'door' || o.kind === 'secret') && <Acao icone="secreta" rotulo={o.state === 'locked' ? 'Destrancar' : 'Trancar'} aoClicar={() => mudar({ state: o.state === 'locked' ? 'closed' : 'locked' }, o.state === 'locked' ? 'Destrancar' : 'Trancar')} id="cartao-trancar" />}
      {o.kind === 'door' && <Acao icone="refazer" rotulo="Trocar o lado em que abre" aoClicar={() => mudar({ swing: o.swing === 'a' ? 'b' : 'a' }, 'Lado da porta')} id="cartao-lado" />}
      <Acao icone="lixeira" rotulo="Remover" aoClicar={removerSelecao} perigo id="cartao-remover" />
    </>);
  } else if (a.colecao === 'walls') {
    const w = m.walls[a.id]!;
    acoes = (<>
      {w.source && <button type="button" class="cartao-texto" title="A parede deixa de seguir o cômodo e passa a ser sua" onClick={() => editar(() => st.executar({ tipo: 'parede.desanexar', id: w.id }))} data-testid="cartao-desanexar">Desanexar</button>}
      {!w.source && <Acao icone="lixeira" rotulo="Remover a parede" aoClicar={removerSelecao} perigo id="cartao-remover" />}
    </>);
  } else if (a.colecao === 'tokens') {
    const token = m.tokens[a.id]!;
    const ref = refDaFicha(token.refs);
    acoes = (<>
      <button
        type="button"
        class="cartao-texto"
        data-testid="cartao-alternar-estilo-token"
        title="Alternar estilo do token (Moeda / Imersivo)"
        onClick={() => {
          const estilo = (token.tokenStyle ?? 'coin') === 'coin' ? 'immersive' : 'coin';
          editar(() => st.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: token.id, patch: { tokenStyle: estilo } }, { rotulo: `Estilo do token: ${estilo}` }));
        }}
      >
        {(token.tokenStyle ?? 'coin') === 'coin' ? '◯' : '🧍'}
      </button>
      {ref && (
        <button
          type="button"
          class={`cartao-texto cartao-espiar-btn ${previaDaFichaAberta.value ? 'ativo' : ''}`}
          data-testid="cartao-espiar-ficha"
          aria-pressed={previaDaFichaAberta.value}
          title="Espiar ficha ao lado do token"
          onClick={() => {
            previaDaFichaAberta.value = !previaDaFichaAberta.value;
            tocar('pop');
          }}
        >
          ▸ Ficha
        </button>
      )}
      <Acao icone="duplicar" rotulo="Duplicar" aoClicar={duplicarSelecao} /><Acao icone="lixeira" rotulo="Remover" aoClicar={removerSelecao} perigo id="cartao-remover" />
    </>);
  } else if (a.colecao === 'props') {
    acoes = (<>
      <Acao icone="desfazer" rotulo="Girar à esquerda (Q)" aoClicar={() => editar(() => st.executar({ tipo: 'item.atualizar', colecao: 'props', id: a.id, patch: { rotation: m.props[a.id]!.rotation - Math.PI / 2 } }, { rotulo: 'Girar' }))} id="cartao-girar-esq" />
      <Acao icone="refazer" rotulo="Girar à direita (E)" aoClicar={() => editar(() => st.executar({ tipo: 'item.atualizar', colecao: 'props', id: a.id, patch: { rotation: m.props[a.id]!.rotation + Math.PI / 2 } }, { rotulo: 'Girar' }))} id="cartao-girar-dir" />
      <Acao icone="duplicar" rotulo="Duplicar (Ctrl+D)" aoClicar={duplicarSelecao} id="cartao-duplicar" /><Acao icone="lixeira" rotulo="Remover" aoClicar={removerSelecao} perigo id="cartao-remover" />
    </>);
  } else if (a.colecao === 'lights') {
    const l = m.lights[a.id]!;
    acoes = (<>
      <Acao icone="luz" rotulo={l.on ? 'Apagar (I)' : 'Acender (I)'} aoClicar={alternarLuzes} id="cartao-luz" />
      <input type="color" class="cartao-cor" aria-label="Cor da luz" value={l.color} onInput={e => { const v = (e.target as HTMLInputElement).value; tentar(() => st.executar({ tipo: 'item.atualizar', colecao: 'lights', id: l.id, patch: { color: v, preset: null } }, { rotulo: 'Cor da luz' })); }} />
      <Acao icone="novo" rotulo="Aumentar o alcance" aoClicar={() => editar(() => st.executar({ tipo: 'item.atualizar', colecao: 'lights', id: l.id, patch: { radius: Math.min(200, l.radius + 1) } }, { rotulo: 'Alcance da luz' }))} id="cartao-mais" />
      <Acao icone="duplicar" rotulo="Duplicar" aoClicar={duplicarSelecao} /><Acao icone="lixeira" rotulo="Remover" aoClicar={removerSelecao} perigo id="cartao-remover" />
    </>);
  } else acoes = (<><Acao icone="duplicar" rotulo="Duplicar" aoClicar={duplicarSelecao} /><Acao icone="lixeira" rotulo="Remover" aoClicar={removerSelecao} perigo id="cartao-remover" /></>);
  void avisar; void desfazer;
  return (
    <div class={`cartao-contextual ${p.abaixo ? 'abaixo' : ''}`} style={{ left: `${p.x}px`, top: `${p.y}px` }} role="toolbar" aria-label="Ações do item" data-testid="cartao-contextual" key={`${a.colecao}:${a.id}`}>
      <span class="cartao-titulo">{nomeDoAlvo(a.colecao, item)}</span>{acoes}
    </div>
  );
}
