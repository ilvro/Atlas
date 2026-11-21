import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAIS, type Material } from '../../src/procedural/materiais.ts';
import type { EntradaDeTerreno } from '../../src/procedural/assar.ts';
import { _definirHashDasTexturas, _reiniciarTexturas, garantirTexturas, hashDasTexturas, texturaCarregada, texturasDoTerreno } from '../../src/procedural/texturas-carregadas.ts';
import { chaveDoTerreno } from '../../src/render/entradas.ts';

// Material fictício: nenhum material real tem `textura` ainda.
const mats = MATERIAIS as Record<string, Material>;
const fic = (id: string, texturas: string[]): void => { mats[id] = { ...mats['terra']!, id, textura: { camadas: texturas.map(textura => ({ textura })), tingir: 0.5 } }; };
fic('teste.a', ['lama', 'cascalho']); fic('teste.b', ['cascalho', 'folhas']);
after(() => { delete mats['teste.a']; delete mats['teste.b']; _reiniciarTexturas(); });

const entrada = (base: string, ...camadas: string[]): EntradaDeTerreno => ({ largura: 4, altura: 4, resolucao: 0.5, base, camadas: camadas.map(material => ({ material, celulas: [[0, 0, 4]] as [number, number, number][] })) });

test('texturasDoTerreno lista as texturas da base e das camadas sem repetir', () => {
  assert.deepEqual(texturasDoTerreno(entrada('teste.a', 'teste.b', 'teste.a', 'terra')), ['lama', 'cascalho', 'folhas']);
  assert.deepEqual(texturasDoTerreno(entrada('terra', 'grama#123456')), []);
});

test('chaveDoTerreno muda com o hash do catálogo só quando há textura', () => {
  _reiniciarTexturas();
  const com = entrada('vazio', 'teste.a'), sem = entrada('vazio', 'terra');
  _definirHashDasTexturas('h1'); const c1 = chaveDoTerreno(com, 24), s1 = chaveDoTerreno(sem, 24);
  _definirHashDasTexturas('h2'); const c2 = chaveDoTerreno(com, 24), s2 = chaveDoTerreno(sem, 24);
  assert.ok(c1.endsWith('|txh1') && c2.endsWith('|txh2'));
  assert.notEqual(c1, c2);
  assert.equal(s1, s2); assert.ok(!s1.includes('|tx'));
  assert.ok(!chaveDoTerreno(com, 24, 'pixel').includes('|tx'));
});

test('sem rede o carregamento degrada sem lançar', async () => {
  _reiniciarTexturas();
  const aviso = console.warn; console.warn = () => {};
  try { await garantirTexturas(['lama']); } finally { console.warn = aviso; }
  assert.equal(texturaCarregada('lama'), undefined);
  assert.equal(hashDasTexturas(), 'indisponivel');
});
