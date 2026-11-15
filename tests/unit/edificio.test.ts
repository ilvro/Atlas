import test from 'node:test';
import assert from 'node:assert/strict';
import { aberturasDoEdificio, acessivel, plantaDoEdificio, type PlantaDoEdificio } from '../../src/authoring/edificio.ts';
import { ErroDeConstrucao, comodos, portas, aplicarEmCopia } from '../../src/authoring/construcao.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';

function desenharAscii(planta: PlantaDoEdificio): string {
  const [x0, y0, x1, y1] = planta.caixa;
  const grade: string[][] = Array.from({ length: y1 - y0 }, () => Array.from({ length: x1 - x0 }, () => '.'));
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  planta.comodos.forEach((c, idx) => {
    const ch = c.tipo === 'corredor' ? '#' : c.tipo === 'varanda' ? '~' : letras[idx % letras.length]!;
    for (const [rx0, ry0, rx1, ry1] of c.rets) {
      for (let y = ry0; y < ry1; y++) {
        for (let x = rx0; x < rx1; x++) grade[y - y0]![x - x0] = ch;
      }
    }
  });
  return grade.map(linha => linha.join('')).join('\n');
}

function areaEmCelulas(rets: readonly (readonly [number, number, number, number])[]): number {
  return rets.reduce((s, r) => s + (r[2] - r[0]) * (r[3] - r[1]), 0);
}

test('programa de 1 cômodo dá 1 retângulo na origem', () => {
  const m = criarMapa({ largura: 45, altura: 45 });
  const planta = plantaDoEdificio(m, {
    nome: 'Cabana',
    origem: [4, 5],
    frente: 's',
    comodos: [{ tipo: 'oficina', area: 18 }],
  }, 1);

  assert.equal(planta.comodos.length, 1);
  assert.equal(planta.comodos[0]!.principal, true);
  assert.equal(planta.comodos[0]!.ligadoA, null);
  assert.equal(planta.comodos[0]!.rets.length, 1);
  const r = planta.comodos[0]!.rets[0]!;
  assert.equal(r[0], 4);
  assert.equal(r[1], 5);
  assert.equal(planta.entrada.comodo, 0);
  assert.equal(planta.entrada.lado, 's');
});

test('3 cômodos em L dão uma caixa não retangular', () => {
  const m = criarMapa({ largura: 45, altura: 45 });
  const planta = plantaDoEdificio(m, {
    nome: 'Casa em L',
    origem: [3, 3],
    frente: 'n',
    forma: 'L',
    comodos: [
      { tipo: 'sala', area: 18, principal: true },
      { tipo: 'cozinha', area: 9 },
      { tipo: 'quarto', area: 9 },
    ],
  }, 7);

  const areaTotal = planta.comodos.reduce((s, c) => s + areaEmCelulas(c.rets), 0);
  const [x0, y0, x1, y1] = planta.caixa;
  const areaCaixa = (x1 - x0) * (y1 - y0);
  assert.ok(areaTotal < areaCaixa, `esperava L não preencher a caixa (${areaTotal} < ${areaCaixa})`);
});

test('linear com 6 cômodos tem corredor conectando o programa', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const planta = plantaDoEdificio(m, {
    nome: 'Alojamento Linear',
    origem: [4, 4],
    frente: 'n',
    forma: 'linear',
    comodos: [
      { tipo: 'salao', area: 18, principal: true },
      { tipo: 'dormitorio', area: 13.5 },
      { tipo: 'dormitorio', area: 13.5 },
      { tipo: 'banheiro', area: 9 },
      { tipo: 'cozinha', area: 13.5 },
      { tipo: 'deposito', area: 9 },
    ],
  }, 11);

  const corredor = planta.comodos.find(c => c.tipo === 'corredor');
  assert.ok(corredor, 'esperava inserção automática de corredor');
  const rCorr = corredor.rets[0]!;
  assert.equal(Math.min(rCorr[2] - rCorr[0], rCorr[3] - rCorr[1]), 1, 'corredor deve ter 1 célula de largura');
  assert.equal(planta.comodos.length, 7);
});

test('nenhuma planta colide com um cômodo existente no mapa', () => {
  let m = criarMapa({ largura: 45, altura: 45 });
  const c = comodos(m, [{ rets: [[6, 6, 10, 10]], tipo: 'deposito' }], 1);
  m = aplicarEmCopia(m, c.comandos);

  const ocupadas = new Set<string>();
  for (const r of Object.values(m.rooms)) {
    for (const [x, y] of decodificar(r.cells)) ocupadas.add(`${x},${y}`);
  }

  for (const semente of [1, 2, 5, 9]) {
    const planta = plantaDoEdificio(m, {
      nome: 'Anexo',
      origem: [3, 3],
      lote: [14, 14],
      frente: 'o',
      forma: 'auto',
      comodos: [
        { tipo: 'loja', area: 14, principal: true },
        { tipo: 'oficina', area: 9 },
        { tipo: 'quarto', area: 9 },
      ],
    }, semente);

    for (const com of planta.comodos) {
      for (const [x0, y0, x1, y1] of com.rets) {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            assert.equal(ocupadas.has(`${x},${y}`), false, `colidiu com célula existente (${x},${y})`);
          }
        }
      }
    }
  }
});

test('mesma semente dá a mesma planta e outra semente dá outra', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const prog = {
    nome: 'Casa Variada',
    origem: [5, 5] as [number, number],
    frente: 's' as const,
    forma: 'auto' as const,
    comodos: [
      { tipo: 'sala', area: 18 },
      { tipo: 'cozinha', area: 11 },
      { tipo: 'quarto', area: 11 },
      { tipo: 'quarto', area: 9 },
    ],
  };

  const a1 = plantaDoEdificio(m, prog, 42);
  const a2 = plantaDoEdificio(m, prog, 42);
  assert.deepEqual(a1, a2);

  const variantes = [1, 2, 3, 4, 5, 6, 7, 8].map(s => JSON.stringify(plantaDoEdificio(m, prog, s)));
  assert.ok(new Set(variantes).size >= 2, 'esperava variação entre sementes');
});

test('todo cômodo tem ligadoA válido e área fica a ±40% da pedida', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const areasPedidas = [20, 12, 10, 9];
  const planta = plantaDoEdificio(m, {
    nome: 'Estalagem',
    origem: [4, 4],
    frente: 'n',
    forma: 'U',
    alpendre: true,
    comodos: [
      { tipo: 'salao', area: areasPedidas[0]!, nome: 'Salão', principal: true },
      { tipo: 'cozinha', area: areasPedidas[1]!, nome: 'Cozinha' },
      { tipo: 'dormitorio', area: areasPedidas[2]!, nome: 'Dormitório' },
      { tipo: 'deposito', area: areasPedidas[3]!, nome: 'Depósito' },
    ],
  }, 15);

  const varanda = planta.comodos.find(c => c.tipo === 'varanda');
  assert.ok(varanda, 'esperava alpendre como varanda');

  let raizes = 0;
  for (let i = 0; i < planta.comodos.length; i++) {
    const c = planta.comodos[i]!;
    if (c.ligadoA === null) {
      raizes++;
      assert.equal(c.principal, true);
    } else {
      assert.ok(c.ligadoA >= 0 && c.ligadoA < planta.comodos.length && c.ligadoA !== i);
    }
    const origIdx = ['Salão', 'Cozinha', 'Dormitório', 'Depósito'].indexOf(c.nome);
    if (origIdx >= 0) {
      const realM2 = areaEmCelulas(c.rets) * 1.5 * 1.5;
      const pedida = areasPedidas[origIdx]!;
      assert.ok(
        realM2 >= pedida * 0.6 && realM2 <= pedida * 1.4,
        `área de ${c.nome}: ${realM2} m² fora de ±40% de ${pedida} m²`,
      );
    }
  }
  assert.equal(raizes, 1);
});

test('lote apertado demais lança ErroDeConstrucao com o motivo e a área livre que faltou', () => {
  const m = criarMapa({ largura: 30, altura: 30 });
  assert.throws(
    () =>
      plantaDoEdificio(
        m,
        {
          nome: 'Grande',
          origem: [2, 2],
          lote: [4, 4],
          frente: 'n',
          comodos: [
            { tipo: 'salao', area: 25 },
            { tipo: 'cozinha', area: 18 },
            { tipo: 'dormitorio', area: 18 },
          ],
        },
        1,
      ),
    (err: unknown) => err instanceof ErroDeConstrucao && /lote/i.test(err.message) && /m²/.test(err.message),
  );
});

test('gera plantas legíveis (ASCII) para 3 programas de exemplo', () => {
  const m = criarMapa({ largura: 60, altura: 60 });

  /*
   * Exemplo 1 — Casa do ferreiro (L, frente sul, com alpendre):
   * CC..
   * CC..
   * AA..
   * AABB
   * AABB
   * AABB
   * ~~..
   */
  const ex1 = plantaDoEdificio(m, {
    nome: 'Casa do Ferreiro',
    origem: [4, 4],
    frente: 's',
    forma: 'L',
    alpendre: true,
    comodos: [
      { tipo: 'oficina', area: 18, principal: true },
      { tipo: 'sala', area: 12 },
      { tipo: 'quarto', area: 9 },
    ],
  }, 3);

  /*
   * Exemplo 2 — Alojamento da guarda (linear com corredor, frente norte):
   * ..AA..
   * DDAAEE
   * DDAAEE
   * ######
   * ..CCFF
   * ..CCFF
   */
  const ex2 = plantaDoEdificio(m, {
    nome: 'Alojamento da Guarda',
    origem: [4, 4],
    frente: 'n',
    forma: 'linear',
    comodos: [
      { tipo: 'salao', area: 16, principal: true },
      { tipo: 'dormitorio', area: 12 },
      { tipo: 'dormitorio', area: 12 },
      { tipo: 'cozinha', area: 9 },
      { tipo: 'deposito', area: 9 },
    ],
  }, 5);

  /*
   * Exemplo 3 — Mosteiro com pátio (patio, frente oeste):
   * ~AAA...FF
   * ~AAA...FF
   * ~AAACCDDD
   * ..BBCCDDD
   * ..BBCCEE.
   * ....CCEE.
   */
  const ex3 = plantaDoEdificio(m, {
    nome: 'Mosteiro',
    origem: [4, 4],
    frente: 'o',
    forma: 'patio',
    alpendre: true,
    comodos: [
      { tipo: 'capela', area: 20, principal: true },
      { tipo: 'dormitorio', area: 14 },
      { tipo: 'refeitorio', area: 14 },
      { tipo: 'biblioteca', area: 12 },
      { tipo: 'cozinha', area: 9 },
      { tipo: 'deposito', area: 9 },
    ],
  }, 9);

  for (const planta of [ex1, ex2, ex3]) {
    const ascii = desenharAscii(planta);
    assert.ok(ascii.length > 0 && ascii.includes('\n'));
  }
});

test('toda planta gerada fica acessível por portas e aplica no mapa', () => {
  const mBase = criarMapa({ largura: 60, altura: 60 });
  const programas = [
    { nome: 'Cabana', origem: [4, 4] as [number, number], frente: 's' as const, comodos: [{ tipo: 'oficina', area: 18 }] },
    { nome: 'Casa L', origem: [4, 4] as [number, number], frente: 'n' as const, forma: 'L' as const, comodos: [{ tipo: 'sala', area: 18 }, { tipo: 'cozinha', area: 12 }, { tipo: 'quarto', area: 9 }] },
    { nome: 'Alojamento Linear', origem: [4, 4] as [number, number], frente: 'n' as const, forma: 'linear' as const, comodos: [{ tipo: 'salao', area: 16, principal: true }, { tipo: 'dormitorio', area: 12 }, { tipo: 'dormitorio', area: 12 }, { tipo: 'cozinha', area: 9 }, { tipo: 'deposito', area: 9 }] },
    { nome: 'Quartel em T', origem: [4, 4] as [number, number], frente: 's' as const, forma: 'T' as const, alpendre: true, comodos: [{ tipo: 'salao', area: 18, principal: true }, { tipo: 'dormitorio', area: 12 }, { tipo: 'dormitorio', area: 12 }, { tipo: 'oficina', area: 9 }, { tipo: 'deposito', area: 9 }] },
    { nome: 'Estalagem U', origem: [4, 4] as [number, number], frente: 'l' as const, forma: 'U' as const, alpendre: true, comodos: [{ tipo: 'taverna', area: 20, principal: true }, { tipo: 'cozinha', area: 12 }, { tipo: 'quarto', area: 9 }, { tipo: 'deposito', area: 9 }] },
    { nome: 'Mosteiro', origem: [4, 4] as [number, number], frente: 'o' as const, forma: 'patio' as const, comodos: [{ tipo: 'capela', area: 20, principal: true }, { tipo: 'dormitorio', area: 14 }, { tipo: 'refeitorio', area: 14 }, { tipo: 'cozinha', area: 9 }, { tipo: 'deposito', area: 9 }] },
  ];

  for (const prog of programas) {
    const planta = plantaDoEdificio(mBase, prog, 13);
    const ab = aberturasDoEdificio(planta, mBase.grid.size);
    assert.equal(acessivel(planta, ab, mBase.grid.size), true, `${prog.nome} deveria ficar acessível`);
    assert.ok(ab.portas.length >= 1);

    // Verifica que todas as portas e janelas encaixam de verdade nas paredes geradas no mapa
    const c = comodos(mBase, planta.comodos.map(cm => ({ rets: cm.rets, tipo: cm.tipo, nome: cm.nome })), 13);
    const comSalas = aplicarEmCopia(mBase, c.comandos);
    const ps = portas(comSalas, [...ab.portas, ...ab.janelas], 13);
    assert.equal(ps.ids.length, ab.portas.length + ab.janelas.length);
  }
});

test('janelas não caem em cela/depósito/corredor e respeitam distância de portas', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const planta = plantaDoEdificio(m, {
    nome: 'Masmorra e Galpão',
    origem: [4, 4],
    frente: 's',
    forma: 'linear',
    comodos: [
      { tipo: 'sala', area: 22, principal: true },
      { tipo: 'cela', area: 18 },
      { tipo: 'deposito', area: 18 },
      { tipo: 'porao', area: 18 },
      { tipo: 'quarto', area: 18 },
    ],
  }, 5);
  const ab = aberturasDoEdificio(planta, m.grid.size);

  const caixaDe = (rets: readonly (readonly [number, number, number, number])[]) =>
    rets.map(r => r.map(v => v * m.grid.size) as [number, number, number, number]);

  const proibidos = planta.comodos.filter(cm => ['cela', 'deposito', 'porao', 'corredor'].includes(cm.tipo));
  const comJanelas = planta.comodos.filter(cm => cm.tipo === 'sala' || cm.tipo === 'quarto');
  for (const j of ab.janelas) {
    // Nunca a menos de 1 célula de qualquer porta
    for (const d of ab.portas) {
      assert.ok(Math.hypot(j.perto[0] - d.perto[0], j.perto[1] - d.perto[1]) >= m.grid.size - 1e-6);
    }
    // Verifica que não encosta somente em cômodo proibido (cela/deposito/porao/corredor)
    const tocaPermitido = comJanelas.some(cm =>
      caixaDe(cm.rets).some(([x0, y0, x1, y1]) => j.perto[0] >= x0 - 0.1 && j.perto[0] <= x1 + 0.1 && j.perto[1] >= y0 - 0.1 && j.perto[1] <= y1 + 0.1),
    );
    assert.equal(tocaPermitido, true, `janela em [${j.perto}] fora de cômodos permitidos (proibidos: ${proibidos.length})`);
  }

  // Entrada fica na face `frente` ('s' neste caso -> y máximo da frente do principal)
  const principal = planta.comodos[planta.entrada.comodo]!;
  const maxY = Math.max(...principal.rets.map(r => r[3])) * m.grid.size;
  assert.ok(Math.abs(ab.portas[0]!.perto[1] - maxY) < 1e-6);
  assert.equal(ab.portas[0]!.largura, 1.2);
});
