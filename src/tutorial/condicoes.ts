import { contem } from '../domain/celulas.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { regioesOcupadas } from '../domain/regioes.ts';

/**
 * Verificações nomeadas que um passo de lição espera. Cada uma lê o estado do mapa e do editor, nunca qual botão foi apertado: o passo termina
 * quando o resultado existe, por qualquer caminho que a pessoa tenha seguido.
 */
export interface EstadoDoTutor {
  doc: MapaAtlas;
  modo: 'construir' | 'sessao';
  /** A aba do inspetor ('mapa', 'selecao' ou 'historico'). */
  aba: string;
  ferramenta: string;
  selecao: readonly { colecao: string; id: string }[];
  /** O projetor está aberto e conectado? */
  projetor: boolean;
  vistaDeJogador: boolean;
  /** O mapa tem alterações não gravadas? */
  sujo: boolean;
  /** O conjunto e o pincel da ferramenta Espalhar. */
  espalhar?: { conjunto: string; raio: number };
}
/** `['nome', ...argumentos]`. */
export type Condicao = readonly [string, ...unknown[]];

const lista = <T,>(o: Record<string, T>): T[] => Object.values(o);
const hsv = (hex: string): { hue: number; saturation: number; value: number } => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(String(hex).slice(i, i + 2), 16) / 255) as [number, number, number], max = Math.max(r, g, b), faixa = max - Math.min(r, g, b);
  const hue = !faixa ? 0 : max === r ? ((g - b) / faixa + 6) % 6 : max === g ? (b - r) / faixa + 2 : (r - g) / faixa + 4;
  return { hue: hue * 60, saturation: max ? faixa / max : 0, value: max };
};

/**
 * Uma cor escolhida a olho vale quando é o mesmo tipo de cor: cinzas pela claridade, o resto pelo matiz (até 25°), saturação e brilho.
 * Ninguém acerta #5a5d60 com o seletor.
 */
export function corProxima(cor: unknown, desejada: string): boolean {
  if (typeof cor !== 'string' || !/^#[0-9a-f]{6}$/i.test(cor)) return false;
  const a = hsv(cor), b = hsv(desejada), matiz = Math.abs(a.hue - b.hue);
  if (b.saturation < 0.15 || b.value < 0.12) return Math.abs(a.value - b.value) <= 0.14 && a.saturation <= Math.max(0.25, b.saturation + 0.15);
  return Math.min(matiz, 360 - matiz) <= 25 && Math.abs(a.saturation - b.saturation) <= 0.35 && Math.abs(a.value - b.value) <= 0.3;
}

/** Números batem a cerca de 2% (e pelo menos 0,011), textos sem olhar maiúsculas. */
export function igual(valor: unknown, desejado: unknown): boolean {
  if (typeof desejado === 'number') return typeof valor === 'number' && Math.abs(valor - desejado) <= Math.max(0.011, Math.abs(desejado) * 0.02);
  return String(valor).toLowerCase() === String(desejado).toLowerCase();
}

/** Os valores num caminho pontilhado do documento (`climate.ambient.intensity`); um `*` percorre uma coleção (`lights.*.radius`). */
export function valoresEm(doc: unknown, caminho: string): unknown[] {
  let atuais: unknown[] = [doc];
  for (const chave of caminho.split('.')) {
    atuais = atuais.flatMap(v => (v && typeof v === 'object' ? (chave === '*' ? Object.values(v as object) : [(v as Record<string, unknown>)[chave]]) : []));
  }
  return atuais.filter(v => v !== undefined);
}

export const CONDICOES: Record<string, (e: EstadoDoTutor, ...a: never[]) => boolean> = {
  /** Uma explicação que a pessoa deixa com "Continuar". */
  ler: () => false,
  modo: (e, m: string) => e.modo === m,
  ferramenta: (e, f: string) => e.ferramenta === f,
  aba: (e, a: string) => e.aba === a,
  vista: (e, v: string) => (e.vistaDeJogador ? 'jogador' : 'mestre') === v,
  projetor: e => e.projetor,
  gravado: e => !e.sujo,
  espalhar: (e, conjunto: string, raio?: number) => e.espalhar?.conjunto === conjunto && (raio === undefined || igual(e.espalhar.raio, raio)),
  /** Todas as condições (a pessoa pega a ferramenta E escolhe o item). */
  e: (e, ...condicoes: Condicao[]) => condicoes.every(c => atendida(c, e)),
  /** Algo da coleção está selecionado e fica no ponto do mapa: o cômodo que o contém, ou a luz, peça ou objeto a até ~1,5 m. */
  selecionadoEm: (e, colecao: string, ponto: Ponto) => e.selecao.some(a => {
    if (a.colecao !== colecao) return false;
    if (colecao === 'rooms') { const c = e.doc.rooms[a.id]; const t = e.doc.grid.size, [ox, oy] = e.doc.grid.offset; return !!c && contem(c.cells, Math.floor((ponto[0] - ox) / t), Math.floor((ponto[1] - oy) / t)); }
    const item = (e.doc[colecao as 'lights' | 'tokens' | 'props'] as Record<string, { position: Ponto }> | undefined)?.[a.id];
    return !!item && Math.hypot(item.position[0] - ponto[0], item.position[1] - ponto[1]) <= 1.5;
  }),
  selecionado: (e, colecao: string) => e.selecao.some(a => a.colecao === colecao),

  comodos: (e, n: number) => lista(e.doc.rooms).length >= n,
  comodoComFuncao: (e, f: string) => lista(e.doc.rooms).some(c => c.function === f),
  comodoComPiso: (e, material: string) => lista(e.doc.rooms).some(c => c.floor.material === material),
  comodoComPapel: (e, material: string) => lista(e.doc.rooms).some(c => c.wallpaper?.material === material),
  comodoNomeado: (e, nome: string) => lista(e.doc.rooms).some(c => c.name.trim().toLowerCase() === nome.toLowerCase()),
  aberturas: (e, tipo: string, n: number) => lista(e.doc.openings).filter(a => !tipo || a.kind === tipo).length >= n,
  objetos: (e, n: number) => lista(e.doc.props).length >= n,
  objetoDe: (e, receita: string) => lista(e.doc.props).some(o => o.source.kind === 'recipe' ? o.source.recipe === receita : o.source.assetId === receita),
  luzes: (e, n: number) => lista(e.doc.lights).length >= n,
  luzComPreset: (e, p: string) => lista(e.doc.lights).some(l => l.preset === p),
  pecas: (e, n: number) => lista(e.doc.tokens).length >= n,
  pecasDeJogador: (e, n: number) => lista(e.doc.tokens).filter(t => t.player).length >= n,
  portaAberta: (e, n = 1) => lista(e.doc.openings).filter(a => a.state === 'open').length >= n,
  reveladas: (e, n: number) => e.doc.session.revealed.length >= n,
  climaE: (e, preset: string) => e.doc.climate.preset === preset,
  estilo: (e, r: string) => e.doc.style.renderer === r,
  terrenoBase: (e, material: string) => e.doc.terrain.base === material,
  terrenoCom: (e, material: string, n = 1) => lista(e.doc.terrain.layers).filter(c => c.material === material).length >= n,
  presencas: (e, n: number) => lista(e.doc.presence).length >= n,
  presencaPintada: (e, pincel?: string) => lista(e.doc.presence).some(p => !pincel || p.brush === pincel),
  climaSalvo: (e, n = 1) => Object.keys(e.doc.customClimates).length >= (typeof n === 'number' ? n : 1),
  regioes: (e, n: number) => lista(e.doc.regions).length >= n,
  regiaoOcupada: (e, kind?: string) => regioesOcupadas(e.doc, kind as never).length > 0,
  comodoComLeitura: e => Object.values(e.doc.comodosExtra).some(extra => typeof extra.leitura === 'string' && extra.leitura.trim().length > 0),
  /** Um valor do documento num caminho (`lights.*.radius`), igual ao desejado (números a ~2%). */
  valor: (e, caminho: string, desejado: unknown) => valoresEm(e.doc, caminho).some(v => igual(v, desejado)),
  /** Uma cor do documento num caminho, do mesmo tipo da desejada. */
  cor: (e, caminho: string, desejada: string) => valoresEm(e.doc, caminho).some(v => corProxima(v, desejada)),
  /** O que o passo pede, desfeito (há o que refazer) ou refeito (não há mais). */
};

/** Confere uma condição; uma condição que não existe nunca é atendida (e a lição de teste acusa). */
export function atendida(feito: Condicao | undefined, estado: EstadoDoTutor): boolean {
  if (!feito) return false;
  const f = CONDICOES[feito[0]]; if (!f) return false;
  return (f as (e: EstadoDoTutor, ...a: unknown[]) => boolean)(estado, ...feito.slice(1));
}

/** "Quase lá": quanto falta para um passo de valor numérico (o mais perto entre os candidatos). `null` para o que não se mede em graus. */
export function medir(feito: Condicao | undefined, estado: EstadoDoTutor): { texto: string; falta: number } | null {
  if (!feito || feito[0] !== 'valor' || typeof feito[2] !== 'number') return null;
  const numeros = valoresEm(estado.doc, String(feito[1])).filter((v): v is number => typeof v === 'number'); if (!numeros.length) return null;
  const alvo = feito[2], perto = numeros.reduce((a, b) => (Math.abs(b - alvo) < Math.abs(a - alvo) ? b : a)), falta = Math.abs(perto - alvo);
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  return { texto: falta <= Math.max(0.011, Math.abs(alvo) * 0.02) ? 'Pronto' : `Agora ${fmt(perto)}, falta chegar a ${fmt(alvo)}`, falta };
}
