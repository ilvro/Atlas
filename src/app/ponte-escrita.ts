import { json, texto, type FerramentaDaPonte } from '#mesa/ponte';
import { comodos, ErroDeConstrucao, espalhar, luzes, objetos, paredes, portas, regioes, terreno, type Construcao } from '../authoring/construcao.ts';
import { TODOS_OS_CONJUNTOS } from '../authoring/espalhar.ts';
import { celulasDaForma, sementeDaForma, type Forma } from '../authoring/formas.ts';
import { ceuNoHorario } from '../domain/clima.ts';
import { EVENTOS_DE_CENA } from '../domain/eventos-de-cena.ts';
import { criarMapa, type MapaAtlas } from '../domain/mapa.ts';
import { descreverPasso, duracaoEstimada, momentoValido, type Momento, type PassoDeMomento } from '../domain/momentos.ts';
import { GENEROS, PINCEIS_DE_PRESENCA, PRESETS_DE_ACABAMENTO, PRESETS_DE_CLIMA, PRESETS_DE_LUZ, TIPOS_DE_COMODO, pincelDePresenca, presetDeAcabamento, presetDeClima } from '../domain/presets.ts';
import { validarMapa } from '../domain/validacao.ts';
import { materialDe, materiaisDo } from '../procedural/materiais.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';
import type { Comando } from '../state/comandos.ts';
import type { Store } from '../state/store.ts';
import { registrarChamada, type RespostaDoMestre } from './atividade-do-assistente.ts';

/** Os ids de tudo o que o assistente criou nesta aba (a 14.2e usa para decidir o que pede confirmação). Só vale até recarregar a aba. */
export const criadosPeloAssistente = new Set<string>();

/** O que as ferramentas de escrita precisam do Atlas; o app liga isto aos signals (sem DOM, dá para testar com store e repositório falsos). */
export interface ContextoDeEscrita {
  /** O store do mapa aberto, ou `null` quando não há mapa aberto. */
  store: () => Pick<Store, 'documento' | 'transacao' | 'versaoEdicao' | 'desfazer'> | null;
  repo: () => Pick<RepositorioMapas, 'salvar'> | null;
  /** Mantém a entidade "lugar" da campanha em dia depois de gravar um mapa novo. */
  sincronizarCampanha?: (mapa: MapaAtlas) => Promise<void>;
  /** Abre o mapa na aba (o mesmo caminho do "novo mapa"); resolve quando ele está aberto. */
  abrirMapa: (id: string) => Promise<void>;
  /** A campanha ativa do app, usada quando `atlas_mapa_criar` não recebe `campanhaId`. */
  campanhaAtiva?: () => string | null;
  /** Toca o momento do mapa aberto pelo mesmo executor do painel (o app liga `tocarMomentoDoMapa`); resolve ao terminar. */
  tocarMomento?: (id: string) => Promise<'fim' | 'cancelado'>;
  /** Para o momento em curso (o app liga `pararMomento`); usado quando o teste estoura o tempo. */
  pararMomento?: () => void;
  /** Mostra um pedido ao mestre (painel do assistente) e espera a resposta; sem isto, mexer no que não é do assistente é recusado. */
  confirmar?: (descricao: string) => Promise<RespostaDoMestre>;
}

/** `ids` são os criados (viram "do assistente"); `afetados` são os que só foram mexidos (destaque no painel). */
export interface Geracao { comandos: readonly Comando[]; ids: readonly string[]; afetados?: readonly string[] }

const SEM_MAPA = 'Não há mapa aberto: abra um com atlas_abrir ou crie com atlas_mapa_criar.';
const MAX_ITENS = 100;
const MAX_OBJETOS = 200;

/**
 * Base de toda escrita: pega o mapa aberto, deixa `gerar` produzir os comandos e aplica tudo numa só `store.transacao` (um Ctrl+Z).
 * Se algo falhar (construção, comando ou validação), a transação desfaz e o erro sobe com a mensagem legível.
 */
export function escrever(ctx: ContextoDeEscrita, rotulo: string, gerar: (mapa: MapaAtlas) => Geracao): string {
  const store = ctx.store();
  try {
    if (!store) throw new Error(SEM_MAPA);
    const { comandos, ids, afetados } = gerar(store.documento);
    if (!comandos.length) { registrarChamada({ rotulo, ids: [], ok: true }); return `${rotulo}: nada mudou (nenhum comando gerado). Confira as coordenadas com atlas_ver_mapa.`; }
    store.transacao(`IA: ${rotulo}`, g => { for (const c of comandos) g.aplicar(c); });
    for (const id of ids) criadosPeloAssistente.add(id);
    registrarChamada({ rotulo, ids: afetados ?? ids, ok: true, ref: { store, versao: store.versaoEdicao } });
    return `${rotulo}: ${comandos.length} comando(s) aplicados como um passo de desfazer.${ids.length ? ` Ids criados: ${ids.join(', ')}.` : ''} Confira com atlas_ver_mapa.`;
  } catch (erro) {
    registrarChamada({ rotulo, ids: [], ok: false, erro: erro instanceof Error ? erro.message : String(erro) });
    throw erro;
  }
}

// ---------- Esquemas JSON ----------
const coord = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 };
const ponto = { ...coord, description: '[x, y] em metros.' };
const irregular = { type: 'number', minimum: 0 };

/** O esquema JSON de uma `Forma` do terreno (metros). Reaproveitado por `atlas_terreno` e, depois, por `atlas_espalhar` e `atlas_presenca`. */
export function esquemaDaForma(): Record<string, unknown> {
  return {
    description: 'Forma em metros.',
    oneOf: [
      { type: 'object', properties: { disco: coord, raio: { type: 'number', exclusiveMinimum: 0 }, irregular }, required: ['disco', 'raio'] },
      { type: 'object', properties: { poligono: { type: 'array', items: coord, minItems: 3 }, irregular }, required: ['poligono'] },
      { type: 'object', properties: { faixa: { type: 'array', items: coord, minItems: 1 }, largura: { type: 'number', exclusiveMinimum: 0 }, irregular }, required: ['faixa', 'largura'] },
      { type: 'object', properties: { retangulo: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, irregular }, required: ['retangulo'] },
      { type: 'object', properties: { celulas: { type: 'array', items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 } } }, required: ['celulas'] },
    ],
  };
}

/** O esquema de um retângulo de células do grid: `[x0, y0, x1, y1]`, fim exclusivo. */
export const esquemaDoRetanguloDeCelulas = { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4, description: '[x0, y0, x1, y1] em células de 1,5 m (x1, y1 exclusivos).' };

const semente = { type: 'number' };

// ---------- Validação de argumentos ----------
type Args = Record<string, unknown>;
const objeto = (v: unknown, nome: string): Args => { if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`"${nome}" deve ser um objeto.`); return v as Args; };
function itens(args: Args, campo: string, max = MAX_ITENS): Args[] {
  const v = args[campo];
  if (!Array.isArray(v) || !v.length) throw new Error(`Falta "${campo}": uma lista com ao menos 1 item.`);
  if (v.length > max) throw new Error(`"${campo}" aceita até ${max} itens por chamada (recebeu ${v.length}); divida em várias chamadas.`);
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
      descricao: 'Cria e abre mapa novo em metros (padrão 45×30; grid 1,5 m). Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        nome: { type: 'string' }, largura: { type: 'number' }, altura: { type: 'number' },
        base: { type: 'string' }, genero: { type: 'string', enum: GENEROS.map(g => g.id) },
        estilo: { type: 'string', enum: ['ilustrado', 'pixel'] }, campanhaId: { type: 'string' }, notas: { type: 'string' },
      }, required: ['nome', 'largura', 'altura'], additionalProperties: false },
      anotacoes: { destrutiva: false },
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
      descricao: 'Pinta ou apaga terreno do mapa aberto, em METROS. Materiais: atlas_catalogo materiais. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        base: { type: 'string' },
        operacoes: { type: 'array', maxItems: MAX_ITENS, items: { type: 'object', properties: { acao: { type: 'string', enum: ['pintar', 'apagar'] }, material: { type: 'string' }, forma: esquemaDaForma() }, required: ['acao', 'forma'] } },
        correnteza: { type: 'object', properties: { material: { type: 'string' }, angulo: { type: 'number' }, velocidade: { type: 'number', minimum: 0, maximum: 3 } }, required: ['material', 'angulo', 'velocidade'] },
        semente,
      }, additionalProperties: false },
      anotacoes: { destrutiva: true },
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
      descricao: 'Cria cômodos (piso, paredes, telhado). ATENÇÃO: rets em CÉLULAS de 1,5 m, x1 e y1 exclusivos. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        comodos: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          rets: { type: 'array', minItems: 1, items: esquemaDoRetanguloDeCelulas }, tipo: { type: 'string', enum: TIPOS_DE_COMODO.map(t => t.id) }, nome: { type: 'string' },
          piso: { type: 'string' }, papel: { type: 'string' }, telhado: { type: ['string', 'null'] }, telhadoVisivel: { type: 'boolean' },
        }, required: ['rets', 'tipo'] } },
        semente,
      }, required: ['comodos'], additionalProperties: false },
      anotacoes: { destrutiva: true },
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
      descricao: 'Cria paredes, muros, cercas ou escarpas avulsas em metros. Para salas use atlas_comodos. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        paredes: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          path: { type: 'array', items: ponto, minItems: 2 }, kind: { type: 'string', enum: ['wall', 'low', 'fence', 'cliff'] },
          altura: { type: 'number' }, espessura: { type: 'number' }, material: { type: 'string' },
          drop: { type: 'string', enum: ['a', 'b'] },
        }, required: ['path'] } },
      }, required: ['paredes'], additionalProperties: false },
      anotacoes: { destrutiva: true },
      async executar(args) {
        const pedidos = itens(args, 'paredes').map((p, i) => ({
          path: pontos(p.path, `paredes[${i}].path`), ...(p.kind !== undefined ? { kind: p.kind as 'wall' } : {}),
          ...(p.altura !== undefined ? { altura: numero(p.altura, 'altura', 0.05, 20) } : {}), ...(p.espessura !== undefined ? { espessura: numero(p.espessura, 'espessura', 0.02, 5) } : {}),
          ...(p.material !== undefined ? { material: textoOpcional(p.material, 'material', 80) } : {}),
          ...(p.drop !== undefined ? { drop: p.drop as 'a' | 'b' } : {}),
        }));
        return [texto(escrever(ctx, `${pedidos.length} parede(s)`, mapa => geracao(paredes(mapa, pedidos))))];
      },
    },
    {
      nome: 'atlas_portas',
      descricao: 'Abre portas, janelas, arcos ou passagens secretas na parede mais próxima (em metros). Crie cômodo/parede antes. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        portas: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          perto: ponto, tipo: { type: 'string', enum: ['door', 'window', 'arch', 'secret'] }, estado: { type: 'string', enum: ['closed', 'open', 'locked'] }, largura: { type: 'number' },
        }, required: ['perto'] } },
      }, required: ['portas'], additionalProperties: false },
      anotacoes: { destrutiva: true },
      async executar(args) {
        const pedidos = itens(args, 'portas').map((p, i) => ({
          perto: pontos([p.perto], `portas[${i}].perto`)[0]!, ...(p.tipo !== undefined ? { tipo: p.tipo as 'door' } : {}), ...(p.estado !== undefined ? { estado: p.estado as 'open' } : {}),
          ...(p.largura !== undefined ? { largura: numero(p.largura, 'largura', 0.2, 6) } : {}),
        }));
        return [texto(escrever(ctx, `${pedidos.length} abertura(s)`, mapa => geracao(portas(mapa, pedidos))))];
      },
    },
    {
      nome: 'atlas_objetos',
      descricao: 'Coloca até 200 objetos no mapa aberto, em metros. "item": receita ou colecao (atlas_catalogo). Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        objetos: { type: 'array', minItems: 1, maxItems: MAX_OBJETOS, items: { type: 'object', properties: {
          item: { type: 'string' }, pos: ponto, rotacao: { type: 'number' }, escala: { type: 'number', minimum: 0.05, maximum: 50 },
          camada: { type: 'string', enum: ['floor', 'table', 'wall', 'ceiling', 'underwater'] }, submerso: { type: 'boolean' }, oculto: { type: 'boolean' }, params: { type: 'object' },
        }, required: ['item', 'pos'] } },
        semente,
      }, required: ['objetos'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const pedidos = itens(args, 'objetos', MAX_OBJETOS).map((o, i) => ({
          item: textoOpcional(o.item, 'item', 120) ?? '', pos: pontos([o.pos], `objetos[${i}].pos`)[0]!,
          ...(o.rotacao !== undefined ? { rotacao: numero(o.rotacao, 'rotacao', -1000, 1000) } : {}), ...(o.escala !== undefined ? { escala: numero(o.escala, 'escala', 0.05, 50) } : {}),
          ...(o.camada !== undefined ? { camada: o.camada as 'floor' } : {}), ...(typeof o.submerso === 'boolean' ? { submerso: o.submerso } : {}),
          ...(typeof o.oculto === 'boolean' ? { oculto: o.oculto } : {}),
          ...(o.params !== undefined ? { params: objeto(o.params, 'params') } : {}),
        }));
        const s = sementeDe(args);
        return [texto(escrever(ctx, `${pedidos.length} objeto(s)`, mapa => geracao(objetos(mapa, pedidos, s))))];
      },
    },
    {
      nome: 'atlas_espalhar',
      descricao: 'Espalha um conjunto de objetos numa região em metros. Conjuntos: atlas_catalogo receitas. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        conjunto: { type: 'string', enum: TODOS_OS_CONJUNTOS.map(c => c.id) }, forma: esquemaDaForma(),
        densidade: { type: 'number', exclusiveMinimum: 0, maximum: 20 }, semente,
      }, required: ['conjunto', 'forma'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const conjunto = verificarId('conjunto', args.conjunto, TODOS_OS_CONJUNTOS.map(c => ({ id: c.id, nome: c.id })));
        const forma = validarForma(args.forma);
        const densidade = args.densidade === undefined ? undefined : numero(args.densidade, 'densidade', 0.001, 20);
        const s = sementeDe(args);
        return [texto(escrever(ctx, `espalhar ${conjunto}`, mapa => geracao(espalhar(mapa, { conjunto, forma, densidade }, s))))];
      },
    },
    {
      nome: 'atlas_luzes',
      descricao: 'Acende luzes no mapa aberto, em metros. Presets: atlas_catalogo luzes. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        luzes: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          preset: { type: 'string', enum: PRESETS_DE_LUZ.map(l => l.id) }, pos: ponto, direcao: { type: 'number' },
          raio: { type: 'number', minimum: 0.1, maximum: 200 }, cor: { type: 'string' }, intensidade: { type: 'number', minimum: 0, maximum: 3 },
        }, required: ['preset', 'pos'] } },
      }, required: ['luzes'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const pedidos = itens(args, 'luzes').map((l, i) => ({
          preset: verificarId('preset de luz', l.preset, PRESETS_DE_LUZ), pos: pontos([l.pos], `luzes[${i}].pos`)[0]!,
          ...(l.direcao !== undefined ? { direcao: numero(l.direcao, 'direcao', -1000, 1000) } : {}), ...(l.raio !== undefined ? { raio: numero(l.raio, 'raio', 0.1, 200) } : {}),
          ...(l.cor !== undefined ? { cor: cor(l.cor, 'cor') } : {}), ...(l.intensidade !== undefined ? { intensidade: numero(l.intensidade, 'intensidade', 0, 3) } : {}),
        }));
        return [texto(escrever(ctx, `${pedidos.length} luz(es)`, mapa => geracao(luzes(mapa, pedidos))))];
      },
    },
    {
      nome: 'atlas_ambiente',
      descricao: 'Ajusta clima e acabamento do mapa aberto. Presets: atlas_catalogo climas. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        clima: { type: 'object', properties: {
          preset: { type: 'string' }, horario: { type: 'string' },
          tempo: { type: 'object', properties: { rain: unidadeEsq, snow: unidadeEsq, fog: unidadeEsq, dust: unidadeEsq, embers: unidadeEsq, leaves: unidadeEsq, lightning: unidadeEsq, wind: { type: 'number', minimum: -1, maximum: 1 } } },
          ambiente: { type: 'object', properties: { color: { type: 'string' }, intensity: unidadeEsq }, required: ['color', 'intensity'] },
          sol: { type: ['object', 'null'], properties: { angle: { type: 'number' }, color: { type: 'string' }, intensity: { type: 'number', minimum: 0, maximum: 3 } }, required: ['angle', 'color', 'intensity'] },
          redeLigada: { type: 'boolean' },
        } },
        acabamento: { type: 'object', properties: {
          preset: { type: 'string', enum: PRESETS_DE_ACABAMENTO.map(a => a.id) }, texture: unidadeEsq, vignette: unidadeEsq, grain: unidadeEsq, glow: unidadeEsq, saturation: { type: 'number', minimum: 0, maximum: 2 }, tint: { type: 'string' },
          grade: { type: 'object', properties: { lift: { type: 'number', minimum: -1, maximum: 1 }, gamma: { type: 'number', minimum: 0.1, maximum: 4 }, gain: { type: 'number', minimum: 0, maximum: 4 } } },
          edges: { type: 'object', properties: { kind: { type: 'string', enum: ['none', 'clouds', 'dark', 'fog'] }, amount: unidadeEsq }, required: ['kind', 'amount'] },
        } },
        guardarClima: { type: 'object', properties: { id: { type: 'string' }, nome: { type: 'string' } }, required: ['id', 'nome'] },
      }, additionalProperties: false },
      anotacoes: { destrutiva: true },
      async executar(args) {
        if (args.clima === undefined && args.acabamento === undefined && args.guardarClima === undefined) throw new Error('Passe "clima", "acabamento" e/ou "guardarClima".');
        return [texto(escrever(ctx, 'ambiente', mapa => ({ comandos: comandosDeAmbiente(mapa, args), ids: [] })))];
      },
    },
    {
      nome: 'atlas_regioes',
      descricao: 'Cria regiões funcionais (reveal, trigger, audio, note) no mapa aberto, em metros.',
      esquema: { type: 'object', properties: {
        regioes: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          poligono: { type: 'array', items: ponto, minItems: 3 }, tipo: { type: 'string', enum: ['reveal', 'trigger', 'audio', 'note'] },
          nome: { type: 'string' }, texto: { type: 'string' }, somenteMestre: { type: 'boolean' },
        }, required: ['poligono', 'tipo'] } },
      }, required: ['regioes'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const pedidos = itens(args, 'regioes').map((r, i) => ({
          poligono: pontos(r.poligono, `regioes[${i}].poligono`), tipo: String(r.tipo ?? '') as 'reveal',
          ...(r.nome !== undefined ? { nome: textoOpcional(r.nome, 'nome', 120) } : {}), ...(r.texto !== undefined ? { texto: textoOpcional(r.texto, 'texto', 5000) } : {}),
          ...(typeof r.somenteMestre === 'boolean' ? { somenteMestre: r.somenteMestre } : {}),
        }));
        return [texto(escrever(ctx, `${pedidos.length} região(ões)`, mapa => geracao(regioes(mapa, pedidos.map(p => limpar(p))))))];
      },
    },
    {
      nome: 'atlas_presenca',
      descricao: 'Pinta presença (musgo, sangue, mofo...) em metros. Pincéis: atlas_catalogo presenca. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        pincel: { type: 'string', enum: PINCEIS_DE_PRESENCA.map(p => p.id) }, forma: esquemaDaForma(), intensidade: unidadeEsq, semente,
      }, required: ['pincel', 'forma'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const pincel = verificarId('pincel de presença', args.pincel, PINCEIS_DE_PRESENCA);
        const forma = validarForma(args.forma);
        const intensidade = args.intensidade === undefined ? undefined : numero(args.intensidade, 'intensidade', 0, 1);
        const s = sementeDe(args);
        return [texto(escrever(ctx, `presença ${pincel}`, mapa => {
          const celulas = celulasDaForma(forma, { resolucao: mapa.terrain.resolution, largura: mapa.bounds.width, altura: mapa.bounds.height, semente: sementeDaForma(Math.floor(s) || 1, 0) });
          if (!celulas.length) return { comandos: [], ids: [] };
          const comandos: Comando[] = [{ tipo: 'presenca.pintar', brush: pincel, celulas }];
          if (intensidade !== undefined) comandos.push({ tipo: 'item.atualizar', colecao: 'presence', id: `p_${pincel.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`, patch: { intensity: intensidade } });
          return { comandos, ids: [] };
        }))];
      },
    },
    {
      nome: 'atlas_notas',
      descricao: 'Escreve notas no mapa aberto (geral e por cômodo), substituindo as anteriores. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        mapa: { type: 'string' },
        comodos: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: { id: { type: 'string' }, leitura: { type: 'string' }, notasMestre: { type: 'string' } }, required: ['id'] } },
      }, additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        if (args.mapa === undefined && args.comodos === undefined) throw new Error('Passe "mapa" e/ou "comodos".');
        const nota = args.mapa === undefined ? undefined : textoOpcional(args.mapa, 'mapa', 5000) ?? '';
        const lista = args.comodos === undefined ? [] : itens(args, 'comodos').map((c, i) => {
          const id = textoOpcional(c.id, `comodos[${i}].id`, 80);
          if (!id) throw new Error(`Falta "comodos[${i}].id".`);
          if (c.leitura === undefined && c.notasMestre === undefined) throw new Error(`"comodos[${i}]" precisa de "leitura" e/ou "notasMestre".`);
          return { id, patch: { ...(c.leitura !== undefined ? { leitura: textoOpcional(c.leitura, 'leitura', 5000) ?? '' } : {}), ...(c.notasMestre !== undefined ? { notasMestre: textoOpcional(c.notasMestre, 'notasMestre', 5000) ?? '' } : {}) } };
        });
        return [texto(escrever(ctx, 'notas', mapa => {
          for (const c of lista) if (!mapa.rooms[c.id]) throw new Error(`O cômodo “${c.id}” não existe; cômodos do mapa: ${Object.keys(mapa.rooms).join(', ') || '(nenhum)'}.`);
          const comandos: Comando[] = [];
          if (nota !== undefined) comandos.push({ tipo: 'mapa.notas', texto: nota });
          for (const c of lista) comandos.push({ tipo: 'comodo.notas', id: c.id, patch: c.patch });
          return { comandos, ids: [] };
        }))];
      },
    },
    {
      nome: 'atlas_momento',
      descricao: 'Cria ou refaz um momento no mapa aberto (sem "id" cria; com "id" altera). Tipos de passo: atlas_catalogo momentos. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: {
        id: { type: 'string' },
        nome: { type: 'string', minLength: 1, maxLength: 60 },
        cor: { type: 'string' },
        passos: { type: 'array', maxItems: 60, items: esquemaDoPasso() },
      }, required: ['nome', 'passos'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const nome = textoOpcional(args.nome, 'nome', 60)?.trim();
        if (!nome) throw new Error('Falta o argumento "nome" (1 a 60 caracteres).');
        const cor = args.cor === undefined || args.cor === null ? null : args.cor as string;
        if (!Array.isArray(args.passos)) throw new Error('Falta "passos": uma lista de passos (pode ser vazia).');
        const idPedido = textoOpcional(args.id, 'id', 64);
        return [texto(escrever(ctx, 'momento', mapa => {
          let id: string;
          if (idPedido) {
            if (mapa.moments[idPedido] && !criadosPeloAssistente.has(idPedido)) throw new Error(`O momento “${idPedido}” é do mestre; crie outro (omita "id").`);
            if (!mapa.moments[idPedido]) throw new Error(`O momento “${idPedido}” não existe; omita "id" para criar um novo.`);
            id = idPedido;
          } else {
            do id = `ia${Math.random().toString(36).slice(2, 10)}`; while (mapa.moments[id]);
          }
          const momento: Momento = { id, nome, cor, passos: args.passos as PassoDeMomento[] };
          const erro = momentoValido(momento);
          if (erro) throw new Error(erro);
          const refs = referenciasDosPassos(mapa, momento.passos);
          if (refs) throw new Error(refs);
          return { comandos: [{ tipo: 'momento.salvar', momento }], ids: [id] };
        }))];
      },
    },
    {
      nome: 'atlas_momento_testar',
      descricao: 'Toca um momento do mapa aberto e espera terminar (máx. 2 min). Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
      anotacoes: { destrutiva: false, idempotente: true },
      async executar(args) {
        const store = ctx.store();
        if (!store) throw new Error(SEM_MAPA);
        const id = textoOpcional(args.id, 'id', 64);
        if (!id) throw new Error('Falta o argumento "id".');
        const mapa = store.documento, momento = mapa.moments[id];
        if (!momento) throw new Error(`O momento “${id}” não existe; momentos do mapa: ${Object.keys(mapa.moments).join(', ') || '(nenhum)'}.`);
        if (!ctx.tocarMomento) throw new Error('Esta aba não consegue tocar momentos.');
        const limite = Math.min(120_000, duracaoEstimada(momento) + 5_000);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const estouro = new Promise<'tempo esgotado'>(r => { timer = setTimeout(() => r('tempo esgotado'), limite); });
        let resultado: 'fim' | 'cancelado' | 'tempo esgotado';
        try { resultado = await Promise.race([ctx.tocarMomento(id), estouro]); } finally { clearTimeout(timer); }
        if (resultado === 'tempo esgotado') ctx.pararMomento?.();
        return [json({ id, nome: momento.nome, resultado, passos: momento.passos.map((p, i) => `${i + 1}. ${descreverPasso(p, mapa)}`) })];
      },
    },
    {
      nome: 'atlas_remover',
      descricao: 'Remove entidades do mapa aberto pelos ids (atlas_mapa_ler). O que é do mestre pede confirmação. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['ids'], additionalProperties: false },
      anotacoes: { destrutiva: true },
      async executar(args) {
        const ids = listaDeIds(args);
        await liberar(ctx, 'remover', ids, mapa => `Remover ${resumoDosIds(mapa, ids.filter(i => !criadosPeloAssistente.has(i)))}`);
        return [texto(escrever(ctx, 'remover', mapa => removerIds(mapa, ids)))];
      },
    },
    {
      nome: 'atlas_mover',
      descricao: 'Move objetos, luzes, peças e regiões por [dx, dy] em metros. O que é do mestre pede confirmação. Detalhes: plataforma_guia ferramentas-atlas.',
      esquema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 }, delta: ponto }, required: ['ids', 'delta'], additionalProperties: false },
      anotacoes: { destrutiva: false },
      async executar(args) {
        const ids = listaDeIds(args);
        const d = Array.isArray(args.delta) ? args.delta : [];
        if (d.length !== 2) throw new Error('"delta" deve ser [dx, dy] em metros.');
        const delta: [number, number] = [numero(d[0], 'delta[0]', -1000, 1000), numero(d[1], 'delta[1]', -1000, 1000)];
        await liberar(ctx, 'mover', ids, mapa => { moverIds(mapa, ids, delta); return `Mover ${resumoDosIds(mapa, ids.filter(i => !criadosPeloAssistente.has(i)))} em [${delta[0]}, ${delta[1]}] m`; });
        return [texto(escrever(ctx, 'mover', mapa => moverIds(mapa, ids, delta)))];
      },
    },
  ];
}

// ---------- Momentos ----------
/** Os tipos de passo (a mesma lista de `atlas_catalogo { parte: "momentos" }`; um teste confere). */
export const TIPOS_DE_PASSO_ESQUEMA = ['esperar', 'som', 'silencio', 'efeito', 'clima', 'tela', 'letreiro', 'camera', 'revelar', 'interagir', 'luz', 'objeto', 'agua', 'pista', 'nota'] as const;

const refEsquema = () => ({ type: 'object', properties: { app: { type: 'string' }, tipo: { type: 'string' }, id: { type: 'string' } }, required: ['app', 'tipo', 'id'] });
const msEsquema = (min: number, max: number) => ({ type: 'number', minimum: min, maximum: max });
const passo = (tipo: string, props: Record<string, unknown>, obrigatorios: string[]) => ({ type: 'object', properties: { tipo: { const: tipo }, ...props }, required: ['tipo', ...obrigatorios] });

/** O esquema JSON de UM passo de momento: `oneOf` por `tipo`, com os limites de `domain/momentos.ts`. */
export function esquemaDoPasso(): Record<string, unknown> {
  return {
    description: 'Passo do momento (tipos: atlas_catalogo momentos).',
    oneOf: [
      passo('esperar', { ms: msEsquema(100, 120_000) }, ['ms']),
      passo('som', { ref: refEsquema() }, ['ref']),
      passo('silencio', { ms: msEsquema(0, 30_000) }, ['ms']),
      passo('efeito', { efeito: { enum: [...EVENTOS_DE_CENA, 'relampago'] } }, ['efeito']),
      passo('clima', { clima: { type: 'string', maxLength: 60 } }, ['clima']),
      passo('tela', { acao: { enum: ['escurecer', 'clarear'] }, ms: msEsquema(0, 10_000) }, ['acao', 'ms']),
      passo('letreiro', { titulo: { type: 'string', minLength: 1, maxLength: 120 }, subtitulo: { type: 'string', maxLength: 200 }, peca: { type: ['string', 'null'] }, estilo: { enum: ['apresentacao', 'capitulo'] }, ms: msEsquema(1_000, 20_000) }, ['titulo', 'subtitulo', 'peca', 'estilo', 'ms']),
      passo('camera', { alvo: { type: 'object', properties: { colecao: { enum: ['rooms', 'regions', 'tokens'] }, id: { type: 'string' } }, required: ['colecao', 'id'] } }, ['alvo']),
      passo('revelar', { ids: { type: 'array', items: { type: 'string' }, maxItems: 100 } }, ['ids']),
      passo('interagir', { id: { type: 'string' } }, ['id']),
      passo('luz', { ids: { type: 'array', items: { type: 'string' }, maxItems: 100 }, acao: { enum: ['ligar', 'desligar', 'alternar'] } }, ['ids', 'acao']),
      passo('objeto', { ids: { type: 'array', items: { type: 'string' }, maxItems: 100 }, acao: { enum: ['mostrar', 'esconder'] } }, ['ids', 'acao']),
      passo('agua', { etapas: { type: 'integer', minimum: 1, maximum: 60 }, material: { type: 'string' }, ms: msEsquema(100, 120_000), poligono: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, minItems: 3 } }, ['material', 'ms', 'poligono']),
      passo('pista', { ref: refEsquema(), mostrar: { type: 'boolean' } }, ['ref', 'mostrar']),
      passo('nota', { texto: { type: 'string', maxLength: 400 } }, ['texto']),
    ],
  };
}

/** Confere os passos contra o mapa aberto. Devolve a mensagem do primeiro problema (com o número do passo) ou `null`. */
function referenciasDosPassos(mapa: MapaAtlas, passos: readonly PassoDeMomento[]): string | null {
  const lista = (o: Record<string, unknown>) => Object.keys(o).join(', ') || '(nenhum)';
  for (let i = 0; i < passos.length; i++) {
    const p = passos[i]!, erro = (m: string) => `Passo ${i + 1} (${p.tipo}): ${m}`;
    switch (p.tipo) {
      case 'clima':
        if (!presetDeClima(p.clima) && !mapa.customClimates[p.clima]) {
          const todos = [...PRESETS_DE_CLIMA.map(c => ({ id: c.id, nome: c.nome })), ...Object.values(mapa.customClimates).map(c => ({ id: c.id, nome: c.name }))];
          return erro(`o clima “${p.clima}” não existe; ${sugerir(p.clima, todos)}.`);
        }
        break;
      case 'camera': {
        const { colecao, id } = p.alvo, colecaoDoMapa = mapa[colecao] as Record<string, unknown>;
        if (!colecaoDoMapa[id]) return erro(`${colecao === 'rooms' ? 'o cômodo' : colecao === 'regions' ? 'a região' : 'a peça'} “${id}” não existe; existentes: ${lista(colecaoDoMapa)}.`);
        break;
      }
      case 'revelar':
        for (const id of p.ids) {
          if (mapa.rooms[id] || mapa.openings[id]) continue;
          if (mapa.regions[id]) {
            if (mapa.regions[id].kind !== 'reveal') return erro(`a região “${id}” não é do tipo "reveal" (é ${mapa.regions[id].kind}).`);
            continue;
          }
          return erro(`o cômodo “${id}” não existe; cômodos do mapa: ${lista(mapa.rooms)}.`);
        }
        break;
      case 'luz':
        for (const id of p.ids) {
          const temLuz = !!mapa.lights[id] || Object.values(mapa.lights).some(l => l.ownerId === id);
          if (!temLuz && !mapa.props[id]) return erro(`a luz ou objeto “${id}” não existe no mapa; luzes: ${lista(mapa.lights)}.`);
        }
        break;
      case 'objeto':
        for (const id of p.ids) {
          if (!mapa.props[id]) return erro(`o objeto “${id}” não existe no mapa; objetos: ${lista(mapa.props)}.`);
        }
        break;
      case 'agua': {
        let mat;
        try { mat = materialDe(p.material); } catch { return erro(`o material “${p.material}” não existe.`); }
        if (mat.uso !== 'agua') return erro(`o material “${p.material}” não é de água (uso: ${mat.uso}); use materiais de água (ex: agua, agua.pantano).`);
        break;
      }
      case 'interagir': {
        const o = mapa.props[p.id], a = mapa.openings[p.id];
        if (a) { if (a.kind !== 'door' && a.kind !== 'secret') return erro(`a abertura “${p.id}” é ${a.kind === 'window' ? 'uma janela' : 'um arco'}; só portas e portas secretas se acionam.`); }
        else if (o) { if (o.interaction?.kind !== 'switch' && o.interaction?.kind !== 'drawer') return erro(`o objeto “${p.id}” ${o.interaction ? 'é uma pista ou nota (não se aciona por momento)' : 'não é interativo'}; use interruptor ou gaveta.`); }
        else return erro(`“${p.id}” não é uma porta nem um objeto interativo do mapa; portas: ${lista(mapa.openings)}.`);
        break;
      }
      case 'letreiro':
        if (p.peca !== null && !mapa.tokens[p.peca]) return erro(`a peça “${p.peca}” não existe; peças: ${lista(mapa.tokens)}.`);
        break;
      default: break;
    }
  }
  return null;
}

const unidadeEsq = { type: 'number', minimum: 0, maximum: 1 };

const cor = (v: unknown, nome: string): string => {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`"${nome}" deve ser uma cor "#rrggbb".`);
  return v;
};

/** Sugere os ids mais parecidos (por id ou nome, nos dois sentidos) ou, sem nenhum, lista todos. */
function sugerir(termo: string, todos: readonly { id: string; nome: string }[]): string {
  const t = termo.toLowerCase().trim();
  const parecidos = todos.filter(x => t && (x.id.toLowerCase().includes(t) || x.nome.toLowerCase().includes(t) || t.includes(x.id.toLowerCase()))).map(x => x.id);
  return parecidos.length ? `parecidos: ${parecidos.join(', ')}` : `existentes: ${todos.map(x => x.id).join(', ')}`;
}

function verificarId(rotulo: string, v: unknown, todos: readonly { id: string; nome: string }[]): string {
  if (typeof v !== 'string' || !v) throw new Error(`Falta o ${rotulo}.`);
  if (!todos.some(x => x.id === v)) throw new ErroDeConstrucao(`${rotulo} “${v}” não existe; ${sugerir(v, todos)}`);
  return v;
}

function numeroOpc(v: unknown, nome: string, min: number, max: number): number | undefined { return v === undefined ? undefined : numero(v, nome, min, max); }

/** Os comandos de `atlas_ambiente`: clima (preset, depois ajustes), acabamento (preset, depois ajustes) e, por fim, guardar o clima. */
function comandosDeAmbiente(mapa: MapaAtlas, args: Args): Comando[] {
  const comandos: Comando[] = [];
  if (args.clima !== undefined) {
    const c = objeto(args.clima, 'clima');
    if (c.preset !== undefined) {
      const id = textoOpcional(c.preset, 'clima.preset', 60) ?? '';
      if (!presetDeClima(id) && !mapa.customClimates[id]) {
        const todos = [...PRESETS_DE_CLIMA.map(p => ({ id: p.id, nome: p.nome })), ...Object.values(mapa.customClimates).map(p => ({ id: p.id, nome: p.name }))];
        throw new ErroDeConstrucao(`clima “${id}” não existe; ${sugerir(id, todos)}`);
      }
      comandos.push({ tipo: 'clima.predefinir', id });
    }
    const patch: Record<string, unknown> = {};
    if (c.horario !== undefined) {
      const h = textoOpcional(c.horario, 'clima.horario', 5) ?? '';
      try { ceuNoHorario(h); } catch { throw new Error(`"clima.horario" deve ser "HH:MM" de 00:00 a 23:59 (recebeu “${h}”).`); }
      patch.time = h;
    }
    if (c.tempo !== undefined) {
      const t = objeto(c.tempo, 'clima.tempo'), w: Record<string, number> = {};
      for (const [k, v] of Object.entries(t)) {
        if (!['rain', 'snow', 'fog', 'dust', 'embers', 'leaves', 'lightning', 'wind'].includes(k)) throw new Error(`"clima.tempo.${k}" não existe; campos: rain, snow, fog, dust, embers, leaves, lightning, wind.`);
        w[k] = k === 'wind' ? numero(v, 'clima.tempo.wind', -1, 1) : numero(v, `clima.tempo.${k}`, 0, 1);
      }
      patch.weather = w;
    }
    if (c.ambiente !== undefined) { const a = objeto(c.ambiente, 'clima.ambiente'); patch.ambient = { color: cor(a.color, 'clima.ambiente.color'), intensity: numero(a.intensity, 'clima.ambiente.intensity', 0, 1) }; }
    if (c.sol !== undefined) {
      if (c.sol === null) patch.sun = null;
      else { const s = objeto(c.sol, 'clima.sol'); patch.sun = { angle: numero(s.angle, 'clima.sol.angle', -1000, 1000), color: cor(s.color, 'clima.sol.color'), intensity: numero(s.intensity, 'clima.sol.intensity', 0, 3) }; }
    }
    if (c.redeLigada !== undefined) { if (typeof c.redeLigada !== 'boolean') throw new Error('"clima.redeLigada" deve ser true ou false.'); patch.gridPower = c.redeLigada; }
    if (Object.keys(patch).length) comandos.push({ tipo: 'clima.aplicar', patch: patch as never });
    else if (c.preset === undefined) throw new Error('"clima" está vazio: passe preset, horario, tempo, ambiente, sol ou redeLigada.');
  }
  if (args.acabamento !== undefined) {
    const a = objeto(args.acabamento, 'acabamento'), patch: Record<string, unknown> = {};
    let preset: string | undefined;
    if (a.preset !== undefined) {
      preset = verificarId('acabamento', a.preset, PRESETS_DE_ACABAMENTO);
      Object.assign(patch, structuredClone(presetDeAcabamento(preset)!.valores));
    }
    let ajustes = 0;
    for (const k of ['texture', 'vignette', 'grain', 'glow'] as const) { const v = numeroOpc(a[k], `acabamento.${k}`, 0, 1); if (v !== undefined) { patch[k] = v; ajustes++; } }
    const sat = numeroOpc(a.saturation, 'acabamento.saturation', 0, 2); if (sat !== undefined) { patch.saturation = sat; ajustes++; }
    if (a.tint !== undefined) { patch.tint = cor(a.tint, 'acabamento.tint'); ajustes++; }
    if (a.grade !== undefined) {
      const g = objeto(a.grade, 'acabamento.grade'), gr: Record<string, number> = {};
      if (g.lift !== undefined) gr.lift = numero(g.lift, 'acabamento.grade.lift', -1, 1);
      if (g.gamma !== undefined) gr.gamma = numero(g.gamma, 'acabamento.grade.gamma', 0.1, 4);
      if (g.gain !== undefined) gr.gain = numero(g.gain, 'acabamento.grade.gain', 0, 4);
      patch.grade = { ...(patch.grade as object | undefined), ...gr }; ajustes++;
    }
    if (a.edges !== undefined) {
      const ed = objeto(a.edges, 'acabamento.edges');
      if (!['none', 'clouds', 'dark', 'fog'].includes(String(ed.kind))) throw new Error('"acabamento.edges.kind" deve ser none, clouds, dark ou fog.');
      patch.edges = { kind: ed.kind, amount: numero(ed.amount, 'acabamento.edges.amount', 0, 1) }; ajustes++;
    }
    if (!preset && !ajustes) throw new Error('"acabamento" está vazio: passe preset e/ou ajustes (texture, vignette, grain, glow, saturation, tint, grade, edges).');
    patch.preset = ajustes ? 'personalizado' : preset;
    comandos.push({ tipo: 'acabamento.atualizar', patch: patch as never });
  }
  if (args.guardarClima !== undefined) {
    const g = objeto(args.guardarClima, 'guardarClima'), id = textoOpcional(g.id, 'guardarClima.id', 60) ?? '', nome = textoOpcional(g.nome, 'guardarClima.nome', 80)?.trim() ?? '';
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('"guardarClima.id" deve ter só letras, números, - e _.');
    if (!nome) throw new Error('Falta "guardarClima.nome".');
    if (presetDeClima(id) || mapa.customClimates[id]) throw new Error(`Já existe um clima com o id “${id}”; escolha outro.`);
    comandos.push({ tipo: 'clima.salvar', nome, id });
  }
  return comandos;
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

// ---------- Remover e mover ----------
type ColecaoDeId = 'rooms' | 'walls' | 'openings' | 'props' | 'lights' | 'tokens' | 'regions' | 'presence' | 'moments';
const COLECOES_DE_ID: readonly ColecaoDeId[] = ['openings', 'walls', 'rooms', 'props', 'lights', 'tokens', 'regions', 'presence', 'moments'];
const NOME_DA_COLECAO: Record<ColecaoDeId, [string, string]> = { rooms: ['cômodo', 'cômodos'], walls: ['parede', 'paredes'], openings: ['abertura', 'aberturas'], props: ['objeto', 'objetos'], lights: ['luz', 'luzes'], tokens: ['peça', 'peças'], regions: ['região', 'regiões'], presence: ['presença', 'presenças'], moments: ['momento', 'momentos'] };

function listaDeIds(args: Args): string[] {
  const v = args.ids;
  if (!Array.isArray(v) || !v.length) throw new Error('Falta "ids": uma lista com ao menos 1 id.');
  if (v.length > 200) throw new Error(`"ids" aceita até 200 ids por chamada (recebeu ${v.length}).`);
  if (v.some(x => typeof x !== 'string' || !x)) throw new Error('"ids" deve conter só textos (ids do mapa).');
  return [...new Set(v as string[])];
}

const colecaoDoId = (mapa: MapaAtlas, id: string): ColecaoDeId | null => COLECOES_DE_ID.find(k => (mapa[k] as Record<string, unknown>)[id]) ?? null;

function resolverIds(mapa: MapaAtlas, ids: readonly string[]): { id: string; colecao: ColecaoDeId }[] {
  const faltam = ids.filter(id => !colecaoDoId(mapa, id));
  if (faltam.length) throw new Error(`Não existe no mapa aberto: ${faltam.join(', ')}. Confira os ids com atlas_mapa_ler.`);
  return ids.map(id => ({ id, colecao: colecaoDoId(mapa, id)! }));
}

/** "1 cômodo (“Sala”), 3 objetos": o texto do pedido ao mestre. */
function resumoDosIds(mapa: MapaAtlas, ids: readonly string[]): string {
  const por = new Map<ColecaoDeId, string[]>();
  for (const { id, colecao } of resolverIds(mapa, ids)) por.set(colecao, [...(por.get(colecao) ?? []), id]);
  return [...por].map(([k, lista]) => {
    const [um, varios] = NOME_DA_COLECAO[k];
    const nomes = lista.map(id => { const o = (mapa[k] as Record<string, { name?: string; nome?: string }>)[id]; return o?.name ?? o?.nome; }).filter(Boolean).slice(0, 3);
    return `${lista.length} ${lista.length === 1 ? um : varios}${nomes.length ? ` (${nomes.map(n => `“${n}”`).join(', ')})` : ''}`;
  }).join(', ');
}

function removerIds(mapa: MapaAtlas, ids: readonly string[]): Geracao {
  const alvos = resolverIds(mapa, ids);
  const salas = new Set(alvos.filter(a => a.colecao === 'rooms').map(a => a.id));
  const comandos: Comando[] = [];
  for (const { id, colecao } of alvos) {
    if (colecao === 'openings') comandos.push({ tipo: 'abertura.remover', id });
  }
  for (const { id, colecao } of alvos) {
    if (colecao !== 'walls') continue;
    const p = mapa.walls[id]!;
    // As paredes de um cômodo somem junto com ele.
    if (p.source && 'roomId' in p.source && salas.has(p.source.roomId)) continue;
    comandos.push({ tipo: 'parede.remover', id });
  }
  for (const { id, colecao } of alvos) if (colecao === 'rooms') comandos.push({ tipo: 'comodo.remover', id });
  for (const { id, colecao } of alvos) {
    if (colecao === 'moments') comandos.push({ tipo: 'momento.remover', id });
    else if (colecao === 'props' || colecao === 'lights' || colecao === 'tokens' || colecao === 'regions' || colecao === 'presence') comandos.push({ tipo: 'item.remover', colecao, id });
  }
  return { comandos, ids: [] };
}

function moverIds(mapa: MapaAtlas, ids: readonly string[], delta: [number, number]): Geracao {
  const alvos = resolverIds(mapa, ids);
  const naoMove = alvos.filter(a => a.colecao !== 'props' && a.colecao !== 'lights' && a.colecao !== 'tokens' && a.colecao !== 'regions');
  if (naoMove.length) throw new Error(`Não dá para mover ${naoMove.map(a => `${a.id} (${NOME_DA_COLECAO[a.colecao][0]})`).join(', ')}: só objetos, luzes, peças e regiões se movem. Cômodos, paredes e aberturas: apague e recrie.`);
  const movem = alvos.map(a => ({ colecao: a.colecao as 'props' | 'lights' | 'tokens' | 'regions', id: a.id }));
  return { comandos: [{ tipo: 'selecao.mover', alvos: movem, delta }], ids: [], afetados: ids };
}

/** Confirma com o mestre o que não é do assistente. Sem nada do mestre na lista, segue direto. Erros voltam como erro da ferramenta. */
async function liberar(ctx: ContextoDeEscrita, rotulo: string, ids: readonly string[], descrever: (mapa: MapaAtlas) => string): Promise<void> {
  const falhar = (mensagem: string): never => { registrarChamada({ rotulo, ids: [], ok: false, erro: mensagem }); throw new Error(mensagem); };
  const store = ctx.store();
  if (!store) return falhar(SEM_MAPA);
  let descricao: string;
  try {
    const mapa = store.documento;
    resolverIds(mapa, ids);
    const doMestre = ids.filter(i => !criadosPeloAssistente.has(i));
    if (!doMestre.length) return;
    if (rotulo === 'mover') moverIds(mapa, ids, [0, 0]);
    descricao = descrever(mapa);
  } catch (e) { return falhar(e instanceof Error ? e.message : String(e)); }
  if (!ctx.confirmar) return falhar('Esta aba não tem o painel de confirmação; só dá para mexer no que o assistente criou.');
  const r = await ctx.confirmar(descricao);
  if (r === 'recusar') return falhar('o mestre recusou');
  if (r === 'sem-resposta') return falhar('o mestre não respondeu');
}
