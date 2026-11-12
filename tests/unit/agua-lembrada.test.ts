import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { projetarParaJogadores } from '../../src/domain/projecao.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { comandoDaEtapaDeAgua } from '../../src/domain/agua.ts';
import { area, decodificar } from '../../src/domain/celulas.ts';
import type { ComandoConstruir } from '../../src/state/comandos-construir.ts';

const ret = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
const pintar = (m: MapaAtlas, material: string, celulas: [number, number][], lembrar = false) => aplicarComando(m, { tipo: 'terreno.pintar', material, celulas, ...(lembrar ? { lembrar: true } : {}) } as ComandoConstruir);
/** O terreno sem campos vazios, para comparar. */
const terreno = (m: MapaAtlas) => JSON.stringify(m.terrain);

function cenario() {
  let m = pintar(criarMapa(), 'grama', ret(0, 0, 20, 20));
  m = pintar(m, 'lama', ret(0, 0, 20, 5));
  return m;
}
const AGUA = 'agua.lago';

test('subir com lembrar guarda o que cobriu, sem guardar água de outro material', () => {
  let m = cenario();
  m = pintar(m, 'agua.rio', ret(15, 15, 18, 18));
  m = pintar(m, AGUA, ret(2, 2, 12, 12), true);
  const g = m.terrain.submerged!;
  assert.equal(area(g['t_grama']!.cells), 10 * 7); // linhas 5..11 por 10 colunas
  assert.equal(area(g['t_lama']!.cells), 10 * 3);
  m = pintar(m, 'agua.rio', ret(5, 5, 8, 8), true);
  assert.equal(m.terrain.submerged!['t_agua_lago'], undefined);
  validarMapa(m);
});

test('baixar devolve exatamente o terreno de antes e o guardado some', () => {
  const antes = cenario();
  let m = pintar(antes, AGUA, ret(2, 2, 12, 12), true);
  const cel = ret(2, 2, 12, 12);
  m = aplicarComando(m, comandoDaEtapaDeAgua(m, { material: AGUA, acao: 'baixar' }, cel)!);
  assert.equal(terreno(m), terreno(antes));
  assert.equal(m.terrain.submerged, undefined);
  validarMapa(m);
});

test('baixar onde não havia camada apaga e mostra a base; subir duas vezes não perde o guardado', () => {
  let m = pintar(criarMapa(), 'grama', ret(0, 0, 10, 10));
  const antes = m;
  m = pintar(m, AGUA, ret(5, 5, 15, 15), true); // metade sobre grama, metade sobre nada
  m = pintar(m, AGUA, ret(0, 0, 12, 12), true); // segunda subida cobre água e grama
  assert.equal(area(m.terrain.submerged!['t_grama']!.cells), 100);
  m = aplicarComando(m, comandoDaEtapaDeAgua(m, { material: AGUA, acao: 'baixar' }, ret(0, 0, 15, 15))!);
  assert.equal(terreno(m), terreno(antes));
});

test('baixar com deixar troca pelo material e limpa o guardado', () => {
  let m = pintar(cenario(), AGUA, ret(2, 2, 12, 12), true);
  m = aplicarComando(m, comandoDaEtapaDeAgua(m, { material: AGUA, acao: 'baixar', deixar: 'areia' }, ret(2, 2, 12, 12))!);
  assert.ok(m.terrain.layers['t_areia']);
  assert.equal(area(m.terrain.layers['t_areia']!.cells), 100);
  assert.equal(m.terrain.submerged, undefined);
  assert.equal(Object.values(m.terrain.layers).some(l => l.material === AGUA), false);
});

test('pintar à mão sobre o guardado impede a volta', () => {
  let m = pintar(cenario(), AGUA, ret(2, 2, 12, 12), true);
  m = pintar(m, 'areia', ret(6, 6, 8, 8)); // sem lembrar, por cima da água
  assert.equal(m.terrain.submerged!['t_grama']!.cells.length > 0, true);
  const g = decodificar(m.terrain.submerged!['t_grama']!.cells).map(c => c.join());
  assert.equal(g.includes('6,6'), false);
  m = aplicarComando(m, comandoDaEtapaDeAgua(m, { material: AGUA, acao: 'baixar' }, ret(2, 2, 12, 12))!);
  assert.equal(decodificar(m.terrain.layers['t_areia']!.cells).length, 4);
  assert.equal(decodificar(m.terrain.layers['t_grama']!.cells).some(([x, y]) => x === 6 && y === 6), false);
});

test('mapas com e sem o campo validam, e a projeção para jogadores o omite', () => {
  const sem = cenario();
  validarMapa(sem);
  const com = pintar(sem, AGUA, ret(2, 2, 12, 12), true);
  validarMapa(com);
  assert.ok(com.terrain.submerged);
  const p = projetarParaJogadores(com);
  assert.equal(p.terrain.submerged, undefined);
  validarMapa(p);
});
