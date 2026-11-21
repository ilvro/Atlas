/**
 * Prepara as texturas de chão aprovadas (scripts/texturas-aprovadas.json): lê os originais em data-private/texturas-fonte/<pasta>/,
 * reduz cada um a 128 px/m (lado = round(metros × 128)), confere que continua em ladrilho e grava WebP em public/colecao/texturas/
 * (<id>.webp e <id>-alt.webp, o deslocamento em tons de cinza), mais texturas.json (hash = SHA-1 dos arquivos) e as linhas de docs/LICENCAS.md.
 * Usa o Chromium do Playwright como canvas (o Node não tem), sem precisar do Vite.
 *   npm run texturas
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { validarCatalogo, type CatalogoDeTexturas, type TexturaDoCatalogo } from '../src/procedural/texturas.ts';

const AQUI = import.meta.dirname, FONTE = join(AQUI, '../data-private/texturas-fonte'), SAIDA = join(AQUI, '../public/colecao/texturas'), LICENCAS = join(AQUI, '../docs/LICENCAS.md');
const PX_POR_METRO = 128, FATOR_DA_BORDA = 3;

interface Aprovada { id: string; pasta: string; fonte: string; autor: string; metros: number; estimado?: boolean; url: string; licenca: 'CC0' }
const aprovadas = JSON.parse(readFileSync(join(AQUI, 'texturas-aprovadas.json'), 'utf8')) as Aprovada[];

/** Acha o arquivo de cor e o de deslocamento na pasta: Poly Haven (cor.jpg, alt.jpg) ou ambientCG (*_Color.jpg, *_Displacement.jpg). */
function arquivosDaPasta(a: Aprovada): { cor: string; alt: string | null } {
  const dir = join(FONTE, a.pasta), nomes = existsSync(dir) ? readdirSync(dir) : [];
  const cor = nomes.find(n => n === 'cor.jpg' || /_Color\.jpg$/.test(n)), alt = nomes.find(n => n === 'alt.jpg' || /_Displacement\.jpg$/.test(n));
  if (!cor) throw new Error(`${a.id}: falta a cor em ${dir}`);
  return { cor: join(dir, cor), alt: alt ? join(dir, alt) : null };
}

const navegador = await chromium.launch();
const catalogo: TexturaDoCatalogo[] = [], hash = createHash('sha1'), linhas: string[] = [], relatorio: string[] = [];
mkdirSync(SAIDA, { recursive: true });
try {
  const pagina = await navegador.newPage();
  await pagina.goto('about:blank');
  // No navegador: decodifica, reduz em passos de metade (sem serrilhado), opcionalmente em tons de cinza, mede a emenda e devolve o WebP.
  const preparar = (b64: string, lado: number, cinza: boolean) => pagina.evaluate(async ([dados, l, g]) => {
    const img = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${dados}`)).blob());
    let fonte: CanvasImageSource = img, w = img.width;
    while (w / 2 > (l as number)) { w = Math.round(w / 2); const c = document.createElement('canvas'); c.width = c.height = w; const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(fonte, 0, 0, w, w); fonte = c; }
    const c = document.createElement('canvas'); c.width = c.height = l as number; const x = c.getContext('2d', { willReadFrequently: true })!; x.imageSmoothingQuality = 'high'; x.drawImage(fonte, 0, 0, l as number, l as number);
    const d = x.getImageData(0, 0, l as number, l as number), p = d.data, n = l as number;
    if (g) for (let i = 0; i < p.length; i += 4) { const v = Math.round(0.2126 * p[i]! + 0.7152 * p[i + 1]! + 0.0722 * p[i + 2]!); p[i] = p[i + 1] = p[i + 2] = v; }
    x.putImageData(d, 0, 0);
    // Emenda: diferença média entre a última e a primeira coluna (linha) contra a diferença média entre vizinhas.
    const lum = (i: number) => 0.2126 * p[i]! + 0.7152 * p[i + 1]! + 0.0722 * p[i + 2]!;
    let bx = 0, vx = 0, by = 0, vy = 0;
    for (let y = 0; y < n; y++) { bx += Math.abs(lum((y * n + n - 1) * 4) - lum(y * n * 4)); for (let k = 0; k < n - 1; k++) vx += Math.abs(lum((y * n + k) * 4) - lum((y * n + k + 1) * 4)); }
    for (let k = 0; k < n; k++) { by += Math.abs(lum(((n - 1) * n + k) * 4) - lum(k * 4)); for (let y = 0; y < n - 1; y++) vy += Math.abs(lum((y * n + k) * 4) - lum(((y + 1) * n + k) * 4)); }
    const emendaX = (bx / n) / (vx / (n * (n - 1)) || 1), emendaY = (by / n) / (vy / (n * (n - 1)) || 1);
    const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/webp', 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), emendaX, emendaY };
  }, [b64, lado, cinza] as const);

  for (const a of aprovadas.slice().sort((p, q) => p.id.localeCompare(q.id))) {
    const { cor, alt } = arquivosDaPasta(a), lado = Math.round(a.metros * PX_POR_METRO);
    const saidas: [string, string, boolean][] = [[cor, `${a.id}.webp`, false]];
    if (alt) saidas.push([alt, `${a.id}-alt.webp`, true]);
    for (const [origem, nome, cinza] of saidas) {
      const r = await preparar(readFileSync(origem).toString('base64'), lado, cinza);
      if (Math.max(r.emendaX, r.emendaY) > FATOR_DA_BORDA) throw new Error(`${nome}: não fecha em ladrilho (emenda ${r.emendaX.toFixed(2)} × / ${r.emendaY.toFixed(2)} × a diferença entre vizinhas; o limite é ${FATOR_DA_BORDA}).`);
      const dados = Buffer.from(r.b64, 'base64');
      writeFileSync(join(SAIDA, nome), dados); hash.update(dados);
      relatorio.push(`${nome.padEnd(34)}${String(lado).padStart(4)} px  ${String(Math.round(dados.length / 1024)).padStart(4)} KB  emenda ${r.emendaX.toFixed(2)}/${r.emendaY.toFixed(2)}`);
    }
    catalogo.push({ id: a.id, nome: a.estimado ? `${a.pasta} (tamanho real estimado em ${a.metros} m)` : a.pasta, arquivo: `${a.id}.webp`, ...(alt ? { deslocamento: `${a.id}-alt.webp` } : {}), metros: a.metros, pxPorMetro: PX_POR_METRO, fonte: a.fonte, autor: a.autor, licenca: a.licenca, url: a.url });
    linhas.push(`| texturas/${a.id}.webp${alt ? `<br>texturas/${a.id}-alt.webp` : ''} | ${a.estimado ? `${a.pasta} (tamanho real estimado em ${a.metros} m)` : a.pasta} | ${a.autor} | ${a.fonte} | ${a.licenca} | ${a.url} |`);
  }
} finally { await navegador.close(); }

// Remove ladrilhos de execuções anteriores que saíram da lista.
const esperados = new Set(catalogo.flatMap(t => [t.arquivo, t.deslocamento ?? '']).concat('texturas.json'));
for (const n of readdirSync(SAIDA)) if (!esperados.has(n)) rmSync(join(SAIDA, n));

const final: CatalogoDeTexturas = { versao: 1, hash: hash.digest('hex'), texturas: catalogo };
validarCatalogo(final);
writeFileSync(join(SAIDA, 'texturas.json'), JSON.stringify(final, null, 2) + '\n');

// docs/LICENCAS.md: a tabela das texturas fica entre os marcadores.
const texto = readFileSync(LICENCAS, 'utf8'), inicio = '<!-- texturas:inicio -->', fim = '<!-- texturas:fim -->';
const bloco = `${inicio}\n| arquivo | textura | autor | fonte | licença | link |\n| --- | --- | --- | --- | --- | --- |\n${linhas.join('\n')}\n${fim}`;
if (!texto.includes(inicio)) throw new Error('docs/LICENCAS.md não tem os marcadores das texturas.');
const novo = texto.replace(new RegExp(`${inicio}[\\s\\S]*?${fim}`), () => bloco);
if (novo !== texto) writeFileSync(LICENCAS, novo);

console.log(relatorio.join('\n') + `\n\n${catalogo.length} texturas, hash ${final.hash}`);
