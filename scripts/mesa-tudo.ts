/**
 * mesa-dev — todos os aplicativos da mesa numa origem só, com um comando (`npm run mesa-dev`).
 *
 * Cada projeto sobe do jeito que se comporta sob um prefixo (`/Atlas/`, `/Ficha/`…):
 *  - com Vite de desenvolvimento e `base` própria (Atlas, Ficha, Mesa): `npm run dev:mesa` do projeto;
 *  - estático, como no GitHub Pages (Ateliê e Tabletop: o `dev` deles precisa de um servidor de API, que não existe atrás do proxy;
 *    a versão `--mode pages` guarda tudo no navegador e usa caminhos relativos) e o Jukebox (arquivos soltos, sem build).
 * Nenhum arquivo de outro projeto é alterado: só se gera o `dist-pages/` (ignorado pelo git) quando falta ou está velho.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export interface ProjetoVite { tipo: 'vite'; nome: string; pasta: string; porta: number }
export interface ProjetoEstatico { tipo: 'estatico'; nome: string; pasta: string; /** Pasta servida (relativa a `pasta`). */ servir: string; /** Como gerar a pasta servida, se precisar. */ construir?: { args: string[]; fontes: string[] } }
export type PlanoDoProjeto = ProjetoVite | ProjetoEstatico;

/** Os aplicativos da mesa e como cada um sobe. `raiz` é a pasta que contém os projetos (`Projects/`). */
export function planoDosProjetos(raiz: string): PlanoDoProjeto[] {
  const fontesDeBuild = ['src', 'public', 'index.html', 'package.json', 'vite.config.js', 'vendor'];
  return [
    { tipo: 'vite', nome: 'Atlas', pasta: path.join(raiz, 'Atlas'), porta: 5190 },
    { tipo: 'vite', nome: 'Mesa', pasta: path.join(raiz, 'Mesa'), porta: 5195 },
    { tipo: 'vite', nome: 'Ficha', pasta: path.join(raiz, 'Ficha teste - Ordem II'), porta: 5173 },
    { tipo: 'estatico', nome: 'Atelie', pasta: path.join(raiz, 'Atelie'), servir: 'dist-pages', construir: { args: ['vite', 'build', '--mode', 'pages'], fontes: fontesDeBuild } },
    { tipo: 'estatico', nome: 'Tabletop', pasta: path.join(raiz, 'Tabletop'), servir: 'dist-pages', construir: { args: ['vite', 'build', '--mode', 'pages'], fontes: fontesDeBuild } },
    { tipo: 'estatico', nome: 'Jukebox', pasta: path.join(raiz, 'Jukebox'), servir: '.' },
  ];
}

/** O instante da modificação mais recente entre os arquivos (recursivo; ignora o que não existe, `node_modules` e `.git`). Só arquivos contam: o instante de uma pasta muda ao criar nela, não ao editar. */
export function modificadoPorUltimo(caminhos: readonly string[]): number {
  let maior = 0;
  const ver = (p: string): void => {
    let st: fs.Stats;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isFile()) maior = Math.max(maior, st.mtimeMs);
    else if (st.isDirectory()) for (const nome of fs.readdirSync(p)) if (nome !== 'node_modules' && nome !== '.git') ver(path.join(p, nome));
  };
  caminhos.forEach(ver);
  return maior;
}

/** O build estático falta ou ficou para trás de alguma fonte. */
export function precisaConstruir(p: ProjetoEstatico): boolean {
  if (!p.construir) return false;
  let feito = 0;
  try { feito = fs.statSync(path.join(p.pasta, p.servir, 'index.html')).mtimeMs; } catch { return true; }
  return modificadoPorUltimo(p.construir.fontes.map(f => path.join(p.pasta, f))) > feito;
}

/** A porta tem alguém ouvindo? */
export const portaOcupada = (porta: number): Promise<boolean> => new Promise(resolve => {
  const s = net.connect(porta, '127.0.0.1');
  s.once('connect', () => { s.destroy(); resolve(true); });
  s.once('error', () => resolve(false));
});

async function esperarPorta(porta: number, ms: number): Promise<boolean> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) { if (await portaOcupada(porta)) return true; await new Promise(r => setTimeout(r, 250)); }
  return false;
}

function prefixar(nome: string, filho: ChildProcess): void {
  for (const fluxo of [filho.stdout, filho.stderr]) {
    let resto = '';
    fluxo?.on('data', (d: Buffer) => { const linhas = (resto + d.toString()).split('\n'); resto = linhas.pop() ?? ''; for (const l of linhas) if (l.trim()) console.log(`[${nome}] ${l}`); });
  }
}

function executar(nome: string, comando: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): { filho: ChildProcess; fim: Promise<number> } {
  const filho = spawn(comando, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  prefixar(nome, filho);
  return { filho, fim: new Promise(res => { filho.on('exit', c => res(c ?? 1)); filho.on('error', () => res(1)); }) };
}

export interface Subida { argumentosDoProxy: string[]; filhos: ChildProcess[]; avisos: string[] }

/**
 * Prepara e sobe os projetos escolhidos (`so`: nomes; vazio = todos). Devolve os argumentos `Nome=…` para o proxy.
 * Um projeto que já responde na porta é reaproveitado; um que não sobe vira aviso, e o proxy segue com os outros.
 */
export async function subirProjetos(raiz: string, so: readonly string[] = []): Promise<Subida> {
  const plano = planoDosProjetos(raiz).filter(p => !so.length || so.includes(p.nome)), filhos: ChildProcess[] = [], avisos: string[] = [], argumentosDoProxy: string[] = [];
  const faltando = plano.filter(p => !fs.existsSync(p.pasta));
  for (const p of faltando) avisos.push(`${p.nome}: pasta não encontrada em ${p.pasta}.`);
  const presentes = plano.filter(p => fs.existsSync(p.pasta));

  // 1. Builds estáticos que faltam ou estão velhos (em paralelo).
  await Promise.all(presentes.filter((p): p is ProjetoEstatico => p.tipo === 'estatico' && precisaConstruir(p)).map(async p => {
    console.log(`[${p.nome}] gerando ${p.servir}/ (vite build --mode pages)…`);
    const { fim } = executar(p.nome, 'npx', p.construir!.args, p.pasta);
    if (await fim !== 0) avisos.push(`${p.nome}: o build falhou; servindo o ${p.servir}/ que existir.`);
  }));

  // 2. Servidores de desenvolvimento.
  const vites = presentes.filter((p): p is ProjetoVite => p.tipo === 'vite');
  for (const p of vites) {
    if (await portaOcupada(p.porta)) { console.log(`[${p.nome}] a porta ${p.porta} já responde: reaproveitando.`); continue; }
    const { filho, fim } = executar(p.nome, 'npm', ['run', 'dev:mesa'], p.pasta);
    filhos.push(filho);
    void fim.then(c => { if (c !== 0) avisos.push(`${p.nome}: o servidor de desenvolvimento terminou com código ${c}.`); });
  }
  for (const p of vites) {
    if (await esperarPorta(p.porta, 60_000)) argumentosDoProxy.push(`${p.nome}=${p.porta}`);
    else avisos.push(`${p.nome}: não respondeu na porta ${p.porta} em 60 s.`);
  }

  // 3. Estáticos: o próprio proxy serve.
  for (const p of presentes) if (p.tipo === 'estatico') {
    const pasta = path.resolve(p.pasta, p.servir);
    if (fs.existsSync(path.join(pasta, 'index.html'))) argumentosDoProxy.push(`${p.nome}=estatico:${pasta}`);
    else avisos.push(`${p.nome}: sem ${p.servir}/index.html para servir.`);
  }
  return { argumentosDoProxy, filhos, avisos };
}
