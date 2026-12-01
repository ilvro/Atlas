import { Geometry, Matrix, type Container } from 'pixi.js';

/** Vertex shader padrão para quads renderizados direto em `RenderTexture` com `Mesh`. */
export const VERTEX_QUAD = `in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

/** Vertex shader padrão para `Filter` do PixiJS (`vTextureCoord` normalizado pelo frame). */
export const VERTEX_FILTRO = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`;

/** Dithering ordenado Bayer 4×4 sem arrays constantes (compatível com GLSL ES 1.00). */
export const GLSL_BAYER = `float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }`;

/** Blur gaussiano separável (9 amostras, pesos somando 1.0) feito direto em `RenderTexture` para preservar HDR. */
export const FRAGMENT_BLUR_GAUSSIANO = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uPasso;
uniform vec4 uLimites;
vec4 amostra(float k) {
  return texture(uTexture, clamp(vUV + uPasso * k, uLimites.xy, uLimites.zw));
}
void main() {
  vec4 soma = amostra(0.0) * 0.202362;
  soma += (amostra(-1.0) + amostra(1.0)) * 0.179044;
  soma += (amostra(-2.0) + amostra(2.0)) * 0.124009;
  soma += (amostra(-3.0) + amostra(3.0)) * 0.067234;
  soma += (amostra(-4.0) + amostra(4.0)) * 0.028532;
  finalColor = soma;
}`;

/** Geometria de quad unitário `[0..1] × [0..1]` para passadas em tela cheia. */
export function criarQuadUnitario(): Geometry {
  return new Geometry({
    attributes: {
      aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
}

/** Calcula a matriz mundo de `alvo` percorrendo seus ancestrais e gravando o resultado em `destino`. */
export function atualizarTransformDoMundo(alvo: Container, destino: Matrix): Matrix {
  const cadeia: Container[] = [];
  for (let cur: Container | null = alvo; cur; cur = cur.parent) cadeia.push(cur);
  destino.identity();
  for (let i = cadeia.length - 1; i >= 0; i--) {
    const no = cadeia[i]!;
    no.updateLocalTransform();
    destino.append(no.localTransform);
  }
  return destino;
}
