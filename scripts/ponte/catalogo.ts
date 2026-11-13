import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ferramentasDeEscrita } from '../../src/app/ponte-escrita.ts';
import { ferramentasDeLeitura } from '../../src/app/ponte-leitura.ts';
import { DESCRICAO_IMAGEM_DEFINIR, DESCRICAO_PRESET_ABRIR, ESQUEMA_IMAGEM_DEFINIR, ESQUEMA_PRESET_ABRIR, ESQUEMA_PRESET_ADICIONAR, ESQUEMA_PRESET_LER } from './mcp.ts';

export const APPS_CONHECIDOS = ['atlas', 'mesa', 'ficha', 'atelie', 'jukebox'];

/** Ferramentas internas (chamadas pelo próprio servidor MCP): nunca entram no catálogo base. */
export const FERRAMENTAS_INTERNAS = ['jukebox_preset_receber', 'jukebox_preset_abrir_receber', 'atelie_imagem_receber'];

export interface ItemCatalogoBase {
  nome: string;
  descricao: string;
  esquema: Record<string, unknown>;
  app: string;
  anotacoes?: Record<string, unknown>;
}

export const FERRAMENTAS_LOCAIS_CATALOGO: ItemCatalogoBase[] = [
  {
    nome: 'jukebox_preset_adicionar',
    descricao: 'Adiciona música MP3 a uma pasta de preset da Jukebox no disco (use substituir: true para atualizar).',
    esquema: ESQUEMA_PRESET_ADICIONAR as Record<string, unknown>,
    app: 'jukebox',
    anotacoes: { destrutiva: false },
  },
  {
    nome: 'atelie_imagem_definir',
    descricao: DESCRICAO_IMAGEM_DEFINIR,
    esquema: ESQUEMA_IMAGEM_DEFINIR as Record<string, unknown>,
    app: 'atelie',
    anotacoes: { destrutiva: false },
  },
  {
    nome: 'jukebox_preset_abrir',
    descricao: DESCRICAO_PRESET_ABRIR,
    esquema: ESQUEMA_PRESET_ABRIR as Record<string, unknown>,
    app: 'jukebox',
    anotacoes: { destrutiva: false },
  },
  {
    nome: 'jukebox_preset_ler',
    descricao: 'Lê músicas e metadados de uma pasta de preset da Jukebox no disco.',
    esquema: ESQUEMA_PRESET_LER as Record<string, unknown>,
    app: 'jukebox',
    anotacoes: { leitura: true },
  },
];

/**
 * As ferramentas `atlas_*` montadas direto do código (contextos falsos: só nome, descrição, esquema e anotações importam),
 * sem depender do cache que o servidor MCP grava quando o app está conectado. É a fonte do catálogo base para o app `atlas`.
 */
export function ferramentasDoAtlasDoCodigo(): ItemCatalogoBase[] {
  const leitura = ferramentasDeLeitura({ repo: () => null, mapaAberto: () => null, abrirMapa: async () => {} });
  const escrita = ferramentasDeEscrita({ store: () => null, repo: () => null, abrirMapa: async () => {} });
  return [...leitura, ...escrita].map(f => ({
    nome: f.nome, descricao: f.descricao, esquema: f.esquema, app: 'atlas',
    ...(f.anotacoes ? { anotacoes: f.anotacoes as Record<string, unknown> } : {}),
  }));
}

export interface IrmaoDoCatalogo {
  app: string;
  /** Pasta do repositório irmão, ao lado do Atlas. */
  pasta: string;
  /** Módulo que monta a lista de ferramentas, relativo à pasta. */
  modulo: string;
  /** Monta a lista de ferramentas a partir do módulo importado, com contexto falso. */
  montar: (modulo: any) => any[];
}

/** Contexto falso: só nome, descrição, esquema e anotações importam, então nenhuma ferramenta é executada. */
const subcontextos = ['repositorio', 'sessoes', 'entidades', 'campanhas', 'cenas', 'elenco'];

export const IRMAOS_DO_CATALOGO: IrmaoDoCatalogo[] = [
  { app: 'mesa', pasta: 'Mesa', modulo: 'src/app/ponte-ferramentas.ts', montar: m => m.ferramentasDaMesa(Object.fromEntries(subcontextos.map(k => [k, {}]))) },
  { app: 'ficha', pasta: 'Dossie', modulo: 'src/ponte.js', montar: m => m.ferramentasDoDossie({}) },
  { app: 'atelie', pasta: 'Atelie', modulo: 'src/ponte.js', montar: m => m.ferramentasDoAtelie({ criados: { tem: () => false, marcar: () => {} } }) },
  { app: 'jukebox', pasta: 'Jukebox', modulo: 'ponte.js', montar: m => m.ferramentasDaJukebox({}) },
];

/** Pasta do repositório irmão, ou null quando ele não existe ao lado do Atlas. */
export function pastaDoIrmao(irmao: IrmaoDoCatalogo, raiz: string): string | null {
  const pasta = path.resolve(raiz, '..', irmao.pasta);
  return fs.existsSync(path.join(pasta, irmao.modulo)) ? pasta : null;
}

/** Importa o repositório irmão e monta as ferramentas do app direto do código. Lança se a importação ou a montagem falhar. */
export async function ferramentasDoIrmaoDoCodigo(irmao: IrmaoDoCatalogo, raiz: string): Promise<ItemCatalogoBase[]> {
  const pasta = pastaDoIrmao(irmao, raiz);
  if (!pasta) throw new Error(`repositório ${irmao.pasta} não encontrado ao lado do Atlas`);
  const modulo = await import(pathToFileURL(path.join(pasta, irmao.modulo)).href);
  return irmao.montar(modulo)
    .filter(f => !FERRAMENTAS_INTERNAS.includes(f.nome))
    .map(f => ({
      nome: f.nome, descricao: f.descricao, esquema: f.esquema, app: irmao.app,
      ...(f.anotacoes ? { anotacoes: f.anotacoes as Record<string, unknown> } : {}),
    }));
}

/** Tenta montar cada app irmão do código; o que falhar fica de fora (com o motivo) e cai no cache ou no catálogo atual. */
export async function ferramentasDosIrmaos(raiz: string): Promise<{ itens: ItemCatalogoBase[]; fontes: Record<string, string>; erros: Record<string, string> }> {
  const itens: ItemCatalogoBase[] = [];
  const fontes: Record<string, string> = {};
  const erros: Record<string, string> = {};
  for (const irmao of IRMAOS_DO_CATALOGO) {
    if (!pastaDoIrmao(irmao, raiz)) { erros[irmao.app] = `repositório ../${irmao.pasta} não existe`; continue; }
    try {
      itens.push(...await ferramentasDoIrmaoDoCodigo(irmao, raiz));
      fontes[irmao.app] = `código (../${irmao.pasta}/${irmao.modulo})`;
    } catch (e) {
      erros[irmao.app] = `importação falhou: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { itens, fontes, erros };
}

/**
 * Gera o catálogo base. Os apps cujas ferramentas vieram do código (`ferramentasDoCodigo`: o Atlas e os repositórios irmãos que
 * puderam ser importados) não usam o cache: o que cache ou catálogo antigo têm deles é descartado, inclusive o que foi removido.
 * Os outros apps vêm do cache (`.ponte/ferramentas.json`, gravado quando eles se conectam) e, sem cache ou sem o app nele,
 * do próprio catálogo base atual.
 */
export function gerarCatalogoBase(
  caminhoCache: string,
  caminhoDestino: string,
  extrasLocais: ItemCatalogoBase[] = [],
  ferramentasDoCodigo: ItemCatalogoBase[] = []
): { total: number; faltantes: string[]; fontes: Record<string, string> } {
  const lerLista = (caminho: string): any[] => {
    const dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    if (!Array.isArray(dados)) throw new Error(`Cache inválido: esperava array, recebeu ${typeof dados}`);
    return dados;
  };
  const temCache = fs.existsSync(caminhoCache);
  const temAtual = fs.existsSync(caminhoDestino);
  if (!temCache && !(ferramentasDoCodigo.length && temAtual)) {
    throw new Error(`Arquivo de cache não encontrado em ${caminhoCache}`);
  }
  const doCodigo = new Set(ferramentasDoCodigo.map(f => f.app));
  const vindoDoCodigo = (item: any) => doCodigo.has(item?.app) && (item.app !== 'atlas' || (typeof item.nome === 'string' && item.nome.startsWith('atlas_')));

  const appsPresentes = new Set<string>();
  const fontes: Record<string, string> = {};
  for (const app of doCodigo) fontes[app] = 'código';
  const itens: ItemCatalogoBase[] = [];
  const adicionar = (item: any, origem: string) => {
    if (vindoDoCodigo(item) || FERRAMENTAS_INTERNAS.includes(item?.nome)) return;
    if (!item || typeof item.nome !== 'string' || typeof item.app !== 'string') return;
    if (itens.some(i => i.nome === item.nome)) return;
    appsPresentes.add(item.app);
    fontes[item.app] ??= origem;
    const limpo: ItemCatalogoBase = { nome: item.nome, descricao: item.descricao ?? '', esquema: item.esquema ?? {}, app: item.app };
    if (item.anotacoes && typeof item.anotacoes === 'object') limpo.anotacoes = item.anotacoes;
    itens.push(limpo);
  };

  if (temCache) for (const item of lerLista(caminhoCache)) adicionar(item, 'cache');
  if (temAtual) {
    // Apps que o cache não trouxe (nem o código) continuam como estão no catálogo atual.
    const jaTem = new Set(appsPresentes);
    for (const item of lerLista(caminhoDestino)) if (!jaTem.has(item?.app)) adicionar(item, 'catálogo atual');
  }

  for (const f of ferramentasDoCodigo) {
    appsPresentes.add(f.app);
    itens.push({ ...f });
  }

  for (const extra of extrasLocais) {
    if (!itens.some(i => i.nome === extra.nome)) {
      appsPresentes.add(extra.app);
      itens.push({ ...extra });
    }
  }

  const faltantes = APPS_CONHECIDOS.filter(app => !appsPresentes.has(app));
  if (faltantes.length > 0) {
    console.error(`[ponte:catalogo] aviso: apps faltando no cache: ${faltantes.join(', ')}`);
  }

  itens.sort((a, b) => a.nome.localeCompare(b.nome));

  fs.mkdirSync(path.dirname(caminhoDestino), { recursive: true });
  fs.writeFileSync(caminhoDestino, JSON.stringify(itens, null, 2) + '\n', 'utf8');

  return { total: itens.length, faltantes, fontes };
}

async function principal() {
  const raiz = path.resolve(import.meta.dirname, '..', '..');
  const caminhoCache = path.join(raiz, '.ponte', 'ferramentas.json');
  const caminhoDestino = path.join(raiz, 'scripts', 'ponte', 'catalogo-base.json');
  const irmaos = await ferramentasDosIrmaos(raiz);
  for (const [app, motivo] of Object.entries(irmaos.erros)) console.error(`[ponte:catalogo] ${app}: ${motivo}; usa cache ou catálogo atual`);
  const { total, faltantes, fontes } = gerarCatalogoBase(
    caminhoCache, caminhoDestino, FERRAMENTAS_LOCAIS_CATALOGO, [...ferramentasDoAtlasDoCodigo(), ...irmaos.itens]
  );
  for (const app of APPS_CONHECIDOS) console.error(`[ponte:catalogo] ${app}: fonte ${fontes[app] ?? 'nenhuma'}`);
  console.error(`[ponte:catalogo] gerado catálogo base com ${total} ferramentas em ${caminhoDestino}`);
  if (faltantes.length > 0) {
    console.error(`[ponte:catalogo] atenção: faltam ferramentas dos apps: ${faltantes.join(', ')}`);
  }
}

if (import.meta.main) {
  principal().catch(e => {
    console.error('[ponte:catalogo] erro:', e);
    process.exit(1);
  });
}
