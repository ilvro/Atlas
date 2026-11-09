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

/**
 * 2 → 3 (Fase 4): o clima ganha `weather` e `gridPower`; o mapa ganha `climateAudio` e `customClimates`; a presença deixa a
 * máscara de imagem pelas células em RLE (as máscaras antigas viram células vazias, como as do terreno na 1→2).
 */
const de2para3: Migracao = doc => {
  const d = doc as Record<string, any>;
  if (d.climate && typeof d.climate === 'object') {
    d.climate.weather ??= { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0 };
    d.climate.gridPower ??= true;
  }
  d.climateAudio ??= {}; d.customClimates ??= {};
  for (const p of porValor(d.presence)) { delete p.mask; p.cells ??= []; }
  return d;
};

/** 3 → 4 (Fase 5): o estilo ganha `genre` (o gênero do mapa, para o assistente). */
const de3para4: Migracao = doc => {
  const d = doc as Record<string, any>;
  if (d.style && typeof d.style === 'object') d.style.genre ??= 'investigacao';
  return d;
};

/**
 * 4 → 5 (Fase 7): peças ganham `player` (ninguém era jogador), objetos ganham `interaction: null`, e o explorado passa de imagem a células
 * (como nunca foi escrito como imagem, vira `null`).
 */
const de4para5: Migracao = doc => {
  const d = doc as Record<string, any>;
  for (const t of porValor(d.tokens)) t.player ??= false;
  for (const o of porValor(d.props)) o.interaction ??= null;
  if (d.session && typeof d.session === 'object') d.session.explored = null;
  return d;
};

/**
 * 5 → 6 (Fase 10): camadas de terreno ganham `flow: null`; paredes, `drop: null`; luzes, `rays: false`; o acabamento (e o de cada
 * clima salvo) ganha `edges` sem borda e `glow` 0. Só acrescenta, com padrões neutros.
 */
const de5para6: Migracao = doc => {
  const d = doc as Record<string, any>;
  if (d.terrain && typeof d.terrain === 'object') for (const c of porValor(d.terrain.layers)) c.flow ??= null;
  for (const p of porValor(d.walls)) p.drop ??= null;
  for (const l of porValor(d.lights)) l.rays ??= false;
  const acabamento = (f: unknown) => { if (f && typeof f === 'object') { const x = f as Record<string, unknown>; x.edges ??= { kind: 'none', amount: 0 }; x.glow ??= 0; } };
  acabamento(d.finish);
  for (const c of porValor(d.customClimates)) acabamento(c.finish);
  return d;
};

/**
 * 6 → 7 (Fase 11): a grade ganha personalização visual e desacoplamento do encaixe:
 * `snap: true`, `lineStyle: 'solid'`, `color: 'auto'`, `opacity: 0.5`, `lineWidth: 1`.
 */
const de6para7: Migracao = doc => {
  const d = doc as Record<string, any>;
  if (d.grid && typeof d.grid === 'object') {
    d.grid.snap ??= true;
    d.grid.lineStyle ??= 'solid';
    d.grid.color ??= 'auto';
    d.grid.opacity ??= 0.1;
    d.grid.lineWidth ??= 1;
  }
  return d;
};

/**
 * 7 → 8 (Fase 13): momentos no mapa (`moments: {}`).
 */
const de7para8: Migracao = doc => {
  const d = doc as Record<string, any>;
  d.moments ??= {};
  return d;
};

export const MIGRACOES: TabelaDeMigracoes = { 1: de1para2, 2: de2para3, 3: de3para4, 4: de4para5, 5: de5para6, 6: de6para7, 7: de7para8 };

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
