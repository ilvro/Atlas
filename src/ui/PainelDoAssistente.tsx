// Só em desenvolvimento: montado pelo selo (`SeloDoAssistente.tsx`), que só entra pelo módulo `app/ponte.ts`; o estilo vai num <style>, fora do build.
import { atividade, alvosDosIds, desfazerChamada, podeDesfazerChamada, type ChamadaDoAssistente } from '../app/atividade-do-assistente.ts';
import { sessao, viewport } from '../app/app.ts';
import { caixaDaSelecao, type Alvo } from '../render/selecao.ts';

const ESTILO = `
.painel-assistente { position: fixed; top: 58px; right: 14px; z-index: 40; width: 340px; max-height: min(70vh, 560px); display: flex; flex-direction: column; background: var(--painel); border: 1px solid var(--linha-forte); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.45); color: var(--texto); font: 12px/1.4 var(--corpo); overflow: hidden; }
.painel-assistente h2 { margin: 0; padding: 10px 14px; font: 700 11px var(--corpo); letter-spacing: .12em; text-transform: uppercase; color: var(--acento); border-bottom: 1px solid var(--linha); }
.painel-assistente .corpo { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.painel-assistente .vazio { padding: 14px 6px; color: var(--apagado); text-align: center; }
.painel-assistente .acoes { display: flex; gap: 6px; }
.painel-assistente .acoes .botao-pilula { padding: 4px 10px; font-size: 10px; }
.painel-assistente .item { padding: 7px 10px; border: 1px solid var(--linha); border-radius: var(--raio); background: var(--superficie); cursor: default; }
.painel-assistente .item.com-ids { cursor: pointer; }
.painel-assistente .item:hover { border-color: var(--acento); }
.painel-assistente .item.erro { border-color: color-mix(in srgb, var(--perigo), transparent 50%); }
.painel-assistente .linha { display: flex; align-items: baseline; gap: 8px; }
.painel-assistente .rotulo { font-weight: 700; flex: 1; }
.painel-assistente .hora { color: var(--apagado); font-size: 11px; }
.painel-assistente .detalhe { margin-top: 3px; color: var(--apagado); }
.painel-assistente .item.erro .detalhe { color: var(--perigo); }
.painel-assistente .aviso { margin-top: 5px; color: var(--apagado); font-style: italic; }
`;

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Destaque temporário no mapa: reaproveita o contorno da seleção e devolve a seleção do mestre ao sair. */
let selecaoGuardada: Alvo[] | null = null;
function destacar(c: ChamadaDoAssistente): void {
  const s = sessao.peek();
  if (!s || !c.ids.length) return;
  if (!selecaoGuardada) selecaoGuardada = s.selecao.peek();
  s.selecao.value = alvosDosIds(s.doc.peek(), c.ids);
}
function soltar(): void {
  const s = sessao.peek();
  if (s && selecaoGuardada) s.selecao.value = selecaoGuardada;
  selecaoGuardada = null;
}
function enquadrar(c: ChamadaDoAssistente): void {
  const s = sessao.peek(), v = viewport.atual;
  if (!s || !v) return;
  const caixa = caixaDaSelecao(s.doc.peek(), alvosDosIds(s.doc.peek(), c.ids));
  if (caixa) v.enquadrarCaixa({ x0: caixa.x0 - 2, y0: caixa.y0 - 2, x1: caixa.x1 + 2, y1: caixa.y1 + 2 }, true);
}

export function PainelDoAssistente() {
  const lista = atividade.value, s = sessao.value;
  return (
    <section class="painel-assistente" data-testid="painel-assistente" aria-label="Atividade do assistente" onMouseLeave={soltar}>
      <style>{ESTILO}</style>
      <h2>Assistente</h2>
      <div class="corpo">
        {!lista.length ? <div class="vazio">Nada por aqui ainda: as chamadas do assistente nesta aba aparecem aqui.</div> : null}
        {lista.map((c, i) => {
          const topo = podeDesfazerChamada(c, s?.store);
          return (
            <div key={c.n} class={`item ${c.ok ? '' : 'erro'} ${c.ids.length ? 'com-ids' : ''}`} data-testid="item-assistente" onMouseEnter={() => destacar(c)} onMouseLeave={soltar} onClick={() => enquadrar(c)}>
              <div class="linha"><span class="rotulo">{c.rotulo}</span><span class="hora">{hora(c.hora)}</span></div>
              {c.erro ? <div class="detalhe">{c.erro}</div> : c.ids.length ? <div class="detalhe">{c.ids.length} {c.ids.length === 1 ? 'item' : 'itens'}</div> : null}
              {i === 0 && c.ok && c.ref ? (topo
                ? <div class="acoes" style="margin-top:6px"><button type="button" class="botao-pilula" onClick={e => { e.stopPropagation(); desfazerChamada(c, s?.store); }} data-testid="desfazer-chamada">Desfazer</button></div>
                : <div class="aviso" data-testid="sem-desfazer">já há edições depois desta</div>) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
