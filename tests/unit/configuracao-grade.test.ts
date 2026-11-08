import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore } from '../../src/state/store.ts';
import { criarMapa, CORES_DE_GRADE } from '../../src/domain/mapa.ts';
import { alinhandoGrade } from '../../src/app/modo.ts';

test('configuracao-grade: catalogo de cores possui auto e 11 cores da referencia', () => {
  assert.equal(CORES_DE_GRADE.length, 12);
  assert.equal(CORES_DE_GRADE[0], 'auto');
  assert.ok(CORES_DE_GRADE.includes('#ff1f1f'));
  assert.ok(CORES_DE_GRADE.includes('#ffffff'));
  assert.ok(CORES_DE_GRADE.includes('#000000'));
});

test('configuracao-grade: atualizacao da grade (cor vermelha, estilo dashed, snap desligado)', () => {
  const mapa = criarMapa({ id: 'teste-grade', nome: 'Teste Grade' });
  const st = criarStore(mapa);

  assert.equal(st.documento.grid.color, 'auto');
  assert.equal(st.documento.grid.lineStyle, 'solid');
  assert.equal(st.documento.grid.snap, true);

  // 1. Troca a cor para vermelho
  st.executar({ tipo: 'grade.atualizar', patch: { color: '#ff1f1f' } });
  assert.equal(st.documento.grid.color, '#ff1f1f');

  // 2. Troca o estilo da linha para dashed
  st.executar({ tipo: 'grade.atualizar', patch: { lineStyle: 'dashed' } });
  assert.equal(st.documento.grid.lineStyle, 'dashed');

  // 3. Desliga o snap independente
  st.executar({ tipo: 'grade.atualizar', patch: { snap: false } });
  assert.equal(st.documento.grid.snap, false);

  // 4. Troca tipo para hex
  st.executar({ tipo: 'grade.atualizar', patch: { kind: 'hex' } });
  assert.equal(st.documento.grid.kind, 'hex');

  // 5. Histórico e desfazer funcionam corretamente
  st.desfazer();
  assert.equal(st.documento.grid.kind, 'square');
  st.desfazer();
  assert.equal(st.documento.grid.snap, true);
  st.desfazer();
  assert.equal(st.documento.grid.lineStyle, 'solid');
  st.desfazer();
  assert.equal(st.documento.grid.color, 'auto');
});

test('configuracao-grade: ajuste continuo por gesto (sliders de opacidade e espessura)', () => {
  const mapa = criarMapa({ id: 'teste-gesto', nome: 'Teste Gesto' });
  const st = criarStore(mapa);

  // Gesto de opacidade
  const g1 = st.iniciarGesto('Opacidade da grade');
  g1.aplicar({ tipo: 'grade.atualizar', patch: { opacity: 0.2 } });
  g1.aplicar({ tipo: 'grade.atualizar', patch: { opacity: 0.8 } });
  assert.equal(st.documento.grid.opacity, 0.8);
  g1.concluir();

  // Histórico tem 1 única entrada do gesto
  assert.equal(st.historico.length, 1);
  st.desfazer();
  assert.equal(st.documento.grid.opacity, 0.1);

  // Gesto de espessura
  const g2 = st.iniciarGesto('Espessura da grade');
  g2.aplicar({ tipo: 'grade.atualizar', patch: { lineWidth: 3.5 } });
  g2.concluir();
  assert.equal(st.documento.grid.lineWidth, 3.5);
  st.desfazer();
  assert.equal(st.documento.grid.lineWidth, 1);
});

test('configuracao-grade: toggle do modo de alinhamento visual', () => {
  alinhandoGrade.value = false;
  assert.equal(alinhandoGrade.value, false);

  alinhandoGrade.value = true;
  assert.equal(alinhandoGrade.value, true);

  alinhandoGrade.value = false;
  assert.equal(alinhandoGrade.value, false);
});
