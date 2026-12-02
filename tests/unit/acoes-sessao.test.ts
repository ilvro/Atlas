import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mocks para ambiente Node
const storageMock: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new Proxy(storageMock, {
    get(target, prop: string) {
      if (prop === 'getItem') return (k: string) => target[k] ?? null;
      if (prop === 'setItem') return (k: string, v: string) => { target[k] = String(v); };
      if (prop === 'removeItem') return (k: string) => { delete target[k]; };
      if (prop === 'clear') return () => { for (const k in target) delete target[k]; };
      return target[prop];
    },
    set(target, prop: string, value: string) {
      target[prop] = String(value);
      return true;
    },
  });
}
if (typeof globalThis.location === 'undefined') {
  globalThis.location = { hash: '', pathname: '/', href: 'http://localhost/' } as any;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    open: () => null,
  } as any;
}

import { acaoPorId, liberadaNaSessao } from '../../src/app/acoes.ts';

test('na Sessão, remover vale só para objetos, luzes e peças; I só com luz selecionada', () => {
  const remover = acaoPorId('remover')!, luz = acaoPorId('luz-acesa')!;
  assert.ok(remover && luz);
  assert.equal(liberadaNaSessao(remover, [{ colecao: 'props' }]), true);
  assert.equal(liberadaNaSessao(remover, [{ colecao: 'props' }, { colecao: 'lights' }]), true);
  assert.equal(liberadaNaSessao(remover, [{ colecao: 'tokens' }]), true);
  assert.equal(liberadaNaSessao(remover, [{ colecao: 'props' }, { colecao: 'rooms' }]), false);
  assert.equal(liberadaNaSessao(remover, [{ colecao: 'walls' }]), false);
  assert.equal(liberadaNaSessao(remover, []), false);
  assert.equal(liberadaNaSessao(luz, [{ colecao: 'lights' }]), true);
  assert.equal(liberadaNaSessao(luz, [{ colecao: 'props' }]), false);
  assert.equal(liberadaNaSessao(acaoPorId('duplicar')!, [{ colecao: 'props' }]), false);
});
