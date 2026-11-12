/**
 * Construção em comandos: as operações do kit dos exemplos (terreno, cômodos, paredes, portas, objetos, espalhar, luzes, regiões)
 * como funções PURAS. Cada uma recebe o `MapaAtlas` atual e devolve `{ comandos, ids }` sem tocar no documento; quem chama aplica
 * os comandos (store, transação) ou encadeia com `aplicarEmCopia`. Unidades: metros, exceto `comodos` (células do grid, fim exclusivo).
 * Aleatoriedade (rotação e semente dos objetos, borda irregular, espalhar) vem de `semente`; ids vêm de `gerarId` (padrão `novoIdEntidade`).
 */
import { ACERVO } from '../procedural/acervo.ts';
import { MATERIAIS, materiaisDo, type Material } from '../procedural/materiais.ts';
import { mulberry32 } from '../procedural/ruido.ts';
import { novaLuz, novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import { PAREDE_PADRAO, encaixarNaParede, motivoDeNaoCaber } from '../domain/geometria.ts';
import type { Abertura, MapaAtlas, Objeto, Parede, Ponto, Regiao } from '../domain/mapa.ts';
import { PRESETS_DE_LUZ, TIPOS_DE_COMODO, camposDoPreset, presetDeLuz, tipoDeComodo } from '../domain/presets.ts';
import { aplicarComando, type Comando } from '../state/comandos.ts';
import { TODOS_OS_CONJUNTOS, conjuntoDeEspalhar, espalhar as espalharConjunto } from './espalhar.ts';
import { celulasDaForma, medirForma, sementeDaForma, type Forma, type Ret } from './formas.ts';

export type { Forma, Ret };

/** Entrada inválida (item, material, tipo ou predefinição desconhecidos; porta sem parede). A mensagem diz o que existe. */
export class ErroDeConstrucao extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = 'ErroDeConstrucao'; }
}

/** O que cada função devolve: os comandos para aplicar em ordem e os ids das entidades criadas. */
export interface Construcao { comandos: Comando[]; ids: string[] }
export type GeradorDeId = (prefixo: string) => string;

/** Aplica os comandos numa cópia (o mapa recebido fica intacto): o caminho para encadear passos, como cômodos e depois portas. */
export function aplicarEmCopia(mapa: MapaAtlas, comandos: readonly Comando[]): MapaAtlas {
  let m = mapa;
  for (const c of comandos) m = aplicarComando(m, c);
  return m;
}

const lista = (ids: readonly string[]) => ids.join(', ');
const resumo = (ids: readonly string[], max = 40) => (ids.length > max ? `${lista(ids.slice(0, max))}… (${ids.length} no total)` : lista(ids));

function verificarMaterial(id: string, usos: readonly Material['uso'][], rotulo: string): void {
  if (id.startsWith('#') || ((usos as readonly string[]).includes('terreno') && (id.startsWith('grama#') || id.startsWith('grama:')))) return;
  const m = MATERIAIS[id];
  if (m && usos.includes(m.uso)) return;
  const validos = usos.flatMap(u => materiaisDo(u)).map(x => x.id);
  throw new ErroDeConstrucao(`material “${id}” ${m ? `não serve para ${rotulo}` : 'não existe'}; materiais de ${rotulo}: ${lista(validos)}`);
}

// ---------- Terreno ----------
export interface OpDeTerreno { acao: 'pintar' | 'apagar'; material?: string; forma: Forma }

/** Pinta ou apaga terreno em formas (metros). `pintar` exige `material` de terreno, maciço ou água. */
export function terreno(mapa: MapaAtlas, ops: readonly OpDeTerreno[], semente = 1, _gerarId: GeradorDeId = novoIdEntidade): Construcao {
  const comandos: Comando[] = [], res = mapa.terrain.resolution;
  ops.forEach((op, n) => {
    if (op.acao !== 'pintar' && op.acao !== 'apagar') throw new ErroDeConstrucao(`ação “${String(op.acao)}” não existe; ações: pintar, apagar`);
    if (op.acao === 'pintar') {
      if (!op.material) throw new ErroDeConstrucao(`pintar exige um material; materiais de terreno: ${lista(['terreno', 'macico', 'agua'].flatMap(u => materiaisDo(u as Material['uso'])).map(x => x.id))}`);
      verificarMaterial(op.material, ['terreno', 'macico', 'agua'], 'terreno');
    }
    const celulas = celulasDaForma(op.forma, { resolucao: res, largura: mapa.bounds.width, altura: mapa.bounds.height, semente: sementeDaForma(Math.floor(semente) || 1, n) });
    if (!celulas.length) return;
    comandos.push(op.acao === 'pintar' ? { tipo: 'terreno.pintar', material: op.material!, celulas } : { tipo: 'terreno.apagar', celulas });
  });
  return { comandos, ids: [] };
}

// ---------- Cômodos ----------
export interface PedidoDeComodo { rets: readonly Ret[]; tipo: string; nome?: string; piso?: string; papel?: string; telhado?: string | null; telhadoVisivel?: boolean }

/** Cômodos em células do grid (`[x0, y0, x1, y1]`, fim exclusivo); várias `rets` fazem um cômodo em L. As paredes derivam sozinhas. */
export function comodos(mapa: MapaAtlas, pedidos: readonly PedidoDeComodo[], semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  void mapa;
  const rng = mulberry32(Math.floor(semente) || 1), comandos: Comando[] = [], ids: string[] = [];
  for (const p of pedidos) {
    const t = tipoDeComodo(p.tipo);
    if (!t) throw new ErroDeConstrucao(`tipo de cômodo “${p.tipo}” não existe; tipos: ${lista(TIPOS_DE_COMODO.map(x => x.id))}`);
    if (!p.rets.length) throw new ErroDeConstrucao('um cômodo precisa de ao menos um retângulo [x0, y0, x1, y1]');
    if (p.piso) verificarMaterial(p.piso, ['piso'], 'piso');
    if (p.papel) verificarMaterial(p.papel, ['papel'], 'papel de parede');
    if (p.telhado) verificarMaterial(p.telhado, ['telhado'], 'telhado');
    const celulas: [number, number][] = [];
    for (const [x0, y0, x1, y1] of p.rets) {
      if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) throw new ErroDeConstrucao(`retângulo inválido [${x0}, ${y0}, ${x1}, ${y1}]: use [x0, y0, x1, y1] em células do grid, com x1 > x0 e y1 > y0`);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) celulas.push([x, y]);
    }
    const id = gerarId('c');
    comandos.push({
      tipo: 'comodo.criar', id, nome: p.nome ?? t.nome, funcao: t.funcao, celulas,
      piso: { material: p.piso ?? t.piso, seed: Math.floor(rng() * 2 ** 31) },
      papel: { material: p.papel ?? t.papel, seed: Math.floor(rng() * 2 ** 31) },
    });
    if (p.telhado !== undefined || p.telhadoVisivel !== undefined) {
      comandos.push({ tipo: 'comodo.atualizar', id, patch: { roof: { material: p.telhado ?? null, visible: p.telhadoVisivel ?? true } } });
    }
    ids.push(id);
  }
  return { comandos, ids };
}

// ---------- Paredes ----------
export interface PedidoDeParede { path: readonly Ponto[]; kind?: Parede['kind']; altura?: number; espessura?: number; material?: string; drop?: Parede['drop'] }
const TIPOS_DE_PAREDE: readonly Parede['kind'][] = ['wall', 'low', 'fence', 'cliff'];

/** Paredes avulsas (muro, cerca, mureta) ao longo de polilinhas em metros. */
export function paredes(mapa: MapaAtlas, pedidos: readonly PedidoDeParede[], _semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  void mapa;
  const comandos: Comando[] = [], ids: string[] = [];
  for (const p of pedidos) {
    if (p.path.length < 2) throw new ErroDeConstrucao('uma parede precisa de ao menos 2 pontos em path');
    if (p.kind && !TIPOS_DE_PAREDE.includes(p.kind)) throw new ErroDeConstrucao(`tipo de parede “${p.kind}” não existe; tipos: ${lista(TIPOS_DE_PAREDE)}`);
    const id = gerarId('w');
    const parede: Omit<Parede, 'source'> = { ...structuredClone(PAREDE_PADRAO), id, path: p.path.map(q => [q[0], q[1]] as Ponto) };
    if (p.kind) {
      parede.kind = p.kind;
      if (p.kind === 'low' || p.kind === 'fence' || p.kind === 'cliff') {
        parede.blocks = { move: true, sight: false, light: false };
      }
      if (p.kind === 'cliff') {
        parede.drop = p.drop ?? 'b';
        parede.height = p.altura ?? 3;
        parede.thickness = p.espessura ?? 0.4;
        parede.material = p.material ?? 'rocha.cinza';
      }
    }
    if (p.altura !== undefined) parede.height = p.altura;
    if (p.espessura !== undefined) parede.thickness = p.espessura;
    if (p.material) parede.material = p.material;
    if (p.drop !== undefined) parede.drop = p.drop;
    comandos.push({ tipo: 'parede.adicionar', parede });
    ids.push(id);
  }
  return { comandos, ids };
}

// ---------- Portas ----------
export interface PedidoDePorta { perto: Ponto; tipo?: Abertura['kind']; estado?: Abertura['state']; largura?: number }
const TIPOS_DE_ABERTURA: readonly Abertura['kind'][] = ['door', 'window', 'arch', 'secret'];
const ESTADOS_DE_ABERTURA: readonly Abertura['state'][] = ['closed', 'open', 'locked'];

/**
 * Aberturas na parede mais próxima de cada ponto, encaixadas no centro de uma célula. Encaixam sobre o `mapa` recebido, então ele já deve ter
 * os cômodos/paredes (use `aplicarEmCopia(mapa, comodos(...).comandos)` antes). Cada abertura vê as anteriores da mesma lista.
 */
export function portas(mapa: MapaAtlas, pedidos: readonly PedidoDePorta[], _semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  const comandos: Comando[] = [], ids: string[] = [];
  let atual = mapa;
  for (const p of pedidos) {
    const tipo = p.tipo ?? 'door', estado = p.estado ?? 'closed', largura = p.largura ?? 0.9;
    if (!TIPOS_DE_ABERTURA.includes(tipo)) throw new ErroDeConstrucao(`tipo de abertura “${tipo}” não existe; tipos: ${lista(TIPOS_DE_ABERTURA)}`);
    if (!ESTADOS_DE_ABERTURA.includes(estado)) throw new ErroDeConstrucao(`estado “${estado}” não existe; estados: ${lista(ESTADOS_DE_ABERTURA)}`);
    const e = encaixarNaParede(atual, p.perto, largura);
    if (!e) throw new ErroDeConstrucao(`não há parede perto de [${p.perto[0]}, ${p.perto[1]}] para a abertura; crie o cômodo ou a parede antes e aponte para a parede (até ~0,75 m)`);
    const abertura: Abertura = { id: gerarId('a'), wallId: e.parede.id, at: e.at, width: largura, kind: tipo, state: estado, material: 'madeira.media', som: null, swing: 'a' };
    const motivo = motivoDeNaoCaber(atual, abertura);
    if (motivo) throw new ErroDeConstrucao(motivo);
    const comando: Comando = { tipo: 'abertura.adicionar', abertura };
    atual = aplicarComando(atual, comando);
    comandos.push(comando); ids.push(abertura.id);
  }
  return { comandos, ids };
}

// ---------- Objetos ----------
export interface PedidoDeObjeto { item: string; pos: Ponto; rotacao?: number; escala?: number; params?: Record<string, unknown>; camada?: Objeto['elevation']; submerso?: boolean; oculto?: boolean }
const CAMADAS: readonly Objeto['elevation'][] = ['floor', 'table', 'wall', 'ceiling', 'underwater'];

function itemInvalido(item: string): ErroDeConstrucao {
  const termo = item.toLowerCase().replace(/^casa:/, ''), todos = ACERVO.lista();
  const parecidos = todos.filter(i => termo && (i.id.includes(termo) || i.nome.toLowerCase().includes(termo) || i.tags.includes(termo))).map(i => i.id);
  const sugestao = parecidos.length ? `parecidos: ${resumo(parecidos, 15)}` : `itens do acervo: ${resumo(todos.map(i => i.id), 40)}`;
  return new ErroDeConstrucao(`item “${item}” não existe; ${sugestao}`);
}

/** Objetos do acervo (receita ou `casa:<nome>`) em posições em metros. Sem `rotacao`, sorteia pela semente. */
export function objetos(mapa: MapaAtlas, pedidos: readonly PedidoDeObjeto[], semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  void mapa;
  const rng = mulberry32(Math.floor(semente) || 1), comandos: Comando[] = [], ids: string[] = [];
  for (const p of pedidos) {
    const info = ACERVO.item(p.item); if (!info) throw itemInvalido(p.item);
    if (p.camada && !CAMADAS.includes(p.camada)) throw new ErroDeConstrucao(`camada “${p.camada}” não existe; camadas: ${lista(CAMADAS)}`);
    const submerso = (p.submerso ?? info.submerso) ? { elevation: 'underwater' as const, castsShadow: false, blocks: { move: false, sight: false } } : {};
    const seed = Math.floor(rng() * 2 ** 31), rotation = p.rotacao ?? rng() * Math.PI * 2;
    const o = novoObjeto([p.pos[0], p.pos[1]], {
      id: gerarId('o'), source: ACERVO.fonte(p.item, seed, p.params), rotation, ...submerso,
      ...(p.escala !== undefined ? { scale: p.escala } : {}), ...(p.camada ? { elevation: p.camada } : {}),
      ...(typeof p.oculto === 'boolean' ? { oculto: p.oculto } : {}),
    });
    comandos.push({ tipo: 'item.adicionar', colecao: 'props', item: o as unknown as { id: string } & Record<string, unknown> });
    ids.push(o.id);
  }
  return { comandos, ids };
}

// ---------- Espalhar ----------
export interface PedidoDeEspalhar { conjunto: string; forma: Forma; densidade?: number }

/** Espalha um conjunto (`mata`, `jardim`, `cemiterio`, `bagunca`…) dentro da forma. Aproximado, como `kit.espalhar`. */
export function espalhar(mapa: MapaAtlas, pedido: PedidoDeEspalhar, semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  if (!conjuntoDeEspalhar(pedido.conjunto)) throw new ErroDeConstrucao(`conjunto “${pedido.conjunto}” não existe; conjuntos: ${lista(TODOS_OS_CONJUNTOS.map(c => c.id))}`);
  const s = Math.floor(semente) || 1, rng = mulberry32(s), res = mapa.terrain.resolution;
  const { caixa, sdf, dentro } = medirForma(pedido.forma, res, sementeDaForma(s, 0));
  const w = caixa.x1 - caixa.x0, h = caixa.y1 - caixa.y0;
  const R = Math.min(2.5, Math.max(1, Math.min(w, h) / 2)), passo = R * 1.1;
  const centros: Ponto[] = [[(caixa.x0 + caixa.x1) / 2, (caixa.y0 + caixa.y1) / 2]];
  for (let y = caixa.y0; y <= caixa.y1 + passo; y += passo) for (let x = caixa.x0; x <= caixa.x1 + passo; x += passo) centros.push([x, y]);
  // Cópia de trabalho: o espalhar conta o que já existe, inclusive o que este mesmo pedido pôs.
  const rascunho = structuredClone(mapa) as MapaAtlas, comandos: Comando[] = [], ids: string[] = [];
  for (const centro of centros) {
    if (sdf(centro) > R * 0.3) continue;
    const novos = espalharConjunto(rascunho, { centro, raio: R, conjunto: pedido.conjunto, semente: rng() * 1000, gerarId, densidade: pedido.densidade });
    for (const n of novos) {
      if (!dentro(n.position)) continue;
      rascunho.props[n.id] = n; ids.push(n.id);
      comandos.push({ tipo: 'item.adicionar', colecao: 'props', item: n as unknown as { id: string } & Record<string, unknown> });
    }
  }
  return { comandos, ids };
}

// ---------- Luzes ----------
export interface PedidoDeLuz { preset: string; pos: Ponto; direcao?: number; raio?: number; cor?: string; intensidade?: number }

/** Luzes a partir de predefinições (`vela`, `tocha`, `fogueira`, `lanterna`…). `direcao` (rad) vale para cones. */
export function luzes(mapa: MapaAtlas, pedidos: readonly PedidoDeLuz[], _semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  void mapa;
  const comandos: Comando[] = [], ids: string[] = [];
  for (const p of pedidos) {
    const preset = presetDeLuz(p.preset);
    if (!preset) throw new ErroDeConstrucao(`predefinição de luz “${p.preset}” não existe; predefinições: ${lista(PRESETS_DE_LUZ.map(x => x.id))}`);
    const l = novaLuz([p.pos[0], p.pos[1]], {
      id: gerarId('l'), ...camposDoPreset(preset, p.direcao ?? 0),
      ...(p.raio !== undefined ? { radius: p.raio } : {}), ...(p.cor !== undefined ? { color: p.cor } : {}), ...(p.intensidade !== undefined ? { intensity: p.intensidade } : {}),
    });
    comandos.push({ tipo: 'item.adicionar', colecao: 'lights', item: l as unknown as { id: string } & Record<string, unknown> });
    ids.push(l.id);
  }
  return { comandos, ids };
}

// ---------- Regiões ----------
export interface PedidoDeRegiao { poligono: readonly Ponto[]; tipo: Regiao['kind']; nome?: string; texto?: string; somenteMestre?: boolean }
const TIPOS_DE_REGIAO: readonly Regiao['kind'][] = ['reveal', 'trigger', 'note', 'audio'];

/** Regiões (`reveal`, `trigger`, `note`, `audio`) como polígonos em metros. */
export function regioes(mapa: MapaAtlas, pedidos: readonly PedidoDeRegiao[], _semente = 1, gerarId: GeradorDeId = novoIdEntidade): Construcao {
  void mapa;
  const comandos: Comando[] = [], ids: string[] = [];
  for (const p of pedidos) {
    if (!TIPOS_DE_REGIAO.includes(p.tipo)) throw new ErroDeConstrucao(`tipo de região “${p.tipo}” não existe; tipos: ${lista(TIPOS_DE_REGIAO)}`);
    if (p.poligono.length < 3) throw new ErroDeConstrucao('uma região precisa de ao menos 3 pontos em poligono');
    const id = gerarId('r'), payload: Record<string, unknown> = {};
    if (p.nome) payload.nome = p.nome;
    if (p.texto) payload.texto = p.texto;
    const r: Regiao = { id, polygon: p.poligono.map(q => [q[0], q[1]] as Ponto), kind: p.tipo, gmOnly: p.somenteMestre ?? true, payload, refs: [] };
    comandos.push({ tipo: 'item.adicionar', colecao: 'regions', item: r as unknown as { id: string } & Record<string, unknown> });
    ids.push(id);
  }
  return { comandos, ids };
}
