import { Container, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';

/** Lado máximo da textura de uma camada (px). */
const LADO_MAXIMO = 4096;

/** Uma camada desenhada em metros e entregue à cena como um sprite pronto. */
export interface CamadaEmTextura {
  /** O que entra na cena: o sprite da textura, já em metros. */
  readonly sprite: Sprite;
  /** Desenha `conteudo` (em metros, com os filtros que tiver) numa textura que cobre `largura × altura` m a `res` px/m. */
  renderizar(conteudo: Container, largura: number, altura: number, res: number, o?: { pixel?: boolean }): void;
  destruir(): void;
}

/**
 * Camada em textura própria, renderizada como raiz em coordenadas de mundo. Serve às camadas com filtros (desfoque,
 * matriz de cor) que ficam dentro de `mundoIluminado`: esse contêiner é renderizado fora da tela com a câmera passada
 * por `transform`, e os filtros do Pixi calculam os limites sem ela; o desenho filtrado caía fora do quadro e sumia.
 * Aqui o filtro roda uma vez, em metros, e a cena só desenha a textura.
 */
export function criarCamadaEmTextura(renderer: Renderer): CamadaEmTextura {
  const sprite = new Sprite(), escala = new Container();
  let rt: RenderTexture | null = null, pw = 0, ph = 0, nearest: boolean | null = null;

  return {
    sprite,
    renderizar(conteudo, largura, altura, res, o = {}) {
      const r = Math.min(res, LADO_MAXIMO / Math.max(largura, altura, 1e-6));
      const w = Math.max(1, Math.round(largura * r)), h = Math.max(1, Math.round(altura * r)), perto = !!o.pixel;
      if (!rt || w !== pw || h !== ph || perto !== nearest) {
        rt?.destroy(true);
        rt = RenderTexture.create({ width: w, height: h, scaleMode: perto ? 'nearest' : 'linear' });
        pw = w; ph = h; nearest = perto;
        sprite.texture = rt;
      }
      escala.scale.set(w / largura, h / altura);
      const pai = conteudo.parent, indice = pai ? pai.getChildIndex(conteudo) : -1;
      escala.addChild(conteudo);
      renderer.render({ container: escala, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
      escala.removeChild(conteudo);
      if (pai && indice >= 0) pai.addChildAt(conteudo, Math.min(indice, pai.children.length));
      sprite.scale.set(largura / w, altura / h);
    },
    destruir() { sprite.texture = Texture.EMPTY; rt?.destroy(true); rt = null; escala.destroy(); },
  };
}
