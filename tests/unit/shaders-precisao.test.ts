import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// No WebKitGTK o fragmento em mediump faz o ruído (hash com sin) degenerar:
// todo GlProgram.from precisa pedir precisão alta.
test('todo GlProgram.from de src/render pede precisão highp no fragmento', () => {
  const pasta = join(process.cwd(), 'src', 'render');
  const faltando: string[] = [];
  for (const nome of readdirSync(pasta).filter((n) => n.endsWith('.ts'))) {
    const linhas = readFileSync(join(pasta, nome), 'utf8').split('\n');
    linhas.forEach((linha, i) => {
      if (!linha.includes('GlProgram.from(')) return;
      // a chamada pode ocupar algumas linhas: olha até o fechamento
      const trecho = linhas.slice(i, i + 6).join('\n');
      if (!trecho.includes("preferredFragmentPrecision: 'highp'")) faltando.push(`${nome}:${i + 1}`);
    });
  }
  assert.deepEqual(faltando, []);
});
