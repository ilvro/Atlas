import { codificar, type Faixa } from '../domain/celulas.ts';
import type { Edificio } from '../domain/edificios.ts';
import { pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import { arestasDeParede, comodoEm, comprimentoDaParede, indiceDeCelulas, normalParaDentro, pontoNaParede, salasDaAbertura, type ArestaUnitaria } from '../domain/geometria.ts';
import type { Comodo, MapaAtlas, Objeto, Parede, Ponto } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE, generoDe } from '../domain/presets.ts';
import { alturaNaCelula, celulasForaDePatamares, corDaNeblinaDoRelevo, degrausDoRelevo, topoDoRelevo } from '../domain/relevo.ts';
import { sombraDoSol } from '../domain/sol.ts';
import { telhadoEfetivo, trechosDe } from '../domain/telhado-geometria.ts';
import type { EntradaDeEscarpa } from '../procedural/escarpa.ts';
import { MATERIAIS, materialDe } from '../procedural/materiais.ts';
import { hashDasTexturas, usaTextura } from '../procedural/texturas-carregadas.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { MARGEM_ASSENTAMENTO, MARGEM_RELEVO, larguraDoDeclive, margensDoTerreno, type EntradaDeTerreno, type EntradaDoComodo } from '../procedural/assar.ts';
import type { EntradaDoTelhado, ParedeExternaDoTelhado, TrechoDoTelhado } from '../procedural/assar-telhado.ts';
import { orientacaoDominante } from '../procedural/orientacao.ts';
import { COLECAO, PPC_DO_PIXEL_ARQUIVO, RES_DA_COLECAO, fonteDoPixel, type ItemDaColecao } from '../procedural/colecao.ts';
import { estiloDe, type IdDoEstilo, type OpcoesDoPixel, type TipoDeAssado } from '../procedural/estilos/index.ts';
import type { PedidoDeBake } from '../procedural/executar.ts';
import { urlDoItem } from './url-da-colecao.ts';

/** O que o desenho precisa saber de cada coisa, em dados simples: a chave do cache é o próprio JSON. */
const r3 = (v: number) => Math.round(v * 1000) / 1000 || 0;

export interface ContextoDeEntradas { arestas: Map<string, ArestaUnitaria>; /** Degraus do relevo (< 1 m), calculados uma vez por sincronização. */ degraus?: ReturnType<typeof degrausDoRelevo> }
export const contextoDeEntradas = (m: Pick<MapaAtlas, 'rooms'>): ContextoDeEntradas => ({ arestas: arestasDeParede(m) });

export function entradaDoComodo(m: MapaAtlas, sala: Comodo, ctx: ContextoDeEntradas = contextoDeEntradas(m)): EntradaDoComodo {
  const aberturas: EntradaDoComodo['aberturas'] = [], objetos: EntradaDoComodo['objetos'] = [];
  for (const a of Object.values(m.openings)) {
    if (!salasDaAbertura(m, a, ctx.arestas).includes(sala.id)) continue;
    const p = m.walls[a.wallId]!, { ponto } = pontoNaParede(p, a.at * comprimentoDaParede(p));
    aberturas.push({ tipo: a.kind, centro: [r3(ponto[0]), r3(ponto[1])], largura: a.width, material: a.material });
  }
  for (const o of Object.values(m.props) as Objeto[]) {
    if (o.elevation !== 'wall' || !o.wall || o.roomId !== sala.id || o.source.kind !== 'recipe') continue;
    const p = m.walls[o.wall.wallId]; if (!p) continue;
    const { ponto } = pontoNaParede(p, o.wall.at * comprimentoDaParede(p));
    objetos.push({ receita: o.source.recipe, params: o.source.params, seed: o.source.seed, centro: [r3(ponto[0]), r3(ponto[1])] });
  }
  aberturas.sort((a, b) => a.centro[0] - b.centro[0] || a.centro[1] - b.centro[1]); objetos.sort((a, b) => a.centro[0] - b.centro[0] || a.centro[1] - b.centro[1]);
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
  if (sala.outline && sala.outline.length >= 3) {
    for (const [x, y] of sala.outline) { cx0 = Math.min(cx0, x); cy0 = Math.min(cy0, y); cx1 = Math.max(cx1, x); cy1 = Math.max(cy1, y); }
  } else {
    for (const [y, x0, n] of sala.cells) { cx0 = Math.min(cx0, ox + x0 * t); cx1 = Math.max(cx1, ox + (x0 + n) * t); cy0 = Math.min(cy0, oy + y * t); cy1 = Math.max(cy1, oy + (y + 1) * t); }
  }
  const nivel = sala.levelId ?? null;
  const paredes: NonNullable<EntradaDoComodo['paredes']> = Object.values(m.walls)
    .filter(p => {
      if ((p.levelId ?? null) !== nivel || p.kind !== 'wall') return false;
      let wx0 = Infinity, wy0 = Infinity, wx1 = -Infinity, wy1 = -Infinity;
      for (const [x, y] of p.path) { wx0 = Math.min(wx0, x); wy0 = Math.min(wy0, y); wx1 = Math.max(wx1, x); wy1 = Math.max(wy1, y); }
      return wx1 >= cx0 - 0.25 && wx0 <= cx1 + 0.25 && wy1 >= cy0 - 0.25 && wy0 <= cy1 + 0.25;
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(p => ({ path: p.path.map(([x, y]) => [r3(x), r3(y)] as Ponto), height: p.height, material: p.material, kind: p.kind }));
  const alturas = paredes.map(p => p.height);
  const coberto = !(!sala.roof.material && sala.function !== null && FUNCOES_AO_AR_LIVRE.has(sala.function));
  // Degraus do relevo que cruzam o cômodo: o piso cobre o terreno, então o assado do cômodo os desenha como degrau construído.
  const degraus: NonNullable<EntradaDoComodo['degraus']> = [];
  if (m.terrain.relief && Object.keys(m.terrain.relief.patamares).length) {
    ctx.degraus ??= degrausDoRelevo(m);
    const dentro = (q: Ponto) => q[0] >= cx0 - 1 && q[0] <= cx1 + 1 && q[1] >= cy0 - 1 && q[1] <= cy1 + 1;
    for (const d of ctx.degraus) {
      const caminhos: Ponto[][] = [], drops: ('a' | 'b')[] = [];
      d.caminhos.forEach((c, i) => { if (c.some(dentro)) { caminhos.push(c.map(([x, y]) => [r3(x), r3(y)] as Ponto)); drops.push(d.drops[i] ?? 'b'); } });
      if (caminhos.length) degraus.push({ caminhos, drops, desnivel: r3(d.desnivel) });
    }
  }
  return {
    grade: { size: m.grid.size, offset: [m.grid.offset[0], m.grid.offset[1]] }, celulas: sala.cells,
    ...(sala.outline ? { outline: sala.outline.map(([x, y]) => [r3(x), r3(y)] as Ponto) } : {}),
    piso: sala.floor, papel: sala.wallpaper,
    ...(sala.wallFace ? { wallFace: sala.wallFace } : {}),
    coberto,
    paredes,
    estilo: sala.wallStyle ?? m.style.walls, altura: alturas.length ? Math.max(...alturas) : 2.6, aberturas, objetos,
    ...(degraus.length ? { degraus } : {}),
  };
}

const materialDoAssentamento = (base: string): string | null => {
  if (base === 'neve' || base === 'neve.funda') return 'neve.pisada';
  if (base === 'grama' || base.startsWith('grama#') || base.startsWith('grama:')) return 'terra';
  return null;
};

function assentamentoDoTerreno(m: MapaAtlas, base: string): EntradaDeTerreno['assentamento'] {
  if (m.style.settle === false) return undefined;
  const salasTerreo = Object.values(m.rooms).filter(s => (s.levelId ?? null) === null);
  const cobertos = salasTerreo.filter(s => !!s.roof.material);
  if (!cobertos.length) return undefined;

  const mat = materialDoAssentamento(base);
  const resT = m.terrain.resolution || 0.25;
  const colsT = Math.max(1, Math.ceil(m.bounds.width / resT));
  const linsT = Math.max(1, Math.ceil(m.bounds.height / resT));
  const gs = m.grid.size, [ox, oy] = m.grid.offset;

  const marcarSala = (s: Comodo, destino: Uint8Array) => {
    if (s.outline && s.outline.length >= 3) {
      let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
      for (const [px, py] of s.outline) {
        if (px < xMin) xMin = px; if (py < yMin) yMin = py;
        if (px > xMax) xMax = px; if (py > yMax) yMax = py;
      }
      const tx0 = Math.max(0, Math.floor(xMin / resT)), tx1 = Math.min(colsT - 1, Math.ceil(xMax / resT));
      const ty0 = Math.max(0, Math.floor(yMin / resT)), ty1 = Math.min(linsT - 1, Math.ceil(yMax / resT));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (pontoNoPoligono([(tx + 0.5) * resT, (ty + 0.5) * resT], s.outline)) destino[ty * colsT + tx] = 1;
      }
      return;
    }
    for (const [ry, rx0, rn] of s.cells) {
      const tx0 = Math.max(0, Math.floor((ox + rx0 * gs) / resT + 1e-6));
      const tx1 = Math.min(colsT - 1, Math.ceil((ox + (rx0 + rn) * gs) / resT - 1e-6) - 1);
      const ty0 = Math.max(0, Math.floor((oy + ry * gs) / resT + 1e-6));
      const ty1 = Math.min(linsT - 1, Math.ceil((oy + (ry + 1) * gs) / resT - 1e-6) - 1);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) destino[ty * colsT + tx] = 1;
    }
  };

  let celulas: Faixa[] = [];
  let salas: Faixa[] = [];
  if (mat) {
    const maskCobertos = new Uint8Array(colsT * linsT);
    const maskTodos = new Uint8Array(colsT * linsT);
    for (const s of cobertos) marcarSala(s, maskCobertos);
    for (const s of salasTerreo) marcarSala(s, maskTodos);

    const raio = Math.max(1, Math.round(0.75 / resT));
    const raioSq = (0.75 / resT) ** 2 + 0.25;
    const offsets: [number, number][] = [];
    for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) {
      if (dx * dx + dy * dy <= raioSq) offsets.push([dx, dy]);
    }
    const temRelevo = !!m.terrain.relief && Object.keys(m.terrain.relief.patamares).length > 0;
    const ptsSala: [number, number][] = [];
    const ptsAnel = new Map<number, [number, number]>();
    for (let ty = 0; ty < linsT; ty++) for (let tx = 0; tx < colsT; tx++) {
      const idx = ty * colsT + tx;
      if (!maskCobertos[idx]) continue;
      ptsSala.push([tx, ty]);
      const altOrigem = temRelevo ? alturaNaCelula(m, tx, ty) : 0;
      for (const [dx, dy] of offsets) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= colsT || ny >= linsT) continue;
        const nIdx = ny * colsT + nx;
        if (maskTodos[nIdx]) continue;
        if (temRelevo && alturaNaCelula(m, nx, ny) !== altOrigem) continue;
        if (!ptsAnel.has(nIdx)) ptsAnel.set(nIdx, [nx, ny]);
      }
    }
    celulas = codificar([...ptsAnel.values()]);
    salas = codificar(ptsSala);
  }

  const cobertoPorId = new Set(cobertos.map(s => s.id));
  const arestas = arestasDeParede(m);
  const idxGround = indiceDeCelulas(m, null);
  const soleiras: NonNullable<EntradaDeTerreno['assentamento']>['soleiras'] = [];
  for (const a of Object.values(m.openings)) {
    if (a.kind !== 'door' && a.kind !== 'arch') continue;
    const p = m.walls[a.wallId];
    if (!p || (p.levelId ?? null) !== null) continue;
    const vizinhos = salasDaAbertura(m, a, arestas);
    if (vizinhos.length !== 1) continue;
    const salaId = vizinhos[0]!;
    if (!cobertoPorId.has(salaId)) continue;
    const dist = a.at * comprimentoDaParede(p);
    const dentro = normalParaDentro(m, p, dist, salaId, idxGround);
    if (!dentro) continue;
    const { ponto } = pontoNaParede(p, dist);
    soleiras.push({ centro: [r3(ponto[0]), r3(ponto[1])], normal: [r3(-dentro[0]), r3(-dentro[1])], largura: r3(a.width) });
  }
  soleiras.sort((a, b) => a.centro[0] - b.centro[0] || a.centro[1] - b.centro[1]);
  if (!celulas.length && !soleiras.length) return undefined;
  return { celulas, ...(salas.length ? { salas } : {}), material: mat, soleiras };
}

export function entradaDoTerreno(m: MapaAtlas): EntradaDeTerreno {
  const rel = m.terrain.relief;
  let relevo: EntradaDeTerreno['relevo'];
  if (rel && Object.keys(rel.patamares).length) {
    const topo = topoDoRelevo(m);
    const faixas = Object.values(rel.patamares)
      .filter(p => p.altura < topo && p.cells.length > 0)
      .map(p => ({ altura: p.altura, celulas: p.cells }));
    if (0 < topo) {
      const zeros = celulasForaDePatamares(m);
      if (zeros.length) faixas.push({ altura: 0, celulas: zeros });
    }
    faixas.sort((a, b) => a.altura - b.altura);
    const degs = degrausDoRelevo(m);
    relevo = {
      faixas,
      topo,
      neblina: corDaNeblinaDoRelevo(m.climate),
      ...(degs.length ? { degraus: degs.map(d => ({ caminhos: d.caminhos, drops: d.drops, desnivel: d.desnivel })) } : {}),
    };
  }
  const base = m.terrain.base !== 'vazio' ? m.terrain.base : m.backdrop.kind === 'texture' && m.backdrop.material ? m.backdrop.material : 'vazio';
  const assentamento = assentamentoDoTerreno(m, base);
  return {
    largura: m.bounds.width, altura: m.bounds.height, resolucao: m.terrain.resolution, // Um fundo em textura aparece onde o terreno é 'vazio': o mesmo desenho do terreno, sem uma segunda via.
    base,
    camadas: Object.values(m.terrain.layers).sort((a, b) => a.order - b.order).map(c => ({ material: c.material, celulas: c.cells, ...(c.flow ? { flow: c.flow } : {}) })),
    ...(relevo ? { relevo } : {}),
    ...(assentamento ? { assentamento } : {}),
  };
}

export const LADO_DO_LADRILHO = 16;

export interface LadrilhoDeTerreno {
  i: number;
  j: number;
  caixa: { x: number; y: number; w: number; h: number };
  entrada: EntradaDeTerreno;
}

function recortarFaixas(faixas: readonly Faixa[], resolucao: number, x0M: number, y0M: number, x1M: number, y1M: number): Faixa[] {
  if (!faixas.length) return [];
  const cxMin = Math.floor(x0M / resolucao);
  const cxMax = Math.ceil(x1M / resolucao) - 1;
  const cyMin = Math.floor(y0M / resolucao);
  const cyMax = Math.ceil(y1M / resolucao) - 1;
  if (cxMax < cxMin || cyMax < cyMin) return [];
  const saida: Faixa[] = [];
  for (const [y, x0, n] of faixas) {
    if (y < cyMin || y > cyMax || n <= 0) continue;
    const a = Math.max(x0, cxMin);
    const b = Math.min(x0 + n, cxMax + 1);
    if (b > a) saida.push([y, a, b - a]);
  }
  return saida;
}

function caminhoTocaCaixa(path: readonly Ponto[], x0: number, y0: number, x1: number, y1: number): boolean {
  if (path.length < 2) return false;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!, b = path[i + 1]!;
    const sx0 = Math.min(a[0], b[0]), sx1 = Math.max(a[0], b[0]);
    const sy0 = Math.min(a[1], b[1]), sy1 = Math.max(a[1], b[1]);
    if (sx1 >= x0 && sx0 <= x1 && sy1 >= y0 && sy0 <= y1) return true;
  }
  return false;
}

/**
 * Divide `[0, e.largura] × [0, e.altura]` em ladrilhos de até `16 × 16` m, recortando cada entrada à caixa + margem
 * para que cada ladrilho possa ser assado e cacheado de forma independente sem costuras.
 */
export function ladrilhosDoTerreno(e: EntradaDeTerreno, res: number): LadrilhoDeTerreno[] {
  const margens = margensDoTerreno(res);
  let aguaCount = 0;
  const metaCamadas = e.camadas.map(c => {
    const mat = materialDe(c.material);
    const agua = mat.uso === 'agua';
    const macico = mat.uso === 'macico';
    const margem = macico ? margens.macico : agua ? margens.agua : margens.base;
    const indiceAgua = agua && c.celulas.length > 0 ? aguaCount++ : undefined;
    const dir = mat.padrao === 'sulcos' && c.celulas.length > 0 ? r3(c.dir ?? orientacaoDominante(c.celulas)) : undefined;
    return { c, margem, indiceAgua, dir };
  });

  const cols = Math.max(1, Math.ceil(e.largura / LADO_DO_LADRILHO));
  const lins = Math.max(1, Math.ceil(e.altura / LADO_DO_LADRILHO));
  const saida: LadrilhoDeTerreno[] = [];

  for (let j = 0; j < lins; j++) {
    const y = j * LADO_DO_LADRILHO;
    const h = Math.min(LADO_DO_LADRILHO, e.altura - y);
    if (h <= 0) continue;
    for (let i = 0; i < cols; i++) {
      const x = i * LADO_DO_LADRILHO;
      const w = Math.min(LADO_DO_LADRILHO, e.largura - x);
      if (w <= 0) continue;
      const caixa = { x, y, w, h };

      const camadas: EntradaDeTerreno['camadas'] = metaCamadas.map(({ c, margem, indiceAgua, dir }) => {
        const celulas = recortarFaixas(c.celulas, e.resolucao, x - margem, y - margem, x + w + margem, y + h + margem);
        if (!celulas.length) return { material: c.material, celulas: [] };
        return {
          material: c.material,
          celulas,
          ...(c.flow ? { flow: c.flow } : {}),
          ...(dir !== undefined ? { dir } : {}),
          ...(indiceAgua !== undefined ? { indiceAgua } : {}),
        };
      });
      // Camadas vazias no fim não afetam o índice das anteriores; removê-las evita invalidar ladrilhos distantes ao criar uma camada nova num canto.
      while (camadas.length > 0 && camadas[camadas.length - 1]!.celulas.length === 0) camadas.pop();

      let relevo: EntradaDeTerreno['relevo'];
      if (e.relevo) {
        const faixas = e.relevo.faixas
          .map(f => ({
            altura: f.altura,
            celulas: recortarFaixas(f.celulas, e.resolucao, x - MARGEM_RELEVO, y - MARGEM_RELEVO, x + w + MARGEM_RELEVO, y + h + MARGEM_RELEVO),
          }))
          .filter(f => f.celulas.length > 0);
        const degraus: NonNullable<NonNullable<EntradaDeTerreno['relevo']>['degraus']> = [];
        for (const d of e.relevo.degraus ?? []) {
          const md = larguraDoDeclive(d.desnivel ?? 0.5) + 0.2;
          const caminhos: Ponto[][] = [], drops: ('a' | 'b')[] = [];
          d.caminhos.forEach((c, idx) => {
            if (caminhoTocaCaixa(c, x - md, y - md, x + w + md, y + h + md)) {
              caminhos.push(c);
              drops.push(d.drops[idx] ?? 'b');
            }
          });
          if (caminhos.length) degraus.push({ caminhos, drops, ...(d.desnivel !== undefined ? { desnivel: d.desnivel } : {}) });
        }
        relevo = {
          faixas,
          topo: e.relevo.topo,
          neblina: e.relevo.neblina,
          ...(degraus.length ? { degraus } : {}),
        };
      }

      let assentamento: EntradaDeTerreno['assentamento'];
      if (e.assentamento) {
        const celulas = recortarFaixas(
          e.assentamento.celulas,
          e.resolucao,
          x - MARGEM_ASSENTAMENTO,
          y - MARGEM_ASSENTAMENTO,
          x + w + MARGEM_ASSENTAMENTO,
          y + h + MARGEM_ASSENTAMENTO,
        );
        const salas = e.assentamento.salas
          ? recortarFaixas(
              e.assentamento.salas,
              e.resolucao,
              x - MARGEM_ASSENTAMENTO,
              y - MARGEM_ASSENTAMENTO,
              x + w + MARGEM_ASSENTAMENTO,
              y + h + MARGEM_ASSENTAMENTO,
            )
          : undefined;
        const soleiras = e.assentamento.soleiras.filter(
          s =>
            s.centro[0] >= x - MARGEM_ASSENTAMENTO &&
            s.centro[0] <= x + w + MARGEM_ASSENTAMENTO &&
            s.centro[1] >= y - MARGEM_ASSENTAMENTO &&
            s.centro[1] <= y + h + MARGEM_ASSENTAMENTO,
        );
        if (celulas.length > 0 || soleiras.length > 0) {
          assentamento = {
            celulas,
            ...(salas?.length ? { salas } : {}),
            material: e.assentamento.material,
            soleiras,
          };
        }
      }

      saida.push({
        i,
        j,
        caixa,
        entrada: {
          largura: e.largura,
          altura: e.altura,
          resolucao: e.resolucao,
          base: e.base,
          recorte: caixa,
          camadas,
          ...(relevo ? { relevo } : {}),
          ...(assentamento ? { assentamento } : {}),
        },
      });
    }
  }
  return saida;
}

/** Chave do cache de um objeto de piso: a mesma receita, semente e parâmetros reaproveitam o mesmo desenho. */
/** px por metro de um tipo de desenho no estilo do mapa. */
export const resolucaoDe = (m: Pick<MapaAtlas, 'style' | 'grid'>, tipo: TipoDeAssado): number =>
  estiloDe(m.style.renderer).resolucao(tipo, { ppc: m.style.pixel.pixelsPerCell, celula: m.grid.size });

/** As opções do Pixel de um mapa (pixels por célula e contorno); `undefined` no Ilustrado, que não as usa. */
export const opcoesDoPixel = (m: Pick<MapaAtlas, 'style'>): OpcoesDoPixel | undefined => (m.style.renderer === 'pixel' ? { ppc: m.style.pixel.pixelsPerCell, contorno: m.style.pixel.outline, paleta: m.style.palette, dither: m.style.pixel.dither } : undefined);
const sufixoDoPixel = (px?: OpcoesDoPixel): string => (px ? `|c${px.contorno ? 1 : 0}` : '');
/** A imagem derivada também depende da paleta e do dithering. */
const sufixoDaImagemNoPixel = (px?: OpcoesDoPixel): string => (px ? `${sufixoDoPixel(px)}|${px.paleta}|${px.dither}` : '');

/** A chave do cache de um item da coleção. No Pixel ela diz de onde vem o desenho: o arquivo manual (com a escala), o gerador ou a imagem derivada. */
export function chaveDoItem(assetId: string, item: ItemDaColecao, harmonizado: boolean, res: number, genero: string, estilo: IdDoEstilo, pixel?: OpcoesDoPixel): string {
  const base = `${estilo}|a|${res}|${assetId}|${harmonizado ? `h:${generoDe(genero).id}` : '-'}`;
  if (estilo !== 'pixel') return base;
  const fonte = pixel ? fonteDoPixel(item, pixel.ppc) : { tipo: 'derivada' as const };
  if (fonte.tipo === 'manual') return `${base}|manual:${fonte.arquivo}:${fonte.escala}`;
  return base + (item.origem.tipo === 'gerado' ? sufixoDoPixel(pixel) : sufixoDaImagemNoPixel(pixel));
}

/** Toda chave começa pelo estilo de raster: o mesmo objeto nos dois estilos são dois desenhos, e o do outro estilo fica em cache até a troca terminar. */
export function chaveDoObjeto(o: Objeto, res: number, genero = 'investigacao', estilo: IdDoEstilo = 'illustrated', pixel?: OpcoesDoPixel): string | null {
  if (o.elevation === 'wall') return null;
  if (o.source.kind === 'asset') { const item = itemDaColecao(o.source.assetId); return item ? chaveDoItem(o.source.assetId, item, harmoniza(o, item), res, genero, estilo, pixel) : null; }     // asset desconhecido: o marcador fica, sem erro
  return `${estilo}|o|${res}|${o.source.recipe}|${o.source.seed}|${JSON.stringify(o.source.params)}${sufixoDoPixel(pixel)}${o.flip ? '|f' : ''}`;
}

/** Item gerado desenhado no estilo Pixel: vai pela descrição, não pela imagem. */
const geradoNoPixel = (item: ItemDaColecao, estilo: IdDoEstilo): boolean => estilo === 'pixel' && item.origem.tipo === 'gerado';
const porId = new Map(COLECAO.map(i => [i.id, i]));
/** Só as imagens achadas passam pela harmonização (as geradas já nascem no traço da casa, com contorno e sombra), e o mestre pode desligar por objeto (`harmonize`). */
const harmoniza = (o: Objeto, item: ItemDaColecao): boolean => o.harmonize && item.origem.tipo === 'achado';
export const itemDaColecao = (assetId: string) => porId.get(assetId);

/**
 * O pedido de pintura de um item da coleção. No Pixel: o arquivo manual, se há e cabe; senão o item gerado é assado da descrição; senão a imagem é derivada.
 * No Ilustrado, a imagem já assada (harmonizada se for achada).
 */
export function pedidoDoItem(item: ItemDaColecao, pegada: [number, number], harmonizado: boolean, res: number, genero: string, estilo: IdDoEstilo, pixel?: OpcoesDoPixel): PedidoDeBake {
  const fonte = estilo === 'pixel' && pixel ? fonteDoPixel(item, pixel.ppc) : null;
  if (fonte?.tipo === 'manual') return { tipo: 'imagem', url: urlDoItem({ arquivo: fonte.arquivo }), pegada, res, resImagem: PPC_DO_PIXEL_ARQUIVO / 1.5, harmonizar: false, alvo: null, estilo, pixel, pixelManual: { escala: fonte.escala } };
  if (geradoNoPixel(item, estilo) && item.origem.tipo === 'gerado') return { tipo: 'gerado', gerador: item.origem.gerador, params: item.origem.params, seed: item.origem.seed, res, estilo, pixel };
  return { tipo: 'imagem', url: urlDoItem(item), pegada, res, resImagem: item.res ?? RES_DA_COLECAO, harmonizar: harmonizado, alvo: harmonizado ? generoDe(genero).alvoDeCor : null, estilo, pixel };
}

/** O pedido de pintura de um objeto de piso, de receita ou da coleção; `null` se não há o que pintar (asset desconhecido). */
export function pedidoDoObjeto(o: Objeto, res: number, genero = 'investigacao', estilo: IdDoEstilo = 'illustrated', pixel?: OpcoesDoPixel): PedidoDeBake | null {
  if (o.source.kind === 'recipe') return { tipo: 'objeto', receita: o.source.recipe, params: o.source.params, seed: o.source.seed, res, estilo, pixel, ...(o.flip ? { espelhar: true } : {}) };
  const item = itemDaColecao(o.source.assetId); if (!item) return null;
  return pedidoDoItem(item, ACERVO.pegadaDaFonte(o.source), harmoniza(o, item), res, genero, estilo, pixel);
}
export const chaveDoComodo = (e: EntradaDoComodo, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|c|${res}|${JSON.stringify(e)}`;
/** Com textura (só no Ilustrado) a chave leva o hash do catálogo: trocar um WebP invalida o cache. Sem textura a chave não muda. */
export const chaveDoTerreno = (e: EntradaDeTerreno, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|t|${res}|${JSON.stringify(e)}${estilo === 'illustrated' && usaTextura(e) ? `|tx${hashDasTexturas()}` : ''}`;

export type { EntradaDoTelhado };

/**
 * Dados de entrada do assado de um edifício de telhado: trechos resolvidos, grade, paredes externas relevantes
 * (para futura fachada N7), neve do clima quando algum trecho usa `snow: 'auto'`, direção do sol discretizada
 * (somente quando há detalhes, evitando invalidar o cache quando só a hora muda sem detalhes) e gênero.
 */
export function entradaDoTelhado(
  m: MapaAtlas,
  ed: Edificio,
  ctx: ContextoDeEntradas = contextoDeEntradas(m),
): EntradaDoTelhado {
  const trechosBrutos = trechosDe(m, ed);
  let temDetalhes = false;
  let usaNeveAuto = false;

  const trechos: TrechoDoTelhado[] = trechosBrutos.map(t => {
    const ef = telhadoEfetivo(t.roof);
    const primeiraSala = m.rooms[t.salas[0]!];
    const seed = ef.seed ?? primeiraSala?.floor.seed ?? 1;
    if (ef.details.length > 0) temDetalhes = true;
    if (ef.wear.snow === 'auto') usaNeveAuto = true;
    return {
      celulas: t.celulas.map(([x, y]): [number, number] => [x, y]),
      ...(t.outline ? { outline: t.outline.map(([x, y]): Ponto => [r3(x), r3(y)]) } : {}),
      roof: {
        material: t.roof.material,
        visible: t.roof.visible,
        shape: ef.shape,
        ridge: ef.ridge,
        steep: ef.steep,
        ...(ef.details.length ? { details: [...ef.details] } : {}),
        wear: { ...ef.wear },
        seed,
      },
      seed,
    };
  });

  // Paredes externas do edifício (para a fachada no N7), apenas quando fachadas estão habilitadas.
  let paredes: ParedeExternaDoTelhado[] | undefined;
  if (m.style.facades !== false && ed.salas.length > 0) {
    const nivel = m.rooms[ed.salas[0]!]?.levelId ?? null;
    const salasEd = new Set(ed.salas);
    const gs = m.grid.size;
    const [ox, oy] = m.grid.offset;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const id of ed.salas) {
      const s = m.rooms[id];
      if (!s) continue;
      if (s.outline && s.outline.length >= 3) {
        for (const [x, y] of s.outline) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      } else {
        for (const [ry, rx0, rn] of s.cells) {
          bx0 = Math.min(bx0, ox + rx0 * gs);
          bx1 = Math.max(bx1, ox + (rx0 + rn) * gs);
          by0 = Math.min(by0, oy + ry * gs);
          by1 = Math.max(by1, oy + (ry + 1) * gs);
        }
      }
    }
    if (Number.isFinite(bx0)) {
      const idxNivel = indiceDeCelulas(m, nivel);
      const salasComOutline = ed.salas
        .map(id => m.rooms[id])
        .filter((s): s is Comodo => Boolean(s && s.outline && s.outline.length >= 3));

      const salaEmPonto = (pt: Ponto): Comodo | null => {
        const idCel = comodoEm(m, pt, idxNivel);
        if (idCel && salasEd.has(idCel)) return m.rooms[idCel] ?? null;
        for (const s of salasComOutline) {
          if (pontoNoPoligono(pt, s.outline!)) return s;
        }
        return null;
      };

      const salaAdjacente = (p: Parede): Comodo | null => {
        if (p.source && 'roomId' in p.source && salasEd.has(p.source.roomId)) {
          return m.rooms[p.source.roomId] ?? null;
        }
        for (let i = 0; i + 1 < p.path.length; i++) {
          const a = p.path[i]!, b = p.path[i + 1]!;
          const dx = b[0] - a[0], dy = b[1] - a[1], c = Math.hypot(dx, dy);
          if (c < 1e-4) continue;
          const mx = (a[0] + b[0]) * 0.5, my = (a[1] + b[1]) * 0.5;
          const nx = -dy / c, ny = dx / c;
          const s1 = salaEmPonto([mx + nx * 0.25, my + ny * 0.25]);
          if (s1) return s1;
          const s2 = salaEmPonto([mx - nx * 0.25, my - ny * 0.25]);
          if (s2) return s2;
        }
        return m.rooms[ed.salas[0]!] ?? null;
      };

      const ehRustico = (s: Comodo | null): boolean => {
        const telha = s?.roof.material ?? '';
        const piso = s?.floor.material ?? '';
        return (
          telha.includes('palha') ||
          telha.includes('tabuinhas') ||
          telha.includes('tabuas') ||
          telha.includes('bambu') ||
          telha.includes('couro') ||
          piso.includes('madeira') ||
          piso.includes('tabuas')
        );
      };

      const resolverWallFace = (p: Parede, sala: Comodo | null): string => {
        if (sala?.wallFace && sala.wallFace !== 'parede.topo' && MATERIAIS[sala.wallFace]) {
          return sala.wallFace;
        }
        if (p.material && p.material !== 'parede.topo' && MATERIAIS[p.material]) {
          return p.material;
        }
        if (ehRustico(sala) && MATERIAIS['parede.tabuas']) return 'parede.tabuas';
        return MATERIAIS['parede.reboco'] ? 'parede.reboco' : 'papel.liso-claro';
      };

      const aberturasPorParede = new Map<string, ParedeExternaDoTelhado['aberturas']>();
      for (const a of Object.values(m.openings)) {
        const p = m.walls[a.wallId];
        if (!p || (p.levelId ?? null) !== nivel) continue;
        const salas = salasDaAbertura(m, a, ctx.arestas);
        const externaPorCelula = salas.length === 1 && salasEd.has(salas[0]!);
        const externaPorOutline =
          salas.length === 0 &&
          salasComOutline.length > 0 &&
          p.source &&
          'roomId' in p.source &&
          salasEd.has(p.source.roomId);
        if (!externaPorCelula && !externaPorOutline) continue;
        const { ponto } = pontoNaParede(p, a.at * comprimentoDaParede(p));
        const lista = aberturasPorParede.get(p.id) ?? [];
        lista.push({
          tipo: a.kind,
          centro: [r3(ponto[0]), r3(ponto[1])],
          largura: r3(a.width),
          ...(a.material ? { material: a.material } : {}),
        });
        aberturasPorParede.set(p.id, lista);
      }
      const listaParedes = Object.values(m.walls)
        .filter(p => {
          if ((p.levelId ?? null) !== nivel || p.kind !== 'wall') return false;
          let wx0 = Infinity, wy0 = Infinity, wx1 = -Infinity, wy1 = -Infinity;
          for (const [x, y] of p.path) {
            if (x < wx0) wx0 = x; if (y < wy0) wy0 = y;
            if (x > wx1) wx1 = x; if (y > wy1) wy1 = y;
          }
          return wx1 >= bx0 - 0.25 && wx0 <= bx1 + 0.25 && wy1 >= by0 - 0.25 && wy0 <= by1 + 0.25;
        })
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p): ParedeExternaDoTelhado => {
          const ab = (aberturasPorParede.get(p.id) ?? []).sort(
            (a, b) => a.centro[0] - b.centro[0] || a.centro[1] - b.centro[1],
          );
          const sala = salaAdjacente(p);
          const wallFace = resolverWallFace(p, sala);
          return {
            path: p.path.map(([x, y]): Ponto => [r3(x), r3(y)]),
            height: r3(p.height),
            material: p.material,
            wallFace,
            aberturas: ab,
          };
        });
      if (listaParedes.length) paredes = listaParedes;
    }
  }

  let sol: EntradaDoTelhado['sol'];
  if (temDetalhes) {
    const s = sombraDoSol(m.climate, m.style.renderer === 'pixel');
    if (s) {
      // Discretiza em passos de 15° para não invalidar o cache por pequenas mudanças de horário.
      const passo = Math.PI / 12;
      const ang = Math.round(Math.atan2(s.dir[1], s.dir[0]) / passo) * passo;
      sol = {
        dir: [r3(Math.cos(ang)), r3(Math.sin(ang))],
        porMetro: Math.round(Math.min(1.2, Math.max(0.25, s.porMetro * 0.55)) * 10) / 10,
        forca: Math.round(Math.min(0.65, Math.max(0.2, s.alfa)) * 10) / 10,
      };
    }
  }

  return {
    grade: { size: m.grid.size, offset: [m.grid.offset[0], m.grid.offset[1]] },
    trechos,
    ...(paredes ? { paredes } : {}),
    neve: usaNeveAuto ? r3(m.climate.weather.snow) : 0,
    ...(sol ? { sol } : {}),
    genero: m.style.genre,
  };
}

export const chaveDoTelhado = (e: EntradaDoTelhado, res: number, estilo: IdDoEstilo = 'illustrated'): string =>
  `${estilo}|r|${res}|${JSON.stringify(e)}`;

/** Semente estável de uma escarpa, a partir do id da parede. */
const sementeDoId = (id: string): number => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return (h >>> 0) % 100000 + 1; };
/** A escarpa avulsa (parede `cliff` sem origem) como dado de desenho; o caminho é relativo ao primeiro ponto. Sem lado definido (documentos antigos) o lado baixo é o `b`; um material que não é de rocha vira `rocha.cinza`. */
export function entradaDaEscarpa(p: Parede): EntradaDeEscarpa {
  const [ox, oy] = p.path[0]!;
  return { path: p.path.map(q => [r3(q[0] - ox), r3(q[1] - oy)] as [number, number]), drop: p.drop ?? 'b', altura: p.height, material: materialDe(p.material).uso === 'macico' ? p.material : 'rocha.cinza', seed: sementeDoId(p.id) };
}
export const chaveDaEscarpa = (e: EntradaDeEscarpa, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|e|${res}|${JSON.stringify(e)}`;
/** Parede `cliff` desenhada como face de rocha (avulsa ou derivada de degrau de relevo; as do contorno do maciço ficam no assar do terreno). */
export const ehEscarpaAvulsa = (p: Parede): boolean => p.kind === 'cliff' && (!p.source || 'reliefStep' in p.source);
