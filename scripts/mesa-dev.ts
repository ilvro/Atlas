/**
 * mesa-dev — um servidor só para todos os projetos da mesa, em desenvolvimento.
 *
 * No GitHub Pages os projetos vivem em https://<conta>.github.io/<Projeto>/, na mesma origem: compartilham IndexedDB,
 * localStorage e BroadcastChannel. Cada `npm run dev` tem a sua porta, então localmente eles ficariam em origens
 * diferentes. Este proxy os põe de volta na mesma origem.
 *
 *   npm run mesa-dev                    → sobe Atlas, Mesa, Dossiê, Ateliê, Tabletop e Jukebox e serve tudo em http://127.0.0.1:5100/
 *   npm run mesa-dev -- --so Atlas,Mesa → só esses (nomes: Atlas, Mesa, Dossie, Atelie, Tabletop, Jukebox)
 *   node scripts/mesa-dev.ts Atlas=5190 Dossie=5173@raiz Jukebox=estatico:../Jukebox --porta 5100
 *                                       → só o proxy, para projetos que você já subiu
 *
 * Por padrão o caminho segue inteiro (`/Atlas/x` chega ao projeto como `/Atlas/x`): é o que o Vite faz quando roda com
 * `base: '/Atlas/'`, e assim os módulos, o recarregamento ao vivo (HMR) e os WebSockets funcionam sem remendos.
 * Um projeto que serve na raiz (sem `base`) leva `@raiz`: o prefixo é tirado do caminho. Uma pasta de arquivos
 * (`Nome=estatico:pasta`) é servida pelo próprio proxy, como o GitHub Pages faria. Como cada projeto sobe: `mesa-tudo.ts`.
 */
import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { servirArquivo } from './mesa-estatico.ts';
import { subirProjetos } from './mesa-tudo.ts';

export interface Projeto { nome: string; alvo: string; /** O projeto serve na raiz: o prefixo `/Nome` é tirado do caminho. */ tirarPrefixo: boolean; /** Pasta de arquivos estáticos servida pelo próprio mesa-dev (como o GitHub Pages), em vez de repassar a um servidor. */ estatico?: string }

const escapar = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lê `Nome=5190`, `Nome=http://host:porta`, `Nome=5173@raiz` (serve na raiz) ou `Nome=estatico:/caminho/da/pasta` (arquivos estáticos). */
export function lerProjeto(texto: string): Projeto {
  const i = texto.indexOf('=');
  const nome = texto.slice(0, i);
  let alvo = texto.slice(i + 1), tirarPrefixo = false;
  if (alvo.startsWith('estatico:')) {
    const pasta = alvo.slice('estatico:'.length);
    if (i < 1 || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(nome) || !pasta) throw new Error(`Use Nome=porta, Nome=http://host:porta, Nome=porta@raiz ou Nome=estatico:pasta (recebi “${texto}”).`);
    return { nome, alvo, tirarPrefixo: true, estatico: pasta };
  }
  if (alvo.endsWith('@raiz')) { tirarPrefixo = true; alvo = alvo.slice(0, -5); }
  if (i < 1 || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(nome) || !alvo) throw new Error(`Use Nome=porta, Nome=http://host:porta ou Nome=porta@raiz (recebi “${texto}”).`);
  return { nome, alvo: /^\d+$/.test(alvo) ? `http://127.0.0.1:${alvo}` : alvo.replace(/\/$/, ''), tirarPrefixo };
}

/** O projeto de um caminho (`/Atlas/x` → Atlas) e o caminho que ele deve receber. */
export function achar(projetos: readonly Projeto[], url: string): { projeto: Projeto; caminho: string } | null {
  const m = /^\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?/.exec(url);
  const projeto = projetos.find(p => p.nome === m?.[1]);
  if (!m || !projeto) return null;
  return { projeto, caminho: projeto.tirarPrefixo ? `${m[2] ?? '/'}${m[3] ?? ''}` : url };
}

export function criarProxy(projetos: readonly Projeto[]): http.Server {
  const servidor = http.createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/' || url.startsWith('/?')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><title>mesa-dev</title><body style="font:16px system-ui;background:#0a0a10;color:#ececf1;padding:2rem"><h1>mesa-dev</h1><p>Todos na mesma origem, como no GitHub Pages.</p><ul>${projetos.map(p => `<li><a style="color:#e91d25" href="/${escapar(p.nome)}/">${escapar(p.nome)}</a> <small>→ ${escapar(p.alvo)}</small></li>`).join('')}</ul>`);
      return;
    }
    const achado = achar(projetos, url);
    if (!achado) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end(`Nenhum projeto em ${url.split('?')[0]}. Projetos: ${projetos.map(p => p.nome).join(', ')}.`); return; }
    // `/Atlas` sem a barra final: os caminhos relativos do projeto só funcionam com ela.
    if (new RegExp(`^/${achado.projeto.nome}(\\?|$)`).test(url)) { res.writeHead(302, { location: `/${achado.projeto.nome}/${url.slice(achado.projeto.nome.length + 1)}` }); res.end(); return; }
    if (achado.projeto.estatico) { servirArquivo(achado.projeto.estatico, achado.caminho, req, res); return; }
    const alvo = new URL(achado.projeto.alvo);
    const pedido = http.request({ host: alvo.hostname, port: alvo.port || 80, method: req.method, path: achado.caminho, headers: { ...req.headers, host: alvo.host, 'x-forwarded-prefix': `/${achado.projeto.nome}` } }, resposta => {
      res.writeHead(resposta.statusCode ?? 502, resposta.headers); resposta.pipe(res);
    });
    pedido.on('error', () => {
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:2rem"><h1>${escapar(achado.projeto.nome)} não está respondendo</h1><p>Esperava encontrá-lo em <code>${escapar(achado.projeto.alvo)}</code>. Rode <code>npm run dev:mesa</code> no projeto.</p>`);
    });
    req.pipe(pedido);
  });

  // WebSocket (recarregamento ao vivo do Vite): túnel direto até o projeto.
  servidor.on('upgrade', (req, socket, cabeca) => {
    const achado = achar(projetos, req.url ?? '/');
    if (!achado || achado.projeto.estatico) { socket.destroy(); return; }
    const alvo = new URL(achado.projeto.alvo);
    const acima = net.connect(Number(alvo.port || 80), alvo.hostname, () => {
      const linhas = [`${req.method} ${achado.caminho} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) linhas.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i]!.toLowerCase() === 'host' ? alvo.host : req.rawHeaders[i + 1]}`);
      acima.write(`${linhas.join('\r\n')}\r\n\r\n`);
      if (cabeca.length) acima.write(cabeca);
      socket.pipe(acima).pipe(socket);
    });
    acima.on('error', () => socket.destroy()); socket.on('error', () => acima.destroy());
  });
  return servidor;
}

/** Sem argumentos: sobe todos os aplicativos da mesa (veja `mesa-tudo.ts`). Com `Nome=…`: só o proxy, para os projetos que você já subiu. */
async function principal(): Promise<void> {
  const args = process.argv.slice(2), i = args.indexOf('--porta');
  const porta = i >= 0 ? Number(args.splice(i, 2)[1]) : 5100;
  const s = args.indexOf('--so'), so = s >= 0 ? String(args.splice(s, 2)[1]).split(',').filter(Boolean) : [];
  let projetos: Projeto[], filhos: { kill(): boolean }[] = [];
  if (args.length) projetos = args.map(lerProjeto);
  else {
    const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
    const subida = await subirProjetos(raiz, so);
    filhos = subida.filhos;
    projetos = subida.argumentosDoProxy.map(lerProjeto);
    for (const aviso of subida.avisos) console.warn(`! ${aviso}`);
    if (!projetos.length) { console.error('Nenhum projeto para servir.'); filhos.forEach(f => f.kill()); process.exit(1); }
  }
  const parar = () => { filhos.forEach(f => f.kill()); process.exit(0); };
  process.on('SIGINT', parar); process.on('SIGTERM', parar);
  criarProxy(projetos).listen(porta, '127.0.0.1', () => {
    console.log(`\nmesa-dev em http://127.0.0.1:${porta}/ — mesma origem para todos:`);
    for (const p of projetos) console.log(`  http://127.0.0.1:${porta}/${p.nome}/  →  ${p.estatico ? `arquivos de ${p.estatico}` : p.alvo}`);
    console.log(`\nComece pela Mesa: http://127.0.0.1:${porta}/Mesa/   (Ctrl+C encerra tudo)`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void principal();
