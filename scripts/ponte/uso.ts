import fs from 'node:fs';
import path from 'node:path';

export type RegistroDeUso = Record<string, { chamadas: number; ultima: string; dias: string[] }>;

const MAX_DIAS = 60;
const raiz = path.resolve(import.meta.dirname, '..', '..');
export const CAMINHO_USO_PADRAO = path.join(raiz, '.ponte', 'uso.json');

/** Soma uma chamada de `nome` ao registro (função pura: devolve uma cópia). */
export function registrarUso(dados: RegistroDeUso, nome: string, agora: Date): RegistroDeUso {
  const iso = agora.toISOString();
  const dia = iso.slice(0, 10);
  const antes = dados[nome];
  const dias = antes?.dias ?? [];
  const novosDias = dias.includes(dia) ? dias : [...dias, dia].sort().slice(-MAX_DIAS);
  return { ...dados, [nome]: { chamadas: (antes?.chamadas ?? 0) + 1, ultima: iso, dias: novosDias } };
}

export function lerUso(caminho: string): RegistroDeUso {
  try {
    if (!fs.existsSync(caminho)) return {};
    const dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return {};
    const saida: RegistroDeUso = {};
    for (const [nome, v] of Object.entries(dados as Record<string, any>)) {
      if (v && typeof v.chamadas === 'number' && typeof v.ultima === 'string' && Array.isArray(v.dias)) {
        saida[nome] = { chamadas: v.chamadas, ultima: v.ultima, dias: v.dias.filter((d: unknown) => typeof d === 'string') };
      }
    }
    return saida;
  } catch (e) {
    console.error('[mesa-mcp] aviso: erro ao ler registro de uso:', e);
    return {};
  }
}

export function gravarUso(caminho: string, dados: RegistroDeUso): void {
  try {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8');
  } catch (e) {
    console.error('[mesa-mcp] aviso: erro ao gravar registro de uso:', e);
  }
}

/** Relatório em texto: ordenado por dias distintos e depois por chamadas. */
export function relatorioDeUso(dados: RegistroDeUso, tamanhos: Record<string, number>, sempre: ReadonlySet<string> = new Set()): string {
  const linhas = Object.entries(dados).sort((a, b) =>
    b[1].dias.length - a[1].dias.length || b[1].chamadas - a[1].chamadas || a[0].localeCompare(b[0]));
  const out = ['dias\tchamadas\tbytes\tultima\tferramenta'];
  for (const [nome, v] of linhas) {
    const bytes = tamanhos[nome] !== undefined ? String(tamanhos[nome]) : '-';
    out.push(`${v.dias.length}\t${v.chamadas}\t${bytes}\t${v.ultima.slice(0, 10)}\t${nome}${sempre.has(nome) ? ' *' : ''}`);
  }
  out.push(`total: ${linhas.length} ferramentas, ${linhas.reduce((s, [, v]) => s + v.chamadas, 0)} chamadas`);
  return out.join('\n');
}

async function principal() {
  const tamanhos: Record<string, number> = {};
  try {
    const base = JSON.parse(fs.readFileSync(path.join(raiz, 'scripts', 'ponte', 'catalogo-base.json'), 'utf8'));
    for (const f of base) tamanhos[f.nome] = Buffer.byteLength(JSON.stringify({ name: f.nome, description: f.descricao, inputSchema: f.esquema }));
  } catch (e) {
    console.error('[uso] aviso: sem catálogo base para os tamanhos:', e);
  }
  // A PM6b acrescenta a marca `*` das ferramentas em SEMPRE (scripts/ponte/niveis.ts).
  console.log(relatorioDeUso(lerUso(CAMINHO_USO_PADRAO), tamanhos));
}

if (import.meta.main) principal().catch(e => { console.error('[uso] erro:', e); process.exit(1); });
