// Texturas de terreno já decodificadas, para o pintor (síncrono) só ler pixels. Cada contexto (página, worker) tem a sua cópia do módulo.
// O hash do catálogo vem daqui: `chaveDoTerreno` lê `hashDasTexturas()`, que fica vazio até o catálogo ser lido. A página lê o catálogo
// quando a cena precisa (ver `sincronizarTerreno`), então a chave só vale depois disso; o worker não calcula chaves, só carrega.
import type { EntradaDeTerreno } from './assar.ts';
import { materialDe } from './materiais.ts';
import { validarCatalogo, type CatalogoDeTexturas } from './texturas.ts';
import type { Pixels } from './textura-de-terreno.ts';

/** Base das texturas da coleção, respeitando subcaminhos (Discord Activity `/.proxy/Atlas/`, GitHub Pages). Fora do navegador (testes sem `location`), devolve `/colecao/texturas/`. */
export function baseDasTexturas(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  if (typeof location === 'undefined') return `${base ?? '/'}colecao/texturas/`;
  return new URL(`${base ?? './'}colecao/texturas/`, location.href).href;
}

const carregadas = new Map<string, Pixels>(), deslocamentos = new Map<string, Pixels>(), metros = new Map<string, number>();
const pendentes = new Map<string, Promise<void>>();
let catalogo: CatalogoDeTexturas | null = null, promessaDoCatalogo: Promise<CatalogoDeTexturas | null> | null = null, hash = '';

/** Os ids de textura de um material (só o que o Ilustrado pinta). Material desconhecido não lança. */
function idsDoMaterial(id: string): string[] {
  try { return materialDe(id).textura?.camadas.map(c => c.textura) ?? []; } catch { return []; }
}

/** Os ids de textura que o terreno usa (base e camadas), sem repetição, na ordem em que aparecem. Pura. */
export function texturasDoTerreno(e: EntradaDeTerreno): string[] {
  const ids = new Set<string>();
  for (const m of [e.base, ...e.camadas.map(c => c.material)]) for (const t of idsDoMaterial(m)) ids.add(t);
  return [...ids];
}

/** A entrada usa algum material com textura? */
export const usaTextura = (e: EntradaDeTerreno): boolean => texturasDoTerreno(e).length > 0;

/** O hash do catálogo lido, ou '' se ainda não foi lido (ou falhou). Síncrona. */
export const hashDasTexturas = (): string => hash;

/** O catálogo já foi tentado (com sucesso ou não)? */
export const catalogoLido = (): boolean => promessaDoCatalogo !== null && (catalogo !== null || hash === 'indisponivel');

/** Busca o catálogo uma vez. Falha de rede ou de formato só avisa no console e devolve `null` (hash 'indisponivel'). */
export function carregarCatalogo(base = baseDasTexturas()): Promise<CatalogoDeTexturas | null> {
  promessaDoCatalogo ??= (async () => {
    try {
      const r = await fetch(`${base}texturas.json`);
      if (!r.ok) throw new Error(`${r.status}`);
      catalogo = validarCatalogo(await r.json()); hash = catalogo.hash;
    } catch (erro) { console.warn('Atlas: não consegui ler o catálogo de texturas', erro); hash = 'indisponivel'; }
    return catalogo;
  })();
  return promessaDoCatalogo;
}

async function carregarUma(url: string): Promise<Pixels> {
  const r = await fetch(url); if (!r.ok) throw new Error(`${url} (${r.status})`);
  const img = await createImageBitmap(await r.blob());
  const tela = new OffscreenCanvas(img.width, img.height), ctx = tela.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('sem contexto 2d');
  ctx.drawImage(img, 0, 0); img.close();
  const d = ctx.getImageData(0, 0, tela.width, tela.height);
  return { dados: d.data, largura: d.width, altura: d.height };
}

/** Carrega as texturas pedidas (se faltam). Nunca rejeita: falha só avisa no console e o pintor cai no `padrao`. */
export async function garantirTexturas(ids: readonly string[], base = baseDasTexturas()): Promise<void> {
  const faltam = ids.filter(id => !carregadas.has(id));
  if (!faltam.length) return;
  try {
    const cat = await carregarCatalogo(base);
    if (!cat) return;
    await Promise.all(faltam.map(id => {
      const t = cat.texturas.find(x => x.id === id);
      if (!t) { console.warn(`Atlas: textura desconhecida ${id}`); return undefined; }
      let p = pendentes.get(id);
      if (!p) {
        // O deslocamento é opcional: sem ele o relevo da textura fica plano.
        const alt = t.deslocamento ? carregarUma(`${base}${t.deslocamento}`).catch(() => undefined) : Promise.resolve(undefined);
        p = Promise.all([carregarUma(`${base}${t.arquivo}`), alt]).then(([px, d]) => { metros.set(id, t.metros); if (d) deslocamentos.set(id, d); carregadas.set(id, px); })
          .catch(erro => { console.warn(`Atlas: não consegui carregar a textura ${id}`, erro); })
          .finally(() => { pendentes.delete(id); });
        pendentes.set(id, p);
      }
      return p;
    }));
  } catch (erro) { console.warn('Atlas: falha ao carregar texturas', erro); }
}

/** Os pixels de uma textura já carregada, ou `undefined`. Síncrona. */
export const texturaCarregada = (id: string): Pixels | undefined => carregadas.get(id);

/** A textura pronta para o pintor: a cor, o deslocamento (se houver) e o tamanho real do ladrilho (m). Síncrona. */
export function texturaPronta(id: string): { cor: Pixels; alt?: Pixels; metros: number } | undefined {
  const cor = carregadas.get(id), m = metros.get(id);
  return cor && m ? { cor, alt: deslocamentos.get(id), metros: m } : undefined;
}

/** Só para testes: esquece tudo. */
export function _reiniciarTexturas(): void { carregadas.clear(); deslocamentos.clear(); metros.clear(); pendentes.clear(); catalogo = null; promessaDoCatalogo = null; hash = ''; }
/** Só para testes: define o hash sem rede. */
export function _definirHashDasTexturas(h: string): void { hash = h; }
