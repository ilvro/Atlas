import { decodificar, type Faixa } from '../domain/celulas.ts';
import { ehNoite, nivelDaLuz } from '../domain/clima.ts';
import { edificiosDe, type Edificio } from '../domain/edificios.ts';
import { pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import { arestasDeParede, caixaDasCelulas, comodoEm, indiceDeCelulas } from '../domain/geometria.ts';
import { colunas, linhas, type Comodo, type MapaAtlas, type Ponto } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE } from '../domain/presets.ts';
import { retangulosDe } from '../domain/telhado-geometria.ts';
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

export const MIN_EDIFICIOS_CASAS_IGUAIS = 5;
export const LIMIAR_CV_AREA_CASAS = 0.3;
export const LIMIAR_FRACAO_RETANGULARES = 0.7;
export const MIN_OBJETOS_FILEIRAS_MECANICAS = 12;
export const FOLGA_GRADE_FILEIRAS = 2;
export const LIMIAR_DESVIO_ROTACAO_FILEIRAS = 0.05;
export const LIMIAR_COPIAS_REPETICAO = 40;
export const LIMIAR_FRACAO_REPETICAO = 0.35;
export const MIN_COPIAS_FRACAO_REPETICAO = 12;
export const LIMIAR_AREA_MANCHA_DISCO = 4;
export const LIMIAR_CIRCULARIDADE_MANCHA = 0.85;
export const LIMIAR_OCUPACAO_COMPOSICAO = 0.55;
export const LIMIAR_DESVIO_CENTRO_COMPOSICAO = 0.1;
export const LIMIAR_DIFERENCA_MARGENS_COMPOSICAO = 0.3;
export const LIMIAR_AMBIENTE_ESCURO = 0.45;
export const LIMIAR_AREA_COMODO_SEM_LUZ = 6;

const TAGS_VEGETACAO = new Set(['arvore', 'arbusto', 'grama']);

const ORDEM_GRAVIDADE: Record<Gravidade, number> = { erro: 0, aviso: 1, dica: 2 };
const r1 = (n: number) => Math.round(n * 10) / 10;
const tuplaCaixa = (c: Caixa): [number, number, number, number] => [r1(c.x0), r1(c.y0), r1(c.x1), r1(c.y1)];
const intersecta = (a: Caixa, b: Caixa) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function caixaDoComodo(m: MapaAtlas, s: Comodo): Caixa | null {
  if (s.outline && s.outline.length >= 3) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of s.outline) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1 };
  }
  return caixaDasCelulas(m, decodificar(s.cells));
}

function salaNoPonto(m: MapaAtlas, ponto: Ponto, nivel: string | null, indices: Map<string | null, Map<number, string>>): string | null {
  for (const s of Object.values(m.rooms)) {
    if ((s.levelId ?? null) === nivel && s.outline && s.outline.length >= 3 && pontoNoPoligono(ponto, s.outline)) {
      return s.id;
    }
  }
  let idx = indices.get(nivel);
  if (!idx) {
    idx = indiceDeCelulas(m, nivel);
    indices.set(nivel, idx);
  }
  return comodoEm(m, ponto, idx);
}

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
  const indices = new Map<string | null, Map<number, string>>();
  const escadasPorSala = new Map<string, string[]>();
  const escadasDoExterior: string[] = [];
  for (const o of Object.values(m.props)) {
    if (o.interaction?.kind !== 'stairs' || o.interaction.toLevel === undefined) continue;
    const origNivel = o.levelId ?? null;
    const origSala = o.roomId && m.rooms[o.roomId] ? o.roomId : salaNoPonto(m, o.position, origNivel, indices);
    const destNivel = o.interaction.toLevel ?? null;
    const destPos = o.interaction.toPosition ?? o.position;
    const destSala = salaNoPonto(m, destPos, destNivel, indices);
    if (!destSala) continue;
    if (origSala === null) {
      if (origNivel === null) escadasDoExterior.push(destSala);
    } else {
      escadasPorSala.set(origSala, [...(escadasPorSala.get(origSala) ?? []), destSala]);
      escadasPorSala.set(destSala, [...(escadasPorSala.get(destSala) ?? []), origSala]);
    }
  }
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
  for (const destId of escadasDoExterior) {
    if (!acessiveis.has(destId)) {
      acessiveis.add(destId);
      fila.push(destId);
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
    for (const destId of escadasPorSala.get(atual) ?? []) {
      if (!acessiveis.has(destId)) {
        acessiveis.add(destId);
        fila.push(destId);
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
    const cobertas = ed.salas
      .map(id => m.rooms[id]!)
      .filter(s => {
        if (s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function)) return false;
        if (s.levelId && (m.levels?.[s.levelId]?.order ?? 0) < 0) return false;
        return true;
      });
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

function ehVegetacao(idFonte: string): boolean {
  const item = ACERVO.item(idFonte);
  return item ? item.tags.some(t => TAGS_VEGETACAO.has(t)) : false;
}

function regraCasasIguais(m: MapaAtlas): Achado[] {
  const salas = Object.values(m.rooms);
  if (!salas.length) return [];
  const arestas = arestasDeParede(m);
  const algumTelhadoAberto = salas.some(s => !s.roof.visible);
  const salasFiltradas: Record<string, Comodo> = {};
  for (const s of salas) {
    if (!s.roof.material && s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function)) continue;
    const ins = insightDoComodo(m, s.id, arestas);
    if (ins && ehSobradoDecorativoFechado(m, s, ins, algumTelhadoAberto)) continue;
    salasFiltradas[s.id] = s.roof.material ? s : { ...s, roof: { ...s.roof, material: '__agrupar__' } };
  }
  const eds = edificiosDe({ rooms: salasFiltradas });
  if (eds.length < MIN_EDIFICIOS_CASAS_IGUAIS) return [];
  const areaCel = m.grid.size * m.grid.size;
  const areas = eds.map(ed => ed.celulas.length * areaCel);
  const media = areas.reduce((s, a) => s + a, 0) / areas.length;
  const desvio = Math.sqrt(areas.reduce((s, a) => s + (a - media) ** 2, 0) / areas.length);
  const cv = media > 0 ? desvio / media : 0;
  const retangulares = eds.filter(ed => retangulosDe(ed.celulas).length === 1).length;
  const fracaoRet = retangulares / eds.length;
  if (cv >= LIMIAR_CV_AREA_CASAS && fracaoRet < LIMIAR_FRACAO_RETANGULARES) return [];
  const todasCelulas = eds.flatMap(ed => ed.celulas);
  const c = caixaDasCelulas(m, todasCelulas);
  return [{
    regra: 'casas-iguais',
    gravidade: 'aviso',
    mensagem: `${eds.length} casas de tamanho e forma parecidos`,
    sugestao: 'Variar porte por função, plantas em L e anexos, alpendre (o guia de projeto explica).',
    ids: eds.map(ed => ed.id),
    ...(c ? { caixa: tuplaCaixa(c) } : {}),
  }];
}

function regraFileirasMecanicas(m: MapaAtlas): Achado[] {
  const porFonte = new Map<string, (typeof m.props)[string][]>();
  for (const o of Object.values(m.props)) {
    const id = ACERVO.idDaFonte(o.source);
    let lista = porFonte.get(id);
    if (!lista) {
      lista = [];
      porFonte.set(id, lista);
    }
    lista.push(o);
  }
  const achados: Achado[] = [];
  for (const [id, lista] of porFonte) {
    const n = lista.length;
    if (n < MIN_OBJETOS_FILEIRAS_MECANICAS) continue;
    const limiteGrade = Math.sqrt(n) + FOLGA_GRADE_FILEIRAS;
    const xs = new Set(lista.map(o => Math.round(o.position[0] * 10)));
    const ys = new Set(lista.map(o => Math.round(o.position[1] * 10)));
    const emGradeQuadrada = xs.size <= limiteGrade && ys.size <= limiteGrade;
    const emGradeRetangular = Math.min(xs.size, ys.size) <= limiteGrade && (xs.size + ys.size) / 2 <= limiteGrade && xs.size * ys.size <= n * 1.25;
    if (!emGradeQuadrada && !emGradeRetangular) continue;
    const mediaRot = lista.reduce((s, o) => s + o.rotation, 0) / n;
    const desvioRot = Math.sqrt(lista.reduce((s, o) => s + (o.rotation - mediaRot) ** 2, 0) / n);
    if (desvioRot >= LIMIAR_DESVIO_ROTACAO_FILEIRAS) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of lista) {
      if (o.position[0] < x0) x0 = o.position[0];
      if (o.position[1] < y0) y0 = o.position[1];
      if (o.position[0] > x1) x1 = o.position[0];
      if (o.position[1] > y1) y1 = o.position[1];
    }
    achados.push({
      regra: 'fileiras-mecanicas',
      gravidade: 'aviso',
      mensagem: `${n} objetos “${id}” alinhados em grade regular e com mesma rotação.`,
      sugestao: 'Use um conjunto de atlas_espalhar ou varie receita, rotação e espaçamento.',
      ids: lista.slice(0, 10).map(o => o.id),
      caixa: [r1(x0), r1(y0), r1(x1), r1(y1)],
    });
  }
  return achados;
}

function regraRepeticao(m: MapaAtlas): Achado[] {
  const porFonte = new Map<string, (typeof m.props)[string][]>();
  let totalNaoVegetacao = 0;
  for (const o of Object.values(m.props)) {
    const id = ACERVO.idDaFonte(o.source);
    if (ehVegetacao(id)) continue;
    totalNaoVegetacao++;
    let lista = porFonte.get(id);
    if (!lista) {
      lista = [];
      porFonte.set(id, lista);
    }
    lista.push(o);
  }
  if (!totalNaoVegetacao) return [];
  const achados: Achado[] = [];
  for (const [id, lista] of porFonte) {
    const n = lista.length;
    const fracao = n / totalNaoVegetacao;
    if (n < LIMIAR_COPIAS_REPETICAO && !(n >= MIN_COPIAS_FRACAO_REPETICAO && fracao > LIMIAR_FRACAO_REPETICAO)) continue;
    achados.push({
      regra: 'repeticao',
      gravidade: 'aviso',
      mensagem: `A receita “${id}” repete ${n} vezes (${Math.round(fracao * 100)}% dos objetos que não são vegetação).`,
      sugestao: 'Alterne entre 3 a 5 receitas da mesma família para dar variedade visual.',
      ids: lista.slice(0, 10).map(o => o.id),
    });
  }
  return achados;
}

function regraManchaEmDisco(m: MapaAtlas): Achado[] {
  const res = m.terrain.resolution;
  const areaCel = res * res;
  const achados: Achado[] = [];
  for (const camada of Object.values(m.terrain.layers)) {
    const mat = MATERIAIS[camada.material];
    if (mat && (mat.uso === 'agua' || mat.uso === 'macico')) continue;
    const celulas = decodificar(camada.cells);
    if (celulas.length * areaCel < LIMIAR_AREA_MANCHA_DISCO) continue;
    const mapaIdx = new Map<string, number>();
    celulas.forEach(([x, y], i) => mapaIdx.set(`${x},${y}`, i));
    const visitado = new Uint8Array(celulas.length);
    for (let i = 0; i < celulas.length; i++) {
      if (visitado[i]) continue;
      const comp: [number, number][] = [];
      const fila: number[] = [i];
      visitado[i] = 1;
      for (let q = 0; q < fila.length; q++) {
        const idx = fila[q]!;
        const [cx, cy] = celulas[idx]!;
        comp.push([cx, cy]);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          const viz = mapaIdx.get(`${nx},${ny}`);
          if (viz !== undefined && !visitado[viz]) {
            visitado[viz] = 1;
            fila.push(viz);
          }
        }
      }
      const areaComp = comp.length * areaCel;
      if (areaComp < LIMIAR_AREA_MANCHA_DISCO) continue;
      let sx = 0, sy = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [cx, cy] of comp) {
        const mx = (cx + 0.5) * res;
        const my = (cy + 0.5) * res;
        sx += mx;
        sy += my;
        if (cx * res < minX) minX = cx * res;
        if (cy * res < minY) minY = cy * res;
        if ((cx + 1) * res > maxX) maxX = (cx + 1) * res;
        if ((cy + 1) * res > maxY) maxY = (cy + 1) * res;
      }
      const centroX = sx / comp.length;
      const centroY = sy / comp.length;
      let r = 0;
      for (const [cx, cy] of comp) {
        const d = Math.hypot((cx + 0.5) * res - centroX, (cy + 0.5) * res - centroY) + res * 0.5;
        if (d > r) r = d;
      }
      const razao = r > 0 ? areaComp / (Math.PI * r * r) : 0;
      if (razao > LIMIAR_CIRCULARIDADE_MANCHA) {
        achados.push({
          regra: 'mancha-em-disco',
          gravidade: 'dica',
          mensagem: `Mancha de terreno “${camada.material}” (${r1(areaComp)} m²) tem formato quase circular (razão ${ Math.round(razao * 100) / 100 }).`,
          sugestao: 'Use traços orgânicos (caminho, polígono irregular ou varios circulos de raios diferentes) em vez de um disco isolado.',
          ids: [camada.id],
          caixa: [r1(minX), r1(minY), r1(maxX), r1(maxY)],
        });
      }
    }
  }
  return achados;
}

function regraComposicaoCentralizada(m: MapaAtlas): Achado[] {
  if (!temTerrenoExterior(m)) return [];
  const W = m.bounds.width;
  const H = m.bounds.height;
  if (W <= 0 || H <= 0) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let temConstrucao = false;
  for (const s of Object.values(m.rooms)) {
    const c = caixaDoComodo(m, s);
    if (!c) continue;
    temConstrucao = true;
    if (c.x0 < x0) x0 = c.x0;
    if (c.y0 < y0) y0 = c.y0;
    if (c.x1 > x1) x1 = c.x1;
    if (c.y1 > y1) y1 = c.y1;
  }
  for (const o of Object.values(m.props)) {
    const id = ACERVO.idDaFonte(o.source);
    if (ehVegetacao(id)) continue;
    const c = caixaDoObjeto(o);
    temConstrucao = true;
    if (c.x0 < x0) x0 = c.x0;
    if (c.y0 < y0) y0 = c.y0;
    if (c.x1 > x1) x1 = c.x1;
    if (c.y1 > y1) y1 = c.y1;
  }
  if (!temConstrucao) return [];
  const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0);
  const cx1 = Math.min(W, x1), cy1 = Math.min(H, y1);
  if (cx1 <= cx0 || cy1 <= cy0) return [];
  const ocupacao = ((cx1 - cx0) * (cy1 - cy0)) / (W * H);
  if (ocupacao >= LIMIAR_OCUPACAO_COMPOSICAO) return [];
  const centroX = (cx0 + cx1) / 2;
  const centroY = (cy0 + cy1) / 2;
  const desvioX = Math.abs(centroX - W / 2) / W;
  const desvioY = Math.abs(centroY - H / 2) / H;
  if (desvioX >= LIMIAR_DESVIO_CENTRO_COMPOSICAO || desvioY >= LIMIAR_DESVIO_CENTRO_COMPOSICAO) return [];
  const margens = [cx0, W - cx1, cy0, H - cy1];
  const minM = Math.min(...margens);
  const maxM = Math.max(...margens);
  if (maxM <= 0 || (maxM - minM) / maxM >= LIMIAR_DIFERENCA_MARGENS_COMPOSICAO) return [];
  return [{
    regra: 'composicao-centralizada',
    gravidade: 'dica',
    mensagem: `Tudo o que foi construído ocupa ${Math.round(ocupacao * 100)}% do mapa no centro, cercado por margens quase iguais.`,
    sugestao: 'Deixe massas saírem pela borda (estrada, rio, mata) ou componha em diagonal.',
    ids: [],
    caixa: [r1(cx0), r1(cy0), r1(cx1), r1(cy1)],
  }];
}

function mapaEscuro(m: MapaAtlas): boolean {
  return ehNoite(m) || m.climate.ambient.intensity < LIMIAR_AMBIENTE_ESCURO;
}

function regraNoiteSemLuz(m: MapaAtlas): Achado[] {
  if (!mapaEscuro(m)) return [];
  const luzesAtivas = Object.values(m.lights).filter(l => nivelDaLuz(l, m) > 0);
  if (luzesAtivas.length === 0) {
    return [{
      regra: 'noite-sem-luz',
      gravidade: 'aviso',
      mensagem: 'O mapa tem ambiente escuro ou noturno e nenhuma luz acesa.',
      sugestao: 'Adicione fontes de luz com atlas_luzes ou objetos luminosos (tocha, poste, fogueira, lareira).',
      ids: [],
    }];
  }
  const salas = Object.values(m.rooms);
  if (!salas.length) return [];
  const arestas = arestasDeParede(m);
  const ativasIds = new Set(luzesAtivas.map(l => l.id));
  const algumTelhadoAberto = salas.some(s => !s.roof.visible);
  const achados: Achado[] = [];
  for (const s of salas) {
    if (s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function)) continue;
    const ins = insightDoComodo(m, s.id, arestas);
    if (!ins || ins.area < LIMIAR_AREA_COMODO_SEM_LUZ || ehSobradoDecorativoFechado(m, s, ins, algumTelhadoAberto)) continue;
    const temLuz = ins.luzes.some(id => ativasIds.has(id));
    if (!temLuz && ins.janelas.length === 0) {
      achados.push({
        regra: 'noite-sem-luz',
        gravidade: 'dica',
        mensagem: `O cômodo “${s.name}” (${r1(ins.area)} m²) está sem luz e sem janela num mapa escuro.`,
        sugestao: 'Adicione uma luz interna (vela, arandela, lareira) com atlas_luzes ou uma janela com atlas_portas.',
        ids: [s.id],
        caixa: tuplaCaixa(ins.caixa),
      });
    }
  }
  return achados;
}

function areaIntersecaoCaixa(a: Caixa, b: Caixa): number {
  const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}

function faixasTocamCaixa(faixas: readonly Faixa[], res: number, q: Caixa): boolean {
  for (const [y, x0, n] of faixas) {
    const cy0 = y * res, cy1 = (y + 1) * res;
    if (cy1 <= q.y0 || cy0 >= q.y1) continue;
    const cx0 = x0 * res, cx1 = (x0 + n) * res;
    if (cx1 > q.x0 && cx0 < q.x1) return true;
  }
  return false;
}

function regraErmosVazios(m: MapaAtlas): Achado[] {
  if (!temTerrenoExterior(m)) return [];
  const W = m.bounds.width, H = m.bounds.height;
  if (W < 40 || H < 40) return [];
  const hw = W / 2, hh = H / 2;
  const quadrantes: (Caixa & { nome: string })[] = [
    { nome: 'noroeste', x0: 0, y0: 0, x1: hw, y1: hh },
    { nome: 'nordeste', x0: hw, y0: 0, x1: W, y1: hh },
    { nome: 'sudoeste', x0: 0, y0: hh, x1: hw, y1: H },
    { nome: 'sudeste', x0: hw, y0: hh, x1: W, y1: H },
  ];
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  const res = m.terrain.resolution || 0.25;
  const salasTerreo = Object.values(m.rooms).filter(s => (s.levelId ?? null) === null);
  const propsTerreo = Object.values(m.props).filter(o => (o.levelId ?? null) === null);
  const camadas = Object.values(m.terrain.layers);
  const patamares = Object.values(m.terrain.relief?.patamares ?? {}).filter(p => p.altura !== 0);
  const achados: Achado[] = [];
  for (const q of quadrantes) {
    const areaQ = (q.x1 - q.x0) * (q.y1 - q.y0);
    if (areaQ <= 0) continue;
    let areaPredios = 0;
    for (const s of salasTerreo) {
      const cels = decodificar(s.cells);
      if (cels.length) {
        for (const [cx, cy] of cels) {
          const x0 = ox + cx * t, y0 = oy + cy * t;
          areaPredios += areaIntersecaoCaixa({ x0, y0, x1: x0 + t, y1: y0 + t }, q);
        }
      } else {
        const c = caixaDoComodo(m, s);
        if (c) areaPredios += areaIntersecaoCaixa(c, q);
      }
    }
    const fracaoFora = Math.max(0, (areaQ - Math.min(areaQ, areaPredios)) / areaQ);
    if (fracaoFora < 0.6) continue;
    const temProp = propsTerreo.some(o => {
      const c = caixaDoObjeto(o);
      return intersecta(c, q) || (o.position[0] >= q.x0 && o.position[0] <= q.x1 && o.position[1] >= q.y0 && o.position[1] <= q.y1);
    });
    if (temProp) continue;
    const temCamada = camadas.some(l => faixasTocamCaixa(l.cells, res, q));
    if (temCamada) continue;
    const temRelevo = patamares.some(p => faixasTocamCaixa(p.cells, res, q));
    if (temRelevo) continue;
    achados.push({
      regra: 'ermos-vazios',
      gravidade: 'aviso',
      mensagem: `O quadrante ${q.nome} tem ${Math.round(fracaoFora * 100)}% de área aberta sem objetos, terreno extra, água ou relevo.`,
      sugestao: 'Povoe o quadrante com atlas_espalhar, afloramentos de terreno (rocha.*, agua.*), trilhas (atlas_caminho) ou patamares de relevo.',
      ids: [],
      caixa: tuplaCaixa(q),
    });
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
  'casas-iguais': regraCasasIguais,
  'fileiras-mecanicas': regraFileirasMecanicas,
  'repeticao': regraRepeticao,
  'mancha-em-disco': regraManchaEmDisco,
  'composicao-centralizada': regraComposicaoCentralizada,
  'noite-sem-luz': regraNoiteSemLuz,
  'ermos-vazios': regraErmosVazios,
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
