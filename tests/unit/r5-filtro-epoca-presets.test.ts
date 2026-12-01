import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa } from '../../src/domain/mapa.ts';
import { PRESETS_DE_LUZ, estiloDeTelhado, generosVisiveis, presetDeLuz, telhadoPadrao } from '../../src/domain/presets.ts';
import { FAMILIAS, familiasVisiveis } from '../../src/procedural/familias.ts';
import { RECEITAS } from '../../src/procedural/receitas/index.ts';
import { materiaisDo } from '../../src/procedural/materiais.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { materiaisDe } from '../../src/authoring/mobiliar.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const HISTORICOS = ['antiguidade', 'oriental', 'deserto', 'faroeste', 'colonial', 'vitoriano'] as const;

const KITS_IRMAOS: Record<(typeof HISTORICOS)[number], readonly string[]> = {
  antiguidade: ['torii', 'mesa-de-latao', 'balcao-de-saloon', 'mesa-de-cartografo', 'maquina-a-vapor', 'dirigivel'],
  oriental: ['mesa-romana', 'mesa-de-latao', 'balcao-de-saloon', 'mesa-de-cartografo', 'maquina-a-vapor', 'dirigivel'],
  deserto: ['mesa-romana', 'torii', 'balcao-de-saloon', 'mesa-de-cartografo', 'maquina-a-vapor', 'dirigivel'],
  faroeste: ['mesa-romana', 'torii', 'mesa-de-latao', 'mesa-de-cartografo', 'maquina-a-vapor', 'dirigivel'],
  colonial: ['mesa-romana', 'torii', 'mesa-de-latao', 'balcao-de-saloon', 'maquina-a-vapor', 'dirigivel'],
  vitoriano: ['mesa-romana', 'torii', 'mesa-de-latao', 'balcao-de-saloon', 'mesa-de-cartografo'],
};

const NATIVAS: Record<(typeof HISTORICOS)[number], readonly string[]> = {
  antiguidade: ['mesa-romana', 'lucerna', 'anfora'],
  oriental: ['torii', 'mesa-baixa', 'tansu'],
  deserto: ['mesa-de-latao', 'narguile', 'kilim'],
  faroeste: ['balcao-de-saloon', 'mesa-de-poquer', 'piano'],
  colonial: ['mesa-de-cartografo', 'canhao-naval', 'piano'],
  vitoriano: ['maquina-a-vapor', 'dirigivel', 'piano'],
};

test('familiasVisiveis: gêneros históricos herdam famílias-base sem vazar kits de épocas irmãs', () => {
  const visiveis = (g: string) => new Set(familiasVisiveis(g, null).map(f => f.id));

  for (const g of HISTORICOS) {
    const ids = visiveis(g);
    assert.ok(ids.has('lareira'), `${g} deve incluir a família base lareira`);
    assert.ok(ids.has('castical'), `${g} deve incluir a família base castical`);
    for (const nativa of NATIVAS[g]) {
      assert.ok(ids.has(nativa), `${g} deve incluir sua família nativa ${nativa}`);
    }
    for (const irma of KITS_IRMAOS[g]) {
      assert.ok(!ids.has(irma), `${g} não deve vazar a família irmã ${irma}`);
    }
  }

  for (const g of ['faroeste', 'colonial', 'vitoriano'] as const) {
    assert.ok(!visiveis(g).has('tv-de-parede'), `${g} não deve incluir tv-de-parede`);
  }

  const fantasiaIds = visiveis('fantasia');
  for (const f of FAMILIAS) {
    if (f.generos?.includes('fantasia')) {
      assert.ok(fantasiaIds.has(f.id), `fantasia ainda deve ver ${f.id}`);
    }
  }
});

test('generosVisiveis normaliza gênero desconhecido para investigacao', () => {
  assert.deepEqual(generosVisiveis('desconhecido'), ['investigacao']);
  assert.deepEqual(
    familiasVisiveis('desconhecido', null).map(f => f.id),
    familiasVisiveis('investigacao', null).map(f => f.id),
  );
});

test('receitas com luz() só devolvem preset ausente ou existente em PRESETS_DE_LUZ', () => {
  const presets = new Set(PRESETS_DE_LUZ.map(p => p.id));
  for (const r of Object.values(RECEITAS)) {
    if (!r.luz) continue;
    const pedido = r.luz({});
    if (!pedido) continue;
    if (pedido.preset !== undefined) {
      assert.ok(presets.has(pedido.preset) && presetDeLuz(pedido.preset), `${r.id}: preset de luz desconhecido “${pedido.preset}”`);
    }
  }
  for (const id of ['cogumelo-gigante', 'cristal', 'fumarola']) {
    const pedido = RECEITAS[id]!.luz!({});
    assert.ok(pedido, id);
    assert.equal(pedido!.preset, undefined, `${id} deve omitir preset para virar null em luz-propria`);
  }
});

test('telhadoPadrao para tenda usa lona, conves usa piso conves e funcaoProvavel reconhece jardim', () => {
  const m = criarMapa();
  m.style.genre = 'deserto';
  assert.deepEqual(telhadoPadrao(m, 'tenda', [[2, 2]]), estiloDeTelhado('tenda')!.roof);

  const pisos = new Set(materiaisDo('piso').map(p => p.id));
  assert.ok(pisos.has('conves'));
  assert.ok(materiaisDe('colonial', 'conves').pisos.includes('conves'));

  for (const nome of ['Jardim', 'Jardim zen', 'Jardim seco', 'Jardim oriental']) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: nome })), 'c')!);
    assert.equal(p?.funcao, 'jardim', nome);
  }
});
