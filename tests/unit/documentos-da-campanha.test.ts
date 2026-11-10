import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef, type Entidade } from '#mesa';
import type { Pista } from '../../src/data/pistas.ts';
import {
  documentosDaCampanha,
  documentosDaCampanhaAtiva,
  idsNaCampanha,
  recarregarDocumentosDaCampanha,
} from '../../src/app/pistas.ts';
import { campanhaAtiva } from '../../src/app/campanha.ts';
import type { Servicos } from '../../src/app/servicos.ts';

const baseEntidade: Omit<Entidade, 'id' | 'nome' | 'tipo' | 'refs'> = {
  campanhaId: 'c1',
  tags: [],
  notas: '',
  criadaPor: 'mesa',
  criadaEm: 1,
  atualizadaEm: 1,
};

const criarPistaMock = (id: string, name: string): Pista => ({
  id,
  name,
  category: 'cartas',
  tags: [],
  revision: 1,
  updatedAt: 100,
  hasUv: false,
  source: 'https://atelie/',
  preview: null,
});

test('documentosDaCampanha: cruza entidades com pistas entregues, ordena e remove duplicatas', () => {
  const e1: Entidade = {
    ...baseEntidade,
    id: 'ent-1',
    tipo: 'pista',
    nome: 'Zodíaco das Sombras',
    refs: [criarRef('atelie', 'documento', 'doc-z')],
  };
  const e2: Entidade = {
    ...baseEntidade,
    id: 'ent-2',
    tipo: 'pista',
    nome: 'Álbum Velho',
    refs: [criarRef('atelie', 'documento', 'doc-a')],
  };
  const eSemPistaEntregue: Entidade = {
    ...baseEntidade,
    id: 'ent-3',
    tipo: 'pista',
    nome: 'Carta Secreta',
    refs: [criarRef('atelie', 'documento', 'doc-c')],
  };
  const eSemRefAtelie: Entidade = {
    ...baseEntidade,
    id: 'ent-4',
    tipo: 'lugar',
    nome: 'Mansão',
    refs: [criarRef('atlas', 'mapa', 'map-1')],
  };
  const eDuplicada: Entidade = {
    ...baseEntidade,
    id: 'ent-5',
    tipo: 'pista',
    nome: 'Álbum Cópia',
    refs: [criarRef('atelie', 'documento', 'doc-a')],
  };

  const pistasEntregues = [
    criarPistaMock('doc-z', 'Zodíaco das Sombras'),
    criarPistaMock('doc-a', 'Álbum Velho'),
  ];

  const resultado = documentosDaCampanha([e1, e2, eSemPistaEntregue, eSemRefAtelie, eDuplicada], pistasEntregues);

  // Deve ignorar entidade sem ref do ateliê (eSemRefAtelie)
  // Deve deduplicar doc-a (fica a primeira encontrada, e2)
  assert.equal(resultado.length, 3);

  // Ordenação: Álbum Velho ('A') < Carta Secreta ('C') < Zodíaco ('Z')
  assert.equal(resultado[0]!.entidade.id, 'ent-2');
  assert.equal(resultado[0]!.idDoDocumento, 'doc-a');
  assert.notEqual(resultado[0]!.pista, null);
  assert.equal(resultado[0]!.pista?.id, 'doc-a');

  assert.equal(resultado[1]!.entidade.id, 'ent-3');
  assert.equal(resultado[1]!.idDoDocumento, 'doc-c');
  assert.equal(resultado[1]!.pista, null, 'documento sem pista entregue fica com pista: null');

  assert.equal(resultado[2]!.entidade.id, 'ent-1');
  assert.equal(resultado[2]!.idDoDocumento, 'doc-z');
  assert.notEqual(resultado[2]!.pista, null);
});

test('idsNaCampanha: extrai conjunto com os IDs de documento da campanha', () => {
  const e1: Entidade = { ...baseEntidade, id: '1', tipo: 'pista', nome: 'A', refs: [criarRef('atelie', 'documento', 'doc-1')] };
  const e2: Entidade = { ...baseEntidade, id: '2', tipo: 'pista', nome: 'B', refs: [criarRef('atelie', 'documento', 'doc-2')] };

  const docs = documentosDaCampanha([e1, e2], []);
  const ids = idsNaCampanha(docs);

  assert.equal(ids.size, 2);
  assert.ok(ids.has('doc-1'));
  assert.ok(ids.has('doc-2'));
  assert.ok(!ids.has('doc-3'));
});

test('recarregarDocumentosDaCampanha: atualiza signal com e sem campanha ativa', async () => {
  campanhaAtiva.value = null;
  await recarregarDocumentosDaCampanha(null);
  assert.equal(documentosDaCampanhaAtiva.value.length, 0);

  const e: Entidade = {
    ...baseEntidade,
    id: 'ent-1',
    tipo: 'pista',
    nome: 'Dossiê Oculto',
    refs: [criarRef('atelie', 'documento', 'doc-d')],
  };

  const servicosFalsos = {
    campanhas: {
      listarEntidades: async (campanhaId: string) => {
        assert.equal(campanhaId, 'c1');
        return [e];
      },
    },
  } as unknown as Servicos;

  campanhaAtiva.value = { id: 'c1', nome: 'Campanha 1', sistema: 'ordem', tema: null, capa: null, criadaEm: 1, atualizadaEm: 1 };
  await recarregarDocumentosDaCampanha(servicosFalsos);

  assert.equal(documentosDaCampanhaAtiva.value.length, 1);
  assert.equal(documentosDaCampanhaAtiva.value[0]!.idDoDocumento, 'doc-d');
  assert.equal(documentosDaCampanhaAtiva.value[0]!.entidade.nome, 'Dossiê Oculto');

  // Ao remover a campanha, limpa a lista
  campanhaAtiva.value = null;
  await recarregarDocumentosDaCampanha(servicosFalsos);
  assert.deepEqual(documentosDaCampanhaAtiva.value, []);
});
