import { assetsDoMapa } from '../domain/assets.ts';
import { duplicarParaNovaSessao, type MapaAtlas } from '../domain/mapa.ts';
import { lerMapa } from '../domain/migracoes.ts';
import { SCHEMA_MAPA } from '../domain/mapa.ts';
import type { Asset, RepositorioMapas } from './repositorio.ts';

export const FORMATO_BACKUP = 'atlas.backup';
export const VERSAO_BACKUP = 1;

export interface AssetEmbutido { id: string; hash: string; tipo: string; base64: string; criadoEm: number }
export interface PacoteBackup { formato: typeof FORMATO_BACKUP; versao: number; criadoEm: number; mapas: unknown[]; assets: AssetEmbutido[] }

export async function paraBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

export function deBase64(base64: string, tipo: string): Blob {
  const texto = atob(base64), bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/**
 * Sem `ids`, é a cópia de segurança completa (todos os mapas e todos os assets). Com `ids`, só esses mapas
 * e os assets que eles usam — o formato é o mesmo, então um mapa avulso também se importa.
 */
export async function exportarBackup(repo: RepositorioMapas, opcoes: { ids?: string[]; agora?: () => number } = {}): Promise<PacoteBackup> {
  const ids = opcoes.ids ?? (await repo.listar()).filter(r => !r.erro).map(r => r.id);
  const mapas: MapaAtlas[] = [];
  for (const id of ids) { const m = await repo.obter(id); if (m) mapas.push(m); }
  const usados = opcoes.ids ? new Set(mapas.flatMap(m => assetsDoMapa(m).map(a => a.id))) : null;
  const assets: AssetEmbutido[] = [];
  for (const a of await repo.listarAssets()) if (!usados || usados.has(a.id)) assets.push({ id: a.id, hash: a.hash, tipo: a.tipo, base64: await paraBase64(a.blob), criadoEm: a.criadoEm });
  return { formato: FORMATO_BACKUP, versao: VERSAO_BACKUP, criadoEm: (opcoes.agora ?? Date.now)(), mapas, assets };
}

export class ErroDeBackup extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = 'ErroDeBackup'; }
}

/** Lê o texto de um arquivo: um backup completo, ou um mapa avulso (`atlas.map`), que vira um pacote de um mapa. */
export function lerPacote(texto: string): PacoteBackup {
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { throw new ErroDeBackup('O arquivo não é um JSON válido.'); }
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new ErroDeBackup('O arquivo não é um backup do Atlas.');
  const o = bruto as Record<string, unknown>;
  if (o.schema === SCHEMA_MAPA) return { formato: FORMATO_BACKUP, versao: VERSAO_BACKUP, criadoEm: Date.now(), mapas: [o], assets: [] };
  if (o.formato !== FORMATO_BACKUP) throw new ErroDeBackup('O arquivo não é um backup do Atlas.');
  if (typeof o.versao !== 'number' || o.versao > VERSAO_BACKUP) throw new ErroDeBackup(`Backup da versão ${String(o.versao)}; este Atlas entende até a ${VERSAO_BACKUP}. Atualize o Atlas.`);
  if (!Array.isArray(o.mapas) || !Array.isArray(o.assets)) throw new ErroDeBackup('Backup incompleto: faltam as listas de mapas e assets.');
  return o as unknown as PacoteBackup;
}

export type Conflito = 'copia' | 'substituir' | 'pular';
export interface RelatorioImportacao {
  importados: { id: string; nome: string; comoCopia: boolean; substituiu: boolean }[];
  pulados: { id: string; nome: string; motivo: string }[];
  erros: { posicao: number; nome: string | null; motivo: string }[];
  assets: number;
}

/**
 * Importa mapa por mapa: um mapa ruim não derruba os outros. Num id repetido, `copia` guarda os dois,
 * `substituir` troca o do banco (e sobe a revisão para outras abas notarem) e `pular` não mexe.
 */
export async function importarBackup(repo: RepositorioMapas, pacote: PacoteBackup, opcoes: { conflito?: Conflito; novoId?: () => string; agora?: () => number } = {}): Promise<RelatorioImportacao> {
  const conflito = opcoes.conflito ?? 'copia', agora = opcoes.agora ?? Date.now;
  const relatorio: RelatorioImportacao = { importados: [], pulados: [], erros: [], assets: 0 };

  for (const [i, a] of pacote.assets.entries()) {
    try {
      await repo.restaurarAsset({ id: a.id, hash: a.hash, tipo: a.tipo, blob: deBase64(a.base64, a.tipo), criadoEm: a.criadoEm } satisfies Asset);
      relatorio.assets++;
    } catch (erro) { relatorio.erros.push({ posicao: i, nome: `asset ${a.id}`, motivo: erro instanceof Error ? erro.message : String(erro) }); }
  }

  for (const [i, bruto] of pacote.mapas.entries()) {
    const nomeBruto = bruto && typeof bruto === 'object' && typeof (bruto as { name?: unknown }).name === 'string' ? (bruto as { name: string }).name : null;
    let mapa: MapaAtlas;
    try { mapa = lerMapa(bruto); } catch (erro) { relatorio.erros.push({ posicao: i, nome: nomeBruto, motivo: erro instanceof Error ? erro.message : String(erro) }); continue; }
    const existente = await repo.obter(mapa.id);
    if (!existente) { await repo.restaurar(mapa); relatorio.importados.push({ id: mapa.id, nome: mapa.name, comoCopia: false, substituiu: false }); continue; }
    if (conflito === 'pular') { relatorio.pulados.push({ id: mapa.id, nome: mapa.name, motivo: 'Já existe um mapa com este identificador.' }); continue; }
    if (conflito === 'substituir') {
      await repo.restaurar({ ...mapa, revision: existente.revision + 1, updatedAt: agora() });
      relatorio.importados.push({ id: mapa.id, nome: mapa.name, comoCopia: false, substituiu: true }); continue;
    }
    // Copia: é uma cópia fiel (com o que aconteceu na sessão), só com identidade nova.
    const copia = { ...duplicarParaNovaSessao(mapa, { ...(opcoes.novoId ? { id: opcoes.novoId() } : {}), agora: agora(), nome: `${mapa.name} (importado)` }), session: mapa.session };
    await repo.restaurar(copia);
    relatorio.importados.push({ id: copia.id, nome: copia.name, comoCopia: true, substituiu: false });
  }
  return relatorio;
}

export function nomeDoArquivo(nome: string, agora = new Date()): string {
  const limpo = nome.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'mapa';
  return `${limpo}-${agora.toISOString().slice(0, 10)}.atlas.json`;
}
