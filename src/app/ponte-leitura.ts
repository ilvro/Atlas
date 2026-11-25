import { imagem, json, type FerramentaDaPonte } from '#mesa/ponte';
import { andarDe, ehMultiandar, listaDeAndares } from '../domain/andares.ts';
import { area, decodificar, limites } from '../domain/celulas.ts';
import { edificiosDe, type Edificio } from '../domain/edificios.ts';
import { EVENTOS_DE_CENA } from '../domain/eventos-de-cena.ts';
import { detectarCirculo } from '../domain/formas-de-comodo.ts';
import { CUMEEIRAS_DE_TELHADO, DETALHES_DE_TELHADO, FORMAS_DE_TELHADO, colunas, linhas, type Comodo, type MapaAtlas, type Ponto, type TransicaoDeMapa } from '../domain/mapa.ts';
import { centroDaAbertura, pontoNaParede } from '../domain/geometria.ts';
import { transicaoDaAbertura, transicaoDoObjeto } from '../domain/transicao-mapa.ts';
import { descreverPasso } from '../domain/momentos.ts';
import { ESTADOS_DE_TELHADO, ESTILOS_DE_TELHADO, FUNCOES_AO_AR_LIVRE, GENEROS, PACOTES_DE_PRESENCA, PINCEIS_DE_PRESENCA, PRESETS_DE_ACABAMENTO, PRESETS_DE_CLIMA, PRESETS_DE_LUZ, TIPOS_DE_COMODO } from '../domain/presets.ts';
import { formaDe, retangulosDe } from '../domain/telhado-geometria.ts';
import { COLECAO } from '../procedural/colecao.ts';
import { MATERIAIS, materiaisDo } from '../procedural/materiais.ts';
import { listaDeReceitas } from '../procedural/receitas/index.ts';
import { TODOS_OS_CONJUNTOS, receitasDoItem } from '../authoring/espalhar.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { GRUPOS_DE_OBJETOS } from '../procedural/familias.ts';
import { regrasPara } from '../authoring/regras-mobilia.ts';
import { revisarMapa } from '../authoring/revisao.ts';
import { caixaDe, type Alvo, type Caixa } from '../render/selecao.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';

/** O que as ferramentas de leitura precisam do Atlas; o app liga isto aos signals (sem DOM, dá para testar com um banco em memória). */
export interface ContextoDeLeitura {
  repo: () => Pick<RepositorioMapas, 'listar' | 'obter'> | null;
  /** O mapa aberto agora, ou `null`. */
  mapaAberto: () => MapaAtlas | null;
  abrirMapa: (id: string) => Promise<void>;
  /** O mapa aberto tem edições não gravadas? (o app liga ao `sujo` do store); ausente vale `false`. */
  naoSalvo?: () => boolean;
  /** Um mapa que está numa aba em segundo plano (cache de sessões): o documento vivo e se tem edições não gravadas; `null` se não está em cache. */
  sessaoEmCache?: (id: string) => { mapa: MapaAtlas; naoSalvo: boolean } | null;
  /** O modo do editor agora (`construir` ou `sessao`). */
  modo?: () => 'construir' | 'sessao';
  /** A seleção atual do editor. */
  selecao?: () => readonly Alvo[];
  /** O editor já está na tela (existe o viewport do mapa aberto)? Ausente: as ferramentas não esperam por ele. */
  editorPronto?: () => boolean;
  /** Espera `ms` milissegundos (setTimeout; os testes trocam por um relógio falso). Nunca use quadro de animação: a aba pode estar em segundo plano. */
  dormir?: (ms: number) => Promise<void>;
  /** O que a câmera mostra agora, em metros; `null` quando não há editor na tela. */
  caixaVisivel?: () => Caixa | null;
  andarAtivo?: () => string | null;
  definirAndarAtivo?: (id: string | null) => void;
  /** Fotografa o mapa aberto (o viewport); ausente ou `null` quando não há editor na tela. */
  capturar?: (opcoes: { caixa?: { x0: number; y0: number; x1: number; y1: number }; ladoMaximo?: number; vista?: 'planta' | 'telhados' }) => Promise<{ dataUrl: string; largura: number; altura: number; pxPorMetro: number; bytes: number; qualidade: number; caixa: { x0: number; y0: number; x1: number; y1: number }; aviso?: string }> | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (p: Ponto): Ponto => [r1(p[0]), r1(p[1])];
const MAX_POSICOES = 8;
const LIMITE_JSON_MAPA_LER = 60_000;

export type ResumoDeTelhado =
  | { estilo: string }
  | { cobertura: string; forma: string; ingreme: boolean; detalhes: string[] };

export function resumirTelhado(roof: Comodo['roof']): ResumoDeTelhado | null {
  if (!roof.material) return null;
  const f = formaDe(roof);
  for (const e of ESTILOS_DE_TELHADO) {
    const fe = formaDe(e.roof);
    if (
      e.roof.material === roof.material &&
      fe.shape === f.shape &&
      fe.ridge === f.ridge &&
      fe.steep === f.steep &&
      fe.details.length === f.details.length &&
      fe.details.every((d, i) => d === f.details[i])
    ) {
      return { estilo: e.id };
    }
  }
  return { cobertura: roof.material, forma: f.shape, ingreme: f.steep, detalhes: f.details };
}

/** Agrupa todos os cômodos de função coberta (ou que já tenham cobertura) em edifícios conectados. */
export function edificiosDoMapa(m: Pick<MapaAtlas, 'rooms'>): Edificio[] {
  const rooms: Record<string, Comodo> = {};
  for (const [id, s] of Object.entries(m.rooms)) {
    const aoArLivreSemTelhado = !s.roof.material && s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function);
    if (aoArLivreSemTelhado) continue;
    rooms[id] = s.roof.material ? s : { ...s, roof: { ...s.roof, material: '_coberto_' } };
  }
  return edificiosDe({ rooms });
}

function nomeDoEdificio(salas: readonly Comodo[]): string {
  if (!salas.length) return '';
  const prefixos = salas.map(s => {
    const idx = s.name.indexOf(' · ');
    return idx > 0 ? s.name.slice(0, idx).trim() : null;
  });
  if (prefixos[0] && prefixos.every(p => p === prefixos[0])) return prefixos[0];
  let maior = salas[0]!;
  let maiorArea = area(maior.cells);
  for (const s of salas.slice(1)) {
    const a = area(s.cells);
    if (a > maiorArea) { maior = s; maiorArea = a; }
  }
  return maior.name;
}

/** O resumo do documento para o assistente: significado e contagens, nunca as células cruas. */
export function resumirMapa(m: MapaAtlas, opcoes?: { comodos?: readonly string[] }): Record<string, unknown> {
  const t = m.grid.size, areaCel = t * t;
  const eds = edificiosDoMapa(m);
  const salaParaEdificio = new Map<string, string>();
  for (const ed of eds) {
    for (const sId of ed.salas) salaParaEdificio.set(sId, ed.id);
  }

  const filtroComodos = opcoes?.comodos ? new Set(opcoes.comodos) : null;
  const todasSalas = Object.values(m.rooms);
  const salasListadas = filtroComodos ? todasSalas.filter(c => filtroComodos.has(c.id)) : todasSalas;

  const comodos = salasListadas.map(c => {
    const l = limites(c.cells);
    const cels = decodificar(c.cells).map(([x, y]): [number, number] => [x, y]);
    const rets = retangulosDe(cels);
    const nCel = area(c.cells);
    const edId = salaParaEdificio.get(c.id);
    const circ = c.outline && c.outline.length >= 3 ? detectarCirculo(c.outline) : null;
    const contorno = c.outline && c.outline.length >= 3
      ? circ
        ? { forma: 'circulo' as const, centro: [r1(circ.centro[0]), r1(circ.centro[1])] as [number, number], raio: r1(circ.raio) }
        : { forma: 'poligono' as const, vertices: c.outline.map(([x, y]) => [r1(x), r1(y)] as [number, number]) }
      : {};
    return {
      id: c.id,
      nome: c.name,
      funcao: c.function,
      andar: andarDe(c),
      celulas: nCel,
      area: r2(nCel * areaCel),
      piso: c.floor.material,
      telhado: resumirTelhado(c.roof),
      ...(edId ? { edificio: edId } : {}),
      rets,
      ...contorno,
      ...(l ? { retangulo: [r1(l.x0 * t), r1(l.y0 * t), r1((l.x1 - l.x0 + 1) * t), r1((l.y1 - l.y0 + 1) * t)] } : {}),
    };
  });

  const edificios = eds.map(ed => {
    const salasDoEd = ed.salas.map(id => m.rooms[id]!).filter(Boolean);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [cx, cy] of ed.celulas) {
      if (cx < x0) x0 = cx;
      if (cy < y0) y0 = cy;
      if (cx > x1) x1 = cx;
      if (cy > y1) y1 = cy;
    }
    const telhadosDistintos: string[] = [];
    for (const s of salasDoEd) {
      const rt = resumirTelhado(s.roof);
      if (!rt) continue;
      const chave = 'estilo' in rt ? rt.estilo : rt.cobertura;
      if (!telhadosDistintos.includes(chave)) telhadosDistintos.push(chave);
    }
    return {
      id: ed.id,
      nome: nomeDoEdificio(salasDoEd),
      salas: ed.salas,
      area: r2(ed.celulas.length * areaCel),
      caixa: ed.celulas.length ? [r1(x0 * t), r1(y0 * t), r1((x1 - x0 + 1) * t), r1((y1 - y0 + 1) * t)] : [0, 0, 0, 0],
      telhados: telhadosDistintos,
    };
  });

  const areasEd = edificios.map(e => e.area);
  const somaAreas = areasEd.reduce((a, b) => a + b, 0);
  const comodosSemTelhado = todasSalas.filter(c => !c.roof.material && !(c.function && FUNCOES_AO_AR_LIVRE.has(c.function))).length;
  const retangulares = eds.filter(ed => retangulosDe(ed.celulas).length === 1).length;
  const resumo = {
    edificios: edificios.length,
    areaMedia: edificios.length ? r1(somaAreas / edificios.length) : 0,
    areaMin: edificios.length ? r2(Math.min(...areasEd)) : 0,
    areaMax: edificios.length ? r2(Math.max(...areasEd)) : 0,
    comodosSemTelhado,
    retangulares,
  };

  const resTerreno = m.terrain.resolution || 0.25, areaTerreno = resTerreno * resTerreno;
  const camadas = Object.values(m.terrain.layers).sort((a, b) => a.order - b.order).map(c => ({ id: c.id, material: c.material, celulas: area(c.cells), ...(c.flow ? { correnteza: { angulo: r1(c.flow.angle), velocidade: r1(c.flow.speed) } } : {}) }));
  const relevo = Object.values(m.terrain.relief?.patamares ?? {}).sort((a, b) => a.altura - b.altura).map(p => {
    const n = area(p.cells), l = limites(p.cells);
    return {
      altura: p.altura,
      area: r2(n * areaTerreno),
      caixa: l ? [r1(l.x0 * resTerreno), r1(l.y0 * resTerreno), r1((l.x1 - l.x0 + 1) * resTerreno), r1((l.y1 - l.y0 + 1) * resTerreno)] : [0, 0, 0, 0],
    };
  });
  const escarpasDerivadas = Object.values(m.walls).filter(w => w.source && 'reliefStep' in w.source).length;
  const resumirTransicao = (tr: TransicaoDeMapa) => ({
    mapa: tr.toMapId,
    ...(tr.toTargetId ? { entrada: tr.toTargetId } : {}),
    ...(tr.toLevel !== undefined ? { andar: tr.toLevel } : {}),
    ...(tr.toPosition ? { posicao: pt(tr.toPosition) } : {}),
  });
  const grupos = new Map<string, { fonte: string; andar: string | null; quantidade: number; ids: string[]; posicoes: Ponto[]; transicao?: ReturnType<typeof resumirTransicao> }>();
  const transicoes: Record<string, unknown>[] = [];
  for (const a of Object.values(m.openings)) {
    const tr = transicaoDaAbertura(a);
    if (!tr) continue;
    const parede = m.walls[a.wallId];
    const pos = parede ? pt(pontoNaParede(parede, centroDaAbertura(parede, a)).ponto) : null;
    transicoes.push({
      id: a.id,
      colecao: 'openings',
      tipo: a.kind,
      andar: parede ? andarDe(parede) : null,
      ...(pos ? { posicao: pos } : {}),
      transicao: resumirTransicao(tr),
    });
  }
  for (const o of Object.values(m.props)) {
    const fonte = o.source.kind === 'recipe' ? o.source.recipe : `asset:${o.source.assetId}`;
    const nivel = andarDe(o);
    const chave = `${fonte}\0${nivel ?? ''}`;
    const g = grupos.get(chave) ?? { fonte, andar: nivel, quantidade: 0, ids: [], posicoes: [] };
    g.quantidade++;
    if (g.posicoes.length < MAX_POSICOES) { g.posicoes.push(pt(o.position)); g.ids.push(o.id); }
    const tr = transicaoDoObjeto(o);
    if (tr) {
      const resumoTr = resumirTransicao(tr);
      g.transicao = resumoTr;
      transicoes.push({
        id: o.id,
        colecao: 'props',
        tipo: fonte,
        andar: nivel,
        posicao: pt(o.position),
        transicao: resumoTr,
      });
    }
    grupos.set(chave, g);
  }
  const objetos = [...grupos.values()].map(g => ({
    fonte: g.fonte,
    andar: g.andar,
    quantidade: g.quantidade,
    posicoes: g.posicoes,
    ids: g.ids,
    ...(g.transicao ? { transicao: g.transicao } : {}),
    ...(g.quantidade > g.posicoes.length ? { maisPosicoes: g.quantidade - g.posicoes.length } : {}),
  }));
  const luzes = Object.values(m.lights).map(l => ({ id: l.id, andar: andarDe(l), posicao: pt(l.position), raio: r1(l.radius), cor: l.color, preset: l.preset, ligada: l.on, energia: l.power }));
  const regioes = Object.values(m.regions).map(g => {
    const xs = g.polygon.map(p => p[0]), ys = g.polygon.map(p => p[1]);
    return { id: g.id, tipo: g.kind, soMestre: g.gmOnly, retangulo: g.polygon.length ? [r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))] : null, ...(typeof g.payload.nome === 'string' ? { nome: g.payload.nome } : {}), ...(typeof g.payload.momento === 'string' ? { momento: g.payload.momento } : {}) };
  });
  const saida: Record<string, unknown> = {
    id: m.id, nome: m.name, revisao: m.revision, campanhaId: m.campanhaId,
    tamanho: { largura: m.bounds.width, altura: m.bounds.height, unidade: 'm' },
    grade: { tipo: m.grid.kind, celula: t, colunas: colunas(m), linhas: linhas(m) },
    andares: listaDeAndares(m).map(a => ({ id: a.id, nome: a.nome, ordem: a.order })),
    estilo: { renderizador: m.style.renderer, genero: m.style.genre, paleta: m.style.palette },
    terreno: { resolucao: m.terrain.resolution, base: m.terrain.base, camadas },
    relevo, escarpasDerivadas,
    resumo, edificios, comodos,
    paredes: Object.keys(m.walls).length, aberturas: Object.values(m.openings).reduce<Record<string, number>>((a, o) => { a[o.kind] = (a[o.kind] ?? 0) + 1; return a; }, {}),
    ...(transicoes.length ? { transicoes } : {}),
    objetos, luzes, regioes,
    presenca: Object.values(m.presence).map(p => ({ id: p.id, pincel: p.brush, celulas: area(p.cells) })),
    pecas: Object.values(m.tokens).map(p => ({ id: p.id, nome: p.name, jogador: p.player, andar: andarDe(p), posicao: pt(p.position) })),
    clima: { preset: m.climate.preset, hora: m.climate.time, tempo: Object.fromEntries(Object.entries(m.climate.weather).filter(([, v]) => v !== 0)) },
    acabamento: m.finish.preset,
    climasSalvos: Object.values(m.customClimates).map(c => ({ id: c.id, nome: c.name })),
    momentos: Object.values(m.moments).map(mo => ({ id: mo.id, nome: mo.nome, passos: mo.passos.map(p => descreverPasso(p, m)) })),
    notas: m.notes,
  };
  if (!filtroComodos && JSON.stringify(saida).length > LIMITE_JSON_MAPA_LER) {
    saida.comodos = comodos.map(({ rets, ...resto }) => {
      const r = resto as Record<string, unknown>;
      if (Array.isArray(r.vertices)) {
        const { vertices, ...semVert } = r;
        return { ...semVert, retsResumidos: rets.length, verticesResumidos: vertices.length };
      }
      return { ...resto, retsResumidos: rets.length };
    });
  }
  return saida;
}

type Parte = 'receitas' | 'colecao' | 'familias' | 'conjuntos' | 'comodos' | 'materiais' | 'telhado' | 'climas' | 'luzes' | 'presenca' | 'momentos';
const PARTES: readonly Parte[] = ['receitas', 'colecao', 'conjuntos', 'comodos', 'materiais', 'telhado', 'climas', 'luzes', 'presenca', 'momentos'];
const LIMITE_BUSCA_CATALOGO = 40;

const normalizarBusca = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const TIPOS_DE_PASSO = [
  { tipo: 'esperar', campos: { ms: 'número, 100 a 120000' }, descricao: 'Espera antes do próximo passo.' },
  { tipo: 'som', campos: { ref: 'Ref { app, tipo, id } de uma cena sonora ou efeito do Jukebox' }, descricao: 'Toca um som.' },
  { tipo: 'silencio', campos: { ms: 'número, 0 a 30000 (fade)' }, descricao: 'Apaga o som do Jukebox com fade.' },
  { tipo: 'efeito', campos: { efeito: [...EVENTOS_DE_CENA, 'relampago'] }, descricao: 'Efeito curto de cena.' },
  { tipo: 'clima', campos: { clima: 'id de uma predefinição de clima ou de um clima salvo do mapa, até 60 caracteres' }, descricao: 'Troca o clima.' },
  { tipo: 'tela', campos: { acao: ['escurecer', 'clarear'], ms: 'número, 0 a 10000' }, descricao: 'Cortina preta no projetor.' },
  { tipo: 'letreiro', campos: { titulo: 'texto, até 120', subtitulo: 'texto, até 200', peca: 'id de peça ou null', estilo: ['apresentacao', 'capitulo'], ms: 'número, 1000 a 20000' }, descricao: 'Letreiro sobre o mapa.' },
  { tipo: 'camera', campos: { alvo: '{ colecao: "rooms" | "regions" | "tokens", id }' }, descricao: 'Enquadra um cômodo, região ou peça.' },
  { tipo: 'revelar', campos: { ids: 'ids de cômodos, aberturas ou regiões, até 100' }, descricao: 'Revela cômodos ou regiões aos jogadores.' },
  { tipo: 'interagir', campos: { id: 'id de objeto interagível ou porta' }, descricao: 'Aciona um interruptor, gaveta ou porta.' },
  { tipo: 'luz', campos: { ids: 'ids de luzes ou de objetos (com tocha/lampião), até 100', acao: ['ligar', 'desligar', 'alternar'] }, descricao: 'Liga, desliga ou alterna luzes.' },
  { tipo: 'objeto', campos: { ids: 'ids de objetos, até 100', acao: ['mostrar', 'esconder'] }, descricao: 'Mostra ou esconde objetos.' },
  { tipo: 'agua', campos: { acao: 'opcional, "subir" (padrão, do centro para a borda) ou "baixar" (da borda para o centro)', deixar: 'opcional, só com acao "baixar": material de chão que fica no lugar da água (ex: lama); sem ele a água devolve o terreno que cobriu (ou mostra a base, se não havia)', etapas: 'opcional, número de etapas (padrão 6)', material: 'material de água (ex: agua.lago, agua.pantano)', ms: 'número, 100 a 120000', poligono: 'pontos [x, y] em metros (mínimo 3)' }, descricao: 'Sobe ou baixa a água gradualmente em anéis (inunda e recua). Altera o terreno: atlas_desfazer volta ao estado anterior.' },
  { tipo: 'pista', campos: { ref: 'Ref de um documento do Ateliê', mostrar: 'booleano (true já projeta)' }, descricao: 'Revela uma pista.' },
  { tipo: 'nota', campos: { texto: 'até 400 caracteres' }, descricao: 'Aviso só para o mestre.' },
];

export function catalogo(parte?: string, busca?: string): unknown {
  const termos = busca ? normalizarBusca(busca.trim()).split(/\s+/).filter(Boolean) : [];
  const bate = (textos: readonly (string | undefined)[]) =>
    !termos.length || termos.every(t => textos.some(x => x !== undefined && normalizarBusca(x).includes(t)));
  const nomeDaFamilia = (id: string) => ACERVO.familiaDoItem(id)?.nome;
  const idDaFamilia = (id: string) => ACERVO.familiaDoItem(id)?.id;
  const listarReceitas = () =>
    listaDeReceitas()
      .filter(r => bate([r.id, r.nome, nomeDaFamilia(r.id), ...r.tags, ...r.funcoes]))
      .map(r => ({ id: r.id, ...(idDaFamilia(r.id) ? { familia: idDaFamilia(r.id) } : {}), nome: r.nome, categoria: r.categoria, tipo: r.tipo, funcoes: r.funcoes, tags: r.tags, ...(r.generos?.length ? { generos: r.generos } : {}), ...(r.kit ? { kit: r.kit } : {}), pegada: r.pegada, ...(r.altura !== undefined ? { altura: r.altura } : {}), ...(r.submerso ? { submerso: true } : {}), ...(r.campos?.length ? { campos: r.campos.map(c => ({ id: c.id, rotulo: c.rotulo, tipo: c.tipo, padrao: c.padrao, ...(c.min !== undefined ? { min: c.min } : {}), ...(c.max !== undefined ? { max: c.max } : {}), ...(c.uso ? { uso: c.uso } : {}) })) } : {}) }));
  const listarColecao = () =>
    COLECAO
      .filter(i => bate([i.id, i.nome, nomeDaFamilia(i.id), ...i.tags, ...i.funcoes]))
      .map(i => ({ id: i.id, ...(idDaFamilia(i.id) ? { familia: idDaFamilia(i.id) } : {}), nome: i.nome, categoria: i.categoria, pegada: i.pegada, funcoes: i.funcoes, tags: i.tags, ...(i.generos.length ? { generos: i.generos } : {}), ...(i.kit ? { kit: i.kit } : {}) }));
  /** As famílias do acervo (o assistente pede `familia:<id>` em atlas_objetos e atlas_arranjo): grupo, id, nome e as variantes, da menor para a maior. */
  const listarFamilias = () =>
    ACERVO.familias()
      .filter(f => bate([f.id, f.nome, f.grupo, GRUPOS_DE_OBJETOS.find(g => g.id === f.grupo)?.nome, ...f.itens, ...f.itens.map(id => ACERVO.item(id)?.nome)]))
      .map(f => ({ grupo: f.grupo, id: f.id, nome: f.nome, itens: f.itens }));
  const listarConjuntos = () =>
    TODOS_OS_CONJUNTOS
      .filter(c => bate([c.id, c.nome, c.descricao, ...c.itens.flatMap(i => [...receitasDoItem(i), ...(i.familia !== undefined ? [i.familia] : [])])]))
      .map(c => ({ id: c.id, nome: c.nome, descricao: c.descricao, densidade: c.densidade, ...(c.grade ? { arranjo: 'fileiras' as const } : {}), itens: c.itens.map(i => (i.familia !== undefined ? `familia:${i.familia}` : i.receita)) }));

  switch (parte as Parte | undefined) {
    case 'receitas': return listarReceitas();
    case 'colecao': return listarColecao();
    case 'familias': return listarFamilias();
    case 'conjuntos': return listarConjuntos();
    case 'comodos': return TIPOS_DE_COMODO.map(t => ({
      id: t.id,
      nome: t.nome,
      funcao: t.funcao,
      piso: t.piso,
      papel: t.papel,
      descricao: t.descricao,
      mobilia: GENEROS.some(g => regrasPara(t.funcao, g.id).length > 0),
      semTelhado: FUNCOES_AO_AR_LIVRE.has(t.funcao),
    }));
    case 'materiais': {
      const usos = ['piso', 'papel', 'objeto', 'terreno', 'macico', 'agua', 'telhado'] as const;
      return Object.fromEntries(usos.map(u => [u, materiaisDo(u).filter(x => bate([x.id, x.nome, u])).map(x => ({ id: x.id, nome: x.nome }))]));
    }
    case 'telhado': return {
      estilos: ESTILOS_DE_TELHADO.map(e => ({ id: e.id, nome: e.nome, cobertura: e.roof.material, forma: e.roof.shape ?? 'quatro-aguas', ingreme: !!e.roof.steep, detalhes: e.roof.details ?? [], ...(e.roof.wear ? { desgaste: e.roof.wear } : {}) })),
      coberturas: materiaisDo('telhado').map(x => ({ id: x.id, nome: x.nome })),
      formas: [...FORMAS_DE_TELHADO],
      cumeeiras: [...CUMEEIRAS_DE_TELHADO],
      detalhes: [...DETALHES_DE_TELHADO],
      estados: ESTADOS_DE_TELHADO,
    };
    case 'climas': return { climas: PRESETS_DE_CLIMA.map(c => ({ id: c.id, nome: c.nome, descricao: c.descricao })), acabamentos: PRESETS_DE_ACABAMENTO.map(a => ({ id: a.id, nome: a.nome })), generos: GENEROS.map(g => ({ id: g.id, nome: g.nome, descricao: g.descricao })), tiposDeComodo: TIPOS_DE_COMODO.map(t => ({ id: t.id, nome: t.nome, funcao: t.funcao, piso: t.piso, papel: t.papel })) };
    case 'luzes': return PRESETS_DE_LUZ.map(l => ({ id: l.id, nome: l.nome, descricao: l.descricao, raio: l.radius, cor: l.color, intensidade: l.intensity, tremulo: l.flicker, energia: l.power, cone: l.cone }));
    case 'presenca': return { pacotes: PACOTES_DE_PRESENCA, pincéis: PINCEIS_DE_PRESENCA.map(p => ({ id: p.id, nome: p.nome, pacote: p.pacote, cor: p.cor, brilha: p.brilho, ...(p.forma ? { forma: p.forma } : {}), ...(p.submerso ? { submerso: true } : {}) })) };
    case 'momentos': return { limites: { passosPorMomento: 60, nome: '1 a 60 caracteres' }, tiposDePasso: TIPOS_DE_PASSO };
    case undefined:
      if (termos.length) {
        return {
          receitas: listarReceitas().slice(0, LIMITE_BUSCA_CATALOGO),
          colecao: listarColecao().slice(0, LIMITE_BUSCA_CATALOGO),
          familias: listarFamilias().slice(0, LIMITE_BUSCA_CATALOGO),
          conjuntos: listarConjuntos().slice(0, LIMITE_BUSCA_CATALOGO),
          materiais: Object.values(MATERIAIS).filter(x => bate([x.id, x.nome, x.uso])).slice(0, LIMITE_BUSCA_CATALOGO).map(x => ({ id: x.id, nome: x.nome, uso: x.uso })),
        };
      }
      return { partes: { receitas: listaDeReceitas().length, colecao: COLECAO.length, familias: ACERVO.familias().length, conjuntos: TODOS_OS_CONJUNTOS.length, comodos: TIPOS_DE_COMODO.length, materiais: Object.fromEntries((['piso', 'papel', 'objeto', 'terreno', 'macico', 'agua', 'telhado'] as const).map(u => [u, materiaisDo(u).length])), telhado: ESTILOS_DE_TELHADO.length, climas: PRESETS_DE_CLIMA.length, luzes: PRESETS_DE_LUZ.length, presenca: PINCEIS_DE_PRESENCA.length, momentos: TIPOS_DE_PASSO.length }, dica: 'Peça uma parte por vez com atlas_catalogo { parte } ou use busca para procurar por palavra.' };
    default: throw new Error(`Parte desconhecida: "${String(parte)}". Use: ${PARTES.join(', ')}.`);
  }
}

const ROTULO_DO_MODO = { construir: 'Construir', sessao: 'Sessão' } as const;
const TIPO_DO_ALVO: Record<Alvo['colecao'], string> = { rooms: 'comodo', walls: 'parede', openings: 'abertura', regions: 'regiao', presence: 'presenca', props: 'objeto', lights: 'luz', tokens: 'peca' };

/** O que o mestre tem na tela: mapa aberto, modo, caixa visível da câmera e a seleção (ids, tipo, nome, posição). */
export function oQueVejo(ctx: ContextoDeLeitura): Record<string, unknown> {
  const m = ctx.mapaAberto();
  if (!m) return { mapa: null, dica: 'Nenhum mapa aberto no Atlas (veja atlas_mapas_listar e atlas_abrir).' };
  const nomeDe = (a: Alvo): string | null => {
    switch (a.colecao) {
      case 'rooms': return m.rooms[a.id]?.name ?? null;
      case 'tokens': return m.tokens[a.id]?.name ?? null;
      case 'props': { const o = m.props[a.id]; if (!o) return null; const id = o.source.kind === 'recipe' ? o.source.recipe : o.source.assetId; return listaDeReceitas().find(r => r.id === id)?.nome ?? id; }
      case 'lights': return m.lights[a.id]?.preset ?? null;
      case 'regions': { const g = m.regions[a.id]; return g ? (typeof g.payload.nome === 'string' ? g.payload.nome : g.kind) : null; }
      case 'openings': return m.openings[a.id]?.kind ?? null;
      default: return null;
    }
  };
  const selecao = (ctx.selecao?.() ?? []).flatMap(a => {
    const c = caixaDe(m, a);
    if (!c) return [];
    return [{ id: a.id, colecao: a.colecao, tipo: TIPO_DO_ALVO[a.colecao], nome: nomeDe(a), posicao: pt([(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]) }];
  });
  const v = ctx.caixaVisivel?.() ?? null, modo = ctx.modo?.() ?? null;
  const andarId = ctx.andarAtivo?.() ?? null;
  const infoAndar = listaDeAndares(m).find(a => a.id === andarId) ?? listaDeAndares(m)[0]!;
  return {
    mapa: { id: m.id, nome: m.name, ...(ctx.naoSalvo?.() ? { naoSalvo: true } : {}) },
    modo: modo ? ROTULO_DO_MODO[modo] : null,
    ...(ctx.andarAtivo || ehMultiandar(m) ? { andarAtivo: { id: infoAndar.id, nome: infoAndar.nome, ordem: infoAndar.order } } : {}),
    camera: v ? { caixa: [r1(v.x0), r1(v.y0), r1(v.x1), r1(v.y1)], unidade: 'm', dica: '[x0, y0, x1, y1] em metros, origem no canto superior esquerdo' } : null,
    selecao,
  };
}

/** Quanto `atlas_abrir` espera o editor nascer, e quanto as ferramentas que precisam do viewport esperam por ele. */
export const ESPERA_AO_ABRIR_MS = 10_000;
export const ESPERA_DO_EDITOR_MS = 5_000;
const PASSO_DA_ESPERA_MS = 100;

/** Espera o viewport existir, de 100 em 100 ms (com `setTimeout`, sem depender de quadro). `true` se apareceu; sem `editorPronto` no contexto, não espera. */
export async function esperarEditor(ctx: ContextoDeLeitura, limiteMs: number): Promise<boolean> {
  if (!ctx.editorPronto) return false;
  const dormir = ctx.dormir ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  for (let t = 0; t < limiteMs && !ctx.editorPronto(); t += PASSO_DA_ESPERA_MS) await dormir(PASSO_DA_ESPERA_MS);
  return ctx.editorPronto();
}

const vazio = { type: 'object', properties: {}, required: [], additionalProperties: false };

export function ferramentasDeLeitura(ctx: ContextoDeLeitura): FerramentaDaPonte[] {
  const repo = () => { const r = ctx.repo(); if (!r) throw new Error('O Atlas ainda não terminou de iniciar.'); return r; };
  /** O mapa pedido e se ele é o documento vivo (com `naoSalvo`): o aberto, depois uma aba em segundo plano, por fim o disco. */
  const carregarComEstado = async (id: unknown): Promise<{ mapa: MapaAtlas; naoSalvo: boolean }> => {
    if (id === undefined || id === '') { const a = ctx.mapaAberto(); if (!a) throw new Error('Não há mapa aberto: passe o "id" (veja atlas_mapas_listar).'); return { mapa: a, naoSalvo: ctx.naoSalvo?.() ?? false }; }
    if (typeof id !== 'string') throw new Error('O "id" deve ser texto.');
    const aberto = ctx.mapaAberto();
    if (aberto?.id === id) return { mapa: aberto, naoSalvo: ctx.naoSalvo?.() ?? false };
    const emAba = ctx.sessaoEmCache?.(id);
    if (emAba) return emAba;
    const m = await repo().obter(id);
    if (!m) throw new Error(`Não existe mapa com id "${id}".`);
    return { mapa: m, naoSalvo: false };
  };
  const carregar = async (id: unknown): Promise<MapaAtlas> => (await carregarComEstado(id)).mapa;
  return [
    {
      nome: 'atlas_o_que_vejo',
      descricao: 'O que o mestre vê na tela: mapa aberto, modo, câmera e seleção (ids, tipo, nome e posição em metros).',
      esquema: vazio,
      anotacoes: { leitura: true },
      async executar() {
        if (ctx.mapaAberto() && ctx.editorPronto && !ctx.editorPronto()) await esperarEditor(ctx, ESPERA_DO_EDITOR_MS);
        return [json(oQueVejo(ctx))];
      },
    },
    {
      nome: 'atlas_mapas_listar',
      descricao: 'Lista mapas salvos no Atlas (id, nome, tamanho, contagens, campanha e datas). Diz qual mapa está aberto.',
      esquema: vazio,
      anotacoes: { leitura: true },
      async executar() {
        const aberto = ctx.mapaAberto();
        const lista = await repo().listar();
        return [json({ aberto: aberto?.id ?? null, mapas: lista.map(m => ({ id: m.id, nome: m.nome, ...((m.id === aberto?.id ? ctx.naoSalvo?.() : ctx.sessaoEmCache?.(m.id)?.naoSalvo) ? { naoSalvo: true } : {}), celulas: m.celulas, comodos: m.comodos, objetos: m.objetos, luzes: m.luzes, pecas: m.pecas, campanhaId: m.campanhaId, criadoEm: m.criadoEm, atualizadoEm: m.atualizadoEm, ...(m.erro ? { erro: m.erro } : {}) })) })];
      },
    },
    {
      nome: 'atlas_mapa_ler',
      descricao: 'Resume o mapa (aberto ou por id): edifícios, cômodos, terreno, objetos, luzes, regiões, peças, clima, momentos e notas.',
      esquema: { type: 'object', properties: { id: { type: 'string' }, comodos: { type: 'array', items: { type: 'string' }, maxItems: 100 } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) {
        if (args.comodos !== undefined && !(Array.isArray(args.comodos) && args.comodos.every(x => typeof x === 'string'))) {
          throw new Error('"comodos" deve ser uma lista de ids.');
        }
        const comodos = args.comodos as string[] | undefined;
        // O aberto e os de abas em segundo plano são documentos vivos (com as edições ainda não gravadas); os demais vêm do disco.
        const { mapa, naoSalvo } = await carregarComEstado(args.id);
        return [json({ ...resumirMapa(mapa, comodos ? { comodos } : undefined), naoSalvo })];
      },
    },
    {
      nome: 'atlas_catalogo',
      descricao: 'Catálogo (receitas, colecao, conjuntos, comodos, materiais, telhado, climas, luzes, presenca, momentos) e busca por palavra.',
      esquema: { type: 'object', properties: { parte: { type: 'string', enum: [...PARTES] }, busca: { type: 'string', maxLength: 60 } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) {
        if (args.busca !== undefined && (typeof args.busca !== 'string' || args.busca.length > 60)) {
          throw new Error('"busca" deve ser um texto de até 60 caracteres.');
        }
        return [json(catalogo(typeof args.parte === 'string' ? args.parte : undefined, typeof args.busca === 'string' ? args.busca : undefined))];
      },
    },
    {
      nome: 'atlas_abrir',
      descricao: 'Abre um mapa no Atlas para visualização e edição.',
      esquema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
      anotacoes: { destrutiva: false, idempotente: true },
      async executar(args) {
        if (typeof args.id !== 'string' || !args.id) throw new Error('Falta o argumento "id".');
        const m = await carregar(args.id);
        await ctx.abrirMapa(m.id);
        // `abrirMapa` resolve antes de o viewport existir: espera o editor nascer (até 10 s) antes de responder.
        if (ctx.editorPronto && !(await esperarEditor(ctx, ESPERA_AO_ABRIR_MS))) return [json({ aberto: m.id, nome: m.name, aviso: 'O mapa abriu, mas o editor ainda não apareceu na tela (a aba pode estar em segundo plano). atlas_ver_mapa espera mais um pouco; se falhar, peça ao mestre para trazer a aba do Atlas para a frente.' })];
        return [json({ aberto: m.id, nome: m.name })];
      },
    },
    {
      nome: 'atlas_revisar',
      descricao: 'Revisa o mapa e aponta defeitos: cômodos sem acesso, casas iguais, fileiras, interiores vazios, luz.',
      esquema: { type: 'object', properties: { id: { type: 'string' }, regras: { type: 'array', items: { type: 'string' }, maxItems: 30 } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) {
        if (args.regras !== undefined && !(Array.isArray(args.regras) && args.regras.every(x => typeof x === 'string'))) {
          throw new Error('"regras" deve ser uma lista de nomes de regras.');
        }
        const regras = args.regras as string[] | undefined;
        const m = await carregar(args.id);
        const achados = revisarMapa(m, regras ? { regras } : undefined);
        const reais = achados.filter(a => a.regra !== 'mais');
        return [json({
          achados,
          resumo: {
            erros: reais.filter(a => a.gravidade === 'erro').length,
            avisos: reais.filter(a => a.gravidade === 'aviso').length,
            dicas: reais.filter(a => a.gravidade === 'dica').length,
          },
        })];
      },
    },
    {
      nome: 'atlas_ver_mapa',
      descricao: 'Captura JPEG do mapa (todo ou caixa [x0,y0,x1,y1] m). vista: planta ou telhados. Aceita andar.',
      esquema: { type: 'object', properties: { caixa: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, ladoMaximo: { type: 'number', minimum: 256, maximum: 1600 }, vista: { type: 'string', enum: ['planta', 'telhados'] }, andar: { type: ['string', 'null'] } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) {
        const c = args.caixa;
        if (c !== undefined && !(Array.isArray(c) && c.length === 4 && c.every(n => typeof n === 'number' && Number.isFinite(n)))) throw new Error('"caixa" deve ser [x0, y0, x1, y1] em metros.');
        const v = args.vista;
        if (v !== undefined && v !== 'planta' && v !== 'telhados') throw new Error('"vista" deve ser "planta" ou "telhados".');
        const vista: 'planta' | 'telhados' = v ?? 'planta';
        const aberto = ctx.mapaAberto();
        if (!aberto) throw new Error('Não há mapa aberto: use atlas_abrir.');
        if (args.andar !== undefined && args.andar !== null && typeof args.andar !== 'string') throw new Error('"andar" deve ser o id de um andar ou null para o térreo.');
        const andarAlvo: string | null | undefined = args.andar as string | null | undefined;
        if (typeof andarAlvo === 'string' && !aberto.levels?.[andarAlvo]) {
          const validos = listaDeAndares(aberto).map(a => a.id ?? 'null').join(', ');
          throw new Error(`Andar "${andarAlvo}" não existe. Disponíveis: ${validos}.`);
        }
        const lm = args.ladoMaximo;
        if (lm !== undefined && !(typeof lm === 'number' && Number.isFinite(lm) && lm >= 256 && lm <= 1600)) throw new Error('"ladoMaximo" deve ser um número de 256 a 1600.');
        const opcoes = { ...(lm !== undefined ? { ladoMaximo: lm } : {}), ...(c ? { caixa: { x0: c[0] as number, y0: c[1] as number, x1: c[2] as number, y1: c[3] as number } } : {}), vista };
        const anterior = ctx.andarAtivo?.() ?? null;
        const trocouAndar = andarAlvo !== undefined && andarAlvo !== anterior && Boolean(ctx.definirAndarAtivo);
        if (trocouAndar) ctx.definirAndarAtivo!(andarAlvo);
        try {
          let p = ctx.capturar?.(opcoes);
          if (!p && await esperarEditor(ctx, ESPERA_DO_EDITOR_MS)) {
            if (trocouAndar) ctx.definirAndarAtivo!(andarAlvo);
            p = ctx.capturar?.(opcoes);
          }
          if (!p) throw new Error('O editor não está na tela: abra o mapa no Atlas (atlas_abrir).');
          let r: { dataUrl: string; largura: number; altura: number; pxPorMetro: number; bytes: number; qualidade: number; caixa: { x0: number; y0: number; x1: number; y1: number }; aviso?: string };
          try {
            r = await p;
          } catch (erro) {
            const msg = erro instanceof Error ? erro.message : String(erro);
            return [{ tipo: 'texto', texto: `não consegui capturar: ${msg}` }];
          }
          const k = r.caixa;
          const textoAviso = r.aviso ? ` Aviso: ${r.aviso}.` : '';
          const idCapturado = andarAlvo !== undefined ? andarAlvo : anterior;
          const infoAndar = ehMultiandar(aberto) || andarAlvo !== undefined
            ? `, andar: ${listaDeAndares(aberto).find(a => a.id === idCapturado)?.nome ?? 'Térreo'}`
            : '';
          return [
            imagem(r.dataUrl),
            { tipo: 'texto', texto: `Imagem ${r.largura}×${r.altura} px (vista: ${vista}${infoAndar}). Escala: ${r.pxPorMetro} px por metro. JPEG de ${Math.round(r.bytes / 1024)} KB (qualidade ${r.qualidade}). Caixa em metros: [${r1(k.x0)}, ${r1(k.y0)}, ${r1(k.x1)}, ${r1(k.y1)}] (o pixel 0,0 é o ponto x0,y0).${textoAviso}` },
          ];
        } finally {
          if (trocouAndar) ctx.definirAndarAtivo!(anterior);
        }
      },
    },
  ];
}
