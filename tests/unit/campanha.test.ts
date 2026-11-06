import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { abrirRepositorioCampanha, mesmaRef } from '#mesa';
import { sincronizarMapaComCampanha, refDoMapa, entidadeDoMapa } from '../../src/app/campanha.ts';
import { gerarMiniaturaDoMapa } from '../../src/ui/previa.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import type { Servicos } from '../../src/app/servicos.ts';

test('gerarMiniaturaDoMapa: em ambiente Node sem canvas, retorna undefined silenciosamente', async () => {
  const m = criarMapa({ id: 'm1', agora: 1 });
  const resultado = await gerarMiniaturaDoMapa(m);
  assert.equal(resultado, undefined);
});

test('sincronizarMapaComCampanha: grava miniatura (retrato: Blob) na entidade lugar da campanha', async () => {
  const idb = new IDBFactory();
  const repoCampanha = await abrirRepositorioCampanha({ app: 'atlas', idb });
  const campanha = await repoCampanha.criarCampanha({ nome: 'Campanha de Teste' });

  const fakeServicos: Servicos = {
    repo: null as never,
    campanhas: repoCampanha,
    barramento: null,
  };

  const mapa = criarMapa({ id: 'mapa-com-retrato', agora: 1 });
  mapa.campanhaId = campanha.id;
  mapa.name = 'Mansão Abandonada';

  const mockBlob = new Blob(['fake-webp-bytes'], { type: 'image/webp' });
  const gerador = async () => mockBlob;

  // 1. Cria a entidade lugar com o retrato
  await sincronizarMapaComCampanha(fakeServicos, mapa, gerador);

  const entidade = await entidadeDoMapa(fakeServicos, mapa);
  assert.ok(entidade, 'Entidade de lugar deve ter sido criada');
  assert.equal(entidade.tipo, 'lugar');
  assert.equal(entidade.nome, 'Mansão Abandonada');
  assert.ok(entidade.refs.some(r => mesmaRef(r, refDoMapa(mapa))));
  assert.ok(entidade.retrato, 'Retrato deve estar presente');
  assert.equal(entidade.retrato.type, 'image/webp');
  assert.equal(entidade.retrato.size, mockBlob.size);

  // 2. Atualiza o nome e gera um novo retrato
  mapa.name = 'Mansão Assombrada';
  const novoBlob = new Blob(['novo-webp-conteudo-diferente'], { type: 'image/webp' });
  await sincronizarMapaComCampanha(fakeServicos, mapa, async () => novoBlob);

  const atualizada = (await entidadeDoMapa(fakeServicos, mapa))!;
  assert.equal(atualizada.nome, 'Mansão Assombrada');
  assert.equal(atualizada.retrato?.size, novoBlob.size);

  // 3. Se o gerador retornar undefined na atualização, preserva o retrato existente
  mapa.name = 'Mansão Restaurada';
  await sincronizarMapaComCampanha(fakeServicos, mapa, async () => undefined);

  const preservada = (await entidadeDoMapa(fakeServicos, mapa))!;
  assert.equal(preservada.nome, 'Mansão Restaurada');
  assert.equal(preservada.retrato?.size, novoBlob.size);
});
