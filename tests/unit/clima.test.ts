import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { ceuNoHorario, curvaDoClarao, ehNoite, intervaloDoRelampago, lerHorario, luzesDerivadas, misturar, nivelDaLuz, piscarDaQueda, piscarDaVolta } from '../../src/domain/clima.ts';
import { recalcularParedes } from '../../src/domain/geometria.ts';
import { PRESETS_DE_CLIMA } from '../../src/domain/presets.ts';
import { criarMapa, type Abertura, type Comodo, type Luz, type MapaAtlas } from '../../src/domain/mapa.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';

const efetiva = (c: { ambient: { color: string; intensity: number } }) => [1, 3, 5].map(i => parseInt(c.ambient.color.slice(i, i + 2), 16) / 255 * c.ambient.intensity);
const brilho = (c: { ambient: { color: string; intensity: number } }) => efetiva(c).reduce((a, b) => a + b, 0);

test('o meio-dia tem sol mais forte que as sete da manhã, e é mais claro', () => {
  const meio = ceuNoHorario('12:00'), manha = ceuNoHorario('07:00');
  assert.ok(meio.sun.intensity > manha.sun.intensity && meio.sun.intensity > 0.95);
  assert.ok(brilho(meio) > brilho(manha));
  assert.equal(meio.noite, false); assert.equal(manha.noite, false);
});

test('o sol anda de leste a oeste', () => {
  const a = ceuNoHorario('06:00').sun.angle, b = ceuNoHorario('12:00').sun.angle, c = ceuNoHorario('17:59').sun.angle;
  assert.ok(a < b && b < c && a < 0.01 && Math.abs(b - Math.PI / 2) < 0.01 && c > 3.1);
});

test('à noite a luz é da lua, azulada e fraca', () => {
  const c = ceuNoHorario('23:00');
  assert.equal(c.noite, true); assert.equal(c.sun.color, '#9fb3e8'); assert.ok(c.sun.intensity < 0.5);
  assert.ok(brilho(c) < 0.5 && brilho(c) < brilho(ceuNoHorario('12:00')));
  assert.equal(ceuNoHorario('03:00').noite, true);
});

test('18:00 já é noite; 05:59 ainda é, 06:00 não', () => {
  assert.equal(ceuNoHorario('18:30').noite, true); assert.equal(ceuNoHorario('18:00').noite, true);
  assert.equal(ceuNoHorario('05:59').noite, true); assert.equal(ceuNoHorario('06:00').noite, false);
});

test('o ambiente muda de forma contínua ao longo do dia (sem saltos)', () => {
  let antes = brilho(ceuNoHorario('00:00'));
  for (let m = 1; m < 24 * 60; m += 10) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0'), agora = brilho(ceuNoHorario(`${hh}:${mm}`));
    assert.ok(Math.abs(agora - antes) < 0.2, `salto às ${hh}:${mm}`); antes = agora;
  }
});

test('ehNoite lê o horário do mapa; horário inválido lança com o caminho', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  assert.equal(ehNoite(m), false);
  m.climate.time = '22:15'; assert.equal(ehNoite(m), true);
  for (const ruim of ['25:00', '12:60', '9:30', 'meio-dia', '']) assert.throws(() => lerHorario(ruim), (e: unknown) => e instanceof ErroDeValidacao && e.caminho === 'climate.time');
  assert.equal(lerHorario('14:30'), 14.5);
});

// ---- luzes derivadas das janelas ----

const sala = (id: string, x0: number, y0: number, x1: number, y1: number): Comodo => {
  const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]);
  return { id, name: id, function: null, cells: codificar(c), floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null };
};
const casa = (...salas: Comodo[]): MapaAtlas => { const m = criarMapa({ id: 'm', agora: 1 }); for (const s of salas) m.rooms[s.id] = s; recalcularParedes(m); return m; };
const janela = (m: MapaAtlas, wallId: string, id = 'j'): Abertura => (m.openings[id] = { id, wallId, at: 0.5, width: 1.2, kind: 'window', state: 'closed', material: 'madeira.media', som: null, swing: 'a' });
const parede = (m: MapaAtlas, f: (p: [number, number][]) => boolean) => Object.values(m.walls).find(w => f(w.path as [number, number][]))!;

test('uma janela para o lado de fora derrama a luz do céu para dentro do cômodo', () => {
  const m = casa(sala('a', 2, 2, 4, 4));                                   // de 3 a 6 m
  const topo = parede(m, p => p.every(q => q[1] === 3));
  janela(m, topo.id);
  const [l, ...resto] = luzesDerivadas(m); assert.equal(resto.length, 0);
  assert.equal(l!.id, 'janela:j'); assert.equal(l!.ownerId, 'j'); assert.equal(l!.power, 'magic'); assert.ok(l!.on);
  assert.ok(Math.abs(l!.position[0] - 4.5) < 1e-9 && Math.abs(l!.position[1] - 3.3) < 1e-9, 'a 0,3 m para dentro, no centro da janela');
  assert.ok(Math.abs(l!.cone!.direction - Math.PI / 2) < 1e-9, 'aponta para baixo (para dentro)');
  assert.equal(l!.color, m.climate.sun!.color); assert.equal(l!.intensity, m.climate.sun!.intensity); assert.equal(l!.cone!.angle, 2.1); assert.equal(l!.radius, 9.5);
});

test('a direção sempre aponta para dentro, em qualquer parede', () => {
  const m = casa(sala('a', 2, 2, 4, 4));
  for (const w of Object.values(m.walls)) { delete m.openings.j; janela(m, w.id); const l = luzesDerivadas(m)[0]!; const centro = [4.5, 4.5], depois = [l.position[0] + Math.cos(l.cone!.direction), l.position[1] + Math.sin(l.cone!.direction)]; assert.ok(Math.hypot(depois[0]! - centro[0]!, depois[1]! - centro[1]!) < Math.hypot(l.position[0] - centro[0]!, l.position[1] - centro[1]!), 'aproxima do centro'); }
});

test('janela entre dois cômodos, fora de cômodos, ou sem sol, não gera luz', () => {
  const m = casa(sala('a', 2, 2, 4, 4), sala('b', 4, 2, 6, 4));
  janela(m, parede(m, p => p.every(q => q[0] === 6) && p[0]![1] === 3).id);
  assert.equal(luzesDerivadas(m).length, 0, 'entre dois cômodos');
  const solta = criarMapa({ id: 's', agora: 1 }); solta.walls.w = { id: 'w', path: [[0, 0], [4, 0]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: null };
  janela(solta, 'w'); assert.equal(luzesDerivadas(solta).length, 0, 'sem cômodo');
  const externa = casa(sala('a', 2, 2, 4, 4)); janela(externa, parede(externa, p => p.every(q => q[1] === 3)).id); externa.climate.sun = null;
  assert.equal(luzesDerivadas(externa).length, 0, 'sun: null');
});

test('a cor da luz da janela acompanha o clima: sol de dia, lua à noite', () => {
  const m = casa(sala('a', 2, 2, 4, 4)); janela(m, parede(m, p => p.every(q => q[1] === 3)).id);
  const dia = luzesDerivadas(m)[0]!; m.climate.sun = ceuNoHorario('23:00').sun;
  const noite = luzesDerivadas(m)[0]!; assert.equal(noite.color, '#9fb3e8'); assert.ok(noite.intensity < dia.intensity);
});

// ---- luzes que reagem ao clima ----
const lamp = (extra: Partial<Luz> = {}): Luz => ({ id: 'l', position: [4.5, 4.5], radius: 5, color: '#ffa85c', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null, ...extra });
const comClima = (gridPower: boolean, time: string) => { const m = criarMapa({ id: 'c', agora: 1 }); m.climate.gridPower = gridPower; m.climate.time = time; return m; };

test('nivelDaLuz: tabela de apagada × rede × noite × só-noturna × fogo/rede', () => {
  const casos: { on: boolean; power: Luz['power']; nightOnly: boolean; rede: boolean; hora: string; espera: 0 | 1 }[] = [];
  for (const on of [true, false]) for (const power of ['grid', 'fire', 'battery', 'magic'] as const) for (const nightOnly of [true, false]) for (const rede of [true, false]) for (const hora of ['14:00', '23:00']) {
    const espera = !on || (power === 'grid' && !rede) || (nightOnly && hora === '14:00') ? 0 : 1;
    casos.push({ on, power, nightOnly, rede, hora, espera });
  }
  assert.equal(casos.length, 64);
  for (const c of casos) assert.equal(nivelDaLuz(lamp({ on: c.on, power: c.power, nightOnly: c.nightOnly }), comClima(c.rede, c.hora)), c.espera, JSON.stringify(c));
  // O render pode perguntar "e se a rede estivesse ligada?" durante o piscar da queda.
  assert.equal(nivelDaLuz(lamp({ power: 'grid' }), comClima(false, '23:00'), { redeLigada: true }), 1);
  assert.equal(nivelDaLuz(lamp({ nightOnly: true }), comClima(true, '14:00'), { noite: true }), 1);
});

test('apagão apaga as lâmpadas e deixa velas e lanternas', () => {
  const m = comClima(false, '23:00');
  const lampada = lamp({ power: 'grid' }), vela = lamp({ power: 'fire' }), lanterna = lamp({ power: 'battery' });
  assert.deepEqual([lampada, vela, lanterna].map(l => nivelDaLuz(l, m)), [0, 1, 1]);
});

test('o relâmpago: sem força nunca dispara; com mais força, vem mais rápido', () => {
  for (const sorteio of [0, 0.3, 0.999]) assert.equal(intervaloDoRelampago(0, sorteio), Infinity);
  for (const sorteio of [0, 0.5, 1]) { const i = intervaloDoRelampago(1, sorteio); assert.ok(i >= 4 && i <= 11, `${i}`); }
  assert.ok(intervaloDoRelampago(1, 0.5) < intervaloDoRelampago(0.25, 0.5));
  assert.equal(intervaloDoRelampago(0.5, 0), 4);
});

test('o clarão pisca e some; com movimento reduzido tem metade da força e não treme', () => {
  assert.equal(curvaDoClarao(0), 0); assert.equal(curvaDoClarao(-1), 0);
  const amostras = Array.from({ length: 101 }, (_, i) => curvaDoClarao(i / 100));
  assert.ok(amostras.every(v => v >= 0 && v <= 1) && Math.max(...amostras) > 0.5);
  let picos = 0; for (let i = 1; i < 100; i++) if (amostras[i]! > amostras[i - 1]! && amostras[i]! >= amostras[i + 1]!) picos++;
  assert.ok(picos >= 2, 'treme: mais de um pico');
  const calmo = Array.from({ length: 101 }, (_, i) => curvaDoClarao(i / 100, true));
  assert.equal(Math.max(...calmo), 0.5); for (let i = 1; i < 101; i++) assert.ok(calmo[i]! >= calmo[i - 1]!, 'cresce sem oscilar');
});

test('a queda de energia pisca e apaga; a volta pisca curto e fica', () => {
  assert.equal(piscarDaQueda(0.2), 0); assert.equal(piscarDaQueda(0), 0);
  const durante = Array.from({ length: 80 }, (_, i) => piscarDaQueda(0.26 + i * 0.01));
  assert.ok(durante.every(v => v === 1 || v === 0.15) && durante.includes(1) && durante.includes(0.15), 'tremula entre aceso e quase apagado');
  assert.equal(piscarDaVolta(0), 1); assert.ok([0.05, 0.1, 0.2, 0.3, 0.4].some(t => piscarDaVolta(t) < 1));
});

// ---- janelas acesas à noite ----
test('à noite, a janela de um cômodo com luz acesa brilha para fora', () => {
  const m = casa(sala('a', 2, 2, 4, 4)); janela(m, parede(m, p => p.every(q => q[1] === 3)).id);     // janela no topo, em y = 3
  m.climate.time = '23:00'; m.lights.l = lamp({ id: 'l', position: [4.5, 4.5], color: '#ffa85c' });
  const fora = luzesDerivadas(m).find(l => l.id === 'janela-fora:j')!;
  assert.ok(fora, 'gera a luz de fora');
  assert.equal(fora.radius, 4); assert.equal(fora.intensity, 0.6); assert.equal(fora.color, '#ffa85c');
  assert.ok(Math.abs(fora.cone!.direction + Math.PI / 2) < 1e-9, 'aponta para cima, para fora do cômodo');
  assert.ok(fora.position[1] < 3, 'nasce do lado de fora da parede');
  assert.ok(luzesDerivadas(m).some(l => l.id === 'janela:j'), 'a do céu continua');
});

test('de dia não acende; luz apagada, de fora do cômodo ou só-noturna não conta', () => {
  const m = casa(sala('a', 2, 2, 4, 4)); janela(m, parede(m, p => p.every(q => q[1] === 3)).id);
  m.lights.l = lamp({ id: 'l' });
  assert.ok(!luzesDerivadas(m).some(l => l.id.startsWith('janela-fora')), 'dia');
  m.climate.time = '23:00';
  m.lights.l = lamp({ id: 'l', on: false }); assert.ok(!luzesDerivadas(m).some(l => l.id.startsWith('janela-fora')), 'luz apagada');
  m.lights.l = lamp({ id: 'l', position: [20, 20] }); assert.ok(!luzesDerivadas(m).some(l => l.id.startsWith('janela-fora')), 'luz fora do cômodo');
  m.lights.l = lamp({ id: 'l', nightOnly: true }); assert.ok(luzesDerivadas(m).some(l => l.id.startsWith('janela-fora')), 'só-noturna acende à noite');
});

test('apagão sem velas não acende a janela; com uma vela, sim; e funciona sem lua', () => {
  const m = casa(sala('a', 2, 2, 4, 4)); janela(m, parede(m, p => p.every(q => q[1] === 3)).id);
  m.climate.time = '23:30'; m.climate.gridPower = false; m.climate.sun = null;
  m.lights.l = lamp({ id: 'l', power: 'grid' }); assert.equal(luzesDerivadas(m).length, 0, 'só lâmpada de rede, sem energia, sem lua: nada');
  m.lights.v = lamp({ id: 'v', power: 'fire', color: '#ffcc66' });
  assert.deepEqual(luzesDerivadas(m).map(l => l.id), ['janela-fora:j'], 'a vela basta, mesmo sem lua');
});

test('a janela acesa usa a cor média das luzes do cômodo', () => {
  const m = casa(sala('a', 2, 2, 4, 4)); janela(m, parede(m, p => p.every(q => q[1] === 3)).id);
  m.climate.time = '22:00'; m.lights.a = lamp({ id: 'a', color: '#ff0000' }); m.lights.b = lamp({ id: 'b', color: '#0000ff', position: [5, 5] });
  assert.equal(luzesDerivadas(m).find(l => l.id === 'janela-fora:j')!.color, '#800080');
});

// ---------- Mistura de climas ----------
const estado = (id: string) => { const p = PRESETS_DE_CLIMA.find(x => x.id === id)!; return { climate: { ...p.climate, preset: id }, finish: p.finish }; };

test('misturar: t = 0 é o clima de origem e t = 1 é o de destino', () => {
  const a = estado('tarde'), b = estado('tempestade');
  const m0 = misturar(a, b, 0), m1 = misturar(a, b, 1);
  assert.equal(m0.climate.weather.rain, a.climate.weather.rain); assert.equal(m1.climate.weather.rain, b.climate.weather.rain);
  assert.equal(m1.climate.preset, 'tempestade'); assert.equal(m1.climate.time, b.climate.time);
  assert.equal(m0.finish.vignette, a.finish.vignette); assert.equal(m1.finish.vignette, b.finish.vignette);
  assert.ok(Math.abs(brilho(m0.climate) - brilho(a.climate)) < 0.01 && Math.abs(brilho(m1.climate) - brilho(b.climate)) < 0.01);
  assert.equal(m0.finish.tint, a.finish.tint); assert.equal(m1.finish.tint, b.finish.tint);
});

test('misturar: o meio-termo fica entre os dois (ambiente, chuva, tinta)', () => {
  const a = estado('tarde'), b = estado('noite'), m = misturar(a, b, 0.5);
  const x = brilho(m.climate);
  assert.ok(x < brilho(a.climate) && x > brilho(b.climate));
  const c = misturar({ ...a, finish: { ...a.finish, tint: '#000000' } }, { ...b, finish: { ...b.finish, tint: '#ffffff' } }, 0.5);
  assert.equal(c.finish.tint, '#808080');
  const chuva = misturar({ ...a, climate: { ...a.climate, weather: { ...a.climate.weather, rain: 0 } } }, { ...b, climate: { ...b.climate, weather: { ...b.climate.weather, rain: 1 } } }, 0.25);
  assert.ok(Math.abs(chuva.climate.weather.rain - 0.25) < 1e-9);
});

test('misturar: o sol que some (ou aparece) muda só de intensidade, com a cor do lado que tem sol', () => {
  const a = estado('tarde'), b = { ...estado('noite'), climate: { ...estado('noite').climate, sun: null } };
  assert.ok(a.climate.sun);
  const meio = misturar(a, b, 0.5).climate.sun!;
  assert.equal(meio.color, a.climate.sun!.color); assert.ok(Math.abs(meio.intensity - a.climate.sun!.intensity / 2) < 1e-9);
  assert.equal(misturar(a, b, 1).climate.sun!.intensity, 0);
  const volta = misturar(b, a, 0.5).climate.sun!;
  assert.equal(volta.color, a.climate.sun!.color); assert.ok(Math.abs(volta.intensity - a.climate.sun!.intensity / 2) < 1e-9);
  assert.equal(misturar(b, b, 0.5).climate.sun, null);
});

test('misturar: a energia da rede vira um número de 0 a 1', () => {
  const a = estado('tarde'), b = estado('apagao');
  assert.equal(a.climate.gridPower, true); assert.equal(b.climate.gridPower, false);
  assert.equal(misturar(a, b, 0).climate.rede, 1); assert.equal(misturar(a, b, 0.25).climate.rede, 0.75); assert.equal(misturar(a, b, 1).climate.rede, 0);
  assert.equal(misturar(a, b, 7).climate.rede, 0);
});
