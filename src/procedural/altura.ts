import type { Contexto } from './canvas.ts';
import type { Parte } from './descricao.ts';
import { caixaDe, caminho, ordenarPartes } from './raster.ts';

/** Altura em metros correspondente ao valor máximo (1.0 / 255) no mapa de altura dos objetos. */
export const ALTURA_MAXIMA = 4;

const limitar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const cinza = (v: number): string => {
  const c = Math.round(limitar(v) * 255);
  return `rgb(${c},${c},${c})`;
};

/** Verdadeiro se a parte contribui para o mapa de altura (partes sólidas; exclui luzes, veladuras, suaves e itens sem sombra). */
export function parteEscreveAltura(p: Parte): boolean {
  return !(p.suave || p.desfoque || p.brilho || (p.alfa !== undefined && p.alfa < 0.5) || p.semSombra);
}

/**
 * Desenha a altura (cinza 0–1 relativa a `ALTURA_MAXIMA`) das partes sólidas na mesma ordem e geometria de
 * `desenharPartes`, sem traço, sombra ou AO. Fundo transparente = altura 0. Partes arredondadas (`raio`)
 * recebem um domo radial de `v` no centro a `0.85 * v` na borda.
 */
export function desenharAlturaDasPartes(ctx: Contexto, partes: readonly Parte[], _op: { res: number }): void {
  ctx.save();
  ctx.globalAlpha = 1;
  for (const p of ordenarPartes(partes)) {
    if (!parteEscreveAltura(p)) continue;
    const v = limitar(p.z / ALTURA_MAXIMA);
    caminho(ctx, p);
    if (p.raio) {
      const b = caixaDe(p);
      if (b.w > 0 && b.h > 0) {
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.scale(b.w / 2, b.h / 2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, cinza(v));
        g.addColorStop(1, cinza(v * 0.85));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        continue;
      }
    }
    ctx.fillStyle = cinza(v);
    ctx.fill();
  }
  ctx.restore();
}
