import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VISTA_INICIAL, ZOOM_MAX, ZOOM_MIN, arrastar, escalaBase, paraFracao, paraTela, retanguloDaImagem, suavizar, zoomEm } from '../../src/domain/inspecao.ts';

const tela = { largura: 1000, altura: 600 }, img = { largura: 1200, altura: 800 };
const perto = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test('a imagem cabe na tela com folga e fica centrada no zoom 1', () => {
  const r = retanguloDaImagem(VISTA_INICIAL, tela, img);
  assert.ok(r.w <= tela.largura && r.h <= tela.altura); perto(r.x + r.w / 2, 500); perto(r.y + r.h / 2, 300); perto(r.w / r.h, 1200 / 800);
  perto(r.h, 600 * 0.9, 1e-6);       // a altura é o que limita aqui
  perto(escalaBase(tela, img), (600 * 0.9) / 800);
});

test('paraFracao e paraTela são inversas, e o centro da tela é o centro da vista', () => {
  const v = { zoom: 2.5, cx: 0.3, cy: 0.7 };
  const f = paraFracao([420, 133], v, tela, img), p = paraTela(f, v, tela, img); perto(p[0], 420); perto(p[1], 133);
  const c = paraFracao([500, 300], v, tela, img); perto(c[0], 0.3); perto(c[1], 0.7);
});

test('zoomEm mantém o ponto sob o foco no mesmo lugar e respeita os limites', () => {
  const v = { zoom: 1, cx: 0.5, cy: 0.5 }, foco = [700, 200] as const;
  const antes = paraFracao(foco, v, tela, img), z = zoomEm(v, 3, foco, tela, img), depois = paraFracao(foco, z, tela, img);
  perto(z.zoom, 3); perto(depois[0], antes[0], 1e-9); perto(depois[1], antes[1], 1e-9);
  assert.equal(zoomEm({ ...v, zoom: ZOOM_MAX }, 2, foco, tela, img).zoom, ZOOM_MAX);
  assert.equal(zoomEm({ ...v, zoom: ZOOM_MIN }, 0.1, foco, tela, img).zoom, ZOOM_MIN);
});

test('arrastar anda a imagem junto do ponteiro e não deixa o centro sair dela', () => {
  const v = { zoom: 2, cx: 0.5, cy: 0.5 }, r0 = retanguloDaImagem(v, tela, img), a = arrastar(v, 50, -30, tela, img), r1 = retanguloDaImagem(a, tela, img);
  perto(r1.x - r0.x, 50, 1e-6); perto(r1.y - r0.y, -30, 1e-6);
  const longe = arrastar(v, 1e6, -1e6, tela, img); assert.equal(longe.cx, 0); assert.equal(longe.cy, 1);
});

test('suavizar caminha até o alvo sem passar dele, mais depressa com dt maior', () => {
  const a = suavizar(0, 1, 0.016), b = suavizar(0, 1, 0.1); assert.ok(a > 0 && a < b && b < 1);
  assert.equal(suavizar(0.4, 0.4, 0.05), 0.4); assert.ok(suavizar(0, 1, 5) > 0.999); assert.equal(suavizar(0, 1, 0), 0);
});
