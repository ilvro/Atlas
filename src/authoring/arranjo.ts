/**
 * Arranjos espaciais de objetos com variação controlada (fileiras, grade solta, aglomerado, ao longo de caminho,
 * círculo e bordas). Pura em `src/authoring/`: evita paredes, cômodos externos, objetos existentes e reservas de portas.
 */
import { comodoEm, indiceDeCelulas } from '../domain/geometria.ts';
import { novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { mulberry32 } from '../procedural/ruido.ts';
import type { Comando } from '../state/comandos.ts';
import { ErroDeConstrucao, type Construcao, type GeradorDeId } from './construcao.ts';
import { medirForma, sementeDaForma, type Forma } from './formas.ts';
import { caixaDoObjeto, type Caixa } from './insight.ts';
import { reservasDePorta } from './portas.ts';

export type Padrao = 'fileiras' | 'grade-solta' | 'aglomerado' | 'ao-longo' | 'circulo' | 'bordas';

export interface ItemDeArranjo {
  item: string;
  peso?: number;
  escala?: [number, number];
  params?: Record<string, unknown>;
}

export interface PedidoDeArranjo {
  padrao: Padrao;
  /** Em `'ao-longo'`, deve ser `{ faixa: [[x, y], ...], largura }`. */
  area: Forma;
  itens: ItemDeArranjo[];
  /** Metros entre colunas e entre fileiras (ou `[passoAoLongo, afastamentoLateral]` em `'ao-longo'`). */
  espacamento: [number, number];
  /** Direção das fileiras em radianos (padrão `0`). */
  angulo?: number;
  /** Metros de deslocamento aleatório (padrão 15% do menor espaçamento; 35% em `grade-solta`). */
  desalinho?: number;
  /** Variação de rotação em radianos (padrão `0.08`). */
  giro?: number;
  /** Chance `0..0.6` de pular uma posição (padrão `0.1`). */
  falhas?: number;
  encarar?: 'fileira' | 'centro' | 'caminho' | 'livre';
  /** Fileiras em quadras com corredores: `tamanho: [cols, rows]`, `vazio` em metros. */
  grupos?: { tamanho: [number, number]; vazio: number };
}

interface Candidato {
  pos: Ponto;
  dir: number;
}

const PADROES: readonly Padrao[] = ['fileiras', 'grade-solta', 'aglomerado', 'ao-longo', 'circulo', 'bordas'];
const ENCARAR_VALIDOS = new Set(['fileira', 'centro', 'caminho', 'livre']);
const MAX_ITENS_ARRANJO = 300;

function erroDeItem(item: string): ErroDeConstrucao {
  const termo = item.toLowerCase().replace(/^casa:/, '');
  const tokens = termo.split(/[-._\s]+/).filter(Boolean);
  const todos = ACERVO.lista();
  const parecidos = todos
    .filter(i => {
      const alvo = `${i.id} ${i.nome.toLowerCase()} ${i.tags.join(' ')}`;
      return (termo && alvo.includes(termo)) || tokens.some(tk => tk.length >= 3 && alvo.includes(tk));
    })
    .slice(0, 15)
    .map(i => i.id);
  const lista = parecidos.length
    ? `parecidos: ${parecidos.join(', ')}`
    : `exemplos do acervo: ${todos.slice(0, 25).map(i => i.id).join(', ')}`;
  return new ErroDeConstrucao(`item “${item}” não existe no acervo; ${lista}`);
}

function caixasSobrepoem(a: Caixa, b: Caixa): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function segmentoTocaCaixa(ax: number, ay: number, bx: number, by: number, c: Caixa, folga: number): boolean {
  const rx0 = c.x0 - folga, ry0 = c.y0 - folga, rx1 = c.x1 + folga, ry1 = c.y1 + folga;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - rx0], [dx, rx1 - ax], [-dy, ay - ry0], [dy, ry1 - ay]] as [number, number][]) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

function paredesBloqueiamCaixa(m: MapaAtlas, c: Caixa): boolean {
  for (const p of Object.values(m.walls)) {
    const meia = (p.thickness || 0.2) / 2;
    for (let i = 0; i + 1 < p.path.length; i++) {
      const a = p.path[i]!, b = p.path[i + 1]!;
      if (segmentoTocaCaixa(a[0], a[1], b[0], b[1], c, meia)) return true;
    }
  }
  return false;
}

function reservasDasAberturasExistentes(m: MapaAtlas): Caixa[] {
  const caixas: Caixa[] = [];
  for (const ab of Object.values(m.openings)) {
    const p = m.walls[ab.wallId];
    if (!p || p.path.length < 2) continue;
    let total = 0;
    for (let i = 0; i + 1 < p.path.length; i++) {
      total += Math.hypot(p.path[i + 1]![0] - p.path[i]![0], p.path[i + 1]![1] - p.path[i]![1]);
    }
    const alvo = ab.at * total;
    let acc = 0;
    let ponto: Ponto = p.path[0]!;
    let horiz = true;
    for (let i = 0; i + 1 < p.path.length; i++) {
      const a = p.path[i]!, b = p.path[i + 1]!;
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + seg >= alvo || i + 2 === p.path.length) {
        const t = seg > 0 ? Math.max(0, Math.min(1, (alvo - acc) / seg)) : 0;
        ponto = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        horiz = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
        break;
      }
      acc += seg;
    }
    const meio = ab.width / 2 + 0.15;
    const frente = 0.9;
    caixas.push(
      horiz
        ? { x0: ponto[0] - meio, x1: ponto[0] + meio, y0: ponto[1] - frente, y1: ponto[1] + frente }
        : { x0: ponto[0] - frente, x1: ponto[0] + frente, y0: ponto[1] - meio, y1: ponto[1] + meio },
    );
  }
  return caixas;
}

function sortearItem(itens: readonly ItemDeArranjo[], pesosAcum: readonly number[], r: number): ItemDeArranjo {
  const alvo = r * pesosAcum[pesosAcum.length - 1]!;
  for (let i = 0; i < pesosAcum.length; i++) {
    if (alvo <= pesosAcum[i]!) return itens[i]!;
  }
  return itens[itens.length - 1]!;
}

/** Gera comandos `item.adicionar` em padrão geométrico controlado com jitter, escala e desvio de colisões. */
export function arranjar(
  m: MapaAtlas,
  p: PedidoDeArranjo,
  semente = 1,
  gerarId: GeradorDeId = novoIdEntidade,
): Construcao & { ignorados: number } {
  if (!PADROES.includes(p.padrao)) {
    throw new ErroDeConstrucao(`padrão “${String(p.padrao)}” não existe; padrões: ${PADROES.join(', ')}`);
  }
  if (!Array.isArray(p.itens) || !p.itens.length) {
    throw new ErroDeConstrucao('um arranjo precisa de ao menos 1 item');
  }
  for (const it of p.itens) {
    if (!ACERVO.item(it.item)) throw erroDeItem(it.item);
    if (it.peso !== undefined && (!Number.isFinite(it.peso) || it.peso <= 0)) {
      throw new ErroDeConstrucao(`peso inválido (${it.peso}) em “${it.item}”`);
    }
    if (it.escala !== undefined && (it.escala[0] <= 0 || it.escala[1] < it.escala[0])) {
      throw new ErroDeConstrucao(`escala inválida [${it.escala[0]}, ${it.escala[1]}] em “${it.item}”`);
    }
  }
  const [dx, dy] = p.espacamento;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx <= 0.1 || dy <= 0.1) {
    throw new ErroDeConstrucao(`espaçamento [${dx}, ${dy}] inválido (use > 0,1 m)`);
  }
  if (p.padrao === 'ao-longo' && !('faixa' in p.area)) {
    throw new ErroDeConstrucao('o padrão "ao-longo" exige area com { faixa: [[x, y], ...], largura }');
  }
  if (p.encarar !== undefined && !ENCARAR_VALIDOS.has(p.encarar)) {
    throw new ErroDeConstrucao(`encarar “${String(p.encarar)}” não existe; valores: fileira, centro, caminho, livre`);
  }

  const falhas = Math.max(0, Math.min(0.6, p.falhas ?? 0.1));
  const angulo = p.angulo ?? 0;
  const giro = Math.max(0, p.giro ?? 0.08);
  const desalinho = p.desalinho ?? (p.padrao === 'grade-solta' ? 0.35 : 0.15) * Math.min(dx, dy);
  const encarar = p.encarar ?? (p.padrao === 'grade-solta' ? 'livre' : p.padrao === 'ao-longo' ? 'caminho' : p.padrao === 'circulo' || p.padrao === 'bordas' ? 'centro' : 'fileira');

  const sementeInt = Math.floor(semente) || 1;
  const rng = mulberry32(sementeInt);
  const medida = medirForma(p.area, m.terrain.resolution, sementeDaForma(sementeInt, 0));
  const { caixa } = medida;
  const cx = (caixa.x0 + caixa.x1) / 2;
  const cy = (caixa.y0 + caixa.y1) / 2;

  const candidatos: Candidato[] = [];

  if (p.padrao === 'fileiras' || p.padrao === 'grade-solta') {
    const ux = Math.cos(angulo), uy = Math.sin(angulo);
    const vx = -uy, vy = ux;
    const cantos: Ponto[] = [
      [caixa.x0 - cx, caixa.y0 - cy],
      [caixa.x1 - cx, caixa.y0 - cy],
      [caixa.x0 - cx, caixa.y1 - cy],
      [caixa.x1 - cx, caixa.y1 - cy],
    ];
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const [rx, ry] of cantos) {
      const u = rx * ux + ry * uy, v = rx * vx + ry * vy;
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
    }

    const posEixo = (min: number, max: number, passo: number, tamGrupo: number, vazioGrupo: number): number[] => {
      const vals: number[] = [];
      let cursor = min + passo / 2;
      let noGrupo = 0;
      while (cursor <= max) {
        vals.push(cursor);
        noGrupo++;
        if (tamGrupo > 0 && noGrupo >= tamGrupo) {
          cursor += passo + vazioGrupo;
          noGrupo = 0;
        } else {
          cursor += passo;
        }
      }
      return vals;
    };

    const tamCol = p.grupos?.tamanho[0] ?? 0;
    const tamRow = p.grupos?.tamanho[1] ?? 0;
    const vazio = p.grupos?.vazio ?? 0;
    const us = posEixo(uMin, uMax, dx, tamCol, vazio);
    const vs = posEixo(vMin, vMax, dy, tamRow, vazio);

    for (const v of vs) {
      for (const u of us) {
        const bx = cx + u * ux + v * vx;
        const by = cy + u * uy + v * vy;
        if (!medida.dentro([bx, by])) continue;
        if (rng() < falhas) continue;
        const px = bx + (rng() * 2 - 1) * desalinho;
        const py = by + (rng() * 2 - 1) * desalinho;
        if (!medida.dentro([px, py])) continue;
        candidatos.push({ pos: [px, py], dir: angulo });
      }
    }
  } else if (p.padrao === 'aglomerado') {
    const rMin = Math.min(dx, dy);
    const raioMax = Math.max(0.5, Math.hypot(caixa.x1 - cx, caixa.y1 - cy));
    const alvoQtd = Math.min(MAX_ITENS_ARRANJO, Math.max(4, Math.ceil(((caixa.x1 - caixa.x0) * (caixa.y1 - caixa.y0)) / (dx * dy) * 1.4)));
    const aceitos: Ponto[] = [];
    for (let t = 0; t < alvoQtd * 18 && candidatos.length < alvoQtd; t++) {
      const px = caixa.x0 + rng() * (caixa.x1 - caixa.x0);
      const py = caixa.y0 + rng() * (caixa.y1 - caixa.y0);
      if (!medida.dentro([px, py])) continue;
      const distNorm = Math.hypot(px - cx, py - cy) / raioMax;
      if (rng() > 1 - 0.65 * distNorm) continue;
      if (aceitos.some(q => Math.hypot(q[0] - px, q[1] - py) < rMin)) continue;
      aceitos.push([px, py]);
      if (rng() < falhas) continue;
      candidatos.push({ pos: [px, py], dir: rng() * Math.PI * 2 });
    }
  } else if (p.padrao === 'ao-longo') {
    const pts = (p.area as { faixa: readonly Ponto[] }).faixa;
    const passo = Math.max(0.2, dx);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (segLen < 1e-6) continue;
      const tx = (b[0] - a[0]) / segLen, ty = (b[1] - a[1]) / segLen;
      const nx = -ty, ny = tx;
      const theta = Math.atan2(ty, tx);
      for (let s = passo / 2; s < segLen; s += passo) {
        const mx = a[0] + tx * s, my = a[1] + ty * s;
        for (const lado of [-1, 1] as const) {
          if (rng() < falhas) continue;
          const jx = (rng() * 2 - 1) * desalinho;
          const jy = (rng() * 2 - 1) * desalinho;
          const px = mx + nx * dy * lado + jx;
          const py = my + ny * dy * lado + jy;
          candidatos.push({ pos: [px, py], dir: theta + (lado < 0 ? Math.PI : 0) });
        }
      }
    }
  } else if (p.padrao === 'circulo') {
    const centro: Ponto = 'disco' in p.area ? [p.area.disco[0], p.area.disco[1]] : [cx, cy];
    const rMax = 'disco' in p.area ? p.area.raio : Math.hypot(caixa.x1 - cx, caixa.y1 - cy);
    for (let r = dy; r <= rMax + 1e-6; r += dy) {
      const qtdAnel = Math.max(1, Math.floor((2 * Math.PI * r) / dx));
      const fase = rng() * Math.PI * 2;
      for (let k = 0; k < qtdAnel; k++) {
        if (rng() < falhas) continue;
        const a = fase + (k * Math.PI * 2) / qtdAnel;
        const px = centro[0] + Math.cos(a) * r + (rng() * 2 - 1) * desalinho;
        const py = centro[1] + Math.sin(a) * r + (rng() * 2 - 1) * desalinho;
        if (!medida.dentro([px, py])) continue;
        candidatos.push({ pos: [px, py], dir: Math.atan2(centro[1] - py, centro[0] - px) });
      }
    }
  } else {
    // 'bordas'
    const passo = Math.max(0.25, Math.min(dx, dy) * 0.5);
    const banda = Math.max(0.4, Math.min(dx, dy) * 0.8);
    const aceitos: Ponto[] = [];
    for (let y = caixa.y0 + passo / 2; y <= caixa.y1; y += passo) {
      for (let x = caixa.x0 + passo / 2; x <= caixa.x1; x += passo) {
        const d = medida.sdf([x, y]);
        if (d > -0.05 || d < -banda) continue;
        if (aceitos.some(q => Math.hypot(q[0] - x, q[1] - y) < Math.min(dx, dy) * 0.85)) continue;
        if (rng() < falhas) continue;
        aceitos.push([x, y]);
        const px = x + (rng() * 2 - 1) * (desalinho * 0.5);
        const py = y + (rng() * 2 - 1) * (desalinho * 0.5);
        candidatos.push({ pos: [px, py], dir: Math.atan2(cy - py, cx - px) });
      }
    }
  }

  // Contexto do mapa para evitar colisões
  const indice = indiceDeCelulas(m);
  const salaDaArea = p.padrao === 'ao-longo' ? null : comodoEm(m, [cx, cy], indice);
  const bloqueios: Caixa[] = [];
  for (const o of Object.values(m.props)) {
    if (o.elevation === 'floor' && o.blocks.move) bloqueios.push(caixaDoObjeto(o));
  }
  const portasBloq: Caixa[] = [...reservasDasAberturasExistentes(m)];
  if (salaDaArea) portasBloq.push(...reservasDePorta(m, salaDaArea));

  const pesosAcum: number[] = [];
  let soma = 0;
  for (const it of p.itens) {
    soma += it.peso ?? 1;
    pesosAcum.push(soma);
  }

  const comandos: Comando[] = [];
  const ids: string[] = [];
  let ignorados = 0;

  for (const cand of candidatos) {
    if (ids.length >= MAX_ITENS_ARRANJO) {
      ignorados++;
      continue;
    }
    const escolha = sortearItem(p.itens, pesosAcum, rng());
    const escala = escolha.escala ? escolha.escala[0] + rng() * (escolha.escala[1] - escolha.escala[0]) : 1;
    const itemSeed = Math.floor(rng() * 2 ** 31);
    const fonte = ACERVO.fonte(escolha.item, itemSeed, escolha.params);
    const [fw, fh] = ACERVO.pegadaDaFonte(fonte);
    let rotacao: number;
    if (encarar === 'livre') rotacao = rng() * Math.PI * 2;
    else if (encarar === 'centro') rotacao = Math.atan2(cy - cand.pos[1], cx - cand.pos[0]) + (rng() * 2 - 1) * giro;
    else rotacao = cand.dir + (rng() * 2 - 1) * giro;

    const c = Math.abs(Math.cos(rotacao)), s = Math.abs(Math.sin(rotacao));
    const ex = (c * fw * escala + s * fh * escala) / 2;
    const ey = (s * fw * escala + c * fh * escala) / 2;
    const caixaCand: Caixa = { x0: cand.pos[0] - ex, y0: cand.pos[1] - ey, x1: cand.pos[0] + ex, y1: cand.pos[1] + ey };

    if (caixaCand.x0 < 0 || caixaCand.y0 < 0 || caixaCand.x1 > m.bounds.width || caixaCand.y1 > m.bounds.height) {
      ignorados++;
      continue;
    }
    if (paredesBloqueiamCaixa(m, caixaCand)) {
      ignorados++;
      continue;
    }
    if (portasBloq.some(b => caixasSobrepoem(caixaCand, b))) {
      ignorados++;
      continue;
    }
    if (bloqueios.some(b => caixasSobrepoem(caixaCand, b))) {
      ignorados++;
      continue;
    }
    if (salaDaArea) {
      const nos = [
        cand.pos,
        [caixaCand.x0, caixaCand.y0],
        [caixaCand.x1, caixaCand.y0],
        [caixaCand.x0, caixaCand.y1],
        [caixaCand.x1, caixaCand.y1],
      ] as Ponto[];
      if (nos.some(pt => comodoEm(m, pt, indice) !== salaDaArea)) {
        ignorados++;
        continue;
      }
    } else if (Object.keys(m.rooms).length > 0) {
      const nos = [
        cand.pos,
        [caixaCand.x0 + 0.05, caixaCand.y0 + 0.05],
        [caixaCand.x1 - 0.05, caixaCand.y0 + 0.05],
        [caixaCand.x0 + 0.05, caixaCand.y1 - 0.05],
        [caixaCand.x1 - 0.05, caixaCand.y1 - 0.05],
      ] as Ponto[];
      if (nos.some(pt => comodoEm(m, pt, indice) !== null)) {
        ignorados++;
        continue;
      }
    }

    const obj = novoObjeto([Math.round(cand.pos[0] * 100) / 100, Math.round(cand.pos[1] * 100) / 100], {
      id: gerarId('o'),
      source: fonte,
      rotation: rotacao,
      scale: escala,
    });
    bloqueios.push(caixaCand);
    ids.push(obj.id);
    comandos.push({ tipo: 'item.adicionar', colecao: 'props', item: obj as never });
  }

  return { comandos, ids, ignorados };
}
