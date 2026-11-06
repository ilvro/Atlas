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
  calcularPosicaoDaPrevia,
  urlDaPreviaDaFicha,
} from '../app/previa-ficha.ts';

export { previaDaFichaAberta, previaFixada, calcularPosicaoDaPrevia, urlDaPreviaDaFicha };

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
    previaDaFichaAberta.value = false;
    tocar('pop');
  };

  const alternarFixacao = () => {
    previaFixada.value = !previaFixada.value;
    tocar('pop');
  };

  const estiloPosicao = fixada
    ? undefined
    : posicao
      ? { left: `${posicao.x}px`, top: `${posicao.y}px` }
      : { display: 'none' };

  return (
    <div
      class={`previa-da-ficha ${fixada ? 'fixada' : ''}`}
      style={estiloPosicao}
      role="region"
      aria-label={`Ficha de ${token.name}`}
      data-testid="previa-da-ficha"
      onClick={e => e.stopPropagation()}
    >
      {/* Cabeçalho da gaveta */}
      <div class="previa-cabecalho">
        <div class="previa-info-token">
          <span class="previa-nome-token" title={token.name}>
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
