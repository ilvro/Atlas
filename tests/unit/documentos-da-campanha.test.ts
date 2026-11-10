import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef, type Entidade } from '#mesa';
import type { Pista } from '../../src/data/pistas.ts';
import {
  abrirDocumentoNoAtelie,
  acrescentarDocumentoNaCampanha,
  adicionarPista,
  documentosDaCampanha,
  documentosDaCampanhaAtiva,
  idsNaCampanha,
  recarregarDocumentosDaCampanha,
} from '../../src/app/pistas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { signal } from '@preact/signals';
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
  const eOutroTipoComDoisRefs: Entidade = {
    ...baseEntidade,
    id: 'ent-6',
    tipo: 'nota',
    nome: 'Bilhete Amarelo',
    refs: [criarRef('atelie', 'documento', 'doc-b'), criarRef('atelie', 'documento', 'doc-ignorado')],
  };

  const pistasEntregues = [
    criarPistaMock('doc-z', 'Zodíaco das Sombras'),
    criarPistaMock('doc-a', 'Álbum Velho'),
    criarPistaMock('doc-b', 'Bilhete Amarelo'),
  ];

  const resultado = documentosDaCampanha([e1, e2, eSemPistaEntregue, eSemRefAtelie, eDuplicada, eOutroTipoComDoisRefs], pistasEntregues);

  // Deve ignorar entidade sem ref do ateliê (eSemRefAtelie)
  // Deve deduplicar doc-a (fica a primeira encontrada, e2)
  // Aceita qualquer tipo de entidade (eOutroTipoComDoisRefs é 'nota') e usa o primeiro Ref ('doc-b')
  assert.equal(resultado.length, 4);

  // Ordenação sem acento: Álbum Velho ('A') < Bilhete Amarelo ('B') < Carta Secreta ('C') < Zodíaco ('Z')
  assert.equal(resultado[0]!.entidade.id, 'ent-2');
  assert.equal(resultado[0]!.idDoDocumento, 'doc-a');
  assert.notEqual(resultado[0]!.pista, null);
  assert.equal(resultado[0]!.pista?.id, 'doc-a');

  assert.equal(resultado[1]!.entidade.id, 'ent-6');
  assert.equal(resultado[1]!.idDoDocumento, 'doc-b');
  assert.notEqual(resultado[1]!.pista, null);

  assert.equal(resultado[2]!.entidade.id, 'ent-3');
  assert.equal(resultado[2]!.idDoDocumento, 'doc-c');
  assert.equal(resultado[2]!.pista, null, 'documento sem pista entregue fica com pista: null');

  assert.equal(resultado[3]!.entidade.id, 'ent-1');
  assert.equal(resultado[3]!.idDoDocumento, 'doc-z');
  assert.notEqual(resultado[3]!.pista, null);
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

test('acrescentarDocumentoNaCampanha: cria entidade pista, não duplica e respeita ausência de campanha', async () => {
  const entidadesCriadas: unknown[] = [];
  const entidadesExistentes: Map<string, Entidade> = new Map();

  const servicosFalsos = {
    campanhas: {
      entidadeDaRef: async (_campanhaId: string, ref: { id: string }) => {
        return entidadesExistentes.get(ref.id) ?? undefined;
      },
      criarEntidade: async (dados: { campanhaId: string; tipo: string; nome: string; refs: any[] }) => {
        const criada: Entidade = {
          ...baseEntidade,
          id: `criada-${entidadesCriadas.length + 1}`,
          campanhaId: dados.campanhaId,
          tipo: dados.tipo as any,
          nome: dados.nome,
          refs: dados.refs,
        };
        entidadesCriadas.push(criada);
        entidadesExistentes.set(dados.refs[0]!.id, criada);
        return criada;
      },
      listarEntidades: async () => Array.from(entidadesExistentes.values()),
    },
  } as unknown as Servicos;

  // Sem campanha ativa
  campanhaAtiva.value = null;
  const semCampanha = await acrescentarDocumentoNaCampanha(servicosFalsos, { id: 'doc-x', name: 'Doc X' });
  assert.equal(semCampanha, null);
  assert.equal(entidadesCriadas.length, 0);

  // Com campanha ativa: cria
  campanhaAtiva.value = { id: 'c1', nome: 'Campanha 1', sistema: 'ordem', tema: null, capa: null, criadaEm: 1, atualizadaEm: 1 };
  const criada = await acrescentarDocumentoNaCampanha(servicosFalsos, { id: 'doc-1', name: 'Relatório Policial' });
  assert.notEqual(criada, null);
  assert.equal(criada?.tipo, 'pista');
  assert.equal(criada?.nome, 'Relatório Policial');
  assert.equal(criada?.refs[0]?.id, 'doc-1');
  assert.equal(entidadesCriadas.length, 1);

  // Segunda chamada com mesmo ID não duplica e retorna existente
  const segunda = await acrescentarDocumentoNaCampanha(servicosFalsos, { id: 'doc-1', name: 'Relatório Policial' });
  assert.equal(segunda?.id, criada?.id);
  assert.equal(entidadesCriadas.length, 1);
});

test('abrirDocumentoNoAtelie: barramento responde aberto; fallback tenta abrir janela', async () => {
  const ref = criarRef('atelie', 'documento', 'doc-123');

  // Caso 1: Barramento atende com ok: true
  const barramentoAtende = {
    pedir: async (tipo: string, dados: unknown) => {
      assert.equal(tipo, 'atelie.abrir');
      assert.deepEqual(dados, { ref });
      return { ok: true as const, resposta: { ok: true } };
    },
  };
  const resp1 = await abrirDocumentoNoAtelie(barramentoAtende, ref);
  assert.equal(resp1, 'aberto');

  // Caso 2: Barramento não atende / recusa; fallback abre janela
  const janelasAbertas: string[] = [];
  const originalOpen = globalThis.window?.open;
  (globalThis as any).window = {
    ...(globalThis.window ?? {}),
    open: (url: string) => {
      janelasAbertas.push(url);
      return null;
    },
  };

  try {
    const barramentoRecusa = {
      pedir: async () => {
        throw new Error('sem resposta');
      },
    };
    const resp2 = await abrirDocumentoNoAtelie(barramentoRecusa, ref);
    assert.equal(resp2, 'aba');
    assert.equal(janelasAbertas.length, 1);
    assert.ok(janelasAbertas[0]!.includes('handout=doc-123'));
  } finally {
    if (originalOpen) (globalThis as any).window.open = originalOpen;
  }
});

test('adicionarPista: põe o objeto no mapa e acrescenta automaticamente à campanha ativa', async () => {
  const entidadesCriadas: Entidade[] = [];
  const servicosFalsos = {
    campanhas: {
      entidadeDaRef: async () => undefined,
      criarEntidade: async (dados: { campanhaId: string; tipo: string; nome: string; refs: any[] }) => {
        const criada: Entidade = {
          ...baseEntidade,
          id: `pista-criada-${entidadesCriadas.length + 1}`,
          campanhaId: dados.campanhaId,
          tipo: dados.tipo as any,
          nome: dados.nome,
          refs: dados.refs,
        };
        entidadesCriadas.push(criada);
        return criada;
      },
      listarEntidades: async () => entidadesCriadas,
      listarLigacoes: async () => [],
      ligar: async () => ({ id: 'lig-1' }),
    },
  } as unknown as Servicos;

  campanhaAtiva.value = { id: 'c1', nome: 'Campanha 1', sistema: 'ordem', tema: null, capa: null, criadaEm: 1, atualizadaEm: 1 };

  const mapa = criarMapa({ nome: 'Mapa Teste', campanhaId: 'c1' });
  const sessaoFalsa = {
    store: {
      documento: mapa,
      executar: (cmd: { tipo: string; item?: { id: string } }) => {
        if (cmd.tipo === 'item.adicionar' && cmd.item) {
          (mapa.props as Record<string, unknown>)[cmd.item.id] = cmd.item;
        }
      },
    },
    selecao: signal<unknown[]>([]),
  } as any;

  const pista = criarPistaMock('doc-mapa-1', 'Pergaminho Antigo');
  const obj = adicionarPista(sessaoFalsa, pista, servicosFalsos, [10, 10]);

  assert.notEqual(obj, null);
  assert.equal(obj.interaction?.kind, 'clue');
  assert.equal(obj.interaction?.clue?.id, 'doc-mapa-1');

  // Aguarda microtask para a promise de acrescentarDocumentoNaCampanha resolver
  await new Promise(r => setTimeout(r, 20));

  assert.equal(entidadesCriadas.length, 1);
  assert.equal(entidadesCriadas[0]!.nome, 'Pergaminho Antigo');
  assert.equal(entidadesCriadas[0]!.refs[0]?.id, 'doc-mapa-1');
});
