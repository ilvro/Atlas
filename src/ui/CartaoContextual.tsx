import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { alternarLuzes, alternarPorta, desfazer, revelarPorta, trancarPorta, duplicarSelecao, removerSelecao, viewport } from '../app/app.ts';
import { modo } from '../app/modo.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { avisar } from '../app/toasts.ts';
import { tocar } from '../fx/som.ts';
import { caixaDe } from '../render/selecao.ts';
import { tentar } from './campos.tsx';
import { Amostra } from './campos-material.tsx';
import { Icone } from './Icone.tsx';
import { materiaisDo } from '../procedural/materiais.ts';
import { nomeDoAlvo } from '../domain/fabrica.ts';
import { secretaOculta } from '../domain/nevoa.ts';

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

const Acao = ({ icone, rotulo, aoClicar, perigo, id }: { icone: string; rotulo: string; aoClicar: () => void; perigo?: boolean; id?: string }) => (
  <button type="button" class={`cartao-acao ${perigo ? 'perigo' : ''}`} title={rotulo} aria-label={rotulo} onClick={aoClicar} data-testid={id}><Icone nome={icone} tamanho={16} /></button>
);

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
  if (emSessao && a.colecao !== 'openings') return null;       // na sessão o cartão só tem ações de porta (a 7.6a acrescenta as dos interativos)
  if (emSessao) {
    const o = m.openings[a.id]!, porta = o.kind === 'door' || o.kind === 'secret';
    acoes = porta ? (<>
      <Acao icone="porta" rotulo={o.state === 'open' ? 'Fechar a porta' : 'Abrir a porta'} aoClicar={() => alternarPorta(o.id)} id="cartao-abrir" />
      <Acao icone="secreta" rotulo={o.state === 'locked' ? 'Destrancar' : 'Trancar'} aoClicar={() => trancarPorta(o.id)} id="cartao-trancar" />
      {secretaOculta(m, o) && <button type="button" class="cartao-texto" title="Mostrar esta porta secreta aos jogadores" onClick={() => revelarPorta(o.id)} data-testid="cartao-revelar">Revelar aos jogadores</button>}
    </>) : <span class="cartao-texto">Sem folha para abrir</span>;
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
