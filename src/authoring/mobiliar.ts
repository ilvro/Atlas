import { novoIdEntidade } from '../domain/fabrica.ts';
import { TIPOS_DE_COMODO, generoDe, type GeneroId } from '../domain/presets.ts';
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
const MATERIAIS_BASE: Readonly<Record<'investigacao' | 'moderno' | 'fantasia', Record<string, MateriaisDoComodo>>> = {
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
      saloon: { pisos: ['tabuas.escuras'], papeis: ['boiserie.escura'] }, xerifado: { pisos: ['tabuas.rusticas'], papeis: ['reboco.sujo'] }, 'armazem-geral': { pisos: ['tabuas.rusticas'], papeis: ['reboco.sujo'] },
      banco: { pisos: ['marmore.xadrez-diagonal'], papeis: ['boiserie.escura'] }, estacao: { pisos: ['tabuas.escuras'], papeis: ['reboco.sujo'] },
      conves: { pisos: ['tabuas.escuras'], papeis: ['tabuas.descascadas'] }, 'cabine-do-capitao': { pisos: ['tabuas.escuras'], papeis: ['boiserie.escura'] }, 'taverna-do-porto': { pisos: ['tabuas.escuras'], papeis: ['reboco.sujo'] },
      fortim: { pisos: ['laje.pedra'], papeis: ['pedra.aparelhada'] }, 'casa-colonial': { pisos: ['tabuas.carvalho'], papeis: ['reboco.branco'] },
      fabrica: { pisos: ['laje.pedra'], papeis: ['tijolo'] }, 'oficina-de-inventor': { pisos: ['tabuas.rusticas'], papeis: ['tijolo'] },
      clube: { pisos: ['parquet.espinha'], papeis: ['papel.damasco-azul'] }, 'estacao-de-dirigivel': { pisos: ['marmore.xadrez-diagonal'], papeis: ['tijolo'] },
      mercado: { pisos: ['vinil.industrial'], papeis: ['papel.liso-claro'] }, lanchonete: { pisos: ['ladrilho.xadrez'], papeis: ['azulejo.metro'] }, garagem: { pisos: ['concreto.placas'], papeis: ['reboco.branco'] },
      posto: { pisos: ['vinil.industrial'], papeis: ['papel.liso-claro'] }, vestiario: { pisos: ['azulejo.branco'], papeis: ['azulejo.metro'] },
      acampamento: { pisos: ['terra.batida'], papeis: ['chapa.enferrujada'] }, abrigo: { pisos: ['concreto.rachado'], papeis: ['concreto.pichado'] }, 'enfermaria-improvisada': { pisos: ['linoleo'], papeis: ['azulejo.metro'] },
      'oficina-de-sucata': { pisos: ['entulho'], papeis: ['chapa.enferrujada'] }, 'posto-de-guarda': { pisos: ['concreto.rachado'], papeis: ['chapa.enferrujada'] },
      'clinica-clandestina': { pisos: ['grade.cyber'], papeis: ['azulejo.metro'] }, bar: { pisos: ['piso.neon'], papeis: ['painel.neon'] }, 'hotel-capsula': { pisos: ['grade.cyber'], papeis: ['painel.metalico'] },
      'sala-de-servidores': { pisos: ['grade.cyber'], papeis: ['painel.metalico'] }, 'mercado-noturno': { pisos: ['concreto.rachado'], papeis: ['concreto.pichado'] },
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

/** Faroeste: tábuas gastas e descascadas, caiado e tijolo com fuligem (Q11) nos cômodos da época; o resto herda a investigação com tábuas de pinho no lugar do papel de parede. */
const FAROESTE_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  saloon: { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['tabuas.descascadas', 'boiserie.escura'] },
  xerifado: { pisos: ['tabuas.gastas', 'tabuas.rusticas'], papeis: ['caiado', 'tabuas.descascadas'] },
  'armazem-geral': { pisos: ['tabuas.gastas', 'tabuas.rusticas'], papeis: ['tabuas.descascadas', 'caiado'] },
  banco: { pisos: ['ladrilho.hidraulico', 'tabuas.gastas'], papeis: ['caiado', 'tijolo.fuligem'] },
  estacao: { pisos: ['tijoleira', 'tabuas.gastas'], papeis: ['tabuas.descascadas', 'tijolo.fuligem'] },
  estabulo: { pisos: ['terra.batida', 'tabuas.gastas'], papeis: ['tabuas.descascadas', 'toras'] },
  deposito: { pisos: ['tabuas.gastas', 'tabuas.rusticas'], papeis: ['tabuas.descascadas', 'caiado'] },
  taverna: { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['tabuas.descascadas', 'boiserie.escura'] },
  loja: { pisos: ['tabuas.gastas', 'tabuas.carvalho'], papeis: ['caiado', 'tabuas.descascadas'] },
  escritorio: { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['caiado', 'boiserie.escura'] },
  sala: { pisos: ['tabuas.gastas', 'tabuas.carvalho'], papeis: ['caiado', 'tabuas.descascadas'] },
  quarto: { pisos: ['tabuas.gastas', 'tabuas.carvalho'], papeis: ['caiado', 'tabuas.descascadas'] },
  cozinha: { pisos: ['tabuas.gastas', 'tijoleira'], papeis: ['caiado', 'tabuas.descascadas'] },
  corredor: { pisos: ['tabuas.gastas'], papeis: ['tabuas.descascadas', 'caiado'] },
  cela: { pisos: ['laje.pedra', 'tabuas.gastas'], papeis: ['tijolo.fuligem', 'pedra.aparelhada'] },
  varanda: { pisos: ['tabuas.gastas', 'tabuas.rusticas'], papeis: ['tabuas.descascadas', 'caiado'] },
  salao: { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['tabuas.descascadas', 'boiserie.escura'] },
  'sala-de-jogos': { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['tabuas.descascadas', 'boiserie.escura'] },
};

/** Colonial e pirata: tábuas de convés, caiado, tijoleira e cantaria do fortim; o resto herda a investigação com caiado e tábuas no lugar do papel de parede. */
const COLONIAL_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  conves: { pisos: ['conves', 'tabuas.gastas', 'tabuas.escuras'], papeis: ['tabuas.descascadas', 'toras'] },
  'cabine-do-capitao': { pisos: ['tabuas.carvalho', 'tabuas.escuras'], papeis: ['boiserie.escura', 'tabuas.descascadas'] },
  'taverna-do-porto': { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['caiado', 'tabuas.descascadas'] },
  fortim: { pisos: ['laje.pedra', 'pedra.rustica'], papeis: ['pedra.aparelhada', 'tijolo.fuligem'] },
  'casa-colonial': { pisos: ['tijoleira', 'tabuas.carvalho'], papeis: ['caiado', 'reboco.branco'] },
  porao: { pisos: ['laje.pedra', 'tabuas.gastas'], papeis: ['tabuas.descascadas', 'pedra.aparelhada'] },
  taverna: { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['caiado', 'tabuas.descascadas'] },
  deposito: { pisos: ['tabuas.gastas', 'tijoleira'], papeis: ['caiado', 'tabuas.descascadas'] },
  loja: { pisos: ['tijoleira', 'tabuas.carvalho'], papeis: ['caiado', 'reboco.branco'] },
  escritorio: { pisos: ['tabuas.carvalho', 'tabuas.escuras'], papeis: ['caiado', 'boiserie.escura'] },
  sala: { pisos: ['tijoleira', 'tabuas.carvalho'], papeis: ['caiado', 'reboco.branco'] },
  quarto: { pisos: ['tabuas.carvalho', 'tijoleira'], papeis: ['caiado', 'reboco.branco'] },
  cozinha: { pisos: ['tijoleira', 'terracota.quadrada'], papeis: ['caiado', 'reboco.branco'] },
  corredor: { pisos: ['tijoleira', 'tabuas.carvalho'], papeis: ['caiado', 'reboco.branco'] },
  capela: { pisos: ['laje.pedra', 'tijoleira'], papeis: ['caiado', 'reboco.branco'] },
  cela: { pisos: ['laje.pedra', 'pedra.rustica'], papeis: ['pedra.aparelhada', 'tijolo'] },
  varanda: { pisos: ['tijoleira', 'terracota.quadrada'], papeis: ['caiado', 'reboco.branco'] },
  salao: { pisos: ['tabuas.carvalho', 'tijoleira'], papeis: ['caiado', 'boiserie.escura'] },
  'sala-de-jantar': { pisos: ['tabuas.carvalho', 'tijoleira'], papeis: ['caiado', 'boiserie.escura'] },
};

/** Vitoriano e steampunk: tijolo com fuligem e tábuas gastas nas fábricas e oficinas; damasco, listras e verde-esmeralda nas salas nobres; ladrilho hidráulico e xadrez onde há movimento e vapor. */
const VITORIANO_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  fabrica: { pisos: ['tabuas.gastas', 'laje.pedra', 'ladrilho.hidraulico'], papeis: ['tijolo.fuligem', 'tijolo'] },
  'oficina-de-inventor': { pisos: ['tabuas.gastas', 'tabuas.rusticas'], papeis: ['tijolo.fuligem', 'pedra.aparelhada'] },
  clube: { pisos: ['tabuas.escuras', 'tabuas.marchetadas', 'parquet.espinha'], papeis: ['papel.damasco-vinho', 'papel.bordo-listras', 'papel.verde-esmeralda'] },
  'estacao-de-dirigivel': { pisos: ['ladrilho.xadrez', 'marmore.xadrez-diagonal', 'laje.pedra'], papeis: ['tijolo.fuligem', 'azulejo.metro'] },
  sala: { pisos: ['tabuas.escuras', 'parquet.espinha', 'tabuas.marchetadas'], papeis: ['papel.damasco-vinho', 'papel.verde-esmeralda', 'papel.bordo-listras'] },
  escritorio: { pisos: ['tabuas.escuras', 'tabuas.carvalho'], papeis: ['papel.verde-esmeralda', 'papel.listras-musgo', 'boiserie.escura'] },
  quarto: { pisos: ['tabuas.carvalho', 'parquet.espinha'], papeis: ['papel.azul-listras', 'papel.damasco-azul', 'papel.floral-rosa'] },
  biblioteca: { pisos: ['tabuas.escuras', 'tabuas.marchetadas'], papeis: ['papel.verde-esmeralda', 'boiserie.escura', 'papel.damasco-vinho'] },
  cozinha: { pisos: ['ladrilho.hidraulico', 'hexagono.terracota'], papeis: ['azulejo.metro', 'tijolo.fuligem'] },
  corredor: { pisos: ['ladrilho.xadrez', 'tabuas.escuras'], papeis: ['papel.damasco-azul', 'papel.azul-listras'] },
  'sala-de-jantar': { pisos: ['tabuas.marchetadas', 'parquet.espinha'], papeis: ['papel.damasco-vinho', 'papel.bordo-listras', 'boiserie.escura'] },
  'sala-de-jogos': { pisos: ['tabuas.escuras', 'tabuas.marchetadas'], papeis: ['papel.verde-esmeralda', 'papel.damasco-vinho'] },
  salao: { pisos: ['tabuas.marchetadas', 'marmore.xadrez-diagonal'], papeis: ['papel.damasco-vinho', 'papel.damasco-azul'] },
  banheiro: { pisos: ['ladrilho.hidraulico', 'hexagono.salvia'], papeis: ['azulejo.metro', 'papel.liso-claro'] },
  oficina: { pisos: ['tabuas.gastas', 'laje.pedra'], papeis: ['tijolo.fuligem', 'pedra.aparelhada'] },
  deposito: { pisos: ['tabuas.gastas', 'laje.pedra'], papeis: ['tijolo.fuligem', 'reboco.sujo'] },
  porao: { pisos: ['laje.pedra', 'concreto'], papeis: ['tijolo.fuligem', 'tijolo'] },
  taverna: { pisos: ['tabuas.gastas', 'tabuas.escuras'], papeis: ['tijolo.fuligem', 'boiserie.escura'] },
  loja: { pisos: ['ladrilho.xadrez', 'parquet.espinha'], papeis: ['papel.listras-creme', 'boiserie.verde'] },
};

/** Moderno urbano: pisos frios e laváveis (vinil, concreto, azulejo) e o xadrez da lanchonete; paredes claras ou de azulejo de metrô. */
const MODERNO_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  mercado: { pisos: ['vinil.industrial', 'ladrilho.cozinha'], papeis: ['papel.liso-claro', 'reboco.branco'] },
  lanchonete: { pisos: ['ladrilho.xadrez', 'azulejo.branco'], papeis: ['azulejo.metro', 'papel.liso-claro'] },
  garagem: { pisos: ['concreto.placas', 'concreto'], papeis: ['reboco.branco', 'painel.metalico'] },
  posto: { pisos: ['vinil.industrial', 'ladrilho.cozinha'], papeis: ['papel.liso-claro', 'painel.metalico'] },
  vestiario: { pisos: ['azulejo.branco', 'vinil.industrial'], papeis: ['azulejo.metro', 'reboco.branco'] },
};

/** Pós-apocalíptico: concreto rachado, entulho, terra batida e linóleo gasto; paredes de chapa enferrujada e concreto pichado (Q12). */
const POS_APOCALIPTICO_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  acampamento: { pisos: ['terra.batida', 'entulho'], papeis: ['chapa.enferrujada', 'concreto.pichado'] },
  abrigo: { pisos: ['concreto.rachado', 'concreto', 'linoleo'], papeis: ['concreto.pichado', 'reboco.branco'] },
  'enfermaria-improvisada': { pisos: ['linoleo', 'concreto.rachado'], papeis: ['azulejo.metro', 'concreto.pichado'] },
  'oficina-de-sucata': { pisos: ['entulho', 'concreto.rachado', 'terra.batida'], papeis: ['chapa.enferrujada', 'painel.metalico'] },
  'posto-de-guarda': { pisos: ['concreto.rachado', 'entulho'], papeis: ['chapa.enferrujada', 'concreto.pichado'] },
  // Os cômodos comuns do moderno ficam gastos: piso rachado e parede pichada ou de chapa.
  sala: { pisos: ['concreto.rachado', 'linoleo', 'entulho'], papeis: ['concreto.pichado', 'chapa.enferrujada'] },
  quarto: { pisos: ['linoleo', 'concreto.rachado'], papeis: ['concreto.pichado', 'reboco.sujo'] },
  cozinha: { pisos: ['linoleo', 'concreto.rachado'], papeis: ['azulejo.metro', 'concreto.pichado'] },
  deposito: { pisos: ['concreto.rachado', 'entulho'], papeis: ['chapa.enferrujada', 'concreto.pichado'] },
  oficina: { pisos: ['entulho', 'concreto.rachado'], papeis: ['chapa.enferrujada', 'painel.metalico'] },
  garagem: { pisos: ['concreto.rachado', 'entulho'], papeis: ['chapa.enferrujada', 'concreto.pichado'] },
};

/** Cyberpunk: grade escura e piso com néon, painéis metálicos e de néon, concreto pichado nas ruas; o azulejo de metrô fica na clínica (Q12). */
const CYBERPUNK_POR_FUNCAO: Readonly<Record<string, MateriaisDoComodo>> = {
  'clinica-clandestina': { pisos: ['grade.cyber', 'linoleo', 'concreto.rachado'], papeis: ['azulejo.metro', 'painel.metalico', 'concreto.pichado'] },
  bar: { pisos: ['piso.neon', 'grade.cyber', 'concreto.rachado'], papeis: ['painel.neon', 'concreto.pichado', 'painel.metalico'] },
  'hotel-capsula': { pisos: ['grade.cyber', 'vinil.industrial'], papeis: ['painel.metalico', 'painel.neon'] },
  'sala-de-servidores': { pisos: ['grade.cyber', 'metal.grade'], papeis: ['painel.metalico', 'chapa.enferrujada'] },
  'mercado-noturno': { pisos: ['concreto.rachado', 'concreto.placas', 'grade.cyber'], papeis: ['concreto.pichado', 'painel.metalico'] },
  // Os cômodos comuns do moderno ficam mais frios e escuros: grade ou concreto, painéis e concreto pichado.
  sala: { pisos: ['grade.cyber', 'concreto.rachado', 'carpete.cinza'], papeis: ['painel.metalico', 'concreto.pichado', 'papel.liso-escuro'] },
  quarto: { pisos: ['carpete.cinza', 'grade.cyber'], papeis: ['papel.liso-escuro', 'painel.metalico'] },
  cozinha: { pisos: ['linoleo', 'grade.cyber'], papeis: ['azulejo.metro', 'painel.metalico'] },
  deposito: { pisos: ['grade.cyber', 'concreto.rachado'], papeis: ['painel.metalico', 'concreto.pichado'] },
  oficina: { pisos: ['grade.cyber', 'concreto.rachado'], papeis: ['painel.metalico', 'chapa.enferrujada'] },
  lanchonete: { pisos: ['piso.neon', 'ladrilho.xadrez'], papeis: ['painel.neon', 'azulejo.metro'] },
  hospital: { pisos: ['grade.cyber', 'linoleo'], papeis: ['azulejo.metro', 'painel.metalico'] },
  taverna: { pisos: ['piso.neon', 'grade.cyber'], papeis: ['painel.neon', 'concreto.pichado'] },
};

const PALETAS_BASE: Readonly<Record<'investigacao' | 'moderno' | 'fantasia', Paleta[]>> = {
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

/** Pisos e papéis disponíveis por gênero e função de cômodo. */
export const MATERIAIS_POR_GENERO: Readonly<Record<GeneroId, Record<string, MateriaisDoComodo>>> & Readonly<Record<string, Record<string, MateriaisDoComodo>>> = {
  ...MATERIAIS_BASE,
  moderno: { ...MATERIAIS_BASE.moderno!, ...MODERNO_POR_FUNCAO },
  antiguidade: { ...MATERIAIS_BASE.fantasia!, ...ANTIGUIDADE_POR_FUNCAO },
  oriental: { ...MATERIAIS_BASE.fantasia!, ...ORIENTAL_POR_FUNCAO },
  deserto: { ...MATERIAIS_BASE.fantasia!, ...DESERTO_POR_FUNCAO },
  faroeste: { ...MATERIAIS_BASE.investigacao!, ...FAROESTE_POR_FUNCAO },
  colonial: { ...MATERIAIS_BASE.investigacao!, ...COLONIAL_POR_FUNCAO },
  vitoriano: { ...MATERIAIS_BASE.investigacao!, ...VITORIANO_POR_FUNCAO },
  'pos-apocaliptico': { ...MATERIAIS_BASE.moderno!, ...MODERNO_POR_FUNCAO, ...POS_APOCALIPTICO_POR_FUNCAO },
  cyberpunk: { ...MATERIAIS_BASE.moderno!, ...MODERNO_POR_FUNCAO, ...CYBERPUNK_POR_FUNCAO },
};

export const PALETAS_POR_GENERO: Readonly<Record<GeneroId, Paleta[]>> & Readonly<Record<string, Paleta[]>> = {
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
  faroeste: [
    { nome: 'Mogno e feltro', madeira: 'madeira.escura', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Pinho e couro', madeira: 'madeira.media', tecidos: ['couro.marrom', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Veludo e poeira', madeira: 'madeira.clara', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
  ],
  colonial: [
    { nome: 'Mogno e couro', madeira: 'madeira.escura', tecidos: ['couro.marrom', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Carvalho e lona', madeira: 'madeira.media', tecidos: ['tecido.mostarda', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Pau-brasil e veludo', madeira: 'madeira.clara', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
  ],
  vitoriano: [
    { nome: 'Latão e vinho', madeira: 'madeira.escura', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Verde-garrafa e mogno', madeira: 'madeira.escura', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Couro e carvalho escuro', madeira: 'madeira.media', tecidos: ['couro.marrom', 'tecido.linho'], tapete: 'tapete.persa' },
  ],
  // Pós-apocalíptico (Q22c): madeira de palete e tábua velha, lona e panos desbotados.
  'pos-apocaliptico': [
    { nome: 'Palete e lona', madeira: 'madeira.escura', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Tábua velha e couro', madeira: 'madeira.media', tecidos: ['couro.marrom', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Compensado e mostarda', madeira: 'madeira.clara', tecidos: ['tecido.mostarda', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
  // Cyberpunk (Q23c): grafite e cromo, com um tecido de cor forte (magenta ou ciano ficam por conta do néon).
  cyberpunk: [
    { nome: 'Grafite e cromo', madeira: 'madeira.escura', tecidos: ['tecido.cinza', 'tecido.linho'], tapete: 'tapete.desbotado' },
    { nome: 'Preto e magenta', madeira: 'madeira.escura', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.marinho' },
    { nome: 'Ciano e aço', madeira: 'madeira.media', tecidos: ['tecido.veludo-azul', 'tecido.linho'], tapete: 'tapete.azul' },
  ],
};

export const materiaisDe = (genero: string, funcao: string): MateriaisDoComodo => (MATERIAIS_POR_GENERO[generoDe(genero).id] ?? MATERIAIS_POR_GENERO.investigacao)[funcao] ?? SEM_PAR(funcao);
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
