import { ACERVO } from '../procedural/acervo.ts';
import { generoDe } from '../domain/presets.ts';

/**
 * Que móveis um cômodo costuma ter, onde ficam e quantos, por função. Dados puros: o gerador de layout (layout.ts) é que posiciona.
 * Só receitas que existem. O gênero muda sobretudo o que é trocado ou tirado; com poucas receitas, a variedade maior vem com o acervo da Fase 6.
 */
/** `sobre`: em cima do móvel âncora (`junto.de`), com `elevation: 'table'`: enfeites de mesa. */
export type Lugar = 'parede' | 'canto' | 'centro' | 'junto' | 'na-parede' | 'sobre';

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
  /** Para 'junto' e 'sobre': ao redor de que item (id da regra) e como (o modo só vale para 'junto'). */
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
    item('tapete', ['tapete.liso', 'tapete.persa', 'casa:tapete-persa-p-vinho', 'casa:tapete-persa-p-verde', 'casa:tapete-persa-p-creme', 'casa:tapete-oval-vinho', 'casa:tapete-oval-verde', 'casa:tapete-oval-creme'], 'centro', [1, 1], 5, { areaMinima: 10 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [1, 3], 6),
    item('espelho', ['espelho'], 'na-parede', [0, 1], 7),
    item('luminaria', ['luminaria.chao'], 'canto', [0, 1], 9),
    item('estante', ['estante'], 'na-parede', [0, 1], 8, { areaMinima: 14 }),
    item('arandela', ['arandela'], 'na-parede', [0, 2], 10),
    item('cortina', ['cortina.janela'], 'na-parede', [0, 1], 10.5, { areaMinima: 10 }),
    item('enfeite-mesinha', ['abajur.mesa', 'relogio.mesa', 'vaso.flores', 'livro.aberto', 'notebook'], 'sobre', [1, 2], 11, { junto: { de: 'mesinha', modo: 'ao-lado' } }),
    item('cesto', ['cesto.roupa'], 'canto', [0, 1], 12),
    item('sapatos', ['sapatos'], 'parede', [0, 1], 13),
  ],
  sala: [
    item('lareira', ['lareira.marmore'], 'parede', [1, 1], 1, { alto: true, areaMinima: 12 }),
    item('sofa', ['sofa', 'casa:chesterfield-vinho', 'casa:chesterfield-verde', 'casa:chesterfield-couro'], 'parede', [1, 1], 2, { areaMinima: 9 }),
    item('poltrona', ['poltrona', 'casa:poltrona-capitone-vinho', 'casa:poltrona-capitone-verde', 'casa:poltrona-capitone-couro'], 'junto', [1, 2], 3, { areaMinima: 12, junto: { de: 'sofa', modo: 'em-frente' } }),
    item('mesinha', ['mesinha'], 'junto', [1, 1], 4, { junto: { de: 'sofa', modo: 'ao-lado' } }),
    item('tapete', ['tapete.persa', 'tapete.liso', 'casa:tapete-persa-p-vinho', 'casa:tapete-persa-p-verde', 'casa:tapete-persa-p-creme', 'casa:tapete-oval-vinho', 'casa:tapete-oval-verde', 'casa:tapete-oval-creme', 'casa:tapete-persa-g-vinho', 'casa:tapete-persa-g-verde', 'casa:tapete-persa-g-creme'], 'centro', [1, 1], 5, { areaMinima: 9 }),
    item('aparador', ['aparador', 'estante.piso'], 'parede', [1, 1], 6, { alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [1, 2], 7),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [2, 4], 8),
    item('espelho', ['espelho', 'espelho.grande'], 'na-parede', [0, 1], 8.5),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 8.6),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 8.7),
    item('cortina', ['cortina.janela'], 'na-parede', [0, 1], 8.8, { areaMinima: 12 }),
    item('prateleira-flutuante', ['prateleira.flutuante'], 'na-parede', [0, 1], 8.9),
    item('poltrona-lareira', ['poltrona'], 'junto', [1, 2], 9, { junto: { de: 'lareira', modo: 'em-frente' } }),
    item('piano', ['piano.cauda'], 'parede', [0, 1], 10, { areaMinima: 20 }),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 11),
    item('tv', ['rack.tv'], 'parede', [0, 1], 12, { alto: true }),
    item('luminaria', ['luminaria.chao'], 'canto', [0, 1], 13),
    item('enfeite-mesinha', ['vaso.flores', 'castical.mesa', 'abajur.mesa', 'relogio.mesa', 'bule.xicaras'], 'sobre', [1, 2], 14, { junto: { de: 'mesinha', modo: 'ao-lado' } }),
    item('enfeite-aparador', ['castical.mesa', 'vaso.flores', 'relogio.mesa', 'garrafa.tacas', 'tabuleiro.xadrez'], 'sobre', [1, 2], 15, { junto: { de: 'aparador', modo: 'ao-lado' } }),
  ],
  cozinha: [
    item('balcao', ['balcao'], 'parede', [1, 2], 1, { params: { largura: 2.6 } }),
    item('mesa', ['mesa.retangular', 'mesa.redonda'], 'centro', [1, 1], 2, { areaMinima: 9 }),
    item('cadeira', ['cadeira'], 'junto', [2, 4], 3, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('aparador', ['aparador'], 'parede', [0, 1], 4, { areaMinima: 12, alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 5),
    item('lareira', ['lareira.pedra'], 'parede', [1, 1], 1, { alto: true, areaMinima: 8 }),
    item('geladeira', ['geladeira'], 'parede', [1, 1], 6, { alto: true }),
    item('fogao', ['fogao'], 'parede', [1, 1], 7, { alto: true }),
    item('prateleira', ['prateleira.parede'], 'na-parede', [1, 2], 9),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 9.5),
    item('painel', ['painel.azulejo'], 'na-parede', [0, 1], 9.6),
    item('servico', ['fruteira', 'bule.xicaras', 'pratos.servico', 'garrafa.tacas'], 'sobre', [1, 3], 10, { junto: { de: 'mesa', modo: 'ao-redor' } }),
  ],
  biblioteca: [
    item('estante', ['estante'], 'na-parede', [2, 3], 1),
    item('estante-baixa', ['estante.piso'], 'parede', [1, 2], 2, { alto: true }),
    item('poltrona', ['poltrona', 'casa:poltrona-capitone-vinho', 'casa:poltrona-capitone-verde', 'casa:poltrona-capitone-couro'], 'canto', [1, 2], 3, { areaMinima: 10 }),
    item('mesa', ['mesa.redonda'], 'centro', [0, 1], 4, { areaMinima: 14 }),
    item('livros', ['livros.pilha'], 'canto', [1, 2], 5),
    item('escrivaninha', ['escrivaninha', 'escrivaninha.verde'], 'parede', [0, 1], 6, { areaMinima: 12 }),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 7),
    item('mapa', ['mapa.mundi'], 'na-parede', [0, 1], 8),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 8.5),
    item('prateleira', ['prateleira.parede'], 'na-parede', [0, 2], 9),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [0, 2], 9.5),
    item('enfeite-mesa', ['livro.aberto', 'abajur.mesa', 'tabuleiro.xadrez', 'tinteiro.pena'], 'sobre', [1, 2], 10, { junto: { de: 'escrivaninha', modo: 'ao-lado' } }),
  ],
  escritorio: [
    item('escrivaninha', ['escrivaninha', 'escrivaninha.verde'], 'parede', [1, 1], 1),
    item('cadeira', ['cadeira'], 'junto', [1, 1], 2, { junto: { de: 'escrivaninha', modo: 'em-frente', folga: 0.1 } }),
    item('estante', ['estante'], 'na-parede', [1, 2], 3),
    item('poltrona', ['poltrona'], 'canto', [0, 1], 4, { areaMinima: 10 }),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [1, 2], 5),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 6),
    item('mapa', ['mapa.mundi'], 'na-parede', [0, 1], 7),
    item('arandela', ['arandela'], 'na-parede', [0, 1], 8),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 8.5),
    item('globo', ['globo.terrestre'], 'canto', [0, 1], 9),
    item('enfeite-mesa', ['tinteiro.pena', 'abajur.mesa', 'livro.aberto', 'telefone.antigo', 'papeis', 'notebook'], 'sobre', [2, 3], 10, { junto: { de: 'escrivaninha', modo: 'ao-lado' } }),
    item('jornais', ['jornais'], 'parede', [0, 1], 11),
  ],
  banheiro: [
    item('banheira', ['banheira.pes'], 'parede', [1, 1], 1, { areaMinima: 6 }),
    item('vaso', ['vaso.sanitario'], 'parede', [1, 1], 2),
    item('pia', ['pia.pedestal'], 'parede', [1, 1], 3),
    item('espelho', ['espelho'], 'na-parede', [1, 1], 4),
    item('box', ['box.banheiro'], 'parede', [1, 1], 5, { areaMinima: 4 }),
    item('painel', ['painel.azulejo'], 'na-parede', [0, 1], 6),
    item('prateleira', ['prateleira.parede'], 'na-parede', [0, 1], 7),
    item('cesto', ['cesto.roupa'], 'canto', [0, 1], 8),
    item('espelho-grande', ['espelho.grande'], 'na-parede', [0, 1], 9),
  ],
  corredor: [
    item('aparador', ['aparador'], 'parede', [0, 2], 1, { alto: true }),
    item('vaso', ['vaso.planta'], 'canto', [0, 2], 2),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [2, 5], 3),
    item('cabideiro', ['cabideiro'], 'canto', [0, 1], 5),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 6),
    item('passadeira', ['casa:passadeira-vinho', 'casa:passadeira-verde', 'casa:passadeira-creme'], 'centro', [1, 1], 4, { areaMinima: 6 }),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 3.5),
    item('espelho', ['espelho', 'espelho.grande'], 'na-parede', [0, 1], 3.6),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 3.7),
    item('enfeite-aparador', ['vaso.flores', 'castical.mesa', 'relogio.mesa', 'telefone.antigo'], 'sobre', [1, 2], 7, { junto: { de: 'aparador', modo: 'ao-lado' } }),
  ],
  'sala-de-jantar': [
    item('mesa', ['mesa.oval'], 'centro', [1, 1], 1, { areaMinima: 10 }),
    item('cadeira', ['cadeira'], 'junto', [4, 6], 2, { junto: { de: 'mesa', modo: 'ao-redor' } }),
    item('cristaleira', ['cristaleira'], 'parede', [1, 1], 3, { alto: true }),
    item('aparador', ['aparador'], 'parede', [0, 1], 4, { alto: true }),
    item('lareira', ['lareira.marmore'], 'parede', [0, 1], 5, { alto: true, areaMinima: 16 }),
    item('vaso', ['vaso.planta'], 'canto', [0, 1], 6),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [2, 3], 7),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 7.5),
    item('cortina', ['cortina.janela'], 'na-parede', [0, 1], 7.6, { areaMinima: 10 }),
    item('relogio-parede', ['relogio.parede'], 'na-parede', [0, 1], 7.7),
    item('servico', ['bule.xicaras', 'candelabro', 'castical.mesa', 'fruteira', 'garrafa.tacas', 'pratos.servico'], 'sobre', [2, 4], 8, { junto: { de: 'mesa', modo: 'ao-redor' } }),
  ],
  'sala-de-jogos': [
    item('bilhar', ['mesa.bilhar'], 'centro', [1, 1], 1, { areaMinima: 14 }),
    item('poltrona', ['poltrona'], 'canto', [1, 2], 2, { areaMinima: 10 }),
    item('aparador', ['aparador'], 'parede', [1, 1], 3, { alto: true }),
    item('banco', ['banco'], 'parede', [0, 2], 4),
    item('quadro', ['quadro', 'retrato.oval', 'paisagem.grande', 'quadros.grupo', 'mapa.mundi', 'quadro.abstrato'], 'na-parede', [1, 3], 5),
    item('relogio', ['relogio.pe'], 'canto', [0, 1], 6),
    item('trofeu', ['trofeu.cervo'], 'na-parede', [0, 1], 7),
    item('arandela', ['arandela'], 'na-parede', [1, 2], 7.5),
    item('enfeite-aparador', ['garrafa.tacas', 'tabuleiro.xadrez', 'castical.mesa'], 'sobre', [1, 2], 8, { junto: { de: 'aparador', modo: 'ao-lado' } }),
  ],
  capela: [
    item('altar', ['altar'], 'parede', [1, 1], 1, { alto: true }),
    item('banco', ['banco.igreja'], 'centro', [2, 4], 2, { areaMinima: 12 }),
    item('banco-lateral', ['banco.longo'], 'parede', [0, 2], 3),
    item('tapecaria', ['tapecaria'], 'na-parede', [1, 2], 4),
    item('bau', ['bau'], 'canto', [0, 1], 5),
    item('arandela', ['arandela'], 'na-parede', [2, 4], 6),
    item('brasao', ['brasao'], 'na-parede', [0, 1], 7),
    item('altar-velas', ['candelabro', 'castical.mesa'], 'sobre', [1, 2], 8, { junto: { de: 'altar', modo: 'ao-lado' } }),
  ],
  forja: [
    item('bigorna', ['bigorna'], 'centro', [1, 1], 1, { areaMinima: 8 }),
    item('lareira', ['lareira.pedra'], 'parede', [1, 1], 2, { alto: true }),
    item('barril', ['barril.em-pe', 'barril.deitado'], 'canto', [1, 3], 3),
    item('prateleira', ['prateleira.pocoes'], 'parede', [0, 1], 4, { alto: true }),
    item('bau', ['bau'], 'parede', [0, 1], 5),
  ],
  varanda: [
    item('escada', ['escada.externa'], 'parede', [1, 1], 1, { areaMinima: 8 }),
    item('urna', ['urna.pedestal'], 'canto', [2, 4], 1.5),
    item('pilar', ['pilar'], 'canto', [0, 4], 1.6, { areaMinima: 12 }),
    item('balaustrada', ['balaustrada'], 'parede', [3, 6], 2),
    item('banco', ['banco.jardim'], 'parede', [0, 2], 5),
    item('fonte', ['fonte'], 'centro', [0, 1], 6, { areaMinima: 30 }),
    item('estatua', ['estatua'], 'canto', [0, 2], 7, { areaMinima: 14 }),
    item('vaso', ['vaso.planta'], 'canto', [0, 2], 8),
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
    item('barril', ['barril.em-pe', 'barril.deitado'], 'canto', [1, 3], 5),
    item('lareira', ['lareira.pedra'], 'parede', [0, 1], 6, { alto: true, areaMinima: 14 }),
    item('trofeu', ['trofeu.cervo'], 'na-parede', [0, 1], 7),
    item('tapecaria', ['tapecaria'], 'na-parede', [0, 2], 7.5),
    item('espadas', ['espadas.cruzadas'], 'na-parede', [0, 1], 7.6),
    item('brasao', ['brasao'], 'na-parede', [0, 1], 7.7),
    item('arandela', ['arandela'], 'na-parede', [1, 3], 7.8),
    item('servico', ['garrafa.tacas', 'castical.mesa', 'pratos.servico', 'candelabro'], 'sobre', [2, 4], 8, { junto: { de: 'mesa', modo: 'ao-redor' } }),
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
  moderno: {
    sem: ['quarto:estante'],
    trocar: {
      'sala:sofa': ['sofa.canto'], 'quarto:cama': ['cama.box'], 'quarto:cama.casal': ['cama.box'], 'quarto:armario': ['guarda-roupa.liso'], 'banheiro:vaso': ['vaso.moderno'], 'banheiro:pia': ['balcao'],
      'escritorio:escrivaninha': ['escrivaninha.computador'], 'sala-de-jantar:mesa': ['mesa.vidro'], 'cozinha:mesa': ['mesa.vidro'],
    },
  },
  fantasia: {
    sem: ['cozinha:balcao'],
    trocar: {
      'taverna:cadeira': ['banco'], 'cozinha:cadeira': ['banco'], 'sala:sofa': ['banco'], 'taverna:mesa': ['mesa.taverna'], 'taverna:banco': ['banco.longo'], 'cozinha:mesa': ['mesa.taverna'],
      'quarto:cama': ['catre'], 'quarto:cama.casal': ['catre'], 'quarto:armario': ['bau'], 'quarto:comoda': ['bau'], 'porao:caixote-canto': ['barril.em-pe'], 'porao:caixote-parede': ['barril.deitado', 'caixa'], 'sala:lareira': ['lareira.pedra'],
    },
  },
};

/** As regras de uma função para um gênero (id desconhecido vale como `investigacao`). Uma função sem regra devolve lista vazia. */
export function regrasPara(funcao: string, genero: string): ItemDeRegra[] {
  const base = REGRAS_DE_MOBILIA[funcao] ?? [], v = VARIACOES_DE_GENERO[genero] ?? {}, id = generoDe(genero).id;
  // Itens do acervo que servem só a certos gêneros (`generos` não vazio) saem das alternativas dos outros.
  const serve = (r: string) => { const g = ACERVO.item(r)?.generos ?? []; return !g.length || g.includes(id); };
  const tirados = new Set((v.sem ?? []).filter(k => k.startsWith(`${funcao}:`)).map(k => k.slice(funcao.length + 1)));
  // Quem dependia de um item tirado sai junto, em cascata.
  let mudou = true; while (mudou) { mudou = false; for (const r of base) if (!tirados.has(r.id) && r.junto && tirados.has(r.junto.de)) { tirados.add(r.id); mudou = true; } }
  const lista = base.filter(r => !tirados.has(r.id)).map(r => {
    const troca = v.trocar?.[`${funcao}:${r.id}`] ?? null;
    const porReceita = (alternativas: string[]) => alternativas.flatMap(x => v.trocar?.[`${funcao}:${x}`] ?? [x]);
    const receitas = (troca ?? porReceita(r.receitas)).filter(serve);
    return { ...r, receitas: [...new Set(receitas)], ...(r.porArea ? { porArea: r.porArea.map(([a, rec]) => [a, (v.trocar?.[`${funcao}:${rec}`] ?? [rec])[0]!] as [number, string]) } : {}) };
  }).filter(r => r.receitas.length > 0);
  // Quem depende de um item que ficou sem nenhuma alternativa para este gênero sai também (em cascata).
  let restantes = lista;
  for (let mudou = true; mudou;) { const ids = new Set(restantes.map(r => r.id)), antes = restantes.length; restantes = restantes.filter(r => !r.junto || ids.has(r.junto.de)); mudou = restantes.length !== antes; }
  return restantes.sort((a, b) => a.prioridade - b.prioridade);
}
