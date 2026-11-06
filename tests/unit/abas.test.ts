import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abasAbertas,
  registrarAbaAberta,
  atualizarNomeDaAba,
  lembrarCameraDaAba,
  obterCameraDaAba,
  fecharAba,
  carregarAbasDoStorage,
  CHAVE_ABAS,
} from '../../src/app/abas.ts';

// Configuração do mock de localStorage caso não exista no ambiente do Node
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

function resetar(): void {
  abasAbertas.value = [];
  try {
    localStorage.clear();
  } catch {
    for (const k in storageMock) delete storageMock[k];
  }
}

test('registrarAbaAberta adiciona nova aba e não duplica', () => {
  resetar();
  registrarAbaAberta('mapa-1', 'Cripta');
  assert.equal(abasAbertas.value.length, 1);
  assert.deepEqual(abasAbertas.value[0], { id: 'mapa-1', nome: 'Cripta' });

  // Tentar registrar a mesma aba com o mesmo nome não duplica
  registrarAbaAberta('mapa-1', 'Cripta');
  assert.equal(abasAbertas.value.length, 1);

  // Registrar outra aba
  registrarAbaAberta('mapa-2', 'Taverna');
  assert.equal(abasAbertas.value.length, 2);
  assert.equal(abasAbertas.value[1]?.id, 'mapa-2');

  // Registrar mapa existente com nome novo atualiza o nome sem duplicar
  registrarAbaAberta('mapa-1', 'Cripta Antiga');
  assert.equal(abasAbertas.value.length, 2);
  assert.equal(abasAbertas.value[0]?.nome, 'Cripta Antiga');
});

test('atualizarNomeDaAba altera o nome de uma aba existente', () => {
  resetar();
  registrarAbaAberta('mapa-1', 'Floresta');
  atualizarNomeDaAba('mapa-1', 'Floresta Negra');
  assert.equal(abasAbertas.value[0]?.nome, 'Floresta Negra');

  // Ignora se não existir
  atualizarNomeDaAba('mapa-fantasma', 'Nada');
  assert.equal(abasAbertas.value.length, 1);
});

test('lembrarCameraDaAba e obterCameraDaAba guardam e devolvem a câmera', () => {
  resetar();
  registrarAbaAberta('mapa-1', 'Masmorra');
  assert.equal(obterCameraDaAba('mapa-1'), undefined);

  lembrarCameraDaAba('mapa-1', { x: 120, y: -45, zoom: 32 });
  const cam = obterCameraDaAba('mapa-1');
  assert.deepEqual(cam, { x: 120, y: -45, zoom: 32 });

  // Registrar novamente o mapa preserva a câmera salva
  registrarAbaAberta('mapa-1', 'Masmorra do Horror');
  assert.deepEqual(obterCameraDaAba('mapa-1'), { x: 120, y: -45, zoom: 32 });

  assert.equal(obterCameraDaAba('inexistente'), undefined);
});

test('fecharAba remove a aba e escolhe a vizinha correta', () => {
  resetar();
  registrarAbaAberta('m1', 'Mapa 1');
  registrarAbaAberta('m2', 'Mapa 2');
  registrarAbaAberta('m3', 'Mapa 3');

  // Fechar aba do meio (m2) -> vizinha é m3
  const prox1 = fecharAba('m2');
  assert.equal(prox1, 'm3');
  assert.deepEqual(abasAbertas.value.map(a => a.id), ['m1', 'm3']);

  // Fechar última aba (m3) -> vizinha é m1
  const prox2 = fecharAba('m3');
  assert.equal(prox2, 'm1');
  assert.deepEqual(abasAbertas.value.map(a => a.id), ['m1']);

  // Fechar a única aba restante -> devolve null
  const prox3 = fecharAba('m1');
  assert.equal(prox3, null);
  assert.equal(abasAbertas.value.length, 0);

  // Fechar em lista vazia ou inexistente devolve null
  assert.equal(fecharAba('m1'), null);
});

test('persistência no localStorage', () => {
  resetar();
  registrarAbaAberta('m1', 'Primeiro');
  lembrarCameraDaAba('m1', { x: 10, y: 20, zoom: 30 });
  registrarAbaAberta('m2', 'Segundo');

  const gravado = localStorage.getItem(CHAVE_ABAS) ?? (localStorage as any)[CHAVE_ABAS];
  assert.ok(gravado, 'deve ter gravado no localStorage');
  const dados = JSON.parse(gravado);
  assert.equal(dados.length, 2);
  assert.equal(dados[0].id, 'm1');
  assert.deepEqual(dados[0].camera, { x: 10, y: 20, zoom: 30 });
  assert.equal(dados[1].id, 'm2');

  // carregarAbasDoStorage recupera os dados salvos
  const recuperadas = carregarAbasDoStorage();
  assert.equal(recuperadas.length, 2);
  assert.equal(recuperadas[0]?.nome, 'Primeiro');
  assert.equal(recuperadas[1]?.nome, 'Segundo');
});
