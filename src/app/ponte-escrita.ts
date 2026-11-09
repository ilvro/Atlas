import { json, texto, type FerramentaDaPonte } from '#mesa/ponte';
import { comodos, ErroDeConstrucao, paredes, portas, terreno, type Construcao } from '../authoring/construcao.ts';
import type { Forma } from '../authoring/formas.ts';
import { criarMapa, type MapaAtlas } from '../domain/mapa.ts';
import { GENEROS, TIPOS_DE_COMODO } from '../domain/presets.ts';
import { validarMapa } from '../domain/validacao.ts';
import { materiaisDo } from '../procedural/materiais.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';
import type { Comando } from '../state/comandos.ts';
import type { Store } from '../state/store.ts';

/** Os ids de tudo o que o assistente criou nesta aba (a 14.2e usa para decidir o que pede confirmação). Só vale até recarregar a aba. */
export const criadosPeloAssistente = new Set<string>();

/** O que as ferramentas de escrita precisam do Atlas; o app liga isto aos signals (sem DOM, dá para testar com store e repositório falsos). */
export interface ContextoDeEscrita {
  /** O store do mapa aberto, ou `null` quando não há mapa aberto. */
  store: () => Pick<Store, 'documento' | 'transacao'> | null;
  repo: () => Pick<RepositorioMapas, 'salvar'> | null;
  /** Mantém a entidade "lugar" da campanha em dia depois de gravar um mapa novo. */
  sincronizarCampanha?: (mapa: MapaAtlas) => Promise<void>;
  /** Abre o mapa na aba (o mesmo caminho do "novo mapa"); resolve quando ele está aberto. */
  abrirMapa: (id: string) => Promise<void>;
  /** A campanha ativa do app, usada quando `atlas_mapa_criar` não recebe `campanhaId`. */
  campanhaAtiva?: () => string | null;
}

export interface Geracao { comandos: readonly Comando[]; ids: readonly string[] }

const SEM_MAPA = 'Não há mapa aberto: abra um com atlas_abrir ou crie com atlas_mapa_criar.';
const MAX_ITENS = 100;

/**
 * Base de toda escrita: pega o mapa aberto, deixa `gerar` produzir os comandos e aplica tudo numa só `store.transacao` (um Ctrl+Z).
 * Se algo falhar (construção, comando ou validação), a transação desfaz e o erro sobe com a mensagem legível.
 */
export function escrever(ctx: ContextoDeEscrita, rotulo: string, gerar: (mapa: MapaAtlas) => Geracao): string {
  const store = ctx.store();
  if (!store) throw new Error(SEM_MAPA);
  const { comandos, ids } = gerar(store.documento);
  if (!comandos.length) return `${rotulo}: nada mudou (nenhum comando gerado). Confira as coordenadas com atlas_ver_mapa.`;
  store.transacao(`IA: ${rotulo}`, g => { for (const c of comandos) g.aplicar(c); });
  for (const id of ids) criadosPeloAssistente.add(id);
  return `${rotulo}: ${comandos.length} comando(s) aplicados como um passo de desfazer.${ids.length ? ` Ids criados: ${ids.join(', ')}.` : ''} Confira com atlas_ver_mapa.`;
}

// ---------- Esquemas JSON ----------
const ponto = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: '[x, y] em metros (origem no canto superior esquerdo, y para baixo).' };
const irregular = { type: 'number', minimum: 0, description: 'Amplitude (m) de uma borda irregular natural; 0,3 a 0,8 para bordas orgânicas. Omita para borda lisa.' };

/** O esquema JSON de uma `Forma` do terreno (metros). Reaproveitado por `atlas_terreno` e, depois, por `atlas_espalhar` e `atlas_presenca`. */
export function esquemaDaForma(): Record<string, unknown> {
  return {
    description: 'Uma região do mapa em METROS. Use exatamente UMA destas formas.',
    oneOf: [
      { type: 'object', properties: { disco: ponto, raio: { type: 'number', exclusiveMinimum: 0 }, irregular }, required: ['disco', 'raio'], additionalProperties: false, description: 'Círculo: centro e raio em metros.' },
      { type: 'object', properties: { poligono: { type: 'array', items: ponto, minItems: 3 }, irregular }, required: ['poligono'], additionalProperties: false, description: 'Polígono fechado (mínimo 3 pontos).' },
      { type: 'object', properties: { faixa: { type: 'array', items: ponto, minItems: 1 }, largura: { type: 'number', exclusiveMinimum: 0 }, irregular }, required: ['faixa', 'largura'], additionalProperties: false, description: 'Faixa de largura (m) ao longo de uma polilinha: trilha, rio, muro de rocha.' },
      { type: 'object', properties: { retangulo: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: '[x0, y0, x1, y1] em metros.' }, irregular }, required: ['retangulo'], additionalProperties: false, description: 'Retângulo em metros.' },
      { type: 'object', properties: { celulas: { type: 'array', items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 } } }, required: ['celulas'], additionalProperties: false, description: 'Células exatas do terreno [i, j] (cada uma tem 0,25 m).' },
    ],
  };
}

/** O esquema de um retângulo de células do grid: `[x0, y0, x1, y1]`, fim exclusivo. */
export const esquemaDoRetanguloDeCelulas = { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4, description: '[x0, y0, x1, y1] em CÉLULAS do grid (1,5 m cada); x1 e y1 são exclusivos. Ex.: [2, 3, 5, 6] é um cômodo de 3 × 3 células (4,5 × 4,5 m).' };

const semente = { type: 'number', description: 'Semente opcional para o acaso (bordas irregulares, pisos). Mesma semente, mesmo resultado.' };

// ---------- Validação de argumentos ----------
type Args = Record<string, unknown>;
const objeto = (v: unknown, nome: string): Args => { if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`"${nome}" deve ser um objeto.`); return v as Args; };
function itens(args: Args, campo: string): Args[] {
  const v = args[campo];
  if (!Array.isArray(v) || !v.length) throw new Error(`Falta "${campo}": uma lista com ao menos 1 item.`);
  if (v.length > MAX_ITENS) throw new Error(`"${campo}" aceita até ${MAX_ITENS} itens por chamada (recebeu ${v.length}); divida em várias chamadas.`);
  return v.map((x, i) => objeto(x, `${campo}[${i}]`));
}
const numero = (v: unknown, nome: string, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`"${nome}" deve ser um número entre ${min} e ${max}.`);
  return v;
};
const textoOpcional = (v: unknown, nome: string, max = 200): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || v.length > max) throw new Error(`"${nome}" deve ser texto de até ${max} caracteres.`);
  return v;
};
const sementeDe = (args: Args): number => args.semente === undefined ? Math.floor(Math.random() * 1_000_000) + 1 : numero(args.semente, 'semente', -1e9, 1e9);

const baseValida = (id: string): boolean => id === 'vazio' || materiaisDo('terreno').some(m => m.id === id) || id.startsWith('grama#') || id.startsWith('grama:');
function verificarBase(id: unknown): string {
  if (typeof id !== 'string' || !baseValida(id)) throw new ErroDeConstrucao(`base “${String(id)}” não existe; bases: vazio, ${materiaisDo('terreno').map(m => m.id).join(', ')}`);
  return id;
}

/** Aplica uma `Construcao` pura às ferramentas: devolve os comandos e ids. */
const geracao = (c: Construcao): Geracao => ({ comandos: c.comandos, ids: c.ids });

const unidades = 'UNIDADES: coordenadas em METROS (origem no canto superior esquerdo, y para baixo), exceto "comodos", em células do grid de 1,5 m.';

export function ferramentasDeEscrita(ctx: ContextoDeEscrita): FerramentaDaPonte[] {
  return [
    {
      nome: 'atlas_mapa_criar',
      descricao: `Cria um mapa novo (vazio), grava e abre na aba; as próximas ferramentas de escrita atuam sobre ele. "largura" e "altura" em METROS (3 a 600; o padrão do app é 45 × 30; o grid tem células de 1,5 m). "base" é o terreno de fundo (ex.: "grama", "vazio"). "genero": ${GENEROS.map(g => g.id).join(', ')}. "estilo": "ilustrado" ou "pixel". Com "campanhaId" (veja campanha_listar) o mapa entra na campanha como um lugar. Devolve o id.`,
      esquema: { type: 'object', properties: {
        nome: { type: 'string', description: 'Nome do mapa.' }, largura: { type: 'number', description: 'Largura em metros (3 a 600).' }, altura: { type: 'number', description: 'Altura em metros (3 a 600).' },
        base: { type: 'string', description: 'Terreno de fundo: "vazio" ou um material de terreno (ex.: "grama").' }, genero: { type: 'string', enum: GENEROS.map(g => g.id) },
        estilo: { type: 'string', enum: ['ilustrado', 'pixel'] }, campanhaId: { type: 'string', description: 'Id da campanha (campanha_listar); omita para usar a campanha ativa do app.' }, notas: { type: 'string', description: 'Notas do mestre sobre o mapa.' },
      }, required: ['nome', 'largura', 'altura'], additionalProperties: false },
      async executar(args) {
        const nome = textoOpcional(args.nome, 'nome', 120);
        if (!nome) throw new Error('Falta o argumento "nome".');
        const largura = numero(args.largura, 'largura', 3, 600), altura = numero(args.altura, 'altura', 3, 600);
        const campanhaId = textoOpcional(args.campanhaId, 'campanhaId', 80) ?? ctx.campanhaAtiva?.() ?? null;
        const mapa = criarMapa({ nome, largura, altura, campanhaId });
        if (args.base !== undefined) mapa.terrain.base = verificarBase(args.base);
        if (args.genero !== undefined) {
          const g = GENEROS.find(x => x.id === args.genero);
          if (!g) throw new Error(`gênero “${String(args.genero)}” não existe; gêneros: ${GENEROS.map(x => x.id).join(', ')}`);
          mapa.style.genre = g.id;
        }
        if (args.estilo !== undefined) {
          if (args.estilo !== 'ilustrado' && args.estilo !== 'pixel') throw new Error('"estilo" deve ser "ilustrado" ou "pixel".');
          mapa.style.renderer = args.estilo === 'pixel' ? 'pixel' : 'illustrated';
        }
        const notas = textoOpcional(args.notas, 'notas', 5000);
        if (notas) mapa.notes = notas;
        validarMapa(mapa);
        const repo = ctx.repo();
        if (!repo) throw new Error('O Atlas ainda não terminou de iniciar.');
        const gravado = await repo.salvar(mapa);
        await ctx.sincronizarCampanha?.(gravado);
        await ctx.abrirMapa(gravado.id);
        return [json({ id: gravado.id, nome: gravado.name, largura, altura, unidade: 'm', campanhaId: gravado.campanhaId, dica: 'Mapa aberto. Use atlas_terreno, atlas_comodos, atlas_paredes e atlas_portas; confira com atlas_ver_mapa.' })];
      },
    },
    {
      nome: 'atlas_terreno',
      descricao: `Pinta ou apaga terreno no mapa aberto, tudo como UM passo de desfazer. ${unidades} "base" troca o terreno de fundo. "operacoes" é uma lista aplicada em ordem: { acao: "pintar" | "apagar", material, forma }. "material" (só em pintar) é de terreno (grama, terra, areia…), maciço (rocha, escarpa) ou água; ids inválidos voltam com a lista. "forma" é UMA de: disco { disco: [x, y], raio }, poligono { poligono: [[x, y]…] }, faixa { faixa: [[x, y]…], largura } (trilha, rio), retangulo { retangulo: [x0, y0, x1, y1] } ou celulas; "irregular" (m) deixa a borda orgânica. Rocha e escarpa são maciço de terreno, não paredes. "correnteza" { material, angulo (radianos), velocidade (0 a 3 m/s) } move a água desse material (ela precisa existir depois das operações).`,
      esquema: { type: 'object', properties: {
        base: { type: 'string', description: 'Terreno de fundo: "vazio" ou um material de terreno.' },
        operacoes: { type: 'array', maxItems: MAX_ITENS, items: { type: 'object', properties: { acao: { type: 'string', enum: ['pintar', 'apagar'] }, material: { type: 'string', description: 'Material de terreno, maciço ou água (obrigatório em pintar).' }, forma: esquemaDaForma() }, required: ['acao', 'forma'], additionalProperties: false } },
        correnteza: { type: 'object', properties: { material: { type: 'string', description: 'Material de água já pintado, ex. "agua.rio".' }, angulo: { type: 'number', description: 'Direção em radianos (0 = para a direita, π/2 = para baixo).' }, velocidade: { type: 'number', minimum: 0, maximum: 3, description: 'm/s; 0 deixa a água parada.' } }, required: ['material', 'angulo', 'velocidade'], additionalProperties: false },
        semente,
      }, additionalProperties: false },
      async executar(args) {
        if (args.base === undefined && args.operacoes === undefined && args.correnteza === undefined) throw new Error('Passe "base", "operacoes" e/ou "correnteza".');
        const ops = args.operacoes === undefined ? [] : itens(args, 'operacoes');
        const s = sementeDe(args);
        return [texto(escrever(ctx, 'terreno', mapa => {
          const comandos: Comando[] = [];
          if (args.base !== undefined) comandos.push({ tipo: 'terreno.base', material: verificarBase(args.base) });
          if (ops.length) comandos.push(...terreno(mapa, ops.map(o => ({ acao: o.acao as 'pintar' | 'apagar', material: textoOpcional(o.material, 'material', 80), forma: validarForma(o.forma) })), s).comandos);
          if (args.correnteza !== undefined) {
            const c = objeto(args.correnteza, 'correnteza');
            comandos.push({ tipo: 'terreno.correnteza', material: textoOpcional(c.material, 'material', 80) ?? '', flow: { angle: numero(c.angulo, 'correnteza.angulo', -100, 100), speed: numero(c.velocidade, 'correnteza.velocidade', 0, 3) } });
          }
          return { comandos, ids: [] };
        }))];
      },
    },
    {
      nome: 'atlas_comodos',
      descricao: `Cria cômodos no mapa aberto (um passo de desfazer); as paredes de cada cômodo nascem sozinhas. ATENÇÃO: aqui as coordenadas são em CÉLULAS do grid de 1,5 m, não em metros: "rets" é uma lista de retângulos [x0, y0, x1, y1] com x1 e y1 EXCLUSIVOS (uma cabana de 3 × 3 células em [2, 3] é [2, 3, 5, 6] e mede 4,5 × 4,5 m). Vários retângulos formam um cômodo em L. "tipo" (obrigatório): ${TIPOS_DE_COMODO.map(t => t.id).join(', ')}. "nome", "piso", "papel" (parede interna) e "telhado" (material, ou null para sem telhado) são opcionais; os padrões vêm do tipo. "telhadoVisivel" mostra ou esconde o telhado.`,
      esquema: { type: 'object', properties: {
        comodos: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          rets: { type: 'array', minItems: 1, items: esquemaDoRetanguloDeCelulas }, tipo: { type: 'string', enum: TIPOS_DE_COMODO.map(t => t.id) }, nome: { type: 'string' },
          piso: { type: 'string', description: 'Material de piso (ex. "madeira.media"); o padrão vem do tipo.' }, papel: { type: 'string', description: 'Material do papel de parede.' },
          telhado: { type: ['string', 'null'], description: 'Material do telhado; null para nenhum.' }, telhadoVisivel: { type: 'boolean' },
        }, required: ['rets', 'tipo'], additionalProperties: false } },
        semente,
      }, required: ['comodos'], additionalProperties: false },
      async executar(args) {
        const pedidos = itens(args, 'comodos').map((c, i) => ({
          rets: retangulos(c.rets, `comodos[${i}].rets`), tipo: String(c.tipo ?? ''), nome: textoOpcional(c.nome, 'nome', 120), piso: textoOpcional(c.piso, 'piso', 80), papel: textoOpcional(c.papel, 'papel', 80),
          ...(c.telhado !== undefined ? { telhado: c.telhado === null ? null : textoOpcional(c.telhado, 'telhado', 80) } : {}), ...(typeof c.telhadoVisivel === 'boolean' ? { telhadoVisivel: c.telhadoVisivel } : {}),
        }));
        const s = sementeDe(args);
        return [texto(escrever(ctx, `${pedidos.length} cômodo(s)`, mapa => geracao(comodos(mapa, pedidos.map(p => limpar(p)), s))))];
      },
    },
    {
      nome: 'atlas_paredes',
      descricao: `Cria paredes avulsas no mapa aberto (um passo de desfazer): muros, cercas, muretas. As paredes dos cômodos já nascem com atlas_comodos; rocha e escarpa são maciço de terreno (atlas_terreno), não paredes. ${unidades} Cada parede: { path: [[x, y], …] (mínimo 2 pontos, em metros), kind?: "wall" | "low" | "fence" | "cliff", altura? (m), espessura? (m), material? }.`,
      esquema: { type: 'object', properties: {
        paredes: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          path: { type: 'array', items: ponto, minItems: 2 }, kind: { type: 'string', enum: ['wall', 'low', 'fence', 'cliff'], description: 'wall = parede; low = mureta; fence = cerca; cliff = penhasco.' },
          altura: { type: 'number', description: 'Altura em metros.' }, espessura: { type: 'number', description: 'Espessura em metros.' }, material: { type: 'string' },
        }, required: ['path'], additionalProperties: false } },
      }, required: ['paredes'], additionalProperties: false },
      async executar(args) {
        const pedidos = itens(args, 'paredes').map((p, i) => ({
          path: pontos(p.path, `paredes[${i}].path`), ...(p.kind !== undefined ? { kind: p.kind as 'wall' } : {}),
          ...(p.altura !== undefined ? { altura: numero(p.altura, 'altura', 0.05, 20) } : {}), ...(p.espessura !== undefined ? { espessura: numero(p.espessura, 'espessura', 0.02, 5) } : {}),
          ...(p.material !== undefined ? { material: textoOpcional(p.material, 'material', 80) } : {}),
        }));
        return [texto(escrever(ctx, `${pedidos.length} parede(s)`, mapa => geracao(paredes(mapa, pedidos))))];
      },
    },
    {
      nome: 'atlas_portas',
      descricao: `Abre portas, janelas, arcos ou passagens secretas na parede mais próxima de cada ponto, no mapa aberto (um passo de desfazer). Crie o cômodo ou a parede ANTES (em outra chamada). ${unidades} Cada porta: { perto: [x, y] (metros, a até ~0,75 m da parede; encaixa no centro de uma célula), tipo?: "door" | "window" | "arch" | "secret" (padrão door), estado?: "closed" | "open" | "locked" (padrão closed), largura? (m, padrão 0,9) }.`,
      esquema: { type: 'object', properties: {
        portas: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          perto: ponto, tipo: { type: 'string', enum: ['door', 'window', 'arch', 'secret'] }, estado: { type: 'string', enum: ['closed', 'open', 'locked'] }, largura: { type: 'number', description: 'Largura em metros (padrão 0,9).' },
        }, required: ['perto'], additionalProperties: false } },
      }, required: ['portas'], additionalProperties: false },
      async executar(args) {
        const pedidos = itens(args, 'portas').map((p, i) => ({
          perto: pontos([p.perto], `portas[${i}].perto`)[0]!, ...(p.tipo !== undefined ? { tipo: p.tipo as 'door' } : {}), ...(p.estado !== undefined ? { estado: p.estado as 'open' } : {}),
          ...(p.largura !== undefined ? { largura: numero(p.largura, 'largura', 0.2, 6) } : {}),
        }));
        return [texto(escrever(ctx, `${pedidos.length} abertura(s)`, mapa => geracao(portas(mapa, pedidos))))];
      },
    },
  ];
}

const limpar = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function pontos(v: unknown, nome: string): [number, number][] {
  if (!Array.isArray(v)) throw new Error(`"${nome}" deve ser uma lista de pontos [x, y].`);
  return v.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error(`"${nome}[${i}]" deve ser [x, y] em metros.`);
    return [p[0], p[1]] as [number, number];
  });
}

function retangulos(v: unknown, nome: string): [number, number, number, number][] {
  if (!Array.isArray(v) || !v.length) throw new Error(`"${nome}" deve ser uma lista com ao menos um retângulo [x0, y0, x1, y1] em células.`);
  return v.map((r, i) => {
    if (!Array.isArray(r) || r.length !== 4 || !r.every(n => Number.isInteger(n))) throw new Error(`"${nome}[${i}]" deve ser [x0, y0, x1, y1] com 4 inteiros (células do grid, fim exclusivo).`);
    return [r[0], r[1], r[2], r[3]] as [number, number, number, number];
  });
}

/** Confere a forma recebida do cliente (o esquema JSON não é garantia) e a devolve tipada. */
function validarForma(v: unknown): Forma {
  const f = objeto(v, 'forma');
  const irr = f.irregular === undefined ? {} : { irregular: numero(f.irregular, 'irregular', 0, 50) };
  if ('disco' in f) return { disco: pontos([f.disco], 'disco')[0]!, raio: numero(f.raio, 'raio', 0.01, 1000), ...irr };
  if ('poligono' in f) { const p = pontos(f.poligono, 'poligono'); if (p.length < 3) throw new Error('Um polígono precisa de ao menos 3 pontos.'); return { poligono: p, ...irr }; }
  if ('faixa' in f) { const p = pontos(f.faixa, 'faixa'); if (!p.length) throw new Error('Uma faixa precisa de ao menos 1 ponto.'); return { faixa: p, largura: numero(f.largura, 'largura', 0.01, 1000), ...irr }; }
  if ('retangulo' in f) {
    const r = f.retangulo;
    if (!Array.isArray(r) || r.length !== 4 || !r.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error('"retangulo" deve ser [x0, y0, x1, y1] em metros.');
    return { retangulo: [r[0], r[1], r[2], r[3]], ...irr };
  }
  if ('celulas' in f) {
    if (!Array.isArray(f.celulas) || !f.celulas.length) throw new Error('"celulas" deve ser uma lista de [i, j].');
    return { celulas: f.celulas.map(c => { if (!Array.isArray(c) || c.length !== 2 || !c.every(n => Number.isInteger(n))) throw new Error('Cada célula deve ser [i, j] com inteiros.'); return [c[0], c[1]] as [number, number]; }) };
  }
  throw new Error('"forma" desconhecida: use disco, poligono, faixa, retangulo ou celulas.');
}
