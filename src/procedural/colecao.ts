import colecaoJson from '../../public/colecao/colecao.json' with { type: 'json' };
import { ErroDeValidacao } from '../domain/esquema.ts';
import { CATEGORIAS, funcoesDeComodo, type Categoria } from './receitas/index.ts';
import { TIPOS_DE_COMODO } from '../domain/presets.ts';

/** De onde veio o item: gerado pelo Atlas (com tudo o que é preciso para regenerar) ou achado (com autor, fonte e licença). */
export type OrigemDoItem =
  | { tipo: 'gerado'; gerador: string; params: Record<string, unknown>; seed: number; versao: number }
  | { tipo: 'achado'; autor: string; fonte: string; url: string; licenca: 'CC0-1.0' | 'CC-BY-4.0'; arquivoOriginal: string };

export interface ItemDaColecao {
  /** `casa:<nome>`. */
  id: string; nome: string;
  /** Relativo a `public/colecao/`. */
  arquivo: string;
  categoria: Categoria;
  /** Largura × profundidade (m). A imagem cobre a pegada mais a margem de sombra. */
  pegada: [number, number];
  funcoes: string[]; tags: string[]; generos: string[]; kit: string | null;
  /** Pixels por metro em que a imagem foi assada (padrão 128). */
  res?: number;
  /** Versão Pixel feita à mão (PNG relativo a `public/colecao/`, em escala 1:1 do Pixel a 16 px por célula). Vale mais que a derivada e que a gerada. */
  pixelArquivo?: string;
  origem: OrigemDoItem;
}

export const LICENCAS_ACEITAS = ['CC0-1.0', 'CC-BY-4.0'] as const;
export const RES_DA_COLECAO = 128;
/** Os pixels por célula em que um `pixelArquivo` é desenhado 1:1. */
export const PPC_DO_PIXEL_ARQUIVO = 16;

/**
 * De onde vem o desenho de um item no Pixel: o arquivo manual (reescalado em `nearest`, só por múltiplos inteiros de 16 px por célula) ou a derivação
 * automática (imagem achada ou item gerado). O manual sempre ganha quando cabe.
 */
export function fonteDoPixel(item: Pick<ItemDaColecao, 'pixelArquivo'>, ppc: number): { tipo: 'manual'; arquivo: string; escala: number } | { tipo: 'derivada' } {
  const escala = ppc / PPC_DO_PIXEL_ARQUIVO;
  return item.pixelArquivo && Number.isInteger(escala) && escala >= 1 ? { tipo: 'manual', arquivo: item.pixelArquivo, escala } : { tipo: 'derivada' };
}

const falha = (msg: string, caminho: string): never => { throw new ErroDeValidacao(msg, caminho); };
const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const textos = (v: unknown, caminho: string): string[] => { if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) falha('Deve ser uma lista de textos.', caminho); return v as string[]; };

/** Valida o `colecao.json` inteiro; lança `ErroDeValidacao` no primeiro defeito (asset sem licença não entra). */
export function validarColecao(bruto: unknown): ItemDaColecao[] {
  if (!ehObj(bruto) || bruto.versao !== 1 || !Array.isArray(bruto.itens)) falha('O catálogo deve ser { versao: 1, itens: [...] }.', '');
  const itens = (bruto as { itens: unknown[] }).itens, ids = new Set<string>(), categorias = new Set<string>(CATEGORIAS.map(c => c[0]));
  const funcoes = new Set<string>([...TIPOS_DE_COMODO.map(t => t.funcao), ...funcoesDeComodo()]);
  return itens.map((x, i) => {
    const c = `itens[${i}]`;
    if (!ehObj(x)) return falha('Deve ser um objeto.', c);
    const id = x.id; if (typeof id !== 'string' || !/^casa:[a-z0-9][a-z0-9.-]*$/.test(id)) falha('O id deve começar com “casa:” e usar letras minúsculas, números, ponto e hífen.', `${c}.id`);
    if (ids.has(id as string)) falha(`Id repetido: ${String(id)}.`, `${c}.id`); ids.add(id as string);
    if (typeof x.nome !== 'string' || !x.nome) falha('Falta o nome.', `${c}.nome`);
    if (typeof x.arquivo !== 'string' || !/^[A-Za-z0-9._/-]+\.(webp|png)$/.test(x.arquivo) || x.arquivo.includes('..')) falha('O arquivo deve ser um .webp ou .png relativo a public/colecao/.', `${c}.arquivo`);
    if (typeof x.categoria !== 'string' || !categorias.has(x.categoria)) falha('Categoria desconhecida.', `${c}.categoria`);
    const p = x.pegada; if (!Array.isArray(p) || p.length !== 2 || !p.every(v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 30)) falha('A pegada deve ser [largura, profundidade] em metros, maior que zero.', `${c}.pegada`);
    const fs = textos(x.funcoes, `${c}.funcoes`); for (const f of fs) if (!funcoes.has(f)) falha(`Função de cômodo desconhecida: ${f}.`, `${c}.funcoes`);
    textos(x.tags, `${c}.tags`); textos(x.generos, `${c}.generos`);
    if (x.kit !== null && typeof x.kit !== 'string') falha('O kit é um texto ou nulo.', `${c}.kit`);
    if (x.res !== undefined && !(typeof x.res === 'number' && x.res >= 16 && x.res <= 512)) falha('A resolução deve ficar entre 16 e 512 px/m.', `${c}.res`);
    if (x.pixelArquivo !== undefined && !(typeof x.pixelArquivo === 'string' && /^[A-Za-z0-9._/-]+\.png$/.test(x.pixelArquivo) && !x.pixelArquivo.includes('..'))) falha('O pixelArquivo deve ser um .png relativo a public/colecao/.', `${c}.pixelArquivo`);
    const o = x.origem; if (!ehObj(o)) return falha('Falta a origem.', `${c}.origem`);
    if (o.tipo === 'gerado') {
      if (typeof o.gerador !== 'string' || !ehObj(o.params) || typeof o.seed !== 'number' || typeof o.versao !== 'number') falha('Origem “gerado” incompleta (gerador, params, seed, versao).', `${c}.origem`);
    } else if (o.tipo === 'achado') {
      for (const k of ['autor', 'fonte', 'url', 'arquivoOriginal']) if (typeof o[k] !== 'string' || !(o[k] as string).trim()) falha(`Origem “achado” sem ${k}.`, `${c}.origem.${k}`);
      if (!(LICENCAS_ACEITAS as readonly unknown[]).includes(o.licenca)) falha(`Licença não aceita: só ${LICENCAS_ACEITAS.join(' ou ')} permitem redistribuir.`, `${c}.origem.licenca`);
    } else falha('A origem deve ser “gerado” ou “achado”.', `${c}.origem.tipo`);
    return x as unknown as ItemDaColecao;
  });
}

/** A coleção da casa, validada ao importar. */
export const COLECAO: readonly ItemDaColecao[] = validarColecao(colecaoJson);
