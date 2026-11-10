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
  /** Toca o momento do mapa aberto pelo mesmo executor do painel (o app liga `tocarMomentoDoMapa`); resolve ao terminar. */
  tocarMomento?: (id: string) => Promise<'fim' | 'cancelado'>;
  /** Para o momento em curso (o app liga `pararMomento`); usado quando o teste estoura o tempo. */
  pararMomento?: () => void;
}

export interface Geracao { comandos: readonly Comando[]; ids: readonly string[] }

const SEM_MAPA = 'Não há mapa aberto: abra um com atlas_abrir ou crie com atlas_mapa_criar.';
const MAX_ITENS = 100;
const MAX_OBJETOS = 200;

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
    {
      nome: 'atlas_objetos',
      descricao: `Coloca objetos do acervo (móveis, árvores, adereços) no mapa aberto, até ${MAX_OBJETOS} por chamada, tudo como UM passo de desfazer. ${unidades} Cada objeto: { item, pos: [x, y] em metros, rotacao? (radianos; omita para sortear), escala? (0,05 a 50; padrão 1), camada? ("floor" | "table" | "wall" | "ceiling" | "underwater"), submerso?, params? }. "item" é o id de uma receita (atlas_catalogo { parte: "receitas" }) ou "casa:<nome>" da coleção (atlas_catalogo { parte: "colecao" }); id desconhecido volta com os mais parecidos. Objetos dentro de um cômodo entram nele sozinhos. Para muitos iguais (mata, jardim, bagunça) prefira atlas_espalhar.`,
      esquema: { type: 'object', properties: {
        objetos: { type: 'array', minItems: 1, maxItems: MAX_OBJETOS, items: { type: 'object', properties: {
          item: { type: 'string', description: 'Id da receita ou "casa:<nome>" (veja atlas_catalogo).' }, pos: ponto,
          rotacao: { type: 'number', description: 'Rotação em radianos (omita para sortear).' }, escala: { type: 'number', minimum: 0.05, maximum: 50, description: 'Multiplicador de tamanho (padrão 1).' },
          camada: { type: 'string', enum: ['floor', 'table', 'wall', 'ceiling', 'underwater'], description: 'floor = chão (padrão); table = sobre mesa; wall = na parede; ceiling = teto.' },
          submerso: { type: 'boolean' }, params: { type: 'object', description: 'Parâmetros da receita, se ela tiver.' },
        }, required: ['item', 'pos'], additionalProperties: false } },
        semente,
      }, required: ['objetos'], additionalProperties: false },
      async executar(args) {
        const pedidos = itens(args, 'objetos', MAX_OBJETOS).map((o, i) => ({
          item: textoOpcional(o.item, 'item', 120) ?? '', pos: pontos([o.pos], `objetos[${i}].pos`)[0]!,
          ...(o.rotacao !== undefined ? { rotacao: numero(o.rotacao, 'rotacao', -1000, 1000) } : {}), ...(o.escala !== undefined ? { escala: numero(o.escala, 'escala', 0.05, 50) } : {}),
          ...(o.camada !== undefined ? { camada: o.camada as 'floor' } : {}), ...(typeof o.submerso === 'boolean' ? { submerso: o.submerso } : {}),
          ...(o.params !== undefined ? { params: objeto(o.params, 'params') } : {}),
        }));
        const s = sementeDe(args);
        return [texto(escrever(ctx, `${pedidos.length} objeto(s)`, mapa => geracao(objetos(mapa, pedidos, s))))];
      },
    },
    {
      nome: 'atlas_espalhar',
      descricao: `Espalha um conjunto de objetos (mata, jardim, cemitério, bagunça…) dentro de uma região do mapa aberto, como UM passo de desfazer; os objetos são comuns e editáveis depois. ${unidades} "conjunto" é um destes: ${TODOS_OS_CONJUNTOS.map(c => c.id).join(', ')}; id desconhecido volta com os mais parecidos. "forma" é UMA de disco { disco: [x, y], raio }, poligono, faixa { faixa, largura }, retangulo ou celulas (tudo em metros). "densidade" (itens por m² no centro) é opcional; omita para usar a do conjunto. O resultado é aproximado: confira com atlas_ver_mapa.`,
      esquema: { type: 'object', properties: {
        conjunto: { type: 'string', enum: TODOS_OS_CONJUNTOS.map(c => c.id), description: 'Id do conjunto.' }, forma: esquemaDaForma(),
        densidade: { type: 'number', exclusiveMinimum: 0, maximum: 20, description: 'Itens por m² (opcional).' }, semente,
      }, required: ['conjunto', 'forma'], additionalProperties: false },
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
      descricao: `Acende luzes no mapa aberto (um passo de desfazer). ${unidades} Cada luz: { preset, pos: [x, y] em metros, direcao? (radianos, só para cones), raio? (m, 0,1 a 200), cor? ("#rrggbb"), intensidade? (0 a 3) }. "preset" (atlas_catalogo { parte: "luzes" }): ${PRESETS_DE_LUZ.map(l => l.id).join(', ')}; "raio", "cor" e "intensidade" sobrescrevem o preset. Luzes só aparecem de verdade em clima escuro (veja atlas_ambiente).`,
      esquema: { type: 'object', properties: {
        luzes: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          preset: { type: 'string', enum: PRESETS_DE_LUZ.map(l => l.id) }, pos: ponto, direcao: { type: 'number', description: 'Direção do cone em radianos (0 = para a direita).' },
          raio: { type: 'number', minimum: 0.1, maximum: 200, description: 'Raio em metros.' }, cor: { type: 'string', description: '"#rrggbb".' }, intensidade: { type: 'number', minimum: 0, maximum: 3 },
        }, required: ['preset', 'pos'], additionalProperties: false } },
      }, required: ['luzes'], additionalProperties: false },
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
      descricao: `Ajusta o clima e o acabamento (cor final) do mapa aberto, como UM passo de desfazer. "clima" { preset?, horario?, tempo?, ambiente?, sol?, redeLigada? }: "preset" é um clima pronto (${PRESETS_DE_CLIMA.map(c => c.id).join(', ')}) ou um clima salvo do mapa (atlas_catalogo { parte: "climas" }); "horario" "HH:MM" move o sol e o ambiente; "tempo" são níveis de 0 a 1 de rain, snow, fog, dust, embers, leaves, lightning e wind (-1 a 1); "ambiente" { color: "#rrggbb", intensity: 0 a 1 } é a luz de base; "sol" { angle (radianos), color, intensity (0 a 3) } ou null para sem sol; "redeLigada" false apaga as luzes de rede (apagão). "acabamento" { preset?, texture, vignette, grain, glow (0 a 1), saturation (0 a 2), tint ("#rrggbb"), grade { lift (-1 a 1), gamma (0,1 a 4), gain (0 a 4) }, edges { kind: none | clouds | dark | fog, amount 0 a 1 } }: "preset" é um de ${PRESETS_DE_ACABAMENTO.map(a => a.id).join(', ')}; os ajustes valem por cima dele. "guardarClima" { id, nome } guarda o clima e o acabamento resultantes para voltar a eles depois. Aplicar um clima pronto troca também o acabamento dele.`,
      esquema: { type: 'object', properties: {
        clima: { type: 'object', properties: {
          preset: { type: 'string' }, horario: { type: 'string', description: '"HH:MM", 00:00 a 23:59.' },
          tempo: { type: 'object', properties: { rain: unidadeEsq, snow: unidadeEsq, fog: unidadeEsq, dust: unidadeEsq, embers: unidadeEsq, leaves: unidadeEsq, lightning: unidadeEsq, wind: { type: 'number', minimum: -1, maximum: 1 } }, additionalProperties: false },
          ambiente: { type: 'object', properties: { color: { type: 'string' }, intensity: unidadeEsq }, required: ['color', 'intensity'], additionalProperties: false },
          sol: { type: ['object', 'null'], properties: { angle: { type: 'number' }, color: { type: 'string' }, intensity: { type: 'number', minimum: 0, maximum: 3 } }, required: ['angle', 'color', 'intensity'], additionalProperties: false },
          redeLigada: { type: 'boolean' },
        }, additionalProperties: false },
        acabamento: { type: 'object', properties: {
          preset: { type: 'string', enum: PRESETS_DE_ACABAMENTO.map(a => a.id) }, texture: unidadeEsq, vignette: unidadeEsq, grain: unidadeEsq, glow: unidadeEsq, saturation: { type: 'number', minimum: 0, maximum: 2 }, tint: { type: 'string' },
          grade: { type: 'object', properties: { lift: { type: 'number', minimum: -1, maximum: 1 }, gamma: { type: 'number', minimum: 0.1, maximum: 4 }, gain: { type: 'number', minimum: 0, maximum: 4 } }, additionalProperties: false },
          edges: { type: 'object', properties: { kind: { type: 'string', enum: ['none', 'clouds', 'dark', 'fog'] }, amount: unidadeEsq }, required: ['kind', 'amount'], additionalProperties: false },
        }, additionalProperties: false },
        guardarClima: { type: 'object', properties: { id: { type: 'string', description: 'Identificador curto (letras, números, - e _).' }, nome: { type: 'string' } }, required: ['id', 'nome'], additionalProperties: false },
      }, additionalProperties: false },
      async executar(args) {
        if (args.clima === undefined && args.acabamento === undefined && args.guardarClima === undefined) throw new Error('Passe "clima", "acabamento" e/ou "guardarClima".');
        return [texto(escrever(ctx, 'ambiente', mapa => ({ comandos: comandosDeAmbiente(mapa, args), ids: [] })))];
      },
    },
    {
      nome: 'atlas_regioes',
      descricao: `Cria regiões no mapa aberto (um passo de desfazer): áreas com função para a sessão. ${unidades} Cada região: { poligono: [[x, y], …] (mínimo 3 pontos, em metros), tipo: "reveal" (revela o que há dentro) | "trigger" (gatilho) | "audio" (som) | "note" (anotação), nome?, texto?, somenteMestre? (padrão true) }.`,
      esquema: { type: 'object', properties: {
        regioes: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: {
          poligono: { type: 'array', items: ponto, minItems: 3 }, tipo: { type: 'string', enum: ['reveal', 'trigger', 'audio', 'note'] },
          nome: { type: 'string' }, texto: { type: 'string' }, somenteMestre: { type: 'boolean', description: 'Só o mestre vê (padrão true).' },
        }, required: ['poligono', 'tipo'], additionalProperties: false } },
      }, required: ['regioes'], additionalProperties: false },
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
      descricao: `Pinta presença (musgo, sangue, mofo, corrupção…) numa região do mapa aberto, como UM passo de desfazer. ${unidades} "pincel" (atlas_catalogo { parte: "presenca" }): ${PINCEIS_DE_PRESENCA.map(p => p.id).join(', ')}; id desconhecido volta com os mais parecidos. "forma" é UMA de disco, poligono, faixa, retangulo ou celulas (em metros). "intensidade" (0 a 1, padrão 0,6) ajusta a presença desse pincel no mapa.`,
      esquema: { type: 'object', properties: {
        pincel: { type: 'string', enum: PINCEIS_DE_PRESENCA.map(p => p.id) }, forma: esquemaDaForma(), intensidade: unidadeEsq, semente,
      }, required: ['pincel', 'forma'], additionalProperties: false },
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
      descricao: `Escreve notas no mapa aberto (um passo de desfazer), SUBSTITUINDO o texto anterior do campo. "mapa" é a nota geral do mestre sobre o mapa. "comodos" é uma lista { id, leitura?, notasMestre? } (ids de atlas_mapa_ler): "leitura" é o texto para ler em voz alta aos jogadores e "notasMestre" é só para o mestre. Texto vazio apaga.`,
      esquema: { type: 'object', properties: {
        mapa: { type: 'string', description: 'Nota geral do mapa (até 5000 caracteres).' },
        comodos: { type: 'array', minItems: 1, maxItems: MAX_ITENS, items: { type: 'object', properties: { id: { type: 'string' }, leitura: { type: 'string' }, notasMestre: { type: 'string' } }, required: ['id'], additionalProperties: false } },
      }, additionalProperties: false },
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
      descricao: `Cria (ou refaz) um momento do mapa aberto: uma sequência curta de passos de cena que o mestre toca na sessão (um passo de desfazer). "nome" 1 a 60 caracteres; "cor" "#rrggbb" opcional; "passos" até 60, na ordem. Sem "id" cria um momento novo e devolve o id; com "id" só substitui momentos que o assistente criou (momento do mestre não é alterado: crie outro). Cada passo tem "tipo": ${TIPOS_DE_PASSO_ESQUEMA.join(', ')}. Os passos que não são "esperar" disparam na hora; use "esperar" entre eles para dar ritmo (um letreiro, uma tela ou um silêncio duram "ms" em paralelo ao próximo passo). Climas: ${PRESETS_DE_CLIMA.map(c => c.id).join(', ')} ou um clima salvo do mapa (atlas_catalogo { parte: "climas" }). Câmera, revelar, interagir e a peça do letreiro usam ids de atlas_mapa_ler; "interagir" aceita porta, porta secreta, interruptor ou gaveta. Os ids de som (Jukebox) e pista (Ateliê) vêm de outros apps e só têm o formato conferido. Teste com atlas_momento_testar.`,
      esquema: { type: 'object', properties: {
        id: { type: 'string', description: 'Só para refazer um momento que o assistente criou; omita para criar um novo.' },
        nome: { type: 'string', minLength: 1, maxLength: 60 },
        cor: { type: 'string', description: 'Cor "#rrggbb" do momento (opcional).' },
        passos: { type: 'array', maxItems: 60, items: esquemaDoPasso(), description: 'Os passos, em ordem (até 60).' },
      }, required: ['nome', 'passos'], additionalProperties: false },
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
      descricao: 'Toca na aba, agora, um momento do mapa aberto (o mesmo executor do painel de momentos: luz, tela, câmera e sons acontecem de verdade) e espera terminar. Devolve a lista dos passos executados, com a descrição de cada um, e o resultado ("fim", "cancelado" ou "tempo esgotado"). Espera no máximo a duração estimada + 5 s (teto de 2 min).',
      esquema: { type: 'object', properties: { id: { type: 'string', description: 'Id do momento (atlas_mapa_ler ou o devolvido por atlas_momento).' } }, required: ['id'], additionalProperties: false },
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
  ];
}

// ---------- Momentos ----------
/** Os tipos de passo (a mesma lista de `atlas_catalogo { parte: "momentos" }`; um teste confere). */
export const TIPOS_DE_PASSO_ESQUEMA = ['esperar', 'som', 'silencio', 'efeito', 'clima', 'tela', 'letreiro', 'camera', 'revelar', 'interagir', 'pista', 'nota'] as const;

const refEsquema = (descricao: string) => ({ type: 'object', properties: { app: { type: 'string' }, tipo: { type: 'string' }, id: { type: 'string' } }, required: ['app', 'tipo', 'id'], additionalProperties: false, description: descricao });
const msEsquema = (min: number, max: number, descricao: string) => ({ type: 'number', minimum: min, maximum: max, description: descricao });
const passo = (tipo: string, descricao: string, props: Record<string, unknown>, obrigatorios: string[]) => ({ type: 'object', properties: { tipo: { const: tipo }, ...props }, required: ['tipo', ...obrigatorios], additionalProperties: false, description: descricao });

/** O esquema JSON de UM passo de momento: `oneOf` por `tipo`, com os limites de `domain/momentos.ts`. */
export function esquemaDoPasso(): Record<string, unknown> {
  return {
    description: 'Um passo do momento: exatamente um destes tipos.',
    oneOf: [
      passo('esperar', 'Espera antes do próximo passo.', { ms: msEsquema(100, 120_000, 'Milissegundos (100 a 120000).') }, ['ms']),
      passo('som', 'Toca uma cena sonora ou efeito do Jukebox.', { ref: refEsquema('Ref { app: "jukebox", tipo: "cena-sonora" | "efeito", id } vinda do Jukebox.') }, ['ref']),
      passo('silencio', 'Apaga o som do Jukebox com fade.', { ms: msEsquema(0, 30_000, 'Duração do fade em ms (0 a 30000).') }, ['ms']),
      passo('efeito', 'Efeito curto de cena.', { efeito: { enum: [...EVENTOS_DE_CENA, 'relampago'] } }, ['efeito']),
      passo('clima', 'Troca o clima do mapa.', { clima: { type: 'string', maxLength: 60, description: 'Id de um clima pronto ou salvo do mapa (atlas_catalogo { parte: "climas" }).' } }, ['clima']),
      passo('tela', 'Cortina preta no projetor.', { acao: { enum: ['escurecer', 'clarear'] }, ms: msEsquema(0, 10_000, 'Duração do fade em ms (0 a 10000).') }, ['acao', 'ms']),
      passo('letreiro', 'Letreiro sobre o mapa (título e subtítulo).', { titulo: { type: 'string', minLength: 1, maxLength: 120 }, subtitulo: { type: 'string', maxLength: 200, description: 'Pode ser "".' }, peca: { type: ['string', 'null'], description: 'Id de uma peça (atlas_mapa_ler) ou null.' }, estilo: { enum: ['apresentacao', 'capitulo'] }, ms: msEsquema(1_000, 20_000, 'Quanto tempo fica na tela, em ms (1000 a 20000).') }, ['titulo', 'subtitulo', 'peca', 'estilo', 'ms']),
      passo('camera', 'Enquadra um cômodo, região ou peça no projetor.', { alvo: { type: 'object', properties: { colecao: { enum: ['rooms', 'regions', 'tokens'] }, id: { type: 'string' } }, required: ['colecao', 'id'], additionalProperties: false } }, ['alvo']),
      passo('revelar', 'Revela cômodos aos jogadores.', { ids: { type: 'array', items: { type: 'string' }, maxItems: 100, description: 'Ids de cômodos do mapa.' } }, ['ids']),
      passo('interagir', 'Aciona uma porta, porta secreta, interruptor ou gaveta.', { id: { type: 'string', description: 'Id da abertura ou do objeto interativo.' } }, ['id']),
      passo('pista', 'Abre uma pista (documento do Ateliê).', { ref: refEsquema('Ref { app: "atelie", tipo: "documento", id }.'), mostrar: { type: 'boolean', description: 'true já projeta aos jogadores.' } }, ['ref', 'mostrar']),
      passo('nota', 'Aviso só para o mestre.', { texto: { type: 'string', maxLength: 400 } }, ['texto']),
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
        for (const id of p.ids) if (!mapa.rooms[id]) return erro(`o cômodo “${id}” não existe; cômodos do mapa: ${lista(mapa.rooms)}.`);
        break;
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
