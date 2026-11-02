import { ErroDeValidacao } from './esquema.ts';
import { SCHEMA_MAPA, VERSAO_MAPA, type MapaAtlas } from './mapa.ts';
import { validarMapa } from './validacao.ts';

/** Cada migração leva a versão N para a N+1 e devolve um objeto novo. Nunca mexe no recebido. */
export type Migracao = (doc: Record<string, unknown>) => Record<string, unknown>;
export type TabelaDeMigracoes = Readonly<Record<number, Migracao>>;

/** Hoje só existe a versão 1; quando o formato mudar, a migração 1→2 entra aqui. */
export const MIGRACOES: TabelaDeMigracoes = {};

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
