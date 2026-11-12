import fs from 'node:fs';
import path from 'node:path';
import { ESQUEMA_PRESET_ADICIONAR, ESQUEMA_PRESET_LER } from './mcp.ts';

export const APPS_CONHECIDOS = ['atlas', 'mesa', 'ficha', 'atelie', 'jukebox'];

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
    descricao: 'Adiciona música MP3 a uma pasta de preset da Jukebox no disco.',
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

export function gerarCatalogoBase(
  caminhoCache: string,
  caminhoDestino: string,
  extrasLocais: ItemCatalogoBase[] = []
): { total: number; faltantes: string[] } {
  if (!fs.existsSync(caminhoCache)) {
    throw new Error(`Arquivo de cache não encontrado em ${caminhoCache}`);
  }
  const conteudo = fs.readFileSync(caminhoCache, 'utf8');
  const dados = JSON.parse(conteudo);
  if (!Array.isArray(dados)) {
    throw new Error(`Cache inválido: esperava array, recebeu ${typeof dados}`);
  }

  const appsPresentes = new Set<string>();
  const itens: ItemCatalogoBase[] = [];

  for (const item of dados) {
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
  const { total, faltantes } = gerarCatalogoBase(caminhoCache, caminhoDestino, FERRAMENTAS_LOCAIS_CATALOGO);
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
