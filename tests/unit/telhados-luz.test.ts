import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luzSobreOsTelhados } from '../../src/render/telhados.ts';
import { presetDeClima } from '../../src/domain/presets.ts';

test('os telhados recebem a luz do clima: de dia ficam como estão, à noite escurecem', () => {
  const canais = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  assert.deepEqual(canais(luzSobreOsTelhados(presetDeClima('tarde')!.climate)), [255, 255, 255]);
  const noite = canais(luzSobreOsTelhados(presetDeClima('noite')!.climate));
  assert.ok(Math.max(...noite) < 200, `noite: ${noite}`);
  assert.ok(Math.min(...canais(luzSobreOsTelhados({ ambient: { color: '#000000', intensity: 0 }, sun: null }))) > 0, 'nunca preto chapado');
});
