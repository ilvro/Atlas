import type { DetalheDeTelhado, MapaAtlas, Ponto } from '../domain/mapa.ts';
import { aguasDe, formaDe, retangulosDe, type Face, type Trecho } from '../domain/telhado-geometria.ts';
import { elipse, poli, ret, type DescricaoDePiso, type Parte } from './descricao.ts';
import { hash2D, mulberry32 } from './ruido.ts';

/**
 * Os detalhes do telhado (chaminé, cruz, sino, cata-vento, claraboia, caixa-d'água) são descrições de desenho comuns, vistas de
 * cima com a frente para +y: os dois renderizadores as assam como assam as receitas, com sombra pelo `z`. O `z` é a altura
 * acima do telhado. Onde cada um fica sai de `posicoesDosDetalhes`, puro e repetível pela semente.
 */

const LEVE = { contorno: 'leve' as const, detalhe: 2 as const };
const MIUDO = { contorno: false as const, semSombra: true, detalhe: 3 as const };

/** As coberturas de feitio rústico ganham chaminé de pedra; o zinco, um cano de metal; as demais, tijolo. */
const CHAMINE_DE_PEDRA = new Set(['telha.pedra', 'telha.palha', 'telha.grama', 'telha.tabuinhas', 'telha.escamas']);

const girar = (pts: readonly [number, number][], a: number): number[] => { const c = Math.cos(a), s = Math.sin(a); return pts.flatMap(([x, y]) => [x * c - y * s, x * s + y * c]); };

function chamine(cobertura: string, r: () => number): Parte[] {
  if (cobertura === 'telha.zinco') return [
    elipse(0, 0, 0.3, 0.3, 'ferro', 1.2, LEVE), elipse(0, 0, 0.46, 0.46, 'ferro', 1.55, { contorno: 'leve' }),
    elipse(-0.05, -0.05, 0.3, 0.3, '#8d9298', 1.57, { ...MIUDO, suave: true, alfa: 0.55 }), elipse(0, 0, 0.14, 0.14, '#1a1817', 1.58, { ...MIUDO, detalhe: 2 }),
  ];
  const w = 0.62 + r() * 0.16, d = 0.5 + r() * 0.12, pedra = CHAMINE_DE_PEDRA.has(cobertura), corpo = pedra ? 'laje.pedra' : 'tijolo', capa = pedra ? '#8a877e' : '#7a3a28';
  return [
    ret(0, 0, w, d, corpo, 1.4, { contorno: 'leve' }),
    ret(0, 0, w + 0.08, d + 0.08, capa, 1.5, { ...LEVE, raio: 0.02 }),
    ret(0, 0, w - 0.06, d - 0.06, corpo, 1.52, { contorno: false, semSombra: true, detalhe: 2 }),
    elipse(0, 0, w * 0.75, d * 0.75, '#201b18', 1.53, { ...MIUDO, suave: true, alfa: 0.55 }),
    ret(0, 0, w * 0.46, d * 0.46, '#120f0d', 1.55, { ...MIUDO, detalhe: 2 }),      // a boca fica no Pixel
  ];
}

function cruz(): Parte[] {
  return [
    ret(0, 0.38, 0.24, 0.18, 'laje.pedra', 1.2, LEVE),
    ret(0, 0, 0.13, 0.92, 'latao', 2.2, { contorno: 'leve' }),
    ret(0, -0.18, 0.54, 0.13, 'latao', 2.25, { contorno: 'leve' }),
    ret(-0.015, -0.015, 0.03, 0.8, '#f2d68c', 2.27, { ...MIUDO, alfa: 0.7 }),
  ];
}

function sino(): Parte[] {
  const posts = [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]] as const;
  return [
    ret(0, 0, 1.24, 1.24, 'madeira.escura', 1.0, { contorno: 'leve' }),
    ret(0, 0, 1.0, 1.0, '#130f0b', 1.02, { contorno: false, semSombra: true }),
    elipse(0, 0, 0.66, 0.66, 'latao', 1.6, { contorno: 'leve' }),
    elipse(0, 0, 0.46, 0.46, '#7a5420', 1.62, { ...MIUDO, detalhe: 2 }),
    elipse(-0.06, -0.06, 0.3, 0.3, '#e0bf72', 1.64, { ...MIUDO, suave: true }),
    ret(0, 0, 1.12, 0.12, 'madeira.media', 1.9, LEVE),
    ...posts.map(([x, y]) => ret(x, y, 0.16, 0.16, 'madeira.media', 2.0, LEVE)),
  ];
}

function catavento(r: () => number): Parte[] {
  const a = r() * Math.PI * 2;
  const flecha = girar([[-0.5, -0.03], [0.3, -0.03], [0.3, -0.1], [0.48, 0], [0.3, 0.1], [0.3, 0.03], [-0.5, 0.03]], a);
  const cauda = girar([[-0.52, 0], [-0.36, -0.16], [-0.3, -0.16], [-0.38, 0], [-0.3, 0.16], [-0.36, 0.16]], a);
  return [
    ret(0, 0, 0.84, 0.035, 'ferro', 2.2, MIUDO), ret(0, 0, 0.035, 0.84, 'ferro', 2.2, MIUDO),
    ...[[0, -0.46], [0.46, 0], [0, 0.46], [-0.46, 0]].map(([x, y]) => elipse(x!, y!, 0.07, 0.07, 'ferro', 2.21, MIUDO)),
    poli(flecha, 'ferro', 2.5, { contorno: 'leve' }), poli(cauda, 'ferro', 2.5, { contorno: 'leve' }),
    elipse(0, 0, 0.13, 0.13, 'latao', 2.55, { contorno: 'leve' }),
  ];
}

function claraboia(): Parte[] {
  return [
    ret(0, 0, 0.92, 0.72, 'madeira.escura', 0.25, { contorno: 'leve' }),
    ret(0, 0, 0.78, 0.58, 'vidro', 0.3, { contorno: false, vidro: true }),
    ret(0, 0, 0.04, 0.58, 'madeira.escura', 0.32, MIUDO), ret(0, 0, 0.78, 0.04, 'madeira.escura', 0.32, MIUDO),
    poli([-0.36, -0.08, -0.2, -0.26, -0.12, -0.26, -0.28, -0.08], '#ffffff', 0.33, { ...MIUDO, suave: true, alfa: 0.4 }),
  ];
}

function caixaDagua(): Parte[] {
  return [
    ret(0, 0, 1.56, 1.56, 'concreto', 0.4, LEVE),
    ret(0.86, 0.3, 0.5, 0.07, 'ferro', 0.5, MIUDO),
    elipse(0, 0, 1.34, 1.34, '#3c6c98', 1.3, { contorno: 'leve' }),
    elipse(0, 0, 1.04, 1.04, '#4f84b4', 1.36, LEVE),
    elipse(0, 0, 0.5, 0.5, '#3c6c98', 1.38, MIUDO),
    elipse(-0.18, -0.2, 0.3, 0.2, '#9cc3e2', 1.39, { ...MIUDO, suave: true, alfa: 0.5 }),
  ];
}

/** A descrição de um detalhe; a cobertura escolhe o material da chaminé, a semente varia tamanho e rumo. */
export function descricaoDoDetalhe(detalhe: DetalheDeTelhado, o: { cobertura: string; semente: number }): DescricaoDePiso {
  const r = mulberry32(o.semente * 7919 + 17);
  const partes = detalhe === 'chamine' ? chamine(o.cobertura, r) : detalhe === 'cruz' ? cruz() : detalhe === 'sino' ? sino() : detalhe === 'catavento' ? catavento(r) : detalhe === 'claraboia' ? claraboia() : caixaDagua();
  const pegada: Record<DetalheDeTelhado, [number, number]> = { chamine: [0.8, 0.7], cruz: [0.52, 0.92], sino: [1.24, 1.24], catavento: [1, 1], claraboia: [0.92, 0.72], 'caixa-dagua': [1.56, 1.56] };
  return { tipo: 'piso', pegada: pegada[detalhe], partes };
}

/** Onde um detalhe fica no mundo, em metros, e para onde gira (radianos; a claraboia segue a água em que está). */
export interface PosicaoDeDetalhe { detalhe: DetalheDeTelhado; x: number; y: number; ang: number }

const area = (f: Face): number => { let s = 0; const p = f.pontos; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
const centro = (f: Face): Ponto => { const p = f.pontos; return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; };

/**
 * As posições dos detalhes do trecho, todas no maior retângulo dele: a chaminé numa água, a 1/3 ou 2/3 da cumeeira; a cruz na
 * ponta da cumeeira voltada para a frente do mapa (+y); o sino no centro; o cata-vento no meio da cumeeira; a claraboia no meio
 * da maior água; a caixa-d'água no centro. Sem cumeeira (pirâmide, laje, quatro águas quadrado), tudo parte do centro.
 */
export function posicoesDosDetalhes(trecho: Trecho, grade: Pick<MapaAtlas['grid'], 'size' | 'offset'>, semente: number): PosicaoDeDetalhe[] {
  const detalhes = formaDe(trecho.roof).details;
  const principal = retangulosDe(trecho.celulas)[0];
  if (!detalhes.length || !principal) return [];
  const t = grade.size, [ox, oy] = grade.offset;
  const x0 = ox + principal[0] * t, y0 = oy + principal[1] * t, x1 = ox + principal[2] * t, y1 = oy + principal[3] * t;
  const { faces, cumeeiras } = aguasDe([x0, y0, x1, y1], trecho.roof, 0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, meioMenor = Math.min(x1 - x0, y1 - y0) / 2, cume = cumeeiras[0];
  const azar = (k: number) => hash2D(Math.floor(semente), k, 977);
  const saida: PosicaoDeDetalhe[] = [];
  const usados: Ponto[] = [];
  /** Afasta um detalhe de outro que já caiu perto: tenta ao longo da cumeeira (para os dois lados) e depois nas águas, sempre dentro do retângulo. */
  const livre = (p: Ponto): Ponto => {
    const [dx, dy] = cume ? [cume[1][0] - cume[0][0], cume[1][1] - cume[0][1]] : [0, 1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    const prender = (q: Ponto): Ponto => [Math.min(x1 - 0.4, Math.max(x0 + 0.4, q[0])), Math.min(y1 - 0.4, Math.max(y0 + 0.4, q[1]))];
    const longe = (q: Ponto) => usados.every(u => Math.hypot(u[0] - q[0], u[1] - q[1]) >= 1);
    const tentativas: Ponto[] = [[0, 0]];
    for (let k = 1; k <= 6; k++) for (const s1 of [1, -1]) tentativas.push([s1 * k * 1.1, 0]);
    for (const lado of [1, -1]) for (let k = 0; k <= 6; k++) for (const s1 of k ? [1, -1] : [1]) tentativas.push([s1 * k * 1.1, lado * Math.max(0.9, meioMenor * 0.6)]);
    let escolhido = prender(p);
    for (const [ao, perp] of tentativas) {
      const q = prender([p[0] + ux * ao - uy * perp, p[1] + uy * ao + ux * perp]);
      if (longe(q)) { escolhido = q; break; }
    }
    usados.push(escolhido); return escolhido;
  };
  for (const d of detalhes) {
    let p: Ponto = [cx, cy], ang = 0;
    if (d === 'chamine') {
      const lado = azar(1) < 0.5 ? -1 : 1, desvio = Math.min(0.7, meioMenor * 0.45);
      if (cume) {
        const k = azar(2) < 0.5 ? 1 / 3 : 2 / 3, px = cume[0][0] + (cume[1][0] - cume[0][0]) * k, py = cume[0][1] + (cume[1][1] - cume[0][1]) * k;
        const horizontal = Math.abs(cume[1][0] - cume[0][0]) >= Math.abs(cume[1][1] - cume[0][1]);
        p = horizontal ? [px, py + lado * desvio] : [px + lado * desvio, py];
      } else p = azar(2) < 0.5 ? [cx + lado * desvio, cy] : [cx, cy + lado * desvio];
    } else if (d === 'cruz') {
      if (cume) {
        const [a, b] = cume, frente = b[1] > a[1] || (b[1] === a[1] && b[0] > a[0]) ? b : a, atras = frente === a ? b : a, n = Math.hypot(frente[0] - atras[0], frente[1] - atras[1]) || 1;
        p = [frente[0] - ((frente[0] - atras[0]) / n) * 0.35, frente[1] - ((frente[1] - atras[1]) / n) * 0.35];
      } else p = [cx, cy];
    } else if (d === 'catavento') {
      p = cume ? [(cume[0][0] + cume[1][0]) / 2, (cume[0][1] + cume[1][1]) / 2] : [cx, cy];
    } else if (d === 'claraboia') {
      const maior = faces.filter(f => !f.platibanda).reduce((a, b) => (area(b) > area(a) ? b : a), faces[0]!);
      p = centro(maior); ang = maior.normal[0] || maior.normal[1] ? Math.atan2(maior.queda[1], maior.queda[0]) - Math.PI / 2 : 0;
    }
    const [x, y] = livre(p);
    saida.push({ detalhe: d, x, y, ang });
  }
  return saida;
}
