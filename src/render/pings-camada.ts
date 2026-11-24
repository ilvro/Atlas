import { Container, Graphics, Text } from 'pixi.js';
import { corDoPing, pingsAtivos, setaNaBorda, type Ping } from '../domain/pings.ts';
import { mundoParaTela, type Camera } from './camera.ts';
import { hexParaNumero } from './cores.ts';

export interface CamadaDePings {
  raiz: Container;
  adicionar(ping: Ping): void;
  atualizar(camera: Camera, largura: number, altura: number, agora: number, escuro?: boolean): void;
  destruir(): void;
}

export function criarCamadaDePings(): CamadaDePings {
  const raiz = new Container();
  const desenho = new Graphics();
  const rotulos = new Container();
  raiz.addChild(desenho, rotulos);

  let lista: Ping[] = [];
  const textos = new Map<string, Text>();

  return {
    raiz,
    adicionar(ping) {
      lista = [...pingsAtivos(lista, ping.em), ping];
    },
    atualizar(camera, largura, altura, agora) {
      desenho.clear();
      const ativos = pingsAtivos(lista, agora);
      lista = ativos;

      const vivos = new Set(ativos.map(p => p.id));
      for (const [id, t] of textos) {
        if (!vivos.has(id)) {
          rotulos.removeChild(t);
          t.destroy();
          textos.delete(id);
        }
      }

      for (const p of ativos) {
        const [sx, sy] = mundoParaTela(camera, p.ponto);
        const cor = hexParaNumero(corDoPing(p.discordId, p.papel));
        const seta = setaNaBorda([sx, sy], largura, altura);

        let label = textos.get(p.id);
        if (!label) {
          label = new Text({
            text: p.nome,
            style: { fontFamily: 'sans-serif', fontSize: 12, fontWeight: '600', fill: 0xffffff, stroke: { color: 0x0b0d14, width: 3 } },
          });
          label.anchor.set(0.5, 0);
          textos.set(p.id, label);
          rotulos.addChild(label);
        }

        if (!seta) {
          desenho.circle(sx, sy, 14).stroke({ width: 2.5, color: cor, alpha: 0.95 });
          desenho.circle(sx, sy, 4.5).fill({ color: cor, alpha: 0.95 });
          label.position.set(sx, sy + 18);
        } else {
          const r = 10;
          const ax = seta.x + Math.cos(seta.angulo) * r;
          const ay = seta.y + Math.sin(seta.angulo) * r;
          const bx = seta.x + Math.cos(seta.angulo + 2.4) * r;
          const by = seta.y + Math.sin(seta.angulo + 2.4) * r;
          const cx = seta.x + Math.cos(seta.angulo - 2.4) * r;
          const cy = seta.y + Math.sin(seta.angulo - 2.4) * r;
          desenho.poly([ax, ay, bx, by, cx, cy]).fill({ color: cor, alpha: 0.95 }).stroke({ width: 1.5, color: 0x0b0d14 });
          label.position.set(seta.x, seta.y + 14);
        }
      }
    },
    destruir() {
      for (const t of textos.values()) t.destroy();
      textos.clear();
      raiz.destroy({ children: true });
    },
  };
}
