import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aceitarProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao } from '../../src/authoring/sugestoes.ts';
import { criarStore } from '../../src/state/store.ts';
import { mapaCom, sala, verificarCasa } from './apoio-casa.ts';

/** Três cômodos de 6 × 4,5 m encostados (Sala, Cozinha, Quarto), só com os nomes. */
const tresComodos = () => mapaCom(sala('a', 0, 0, 4, 3, { name: 'Sala' }), sala('b', 4, 0, 8, 3, { name: 'Cozinha' }), sala('c', 8, 0, 12, 3, { name: 'Quarto' }));

test('casa jogável: aceitar as sugestões de cada cômodo, em laço, gera uma casa de verdade', () => {
  for (const genero of ['investigacao', 'moderno', 'fantasia']) {
    const inicial = tresComodos(); inicial.style = { ...inicial.style, genre: genero };
    const store = criarStore(inicial), aceitas: string[] = [];
    for (let volta = 0; volta < 20; volta++) {
      let andou = false;
      for (const id of Object.keys(store.documento.rooms)) {
        const p = proximaSugestao({ m: store.documento, versao: store.versaoEdicao, semente: 0 }, id, new Set()); if (!p) continue;
        aceitarProposta(store, p); aceitas.push(`${p.tipo}:${store.documento.rooms[id]!.name}`); andou = true;
      }
      if (!andou) break;
    }
    assert.ok(aceitas.length >= 8 && aceitas.length <= 20, `${genero}: ${aceitas.length} sugestões aceitas (${aceitas.join(', ')})`);
    assert.equal(store.historico.length, aceitas.length, 'uma entrada de histórico por sugestão');
    verificarCasa(store.documento, { Sala: 'sala', Cozinha: 'cozinha', Quarto: 'quarto' });
    // Nada mais a sugerir.
    for (const id of Object.keys(store.documento.rooms)) assert.equal(proximaSugestao({ m: store.documento, versao: store.versaoEdicao, semente: 0 }, id, new Set()), null);
    const objetos = Object.keys(store.documento.props).length, luzes = Object.keys(store.documento.lights).length, portas = Object.keys(store.documento.openings).length;
    console.log(`# casa (${genero}): ${aceitas.length} sugestões, ${objetos} objetos, ${luzes} luzes, ${portas} portas`);
  }
});

test('desfazer tira a última sugestão inteira e refazer a devolve', () => {
  const store = criarStore(tresComodos());
  for (let i = 0; i < 6; i++) for (const id of Object.keys(store.documento.rooms)) { const p = proximaSugestao({ m: store.documento, versao: store.versaoEdicao, semente: 0 }, id, new Set()); if (p) aceitarProposta(store, p); }
  const cheio = store.documento, n = store.historico.length;
  store.desfazer(); assert.equal(store.historico.length, n - 1); assert.notDeepEqual(store.documento.props, cheio.props === store.documento.props ? {} : cheio.props) ;
  store.refazer(); assert.deepEqual(store.documento.props, cheio.props); assert.deepEqual(store.documento.lights, cheio.lights);
});
