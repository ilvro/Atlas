import type { Objeto } from './mapa.ts';

/** O que o pincel de objeto carrega: o item, o desenho e as propriedades que valem ao pôr (como o carimbo do Inkarnate). */
export interface PincelDeObjeto {
  /** `item` é qualquer id do acervo: uma receita (`sofa`) ou um item da coleção (`casa:chesterfield-vinho`). */
  item: string;
  params: Record<string, unknown>;
  /** `null` varia a semente a cada objeto posto. */
  semente: number | null;
  /** Radianos. */
  rotacao: number;
  /** Família do item (`ACERVO.familiaDoItem`); `null` para item sem família. */
  familia: string | null;
  /** Sorteia a variante da família a cada objeto posto. */
  varianteAleatoria: boolean;
  /** Multiplicador de escala (1 = tamanho do acervo). */
  escala: number;
  /** `null` = a camada padrão do tipo. */
  camada: number | null;
  espelhado: boolean;
  /** 0,1 a 1. */
  opacidade: number;
  sombra: boolean;
  bloqueia: boolean;
  rotacaoAleatoria: boolean;
  espelhoAleatorio: boolean;
  /** Variação aleatória da escala, ± em fração (0 a 0,5). */
  escalaAleatoria: number;
  /** O modo Vários (arrastar) e a área e a densidade ficam para a O9. */
  colocar: 'um' | 'varios';
  selecionarAoPor: boolean;
  /** Raio da área, em metros (0 = um ponto só). */
  area: number;
  densidade: number;
}

export const PROPRIEDADES_PADRAO = {
  escala: 1, camada: null, espelhado: false, opacidade: 1, sombra: true, bloqueia: true,
  rotacaoAleatoria: false, espelhoAleatorio: false, escalaAleatoria: 0,
  colocar: 'um', selecionarAoPor: true, area: 0, densidade: 1,
} as const satisfies Partial<PincelDeObjeto>;

export type CamposDoPincel = Pick<Objeto, 'rotation' | 'scale'> & Partial<Pick<Objeto, 'flip' | 'opacity' | 'layer' | 'castsShadow' | 'blocks'>>;

const ESCALA_MIN = 0.05, ESCALA_MAX = 50;

/**
 * Os campos do objeto que o pincel produz, com as variações aleatórias aplicadas. Omite o que está no padrão, para não poluir o documento.
 * A ordem dos sorteios é fixa (rotação, escala, espelho), e só sorteia o que está ligado.
 */
export function camposDoPincel(p: PincelDeObjeto, rand: () => number): CamposDoPincel {
  const rotation = p.rotacaoAleatoria ? rand() * Math.PI * 2 : p.rotacao;
  const variacao = p.escalaAleatoria > 0 ? 1 + (rand() * 2 - 1) * Math.min(0.5, p.escalaAleatoria) : 1;
  const scale = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, p.escala * variacao));
  const flip = p.espelhoAleatorio ? (rand() < 0.5) !== p.espelhado : p.espelhado;
  return {
    rotation, scale,
    ...(flip ? { flip: true } : {}),
    ...(p.opacidade < 1 ? { opacity: Math.max(0.1, p.opacidade) } : {}),
    ...(p.camada !== null ? { layer: Math.round(p.camada) } : {}),
    ...(!p.sombra ? { castsShadow: false } : {}),
    ...(!p.bloqueia ? { blocks: { move: false, sight: false } } : {}),
  };
}

/** O pincel como o objeto é (Ctrl+clique, "Copiar para o pincel"): item e desenho vêm do objeto, as variações aleatórias e a colocação ficam como estavam. */
export function pincelDoObjeto(o: Objeto, atual: PincelDeObjeto, item: string, familia: string | null): PincelDeObjeto {
  return {
    ...atual, item, familia,
    params: o.source.kind === 'recipe' ? structuredClone(o.source.params) : {},
    semente: o.source.kind === 'recipe' ? o.source.seed : null,
    rotacao: o.rotation, escala: o.scale, camada: o.layer ?? null, espelhado: o.flip ?? false, opacidade: o.opacity ?? 1,
    sombra: o.castsShadow, bloqueia: o.blocks.move,
  };
}
