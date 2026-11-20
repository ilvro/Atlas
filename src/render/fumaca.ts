import { Container, Sprite, Texture } from 'pixi.js';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO, corDaNeblina } from './particulas-config.ts';

/** Receitas que soltam fumaça quando estão ao ar livre (fora de cômodo). */
export const FONTES_DE_FUMACA: ReadonlySet<string> = new Set(['fogueira', 'braseiro']);
/** Baforadas por fonte e quanto cada uma vive (s). */
const BAFORADAS = 16, VIDA = 7;

export interface Fumaca {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  definirLigado(ligado: boolean): void;
  /** Quantas fontes soltam fumaça agora (testes). */
  contagem(): number;
  destruir(): void;
}

let texturaDaBaforada: Texture | null = null;
/** Uma baforada: mancha redonda e macia, com o miolo pouco mais denso e a borda irregular. */
function baforada(): Texture {
  if (texturaDaBaforada) return texturaDaBaforada;
  const c = document.createElement('canvas'), L = 64; c.width = c.height = L;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = L / 2 + Math.cos(a) * 7, y = L / 2 + Math.sin(a) * 7, gr = g.createRadialGradient(x, y, 0, x, y, 22);
    gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, L, L);
  }
  texturaDaBaforada = Texture.from(c);
  return texturaDaBaforada;
}

interface Fonte { pos: Ponto; tamanho: number; sprites: Sprite[]; idade: number[]; deriva: number[] }

/**
 * Fumaça das fogueiras e braseiros ao ar livre: baforadas que nascem no fogo, sobem (no mapa visto de cima, derivam para o lado do
 * vento), crescem e se desfazem. A cor é a da névoa (luz ambiente espalhada), mais quente perto do fogo. Fica por cima dos objetos e
 * por baixo da névoa; sem nada por quadro além de mover sprites.
 */
export function criarFumaca(): Fumaca {
  const raiz = new Container();
  let fontes: Fonte[] = [], mapa: MapaAtlas | null = null, ligado = true, cor: [number, number, number] = [0.5, 0.5, 0.5];

  const tingir = (s: Sprite, t: number) => {
    // Perto do fogo a fumaça pega a luz dele (âmbar); depois fica da cor do ambiente.
    const quente = Math.max(0, 1 - t * 3.5), r = cor[0] * (1 - quente) + 1 * quente * 0.9, g = cor[1] * (1 - quente) + 0.62 * quente * 0.9, b = cor[2] * (1 - quente) + 0.35 * quente * 0.9;
    s.tint = (Math.round(Math.min(1, r) * 255) << 16) | (Math.round(Math.min(1, g) * 255) << 8) | Math.round(Math.min(1, b) * 255);
  };
  const posicionar = (f: Fonte, i: number) => {
    const s = f.sprites[i]!, t = f.idade[i]! / VIDA, vento = mapa?.climate.weather.wind ?? 0;
    // A coluna sobe torta: deriva para noroeste (para cima, no mapa) e o vento a deita para leste.
    const d = t * (1.2 + 2.4 * f.tamanho), ondula = Math.sin(t * 5 + f.deriva[i]!) * 0.18 * t;
    s.position.set(f.pos[0] - d * 0.45 + d * vento * 1.2 + ondula, f.pos[1] - d * 0.9 + f.deriva[i]! * 0.05);
    const lado = (0.35 + t * 1.6) * f.tamanho;
    s.width = s.height = lado; s.rotation = f.deriva[i]! + t * 0.8;
    s.alpha = Math.sin(Math.min(1, t * 6) * Math.PI / 2) * (1 - t) ** 1.4 * 0.85;
    tingir(s, t);
  };

  return {
    raiz,
    sincronizar(m, mud) {
      mapa = m;
      if (mud && !mud.completo && !(mud.colecoes as Record<string, unknown>).props && !mud.campos.includes('climate')) return;
      cor = corDaNeblina(m.climate.ambient);
      const novas = Object.values(m.props).filter(o => o.source.kind === 'recipe' && FONTES_DE_FUMACA.has(o.source.recipe) && o.roomId === null);
      const chave = (p: Ponto) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
      if (novas.length === fontes.length && novas.every((o, i) => chave(o.position) === chave(fontes[i]!.pos))) { for (const f of fontes) for (let i = 0; i < f.sprites.length; i++) posicionar(f, i); return; }
      raiz.removeChildren().forEach(c => c.destroy());
      fontes = novas.map(o => {
        const tamanho = Math.max(0.6, Math.min(2, o.scale * (o.source.kind === 'recipe' && o.source.recipe === 'braseiro' ? 0.8 : 1)));
        const f: Fonte = { pos: [o.position[0], o.position[1]], tamanho, sprites: [], idade: [], deriva: [] };
        for (let i = 0; i < BAFORADAS; i++) {
          const s = new Sprite(baforada()); s.anchor.set(0.5); raiz.addChild(s);
          f.sprites.push(s); f.idade.push((i / BAFORADAS) * VIDA); f.deriva.push(Math.random() * 6);
          posicionar(f, i);
        }
        return f;
      });
      raiz.visible = ligado && fontes.length > 0;
    },
    quadro(dt) {
      if (!ligado || !fontes.length) return;
      const passo = Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1);
      for (const f of fontes) for (let i = 0; i < f.sprites.length; i++) {
        f.idade[i] = f.idade[i]! + passo;
        if (f.idade[i]! >= VIDA) { f.idade[i] = f.idade[i]! - VIDA; f.deriva[i] = Math.random() * 6; }
        posicionar(f, i);
      }
    },
    definirLigado(v) { ligado = v; raiz.visible = v && fontes.length > 0; },
    contagem: () => fontes.length,
    destruir() { raiz.destroy({ children: true }); },
  };
}
