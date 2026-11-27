import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luzSobreOsTelhados } from '../../src/render/telhados.ts';
import { presetDeClima } from '../../src/domain/presets.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { edificiosDe } from '../../src/domain/edificios.ts';
import { chaveDoTelhado, entradaDoTelhado } from '../../src/render/entradas.ts';

test('os telhados recebem a luz do clima: de dia ficam como estão, à noite escurecem', () => {
  const canais = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  assert.deepEqual(canais(luzSobreOsTelhados(presetDeClima('tarde')!.climate)), [255, 255, 255]);
  const noite = canais(luzSobreOsTelhados(presetDeClima('noite')!.climate));
  assert.ok(Math.max(...noite) < 200, `noite: ${noite}`);
  assert.ok(Math.min(...canais(luzSobreOsTelhados({ ambient: { color: '#000000', intensity: 0 }, sun: null }))) > 0, 'nunca preto chapado');
});

test('entradaDoTelhado marca abertura de porta aberta na fachada e altera a chave do assado', () => {
  const m = criarMapa({ id: 'mapa-fachada-porta', nome: 'Teste' });
  m.rooms.r1 = {
    id: 'r1',
    name: 'Casa',
    function: 'taverna',
    cells: [[0, 0, 3], [1, 0, 3]],
    floor: { material: 'madeira.tabuas', seed: 1 },
    roof: { material: 'telha.ceramica', visible: true, shape: 'duas-aguas' },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    levelId: null,
  };
  m.walls.wSul = {
    id: 'wSul',
    kind: 'wall',
    path: [[0, 3], [4.5, 3]],
    height: 2.8,
    thickness: 0.2,
    material: 'parede.reboco',
    blocks: { sight: true, move: true, light: true },
    drop: null,
    source: { roomId: 'r1' },
  };
  const porta = { id: 'porta', kind: 'door' as const, wallId: 'wSul', at: 0.5, width: 1, state: 'closed' as 'closed' | 'open', material: 'madeira.escura', som: null, swing: 'a' as const };
  m.openings.porta = porta;

  const ed = edificiosDe(m)[0]!;
  const eFechada = entradaDoTelhado(m, ed);
  const abFechada = eFechada.paredes?.flatMap(p => p.aberturas)[0];
  assert.equal(abFechada?.aberta, undefined);

  porta.state = 'open';
  const eAberta = entradaDoTelhado(m, ed);
  const abAberta = eAberta.paredes?.flatMap(p => p.aberturas)[0];
  assert.equal(abAberta?.aberta, true);
  assert.notEqual(chaveDoTelhado(eFechada, 32), chaveDoTelhado(eAberta, 32));
});
