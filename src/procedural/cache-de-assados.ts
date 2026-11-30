import { abrirBanco, promessa, transacao } from '#mesa';
import type { PedidoDeBake, ResultadoDeBake } from './executar.ts';

export const NOME_BANCO_ASSADOS = 'atlas-assados-v1';
export const VERSAO_BANCO_ASSADOS = 1;
export const STORE_ASSADOS = 'assados';
export const LIMITE_CACHE_ASSADOS_BYTES = 400 * 1024 * 1024;

export interface RegistroAssado {
  chaveHash: string;
  cor: Blob;
  altura: Blob | null;
  agua: { blob: Blob; res: number; origem?: [number, number] } | null;
  normal?: Blob | null;
  fachada?: Blob | null;
  origem: [number, number];
  res: number;
  bytes: number;
  usadoEm: number;
}

export interface ResultadoComExtras extends ResultadoDeBake {
  normal?: ImageBitmap | null;
  fachada?: ImageBitmap | null;
}

export interface EntradaBrutaAssado {
  cor: Blob;
  altura: Blob | null;
  agua: { blob: Blob; res: number; origem?: [number, number] } | null;
  normal?: Blob | null;
  fachada?: Blob | null;
  origem: [number, number];
  res: number;
}

export interface OpcoesCacheDeAssados {
  nomeBanco?: string;
  versao?: string;
  limiteBytes?: number;
  idb?: IDBFactory;
  agora?: () => number;
  decodificar?: (blob: Blob) => Promise<ImageBitmap>;
  codificar?: (bmp: ImageBitmap) => Promise<Blob>;
}

export interface CacheDeAssados {
  readonly versao: string;
  obter(chave: string): Promise<ResultadoComExtras | null>;
  gravar(chave: string, resultado: ResultadoComExtras): Promise<void>;
  obterBruto(chave: string): Promise<RegistroAssado | null>;
  gravarBruto(chave: string, bruto: EntradaBrutaAssado): Promise<void>;
  fechar(): void;
}

export function versaoDosPintores(): string {
  return typeof __VERSAO_DOS_PINTORES__ !== 'undefined' ? __VERSAO_DOS_PINTORES__ : 'dev';
}

export function cachePersistenteAtivo(
  dev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV),
  search = typeof globalThis.location !== 'undefined' ? globalThis.location.search : '',
  hash = typeof globalThis.location !== 'undefined' ? globalThis.location.hash : '',
): boolean {
  if (!dev) return true;
  try {
    if (new URLSearchParams(search).get('cache') === '1') return true;
    const idx = hash.indexOf('?');
    return idx >= 0 && new URLSearchParams(hash.slice(idx + 1)).get('cache') === '1';
  } catch {
    return false;
  }
}

export function pedidoCacheavel(pedido: PedidoDeBake): boolean {
  if (pedido.tipo === 'sprite') return false;
  if (pedido.tipo === 'imagem' && pedido.pixelManual) return false;
  if ('semCache' in pedido && pedido.semCache === true) return false;
  // Imagem da coleção já pronta: o cache HTTP do navegador basta, sem re-codificar em PNG.
  if (pedido.tipo === 'imagem' && !pedido.harmonizar && pedido.estilo !== 'pixel') return false;
  return true;
}

export function sha1Fallback(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  const n = bytes.length;
  const total = (((n + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[n] = 0x80;
  const bits = n * 8;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(bits / 0x100000000), false);
  view.setUint32(total - 4, bits >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (v: number, s: number) => (v << s) | (v >>> (32 - s));

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const temp = (rotl(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(v => v.toString(16).padStart(8, '0')).join('');
}

export async function hashChave(versao: string, chave: string): Promise<string> {
  const texto = `${versao}|${chave}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-1', new TextEncoder().encode(texto));
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Contextos sem crypto.subtle usam SHA-1 puro determinístico.
    }
  }
  return sha1Fallback(texto);
}

export async function bitmapParaPng(bmp: ImageBitmap): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const tela = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error('Sem contexto 2D para codificar PNG.');
    ctx.drawImage(bmp, 0, 0);
    return tela.convertToBlob({ type: 'image/png' });
  }
  if (typeof document !== 'undefined') {
    const tela = document.createElement('canvas');
    tela.width = bmp.width;
    tela.height = bmp.height;
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error('Sem contexto 2D para codificar PNG.');
    ctx.drawImage(bmp, 0, 0);
    return new Promise<Blob>((resolver, rejeitar) => {
      tela.toBlob(b => (b ? resolver(b) : rejeitar(new Error('Falha ao gerar PNG.'))), 'image/png');
    });
  }
  throw new Error('Sem Canvas para codificar PNG.');
}

function percorrerIndiceUsadoEm(store: IDBObjectStore, aoItem: (reg: RegistroAssado) => void): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const origem = store.indexNames.contains('usadoEm') ? store.index('usadoEm') : store;
    const pedido = origem.openCursor();
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor) { resolver(); return; }
      aoItem(cursor.value as RegistroAssado);
      cursor.continue();
    };
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('Falha ao percorrer cache.'));
  });
}

const GRAVACOES_ENTRE_VARREDURAS = 64;

export function criarCacheDeAssados(opcoes: OpcoesCacheDeAssados = {}): CacheDeAssados {
  const nomeBanco = opcoes.nomeBanco ?? NOME_BANCO_ASSADOS;
  const versao = opcoes.versao ?? versaoDosPintores();
  const limiteBytes = opcoes.limiteBytes ?? LIMITE_CACHE_ASSADOS_BYTES;
  const idb = opcoes.idb ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
  const agora = opcoes.agora ?? Date.now;
  const decodificar = opcoes.decodificar ?? (blob => createImageBitmap(blob));
  const codificar = opcoes.codificar ?? bitmapParaPng;

  let bancoPromise: Promise<IDBDatabase> | null = null;
  let bancoAberto: IDBDatabase | null = null;
  let fechando = false;
  // Soma dos bytes gravados, mantida em memória; null até a primeira gravação varrer o índice.
  let totalBytesEstimado: number | null = null;
  let gravacoesDesdeVarredura = 0;
  let gravacoesEmSerie: Promise<void> = Promise.resolve();
  const toquesPendentes = new Map<string, number>();
  let flushAgendado: Promise<void> | null = null;
  let flushEmCurso: Promise<void> = Promise.resolve();

  function agendarToque(chaveHash: string, tocado: number): Promise<void> {
    toquesPendentes.set(chaveHash, tocado);
    if (!flushAgendado) {
      flushAgendado = Promise.resolve().then(() => {
        flushAgendado = null;
        if (toquesPendentes.size === 0 || fechando) return flushEmCurso;
        const lote = new Map(toquesPendentes);
        toquesPendentes.clear();
        flushEmCurso = flushEmCurso.then(async () => {
          try {
            const banco = await abrir();
            if (!banco) return;
            await transacao(banco, [STORE_ASSADOS], 'readwrite', async tx => {
              const store = tx.objectStore(STORE_ASSADOS);
              await Promise.all(
                [...lote.entries()].map(async ([k, ts]) => {
                  const atual = (await promessa(store.get(k))) as RegistroAssado | undefined;
                  if (atual) {
                    atual.usadoEm = ts;
                    await promessa(store.put(atual));
                  }
                }),
              );
            });
          } catch {
            // Falha silenciosa ao atualizar usadoEm.
          }
        });
        return flushEmCurso;
      });
    }
    return flushAgendado;
  }

  async function esperarToques(): Promise<void> {
    if (flushAgendado) await flushAgendado;
    await flushEmCurso;
  }

  async function abrir(): Promise<IDBDatabase | null> {
    if (fechando || !idb) return null;
    if (bancoAberto) return bancoAberto;
    if (!bancoPromise) {
      bancoPromise = abrirBanco(
        nomeBanco,
        VERSAO_BANCO_ASSADOS,
        [{ nome: STORE_ASSADOS, chave: 'chaveHash', indices: [{ nome: 'usadoEm', caminho: 'usadoEm' }] }],
        idb,
      ).then(b => {
        bancoAberto = b;
        b.onversionchange = () => {
          b.close();
          bancoAberto = null;
          bancoPromise = null;
          totalBytesEstimado = null;
        };
        b.onclose = () => {
          bancoAberto = null;
          bancoPromise = null;
          totalBytesEstimado = null;
        };
        return b;
      });
    }
    try {
      return await bancoPromise;
    } catch {
      bancoPromise = null;
      bancoAberto = null;
      return null;
    }
  }

  async function lerRegistro(chave: string): Promise<{ reg: RegistroAssado; toque: Promise<void> } | null> {
    try {
      const banco = await abrir();
      if (!banco) return null;
      const chaveHash = await hashChave(versao, chave);
      const reg = await transacao(banco, [STORE_ASSADOS], 'readonly', tx =>
        promessa(tx.objectStore(STORE_ASSADOS).get(chaveHash)) as Promise<RegistroAssado | undefined>,
      );
      if (!reg) return null;
      const tocado = agora();
      const toque = agendarToque(chaveHash, tocado);
      return { reg: { ...reg, usadoEm: tocado }, toque };
    } catch {
      return null;
    }
  }

  async function obterBruto(chave: string): Promise<RegistroAssado | null> {
    const achado = await lerRegistro(chave);
    if (!achado) return null;
    await achado.toque;
    return achado.reg;
  }

  async function obter(chave: string): Promise<ResultadoComExtras | null> {
    const achado = await lerRegistro(chave);
    if (!achado) return null;
    const { reg } = achado;
    const abertos: ImageBitmap[] = [];
    const dec = async (blob: Blob): Promise<ImageBitmap> => {
      const bmp = await decodificar(blob);
      abertos.push(bmp);
      return bmp;
    };
    try {
      const [bitmap, altura, aguaBitmap, normal, fachada] = await Promise.all([
        dec(reg.cor),
        reg.altura ? dec(reg.altura) : Promise.resolve(null),
        reg.agua ? dec(reg.agua.blob) : Promise.resolve(undefined),
        reg.normal ? dec(reg.normal) : Promise.resolve(undefined),
        reg.fachada ? dec(reg.fachada) : Promise.resolve(undefined),
      ]);
      return {
        bitmap,
        altura,
        origem: reg.origem,
        res: reg.res,
        ...(reg.agua && aguaBitmap ? { agua: { bitmap: aguaBitmap, res: reg.agua.res, ...(reg.agua.origem ? { origem: reg.agua.origem } : {}) } } : {}),
        ...(normal ? { normal } : {}),
        ...(fachada ? { fachada } : {}),
      };
    } catch {
      for (const bmp of abertos) bmp.close?.();
      return null;
    }
  }

  async function gravarBruto(chave: string, bruto: EntradaBrutaAssado): Promise<void> {
    try {
      await esperarToques();
      const banco = await abrir();
      if (!banco) return;
      const bytes =
        bruto.cor.size +
        (bruto.altura?.size ?? 0) +
        (bruto.agua?.blob.size ?? 0) +
        (bruto.normal?.size ?? 0) +
        (bruto.fachada?.size ?? 0);
      if (bytes > limiteBytes) return;

      const chaveHash = await hashChave(versao, chave);
      const registro: RegistroAssado = {
        chaveHash,
        cor: bruto.cor,
        altura: bruto.altura,
        agua: bruto.agua,
        ...(bruto.normal !== undefined ? { normal: bruto.normal } : {}),
        ...(bruto.fachada !== undefined ? { fachada: bruto.fachada } : {}),
        origem: bruto.origem,
        res: bruto.res,
        bytes,
        usadoEm: agora(),
      };

      // Gravações em série: o total em memória só vale se uma gravação termina antes da próxima ler.
      const turno = gravacoesEmSerie.then(async () => {
        try {
          await transacao(banco, [STORE_ASSADOS], 'readwrite', async tx => {
            const store = tx.objectStore(STORE_ASSADOS);
            const existente = (await promessa(store.get(chaveHash))) as RegistroAssado | undefined;
            const bytesExistente = existente?.bytes ?? 0;
            // O total só é varrido uma vez por conexão; depois é mantido em memória.
            // A cada tantas gravações recalcula, para absorver o que outra aba gravou ou apagou.
            if (totalBytesEstimado === null || ++gravacoesDesdeVarredura > GRAVACOES_ENTRE_VARREDURAS) {
              gravacoesDesdeVarredura = 0;
              let soma = 0;
              await percorrerIndiceUsadoEm(store, reg => { soma += reg.bytes; });
              totalBytesEstimado = soma;
            }
            let novoTotal = totalBytesEstimado - bytesExistente + bytes;
            if (novoTotal > limiteBytes) {
              // Só então vale o custo de varrer o índice para escolher as vítimas (LRU).
              const entradas: { chaveHash: string; bytes: number; usadoEm: number }[] = [];
              let total = 0;
              await percorrerIndiceUsadoEm(store, reg => {
                if (reg.chaveHash === chaveHash) return;
                entradas.push({ chaveHash: reg.chaveHash, bytes: reg.bytes, usadoEm: reg.usadoEm });
                total += reg.bytes;
              });
              if (!store.indexNames.contains('usadoEm')) {
                entradas.sort((a, b) => a.usadoEm - b.usadoEm);
              }
              const apagar: string[] = [];
              for (let i = 0; i < entradas.length && total + bytes > limiteBytes; i++) {
                const vitima = entradas[i]!;
                apagar.push(vitima.chaveHash);
                total -= vitima.bytes;
              }
              if (apagar.length > 0) {
                await Promise.all(apagar.map(k => promessa(store.delete(k))));
              }
              novoTotal = total + bytes;
            }
            await promessa(store.put(registro));
            totalBytesEstimado = novoTotal;
          });
        } catch (e) {
          totalBytesEstimado = null;
          throw e;
        }
      });
      gravacoesEmSerie = turno.catch(() => undefined);
      await turno;
    } catch {
      // Falha silenciosa (aba privada, cota excedida, erro de transação, indisponibilidade).
    }
  }

  async function gravar(chave: string, resultado: ResultadoComExtras): Promise<void> {
    try {
      const banco = await abrir();
      if (!banco) return;
      const [cor, altura, aguaBlob, normal, fachada] = await Promise.all([
        codificar(resultado.bitmap),
        resultado.altura ? codificar(resultado.altura) : Promise.resolve(null),
        resultado.agua ? codificar(resultado.agua.bitmap) : Promise.resolve(undefined),
        resultado.normal ? codificar(resultado.normal) : Promise.resolve(undefined),
        resultado.fachada ? codificar(resultado.fachada) : Promise.resolve(undefined),
      ]);
      await gravarBruto(chave, {
        cor,
        altura,
        agua: resultado.agua && aguaBlob ? { blob: aguaBlob, res: resultado.agua.res, ...(resultado.agua.origem ? { origem: resultado.agua.origem } : {}) } : null,
        ...(normal !== undefined ? { normal } : {}),
        ...(fachada !== undefined ? { fachada } : {}),
        origem: resultado.origem,
        res: resultado.res,
      });
    } catch {
      // Falha silenciosa.
    }
  }

  function fechar(): void {
    fechando = true;
    toquesPendentes.clear();
    if (bancoAberto) {
      bancoAberto.close();
      bancoAberto = null;
    }
    bancoPromise = null;
    totalBytesEstimado = null;
  }

  return { versao, obter, gravar, obterBruto, gravarBruto, fechar };
}

let padrao: CacheDeAssados | null = null;
export function cacheDeAssadosPadrao(): CacheDeAssados {
  return (padrao ??= criarCacheDeAssados());
}
