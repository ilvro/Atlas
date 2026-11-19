import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { mapaCompleto } from './fixtures.ts';

const caminhoDoErro = (m: unknown) => {
  try {
    validarMapa(m);
    return null;
  } catch (e) {
    if (e instanceof ErroDeValidacao) return e.caminho;
    throw e;
  }
};

const mexer = (fn: (m: any) => void) => {
  const m = structuredClone(mapaCompleto());
  fn(m);
  return m;
};

test('v7: validação dos campos de personalização e tipo da grade', () => {
  assert.equal(caminhoDoErro(mexer(() => {})), null);

  // kind
  assert.equal(caminhoDoErro(mexer(x => { x.grid.kind = 'hex'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.kind = 'triangular'; })), 'grid.kind');

  // snap
  assert.equal(caminhoDoErro(mexer(x => { x.grid.snap = false; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.snap = 'nao'; })), 'grid.snap');

  // lineStyle
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'dashed'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'dotted'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'corners'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'ondulada'; })), 'grid.lineStyle');

  // color
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = 'auto'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = '#ffffff'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = '#ff1f1f'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = 'vermelho'; })), 'grid.color');
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = '#fff'; })), 'grid.color');

  // opacity
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 0.05; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 1; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 0.04; })), 'grid.opacity');
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 1.1; })), 'grid.opacity');

  // lineWidth
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 0.5; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 5; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 0.4; })), 'grid.lineWidth');
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 5.1; })), 'grid.lineWidth');
});

test('validação de token: tokenStyle e portraitScale', () => {
  assert.equal(caminhoDoErro(mexer(x => {
    const t = Object.values(x.tokens)[0] as any;
    t.tokenStyle = 'coin';
    t.portraitScale = 1.5;
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    const t = Object.values(x.tokens)[0] as any;
    t.tokenStyle = 'immersive';
    t.portraitScale = 0.5;
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    const t = Object.values(x.tokens)[0] as any;
    t.tokenStyle = 'invalido';
  })), `tokens.${Object.keys(mapaCompleto().tokens)[0]}.tokenStyle`);

  assert.equal(caminhoDoErro(mexer(x => {
    const t = Object.values(x.tokens)[0] as any;
    t.portraitScale = 0.4;
  })), `tokens.${Object.keys(mapaCompleto().tokens)[0]}.portraitScale`);

  assert.equal(caminhoDoErro(mexer(x => {
    const t = Object.values(x.tokens)[0] as any;
    t.portraitScale = 3.5;
  })), `tokens.${Object.keys(mapaCompleto().tokens)[0]}.portraitScale`);
});

test('validação de objeto: interação de nota com título, texto e gmOnly', () => {
  const chaveObjeto = Object.keys(mapaCompleto().props)[0];
  assert.equal(caminhoDoErro(mexer(x => {
    const o = Object.values(x.props)[0] as any;
    o.interaction = {
      kind: 'note',
      on: false,
      targets: [],
      sound: null,
      clue: null,
      note: 'Um bilhete misterioso',
      noteTitle: 'Bilhete',
      gmOnly: true,
    };
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    const o = Object.values(x.props)[0] as any;
    o.interaction = {
      kind: 'invalido',
      on: false,
      targets: [],
      sound: null,
      clue: null,
    };
  })), `props.${chaveObjeto}.interaction.kind`);
});

test('validação de telhado: aceita ausência dos campos novos e recusa valores desconhecidos', () => {
  const chaveSala = Object.keys(mapaCompleto().rooms)[0]!;
  assert.equal(caminhoDoErro(mexer(x => {
    const r = x.rooms[chaveSala];
    r.roof = { material: 'telha.barro', visible: true };
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    const r = x.rooms[chaveSala];
    r.roof = { material: 'telha.ardosia', visible: true, shape: 'duas-aguas', ridge: 'v', steep: true, details: ['cruz', 'chamine'] };
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    x.rooms[chaveSala].roof.shape = 'redondo';
  })), `rooms.${chaveSala}.roof.shape`);

  for (const forma of ['uma-agua', 'mansarda', 'holandes', 'cupula', 'abobada', 'pagode', 'bulbo']) {
    assert.equal(caminhoDoErro(mexer(x => {
      x.rooms[chaveSala].roof.shape = forma;
    })), null);
  }

  assert.equal(caminhoDoErro(mexer(x => {
    x.rooms[chaveSala].roof.ridge = 'diagonal';
  })), `rooms.${chaveSala}.roof.ridge`);

  assert.equal(caminhoDoErro(mexer(x => {
    x.rooms[chaveSala].roof.details = ['antena'];
  })), `rooms.${chaveSala}.roof.details[0]`);
});

test('validação de telhado: wear, seed e style.facades opcionais e validação de faixas', () => {
  const chaveSala = Object.keys(mapaCompleto().rooms)[0]!;

  // Sem os novos campos continua passando
  assert.equal(caminhoDoErro(mexer(x => {
    delete x.style.facades;
    delete x.rooms[chaveSala].roof.wear;
    delete x.rooms[chaveSala].roof.seed;
  })), null);

  // Valores válidos de wear, seed e facades
  assert.equal(caminhoDoErro(mexer(x => {
    x.style.facades = false;
    x.rooms[chaveSala].roof.wear = { moss: 0, dirt: 0.4, damage: 1, snow: 'auto' };
    x.rooms[chaveSala].roof.seed = 42;
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    x.rooms[chaveSala].roof.wear = { snow: 0.75 };
  })), null);

  // Recusa fora de faixa, tipos errados e campos desconhecidos
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.wear = { moss: -0.1 }; })), `rooms.${chaveSala}.roof.wear.moss`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.wear = { dirt: 1.1 }; })), `rooms.${chaveSala}.roof.wear.dirt`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.wear = { damage: 'alto' }; })), `rooms.${chaveSala}.roof.wear.damage`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.wear = { snow: 1.2 }; })), `rooms.${chaveSala}.roof.wear.snow`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.wear = { snow: 'pesada' }; })), `rooms.${chaveSala}.roof.wear.snow`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.wear = { extra: 0.2 }; })), `rooms.${chaveSala}.roof.wear.extra`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.seed = Infinity; })), `rooms.${chaveSala}.roof.seed`);
  assert.equal(caminhoDoErro(mexer(x => { x.rooms[chaveSala].roof.seed = '42'; })), `rooms.${chaveSala}.roof.seed`);
  assert.equal(caminhoDoErro(mexer(x => { x.style.facades = 'nao'; })), 'style.facades');
});

test('validação de relevo: patamares válidos, sobreposição, faixa de altitude e reliefStep só em escarpa', () => {
  assert.equal(caminhoDoErro(mexer(x => {
    delete x.terrain.relief;
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    x.terrain.relief = {
      patamares: {
        'p-200': { id: 'p-200', altura: -20, cells: [[2, 2, 4]] },
        p30: { id: 'p30', altura: 3, cells: [[4, 2, 4]] },
      },
    };
  })), null);

  assert.equal(caminhoDoErro(mexer(x => {
    x.terrain.relief = { patamares: { p9999: { id: 'p9999', altura: 250, cells: [[2, 2, 2]] } } };
  })), 'terrain.relief.patamares.p9999.altura');

  assert.equal(caminhoDoErro(mexer(x => {
    x.terrain.relief = {
      patamares: {
        p10: { id: 'p10', altura: 1, cells: [[2, 2, 4]] },
        'p-10': { id: 'p-10', altura: -1, cells: [[2, 4, 3]] },
      },
    };
  })), 'terrain.relief.patamares.p-10.cells');

  assert.equal(caminhoDoErro(mexer(x => {
    x.walls.wr_test = {
      id: 'wr_test', path: [[1, 1], [4, 1]], height: 3, thickness: 0.2, material: 'rocha.cinza',
      kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: { reliefStep: 0 },
    };
  })), 'walls.wr_test.source');
});

test('validação de contorno livre em cômodo: aceita polígono simples e recusa autointerseção/pequeno', () => {
  assert.equal(caminhoDoErro(mexer(m => {
    m.rooms.r1 = {
      id: 'r1', name: 'Torre', function: 'sala', cells: [[2, 2, 2], [3, 2, 2]],
      outline: [[3, 6], [6, 6], [6, 3], [3, 3]],
      floor: { material: 'pedra', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
      roof: { material: null, visible: true }, levelId: null,
    };
  })), null);

  assert.equal(caminhoDoErro(mexer(m => {
    m.rooms.r1 = {
      id: 'r1', name: 'Torre', function: 'sala', cells: [[2, 2, 2], [3, 2, 2]],
      outline: [[3, 3], [6, 6], [6, 3], [3, 6]], // laço cruzado
      floor: { material: 'pedra', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
      roof: { material: null, visible: true }, levelId: null,
    };
  })), 'rooms.r1.outline');

  assert.equal(caminhoDoErro(mexer(m => {
    m.rooms.r1 = {
      id: 'r1', name: 'Torre', function: 'sala', cells: [[2, 2, 2], [3, 2, 2]],
      outline: [[3, 3], [3, 4], [4, 4], [4, 3]], // 1 m² < 2 m²
      floor: { material: 'pedra', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
      roof: { material: null, visible: true }, levelId: null,
    };
  })), 'rooms.r1.outline');
});

test('validação de finish.relief: opcional, aceita 0..1 e recusa fora da faixa', () => {
  assert.equal(caminhoDoErro(mexer(x => { delete x.finish.relief; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.relief = 0; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.relief = 0.7; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.relief = 1; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.relief = -0.1; })), 'finish.relief');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.relief = 1.1; })), 'finish.relief');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.relief = 'alto'; })), 'finish.relief');
});

test('validação de finish.ao: opcional, aceita 0..1 e recusa fora da faixa', () => {
  assert.equal(caminhoDoErro(mexer(x => { delete x.finish.ao; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.ao = 0; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.ao = 0.55; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.ao = 1; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.ao = -0.1; })), 'finish.ao');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.ao = 1.1; })), 'finish.ao');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.ao = 'medio'; })), 'finish.ao');
});

test('validação de finish.exposure e finish.split: opcionais e validam faixas e cores', () => {
  assert.equal(caminhoDoErro(mexer(x => { delete x.finish.exposure; delete x.finish.split; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.exposure = 0; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.exposure = 1; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.exposure = 4; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.exposure = -0.1; })), 'finish.exposure');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.exposure = 4.5; })), 'finish.exposure');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.exposure = 'claro'; })), 'finish.exposure');

  assert.equal(caminhoDoErro(mexer(x => { x.finish.split = { shadows: '#2a4a5a', highlights: '#ffb060', balance: 0, amount: 0.35 }; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.finish.split = { shadows: 'azul', highlights: '#ffb060', balance: 0, amount: 0.35 }; })), 'finish.split.shadows');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.split = { shadows: '#2a4a5a', highlights: '#fff', balance: 0, amount: 0.35 }; })), 'finish.split.highlights');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.split = { shadows: '#2a4a5a', highlights: '#ffb060', balance: -1.5, amount: 0.35 }; })), 'finish.split.balance');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.split = { shadows: '#2a4a5a', highlights: '#ffb060', balance: 0, amount: 1.2 }; })), 'finish.split.amount');
  assert.equal(caminhoDoErro(mexer(x => { x.finish.split = { shadows: '#2a4a5a', highlights: '#ffb060', balance: 0 }; })), 'finish.split.amount');
});
