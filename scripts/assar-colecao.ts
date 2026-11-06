/**
 * Assa os geradores pesados (src/procedural/pesados/) em WebP, grava em public/colecao/gerados/ e atualiza o catálogo e docs/LICENCAS.md.
 * Precisa de navegador (o Node não tem canvas): sobe o Vite e o Chromium do Playwright, como os testes e2e.
 *   npm run assar              todos os geradores
 *   npm run assar -- --so <id>  um gerador só (ex.: chesterfield)
 * Mesma versão e mesmos parâmetros = mesmo arquivo: o que não mudou não é regravado.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { encerrar, iniciarAmbiente } from '../tests/e2e/apoio.ts';
import { PESADOS, idDaVariante } from '../src/procedural/pesados/index.ts';
import { RES_DA_COLECAO, type ItemDaColecao } from '../src/procedural/colecao.ts';

const RAIZ = join(import.meta.dirname, '../public/colecao'), CATALOGO = join(RAIZ, 'colecao.json'), LICENCAS = join(import.meta.dirname, '../docs/LICENCAS.md');
const soIdx = process.argv.indexOf('--so'), so = soIdx >= 0 ? process.argv[soIdx + 1] : null;

const catalogo = JSON.parse(readFileSync(CATALOGO, 'utf8')) as { versao: 1; itens: ItemDaColecao[] };
const antigos = new Map(catalogo.itens.map(i => [i.id, i]));
const itens = new Map(catalogo.itens.map(i => [i.id, i]));
const tabela: { id: string; partes: number | string; ms: number | string; kb: number; estado: string }[] = [];

const ambiente = await iniciarAmbiente();
try {
  const pagina = await ambiente.navegador.newPage();
  await pagina.goto(ambiente.url, { waitUntil: 'domcontentloaded' });
  for (const g of PESADOS) {
    if (so && g.id !== so) continue;
    for (const v of g.variantes) {
      const id = idDaVariante(g, v.sufixo), arquivo = `gerados/${g.id}-${v.sufixo}.webp`, res = g.res ?? RES_DA_COLECAO, caminho = join(RAIZ, arquivo);
      const d = g.gerar({ seed: v.seed, params: v.params }), antigo = antigos.get(id);
      const igual = !!antigo && antigo.origem.tipo === 'gerado' && antigo.origem.versao === g.versao && antigo.origem.seed === v.seed && JSON.stringify(antigo.origem.params) === JSON.stringify(v.params) && (antigo.res ?? RES_DA_COLECAO) === res && existsSync(caminho);
      let partes: number | string = d.partes.length, ms: number | string = '—', estado = 'sem mudança';
      if (!igual) {
        const r = await pagina.evaluate(async ([gid, suf, rs]) => { const caminho = '/src/procedural/pesados/no-navegador.ts', m = await import(/* @vite-ignore */ caminho); return m.assarParaWebp(gid as string, suf as string, rs as number); }, [g.id, v.sufixo, res] as const);
        mkdirSync(dirname(caminho), { recursive: true }); writeFileSync(caminho, Buffer.from(r.dataUrl.split(',')[1]!, 'base64'));
        partes = r.partes; ms = Math.round(r.ms); estado = 'assado';
      }
      itens.set(id, {
        id, nome: `${g.nome} (${v.nome})`, arquivo, categoria: g.categoria, pegada: [Math.round(d.pegada[0] * 100) / 100, Math.round(d.pegada[1] * 100) / 100], funcoes: g.funcoes, tags: g.tags, generos: g.generos, kit: g.kit,
        altura: Math.round(Math.min(12, g.altura ? g.altura(d.pegada) : d.partes.reduce((m, p) => Math.max(m, p.z), 0.1)) * 100) / 100,
        ...(res !== RES_DA_COLECAO ? { res } : {}), origem: { tipo: 'gerado', gerador: g.id, params: v.params, seed: v.seed, versao: g.versao },
      });
      tabela.push({ id, partes, ms, kb: Math.round(statSync(caminho).size / 1024), estado });
    }
  }
} finally { await encerrar(ambiente); }

const final = [...itens.values()].sort((a, b) => a.id.localeCompare(b.id));
const json = JSON.stringify({ versao: 1, itens: final }, null, 2) + '\n';
if (json !== readFileSync(CATALOGO, 'utf8')) writeFileSync(CATALOGO, json);

// docs/LICENCAS.md: a tabela dos gerados fica entre os marcadores.
const texto = readFileSync(LICENCAS, 'utf8'), inicio = '<!-- gerados:inicio -->', fim = '<!-- gerados:fim -->';
const linhas = final.filter(i => i.origem.tipo === 'gerado').map(i => `| ${i.arquivo} | ${(i.origem as { gerador: string }).gerador} | ${i.nome} |`).join('\n');
const bloco = `${inicio}\n| arquivo | gerador | observação |\n| --- | --- | --- |\n${linhas}\n${fim}`;
const novo = texto.includes(inicio) ? texto.replace(new RegExp(`${inicio}[\\s\\S]*?${fim}`), bloco) : texto.replace(/\| arquivo \| gerador \| observação \|\n\| --- \| --- \| --- \|\n/, `${bloco}\n`);
if (novo !== texto) writeFileSync(LICENCAS, novo);

console.log('\nid'.padEnd(34) + 'partes'.padStart(8) + 'ms'.padStart(8) + 'KB'.padStart(7) + '  estado');
for (const l of tabela) console.log(l.id.padEnd(33) + String(l.partes).padStart(8) + String(l.ms).padStart(8) + String(l.kb).padStart(7) + '  ' + l.estado);
