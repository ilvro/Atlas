import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAIS, materiaisDo } from '../../src/procedural/materiais.ts';
import { PADROES_PIXEL } from '../../src/procedural/estilos/materiais-pixel.ts';

const NOVOS: Record<string, string[]> = {
  piso: ['terra.batida', 'palha.chao', 'pedra.rustica', 'tabuas.rusticas', 'metal.chapa', 'metal.grade', 'vinil.industrial', 'concreto.placas'],
  papel: ['toras', 'pedra.aparelhada', 'reboco.sujo', 'painel.metalico', 'painel.acolchoado'],
  terreno: ['neve.pisada', 'terra.congelada', 'piso.hangar'],
};

test('os materiais rústicos e industriais existem, cada um no seu uso', () => {
  for (const [uso, ids] of Object.entries(NOVOS)) for (const id of ids) {
    assert.equal(MATERIAIS[id]?.uso, uso, id);
    assert.ok(materiaisDo(uso as 'piso').some(m => m.id === id), id);
  }
});

test('os padrões novos têm pintor no Pixel e cores hex válidas', () => {
  for (const ids of Object.values(NOVOS)) for (const id of ids) {
    const m = MATERIAIS[id]!;
    assert.ok(PADROES_PIXEL.includes(m.padrao), `${id}: ${m.padrao}`);
    for (const c of [m.base, m.escuro, m.claro]) assert.match(c, /^#[0-9a-f]{6}$/, id);
  }
  assert.equal(MATERIAIS['piso.hangar']!.ouro, '#c9a12a', 'o hangar tem faixa de segurança');
});

test('neve mantém hierarquia distinta de neve.funda, neve.pisada e grama', () => {
  const neve = MATERIAIS['neve']!;
  const funda = MATERIAIS['neve.funda']!;
  const pisada = MATERIAIS['neve.pisada']!;
  const grama = MATERIAIS['grama']!;
  assert.equal(neve.uso, 'terreno');
  assert.equal(neve.padrao, 'neve');
  assert.notEqual(neve.padrao, grama.padrao);
  assert.notEqual(neve.padrao, funda.padrao);
  assert.notEqual(neve.padrao, pisada.padrao);
  assert.equal(neve.claro, '#ffffff');
});
