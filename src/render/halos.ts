import { Container, Geometry, GlProgram, Graphics, Mesh, Shader, Sprite, UniformGroup } from 'pixi.js';
import { comodoEm, indiceDeCelulas } from '../domain/geometria.ts';
import type { Luz, MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { texturaDeBrilho, texturaDeBrilhoPixel } from './luzes.ts';
import type { MapaDeLuz } from './mapa-de-luz.ts';
import type { Telhados } from './telhados.ts';

export interface Halos {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Avança a animação dos raios e atualiza a opacidade do halo com o flicker da luz. */
  quadro(agora: number, dt: number): void;
  definirLigado(ligado: boolean): void;
  destruir(): void;
}

const vertexRaios = `in vec2 aPosition;
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

const fragmentRaios = `in vec2 vUV;
out vec4 finalColor;
uniform highp float uDirecao;
uniform highp float uAbertura;
uniform highp float uRaio;
uniform highp float uIntensidade;
uniform vec3 uCor;
uniform highp float uTempo;
uniform float uPixel;
uniform float uPpm;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido1D(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), f);
}

void main() {
  vec2 p = vUV;
  bool pixel = uPixel > 0.5;

  if (pixel) {
    float halfPx = uRaio * uPpm;
    if (halfPx > 0.0) p = (floor(p * halfPx) + 0.5) / halfPx;
  }

  float dist = length(p);
  if (dist > 1.0 || dist < 0.001) {
    finalColor = vec4(0.0);
    return;
  }

  float ang = atan(p.y, p.x);
  float diff = mod(ang - uDirecao + 3.14159265, 6.2831853) - 3.14159265;
  float meia = uAbertura * 0.5;

  if (abs(diff) > meia) {
    finalColor = vec4(0.0);
    return;
  }

  float borda = pixel ? 1.0 : smoothstep(meia, meia - min(0.08, meia * 0.25), abs(diff));

  float queda = clamp(1.0 - dist, 0.0, 1.0);
  if (pixel) {
    queda = floor(queda * 3.0 + 0.35) / 3.0;
  } else {
    queda = queda * queda;
  }

  float escalaAng = 14.0;
  float coord = diff * escalaAng + uTempo * 0.3;
  float n = ruido1D(coord) * 0.65 + ruido1D(coord * 2.3 + 5.1) * 0.35;
  float listras = pixel ? step(0.48, n) : smoothstep(0.25, 0.75, n);

  float alfa = queda * borda * listras * (0.25 * uIntensidade);
  finalColor = vec4(uCor * alfa, alfa);
}`;

const rgb01 = (hex: string): [number, number, number] => {
  const n = hexParaNumero(hex);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

interface HaloGPU {
  s: Sprite;
  luz: Luz;
}

interface RaiosGPU {
  c: Container;
  mesh: Mesh<Geometry, Shader>;
  m: Graphics;
  grupo: UniformGroup;
  luz: Luz;
  chaveGeo: string;
  pts: readonly number[] | null;
  raio: number;
}

function geometriaQuad(raio: number): Geometry {
  const coords = new Float32Array([-raio, -raio, raio, -raio, raio, raio, -raio, raio]);
  const uvs = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
  return new Geometry({
    attributes: { aPosition: coords, aUV: uvs },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
}

/**
 * Halos atmosféricos ao redor das luzes e raios volumétricos nos cones de lanterna e janelas.
 * Fica acima do mapa de luz multiplicado e das presenças, abaixo da névoa e das peças.
 */
export function criarHalos(mapaDeLuz: MapaDeLuz, telhados: Telhados): Halos {
  const raiz = new Container(), halosC = new Container(), raiosC = new Container();
  raiz.addChild(halosC, raiosC);

  let programaRaios: GlProgram | null = null;
  const halos = new Map<string, HaloGPU>(), raios = new Map<string, RaiosGPU>();
  let mapa: MapaAtlas | null = null, indiceCelulas: ReturnType<typeof indiceDeCelulas> | null = null;
  let ligado = true, destruido = false, pixel = false, ppm = 1;

  function obterPrograma(): GlProgram {
    programaRaios ??= GlProgram.from({ vertex: vertexRaios, fragment: fragmentRaios, preferredFragmentPrecision: 'highp', name: 'atlas-raios' });
    return programaRaios;
  }

  return {
    raiz,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (tudo || campo('rooms', 'grid')) indiceCelulas = indiceDeCelulas(m);
      if (campo('style', 'grid')) {
        pixel = m.style.renderer === 'pixel';
        ppm = pixel ? m.style.pixel.pixelsPerCell / m.grid.size : 1;
      }

      const vivas = mapaDeLuz.todasAsLuzes();
      const idsVivas = new Set(vivas.map(l => l.id));

      // Halos: cada luz acesa ganha um sprite aditivo com textura de brilho
      for (const l of vivas) {
        let h = halos.get(l.id);
        if (!h) {
          const s = new Sprite(pixel ? texturaDeBrilhoPixel() : texturaDeBrilho());
          s.anchor.set(0.5); s.blendMode = 'add'; halosC.addChild(s);
          h = { s, luz: l };
          halos.set(l.id, h);
        }
        h.luz = l;
        h.s.position.set(l.position[0], l.position[1]);
        const raio = 0.35 * l.radius;
        h.s.width = h.s.height = raio * 2;
        h.s.tint = hexParaNumero(l.color);
        h.s.texture = pixel ? texturaDeBrilhoPixel() : texturaDeBrilho();
      }
      for (const [id, h] of halos) if (!idsVivas.has(id)) { h.s.destroy(); halos.delete(id); }

      // Raios: luz com cone e rays: true ganha mesh em coordenadas de mundo com shader de listras radiais
      for (const l of vivas) {
        const querRaios = l.cone !== null && l.rays;
        let r = raios.get(l.id);
        if (!querRaios) {
          if (r) { r.mesh.geometry.destroy(); r.c.destroy({ children: true }); raios.delete(l.id); }
          continue;
        }
        if (!r) {
          const c = new Container(), mGraf = new Graphics();
          const grupo = new UniformGroup({
            uDirecao: { value: 0, type: 'f32' }, uAbertura: { value: 0, type: 'f32' },
            uRaio: { value: 1, type: 'f32' }, uIntensidade: { value: 0, type: 'f32' },
            uCor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
            uTempo: { value: 0, type: 'f32' }, uPixel: { value: 0, type: 'f32' }, uPpm: { value: 1, type: 'f32' },
          });
          const shader = new Shader({ glProgram: obterPrograma(), resources: { raios: grupo } });
          const mesh = new Mesh<Geometry, Shader>({ geometry: geometriaQuad(l.radius), shader });
          mesh.blendMode = 'add';
          mesh.mask = mGraf;
          c.addChild(mesh, mGraf);
          raiosC.addChild(c);
          r = { c, mesh, m: mGraf, grupo, luz: l, chaveGeo: '', pts: null, raio: l.radius };
          raios.set(l.id, r);
        }
        const item = r;
        item.luz = l;
        if (item.raio !== l.radius) {
          item.raio = l.radius;
          item.mesh.geometry.destroy();
          item.mesh.geometry = geometriaQuad(l.radius);
        }
        const u = item.grupo.uniforms as Record<string, unknown>;
        u.uDirecao = l.cone!.direction;
        u.uAbertura = l.cone!.angle;
        u.uRaio = l.radius;
        u.uCor = new Float32Array(rgb01(l.color));
        u.uPixel = pixel ? 1 : 0;
        u.uPpm = ppm;
        item.mesh.position.set(l.position[0], l.position[1]);

        const chave = JSON.stringify([l.position, l.radius, l.cone]);
        if (chave !== item.chaveGeo) {
          item.chaveGeo = chave;
          const pts = mapaDeLuz.poligono(l.id);
          item.pts = pts;
          item.m.clear(); if (pts && pts.length >= 6) item.m.poly(pts as number[]).fill(0xffffff);
        }
      }
      for (const [id, r] of raios) if (!idsVivas.has(id)) { r.mesh.geometry.destroy(); r.c.destroy({ children: true }); raios.delete(id); }
    },
    quadro(agora) {
      if (destruido || !mapa) return;
      const reduzido = movimentoReduzido();
      const tempoRaios = reduzido ? 0 : (pixel ? Math.floor(agora / 500) * 0.5 : agora / 1000);

      // Halos
      for (const h of halos.values()) {
        const k = mapaDeLuz.intensidade(h.luz.id);
        const salaId = indiceCelulas ? comodoEm(mapa, h.luz.position, indiceCelulas) : null;
        const oculta = salaId !== null && telhados.visivel(salaId);
        const alfa = oculta ? 0 : Math.min(1, Math.max(0, mapa.finish.glow * k));
        h.s.alpha = alfa;
        h.s.visible = ligado && alfa > 0.001;
      }

      // Raios
      for (const r of raios.values()) {
        const k = mapaDeLuz.intensidade(r.luz.id);
        const salaId = indiceCelulas ? comodoEm(mapa, r.luz.position, indiceCelulas) : null;
        const oculta = salaId !== null && telhados.visivel(salaId);
        const alfa = oculta ? 0 : Math.min(1, Math.max(0, k));
        r.c.visible = ligado && alfa > 0.001;
        if (r.c.visible) {
          const u = r.grupo.uniforms as Record<string, unknown>;
          u.uIntensidade = alfa;
          u.uTempo = tempoRaios;
          const pts = mapaDeLuz.poligono(r.luz.id);
          if (pts && pts !== r.pts && pts.length >= 6) {
            r.pts = pts;
            r.m.clear().poly(pts as number[]).fill(0xffffff);
          }
        }
      }
    },
    definirLigado(v) {
      ligado = v;
      halosC.visible = v;
      raiosC.visible = v;
    },
    destruir() {
      destruido = true;
      for (const h of halos.values()) h.s.destroy(); halos.clear();
      for (const r of raios.values()) { r.mesh.geometry.destroy(); r.c.destroy({ children: true }); } raios.clear();
      raiz.destroy({ children: true });
    },
  };
}
