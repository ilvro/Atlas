import { novoIdEntidade } from '../domain/fabrica.ts';
import { GENEROS, TIPOS_DE_COMODO, generoDe } from '../domain/presets.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { gerarLayout } from './layout.ts';
import { novaProposta, type Proposta } from './proposta.ts';
import { regrasPara } from './regras-mobilia.ts';
import type { Contexto } from './sugestoes.ts';

export interface MateriaisDoComodo { pisos: string[]; papeis: string[] }
export interface Paleta { nome: string; madeira: string; /** O segundo é sempre o linho (toalhas). */ tecidos: string[]; tapete: string }

const SEM_PAR = (funcao: string): MateriaisDoComodo => {
  const t = TIPOS_DE_COMODO.find(x => x.funcao === funcao);
  return { pisos: t ? [t.piso] : ['tabuas.carvalho'], papeis: t ? [t.papel] : ['papel.liso-claro'] };
};

/** Pisos e papéis por gênero e função; para a investigação, o par atual de `TIPOS_DE_COMODO` vem primeiro (é o que a pílula de função já pôs). */
const MATERIAIS_BASE: Readonly<Record<string, Record<string, MateriaisDoComodo>>> = {
  investigacao: Object.fromEntries(TIPOS_DE_COMODO.map(t => {
    const extra: Record<string, MateriaisDoComodo> = {
      sala: { pisos: ['tabuas.escuras', 'parquet.espinha', 'marmore.xadrez-diagonal'], papeis: ['papel.listras-musgo', 'papel.verde-esmeralda', 'boiserie.escura'] }, cozinha: { pisos: ['azulejo.branco', 'hexagono.salvia', 'hexagono.terracota'], papeis: ['reboco.branco', 'papel.floral-azul'] },
      quarto: { pisos: ['tabuas.carvalho', 'parquet.espinha'], papeis: ['papel.damasco-vinho', 'papel.floral-rosa', 'papel.floral-azul'] }, biblioteca: { pisos: ['tabuas.escuras', 'parquet.espinha'], papeis: ['papel.damasco-vinho', 'boiserie.escura', 'boiserie.verde'] },
      escritorio: { pisos: ['tabuas.carvalho', 'parquet.espinha'], papeis: ['papel.listras-musgo', 'boiserie.escura', 'papel.bordo-listras'] }, banheiro: { pisos: ['ladrilho.cozinha', 'marmore.branco', 'hexagono.salvia'], papeis: ['papel.liso-claro', 'papel.floral-azul'] },
      corredor: { pisos: ['tabuas.escuras', 'marmore.xadrez-diagonal'], papeis: ['papel.damasco-azul', 'papel.azul-listras'] }, 'sala-de-jantar': { pisos: ['tabuas.carvalho', 'marmore.xadrez-diagonal', 'parquet.espinha'], papeis: ['papel.listras-musgo', 'papel.bordo-listras', 'boiserie.verde'] }, 'sala-de-jogos': { pisos: ['tabuas.escuras', 'parquet.espinha'], papeis: ['papel.damasco-vinho', 'boiserie.verde'] }, capela: { pisos: ['laje.pedra', 'marmore.branco'], papeis: ['reboco.branco'] }, forja: { pisos: ['laje.pedra'], papeis: ['tijolo'] }, varanda: { pisos: ['laje.pedra', 'marmore.branco', 'hexagono.terracota'], papeis: ['reboco.branco', 'tijolo'] }, hospital: { pisos: ['azulejo.branco'], papeis: ['papel.liso-claro'] }, taverna: { pisos: ['tabuas.carvalho'], papeis: ['tijolo'] }, porao: { pisos: ['concreto'], papeis: ['tijolo'] },
      estabulo: { pisos: ['terra.batida', 'palha.chao', 'tabuas.rusticas'], papeis: ['toras', 'reboco.sujo'] },
      celeiro: { pisos: ['palha.chao', 'terra.batida', 'tabuas.rusticas'], papeis: ['toras', 'reboco.sujo'] },
      deposito: { pisos: ['tabuas.rusticas', 'laje.pedra'], papeis: ['reboco.sujo', 'papel.liso-escuro'] },
      loja: { pisos: ['parquet.espinha', 'tabuas.escuras'], papeis: ['papel.listras-creme', 'boiserie.escura'] },
      oficina: { pisos: ['tabuas.rusticas', 'concreto'], papeis: ['reboco.sujo', 'pedra.aparelhada'] },
      cela: { pisos: ['pedra.rustica', 'concreto'], papeis: ['pedra.aparelhada', 'reboco.sujo'] },
      dormitorio: { pisos: ['tabuas.rusticas', 'tabuas.carvalho'], papeis: ['papel.liso-claro', 'reboco.sujo'] },
      refeitorio: { pisos: ['tabuas.rusticas', 'laje.pedra'], papeis: ['reboco.branco', 'pedra.aparelhada'] },
      salao: { pisos: ['parquet.espinha', 'marmore.xadrez-diagonal'], papeis: ['papel.damasco-vinho', 'boiserie.verde'] },
      patio: { pisos: ['pedra.rustica', 'marmore.branco'], papeis: ['tijolo', 'pedra.aparelhada'] },
      atrio: { pisos: ['marmore.xadrez-diagonal', 'marmore.branco'], papeis: ['papel.damasco-vinho', 'reboco.branco'] },
      peristilo: { pisos: ['pedra.rustica', 'marmore.branco'], papeis: ['reboco.branco', 'pedra.aparelhada'] },
      triclinio: { pisos: ['tabuas.carvalho', 'marmore.xadrez-diagonal'], papeis: ['papel.damasco-vinho', 'boiserie.verde'] },
      termas: { pisos: ['marmore.branco', 'azulejo.branco'], papeis: ['reboco.branco', 'pedra.aparelhada'] },
      templo: { pisos: ['marmore.branco', 'laje.pedra'], papeis: ['reboco.branco', 'pedra.aparelhada'] },
      forum: { pisos: ['laje.pedra', 'pedra.rustica'], papeis: ['tijolo', 'pedra.aparelhada'] },
      taberna: { pisos: ['tabuas.escuras', 'tabuas.rusticas'], papeis: ['tijolo', 'reboco.sujo'] },
      'sala-de-tatami': { pisos: ['tabuas.claras', 'tabuas.carvalho'], papeis: ['reboco.branco', 'papel.liso-claro'] },
      'casa-de-cha': { pisos: ['tabuas.claras', 'tabuas.carvalho'], papeis: ['reboco.branco', 'papel.liso-claro'] },
      dojo: { pisos: ['tabuas.carvalho', 'tabuas.escuras'], papeis: ['reboco.branco', 'papel.liso-claro'] },
      santuario: { pisos: ['laje.pedra', 'marmore.branco'], papeis: ['reboco.branco', 'pedra.aparelhada'] },
      jardim: { pisos: ['laje.pedra', 'pedra.rustica'], papeis: ['pedra.aparelhada', 'reboco.branco'] },
      tenda: { pisos: ['palha.chao', 'tabuas.rusticas'], papeis: ['reboco.sujo', 'toras'] },
      'patio-com-fonte': { pisos: ['laje.pedra', 'pedra.rustica'], papeis: ['reboco.branco', 'pedra.aparelhada'] },
      bazar: { pisos: ['terracota.quadrada', 'tabuas.rusticas'], papeis: ['reboco.sujo', 'tijolo'] },
      'salao-de-cha': { pisos: ['tabuas.escuras', 'laje.pedra'], papeis: ['reboco.branco', 'reboco.sujo'] },
    };
    const e = extra[t.funcao]!; return [t.funcao, { pisos: [t.piso, ...e.pisos], papeis: [t.papel, ...e.papeis] }];
  })),
  moderno: Object.fromEntries(TIPOS_DE_COMODO.map(t => [t.funcao, t.funcao === 'cozinha' ? { pisos: ['ladrilho.cozinha', 'azulejo.branco', 'hexagono.salvia', 'concreto'], papeis: ['reboco.branco', 'papel.liso-claro'] } : t.funcao === 'banheiro' || t.funcao === 'hospital' ? { pisos: ['azulejo.branco', 'ladrilho.cozinha'], papeis: ['reboco.branco', 'papel.liso-claro'] }
    : t.funcao === 'porao' || t.funcao === 'deposito' || t.funcao === 'oficina' || t.funcao === 'cela' ? { pisos: ['concreto', 'concreto.placas', 'vinil.industrial', 'carpete.cinza'], papeis: ['reboco.branco', 'papel.liso-escuro', 'painel.metalico'] }
    : t.funcao === 'patio' ? { pisos: ['concreto.placas', 'laje.pedra'], papeis: ['reboco.branco', 'tijolo'] }
    : { pisos: ['tabuas.claras', 'carpete.cinza', 'concreto', 'tabuas.cinza'], papeis: ['papel.liso-claro', 'reboco.branco', 'papel.liso-escuro'] }])),
  fantasia: Object.fromEntries(TIPOS_DE_COMODO.map(t => [t.funcao, t.funcao === 'quarto' || t.funcao === 'biblioteca' || t.funcao === 'escritorio' ? { pisos: ['tabuas.escuras', 'tabuas.carvalho'], papeis: ['tijolo', 'papel.damasco-vinho'] }
    : t.funcao === 'estabulo' || t.funcao === 'celeiro' ? { pisos: ['palha.chao', 'terra.batida', 'tabuas.rusticas'], papeis: ['toras', 'tijolo'] }
    : t.funcao === 'cela' || t.funcao === 'forja' || t.funcao === 'patio' ? { pisos: ['pedra.rustica', 'laje.pedra'], papeis: ['pedra.aparelhada', 'tijolo'] }
    : { pisos: ['laje.pedra', 'tabuas.escuras', 'tabuas.rusticas'], papeis: ['tijolo', 'pedra.aparelhada', 'papel.liso-escuro'] }])),
};

/** Antiguidade: mosaico, terracota, estuque pompeiano e arenito (Q10) nos cômodos da época; o resto herda o par de pedra e madeira da fantasia. */
const ANTIGUIDADE_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  atrio: { pisos: ['mosaico.romano', 'mosaico.medalhao', 'lajes.arenito'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  peristilo: { pisos: ['lajes.arenito', 'mosaico.romano', 'laje.pedra'], papeis: ['alvenaria.arenito', 'estuque.pompeiano'] },
  triclinio: { pisos: ['mosaico.medalhao', 'mosaico.romano'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  termas: { pisos: ['mosaico.romano', 'marmore.branco', 'lajes.arenito'], papeis: ['alvenaria.arenito', 'estuque.pompeiano', 'reboco.branco'] },
  templo: { pisos: ['lajes.arenito', 'marmore.branco', 'mosaico.romano'], papeis: ['alvenaria.arenito', 'parede.hieroglifos', 'reboco.branco'] },
  forum: { pisos: ['lajes.arenito', 'laje.pedra', 'terra.batida'], papeis: ['alvenaria.arenito', 'estuque.pompeiano'] },
  taberna: { pisos: ['terracota.quadrada', 'lajes.arenito', 'terra.batida'], papeis: ['alvenaria.arenito', 'estuque.pompeiano'] },
  sala: { pisos: ['mosaico.romano', 'terracota.quadrada', 'lajes.arenito'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  quarto: { pisos: ['terracota.quadrada', 'mosaico.romano'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  cozinha: { pisos: ['terracota.quadrada', 'lajes.arenito'], papeis: ['alvenaria.arenito'] },
  biblioteca: { pisos: ['mosaico.romano', 'terracota.quadrada'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  escritorio: { pisos: ['terracota.quadrada', 'mosaico.romano'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  banheiro: { pisos: ['mosaico.romano', 'marmore.branco'], papeis: ['alvenaria.arenito', 'estuque.pompeiano'] },
  corredor: { pisos: ['terracota.quadrada', 'lajes.arenito'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  'sala-de-jantar': { pisos: ['mosaico.medalhao', 'mosaico.romano'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  salao: { pisos: ['mosaico.romano', 'lajes.arenito', 'marmore.branco'], papeis: ['estuque.pompeiano', 'alvenaria.arenito'] },
  capela: { pisos: ['lajes.arenito', 'marmore.branco'], papeis: ['alvenaria.arenito', 'parede.hieroglifos'] },
  varanda: { pisos: ['lajes.arenito', 'terracota.quadrada'], papeis: ['alvenaria.arenito'] },
  patio: { pisos: ['lajes.arenito', 'laje.pedra'], papeis: ['alvenaria.arenito'] },
  loja: { pisos: ['terracota.quadrada', 'lajes.arenito'], papeis: ['alvenaria.arenito', 'estuque.pompeiano'] },
  taverna: { pisos: ['terracota.quadrada', 'lajes.arenito'], papeis: ['alvenaria.arenito', 'estuque.pompeiano'] },
};

/** Oriental: tatami e tábuas laqueadas, shoji e madeira laqueada (Q10) nos cômodos da época; o resto herda a fantasia. */
const ORIENTAL_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  'sala-de-tatami': { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  'casa-de-cha': { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  dojo: { pisos: ['tabuas.claras', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  santuario: { pisos: ['tabuas.laqueadas', 'laje.pedra'], papeis: ['madeira.laqueada', 'shoji'] },
  jardim: { pisos: ['pedra.rustica', 'laje.pedra'], papeis: ['pedra.aparelhada'] },
  sala: { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  quarto: { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  cozinha: { pisos: ['tabuas.laqueadas', 'laje.pedra'], papeis: ['madeira.laqueada', 'shoji'] },
  biblioteca: { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  escritorio: { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  corredor: { pisos: ['tabuas.laqueadas', 'tabuas.claras'], papeis: ['shoji', 'madeira.laqueada'] },
  'sala-de-jantar': { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  salao: { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
  capela: { pisos: ['tabuas.laqueadas', 'laje.pedra'], papeis: ['madeira.laqueada', 'shoji'] },
  varanda: { pisos: ['tabuas.claras', 'laje.pedra'], papeis: ['madeira.laqueada'] },
  patio: { pisos: ['pedra.rustica', 'laje.pedra'], papeis: ['pedra.aparelhada'] },
  taverna: { pisos: ['tatami', 'tabuas.laqueadas'], papeis: ['shoji', 'madeira.laqueada'] },
};

/** Deserto: adobe, taipa, zellige, terracota e palha (Q7/Q10) nos cômodos da época; o resto herda a fantasia com adobe e reboco no lugar da pedra escura. */
const DESERTO_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  tenda: { pisos: ['palha.chao', 'terra.batida'], papeis: ['taipa', 'reboco.sujo'] },
  'patio-com-fonte': { pisos: ['zellige', 'terracota.quadrada', 'lajes.arenito'], papeis: ['adobe', 'reboco.branco'] },
  bazar: { pisos: ['terracota.quadrada', 'terra.batida'], papeis: ['adobe', 'taipa'] },
  'salao-de-cha': { pisos: ['zellige', 'terracota.quadrada'], papeis: ['reboco.branco', 'adobe'] },
  deposito: { pisos: ['terra.batida', 'terracota.quadrada'], papeis: ['taipa', 'adobe'] },
  sala: { pisos: ['zellige', 'terracota.quadrada'], papeis: ['reboco.branco', 'adobe'] },
  quarto: { pisos: ['terracota.quadrada', 'zellige'], papeis: ['reboco.branco', 'adobe'] },
  cozinha: { pisos: ['terracota.quadrada', 'hexagono.terracota'], papeis: ['adobe', 'reboco.sujo'] },
  biblioteca: { pisos: ['terracota.quadrada', 'zellige'], papeis: ['reboco.branco', 'adobe'] },
  escritorio: { pisos: ['terracota.quadrada', 'zellige'], papeis: ['reboco.branco', 'adobe'] },
  corredor: { pisos: ['terracota.quadrada', 'lajes.arenito'], papeis: ['adobe', 'reboco.branco'] },
  'sala-de-jantar': { pisos: ['zellige', 'terracota.quadrada'], papeis: ['reboco.branco', 'adobe'] },
  salao: { pisos: ['zellige', 'terracota.quadrada'], papeis: ['reboco.branco', 'adobe'] },
  varanda: { pisos: ['terracota.quadrada', 'lajes.arenito'], papeis: ['adobe', 'reboco.branco'] },
  patio: { pisos: ['lajes.arenito', 'terracota.quadrada'], papeis: ['adobe', 'taipa'] },
  loja: { pisos: ['terracota.quadrada', 'terra.batida'], papeis: ['adobe', 'reboco.branco'] },
  taverna: { pisos: ['terracota.quadrada', 'terra.batida'], papeis: ['adobe', 'taipa'] },
  estabulo: { pisos: ['terra.batida', 'palha.chao'], papeis: ['taipa', 'adobe'] },
};

const PALETAS_BASE: Readonly<Record<string, Paleta[]>> = {
  investigacao: [
    { nome: 'Vinho e carvalho', madeira: 'madeira.escura', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Azul e nogueira', madeira: 'madeira.media', tecidos: ['tecido.veludo-azul', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Verde e pinho', madeira: 'madeira.clara', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
  moderno: [
    { nome: 'Cinza e mostarda', madeira: 'madeira.clara', tecidos: ['tecido.cinza', 'tecido.linho', 'tecido.mostarda'], tapete: 'tapete.persa' },
    { nome: 'Azul e branco', madeira: 'madeira.clara', tecidos: ['tecido.veludo-azul', 'tecido.linho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Sálvia e carvalho', madeira: 'madeira.media', tecidos: ['tecido.salvia', 'tecido.linho', 'tecido.mostarda'], tapete: 'tapete.verde' },
  ],
  fantasia: [
    { nome: 'Couro e carvalho', madeira: 'madeira.escura', tecidos: ['couro.marrom', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Vinho e nogueira', madeira: 'madeira.media', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Verde e carvalho', madeira: 'madeira.escura', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
};

/** Cada gênero novo copia, por enquanto, o mais próximo; os materiais próprios chegam com as Q10–Q12 e as fichas `c` de cada época os ligam. */
export const MATERIAIS_POR_GENERO: Readonly<Record<string, Record<string, MateriaisDoComodo>>> = {
  ...MATERIAIS_BASE,
  antiguidade: { ...MATERIAIS_BASE.fantasia!, ...ANTIGUIDADE_POR_FUNCAO },
  oriental: { ...MATERIAIS_BASE.fantasia!, ...ORIENTAL_POR_FUNCAO },
  deserto: { ...MATERIAIS_BASE.fantasia!, ...DESERTO_POR_FUNCAO },
  faroeste: MATERIAIS_BASE.investigacao!, // trocado na ficha Q18c
  colonial: MATERIAIS_BASE.investigacao!, // trocado na ficha Q19c
  vitoriano: MATERIAIS_BASE.investigacao!, // trocado na ficha Q20c
  'pos-apocaliptico': MATERIAIS_BASE.moderno!, // trocado na ficha Q22c
  cyberpunk: MATERIAIS_BASE.moderno!, // trocado na ficha Q23c
};

export const PALETAS_POR_GENERO: Readonly<Record<string, Paleta[]>> = {
  ...PALETAS_BASE,
  antiguidade: [
    { nome: 'Pompeia', madeira: 'madeira.escura', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Linho e oliveira', madeira: 'madeira.media', tecidos: ['tecido.salvia', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Púrpura e cedro', madeira: 'madeira.clara', tecidos: ['tecido.veludo-azul', 'tecido.linho'], tapete: 'tapete.persa' },
  ],
  oriental: [
    { nome: 'Papel e cedro', madeira: 'madeira.clara', tecidos: ['tecido.salvia', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Laca e ouro', madeira: 'madeira.escura', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Musgo e granito', madeira: 'madeira.media', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
  deserto: [
    { nome: 'Garança e cedro', madeira: 'madeira.media', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Anil e tamareira', madeira: 'madeira.escura', tecidos: ['tecido.veludo-azul', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Ocre e palha', madeira: 'madeira.clara', tecidos: ['tecido.mostarda', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
  faroeste: PALETAS_BASE.investigacao!, // trocado na ficha Q18c
  colonial: PALETAS_BASE.investigacao!, // trocado na ficha Q19c
  vitoriano: PALETAS_BASE.investigacao!, // trocado na ficha Q20c
  'pos-apocaliptico': PALETAS_BASE.moderno!, // trocado na ficha Q22c
  cyberpunk: PALETAS_BASE.moderno!, // trocado na ficha Q23c
};

export const materiaisDe = (genero: string, funcao: string): MateriaisDoComodo => (MATERIAIS_POR_GENERO[generoDe(genero).id] ?? MATERIAIS_POR_GENERO.investigacao!)[funcao] ?? SEM_PAR(funcao);
export const paletaDe = (genero: string, semente: number): Paleta => { const l = PALETAS_POR_GENERO[generoDe(genero).id]!; return l[Math.abs(semente) % l.length]!; };

/** Que tecidos de paleta combinam com a cor de cada tapete da coleção (pelo sufixo do id). */
const TECIDOS_DO_TAPETE: Record<string, string[]> = { vinho: ['tecido.veludo-vinho', 'tecido.veludo-azul'], verde: ['tecido.verde'], creme: ['tecido.linho', 'couro.marrom'] };
/** O peso de um item no sorteio do mobiliar: o tapete da coleção cuja paleta combina com a do cômodo vale quatro vezes mais. */
export function pesoNaPaleta(paleta: Paleta, item: string): number {
  const m = /^casa:(?:tapete|passadeira)[a-z-]*-(vinho|verde|creme)$/.exec(item); if (!m) return 1;
  return TECIDOS_DO_TAPETE[m[1]!]!.includes(paleta.tecidos[0]!) ? 4 : 1;
}

/** Os parâmetros de material de uma receita, tirados da paleta: tecido nos estofados, colchas e toalhas; madeira nos móveis; um tapete que combina. */
export function paramsDaPaleta(paleta: Paleta, receita: string): Record<string, unknown> {
  const campos = ACERVO.item(receita)?.campos ?? [], params: Record<string, unknown> = {};
  for (const c of campos) {
    if (c.tipo !== 'material' || c.uso !== 'objeto') continue;
    if (c.id === 'estofado') params[c.id] = paleta.tecidos[0];
    else if (c.id === 'cobertor') params[c.id] = paleta.tecidos[2] ?? paleta.tecidos[0];
    else if (c.id === 'toalha') params[c.id] = paleta.tecidos[1] ?? paleta.tecidos[0];
    else if (c.id === 'madeira') params[c.id] = paleta.madeira;
    else if (c.id === 'material') params[c.id] = paleta.tapete;
  }
  return params;
}

/**
 * A proposta de mobiliar um cômodo: piso e papel do gênero (só se ainda são os de um tipo de cômodo, ou seja, não escolhidos à mão),
 * mais os móveis que faltam, numa paleta só. `null` se o cômodo não tem função, não há regra ou o layout trouxe menos de 2 objetos.
 */
const hashDoTexto = (t: string): number => { let h = 2166136261; for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 997; };

export function propostaDeMobilia(c: Contexto, roomId: string): Proposta | null {
  const sala = c.m.rooms[roomId]; if (!sala?.function) return null;
  const genero = generoDe(c.m.style.genre).id; if (!regrasPara(sala.function, genero).length) return null;
  const paleta = paletaDe(genero, c.semente), gerarId = c.gerarId ?? novoIdEntidade;
  const layout = gerarLayout(c.m, { roomId, funcao: sala.function, genero, semente: c.semente, gerarId, params: r => paramsDaPaleta(paleta, r), preferir: r => pesoNaPaleta(paleta, r) });
  if (layout.objetos.length < 2) return null;
  const comandos: Proposta['comandos'] = [];
  // A escolha varia de cômodo para cômodo (pela identidade dele) e com a semente: casas de vários cômodos não saem com o mesmo piso em todos.
  const mat = materiaisDe(genero, sala.function), vario = hashDoTexto(roomId), piso = mat.pisos[(c.semente + vario) % mat.pisos.length]!, papel = mat.papeis[(c.semente + Math.floor(vario / 7)) % mat.papeis.length]!;
  const ehDeTipo = TIPOS_DE_COMODO.some(t => t.piso === sala.floor.material && t.papel === (sala.wallpaper?.material ?? null));
  if (ehDeTipo && (piso !== sala.floor.material || papel !== sala.wallpaper?.material)) {
    comandos.push({ tipo: 'comodo.atualizar', id: roomId, patch: { floor: { material: piso }, wallpaper: { material: papel, seed: sala.wallpaper?.seed ?? sala.floor.seed } } });
  }
  for (const o of layout.objetos) comandos.push({ tipo: 'item.adicionar', colecao: 'props', item: o });
  return novaProposta({ tipo: 'mobiliar', rotulo: `Mobiliar a ${sala.name}`, comandos, versaoEsperada: c.versao, roomId, semente: c.semente });
}

export { GENEROS };
