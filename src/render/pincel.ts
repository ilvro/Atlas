import { AREA_MINIMA_CONTORNO, areaDoPoligono, celulasDoContorno, ehPoligonoSimples, normalizarContorno } from '../domain/formas-de-comodo.ts';
import type { PincelDeObjeto } from '../domain/pincel-de-objeto.ts';
import { PROPRIEDADES_PADRAO } from '../domain/pincel-de-objeto.ts';
import { colunas, linhas, type MapaAtlas, type Ponto } from '../domain/mapa.ts';
import { telhadoPadrao, tipoDeComodo } from '../domain/presets.ts';
import type { ComandoConstruir } from '../state/comandos-construir.ts';

/** As ferramentas do editor e o que cada uma "carrega na mão" (o pincel). Dados puros, sem Pixi nem Preact. */
export type Ferramenta = 'selecionar' | 'mao' | 'comodo' | 'borracha' | 'parede' | 'abertura' | 'objeto' | 'luz' | 'peca' | 'regiao' | 'terreno' | 'presenca' | 'espalhar' | 'regua';
export type FormaDeDesenhoDeComodo = 'celulas' | 'circulo' | 'poligono';

export interface Pincel {
  /** Tipo de cômodo (`TIPOS_DE_COMODO`). */
  comodo: string;
  /** Modo de desenho da ferramenta Cômodo (células da grade, círculo ou polígono livre). */
  comodoForma?: FormaDeDesenhoDeComodo;
  /** Número de lados ao desenhar cômodo circular (8..48; padrão 24). */
  comodoLados?: number;
  /** Item, desenho e propriedades do objeto (ver `PincelDeObjeto`). */
  objeto: PincelDeObjeto;
  luz: { preset: string; /** Direção do facho, em radianos. */ direcao: number };
  abertura: { tipo: 'door' | 'window' | 'arch' | 'secret' };
  parede: { tipo: 'wall' | 'low' | 'fence' | 'cliff' };
  terreno: {
    material: string;
    /** Raio do pincel, em metros. */
    raio: number;
    /** Água: arredonda a borda onde a pincelada passou. */
    suavizar?: boolean;
    /** Modo do pincel de terreno: pinta material (padrão) ou patamar de relevo. */
    modo?: 'material' | 'relevo';
    /** Altitude alvo em metros quando `modo === 'relevo'`. */
    altura?: number;
  };
  presenca: { brush: string; raio: number };
  espalhar: { conjunto: string; raio: number };
}

/** Comando de construção emitido pelo pincel de Terreno (material ou relevo) para um conjunto de células. */
export function comandoDoPincelDeTerreno(
  terreno: Pincel['terreno'],
  celulas: [number, number][],
  apagar: boolean,
): ComandoConstruir {
  if (terreno.modo === 'relevo') {
    if (apagar) return { tipo: 'relevo.apagar', celulas };
    return { tipo: 'relevo.pintar', altura: terreno.altura ?? 0, celulas };
  }
  if (apagar) return { tipo: 'terreno.apagar', celulas };
  return { tipo: 'terreno.pintar', material: terreno.material, celulas, ...(terreno.suavizar ? { suavizar: true } : {}) };
}

export const PINCEL_PADRAO: Pincel = {
  comodo: 'sala',
  objeto: { item: 'mesa.redonda', params: {}, semente: null, rotacao: 0, familia: 'mesa-redonda', varianteAleatoria: false, ...PROPRIEDADES_PADRAO },
  luz: { preset: 'lamparina', direcao: 0 },
  abertura: { tipo: 'door' },
  parede: { tipo: 'wall' },
  terreno: { material: 'grama', raio: 1.5 },
  presenca: { brush: 'musgo', raio: 1.5 },
  espalhar: { conjunto: 'papelada', raio: 1.5 },
};

export const LARGURA_DA_ABERTURA: Record<Pincel['abertura']['tipo'], number> = { door: 0.9, window: 1.0, arch: 1.2, secret: 0.9 };
export const ROTULO_DA_FERRAMENTA: Record<Ferramenta, string> = {
  selecionar: 'Selecionar', mao: 'Mover a vista', comodo: 'Pintar cômodo', borracha: 'Apagar cômodo', parede: 'Desenhar parede', abertura: 'Porta ou janela',
  objeto: 'Objeto', luz: 'Luz', peca: 'Peça', regiao: 'Região', terreno: 'Terreno', presenca: 'Presença', espalhar: 'Espalhar', regua: 'Régua',
};

/** Prende `p` ao ângulo múltiplo de 45° mais próximo em relação a `origem` (usado ao desenhar polígono com Shift). */
export function pontoPreso45(origem: Ponto, p: Ponto): Ponto {
  const dx = p[0] - origem[0], dy = p[1] - origem[1];
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return p;
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [origem[0] + Math.cos(ang) * dist, origem[1] + Math.sin(ang) * dist];
}

/** Comando `comodo.criar` a partir de um contorno livre desenhado no editor, ou erro descritivo em `string`. */
export function comandoDeComodoPorContorno(
  m: Pick<MapaAtlas, 'bounds' | 'grid' | 'rooms' | 'style'>,
  bruto: readonly Ponto[],
  tipoComodoId: string,
  id: string,
  semente = Math.floor(Math.random() * 1e6),
  andar: string | null = null,
): Extract<ComandoConstruir, { tipo: 'comodo.criar' }> | string {
  const outline = normalizarContorno(bruto);
  if (outline.length < 3 || !ehPoligonoSimples(outline)) return 'O contorno do cômodo se cruza ou é inválido.';
  if (areaDoPoligono(outline) < AREA_MINIMA_CONTORNO) return `O cômodo precisa ter pelo menos ${AREA_MINIMA_CONTORNO} m².`;
  const cols = colunas(m), lins = linhas(m);
  const celulas = celulasDoContorno(m.grid, outline).filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < lins);
  if (!celulas.length) return 'O cômodo ficou fora dos limites do mapa.';
  const tipo = tipoDeComodo(tipoComodoId) ?? tipoDeComodo('sala')!;
  const mesmos = Object.values(m.rooms).filter(s => s.function === tipo.funcao).length;
  return {
    tipo: 'comodo.criar',
    id,
    nome: mesmos ? `${tipo.nome} ${mesmos + 1}` : tipo.nome,
    funcao: tipo.funcao,
    piso: { material: tipo.piso, seed: semente },
    papel: { material: tipo.papel, seed: (semente + 17) % 1_000_000 },
    telhado: telhadoPadrao(m, tipo.funcao, celulas, null, outline),
    celulas,
    outline,
    ...(andar !== null ? { levelId: andar } : {}),
  };
}
