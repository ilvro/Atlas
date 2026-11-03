import { criarRef } from '#mesa';
import { codificar } from '../../src/domain/celulas.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';

/** Um mapa que usa todas as coleções, no espírito da Casa dos Salgueiros do protótipo. */
export function mapaCompleto(): MapaAtlas {
  const m = criarMapa({ id: 'casa', nome: 'Casa dos Salgueiros', agora: 1_000, campanhaId: 'c1' });
  const retangulo = (x0: number, y0: number, x1: number, y1: number) => { const cs: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cs.push([x, y]); return codificar(cs); };
  m.rooms.sala = { id: 'sala', name: 'Sala', function: 'sala', cells: retangulo(2, 2, 8, 6), floor: { material: 'tabuas.carvalho', seed: 11 }, wallpaper: { material: 'papel.damasco-vinho', seed: 5 }, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null };
  m.rooms.biblioteca = { id: 'biblioteca', name: 'Biblioteca', function: 'biblioteca', cells: codificar([...retangulo(8, 2, 13, 4).flatMap(([y, x0, n]) => Array.from({ length: n }, (_, i) => [x0 + i, y] as [number, number]))]), floor: { material: 'ladrilho.xadrez', seed: 23 }, wallpaper: null, wallStyle: 'box', palette: null, roof: { material: null, visible: true }, levelId: null };
  m.walls.p1 = { id: 'p1', path: [[12, 3], [12, 9]], height: 2.6, thickness: 0.24, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: { roomId: 'sala' } };
  m.openings.porta = { id: 'porta', wallId: 'p1', at: 0.5, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: criarRef('jukebox', 'efeito', 'porta-rangendo'), swing: 'a' };
  m.props.mesa = { id: 'mesa', source: { kind: 'recipe', recipe: 'mesa.redonda', seed: 2, params: {} }, position: [7.5, 6.2], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: 'sala', blocks: { move: true, sight: false }, castsShadow: true, harmonize: true };
  m.props.quadro = { id: 'quadro', source: { kind: 'asset', assetId: 'casa:quadro-paisagem' }, position: [3, 3], rotation: 0, scale: 1, elevation: 'wall', wall: { wallId: 'p1', at: 0.3, face: 'inner' }, roomId: 'sala', blocks: { move: false, sight: false }, castsShadow: false, harmonize: true };
  m.lights.lampiao = { id: 'lampiao', position: [7.5, 6.2], radius: 7, color: '#ffa85c', intensity: 1, flicker: 0.14, cone: null, ownerId: 'mesa', power: 'fire', on: true, nightOnly: false, preset: 'lamparina' };
  m.lights.lanterna = { id: 'lanterna', position: [5, 5], radius: 8.5, color: '#fff0cc', intensity: 1, flicker: 0, cone: { angle: 1.05, direction: 0 }, ownerId: 'muirenn', power: 'battery', on: true, nightOnly: false, preset: null };
  m.regions.entrada = { id: 'entrada', polygon: [[3, 3], [6, 3], [6, 6], [3, 6]], kind: 'trigger', gmOnly: false, payload: { cena: 'chuva' }, refs: [criarRef('jukebox', 'cena-sonora', 'chuva')] };
  m.presence.musgo = { id: 'musgo', brush: 'musgo', cells: [[2, 10, 6], [3, 10, 6]], intensity: 0.6, seed: 4, gmOnly: false };
  m.tokens.muirenn = { id: 'muirenn', name: 'Muirenn', portrait: null, sprite: null, facing: 'down', position: [5.25, 6.75], size: 1, vision: { radius: 11, dark: false }, lightId: 'lanterna', figure: { state: 'normal' }, refs: [criarRef('ficha', 'ficha', 'sheet-1')] };
  m.comodosExtra.sala = { id: 'sala', leitura: 'O ar cheira a cera e papel velho.', notasMestre: 'A carta está atrás do quadro.', refs: [criarRef('atelie', 'documento', 'carta-queimada', 3)] };
  m.session = { explored: null, initiative: { order: [{ tokenId: 'muirenn', value: 17 }], current: 0, round: 1 }, revealed: ['sala'], event: null };
  m.audioCue = criarRef('jukebox', 'cena-sonora', 'casa');
  m.notes = 'Sessão 3.';
  return m;
}
