import type { CampoDoTelhado } from '../domain/campo-do-telhado.ts';
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

/** Ar-condicionado de janela/telhado: caixa de metal claro com a grade do ventilador (pás e cubo) e o duto saindo para a água. */
function arCondicionado(r: () => number): Parte[] {
  const giro = r() * Math.PI;
  return [
    ret(0, 0, 0.96, 0.66, '#b8bab6', 0.75, { contorno: 'leve' }),
    ret(0.36, 0, 0.16, 0.6, '#9a9c98', 0.78, MIUDO),
    ...[-0.24, -0.12, 0, 0.12, 0.24].map(y => ret(0.36, y, 0.14, 0.03, '#6a6c68', 0.79, MIUDO)),
    elipse(-0.14, 0, 0.56, 0.56, '#3a3c3a', 0.78, { ...MIUDO, detalhe: 2 }),
    ...[0, 1, 2].map(k => poli([[-0.14, 0], [-0.14 + Math.cos(giro + k * 2.094) * 0.25, Math.sin(giro + k * 2.094) * 0.25], [-0.14 + Math.cos(giro + k * 2.094 + 0.5) * 0.22, Math.sin(giro + k * 2.094 + 0.5) * 0.22]].flat(), '#8a8c88', 0.79, MIUDO)),
    elipse(-0.14, 0, 0.1, 0.1, '#5a5c58', 0.8, MIUDO),
    ret(-0.62, 0.12, 0.3, 0.08, '#6a6c68', 0.3, MIUDO),
  ];
}

/** Antena parabólica num pé: prato claro com o braço do receptor e a sombra interna do lado da luz. */
function antena(r: () => number): Parte[] {
  const a = r() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  return [
    elipse(0, 0, 0.24, 0.24, 'ferro', 0.9, LEVE),
    elipse(c * 0.12, s * 0.12, 0.92, 0.8, '#d6d6d0', 1.5, { contorno: 'leve' }),
    elipse(c * 0.16, s * 0.16, 0.7, 0.6, '#b0b0aa', 1.52, { ...MIUDO, suave: true }),
    poli([c * 0.1 - s * 0.02, s * 0.1 + c * 0.02, c * 0.45 - s * 0.02, s * 0.45 + c * 0.02, c * 0.45 + s * 0.02, s * 0.45 - c * 0.02, c * 0.1 + s * 0.02, s * 0.1 - c * 0.02], 'ferro', 1.6, MIUDO),
    elipse(c * 0.47, s * 0.47, 0.08, 0.08, '#3a3a3a', 1.62, MIUDO),
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
  const partes = detalhe === 'chamine' ? chamine(o.cobertura, r) : detalhe === 'cruz' ? cruz() : detalhe === 'sino' ? sino() : detalhe === 'catavento' ? catavento(r) : detalhe === 'claraboia' ? claraboia() : detalhe === 'ar-condicionado' ? arCondicionado(r) : detalhe === 'antena' ? antena(r) : caixaDagua();
  const pegada: Record<DetalheDeTelhado, [number, number]> = { chamine: [0.8, 0.7], cruz: [0.52, 0.92], sino: [1.24, 1.24], catavento: [1, 1], claraboia: [0.92, 0.72], 'caixa-dagua': [1.56, 1.56], 'ar-condicionado': [1.4, 0.7], antena: [1.1, 1.1] };
  return { tipo: 'piso', pegada: pegada[detalhe], partes };
}

/** Onde um detalhe fica no mundo, em metros, e para onde gira (radianos; a claraboia segue a água em que está). */
export interface PosicaoDeDetalhe { detalhe: DetalheDeTelhado; x: number; y: number; ang: number }

const area = (f: Face): number => { let s = 0; const p = f.pontos; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
const centro = (f: Face): Ponto => { const p = f.pontos; return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; };

/**
 * As posições dos detalhes do trecho, todas no maior retângulo dele: a chaminé numa água, a 1/3 ou 2/3 da cumeeira; a cruz na
 * ponta da cumeeira voltada para a frente do mapa (+y); o sino no centro; o cata-vento no meio da cumeeira; a claraboia no meio
 * da maior água; a caixa-d'água no centro. Sem cumeeira (pirâmide, laje, cúpula, bulbo, cone, quatro águas quadrado), tudo parte do centro.
 * Quando `campo` é fornecido, valida as posições no campo de altura (evitando rincões e ajustando a rotação da claraboia pela inclinação real).
 */
export function posicoesDosDetalhes(
  trecho: Trecho,
  grade: Pick<MapaAtlas['grid'], 'size' | 'offset'>,
  semente: number,
  campo?: CampoDoTelhado,
): PosicaoDeDetalhe[] {
  const forma = formaDe(trecho.roof);
  const detalhes = forma.details;
  if (!detalhes.length) return [];
  if (trecho.outline && trecho.outline.length >= 3) {
    const cx = trecho.outline.reduce((s, p) => s + p[0], 0) / trecho.outline.length;
    const cy = trecho.outline.reduce((s, p) => s + p[1], 0) / trecho.outline.length;
    return detalhes.map((d, i) => {
      const px = cx + (i === 0 ? 0 : (i - 0.5) * 0.9);
      const py = cy;
      let ang = 0;
      if (d === 'claraboia' && campo) {
        const a = campo.amostrar(px, py);
        if (a && (a.gx !== 0 || a.gy !== 0)) ang = Math.atan2(-a.gy, -a.gx) - Math.PI / 2;
      }
      return { detalhe: d, x: px, y: py, ang };
    });
  }
  const principal = retangulosDe(trecho.celulas)[0];
  if (!principal) return [];
  const t = grade.size, [ox, oy] = grade.offset;
  const x0 = ox + principal[0] * t, y0 = oy + principal[1] * t, x1 = ox + principal[2] * t, y1 = oy + principal[3] * t;
  const semCumeeira = forma.shape === 'cupula' || forma.shape === 'bulbo' || forma.shape === 'cone' || forma.shape === 'uma-agua';
  const { faces, cumeeiras } = aguasDe([x0, y0, x1, y1], trecho.roof, 0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, meioMenor = Math.min(x1 - x0, y1 - y0) / 2, cume = semCumeeira ? undefined : cumeeiras[0];
  const azar = (k: number) => hash2D(Math.floor(semente), k, 977);
  const saida: PosicaoDeDetalhe[] = [];
  const usados: Ponto[] = [];
  /** Afasta um detalhe de outro que já caiu perto: tenta ao longo da cumeeira (para os dois lados) e depois nas águas, sempre dentro do retângulo. */
  const livre = (p: Ponto, prefereAgua = false): Ponto => {
    const [dx, dy] = cume ? [cume[1][0] - cume[0][0], cume[1][1] - cume[0][1]] : [0, 1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    const prender = (q: Ponto): Ponto => [Math.min(x1 - 0.4, Math.max(x0 + 0.4, q[0])), Math.min(y1 - 0.4, Math.max(y0 + 0.4, q[1]))];
    const longe = (q: Ponto) => usados.every(u => Math.hypot(u[0] - q[0], u[1] - q[1]) >= 1);
    const bomNoCampo = (q: Ponto): boolean => {
      if (!campo) return true;
      const a = campo.amostrar(q[0], q[1]);
      if (!a || a.peca === 'rincao' || a.folgaRincao < 0.12) return false;
      if (prefereAgua && a.peca === 'beiral') return false;
      return true;
    };
    const tentativas: Ponto[] = [[0, 0]];
    for (let k = 1; k <= 6; k++) for (const s1 of [1, -1]) tentativas.push([s1 * k * 1.1, 0]);
    for (const lado of [1, -1]) for (let k = 0; k <= 6; k++) for (const s1 of k ? [1, -1] : [1]) tentativas.push([s1 * k * 1.1, lado * Math.max(0.9, meioMenor * 0.6)]);
    let escolhido: Ponto | null = null;
    for (const [ao, perp] of tentativas) {
      const q = prender([p[0] + ux * ao - uy * perp, p[1] + uy * ao + ux * perp]);
      if (longe(q) && bomNoCampo(q)) { escolhido = q; break; }
    }
    if (!escolhido) {
      escolhido = prender(p);
      for (const [ao, perp] of tentativas) {
        const q = prender([p[0] + ux * ao - uy * perp, p[1] + uy * ao + ux * perp]);
        if (longe(q)) { escolhido = q; break; }
      }
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
    } else if (d === 'ar-condicionado') {
      p = [cx + (azar(3) < 0.5 ? -1 : 1) * Math.min(1.2, (x1 - x0) * 0.25), cy + (azar(4) - 0.5) * Math.min(1, (y1 - y0) * 0.3)];
    } else if (d === 'antena') {
      p = [azar(5) < 0.5 ? x0 + 0.8 : x1 - 0.8, azar(6) < 0.5 ? y0 + 0.8 : y1 - 0.8];
    } else if (d === 'claraboia') {
      const maior = faces.filter(f => !f.platibanda).reduce((a, b) => (area(b) > area(a) ? b : a), faces[0]!);
      p = centro(maior); ang = maior.normal[0] || maior.normal[1] ? Math.atan2(maior.queda[1], maior.queda[0]) - Math.PI / 2 : 0;
    }
    const [x, y] = livre(p, d === 'chamine' || d === 'claraboia');
    if (d === 'claraboia' && campo) {
      const a = campo.amostrar(x, y);
      if (a && (a.gx !== 0 || a.gy !== 0)) ang = Math.atan2(-a.gy, -a.gx) - Math.PI / 2;
    }
    saida.push({ detalhe: d, x, y, ang });
  }
  return saida;
}
