import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { aplicarEmCopia, comodos, luzes, objetos, portas, terreno } from '../../src/authoring/construcao.ts';
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

test('casas-iguais: dispara com 5 casas retangulares de porte igual e passa com plantas em L e tamanhos variados', () => {
  let mIguais = criarMapa({ largura: 60, altura: 30 });
  mIguais = aplicarEmCopia(mIguais, comodos(mIguais, [
    { rets: [[2, 2, 5, 5]], tipo: 'quarto', nome: 'Casa 1' },
    { rets: [[7, 2, 10, 5]], tipo: 'quarto', nome: 'Casa 2' },
    { rets: [[12, 2, 15, 5]], tipo: 'quarto', nome: 'Casa 3' },
    { rets: [[17, 2, 20, 5]], tipo: 'quarto', nome: 'Casa 4' },
    { rets: [[22, 2, 25, 5]], tipo: 'quarto', nome: 'Casa 5' },
  ]).comandos);
  const achados = revisarMapa(mIguais, { regras: ['casas-iguais'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'aviso');
  assert.equal(achados[0]!.mensagem, '5 casas de tamanho e forma parecidos');

  // 5 edifícios com áreas bem diferentes (CV >= 0,3) e ao menos 2 em L (< 70% de retângulo único).
  let mVariadas = criarMapa({ largura: 60, altura: 30 });
  mVariadas = aplicarEmCopia(mVariadas, comodos(mVariadas, [
    { rets: [[2, 2, 4, 4]], tipo: 'quarto', nome: 'Cabana pequena' },
    { rets: [[6, 2, 9, 5]], tipo: 'sala', nome: 'Casa média' },
    { rets: [[11, 2, 15, 5], [11, 5, 13, 7]], tipo: 'taverna', nome: 'Estalagem em L' },
    { rets: [[17, 2, 22, 6], [17, 6, 20, 9]], tipo: 'capela', nome: 'Igreja com ala' },
    { rets: [[24, 2, 31, 8]], tipo: 'porao', nome: 'Armazém grande' },
  ]).comandos);
  assert.deepEqual(revisarMapa(mVariadas, { regras: ['casas-iguais'] }), []);
});

test('fileiras-mecanicas e repeticao: grid 8×15 de lápides (Lysdal) dispara ambas e passa com distribuição orgânica e variada', () => {
  let mGrade = criarMapa({ largura: 45, altura: 30 });
  const lapidesGrade: { item: string; pos: [number, number]; rotacao: number }[] = [];
  for (let iy = 0; iy < 8; iy++) {
    for (let ix = 0; ix < 15; ix++) {
      lapidesGrade.push({ item: 'lapide', pos: [4 + ix * 1.6, 4 + iy * 1.8], rotacao: 0 });
    }
  }
  mGrade = aplicarEmCopia(mGrade, objetos(mGrade, lapidesGrade).comandos);

  const fileiras = revisarMapa(mGrade, { regras: ['fileiras-mecanicas'] });
  assert.equal(fileiras.length, 1);
  assert.equal(fileiras[0]!.gravidade, 'aviso');

  const rep = revisarMapa(mGrade, { regras: ['repeticao'] });
  assert.equal(rep.length, 1);
  assert.equal(rep[0]!.gravidade, 'aviso');

  // Com posições não alinhadas, rotações variadas e mix de 4 receitas (nenhuma >= 40 nem > 35%), nenhuma das duas dispara.
  let mOrganico = criarMapa({ largura: 45, altura: 30 });
  const receitas = ['lapide', 'banco.jardim', 'estatua', 'bau'] as const;
  const variados = Array.from({ length: 16 }, (_, i) => ({
    item: receitas[i % receitas.length]!,
    pos: [3 + i * 2.1 + (i % 3) * 0.37, 3 + ((i * 7) % 11) * 1.73] as [number, number],
    rotacao: (i * 0.45) % 3.14,
  }));
  mOrganico = aplicarEmCopia(mOrganico, objetos(mOrganico, variados).comandos);
  assert.deepEqual(revisarMapa(mOrganico, { regras: ['fileiras-mecanicas', 'repeticao'] }), []);

  // Vegetação (árvores) com mais de 40 cópias não dispara repeticao.
  let mMata = criarMapa({ largura: 60, altura: 40 });
  mMata = aplicarEmCopia(mMata, objetos(mMata, Array.from({ length: 42 }, (_, i) => ({
    item: 'casa:arvore-5m',
    pos: [4 + (i % 7) * 6.5 + (i % 3) * 1.1, 4 + Math.floor(i / 7) * 5.2] as [number, number],
    rotacao: (i * 0.7) % 6.28,
  }))).comandos);
  assert.deepEqual(revisarMapa(mMata, { regras: ['repeticao'] }), []);
});

test('mancha-em-disco: dispara para círculo de terreno isolado ≥ 4 m² e ignora trilha alongada ou água', () => {
  let mDisco = criarMapa({ largura: 30, altura: 20 });
  mDisco = aplicarEmCopia(mDisco, terreno(mDisco, [
    { acao: 'pintar', material: 'terra', forma: { disco: [15, 10], raio: 2.5 } },
  ]).comandos);
  const achados = revisarMapa(mDisco, { regras: ['mancha-em-disco'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'dica');

  // Trilha sinuosa alongada e lagoa de água não disparam mancha-em-disco.
  let mTrilha = criarMapa({ largura: 30, altura: 20 });
  mTrilha = aplicarEmCopia(mTrilha, terreno(mTrilha, [
    { acao: 'pintar', material: 'terra', forma: { faixa: [[2, 10], [10, 8], [20, 12], [28, 9]], largura: 2 } },
    { acao: 'pintar', material: 'agua.lago', forma: { disco: [8, 15], raio: 3 } },
  ]).comandos);
  assert.deepEqual(revisarMapa(mTrilha, { regras: ['mancha-em-disco'] }), []);
});

test('composicao-centralizada: dispara quando construção fica ilhada no centro e passa quando ancorada nas bordas', () => {
  let mCentro = criarMapa({ largura: 30, altura: 30 });
  mCentro.terrain.base = 'grama';
  mCentro = aplicarEmCopia(mCentro, comodos(mCentro, [
    { rets: [[7, 7, 13, 13]], tipo: 'sala', nome: 'Torre central' },
  ]).comandos);
  const achados = revisarMapa(mCentro, { regras: ['composicao-centralizada'] });
  assert.equal(achados.length, 1);
  assert.equal(achados[0]!.gravidade, 'dica');

  // Se houver construções/objetos ancorando perto da borda, não dispara.
  const mAncorado = aplicarEmCopia(mCentro, objetos(mCentro, [
    { item: 'carroca', pos: [2, 15] },
    { item: 'poco', pos: [27, 25] },
  ]).comandos);
  assert.deepEqual(revisarMapa(mAncorado, { regras: ['composicao-centralizada'] }), []);
});

test('noite-sem-luz: dispara aviso em mapa escuro sem luzes, dica em cômodo escuro sem janela e passa com luz', () => {
  let m = criarMapa({ largura: 30, altura: 20 });
  m = { ...m, climate: { ...m.climate, preset: 'noite', time: '22:00', ambient: { color: '#9fb3e8', intensity: 0.1 } } };
  m = aplicarEmCopia(m, comodos(m, [
    { rets: [[4, 4, 8, 8]], tipo: 'sala', nome: 'Salão escuro' },
  ]).comandos);

  // Sem nenhuma luz acesa no mapa inteiro -> aviso.
  const semLuz = revisarMapa(m, { regras: ['noite-sem-luz'] });
  assert.equal(semLuz.length, 1);
  assert.equal(semLuz[0]!.gravidade, 'aviso');

  // Com uma luz do lado de fora, mas o cômodo ainda sem luz interna nem janela -> dica para o cômodo.
  const luzFora = aplicarEmCopia(m, luzes(m, [
    { preset: 'tocha', pos: [2, 2] },
  ]).comandos);
  const dicaComodo = revisarMapa(luzFora, { regras: ['noite-sem-luz'] });
  assert.equal(dicaComodo.length, 1);
  assert.equal(dicaComodo[0]!.gravidade, 'dica');
  assert.deepEqual(dicaComodo[0]!.ids, [ Object.keys(luzFora.rooms)[0]! ]);

  // Adicionando uma luz dentro do cômodo, não dispara mais.
  const iluminado = aplicarEmCopia(luzFora, luzes(luzFora, [
    { preset: 'vela', pos: [9, 9] },
  ]).comandos);
  assert.deepEqual(revisarMapa(iluminado, { regras: ['noite-sem-luz'] }), []);
});

test('revisarMapa nos exemplos da Fase 10 não aponta nenhum erro e as regras de composição dão no máximo dicas', () => {
  const arquivos = readdirSync('public/exemplos').filter(f => f.endsWith('.atlas.json'));
  assert.ok(arquivos.length >= 8);
  const regrasComposicao = [
    'casas-iguais',
    'fileiras-mecanicas',
    'repeticao',
    'mancha-em-disco',
    'composicao-centralizada',
    'noite-sem-luz',
  ];
  for (const arq of arquivos) {
    const m = lerMapa(JSON.parse(readFileSync(`public/exemplos/${arq}`, 'utf8')));
    const erros = revisarMapa(m).filter(a => a.gravidade === 'erro');
    assert.deepEqual(erros, [], `Exemplo ${arq} teve erros: ${JSON.stringify(erros)}`);
    const compNaoDica = revisarMapa(m, { regras: regrasComposicao }).filter(a => a.gravidade !== 'dica');
    assert.deepEqual(compNaoDica, [], `Exemplo ${arq} teve erro/aviso de composição: ${JSON.stringify(compNaoDica)}`);
  }
});
