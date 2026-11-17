import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, RECEITAS } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DA_MANSAO } from '../../src/procedural/receitas/mansao.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { MATERIAIS } from '../../src/procedural/materiais.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3): Parte[] => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };

test('o kit da mansão existe, desenha partes finitas e cabe na pegada', () => {
  assert.deepEqual(RECEITAS_DA_MANSAO.map(r => r.id), ['lareira.nobre', 'luminaria.franja', 'lustre', 'candelabro.pe', 'jantar.posto', 'sofa.capitone', 'poltrona.capitone', 'mesa.centro', 'mesa.carteado', 'escadaria.nobre', 'tapete.redondo']);
  for (const r of RECEITAS_DA_MANSAO) {
    assert.equal(RECEITAS[r.id], r); assert.equal(r.kit, 'mansao');
    const ps = partes(r.id), [w, h] = pegadaDaReceita(r.id), c = caixaDasPartes(ps);
    assert.ok(ps.length >= 6, r.id);
    for (const p of ps) assert.ok(p.forma === 'poli' ? p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(Number.isFinite), r.id);
    assert.ok(c.x1 - c.x0 <= w + 0.3 && c.y1 - c.y0 <= h + 0.3, `${r.id}: ${c.x1 - c.x0} × ${c.y1 - c.y0} em ${w} × ${h}`);
  }
});

test('a mesa posta cresce com o comprimento e ganha cadeiras; a lareira apaga', () => {
  assert.ok(pegadaDaReceita('jantar.posto', { largura: 5 })[0] > pegadaDaReceita('jantar.posto', { largura: 3 })[0]);
  const cadeiras = (l: number) => partes('jantar.posto', { largura: l }).filter(p => p.z > 0.9 && p.z < 1).length;
  assert.ok(cadeiras(5.6) > cadeiras(2.4));
  const chamas = (fogo: number) => partes('lareira.nobre', { fogo }).filter(p => p.mat === '#ffd66a').length;
  assert.ok(chamas(1) > chamas(0));
});

test('a escadaria nobre sobe de +y para −y, com passadeira e corrimão dos dois lados', () => {
  const ps = partes('escadaria.nobre', { largura: 2.4, comprimento: 5 }), pisadas = ps.filter(p => p.forma === 'ret' && p.dir === 0).sort((a, b) => b.y! - a.y!);
  assert.ok(pisadas.length >= 10);
  for (let i = 1; i < pisadas.length; i++) assert.ok(pisadas[i]!.z > pisadas[i - 1]!.z);
  for (const s of [-1, 1]) assert.ok(ps.some(p => p.forma === 'ret' && Math.sign(p.x!) === s && p.z > 1.1));
});

test('tapetes persas novos e o capitonê com botões', () => {
  for (const id of ['tapete.creme', 'tapete.azul']) assert.equal(MATERIAIS[id]!.padrao, 'persa');
  assert.ok(partes('sofa.capitone').filter(p => p.forma === 'elipse' && p.w! < 0.06).length >= 8);
});

test('tapete com desenho escolhido por @N, cinco desenhos, oval e paletas apagadas', async () => {
  const { materialDe } = await import('../../src/procedural/materiais.ts');
  assert.equal(materialDe('tapete.persa@3').desenho, 3);
  assert.equal(materialDe('tapete.persa@3').base, MATERIAIS['tapete.persa']!.base);
  assert.equal(materialDe('tapete.persa').desenho, undefined);
  for (const id of ['tapete.marinho', 'tapete.areia', 'tapete.desbotado']) assert.equal(MATERIAIS[id]!.padrao, 'persa');
  const ps = partes('tapete.persa', { desenho: 4 });
  assert.equal(ps[0]!.mat, 'tapete.persa@4');
  assert.equal(partes('tapete.persa')[0]!.mat, 'tapete.persa', 'sem desenho, a semente sorteia');
  const oval = partes('tapete.oval');
  assert.equal(oval[0]!.forma, 'elipse'); assert.ok(oval[0]!.mat.endsWith('@5'));
});

test('pisos de casarão: mármore com incrustação, espinha e assoalho marchetado', () => {
  assert.equal(MATERIAIS['marmore.incrustado']!.padrao, 'marmore');
  assert.ok(MATERIAIS['marmore.incrustado']!.meio);
  assert.equal(MATERIAIS['tabuas.marchetadas']!.padrao, 'marchetaria');
  assert.equal(MATERIAIS['parquet.espinha']!.padrao, 'espinha');
});
