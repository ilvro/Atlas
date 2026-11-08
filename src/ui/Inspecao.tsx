import { useEffect, useRef } from 'preact/hooks';
import { servicos } from '../app/app.ts';
import { enviarEstadoDaInspecao, fecharInspecaoDoMestre, mostrarInspecaoAosJogadores, pararDeMostrarInspecao } from '../app/app.ts';
import { editarNoAtelie, inspecao, mostrandoAosJogadores } from '../app/inspecao.ts';
import { VISTA_INICIAL, arrastar, paraFracao, zoomEm, type Vista } from '../domain/inspecao.ts';
import { signal } from '@preact/signals';
import { VisorDeDocumento, type EstadoDoVisor } from './VisorDeDocumento.tsx';
import { tocar } from '../fx/som.ts';

const uvLigada = signal(false);

/**
 * A inspeção de uma pista na sessão: o documento em tela grande com efeito 3D (estilo Resident Evil / Enigma do Medo),
 * zoom (roda) e arrasto, "Luz UV" com a lanterna que segue o ponteiro, e "Mostrar aos jogadores" (o projetor abre o mesmo documento e segue a lanterna). Esc fecha.
 */
export function Inspecao() {
  const d = inspecao.value, area = useRef<HTMLDivElement>(null), palco = useRef<HTMLDivElement>(null);
  // O estado vivo fica fora do Preact: o visor lê a cada quadro, e o ponteiro não refaz a interface.
  const vivo = useRef<{ vista: Vista; lanterna: { x: number; y: number } | null; ultimoEnvio: number; arraste: { x: number; y: number } | null }>({ vista: VISTA_INICIAL, lanterna: null, ultimoEnvio: 0, arraste: null });
  useEffect(() => {
    vivo.current.vista = VISTA_INICIAL;
    vivo.current.lanterna = null;
    uvLigada.value = false;
    if (d) tocar('papel');
  }, [d?.pista.id]);
  useEffect(() => {
    if (!d) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharInspecaoDoMestre(); } };
    window.addEventListener('keydown', aoTeclar, true);
    return () => window.removeEventListener('keydown', aoTeclar, true);
  }, [d]);
  const estado = useRef<() => EstadoDoVisor>(() => ({ vista: vivo.current.vista, lanterna: uvLigada.peek() ? vivo.current.lanterna ?? { x: 0.5, y: 0.5 } : null })).current;
  if (!d) return null;
  const tela = () => { const r = area.current!.getBoundingClientRect(); return { largura: r.width, altura: r.height, r }; };
  const imagem = { largura: d.normal.width, altura: d.normal.height };
  const enviar = (forcar = false) => {
    const agora = performance.now(); if (!forcar && agora - vivo.current.ultimoEnvio < 33) return;
    vivo.current.ultimoEnvio = agora; enviarEstadoDaInspecao(vivo.current.vista, uvLigada.peek() ? vivo.current.lanterna : null);
  };
  const aoMover = (e: PointerEvent) => {
    const t = tela(), p: [number, number] = [e.clientX - t.r.left, e.clientY - t.r.top], v = vivo.current;
    if (v.arraste) { v.vista = arrastar(v.vista, p[0] - v.arraste.x, p[1] - v.arraste.y, t, imagem); v.arraste = { x: p[0], y: p[1] }; }
    else v.lanterna = (() => { const f = paraFracao(p, v.vista, t, imagem); return { x: f[0], y: f[1] }; })();
    if (palco.current && t.largura > 0 && t.altura > 0) {
      const nx = ((p[0] / t.largura) - 0.5) * 2;
      const ny = ((p[1] / t.altura) - 0.5) * 2;
      palco.current.style.setProperty('--tilt-x', `${(-ny * 10).toFixed(2)}deg`);
      palco.current.style.setProperty('--tilt-y', `${(nx * 12).toFixed(2)}deg`);
      palco.current.style.setProperty('--glare-x', `${((nx + 1) * 50).toFixed(1)}%`);
      palco.current.style.setProperty('--glare-y', `${((ny + 1) * 50).toFixed(1)}%`);
    }
    enviar();
  };
  const aoSair = () => {
    if (palco.current) {
      palco.current.style.setProperty('--tilt-x', '0deg');
      palco.current.style.setProperty('--tilt-y', '0deg');
    }
  };
  return (
    <div class="inspecao" data-testid="inspecao" role="dialog" aria-label={`Inspeção: ${d.pista.name}`}>
      <div class="inspecao-barra">
        <strong class="inspecao-nome">{d.pista.name}</strong>
        <button type="button" class={`dock-pilula ${uvLigada.value ? 'ativa' : ''}`} aria-pressed={uvLigada.value} disabled={!d.pista.hasUv} title={d.pista.hasUv ? 'Acende a lanterna de luz ultravioleta' : 'Este documento não tem camada UV'} data-testid="inspecao-uv"
          onClick={() => { uvLigada.value = !uvLigada.value; enviar(true); }}>Luz UV</button>
        <button type="button" class={`dock-pilula ${mostrandoAosJogadores.value ? 'ativa' : ''}`} aria-pressed={mostrandoAosJogadores.value} data-testid="inspecao-mostrar"
          onClick={() => { if (mostrandoAosJogadores.value) pararDeMostrarInspecao(); else mostrarInspecaoAosJogadores(vivo.current.vista, uvLigada.peek() ? vivo.current.lanterna : null); }}>{mostrandoAosJogadores.value ? 'Parar de mostrar' : 'Mostrar aos jogadores'}</button>
        <button type="button" class="dock-pilula" data-testid="inspecao-editar" onClick={() => void editarNoAtelie(d.pista, servicos.peek()?.barramento)}>Editar no Ateliê</button>
        <span class="espaco" />
        <button type="button" class="dock-pilula" data-testid="inspecao-fechar" onClick={fecharInspecaoDoMestre}>Fechar (Esc)</button>
      </div>
      <div class="inspecao-area" ref={area} onPointerMove={aoMover} onPointerLeave={aoSair} onPointerDown={e => { const t = tela(); vivo.current.arraste = { x: e.clientX - t.r.left, y: e.clientY - t.r.top }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerUp={() => { vivo.current.arraste = null; }} onPointerCancel={() => { vivo.current.arraste = null; }}
        onWheel={e => { e.preventDefault(); const t = tela(); vivo.current.vista = zoomEm(vivo.current.vista, Math.exp(-e.deltaY * 0.0015), [e.clientX - t.r.left, e.clientY - t.r.top], t, imagem); enviar(true); }}>
        <div class="inspecao-palco-3d" ref={palco}>
          <VisorDeDocumento normal={d.normal} uv={d.uv} estado={estado} testid="inspecao-visor" />
          <div class="inspecao-glare" aria-hidden="true" />
        </div>
      </div>
      <p class="inspecao-dica">Role para aproximar, arraste para mover e inspecionar em 3D{d.pista.hasUv ? '. Com a luz UV, a lanterna segue o ponteiro.' : '.'}</p>
    </div>
  );
}
