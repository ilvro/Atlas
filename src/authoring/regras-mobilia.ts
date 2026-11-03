/**
 * Que móveis um cômodo costuma ter, onde ficam e quantos, por função. Dados puros: o gerador de layout (layout.ts) é que posiciona.
 * Só receitas que existem. O gênero muda sobretudo o que é trocado ou tirado; com poucas receitas, a variedade maior vem com o acervo da Fase 6.
 */
export type Lugar = 'parede' | 'canto' | 'centro' | 'junto' | 'na-parede';

export interface ItemDeRegra {
  id: string;
  /** Alternativas; o gerador sorteia pela semente. */
  receitas: string[];
  lugar: Lugar;
  quantos: [min: number, max: number];
  /** Abaixo disso (m²), o item não entra. */
  areaMinima?: number;
  /** A partir de qual área (m²) cada receita passa a valer no lugar do sorteio: a última que cabe vence. */
  porArea?: [areaMinima: number, receita: string][];
  /** Os menores números entram primeiro. */
  prioridade: number;
  /** Para 'junto': ao redor de que item (id da regra) e como. */
  junto?: { de: string; modo: 'ao-redor' | 'ao-lado' | 'em-frente'; /** Para 'em-frente': a distância (m) entre a âncora e o móvel; padrão 1,2. */ folga?: number };
  /** Não fica na frente de janela. */
  alto?: boolean;
  params?: Record<string, unknown>;
}

const item = (id: string, receitas: string[], lugar: Lugar, quantos: [number, number], prioridade: number, extra: Partial<ItemDeRegra> = {}): ItemDeRegra => ({ id, receitas, lugar, quantos, prioridade, ...extra });

export const REGRAS_DE_MOBILIA: Readonly<Record<string, ItemDeRegra[]>> = {
  quarto: [
    item('cama', ['cama.solteiro'], 'parede', [1, 1], 1, { porArea: [[12, 'cama.casal']] }),
    item('mesinha', ['mesinha'], 'junto', [1, 2], 2, { junto: { de: 'cama', modo: 'ao-lado' } }),
    item('armario', ['armario'], 'parede', [1, 1], 3, { alto: true, areaMinima: 8 }),
    item('comoda', ['comoda'], 'parede', [0, 1], 4, { areaMinima: 10 }),
    item('tapete', ['tapete.liso', 'tapete.persa'], 'centro', [1, 1], 5, { areaMinima: 10 }),
    item('quadro', ['quadro'], 'na-parede', [1, 2], 6),
    item('espelho', ['espelho'], 'na-parede', [0, 1], 7),
    item('estante', ['estante'], 'na-parede', [0, 1], 8, { areaMinima: 14 }),
  ],
  sala: [
    item('sofa', ['sofa'], 'parede', [1, 1], 1, { areaMinima: 9 }),
    item('poltrona', ['poltrona'], 'junto', [1, 2], 2, { areaMinima: 12, junto: { de: 'sofa', modo: 'em-frente' } }),
    item('mesinha', ['mesinha'], 'junto', [1, 1], 3, { junto: { de: 'sofa', modo: 'ao-lado' } }),
    item('tapete', ['tapete.persa', 'tapete.liso'], 'centro', [1, 1], 4, { areaMinima: 9 }),
    item('aparador', ['aparador', 'estante.piso'], 'parede', [1, 1], 5, { alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [1, 2], 6),
    item('quadro', ['quadro'], 'na-parede', [1, 2], 7),
  ],
  cozinha: [
    item('balcao', ['balcao'], 'parede', [1, 2], 1, { params: { largura: 2.6 } }),
    item('mesa', ['mesa.retangular', 'mesa.redonda'], 'centro', [1, 1], 2, { areaMinima: 9 }),
    item('cadeira', ['cadeira'], 'junto', [2, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('aparador', ['aparador'], 'parede', [0, 1], 4, { areaMinima: 12, alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 5),
  ],
  biblioteca: [
    item('estante', ['estante'], 'na-parede', [2, 3], 1),
    item('estante-baixa', ['estante.piso'], 'parede', [1, 2], 2, { alto: true }),
    item('poltrona', ['poltrona'], 'canto', [1, 2], 3, { areaMinima: 10 }),
    item('mesa', ['mesa.redonda'], 'centro', [0, 1], 4, { areaMinima: 14 }),
    item('livros', ['livros.pilha'], 'canto', [1, 2], 5),
  ],
  escritorio: [
    item('escrivaninha', ['escrivaninha'], 'parede', [1, 1], 1),
    item('cadeira', ['cadeira'], 'junto', [1, 1], 2, { junto: { de: 'escrivaninha', modo: 'em-frente', folga: 0.1 } }),
    item('estante', ['estante'], 'na-parede', [1, 2], 3),
    item('poltrona', ['poltrona'], 'canto', [0, 1], 4, { areaMinima: 10 }),
    item('quadro', ['quadro'], 'na-parede', [0, 1], 5),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 6),
  ],
  banheiro: [
    item('balcao', ['balcao'], 'parede', [1, 1], 1, { params: { largura: 1.2 } }),
    item('espelho', ['espelho'], 'na-parede', [1, 1], 2),
  ],
  corredor: [
    item('aparador', ['aparador'], 'parede', [0, 2], 1, { alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [0, 2], 2),
    item('quadro', ['quadro'], 'na-parede', [1, 3], 3),
  ],
  hospital: [
    item('cama', ['cama.solteiro'], 'parede', [2, 4], 1),
    item('mesinha', ['mesinha'], 'junto', [1, 3], 2, { junto: { de: 'cama', modo: 'ao-lado' } }),
    item('balcao', ['balcao'], 'parede', [0, 1], 3, { areaMinima: 10 }),
    item('cadeira', ['cadeira'], 'canto', [0, 1], 4),
  ],
  taverna: [
    item('balcao', ['balcao'], 'parede', [1, 1], 1, { areaMinima: 12, params: { largura: 3 } }),
    item('mesa', ['mesa.redonda'], 'centro', [1, 3], 2),
    item('cadeira', ['cadeira'], 'junto', [3, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('banco', ['banco'], 'parede', [0, 2], 4),
  ],
  porao: [
    item('caixote-canto', ['caixa'], 'canto', [2, 4], 1),
    item('caixote-parede', ['caixa'], 'parede', [2, 5], 2),
  ],
};

/**
 * Como o gênero muda as regras: `trocar` e `sem` usam chaves `funcao:chave`. Em `trocar`, a chave é um item ou uma receita
 * (as receitas do item, ou a receita citada, passam a ser as dadas); `sem` tira o item (e o que dependia dele). `investigacao` não muda nada.
 */
export const VARIACOES_DE_GENERO: Readonly<Record<string, { trocar?: Record<string, string[]>; sem?: string[] }>> = {
  investigacao: {},
  moderno: { sem: ['quarto:estante'] },
  fantasia: { trocar: { 'taverna:cadeira': ['banco'], 'cozinha:cadeira': ['banco'], 'sala:sofa': ['banco'] } },
};

/** As regras de uma função para um gênero (id desconhecido vale como `investigacao`). Uma função sem regra devolve lista vazia. */
export function regrasPara(funcao: string, genero: string): ItemDeRegra[] {
  const base = REGRAS_DE_MOBILIA[funcao] ?? [], v = VARIACOES_DE_GENERO[genero] ?? {};
  const tirados = new Set((v.sem ?? []).filter(k => k.startsWith(`${funcao}:`)).map(k => k.slice(funcao.length + 1)));
  // Quem dependia de um item tirado sai junto, em cascata.
  let mudou = true; while (mudou) { mudou = false; for (const r of base) if (!tirados.has(r.id) && r.junto && tirados.has(r.junto.de)) { tirados.add(r.id); mudou = true; } }
  return base.filter(r => !tirados.has(r.id)).map(r => {
    const troca = v.trocar?.[`${funcao}:${r.id}`] ?? null;
    const porReceita = (lista: string[]) => lista.flatMap(x => v.trocar?.[`${funcao}:${x}`] ?? [x]);
    const receitas = troca ?? porReceita(r.receitas);
    return { ...r, receitas: [...new Set(receitas)], ...(r.porArea ? { porArea: r.porArea.map(([a, rec]) => [a, (v.trocar?.[`${funcao}:${rec}`] ?? [rec])[0]!] as [number, string]) } : {}) };
  }).sort((a, b) => a.prioridade - b.prioridade);
}
