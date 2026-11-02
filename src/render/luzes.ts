import { Texture } from 'pixi.js';

let textura: Texture | null = null;

/** O brilho de uma luz: um degradê radial branco que o Pixi tinge com a cor da luz e soma à cena. */
export function texturaDeBrilho(): Texture {
  if (textura && !textura.destroyed) return textura;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  textura = Texture.from(c);
  return textura;
}
