/**
 * Imagens do disco para o assistente: lista as de uma pasta ou de um PDF e lê uma (arquivo, imagem embutida ou recorte
 * de página) já reduzida. Lógica pura: as chamadas externas (`pdfimages`, `pdftoppm`, `magick`…) entram por `Externos`.
 * Só roda no servidor MCP (Node); a aba nunca lê o disco. Logs, se houver, vão para stderr.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

export const LADO_MAX_PADRAO = 2048;
export const LADO_MAX_MINIATURA = 768;
export const MIN_LADO_PDF = 300;
export const REPETIDA_EM_PAGINAS = 3;
export const NIVEIS_DE_PASTA = 3;
export const MAX_ARQUIVOS_DA_PASTA = 300;
export const MAX_ORIGINAL_SEM_REDUZIR = 8 * 1024 * 1024;
const EXTENSOES = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export interface Externos {
  /** Roda um programa e devolve o stdout; lança se o programa não existir ou falhar. */
  executar(cmd: string, args: string[]): Promise<Buffer>;
  /** Diz se o programa existe no PATH. */
  existe(cmd: string): Promise<boolean>;
}

export const externosReais: Externos = {
  executar: (cmd, args) => new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 }, (erro, stdout, stderr) => {
      if (erro) reject(new Error(`${cmd} falhou: ${(stderr?.toString() || erro.message).trim().split('\n')[0]}`));
      else resolve(stdout);
    });
  }),
  existe: cmd => new Promise(resolve => { execFile('which', [cmd], erro => resolve(!erro)); }),
};

export interface Ambiente {
  externos?: Externos;
  /** Valor de `MESA_RAIZES` (caminhos separados por `:`). */
  raizes?: string;
  home?: string;
  tmp?: string;
}

// --- Raízes permitidas ---

export function raizesPermitidas(amb: Ambiente = {}): string[] {
  const home = amb.home ?? os.homedir();
  const bruto = amb.raizes ?? process.env.MESA_RAIZES ?? '';
  const lista = bruto.split(':').map(s => s.trim()).filter(Boolean);
  return (lista.length ? lista : [path.join(home, 'Documents')]).map(r => expandirTil(r, home));
}

function expandirTil(texto: string, home: string): string {
  if (texto === '~') return home;
  if (texto.startsWith('~/')) return path.join(home, texto.slice(2));
  return path.resolve(texto);
}

function dentroDe(caminho: string, raiz: string): boolean {
  const rel = path.relative(raiz, caminho);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Caminho real (links resolvidos) dentro de uma raiz permitida, ou erro legível. */
export function validarCaminho(texto: string, amb: Ambiente = {}): string {
  const home = amb.home ?? os.homedir();
  const raizes = raizesPermitidas(amb);
  const pedido = expandirTil(String(texto ?? '').trim(), home);
  let real: string;
  try {
    real = fs.realpathSync(pedido);
  } catch {
    throw new Error(`O caminho "${pedido}" não existe.`);
  }
  const reaisDasRaizes = raizes.map(r => { try { return fs.realpathSync(r); } catch { return r; } });
  // Vale o caminho pedido, normalizado (o `..` não escapa), ou o real. Um atalho que o próprio mestre criou dentro
  // de uma raiz vale (o material dele em ~/Documents/RPG é um link para /media/hd); o que se recusa é sair por `..`.
  const normalizado = path.resolve(pedido);
  const dentro = raizes.some(r => dentroDe(normalizado, path.resolve(expandirTil(r, home)))) || reaisDasRaizes.some(r => dentroDe(real, r));
  if (!dentro) {
    throw new Error(`O caminho está fora das pastas permitidas (${raizes.join(', ')}). Para liberar outra pasta, defina MESA_RAIZES.`);
  }
  return real;
}

// --- Referências ---

export type Referencia =
  | { tipo: 'arquivo'; caminho: string }
  | { tipo: 'pdf-imagem'; caminho: string; pagina: number; indice: number }
  | { tipo: 'pdf-recorte'; caminho: string; pagina: number; recorte: [number, number, number, number] };

export function eReferenciaDeArquivo(de: unknown): de is string {
  return typeof de === 'string' && (de.startsWith('arquivo:') || de.startsWith('pdf:'));
}

export function lerReferencia(ref: string): Referencia {
  if (ref.startsWith('arquivo:')) {
    const caminho = ref.slice('arquivo:'.length).trim();
    if (!caminho) throw new Error('Referência "arquivo:" sem caminho.');
    return { tipo: 'arquivo', caminho };
  }
  if (ref.startsWith('pdf:')) {
    const corpo = ref.slice('pdf:'.length);
    const corte = corpo.lastIndexOf('#');
    if (corte < 0) throw new Error(`Referência de PDF sem "#": use pdf:<caminho>#p=<página>&i=<número> ou #p=<página>&recorte=x,y,l,a (recebi "${ref}").`);
    const caminho = corpo.slice(0, corte);
    const params = new URLSearchParams(corpo.slice(corte + 1));
    const pagina = Number(params.get('p'));
    if (!Number.isInteger(pagina) || pagina < 1) throw new Error(`Referência de PDF com página inválida: "${ref}".`);
    const rec = params.get('recorte');
    if (rec !== null) {
      const v = rec.split(',').map(Number);
      if (v.length !== 4 || v.some(n => !Number.isFinite(n))) throw new Error(`Recorte inválido em "${ref}": use recorte=x,y,l,a (frações de 0 a 1 da página).`);
      const [x, y, l, a] = v as [number, number, number, number];
      if (x < 0 || y < 0 || l <= 0 || a <= 0 || x >= 1 || y >= 1 || x + l > 1.0001 || y + a > 1.0001) {
        throw new Error(`Recorte fora da página em "${ref}": x,y,l,a são frações de 0 a 1 e x+l, y+a não passam de 1.`);
      }
      return { tipo: 'pdf-recorte', caminho, pagina, recorte: [x, y, l, a] };
    }
    const indice = Number(params.get('i'));
    if (!Number.isInteger(indice) || indice < 0) throw new Error(`Referência de PDF sem imagem (i=) nem recorte: "${ref}".`);
    return { tipo: 'pdf-imagem', caminho, pagina, indice };
  }
  throw new Error(`Referência desconhecida: "${ref}" (use arquivo: ou pdf:).`);
}

// --- PDF: listagem ---

export interface ImagemDePdf { id: string; pagina: number; largura: number; altura: number }

interface LinhaDoPdfimages { pagina: number; num: number; tipo: string; largura: number; altura: number; objeto: number }

export function lerSaidaDoPdfimages(saida: string): LinhaDoPdfimages[] {
  const linhas: LinhaDoPdfimages[] = [];
  for (const l of saida.split('\n')) {
    const c = l.trim().split(/\s+/);
    if (c.length < 12 || !/^\d+$/.test(c[0]!)) continue;
    linhas.push({ pagina: Number(c[0]), num: Number(c[1]), tipo: c[2]!, largura: Number(c[3]), altura: Number(c[4]), objeto: Number(c[10]) });
  }
  return linhas;
}

/** Descarta máscaras, imagens pequenas e as que se repetem em 3 ou mais páginas (mesmo object ID: fundos de página). */
export function filtrarImagensDePdf(saida: string, caminho: string): ImagemDePdf[] {
  const linhas = lerSaidaDoPdfimages(saida);
  const paginasPorObjeto = new Map<number, Set<number>>();
  for (const l of linhas) {
    const s = paginasPorObjeto.get(l.objeto) ?? new Set<number>();
    s.add(l.pagina);
    paginasPorObjeto.set(l.objeto, s);
  }
  return linhas
    .filter(l => l.tipo === 'image' && Math.min(l.largura, l.altura) >= MIN_LADO_PDF && (paginasPorObjeto.get(l.objeto)?.size ?? 0) < REPETIDA_EM_PAGINAS)
    .map(l => ({ id: `pdf:${caminho}#p=${l.pagina}&i=${l.num}`, pagina: l.pagina, largura: l.largura, altura: l.altura }));
}

/** Tamanho da página em pontos, da saída de `pdfinfo -f p -l p`. */
export function tamanhoDaPagina(saida: string, pagina: number): { largura: number; altura: number } | null {
  const m = new RegExp(`Page\\s+${pagina}\\s+size:\\s*([\\d.]+)\\s*x\\s*([\\d.]+)`).exec(saida) ?? /Page size:\s*([\d.]+)\s*x\s*([\d.]+)/.exec(saida);
  return m ? { largura: Number(m[1]), altura: Number(m[2]) } : null;
}

/** Recorte (frações da página) em pixels da página renderizada a `dpi`. */
export function recorteEmPx(recorte: [number, number, number, number], paginaPts: { largura: number; altura: number }, dpi = 150) {
  const pxL = Math.round(paginaPts.largura * dpi / 72);
  const pxA = Math.round(paginaPts.altura * dpi / 72);
  const x = Math.min(pxL - 1, Math.max(0, Math.round(recorte[0] * pxL)));
  const y = Math.min(pxA - 1, Math.max(0, Math.round(recorte[1] * pxA)));
  const l = Math.max(1, Math.min(pxL - x, Math.round(recorte[2] * pxL)));
  const a = Math.max(1, Math.min(pxA - y, Math.round(recorte[3] * pxA)));
  return { x, y, l, a, paginaL: pxL, paginaA: pxA };
}

// --- Listagem ---

export interface ImagemDePasta { id: string; nome: string; largura: number | null; altura: number | null }
export type Listagem =
  | { tipo: 'pasta'; caminho: string; imagens: ImagemDePasta[]; cortada?: boolean }
  | { tipo: 'pdf'; caminho: string; paginas: number | null; imagens: ImagemDePdf[] };

async function comandoDeImagem(ext: Externos): Promise<'magick' | 'convert' | null> {
  if (await ext.existe('magick')) return 'magick';
  if (await ext.existe('convert')) return 'convert';
  return null;
}

function percorrer(raiz: string, amb: Ambiente): { arquivos: string[]; cortada: boolean } {
  const arquivos: string[] = [];
  let cortada = false;
  const visitar = (dir: string, nivel: number) => {
    let entradas: fs.Dirent[];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entradas.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entradas) {
      if (arquivos.length >= MAX_ARQUIVOS_DA_PASTA) { cortada = true; return; }
      const completo = path.join(dir, e.name);
      if (e.isDirectory() || e.isSymbolicLink()) {
        let real: string;
        try { real = validarCaminho(completo, amb); } catch { continue; }
        if (fs.statSync(real).isDirectory()) { if (nivel < NIVEIS_DE_PASTA) visitar(completo, nivel + 1); continue; }
      }
      if (EXTENSOES.has(path.extname(e.name).toLowerCase())) {
        // O id usa o caminho pedido (dentro da raiz), não o real: um atalho do mestre leva para fora dela.
        try { validarCaminho(completo, amb); arquivos.push(completo); } catch { /* link para fora: ignora */ }
      }
    }
  };
  visitar(raiz, 0);
  return { arquivos, cortada };
}

export async function listarImagens(caminho: string, amb: Ambiente = {}): Promise<Listagem> {
  const ext = amb.externos ?? externosReais;
  const real = validarCaminho(caminho, amb);
  // Os ids saem pelo caminho pedido, normalizado: é o que passa por validarCaminho de novo na leitura.
  const pedido = path.resolve(expandirTil(String(caminho).trim(), amb.home ?? os.homedir()));
  const stat = fs.statSync(real);
  if (stat.isDirectory()) {
    const { arquivos, cortada } = percorrer(pedido, amb);
    const imagens: ImagemDePasta[] = [];
    for (const arq of arquivos) {
      let largura: number | null = null;
      let altura: number | null = null;
      try {
        const [l, a] = (await ext.executar('identify', ['-ping', '-format', '%w %h', `${arq}[0]`])).toString().trim().split(/\s+/).map(Number);
        if (Number.isFinite(l) && Number.isFinite(a)) { largura = l!; altura = a!; }
      } catch { /* sem tamanho */ }
      imagens.push({ id: `arquivo:${arq}`, nome: path.relative(pedido, arq), largura, altura });
    }
    return { tipo: 'pasta', caminho: pedido, imagens, ...(cortada ? { cortada: true } : {}) };
  }
  if (path.extname(real).toLowerCase() === '.pdf') {
    const saida = (await ext.executar('pdfimages', ['-list', real])).toString();
    let paginas: number | null = null;
    try {
      const m = /^Pages:\s*(\d+)/m.exec((await ext.executar('pdfinfo', [real])).toString());
      if (m) paginas = Number(m[1]);
    } catch { /* pdfinfo ausente */ }
    return { tipo: 'pdf', caminho: pedido, paginas, imagens: filtrarImagensDePdf(saida, pedido) };
  }
  throw new Error(`"${real}" não é uma pasta nem um PDF.`);
}

// --- Leitura ---

export interface ImagemLida { mime: 'image/jpeg' | 'image/png'; bytes: Buffer; largura: number; altura: number }
export interface OpcoesDeLeitura { ladoMax?: number; qualidade?: number }

async function medir(ext: Externos, arq: string): Promise<{ largura: number; altura: number; opaca: boolean }> {
  const [l, a, o] = (await ext.executar('identify', ['-ping', '-format', '%w %h %[opaque]', `${arq}[0]`])).toString().trim().split(/\s+/);
  return { largura: Number(l), altura: Number(a), opaca: o !== 'False' && o !== 'false' };
}

/** Lê uma imagem (arquivo, imagem de PDF ou recorte de página), reduzida a `ladoMax` (padrão 2048), em JPEG 0,85 ou PNG se tiver transparência. */
export async function lerImagem(ref: string, opcoes: OpcoesDeLeitura = {}, amb: Ambiente = {}): Promise<ImagemLida> {
  const ext = amb.externos ?? externosReais;
  const ladoMax = opcoes.ladoMax ?? LADO_MAX_PADRAO;
  const qualidade = opcoes.qualidade ?? 85;
  const r = lerReferencia(ref);
  const real = validarCaminho(r.caminho, amb);
  if (r.tipo !== 'arquivo' && path.extname(real).toLowerCase() !== '.pdf') throw new Error(`"${real}" não é um PDF.`);
  const tmp = fs.mkdtempSync(path.join(amb.tmp ?? os.tmpdir(), 'mesa-img-'));
  try {
    let origem: string;
    let ehJpeg = false;
    if (r.tipo === 'arquivo') {
      if (!fs.statSync(real).isFile()) throw new Error(`"${real}" não é um arquivo.`);
      if (!EXTENSOES.has(path.extname(real).toLowerCase())) throw new Error(`"${real}" não é png, jpg nem webp.`);
      origem = real;
    } else if (r.tipo === 'pdf-imagem') {
      const lista = lerSaidaDoPdfimages((await ext.executar('pdfimages', ['-list', '-f', String(r.pagina), '-l', String(r.pagina), real])).toString());
      const completa = lerSaidaDoPdfimages((await ext.executar('pdfimages', ['-list', real])).toString());
      const daPagina = completa.filter(l => l.pagina === r.pagina);
      const alvo = daPagina.find(l => l.num === r.indice);
      if (!alvo || lista.length === 0) throw new Error(`A imagem ${r.indice} não está na página ${r.pagina} do PDF (rode arquivo_imagens para ver os ids).`);
      const posicao = alvo.num - Math.min(...daPagina.map(l => l.num));
      await ext.executar('pdfimages', ['-png', '-f', String(r.pagina), '-l', String(r.pagina), real, path.join(tmp, 'img')]);
      const gerados = fs.readdirSync(tmp).filter(n => n.startsWith('img-')).sort();
      const nome = gerados[posicao];
      if (!nome) throw new Error(`Não consegui extrair a imagem ${r.indice} da página ${r.pagina}.`);
      origem = path.join(tmp, nome);
    } else {
      const info = tamanhoDaPagina((await ext.executar('pdfinfo', ['-f', String(r.pagina), '-l', String(r.pagina), real])).toString(), r.pagina);
      if (!info) throw new Error(`Não consegui ler o tamanho da página ${r.pagina} do PDF.`);
      const c = recorteEmPx(r.recorte, info);
      await ext.executar('pdftoppm', ['-r', '150', '-f', String(r.pagina), '-l', String(r.pagina), '-x', String(c.x), '-y', String(c.y), '-W', String(c.l), '-H', String(c.a), '-jpeg', '-jpegopt', `quality=${qualidade}`, '-singlefile', real, path.join(tmp, 'rec')]);
      origem = path.join(tmp, 'rec.jpg');
      ehJpeg = true;
    }

    const conversor = await comandoDeImagem(ext);
    if (!conversor) {
      // Sem ImageMagick: só devolve o que já está em JPEG/PNG de tamanho razoável.
      const bytes = fs.readFileSync(origem);
      if (!ehJpeg && bytes.length > MAX_ORIGINAL_SEM_REDUZIR) throw new Error('Sem ImageMagick instalado não dá para reduzir esta imagem (maior que 8 MB).');
      const png = bytes[0] === 0x89;
      const jpg = bytes[0] === 0xff;
      if (!png && !jpg) throw new Error('Sem ImageMagick instalado só leio PNG e JPEG.');
      return { mime: png ? 'image/png' : 'image/jpeg', bytes, largura: 0, altura: 0 };
    }
    const m = await medir(ext, origem);
    const saida = path.join(tmp, m.opaca ? 'saida.jpg' : 'saida.png');
    const args = [origem + '[0]', '-auto-orient', '-resize', `${ladoMax}x${ladoMax}>`];
    if (m.opaca) args.push('-colorspace', 'sRGB', '-strip', '-quality', String(qualidade));
    else args.push('-strip');
    args.push(saida);
    await ext.executar(conversor, args);
    const fim = await medir(ext, saida);
    return { mime: m.opaca ? 'image/jpeg' : 'image/png', bytes: fs.readFileSync(saida), largura: fim.largura, altura: fim.altura };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function paraDataUrl(img: ImagemLida): string {
  return `data:${img.mime};base64,${img.bytes.toString('base64')}`;
}

// --- Reescrita dos argumentos de quadro_inserir ---

/**
 * Troca cada `de` que começa com `arquivo:` ou `pdf:` (em qualquer profundidade de `itens`: linhas, grades, células)
 * por `dados:<data URL>`. Não muda os outros campos nem o objeto original. Erro de leitura sai com a referência no texto.
 */
export async function reescreverImagensDoQuadro(args: Record<string, unknown>, amb: Ambiente = {}): Promise<Record<string, unknown>> {
  const cache = new Map<string, string>();
  const visitar = async (v: unknown): Promise<unknown> => {
    if (Array.isArray(v)) {
      const lista: unknown[] = [];
      for (const x of v) lista.push(await visitar(x));
      return lista;
    }
    if (v && typeof v === 'object') {
      const saida: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (k === 'de' && eReferenciaDeArquivo(x)) {
          let dados = cache.get(x);
          if (!dados) {
            try {
              dados = `dados:${paraDataUrl(await lerImagem(x, {}, amb))}`;
            } catch (e) {
              throw new Error(`Não consegui ler a imagem "${x}": ${(e as Error).message}`);
            }
            cache.set(x, dados);
          }
          saida[k] = dados;
        } else saida[k] = await visitar(x);
      }
      return saida;
    }
    return v;
  };
  if (!('itens' in args)) return args;
  return { ...args, itens: await visitar(args.itens) };
}
