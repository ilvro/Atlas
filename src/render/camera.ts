import type { Ponto } from '../domain/mapa.ts';

/** `x`,`y`: posição na tela (px) da origem do mundo. `zoom`: pixels por metro. */
export interface Camera { x: number; y: number; zoom: number }
export interface Tela { largura: number; altura: number }
export const ZOOM_MIN = 4, ZOOM_MAX = 400;

export const limitarZoom = (z: number, min = ZOOM_MIN, max = ZOOM_MAX): number => Math.max(min, Math.min(max, z));
export const mundoParaTela = (c: Camera, p: Ponto): Ponto => [c.x + p[0] * c.zoom, c.y + p[1] * c.zoom];
export const telaParaMundo = (c: Camera, p: Ponto): Ponto => [(p[0] - c.x) / c.zoom, (p[1] - c.y) / c.zoom];
export const panear = (c: Camera, dx: number, dy: number): Camera => ({ ...c, x: c.x + dx, y: c.y + dy });

/** Muda o zoom mantendo fixo o ponto do mundo que está sob `foco` (px da tela). */
export function zoomEm(c: Camera, foco: Ponto, fator: number, min = ZOOM_MIN, max = ZOOM_MAX): Camera {
  const zoom = limitarZoom(c.zoom * fator, min, max);
  if (zoom === c.zoom) return c;
  const [mx, my] = telaParaMundo(c, foco);
  return { x: foco[0] - mx * zoom, y: foco[1] - my * zoom, zoom };
}

/** Câmera que mostra `area` (em metros) inteira e centrada, deixando `margem` px livres. `reservado` tira largura (painéis). */
export function enquadrar(area: { x: number; y: number; largura: number; altura: number }, tela: Tela, margem = 48, reservado = { esquerda: 0, direita: 0, topo: 0, base: 0 }): Camera {
  const livreL = Math.max(1, tela.largura - reservado.esquerda - reservado.direita - 2 * margem);
  const livreA = Math.max(1, tela.altura - reservado.topo - reservado.base - 2 * margem);
  const zoom = limitarZoom(Math.min(livreL / area.largura, livreA / area.altura));
  return {
    zoom,
    x: reservado.esquerda + margem + (livreL - area.largura * zoom) / 2 - area.x * zoom,
    y: reservado.topo + margem + (livreA - area.altura * zoom) / 2 - area.y * zoom,
  };
}

/** Parte do mundo visível na tela. */
export function visivel(c: Camera, t: Tela): { x0: number; y0: number; x1: number; y1: number } {
  const [x0, y0] = telaParaMundo(c, [0, 0]), [x1, y1] = telaParaMundo(c, [t.largura, t.altura]);
  return { x0, y0, x1, y1 };
}
