/**
 * Linhas de nível (contornos de relevo) para o modo Construir.
 * Desenha traços tracejados sobre as bordas de `bordasDoRelevo` e rótulos de altitude ("−20 m")
 * espaçados ao longo de cada borda; nunca aparece no projetor nem na vista de jogador.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { bordasDoRelevo } from '../domain/relevo.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';

export interface SegmentoTracejado {
  a: Ponto;
  b: Ponto;
  cor: number;
}

export interface RotuloDeNivel {
  ponto: Ponto;
  texto: string;
  cor: number;
}

export interface ContornoDoRelevo {
  segmentos: SegmentoTracejado[];
  rotulos: RotuloDeNivel[];
}

export const PASSO_ROTULO_NIVEL = 15;
const TRACO_M = 0.35;
const ESPACO_M = 0.25;

/** Altitude representativa da borda para o rótulo: abaixo de zero mostra o fundo; acima, o topo. */
export function altitudeDaBorda(limiar: number, desnivel: number): number {
  return limiar <= 0 ? Math.round((limiar - desnivel) * 1000) / 1000 : limiar;
}

/** Texto legível em metros para a linha de nível ("−20 m", "+3 m", "0 m"). */
export function rotuloDeAltitude(alt: number): string {
  const arred = Math.round(alt * 100) / 100;
  if (arred < 0) return `−${String(Math.abs(arred)).replace('.', ',')} m`;
  if (arred > 0) return `+${String(arred).replace('.', ',')} m`;
  return '0 m';
}

export function corDaLinhaDeNivel(alt: number): number {
  if (alt < 0) return 0x6ec6f5;
  if (alt > 0) return 0xf0b35e;
  return 0xcbd5e1;
}

function comprimentoDaPolilinha(pts: readonly Ponto[]): number {
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    total += Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
  }
  return total;
}

function pontoNaPolilinha(pts: readonly Ponto[], distAlvo: number): Ponto {
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg < 1e-9) continue;
    if (acc + seg >= distAlvo) {
      const t = (distAlvo - acc) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    acc += seg;
  }
  return pts.at(-1)!;
}

function tracejarPolilinha(pts: readonly Ponto[], cor: number, saida: SegmentoTracejado[]): void {
  const ciclo = TRACO_M + ESPACO_M;
  let resto = 0;
  let pintando = true;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const seg = Math.hypot(dx, dy);
    if (seg < 1e-9) continue;
    const ux = dx / seg, uy = dy / seg;
    let pos = 0;
    while (pos < seg - 1e-9) {
      const alvo = (pintando ? TRACO_M : ESPACO_M) - resto;
      const passo = Math.min(seg - pos, alvo > 1e-9 ? alvo : ciclo);
      if (pintando) {
        saida.push({
          a: [a[0] + ux * pos, a[1] + uy * pos],
          b: [a[0] + ux * (pos + passo), a[1] + uy * (pos + passo)],
          cor,
        });
      }
      pos += passo;
      resto += passo;
      if (pintando && resto >= TRACO_M - 1e-9) { pintando = false; resto = 0; }
      else if (!pintando && resto >= ESPACO_M - 1e-9) { pintando = true; resto = 0; }
    }
  }
}

/** Calcula os subsegmentos tracejados e as posições de rótulo ("−20 m") para o relevo do mapa. */
export function segmentosERotulosDeNivel(
  m: Pick<MapaAtlas, 'bounds' | 'terrain'>,
  passoRotulo = PASSO_ROTULO_NIVEL,
): ContornoDoRelevo {
  const bordas = bordasDoRelevo(m);
  const segmentos: SegmentoTracejado[] = [];
  const rotulos: RotuloDeNivel[] = [];
  if (!bordas.length) return { segmentos, rotulos };

  for (const borda of bordas) {
    const alt = altitudeDaBorda(borda.limiar, borda.desnivel);
    const cor = corDaLinhaDeNivel(alt);
    const texto = rotuloDeAltitude(alt);
    for (const caminho of borda.caminhos) {
      if (caminho.length < 2) continue;
      tracejarPolilinha(caminho, cor, segmentos);
      const total = comprimentoDaPolilinha(caminho);
      if (total < 1.5) continue;
      const inicio = Math.min(total * 0.5, 4);
      for (let d = inicio; d < total - 0.5; d += passoRotulo) {
        rotulos.push({ ponto: pontoNaPolilinha(caminho, d), texto, cor });
      }
    }
  }
  return { segmentos, rotulos };
}

export interface LinhasDeNivel {
  container: Container;
  atualizar(m: MapaAtlas, zoom: number, visivel: boolean): void;
  destruir(): void;
}

/** Hash leve do conteúdo das faixas RLE para invalidar o cache ao estender/encolher um trecho. */
function hashFaixas(cells: readonly (readonly [number, number, number])[]): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < cells.length; i++) {
    const [y, x0, n] = cells[i]!;
    h = Math.imul(h ^ (y | 0), 16777619);
    h = Math.imul(h ^ (x0 | 0), 16777619);
    h = Math.imul(h ^ (n | 0), 16777619);
  }
  return h >>> 0;
}

/** Camada Pixi com linhas tracejadas e rótulos de altitude do relevo. */
export function criarLinhasDeNivel(): LinhasDeNivel {
  const container = new Container();
  container.label = 'linhas-de-nivel';
  const desenho = new Graphics();
  const textosC = new Container();
  container.addChild(desenho, textosC);
  const pool: Text[] = [];
  let ultimaChave = '';
  let ultimoZoom = 0;

  function obterTexto(i: number): Text {
    if (pool[i]) return pool[i]!;
    const t = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x07080b, width: 3.5 } },
    });
    t.anchor.set(0.5, 0.5);
    pool.push(t);
    textosC.addChild(t);
    return t;
  }

  return {
    container,
    atualizar(m: MapaAtlas, zoom: number, visivel: boolean) {
      container.visible = visivel;
      if (!visivel) return;
      const rel = m.terrain.relief;
      const chave = rel ? `${m.bounds.width}x${m.bounds.height}:${m.terrain.resolution}:${Object.entries(rel.patamares).map(([id, p]) => `${id}=${p.altura}:${p.cells.length}:${hashFaixas(p.cells)}`).join('|')}` : '';
      if (chave === ultimaChave && Math.abs(zoom - ultimoZoom) < 1e-6) return;
      ultimaChave = chave;
      ultimoZoom = zoom;

      desenho.clear();
      for (const t of pool) t.visible = false;
      if (!rel) return;

      const { segmentos, rotulos } = segmentosERotulosDeNivel(m);
      const w = 1.6 / Math.max(zoom, 1e-3);
      const porCor = new Map<number, SegmentoTracejado[]>();
      for (const s of segmentos) {
        let lista = porCor.get(s.cor);
        if (!lista) { lista = []; porCor.set(s.cor, lista); }
        lista.push(s);
      }
      for (const [cor, segs] of porCor) {
        for (const s of segs) desenho.moveTo(s.a[0], s.a[1]).lineTo(s.b[0], s.b[1]);
        desenho.stroke({ width: w, color: cor, alpha: 0.85, cap: 'round' });
      }

      const inv = 1 / Math.max(zoom, 1e-3);
      for (let i = 0; i < rotulos.length; i++) {
        const r = rotulos[i]!;
        const t = obterTexto(i);
        t.text = r.texto;
        t.style.fill = r.cor;
        t.scale.set(inv);
        t.position.set(r.ponto[0], r.ponto[1]);
        t.visible = true;
      }
    },
    destruir() {
      container.destroy({ children: true });
    },
  };
}
