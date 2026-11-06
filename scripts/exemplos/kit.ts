/**
 * Kit dos mapas de exemplo: um construtor fluente sobre um `MapaAtlas`, para montar mapas grandes por script.
 * Puro (só `src/domain`, `src/authoring` e `src/procedural`): roda no Node, sem navegador. Mesma semente, mesmo JSON.
 *
 * Unidades: tudo em METROS (posições, raios, larguras, polilinhas), exceto `comodo`, que usa CÉLULAS DO GRID
 * (`[x0, y0, x1, y1]`, fim exclusivo; a célula padrão tem 1,5 m) e a forma `{ celulas }`, que usa células do TERRENO (`terrain.resolution`, 0,25 m).
 * Pintar terreno é exclusivo, como o pincel do editor: o que se pinta por cima tira a célula das outras camadas.
 *
 * Exemplo curto:
 *
 *   import { Kit } from './kit.ts';
 *   const k = new Kit({ id: 'meu-mapa', nome: 'Meu mapa', largura: 30, altura: 20, semente: 7 });
 *   k.base('grama');                                                       // o fundo do terreno
 *   k.pintar('terra', { faixa: [[0, 10], [15, 8], [30, 11]], largura: 2, irregular: 0.3 });   // trilha com borda torta
 *   k.pintar('areia', { disco: [22, 5], raio: 3, irregular: 0.5 });        // uma clareira
 *   k.espalhar('mata', { poligono: [[2, 2], [12, 2], [10, 7], [2, 6]] });  // árvores dentro da forma
 *   k.objeto('casa:arvore-5m', [16, 14]);                                  // um objeto avulso (receita ou item da coleção)
 *   k.luz('fogueira', [15, 9]);                                            // luz a partir de uma predefinição
 *   k.comodo([8, 4, 11, 7], 'taverna', { nome: 'Cabana' });                // cômodo em células do grid (+ paredes derivadas)
 *   k.porta([12, 8.25]);                                                   // porta na parede mais próxima do ponto
 *   k.clima('entardecer'); k.acabamento('quente');
 *   const mapa = k.construir();                                            // MapaAtlas pronto (ainda sem validar)
 */
import { criarRef } from '#mesa';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { espalhar as espalharConjunto, conjuntoDeEspalhar } from '../../src/authoring/espalhar.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { atualizarEscarpasDoMacico } from '../../src/domain/contorno.ts';
import { ceuNoHorario } from '../../src/domain/clima.ts';
import { novaLuz, novaPeca, novoObjeto } from '../../src/domain/fabrica.ts';
import { PAREDE_PADRAO, atualizarSalasDosObjetos, encaixarNaParede, motivoDeNaoCaber, recalcularParedes } from '../../src/domain/geometria.ts';
import { criarMapa, type Abertura, type Acabamento, type Comodo, type Estilo, type Fundo, type MapaAtlas, type Objeto, type Parede, type Peca, type Ponto, type Regiao, type Tempo } from '../../src/domain/mapa.ts';
import { camposDoPreset, presetDeAcabamento, presetDeClima, presetDeLuz, pincelDePresenca, tipoDeComodo, TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { fbm, mulberry32, valueNoise2D } from '../../src/procedural/ruido.ts';

/** Carimbo fixo (5/11/2026) para o JSON não mudar entre execuções. */
export const CARIMBO_DOS_EXEMPLOS = Date.UTC(2026, 10, 5);

/** Retângulo de células do GRID: `[x0, y0, x1, y1]`, com `x1` e `y1` exclusivos. */
export type Ret = readonly [x0: number, y0: number, x1: number, y1: number];

/** `irregular`: amplitude (m) de um ruído suave na borda da forma; 0 ou ausente = borda lisa. Ex.: 0,3 a 0,8 para bordas naturais. */
export interface Irregular { irregular?: number }
/**
 * Uma região do mapa, em metros:
 *  - `{ disco: [x, y], raio }`
 *  - `{ poligono: [[x, y], ...] }`
 *  - `{ faixa: [[x, y], ...], largura }`: uma faixa ao longo de uma polilinha (trilha, rio, muro de rocha)
 *  - `{ retangulo: [x0, y0, x1, y1] }`
 *  - `{ celulas: [[i, j], ...] }`: células exatas do terreno (sem `irregular`)
 */
export type Forma =
  | ({ disco: Ponto; raio: number } & Irregular)
  | ({ poligono: readonly Ponto[] } & Irregular)
  | ({ faixa: readonly Ponto[]; largura: number } & Irregular)
  | ({ retangulo: readonly [x0: number, y0: number, x1: number, y1: number] } & Irregular)
  | { celulas: readonly (readonly [number, number])[] };

export interface OpcoesDoKit {
  /** Id do mapa (letras, números, `_` e `-`). */ id: string;
  nome: string; largura: number; altura: number;
  /** Lado da célula do grid, em metros (padrão 1,5). */ celula?: number;
  /** Semente fixa: ruído de bordas, ids e espalhamento derivam dela. */ semente?: number;
  /** Resolução do terreno em metros (padrão 0,25). */ resolucao?: number;
}

interface Medida {
  caixa: { x0: number; y0: number; x1: number; y1: number };
  /** Distância assinada (m) à borda lisa: negativa dentro. */ sdf: (p: Ponto) => number;
  /** Dentro da forma, já com a borda irregular. */ dentro: (p: Ponto) => boolean;
}

const distSeg = (p: Ponto, a: Ponto, b: Ponto): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy, t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const distPolilinha = (p: Ponto, pts: readonly Ponto[]): number => {
  if (pts.length === 1) return Math.hypot(p[0] - pts[0]![0], p[1] - pts[0]![1]);
  let d = Infinity; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, distSeg(p, pts[i]!, pts[i + 1]!)); return d;
};
const dentroDoPoligono = (p: Ponto, pts: readonly Ponto[]): boolean => {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }
  return dentro;
};
const caixaDe = (pts: readonly Ponto[], folga: number) => ({
  x0: Math.min(...pts.map(p => p[0])) - folga, y0: Math.min(...pts.map(p => p[1])) - folga,
  x1: Math.max(...pts.map(p => p[0])) + folga, y1: Math.max(...pts.map(p => p[1])) + folga,
});

/** Escala (m) do ruído da borda irregular: ondulações de ~1,5 m. */
const ESCALA_DO_RUIDO = 1.5;

export class Kit {
  /** Gerador determinístico para o script do exemplo (0 a 1); deriva da semente. */
  readonly rng: () => number;
  private readonly m: MapaAtlas;
  private readonly semente: number;
  private readonly sorteioDeIds: () => number;
  private readonly usados = new Set<string>();
  private formas = 0;
  /** Terreno: chave da célula → material. `ordem` guarda a ordem em que cada material apareceu. */
  private readonly terreno = new Map<number, string>();
  private readonly ordem: string[] = [];
  private readonly correntezas = new Map<string, { angle: number; speed: number }>();
  private readonly presencas = new Map<string, Set<number>>();
  private readonly colunasT: number;
  private readonly linhasT: number;

  constructor(o: OpcoesDoKit) {
    this.semente = Math.floor(o.semente ?? 1) || 1;
    this.rng = mulberry32(this.semente);
    this.sorteioDeIds = mulberry32(Math.imul(this.semente, 2654435761) ^ 0x5bd1e995);
    this.m = criarMapa({ id: o.id, nome: o.nome, agora: CARIMBO_DOS_EXEMPLOS, largura: o.largura, altura: o.altura, celula: o.celula });
    if (o.resolucao) this.m.terrain.resolution = o.resolucao;
    this.colunasT = Math.ceil(o.largura / this.m.terrain.resolution); this.linhasT = Math.ceil(o.altura / this.m.terrain.resolution);
  }

  /** Um id novo, único e derivado da semente (`prefixo` + 10 caracteres). */
  id(prefixo = 'x'): string {
    for (;;) {
      const id = prefixo + (Math.floor(this.sorteioDeIds() * 2 ** 32).toString(36) + Math.floor(this.sorteioDeIds() * 2 ** 32).toString(36)).padStart(10, '0').slice(0, 10);
      if (!this.usados.has(id)) { this.usados.add(id); return id; }
    }
  }

  // ---------- Formas ----------
  private medir(forma: Forma): Medida {
    const irr = 'irregular' in forma ? forma.irregular ?? 0 : 0, n = this.formas++;
    const ruido = valueNoise2D(this.semente * 31 + n * 7919);
    const tremor = irr > 0 ? (p: Ponto) => irr * (fbm(ruido, p[0] / ESCALA_DO_RUIDO, p[1] / ESCALA_DO_RUIDO, 3) * 2 - 1) * 1.6 : () => 0;
    let caixa: Medida['caixa'], sdf: (p: Ponto) => number;
    if ('disco' in forma) {
      const c = forma.disco, r = forma.raio; caixa = { x0: c[0] - r - irr, y0: c[1] - r - irr, x1: c[0] + r + irr, y1: c[1] + r + irr };
      sdf = p => Math.hypot(p[0] - c[0], p[1] - c[1]) - r;
    } else if ('poligono' in forma) {
      const pts = forma.poligono; if (pts.length < 3) throw new Error('Kit: um polígono precisa de ao menos 3 pontos.');
      caixa = caixaDe(pts, irr); sdf = p => { const d = distPolilinha(p, [...pts, pts[0]!]); return dentroDoPoligono(p, pts) ? -d : d; };
    } else if ('faixa' in forma) {
      const pts = forma.faixa; if (!pts.length) throw new Error('Kit: uma faixa precisa de ao menos 1 ponto.');
      const w = forma.largura / 2; caixa = caixaDe(pts, w + irr); sdf = p => distPolilinha(p, pts) - w;
    } else if ('retangulo' in forma) {
      const [x0, y0, x1, y1] = forma.retangulo; caixa = { x0: x0 - irr, y0: y0 - irr, x1: x1 + irr, y1: y1 + irr };
      sdf = p => { const dx = Math.max(x0 - p[0], p[0] - x1), dy = Math.max(y0 - p[1], p[1] - y1); return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy); };
    } else {
      const res = this.m.terrain.resolution, chaves = new Set(forma.celulas.map(([i, j]) => j * 65_536 + i)), lista = forma.celulas;
      const xs = lista.map(c => c[0]), ys = lista.map(c => c[1]);
      caixa = { x0: Math.min(...xs) * res, y0: Math.min(...ys) * res, x1: (Math.max(...xs) + 1) * res, y1: (Math.max(...ys) + 1) * res };
      sdf = p => {
        if (chaves.has(Math.floor(p[1] / res) * 65_536 + Math.floor(p[0] / res))) return -res / 2;
        let d = Infinity; for (const [i, j] of lista) d = Math.min(d, Math.hypot((i + 0.5) * res - p[0], (j + 0.5) * res - p[1])); return d - res / 2;
      };
      return { caixa, sdf, dentro: p => chaves.has(Math.floor(p[1] / res) * 65_536 + Math.floor(p[0] / res)) };
    }
    return { caixa, sdf, dentro: p => sdf(p) + tremor(p) <= 0 };
  }

  private chavesDe(forma: Forma): number[] {
    const res = this.m.terrain.resolution, { caixa, dentro } = this.medir(forma), saida: number[] = [];
    const i0 = Math.max(0, Math.floor(caixa.x0 / res)), i1 = Math.min(this.colunasT - 1, Math.floor(caixa.x1 / res));
    const j0 = Math.max(0, Math.floor(caixa.y0 / res)), j1 = Math.min(this.linhasT - 1, Math.floor(caixa.y1 / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (dentro([(i + 0.5) * res, (j + 0.5) * res])) saida.push(j * 65_536 + i);
    return saida;
  }

  // ---------- Terreno e presença ----------
  /** O terreno base (o que aparece onde nada foi pintado): um material de terreno ou `'vazio'`. */
  base(material: string): this { this.m.terrain.base = material; return this; }

  /** Pinta `material` na forma, tirando as células das outras camadas. Cria a camada se faltar. */
  pintar(material: string, forma: Forma): this {
    if (!this.ordem.includes(material)) this.ordem.push(material);
    for (const k of this.chavesDe(forma)) this.terreno.set(k, material);
    return this;
  }

  /** Define a correnteza (`angle` em rad, `speed` de 0 a 3 m/s) de uma camada de água. */
  correnteza(material: string, angle: number, speed: number): this {
    this.correntezas.set(material, { angle, speed });
    return this;
  }

  /** Apaga o terreno pintado na forma (volta ao terreno base). */
  apagar(forma: Forma): this { for (const k of this.chavesDe(forma)) this.terreno.delete(k); return this; }

  /** Pinta uma presença (musgo, sangue, mofo…; ver `PINCEIS_DE_PRESENCA`) na forma. */
  presenca(pincel: string, forma: Forma): this {
    if (!pincelDePresenca(pincel)) throw new Error(`Kit: pincel de presença desconhecido: “${pincel}”.`);
    const s = this.presencas.get(pincel) ?? new Set<number>(); for (const k of this.chavesDe(forma)) s.add(k); this.presencas.set(pincel, s);
    return this;
  }

  // ---------- Construção ----------
  /**
   * Cria um cômodo com o piso e o papel do tipo (`TIPOS_DE_COMODO`: sala, cozinha, taverna, porao…). `ret` em CÉLULAS DO GRID, `[x0, y0, x1, y1]`
   * com fim exclusivo; uma lista de retângulos faz cômodos em L. As paredes derivadas são refeitas na hora (já dá para pôr portas).
   */
  comodo(ret: Ret | readonly Ret[], tipo: string, extra: { id?: string; nome?: string; funcao?: string | null; piso?: string; papel?: string | null; telhado?: string | null; telhadoVisivel?: boolean } = {}): string {
    const t = tipoDeComodo(tipo); if (!t) throw new Error(`Kit: tipo de cômodo desconhecido “${tipo}” (${TIPOS_DE_COMODO.map(x => x.id).join(', ')}).`);
    const rets = (typeof ret[0] === 'number' ? [ret as Ret] : ret as readonly Ret[]), celulas: [number, number][] = [];
    for (const [x0, y0, x1, y1] of rets) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) celulas.push([x, y]);
    const id = extra.id ?? this.id('c');
    const sala: Comodo = {
      id, name: extra.nome ?? t.nome, function: extra.funcao === undefined ? t.funcao : extra.funcao, cells: codificar(celulas),
      floor: { material: extra.piso ?? t.piso, seed: Math.floor(this.rng() * 2 ** 31) },
      wallpaper: extra.papel === null ? null : { material: extra.papel ?? t.papel, seed: Math.floor(this.rng() * 2 ** 31) },
      wallStyle: null, palette: null, roof: { material: extra.telhado ?? null, visible: extra.telhadoVisivel ?? true }, levelId: null,
    };
    this.m.rooms[id] = sala; recalcularParedes(this.m); return id;
  }

  /** Uma parede avulsa (muro, cerca, mureta) ao longo de `path` (metros). `extra` sobrescreve altura, espessura, material, tipo (`kind`), bloqueios… */
  parede(path: readonly Ponto[], extra: Partial<Parede> = {}): string {
    const id = extra.id ?? this.id('w');
    this.m.walls[id] = { ...structuredClone(PAREDE_PADRAO), id, path: path.map(p => [p[0], p[1]] as Ponto), source: null, ...extra };
    recalcularParedes(this.m); return id;
  }

  /** Uma abertura na parede mais próxima de `perto` (m), encaixada no centro de uma célula. Falha com mensagem clara se não houver parede ali. */
  porta(perto: Ponto, tipo: Abertura['kind'] = 'door', extra: Partial<Abertura> = {}): string {
    const largura = extra.width ?? 0.9, e = encaixarNaParede(this.m, perto, largura);
    if (!e) throw new Error(`Kit: não há parede perto de [${perto}] para a abertura.`);
    const a: Abertura = { id: this.id('a'), wallId: e.parede.id, at: e.at, width: largura, kind: tipo, state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...extra };
    const motivo = motivoDeNaoCaber(this.m, a); if (motivo) throw new Error(`Kit: ${motivo}`);
    this.m.openings[a.id] = a; return a.id;
  }

  // ---------- Objetos, peças e luzes ----------
  /** Um objeto: receita (`'pedra.media'`) ou item da coleção (`'casa:arvore-5m'`). `extra` sobrescreve rotação, escala, bloqueios, `params`, `harmonize`… */
  objeto(item: string, pos: Ponto, extra: Partial<Objeto> & { params?: Record<string, unknown> } = {}): string {
    const info = ACERVO.item(item);
    if (!info) throw new Error(`Kit: item desconhecido “${item}”.`);
    const { params, ...resto } = extra;
    const submerso = info.submerso ? { elevation: 'underwater' as const, castsShadow: false, blocks: { move: false, sight: false } } : {};
    const o = novoObjeto([pos[0], pos[1]], {
      id: this.id('o'),
      source: ACERVO.fonte(item, Math.floor(this.rng() * 2 ** 31), params),
      rotation: this.rng() * Math.PI * 2,
      ...submerso,
      ...resto,
    });
    this.m.props[o.id] = o; return o.id;
  }

  /**
   * Espalha um conjunto (`CONJUNTOS_DE_ESPALHAR`/`CONJUNTOS_EXTERIORES`: mata, jardim, cemiterio…) dentro da forma. `densidade` (itens/m²)
   * troca a do conjunto; é aproximada, porque a forma é coberta por vários círculos. Devolve os ids criados.
   */
  espalhar(conjunto: string, forma: Forma, o: { densidade?: number } = {}): string[] {
    if (!conjuntoDeEspalhar(conjunto)) throw new Error(`Kit: conjunto desconhecido “${conjunto}”.`);
    const { caixa, sdf, dentro } = this.medir(forma), w = caixa.x1 - caixa.x0, h = caixa.y1 - caixa.y0;
    const R = Math.min(2.5, Math.max(1, Math.min(w, h) / 2)), passo = R * 1.1, criados: string[] = [];
    const centros: Ponto[] = [[(caixa.x0 + caixa.x1) / 2, (caixa.y0 + caixa.y1) / 2]];
    for (let y = caixa.y0; y <= caixa.y1 + passo; y += passo) for (let x = caixa.x0; x <= caixa.x1 + passo; x += passo) centros.push([x, y]);
    for (const centro of centros) {
      if (sdf(centro) > R * 0.3) continue;
      const novos = espalharConjunto(this.m, { centro, raio: R, conjunto, semente: this.rng() * 1000, gerarId: p => this.id(p), densidade: o.densidade });
      for (const n of novos) if (dentro(n.position)) { this.m.props[n.id] = n; criados.push(n.id); }
    }
    return criados;
  }

  /** Uma peça (personagem, monstro) em `pos`. */
  peca(nome: string, pos: Ponto, extra: Partial<Peca> = {}): string {
    const t = novaPeca([pos[0], pos[1]], nome, { id: this.id('t'), ...extra }); this.m.tokens[t.id] = t; return t.id;
  }

  /** Uma luz a partir de uma predefinição (`PRESETS_DE_LUZ`: vela, tocha, fogueira, lanterna, farol…). `direcao` (rad) vale para cones. `extra` sobrescreve qualquer campo. */
  luz(preset: string, pos: Ponto, extra: Partial<Omit<ReturnType<typeof novaLuz>, 'id'>> & { direcao?: number } = {}): string {
    const p = presetDeLuz(preset); if (!p) throw new Error(`Kit: predefinição de luz desconhecida “${preset}”.`);
    const { direcao, ...resto } = extra, l = novaLuz([pos[0], pos[1]], { id: this.id('l'), ...camposDoPreset(p, direcao ?? 0), ...resto });
    this.m.lights[l.id] = l; return l.id;
  }

  // ---------- Atmosfera ----------
  /** Aplica um clima pronto (`PRESETS_DE_CLIMA`: manha, tarde, entardecer, noite, tempestade, neblina, neve…). `time` ("HH:MM") move o sol; `tempo` ajusta o tempo. */
  clima(preset: string, ajuste: { time?: string; tempo?: Partial<Tempo>; gridPower?: boolean; ambient?: { color: string; intensity: number }; sun?: null | { angle: number; color: string; intensity: number } } = {}): this {
    const p = presetDeClima(preset); if (!p) throw new Error(`Kit: clima desconhecido “${preset}”.`);
    this.m.climate = { preset: p.id, ...structuredClone(p.climate) }; this.m.finish = structuredClone(p.finish);
    if (ajuste.time) { const ceu = ceuNoHorario(ajuste.time); Object.assign(this.m.climate, { time: ajuste.time, sun: ceu.sun, ambient: ceu.ambient }); }
    if (ajuste.ambient) this.m.climate.ambient = { ...ajuste.ambient };
    if (ajuste.sun !== undefined) this.m.climate.sun = ajuste.sun ? { ...ajuste.sun } : null;
    if (ajuste.tempo) Object.assign(this.m.climate.weather, ajuste.tempo);
    if (ajuste.gridPower !== undefined) this.m.climate.gridPower = ajuste.gridPower;
    return this;
  }

  /** Guarda um clima nomeado em `customClimates` (a partir de um `preset` + ajustes, ou do clima/acabamento atuais se `preset` for omitido). */
  guardarClima(id: string, nome: string, preset?: string, ajuste: { time?: string; tempo?: Partial<Tempo>; gridPower?: boolean; ambient?: { color: string; intensity: number }; sun?: null | { angle: number; color: string; intensity: number }; finish?: Partial<Omit<Acabamento, 'preset'>> } = {}): this {
    let baseClima: Omit<MapaAtlas['climate'], 'preset'>;
    let baseAcab: Omit<Acabamento, 'preset'>;
    if (preset) {
      const p = presetDeClima(preset); if (!p) throw new Error(`Kit: clima desconhecido “${preset}”.`);
      baseClima = structuredClone(p.climate);
      const { preset: _fp, ...fResto } = structuredClone(p.finish);
      baseAcab = fResto;
    } else {
      const { preset: _cp, ...cResto } = structuredClone(this.m.climate);
      const { preset: _fp, ...fResto } = structuredClone(this.m.finish);
      baseClima = cResto;
      baseAcab = fResto;
    }
    if (ajuste.time) { const ceu = ceuNoHorario(ajuste.time); Object.assign(baseClima, { time: ajuste.time, sun: ceu.sun, ambient: ceu.ambient }); }
    if (ajuste.ambient) baseClima.ambient = { ...ajuste.ambient };
    if (ajuste.sun !== undefined) baseClima.sun = ajuste.sun ? { ...ajuste.sun } : null;
    if (ajuste.tempo) Object.assign(baseClima.weather, ajuste.tempo);
    if (ajuste.gridPower !== undefined) baseClima.gridPower = ajuste.gridPower;
    if (ajuste.finish) Object.assign(baseAcab, structuredClone(ajuste.finish));
    this.m.customClimates[id] = { id, name: nome, climate: baseClima, finish: baseAcab };
    return this;
  }

  /** Cria uma região (`reveal`, `audio`, `trigger`, `note`) no mapa. */
  regiao(polygon: readonly Ponto[], kind: Regiao['kind'], extra: { id?: string; nome?: string; texto?: string; gmOnly?: boolean; cenaJukebox?: string } = {}): string {
    if (polygon.length < 3) throw new Error('Kit: uma região precisa de ao menos 3 pontos.');
    const id = extra.id ?? this.id('r');
    const payload: Record<string, unknown> = {};
    if (extra.nome) payload.nome = extra.nome;
    if (extra.texto) payload.texto = extra.texto;
    this.m.regions[id] = {
      id,
      polygon: polygon.map(p => [p[0], p[1]] as Ponto),
      kind,
      gmOnly: extra.gmOnly ?? true,
      payload,
      refs: extra.cenaJukebox ? [criarRef('jukebox', 'cena', extra.cenaJukebox)] : [],
    };
    return id;
  }

  /** Notas de um cômodo (texto de leitura em voz alta e notas do mestre). */
  notaDeComodo(id: string, nota: { leitura?: string; notasMestre?: string }): this {
    this.m.comodosExtra[id] = { id, leitura: nota.leitura ?? '', notasMestre: nota.notasMestre ?? '', refs: [] };
    return this;
  }

  /** Aplica um acabamento pronto (`PRESETS_DE_ACABAMENTO`) ou, com `null`, parte do atual; `extra` sobrescreve campos (`edges`, `glow`, `tint`…). */
  acabamento(preset: string | null, extra: Partial<Omit<Acabamento, 'preset'>> = {}): this {
    let base: Acabamento = this.m.finish;
    if (preset !== null) { const p = presetDeAcabamento(preset); if (!p) throw new Error(`Kit: acabamento desconhecido “${preset}”.`); base = { preset: p.id, ...structuredClone(p.valores) }; }
    this.m.finish = { ...base, ...structuredClone(extra), preset: Object.keys(extra).length ? 'personalizado' : base.preset };
    return this;
  }

  /** Estilo do mapa: renderizador, paleta, gênero, estilo das paredes (`pixel` é mesclado). */
  estilo(patch: Partial<Omit<Estilo, 'pixel'>> & { pixel?: Partial<Estilo['pixel']> }): this {
    const { pixel, ...resto } = patch; Object.assign(this.m.style, resto); if (pixel) Object.assign(this.m.style.pixel, pixel); return this;
  }

  /** Fundo do mapa (a cor atrás do terreno e do “vazio”). */
  fundo(patch: Partial<Fundo>): this { Object.assign(this.m.backdrop, patch); return this; }

  /** Notas do mestre do mapa. */
  notas(texto: string): this { this.m.notes = texto; return this; }

  // ---------- Resultado ----------
  /** O documento pronto: terreno e presenças gravados, objetos ligados aos cômodos. Pode ser chamado mais de uma vez. Valide com `validarMapa`. */
  construir(): MapaAtlas {
    const m = structuredClone(this.m), camadas: [string, number[]][] = this.ordem.map(mat => [mat, []]);
    for (const [k, mat] of this.terreno) camadas[this.ordem.indexOf(mat)]![1].push(k);
    m.terrain.layers = {};
    camadas.forEach(([mat, chaves], ordem) => {
      if (!chaves.length) return;
      const id = `t_${mat.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;
      const flow = this.correntezas.get(mat) ?? null;
      m.terrain.layers[id] = { id, material: mat, cells: codificar(chaves.map(k => [k % 65_536, Math.floor(k / 65_536)] as const)), order: ordem, flow };
    });
    m.presence = {};
    for (const [pincel, chaves] of this.presencas) {
      if (!chaves.size) continue;
      const id = `p_${pincel.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;
      m.presence[id] = { id, brush: pincel, cells: codificar([...chaves].map(k => [k % 65_536, Math.floor(k / 65_536)] as const)), intensity: 0.6, seed: Math.floor(this.semente * 977 + pincel.length), gmOnly: false };
    }
    atualizarEscarpasDoMacico(m);      // o maciço pintado por aqui também bloqueia, igual ao pintado no editor
    atualizarSalasDosObjetos(m); m.createdAt = m.updatedAt = CARIMBO_DOS_EXEMPLOS;
    return m;
  }
}

// ---------- Exemplos ----------
/** Um exemplo da galeria: o tamanho e a semente ficam aqui; `construir` recebe o kit já pronto. */
export interface Exemplo {
  /** Letras, números, `_` e `-`: vira o nome do arquivo `public/exemplos/<id>.atlas.json`. */ id: string;
  nome: string; descricao: string; largura: number; altura: number; semente?: number; celula?: number;
  construir(k: Kit): void;
}

/** Monta e valida o documento de um exemplo. */
export function montarExemplo(e: Exemplo): MapaAtlas {
  const k = new Kit({ id: e.id, nome: e.nome, largura: e.largura, altura: e.altura, semente: e.semente ?? 1, celula: e.celula });
  e.construir(k);
  const mapa = k.construir(); validarMapa(mapa); return mapa;
}
