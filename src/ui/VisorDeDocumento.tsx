import { useEffect, useRef } from 'preact/hooks';
import { RAIO_DA_LANTERNA, paraTela, retanguloDaImagem, suavizar, type Vista } from '../domain/inspecao.ts';

/** O que o visor desenha a cada quadro: a vista (zoom e centro) e a lanterna UV (em frações da imagem), se acesa. */
export interface EstadoDoVisor { vista: Vista; lanterna: { x: number; y: number } | null }

let rascunho: HTMLCanvasElement | null = null;

/** Desenha o documento: a luz normal inteira e, com a lanterna UV acesa, o documento escurecido com o assado UV num círculo suave sob a lanterna. */
export function desenharDocumento(ctx: CanvasRenderingContext2D, W: number, H: number, normal: ImageBitmap, uv: ImageBitmap | null, e: EstadoDoVisor): void {
  ctx.clearRect(0, 0, W, H);
  const tela = { largura: W, altura: H }, img = { largura: normal.width, altura: normal.height }, r = retanguloDaImagem(e.vista, tela, img);
  ctx.imageSmoothingQuality = 'high';
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 28; ctx.drawImage(normal, r.x, r.y, r.w, r.h); ctx.restore();
  if (!uv || !e.lanterna) return;
  ctx.fillStyle = 'rgba(10, 6, 28, 0.58)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  // O assado UV só aparece dentro do círculo da lanterna, com a borda suave.
  rascunho ??= document.createElement('canvas');
  if (rascunho.width !== W || rascunho.height !== H) { rascunho.width = W; rascunho.height = H; }
  const g = rascunho.getContext('2d')!, [lx, ly] = paraTela([e.lanterna.x, e.lanterna.y], e.vista, tela, img), raio = RAIO_DA_LANTERNA * r.w;
  g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.imageSmoothingQuality = 'high'; g.drawImage(uv, r.x, r.y, r.w, r.h);
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(lx, ly, 0, lx, ly, raio); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.72, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  ctx.drawImage(rascunho, 0, 0);
  // Um halo roxo no contorno da lanterna.
  const halo = ctx.createRadialGradient(lx, ly, raio * 0.7, lx, ly, raio * 1.08); halo.addColorStop(0, 'rgba(160, 110, 255, 0)'); halo.addColorStop(0.6, 'rgba(160, 110, 255, 0.18)'); halo.addColorStop(1, 'rgba(160, 110, 255, 0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(lx, ly, raio * 1.08, 0, Math.PI * 2); ctx.fill();
}

/** Um canvas que ocupa o contêiner e redesenha o documento a cada quadro, com o estado que `estado()` devolve. */
export function VisorDeDocumento({ normal, uv, estado, testid }: { normal: ImageBitmap; uv: ImageBitmap | null; estado: () => EstadoDoVisor; testid: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!; let quadro = 0;
    const laco = () => {
      const w = Math.max(1, Math.round(c.clientWidth * devicePixelRatio)), h = Math.max(1, Math.round(c.clientHeight * devicePixelRatio));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const e = estado();
      try { desenharDocumento(g, w, h, normal, uv, e); } catch { /* a imagem acabou de ser solta: o próximo quadro já é outro visor */ }
      c.dataset.uv = e.lanterna ? '1' : '0'; if (e.lanterna) { c.dataset.lx = e.lanterna.x.toFixed(3); c.dataset.ly = e.lanterna.y.toFixed(3); }
      c.dataset.zoom = e.vista.zoom.toFixed(2);
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, [normal, uv, estado]);
  return <canvas ref={ref} class="visor-de-documento" data-testid={testid} />;
}

/** A lanterna e a vista suavizadas para o projetor: o que chega em saltos vira movimento fluido. */
export function suavizarEstado(atual: EstadoDoVisor, alvo: EstadoDoVisor, dt: number): EstadoDoVisor {
  const v = { zoom: suavizar(atual.vista.zoom, alvo.vista.zoom, dt), cx: suavizar(atual.vista.cx, alvo.vista.cx, dt), cy: suavizar(atual.vista.cy, alvo.vista.cy, dt) };
  if (!alvo.lanterna) return { vista: v, lanterna: null };
  const de = atual.lanterna ?? alvo.lanterna;
  return { vista: v, lanterna: { x: suavizar(de.x, alvo.lanterna.x, dt, 0.05), y: suavizar(de.y, alvo.lanterna.y, dt, 0.05) } };
}
