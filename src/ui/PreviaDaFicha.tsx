import { useEffect, useState } from 'preact/hooks';
import { chaveDaRef, type Ref } from '#mesa';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { refDaFicha, textoDeRecursos } from '../domain/fichas.ts';
import { abrirFicha, recursosDasFichas } from '../app/fichas.ts';
import { servicos, viewport } from '../app/app.ts';
import { caixaDe } from '../render/selecao.ts';
import { Icone } from './Icone.tsx';
import { tocar } from '../fx/som.ts';
import {
  previaDaFichaAberta,
  previaFixada,
  posicaoManualPrevia,
  arrastandoPrevia,
  calcularPosicaoDaPrevia,
  urlDaPreviaDaFicha,
} from '../app/previa-ficha.ts';

export {
  previaDaFichaAberta,
  previaFixada,
  posicaoManualPrevia,
  arrastandoPrevia,
  calcularPosicaoDaPrevia,
  urlDaPreviaDaFicha,
};

export function PreviaDaFicha({ s }: { s: SessaoDeEdicao }) {
  const aberta = previaDaFichaAberta.value;
  const fixada = previaFixada.value;
  const alvos = s.selecao.value;
  const m = s.doc.value;

  const alvoToken = alvos.length === 1 && alvos[0]!.colecao === 'tokens' ? alvos[0]! : null;
  const token = alvoToken ? m.tokens[alvoToken.id] : null;
  const ref = token ? refDaFicha(token.refs) : null;

  // Fecha a prévia automaticamente se o token for desselecionado ou não possuir ficha
  useEffect(() => {
    if (!alvoToken || !ref) {
      if (previaDaFichaAberta.peek()) {
        previaDaFichaAberta.value = false;
      }
    }
  }, [alvos, alvoToken, ref]);

  const [posicao, setPosicao] = useState<{ x: number; y: number } | null>(null);

  // Calcula e atualiza a posição do card ancorado ao lado do token
  useEffect(() => {
    if (!aberta || fixada || !token) return;

    let quadro = 0;
    const atualizarPosicao = () => {
      const v = viewport.atual;
      const c = v ? caixaDe(s.store.documento, { colecao: 'tokens', id: token.id }) : null;
      const area = document.querySelector('[data-testid="area-do-mapa"]')?.getBoundingClientRect();

      if (v && c && area) {
        const [cx0, cy0] = v.clientDe([c.x0, c.y0]);
        const [cx1, cy1] = v.clientDe([c.x1, c.y1]);
        const pos = calcularPosicaoDaPrevia(
          { cx0, cy0, cx1, cy1 },
          { left: area.left, right: area.right, top: area.top, bottom: area.bottom }
        );
        setPosicao(pos);
      }
      quadro = requestAnimationFrame(atualizarPosicao);
    };

    quadro = requestAnimationFrame(atualizarPosicao);
    return () => cancelAnimationFrame(quadro);
  }, [aberta, fixada, token, s]);

  if (!aberta || !token || !ref) return null;

  const rec = recursosDasFichas.value[chaveDaRef(ref)];
  const b = servicos.peek()?.barramento;

  const fechar = () => {
    arrastandoPrevia.value = false;
    previaDaFichaAberta.value = false;
    tocar('pop');
  };

  const alternarFixacao = () => {
    posicaoManualPrevia.value = null;
    previaFixada.value = !previaFixada.value;
    tocar('pop');
  };

  const aoDuploClique = () => {
    posicaoManualPrevia.value = null;
    tocar('pop');
  };

  const iniciarArrasto = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const el = document.querySelector('.previa-da-ficha') as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    arrastandoPrevia.value = true;

    const aoMover = (ev: PointerEvent) => {
      const largura = rect.width || 380;
      const altura = rect.height || 500;
      const x = Math.max(10, Math.min(window.innerWidth - largura - 10, ev.clientX - offsetX));
      const y = Math.max(52, Math.min(window.innerHeight - 60, ev.clientY - offsetY));
      posicaoManualPrevia.value = { x: Math.round(x), y: Math.round(y) };
    };

    const aoSoltar = () => {
      arrastandoPrevia.value = false;
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('pointercancel', aoSoltar);
    };

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', aoSoltar);
  };

  const posManual = posicaoManualPrevia.value;
  const estiloPosicao = posManual
    ? { left: `${posManual.x}px`, top: `${posManual.y}px`, position: 'fixed' as const }
    : fixada
      ? undefined
      : posicao
        ? { left: `${posicao.x}px`, top: `${posicao.y}px` }
        : { display: 'none' };

  return (
    <div
      class={`previa-da-ficha ${fixada && !posManual ? 'fixada' : ''} ${arrastandoPrevia.value ? 'arrastando' : ''}`}
      style={estiloPosicao}
      role="region"
      aria-label={`Ficha de ${token.name}`}
      data-testid="previa-da-ficha"
      onClick={e => e.stopPropagation()}
    >
      {/* Cabeçalho da gaveta */}
      <div class="previa-cabecalho" onPointerDown={iniciarArrasto} onDblClick={aoDuploClique}>
        <div class="previa-info-token">
          <span class="previa-nome-token" title={token.name}>
            <span class="dock-alca" aria-hidden="true" style={{ cursor: 'grab', marginRight: '6px' }}>⠿</span>
            {token.name}
          </span>
          {rec && (
            <span class="previa-recursos-resumo" title={textoDeRecursos(rec)}>
              {textoDeRecursos(rec)}
            </span>
          )}
        </div>

        <div class="previa-acoes">
          <button
            type="button"
            class={`previa-botao-acao ${fixada ? 'ativa' : ''}`}
            title={fixada ? 'Soltar do canto (seguir token)' : 'Fixar no canto superior'}
            aria-label="Fixar ou soltar prévia"
            data-testid="previa-fixar"
            onClick={alternarFixacao}
          >
            📌
          </button>
          <button
            type="button"
            class="previa-botao-acao"
            title="Abrir ficha completa em nova aba"
            aria-label="Abrir ficha completa"
            data-testid="previa-abrir-cheia"
            onClick={() => void abrirFicha(b, ref)}
          >
            ↗
          </button>
          <button
            type="button"
            class="previa-botao-acao fechar"
            title="Fechar prévia da ficha"
            aria-label="Fechar prévia"
            data-testid="previa-fechar"
            onClick={fechar}
          >
            ×
          </button>
        </div>
      </div>

      {/* Corpo com iframe compacto do Dossiê */}
      <div class="previa-corpo">
        <iframe
          data-testid="iframe-previa-ficha"
          class="iframe-previa-ficha"
          src={urlDaPreviaDaFicha(ref.id)}
          title={`Ficha de ${token.name}`}
        />
      </div>
    </div>
  );
}
