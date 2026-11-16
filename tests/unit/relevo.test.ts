import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEmCopia } from '../../src/authoring/construcao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { bloqueioNoCaminho } from '../../src/domain/movimento.ts';
import {
  alturaEm,
  alturaNaCelula,
  alturasDistintas,
  bordasDoRelevo,
  degrausDoRelevo,
} from '../../src/domain/relevo.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ladoBaixo, larguraDaFace, FACE_MAXIMA } from '../../src/procedural/escarpa.ts';
import { ehEscarpaAvulsa } from '../../src/render/entradas.ts';
import { corDaNeblinaDoRelevo, tintDoRelevo } from '../../src/domain/relevo.ts';
import { PINCEL_PADRAO, comandoDoPincelDeTerreno } from '../../src/render/pincel.ts';
import { segmentosERotulosDeNivel } from '../../src/render/linhas-de-nivel.ts';
import { comporMascaraDeRelevo, larguraDoDeclive, pintarDegraus } from '../../src/procedural/assar.ts';
import { fatorDeProfundidade } from '../../src/domain/relevo.ts';
import type { Contexto } from '../../src/procedural/canvas.ts';
import { codificar } from '../../src/domain/celulas.ts';

function retanguloDeCelulas(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out.push([x, y]);
  return out;
}

test('relevo: retângulo a −20 m gera escarpa fechada com drop apontando para dentro (lado baixo) e bloqueia movimento', () => {
  const m = criarMapa({ largura: 20, altura: 20 });
  const r = aplicarEmCopia(m, [{ tipo: 'relevo.pintar', altura: -20, celulas: retanguloDeCelulas(20, 20, 40, 40) }]);
  validarMapa(r);

  assert.deepEqual(alturasDistintas(r), [-20, 0]);
  assert.equal(alturaEm(r, [7.5, 7.5]), -20);
  assert.equal(alturaEm(r, [2, 2]), 0);
  assert.equal(alturaNaCelula(r, 25, 25), -20);
  assert.equal(alturaNaCelula(r, 2, 2), 0);

  const escarpas = Object.values(r.walls).filter(w => w.source && 'reliefStep' in w.source);
  assert.equal(escarpas.length, 1);
  const esc = escarpas[0]!;
  assert.equal(esc.kind, 'cliff');
  assert.equal(esc.height, 20);
  assert.deepEqual(esc.blocks, { move: true, sight: false, light: false });
  assert.ok(ehEscarpaAvulsa(esc), 'escarpa derivada de relevo deve ser desenhável como avulsa');
  assert.deepEqual(esc.path[0], esc.path.at(-1), 'contorno do poço deve ser fechado');

  // Prova geométrica do drop: todo segmento da escarpa tem ladoBaixo voltado para a região -20 m
  const p0 = esc.path[0]!, p1 = esc.path[1]!;
  const nBaixo = ladoBaixo(p0, p1, esc.drop!);
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  const altBaixo = alturaEm(r, [mx + nBaixo[0] * 0.3, my + nBaixo[1] * 0.3]);
  const altAlto = alturaEm(r, [mx - nBaixo[0] * 0.3, my - nBaixo[1] * 0.3]);
  assert.equal(altBaixo, -20, 'drop deve apontar para dentro do rebaixo (-20 m)');
  assert.equal(altAlto, 0, 'lado oposto ao drop deve estar em 0 m');

  // Escarpa bloqueia movimento entre 0 e -20
  assert.ok(bloqueioNoCaminho(r, [3, 7.5], [7.5, 7.5]), 'escarpa derivada deve bloquear passagem');
});

test('relevo: degrau de −0,5 m não cria parede, mas aparece em degrausDoRelevo', () => {
  const m = criarMapa({ largura: 20, altura: 20 });
  const r = aplicarEmCopia(m, [{ tipo: 'relevo.pintar', altura: -0.5, celulas: retanguloDeCelulas(10, 10, 30, 30) }]);
  validarMapa(r);

  assert.equal(Object.keys(r.walls).length, 0, 'desnível < 1 m não cria parede');
  const degraus = degrausDoRelevo(r);
  assert.equal(degraus.length, 1);
  assert.equal(degraus[0]!.desnivel, 0.5);
  assert.equal(bloqueioNoCaminho(r, [1, 5], [5, 5]), null, 'degrau transponível não bloqueia movimento');
});

test('relevo: patamares aninhados (0 -> −8 -> −20) criam duas bordas com desníveis 8 e 12 e apagar restaura tudo', () => {
  const m = criarMapa({ largura: 20, altura: 20 });
  const celMedio = retanguloDeCelulas(10, 10, 50, 50);
  const celFundo = retanguloDeCelulas(20, 20, 40, 40);
  const comDois = aplicarEmCopia(m, [
    { tipo: 'relevo.pintar', altura: -8, celulas: celMedio },
    { tipo: 'relevo.pintar', altura: -20, celulas: celFundo },
  ]);
  validarMapa(comDois);

  assert.deepEqual(alturasDistintas(comDois), [-20, -8, 0]);
  const bordas = bordasDoRelevo(comDois);
  assert.equal(bordas.length, 2);
  assert.deepEqual(bordas.map(b => ({ limiar: b.limiar, desnivel: b.desnivel })), [
    { limiar: -8, desnivel: 12 },
    { limiar: 0, desnivel: 8 },
  ]);
  const escarpas = Object.values(comDois.walls).filter(w => w.source && 'reliefStep' in w.source);
  assert.deepEqual(escarpas.map(w => w.height).sort((a, b) => a - b), [8, 12]);

  // Apagar tudo devolve altitude 0 e remove escarpas e objeto relief
  const apagado = aplicarEmCopia(comDois, [{ tipo: 'relevo.apagar', celulas: celMedio }]);
  validarMapa(apagado);
  assert.equal(apagado.terrain.relief, undefined);
  assert.deepEqual(alturasDistintas(apagado), [0]);
  assert.equal(Object.keys(apagado.walls).length, 0);
});

test('relevo: escarpa herdará material da camada de maciço se existir e sobrevive a comodo.criar', () => {
  const m = criarMapa({ largura: 20, altura: 20 });
  const r = aplicarEmCopia(m, [
    { tipo: 'terreno.pintar', material: 'rocha.arenito', celulas: retanguloDeCelulas(0, 0, 8, 8) },
    { tipo: 'relevo.pintar', altura: -10, celulas: retanguloDeCelulas(15, 15, 30, 30) },
  ]);
  const esc = Object.values(r.walls).find(w => w.source && 'reliefStep' in w.source);
  assert.ok(esc);
  assert.equal(esc.material, 'rocha.arenito');

  const comSala = aplicarEmCopia(r, [{
    tipo: 'comodo.criar',
    id: 'sala_teste',
    nome: 'Sala',
    funcao: 'sala',
    piso: { material: 'madeira', seed: 1 },
    papel: null,
    celulas: [[1, 1], [1, 2]],
  }]);
  assert.ok(comSala.walls[esc.id], 'recalcularParedes (via cômodo) não remove escarpa de relevo');
});

test('relevo: larguraDaFace limita em FACE_MAXIMA e tintDoRelevo escurece abaixo do topo e muda com clima', () => {
  assert.equal(larguraDaFace(25), FACE_MAXIMA);
  const m = criarMapa({ largura: 20, altura: 20 });
  const r = aplicarEmCopia(m, [{ tipo: 'relevo.pintar', altura: -25, celulas: retanguloDeCelulas(20, 0, 40, 40) }]);
  assert.equal(tintDoRelevo(r, [2, 2]), 0xffffff, 'ponto no topo fica sem escurecimento');
  const tintBaixo = tintDoRelevo(r, [8, 8]);
  assert.notEqual(tintBaixo, 0xffffff, 'ponto a -25 m ganha tint de profundidade');
  const outroClima = aplicarEmCopia(r, [{ tipo: 'clima.aplicar', patch: { ambient: { color: '#334477', intensity: 0.4 } } }]);
  assert.notEqual(corDaNeblinaDoRelevo(outroClima.climate), corDaNeblinaDoRelevo(r.climate));
  assert.notEqual(tintDoRelevo(outroClima, [8, 8]), tintBaixo);
});

test('relevo: pincel com altitude emite relevo.pintar e linhas de nível rotulam bordas', () => {
  const celulas: [number, number][] = [[2, 3], [2, 4]];
  const comoMaterial = comandoDoPincelDeTerreno(PINCEL_PADRAO.terreno, celulas, false);
  assert.equal(comoMaterial.tipo, 'terreno.pintar');

  const emRelevo = { ...PINCEL_PADRAO.terreno, modo: 'relevo' as const, altura: -20 };
  const cmdRelevo = comandoDoPincelDeTerreno(emRelevo, celulas, false);
  assert.deepEqual(cmdRelevo, { tipo: 'relevo.pintar', altura: -20, celulas });

  const borrachaAlt = { ...PINCEL_PADRAO.terreno, modo: 'relevo' as const, altura: 0 };
  assert.deepEqual(comandoDoPincelDeTerreno(borrachaAlt, celulas, false), { tipo: 'relevo.pintar', altura: 0, celulas });
  assert.deepEqual(comandoDoPincelDeTerreno(emRelevo, celulas, true), { tipo: 'relevo.apagar', celulas });

  const m = aplicarEmCopia(criarMapa({ largura: 30, altura: 20 }), [
    { tipo: 'relevo.pintar', altura: -20, celulas: retanguloDeCelulas(0, 0, 60, 80) },
  ]);
  const { segmentos, rotulos } = segmentosERotulosDeNivel(m);
  assert.ok(segmentos.length > 0, 'desenha traços tracejados');
  assert.ok(rotulos.length >= 1, 'emite rótulo de altitude ao longo da borda');
  assert.ok(rotulos.every(r => r.texto === '−20 m'));
});

test('relevo (J9): patamar na margem do mapa não gera parede espúria nem artefato radial e mapa grande usa mRes reduzida', () => {
  const m = aplicarEmCopia(criarMapa({ largura: 30, altura: 30 }), [
    { tipo: 'relevo.pintar', altura: -15, celulas: retanguloDeCelulas(0, 0, 32, 32) },
  ]);
  const bordas = bordasDoRelevo(m);
  for (const b of bordas) {
    for (const seg of b.caminhos) {
      const naMargemX = seg.every(([x]) => Math.abs(x) < 1e-3);
      const naMargemY = seg.every(([, y]) => Math.abs(y) < 1e-3);
      assert.equal(naMargemX || naMargemY, false, 'borda do patamar não deve fechar sobre a margem do mapa');
    }
  }
  const celulas = codificar(retanguloDeCelulas(0, 0, 32, 32));
  const comp = comporMascaraDeRelevo([{ altura: -15, celulas }], 0, 0.25, 30, 30, 32);
  assert.equal(comp.mRes, 8);
  const idx = (xm: number, ym: number) => Math.floor(ym * comp.mRes) * comp.Mw + Math.floor(xm * comp.mRes);
  const gCanto = comp.gain[idx(0, 0)]!;
  const gInterior = comp.gain[idx(2, 2)]!;
  const bCanto = comp.bias[idx(0, 0)]!;
  const bInterior = comp.bias[idx(2, 2)]!;
  assert.ok(Math.abs(gCanto - gInterior) < 1e-4, `gain no canto (${gCanto}) deve igualar interior (${gInterior})`);
  assert.ok(Math.abs(bCanto - bInterior) < 1e-4, `bias no canto (${bCanto}) deve igualar interior (${bInterior})`);

  const grande = comporMascaraDeRelevo(
    [
      { altura: -10, celulas: codificar(retanguloDeCelulas(0, 0, 120, 120)) },
      { altura: -25, celulas: codificar(retanguloDeCelulas(120, 0, 240, 120)) },
    ],
    0,
    0.25,
    140,
    120,
    32,
  );
  assert.equal(grande.mRes, 4);
  assert.equal(grande.Mw, 140 * 4);
  assert.ok(grande.Mw < 140 * 32);
});

test('relevo: fatorDeProfundidade é monotônico, zera no topo e já separa degraus médios (3–10 m)', () => {
  assert.equal(fatorDeProfundidade(5, 5), 0);
  assert.equal(fatorDeProfundidade(8, 5), 0, 'acima do topo também é 0');
  let anterior = 0;
  for (let queda = 0.5; queda <= 30; queda += 0.5) {
    const p = fatorDeProfundidade(-queda, 0);
    assert.ok(p >= anterior, `monotônico em ${queda} m`);
    assert.ok(p <= 1);
    anterior = p;
  }
  assert.equal(fatorDeProfundidade(-20, 0), 1, 'satura em 20 m');
  assert.ok(fatorDeProfundidade(-3.5, 0) > 0.25, '3,5 m já tem leitura clara');
  assert.ok(fatorDeProfundidade(-13, 0) - fatorDeProfundidade(-3.5, 0) > 0.35, 'platô +3,5 m × vale −9,5 m bem separados');
});

test('relevo: degraus < 1 m pintam faixa de declive escura no lado baixo e borda clara na crista', () => {
  // Contexto falso: registra cada traço com a cor e os pontos.
  const tracos: { cor: string; largura: number; pts: number[][] }[] = [];
  let atual: number[][] = [];
  const falso = {
    strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
    save() {}, restore() {}, setTransform() {},
    beginPath() { atual = []; },
    moveTo(x: number, y: number) { atual.push([x, y]); },
    lineTo(x: number, y: number) { atual.push([x, y]); },
    stroke() { tracos.push({ cor: falso.strokeStyle, largura: falso.lineWidth, pts: atual }); },
  };
  const ctx = falso as unknown as Contexto;
  // Borda horizontal em y = 5, lado baixo para +y.
  const path: [number, number][] = [[0, 5], [10, 5]];
  const drop = ladoBaixo(path[0]!, path[1]!, 'a')[1] > 0 ? 'a' : 'b';
  pintarDegraus(ctx, [{ caminhos: [path], drops: [drop], desnivel: 0.5 }], 16, false);
  const alfa = (cor: string) => Number(/,\s*([\d.]+)\)$/.exec(cor)?.[1] ?? 0);
  const escuros = tracos.filter(t => t.cor.startsWith('rgba(0, 0, 0') || t.cor.startsWith('rgba(30'));
  const claros = tracos.filter(t => t.cor.startsWith('rgba(255'));
  assert.ok(escuros.length >= 6, 'faixa em camadas + hachuras + quebra');
  assert.ok(escuros.every(t => t.pts.every(p => p[1]! >= 5 - 1e-6)), 'sombra só no lado baixo');
  assert.ok(escuros.some(t => t.pts.some(p => p[1]! > 5 + larguraDoDeclive(0.5) * 0.5)), 'a faixa avança pelo declive');
  assert.ok(escuros.some(t => alfa(t.cor) >= 0.3), 'há sombra forte junto à crista');
  assert.ok(claros.length === 1 && claros[0]!.pts.every(p => p[1]! < 5), 'borda clara no lado alto');
  assert.ok(Math.abs(larguraDoDeclive(0.5) - 0.55) < 1e-9);
});
