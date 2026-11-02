import { ErroDeValidacao } from './esquema.ts';
import { SCHEMA_MAPA, VERSAO_MAPA, type MapaAtlas } from './mapa.ts';
import { validarMapa } from './validacao.ts';

/** Cada migração leva a versão N para a N+1 e devolve um objeto novo. Nunca mexe no recebido. */
export type Migracao = (doc: Record<string, unknown>) => Record<string, unknown>;
export type TabelaDeMigracoes = Readonly<Record<number, Migracao>>;

type Objetos = Record<string, Record<string, unknown>>;
const porValor = (o: unknown): Record<string, unknown>[] => (o && typeof o === 'object' ? Object.values(o as Objetos) : []);

/**
 * 1 → 2 (Fase 3): as camadas de terreno passam de máscara de imagem para células em RLE; o terreno base padrão deixa
 * de ser 'terra' (o fundo do mapa aparece); luzes ganham `preset`; portas ganham `swing`; o acabamento ganha `tint`.
 */
const de1para2: Migracao = doc => {
  const d = doc as Record<string, any>;
  const terreno = d.terrain as { base?: unknown; layers?: unknown } | undefined;
  if (terreno && typeof terreno === 'object') {
    for (const camada of porValor(terreno.layers)) { delete camada.mask; camada.cells ??= []; }
    if (terreno.base === 'terra' && !Object.keys((terreno.layers as object) ?? {}).length) terreno.base = 'vazio';
  }
  if (d.finish && typeof d.finish === 'object') d.finish.tint ??= '#ffffff';
  for (const luz of porValor(d.lights)) luz.preset ??= null;
  for (const a of porValor(d.openings)) a.swing ??= 'a';
  return d;
};

export const MIGRACOES: TabelaDeMigracoes = { 1: de1para2 };

/** Aplica a cadeia de migrações até `alvo`. Separada para ser testada com tabelas de mentira. */
export function aplicarMigracoes(bruto: unknown, tabela: TabelaDeMigracoes, alvo: number): Record<string, unknown> {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new ErroDeValidacao('O arquivo não é um mapa do Atlas.', '');
  let doc = structuredClone(bruto) as Record<string, unknown>;
  if (doc.schema !== SCHEMA_MAPA) throw new ErroDeValidacao(`Esperado “${SCHEMA_MAPA}”.`, 'schema');
  const versao = doc.version;
  if (typeof versao !== 'number' || !Number.isInteger(versao) || versao < 1) throw new ErroDeValidacao('Versão inválida.', 'version');
  if (versao > alvo) throw new ErroDeValidacao(`Este mapa é da versão ${versao}, mais nova que a ${alvo} que este Atlas entende. Atualize o Atlas.`, 'version');
  for (let v = versao; v < alvo; v++) {
    const passo = tabela[v];
    if (!passo) throw new ErroDeValidacao(`Não há migração da versão ${v} para a ${v + 1}.`, 'version');
    doc = passo(doc);
    doc.version = v + 1;
  }
  return doc;
}

/** Porta de entrada de qualquer mapa vindo de fora (arquivo, banco, outra aba): migra e valida. */
export function lerMapa(bruto: unknown): MapaAtlas {
  const doc = aplicarMigracoes(bruto, MIGRACOES, VERSAO_MAPA);
  validarMapa(doc);
  return doc;
}
