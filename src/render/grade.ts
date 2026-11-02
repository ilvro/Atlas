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
