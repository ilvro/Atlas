import { Filter, GlProgram, Matrix, UniformGroup } from 'pixi.js';
import type { FilterSystem, RenderSurface, Sprite, Texture } from 'pixi.js';

/**
 * Filtro de véu de mundo: o ruído da neblina e das bordas tem de estar preso ao terreno, não à tela. O Pixi recorta a área do filtro à parte
 * visível da tela, então o `uv` do quadro de saída não cobre o sprite inteiro (com zoom ou arrasto cobre só um trecho). Aqui o vértice
 * mapeia a posição de cada fragmento para o espaço normalizado do sprite (`vMundoUv`, de 0 a 1 sobre o mapa) com a matriz do próprio Pixi
 * (`calculateSpriteMatrix`), que já considera câmera, resolução do renderer e captura; o fragmento multiplica pelo tamanho do mapa em metros.
 */
export const VERTEX_DE_MUNDO = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vMundoUv;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uFiltroDeMundo;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  vMundoUv = (uFiltroDeMundo * vec3(vTextureCoord, 1.0)).xy;
}`;

/** Declarações do fragmento: `vMundoUv` é a posição do fragmento no sprite do véu, de 0 a 1 (multiplique por `uTamanho` para ter metros). */
export const FRAGMENTO_DE_MUNDO_DECL = 'in vec2 vMundoUv;';

class FiltroDeMundo extends Filter {
  private readonly _sprite: Sprite;
  constructor(sprite: Sprite, programa: GlProgram, recursos: Record<string, UniformGroup>) {
    const grupo = new UniformGroup({ uFiltroDeMundo: { value: new Matrix(), type: 'mat3x3<f32>' } });
    super({ glProgram: programa, resources: { ...recursos, filtroDeMundo: grupo } });
    this._sprite = sprite;
    this._grupo = grupo;
  }
  private readonly _grupo: UniformGroup;
  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    // Preenche a matriz in-place no valor do uniforme (o Pixi a lê direto de lá).
    filterManager.calculateSpriteMatrix((this._grupo.uniforms as { uFiltroDeMundo: Matrix }).uFiltroDeMundo, this._sprite);
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

/** Cria o filtro de mundo para `sprite` (o véu do tamanho do mapa), com o fragmento e os demais grupos de uniformes dados. */
export function criarFiltroDeMundo(sprite: Sprite, opcoes: { vertex?: string; fragment: string; nome: string; recursos: Record<string, UniformGroup> }): Filter {
  const programa = GlProgram.from({ vertex: opcoes.vertex ?? VERTEX_DE_MUNDO, fragment: opcoes.fragment, preferredFragmentPrecision: 'highp', name: opcoes.nome });
  return new FiltroDeMundo(sprite, programa, opcoes.recursos);
}
