import fs from 'node:fs';
import path from 'node:path';
import { ferramentasDeEscrita } from '../../src/app/ponte-escrita.ts';
import { ferramentasDeLeitura } from '../../src/app/ponte-leitura.ts';
import { ESQUEMA_PRESET_ADICIONAR, ESQUEMA_PRESET_LER } from './mcp.ts';

export const APPS_CONHECIDOS = ['atlas', 'mesa', 'ficha', 'atelie', 'jukebox'];

/** Ferramentas internas (chamadas pelo próprio servidor MCP): nunca entram no catálogo base. */
export const FERRAMENTAS_INTERNAS = ['jukebox_preset_receber'];

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

/**
 * Gera o catálogo base. Os outros apps vêm do cache (`.ponte/ferramentas.json`, gravado quando eles estão conectados) ou, se ele
 * não existir, do próprio catálogo base atual; as ferramentas `atlas_*` vêm sempre do código (`ferramentasDoAtlas`).
 */
export function gerarCatalogoBase(
  caminhoCache: string,
  caminhoDestino: string,
  extrasLocais: ItemCatalogoBase[] = [],
  ferramentasDoAtlas: ItemCatalogoBase[] = []
): { total: number; faltantes: string[] } {
  const fonte = fs.existsSync(caminhoCache) ? caminhoCache : ferramentasDoAtlas.length && fs.existsSync(caminhoDestino) ? caminhoDestino : null;
  if (!fonte) {
    throw new Error(`Arquivo de cache não encontrado em ${caminhoCache}`);
  }
  const conteudo = fs.readFileSync(fonte, 'utf8');
  const dados = JSON.parse(conteudo);
  if (!Array.isArray(dados)) {
    throw new Error(`Cache inválido: esperava array, recebeu ${typeof dados}`);
  }

  const appsPresentes = new Set<string>();
  const itens: ItemCatalogoBase[] = [];

  for (const item of dados) {
    // As ferramentas do Atlas vêm do código: o que o cache (ou o catálogo antigo) tem delas é descartado, inclusive as removidas.
    if (ferramentasDoAtlas.length && item?.app === 'atlas' && typeof item.nome === 'string' && item.nome.startsWith('atlas_')) continue;
    if (FERRAMENTAS_INTERNAS.includes(item?.nome)) continue;
    if (!item || typeof item.nome !== 'string' || typeof item.app !== 'string') continue;
    appsPresentes.add(item.app);
    const limpo: ItemCatalogoBase = {
      nome: item.nome,
      descricao: item.descricao ?? '',
      esquema: item.esquema ?? {},
      app: item.app,
    };
    if (item.anotacoes && typeof item.anotacoes === 'object') {
      limpo.anotacoes = item.anotacoes;
    }
    itens.push(limpo);
  }

  for (const f of ferramentasDoAtlas) {
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

  return { total: itens.length, faltantes };
}

async function principal() {
  const raiz = path.resolve(import.meta.dirname, '..', '..');
  const caminhoCache = path.join(raiz, '.ponte', 'ferramentas.json');
  const caminhoDestino = path.join(raiz, 'scripts', 'ponte', 'catalogo-base.json');
  const { total, faltantes } = gerarCatalogoBase(caminhoCache, caminhoDestino, FERRAMENTAS_LOCAIS_CATALOGO, ferramentasDoAtlasDoCodigo());
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
