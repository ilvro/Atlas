import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LUZES_POR_FUNCAO, LUZES_POR_GENERO, propostaDeLuzes } from '../../src/authoring/luzes.ts';
import { previaDaProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao, type Contexto } from '../../src/authoring/sugestoes.ts';
import { mapaDoAndar } from '../../src/domain/andares.ts';
import { novaLuz, novoObjeto, novaPeca } from '../../src/domain/fabrica.ts';
import type { Luz, MapaAtlas } from '../../src/domain/mapa.ts';
import { GENEROS, TIPOS_DE_COMODO, presetDeLuz } from '../../src/domain/presets.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { RendererType } from 'pixi.js';
import { ALTURA_DA_LUZ, ESCALA_HDR, codificarLuz, decodificarLuz, formatoDaLuz, luzAfetadaPorTokens, nivelAtivoDe, poligonoDaLuz, sincronizarOclusao } from '../../src/render/mapa-de-luz.ts';
import { modoDeDepuracaoDaLuz, realceDoRelevo } from '../../src/render/composicao-de-luz.ts';
import { TAMANHO_TEXTURA_DIRECAO, floatParaHalf, pixelDeDirecao, texturaDeDirecao } from '../../src/render/luzes.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const ctx = (m: MapaAtlas): Contexto => ({ m, versao: 0, semente: 0, gerarId: contador() });
const luzesDe = (p: NonNullable<ReturnType<typeof propostaDeLuzes>>): Luz[] => p.comandos.map(c => { assert.equal(c.tipo, 'item.adicionar'); return (c as unknown as { item: Luz }).item; });
const escritorio = (genre = 'investigacao') => { const m = mapaCom(sala('e', 0, 0, 4, 3, { name: 'Escritório', function: 'escritorio' })); m.style = { ...m.style, genre }; return m; };

test('as tabelas só citam predefinições de luz e funções que existem', () => {
  for (const g of GENEROS) for (const k of ['principal', 'pequena'] as const) assert.ok(presetDeLuz(LUZES_POR_GENERO[g.id]![k]), `${g.id}/${k}`);
  for (const t of TIPOS_DE_COMODO) assert.ok(LUZES_POR_FUNCAO[t.funcao], t.funcao);
});

test('escritório com escrivaninha recebe a luz sobre ela, com `ownerId`', () => {
  const m = escritorio(); m.props.mesa = novoObjeto([3, 0.5], { id: 'mesa', roomId: 'e', source: { kind: 'recipe', recipe: 'escrivaninha', seed: 1, params: {} } });
  const p = propostaDeLuzes(ctx(m), 'e')!, luzes = luzesDe(p);
  assert.equal(luzes.length, 1); assert.deepEqual(luzes[0]!.position, [3, 0.5]); assert.equal(luzes[0]!.ownerId, 'mesa'); assert.equal(luzes[0]!.preset, 'lamparina'); assert.equal(luzes[0]!.on, true);
  assert.equal(p.rotulo, 'Iluminar a Escritório'); previaDaProposta(m, p);
  const depois = previaDaProposta(m, p); assert.equal(propostaDeLuzes(ctx(depois), 'e'), null, 'cômodo com luz não recebe outra');
});

test('o gênero escolhe a luz: moderno é de rede (some no apagão), fantasia é fogo', () => {
  const moderno = luzesDe(propostaDeLuzes(ctx(escritorio('moderno')), 'e')!)[0]!, fantasia = luzesDe(propostaDeLuzes(ctx(escritorio('fantasia')), 'e')!)[0]!;
  assert.equal(moderno.power, 'grid'); assert.equal(fantasia.power, 'fire'); assert.equal(fantasia.preset, 'tocha');
  const quarto = mapaCom(sala('q', 0, 0, 4, 3, { name: 'Quarto', function: 'quarto' })); quarto.style = { ...quarto.style, genre: 'fantasia' };
  assert.equal(luzesDe(propostaDeLuzes(ctx(quarto), 'q')!)[0]!.preset, 'vela', 'o quarto usa a luz pequena');
});

test('cômodo grande recebe mais de uma luz, a pelo menos 2 m uma da outra; corredor, uma a cada 6 m', () => {
  const grande = mapaCom(sala('s', 0, 0, 8, 6, { name: 'Salão', function: 'taverna' })), luzes = luzesDe(propostaDeLuzes(ctx(grande), 's')!);
  assert.ok(luzes.length >= 2, `${luzes.length} luzes`);
  for (let i = 0; i < luzes.length; i++) for (let j = i + 1; j < luzes.length; j++) assert.ok(Math.hypot(luzes[i]!.position[0] - luzes[j]!.position[0], luzes[i]!.position[1] - luzes[j]!.position[1]) >= 2);
  const corredor = mapaCom(sala('c', 0, 0, 8, 1, { name: 'Corredor', function: 'corredor' }));      // 12 m
  assert.equal(luzesDe(propostaDeLuzes(ctx(corredor), 'c')!).length, 2);
});

test('sem função, sem luz a sugerir e fora da fila quando já há luz; a luz é a última sugestão', () => {
  assert.equal(propostaDeLuzes(ctx(mapaCom(sala('x', 0, 0, 4, 3, { name: 'Cômodo' }))), 'x'), null);
  const m = escritorio(), sem = new Set(['porta:e', 'mobiliar:e']);      // o único cômodo também sugere a porta de entrada
  assert.equal(proximaSugestao(ctx(m), 'e', sem)?.tipo, 'luz');
  m.lights.l = { id: 'l', position: [1, 1], radius: 4, color: '#fff', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null, rays: false };
  assert.equal(proximaSugestao(ctx(m), 'e', sem), null);
  const patio = mapaCom(sala('p', 0, 0, 4, 4, { name: 'Pátio', function: 'patio' }));
  assert.equal(propostaDeLuzes(ctx(patio), 'p'), null, 'pátio ao ar livre não recebe luz automática');
});

const dentroPoligono = (p: number[], x: number, y: number): boolean => {
  let d = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i]!, yi = p[i + 1]!, xj = p[j]!, yj = p[j + 1]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
};

test('lanterna de um token ilumina ao redor do portador, projeta sombra atrás de outro token e pilar, e move seletivamente', () => {
  const m = mapaCom(sala('s', 0, 0, 14, 10, { name: 'Salão', function: 'sala' }));
  const lanterna = novaLuz([4.25, 6], { id: 'lanterna', radius: 9, ownerId: 'portador' });
  const longe = novaLuz([40, 40], { id: 'longe', radius: 4 });
  m.lights[lanterna.id] = lanterna;
  m.lights[longe.id] = longe;
  m.tokens.portador = novaPeca([4, 6], 'Portador', { id: 'portador', lightId: 'lanterna', size: 1 });
  m.tokens.segundo = novaPeca([8, 6], 'Segundo', { id: 'segundo', size: 1 });
  m.props.pilar = novoObjeto([4, 9], { id: 'pilar', source: ACERVO.fonte('pilar', 1), scale: 1.8 });

  const s1 = sincronizarOclusao(null, m, null);
  assert.equal(s1.estaticoMudou, true);
  const poli = poligonoDaLuz(lanterna, s1.ctx);
  assert.ok(dentroPoligono(poli, 2.5, 6), 'portador não bloqueia a própria lanterna');
  assert.ok(!dentroPoligono(poli, 10.5, 6), 'segundo token projeta sombra dinâmica');
  assert.ok(!dentroPoligono(poli, 4, 11.5), 'pilar próximo projeta sombra dinâmica');

  // Mover o segundo token recalcula apenas a lanterna perto dele (não a luz distante), mantendo o índice estático
  m.tokens.segundo = { ...m.tokens.segundo, position: [8, 7.5] };
  const s2 = sincronizarOclusao(s1.ctx, m, { completo: false, colecoes: { tokens: ['segundo'] }, campos: [] });
  assert.equal(s2.estaticoMudou, false);
  assert.equal(s2.ctx.versaoEstatica, s1.ctx.versaoEstatica);
  assert.ok(luzAfetadaPorTokens(lanterna, s2.tokensMudados));
  assert.ok(!luzAfetadaPorTokens(longe, s2.tokensMudados));
  const poli2 = poligonoDaLuz(lanterna, s2.ctx);
  assert.ok(dentroPoligono(poli2, 10.5, 6), 'antiga posição atrás do token voltou a ficar iluminada');
});

test('oclusão de objetos e tokens respeita recorte de andar vindo de mapaDoAndar', () => {
  const m = mapaCom(sala('s', 0, 0, 8, 8, { name: 'Térreo', function: 'sala' }));
  m.levels = { a2: { id: 'a2', name: 'Superior', order: 1 } };
  m.props.p2 = novoObjeto([6, 4], { id: 'p2', source: ACERVO.fonte('pilar', 1), scale: 2, levelId: 'a2' });
  m.tokens.t2 = novaPeca([4, 6], 'Guarda', { id: 't2', levelId: 'a2' });
  const luz2 = novaLuz([4, 4], { id: 'l2', radius: 8, levelId: 'a2' });
  m.lights.l2 = luz2;

  const andar2 = mapaDoAndar(m, 'a2');
  assert.equal(nivelAtivoDe(andar2), 'a2');
  const { ctx: ctxAndar2 } = sincronizarOclusao(null, andar2, null);
  const poli = poligonoDaLuz(luz2, ctxAndar2);
  assert.ok(!dentroPoligono(poli, 9, 4), 'pilar do andar superior projeta sombra no próprio andar');
  assert.ok(!dentroPoligono(poli, 4, 8.5), 'token do andar superior projeta sombra no próprio andar');
});

test('formatoDaLuz escolhe 16-bit float só em WebGL2 com EXT_color_buffer_float e cai para 8 bits escalado nos demais', () => {
  assert.deepEqual(formatoDaLuz({ type: RendererType.WEBGL, context: { webGLVersion: 1 } }), { formato: 'rgba8unorm', escala: ESCALA_HDR });
  assert.deepEqual(formatoDaLuz({ type: RendererType.WEBGL, context: { webGLVersion: 2, extensions: {} } }), { formato: 'rgba8unorm', escala: ESCALA_HDR });
  assert.deepEqual(formatoDaLuz({ type: RendererType.WEBGL, context: { webGLVersion: 2, extensions: { colorBufferFloat: {} } } }), { formato: 'rgba16float', escala: 1 });
  assert.deepEqual(formatoDaLuz({ type: RendererType.WEBGPU }), { formato: 'rgba8unorm', escala: ESCALA_HDR });
});

test('codificarLuz e decodificarLuz preservam intensidades <= 1 e HDR > 1 até ESCALA_HDR', () => {
  assert.equal(codificarLuz(2.5, 1), 2.5);
  assert.equal(decodificarLuz(2.5, 1), 2.5);
  assert.equal(codificarLuz(2.5, ESCALA_HDR), 2.5 / ESCALA_HDR);
  assert.equal(decodificarLuz(codificarLuz(2.5, ESCALA_HDR), ESCALA_HDR), 2.5);
  assert.equal(decodificarLuz(codificarLuz(0.6, ESCALA_HDR), ESCALA_HDR), 0.6);
  assert.equal(codificarLuz(-0.5, ESCALA_HDR), 0);
  assert.equal(codificarLuz(10, ESCALA_HDR), 1);
});

test('pixelDeDirecao e texturaDeDirecao codificam o vetor do pixel para a luz em 8 bits e float', () => {
  assert.equal(ALTURA_DA_LUZ, 1.6);

  const centro = pixelDeDirecao(128, 128);
  assert.equal(centro[0], 0.5);
  assert.equal(centro[1], 0.5);
  assert.equal(centro[2], 1);

  const direita = pixelDeDirecao(192, 128);
  assert.ok(direita[0] < 0.5, `borda direita R=${direita[0]} < 0.5`);
  assert.ok(direita[2] > 0);
  assert.ok(direita[0] - 0.5 * direita[2] < 0, 'vetor aponta para a esquerda (centro)');
  assert.ok(Math.abs(direita[1] - 0.5 * direita[2]) < 1e-12, 'sem componente vertical na linha central');

  const direitaExtrema = pixelDeDirecao(255, 128);
  assert.ok(direitaExtrema[0] < 0.5 && direitaExtrema[2] > 0);

  const esquerda = pixelDeDirecao(64, 128);
  assert.ok(esquerda[0] - 0.5 * esquerda[2] > 0, 'vetor aponta para a direita (centro)');

  const cima = pixelDeDirecao(128, 64);
  const baixo = pixelDeDirecao(128, 192);
  assert.ok(cima[1] - 0.5 * cima[2] > 0, 'acima aponta para baixo');
  assert.ok(baixo[1] - 0.5 * baixo[2] < 0, 'abaixo aponta para cima');

  const fora = pixelDeDirecao(0, 0);
  assert.deepEqual(fora, [0, 0, 0, 0]);

  // Soma vetorial de duas luzes: d.rg - 0.5 * d.b recupera exatamente a soma ponderada por intensidade e queda
  const k1 = 2.0, k2 = 0.75;
  const p1 = pixelDeDirecao(192, 128); // dx = +0.5
  const p2 = pixelDeDirecao(128, 96);  // dy = -0.25
  const sumR = k1 * p1[0] + k2 * p2[0];
  const sumG = k1 * p1[1] + k2 * p2[1];
  const sumB = k1 * p1[2] + k2 * p2[2];
  assert.ok(Math.abs((sumR - 0.5 * sumB) / sumB - (-0.5 * (k1 * p1[2] * 0.5) / sumB)) < 1e-9);
  assert.ok(Math.abs((sumG - 0.5 * sumB) / sumB - (-0.5 * (k2 * p2[2] * -0.25) / sumB)) < 1e-9);

  // Texturas reais (BufferImageSource 8 bits e float16)
  const tex8 = texturaDeDirecao(false);
  assert.equal(tex8.width, TAMANHO_TEXTURA_DIRECAO);
  assert.equal(tex8.height, TAMANHO_TEXTURA_DIRECAO);
  assert.equal(tex8.source.format, 'rgba8unorm');
  assert.equal(tex8.source.alphaMode, 'no-premultiply-alpha');
  const buf8 = tex8.source.resource as Uint8Array;
  const idxCentro = (128 * TAMANHO_TEXTURA_DIRECAO + 128) * 4;
  assert.equal(buf8[idxCentro + 2], 255);
  assert.ok(Math.abs(buf8[idxCentro]! - 128) <= 1);
  assert.ok(Math.abs(buf8[idxCentro + 1]! - 128) <= 1);
  const idxDir = (128 * TAMANHO_TEXTURA_DIRECAO + 192) * 4;
  assert.ok(buf8[idxDir]! < 128);

  const texF = texturaDeDirecao(true);
  assert.equal(texF.source.format, 'rgba16float');
  assert.equal(texF.source.alphaMode, 'no-premultiply-alpha');
  const bufF = texF.source.resource as Uint16Array;
  assert.equal(bufF[idxCentro], floatParaHalf(0.5));
  assert.equal(bufF[idxCentro + 1], floatParaHalf(0.5));
  assert.equal(bufF[idxCentro + 2], floatParaHalf(1));
  assert.ok(bufF[idxDir]! < floatParaHalf(0.5));

  assert.equal(modoDeDepuracaoDaLuz('?luz=direcao'), 'direcao');
  assert.equal(modoDeDepuracaoDaLuz('?foo=1&luz=direcao'), 'direcao');
  assert.equal(modoDeDepuracaoDaLuz('?luz=altura'), 'altura');
  assert.equal(modoDeDepuracaoDaLuz('?foo=1&luz=altura'), 'altura');
  assert.equal(modoDeDepuracaoDaLuz('?luz=outra'), null);
  assert.equal(modoDeDepuracaoDaLuz(''), null);
});

test('realceDoRelevo dá 1 para chão liso, > 1 para normal inclinada para a luz e < 1 para inclinada contra', () => {
  const luzEsquerda: readonly [number, number, number] = [-0.8, 0, 0.6];
  // Chão liso (N = [0, 0, 1]) recebe 1 quando L.z >= 0.25
  assert.ok(Math.abs(realceDoRelevo([0, 0, 1], luzEsquerda) - 1) < 1e-12);
  assert.ok(Math.abs(realceDoRelevo([0, 0, 1], [0, 0, 1]) - 1) < 1e-12);

  // Normal inclinada na direção da luz recebe > 1
  const voltadaParaLuz = realceDoRelevo([-0.6, 0, 0.8], luzEsquerda);
  assert.ok(voltadaParaLuz > 1, `esperado > 1, recebeu ${voltadaParaLuz}`);

  // Normal inclinada contra a luz recebe < 1
  const voltadaContraLuz = realceDoRelevo([0.3, 0, 0.95], luzEsquerda);
  assert.ok(voltadaContraLuz < 1 && voltadaContraLuz >= 0, `esperado < 1, recebeu ${voltadaContraLuz}`);

  // Normal oposta (N·L <= 0) zera em vez de negativar
  assert.equal(realceDoRelevo([0.9, 0, 0.4], luzEsquerda), 0);
});
