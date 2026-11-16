import { BlurFilter, Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { DURACAO_DA_QUEDA, DURACAO_DA_VOLTA, LUZ_INTERIOR_PADRAO, curvaDoClarao, ehNoite, intervaloDoRelampago, luzesDerivadas, nivelDaLuz, piscarDaQueda, piscarDaVolta } from '../domain/clima.ts';
import type { Luz, MapaAtlas } from '../domain/mapa.ts';
import {
  IndiceDeSegmentos,
  oclusores,
  oclusoresDeObjetos,
  oclusoresDeTokens,
  poligonoIluminado,
  segmentosParaFonte,
  type OclusorDeObjeto,
  type OclusorDeToken,
} from '../domain/visibilidade.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { somPreferido, trovao } from '../fx/som.ts';
import { valueNoise2D } from '../procedural/ruido.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { criarFiltroDeFaixas } from './faixas.ts';
import { texturaDeBrilho } from './luzes.ts';

/** Pixels por metro do mapa de luz: baixo de propósito (a luz é suave e o desfoque esconde a resolução). */
export const RES_LUZ = 8;
/** Quanto da luz ambiente do céu chega ao interior de cômodos cobertos por telhado. */
export const FATOR_DO_INTERIOR = LUZ_INTERIOR_PADRAO;
const TEXTURA_MAX = 4096;

export interface MapaDeLuz {
  /** A luz já composta, para multiplicar sobre a cena (em metros). */
  readonly sprite: Sprite;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Tremulação das luzes; `agora` em milissegundos. */
  quadro(agora: number): void;
  definirLigado(ligado: boolean): void;
  /** Dispara um relâmpago agora (e o trovão, se o som estiver ligado). */
  relampagoAgora(): void;
  /** Eventos de cena: multiplicam a intensidade de todas as luzes (piscar) e a do ambiente (escurecer). 1 = sem efeito. */
  definirEfeitos(luzes: number, ambiente: number): void;
  /** Intensidade atual da luz (inclui flicker, queda de rede, relâmpago, etc.). */
  intensidade(id: string): number;
  /** Polígono de visão iluminado recortado pelas paredes (para a máscara de raios). */
  poligono(id: string): readonly number[] | null;
  /** Todas as luzes ativas (do mapa e derivadas). */
  todasAsLuzes(): readonly Luz[];
  destruir(): void;
}

interface LuzNaGPU { c: Container; s: Sprite; s2: Sprite; s3: Sprite; m: Graphics; luz: Luz; raio: number; chaveGeo: string; versaoGeo: number; semente: number; alfa: number; clarao: number; poligono: number[] }

const somarCor = (cor: number, v: number): number => { const c = (n: number) => Math.min(255, Math.round(n * 255 + v * 255)); return (c(((cor >> 16) & 255) / 255) << 16) | (c(((cor >> 8) & 255) / 255) << 8) | c((cor & 255) / 255); };
const rgb01 = (hex: string): [number, number, number] => { const n = hexParaNumero(hex); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

interface ObjetoComCaixa { oclusor: OclusorDeObjeto; x0: number; y0: number; x1: number; y1: number }

export interface ContextoDeOclusao {
  nivel: string | null;
  indiceParedes: IndiceDeSegmentos;
  objetos: ObjetoComCaixa[];
  tokens: OclusorDeToken[];
  tokensPorId: Map<string, OclusorDeToken>;
  versaoEstatica: number;
}

/** Determina o andar representado por `m` (quando já filtrado por `mapaDoAndar`, todos os itens compartilham o mesmo `levelId`). */
export function nivelAtivoDe(m: Pick<MapaAtlas, 'lights' | 'tokens' | 'props' | 'rooms' | 'walls'>): string | null {
  let primeiroNaoNulo: string | null = null;
  for (const c of [m.lights, m.tokens, m.props, m.rooms, m.walls]) {
    for (const item of Object.values(c)) {
      const nivel = item.levelId ?? null;
      if (nivel === null) return null;
      if (primeiroNaoNulo === null) primeiroNaoNulo = nivel;
    }
  }
  return primeiroNaoNulo;
}

function empacotarObjetos(lista: readonly OclusorDeObjeto[]): ObjetoComCaixa[] {
  return lista.map(oclusor => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of oclusor.poligono) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { oclusor, x0, y0, x1, y1 };
  });
}

function tokenMudou(a: OclusorDeToken, b: OclusorDeToken): boolean {
  return a.centro[0] !== b.centro[0] || a.centro[1] !== b.centro[1] || a.raio !== b.raio || a.lightId !== b.lightId;
}

/** Atualiza o índice estático (`walls` + `props`) separado dos `tokens` dinâmicos para recálculo seletivo por luz. */
export function sincronizarOclusao(
  atual: ContextoDeOclusao | null,
  m: MapaAtlas,
  mud: Mudancas | null,
): { ctx: ContextoDeOclusao; estaticoMudou: boolean; tokensMudados: OclusorDeToken[] } {
  const tudo = !mud || mud.completo;
  const col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c];
  const campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
  const estaticoMudou = !atual || col('walls') || col('openings') || col('rooms') || col('props') || campo('grid');
  const tokensMudaram = estaticoMudou || col('tokens');
  if (!estaticoMudou && !tokensMudaram) return { ctx: atual, estaticoMudou: false, tokensMudados: [] };

  const nivel = nivelAtivoDe(m);
  const indiceParedes = estaticoMudou ? new IndiceDeSegmentos(oclusores(m, 'luz')) : atual.indiceParedes;
  const objetos = estaticoMudou ? empacotarObjetos(oclusoresDeObjetos(m, { levelId: nivel })) : atual.objetos;
  const versaoEstatica = estaticoMudou ? (atual?.versaoEstatica ?? 0) + 1 : atual.versaoEstatica;

  const tokens = tokensMudaram ? oclusoresDeTokens(m, nivel) : atual!.tokens;
  const tokensPorId = tokensMudaram ? new Map(tokens.map(t => [t.id, t])) : atual!.tokensPorId;
  const tokensMudados: OclusorDeToken[] = [];
  if (!estaticoMudou && tokensMudaram && atual) {
    for (const ant of atual.tokens) {
      const novo = tokensPorId.get(ant.id);
      if (!novo) tokensMudados.push(ant);
      else if (tokenMudou(ant, novo)) tokensMudados.push(ant, novo);
    }
    for (const novo of tokens) {
      if (!atual.tokensPorId.has(novo.id)) tokensMudados.push(novo);
    }
  }

  return {
    ctx: { nivel, indiceParedes, objetos, tokens, tokensPorId, versaoEstatica },
    estaticoMudou,
    tokensMudados,
  };
}

/** Verifica se uma luz é alcançada por algum token alterado (ou é portada por ele). */
export function luzAfetadaPorTokens(l: Luz, mudados: readonly OclusorDeToken[]): boolean {
  const alcance = l.radius * 1.5;
  for (const t of mudados) {
    if (l.ownerId === t.id || t.lightId === l.id) return true;
    const r = alcance + t.raio;
    const dx = t.centro[0] - l.position[0], dy = t.centro[1] - l.position[1];
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** Calcula o polígono iluminado de `l` considerando paredes, objetos altos e tokens fora da margem do portador. */
export function poligonoDaLuz(l: Luz, ctx: ContextoDeOclusao): number[] {
  const paredesPerto = ctx.indiceParedes.perto(l.position, l.radius);
  const r = l.radius * 1.5, lx = l.position[0], ly = l.position[1];
  const objsPerto: OclusorDeObjeto[] = [];
  for (const o of ctx.objetos) {
    if (o.x1 < lx - r || o.x0 > lx + r || o.y1 < ly - r || o.y0 > ly + r) continue;
    objsPerto.push(o.oclusor);
  }
  const tokensPerto: OclusorDeToken[] = [];
  for (const t of ctx.tokens) {
    const rt = r + t.raio;
    const dx = t.centro[0] - lx, dy = t.centro[1] - ly;
    if (dx * dx + dy * dy <= rt * rt) tokensPerto.push(t);
  }
  const segs = segmentosParaFonte(l.position, paredesPerto, objsPerto, tokensPerto, { ownerId: l.ownerId, lightId: l.id });
  return poligonoIluminado(l.position, segs, l.radius, l.cone);
}

/**
 * Cada luz é um brilho redondo recortado pelo polígono que ela enxerga (as paredes fazem sombra), somado numa textura "bruta";
 * esta, desfocada, vai sobre a cor do ambiente numa textura final que multiplica a cena. Os polígonos só são refeitos quando a
 * luz ou as paredes mudam; a tremulação só mexe na opacidade.
 */
export function criarMapaDeLuz(renderer: Renderer): MapaDeLuz {
  const raiz = new Container(), interior = new Graphics(), composicao = new Container(), brutaS = new Sprite(), sprite = new Sprite();
  const blur = new BlurFilter({ strength: 2, quality: 3 }); blur.blendMode = 'add';
  brutaS.blendMode = 'add'; composicao.addChild(brutaS); composicao.filters = [blur];
  sprite.blendMode = 'multiply';
  // No Pixel a luz final passa por um filtro de faixas (degraus de borda dura) antes de multiplicar a cena.
  const passadaFaixas = new Container(), faixasS = new Sprite(); passadaFaixas.addChild(faixasS); passadaFaixas.filters = [criarFiltroDeFaixas()];
  const luzes = new Map<string, LuzNaGPU>(), ruido = valueNoise2D(7);
  let brutaRT: RenderTexture | null = null, finalRT: RenderTexture | null = null, faixasRT: RenderTexture | null = null, largura = 0, altura = 0, resAtual = 0, pixel = false, pxPorMetro = 0;
  let oclusao: ContextoDeOclusao | null = null, derivadas: Luz[] = [], ambiente: [number, number, number] = [1, 1, 1];
  let sujo = true, ligado = true, destruido = false, contador = 0, interiorPronto = false;
  // O estado do momento (clima): o mapa atual, se é noite, a queda de energia, o relâmpago e os trovões a caminho.
  let mapa: MapaAtlas | null = null, noite = false, redeAnterior: boolean | null = null, queda = 0, volta = 0;
  let efLuzes = 1, efAmbiente = 1, flash = 0, forcaDoRaio = 0, proximoRaio = Infinity, ultimoQuadro = -1, claraoAtual = 0;
  const trovoes: number[] = [];

  let todasLuzes: Luz[] = [];

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height, ehPixel = m.style.renderer === 'pixel', r0 = ehPixel ? m.style.pixel.pixelsPerCell / m.grid.size : RES_LUZ;
    if (brutaRT && w === largura && h === altura && r0 === resAtual) return;
    largura = w; altura = h; resAtual = r0; pixel = ehPixel;
    const res = Math.min(r0, TEXTURA_MAX / Math.max(w, h)), pw = Math.max(1, Math.round(w * res)), ph = Math.max(1, Math.round(h * res)); pxPorMetro = res;
    const antigas = [brutaRT, finalRT, faixasRT], modo = pixel ? 'nearest' : 'linear';
    brutaRT = RenderTexture.create({ width: pw, height: ph, scaleMode: modo }); finalRT = RenderTexture.create({ width: pw, height: ph, scaleMode: modo });
    faixasRT = pixel ? RenderTexture.create({ width: pw, height: ph, scaleMode: 'nearest' }) : null;
    // Pixel: sem desfoque, em resolução do Pixel, e as faixas depois da composição. Ilustrado: a luz suave de sempre.
    composicao.filters = pixel ? [] : [blur]; faixasS.texture = finalRT;
    brutaS.texture = brutaRT; sprite.texture = pixel ? faixasRT! : finalRT; sprite.scale.set(w / pw, h / ph); raiz.scale.set(pw / w, ph / h); interior.scale.set(pw / w, ph / h);
    for (const t of antigas) t?.destroy(true);
    sujo = true;
  }

  function aplicarAlfa(g: LuzNaGPU, k: number): void {
    g.alfa = k;
    g.c.visible = k > 0.01;
    g.s.alpha = Math.min(1, k);
    g.s.visible = k > 0.01;
    g.s2.alpha = Math.min(1, Math.max(0, k - 1));
    g.s2.visible = k > 1.001;
    g.s3.alpha = Math.min(1, Math.max(0, k - 2));
    g.s3.visible = k > 2.001;
  }

  function criar(l: Luz): LuzNaGPU {
    const c = new Container(), m = new Graphics();
    const novoS = () => {
      const s = new Sprite(texturaDeBrilho());
      s.anchor.set(0.5); s.blendMode = 'add'; s.mask = m; s.visible = false;
      c.addChild(s);
      return s;
    };
    const s = novoS(), s2 = novoS(), s3 = novoS();
    c.addChild(m); raiz.addChild(c);
    return { c, s, s2, s3, m, luz: l, raio: l.radius, chaveGeo: '', versaoGeo: -1, semente: ++contador * 13.7, alfa: -1, clarao: -1, poligono: [] };
  }

  function atualizar(g: LuzNaGPU, l: Luz): void {
    g.luz = l;
    const geo = JSON.stringify([l.position, l.radius, l.cone, l.ownerId]);
    if (oclusao && (geo !== g.chaveGeo || g.versaoGeo !== oclusao.versaoEstatica)) {
      g.chaveGeo = geo; g.versaoGeo = oclusao.versaoEstatica;
      const pts = poligonoDaLuz(l, oclusao);
      g.poligono = pts;
      g.m.clear(); if (pts.length >= 6) g.m.poly(pts).fill(0xffffff);
      for (const s of [g.s, g.s2, g.s3]) { s.position.set(l.position[0], l.position[1]); s.width = s.height = l.radius * 2; }
      g.raio = l.radius;
    }
    const cor = hexParaNumero(l.color);
    for (const s of [g.s, g.s2, g.s3]) s.tint = cor;
    if (g.alfa < 0 && mapa) {
      const daRede = l.power === 'grid';
      const nivel = nivelDaLuz(l, mapa, queda > 0 ? { redeLigada: true, noite } : { noite });
      const piscar = !daRede ? 1 : queda > 0 ? piscarDaQueda(queda) : volta > 0 ? piscarDaVolta(volta) : 1;
      aplicarAlfa(g, nivel * piscar * efLuzes * Math.min(3, Math.max(0, l.intensity)));
    }
  }

  /** Um relâmpago: o clarão entra pelas janelas e, um instante depois, o trovão (se o som estiver ligado). */
  function disparar(): void {
    if (!ligado) return;
    flash = 1; if (somPreferido()) trovoes.push(0.4 + Math.random() * 1.2);
  }

  function desenharInterior(m: MapaAtlas): void {
    const t = m.grid.size, [ox, oy] = m.grid.offset;
    interior.clear();
    let tem = false;
    for (const sala of Object.values(m.rooms)) {
      if (!sala.roof.material) continue;
      if (sala.outline && sala.outline.length >= 3) {
        interior.moveTo(sala.outline[0]![0], sala.outline[0]![1]);
        for (let i = 1; i < sala.outline.length; i++) interior.lineTo(sala.outline[i]![0], sala.outline[i]![1]);
        interior.closePath();
        tem = true;
      } else {
        for (const [y, x0, n] of sala.cells) {
          interior.rect(ox + x0 * t, oy + y * t, n * t, t);
          tem = true;
        }
      }
    }
    if (tem) interior.fill(0xffffff);
    interiorPronto = true;
  }

  function renderizar(): void {
    if (!brutaRT || !finalRT) return;
    renderer.render({ container: raiz, target: brutaRT, clear: true, clearColor: [0, 0, 0, 0] });
    const brilho = claraoAtual * 0.35, amb: [number, number, number, number] = [Math.min(1, ambiente[0] * efAmbiente + brilho), Math.min(1, ambiente[1] * efAmbiente + brilho), Math.min(1, ambiente[2] * efAmbiente + brilho), 1];
    const fatorInterior = mapa?.climate.interiorLight ?? FATOR_DO_INTERIOR;
    const intR = Math.min(1, ambiente[0] * efAmbiente * fatorInterior + brilho * 0.3);
    const intG = Math.min(1, ambiente[1] * efAmbiente * fatorInterior + brilho * 0.3);
    const intB = Math.min(1, ambiente[2] * efAmbiente * fatorInterior + brilho * 0.3);
    interior.tint = (Math.round(intR * 255) << 16) | (Math.round(intG * 255) << 8) | Math.round(intB * 255);
    renderer.render({ container: interior, target: finalRT, clear: true, clearColor: amb });
    renderer.render({ container: composicao, target: finalRT, clear: false });
    if (pixel && faixasRT) renderer.render({ container: passadaFaixas, target: faixasRT, clear: true, clearColor: [0, 0, 0, 1] });
    sujo = false;
  }

  return {
    sprite,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (campo('climate')) {
        noite = ehNoite(m);
        // A queda de energia pisca antes de apagar, e a volta pisca de leve; abrir ou importar um mapa não anima.
        const rede = m.climate.gridPower;
        if (redeAnterior !== null && rede !== redeAnterior && !tudo && !movimentoReduzido()) { queda = rede ? 0 : DURACAO_DA_QUEDA; volta = rede ? DURACAO_DA_VOLTA : 0; }
        redeAnterior = rede;
        const forca = m.climate.weather.lightning;
        if (forca !== forcaDoRaio) { forcaDoRaio = forca; proximoRaio = intervaloDoRelampago(forca, Math.random()); }
      }
      if (campo('bounds', 'style', 'grid')) dimensionar(m);
      if (!brutaRT) dimensionar(m);
      const { ctx, estaticoMudou, tokensMudados } = sincronizarOclusao(oclusao, m, mud);
      oclusao = ctx;
      if (tokensMudados.length > 0) {
        for (const g of luzes.values()) if (luzAfetadaPorTokens(g.luz, tokensMudados)) g.versaoGeo = -1;
      }
      if (col('rooms') || campo('grid') || !interiorPronto) desenharInterior(m);
      if (estaticoMudou || col('lights') || campo('climate')) derivadas = luzesDerivadas(m);
      if (campo('climate')) { const a = m.climate.ambient, [r, g, b] = rgb01(a.color); ambiente = [Math.min(1, r * a.intensity), Math.min(1, g * a.intensity), Math.min(1, b * a.intensity)]; }
      todasLuzes = [...Object.values(m.lights), ...derivadas];
      const vivos = new Set<string>();
      for (const l of todasLuzes) { vivos.add(l.id); let g = luzes.get(l.id); if (!g) { g = criar(l); luzes.set(l.id, g); } atualizar(g, l); }
      for (const [id, g] of luzes) if (!vivos.has(id)) { g.c.destroy({ children: true }); luzes.delete(id); }
      sujo = true;
    },
    quadro(agora) {
      if (destruido) return;
      const dt = ultimoQuadro < 0 ? 0 : Math.min(0.1, (agora - ultimoQuadro) / 1000); ultimoQuadro = agora;
      if (!ligado || !mapa) return;
      const t = agora / 1000, reduzido = movimentoReduzido();
      if (queda > 0) { queda = Math.max(0, queda - dt); sujo = true; }
      if (volta > 0) { volta = Math.max(0, volta - dt); sujo = true; }
      if (forcaDoRaio > 0 && (proximoRaio -= dt) <= 0) { disparar(); proximoRaio = intervaloDoRelampago(forcaDoRaio, Math.random()); }
      for (let i = trovoes.length - 1; i >= 0; i--) if ((trovoes[i]! -= dt) <= 0) { trovoes.splice(i, 1); trovao(); }
      const f = flash; flash = Math.max(0, flash - dt * 2.2);
      const clarao = curvaDoClarao(f, reduzido);
      if (clarao !== claraoAtual) { claraoAtual = clarao; sujo = true; }
      for (const g of luzes.values()) {
        const l = g.luz, daRede = l.power === 'grid';
        // Durante o piscar da queda a rede ainda "existe": a luz tremula e só depois apaga (quando o documento já diz que a rede caiu).
        const nivel = nivelDaLuz(l, mapa, queda > 0 ? { redeLigada: true, noite } : { noite });
        const piscar = !daRede ? 1 : queda > 0 ? piscarDaQueda(queda) : volta > 0 ? piscarDaVolta(volta) : 1;
        const janela = l.id.startsWith('janela:');          // só a luz do céu pelas janelas leva o clarão
        let k = nivel * piscar * efLuzes * Math.min(3, Math.max(0, l.intensity));
        if (k > 0 && l.flicker > 0) {
          const f = (ruido(t * 9 + g.semente, g.semente) + 0.5 * ruido(t * 23, g.semente + 9)) / 1.5;
          if (!pixel) k *= 1 - l.flicker * 0.7 * f;
          else {
            // No Pixel a chama treme no raio, em passos de 1 pixel (a intensidade contínua faria as faixas cintilarem).
            const raio = Math.round(l.radius * (1 - l.flicker * 0.3 * f) * pxPorMetro) / pxPorMetro;
            if (raio !== g.raio) { g.raio = raio; for (const s of [g.s, g.s2, g.s3]) s.width = s.height = raio * 2; sujo = true; }
          }
        } else if (pixel && g.raio !== l.radius) { g.raio = l.radius; for (const s of [g.s, g.s2, g.s3]) s.width = s.height = l.radius * 2; sujo = true; }
        if (janela) k = Math.min(3, k + clarao * 1.2);
        if (Math.abs(k - g.alfa) > 1e-3) { aplicarAlfa(g, k); sujo = true; }
        if (janela && clarao !== g.clarao) { g.clarao = clarao; const tint = clarao > 0 ? somarCor(hexParaNumero(l.color), clarao * 0.6) : hexParaNumero(l.color); for (const s of [g.s, g.s2, g.s3]) s.tint = tint; }
      }
      if (sujo) renderizar();
    },
    relampagoAgora: disparar,
    definirEfeitos(luzes, ambiente) { if (luzes === efLuzes && ambiente === efAmbiente) return; efLuzes = luzes; efAmbiente = ambiente; sujo = true; },
    definirLigado(v) { ligado = v; sprite.visible = v; if (v) sujo = true; },
    intensidade: (id: string) => { const g = luzes.get(id); return g ? Math.max(0, g.alfa) : 0; },
    poligono: (id: string) => { const g = luzes.get(id); return g?.poligono && g.poligono.length >= 6 ? g.poligono : null; },
    todasAsLuzes: () => todasLuzes,
    destruir() {
      destruido = true; for (const g of luzes.values()) g.c.destroy({ children: true }); luzes.clear();
      brutaRT?.destroy(true); finalRT?.destroy(true); faixasRT?.destroy(true); passadaFaixas.destroy({ children: false }); faixasS.destroy(); interior.destroy(); sprite.destroy(); composicao.destroy({ children: false }); raiz.destroy({ children: true });
    },
  };
}
