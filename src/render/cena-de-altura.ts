import { Container, Graphics, Matrix, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { alturaNoMapa } from '../procedural/altura.ts';
import { atualizarTransformDoMundo } from './passadas.ts';

/** Altura padrão (m) usada para paredes no mapa de altura. */
export const ALTURA_DE_PAREDE = 3;

export interface EntradaDeAltura {
  c: Container;
  sprite: Sprite | null;
  texAltura: Texture | null;
}

export interface CenaDeAltura {
  /** Contêiner paralelo à cena de cor: contém chão (terreno + cômodos) e objetos com suas texturas de altura. */
  readonly alturaC: Container;
  /** Textura de altura na resolução da tela (`alturaRT`), ou `Texture.EMPTY` antes do primeiro quadro. */
  readonly textura: Texture;
  /** Tamanho em metros de 1 texel de `alturaRT` no zoom atual (0 antes do primeiro quadro). */
  readonly metrosPorTexel: number;
  /** Verdadeiro se a última chamada a `atualizar` redesenhou `alturaRT` (para testes/diagnóstico). */
  readonly redesenhouNoUltimoQuadro: boolean;
  definirTerreno(tex: Texture | null, origem?: readonly [number, number], res?: number): void;
  sincronizarComodo(id: string, tex: Texture | null, origem?: readonly [number, number], res?: number): void;
  removerComodo(id: string): void;
  sincronizarObjetos(objetos: ReadonlyMap<string, EntradaDeAltura>, paiEsperado: Container): void;
  /** Redesenha as paredes na `alturaC` com o valor de altura correspondente a `alturaNoMapa(ALTURA_DE_PAREDE)`. */
  atualizarParedes(desenhar: (g: Graphics, cor: number) => void): void;
  /** Renderiza `alturaC` em `alturaRT` somente quando câmera, tamanho de tela ou conteúdo mudarem. */
  atualizar(renderer: Renderer, mundoIluminado: Container, ativo: boolean): void;
  destruir(): void;
}

/**
 * Cena de altura paralela (Ilustrado): espelha terreno, cômodos e objetos usando `texAltura`.
 * Objetos combinam entre si com `blendMode = 'max'` (para que sobreposições fiquem com a parte mais alta)
 * e cobrem o chão em `alturaRT` com a altura absoluta do assado (`alturaNoMapa`), renderizada sob demanda quando câmera ou conteúdo mudam.
 */
export function criarCenaDeAltura(): CenaDeAltura {
  const alturaC = new Container();
  const chaoAlturaC = new Container();
  const terrenoAlturaC = new Container();
  const comodosAlturaC = new Container();
  const objetosAlturaC = new Container();
  objetosAlturaC.sortableChildren = true;
  const paredesAlturaG = new Graphics();

  chaoAlturaC.addChild(terrenoAlturaC, comodosAlturaC);
  alturaC.addChild(chaoAlturaC, objetosAlturaC, paredesAlturaG);

  const terrenoS = new Sprite(Texture.EMPTY);
  terrenoS.visible = false;
  terrenoAlturaC.addChild(terrenoS);

  const comodos = new Map<string, Sprite>();
  const objetos = new Map<string, { c: Container; s: Sprite }>();
  const objetosAddC = new Container();
  const objetosAlturaS = new Sprite(Texture.EMPTY);
  // O objeto cobre o piso (não soma ao relevo dele): a altura dos objetos já vem absoluta do assado (`alturaNoMapa`), então
  // basta desenhá-la por cima; senão os veios e juntas do piso apareciam em tapetes, sofás e mesas.
  objetosAddC.addChild(objetosAlturaS);

  let alturaRT: RenderTexture | null = null;
  let objetosRT: RenderTexture | null = null;
  let largura = 0;
  let altura = 0;
  let resolucao = 0;
  let sujo = true;
  let redesenhou = false;
  let destruida = false;

  const camAtual = new Matrix();
  let ultimaCam = [NaN, NaN, NaN, NaN, NaN, NaN];

  function dimensionar(renderer: Renderer): void {
    const w = Math.max(1, Math.round(renderer.screen.width));
    const h = Math.max(1, Math.round(renderer.screen.height));
    const r = renderer.resolution || 1;
    if (alturaRT && w === largura && h === altura && r === resolucao) return;

    alturaRT?.destroy(true);
    objetosRT?.destroy(true);
    alturaRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
    objetosRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
    objetosAlturaS.texture = objetosRT;
    largura = w;
    altura = h;
    resolucao = r;
    sujo = true;
  }

  function cameraMudou(m: Matrix): boolean {
    return (
      Number.isNaN(ultimaCam[0]) ||
      Math.abs(m.a - ultimaCam[0]!) > 1e-6 ||
      Math.abs(m.b - ultimaCam[1]!) > 1e-6 ||
      Math.abs(m.c - ultimaCam[2]!) > 1e-6 ||
      Math.abs(m.d - ultimaCam[3]!) > 1e-6 ||
      Math.abs(m.tx - ultimaCam[4]!) > 1e-4 ||
      Math.abs(m.ty - ultimaCam[5]!) > 1e-4
    );
  }

  return {
    alturaC,
    get textura() {
      return alturaRT ?? Texture.EMPTY;
    },
    get metrosPorTexel() {
      if (!alturaRT || resolucao <= 0) return 0;
      const pxPorMetro = Math.hypot(camAtual.a, camAtual.b);
      return pxPorMetro > 0 ? 1 / (pxPorMetro * resolucao) : 0;
    },
    get redesenhouNoUltimoQuadro() {
      return redesenhou;
    },
    definirTerreno(tex, origem, res) {
      if (destruida) return;
      const valida = tex && !tex.destroyed ? tex : null;
      if (!valida || !origem || !res) {
        if (terrenoS.visible || terrenoS.texture !== Texture.EMPTY) {
          terrenoS.visible = false;
          terrenoS.texture = Texture.EMPTY;
          sujo = true;
        }
        return;
      }
      const esc = 1 / res;
      if (!terrenoS.visible || terrenoS.texture !== valida || terrenoS.x !== origem[0] || terrenoS.y !== origem[1] || terrenoS.scale.x !== esc) {
        terrenoS.texture = valida;
        terrenoS.position.set(origem[0], origem[1]);
        terrenoS.scale.set(esc);
        terrenoS.visible = true;
        sujo = true;
      }
    },
    sincronizarComodo(id, tex, origem, res) {
      if (destruida) return;
      let sp = comodos.get(id);
      if (!sp) {
        sp = new Sprite(Texture.EMPTY);
        sp.visible = false;
        comodos.set(id, sp);
        comodosAlturaC.addChild(sp);
      }
      const valida = tex && !tex.destroyed ? tex : null;
      if (!valida || !origem || !res) {
        if (sp.visible || sp.texture !== Texture.EMPTY) {
          sp.visible = false;
          sp.texture = Texture.EMPTY;
          sujo = true;
        }
        return;
      }
      const esc = 1 / res;
      if (!sp.visible || sp.texture !== valida || sp.x !== origem[0] || sp.y !== origem[1] || sp.scale.x !== esc) {
        sp.texture = valida;
        sp.position.set(origem[0], origem[1]);
        sp.scale.set(esc);
        sp.visible = true;
        sujo = true;
      }
    },
    removerComodo(id) {
      if (destruida) return;
      const sp = comodos.get(id);
      if (!sp) return;
      sp.destroy();
      comodos.delete(id);
      sujo = true;
    },
    sincronizarObjetos(origem, paiEsperado) {
      if (destruida) return;
      for (const [id, m] of objetos) {
        if (!origem.has(id)) {
          m.c.destroy({ children: true });
          objetos.delete(id);
          sujo = true;
        }
      }
      for (const [id, e] of origem) {
        let m = objetos.get(id);
        if (!m) {
          const c = new Container();
          const s = new Sprite(Texture.EMPTY);
          s.blendMode = 'max';
          c.addChild(s);
          objetosAlturaC.addChild(c);
          m = { c, s };
          objetos.set(id, m);
          sujo = true;
        }
        const tex = e.texAltura && !e.texAltura.destroyed ? e.texAltura : null;
        const vis = Boolean(e.c.visible && e.c.parent === paiEsperado && e.sprite && tex);
        if (m.c.visible !== vis) {
          m.c.visible = vis;
          sujo = true;
        }
        if (!vis) {
          if (m.s.texture !== Texture.EMPTY) {
            m.s.texture = Texture.EMPTY;
            sujo = true;
          }
          continue;
        }
        const sp = e.sprite!;
        if (
          m.c.x !== e.c.x ||
          m.c.y !== e.c.y ||
          m.c.rotation !== e.c.rotation ||
          m.c.scale.x !== e.c.scale.x ||
          m.c.scale.y !== e.c.scale.y ||
          m.c.zIndex !== e.c.zIndex ||
          m.c.alpha !== e.c.alpha ||
          m.s.texture !== tex ||
          m.s.x !== sp.x ||
          m.s.y !== sp.y ||
          m.s.scale.x !== sp.scale.x ||
          m.s.scale.y !== sp.scale.y
        ) {
          m.c.position.copyFrom(e.c.position);
          m.c.rotation = e.c.rotation;
          m.c.scale.copyFrom(e.c.scale);
          m.c.zIndex = e.c.zIndex;
          m.c.alpha = e.c.alpha;
          m.s.texture = tex!;
          m.s.position.copyFrom(sp.position);
          m.s.scale.copyFrom(sp.scale);
          sujo = true;
        }
      }
    },
    atualizarParedes(desenhar) {
      if (destruida) return;
      paredesAlturaG.clear();
      const c = Math.round(alturaNoMapa(ALTURA_DE_PAREDE) * 255);
      desenhar(paredesAlturaG, c << 16);
      sujo = true;
    },
    atualizar(renderer, mundoIluminado, ativo) {
      redesenhou = false;
      if (destruida || !ativo) return;
      dimensionar(renderer);
      atualizarTransformDoMundo(mundoIluminado, camAtual);
      if (cameraMudou(camAtual)) sujo = true;
      if (!sujo || !alturaRT || !objetosRT) return;

      renderer.render({ container: chaoAlturaC, target: alturaRT, transform: camAtual, clear: true, clearColor: [0, 0, 0, 0] });
      renderer.render({ container: objetosAlturaC, target: objetosRT, transform: camAtual, clear: true, clearColor: [0, 0, 0, 0] });
      renderer.render({ container: objetosAddC, target: alturaRT, clear: false });
      renderer.render({ container: paredesAlturaG, target: alturaRT, transform: camAtual, clear: false });

      ultimaCam = [camAtual.a, camAtual.b, camAtual.c, camAtual.d, camAtual.tx, camAtual.ty];
      sujo = false;
      redesenhou = true;
    },
    destruir() {
      destruida = true;
      comodos.clear();
      objetos.clear();
      alturaRT?.destroy(true);
      objetosRT?.destroy(true);
      alturaRT = null;
      objetosRT = null;
      objetosAddC.destroy({ children: true });
      alturaC.destroy({ children: true });
    },
  };
}
