import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { aplicarEmCopia, comodos, objetos, portas } from '../../src/authoring/construcao.ts';
import { MAX_ACHADOS, revisarMapa } from '../../src/authoring/revisao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { lerMapa } from '../../src/domain/migracoes.ts';

test('comodo-sem-acesso: dispara sem porta para fora e passa quando há acesso direto ou por vizinho', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Sala' },
    { rets: [[5, 2, 8, 5]], tipo: 'quarto', nome: 'Quarto' },
  ]).comandos);

  // Nenhuma porta: os dois cômodos ficam sem acesso.
  const semAcesso = revisarMapa(m, { regras: ['comodo-sem-acesso'] });
  assert.equal(semAcesso.length, 2);
  assert.ok(semAcesso.every(a => a.gravidade === 'erro' && a.regra === 'comodo-sem-acesso'));

  // Porta da Sala para fora e porta entre Sala e Quarto: ambos passam a ter acesso (via BFS).
  m = aplicarEmCopia(m, portas(m, [
    { perto: [4.5, 3.0], tipo: 'door' },
    { perto: [7.5, 5.25], tipo: 'door' },
  ]).comandos);
  assert.deepEqual(revisarMapa(m, { regras: ['comodo-sem-acesso'] }), []);
});

test('edificio-sem-telhado: dispara em mapa exterior sem cobertura e ignora mapa vazio ou edifício coberto', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m.terrain.base = 'grama';
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Casa', telhado: null },
  ]).comandos);

  const achados = revisarMapa(m, { regras: ['edificio-sem-telhado'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'aviso');

  // Em mapa com base 'vazio' (masmorra/interior), não dispara.
  const mVazio = { ...m, terrain: { ...m.terrain, base: 'vazio' } };
  assert.deepEqual(revisarMapa(mVazio, { regras: ['edificio-sem-telhado'] }), []);

  // Com telhado definido, não dispara.
  let mCoberto = criarMapa({ largura: 30, altura: 20 });
  mCoberto.terrain.base = 'grama';
  mCoberto = aplicarEmCopia(mCoberto, comodos(mCoberto, [
    { rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Casa', telhado: 'casa-de-telha' },
  ]).comandos);
  assert.deepEqual(revisarMapa(mCoberto, { regras: ['edificio-sem-telhado'] }), []);
});

test('interior-vazio: dispara em cômodo ≥ 9 m² sem objetos suficientes e ignora corredor ou cômodo mobiliado', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  // 2×2 células = 3×3 m = 9 m² (mínimo 1 objeto); corredor 2×4 células (ignorado).
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 4, 4]], tipo: 'quarto', nome: 'Quarto vazio' },
    { rets: [[4, 2, 6, 6]], tipo: 'corredor', nome: 'Corredor' },
  ]).comandos);

  const vazios = revisarMapa(m, { regras: ['interior-vazio'] });
  assert.equal(vazios.length, 1);
  assert.equal(vazios[0]!.gravidade, 'aviso');
  assert.match(vazios[0]!.sugestao, /atlas_mobiliar/);

  // Colocando 1 objeto de piso dentro do quarto de 9 m², passa.
  m = aplicarEmCopia(m, objetos(m, [{ item: 'cama.solteiro', pos: [4.5, 4.5] }]).comandos);
  assert.deepEqual(revisarMapa(m, { regras: ['interior-vazio'] }), []);
});

test('porta-bloqueada: dispara quando móvel bloqueante fica sobre a reserva de porta e passa quando afastado', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 6, 6]], tipo: 'sala', nome: 'Sala' },
  ]).comandos);
  // A reserva da porta de entrada fica no meio da parede externa (ex.: [6.0, 3.0]); colocar um armário em cima bloqueia.
  const comBloqueio = aplicarEmCopia(m, objetos(m, [
    { item: 'armario', pos: [6.0, 3.3], rotacao: 0 },
  ]).comandos);
  const achados = revisarMapa(comBloqueio, { regras: ['porta-bloqueada'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'erro');

  // Móvel no centro da sala não bloqueia a reserva de porta.
  const livre = aplicarEmCopia(m, objetos(m, [
    { item: 'mesa.redonda', pos: [6.0, 6.0], rotacao: 0 },
  ]).comandos);
  assert.deepEqual(revisarMapa(livre, { regras: ['porta-bloqueada'] }), []);
});

test('objeto-fora: dispara para objeto fora dos limites e passa para objeto dentro', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  const fora = aplicarEmCopia(m, objetos(m, [{ item: 'caixa', pos: [-2, 10] }]).comandos);
  const achados = revisarMapa(fora, { regras: ['objeto-fora'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'erro');

  const dentro = aplicarEmCopia(m, objetos(m, [{ item: 'caixa', pos: [10, 10] }]).comandos);
  assert.deepEqual(revisarMapa(dentro, { regras: ['objeto-fora'] }), []);
});

test('escala-suspeita: dispara para árvore < 2,5 m ou rochedo < 1,5 m e passa em escala real', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  const miudos = aplicarEmCopia(m, objetos(m, [
    { item: 'casa:arvore-3m', pos: [5, 5], escala: 0.5 },
    { item: 'rochedo', pos: [10, 5], escala: 0.4 },
  ]).comandos);
  const achados = revisarMapa(miudos, { regras: ['escala-suspeita'] });
  assert.equal(achados.length, 2);
  assert.ok(achados.every(a => a.gravidade === 'dica'));

  const normais = aplicarEmCopia(m, objetos(m, [
    { item: 'casa:arvore-5m', pos: [5, 5], escala: 1 },
    { item: 'rochedo', pos: [10, 5], escala: 1.5 },
  ]).comandos);
  assert.deepEqual(revisarMapa(normais, { regras: ['escala-suspeita'] }), []);
});

test('revisarMapa: ordena por gravidade (erro, aviso, dica) e limita a 15 achados com resumo mais', () => {
  let m = criarMapa({ largura: 45, altura: 30 });
  m.terrain.base = 'grama';
  // Cria 1 cômodo sem porta e sem telhado (gera erro comodo-sem-acesso + aviso edificio-sem-telhado + aviso interior-vazio)
  // e 16 árvores minúsculas (16 dicas escala-suspeita) -> mais de 15 achados no total.
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Sala isolada', telhado: null },
  ]).comandos);
  m = aplicarEmCopia(m, objetos(m, Array.from({ length: 16 }, (_, i) => ({
    item: 'casa:arvore-3m',
    pos: [2 + i * 2, 15] as [number, number],
    escala: 0.4,
  }))).comandos);

  const achados = revisarMapa(m);
  assert.equal(achados.length, MAX_ACHADOS);
  assert.equal(achados[0]!.gravidade, 'erro');
  assert.ok(achados.some(a => a.gravidade === 'aviso'));
  assert.equal(achados.at(-1)!.regra, 'mais');
  assert.match(achados.at(-1)!.mensagem, /Mais 5 achado/);
});

test('revisarMapa nos exemplos da Fase 10 não aponta nenhum erro', () => {
  const arquivos = readdirSync('public/exemplos').filter(f => f.endsWith('.atlas.json'));
  assert.ok(arquivos.length >= 8);
  for (const arq of arquivos) {
    const m = lerMapa(JSON.parse(readFileSync(`public/exemplos/${arq}`, 'utf8')));
    const erros = revisarMapa(m).filter(a => a.gravidade === 'erro');
    assert.deepEqual(erros, [], `Exemplo ${arq} teve erros: ${JSON.stringify(erros)}`);
  }
});
