/**
 * Prova que a ponte do assistente não vai para o build de produção (o que o Pages publica).
 * Roda `vite build` do Atlas, da Mesa, do Ateliê e do Dossiê em pastas temporárias e procura marcas da ponte nos arquivos gerados.
 * (No Dossiê é só `vite build`, nunca `npm run build`, que gera fichas.) A Jukebox não tem build e fica de fora.
 * Checagem inversa só no Atlas: o build `--mode desktop` (o do app de desktop) TEM `conectarPonte`; se não tiver, a trava sumiu sem querer.
 * Uso: `npm run ponte:verificar [-- --mesa <caminho> --atelie <caminho> --dossie <caminho>]`
 * (ou env `MESA_DIR`, `ATELIE_DIR`, `DOSSIE_DIR`; padrões: `../Mesa`, `../Atelie`, `../Dossie`).
 * Ateliê e Dossiê ausentes são avisados e pulados; Atlas e Mesa são obrigatórios.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// `ponte_` solto casaria com palavras como "ponte_" em dados; por isso os nomes reais das ferramentas e o `ponte_estado` do MCP.
const MARCAS = ['__ponte', 'conectarPonte', 'ponte_estado', 'atlas_mapa_ler', 'atlas_ver_mapa', 'campanha_ler', 'mesa_campanha_atual', 'atlas_o_que_vejo', 'atlas_mapa_criar', 'atlas_terreno', 'atlas_comodos', 'atlas_paredes', 'atlas_portas', 'atlas_objetos', 'atlas_espalhar', 'atlas_luzes', 'atlas_ambiente', 'atlas_regioes', 'atlas_presenca', 'atlas_notas', 'atlas_momento', 'atlas_momento_testar', 'atlas_remover', 'atlas_mover', 'painel-assistente', 'o mestre recusou', 'mesa_o_que_vejo', 'mesa_sessao_criar', 'mesa_entidade_criar', 'mesa_cena_montar', 'mesa_elenco', 'selo-assistente', 'atelie_documento_criar', 'atelie_modelos_listar', 'dossie_ameaca_criar', 'dossie_ficha_criar', 'jukebox_tocar'];

const raizAtlas = path.resolve(import.meta.dirname, '..', '..');
/** Caminho de um projeto vizinho: `--flag <caminho>`, env, ou `../<padrão>`. */
function caminho(flag: string, env: string, padrao: string): string {
  const i = process.argv.indexOf(flag);
  const arg = i >= 0 ? process.argv[i + 1] : process.env[env];
  if (i >= 0 && !arg) { console.error(`Falta o caminho depois de ${flag}.`); process.exit(2); }
  return path.resolve(arg ? path.resolve(arg) : path.join(raizAtlas, '..', padrao));
}
const projetos = [
  { nome: 'Atlas', raiz: raizAtlas, opcional: false },
  { nome: 'Mesa', raiz: caminho('--mesa', 'MESA_DIR', 'Mesa'), opcional: false },
  { nome: 'Ateliê', raiz: caminho('--atelie', 'ATELIE_DIR', 'Atelie'), opcional: true },
  { nome: 'Dossiê', raiz: caminho('--dossie', 'DOSSIE_DIR', 'Dossie'), opcional: true },
];

function* arquivos(pasta: string): Generator<string> {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) yield* arquivos(p); else yield p;
  }
}

const temporarias: string[] = [];
let falhou = false;
try {
  for (const { nome, raiz, opcional } of projetos) {
    if (opcional && !fs.existsSync(raiz)) { console.warn(`${nome}: ${raiz} não existe; pulado.`); continue; }
    if (!['vite.config.ts', 'vite.config.js'].some(c => fs.existsSync(path.join(raiz, c)))) { console.error(`${nome}: ${raiz} não parece um projeto Vite.`); falhou = true; continue; }
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), `ponte-build-${nome.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}-`));
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
    if (nome === 'Atlas') {
      const saidaDesktop = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-build-atlas-desktop-'));
      temporarias.push(saidaDesktop);
      const d = spawnSync('npx', ['vite', 'build', '--mode', 'desktop', '--outDir', saidaDesktop, '--emptyOutDir'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } });
      if (d.status !== 0) { console.error(`Atlas (desktop): o build falhou.\n${d.stdout}${d.stderr}`); falhou = true; }
      else if (![...arquivos(saidaDesktop)].some(arq => fs.readFileSync(arq, 'latin1').includes('conectarPonte'))) {
        falhou = true;
        console.error('Atlas (desktop): o build `--mode desktop` NÃO contém `conectarPonte`. Confira a trava `VITE_PONTE` em src/main.tsx e o `.env.desktop`; sem ela o app de desktop fica sem a ponte.');
      } else console.log('Atlas (desktop): ok (o build desktop contém a ponte)');
    }
    if (achados.length) { falhou = true; console.error(`${nome}: a ponte vazou para o build:\n${achados.map(a => `  ${a}`).join('\n')}`); }
    else console.log(`${nome}: ok (${total} arquivos sem a ponte)`);
  }
} finally {
  for (const t of temporarias) fs.rmSync(t, { recursive: true, force: true });
}
process.exit(falhou ? 1 : 0);
