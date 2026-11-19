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
