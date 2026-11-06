import type { Camera, Tela } from './camera.ts';
import { visivel } from './camera.ts';

export interface DadosGrade { size: number; offset: [number, number] }
export interface LinhasGrade { verticais: number[]; horizontais: number[]; passo: number }

/**
 * Linhas da grade visíveis, em metros. Quando a célula fica pequena demais na tela, só se desenha uma a cada N
 * (potências de 2), para a grade nunca virar uma mancha.
 */
export function linhasDaGrade(camera: Camera, tela: Tela, grade: DadosGrade, limites: { width: number; height: number }, pxMinimo = 14): LinhasGrade {
  let passo = 1;
  while (grade.size * passo * camera.zoom < pxMinimo && passo < 1024) passo *= 2;
  const v = visivel(camera, tela), tam = grade.size * passo;
  const [ox, oy] = grade.offset;
  const faixa = (min: number, max: number, deslocamento: number, fim: number): number[] => {
    const saida: number[] = [];
    const ini = Math.max(0, Math.ceil((Math.max(min, 0) - deslocamento) / tam)), ultimo = Math.min(fim, max);
    for (let i = ini; ; i++) { const p = deslocamento + i * tam; if (p > ultimo + 1e-9) break; if (p >= -1e-9) saida.push(Math.round(p * 1e6) / 1e6); }
    return saida;
  };
  return { verticais: faixa(v.x0, v.x1, ox, limites.width), horizontais: faixa(v.y0, v.y1, oy, limites.height), passo };
}

/** Encaixa um valor na grade, em passos de `fracao` célula (0,5 = meia célula). `desligado` devolve o valor como está. */
export function encaixar(valor: number, grade: DadosGrade, eixo: 0 | 1, fracao = 0.5, desligado = false): number {
  if (desligado) return valor;
  const passo = grade.size * fracao, o = grade.offset[eixo];
  return Math.round((valor - o) / passo) * passo + o;
}

/** Deslocamento que leva `de` ao ponto encaixado mais próximo de `de + delta`. */
export function deltaEncaixado(de: [number, number], delta: [number, number], grade: DadosGrade, fracao = 0.5, desligado = false): [number, number] {
  return [encaixar(de[0] + delta[0], grade, 0, fracao, desligado) - de[0], encaixar(de[1] + delta[1], grade, 1, fracao, desligado) - de[1]];
}

/**
 * Divide um segmento [ini, fim] em intervalos tracejados [d0, d1] de comprimento `comp`
 * separados por `espaco`.
 */
export function segmentosTracejados(ini: number, fim: number, comp: number, espaco: number): [number, number][] {
  if (fim <= ini || comp <= 0 || espaco <= 0) return [];
  const saida: [number, number][] = [];
  let atual = ini;
  while (atual < fim - 1e-9) {
    const proximo = Math.min(fim, atual + comp);
    saida.push([Math.round(atual * 1e6) / 1e6, Math.round(proximo * 1e6) / 1e6]);
    atual = proximo + espaco;
  }
  return saida;
}

/**
 * Interseções de todas as linhas verticais e horizontais visíveis (para estilo 'corners').
 */
export function intersecoesDaGrade(l: LinhasGrade): [number, number][] {
  const saida: [number, number][] = [];
  for (const x of l.verticais) {
    for (const y of l.horizontais) {
      saida.push([x, y]);
    }
  }
  return saida;
}

export interface CelulaHexagonal {
  centro: [number, number];
  vertices: [number, number][];
}

/**
 * Gera as células hexagonais visíveis na câmera, dentro dos limites do mapa.
 * Hexágonos regulares pontiagudos no topo (pointy-topped) com raio R = size / 2.
 */
export function celulasHexagonaisVisiveis(
  camera: Camera,
  tela: Tela,
  grade: DadosGrade,
  limites: { width: number; height: number },
): CelulaHexagonal[] {
  const v = visivel(camera, tela);
  const R = grade.size / 2;
  if (R <= 1e-6) return [];

  const dx = Math.sqrt(3) * R;
  const dy = 1.5 * R;
  const [ox, oy] = grade.offset;

  const rMin = Math.max(0, Math.floor((Math.max(0, v.y0) - oy - R) / dy));
  const rMax = Math.ceil((Math.min(limites.height, v.y1) - oy + R) / dy);

  const saida: CelulaHexagonal[] = [];

  for (let r = rMin; r <= rMax; r++) {
    const shiftX = (r % 2 === 0 ? 0 : dx / 2);
    const cy = oy + r * dy;
    if (cy < -R || cy > limites.height + R) continue;

    const cMin = Math.max(0, Math.floor((Math.max(0, v.x0) - ox - shiftX - R) / dx));
    const cMax = Math.ceil((Math.min(limites.width, v.x1) - ox - shiftX + R) / dx);

    for (let c = cMin; c <= cMax; c++) {
      const cx = ox + shiftX + c * dx;
      if (cx < -R || cx > limites.width + R) continue;

      const vertices: [number, number][] = [];
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI / 6 + (k * Math.PI) / 3;
        vertices.push([
          Math.round((cx + R * Math.cos(ang)) * 1e6) / 1e6,
          Math.round((cy + R * Math.sin(ang)) * 1e6) / 1e6,
        ]);
      }
      saida.push({
        centro: [Math.round(cx * 1e6) / 1e6, Math.round(cy * 1e6) / 1e6],
        vertices,
      });
    }
  }

  return saida;
}

/**
 * Retorna apenas as listas de vértices dos hexágonos visíveis.
 */
export function verticesHexagonaisVisiveis(
  camera: Camera,
  tela: Tela,
  grade: DadosGrade,
  limites: { width: number; height: number },
): [number, number][][] {
  return celulasHexagonaisVisiveis(camera, tela, grade, limites).map(c => c.vertices);
}

/**
 * Calcula o novo tamanho ou deslocamento da grade durante a calibração no Modo de Alinhamento.
 */
export function ajustarGradePorAlinhamento(
  grade: { size: number; offset: [number, number] },
  origem: [number, number],
  novoPonto: [number, number],
  modo: 'offset' | 'escala',
  celulasReferencia = 3,
): { size: number; offset: [number, number] } {
  if (modo === 'offset') {
    const dx = novoPonto[0] - origem[0];
    const dy = novoPonto[1] - origem[1];
    const ox = ((grade.offset[0] + dx) % grade.size + grade.size) % grade.size;
    const oy = ((grade.offset[1] + dy) % grade.size + grade.size) % grade.size;
    return {
      size: grade.size,
      offset: [Math.round(ox * 1e4) / 1e4, Math.round(oy * 1e4) / 1e4],
    };
  }

  // modo === 'escala': arrastar canto de um bloco de N células
  const dx = Math.abs(novoPonto[0] - origem[0]);
  const dy = Math.abs(novoPonto[1] - origem[1]);
  const dist = Math.max(dx, dy);
  const n = Math.max(1, celulasReferencia);
  const novoTamanho = Math.max(0.25, Math.min(10, dist / n));
  return {
    size: Math.round(novoTamanho * 100) / 100,
    offset: grade.offset,
  };
}
