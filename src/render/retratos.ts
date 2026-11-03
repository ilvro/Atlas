import type { Texture } from 'pixi.js';
import { texturaPropria } from './textura-propria.ts';

/**
 * Os retratos das peças: lê o blob guardado (pelo id do asset), vira textura e avisa quando chega. Cada id é lido uma vez; `limpar` solta tudo (ao fechar o mapa).
 * Uma imagem que não abre fica como "sem retrato" (a peça mostra a inicial) e não é pedida de novo.
 */
export interface Retratos {
  /** A textura do retrato, ou `null` se ainda não chegou (e então a lê). */
  obter(id: string | null | undefined): Texture | null;
  limpar(): void;
}

export function criarRetratos(ler: (id: string) => Promise<Blob | null>, aoChegar: () => void): Retratos {
  const prontas = new Map<string, Texture>(), pedidas = new Set<string>();
  let vivo = true;
  return {
    obter(id) {
      if (!id) return null;
      const t = prontas.get(id); if (t) return t;
      if (!pedidas.has(id)) {
        pedidas.add(id);
        void ler(id).then(async blob => {
          if (!blob || !vivo) return;
          const bitmap = await createImageBitmap(blob); if (!vivo) { bitmap.close(); return; }
          prontas.set(id, texturaPropria(bitmap)); aoChegar();
        }).catch(() => { /* retrato ilegível: a peça segue com a inicial */ });
      }
      return null;
    },
    limpar() { vivo = false; for (const t of prontas.values()) t.destroy(true); prontas.clear(); },
  };
}
