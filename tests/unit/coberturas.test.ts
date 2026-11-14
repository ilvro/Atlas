import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PADROES_DE_COBERTURA, PERIODO_DA_COBERTURA, amostrarCobertura, amostrarPonto, ehPadraoDeCobertura, type LadrilhoDeCobertura } from '../../src/procedural/coberturas.ts';
import { materiaisDo } from '../../src/procedural/materiais.ts';
import { PADROES_PIXEL } from '../../src/procedural/estilos/materiais-pixel.ts';

const COBERTURAS = materiaisDo('telhado');
const RES_PIXEL = 16 / 1.5;

/** Diferença média (0 a 255) entre duas colunas (ou linhas) do ladrilho. */
function diferenca(l: LadrilhoDeCobertura, a: number, b: number, eixo: 'x' | 'y'): number {
  let soma = 0;
  for (let k = 0; k < l.lado; k++) {
    const i = eixo === 'x' ? (k * l.lado + a) * 4 : (a * l.lado + k) * 4, j = eixo === 'x' ? (k * l.lado + b) * 4 : (b * l.lado + k) * 4;
    for (let c = 0; c < 3; c++) soma += Math.abs(l.dados[i + c]! - l.dados[j + c]!);
  }
  return soma / (l.lado * 3);
}

test('há 12 coberturas, todas com padrão de cobertura, e o Pixel sabe pintar cada padrão', () => {
  assert.equal(COBERTURAS.length, 12);
  for (const m of COBERTURAS) assert.ok(ehPadraoDeCobertura(m.padrao), `${m.id} tem padrão ${m.padrao}`);
  for (const p of PADROES_DE_COBERTURA) assert.ok(PADROES_PIXEL.includes(p), `o Pixel não pinta ${p}`);
  for (const p of PADROES_DE_COBERTURA) assert.ok(COBERTURAS.some(m => m.padrao === p), `nenhuma cobertura usa ${p}`);
});

test('o ladrilho emenda: o desenho num ponto é o mesmo um período adiante, nos dois eixos', () => {
  // A costura do ladrilho cai sobre uma fronteira do desenho (a beira de uma fiada); o que importa é o desenho fechar no período.
  const P = PERIODO_DA_COBERTURA;
  for (const m of COBERTURAS) for (let k = 0; k < 400; k++) {
    const x = ((k * 0.6180339) % 1) * P, y = ((k * 0.4142135) % 1) * P, a = amostrarPonto(m, x, y, 2);
    for (const [dx, dy] of [[P, 0], [0, P], [-P, 0], [0, -P]] as const) {
      const b = amostrarPonto(m, x + dx, y + dy, 2);
      assert.ok(Math.abs(a.t - b.t) < 1e-6 && Math.abs(a.m - b.m) < 1e-6, `${m.id} não fecha em (${x.toFixed(3)}, ${y.toFixed(3)}) + (${dx}, ${dy})`);
    }
  }
});

test('o ladrilho emenda de verdade: a costura não tem salto maior que a borda mais forte de dentro', () => {
  for (const m of COBERTURAS) for (const estilo of ['illustrated', 'pixel'] as const) {
    const l = amostrarCobertura(m, estilo, 1, RES_PIXEL), n = l.lado;
    for (const eixo of ['x', 'y'] as const) {
      let maior = 0;
      for (let k = 0; k < n - 1; k++) maior = Math.max(maior, diferenca(l, k, k + 1, eixo));
      const costura = diferenca(l, n - 1, 0, eixo);
      assert.ok(costura <= maior + 4, `${m.id} ${estilo} ${eixo}: costura ${costura.toFixed(1)} contra a maior borda ${maior.toFixed(1)}`);
    }
  }
});

test('mesma semente, mesmos pixels; o Pixel usa no máximo 7 cores (5 tons e 2 da mancha)', () => {
  for (const m of COBERTURAS) {
    assert.deepEqual(amostrarCobertura(m, 'illustrated', 3).dados, amostrarCobertura(m, 'illustrated', 3).dados);
    const l = amostrarCobertura(m, 'pixel', 2, RES_PIXEL), cores = new Set<number>();
    for (let i = 0; i < l.dados.length; i += 4) cores.add((l.dados[i]! << 16) | (l.dados[i + 1]! << 8) | l.dados[i + 2]!);
    assert.ok(cores.size <= 7, `${m.id}: ${cores.size} cores no Pixel`);
    assert.ok(cores.size >= 3, `${m.id}: só ${cores.size} cores no Pixel, o desenho sumiu`);
    assert.equal(l.lado, Math.round(2 * RES_PIXEL), 'um pixel do ladrilho por pixel do mapa');
  }
});

test('as coberturas são distintas: barro, ardósia e palha não saem iguais (nem só com a cor trocada)', () => {
  const luminancias = (id: string): number[] => {
    const l = amostrarCobertura(COBERTURAS.find(m => m.id === id)!, 'illustrated', 1), saida: number[] = [];
    for (let i = 0; i < l.dados.length; i += 4) saida.push(0.3 * l.dados[i]! + 0.59 * l.dados[i + 1]! + 0.11 * l.dados[i + 2]!);
    const media = saida.reduce((a, b) => a + b, 0) / saida.length, desvio = Math.sqrt(saida.reduce((a, b) => a + (b - media) ** 2, 0) / saida.length);
    return saida.map(v => (v - media) / (desvio || 1));      // só a forma do desenho, sem a cor
  };
  const ids = ['telha.barro', 'telha.ardosia', 'telha.palha', 'telha.escamas', 'telha.zinco'];
  const formas = ids.map(luminancias);
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const correlacao = formas[a]!.reduce((s, v, i) => s + v * formas[b]![i]!, 0) / formas[a]!.length;
    assert.ok(correlacao < 0.6, `${ids[a]} e ${ids[b]} têm o mesmo desenho (correlação ${correlacao.toFixed(2)})`);
  }
});

test('a mancha aparece onde há mancha: o cobre fica verde, a telha nova não', () => {
  const verde = (id: string) => {
    const l = amostrarCobertura(COBERTURAS.find(m => m.id === id)!, 'illustrated', 1);
    let n = 0;
    for (let i = 0; i < l.dados.length; i += 4) if (l.dados[i + 1]! > l.dados[i]! + 8) n++;
    return n / (l.lado * l.lado);
  };
  assert.ok(verde('telha.cobre') > 0.3, 'o azinhavre cobre boa parte do cobre');
  assert.ok(verde('telha.velha') > 0.1, 'a telha velha tem musgo');
  assert.equal(verde('telha.barro'), 0);
});
