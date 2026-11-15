import { edificiosDe, type Edificio } from '../domain/edificios.ts';
import { arestasDeParede, caixaDasCelulas, comodoEm, indiceDeCelulas } from '../domain/geometria.ts';
import { colunas, linhas, type Comodo, type MapaAtlas } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE } from '../domain/presets.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { MATERIAIS } from '../procedural/materiais.ts';
import { caixaDoObjeto, insightDoComodo, tamanhoDoObjeto, type Caixa, type InsightDoComodo } from './insight.ts';
import { reservasDePorta } from './portas.ts';

export type Gravidade = 'erro' | 'aviso' | 'dica';

export interface Achado {
  regra: string;
  gravidade: Gravidade;
  mensagem: string;
  sugestao: string;
  ids: string[];
  caixa?: [number, number, number, number];
}

export const MAX_ACHADOS = 15;
export const LIMIAR_AREA_INTERIOR_VAZIO = 9;
export const M2_POR_OBJETO_INTERIOR = 8;
export const LIMIAR_ESCALA_ARVORE = 2.5;
export const LIMIAR_ESCALA_ROCHEDO = 1.5;

const ORDEM_GRAVIDADE: Record<Gravidade, number> = { erro: 0, aviso: 1, dica: 2 };
const r1 = (n: number) => Math.round(n * 10) / 10;
const tuplaCaixa = (c: Caixa): [number, number, number, number] => [r1(c.x0), r1(c.y0), r1(c.x1), r1(c.y1)];
const intersecta = (a: Caixa, b: Caixa) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Agrupa todos os cômodos (exceto cômodos ao ar livre sem telhado) em edifícios conexos em 4 direções. */
export function edificiosParaRevisao(m: Pick<MapaAtlas, 'rooms'>): Edificio[] {
  const salas: Record<string, Comodo> = {};
  for (const s of Object.values(m.rooms)) {
    if (!s.roof.material && s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function)) continue;
    salas[s.id] = s.roof.material ? s : { ...s, roof: { ...s.roof, material: '__agrupar__' } };
  }
  return edificiosDe({ rooms: salas });
}

/** Sobrado decorativo fechado de cenário: telhado visível, sem aberturas nem objetos, num mapa em que os interiores jogáveis têm `roof.visible: false`. */
function ehSobradoDecorativoFechado(m: MapaAtlas, sala: Comodo, ins: InsightDoComodo, algumTelhadoAberto: boolean): boolean {
  return (
    algumTelhadoAberto &&
    sala.roof.material !== null &&
    sala.roof.visible &&
    ins.portas.length === 0 &&
    ins.janelas.length === 0 &&
    ins.objetos.length === 0
  );
}

function regraComodoSemAcesso(m: MapaAtlas): Achado[] {
  const salas = Object.values(m.rooms);
  if (!salas.length) return [];
  const arestas = arestasDeParede(m);
  const insPorId = new Map<string, InsightDoComodo>();
  for (const s of salas) {
    const ins = insightDoComodo(m, s.id, arestas);
    if (ins) insPorId.set(s.id, ins);
  }
  const algumTelhadoAberto = salas.some(s => !s.roof.visible);
  const acessiveis = new Set<string>();
  const fila: string[] = [];
  for (const s of salas) {
    const ins = insPorId.get(s.id);
    if (!ins) continue;
    if (ins.portas.some(p => p.outro === null)) {
      acessiveis.add(s.id);
      fila.push(s.id);
    }
  }
  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i]!;
    const ins = insPorId.get(atual);
    if (!ins) continue;
    for (const p of ins.portas) {
      if (p.outro !== null && !acessiveis.has(p.outro)) {
        acessiveis.add(p.outro);
        fila.push(p.outro);
      }
    }
    for (const v of ins.vizinhos) {
      if (v.ligado && !acessiveis.has(v.id)) {
        acessiveis.add(v.id);
        fila.push(v.id);
      }
    }
  }
  const achados: Achado[] = [];
  for (const s of salas) {
    if (acessiveis.has(s.id)) continue;
    const ins = insPorId.get(s.id);
    if (!ins || ehSobradoDecorativoFechado(m, s, ins, algumTelhadoAberto)) continue;
    achados.push({
      regra: 'comodo-sem-acesso',
      gravidade: 'erro',
      mensagem: `O cômodo “${s.name}” (${s.id}) não tem porta, arco ou passagem de acesso.`,
      sugestao: 'Abra uma porta ou arco com atlas_portas ligando o cômodo ao exterior ou a um cômodo vizinho com acesso.',
      ids: [s.id],
      caixa: tuplaCaixa(ins.caixa),
    });
  }
  return achados;
}

function temTerrenoExterior(m: MapaAtlas): boolean {
  const base = m.terrain.base;
  if (base === 'vazio' || base === 'rocha.rachada') return false;
  const usoBase = MATERIAIS[base]?.uso;
  if (usoBase === 'macico') return false;
  return true;
}

function regraEdificioSemTelhado(m: MapaAtlas): Achado[] {
  if (!temTerrenoExterior(m)) return [];
  const eds = edificiosParaRevisao(m);
  const achados: Achado[] = [];
  for (const ed of eds) {
    const cobertas = ed.salas.map(id => m.rooms[id]!).filter(s => !(s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function)));
    if (!cobertas.length || cobertas.some(s => s.roof.material !== null)) continue;
    const c = caixaDasCelulas(m, ed.celulas);
    const nomes = ed.salas.map(id => m.rooms[id]!.name).slice(0, 3).join(', ');
    achados.push({
      regra: 'edificio-sem-telhado',
      gravidade: 'aviso',
      mensagem: `Edifício (${nomes}) com ${cobertas.length} cômodo(s) coberto(s) sem telhado.`,
      sugestao: 'Defina um estilo ou cobertura de telhado nos cômodos cobertos (ex.: telhado em atlas_comodos).',
      ids: [...ed.salas],
      ...(c ? { caixa: tuplaCaixa(c) } : {}),
    });
  }
  return achados;
}

function regraInteriorVazio(m: MapaAtlas): Achado[] {
  const salas = Object.values(m.rooms);
  if (!salas.length) return [];
  const arestas = arestasDeParede(m);
  const indice = indiceDeCelulas(m);
  const algumTelhadoAberto = salas.some(s => !s.roof.visible);
  const achados: Achado[] = [];
  for (const s of salas) {
    if (s.function === 'corredor' || (s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function))) continue;
    const ins = insightDoComodo(m, s.id, arestas);
    if (!ins || ins.area < LIMIAR_AREA_INTERIOR_VAZIO || ehSobradoDecorativoFechado(m, s, ins, algumTelhadoAberto)) continue;
    const objetosDePiso = Object.values(m.props).filter(
      o => o.elevation === 'floor' && (o.roomId === s.id || (o.roomId === null && comodoEm(m, o.position, indice) === s.id)),
    ).length;
    const minimo = Math.max(1, Math.floor(ins.area / M2_POR_OBJETO_INTERIOR));
    if (objetosDePiso < minimo) {
      achados.push({
        regra: 'interior-vazio',
        gravidade: 'aviso',
        mensagem: `O cômodo “${s.name}” (${r1(ins.area)} m²) tem apenas ${objetosDePiso} objeto(s) de piso (esperado ao menos ${minimo}).`,
        sugestao: 'Use atlas_mobiliar ou adicione objetos adequados à função do cômodo com atlas_objetos / atlas_espalhar.',
        ids: [s.id],
        caixa: tuplaCaixa(ins.caixa),
      });
    }
  }
  return achados;
}

function regraPortaBloqueada(m: MapaAtlas): Achado[] {
  const salas = Object.values(m.rooms);
  if (!salas.length) return [];
  const arestas = arestasDeParede(m);
  const bloqueantes = Object.values(m.props)
    .filter(o => o.elevation === 'floor' && o.blocks.move)
    .map(o => ({ obj: o, caixa: caixaDoObjeto(o) }));
  if (!bloqueantes.length) return [];
  const achados: Achado[] = [];
  const reportados = new Set<string>();
  for (const s of salas) {
    const ins = insightDoComodo(m, s.id, arestas);
    const reservas = reservasDePorta(m, s.id);
    for (const { obj, caixa } of bloqueantes) {
      if (reportados.has(obj.id)) continue;
      const naReserva =
        (obj.roomId === null || obj.roomId === s.id) && reservas.some(z => intersecta(caixa, z));
      const noVao =
        ins !== null &&
        ins.portas.some(p => Math.hypot(obj.position[0] - p.centro[0], obj.position[1] - p.centro[1]) < 0.45);
      if (naReserva || noVao) {
        reportados.add(obj.id);
        achados.push({
          regra: 'porta-bloqueada',
          gravidade: 'erro',
          mensagem: `O objeto “${ACERVO.idDaFonte(obj.source)}” (${obj.id}) bloqueia a passagem ou a reserva de porta de “${s.name}”.`,
          sugestao: 'Mova ou remova o objeto da frente da porta com atlas_mover ou atlas_remover.',
          ids: [obj.id, s.id],
          caixa: tuplaCaixa(caixa),
        });
      }
    }
  }
  return achados;
}

function regraObjetoFora(m: MapaAtlas): Achado[] {
  const maxX = Math.max(m.bounds.width, colunas(m) * m.grid.size);
  const maxY = Math.max(m.bounds.height, linhas(m) * m.grid.size);
  const achados: Achado[] = [];
  for (const o of Object.values(m.props)) {
    const [x, y] = o.position;
    if (x < 0 || y < 0 || x > maxX || y > maxY) {
      achados.push({
        regra: 'objeto-fora',
        gravidade: 'erro',
        mensagem: `O objeto “${ACERVO.idDaFonte(o.source)}” (${o.id}) está fora dos limites do mapa em [${r1(x)}, ${r1(y)}] m.`,
        sugestao: `Mova o objeto para dentro de [0, 0, ${m.bounds.width}, ${m.bounds.height}] m com atlas_mover ou remova-o com atlas_remover.`,
        ids: [o.id],
        caixa: tuplaCaixa(caixaDoObjeto(o)),
      });
    }
  }
  return achados;
}

function regraEscalaSuspeita(m: MapaAtlas): Achado[] {
  const achados: Achado[] = [];
  for (const o of Object.values(m.props)) {
    const id = ACERVO.idDaFonte(o.source);
    const item = ACERVO.item(id);
    if (!item) continue;
    const lado = Math.max(...tamanhoDoObjeto(o));
    if (item.tags.includes('arvore') && lado < LIMIAR_ESCALA_ARVORE) {
      achados.push({
        regra: 'escala-suspeita',
        gravidade: 'dica',
        mensagem: `A árvore “${id}” (${o.id}) tem apenas ${r1(lado)} m de diâmetro (menor que ${LIMIAR_ESCALA_ARVORE} m).`,
        sugestao: 'Aumente a escala da árvore para ficar entre 3 e 8 m de copa.',
        ids: [o.id],
        caixa: tuplaCaixa(caixaDoObjeto(o)),
      });
    } else if ((item.id === 'rochedo' || item.tags.includes('rochedo')) && lado < LIMIAR_ESCALA_ROCHEDO) {
      achados.push({
        regra: 'escala-suspeita',
        gravidade: 'dica',
        mensagem: `O rochedo “${id}” (${o.id}) tem apenas ${r1(lado)} m (menor que ${LIMIAR_ESCALA_ROCHEDO} m).`,
        sugestao: 'Aumente a escala do rochedo para ao menos 1,5 m ou use pedra.pequena / seixos.',
        ids: [o.id],
        caixa: tuplaCaixa(caixaDoObjeto(o)),
      });
    }
  }
  return achados;
}

export const REGRAS: Readonly<Record<string, (m: MapaAtlas) => Achado[]>> = {
  'comodo-sem-acesso': regraComodoSemAcesso,
  'edificio-sem-telhado': regraEdificioSemTelhado,
  'interior-vazio': regraInteriorVazio,
  'porta-bloqueada': regraPortaBloqueada,
  'objeto-fora': regraObjetoFora,
  'escala-suspeita': regraEscalaSuspeita,
};

export function revisarMapa(m: MapaAtlas, opcoes?: { regras?: string[] }): Achado[] {
  const chaves = opcoes?.regras ? opcoes.regras.filter(k => k in REGRAS) : Object.keys(REGRAS);
  const todos: Achado[] = [];
  for (const k of chaves) {
    todos.push(...REGRAS[k]!(m));
  }
  todos.sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade]);
  if (todos.length <= MAX_ACHADOS) return todos;
  const visiveis = todos.slice(0, MAX_ACHADOS - 1);
  const restantes = todos.length - visiveis.length;
  return [
    ...visiveis,
    {
      regra: 'mais',
      gravidade: todos[MAX_ACHADOS - 1]!.gravidade,
      mensagem: `Mais ${restantes} achado(s) omitido(s) além do limite de ${MAX_ACHADOS}.`,
      sugestao: 'Corrija os primeiros achados ou filtre por regra.',
      ids: [],
    },
  ];
}
