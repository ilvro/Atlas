import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobrirCasas } from '../../src/authoring/cobrir.ts';
import { aplicarEmCopia, comodos } from '../../src/authoring/construcao.ts';
import { aberturasDoEdificio, acessivel, plantaDoEdificio } from '../../src/authoring/edificio.ts';
import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import { TODOS_OS_CONJUNTOS, espalhar } from '../../src/authoring/espalhar.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { LUZES_POR_GENERO, propostaDeLuzes } from '../../src/authoring/luzes.ts';
import { MATERIAIS_POR_GENERO } from '../../src/authoring/mobiliar.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { PAREDE_PADRAO } from '../../src/domain/geometria.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { estiloDeTelhado, presetDeLuz, TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { mapaCom, sala } from './apoio-casa.ts';

function contador(prefixo = '') {
  let n = 0;
  return (p: string) => `${prefixo}${p}${++n}`;
}

test('R4.1: pos-apocaliptico herda trocas do moderno em banheiro/sala/escritorio/quarto mantendo overrides pós-apocalípticos', () => {
  const receitas = (f: string) => regrasPara(f, 'pos-apocaliptico').flatMap(r => r.receitas);

  assert.deepEqual(regrasPara('banheiro', 'pos-apocaliptico').find(r => r.id === 'vaso')?.receitas, ['vaso.moderno']);
  assert.deepEqual(regrasPara('banheiro', 'pos-apocaliptico').find(r => r.id === 'pia')?.receitas, ['balcao']);
  assert.ok(receitas('sala').includes('sofa.canto'));
  assert.ok(!receitas('sala').includes('sofa'));
  assert.deepEqual(regrasPara('escritorio', 'pos-apocaliptico').find(r => r.id === 'escrivaninha')?.receitas, ['escrivaninha.computador']);
  assert.deepEqual(regrasPara('quarto', 'pos-apocaliptico').find(r => r.id === 'armario')?.receitas, ['guarda-roupa.liso']);
  assert.deepEqual(regrasPara('quarto', 'pos-apocaliptico').find(r => r.id === 'cama')?.receitas, ['colchao-no-chao', 'cama.solteiro']);
  assert.deepEqual(regrasPara('quarto', 'pos-apocaliptico').find(r => r.id === 'cama')?.porArea, [[12, 'colchao-no-chao']]);
});

test('R4.2: regrasPara normaliza gênero com generoDe, filtra porArea com serve() e evita cama.dossel nos 5 gêneros históricos/regionais', () => {
  // Gênero desconhecido normaliza para 'investigacao' (incluindo VARIACOES_DE_GENERO)
  assert.deepEqual(regrasPara('quarto', 'genero-desconhecido'), regrasPara('quarto', 'investigacao'));

  // Nenhum dos 5 gêneros que herdam fantasia herda cama.dossel em quarto (receitas nem porArea)
  for (const g of ['antiguidade', 'oriental', 'deserto', 'faroeste', 'colonial'] as const) {
    const cama = regrasPara('quarto', g).find(r => r.id === 'cama')!;
    assert.ok(cama, `${g}: regra de cama existe`);
    assert.ok(!cama.receitas.includes('cama.dossel'), `${g}: receitas não deve ter cama.dossel`);
    assert.ok(!(cama.porArea ?? []).some(([, r]) => r === 'cama.dossel'), `${g}: porArea não deve ter cama.dossel`);
    for (const [, r] of cama.porArea ?? []) {
      assert.ok(ACERVO.item(r), `${g}: porArea ${r} existe`);
    }
  }
  assert.deepEqual(regrasPara('quarto', 'oriental').find(r => r.id === 'cama')?.porArea, [[12, 'futon']]);
  assert.deepEqual(regrasPara('quarto', 'antiguidade').find(r => r.id === 'cama')?.porArea, [[12, 'cama.casal']]);

  // porArea filtra receitas incompatíveis com o gênero via serve()
  const orig = REGRAS_DE_MOBILIA.quarto![0]!;
  const prevPorArea = orig.porArea;
  try {
    orig.porArea = [[12, 'cama.box']];
    const camaFantasia = regrasPara('quarto', 'fantasia').find(r => r.id === 'cama')!;
    assert.equal(camaFantasia.porArea, undefined, 'cama.box (moderno) é filtrada de porArea em fantasia');
  } finally {
    orig.porArea = prevPorArea;
  }
});

test('R4.3: LUZES_POR_GENERO["pos-apocaliptico"].pequena é omnidirecional (cone === null)', () => {
  const idPreset = LUZES_POR_GENERO['pos-apocaliptico']!.pequena;
  const preset = presetDeLuz(idPreset);
  assert.ok(preset, 'preset existe');
  assert.equal(preset.cone, null, `esperava luz omnidirecional, recebeu ${idPreset} com cone=${preset.cone}`);

  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Abrigo', function: 'abrigo' }));
  m.style = { ...m.style, genre: 'pos-apocaliptico' };
  const prop = propostaDeLuzes({ m, versao: 0, semente: 1, gerarId: contador() }, 'a')!;
  assert.ok(prop);
  const luz = (prop.comandos[0] as { item: { cone: unknown } }).item;
  assert.equal(luz.cone, null);
});

test('R4.4: edifício rotacionado não duplica luzes próprias lp-* e propaga floor/wallpaper do gênero', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  m.style = { ...m.style, genre: 'moderno' };

  const orto = construirEdificios(
    m,
    [
      {
        nome: 'Casa Reta',
        origem: [6, 6],
        frente: 's',
        forma: 'L',
        rotacao: 0,
        comodos: [
          { tipo: 'sala', area: 20, principal: true },
          { tipo: 'cozinha', area: 12 },
          { tipo: 'quarto', area: 10 },
        ],
      },
    ],
    42,
    contador('o_'),
  );
  const rot = construirEdificios(
    m,
    [
      {
        nome: 'Casa Girada',
        origem: [6, 6],
        frente: 's',
        forma: 'L',
        rotacao: 0.35,
        comodos: [
          { tipo: 'sala', area: 20, principal: true },
          { tipo: 'cozinha', area: 12 },
          { tipo: 'quarto', area: 10 },
        ],
      },
    ],
    42,
    contador('r_'),
  );

  const mapaOrto = aplicarEmCopia(m, orto.comandos);
  const mapaRot = aplicarEmCopia(m, rot.comandos);

  // Sem luzes duplicadas em objetos que geram lp-*
  for (const luz of Object.values(mapaRot.lights)) {
    if (!luz.ownerId || !mapaRot.props[luz.ownerId]) continue;
    const lpId = `lp-${luz.ownerId}`;
    if (mapaRot.lights[lpId]) {
      const doMesmoDono = Object.values(mapaRot.lights).filter(l => l.ownerId === luz.ownerId);
      assert.equal(doMesmoDono.length, 1, `objeto ${luz.ownerId} não deve ter luzes duplicadas`);
    }
  }
  assert.equal(Object.keys(mapaRot.lights).length, Object.keys(mapaOrto.lights).length);

  // Salas rotacionadas recebem floor e wallpaper do gênero moderno (não ficam presos no padrão de investigação)
  const salasOrto = Object.values(mapaOrto.rooms);
  const salasRot = Object.values(mapaRot.rooms);
  assert.equal(salasRot.length, salasOrto.length);
  for (const sr of salasRot) {
    const tipo = TIPOS_DE_COMODO.find(t => t.funcao === sr.function);
    const mats = MATERIAIS_POR_GENERO.moderno![sr.function!]!;
    assert.ok(mats.pisos.includes(sr.floor.material), `${sr.function}: floor ${sr.floor.material} pertence ao moderno`);
    assert.ok(sr.wallpaper?.material && mats.papeis.includes(sr.wallpaper.material), `${sr.function}: wallpaper ${sr.wallpaper?.material} pertence ao moderno`);
    if (tipo && sr.function === 'sala') {
      assert.notEqual(sr.floor.material, tipo.piso, 'sala moderna não fica no piso padrão de investigação');
      assert.notEqual(sr.wallpaper?.material, tipo.papel, 'sala moderna não fica no papel padrão de investigação');
    }
  }
});

test('R4.5: espalhar não aborta em contexto mesa misto e deriva castsShadow/bloqueio dos metadados do ACERVO', () => {
  // Contexto misto: item 'mesa' sem mesas perto não aborta o loop antes de colocar o item 'livre'
  const conjuntoMistoId = '__teste-r4-misto';
  const mutConjuntos = TODOS_OS_CONJUNTOS as unknown as { id: string; nome: string; descricao: string; itens: { peso: number; contexto: 'mesa' | 'livre'; receita: string }[]; densidade: number }[];
  mutConjuntos.push({
    id: conjuntoMistoId,
    nome: 'Teste Misto',
    descricao: 'Teste',
    densidade: 1.5,
    itens: [
      { receita: 'papeis', peso: 2, contexto: 'mesa' },
      { receita: 'vaso.planta', peso: 1, contexto: 'livre' },
    ],
  });
  try {
    const m = criarMapa({ largura: 30, altura: 30 });
    const postos = espalhar(m, { centro: [15, 15], raio: 3, conjunto: conjuntoMistoId, semente: 7, gerarId: contador() });
    assert.ok(postos.some(o => ACERVO.idDaFonte(o.source) === 'vaso.planta'), 'deve continuar o loop e colocar itens livres mesmo sem mesa');
  } finally {
    mutConjuntos.pop();
  }

  // Metadados: árvores/pedras/lápides projetam sombra; rasteiros/passáveis não projetam
  const mExt = criarMapa({ largura: 60, altura: 60 });
  const cem = espalhar(mExt, { centro: [30, 30], raio: 8, conjunto: 'cemiterio', semente: 3, gerarId: contador() });
  const lapides = cem.filter(o => ACERVO.idDaFonte(o.source) === 'lapide');
  assert.ok(lapides.length >= 3);
  for (const l of lapides) {
    assert.equal(l.castsShadow, true, 'lápide projeta sombra');
    assert.equal(l.blocks.move, true, 'lápide bloqueia movimento');
  }

  const mataFechada = espalhar(mExt, { centro: [30, 30], raio: 12, conjunto: 'mata-fechada', semente: 5, gerarId: contador() });
  const arvores = mataFechada.filter(o => ACERVO.item(ACERVO.idDaFonte(o.source))?.tags.includes('copa'));
  const rasteiros = mataFechada.filter(o => ACERVO.item(ACERVO.idDaFonte(o.source))?.tags.includes('rasteira'));
  assert.ok(arvores.length >= 1 && rasteiros.length >= 1);
  for (const a of arvores) assert.equal(a.castsShadow, true, 'árvore projeta sombra');
  for (const r of rasteiros) {
    assert.equal(r.castsShadow, false, 'item rasteiro não projeta sombra');
    assert.equal(r.blocks.move, false, 'item rasteiro não bloqueia movimento');
  }

  const mSala = mapaCom(sala('s', 0, 0, 6, 5, { name: 'Sala', function: 'sala' }));
  const bag = espalhar(mSala, { centro: [4.5, 3.75], raio: 3.5, conjunto: 'bagunca', semente: 2, gerarId: contador() });
  for (const o of bag) {
    const id = ACERVO.idDaFonte(o.source);
    if (id === 'papeis' || id === 'jornais' || id === 'livros.pilha' || id === 'sapatos') {
      assert.equal(o.castsShadow, false, `${id} não projeta sombra`);
      assert.equal(o.blocks.move, false, `${id} não bloqueia`);
    } else {
      assert.equal(o.castsShadow, true, `${id} projeta sombra`);
      assert.equal(o.blocks.move, true, `${id} bloqueia`);
    }
  }
});

test('R4.6a: construcao.ts passa p.andar ?? null para telhadoPadrao (herança de telhado no mesmo andar)', () => {
  const m = criarMapa({ largura: 30, altura: 30 });
  m.levels = { andar2: { id: 'andar2', name: '2º Andar', order: 1 } };
  const res = comodos(
    m,
    [
      { rets: [[2, 2, 4, 4]], tipo: 'sala', telhado: 'telha.ardosia', andar: 'andar2' },
      { rets: [[4, 2, 6, 4]], tipo: 'cozinha', andar: 'andar2' },
    ],
    1,
    contador(),
  );
  const m1 = aplicarEmCopia(m, res.comandos);
  assert.equal(m1.rooms[res.ids[1]!]!.roof.material, 'telha.ardosia', 'cozinha vizinha no andar2 herda telhado do andar2');
});

test('R4.6b: cobrir.ts pula andares subterrâneos (order < 0) e passa sala.outline para telhadoPadrao', () => {
  const m = criarMapa({ largura: 30, altura: 30 });
  m.style = { ...m.style, genre: 'investigacao' };
  m.levels = { sub: { id: 'sub', name: 'Subsolo', order: -1 } };
  const subCells = codificar([[1, 1], [2, 1]]);
  m.rooms.porao_sub = {
    id: 'porao_sub',
    name: 'Porão Subterrâneo',
    function: 'porao',
    cells: subCells,
    floor: { material: 'laje.pedra', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material: null, visible: true },
    levelId: 'sub',
  };
  const resTorre = comodos(m, [{ circulo: { centro: [10, 10], raio: 3 }, tipo: 'sala', telhado: null }], 1, contador());
  const m1 = aplicarEmCopia(m, resTorre.comandos);

  const cmds = cobrirCasas(m1);
  const m2 = aplicarEmCopia(m1, cmds);
  assert.equal(m2.rooms.porao_sub!.roof.material, null, 'andar subterrâneo não ganha telhado');
  assert.equal(m2.rooms[resTorre.ids[0]!]!.roof.shape, estiloDeTelhado('torre-redonda')!.roof.shape, 'sala com outline circular ganha telhado cone');
});

test('R4.6c: layout.ts usa comprimentoDaParede em paredes fechadas/poligonais (wc_*) para objetos na parede', () => {
  const m0 = criarMapa({ largura: 30, altura: 30 });
  const res = comodos(m0, [{ circulo: { centro: [10, 10], raio: 3.5 }, tipo: 'sala' }], 1, contador());
  const m = aplicarEmCopia(m0, res.comandos);
  const paredeCircular = Object.values(m.walls).find(w => w.id.startsWith('wc_'));
  assert.ok(paredeCircular, 'parede circular criada');
  // Antes da correção, a distância em linha reta entre início e fim da parede fechada era 0, colapsando o espaçamento de quadros/arandelas.
  const layout = gerarLayout(m, { roomId: res.ids[0]!, funcao: 'sala', genero: 'investigacao', semente: 7, gerarId: contador() });
  const naParede = layout.objetos.filter(o => o.elevation === 'wall');
  assert.ok(naParede.length >= 2, `esperava múltiplos objetos na parede circular, obteve ${naParede.length}`);
  for (let i = 0; i < naParede.length; i++) {
    for (let j = i + 1; j < naParede.length; j++) {
      const dist = Math.hypot(naParede[i]!.position[0] - naParede[j]!.position[0], naParede[i]!.position[1] - naParede[j]!.position[1]);
      assert.ok(dist >= 0.4, `objetos na parede circular não devem colidir (${dist.toFixed(2)} m)`);
    }
  }
});

test('R4.6d: edificio.ts aplica grid.offset em paredesBloqueiam e pontoDaAresta, e capela tem entrada larga (1.5 m)', () => {
  const m: MapaAtlas = criarMapa({ largura: 45, altura: 45 });
  m.grid = { ...m.grid, offset: [3, 4.5] };
  // Parede manual dentro do retângulo [2,2,5,5] considerado o offset [3, 4.5] -> mundo x=[6..10.5], y=[7.5..12]
  m.walls.w_off = { ...structuredClone(PAREDE_PADRAO), id: 'w_off', path: [[7, 8], [9, 8]], source: null };

  // O lote em [2,2] deve detectar colisão com w_off via paredesBloqueiam com offset
  assert.throws(() =>
    plantaDoEdificio(m, {
      nome: 'Bloqueada',
      origem: [2, 2],
      lote: [4, 4],
      frente: 's',
      comodos: [{ tipo: 'sala', area: 16 }],
    }, 1),
  );

  // Construção completa em mapa com grid.offset não-zero: portas e janelas encaixam corretamente nas paredes deslocadas
  const mLivre = criarMapa({ largura: 45, altura: 45 });
  mLivre.grid = { ...mLivre.grid, offset: [3, 4.5] };
  const capelaPlanta = plantaDoEdificio(mLivre, {
    nome: 'Capela',
    origem: [4, 4],
    frente: 's',
    comodos: [{ tipo: 'capela', area: 24, principal: true }],
  }, 1);
  const abCapela = aberturasDoEdificio(capelaPlanta, mLivre.grid.size, mLivre.grid.offset);
  assert.equal(abCapela.portas[0]!.largura, 1.5, 'capela tem entrada larga de 1,5 m');
  assert.equal(acessivel(capelaPlanta, abCapela, mLivre.grid.size, mLivre.grid.offset), true);

  const built = construirEdificios(mLivre, [
    {
      nome: 'Capela Deslocada',
      origem: [4, 4],
      frente: 's',
      comodos: [{ tipo: 'capela', area: 24, principal: true }],
    },
  ], 1, contador());
  assert.doesNotMatch(built.descricoes[0]!, /\(erro\)/);
  const mFinal = aplicarEmCopia(mLivre, built.comandos);
  assert.ok(Object.values(mFinal.openings).some(o => o.kind === 'door' && o.width === 1.5));
});
