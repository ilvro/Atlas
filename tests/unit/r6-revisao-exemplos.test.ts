import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { aplicarEmCopia, comodos, objetos, portas } from '../../src/authoring/construcao.ts';
import { revisarMapa } from '../../src/authoring/revisao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { lerMapa } from '../../src/domain/migracoes.ts';

test('edificio-sem-telhado: flaga edifício parcialmente sem telhado (1 cômodo coberto e 1 descoberto)', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m.terrain.base = 'grama';
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Sala coberta', telhado: 'casa-de-telha' },
    { rets: [[5, 2, 8, 5]], tipo: 'quarto', nome: 'Quarto descoberto', telhado: null },
  ]).comandos);

  const achados = revisarMapa(m, { regras: ['edificio-sem-telhado'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'aviso');
  assert.equal(achados[0]!.ids.length, 2);

  // Com ambos cobertos, não dispara.
  let mCompleto = criarMapa({ largura: 30, altura: 20 });
  mCompleto.terrain.base = 'grama';
  mCompleto = aplicarEmCopia(mCompleto, comodos(mCompleto, [
    { rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Sala coberta', telhado: 'casa-de-telha' },
    { rets: [[5, 2, 8, 5]], tipo: 'quarto', nome: 'Quarto coberto', telhado: 'casa-de-telha' },
  ]).comandos);
  assert.deepEqual(revisarMapa(mCompleto, { regras: ['edificio-sem-telhado'] }), []);
});

test('escala-suspeita: isenta bonsai da checagem de árvore mínima e mantém checagem para árvores comuns', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m = aplicarEmCopia(m, objetos(m, [
    { item: 'bonsai', pos: [5, 5], escala: 1 },
    { item: 'casa:arvore-3m', pos: [12, 5], escala: 0.5 },
  ]).comandos);

  const achados = revisarMapa(m, { regras: ['escala-suspeita'] });
  assert.equal(achados.length, 1);
  assert.match(achados[0]!.mensagem, /casa:arvore-3m/);

  const templo = lerMapa(JSON.parse(readFileSync('public/exemplos/templo-na-encosta.atlas.json', 'utf8')));
  const escalaTemplo = revisarMapa(templo, { regras: ['escala-suspeita'] });
  assert.equal(escalaTemplo.some(a => a.mensagem.includes('bonsai')), false);
});

test('interior-vazio: isola células e objetos por levelId entre andares sobrepostos', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m.levels = { alto: { id: 'alto', name: '1º andar', order: 1 } };
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 4, 4]], tipo: 'quarto', nome: 'Quarto térreo' },
    { rets: [[2, 2, 4, 4]], tipo: 'quarto', nome: 'Quarto alto', andar: 'alto' },
  ]).comandos);

  const idTerreo = Object.values(m.rooms).find(r => r.name === 'Quarto térreo')!.id;
  const idAlto = Object.values(m.rooms).find(r => r.name === 'Quarto alto')!.id;

  // Mobília apenas no 1º andar (mesmo sem roomId explícito): só o térreo deve acusar interior-vazio.
  m = aplicarEmCopia(m, objetos(m, [
    { item: 'cama.solteiro', pos: [4.5, 4.5], andar: 'alto' },
  ]).comandos);
  const idObjAlto = Object.keys(m.props)[0]!;
  m = { ...m, props: { ...m.props, [idObjAlto]: { ...m.props[idObjAlto]!, roomId: null } } };

  const achados = revisarMapa(m, { regras: ['interior-vazio'] });
  assert.equal(achados.length, 1);
  assert.deepEqual(achados[0]!.ids, [idTerreo]);
  assert.notEqual(achados[0]!.ids[0], idAlto);
});

test('porta-bloqueada: objeto bloqueante em outro levelId não bloqueia porta ou reserva de outro andar', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m.levels = { alto: { id: 'alto', name: '1º andar', order: 1 } };
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[2, 2, 6, 6]], tipo: 'sala', nome: 'Sala térreo' },
    { rets: [[2, 2, 6, 6]], tipo: 'sala', nome: 'Sala alto', andar: 'alto' },
  ]).comandos);
  // Porta apenas no térreo, encaixada no vão de [5.25, 3.0].
  m = aplicarEmCopia(m, portas(m, [{ perto: [5.25, 3.0], tipo: 'door' }]).comandos);

  // Armário no 1º andar exatamente sobre a coordenada da porta do térreo: não deve bloquear o térreo.
  const comArmarioAlto = aplicarEmCopia(m, objetos(m, [
    { item: 'armario', pos: [5.25, 3.3], rotacao: 0, andar: 'alto' },
  ]).comandos);
  assert.deepEqual(revisarMapa(comArmarioAlto, { regras: ['porta-bloqueada'] }), []);

  // Armário no térreo na mesma posição bloqueia a porta do térreo.
  const comArmarioTerreo = aplicarEmCopia(m, objetos(m, [
    { item: 'armario', pos: [5.25, 3.3], rotacao: 0 },
  ]).comandos);
  const achados = revisarMapa(comArmarioTerreo, { regras: ['porta-bloqueada'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'erro');

  // Sem porta colocada ainda (reserva de porta no térreo): bloqueante no 1º andar não dispara para o térreo.
  let mReserva = criarMapa({ largura: 30, altura: 20 });
  mReserva.levels = { alto: { id: 'alto', name: '1º andar', order: 1 } };
  mReserva = aplicarEmCopia(mReserva, comodos(mReserva, [
    { rets: [[2, 2, 6, 6]], tipo: 'sala', nome: 'Sala térreo' },
    { rets: [[8, 8, 10, 10]], tipo: 'sala', nome: 'Sala alto', andar: 'alto' },
  ]).comandos);
  mReserva = aplicarEmCopia(mReserva, objetos(mReserva, [
    { item: 'armario', pos: [6.0, 3.3], rotacao: 0, andar: 'alto' },
  ]).comandos);
  const idArmarioAlto = Object.keys(mReserva.props)[0]!;
  mReserva = { ...mReserva, props: { ...mReserva.props, [idArmarioAlto]: { ...mReserva.props[idArmarioAlto]!, roomId: null } } };
  assert.deepEqual(revisarMapa(mReserva, { regras: ['porta-bloqueada'] }), []);
});

test('exemplos R6 (cidade-da-fronteira, posto-na-estrada, posto-avancado) passam sem erros nem casas-iguais / objeto-externo-no-interior', () => {
  const cidade = lerMapa(JSON.parse(readFileSync('public/exemplos/cidade-da-fronteira.atlas.json', 'utf8')));
  assert.deepEqual(revisarMapa(cidade, { regras: ['casas-iguais'] }), []);
  assert.deepEqual(revisarMapa(cidade).filter(a => a.gravidade === 'erro'), []);

  for (const id of ['posto-na-estrada', 'posto-avancado']) {
    const mapa = lerMapa(JSON.parse(readFileSync(`public/exemplos/${id}.atlas.json`, 'utf8')));
    assert.deepEqual(revisarMapa(mapa, { regras: ['objeto-externo-no-interior'] }), [], `${id} ainda tem objeto-externo-no-interior`);
    assert.deepEqual(revisarMapa(mapa).filter(a => a.gravidade === 'erro'), [], `${id} ainda tem erros`);
  }
});
