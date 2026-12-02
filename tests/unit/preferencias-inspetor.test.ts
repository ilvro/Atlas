import { test } from 'node:test';
import assert from 'node:assert/strict';

const storageMock: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => storageMock[k] ?? null,
    setItem: (k: string, v: string) => { storageMock[k] = String(v); },
    removeItem: (k: string) => { delete storageMock[k]; },
    clear: () => { for (const k of Object.keys(storageMock)) delete storageMock[k]; },
    key: (i: number) => Object.keys(storageMock)[i] ?? null,
    get length() { return Object.keys(storageMock).length; },
  };
}

import {
  CHAVE_INSPETOR_ABERTO,
  definirInspetorAberto,
  inspetorAberto,
  inspetorAbertoInicial,
} from '../../src/app/preferencias.ts';

test('inspetorAbertoInicial abre em telas largas sem valor salvo e recolhe em viewports compactos', () => {
  assert.equal(inspetorAbertoInicial(null, 1280), true);
  assert.equal(inspetorAbertoInicial(null, 961), true);
  assert.equal(inspetorAbertoInicial(null, 960), false);
  assert.equal(inspetorAbertoInicial(null, 900), false);
  assert.equal(inspetorAbertoInicial(null, undefined), true);
});

test('inspetorAbertoInicial respeita preferencia salva independente da largura', () => {
  assert.equal(inspetorAbertoInicial('0', 1280), false);
  assert.equal(inspetorAbertoInicial('1', 900), true);
});

test('definirInspetorAberto atualiza o signal e persiste no localStorage', () => {
  definirInspetorAberto(false);
  assert.equal(inspetorAberto.value, false);
  assert.equal(globalThis.localStorage.getItem(CHAVE_INSPETOR_ABERTO), '0');

  definirInspetorAberto(true);
  assert.equal(inspetorAberto.value, true);
  assert.equal(globalThis.localStorage.getItem(CHAVE_INSPETOR_ABERTO), '1');
});
