/**
 * Níveis das ferramentas no servidor MCP: `SEMPRE` vai no `tools/list` com esquema completo; todas as outras
 * (inclusive as futuras) ficam sob demanda, listadas no índice de `plataforma_ferramentas`. Promover uma ferramenta
 * a `SEMPRE` é uma decisão explícita, com dados de `npm run ponte:uso`.
 */
import type { FerramentaDoApp } from './protocolo.ts';

export const SEMPRE: readonly string[] = [
  'ponte_estado', 'plataforma_guia',
  'atlas_abrir', 'atlas_o_que_vejo', 'atlas_mapas_listar', 'atlas_mapa_ler', 'atlas_mapa_criar', 'atlas_catalogo',
  'atlas_comodos', 'atlas_edificio', 'atlas_mobiliar', 'atlas_objetos', 'atlas_portas', 'atlas_paredes', 'atlas_luzes',
  'atlas_terreno', 'atlas_ver_mapa', 'atlas_revisar', 'atlas_salvar', 'atlas_desfazer', 'atlas_remover', 'atlas_mover',
  'mesa_o_que_vejo', 'mesa_campanha_atual', 'campanha_listar', 'campanha_ler',
];

const CONJUNTO_SEMPRE: ReadonlySet<string> = new Set(SEMPRE);

export function ehSempre(nome: string): boolean {
  return CONJUNTO_SEMPRE.has(nome);
}

/** Destrutiva: as anotações (já resolvidas por `anotacoesDaFerramenta`) não trazem `readOnlyHint: true` nem `destructiveHint: false`. */
export function ehDestrutiva(anotacoes: { readOnlyHint?: boolean; destructiveHint?: boolean }): boolean {
  return !(anotacoes.readOnlyHint === true || anotacoes.destructiveHint === false);
}

/** Primeira frase da descrição, cortada em ~70 caracteres sem partir palavra. */
export function linhaDoIndice(descricao: string, max = 70): string {
  const limpa = descricao.replace(/\s+/g, ' ').trim();
  const m = /^.*?[.!?](?=\s|$)/.exec(limpa);
  const frase = (m ? m[0] : limpa).replace(/[.!?]$/, '');
  if (frase.length <= max) return frase;
  const corte = frase.slice(0, max + 1);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > 20 ? corte.slice(0, espaco) : frase.slice(0, max)).replace(/[,;:\s]+$/, '')}…`;
}

const NOMES_DOS_APPS: Record<string, string> = { atlas: 'Atlas', mesa: 'Mesa', atelie: 'Ateliê', dossie: 'Dossiê', ficha: 'Dossiê', jukebox: 'Jukebox', tabletop: 'Tabletop', campanha: 'Campanha' };

/** Índice das ferramentas sob demanda, uma linha por app: `Atlas: atlas_momento (cria ou refaz um momento…), …`. */
export function indiceSobDemanda(catalogo: Pick<FerramentaDoApp, 'nome' | 'descricao' | 'app'>[]): string {
  const porApp = new Map<string, string[]>();
  for (const f of [...catalogo].sort((a, b) => a.nome.localeCompare(b.nome))) {
    if (ehSempre(f.nome)) continue;
    const grupo = porApp.get(f.app) ?? [];
    grupo.push(`${f.nome} (${linhaDoIndice(f.descricao)})`);
    porApp.set(f.app, grupo);
  }
  return [...porApp].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([app, itens]) => `${NOMES_DOS_APPS[app] ?? app}: ${itens.join(', ')}`).join('\n');
}

/** Até 3 nomes parecidos: contém/começa com o texto, depois o mesmo app com palavra em comum, depois o mesmo app. */
export function sugerirNomes(nome: string, nomes: string[], max = 3): string[] {
  const q = String(nome).toLowerCase();
  const prefixo = q.split('_')[0] ?? '';
  const palavras = q.split('_').slice(1).filter(Boolean);
  const pontos = (n: string): number => {
    const l = n.toLowerCase();
    if (q && l.startsWith(q)) return 4;
    if (q && (l.includes(q) || q.includes(l))) return 3;
    if (l.startsWith(`${prefixo}_`)) {
      const outras = l.split('_').slice(1);
      return palavras.some(p => outras.some(o => o.startsWith(p) || p.startsWith(o))) ? 2 : 1;
    }
    return palavras.some(p => p.length > 3 && l.includes(p)) ? 1 : 0;
  };
  return nomes.map(n => ({ n, p: pontos(n) })).filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || a.n.localeCompare(b.n)).slice(0, max).map(x => x.n);
}

