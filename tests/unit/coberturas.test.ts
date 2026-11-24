import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPAS_DE_CUMEEIRA,
  CAPA_DA_COBERTURA,
  PADROES_DE_COBERTURA,
  PERIODO_DA_COBERTURA,
  amostradorContinuo,
  amostrarCobertura,
  amostrarPonto,
  amostrarPontoContinuo,
  capaDaCobertura,
  corDaAmostra,
  ehPadraoDeCobertura,
  hashDaPeca,
  type AmostraDeCobertura,
  type LadrilhoDeCobertura,
} from '../../src/procedural/coberturas.ts';
import { materiaisDo, padraoDependeDaArea } from '../../src/procedural/materiais.ts';
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

test('há 37 coberturas, todas com padrão de cobertura, capa de cumeeira e suporte no Pixel e fora de PADROES_DEPENDENTES_DE_AREA', () => {
  assert.equal(COBERTURAS.length, 37);
  for (const m of COBERTURAS) {
    assert.ok(ehPadraoDeCobertura(m.padrao), `${m.id} tem padrão ${m.padrao}`);
    assert.equal(padraoDependeDaArea(m.padrao), false, `${m.id} (${m.padrao}) não deve depender de área`);
    const capa = capaDaCobertura(m);
    assert.ok((CAPAS_DE_CUMEEIRA as readonly string[]).includes(capa), `${m.id} tem capa inválida: ${capa}`);
    assert.equal(capa, CAPA_DA_COBERTURA[m.padrao]);
  }
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
  const ids = [
    'telha.barro', 'telha.ardosia', 'telha.palha', 'telha.escamas', 'telha.zinco',
    'telha.tabuas', 'telha.francesa', 'telha.esmaltada.verde', 'telha.chapa.cinza',
    'telha.fibrocimento', 'telha.bambu', 'telha.couro', 'telha.chumbo',
    'telha.marmore', 'telha.ouro', 'telha.vidro', 'telha.vitral',
  ];
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

test('toda cobertura devolve h em [0, 1] e id inteiro estável (periódico e contínuo, inclusive coordenadas negativas)', () => {
  const saida: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  for (const m of COBERTURAS) {
    const fn = amostradorContinuo(m, 7);
    let minH = 1, maxH = 0;
    for (let k = 0; k < 400; k++) {
      const u = ((k * 1.7320508) % 13) - 4.5;
      const v = ((k * 2.2360679) % 11) - 3.5;
      const p1 = amostrarPonto(m, u, v, 7);
      const p2 = amostrarPonto(m, u, v, 7);
      assert.deepEqual(p1, p2, `${m.id} periódico não é determinístico`);
      assert.ok(Number.isFinite(p1.h) && p1.h >= 0 && p1.h <= 1, `${m.id} periódico h fora de [0, 1]: ${p1.h}`);
      assert.ok(Number.isInteger(p1.id) && p1.id >= 0, `${m.id} periódico id inválido: ${p1.id}`);

      const c1 = amostrarPontoContinuo(m, u, v, 7);
      const c2 = amostrarPontoContinuo(m, u, v, 7);
      fn(u, v, saida);
      assert.deepEqual(c1, c2, `${m.id} contínuo não é determinístico`);
      assert.deepEqual(c1, saida, `${m.id} amostradorContinuo diverge de amostrarPontoContinuo`);
      assert.ok(Number.isFinite(c1.h) && c1.h >= 0 && c1.h <= 1, `${m.id} contínuo h fora de [0, 1]: ${c1.h}`);
      assert.ok(Number.isInteger(c1.id) && c1.id >= 0, `${m.id} contínuo id inválido: ${c1.id}`);
      if (c1.h < minH) minH = c1.h;
      if (c1.h > maxH) maxH = c1.h;
    }
    assert.ok(maxH - minH > 0.25, `${m.id} quase sem relevo em h (${minH.toFixed(2)}..${maxH.toFixed(2)})`);
  }
});

test('duas peças vizinhas têm id diferente e pontos dentro da mesma peça mantêm o mesmo id', () => {
  // Passo característico de peça (em metros) em u e v para garantir que cruzamos para a peça vizinha em cada cobertura.
  const passos: Record<string, [number, number]> = {
    'telha-canal': [0.25, 0.4],
    imbrex: [0.52, 0.55],
    rebitada: [0.6, 0.45],
    remendada: [1.1, 0.9],
    escamas: [0.25, 0.22],
    ardosia: [0.25, 0.2],
    palha: [0.35, 0.5],
    tabuinhas: [0.35, 0.25],
    'lajes-telhado': [0.7, 0.4],
    ondulado: [1.0, 1.0],
    cobre: [0.4, 1.0],
    'concreto-laje': [1.0, 1.0],
    'grama-telhado': [0.55, 0.55],
    lona: [1.0, 1.0],
    'tabuas-telhado': [0.2, 1.0],
    'telha-francesa': [0.25, 0.4],
    'telha-esmaltada': [0.25, 0.25],
    'chapa-com-junta': [0.5, 1.0],
    fibrocimento: [1.0, 1.0],
    bambu: [0.2, 0.4],
    'couro-telhado': [0.7, 0.5],
    chumbo: [0.7, 1.0],
    'marmore-telhado': [0.7, 0.5],
    'ouro-telhado': [0.2, 0.2],
    'vidro-telhado': [0.5, 0.5],
    'vitral-telhado': [0.5, 0.5],
  };
  for (const m of COBERTURAS) {
    const [du, dv] = passos[m.padrao]!;
    const u0 = 1.13, v0 = 0.71;
    const base = amostrarPontoContinuo(m, u0, v0, 5);
    // Um ponto a 2 mm do centro permanece na mesma peça (id estável dentro da peça).
    const mesmo = amostrarPontoContinuo(m, u0 + 0.002, v0 + 0.002, 5);
    assert.equal(mesmo.id, base.id, `${m.id}: id mudou 2 mm ao lado dentro da peça`);

    const vizU = amostrarPontoContinuo(m, u0 + du, v0, 5);
    const vizV = amostrarPontoContinuo(m, u0, v0 + dv, 5);
    assert.notEqual(vizU.id, base.id, `${m.id}: peça vizinha em u (+${du} m) teve o mesmo id`);
    assert.notEqual(vizV.id, base.id, `${m.id}: peça vizinha em v (+${dv} m) teve o mesmo id`);
  }
});

test('amostragem contínua não repete a cada 2 m: peças 2 m adiante têm id único', () => {
  const P = PERIODO_DA_COBERTURA;
  for (const m of COBERTURAS) {
    const ids = new Set<number>();
    let repetiuNoPeriodo = 0;
    const total = 25;
    for (let k = 0; k < total; k++) {
      const u = 0.17 + k * P, v = 0.23 + (k % 5) * P;
      const a = amostrarPontoContinuo(m, u, v, 3);
      const b = amostrarPontoContinuo(m, u + P, v, 3);
      const c = amostrarPontoContinuo(m, u, v + P, 3);
      ids.add(a.id);
      if (a.id === b.id || a.id === c.id) repetiuNoPeriodo++;
    }
    assert.equal(repetiuNoPeriodo, 0, `${m.id}: id repetiu após deslocar ${P} m no modo contínuo`);
    assert.equal(ids.size, total, `${m.id}: esperava ${total} ids distintos a cada ${P} m, achou ${ids.size}`);
  }
});

test('telha de barro tem variação por peça e telhas trocadas (~1 em 40 visivelmente mais clara ou mais escura)', () => {
  const barro = COBERTURAS.find(m => m.id === 'telha.barro')!;
  const tons: number[] = [];
  // Amostra o centro de 400 capas distintas (20 colunas × 20 fiadas).
  for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
    const u = (i + 0.64) * 0.25;
    const v = (j + 0.5) * 0.4;
    tons.push(amostrarPontoContinuo(barro, u, v, 11).t);
  }
  const media = tons.reduce((a, b) => a + b, 0) / tons.length;
  const trocadas = tons.filter(t => Math.abs(t - media) > 0.19).length;
  assert.ok(trocadas >= 3 && trocadas <= 25, `esperava ~10 telhas trocadas em 400 (~1/40), achou ${trocadas}`);
});

test('corDaAmostra e hashDaPeca são determinísticos e ficam nas faixas válidas', () => {
  const rgb: [number, number, number] = [0, 0, 0];
  for (const m of COBERTURAS) {
    corDaAmostra(m, 0.5, 0.7, rgb);
    for (const c of rgb) assert.ok(c >= 0 && c <= 255 && Number.isFinite(c), `${m.id}: canal fora de [0, 255]`);
  }
  const h1 = hashDaPeca(12345, 7);
  assert.equal(h1, hashDaPeca(12345, 7));
  assert.ok(h1 >= 0 && h1 < 1);
  assert.notEqual(h1, hashDaPeca(12346, 7));
});

test('coberturas nobres e transparentes expõem alfa nos vidros/caixilhos, especular alto e cores ricas no vitral', () => {
  const vidro = COBERTURAS.find(m => m.id === 'telha.vidro')!;
  const vitral = COBERTURAS.find(m => m.id === 'telha.vitral')!;
  const ouro = COBERTURAS.find(m => m.id === 'telha.ouro')!;
  const marmore = COBERTURAS.find(m => m.id === 'telha.marmore')!;

  assert.ok((ouro.especular ?? 0) > 0.85);
  assert.ok((marmore.especular ?? 0) >= 0.3 && (marmore.especular ?? 0) <= 0.5);

  const centroVidro = amostrarPontoContinuo(vidro, 0.25, 0.25, 1);
  const caixilhoVidro = amostrarPontoContinuo(vidro, 0.005, 0.25, 1);
  assert.ok((centroVidro.alfa ?? 1) < 0.5, `painel de vidro deve ser translúcido, veio alfa=${centroVidro.alfa}`);
  assert.equal(caixilhoVidro.alfa, 1, 'caixilho de ferro do vidro deve ser opaco');
  assert.ok((centroVidro.especular ?? 0) > 0.75);
  assert.ok((caixilhoVidro.especular ?? 1) < 0.4);

  const chumboVitral = amostrarPontoContinuo(vitral, 0.005, 0.25, 1);
  assert.equal(chumboVitral.alfa, 1, 'malha de chumbo do vitral deve ser opaca');
  assert.equal(chumboVitral.cor, undefined);

  const coresVitral = new Set<string>();
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
    const a = amostrarPontoContinuo(vitral, i * 0.5 + 0.25, j * 0.5 + 0.25, 3);
    assert.ok((a.alfa ?? 1) < 0.6, `painel do vitral deve ser translúcido, veio alfa=${a.alfa}`);
    assert.ok(a.cor, 'painel do vitral deve expor cor RGB');
    coresVitral.add(a.cor.map(v => Math.round(v / 32)).join(','));
  }
  assert.ok(coresVitral.size >= 4, `vitral deve ter variedade de cores, achou ${coresVitral.size}`);
});
