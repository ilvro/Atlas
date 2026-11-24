import { Container, Graphics, Text } from 'pixi.js';
import { corDoPing, DURACAO_PING_MS, pingsAtivos, setaNaBorda, type Ping } from '../domain/pings.ts';
import { mundoParaTela, type Camera } from './camera.ts';
import { hexParaNumero } from './cores.ts';

export interface CamadaDePings {
  raiz: Container;
  adicionar(ping: Ping): void;
  atualizar(camera: Camera, largura: number, altura: number, agora: number, escuro?: boolean): void;
  destruir(): void;
}

const CONTORNO_CLARO = 0xf8fafc;
const CONTORNO_ESCURO = 0x0b0d14;

/**
 * Renderiza pings animados (R15c): duas ondas expansivas, ponto central na cor da pessoa,
 * etiqueta pequena e seta na borda quando fora da câmera, com contorno adaptável a dia/noite.
 */
export function criarCamadaDePings(): CamadaDePings {
  const raiz = new Container();
  const desenho = new Graphics();
  const rotulos = new Container();
  raiz.addChild(desenho, rotulos);

  let lista: Ping[] = [];
  const textos = new Map<string, { texto: Text; escuro: boolean }>();

  function obterTexto(p: Ping, escuro: boolean): Text {
    const existente = textos.get(p.id);
    if (existente && existente.escuro === escuro) return existente.texto;
    if (existente) {
      rotulos.removeChild(existente.texto);
      existente.texto.destroy();
    }
    const contorno = escuro ? CONTORNO_CLARO : CONTORNO_ESCURO;
    const preenchimento = escuro ? CONTORNO_ESCURO : CONTORNO_CLARO;
    const t = new Text({
      text: p.nome,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 11,
        fontWeight: '700',
        fill: preenchimento,
        stroke: { color: contorno, width: 3.5 },
      },
    });
    t.anchor.set(0.5, 0);
    textos.set(p.id, { texto: t, escuro });
    rotulos.addChild(t);
    return t;
  }

  return {
    raiz,
    adicionar(ping) {
      lista = [...pingsAtivos(lista, ping.em), ping];
    },
    atualizar(camera, largura, altura, agora, escuro = false) {
      desenho.clear();
      const ativos = pingsAtivos(lista, agora);
      lista = ativos;

      const vivos = new Set(ativos.map(p => p.id));
      for (const [id, item] of textos) {
        if (!vivos.has(id)) {
          rotulos.removeChild(item.texto);
          item.texto.destroy();
          textos.delete(id);
        }
      }

      const contorno = escuro ? CONTORNO_CLARO : CONTORNO_ESCURO;

      for (const p of ativos) {
        const u = Math.max(0, Math.min(1, (agora - p.em) / DURACAO_PING_MS));
        const alfaGeral = u > 0.85 ? (1 - u) / 0.15 : 1;
        const [sx, sy] = mundoParaTela(camera, p.ponto);
        const cor = hexParaNumero(corDoPing(p.discordId, p.papel));
        const seta = setaNaBorda([sx, sy], largura, altura, 26);

        const label = obterTexto(p, escuro);
        label.alpha = alfaGeral;

        if (!seta) {
          // Duas ondas que se expandem e somem.
          for (const atraso of [0, 0.2]) {
            const f = (u - atraso) / (1 - atraso);
            if (f <= 0 || f >= 1) continue;
            const r = 7 + (1 - (1 - f) ** 2) * 38;
            const alfa = (1 - f) ** 1.35 * 0.88;
            desenho.circle(sx, sy, r).stroke({ width: 4, color: contorno, alpha: alfa * 0.65 });
            desenho.circle(sx, sy, r).stroke({ width: 2.2, color: cor, alpha: alfa });
          }
          // Ponto central com pulso inicial discreto.
          const pulso = u < 0.12 ? 1 + Math.sin((u / 0.12) * Math.PI) * 0.35 : 1;
          const rc = 4.8 * pulso;
          desenho.circle(sx, sy, rc).fill({ color: cor, alpha: 0.95 * alfaGeral }).stroke({ width: 2, color: contorno, alpha: 0.85 * alfaGeral });
          desenho.circle(sx, sy, 1.7 * pulso).fill({ color: 0xffffff, alpha: 0.7 * alfaGeral });
          label.position.set(sx, sy + 13);
        } else {
          const pulso = 1 + Math.sin(u * Math.PI * 6) * 0.12;
          const r = 10 * pulso;
          const ax = seta.x + Math.cos(seta.angulo) * r;
          const ay = seta.y + Math.sin(seta.angulo) * r;
          const bx = seta.x + Math.cos(seta.angulo + 2.35) * r;
          const by = seta.y + Math.sin(seta.angulo + 2.35) * r;
          const cx = seta.x + Math.cos(seta.angulo - 2.35) * r;
          const cy = seta.y + Math.sin(seta.angulo - 2.35) * r;
          desenho.poly([ax, ay, bx, by, cx, cy]).fill({ color: cor, alpha: 0.95 * alfaGeral }).stroke({ width: 2.2, color: contorno, alpha: 0.85 * alfaGeral });
          const recuo = 14;
          const lx = Math.max(32, Math.min(largura - 32, seta.x - Math.cos(seta.angulo) * recuo));
          const ly = Math.max(12, Math.min(altura - 24, seta.y - Math.sin(seta.angulo) * recuo + 10));
          label.position.set(lx, ly);
        }
      }
    },
    destruir() {
      for (const item of textos.values()) item.texto.destroy();
      textos.clear();
      raiz.destroy({ children: true });
    },
  };
}
