/**
 * Prova que a ponte do assistente não vai para o build de produção (o que o Pages publica).
 * Roda `vite build` do Atlas e da Mesa em pastas temporárias e procura marcas da ponte nos arquivos gerados.
 * Uso: `npm run ponte:verificar [-- --mesa <caminho>]` (ou env `MESA_DIR`; padrão: `../Mesa`).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// `ponte_` solto casaria com palavras como "ponte_" em dados; por isso os nomes reais das ferramentas e o `ponte_estado` do MCP.
const MARCAS = ['__ponte', 'conectarPonte', 'ponte_estado', 'atlas_mapa_ler', 'atlas_ver_mapa', 'campanha_ler', 'mesa_campanha_atual', 'atlas_o_que_vejo', 'atlas_mapa_criar', 'atlas_terreno', 'atlas_comodos', 'atlas_paredes', 'atlas_portas', 'atlas_objetos', 'atlas_espalhar', 'atlas_luzes', 'atlas_ambiente', 'atlas_regioes', 'atlas_presenca', 'atlas_notas', 'atlas_momento', 'atlas_momento_testar', 'atlas_remover', 'atlas_mover', 'painel-assistente', 'o mestre recusou', 'mesa_o_que_vejo', 'selo-assistente'];

const raizAtlas = path.resolve(import.meta.dirname, '..', '..');
const i = process.argv.indexOf('--mesa');
const mesaArg = i >= 0 ? process.argv[i + 1] : process.env.MESA_DIR;
if (i >= 0 && !mesaArg) { console.error('Falta o caminho depois de --mesa.'); process.exit(2); }
const raizMesa = path.resolve(mesaArg ? path.resolve(mesaArg) : path.join(raizAtlas, '..', 'Mesa'));

function* arquivos(pasta: string): Generator<string> {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) yield* arquivos(p); else yield p;
  }
}

const temporarias: string[] = [];
let falhou = false;
try {
  for (const [nome, raiz] of [['Atlas', raizAtlas], ['Mesa', raizMesa]] as const) {
    if (!fs.existsSync(path.join(raiz, 'vite.config.ts'))) { console.error(`${nome}: ${raiz} não parece um projeto Vite.`); falhou = true; continue; }
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), `ponte-build-${nome.toLowerCase()}-`));
    temporarias.push(saida);
    const r = spawnSync('npx', ['vite', 'build', '--outDir', saida, '--emptyOutDir'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } });
    if (r.status !== 0) { console.error(`${nome}: o build falhou.\n${r.stdout}${r.stderr}`); falhou = true; continue; }
    const achados: string[] = [];
    let total = 0;
    for (const arq of arquivos(saida)) {
      total++;
      const conteudo = fs.readFileSync(arq, 'latin1');
      for (const m of MARCAS) if (conteudo.includes(m)) achados.push(`${path.relative(saida, arq)}: ${m}`);
    }
    if (achados.length) { falhou = true; console.error(`${nome}: a ponte vazou para o build:\n${achados.map(a => `  ${a}`).join('\n')}`); }
    else console.log(`${nome}: ok (${total} arquivos sem a ponte)`);
  }
} finally {
  for (const t of temporarias) fs.rmSync(t, { recursive: true, force: true });
}
process.exit(falhou ? 1 : 0);
