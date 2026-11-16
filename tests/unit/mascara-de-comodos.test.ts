import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaDoPoligono, circulo, pontoNoPoligono } from '../../src/domain/formas-de-comodo.ts';
import type { Ponto } from '../../src/domain/mapa.ts';
import { faixasDosComodos } from '../../src/render/mascara-de-comodos.ts';
import { mapaCom, sala } from './apoio-casa.ts';

function retanguloRotacionado(cx: number, cy: number, w: number, h: number, ang: number): Ponto[] {
  const c = Math.cos(ang), s = Math.sin(ang);
  const hw = w * 0.5, hh = h * 0.5;
  return [
    [cx - hw * c + hh * s, cy - hw * s - hh * c],
    [cx - hw * c - hh * s, cy - hw * s + hh * c],
    [cx + hw * c - hh * s, cy + hw * s + hh * c],
    [cx + hw * c + hh * s, cy + hw * s - hh * c],
  ];
}

function conferirFaixasNoPoligono(faixas: { x: number; y: number; w: number; h: number }[], outline: readonly Ponto[]): void {
  assert.ok(faixas.length > 0, 'esperava ao menos uma faixa dentro do contorno');
  const amostras = [0.001, 0.25, 0.5, 0.75, 0.999];
  for (const f of faixas) {
    assert.ok(f.w > 0 && f.h > 0);
    for (const u of amostras) {
      for (const v of amostras) {
        const p: Ponto = [f.x + u * f.w, f.y + v * f.h];
        assert.equal(pontoNoPoligono(p, outline), true, `ponto [${p[0]}, ${p[1]}] fora do contorno`);
      }
    }
  }
}

test('faixasDosComodos em cômodo rotacionado gera faixas estritamente dentro do outline e área real', () => {
  const outline = retanguloRotacionado(8, 8, 6, 4, 0.6);
  const s = sala('rot', 0, 0, 1, 1, { outline });
  const m = mapaCom(s);
  const res = faixasDosComodos(m);
  conferirFaixasNoPoligono(res.faixas, outline);
  assert.ok(Math.abs(res.area - areaDoPoligono(outline)) < 1e-6);
});

test('faixasDosComodos em cômodo circular gera faixas estritamente dentro do outline e área real', () => {
  const outline = circulo([10, 10], 3, 24);
  const s = sala('cir', 0, 0, 1, 1, { outline });
  const m = mapaCom(s);
  const res = faixasDosComodos(m);
  conferirFaixasNoPoligono(res.faixas, outline);
  assert.ok(Math.abs(res.area - areaDoPoligono(outline)) < 1e-6);
});

test('faixasDosComodos em cômodo em L com outline não invade o recorte côncavo', () => {
  const outline: Ponto[] = [
    [2, 2], [2, 8], [8, 8], [8, 5], [5, 5], [5, 2],
  ];
  const s = sala('l', 0, 0, 1, 1, { outline });
  const res = faixasDosComodos(mapaCom(s));
  conferirFaixasNoPoligono(res.faixas, outline);
  assert.ok(Math.abs(res.area - areaDoPoligono(outline)) < 1e-6);
});

test('faixasDosComodos continua usando cells e somando área para cômodos comuns', () => {
  const s = sala('ret', 1, 2, 4, 4);
  const res = faixasDosComodos(mapaCom(s));
  assert.equal(res.faixas.length, 2);
  assert.ok(Math.abs(res.area - 3 * 2 * 1.5 * 1.5) < 1e-6);
});
