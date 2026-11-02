/**
 * mesa-dev — um servidor só para todos os projetos da mesa, em desenvolvimento.
 *
 * No GitHub Pages os projetos vivem em https://<conta>.github.io/<Projeto>/, na mesma origem: compartilham IndexedDB,
 * localStorage e BroadcastChannel. Cada `npm run dev` tem a sua porta, então localmente eles ficariam em origens
 * diferentes. Este proxy os põe de volta na mesma origem:
 *
 *   node scripts/mesa-dev.ts Atlas=5190 Ficha=5173@raiz --porta 5100
 *   → http://127.0.0.1:5100/Atlas/   http://127.0.0.1:5100/Ficha/
 *
 * Por padrão o caminho segue inteiro (`/Atlas/x` chega ao projeto como `/Atlas/x`): é o que o Vite faz quando roda com
 * `base: '/Atlas/'`, e assim os módulos, o recarregamento ao vivo (HMR) e os WebSockets funcionam sem remendos.
 * No Atlas, `npm run dev:mesa`. Um projeto que serve na raiz (sem `base`) leva `@raiz`: o prefixo é tirado do caminho.
 */
import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

export interface Projeto { nome: string; alvo: string; /** O projeto serve na raiz: o prefixo `/Nome` é tirado do caminho. */ tirarPrefixo: boolean }

const PROJETOS_PADRAO: Projeto[] = [{ nome: 'Atlas', alvo: 'http://127.0.0.1:5190', tirarPrefixo: false }];
const escapar = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lê `Nome=5190`, `Nome=http://host:porta` ou, para quem serve na raiz, `Nome=5173@raiz`. */
export function lerProjeto(texto: string): Projeto {
  const i = texto.indexOf('=');
  const nome = texto.slice(0, i);
  let alvo = texto.slice(i + 1), tirarPrefixo = false;
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
    if (!achado) { socket.destroy(); return; }
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

function principal(): void {
  const args = process.argv.slice(2), i = args.indexOf('--porta');
  const porta = i >= 0 ? Number(args.splice(i, 2)[1]) : 5100;
  const projetos = args.length ? args.map(lerProjeto) : PROJETOS_PADRAO;
  criarProxy(projetos).listen(porta, '127.0.0.1', () => {
    console.log(`mesa-dev em http://127.0.0.1:${porta}/ — mesma origem para todos:`);
    for (const p of projetos) console.log(`  http://127.0.0.1:${porta}/${p.nome}/  →  ${p.alvo}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
