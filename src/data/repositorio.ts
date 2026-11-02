import { abrirBanco, obterTudo, promessa, transacao } from '#mesa';
import { colunas, linhas, type MapaAtlas, type RefAsset } from '../domain/mapa.ts';
import { lerMapa } from '../domain/migracoes.ts';
import { validarMapa } from '../domain/validacao.ts';
import { area } from '../domain/celulas.ts';

export const VERSAO_BANCO = 1;

export interface ResumoMapa {
  id: string; nome: string; revisao: number; criadoEm: number; atualizadoEm: number; campanhaId: string | null;
  comodos: number; objetos: number; luzes: number; pecas: number;
  /** Largura × altura em células do grid. */
  celulas: [number, number];
  /** Células cobertas por cômodos. */
  area: number;
  /** Presente quando o registro não pôde ser lido (corrompido ou de versão mais nova). */
  erro?: string;
}

export class ErroDeConflito extends Error {
  readonly atual: MapaAtlas;
  constructor(atual: MapaAtlas) { super('O mapa foi alterado em outra aba desde que você o abriu.'); this.name = 'ErroDeConflito'; this.atual = atual; }
}

export interface Asset { id: string; hash: string; tipo: string; blob: Blob; criadoEm: number }
export interface Rascunho { id: string; mapa: MapaAtlas; salvoEm: number }

export interface RepositorioMapas {
  listar(): Promise<ResumoMapa[]>;
  obter(id: string): Promise<MapaAtlas | undefined>;
  /**
   * Grava o mapa e devolve a versão confirmada (revisão + 1, carimbo de tempo novo). Se o registro mudou
   * desde a revisão que o chamador conhece, lança `ErroDeConflito`. Apaga o rascunho do mapa.
   */
  salvar(mapa: MapaAtlas, opcoes?: { forcar?: boolean }): Promise<MapaAtlas>;
  /** Grava tal como veio (importação, restauração de backup), sem mexer em revisão nem carimbos. */
  restaurar(mapa: MapaAtlas): Promise<void>;
  remover(id: string): Promise<void>;

  obterRascunho(id: string): Promise<Rascunho | undefined>;
  salvarRascunho(mapa: MapaAtlas): Promise<void>;
  descartarRascunho(id: string): Promise<void>;
  listarRascunhos(): Promise<Rascunho[]>;

  salvarAsset(blob: Blob): Promise<RefAsset>;
  obterAsset(id: string): Promise<Asset | undefined>;
  listarAssets(): Promise<Asset[]>;
  /** Grava um asset já conhecido (backup), conferindo se o conteúdo bate com o hash. */
  restaurarAsset(asset: Asset): Promise<void>;
  fechar(): void;
}

export const resumir = (m: MapaAtlas): ResumoMapa => ({
  id: m.id, nome: m.name, revisao: m.revision, criadoEm: m.createdAt, atualizadoEm: m.updatedAt, campanhaId: m.campanhaId,
  comodos: Object.keys(m.rooms).length, objetos: Object.keys(m.props).length, luzes: Object.keys(m.lights).length, pecas: Object.keys(m.tokens).length,
  celulas: [colunas(m), linhas(m)], area: Object.values(m.rooms).reduce((s, c) => s + area(c.cells), 0),
});

export async function sha256(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface OpcoesRepositorioMapas { nome: string; idb?: IDBFactory; agora?: () => number }

export async function abrirRepositorioMapas(opcoes: OpcoesRepositorioMapas): Promise<RepositorioMapas> {
  const agora = opcoes.agora ?? Date.now;
  const banco = await abrirBanco(opcoes.nome, VERSAO_BANCO, [
    { nome: 'mapas', chave: 'id' }, { nome: 'rascunhos', chave: 'id' }, { nome: 'assets', chave: 'id' },
  ], opcoes.idb);

  const repo: RepositorioMapas = {
    listar: () => transacao(banco, ['mapas'], 'readonly', async tx => {
      const brutos = await obterTudo<Record<string, unknown>>(tx.objectStore('mapas'));
      const itens = brutos.map((bruto): ResumoMapa => {
        try { return resumir(lerMapa(bruto)); } catch (erro) {
          const id = typeof bruto.id === 'string' ? bruto.id : '?';
          return { id, nome: typeof bruto.name === 'string' ? bruto.name : '(ilegível)', revisao: 0, criadoEm: 0, atualizadoEm: typeof bruto.updatedAt === 'number' ? bruto.updatedAt : 0, campanhaId: null, comodos: 0, objetos: 0, luzes: 0, pecas: 0, celulas: [0, 0], area: 0, erro: erro instanceof Error ? erro.message : String(erro) };
        }
      });
      return itens.sort((a, b) => b.atualizadoEm - a.atualizadoEm);
    }),

    obter: id => transacao(banco, ['mapas'], 'readonly', async tx => {
      const bruto = await promessa(tx.objectStore('mapas').get(id));
      return bruto === undefined ? undefined : lerMapa(bruto);
    }),

    salvar: async (mapa, extra = {}) => {
      validarMapa(mapa);
      return transacao(banco, ['mapas', 'rascunhos'], 'readwrite', async tx => {
        const store = tx.objectStore('mapas'), atualBruto = await promessa(store.get(mapa.id));
        const atual = atualBruto === undefined ? undefined : lerMapa(atualBruto);
        if (atual && atual.revision !== mapa.revision && !extra.forcar) throw new ErroDeConflito(atual);
        const confirmado: MapaAtlas = { ...mapa, revision: (atual?.revision ?? mapa.revision) + 1, createdAt: atual?.createdAt ?? mapa.createdAt, updatedAt: agora() };
        await promessa(store.put(confirmado));
        await promessa(tx.objectStore('rascunhos').delete(mapa.id));
        return confirmado;
      });
    },

    restaurar: async mapa => { validarMapa(mapa); return transacao(banco, ['mapas', 'rascunhos'], 'readwrite', async tx => { await promessa(tx.objectStore('mapas').put(mapa)); await promessa(tx.objectStore('rascunhos').delete(mapa.id)); }); },
    remover: id => transacao(banco, ['mapas', 'rascunhos'], 'readwrite', async tx => { await promessa(tx.objectStore('mapas').delete(id)); await promessa(tx.objectStore('rascunhos').delete(id)); }),

    obterRascunho: id => transacao(banco, ['rascunhos'], 'readonly', async tx => {
      const bruto = await promessa(tx.objectStore('rascunhos').get(id)) as { id: string; mapa: unknown; salvoEm: number } | undefined;
      if (!bruto) return undefined;
      try { return { id, mapa: lerMapa(bruto.mapa), salvoEm: bruto.salvoEm }; } catch { return undefined; }
    }),
    salvarRascunho: async mapa => { validarMapa(mapa); return transacao(banco, ['rascunhos'], 'readwrite', async tx => { await promessa(tx.objectStore('rascunhos').put({ id: mapa.id, mapa, salvoEm: agora() })); }); },
    descartarRascunho: id => transacao(banco, ['rascunhos'], 'readwrite', async tx => { await promessa(tx.objectStore('rascunhos').delete(id)); }),
    listarRascunhos: () => transacao(banco, ['rascunhos'], 'readonly', async tx => {
      const brutos = await obterTudo<{ id: string; mapa: unknown; salvoEm: number }>(tx.objectStore('rascunhos'));
      const saida: Rascunho[] = [];
      for (const b of brutos) { try { saida.push({ id: b.id, mapa: lerMapa(b.mapa), salvoEm: b.salvoEm }); } catch { /* rascunho ilegível: ignorado */ } }
      return saida;
    }),

    async salvarAsset(blob) {
      const hash = await sha256(blob), id = hash.slice(0, 32);
      await transacao(banco, ['assets'], 'readwrite', async tx => {
        const store = tx.objectStore('assets');
        if (await promessa(store.getKey(id)) === undefined) await promessa(store.put({ id, hash, tipo: blob.type || 'application/octet-stream', blob, criadoEm: agora() } satisfies Asset));
      });
      return { id, hash };
    },
    obterAsset: id => transacao(banco, ['assets'], 'readonly', tx => promessa(tx.objectStore('assets').get(id)) as Promise<Asset | undefined>),
    listarAssets: () => transacao(banco, ['assets'], 'readonly', tx => obterTudo<Asset>(tx.objectStore('assets'))),
    async restaurarAsset(asset) {
      if (await sha256(asset.blob) !== asset.hash || asset.id !== asset.hash.slice(0, 32)) throw new Error(`O conteúdo do asset ${asset.id} não bate com o hash.`);
      await transacao(banco, ['assets'], 'readwrite', async tx => { await promessa(tx.objectStore('assets').put(asset)); });
    },
    fechar: () => banco.close(),
  };
  return repo;
}
