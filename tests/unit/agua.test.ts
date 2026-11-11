import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leitoDaAgua, MARGEM_MOLHADA } from '../../src/procedural/agua.ts';
import { MATERIAIS, materialDe, materiaisDo } from '../../src/procedural/materiais.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { chaveDoTerreno } from '../../src/render/entradas.ts';

const RES = 8;
/** Um lago quadrado de `lado` m numa tela com `margem` m de terra em volta. */
function lago(lado: number, margem: number, pixel = false) {
  const W = (lado + 2 * margem) * RES, binaria = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) binaria[y * W + x] = x >= margem * RES && x < (margem + lado) * RES && y >= margem * RES && y < (margem + lado) * RES ? 1 : 0;
  const cobertura = pixel ? null : binaria.map(v => v * 255);
  return { W, saida: leitoDaAgua({ binaria, cobertura, largura: W, altura: W, res: RES, seed: 1, material: materialDe('agua.lago'), pixel }) };
}

test('os cinco materiais de água existem e aparecem por uso', () => {
  for (const id of ['agua.mar', 'agua.lago', 'agua.rio', 'agua.gruta', 'agua.pantano']) assert.equal(MATERIAIS[id]?.uso, 'agua', id);
  assert.equal(materiaisDo('agua').length, 5);
  assert.equal(MATERIAIS['agua.gruta']!.transparencia, 0.85);
});

test('o leito fica mais opaco e mais escuro do raso para o fundo', () => {
  const { W, saida } = lago(10, 2), a = (x: number, y: number) => saida.leito[(y * W + x) * 4 + 3]!;
  const meio = W / 2, perto = 2 * RES + 3, rasoA = a(perto, meio), fundoA = a(meio, meio);
  assert.ok(fundoA > rasoA + 60, `fundo ${fundoA} raso ${rasoA}`);
  assert.ok(saida.leito[(meio * W + meio) * 4]! < saida.leito[(meio * W + perto) * 4]!, 'o fundo é mais escuro');
  assert.equal(a(2, 2), 0, 'fora da água não há leito');
});

test('a margem molhada fica só do lado de fora, em até 0,3 m', () => {
  const { W, saida } = lago(10, 2), m = (x: number, y: number) => saida.margem[(y * W + x) * 4 + 3]!;
  const meio = W / 2, borda = 2 * RES;
  assert.ok(m(borda - 2, meio) > 0, 'logo fora da água há areia molhada');
  assert.equal(m(borda - Math.ceil(MARGEM_MOLHADA * RES) - 2, meio), 0, 'além de 0,3 m não há');
  assert.equal(m(meio, meio), 0, 'dentro da água não há');
});

test('no Pixel o leito vem em três faixas de cor, sem transparência parcial', () => {
  const { W, saida } = lago(10, 2, true), cores = new Set<string>(), alfas = new Set<number>();
  for (let i = 0; i < W * W; i++) { const a = saida.leito[i * 4 + 3]!; alfas.add(a); if (a) cores.add(`${saida.leito[i * 4]},${saida.leito[i * 4 + 1]},${saida.leito[i * 4 + 2]}`); }
  assert.equal(cores.size, 3);
  assert.deepEqual([...alfas].sort((x, y) => x - y), [0, 255]);
});

test('a chave do terreno muda com o flow da camada de água', () => {
  const base = { largura: 10, altura: 10, resolucao: 0.5, base: 'areia' }, cel: [number, number, number][] = [[2, 2, 6]];
  const a = chaveDoTerreno({ ...base, camadas: [{ material: 'agua.rio', celulas: cel, flow: null }] }, 48), b = chaveDoTerreno({ ...base, camadas: [{ material: 'agua.rio', celulas: cel, flow: { angle: 1, speed: 1 } }] }, 48);
  assert.notEqual(a, b);
});

test('terreno.correnteza muda só a camada de água desse material, valida e se recusa fora da água', () => {
  const ret = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
  let m = aplicarComando(criarMapa(), { tipo: 'terreno.pintar', material: 'agua.rio', celulas: ret(0, 0, 20, 10) });
  m = aplicarComando(m, { tipo: 'terreno.pintar', material: 'grama', celulas: ret(30, 0, 40, 10) });
  m = aplicarComando(m, { tipo: 'terreno.correnteza', material: 'agua.rio', flow: { angle: 1, speed: 1.5 } });
  const camadas = Object.values(m.terrain.layers);
  assert.deepEqual(camadas.find(c => c.material === 'agua.rio')!.flow, { angle: 1, speed: 1.5 });
  assert.equal(camadas.find(c => c.material === 'grama')!.flow, null);
  validarMapa(m);
  assert.equal(Object.values(aplicarComando(m, { tipo: 'terreno.correnteza', material: 'agua.rio', flow: { angle: 0, speed: 0 } }).terrain.layers).find(c => c.material === 'agua.rio')!.flow, null);
  assert.throws(() => aplicarComando(m, { tipo: 'terreno.correnteza', material: 'grama', flow: { angle: 0, speed: 1 } }), /água/);
  assert.throws(() => aplicarComando(m, { tipo: 'terreno.correnteza', material: 'agua.rio', flow: { angle: 0, speed: 9 } }), /0 a 3/);
  assert.throws(() => aplicarComando(m, { tipo: 'terreno.correnteza', material: 'agua.mar', flow: { angle: 0, speed: 1 } }), /Não há água/);
});

import { decodificar } from '../../src/domain/celulas.ts';
import { aguaEm, etapasDaAgua, suavizarMargem } from '../../src/domain/agua.ts';

test('aguaEm acha o material da água sob um ponto e nada fora dela', () => {
  const ret = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
  let m = aplicarComando(criarMapa(), { tipo: 'terreno.pintar', material: 'grama', celulas: ret(0, 0, 100, 100) });
  m = aplicarComando(m, { tipo: 'terreno.pintar', material: 'agua.lago', celulas: ret(20, 20, 60, 60) });      // 5 a 15 m
  assert.equal(aguaEm(m, [10, 10]), 'agua.lago'); assert.equal(aguaEm(m, [2, 2]), null); assert.equal(aguaEm(m, [20, 20]), null);
});

test('suavizar a margem tira as pontas da borda e não mexe longe da pincelada', () => {
  const ret = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
  // Um quadrado de 30 × 30 com uma ponta fina de 1 célula; do outro lado, uma ilha longe, que a pincelada não toca.
  const corpo = [...ret(10, 10, 40, 40), ...ret(40, 24, 46, 25), ...ret(100, 10, 104, 14)];
  const antes = new Set(corpo.map(c => c.join()));
  const depois = new Set(decodificar(suavizarMargem(aplicarComando(criarMapa(), { tipo: 'terreno.pintar', material: 'agua.lago', celulas: corpo }).terrain.layers['t_agua_lago']!.cells, { x0: 10, y0: 10, x1: 46, y1: 40 })).map(c => c.join()));
  assert.ok(!depois.has('44,24'), 'a ponta fina some'); assert.ok(antes.has('44,24'));
  assert.ok(!depois.has('10,10'), 'a quina é arredondada'); assert.ok(depois.has('25,25'), 'o miolo fica');
  assert.ok(depois.has('101,11') && depois.has('103,13'), 'a ilha distante fica como estava');
});

test('terreno.pintar com suavizar só mexe em água', () => {
  const ret = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
  const cel = [...ret(10, 10, 40, 40), ...ret(40, 24, 46, 25)];
  const agua = aplicarComando(criarMapa(), { tipo: 'terreno.pintar', material: 'agua.lago', celulas: cel, suavizar: true }), grama = aplicarComando(criarMapa(), { tipo: 'terreno.pintar', material: 'grama', celulas: cel, suavizar: true });
  assert.ok(!decodificar(agua.terrain.layers['t_agua_lago']!.cells).some(([x, y]) => x === 44 && y === 24));
  assert.ok(decodificar(grama.terrain.layers['t_grama']!.cells).some(([x, y]) => x === 44 && y === 24));
});

test('etapasDaAgua divide o polígono em anéis do centro para a borda e cobre o polígono', () => {
  const poligono: [number, number][] = [[10, 10], [30, 10], [30, 30], [10, 30]];
  const res = 0.5;
  const etapas = etapasDaAgua(poligono, res, 6);
  assert.equal(etapas.length, 6);

  // Cada etapa tem células
  for (const e of etapas) {
    assert.ok(e.length > 0, 'etapa tem células');
  }

  // A distância média cresce da primeira etapa até a última
  const centro = [20, 20];
  const distMedia = (celulas: readonly (readonly [number, number])[]) =>
    celulas.reduce((s, [cx, cy]) => s + Math.hypot((cx + 0.5) * res - centro[0]!, (cy + 0.5) * res - centro[1]!), 0) / celulas.length;

  for (let i = 0; i < etapas.length - 1; i++) {
    assert.ok(distMedia(etapas[i]!) <= distMedia(etapas[i + 1]!), `etapa ${i} está mais perto do centro que ${i + 1}`);
  }

  // A união cobre o total de células
  const todas = new Set(etapas.flatMap(e => e.map(([x, y]) => `${x},${y}`)));
  const totalCelulas = etapas.reduce((s, e) => s + e.length, 0);
  assert.equal(todas.size, totalCelulas, 'não há repetição entre etapas');
  assert.ok(todas.size > 1000, 'polígono de 20x20 m a 0.5 m tem ~1600 células');
});
