/** Servir uma pasta de arquivos estáticos (o que o GitHub Pages faria), para os projetos sem servidor de desenvolvimento sob prefixo. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

export const tipoDoArquivo = (arquivo: string): string => MIME[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream';

/**
 * O arquivo que um caminho de URL pede, ou `null` se sai da pasta, não existe ou não é arquivo.
 * Pasta vira o `index.html` dela. Consulta (`?x=1`) e fragmento são ignorados.
 */
export function resolverArquivo(raiz: string, url: string): string | null {
  let caminho: string;
  try { caminho = decodeURIComponent(url.split(/[?#]/)[0] ?? '/'); } catch { return null; }
  if (caminho.includes('\0')) return null;
  const base = path.resolve(raiz), alvo = path.resolve(base, `.${caminho.startsWith('/') ? caminho : `/${caminho}`}`);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) return null;
  try {
    const stat = fs.statSync(alvo);
    if (stat.isFile()) return alvo;
    if (stat.isDirectory()) { const indice = path.join(alvo, 'index.html'); return fs.statSync(indice).isFile() ? indice : null; }
  } catch { /* não existe */ }
  return null;
}

/** Responde com o arquivo (com suporte a `Range`, que o `<audio>` usa para avançar a faixa). */
export function servirArquivo(raiz: string, url: string, req: http.IncomingMessage, res: http.ServerResponse): void {
  const arquivo = resolverArquivo(raiz, url);
  if (!arquivo) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end(`Não achei ${url.split('?')[0]} em ${path.basename(raiz)}.`); return; }
  const { size } = fs.statSync(arquivo), cabecalhos = { 'content-type': tipoDoArquivo(arquivo), 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (faixa && (faixa[1] || faixa[2])) {
    const inicio = faixa[1] ? Number(faixa[1]) : Math.max(0, size - Number(faixa[2])), fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), size - 1) : size - 1;
    if (inicio > fim || inicio >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { ...cabecalhos, 'content-range': `bytes ${inicio}-${fim}/${size}`, 'content-length': fim - inicio + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(arquivo, { start: inicio, end: fim }).pipe(res); return;
  }
  res.writeHead(200, { ...cabecalhos, 'content-length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(arquivo).pipe(res);
}
