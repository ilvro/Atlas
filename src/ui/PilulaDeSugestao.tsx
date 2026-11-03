import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { menuRadial, paletaAberta, viewport } from '../app/app.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { aceitarSugestao, comodoEmFoco, dispensarSugestao, outraSugestao, sugestao, sugestoesLigadas } from '../app/sugestoes.ts';
import { TIPOS_DE_SUGESTAO, textoDaSugestao } from '../authoring/sugestoes.ts';
import { caixaDe } from '../render/selecao.ts';
import { Icone } from './Icone.tsx';

const posicao = signal<{ x: number; y: number; abaixo: boolean } | null>(null);

/** Cola a pílula ao cômodo em foco: no topo dele, ou embaixo se o cartão contextual já ocupa o topo. */
function useSeguirComodo(s: SessaoDeEdicao): void {
  useEffect(() => {
    let quadro = 0, ultimo = '';
    const laco = () => {
      const v = viewport.atual, id = comodoEmFoco.peek(), m = s.store.documento, c = v && id ? caixaDe(m, { colecao: 'rooms', id }) : null;
      if (!v || !c) { if (posicao.peek()) posicao.value = null; ultimo = ''; }
      else {
        const doCartao = s.selecao.peek().length === 1 && s.selecao.peek()[0]!.id === id && s.ferramenta.peek() === 'selecionar';
        const [x, y] = v.clientDe([(c.x0 + c.x1) / 2, c.y0]), [, y2] = v.clientDe([0, c.y1]), caixa = document.querySelector('[data-testid="area-do-mapa"]')?.getBoundingClientRect();
        const abaixo = doCartao || (!!caixa && y < caixa.top + 56), alvoY = abaixo ? y2 : y, chave = `${Math.round(x)}|${Math.round(alvoY)}|${abaixo}`;
        if (chave !== ultimo && caixa) { ultimo = chave; posicao.value = { x: Math.max(caixa.left + 170, Math.min(caixa.right - 170, x)), y: Math.max(caixa.top + 8, Math.min(caixa.bottom - 40, alvoY)), abaixo }; }
      }
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => { cancelAnimationFrame(quadro); posicao.value = null; };
  }, [s]);
}

/** A sugestão do assistente: uma pílula discreta junto do cômodo. O texto aceita; ↻ pede outra; ✕ dispensa. */
export function PilulaDeSugestao({ s }: { s: SessaoDeEdicao }) {
  useSeguirComodo(s);
  const p = sugestao.value, pos = posicao.value;
  if (!sugestoesLigadas.value || !p || !pos || s.store.emGesto || paletaAberta.value || menuRadial.value) return null;
  const texto = textoDaSugestao({ m: s.doc.value, versao: s.store.versaoEdicao, semente: p.semente }, p), variavel = TIPOS_DE_SUGESTAO.find(t => t.tipo === p.tipo)?.variavel ?? false;
  return (
    <div class={`pilula-de-sugestao ${pos.abaixo ? 'abaixo' : ''}`} style={{ left: `${pos.x}px`, top: `${pos.y}px` }} role="group" aria-label="Sugestão do assistente" data-testid="pilula" key={p.id}>
      <button type="button" class="pilula-texto" onClick={aceitarSugestao} title="Aceitar a sugestão" data-testid="pilula-aceitar"><Icone nome="novo" tamanho={14} />{texto}</button>
      {variavel && <button type="button" class="pilula-botao" onClick={outraSugestao} title="Outra sugestão" aria-label="Outra sugestão" data-testid="pilula-outra"><Icone nome="refazer" tamanho={14} /></button>}
      <button type="button" class="pilula-botao" onClick={dispensarSugestao} title="Agora não" aria-label="Agora não" data-testid="pilula-dispensar"><Icone nome="fechar" tamanho={14} /></button>
    </div>
  );
}
