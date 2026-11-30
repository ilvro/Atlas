import { Container, Graphics, Text } from 'pixi.js';
import { cursoresAtivos, type CursorRemoto } from '../domain/cursores-remotos.ts';
import { mundoParaTela, type Camera } from './camera.ts';
import { hexParaNumero } from './cores.ts';

export interface CamadaDeCursores {
  raiz: Container;
  atualizar(
    cursores: readonly CursorRemoto[],
    camera: Camera,
    levelId: string | null,
    agora: number,
    escuro?: boolean,
    meuDiscordId?: string | null,
  ): void;
  destruir(): void;
}

const CONTORNO_CLARO = 0xf8fafc;
const CONTORNO_ESCURO = 0x0b0d14;

/**
 * Renderiza os cursores colaborativos dos colegas sobre o mapa (S5): ponteiro colorido com
 * contorno adaptável a dia/noite, etiqueta pequena com o nome e pulso sutil ao pintar.
 */
export function criarCamadaDeCursores(): CamadaDeCursores {
  const raiz = new Container();
  const desenho = new Graphics();
  const rotulos = new Container();
  raiz.addChild(desenho, rotulos);

  const textos = new Map<string, { texto: Text; nome: string; escuro: boolean }>();

  function obterTexto(c: CursorRemoto, escuro: boolean): Text {
    const existente = textos.get(c.discordId);
    if (existente && existente.nome === c.nome && existente.escuro === escuro) {
      return existente.texto;
    }
    if (existente) {
      rotulos.removeChild(existente.texto);
      existente.texto.destroy();
    }
    const contorno = escuro ? CONTORNO_CLARO : CONTORNO_ESCURO;
    const preenchimento = escuro ? CONTORNO_ESCURO : CONTORNO_CLARO;
    const t = new Text({
      text: c.nome,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 11,
        fontWeight: '700',
        fill: preenchimento,
        stroke: { color: contorno, width: 3.5 },
      },
    });
    t.anchor.set(0, 0);
    textos.set(c.discordId, { texto: t, nome: c.nome, escuro });
    rotulos.addChild(t);
    return t;
  }

  return {
    raiz,
    atualizar(cursores, camera, levelId, agora, escuro = false, meuDiscordId = null) {
      desenho.clear();
      const ativos = cursoresAtivos(cursores, agora, { levelId, meuDiscordId });

      const vivos = new Set(ativos.map(c => c.discordId));
      for (const [id, item] of textos) {
        if (!vivos.has(id)) {
          rotulos.removeChild(item.texto);
          item.texto.destroy();
          textos.delete(id);
        }
      }

      const contorno = escuro ? CONTORNO_CLARO : CONTORNO_ESCURO;

      for (const c of ativos) {
        const [sx, sy] = mundoParaTela(camera, [c.x, c.y]);
        const cor = hexParaNumero(c.cor);

        if (c.pintando) {
          const fase = (agora % 900) / 900;
          const pulso = 0.5 + 0.5 * Math.sin(fase * Math.PI * 2);
          const r = 7 + pulso * 5;
          const alfa = 0.72 - pulso * 0.36;
          desenho.circle(sx, sy, r).stroke({ width: 2.5, color: contorno, alpha: alfa * 0.5 });
          desenho.circle(sx, sy, r).stroke({ width: 1.6, color: cor, alpha: alfa });
        }

        // Ponteiro discreto com a ponta exata em (sx, sy).
        desenho
          .poly([sx, sy, sx + 1, sy + 14, sx + 4.5, sy + 10.5, sx + 10, sy + 10])
          .fill({ color: cor, alpha: 0.95 })
          .stroke({ width: 1.8, color: contorno, alpha: 0.9, join: 'round' });

        const label = obterTexto(c, escuro);
        label.position.set(sx + 12, sy + 11);
      }
    },
    destruir() {
      for (const item of textos.values()) item.texto.destroy();
      textos.clear();
      raiz.destroy({ children: true });
    },
  };
}
