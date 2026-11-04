import { Container, Graphics, Particle, ParticleContainer, Texture } from 'pixi.js';
import type { Luz, MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { BRASAS_POR_FOGO, BRASAS_SOLTAS_POR_M2, DENSIDADE, FATOR_DE_MOVIMENTO_REDUZIDO, TETO_DE_BRASAS, inclinacaoDaChuva, quantidade, type TipoDeParticula } from './particulas-config.ts';
import { desenharComodos, faixasDosComodos, type FaixasDeComodos } from './mascara-de-comodos.ts';

export interface Particulas {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  definirLigado(ligado: boolean): void;
  /** Quantas partículas de cada tipo existem agora (para testes e diagnóstico). */
  contagem(): Record<TipoDeParticula, number>;
  destruir(): void;
}

const aleatorio = (a: number, b: number) => a + Math.random() * (b - a);

/** Uma textura pequena, desenhada uma vez em canvas. */
function textura(largura: number, altura: number, desenhar: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas'); c.width = largura; c.height = altura;
  desenhar(c.getContext('2d')!); return Texture.from(c);
}
const ponto = (g: CanvasRenderingContext2D, r: number) => { const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); };

const TEXTURAS: Record<TipoDeParticula, () => { tex: Texture; largura: number; altura: number }> = {
  chuva: () => ({ tex: textura(4, 48, g => { const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(1, 0, 2, 48); }), largura: 4, altura: 48 }),
  neve: () => ({ tex: textura(16, 16, g => ponto(g, 8)), largura: 16, altura: 16 }),
  poeira: () => ({ tex: textura(16, 16, g => ponto(g, 8)), largura: 16, altura: 16 }),
  brasa: () => ({ tex: textura(16, 16, g => ponto(g, 8)), largura: 16, altura: 16 }),
  folha: () => ({ tex: textura(24, 16, g => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(12, 8, 11, 6.5, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, 8); g.lineTo(22, 8); g.stroke(); }), largura: 24, altura: 16 }),
};

/**
 * As partículas no Pixel: texturas de pixels inteiros (gota 1 × 3, floco e poeira e brasa 1 × 1 ou 2 × 2, folha 2 × 2), em `nearest`, sem rotação contínua.
 * Entram no render target pixelizado, então a posição cai sozinha na grade do Pixel e as cores passam pela paleta.
 */
const TEXTURAS_PIXEL: Record<TipoDeParticula, () => { tex: Texture; largura: number; altura: number }> = {
  chuva: () => ({ tex: texturaPixel(1, 3), largura: 1, altura: 3 }),
  neve: () => ({ tex: texturaPixel(1, 1), largura: 1, altura: 1 }),
  poeira: () => ({ tex: texturaPixel(1, 1), largura: 1, altura: 1 }),
  brasa: () => ({ tex: texturaPixel(1, 1), largura: 1, altura: 1 }),
  folha: () => ({ tex: texturaPixel(2, 2), largura: 2, altura: 2 }),
};
function texturaPixel(l: number, a: number): Texture { const t = textura(l, a, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, l, a); }); t.source.scaleMode = 'nearest'; return t; }

const CORES_DE_FOLHA = [0x6b8a3a, 0x8a7a2e, 0xb06a28, 0x7a3b1f, 0x4f6b2c];

interface Grupo {
  tipo: TipoDeParticula; pc: ParticleContainer; particulas: Particle[];
  tex: Texture; largura: number; altura: number;
  vx: Float32Array; vy: Float32Array; fase: Float32Array; vida: Float32Array; duracao: Float32Array; giro: Float32Array; base: Float32Array;
}

export function criarParticulas(): Particulas {
  const raiz = new Container(), fora = new Container(), dentro = new Container();
  const mascaraFora = new Graphics(), mascaraDentro = new Graphics();
  fora.addChild(mascaraFora); dentro.addChild(mascaraDentro);
  fora.setMask({ mask: mascaraFora, inverse: true }); dentro.mask = mascaraDentro;
  raiz.addChild(fora, dentro);

  const grupos = new Map<TipoDeParticula, Grupo>();
  let pixel = false, ppm = 1;      // no Pixel: texturas próprias e uma unidade de 1 pixel do Pixel (1 / ppm metros)
  let mapa: MapaAtlas | null = null, salas: FaixasDeComodos = { faixas: [], area: 0 }, fogos: Luz[] = [], tempo = 0, ligado = true, destruido = false;
  const forca: Record<TipoDeParticula, number> = { chuva: 0, neve: 0, poeira: 0, brasa: 0, folha: 0 };

  /** No Pixel a opacidade cai em degraus (a transparência contínua daria meios-tons). */
  const quant = (a: number): number => (pixel ? Math.round(a * 3) / 3 : a);
  const largura = () => mapa?.bounds.width ?? 0, altura = () => mapa?.bounds.height ?? 0;

  function grupo(tipo: TipoDeParticula): Grupo {
    let g = grupos.get(tipo); if (g) return g;
    const { tex, largura: l, altura: a } = (pixel ? TEXTURAS_PIXEL : TEXTURAS)[tipo](), din = tipo === 'chuva' || tipo === 'neve' ? false : true;
    const pc = new ParticleContainer({ texture: tex, dynamicProperties: { position: true, rotation: true, color: din, vertex: false, uvs: false } });
    if (tipo === 'brasa') pc.blendMode = 'add';
    const n = tipo === 'brasa' ? TETO_DE_BRASAS : 4000, f = () => new Float32Array(n);
    g = { tipo, pc, particulas: [], tex, largura: l, altura: a, vx: f(), vy: f(), fase: f(), vida: f(), duracao: f(), giro: f(), base: f() };
    (tipo === 'poeira' ? dentro : tipo === 'brasa' ? raiz : fora).addChild(pc);
    grupos.set(tipo, g); return g;
  }

  /** Põe a partícula `i` num ponto de partida do tipo; `espalhar` a joga num ponto qualquer da altura (início), senão nasce na origem do movimento. */
  function nascer(g: Grupo, i: number, espalhar: boolean): void {
    const p = g.particulas[i]!, W = largura(), H = altura(), vento = mapa?.climate.weather.wind ?? 0;
    g.fase[i] = Math.random() * Math.PI * 2; g.vida[i] = 0;
    switch (g.tipo) {
      case 'chuva': {
        const v = aleatorio(16, 24); g.vy[i] = v; g.vx[i] = v * vento * 0.4; p.x = Math.random() * (W + 6) - 3; p.y = espalhar ? Math.random() * H : -aleatorio(0.5, 2);
        if (espalhar) { const e = aleatorio(0.8, 1.1); if (pixel) p.scaleX = p.scaleY = 1 / ppm; else { p.scaleX = (0.035 / g.largura) * 1.4; p.scaleY = (0.55 * e) / g.altura; } p.alpha = aleatorio(0.3, 0.8); p.tint = 0xd6e2f0; }
        break;
      }
      case 'neve': {
        g.vy[i] = aleatorio(0.8, 1.8); g.base[i] = aleatorio(0.5, 1.2); p.x = Math.random() * (W + 4) - 2; p.y = espalhar ? Math.random() * H : -aleatorio(0.2, 1);
        if (espalhar) { const e = aleatorio(0.09, 0.2); p.scaleX = p.scaleY = pixel ? (Math.random() < 0.6 ? 1 : 2) / ppm : e / g.largura; p.alpha = aleatorio(0.5, 0.95); p.tint = 0xf2f7ff; }
        break;
      }
      case 'poeira': {
        const f = salas.faixas; if (!f.length) { p.alpha = 0; break; }
        let r = Math.random() * salas.area, k = 0; while (k < f.length - 1 && r > f[k]!.w * f[k]!.h) { r -= f[k]!.w * f[k]!.h; k++; }
        const z = f[k]!; p.x = z.x + Math.random() * z.w; p.y = z.y + Math.random() * z.h;
        g.vx[i] = aleatorio(-0.12, 0.12); g.vy[i] = aleatorio(-0.1, 0.06); g.duracao[i] = aleatorio(7, 16); g.vida[i] = espalhar ? Math.random() * g.duracao[i]! : 0;
        if (espalhar) { const e = aleatorio(0.07, 0.16); p.scaleX = p.scaleY = pixel ? 1 / ppm : e / g.largura; p.tint = 0xf0e4cc; }
        p.alpha = 0; break;
      }
      case 'brasa': {
        const fogo = fogos.length ? fogos[Math.floor(Math.random() * fogos.length)]! : null;
        p.x = fogo ? fogo.position[0] + aleatorio(-0.3, 0.3) : Math.random() * W; p.y = fogo ? fogo.position[1] + aleatorio(-0.3, 0.3) : Math.random() * H;
        g.vy[i] = -aleatorio(0.5, 1.4); g.vx[i] = aleatorio(-0.15, 0.15); g.duracao[i] = aleatorio(1.2, 2.8); g.vida[i] = espalhar ? Math.random() * g.duracao[i]! : 0;
        if (espalhar) { const e = aleatorio(0.08, 0.17); p.scaleX = p.scaleY = pixel ? 1 / ppm : e / g.largura; p.tint = Math.random() < 0.5 ? 0xffa040 : 0xff7a2a; }
        p.alpha = 0; break;
      }
      case 'folha': {
        g.vy[i] = aleatorio(0.5, 1.1); g.base[i] = aleatorio(0.6, 1.5); g.giro[i] = aleatorio(-2.2, 2.2); p.x = Math.random() * (W + 4) - 2; p.y = espalhar ? Math.random() * H : -aleatorio(0.2, 1);
        if (espalhar) { const e = aleatorio(0.24, 0.4); p.scaleX = p.scaleY = pixel ? 1 / ppm : e / g.largura; p.alpha = pixel ? 1 : 0.92; p.tint = CORES_DE_FOLHA[Math.floor(Math.random() * CORES_DE_FOLHA.length)]!; }
        p.rotation = pixel ? 0 : Math.random() * Math.PI * 2; break;
      }
    }
  }

  /** Ajusta quantas partículas o grupo tem, sem recriar as que já existem. */
  function ajustar(tipo: TipoDeParticula, alvo: number): void {
    const g = grupo(tipo), atual = g.particulas.length;
    if (alvo === atual) return;
    if (alvo > atual) { for (let i = atual; i < alvo; i++) { g.particulas.push(new Particle({ texture: g.tex, anchorX: 0.5, anchorY: 0.5 })); g.pc.addParticle(g.particulas[i]!); nascer(g, i, true); } }
    else { for (let i = atual - 1; i >= alvo; i--) g.pc.removeParticle(g.particulas[i]!); g.particulas.length = alvo; }
    g.pc.update(); g.pc.visible = alvo > 0;
  }

  function recontar(): void {
    if (!mapa) return;
    const w = mapa.climate.weather, area = largura() * altura();
    ajustar('chuva', quantidade(DENSIDADE.chuva, area, w.rain));
    ajustar('neve', quantidade(DENSIDADE.neve, area, w.snow));
    ajustar('folha', quantidade(DENSIDADE.folha, area, w.leaves));
    ajustar('poeira', quantidade(DENSIDADE.poeira, salas.area, w.dust));
    ajustar('brasa', w.embers > 0 ? quantidade(fogos.length ? BRASAS_POR_FOGO * fogos.length : BRASAS_SOLTAS_POR_M2 * area, 1, w.embers, TETO_DE_BRASAS) : 0);
    forca.chuva = w.rain; forca.neve = w.snow; forca.folha = w.leaves; forca.poeira = w.dust; forca.brasa = w.embers;
    for (const g of grupos.values()) g.pc.alpha = g.tipo === 'chuva' ? Math.min(1, w.rain) : 1;
  }

  return {
    raiz,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      // Trocar de estilo (ou de pixels por célula) refaz os grupos: as texturas e as escalas são outras.
      const ehPixel = m.style.renderer === 'pixel', razao = m.style.pixel.pixelsPerCell / m.grid.size;
      if (ehPixel !== pixel || (ehPixel && razao !== ppm)) {
        for (const g of grupos.values()) { g.pc.destroy(); g.tex.destroy(true); } grupos.clear(); pixel = ehPixel; ppm = razao;
        for (const k of Object.keys(forca) as TipoDeParticula[]) forca[k] = 0;
      }
      const comodos = col('rooms') || campo('grid');
      if (comodos) { desenharComodos(mascaraFora, m); desenharComodos(mascaraDentro, m); salas = faixasDosComodos(m); }
      const fogosAntes = fogos.length;
      if (tudo || col('lights')) fogos = Object.values(m.lights).filter(l => l.power === 'fire' && l.on);
      if (tudo || comodos || col('lights') || campo('climate', 'bounds', 'style')) {
        recontar();
        // Os grupos que dependem dos cômodos ou das luzes recomeçam: a poeira dentro dos cômodos novos, as brasas junto às luzes.
        if (comodos) { const g = grupos.get('poeira'); if (g) { for (let i = 0; i < g.particulas.length; i++) nascer(g, i, true); g.pc.update(); } }
        if (fogos.length !== fogosAntes) { const g = grupos.get('brasa'); if (g) { for (let i = 0; i < g.particulas.length; i++) nascer(g, i, true); g.pc.update(); } }
      }
    },
    quadro(dt) {
      if (destruido || !ligado || !mapa) return;
      const passo = Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1); tempo += passo;
      const W = largura(), H = altura(), vento = mapa.climate.weather.wind, rot = inclinacaoDaChuva(vento);
      for (const g of grupos.values()) {
        const ps = g.particulas; if (!ps.length) continue;
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i]!;
          switch (g.tipo) {
            case 'chuva': {
              g.vx[i] = g.vy[i]! * vento * 0.4; p.x += g.vx[i]! * passo; p.y += g.vy[i]! * passo; p.rotation = pixel ? 0 : rot;
              if (p.y > H + 1 || p.x < -3 || p.x > W + 3) { nascer(g, i, false); if (p.x < -3 || p.x > W + 3) p.x = Math.random() * W; }
              break;
            }
            case 'neve': {
              p.x += (vento * 1.5 + Math.sin(tempo * 1.3 + g.fase[i]!) * 0.5 * g.base[i]!) * passo; p.y += g.vy[i]! * passo;
              if (p.y > H + 0.5) nascer(g, i, false); else if (p.x < -2) p.x += W + 4; else if (p.x > W + 2) p.x -= W + 4;
              break;
            }
            case 'poeira': {
              g.vida[i]! += passo; const t = g.vida[i]! / g.duracao[i]!;
              if (t >= 1) { nascer(g, i, false); break; }
              p.x += (g.vx[i]! + Math.sin(tempo * 0.7 + g.fase[i]!) * 0.05) * passo; p.y += (g.vy[i]! + Math.cos(tempo * 0.5 + g.fase[i]!) * 0.04) * passo;
              p.alpha = quant(Math.sin(Math.PI * t) * 0.8); break;
            }
            case 'brasa': {
              g.vida[i]! += passo; const t = g.vida[i]! / g.duracao[i]!;
              if (t >= 1) { nascer(g, i, false); break; }
              p.x += (g.vx[i]! + vento * 0.8 + Math.sin(tempo * 4 + g.fase[i]!) * 0.25) * passo; p.y += g.vy[i]! * passo;
              p.alpha = quant(Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.95); break;
            }
            case 'folha': {
              p.x += (vento * 3 + Math.sin(tempo * 1.1 + g.fase[i]!) * 0.5 * g.base[i]!) * passo; p.y += g.vy[i]! * passo; if (!pixel) p.rotation += g.giro[i]! * passo;
              if (p.y > H + 0.5) nascer(g, i, false); else if (p.x < -2) p.x += W + 4; else if (p.x > W + 2) p.x -= W + 4;
              break;
            }
          }
        }
      }
    },
    definirLigado(v) { ligado = v; raiz.visible = v; },
    contagem: () => ({ chuva: grupos.get('chuva')?.particulas.length ?? 0, neve: grupos.get('neve')?.particulas.length ?? 0, poeira: grupos.get('poeira')?.particulas.length ?? 0, brasa: grupos.get('brasa')?.particulas.length ?? 0, folha: grupos.get('folha')?.particulas.length ?? 0 }),
    destruir() { destruido = true; for (const g of grupos.values()) { g.pc.destroy(); g.tex.destroy(true); } grupos.clear(); raiz.destroy({ children: true }); },
  };
}
