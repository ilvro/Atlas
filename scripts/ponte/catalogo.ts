import fs from 'node:fs';
import path from 'node:path';

export const APPS_CONHECIDOS = ['atlas', 'mesa', 'ficha', 'atelie', 'jukebox'];

export interface ItemCatalogoBase {
  nome: string;
  descricao: string;
  esquema: Record<string, unknown>;
  app: string;
  anotacoes?: Record<string, unknown>;
}

export function gerarCatalogoBase(caminhoCache: string, caminhoDestino: string): { total: number; faltantes: string[] } {
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
  const { total, faltantes } = gerarCatalogoBase(caminhoCache, caminhoDestino);
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
