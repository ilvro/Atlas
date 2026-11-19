import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

function versaoDosPintores(): string {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), 'src', 'procedural');
  const arquivos: string[] = [];
  const percorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) percorrer(caminho);
      else if (entrada.isFile() && !entrada.name.endsWith('.test.ts')) arquivos.push(caminho);
    }
  };
  percorrer(raiz);
  arquivos.sort((a, b) => relative(raiz, a).replace(/\\/g, '/').localeCompare(relative(raiz, b).replace(/\\/g, '/')));
  const hash = createHash('sha1');
  for (const arq of arquivos) {
    hash.update(relative(raiz, arq).replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(readFileSync(arq));
    hash.update('\0');
  }
  return hash.digest('hex');
}

// `base: './'` mantém o site funcionando em qualquer caminho do GitHub Pages
// (https://<conta>.github.io/Atlas/) e sob o servidor único de desenvolvimento (mesa-dev).
// Atrás do `mesa-dev` (todos os projetos numa origem só), o Vite serve sob o prefixo do projeto (`/Atlas/`): todas as
// URLs, os módulos e o recarregamento ao vivo passam a ficar sob ele. Sem a variável, `./` serve em qualquer caminho.
const prefixo = process.env.MESA_DEV_PREFIX;

export default defineConfig({
  base: prefixo ?? './',
  plugins: [preact()],
  define: {
    __VERSAO_DOS_PINTORES__: JSON.stringify(versaoDosPintores()),
  },
  build: { target: 'es2023', sourcemap: true },
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
});
