import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// `base: './'` mantém o site funcionando em qualquer caminho do GitHub Pages
// (https://<conta>.github.io/Atlas/) e sob o servidor único de desenvolvimento (mesa-dev).
// Atrás do `mesa-dev` (todos os projetos numa origem só), o Vite serve sob o prefixo do projeto (`/Atlas/`): todas as
// URLs, os módulos e o recarregamento ao vivo passam a ficar sob ele. Sem a variável, `./` serve em qualquer caminho.
const prefixo = process.env.MESA_DEV_PREFIX;

export default defineConfig({
  base: prefixo ?? './',
  plugins: [preact()],
  build: { target: 'es2023', sourcemap: true },
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
});
