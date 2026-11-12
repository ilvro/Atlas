import type { Ref } from '#mesa';
import { codificar, decodificar, subtrair, unir, type Celula, type Faixa } from '../domain/celulas.ts';
import { atualizarEscarpasDoMacico, mesmasFaixas } from '../domain/contorno.ts';
import { atualizarSalasDosObjetos, limparOrfaos, motivoDeNaoCaber, recalcularParedes } from '../domain/geometria.ts';
import type { Abertura, Comodo, MapaAtlas, Parede } from '../domain/mapa.ts';
import { suavizarMargem } from '../domain/agua.ts';
import { materialDe } from '../procedural/materiais.ts';
import { clonar } from './imutavel.ts';

export type ParcialProfundo<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? ParcialProfundo<T[K]> : T[K] };
export type CelulaDoComando = readonly [number, number];

/** Comandos de construção: cômodos, paredes, aberturas e terreno. Cômodos e paredes refazem as paredes derivadas. */
export type ComandoConstruir =
  | { tipo: 'comodo.criar'; id: string; nome: string; funcao: string | null; piso: Comodo['floor']; papel: Comodo['wallpaper']; celulas: readonly CelulaDoComando[] }
  | { tipo: 'comodo.pintar'; id: string; celulas: readonly CelulaDoComando[] }
  | { tipo: 'comodo.apagar'; celulas: readonly CelulaDoComando[] }
  | { tipo: 'comodo.atualizar'; id: string; patch: ParcialProfundo<Omit<Comodo, 'id' | 'cells'>> }
  | { tipo: 'comodo.remover'; id: string }
  | { tipo: 'comodo.notas'; id: string; patch: { leitura?: string; notasMestre?: string; refs?: Ref[] } }
  | { tipo: 'parede.adicionar'; parede: Omit<Parede, 'source'> }
  | { tipo: 'parede.atualizar'; id: string; patch: ParcialProfundo<Omit<Parede, 'id' | 'path' | 'source'>> }
  | { tipo: 'parede.remover'; id: string }
  | { tipo: 'parede.desanexar'; id: string }
  | { tipo: 'abertura.adicionar'; abertura: Abertura }
  | { tipo: 'abertura.atualizar'; id: string; patch: Partial<Pick<Abertura, 'at' | 'width' | 'kind' | 'state' | 'material' | 'som' | 'swing' | 'wallId'>> }
  | { tipo: 'abertura.remover'; id: string }
  /** `suavizar` (só água): arredonda a borda da camada onde a pincelada passou. */
  /** `lembrar` (água que sobe): guarda em `terrain.submerged` o que cada camada perdeu, para `terreno.emergir` devolver. Sem ele, pintar tira essas células do guardado. */
  | { tipo: 'terreno.pintar'; material: string; celulas: readonly CelulaDoComando[]; suavizar?: boolean; lembrar?: boolean }
  /** Água que baixa: nas células dessa água, devolve o terreno guardado em `submerged`; o que não tinha camada guardada some e mostra a base. */
  | { tipo: 'terreno.emergir'; material: string; celulas: readonly CelulaDoComando[] }
  | { tipo: 'terreno.apagar'; celulas: readonly CelulaDoComando[] }
  | { tipo: 'terreno.base'; material: string }
  /** Correnteza da camada de água desse material (`angle` em rad, `speed` de 0 a 3 m/s); `null` deixa a água parada. */
  | { tipo: 'terreno.correnteza'; material: string; flow: { angle: number; speed: number } | null }
  | { tipo: 'presenca.pintar'; brush: string; celulas: readonly CelulaDoComando[]; intensidade?: number }
  | { tipo: 'presenca.apagar'; brush: string | null; celulas: readonly CelulaDoComando[] };

export const TIPOS_DE_CONSTRUCAO = ['comodo.criar', 'comodo.pintar', 'comodo.apagar', 'comodo.atualizar', 'comodo.remover', 'comodo.notas', 'parede.adicionar', 'parede.atualizar', 'parede.remover', 'parede.desanexar', 'abertura.adicionar', 'abertura.atualizar', 'abertura.remover', 'terreno.pintar', 'terreno.emergir', 'terreno.apagar', 'terreno.base', 'terreno.correnteza', 'presenca.pintar', 'presenca.apagar'] as const;
export const ehComandoDeConstrucao = (c: { tipo: string }): c is ComandoConstruir => (TIPOS_DE_CONSTRUCAO as readonly string[]).includes(c.tipo);

export const ROTULOS_CONSTRUIR: Record<ComandoConstruir['tipo'], string> = {
  'comodo.criar': 'Criar cômodo', 'comodo.pintar': 'Pintar cômodo', 'comodo.apagar': 'Apagar cômodo', 'comodo.atualizar': 'Editar cômodo', 'comodo.remover': 'Remover cômodo', 'comodo.notas': 'Notas do cômodo',
  'parede.adicionar': 'Desenhar parede', 'parede.atualizar': 'Editar parede', 'parede.remover': 'Remover parede', 'parede.desanexar': 'Desanexar parede',
  'abertura.adicionar': 'Pôr abertura', 'abertura.atualizar': 'Editar abertura', 'abertura.remover': 'Remover abertura',
  'terreno.pintar': 'Pintar terreno', 'terreno.apagar': 'Apagar terreno', 'terreno.emergir': 'Água que baixa', 'terreno.base': 'Terreno base', 'terreno.correnteza': 'Correnteza da água',
  'presenca.pintar': 'Pintar presença', 'presenca.apagar': 'Apagar presença',
};

/** Um comando que não pode ser aplicado (alvo inexistente, valor que o mapa não aceita). */
export class ErroDeComando extends Error { constructor(mensagem: string) { super(mensagem); this.name = 'ErroDeComando'; } }
const nao = (msg: string): never => { throw new ErroDeComando(msg); };
const ehPlano = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const chave = (x: number, y: number) => y * 200_003 + x;

function mesclar(alvo: Record<string, any>, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete alvo[k];
    else if (ehPlano(v) && ehPlano(alvo[k])) mesclar(alvo[k], v);
    else alvo[k] = clonar(v);
  }
}

const normais = (cel: readonly CelulaDoComando[]): Celula[] => cel.map(([x, y]) => {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) nao(`Célula inválida: ${x}, ${y}.`);
  return [x, y] as const;
});

/** Dá as `celulas` ao cômodo `id`, tirando-as de quem as tinha; cômodos que ficam sem células deixam de existir. */
function darCelulas(m: MapaAtlas, id: string, celulas: readonly Celula[]): void {
  const sala = m.rooms[id] ?? nao(`O cômodo “${id}” não existe.`);
  const novas = codificar(celulas);
  const doOutro = new Map<string, Celula[]>();
  for (const outra of Object.values(m.rooms)) {
    if (outra.id === id) continue;
    const dela = new Set(decodificar(outra.cells).map(([x, y]) => chave(x, y))), roubadas = celulas.filter(([x, y]) => dela.has(chave(x, y)));
    if (roubadas.length) doOutro.set(outra.id, roubadas as Celula[]);
  }
  sala.cells = unir(sala.cells, novas);
  for (const [outraId, roubadas] of doOutro) m.rooms[outraId]!.cells = subtrair(m.rooms[outraId]!.cells, codificar(roubadas));
  removerVazios(m);
}

function removerVazios(m: MapaAtlas): void { for (const s of Object.values(m.rooms)) if (!s.cells.length) delete m.rooms[s.id]; }

const idDaPresenca = (brush: string) => `p_${brush.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;
/** Uma semente estável por pincel: a mesma presença tem a mesma cara em qualquer cópia do mapa. */
const sementeDe = (texto: string) => { let h = 2166136261; for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 2 ** 31; };
const intersecao = (a: readonly Faixa[], b: readonly Faixa[]): Faixa[] => subtrair(a, subtrair(a, b));
/** Tira `celulas` do que a água guardou; entradas vazias somem, e o campo some quando não sobra nada. */
function tirarDoGuardado(m: MapaAtlas, celulas: readonly Faixa[]): void {
  const g = m.terrain.submerged; if (!g) return;
  for (const [id, e] of Object.entries(g)) { e.cells = subtrair(e.cells, celulas); if (!e.cells.length) delete g[id]; }
  if (!Object.keys(g).length) delete m.terrain.submerged;
}
const idDaCamada = (material: string) => `t_${material.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;

/** As células de cada camada antes de um comando de terreno; depois dele, `camadasMudadas` diz quais camadas (e quais sumiram) foram mexidas. */
const guardarCamadas = (m: MapaAtlas) => new Map(Object.values(m.terrain.layers).map(l => [l.id, l.cells] as const));
function camadasMudadas(m: MapaAtlas, antes: ReadonlyMap<string, MapaAtlas['terrain']['layers'][string]['cells']>): Set<string> {
  const mudadas = new Set<string>();
  for (const l of Object.values(m.terrain.layers)) { const a = antes.get(l.id); if (!a || !mesmasFaixas(a, l.cells)) mudadas.add(l.id); }
  return mudadas;
}

export function aplicarConstrucao(m: MapaAtlas, c: ComandoConstruir): void {
  switch (c.tipo) {
    case 'comodo.criar': {
      if (m.rooms[c.id]) nao(`Já existe o cômodo “${c.id}”.`);
      const cel = normais(c.celulas); if (!cel.length) nao('Um cômodo precisa de pelo menos uma célula.');
      m.rooms[c.id] = { id: c.id, name: c.nome, function: c.funcao, cells: [], floor: clonar(c.piso), wallpaper: c.papel ? clonar(c.papel) : null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null };
      darCelulas(m, c.id, cel); recalcularParedes(m); break;
    }
    case 'comodo.pintar': darCelulas(m, c.id, normais(c.celulas)); recalcularParedes(m); break;
    case 'comodo.apagar': {
      const tirar = codificar(normais(c.celulas));
      for (const s of Object.values(m.rooms)) s.cells = subtrair(s.cells, tirar);
      removerVazios(m); recalcularParedes(m); break;
    }
    case 'comodo.atualizar': {
      const s = m.rooms[c.id] ?? nao(`O cômodo “${c.id}” não existe.`);
      if ('id' in c.patch || 'cells' in c.patch) nao('Identificador e células não se editam assim.');
      mesclar(s, c.patch as Record<string, unknown>); break;
    }
    case 'comodo.notas': {
      if (!m.rooms[c.id]) nao(`O cômodo “${c.id}” não existe.`);
      const n = (m.comodosExtra[c.id] ??= { id: c.id, leitura: '', notasMestre: '', refs: [] });
      if (c.patch.leitura !== undefined) n.leitura = c.patch.leitura;
      if (c.patch.notasMestre !== undefined) n.notasMestre = c.patch.notasMestre;
      if (c.patch.refs !== undefined) n.refs = clonar(c.patch.refs) as Ref[];
      // Um cômodo sem nada escrito não precisa de entrada.
      if (!n.leitura && !n.notasMestre && !n.refs.length) delete m.comodosExtra[c.id];
      break;
    }
    case 'comodo.remover': { if (!m.rooms[c.id]) nao(`O cômodo “${c.id}” não existe.`); delete m.rooms[c.id]; recalcularParedes(m); break; }

    case 'parede.adicionar': {
      if (m.walls[c.parede.id]) nao(`Já existe a parede “${c.parede.id}”.`);
      const p = c.parede.path;
      if (p.length < 2 || p.every(q => q[0] === p[0]![0] && q[1] === p[0]![1])) nao('Uma parede precisa de dois pontos diferentes.');
      m.walls[c.parede.id] = { ...clonar(c.parede), source: null }; recalcularParedes(m); break;
    }
    case 'parede.atualizar': { const p = m.walls[c.id] ?? nao(`A parede “${c.id}” não existe.`); mesclar(p, c.patch as Record<string, unknown>); break; }
    case 'parede.remover': {
      const p = m.walls[c.id] ?? nao(`A parede “${c.id}” não existe.`);
      if (p.source) nao('terrainLayerId' in p.source ? 'Esta parede segue o maciço. Desanexe-a antes, ou mude o terreno.' : 'Esta parede segue o cômodo. Desanexe-a antes, ou mude o cômodo.');
      delete m.walls[c.id]; for (const a of Object.values(m.openings)) if (a.wallId === c.id) delete m.openings[a.id];
      for (const o of Object.values(m.props)) if (o.wall?.wallId === c.id) delete m.props[o.id];
      recalcularParedes(m); break;
    }
    case 'parede.desanexar': {
      const p = m.walls[c.id] ?? nao(`A parede “${c.id}” não existe.`);
      if (!p.source) nao('Esta parede já é sua.');
      p.source = null; recalcularParedes(m); break;
    }

    case 'abertura.adicionar': {
      if (m.openings[c.abertura.id]) nao(`Já existe a abertura “${c.abertura.id}”.`);
      const motivo = motivoDeNaoCaber(m, c.abertura); if (motivo) nao(motivo);
      m.openings[c.abertura.id] = clonar(c.abertura); break;
    }
    case 'abertura.atualizar': {
      const a = m.openings[c.id] ?? nao(`A abertura “${c.id}” não existe.`);
      const depois = { ...JSON.parse(JSON.stringify(a)), ...c.patch };
      const motivo = motivoDeNaoCaber(m, depois); if (motivo) nao(motivo);
      mesclar(a, c.patch as Record<string, unknown>); break;
    }
    case 'abertura.remover': { if (!m.openings[c.id]) nao(`A abertura “${c.id}” não existe.`); delete m.openings[c.id]; m.session.revealed = m.session.revealed.filter(x => x !== c.id); break; }

    case 'terreno.pintar': {
      const antes = guardarCamadas(m);
      const cel = normais(c.celulas), novas = codificar(cel), id = idDaCamada(c.material);
      m.terrain.layers[id] ??= { id, material: c.material, cells: [], order: Object.keys(m.terrain.layers).length, flow: null };
      for (const camada of Object.values(m.terrain.layers)) if (camada.id !== id) {
        if (c.lembrar && !(materialDe(camada.material).uso === 'agua' && camada.material !== c.material)) {
          const perdidas = intersecao(camada.cells, novas);
          if (perdidas.length) { const g = (m.terrain.submerged ??= {}); g[camada.id] = { material: camada.material, order: camada.order, cells: unir(g[camada.id]?.cells ?? [], perdidas) }; }
        }
        camada.cells = subtrair(camada.cells, novas);
      }
      if (!c.lembrar) tirarDoGuardado(m, novas);
      m.terrain.layers[id]!.cells = unir(m.terrain.layers[id]!.cells, novas);
      if (c.suavizar && materialDe(c.material).uso === 'agua' && cel.length) { const xs = cel.map(q => q[0]), ys = cel.map(q => q[1]); m.terrain.layers[id]!.cells = suavizarMargem(m.terrain.layers[id]!.cells, { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }); }
      for (const camada of Object.values(m.terrain.layers)) if (!camada.cells.length) delete m.terrain.layers[camada.id];
      atualizarEscarpasDoMacico(m, camadasMudadas(m, antes)); break;
    }
    case 'terreno.emergir': {
      const antes = guardarCamadas(m);
      const aguas = Object.values(m.terrain.layers).filter(l => l.material === c.material);
      const pedidas = codificar(normais(c.celulas));
      const daAgua = aguas.reduce<Faixa[]>((acc, l) => unir(acc, intersecao(l.cells, pedidas)), []);
      if (!daAgua.length) break;
      for (const camada of Object.values(m.terrain.layers)) camada.cells = subtrair(camada.cells, daAgua);
      for (const [cid, g] of Object.entries(m.terrain.submerged ?? {})) {
        const volta = intersecao(g.cells, daAgua);
        if (!volta.length) continue;
        m.terrain.layers[cid] ??= { id: cid, material: g.material, cells: [], order: g.order ?? Object.keys(m.terrain.layers).length, flow: null };
        m.terrain.layers[cid]!.cells = unir(m.terrain.layers[cid]!.cells, volta);
      }
      tirarDoGuardado(m, daAgua);
      for (const camada of Object.values(m.terrain.layers)) if (!camada.cells.length) delete m.terrain.layers[camada.id];
      atualizarEscarpasDoMacico(m, camadasMudadas(m, antes)); break;
    }
    case 'terreno.apagar': {
      const antes = guardarCamadas(m);
      const tirar = codificar(normais(c.celulas));
      for (const camada of Object.values(m.terrain.layers)) { camada.cells = subtrair(camada.cells, tirar); if (!camada.cells.length) delete m.terrain.layers[camada.id]; }
      atualizarEscarpasDoMacico(m, camadasMudadas(m, antes)); break;
    }
    case 'terreno.base': m.terrain.base = c.material; break;
    case 'terreno.correnteza': {
      const camada = m.terrain.layers[idDaCamada(c.material)] ?? nao('Não há água desse material no mapa.');
      if (materialDe(camada.material).uso !== 'agua') nao('Só a água tem correnteza.');
      if (c.flow && !(Number.isFinite(c.flow.angle) && Number.isFinite(c.flow.speed) && c.flow.speed >= 0 && c.flow.speed <= 3)) nao('A correnteza vai de 0 a 3 m/s.');
      camada.flow = c.flow && c.flow.speed > 0 ? { angle: c.flow.angle, speed: c.flow.speed } : null; break;
    }
    case 'presenca.pintar': {
      if (!c.brush) nao('Escolha um pincel de presença.');
      const id = idDaPresenca(c.brush);
      m.presence[id] ??= { id, brush: c.brush, cells: [], intensity: 0.6, seed: sementeDe(c.brush), gmOnly: false };
      m.presence[id]!.cells = unir(m.presence[id]!.cells, codificar(normais(c.celulas)));
      if (c.intensidade !== undefined) m.presence[id]!.intensity = Math.min(1, Math.max(0, c.intensidade));
      break;
    }
    case 'presenca.apagar': {
      const tirar = codificar(normais(c.celulas));
      for (const p of Object.values(m.presence)) {
        if (c.brush !== null && p.brush !== c.brush) continue;
        p.cells = subtrair(p.cells, tirar); if (!p.cells.length) delete m.presence[p.id];
      }
      break;
    }
    default: { const _fim: never = c; nao(`Comando desconhecido: ${JSON.stringify(_fim)}`); }
  }
  if (c.tipo.startsWith('comodo.') || c.tipo.startsWith('parede.')) limparOrfaos(m); else if (c.tipo.startsWith('abertura.')) atualizarSalasDosObjetos(m);
}
