import { BlurFilter, Container, Graphics, RenderTexture, Sprite, Texture, UniformGroup, type Renderer } from 'pixi.js';
import { edificiosDe, jogadorDentroDoEdificio, type Edificio } from '../domain/edificios.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { RES_NEVOA, celulasExploradas, comodosConhecidos, edificioTocadoPorPoligonos, poligonosDeVisao, tokensDeVisaoAtivos, type FiltroDeVisao } from '../domain/nevoa.ts';
import { expandirContorno, retangulosDe, trechosDe } from '../domain/telhado-geometria.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { criarFiltroDeMundo } from './filtro-de-mundo.ts';
import { resDaMemoria } from './memoria.ts';
import { criarFiltroDeDitherDeAlfa } from './pixelizar.ts';

export { edificioTocadoPorPoligonos } from '../domain/nevoa.ts';

/** Cor escura neutra usada no lugar do não explorado (`fundoG` e `foraG`), nos modos `darkwood` e `shroud`, independente de `m.backdrop.color`. */
export const COR_NAO_EXPLORADO = 0x07090e;

/** Pelos olhos de quem se vê o mapa: Construir (tudo, sem telhado), o mestre na sessão (tudo, telhado esmaecido) ou os jogadores (névoa e telhado). */
export type Vista = 'construir' | 'mestre' | 'jogador';
const TEXTURA_MAX = 4096;
/** Margem em metros ao redor de `m.bounds` para que dar zoom out ou panear nunca revele vazio ou bordas duras fora do mapa. */
const MARGEM_EXTERNA = 2400;
const BEIRAL_TELHADO = 0.25;
/** O visível exibido caminha até o visível de verdade: sobe em ~0,5 s e desce em ~1,2 s (constantes de tempo, em segundos). */
const SOBE = 0.12, DESCE = 0.3, ASSENTAR = 1600;

/**
 * Modo efetivo de memória/névoa do mapa (`'darkwood'` ou `'shroud'`).
 * Mapas antigos com `mode === 'sketch'` ou `sketch === true` sem `mode` caem automaticamente em `'darkwood'`.
 */
export function modoDeMemoriaEfetivo(m: Pick<MapaAtlas, 'memory'>): 'darkwood' | 'shroud' {
  if (m.memory.mode === 'shroud') return 'shroud';
  if (m.memory.mode === 'darkwood' || m.memory.mode === 'sketch') return 'darkwood';
  return m.memory.sketch ? 'darkwood' : 'shroud';
}

/** Edifícios com telhado atualmente fechado na vista dos jogadores (considerando `session.roofs` e tokens de jogador dentro). */
export function edificiosFechadosNaNevoa(
  m: MapaAtlas,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): Edificio[] {
  const modoTelhados = m.session.roofs ?? 'auto';
  if (modoTelhados === 'abertos') return [];
  const todos = edificiosDe(m);
  if (modoTelhados === 'fechados') return todos;
  const jogadores = tokensDeVisaoAtivos(m, filtro, minhasFichas);
  return todos.filter(ed => !jogadorDentroDoEdificio(m, ed, jogadores));
}

function desenharEdificioNaMascara(g: Graphics, m: MapaAtlas, ed: Edificio): void {
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  for (const trecho of trechosDe(m, ed)) {
    if (trecho.outline && trecho.outline.length >= 3) {
      const ext = expandirContorno(trecho.outline, BEIRAL_TELHADO);
      if (ext.length >= 3) g.poly(ext.flat());
    } else {
      for (const [rx0, ry0, rx1, ry1] of retangulosDe(trecho.celulas)) {
        g.rect(ox + rx0 * t - BEIRAL_TELHADO, oy + ry0 * t - BEIRAL_TELHADO, (rx1 - rx0) * t + BEIRAL_TELHADO * 2, (ry1 - ry0) * t + BEIRAL_TELHADO * 2);
      }
    }
  }
}

const FRAGMENT_NAO_EXPLORADO = `in vec2 vTextureCoord;
in vec2 vMundoUv;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec2 uTamanho;
uniform highp float uTempo;
float hash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  mat2 giro = mat2(0.8, -0.6, 0.6, 0.8);
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ruido(p);
    p = giro * p * 2.03 + vec2(3.1, 7.4);
    a *= 0.5;
  }
  return v / 0.9375;
}
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a <= 0.001) {
    finalColor = vec4(0.0);
    return;
  }
  float naoExp = smoothstep(0.76, 0.98, c.a);
  if (naoExp <= 0.001) {
    finalColor = c;
    return;
  }
  vec2 mundo = vMundoUv * uTamanho;
  vec2 desl = vec2(uTempo * 0.045, -uTempo * 0.018);
  vec2 q = vec2(fbm(mundo * 0.065 + desl), fbm(mundo * 0.065 - desl * 0.7 + vec2(4.3, 1.9)));
  float banco = fbm(mundo * 0.095 + 1.15 * q + desl * 0.6);
  float fiapo = fbm(mundo * 0.24 - 0.8 * q + desl * 1.1);
  float nevoa = smoothstep(0.32, 0.82, banco * 0.72 + fiapo * 0.28);
  vec3 base = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  vec3 corNeblina = mix(base * 0.74, min(vec3(1.0), base * 1.18 + vec3(0.028, 0.038, 0.056)), nevoa);
  vec3 corFinal = mix(base, corNeblina, naoExp);
  finalColor = vec4(corFinal * c.a, c.a);
}`;

export interface Nevoa {
  /** A cobertura em metros: onde as peças de jogador não veem, a memória escurecida (explorado) e o breu atmosférico além das bordas (nunca visto). Invisível na vista do mestre. */
  readonly sprite: Container;
  /** A textura atual do visível suavizado (`rt(11)` ou `rt(1)` quando assentado), ou `Texture.EMPTY` se ainda não dimensionada. */
  readonly mascaraVisivel: Texture;
  /** Verdadeiro quando o mapa atual está em modo de visão Darkwood. */
  readonly modoDarkwood: boolean;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Mestre vê tudo; jogador vê só o que as suas peças enxergam. */
  definirVista(v: Vista): void;
  definirFiltroDeVisao?(filtro: FiltroDeVisao | null, minhasFichas?: readonly string[] | null): void;
  vista(): Vista;
  quadro(agora: number, posicoesVivas?: ReadonlyMap<string, { position: Ponto; direction?: number }>): void;
  destruir(): void;
}

/** Um contêiner com um desfoque, para suavizar a borda de uma máscara desenhada com polígonos ou retângulos. */
function borrada(forca: number, entrada: Sprite): Container {
  const c = new Container(); c.addChild(entrada); c.filters = [new BlurFilter({ strength: forca, quality: 3 })]; return c;
}

/**
 * Três máscaras: o **visível** (polígonos de visão das peças de jogador + telhados fechados à vista), o **explorado** (`session.explored` mais os cômodos/telhados conhecidos) e o resto.
 * A cobertura é o fundo do mapa (e a área externa ao redor de `m.bounds`, com véu atmosférico sutil); onde há explorado, a cena escurecida (Darkwood ou Breu); e o visível apagado por cima.
 * Todas as bordas são suaves, e nada disso é refeito na vista do mestre.
 */
export function criarNevoa(renderer: Renderer): Nevoa {
  const raiz = new Container(), foraG = new Graphics(), mapaSprite = new Sprite(), ditherDeAlfa = criarFiltroDeDitherDeAlfa();
  raiz.addChild(foraG, mapaSprite);
  const grupoNaoExplorado = new UniformGroup({
    uTamanho: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uTempo: { value: 0, type: 'f32' },
  });
  const filtroNaoExplorado = criarFiltroDeMundo(mapaSprite, {
    fragment: FRAGMENT_NAO_EXPLORADO,
    nome: 'atlas-nevoa-nao-explorado',
    recursos: { nevoa: grupoNaoExplorado },
  });
  // 1. visível
  const visRaiz = new Container(), visG = new Graphics(), visBruta = new Sprite(), visBorrada = borrada(2, visBruta); visRaiz.addChild(visG);
  // 2. explorado
  const expRaiz = new Container(), expG = new Graphics(), expBruta = new Sprite(), expBorrada = borrada(2, expBruta); expRaiz.addChild(expG);
  // 3. o contrário do explorado (branco onde nunca foi visto)
  const invC = new Container(), invFundo = new Graphics(), invExp = new Sprite(); invExp.blendMode = 'erase'; invC.addChild(invFundo, invExp);
  // 4. a memória só onde há explorado
  const memC = new Container(), memEscuro = new Graphics(), memInv = new Sprite(); memInv.blendMode = 'erase'; memC.addChild(memEscuro, memInv);
  // 5. a cobertura
  const fim = new Container(), fundoG = new Graphics(), fimExp = new Sprite(), fimMem = new Sprite(), fimVis = new Sprite(); fimExp.blendMode = 'erase'; fimVis.blendMode = 'erase'; fim.addChild(fundoG, fimExp, fimMem, fimVis);
  // 6. o visível suavizado no tempo: uma média que sobe depressa (U) e outra que desce devagar (D); a exibida é a união das duas (tela)
  const lerpC = new Container(), lerpA = new Sprite(), lerpB = new Sprite(); lerpB.blendMode = 'add'; lerpC.addChild(lerpA, lerpB);
  const uniaoC = new Container(), uniaoU = new Sprite(), uniaoD = new Sprite(); uniaoD.blendMode = 'screen'; uniaoC.addChild(uniaoU, uniaoD);
  raiz.visible = false;
  const rts: (RenderTexture | null)[] = [], rt = (i: number) => rts[i]!;
  let largura = 0, altura = 0, resAtual = 0, pixel = false, pw = 0, ph = 0, mapa: MapaAtlas | null = null, vista: Vista = 'mestre', sujo = true, destruido = false;
  let filtroVisao: FiltroDeVisao | null = null, minhasFichas: readonly string[] | null = null;
  let mudouEm = 0, animando = false, assentar = true, ultimo = -1, u = 7, d = 9, vivasAtivas = false, tempo = 0;

  function atualizarFora(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height;
    foraG.clear()
      .rect(-MARGEM_EXTERNA, -MARGEM_EXTERNA, w + MARGEM_EXTERNA * 2, h + MARGEM_EXTERNA * 2)
      .fill(COR_NAO_EXPLORADO)
      .rect(0, 0, w, h)
      .cut();
  }

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height, r0 = resDaMemoria(m), querPixel = m.style.renderer === 'pixel';
    if (rts.length && w === largura && h === altura && r0 === resAtual && querPixel === pixel) return;
    largura = w; altura = h; resAtual = r0; pixel = querPixel;
    const res = Math.min(r0, TEXTURA_MAX / Math.max(w, h)); pw = Math.max(1, Math.round(w * res)); ph = Math.max(1, Math.round(h * res));
    const antigas = rts.splice(0);
    for (let i = 0; i < 12; i++) rts.push(RenderTexture.create({ width: pw, height: ph, scaleMode: pixel ? 'nearest' : 'linear' }));
    // 0 vis bruta · 1 visível · 2 exp bruta · 3 explorado · 4 inverso · 5 memória · 6 cobertura · 7-8 média que sobe · 9-10 média que desce · 11 visível exibido
    visBruta.texture = rt(0); fimVis.texture = rt(1); expBruta.texture = rt(2); invExp.texture = rt(3); fimExp.texture = rt(3); memInv.texture = rt(4); fimMem.texture = rt(5); mapaSprite.texture = rt(6); u = 7; d = 9;
    // No Pixel as bordas das máscaras só se espalham um pouco, e o filtro de dithering do alfa as transforma em blocos de tudo ou nada.
    (visBorrada.filters![0] as BlurFilter).strength = 2; (expBorrada.filters![0] as BlurFilter).strength = 2;
    mapaSprite.filters = pixel ? [ditherDeAlfa.filtro] : [];
    raiz.filters = pixel ? [] : [filtroNaoExplorado];
    (grupoNaoExplorado.uniforms as { uTamanho: Float32Array }).uTamanho = new Float32Array([w, h]);
    mapaSprite.scale.set(w / pw, h / ph); visRaiz.scale.set(pw / w, ph / h); expRaiz.scale.set(pw / w, ph / h);
    atualizarFora(m);
    for (const t of antigas) t?.destroy(true);
    sujo = true;
  }

  const desenhar = (container: Container, alvo: RenderTexture) => renderer.render({ container, target: alvo, clear: true, clearColor: [0, 0, 0, 0] });

  function desenharVisivelComTelhados(m: MapaAtlas, poligonos: readonly number[][], fechados: readonly Edificio[]): void {
    visG.clear();
    for (const pts of poligonos) visG.poly(pts).fill(0xffffff);
    if (poligonos.length && fechados.length) {
      let desenhou = false;
      for (const ed of fechados) {
        if (!edificioTocadoPorPoligonos(m, ed, poligonos)) continue;
        desenharEdificioNaMascara(visG, m, ed);
        desenhou = true;
      }
      if (desenhou) visG.fill(0xffffff);
    }
    desenhar(visRaiz, rt(0));
    desenhar(visBorrada, rt(1));
  }

  /** As máscaras que só mudam quando o mundo muda: visível (alvo), explorado, e a memória onde há explorado. */
  function renderizarMascaras(): void {
    const m = mapa; if (!m || !rts.length) return;
    const poligonos = poligonosDeVisao(m, filtroVisao, minhasFichas);
    const fechados = edificiosFechadosNaNevoa(m, filtroVisao, minhasFichas);
    desenharVisivelComTelhados(m, poligonos, fechados);
    const res = m.session.explored?.res ?? RES_NEVOA;
    const modo = modoDeMemoriaEfetivo(m);
    const darkwood = modo === 'darkwood';
    const faixasExp = celulasExploradas(m);
    expG.clear();
    for (const [y, x0, n] of faixasExp) expG.rect(x0 * res, y * res, n * res + 0.02, res + 0.02);
    if (fechados.length) {
      const conhecidos = comodosConhecidos(m, filtroVisao, minhasFichas);
      for (const ed of fechados) {
        if (ed.salas.some(id => conhecidos.has(id))) desenharEdificioNaMascara(expG, m, ed);
      }
    }
    expG.fill(0xffffff);
    desenhar(expRaiz, rt(2)); desenhar(expBorrada, rt(3));
    invFundo.clear().rect(0, 0, pw, ph).fill(0xffffff); desenhar(invC, rt(4));
    // Memória: o véu de penumbra Darkwood, ou o Breu (cena escurecida por véu preto).
    if (darkwood) memEscuro.clear().rect(0, 0, pw, ph).fill({ color: 0x080b12, alpha: pixel ? 0.72 : 0.42 });
    else memEscuro.clear().rect(0, 0, pw, ph).fill({ color: 0x000000, alpha: 0.65 });
    desenhar(memC, rt(5)); fimExp.visible = true;
    fundoG.clear().rect(0, 0, pw, ph).fill(COR_NAO_EXPLORADO);
    atualizarFora(m);
  }

  function renderizarVisivelVivo(posicoesVivas?: ReadonlyMap<string, { position: Ponto; direction?: number }>): void {
    const m = mapa; if (!m || !rts.length) return;
    let alvo = m;
    if (posicoesVivas && posicoesVivas.size > 0) {
      const tokens = { ...m.tokens };
      let lights = m.lights;
      let mudou = false;
      for (const [id, vivo] of posicoesVivas) {
        const t = tokens[id];
        if (!t) continue;
        tokens[id] = {
          ...t,
          position: vivo.position,
          ...(vivo.direction !== undefined ? { vision: { ...t.vision, direction: vivo.direction } } : {}),
        };
        if (vivo.direction !== undefined && t.lightId && lights[t.lightId]?.cone) {
          if (lights === m.lights) lights = { ...m.lights };
          const luz = lights[t.lightId]!;
          lights[t.lightId] = { ...luz, position: vivo.position, cone: { ...luz.cone!, direction: vivo.direction } };
        }
        mudou = true;
      }
      if (mudou) alvo = { ...m, tokens, lights };
    }
    const poligonos = poligonosDeVisao(alvo, filtroVisao, minhasFichas);
    desenharVisivelComTelhados(alvo, poligonos, edificiosFechadosNaNevoa(alvo, filtroVisao, minhasFichas));
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
    sprite: raiz,
    get mascaraVisivel() { return rts.length ? fimVis.texture : Texture.EMPTY; },
    get modoDarkwood() { return mapa !== null && modoDeMemoriaEfetivo(mapa) === 'darkwood'; },
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (campo('bounds', 'style', 'grid') || !rts.length) dimensionar(m);
      if (tudo || col('tokens') || col('walls') || col('openings') || col('rooms') || col('props') || col('lights') || campo('backdrop', 'session', 'memory', 'grid')) sujo = true;
      if (tudo) assentar = true;
    },
    definirVista(v) { if (v === vista) return; vista = v; raiz.visible = v === 'jogador'; sujo = true; assentar = true; },
    definirFiltroDeVisao(f, fichas) {
      filtroVisao = f ?? null;
      minhasFichas = fichas ?? null;
      sujo = true;
      assentar = true;
    },
    vista: () => vista,
    quadro(agora, posicoesVivas) {
      if (destruido || vista !== 'jogador') { ultimo = -1; return; }
      const dt = ultimo < 0 ? 0 : Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
      if (!movimentoReduzido() && dt > 0) {
        tempo += dt * 0.6;
        (grupoNaoExplorado.uniforms as Record<string, unknown>).uTempo = tempo;
      }
      if (sujo) { renderizarMascaras(); sujo = false; mudouEm = agora; animando = true; }
      if (posicoesVivas && posicoesVivas.size > 0) {
        renderizarVisivelVivo(posicoesVivas);
        vivasAtivas = true;
        mudouEm = agora;
        animando = true;
      } else if (vivasAtivas) {
        renderizarVisivelVivo();
        vivasAtivas = false;
        mudouEm = agora;
        animando = true;
      }
      if (!animando) return;
      // Abrir o mapa, trocar de vista ou o movimento reduzido: o visível entra de uma vez. Senão caminha até ele e, passado um tempo, assenta.
      const imediato = assentar || movimentoReduzido() || (!vivasAtivas && agora - mudouEm > ASSENTAR);
      renderizarCobertura(dt, imediato);
      if (imediato) { animando = false; assentar = false; }
    },
    destruir() {
      destruido = true;
      filtroNaoExplorado.destroy();
      ditherDeAlfa.filtro.destroy();
      for (const c of [visBorrada, expBorrada]) {
        for (const f of c.filters ?? []) f.destroy();
        c.filters = null;
      }
      lerpC.destroy({ children: true }); uniaoC.destroy({ children: true });
      for (const t of rts) t?.destroy(true);
      raiz.destroy({ children: true });
      for (const c of [visRaiz, visBorrada, expRaiz, expBorrada, invC, memC, fim]) c.destroy({ children: true });
    },
  };
}
