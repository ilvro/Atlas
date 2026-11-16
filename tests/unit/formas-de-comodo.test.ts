import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areaComSinal,
  areaDoPoligono,
  celulasDoContorno,
  circulo,
  ehPoligonoSimples,
  normalizarContorno,
  octogono,
  pontoNoPoligono,
} from '../../src/domain/formas-de-comodo.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { criarMapa, type Ponto } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { comandoDeComodoPorContorno, pontoPreso45 } from '../../src/render/pincel.ts';
import { ErroDeComando } from '../../src/state/comandos-construir.ts';
import { criarStore } from '../../src/state/store.ts';

test('formas-de-comodo: círculo de raio 3 m na grade 1,5 m gera cerca de 12 a 16 células', () => {
  const grade = { size: 1.5, offset: [0, 0] as [number, number] };
  const c = circulo([6, 6], 3);
  assert.equal(c.length, 24);
  assert.ok(ehPoligonoSimples(c));
  assert.ok(areaComSinal(c) < 0, 'anti-horário no mapa');
  assert.ok(Math.abs(areaDoPoligono(c) - Math.PI * 9) < 0.8);

  const celulas = celulasDoContorno(grade, c);
  assert.ok(celulas.length >= 12 && celulas.length <= 16, `esperado 12..16, veio ${celulas.length}`);
  assert.equal(octogono([6, 6], 3).length, 8);
  assert.ok(pontoNoPoligono([6, 6], c));
  assert.ok(!pontoNoPoligono([1, 1], c));
});

test('formas-de-comodo: normalizarContorno reverte polígono horário e limpa colineares', () => {
  const horario: Ponto[] = [[2, 2], [5, 2], [8, 2], [8, 8], [2, 8]]; // sentido horário na tela + ponto colinear no topo
  assert.ok(areaComSinal(horario) > 0);
  const norm = normalizarContorno(horario);
  assert.ok(areaComSinal(norm) < 0);
  assert.equal(norm.length, 4);
});

test('formas-de-comodo: comodo.criar e comodo.atualizar com outline mantêm células e validam', () => {
  const st = criarStore(criarMapa({ largura: 20, altura: 20 }));
  const horario: Ponto[] = [[3, 3], [9, 3], [9, 9], [3, 9]];
  st.executar({
    tipo: 'comodo.criar',
    id: 'torre',
    nome: 'Torre',
    funcao: 'sala',
    piso: { material: 'pedra', seed: 1 },
    papel: null,
    celulas: [[0, 0]], // deve ser ignorado quando outline vem
    outline: horario,
  });
  const torre = st.documento.rooms.torre!;
  validarMapa(st.documento);
  assert.ok(torre.outline);
  assert.ok(areaComSinal(torre.outline!) < 0, 'gravado em anti-horário');
  const cels = decodificar(torre.cells);
  assert.equal(cels.length, 16, '6x6 m = 4x4 células de 1,5 m');
  assert.ok(!cels.some(([x, y]) => x === 0 && y === 0));

  // Autointerseção e contorno sem células são recusados com ErroDeComando
  assert.throws(() => st.executar({
    tipo: 'comodo.criar',
    id: 'laco',
    nome: 'Laço',
    funcao: 'sala',
    piso: { material: 'pedra', seed: 1 },
    papel: null,
    celulas: [],
    outline: [[2, 2], [8, 8], [8, 2], [2, 8]],
  }), ErroDeComando);

  assert.throws(() => st.executar({
    tipo: 'comodo.criar',
    id: 'fora',
    nome: 'Fora',
    funcao: 'sala',
    piso: { material: 'pedra', seed: 1 },
    papel: null,
    celulas: [],
    outline: [[30, 30], [34, 30], [34, 34], [30, 34]],
  }), ErroDeComando);

  // outline: null converte de volta em cômodo de células preservando as células atuais
  st.executar({ tipo: 'comodo.atualizar', id: 'torre', patch: { outline: null } });
  validarMapa(st.documento);
  assert.equal(st.documento.rooms.torre!.outline, undefined);
  assert.equal(decodificar(st.documento.rooms.torre!.cells).length, 16);
});

test('ferramenta de cômodo livre: pontoPreso45 trava múltiplos de 45° e comandoDeComodoPorContorno gera cone no círculo', () => {
  const p = pontoPreso45([3, 3], [6, 3.1]);
  assert.ok(Math.abs(p[1] - 3) < 1e-6);
  assert.ok(p[0] > 5.9);

  const diag = pontoPreso45([0, 0], [3, 2.9]);
  assert.ok(Math.abs(diag[0] - diag[1]) < 1e-6);

  const m = criarMapa({ id: 'm', agora: 1 });
  const c = comandoDeComodoPorContorno(m, circulo([6, 6], 3, 24), 'sala', 'torre1', 42);
  assert.equal(typeof c, 'object');
  if (typeof c === 'string') return;
  assert.equal(c.tipo, 'comodo.criar');
  assert.equal(typeof c.telhado, 'object');
  assert.equal((c.telhado as { shape?: string }).shape, 'cone');

  const st = criarStore(m);
  st.executar(c);
  assert.ok(st.documento.rooms.torre1?.outline);
  assert.equal(st.documento.rooms.torre1!.roof.shape, 'cone');

  // Autointerseção e área mínima recusam com mensagem legível
  assert.equal(typeof comandoDeComodoPorContorno(m, [[0, 0], [4, 4], [4, 0], [0, 4]], 'sala', 'bad'), 'string');
  assert.equal(typeof comandoDeComodoPorContorno(m, [[3, 3], [3.5, 3], [3.5, 3.5]], 'sala', 'mini'), 'string');
});
