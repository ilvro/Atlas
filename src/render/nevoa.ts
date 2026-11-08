import { BlurFilter, Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { subtrair, unir } from '../domain/celulas.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { RES_NEVOA, celulasDosComodos, celulasDosPoligonos, celulasExploradas, poligonosDeVisao } from '../domain/nevoa.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { criarMemoria, resDaMemoria } from './memoria.ts';
import { criarFiltroDeDitherDeAlfa } from './pixelizar.ts';

/** Pelos olhos de quem se vê o mapa: Construir (tudo, sem telhado), o mestre na sessão (tudo, telhado esmaecido) ou os jogadores (névoa e telhado). */
export type Vista = 'construir' | 'mestre' | 'jogador';
const TEXTURA_MAX = 4096;
/** O visível exibido caminha até o visível de verdade: sobe em ~0,5 s e desce em ~1,2 s (constantes de tempo, em segundos). */
const SOBE = 0.12, DESCE = 0.3, ASSENTAR = 1600;

export interface Nevoa {
  /** A cobertura em metros: onde as peças de jogador não veem, a memória em esboço (explorado) ou o fundo do mapa (nunca visto). Invisível na vista do mestre. */
  readonly sprite: Sprite;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Mestre vê tudo; jogador vê só o que as suas peças enxergam. */
  definirVista(v: Vista): void;
  vista(): Vista;
  quadro(agora: number): void;
  destruir(): void;
}

/** Um contêiner com um desfoque, para suavizar a borda de uma máscara desenhada com polígonos ou retângulos. */
function borrada(forca: number, entrada: Sprite): Container {
  const c = new Container(); c.addChild(entrada); c.filters = [new BlurFilter({ strength: forca, quality: 3 })]; return c;
}

/**
 * Três máscaras: o **visível** (polígonos de visão das peças de jogador), o **explorado** (`session.explored` mais os cômodos revelados) e o resto.
 * A cobertura é o fundo do mapa; onde há explorado, a memória (esboço, ou a cena escurecida com `memory.sketch: false`); e o visível apagado por cima.
 * Todas as bordas são suaves, e nada disso é refeito na vista do mestre.
 */
export function criarNevoa(renderer: Renderer): Nevoa {
  const sprite = new Sprite(), memoria = criarMemoria(renderer), ditherDeAlfa = criarFiltroDeDitherDeAlfa();
  // 1. visível
  const visRaiz = new Container(), visG = new Graphics(), visBruta = new Sprite(), visBorrada = borrada(2, visBruta); visRaiz.addChild(visG);
  // 2. explorado
  const expRaiz = new Container(), expG = new Graphics(), expBruta = new Sprite(), expBorrada = borrada(2, expBruta); expRaiz.addChild(expG);
  // 3. o contrário do explorado (branco onde nunca foi visto)
  const invC = new Container(), invFundo = new Graphics(), invExp = new Sprite(); invExp.blendMode = 'erase'; invC.addChild(invFundo, invExp);
  // 4. a memória só onde há explorado (e fora da borda imediata da visão atual, para o papel claro não vazar como halo nas paredes)
  const memC = new Container(), memEsboco = new Sprite(), memEscuro = new Graphics(), memInv = new Sprite(), memVis = new Sprite(); memInv.blendMode = 'erase'; memVis.blendMode = 'erase'; memC.addChild(memEsboco, memEscuro, memInv, memVis);
  // 5. a cobertura
  const fim = new Container(), fundoG = new Graphics(), fimExp = new Sprite(), fimMem = new Sprite(), fimVis = new Sprite(); fimExp.blendMode = 'erase'; fimVis.blendMode = 'erase'; fim.addChild(fundoG, fimExp, fimMem, fimVis);
  // 6. o visível suavizado no tempo: uma média que sobe depressa (U) e outra que desce devagar (D); a exibida é a união das duas (tela)
  const lerpC = new Container(), lerpA = new Sprite(), lerpB = new Sprite(); lerpB.blendMode = 'add'; lerpC.addChild(lerpA, lerpB);
  const uniaoC = new Container(), uniaoU = new Sprite(), uniaoD = new Sprite(); uniaoD.blendMode = 'screen'; uniaoC.addChild(uniaoU, uniaoD);
  sprite.visible = false;
  const rts: (RenderTexture | null)[] = [], rt = (i: number) => rts[i]!;
  let largura = 0, altura = 0, resAtual = 0, pixel = false, pw = 0, ph = 0, mapa: MapaAtlas | null = null, vista: Vista = 'mestre', sujo = true, destruido = false;
  let mudouEm = 0, animando = false, assentar = true, ultimo = -1, u = 7, d = 9;     // `u` e `d`: o índice da textura atual de cada média (a outra do par é o destino)

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height, r0 = resDaMemoria(m);
    if (rts.length && w === largura && h === altura && r0 === resAtual) return;
    largura = w; altura = h; resAtual = r0; pixel = m.style.renderer === 'pixel';
    const res = Math.min(r0, TEXTURA_MAX / Math.max(w, h)); pw = Math.max(1, Math.round(w * res)); ph = Math.max(1, Math.round(h * res));
    const antigas = rts.splice(0);
    for (let i = 0; i < 12; i++) rts.push(RenderTexture.create({ width: pw, height: ph, scaleMode: pixel ? 'nearest' : 'linear' }));
    // 0 vis bruta · 1 visível · 2 exp bruta · 3 explorado · 4 inverso · 5 memória · 6 cobertura · 7-8 média que sobe · 9-10 média que desce · 11 visível exibido
    visBruta.texture = rt(0); fimVis.texture = rt(1); expBruta.texture = rt(2); invExp.texture = rt(3); fimExp.texture = rt(3); memInv.texture = rt(4); memVis.texture = rt(2); fimMem.texture = rt(5); sprite.texture = rt(6); u = 7; d = 9;
    // No Pixel as bordas das máscaras só se espalham um pouco, e o filtro de dithering do alfa as transforma em blocos de tudo ou nada.
    (visBorrada.filters![0] as BlurFilter).strength = 2; (expBorrada.filters![0] as BlurFilter).strength = 2;
    sprite.filters = pixel ? [ditherDeAlfa.filtro] : [];
    memEsboco.scale.set(pw / Math.max(1, memoria.textura?.width ?? pw), ph / Math.max(1, memoria.textura?.height ?? ph));
    sprite.scale.set(w / pw, h / ph); visRaiz.scale.set(pw / w, ph / h); expRaiz.scale.set(pw / w, ph / h);
    for (const t of antigas) t?.destroy(true);
    sujo = true;
  }

  const desenhar = (container: Container, alvo: RenderTexture) => renderer.render({ container, target: alvo, clear: true, clearColor: [0, 0, 0, 0] });

  /** As máscaras que só mudam quando o mundo muda: visível (alvo), explorado, e a memória onde há explorado. */
  function renderizarMascaras(): void {
    const m = mapa; if (!m || !rts.length) return;
    const poligonos = poligonosDeVisao(m);
    visG.clear(); for (const pts of poligonos) visG.poly(pts).fill(0xffffff);
    desenhar(visRaiz, rt(0)); desenhar(visBorrada, rt(1));
    const res = m.session.explored?.res ?? RES_NEVOA;
    const esboco = m.memory.sketch && memoria.textura !== null;
    const faixasExp = esboco
      ? unir(subtrair(m.session.explored?.cells ?? [], celulasDosPoligonos(m, poligonos, res)), celulasDosComodos(m, m.session.revealed.filter(id => m.rooms[id]), res))
      : celulasExploradas(m);
    expG.clear(); for (const [y, x0, n] of faixasExp) expG.rect(x0 * res, y * res, n * res + 0.02, res + 0.02);
    expG.fill(0xffffff);
    desenhar(expRaiz, rt(2)); desenhar(expBorrada, rt(3));
    invFundo.clear().rect(0, 0, pw, ph).fill(0xffffff); desenhar(invC, rt(4));
    // Memória: o esboço, ou a cena escurecida (um véu preto) quando o mestre desliga o esboço.
    if (esboco) {
      visG.clear(); for (const pts of poligonos) visG.poly(pts).fill(0xffffff).stroke({ width: 0.35, color: 0xffffff, join: 'round', cap: 'round' });
      desenhar(visRaiz, rt(0)); desenhar(visBorrada, rt(2));
    }
    memEsboco.visible = esboco; memEscuro.visible = !esboco; memVis.visible = esboco;
    if (esboco) memEsboco.texture = memoria.textura!; else memEscuro.clear().rect(0, 0, pw, ph).fill({ color: 0x000000, alpha: 0.65 });
    desenhar(memC, rt(5)); fimExp.visible = !esboco;
    fundoG.clear().rect(0, 0, pw, ph).fill(hexParaNumero(m.backdrop.color));
  }

  /** `destino = origem + (visível − origem) · a`: um passo de média móvel, entre duas texturas do par. */
  function passo(origem: number, destino: number, a: number): void {
    lerpA.texture = rt(origem); lerpA.alpha = 1 - a; lerpB.texture = rt(1); lerpB.alpha = a; desenhar(lerpC, rt(destino));
  }

  /** Atualiza o visível exibido (suavizado ou, com `assentado`, igual ao visível) e refaz a cobertura. */
  function renderizarCobertura(dt: number, assentado: boolean): void {
    if (assentado) { passo(u, u === 7 ? 8 : 7, 1); u = u === 7 ? 8 : 7; passo(d, d === 9 ? 10 : 9, 1); d = d === 9 ? 10 : 9; }
    else {
      passo(u, u === 7 ? 8 : 7, 1 - Math.exp(-dt / SOBE)); u = u === 7 ? 8 : 7;
      passo(d, d === 9 ? 10 : 9, 1 - Math.exp(-dt / DESCE)); d = d === 9 ? 10 : 9;
    }
    uniaoU.texture = rt(u); uniaoD.texture = rt(d); desenhar(uniaoC, rt(11));
    fimVis.texture = assentado ? rt(1) : rt(11);
    desenhar(fim, rt(6));
  }

  return {
    sprite,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      memoria.sincronizar(m, mud);
      if (campo('bounds', 'style', 'grid') || !rts.length) dimensionar(m);
      if (tudo || col('tokens') || col('walls') || col('openings') || col('rooms') || campo('backdrop', 'session', 'memory', 'grid')) sujo = true;
      if (tudo) assentar = true;
    },
    definirVista(v) { if (v === vista) return; vista = v; sprite.visible = v === 'jogador'; sujo = true; assentar = true; },
    vista: () => vista,
    quadro(agora) {
      if (destruido || vista !== 'jogador') { ultimo = -1; return; }
      const dt = ultimo < 0 ? 0 : Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
      if (memoria.quadro(agora)) sujo = true;
      if (sujo) { renderizarMascaras(); sujo = false; mudouEm = agora; animando = true; }
      if (!animando) return;
      // Abrir o mapa, trocar de vista ou o movimento reduzido: o visível entra de uma vez. Senão caminha até ele e, passado um tempo, assenta.
      const imediato = assentar || movimentoReduzido() || agora - mudouEm > ASSENTAR;
      renderizarCobertura(dt, imediato);
      if (imediato) { animando = false; assentar = false; }
    },
    destruir() {
      destruido = true; memoria.destruir(); lerpC.destroy({ children: true }); uniaoC.destroy({ children: true }); for (const t of rts) t?.destroy(true); sprite.destroy();
      for (const c of [visRaiz, visBorrada, expRaiz, expBorrada, invC, memC, fim]) c.destroy({ children: true });
    },
  };
}
