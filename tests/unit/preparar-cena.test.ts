import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  abrirRepositorioCampanha,
  criarBarramento,
  criarRef,
  type Barramento,
  type Ref,
} from '#mesa';
import {
  prepararCenaNoAtlas,
  tocarMomentoRemoto,
  abrirMapa,
  fecharSessao,
  cacheDeSessoes,
  sessao,
  servicos,
  type DadosPrepararCena,
  type DadosAtlasMomento,
} from '../../src/app/app.ts';
import { momentoEmCurso } from '../../src/app/momentos.ts';
import { novoMomento } from '../../src/domain/momentos.ts';
import { entidadesDaCampanha } from '../../src/app/campanha.ts';
import { abasAbertas } from '../../src/app/abas.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import type { RepositorioMapas } from '../../src/data/repositorio.ts';
import type { Servicos } from '../../src/app/servicos.ts';

function criarRepoMock(mapas: Record<string, MapaAtlas> = {}): RepositorioMapas {
  const dados = new Map<string, MapaAtlas>(Object.entries(mapas));
  return {
    async listar() { return []; },
    async obter(id: string) { return dados.get(id); },
    async salvar(m: MapaAtlas) { dados.set(m.id, m); return m; },
    async restaurar(m: MapaAtlas) { dados.set(m.id, m); },
    async remover(id: string) { dados.delete(id); },
    async obterRascunho() { return undefined; },
    async salvarRascunho() {},
    async descartarRascunho() {},
    async listarRascunhos() { return []; },
    async salvarAsset() { return { id: 'asset-1', hash: 'hash-1' }; },
    async obterAsset() { return undefined; },
    async listarAssets() { return []; },
    async restaurarAsset() {},
    fechar() {},
  };
}

class CanalEmMemoria {
  static canais = new Map<string, Set<CanalEmMemoria>>();
  nome: string;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  private grupo: Set<CanalEmMemoria>;

  constructor(nome: string) {
    this.nome = nome;
    let g = CanalEmMemoria.canais.get(nome);
    if (!g) {
      g = new Set();
      CanalEmMemoria.canais.set(nome, g);
    }
    this.grupo = g;
    this.grupo.add(this);
  }

  postMessage(data: unknown): void {
    for (const c of this.grupo) {
      if (c !== this && c.onmessage) {
        c.onmessage({ data });
      }
    }
  }

  close(): void {
    this.grupo.delete(this);
  }
}

test('prepararCenaNoAtlas: abre mapa, aplica clima e posiciona fichas no cômodo sem duplicatas', async () => {
  const idb = new IDBFactory();
  const repoCampanha = await abrirRepositorioCampanha({ app: 'atlas', idb });
  const campanha = await repoCampanha.criarCampanha({ nome: 'Campanha de Encontro' });

  // Cria o mapa com uma sala "Taverna"
  const mapa = criarMapa({ id: 'mapa-taverna', agora: 1 });
  mapa.campanhaId = campanha.id;
  mapa.name = 'Taverna do Javali';
  mapa.rooms['quarto-1'] = {
    id: 'quarto-1',
    name: 'Taverna',
    function: null,
    cells: [[2, 2, 4]], // y=2, x=2..5
    floor: { material: 'madeira', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material: null, visible: false },
    levelId: null,
  };

  const repo = criarRepoMock({ [mapa.id]: mapa });
  const fakeServicos: Servicos = {
    repo,
    campanhas: repoCampanha,
    barramento: null,
  };
  servicos.value = fakeServicos;

  // Cria entidades de personagem e ameaça com ficha
  const fichaHeroi = criarRef('ficha', 'ficha', 'heroi-1');
  const fichaMonstro = criarRef('ficha', 'ficha', 'monstro-1');

  const entHeroi = await repoCampanha.criarEntidade({
    campanhaId: campanha.id,
    tipo: 'personagem',
    nome: 'Guerreiro',
    refs: [fichaHeroi],
  });
  const entMonstro = await repoCampanha.criarEntidade({
    campanhaId: campanha.id,
    tipo: 'ameaca',
    nome: 'Orc Chefe',
    refs: [fichaMonstro],
  });
  entidadesDaCampanha.value = [entHeroi, entMonstro];

  // 1. Executa prepararCenaNoAtlas
  const res1 = await prepararCenaNoAtlas(fakeServicos, {
    mapa: criarRef('atlas', 'mapa', mapa.id),
    comodo: 'Taverna',
    clima: 'tempestade',
    fichas: [fichaHeroi, fichaMonstro],
  });

  assert.equal(res1.ok, true);
  assert.ok(sessao.value, 'sessao.value deve existir após abrirMapa');
  assert.equal(sessao.value.doc.value.id, mapa.id);
  assert.ok(abasAbertas.value.some(a => a.id === mapa.id));
  assert.equal(sessao.value.doc.value.climate.preset, 'tempestade');

  // Duas peças devem ter sido adicionadas
  const pecas1 = Object.values(sessao.value.doc.value.tokens);
  assert.equal(pecas1.length, 2);
  const pecaHeroi = pecas1.find(p => p.refs.some(r => r.id === 'heroi-1'));
  const pecaMonstro = pecas1.find(p => p.refs.some(r => r.id === 'monstro-1'));
  assert.ok(pecaHeroi, 'Peça do herói deve estar no mapa');
  assert.ok(pecaMonstro, 'Peça do monstro deve estar no mapa');
  assert.equal(pecaHeroi.player, true);
  assert.equal(pecaMonstro.player, false);

  // 2. Chamar novamente não duplica peças
  const res2 = await prepararCenaNoAtlas(fakeServicos, {
    comodo: 'Taverna',
    fichas: [fichaHeroi, fichaMonstro],
  });
  assert.equal(res2.ok, true);
  assert.equal(Object.values(sessao.value.doc.value.tokens).length, 2);
});

test('atendimento de atlas.preparar-cena via barramento', async () => {
  const mapa = criarMapa({ id: 'mapa-barramento', agora: 1 });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const canalNome = 'teste-preparar-cena';

  const barramentoAtlas = criarBarramento({
    app: 'atlas',
    criarCanal: () => new CanalEmMemoria(canalNome) as never,
  });
  const barramentoMesa = criarBarramento({
    app: 'mesa',
    criarCanal: () => new CanalEmMemoria(canalNome) as never,
  });

  const fakeServicos: Servicos = {
    repo,
    campanhas: null,
    barramento: barramentoAtlas,
  };
  servicos.value = fakeServicos;

  // Registra o atendimento
  barramentoAtlas.atender('atlas.preparar-cena', dados => {
    return prepararCenaNoAtlas(fakeServicos, dados as DadosPrepararCena);
  });

  const fichaRef = criarRef('ficha', 'ficha', 'ladino-1');
  const resultado = await barramentoMesa.pedir('atlas.preparar-cena', {
    mapa: criarRef('atlas', 'mapa', mapa.id),
    clima: 'neblina',
    fichas: [fichaRef],
  });

  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.resposta.ok, true);
  }
  assert.ok(sessao.value);
  assert.equal(sessao.value.doc.value.id, mapa.id);
  assert.equal(sessao.value.doc.value.climate.preset, 'neblina');
  assert.equal(Object.values(sessao.value.doc.value.tokens).length, 1);

  barramentoAtlas.fechar();
  barramentoMesa.fechar();
});

test('atendimento de atlas.momento via barramento: abre mapa e dispara momento', async () => {
  const mapa = criarMapa({ id: 'mapa-com-momento', agora: 1 });
  const momento = novoMomento('susto-1', 'O Pavor');
  momento.passos.push({ tipo: 'efeito', efeito: 'tremor' });
  mapa.moments[momento.id] = momento;

  const repo = criarRepoMock({ [mapa.id]: mapa });
  const canalNome = 'teste-atlas-momento';

  const barramentoAtlas = criarBarramento({
    app: 'atlas',
    criarCanal: () => new CanalEmMemoria(canalNome) as never,
  });
  const barramentoMesa = criarBarramento({
    app: 'mesa',
    criarCanal: () => new CanalEmMemoria(canalNome) as never,
  });

  const fakeServicos: Servicos = {
    repo,
    campanhas: null,
    barramento: barramentoAtlas,
  };
  servicos.value = fakeServicos;

  barramentoAtlas.atender('atlas.momento', dados => {
    return tocarMomentoRemoto(fakeServicos, dados as DadosAtlasMomento);
  });

  // 1. Pede momento por ID
  const resultado = await barramentoMesa.pedir('atlas.momento', {
    mapa: criarRef('atlas', 'mapa', mapa.id),
    momento: 'susto-1',
  });

  assert.equal(resultado.ok, true);
  assert.ok(sessao.value);
  assert.equal(sessao.value.doc.value.id, mapa.id);

  // 2. Pede momento por Nome
  const resultadoNome = await barramentoMesa.pedir('atlas.momento', {
    mapa: criarRef('atlas', 'mapa', mapa.id),
    momento: 'o pavor',
  });
  assert.equal(resultadoNome.ok, true);

  // 3. Momento inexistente é recusado
  const resultadoInexistente = await barramentoMesa.pedir('atlas.momento', {
    mapa: criarRef('atlas', 'mapa', mapa.id),
    momento: 'fantasma',
  });
  assert.equal(resultadoInexistente.ok, false);

  barramentoAtlas.fechar();
  barramentoMesa.fechar();
});

test.after(() => {
  fecharSessao();
  cacheDeSessoes.clear();
});
