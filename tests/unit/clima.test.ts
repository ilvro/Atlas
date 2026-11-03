import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { ceuNoHorario, ehNoite, lerHorario, luzesDerivadas } from '../../src/domain/clima.ts';
import { recalcularParedes } from '../../src/domain/geometria.ts';
import { criarMapa, type Abertura, type Comodo, type MapaAtlas } from '../../src/domain/mapa.ts';
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
