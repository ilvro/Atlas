import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ceuNoHorario } from '../../src/domain/clima.ts';
import { elevacaoDoSol, sombraDoSol } from '../../src/domain/sol.ts';
import { PRESETS_DE_CLIMA } from '../../src/domain/presets.ts';

const clima = (time: string, extra: Record<string, unknown> = {}) => { const c = ceuNoHorario(time); return { time, sun: c.noite ? null : c.sun, ambient: c.ambient, weather: { fog: 0 } as never, ...extra } as Parameters<typeof sombraDoSol>[0]; };

test('sombra do sol: curta às 12h30, longa às 8h, nenhuma de noite ou sem sol', () => {
  assert.ok(sombraDoSol(clima('12:30'))!.porMetro <= 0.5);
  assert.ok(sombraDoSol(clima('08:00'))!.porMetro >= 2);
  assert.ok(sombraDoSol(clima('06:00'))! === null || sombraDoSol(clima('06:00'))!.porMetro === 4);
  assert.equal(sombraDoSol(clima('23:00', { sun: { angle: 0.3, color: '#fff', intensity: 0.35 } })), null);
  assert.equal(sombraDoSol(clima('12:30', { sun: null })), null);
  assert.ok(elevacaoDoSol(12.5) > elevacaoDoSol(9) && elevacaoDoSol(9) > elevacaoDoSol(7) && elevacaoDoSol(5) === 0 && elevacaoDoSol(19) === 0);
});

test('sombra do sol: a direção é oposta à do sol, unitária, e a manhã e a tarde caem para lados opostos', () => {
  const manha = sombraDoSol(clima('08:00'))!, tarde = sombraDoSol(clima('16:30'))!, meio = sombraDoSol(clima('12:30'))!;
  for (const s of [manha, tarde, meio]) assert.ok(Math.abs(Math.hypot(...s.dir) - 1) < 1e-4);
  assert.ok(manha.dir[0] < -0.5, 'de manhã o sol está a leste e a sombra cai para oeste');
  assert.ok(tarde.dir[0] > 0.5, 'à tarde, o contrário');
  assert.ok(Math.abs(meio.dir[0]) < 0.2 && meio.dir[1] > 0.95, 'ao meio-dia a sombra cai para baixo na tela');
  const c = clima('08:00'), sol = [Math.cos(c.sun!.angle), -Math.sin(c.sun!.angle)];
  assert.ok(Math.abs(manha.dir[0] + sol[0]!) < 1e-4 && Math.abs(manha.dir[1] + sol[1]!) < 1e-4);
});

test('sombra do sol: a neblina a apaga, o Pixel é opaco, e a cor acompanha o ambiente', () => {
  const claro = sombraDoSol(clima('10:00'))!, nublado = sombraDoSol(clima('10:00', { weather: { fog: 0.85 } }))!;
  assert.ok(nublado.alfa < claro.alfa * 0.3);
  assert.equal(sombraDoSol(clima('10:00'), true)!.alfa, 1);
  const azul = sombraDoSol({ ...clima('10:00'), ambient: { color: '#a8c4e8', intensity: 0.8 } })!.cor, canais = [1, 3, 5].map(i => parseInt(azul.slice(i, i + 2), 16));
  assert.ok(canais[2]! > canais[0]!, azul);
  assert.ok(PRESETS_DE_CLIMA.length > 0);
});
