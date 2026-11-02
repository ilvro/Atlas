// Medição do protótipo: capturas de cada combinação e FPS em 1920×1080.
// Uso: com `npm run dev` aberto, `npm run medir [-- --rapido]`. Resultado em spikes/estilos/medicao/.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ENDERECO = process.env.ATLAS_URL ?? 'http://127.0.0.1:5180/';
const rapido = process.argv.includes('--rapido');
const saida = new URL('../medicao/', import.meta.url);
await mkdir(saida, { recursive: true });

const navegador = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=default'] });
const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 } });
const erros = [];
pagina.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(`[${m.type()}] ${m.text()}`); });
pagina.on('pageerror', e => erros.push(`[pageerror] ${e.message}`));
await pagina.goto(ENDERECO);
await pagina.waitForFunction(() => window.atlas, null, { timeout: 30000 });
const gpu = await pagina.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconhecido';
});

const passos = [
  { nome: 'ilustrado-caixa-noite', estado: { estilo: 'ilustrado', paredes: 'caixa' }, clima: 'noite' },
  { nome: 'ilustrado-caixa-dia-mestre', estado: { estilo: 'ilustrado', paredes: 'caixa', visao: 'mestre' }, clima: 'dia' },
  { nome: 'ilustrado-solida-dia-mestre', estado: { estilo: 'ilustrado', paredes: 'solida', visao: 'mestre' }, clima: 'dia' },
  { nome: 'ilustrado-caixa-tempestade-mestre', estado: { estilo: 'ilustrado', paredes: 'caixa', visao: 'mestre' }, clima: 'tempestade' },
  { nome: 'ilustrado-caixa-apagao', estado: { estilo: 'ilustrado', paredes: 'caixa', visao: 'jogadores' }, clima: 'apagao' },
  { nome: 'pixel16-caixa-noite-mestre', estado: { estilo: 'pixel', ppc: 16, paredes: 'caixa', visao: 'mestre' }, clima: 'noite' },
  { nome: 'pixel16-caixa-dia-mestre', estado: { estilo: 'pixel', ppc: 16, paredes: 'caixa', visao: 'mestre' }, clima: 'dia' },
  { nome: 'pixel24-caixa-dia-mestre', estado: { estilo: 'pixel', ppc: 24, paredes: 'caixa', visao: 'mestre' }, clima: 'dia' },
  { nome: 'pixel12-caixa-dia-mestre', estado: { estilo: 'pixel', ppc: 12, paredes: 'caixa', visao: 'mestre' }, clima: 'dia' },
  { nome: 'pixel16-caixa-apagao', estado: { estilo: 'pixel', ppc: 16, paredes: 'caixa', visao: 'jogadores' }, clima: 'apagao' },
];

const resultados = [];
for (const p of rapido ? passos.slice(0, 2) : passos) {
  await pagina.evaluate(async ({ estado, clima }) => { await window.atlas.mudar(estado); window.atlas.clima(clima); }, p);
  await pagina.waitForTimeout(2200);
  const fps = await pagina.evaluate(() => window.atlas.fps(2500));
  await pagina.screenshot({ path: new URL(`${p.nome}.png`, saida).pathname });
  resultados.push({ ...p, fps: { media: Math.round(fps.media), p5: Math.round(fps.p5) } });
  console.log(p.nome, Math.round(fps.media), 'fps');
}

// Caminhada: o token entra na biblioteca e a sala vira memória em esboço.
await pagina.evaluate(async () => { await window.atlas.mudar({ estilo: 'ilustrado', paredes: 'caixa', visao: 'jogadores' }); window.atlas.clima('noite'); window.atlas.porta(); });
await pagina.waitForTimeout(800);
await pagina.evaluate(() => window.atlas.irPara([9, 6]));
await pagina.waitForTimeout(4500);
await pagina.screenshot({ path: new URL('caminhada-memoria-ilustrado.png', saida).pathname });
await pagina.evaluate(async () => { await window.atlas.mudar({ estilo: 'pixel', ppc: 16 }); });
await pagina.waitForTimeout(1500);
await pagina.screenshot({ path: new URL('caminhada-memoria-pixel.png', saida).pathname });

const tempos = await pagina.evaluate(() => window.atlas.tempos);
await writeFile(new URL('resultado.json', saida), JSON.stringify({ gpu, resultados, tempos, erros }, null, 2));
console.log('GPU:', gpu); console.log('Assar (ms):', tempos); console.log('Erros:', erros.length ? erros : 'nenhum');
await navegador.close();
