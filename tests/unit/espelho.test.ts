import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa } from '../../src/domain/mapa.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { descreverReceita } from '../../src/procedural/receitas/index.ts';
import { caixaDasPartes, espelharDescricao, poli, ret, type Descricao, type DescricaoDePiso } from '../../src/procedural/descricao.ts';

const assimetrica: Descricao = { tipo: 'piso', pegada: [2, 1], partes: [poli([0, 0, 1, 0, 1, 0.5], '#ffffff', 1, { dir: 0.3 }), ret(0.5, 0, 1, 1, 'madeira.media', 0.5)] };

test('espelhar duas vezes devolve a mesma descrição', () => {
  const arredondar = (d: Descricao) => JSON.parse(JSON.stringify(d), (_k, v) => (typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v));
  assert.deepEqual(arredondar(espelharDescricao(espelharDescricao(assimetrica))), arredondar(assimetrica));
  const d = descreverReceita('escrivaninha', { seed: 3, params: {} });
  assert.deepEqual(arredondar(espelharDescricao(espelharDescricao(d))), arredondar(d));
});
test('a pegada não muda e o poli assimétrico tem o x negado', () => {
  const e = espelharDescricao(assimetrica);
  assert.equal(e.tipo, 'piso');
  if (e.tipo !== 'piso') return;
  assert.deepEqual(e.pegada, [2, 1]);
  assert.deepEqual(e.partes[0]!.pts, [-1, 0.5, -1, 0, 0, 0], 'pontos invertidos e com x negado');
  assert.equal(e.partes[0]!.dir, Math.PI - 0.3);
  assert.equal(e.partes[1]!.x, -0.5);
  const a = caixaDasPartes((assimetrica as DescricaoDePiso).partes), b = caixaDasPartes(e.partes);
  assert.equal(b.x0, -a.x1); assert.equal(b.x1, 0 - a.x0); assert.equal(b.y0, a.y0);
});
test('na parede, espelha o eixo u da face e do topo', () => {
  const d: Descricao = { tipo: 'parede', largura: 1, face: [ret(0.3, 0.5, 0.2, 0.2, '#fff', 1)], topo: [ret(-0.2, 0.1, 0.1, 0.1, '#fff', 1)] };
  const e = espelharDescricao(d);
  assert.equal(e.tipo === 'parede' && e.face[0]!.x, -0.3);
  assert.equal(e.tipo === 'parede' && e.topo[0]!.x, 0.2);
});
test('a validação aceita flip e opacity, e rejeita opacity fora de [0,1; 1]', () => {
  const com = (extra: object) => { const m = criarMapa({ id: 'm', agora: 1 }); const o = novoObjeto([1, 1], extra); m.props[o.id] = o; return m; };
  validarMapa(com({ flip: true, opacity: 0.5 }));
  assert.throws(() => validarMapa(com({ opacity: 0 })));
  assert.throws(() => validarMapa(com({ opacity: 2 })));
  assert.throws(() => validarMapa(com({ flip: 'sim' })));
});
