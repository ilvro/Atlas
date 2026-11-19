import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import {
  ALTURA_BASE_TELHADO,
  campoDoEdificio,
  campoDosTrechos,
  type CampoDoTelhado,
} from '../../src/domain/campo-do-telhado.ts';
import { edificiosDe } from '../../src/domain/edificios.ts';
import { circulo } from '../../src/domain/formas-de-comodo.ts';
import { criarMapa, type Comodo, type MapaAtlas, type Ponto, type Telhado } from '../../src/domain/mapa.ts';
import { trechosDe } from '../../src/domain/telhado-geometria.ts';

function comodo(
  id: string,
  celulas: [number, number][],
  roof: Telhado,
  outline?: Ponto[],
): Comodo {
  return {
    id,
    name: id,
    function: null,
    cells: codificar(celulas),
    ...(outline ? { outline } : {}),
    floor: { material: 'pedra', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof,
    levelId: null,
  };
}

function retCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) out.push([x, y]);
  }
  return out;
}

function mapaComGrade(salas: Record<string, Comodo>, size = 1, offset: Ponto = [0, 0]): MapaAtlas {
  const m = criarMapa({ celula: size });
  m.grid.offset = offset;
  m.rooms = salas;
  return m;
}

function conferirGradienteNumerico(campo: CampoDoTelhado, x: number, y: number, tol = 2e-2): void {
  const eps = 1e-3;
  const c = campo.amostrar(x, y);
  const px = campo.amostrar(x + eps, y);
  const mx = campo.amostrar(x - eps, y);
  const py = campo.amostrar(x, y + eps);
  const my = campo.amostrar(x, y - eps);
  assert.ok(c && px && mx && py && my, `amostras válidas em (${x}, ${y})`);
  const dhdX = (px.h - mx.h) / (2 * eps);
  const dhdY = (py.h - my.h) / (2 * eps);
  assert.ok(Math.abs(c.gx - dhdX) < tol, `gx=${c.gx} vs numérico=${dhdX} em (${x}, ${y})`);
  assert.ok(Math.abs(c.gy - dhdY) < tol, `gy=${c.gy} vs numérico=${dhdY} em (${x}, ${y})`);
}

test('4 × 2 em quatro-aguas: h máximo no centro, gradiente consistente nas 4 águas, cumeeira, espigões e beiral', () => {
  const m = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.barro', visible: true, shape: 'quatro-aguas' }),
  });
  const ed = edificiosDe(m)[0]!;
  const campo = campoDoEdificio(m, ed, 0.25);

  assert.deepEqual(campo.caixa, { x0: -0.25, y0: -0.25, x1: 4.25, y1: 2.25, w: 4.5, h: 2.5 });
  assert.equal(campo.amostrar(-0.3, 1), null);
  assert.equal(campo.amostrar(2, 2.3), null);

  const k30 = Math.tan((30 * Math.PI) / 180);
  const centro = campo.amostrar(2, 1)!;
  assert.ok(centro);
  assert.ok(Math.abs(centro.h - (ALTURA_BASE_TELHADO + k30 * 1.25)) < 1e-6);
  assert.ok(Math.abs(campo.alturaMaxima - centro.h) < 1e-6);
  assert.equal(centro.peca, 'cumeeira');

  // Nenhuma amostra na grade interna supera a altura do centro.
  for (let y = -0.2; y <= 2.2; y += 0.2) {
    for (let x = -0.2; x <= 4.2; x += 0.2) {
      const a = campo.amostrar(x, y)!;
      assert.ok(a.h <= centro.h + 1e-6);
    }
  }

  // Nas 4 águas, (gx, gy) = (∂h/∂x, ∂h/∂y) aponta para dentro (subida) e (-gx, -gy) aponta para fora (queda/normal).
  const norte = campo.amostrar(2, 0.2)!;
  const sul = campo.amostrar(2, 1.8)!;
  const oeste = campo.amostrar(0.2, 1)!;
  const leste = campo.amostrar(3.8, 1)!;

  assert.equal(norte.peca, 'agua');
  assert.ok(Math.abs(norte.gx) < 1e-9 && Math.abs(norte.gy - k30) < 1e-6, 'água norte: -grad aponta para -y');
  assert.ok(-norte.gy < 0, 'normal horizontal norte aponta para fora (-y)');

  assert.equal(sul.peca, 'agua');
  assert.ok(Math.abs(sul.gx) < 1e-9 && Math.abs(sul.gy + k30) < 1e-6, 'água sul: -grad aponta para +y');
  assert.ok(-sul.gy > 0, 'normal horizontal sul aponta para fora (+y)');

  assert.equal(oeste.peca, 'agua');
  assert.ok(Math.abs(oeste.gx - k30) < 1e-6 && Math.abs(oeste.gy) < 1e-9, 'água oeste: -grad aponta para -x');
  assert.ok(-oeste.gx < 0, 'normal horizontal oeste aponta para fora (-x)');

  assert.equal(leste.peca, 'agua');
  assert.ok(Math.abs(leste.gx + k30) < 1e-6 && Math.abs(leste.gy) < 1e-9, 'água leste: -grad aponta para +x');
  assert.ok(-leste.gx > 0, 'normal horizontal leste aponta para fora (+x)');

  conferirGradienteNumerico(campo, 2, 0.2);
  conferirGradienteNumerico(campo, 2, 1.8);
  conferirGradienteNumerico(campo, 0.2, 1);
  conferirGradienteNumerico(campo, 3.8, 1);

  // Espigões nas 4 diagonais (45° a partir dos cantos expandidos).
  assert.equal(campo.amostrar(0.5, 0.5)!.peca, 'espigao');
  assert.equal(campo.amostrar(3.5, 0.5)!.peca, 'espigao');
  assert.equal(campo.amostrar(0.5, 1.5)!.peca, 'espigao');
  assert.equal(campo.amostrar(3.5, 1.5)!.peca, 'espigao');

  // Beiral na borda externa (<= 8 cm).
  const beiral = campo.amostrar(2, -0.22)!;
  assert.equal(beiral.peca, 'beiral');
  assert.ok(beiral.distAresta < 0.08);

  // steep: true sobe a inclinação de 30° para 50°.
  const mIngreme = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.ardosia', visible: true, shape: 'quatro-aguas', steep: true }),
  });
  const campoIngreme = campoDoEdificio(mIngreme, edificiosDe(mIngreme)[0]!, 0.25);
  const k50 = Math.tan((50 * Math.PI) / 180);
  assert.ok(Math.abs(campoIngreme.amostrar(2, 1)!.h - (ALTURA_BASE_TELHADO + k50 * 1.25)) < 1e-6);
});

test('L de duas duas-aguas: existe rincao na diagonal interna e o gradiente vira ao cruzá-la', () => {
  const celulasL = [...retCells(0, 0, 4, 2), ...retCells(0, 2, 2, 4)];
  const m = mapaComGrade({
    casa: comodo('casa', celulasL, { material: 'telha.barro', visible: true, shape: 'duas-aguas' }),
  });
  const campo = campoDoEdificio(m, edificiosDe(m)[0]!, 0.25);

  // Diagonal interna vai da junção das cumeeiras (1, 1) até o canto interno (2.25, 2.25).
  for (const t of [1.25, 1.5, 1.75, 2.0]) {
    const a = campo.amostrar(t, t)!;
    assert.ok(a);
    assert.equal(a.peca, 'rincao', `esperava rincao em (${t}, ${t}), veio ${a.peca}`);
    assert.ok(a.folgaRincao < 0.02);
  }

  // De um lado da diagonal vence a aba horizontal (gradiente em y), do outro vence a vertical (gradiente em x).
  const ladoHoriz = campo.amostrar(1.8, 1.4)!;
  const ladoVert = campo.amostrar(1.4, 1.8)!;
  assert.equal(ladoHoriz.peca, 'agua');
  assert.equal(ladoVert.peca, 'agua');
  assert.ok(Math.abs(ladoHoriz.gx) < 1e-6 && ladoHoriz.gy < 0, 'aba horizontal cai para +y');
  assert.ok(ladoVert.gx < 0 && Math.abs(ladoVert.gy) < 1e-6, 'aba vertical cai para +x');

  // Continuidade de altura cruzando a diagonal interna.
  const pA = campo.amostrar(1.51, 1.49)!;
  const pB = campo.amostrar(1.49, 1.51)!;
  assert.ok(Math.abs(pA.h - pB.h) < 0.02);

  // Cumeeiras dos dois braços preservadas.
  assert.equal(campo.amostrar(3.0, 1.0)!.peca, 'cumeeira');
  assert.equal(campo.amostrar(1.0, 3.0)!.peca, 'cumeeira');

  // Mesmo L com dois cômodos separados (materiais distintos) mantém rincão e troca de trecho na diagonal.
  const m2 = mapaComGrade({
    alaH: comodo('alaH', retCells(0, 0, 4, 2), { material: 'telha.barro', visible: true, shape: 'duas-aguas' }),
    alaV: comodo('alaV', retCells(0, 2, 2, 4), { material: 'telha.ardosia', visible: true, shape: 'duas-aguas' }),
  });
  const c2 = campoDoEdificio(m2, edificiosDe(m2)[0]!, 0.25);
  assert.equal(c2.amostrar(1.5, 1.5)!.peca, 'rincao');
  assert.equal(c2.amostrar(1.8, 1.4)!.trecho.salas[0], 'alaH');
  assert.equal(c2.amostrar(1.4, 1.8)!.trecho.salas[0], 'alaV');
});

test('L em quatro-aguas: rincao na diagonal interna, espigao na externa e sem falso rincao na água contínua', () => {
  const celulasL = [...retCells(0, 0, 4, 2), ...retCells(0, 2, 2, 4)];
  const m = mapaComGrade({
    casa: comodo('casa', celulasL, { material: 'telha.barro', visible: true, shape: 'quatro-aguas' }),
  });
  const campo = campoDoEdificio(m, edificiosDe(m)[0]!, 0.25);
  const k30 = Math.tan((30 * Math.PI) / 180);

  assert.equal(campo.amostrar(1.5, 1.5)!.peca, 'rincao', 'diagonal interna é rincão');
  assert.equal(campo.amostrar(0.4, 0.4)!.peca, 'espigao', 'diagonal externa é espigão');
  // Varredura contínua na água oeste (x = 0.5, y ∈ [0.8, 2.2]): sem costura, sem falso rincão ou espigão.
  for (let y = 0.8; y <= 2.2; y += 0.05) {
    const a = campo.amostrar(0.5, y)!;
    assert.equal(a.peca, 'agua', `esperava agua em (0.5, ${y.toFixed(2)}), veio ${a.peca}`);
    assert.ok(Math.abs(a.gx - k30) < 1e-6 && Math.abs(a.gy) < 1e-6);
  }
});

test('puxado de 2 m ao lado de corpo de 6 m: fica mais baixo, não cobre a cumeeira do corpo e gera rincao', () => {
  // Caso 1: puxado perpendicular de 2 m saindo da lateral sul de um corpo de 6 × 6 m.
  const mPerp = mapaComGrade({
    corpo: comodo('corpo', retCells(0, 0, 6, 6), { material: 'telha.barro', visible: true, shape: 'quatro-aguas' }),
    puxado: comodo('puxado', retCells(2, 6, 4, 9), { material: 'telha.zinco', visible: true, shape: 'duas-aguas' }),
  });
  const campoPerp = campoDoEdificio(mPerp, edificiosDe(mPerp)[0]!, 0.25);

  const picoCorpo = campoPerp.amostrar(3, 3)!;
  const picoPuxado = campoPerp.amostrar(3, 7.5)!;
  assert.equal(picoCorpo.trecho.salas[0], 'corpo');
  assert.equal(picoPuxado.trecho.salas[0], 'puxado');
  assert.ok(picoPuxado.h < picoCorpo.h - 1.0, 'puxado é bem mais baixo que o corpo');
  // Cumeeira/pico do corpo intactos.
  assert.equal(campoPerp.amostrar(3, 3)!.trecho.salas[0], 'corpo');
  assert.equal(campoPerp.amostrar(3, 4.5)!.trecho.salas[0], 'corpo');
  // Rincões diagonais saindo da junção (3, 5) para (1.75, 6.25) e (4.25, 6.25).
  assert.equal(campoPerp.amostrar(2.4, 5.6)!.peca, 'rincao');
  assert.equal(campoPerp.amostrar(3.6, 5.6)!.peca, 'rincao');

  // Caso 2: puxado lateral paralelo de 2 m colado à parede leste de um corpo 6 × 6 m em duas águas (cumeeira vertical).
  const mPar = mapaComGrade({
    corpo: comodo('corpo', retCells(0, 0, 6, 6), { material: 'telha.barro', visible: true, shape: 'duas-aguas', ridge: 'v' }),
    puxado: comodo('puxado', retCells(6, 0, 8, 6), { material: 'telha.zinco', visible: true, shape: 'duas-aguas', ridge: 'v' }),
  });
  const campoPar = campoDoEdificio(mPar, edificiosDe(mPar)[0]!, 0.25);

  const cumeeiraCorpo = campoPar.amostrar(3, 3)!;
  const cumeeiraPuxado = campoPar.amostrar(7, 3)!;
  assert.equal(cumeeiraCorpo.trecho.salas[0], 'corpo');
  assert.equal(cumeeiraCorpo.peca, 'cumeeira');
  assert.equal(cumeeiraPuxado.trecho.salas[0], 'puxado');
  assert.equal(cumeeiraPuxado.peca, 'cumeeira');
  assert.ok(cumeeiraPuxado.h < cumeeiraCorpo.h - 1.0);
  // Rincão reto exatamente no encontro x = 6.
  assert.equal(campoPar.amostrar(6, 3)!.peca, 'rincao');
});

test('cupula: h máximo no centro, simétrico em 8 direções e gradiente radial para fora', () => {
  const m = mapaComGrade({
    domo: comodo('domo', retCells(0, 0, 4, 4), { material: 'telha.cobre', visible: true, shape: 'cupula' }),
  });
  const campo = campoDoEdificio(m, edificiosDe(m)[0]!, 0.25);
  const cx = 2;
  const cy = 2;
  const r = 2.25;

  const centro = campo.amostrar(cx, cy)!;
  assert.ok(Math.abs(centro.h - (ALTURA_BASE_TELHADO + r)) < 1e-6);
  assert.ok(Math.abs(centro.gx) < 1e-9 && Math.abs(centro.gy) < 1e-9);
  assert.equal(centro.peca, 'agua');

  const d1 = 0.6;
  const d2 = 1.1;
  const simetricos: [number, number][] = [
    [cx + d1, cy + d2],
    [cx - d1, cy + d2],
    [cx + d1, cy - d2],
    [cx - d1, cy - d2],
    [cx + d2, cy + d1],
    [cx - d2, cy + d1],
    [cx + d2, cy - d1],
    [cx - d2, cy - d1],
  ];
  const hRef = campo.amostrar(simetricos[0]![0], simetricos[0]![1])!.h;
  assert.ok(hRef < centro.h);
  for (const [x, y] of simetricos) {
    const a = campo.amostrar(x, y)!;
    assert.ok(Math.abs(a.h - hRef) < 1e-9, `simetria em (${x}, ${y})`);
    // Normal horizontal (-gx, -gy) aponta radialmente para fora.
    const radial = -a.gx * (x - cx) + -a.gy * (y - cy);
    assert.ok(radial > 0);
  }
  conferirGradienteNumerico(campo, cx + d1, cy + d2);

  // Canto da caixa fora do círculo inscrito fica plano (ou beiral).
  const canto = campo.amostrar(0.15, 0.15)!;
  assert.equal(canto.peca, 'plano');
  assert.equal(canto.h, ALTURA_BASE_TELHADO);
});

test('u e v são contínuos dentro de uma água e v cresce do beiral para a cumeeira', () => {
  const m = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.barro', visible: true, shape: 'quatro-aguas' }),
  });
  const campo = campoDoEdificio(m, edificiosDe(m)[0]!, 0.25);

  const passo = 0.02;
  // Varredura em x ao longo da água norte (y = 0.3, x ∈ [1.1, 2.9]).
  let prev = campo.amostrar(1.1, 0.3)!;
  for (let x = 1.1 + passo; x <= 2.9; x += passo) {
    const atu = campo.amostrar(x, 0.3)!;
    assert.equal(atu.peca, 'agua');
    assert.ok(Math.abs(atu.u - prev.u - passo) < 1e-6, 'u cresce linearmente ao longo da aresta');
    assert.ok(Math.abs(atu.v - prev.v) < 1e-6, 'v constante paralelo ao beiral');
    prev = atu;
  }

  // Varredura em y subindo do beiral norte (-0.25) para a cumeeira (0.9) em x = 2.0.
  prev = campo.amostrar(2.0, -0.24)!;
  for (let y = -0.24 + passo; y <= 0.9; y += passo) {
    const atu = campo.amostrar(2.0, y)!;
    assert.ok(Math.abs(atu.v - prev.v - passo) < 1e-6, 'v cresce linearmente do beiral para a cumeeira');
    assert.ok(Math.abs(atu.u - prev.u) < 1e-6, 'u constante na direção da queda');
    prev = atu;
  }
});

test('uma-agua: queda para +y por padrão e para +x quando ridge é v', () => {
  const k30 = Math.tan((30 * Math.PI) / 180);

  const mH = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.zinco', visible: true, shape: 'uma-agua' }),
  });
  const cH = campoDoEdificio(mH, edificiosDe(mH)[0]!, 0.25);
  const altoH = cH.amostrar(2, 0.2)!;
  const baixoH = cH.amostrar(2, 1.8)!;
  assert.ok(altoH.h > baixoH.h, 'lado norte (-y) é mais alto');
  assert.ok(Math.abs(altoH.gx) < 1e-9 && Math.abs(altoH.gy + k30) < 1e-6);
  assert.equal(altoH.peca, 'agua');
  conferirGradienteNumerico(cH, 2, 1);

  const mV = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.zinco', visible: true, shape: 'uma-agua', ridge: 'v' }),
  });
  const cV = campoDoEdificio(mV, edificiosDe(mV)[0]!, 0.25);
  const altoV = cV.amostrar(0.5, 1)!;
  const baixoV = cV.amostrar(3.5, 1)!;
  assert.ok(altoV.h > baixoV.h, 'lado oeste (-x) é mais alto com ridge: v');
  assert.ok(Math.abs(altoV.gx + k30) < 1e-6 && Math.abs(altoV.gy) < 1e-9);
  conferirGradienteNumerico(cV, 2, 1);
});

test('mansarda e holandes: duas inclinações (70° até 40% do meio-vão e 25° depois)', () => {
  const k70 = Math.tan((70 * Math.PI) / 180);
  const k25 = Math.tan((25 * Math.PI) / 180);

  // 6 × 4 + beiral 0.25 -> w = 6.5, h = 4.5, meio-vão = 2.25, quebra a 0.4 * 2.25 = 0.90 m do beiral (y = -0.25 + 0.90 = 0.65).
  const mMans = mapaComGrade({
    a: comodo('a', retCells(0, 0, 6, 4), { material: 'telha.ardosia', visible: true, shape: 'mansarda' }),
  });
  const cMans = campoDoEdificio(mMans, edificiosDe(mMans)[0]!, 0.25);
  const saia = cMans.amostrar(3, 0.2)!; // d = 0.45 < 0.90 -> 70°
  const topo = cMans.amostrar(3, 1.3)!; // d = 1.55 > 0.90 -> 25°
  assert.ok(Math.abs(saia.gy - k70) < 1e-5, 'trecho inferior a 70°');
  assert.ok(Math.abs(topo.gy - k25) < 1e-5, 'trecho superior a 25°');
  assert.equal(cMans.amostrar(3, 2)!.peca, 'cumeeira');
  assert.equal(cMans.amostrar(0.8, 0.8)!.peca, 'espigao');
  // Na linha de quebra (d = 0.90 -> y = 0.65), a direção do gradiente não muda: segue sendo água.
  assert.equal(cMans.amostrar(3, 0.65)!.peca, 'agua');
  conferirGradienteNumerico(cMans, 3, 0.2);
  conferirGradienteNumerico(cMans, 3, 1.3);

  const mHol = mapaComGrade({
    a: comodo('a', retCells(0, 0, 6, 4), { material: 'telha.tabuinhas', visible: true, shape: 'holandes' }),
  });
  const cHol = campoDoEdificio(mHol, edificiosDe(mHol)[0]!, 0.25);
  assert.ok(Math.abs(cHol.amostrar(3, 0.2)!.gy - k70) < 1e-5);
  assert.ok(Math.abs(cHol.amostrar(3, 1.3)!.gy - k25) < 1e-5);
  assert.equal(cHol.amostrar(3, 2)!.peca, 'cumeeira');
  // Holandês tem só duas águas (não tem espigão diagonal).
  assert.equal(cHol.amostrar(0.8, 0.8)!.peca, 'agua');
});

test('plano: laje constante com gradiente nulo e platibanda elevada nos 14 cm externos', () => {
  const m = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 3), { material: 'telha.concreto', visible: true, shape: 'plano' }),
  });
  const campo = campoDoEdificio(m, edificiosDe(m)[0]!, 0.25);

  const laje1 = campo.amostrar(2, 1.5)!;
  const laje2 = campo.amostrar(0.5, 0.5)!;
  const plat = campo.amostrar(2, -0.2)!; // distAresta = 0.05 <= 0.14

  assert.equal(laje1.peca, 'plano');
  assert.equal(laje2.peca, 'plano');
  assert.equal(laje1.h, laje2.h);
  assert.equal(laje1.gx, 0);
  assert.equal(laje1.gy, 0);

  assert.equal(plat.peca, 'beiral');
  assert.ok(plat.h > laje1.h + 0.1, 'platibanda é elevada em relação à laje');
});

test('piramide, abobada, pagode e bulbo: perfis geométricos e gradientes analíticos corretos', () => {
  // Pirâmide em retângulo 4 × 2: ápice único no centro, sem cumeeira horizontal.
  const mPir = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.escamas', visible: true, shape: 'piramide' }),
  });
  const cPir = campoDoEdificio(mPir, edificiosDe(mPir)[0]!, 0.25);
  const apice = cPir.amostrar(2, 1)!;
  assert.ok(apice.h > cPir.amostrar(1.5, 1)!.h, 'pirâmide retangular tem ápice único no centro');
  assert.equal(apice.peca, 'espigao');
  conferirGradienteNumerico(cPir, 2, 0.2);
  conferirGradienteNumerico(cPir, 0.3, 1);

  // Abóbada: semicilindro no eixo maior (4 × 2 -> eixo horizontal), constante em x, circular em y.
  const mAbo = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 2), { material: 'telha.zinco', visible: true, shape: 'abobada' }),
  });
  const cAbo = campoDoEdificio(mAbo, edificiosDe(mAbo)[0]!, 0.25);
  const crista1 = cAbo.amostrar(1, 1)!;
  const crista2 = cAbo.amostrar(3, 1)!;
  assert.ok(Math.abs(crista1.h - crista2.h) < 1e-9);
  assert.ok(Math.abs(crista1.h - (ALTURA_BASE_TELHADO + 1.25)) < 1e-6);
  assert.equal(crista1.peca, 'agua');
  assert.ok(cAbo.amostrar(2, 0.3)!.h < crista1.h);
  conferirGradienteNumerico(cAbo, 2, 0.3);

  // Pagode: k * d^1.6 — inclinação cresce do beiral para o centro.
  const mPag = mapaComGrade({
    a: comodo('a', retCells(0, 0, 6, 4), { material: 'telha.barro', visible: true, shape: 'pagode' }),
  });
  const cPag = campoDoEdificio(mPag, edificiosDe(mPag)[0]!, 0.25);
  const pertoBeiral = cPag.amostrar(3, 0.1)!;
  const pertoTopo = cPag.amostrar(3, 1.4)!;
  assert.ok(Math.abs(pertoTopo.gy) > Math.abs(pertoBeiral.gy), 'pagode fica mais íngreme em direção à cumeeira');
  assert.equal(cPag.amostrar(3, 2)!.peca, 'cumeeira');
  assert.equal(cPag.amostrar(0.8, 0.8)!.peca, 'espigao');
  conferirGradienteNumerico(cPag, 3, 0.4);
  conferirGradienteNumerico(cPag, 3, 1.4);

  // Bulbo: simétrico, mais alto que cúpula no centro, decresce monotonicamente do centro até a borda.
  const mBul = mapaComGrade({
    a: comodo('a', retCells(0, 0, 4, 4), { material: 'telha.cobre', visible: true, shape: 'bulbo' }),
  });
  const cBul = campoDoEdificio(mBul, edificiosDe(mBul)[0]!, 0.25);
  const hCentro = cBul.amostrar(2, 2)!.h;
  assert.ok(hCentro > ALTURA_BASE_TELHADO + 2.25 * 1.4, 'ponta do bulbo sobe acima do hemisfério');
  let hAnt = hCentro;
  for (let d = 0.2; d <= 2.1; d += 0.2) {
    const a1 = cBul.amostrar(2 + d, 2)!;
    const a2 = cBul.amostrar(2, 2 - d)!;
    assert.ok(Math.abs(a1.h - a2.h) < 1e-9, 'bulbo é radialmente simétrico');
    assert.ok(a1.h < hAnt, 'bulbo decresce monotonicamente para fora');
    hAnt = a1.h;
  }
  conferirGradienteNumerico(cBul, 2.7, 2.4);
});

test('contorno livre (cone e plano em círculo): respeita o contorno expandido e a distância à borda', () => {
  const pts = circulo([6, 6], 3, 24);
  const mCone = mapaComGrade({
    torre: comodo('torre', [[4, 4]], { material: 'telha.escamas', visible: true, shape: 'cone', steep: true }, pts),
  });
  const campo = campoDoEdificio(mCone, edificiosDe(mCone)[0]!, 0.25);

  assert.equal(campo.amostrar(2, 6), null, 'fora do contorno expandido devolve null');
  const centro = campo.amostrar(6, 6)!;
  const k50 = Math.tan((50 * Math.PI) / 180);
  assert.ok(centro);
  // Raio expandido ≈ 3.25 m (com pequena correção poligonal de 24 lados).
  assert.ok(centro.h > ALTURA_BASE_TELHADO + k50 * 3.1 && centro.h < ALTURA_BASE_TELHADO + k50 * 3.35);

  const leste = campo.amostrar(8, 6)!;
  assert.equal(leste.peca, 'agua');
  assert.ok(-leste.gx > 0 && Math.abs(leste.gy) < 0.2, 'normal horizontal aponta radialmente para leste');
  assert.ok(leste.h < centro.h);
  conferirGradienteNumerico(campo, 7.5, 6.8);

  const borda = campo.amostrar(9.2, 6)!;
  assert.equal(borda.peca, 'beiral');

  // Contorno livre plano tem laje plana e platibanda.
  const mPlano = mapaComGrade({
    torre: comodo('torre', [[4, 4]], { material: 'telha.concreto', visible: true, shape: 'plano' }, pts),
  });
  const cPlano = campoDoEdificio(mPlano, edificiosDe(mPlano)[0]!, 0.25);
  assert.equal(cPlano.amostrar(6, 6)!.peca, 'plano');
  assert.equal(cPlano.amostrar(9.18, 6)!.peca, 'beiral');
  assert.ok(cPlano.amostrar(9.18, 6)!.h > cPlano.amostrar(6, 6)!.h + 0.1);

  // Contorno livre em cúpula e bulbo: centro máximo e gradiente consistente.
  const mCup = mapaComGrade({
    torre: comodo('torre', [[4, 4]], { material: 'telha.cobre', visible: true, shape: 'cupula' }, pts),
  });
  const cCup = campoDoEdificio(mCup, edificiosDe(mCup)[0]!, 0.25);
  assert.ok(cCup.amostrar(6, 6)!.h > cCup.amostrar(7.5, 6)!.h);
  conferirGradienteNumerico(cCup, 7.2, 6.5, 5e-2);

  const mBul = mapaComGrade({
    torre: comodo('torre', [[4, 4]], { material: 'telha.cobre', visible: true, shape: 'bulbo' }, pts),
  });
  const cBul = campoDoEdificio(mBul, edificiosDe(mBul)[0]!, 0.25);
  assert.ok(cBul.amostrar(6, 6)!.h > cCup.amostrar(6, 6)!.h);
  conferirGradienteNumerico(cBul, 7.2, 6.5, 5e-2);

  // Cone em cômodo retangular (sem outline) usa cone inscrito simétrico.
  const mConeRet = mapaComGrade({
    torre: comodo('torre', retCells(0, 0, 4, 4), { material: 'telha.escamas', visible: true, shape: 'cone' }),
  });
  const cConeRet = campoDoEdificio(mConeRet, edificiosDe(mConeRet)[0]!, 0.25);
  assert.ok(cConeRet.amostrar(2, 2)!.h > cConeRet.amostrar(3, 2)!.h);
  assert.ok(Math.abs(cConeRet.amostrar(3, 2)!.h - cConeRet.amostrar(2, 3)!.h) < 1e-9);
  conferirGradienteNumerico(cConeRet, 2.8, 2.4);
});

test('grade com size/offset, campoDosTrechos e edifício vazio', () => {
  const m = mapaComGrade(
    {
      a: comodo('a', retCells(0, 0, 2, 2), { material: 'telha.barro', visible: true, shape: 'duas-aguas' }),
    },
    1.5,
    [3, 2],
  );
  const ed = edificiosDe(m)[0]!;
  const c1 = campoDoEdificio(m, ed, 0.25);
  const c2 = campoDosTrechos(trechosDe(m, ed), m.grid, 0.25);

  assert.deepEqual(c1.caixa, { x0: 2.75, y0: 1.75, x1: 6.25, y1: 5.25, w: 3.5, h: 3.5 });
  assert.deepEqual(c2.caixa, c1.caixa);
  assert.equal(c1.amostrar(4.5, 3.5)!.h, c2.amostrar(4.5, 3.5)!.h);

  const vazio = campoDosTrechos([], m.grid);
  assert.equal(vazio.amostrar(0, 0), null);
  assert.equal(vazio.alturaMaxima, ALTURA_BASE_TELHADO);
});
