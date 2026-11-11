import { imagem, json, type FerramentaDaPonte } from '#mesa/ponte';
import { area, limites } from '../domain/celulas.ts';
import { EVENTOS_DE_CENA } from '../domain/eventos-de-cena.ts';
import { colunas, linhas, type MapaAtlas, type Ponto } from '../domain/mapa.ts';
import { descreverPasso } from '../domain/momentos.ts';
import { GENEROS, PACOTES_DE_PRESENCA, PINCEIS_DE_PRESENCA, PRESETS_DE_ACABAMENTO, PRESETS_DE_CLIMA, PRESETS_DE_LUZ, TIPOS_DE_COMODO } from '../domain/presets.ts';
import { COLECAO } from '../procedural/colecao.ts';
import { materiaisDo } from '../procedural/materiais.ts';
import { listaDeReceitas } from '../procedural/receitas/index.ts';
import { caixaDe, type Alvo, type Caixa } from '../render/selecao.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';

/** O que as ferramentas de leitura precisam do Atlas; o app liga isto aos signals (sem DOM, dá para testar com um banco em memória). */
export interface ContextoDeLeitura {
  repo: () => Pick<RepositorioMapas, 'listar' | 'obter'> | null;
  /** O mapa aberto agora, ou `null`. */
  mapaAberto: () => MapaAtlas | null;
  abrirMapa: (id: string) => Promise<void>;
  /** O modo do editor agora (`construir` ou `sessao`). */
  modo?: () => 'construir' | 'sessao';
  /** A seleção atual do editor. */
  selecao?: () => readonly Alvo[];
  /** O que a câmera mostra agora, em metros; `null` quando não há editor na tela. */
  caixaVisivel?: () => Caixa | null;
  /** Fotografa o mapa aberto (o viewport); ausente ou `null` quando não há editor na tela. */
  capturar?: (opcoes: { caixa?: { x0: number; y0: number; x1: number; y1: number }; ladoMaximo?: number }) => Promise<{ dataUrl: string; largura: number; altura: number; pxPorMetro: number; bytes: number; qualidade: number; caixa: { x0: number; y0: number; x1: number; y1: number } }> | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Ponto): Ponto => [r1(p[0]), r1(p[1])];
const MAX_POSICOES = 8;

/** O resumo do documento para o assistente: significado e contagens, nunca as células cruas. */
export function resumirMapa(m: MapaAtlas): Record<string, unknown> {
  const t = m.grid.size;
  const camadas = Object.values(m.terrain.layers).sort((a, b) => a.order - b.order).map(c => ({ id: c.id, material: c.material, celulas: area(c.cells), ...(c.flow ? { correnteza: { angulo: r1(c.flow.angle), velocidade: r1(c.flow.speed) } } : {}) }));
  const comodos = Object.values(m.rooms).map(c => {
    const l = limites(c.cells);
    return { id: c.id, nome: c.name, funcao: c.function, celulas: area(c.cells), piso: c.floor.material, ...(l ? { retangulo: [r1(l.x0 * t), r1(l.y0 * t), r1((l.x1 - l.x0 + 1) * t), r1((l.y1 - l.y0 + 1) * t)] } : {}) };
  });
  const grupos = new Map<string, { quantidade: number; ids: string[]; posicoes: Ponto[] }>();
  for (const o of Object.values(m.props)) {
    const chave = o.source.kind === 'recipe' ? o.source.recipe : `asset:${o.source.assetId}`;
    const g = grupos.get(chave) ?? { quantidade: 0, ids: [], posicoes: [] };
    g.quantidade++;
    if (g.posicoes.length < MAX_POSICOES) { g.posicoes.push(pt(o.position)); g.ids.push(o.id); }
    grupos.set(chave, g);
  }
  const objetos = [...grupos].map(([fonte, g]) => ({ fonte, quantidade: g.quantidade, posicoes: g.posicoes, ids: g.ids, ...(g.quantidade > g.posicoes.length ? { maisPosicoes: g.quantidade - g.posicoes.length } : {}) }));
  const luzes = Object.values(m.lights).map(l => ({ id: l.id, posicao: pt(l.position), raio: r1(l.radius), cor: l.color, preset: l.preset, ligada: l.on, energia: l.power }));
  const regioes = Object.values(m.regions).map(g => {
    const xs = g.polygon.map(p => p[0]), ys = g.polygon.map(p => p[1]);
    return { id: g.id, tipo: g.kind, soMestre: g.gmOnly, retangulo: g.polygon.length ? [r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))] : null, ...(typeof g.payload.nome === 'string' ? { nome: g.payload.nome } : {}), ...(typeof g.payload.momento === 'string' ? { momento: g.payload.momento } : {}) };
  });
  return {
    id: m.id, nome: m.name, revisao: m.revision, campanhaId: m.campanhaId,
    tamanho: { largura: m.bounds.width, altura: m.bounds.height, unidade: 'm' },
    grade: { tipo: m.grid.kind, celula: t, colunas: colunas(m), linhas: linhas(m) },
    estilo: { renderizador: m.style.renderer, genero: m.style.genre, paleta: m.style.palette },
    terreno: { resolucao: m.terrain.resolution, base: m.terrain.base, camadas },
    comodos, paredes: Object.keys(m.walls).length, aberturas: Object.values(m.openings).reduce<Record<string, number>>((a, o) => { a[o.kind] = (a[o.kind] ?? 0) + 1; return a; }, {}),
    objetos, luzes, regioes,
    presenca: Object.values(m.presence).map(p => ({ id: p.id, pincel: p.brush, celulas: area(p.cells) })),
    pecas: Object.values(m.tokens).map(p => ({ id: p.id, nome: p.name, jogador: p.player, posicao: pt(p.position) })),
    clima: { preset: m.climate.preset, hora: m.climate.time, tempo: Object.fromEntries(Object.entries(m.climate.weather).filter(([, v]) => v !== 0)) },
    acabamento: m.finish.preset,
    climasSalvos: Object.values(m.customClimates).map(c => ({ id: c.id, nome: c.name })),
    momentos: Object.values(m.moments).map(mo => ({ id: mo.id, nome: mo.nome, passos: mo.passos.map(p => descreverPasso(p, m)) })),
    notas: m.notes,
  };
}

type Parte = 'receitas' | 'colecao' | 'materiais' | 'climas' | 'luzes' | 'presenca' | 'momentos';
const PARTES: readonly Parte[] = ['receitas', 'colecao', 'materiais', 'climas', 'luzes', 'presenca', 'momentos'];

const TIPOS_DE_PASSO = [
  { tipo: 'esperar', campos: { ms: 'número, 100 a 120000' }, descricao: 'Espera antes do próximo passo.' },
  { tipo: 'som', campos: { ref: 'Ref { app, tipo, id } de uma cena sonora ou efeito do Jukebox' }, descricao: 'Toca um som.' },
  { tipo: 'silencio', campos: { ms: 'número, 0 a 30000 (fade)' }, descricao: 'Apaga o som do Jukebox com fade.' },
  { tipo: 'efeito', campos: { efeito: [...EVENTOS_DE_CENA, 'relampago'] }, descricao: 'Efeito curto de cena.' },
  { tipo: 'clima', campos: { clima: 'id de uma predefinição de clima ou de um clima salvo do mapa, até 60 caracteres' }, descricao: 'Troca o clima.' },
  { tipo: 'tela', campos: { acao: ['escurecer', 'clarear'], ms: 'número, 0 a 10000' }, descricao: 'Cortina preta no projetor.' },
  { tipo: 'letreiro', campos: { titulo: 'texto, até 120', subtitulo: 'texto, até 200', peca: 'id de peça ou null', estilo: ['apresentacao', 'capitulo'], ms: 'número, 1000 a 20000' }, descricao: 'Letreiro sobre o mapa.' },
  { tipo: 'camera', campos: { alvo: '{ colecao: "rooms" | "regions" | "tokens", id }' }, descricao: 'Enquadra um cômodo, região ou peça.' },
  { tipo: 'revelar', campos: { ids: 'ids de cômodos/aberturas, até 100' }, descricao: 'Revela cômodos aos jogadores.' },
  { tipo: 'interagir', campos: { id: 'id de objeto interagível ou porta' }, descricao: 'Aciona um interruptor, gaveta ou porta.' },
  { tipo: 'pista', campos: { ref: 'Ref de um documento do Ateliê', mostrar: 'booleano (true já projeta)' }, descricao: 'Revela uma pista.' },
  { tipo: 'nota', campos: { texto: 'até 400 caracteres' }, descricao: 'Aviso só para o mestre.' },
];

export function catalogo(parte?: string): unknown {
  switch (parte as Parte | undefined) {
    case 'receitas': return listaDeReceitas().map(r => ({ id: r.id, nome: r.nome, categoria: r.categoria, tipo: r.tipo, funcoes: r.funcoes, tags: r.tags, ...(r.generos?.length ? { generos: r.generos } : {}), ...(r.kit ? { kit: r.kit } : {}), pegada: r.pegada, ...(r.altura !== undefined ? { altura: r.altura } : {}), ...(r.submerso ? { submerso: true } : {}), ...(r.campos?.length ? { campos: r.campos.map(c => ({ id: c.id, rotulo: c.rotulo, tipo: c.tipo, padrao: c.padrao, ...(c.min !== undefined ? { min: c.min } : {}), ...(c.max !== undefined ? { max: c.max } : {}), ...(c.uso ? { uso: c.uso } : {}) })) } : {}) }));
    case 'colecao': return COLECAO.map(i => ({ id: i.id, nome: i.nome, categoria: i.categoria, pegada: i.pegada, funcoes: i.funcoes, tags: i.tags, ...(i.generos.length ? { generos: i.generos } : {}), ...(i.kit ? { kit: i.kit } : {}) }));
    case 'materiais': {
      const usos = ['piso', 'papel', 'objeto', 'terreno', 'macico', 'agua', 'telhado'] as const;
      return Object.fromEntries(usos.map(u => [u, materiaisDo(u).map(x => ({ id: x.id, nome: x.nome }))]));
    }
    case 'climas': return { climas: PRESETS_DE_CLIMA.map(c => ({ id: c.id, nome: c.nome, descricao: c.descricao })), acabamentos: PRESETS_DE_ACABAMENTO.map(a => ({ id: a.id, nome: a.nome })), generos: GENEROS.map(g => ({ id: g.id, nome: g.nome, descricao: g.descricao })), tiposDeComodo: TIPOS_DE_COMODO.map(t => ({ id: t.id, nome: t.nome, funcao: t.funcao, piso: t.piso, papel: t.papel })) };
    case 'luzes': return PRESETS_DE_LUZ.map(l => ({ id: l.id, nome: l.nome, descricao: l.descricao, raio: l.radius, cor: l.color, intensidade: l.intensity, tremulo: l.flicker, energia: l.power, cone: l.cone }));
    case 'presenca': return { pacotes: PACOTES_DE_PRESENCA, pincéis: PINCEIS_DE_PRESENCA.map(p => ({ id: p.id, nome: p.nome, pacote: p.pacote, cor: p.cor, brilha: p.brilho, ...(p.forma ? { forma: p.forma } : {}), ...(p.submerso ? { submerso: true } : {}) })) };
    case 'momentos': return { limites: { passosPorMomento: 60, nome: '1 a 60 caracteres' }, tiposDePasso: TIPOS_DE_PASSO };
    case undefined: return { partes: { receitas: listaDeReceitas().length, colecao: COLECAO.length, materiais: Object.fromEntries((['piso', 'papel', 'objeto', 'terreno', 'macico', 'agua', 'telhado'] as const).map(u => [u, materiaisDo(u).length])), climas: PRESETS_DE_CLIMA.length, luzes: PRESETS_DE_LUZ.length, presenca: PINCEIS_DE_PRESENCA.length, momentos: TIPOS_DE_PASSO.length }, dica: 'Peça uma parte por vez com atlas_catalogo { parte }.' };
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
  return {
    mapa: { id: m.id, nome: m.name },
    modo: modo ? ROTULO_DO_MODO[modo] : null,
    camera: v ? { caixa: [r1(v.x0), r1(v.y0), r1(v.x1), r1(v.y1)], unidade: 'm', dica: '[x0, y0, x1, y1] em metros, origem no canto superior esquerdo' } : null,
    selecao,
  };
}

const vazio = { type: 'object', properties: {}, required: [], additionalProperties: false };

export function ferramentasDeLeitura(ctx: ContextoDeLeitura): FerramentaDaPonte[] {
  const repo = () => { const r = ctx.repo(); if (!r) throw new Error('O Atlas ainda não terminou de iniciar.'); return r; };
  const carregar = async (id: unknown): Promise<MapaAtlas> => {
    if (id === undefined || id === '') { const a = ctx.mapaAberto(); if (!a) throw new Error('Não há mapa aberto: passe o "id" (veja atlas_mapas_listar).'); return a; }
    if (typeof id !== 'string') throw new Error('O "id" deve ser texto.');
    const aberto = ctx.mapaAberto();
    if (aberto?.id === id) return aberto;
    const m = await repo().obter(id);
    if (!m) throw new Error(`Não existe mapa com id "${id}".`);
    return m;
  };
  return [
    {
      nome: 'atlas_o_que_vejo',
      descricao: 'O que o mestre vê na tela: mapa aberto, modo, câmera e seleção (ids, tipo, nome e posição em metros).',
      esquema: vazio,
      anotacoes: { leitura: true },
      async executar() { return [json(oQueVejo(ctx))]; },
    },
    {
      nome: 'atlas_mapas_listar',
      descricao: 'Lista mapas salvos no Atlas (id, nome, tamanho, contagens, campanha e datas). Diz qual mapa está aberto.',
      esquema: vazio,
      anotacoes: { leitura: true },
      async executar() {
        const aberto = ctx.mapaAberto();
        const lista = await repo().listar();
        return [json({ aberto: aberto?.id ?? null, mapas: lista.map(m => ({ id: m.id, nome: m.nome, celulas: m.celulas, comodos: m.comodos, objetos: m.objetos, luzes: m.luzes, pecas: m.pecas, campanhaId: m.campanhaId, criadoEm: m.criadoEm, atualizadoEm: m.atualizadoEm, ...(m.erro ? { erro: m.erro } : {}) })) })];
      },
    },
    {
      nome: 'atlas_mapa_ler',
      descricao: 'Resume o mapa (aberto ou por id): terreno, cômodos, objetos, luzes, regiões, peças, clima, momentos e notas.',
      esquema: { type: 'object', properties: { id: { type: 'string' } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) { return [json(resumirMapa(await carregar(args.id)))]; },
    },
    {
      nome: 'atlas_catalogo',
      descricao: 'Catálogo de opções (receitas, colecao, materiais, climas, luzes, presenca, momentos). Use para não inventar ids.',
      esquema: { type: 'object', properties: { parte: { type: 'string', enum: [...PARTES] } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) { return [json(catalogo(typeof args.parte === 'string' ? args.parte : undefined))]; },
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
        return [json({ aberto: m.id, nome: m.name })];
      },
    },
    {
      nome: 'atlas_ver_mapa',
      descricao: 'Captura imagem JPEG do mapa aberto (todo, ou recorte com caixa [x0,y0,x1,y1] em metros). Retorna escala e caixa.',
      esquema: { type: 'object', properties: { caixa: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, ladoMaximo: { type: 'number', minimum: 256, maximum: 1600 } }, required: [], additionalProperties: false },
      anotacoes: { leitura: true },
      async executar(args) {
        const c = args.caixa;
        if (c !== undefined && !(Array.isArray(c) && c.length === 4 && c.every(n => typeof n === 'number' && Number.isFinite(n)))) throw new Error('"caixa" deve ser [x0, y0, x1, y1] em metros.');
        if (!ctx.mapaAberto()) throw new Error('Não há mapa aberto: use atlas_abrir.');
        const lm = args.ladoMaximo;
        if (lm !== undefined && !(typeof lm === 'number' && Number.isFinite(lm) && lm >= 256 && lm <= 1600)) throw new Error('"ladoMaximo" deve ser um número de 256 a 1600.');
        const p = ctx.capturar?.({ ...(lm !== undefined ? { ladoMaximo: lm } : {}), ...(c ? { caixa: { x0: c[0] as number, y0: c[1] as number, x1: c[2] as number, y1: c[3] as number } } : {}) });
        if (!p) throw new Error('O editor não está na tela: abra o mapa no Atlas (atlas_abrir).');
        const r = await p, k = r.caixa;
        return [
          imagem(r.dataUrl),
          { tipo: 'texto', texto: `Imagem ${r.largura}×${r.altura} px. Escala: ${r.pxPorMetro} px por metro. JPEG de ${Math.round(r.bytes / 1024)} KB (qualidade ${r.qualidade}). Caixa em metros: [${r1(k.x0)}, ${r1(k.y0)}, ${r1(k.x1)}, ${r1(k.y1)}] (o pixel 0,0 é o ponto x0,y0).` },
        ];
      },
    },
  ];
}
