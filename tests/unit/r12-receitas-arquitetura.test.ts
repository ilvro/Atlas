import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ_RECEITAS = path.resolve(import.meta.dirname, '../../src/procedural/receitas');

const ARQUIVOS_DE_EPOCA = [
  'antiguidade',
  'oriental',
  'deserto',
  'faroeste',
  'colonial',
  'vitoriano',
  'moderno-urbano',
  'pos-apocaliptico',
  'cyberpunk',
] as const;

const EXCECOES_PERMITIDAS = new Set([
  'pos-apocaliptico->moderno-urbano',
  'cyberpunk->moderno-urbano',
]);

function extrairImportsLocais(conteudo: string): string[] {
  const alvos: string[] = [];
  const rx = /\bfrom\s+['"]\.\/([^'"]+)['"]/g;
  for (const m of conteudo.matchAll(rx)) alvos.push(m[1]!.replace(/\.ts$/, ''));
  return alvos;
}

test('R12: kits de época não importam uns dos outros (exceto extensões modernas explícitas)', () => {
  const epocas = new Set<string>(ARQUIVOS_DE_EPOCA);
  const violacoes: string[] = [];

  for (const origem of ARQUIVOS_DE_EPOCA) {
    const caminho = path.join(RAIZ_RECEITAS, `${origem}.ts`);
    const conteudo = fs.readFileSync(caminho, 'utf8');
    for (const alvo of extrairImportsLocais(conteudo)) {
      if (!epocas.has(alvo) || alvo === origem) continue;
      const par = `${origem}->${alvo}`;
      if (!EXCECOES_PERMITIDAS.has(par)) violacoes.push(par);
    }
  }

  assert.deepEqual(violacoes, [], `Imports cruzados proibidos entre kits de época: ${violacoes.join(', ')}`);
});

test('R12: formas.ts não importa nenhum kit de época ou arquivo de receita', () => {
  const conteudo = fs.readFileSync(path.join(RAIZ_RECEITAS, 'formas.ts'), 'utf8');
  const locais = extrairImportsLocais(conteudo);
  assert.deepEqual(locais, [], `formas.ts não deve depender de outros arquivos em receitas/: ${locais.join(', ')}`);
});
