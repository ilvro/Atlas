import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPenumbraDarkwood } from '../../src/render/composicao-de-luz.ts';
import { edificiosFechadosNaNevoa, edificioTocadoPorPoligonos, modoDeMemoriaEfetivo } from '../../src/render/nevoa.ts';
import { alvoDoTelhado } from '../../src/render/telhados.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa } from '../../src/domain/mapa.ts';

test('aplicarPenumbraDarkwood preserva a cor em visivel=1 e dessatura/escurece em tom frio em visivel=0', () => {
  const quente: readonly [number, number, number] = [0.9, 0.5, 0.2];
  const dentro = aplicarPenumbraDarkwood(quente, 1);
  assert.deepEqual(dentro, [0.9, 0.5, 0.2]);

  const fora = aplicarPenumbraDarkwood(quente, 0);
  const lumAntes = 0.299 * quente[0] + 0.587 * quente[1] + 0.114 * quente[2];
  const lumDepois = 0.299 * fora[0] + 0.587 * fora[1] + 0.114 * fora[2];
  assert.ok(lumDepois < lumAntes * 0.6 && lumDepois > 0.05, `escurece preservando contraste: ${lumDepois} vs ${lumAntes}`);

  // Cinza neutro fora do cone adquire matiz frio azulado (B > G > R)
  const cinzaFora = aplicarPenumbraDarkwood([0.6, 0.6, 0.6], 0);
  assert.ok(cinzaFora[2] > cinzaFora[1] && cinzaFora[1] > cinzaFora[0], `tom frio azulado: ${cinzaFora}`);

  // Cor quente saturada perde forte saturação fora do cone (spread R-B encolhe drasticamente)
  const spreadAntes = quente[0] - quente[2];
  const spreadDepois = Math.abs(fora[0] - fora[2]);
  assert.ok(spreadDepois < spreadAntes * 0.2, `dessaturação forte: ${spreadDepois} vs ${spreadAntes}`);

  // Interpolação intermediária e clamp fora de [0, 1]
  const meio = aplicarPenumbraDarkwood(quente, 0.5);
  assert.ok(Math.abs(meio[0] - (fora[0] + dentro[0]) / 2) < 1e-12);
  assert.deepEqual(aplicarPenumbraDarkwood(quente, 2), dentro);
  assert.deepEqual(aplicarPenumbraDarkwood(quente, -1), fora);
});

test('modoDeMemoriaEfetivo respeita mode explícito, remove esboço via fallback para darkwood e usa shroud quando sketch=false', () => {
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: true, paper: '#fff', ink: '#000', mode: 'darkwood' } }), 'darkwood');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: false, paper: '#fff', ink: '#000', mode: 'darkwood' } }), 'darkwood');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: true, paper: '#fff', ink: '#000', mode: 'sketch' } }), 'darkwood');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: false, paper: '#fff', ink: '#000', mode: 'shroud' } }), 'shroud');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: true, paper: '#fff', ink: '#000' } }), 'darkwood');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: false, paper: '#fff', ink: '#000' } }), 'shroud');
});

test('alvoDoTelhado: vista de jogador mantém edifício com roof.material coberto mesmo com roof.visible=false', () => {
  assert.equal(
    alvoDoTelhado({ vista: 'jogador', modoTelhados: 'auto', visivelNoMapa: false, conhecido: true, dentro: false, noEditor: false, forcado: null }),
    1,
    'na vista do jogador, roof.visible=false do editor não abre o telhado',
  );
  assert.equal(
    alvoDoTelhado({ vista: 'jogador', modoTelhados: 'auto', visivelNoMapa: false, conhecido: true, dentro: true, noEditor: false, forcado: null }),
    0,
    'com jogador dentro em auto, telhado abre',
  );
  assert.equal(
    alvoDoTelhado({ vista: 'jogador', modoTelhados: 'fechados', visivelNoMapa: false, conhecido: true, dentro: true, noEditor: false, forcado: null }),
    1,
    'em modo fechados, telhado permanece cobrindo mesmo com jogador dentro e roof.visible=false',
  );
  assert.equal(
    alvoDoTelhado({ vista: 'jogador', modoTelhados: 'abertos', visivelNoMapa: true, conhecido: true, dentro: false, noEditor: false, forcado: null }),
    0,
    'em modo abertos, mestre libera todos os telhados',
  );
  assert.equal(
    alvoDoTelhado({ vista: 'mestre', modoTelhados: 'auto', visivelNoMapa: false, conhecido: true, dentro: false, noEditor: false, forcado: null }),
    0,
    'na vista do mestre, roof.visible=false continua escondendo o telhado',
  );
  assert.equal(
    alvoDoTelhado({ vista: 'mestre', modoTelhados: 'auto', visivelNoMapa: true, conhecido: true, dentro: false, noEditor: false, forcado: null }),
    0.25,
    'na vista do mestre, roof.visible=true aparece esmaecido',
  );
  assert.equal(
    alvoDoTelhado({ vista: 'construir', modoTelhados: 'auto', visivelNoMapa: false, conhecido: true, dentro: false, noEditor: true, forcado: null }),
    0,
    'no editor, roof.visible=false esconde o telhado mesmo com Ver telhados ligado',
  );
});

test('edificiosFechadosNaNevoa e edificioTocadoPorPoligonos acompanham jogador fora/dentro e modo da sessão', () => {
  const m = criarMapa({ id: 't', nome: 'T', largura: 30, altura: 20 });
  m.rooms.casa = {
    id: 'casa',
    name: 'Casa',
    function: 'quarto',
    cells: codificar([[4, 4], [5, 4], [4, 5], [5, 5]]),
    floor: { material: 'tabuas.carvalho', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material: 'telha.barro', visible: false },
    levelId: null,
  };
  // Jogador fora na rua (x = 7.5, y = 10.5 — casa ocupa x=6..9, y=6..9)
  m.tokens.j1 = { ...novaPeca([7.5, 10.5]), id: 'j1', player: true };
  assert.equal(edificiosFechadosNaNevoa(m).length, 1);

  const poliPerto = [[5.5, 8.8, 9.5, 8.8, 9.5, 11, 5.5, 11]];
  const poliLonge = [[20, 15, 25, 15, 25, 18, 20, 18]];
  const ed = edificiosFechadosNaNevoa(m)[0]!;
  assert.equal(edificioTocadoPorPoligonos(m, ed, poliPerto), true);
  assert.equal(edificioTocadoPorPoligonos(m, ed, poliLonge), false);

  // Jogador entra na casa -> telhado abre em 'auto', continua fechado em 'fechados'
  m.tokens.j1.position = [7.5, 7.5];
  assert.equal(edificiosFechadosNaNevoa(m).length, 0);
  m.session.roofs = 'fechados';
  assert.equal(edificiosFechadosNaNevoa(m).length, 1);
  m.session.roofs = 'abertos';
  assert.equal(edificiosFechadosNaNevoa(m).length, 0);
});
