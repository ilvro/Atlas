import type { ComandoConstruir } from '../state/comandos-construir.ts';

/** As ferramentas do editor e o que cada uma "carrega na mão" (o pincel). Dados puros, sem Pixi nem Preact. */
export type Ferramenta = 'selecionar' | 'mao' | 'comodo' | 'borracha' | 'parede' | 'abertura' | 'objeto' | 'luz' | 'peca' | 'regiao' | 'terreno' | 'presenca' | 'espalhar' | 'regua';

export interface Pincel {
  /** Tipo de cômodo (`TIPOS_DE_COMODO`). */
  comodo: string;
  /** Receita e parâmetros do objeto; `semente: null` varia a cada objeto posto. `rotacao` em radianos. */
  /** `item` é qualquer id do acervo: uma receita (`sofa`) ou um item da coleção (`casa:chesterfield-vinho`). */
  objeto: { item: string; params: Record<string, unknown>; semente: number | null; rotacao: number };
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
  objeto: { item: 'mesa.redonda', params: {}, semente: null, rotacao: 0 },
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
