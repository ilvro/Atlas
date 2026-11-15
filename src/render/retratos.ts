import { Texture } from 'pixi.js';
import { derivarPixel } from '../procedural/derivar-pixel.ts';
import { texturaPropria } from './textura-propria.ts';

/**
 * Os retratos das peças: lê o blob guardado (pelo id do asset), vira textura e avisa quando chega. Cada id é lido uma vez; `limpar` solta tudo (ao fechar o mapa).
 * Uma imagem que não abre fica como "sem retrato" (a peça mostra a inicial) e não é pedida de novo.
 */
/** Como derivar o retrato no estilo Pixel: lado em pixels do Pixel, paleta e opções (a `chave` identifica a combinação no cache). */
export interface RetratoNoPixel { chave: string; lado: number; paleta: readonly string[]; dither: boolean; contorno: boolean }

export interface Retratos {
  /** A textura do retrato, ou `null` se ainda não chegou (e então a lê). Com `pixel`, a versão derivada: recortada em círculo, na paleta, com contorno. */
  obter(id: string | null | undefined, pixel?: RetratoNoPixel): Texture | null;
  limpar(): void;
}

export function criarRetratos(ler: (id: string) => Promise<Blob | null>, aoChegar: () => void): Retratos {
  const prontas = new Map<string, Texture>(), pedidas = new Set<string>(), bitmaps = new Map<string, ImageBitmap>(), derivadas = new Map<string, Texture>();
  let vivo = true;
  return {
    obter(id, pixel) {
      if (!id) return null;
      if (pixel) {
        const k = `${id}|${pixel.chave}`, d = derivadas.get(k); if (d) return d;
        const bmp = bitmaps.get(id); if (bmp) { const t = derivarRetrato(bmp, pixel); derivadas.set(k, t); return t; }
      }
      const t = prontas.get(id); if (t && !pixel) return t;
      if (!pedidas.has(id)) {
        pedidas.add(id);
        void ler(id).then(async blob => {
          if (!blob) { pedidas.delete(id); return; }
          if (!vivo) return;
          const bitmap = await createImageBitmap(blob); if (!vivo) { bitmap.close(); return; }
          bitmaps.set(id, bitmap); prontas.set(id, texturaPropria(bitmap)); aoChegar();
        }).catch(() => { pedidas.delete(id); /* retrato ilegível: a peça segue com a inicial */ });
      }
      return null;
    },
    limpar() { vivo = false; for (const t of prontas.values()) t.destroy(true); for (const t of derivadas.values()) t.destroy(true); prontas.clear(); derivadas.clear(); bitmaps.clear(); pedidas.clear(); },
  };
}

/** O retrato no Pixel: recortado ao quadrado pelo centro e em círculo, desenhado com 4× o tamanho e derivado (moda por bloco, paleta, contorno). */
function derivarRetrato(bmp: ImageBitmap, o: RetratoNoPixel): Texture {
  const hi = o.lado * 4, c = document.createElement('canvas'); c.width = c.height = hi;
  const g = c.getContext('2d', { willReadFrequently: true })!, lado = Math.min(bmp.width, bmp.height);
  g.imageSmoothingQuality = 'high'; g.beginPath(); g.arc(hi / 2, hi / 2, hi / 2 - 4, 0, Math.PI * 2); g.clip();
  g.drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, hi, hi);
  const d = derivarPixel(g.getImageData(0, 0, hi, hi), { largura: o.lado, altura: o.lado }, o.paleta, { dither: o.dither, contorno: o.contorno });
  const saida = document.createElement('canvas'); saida.width = d.width; saida.height = d.height;
  saida.getContext('2d')!.putImageData(new ImageData(d.data as unknown as Uint8ClampedArray<ArrayBuffer>, d.width, d.height), 0, 0);
  const t = Texture.from(saida); t.source.scaleMode = 'nearest'; return t;
}
