import { batch, computed, type ReadonlySignal } from '@preact/signals';
import {
  ErroDeConflito,
  resumir,
  sha256,
  type Asset,
  type Rascunho,
  type RepositorioMapas,
} from '../data/repositorio.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { lerMapa } from '../domain/migracoes.ts';
import { validarMapa } from '../domain/validacao.ts';
import { aplicarComando, ErroDeComando, type Comando } from '../state/comandos.ts';
import { modo, vistaDeJogador } from './modo.ts';
import { rota } from './rotas.ts';
import { criarSessao, sessao, type SessaoDeEdicao } from './sessao.ts';
import { avisar } from './toasts.ts';

/** Canal prefixado da sala para a ponte de construção colaborativa (S3+). */
export const canalConstrucaoDaSala = (salaId: string): string => `sala:${salaId}:atlas:construcao`;

/** Verdadeiro quando a rota atual está em modo de construção colaborativa remota (`#/construir-remoto/<salaId>`). */
export const emConstrucaoRemota: ReadonlySignal<boolean> = computed(() => rota.value.tipo === 'construir-remoto');

/**
 * Repositório puro em memória (sem abrir IndexedDB), para que o editor remoto nunca grave nem
 * sobrescreva mapas locais do navegador nem dispare recuperação de rascunho ou conflitos de disco.
 */
export function criarRepositorioMemoria(): RepositorioMapas {
  const mapas = new Map<string, MapaAtlas>();
  const rascunhos = new Map<string, Rascunho>();
  const assets = new Map<string, Asset>();

  return {
    async listar() {
      return [...mapas.values()]
        .map(m => resumir(m))
        .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
    },

    async obter(id) {
      const m = mapas.get(id);
      return m ? lerMapa(m) : undefined;
    },

    async salvar(mapa, opcoes = {}) {
      validarMapa(mapa);
      const atual = mapas.get(mapa.id);
      if (atual && atual.revision !== mapa.revision && !opcoes.forcar) {
        throw new ErroDeConflito(lerMapa(atual));
      }
      const confirmado: MapaAtlas = {
        ...structuredClone(mapa),
        revision: (atual?.revision ?? mapa.revision) + 1,
        createdAt: atual?.createdAt ?? mapa.createdAt,
        updatedAt: Date.now(),
      };
      mapas.set(mapa.id, confirmado);
      rascunhos.delete(mapa.id);
      return structuredClone(confirmado);
    },

    async restaurar(mapa) {
      validarMapa(mapa);
      mapas.set(mapa.id, lerMapa(mapa));
      rascunhos.delete(mapa.id);
    },

    async remover(id) {
      mapas.delete(id);
      rascunhos.delete(id);
    },

    async obterRascunho(id) {
      const r = rascunhos.get(id);
      return r ? { id: r.id, mapa: lerMapa(r.mapa), salvoEm: r.salvoEm } : undefined;
    },

    async salvarRascunho(mapa) {
      validarMapa(mapa);
      rascunhos.set(mapa.id, { id: mapa.id, mapa: lerMapa(mapa), salvoEm: Date.now() });
    },

    async descartarRascunho(id) {
      rascunhos.delete(id);
    },

    async listarRascunhos() {
      return [...rascunhos.values()].map(r => ({
        id: r.id,
        mapa: lerMapa(r.mapa),
        salvoEm: r.salvoEm,
      }));
    },

    async salvarAsset(blob) {
      const hash = await sha256(blob);
      const id = hash.slice(0, 32);
      if (!assets.has(id)) {
        assets.set(id, {
          id,
          hash,
          tipo: blob.type || 'application/octet-stream',
          blob,
          criadoEm: Date.now(),
        });
      }
      return { id, hash };
    },

    async obterAsset(id) {
      return assets.get(id);
    },

    async listarAssets() {
      return [...assets.values()];
    },

    async restaurarAsset(asset) {
      if ((await sha256(asset.blob)) !== asset.hash || asset.id !== asset.hash.slice(0, 32)) {
        throw new Error(`O conteúdo do asset ${asset.id} não bate com o hash.`);
      }
      assets.set(asset.id, { ...asset });
    },

    fechar() {
      mapas.clear();
      rascunhos.clear();
      assets.clear();
    },
  };
}

export interface CanalConstrucaoLike {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

export interface OpConstrucaoRemota {
  rev: number;
  opId: string;
  comandos: readonly ({ tipo: string } & Record<string, unknown>)[];
  rotulo?: string;
}

export interface OpcoesConstrucaoRemota {
  salaId: string;
  criarCanal?: (nome: string) => CanalConstrucaoLike;
  postarPai?: (msg: unknown, origem: string) => void;
  origemPai?: string;
  repo?: RepositorioMapas;
}

export interface PonteConstrucaoRemota {
  readonly rev: number;
  readonly mapaId: string | null;
  parar(): void;
}

const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Conecta o editor remoto do Atlas ao canal `sala:<salaId>:atlas:construcao`, anuncia que está
 * pronto (no canal e via `postMessage` para `window.parent` quando em `iframe`), aplica `construcao.estado`
 * (validando com `lerMapa` e aplicando `ops` em ordem) e limpa a sessão quando recebe `construcao.fechada`.
 */
export function iniciarConstrucaoRemota(opcoes: OpcoesConstrucaoRemota): PonteConstrucaoRemota {
  const nomeCanal = canalConstrucaoDaSala(opcoes.salaId);
  const canal: CanalConstrucaoLike | null = opcoes.criarCanal
    ? opcoes.criarCanal(nomeCanal)
    : typeof BroadcastChannel === 'function'
      ? (new BroadcastChannel(nomeCanal) as unknown as CanalConstrucaoLike)
      : null;

  const repo = opcoes.repo ?? criarRepositorioMemoria();
  let morto = false;
  let revAtual = 0;
  let sessaoLocal: SessaoDeEdicao | null = null;

  const fecharSessaoLocal = () => {
    revAtual = 0;
    batch(() => {
      modo.value = 'construir';
      vistaDeJogador.value = false;
      if (sessaoLocal) {
        const antiga = sessaoLocal;
        sessaoLocal = null;
        if (sessao.peek() === antiga) sessao.value = null;
        antiga.fechar();
      } else {
        const ativa = sessao.peek();
        if (ativa) {
          sessao.value = null;
          ativa.fechar();
        }
      }
    });
  };

  const aplicarEstado = (msg: Record<string, unknown>) => {
    if (!ehObj(msg.mapa)) return;
    let doc: MapaAtlas;
    try {
      doc = lerMapa(msg.mapa);
    } catch (erro) {
      console.warn('Atlas: mapa de construção inválido', erro);
      avisar('Não consegui abrir o mapa de construção recebido.', { tipo: 'erro' });
      return;
    }

    let revEfetiva = typeof msg.rev === 'number' && Number.isFinite(msg.rev) ? msg.rev : 0;
    if (Array.isArray(msg.ops)) {
      const ordenadas = [...msg.ops].sort((a, b) => {
        const ra = ehObj(a) && typeof a.rev === 'number' ? a.rev : 0;
        const rb = ehObj(b) && typeof b.rev === 'number' ? b.rev : 0;
        return ra - rb;
      });
      for (const op of ordenadas) {
        if (!ehObj(op) || !Array.isArray(op.comandos)) continue;
        for (const cmd of op.comandos) {
          if (!ehObj(cmd) || typeof cmd.tipo !== 'string' || !cmd.tipo) continue;
          try {
            doc = aplicarComando(doc, cmd as unknown as Comando);
          } catch (erro) {
            if (erro instanceof ErroDeComando) continue;
            throw erro;
          }
        }
        if (typeof op.rev === 'number' && Number.isFinite(op.rev) && op.rev > revEfetiva) {
          revEfetiva = op.rev;
        }
      }
    }

    revAtual = revEfetiva;
    batch(() => {
      modo.value = 'construir';
      vistaDeJogador.value = false;
      const ativa = sessao.peek();
      if (sessaoLocal && ativa === sessaoLocal && sessaoLocal.doc.peek().id === doc.id) {
        sessaoLocal.store.substituir(doc, { salvo: true });
        sessaoLocal.selecao.value = [];
        sessaoLocal.ferramenta.value = 'selecionar';
        sessaoLocal.biblioteca.value = false;
      } else {
        if (ativa && ativa !== sessaoLocal) {
          sessao.value = null;
          ativa.fechar();
        }
        if (sessaoLocal) {
          if (sessao.peek() === sessaoLocal) sessao.value = null;
          sessaoLocal.fechar();
        }
        sessaoLocal = criarSessao(doc, repo, { salvo: true });
        sessao.value = sessaoLocal;
      }
    });
  };

  if (canal) {
    canal.onmessage = ev => {
      if (morto || !ehObj(ev?.data) || typeof ev.data.tipo !== 'string') return;
      if (ev.data.tipo === 'construcao.estado') {
        aplicarEstado(ev.data);
      } else if (ev.data.tipo === 'construcao.fechada') {
        fecharSessaoLocal();
      }
    };

    const pronto = { tipo: 'atlas-construcao.pronto' };
    try {
      canal.postMessage(pronto);
    } catch {
      /* ignora erro de postMessage */
    }
    const origem = opcoes.origemPai ?? (typeof location !== 'undefined' && location.origin ? location.origin : '*');
    if (opcoes.postarPai) {
      try {
        opcoes.postarPai(pronto, origem);
      } catch {
        /* ignora erro de postarPai */
      }
    } else if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(pronto, origem);
      } catch {
        /* ignora erro de postMessage no pai */
      }
    }
  }

  return {
    get rev() {
      return revAtual;
    },
    get mapaId() {
      return sessaoLocal?.doc.peek().id ?? null;
    },
    parar() {
      if (morto) return;
      morto = true;
      if (canal) {
        try {
          canal.onmessage = null;
          canal.close();
        } catch {
          /* ignora */
        }
      }
      fecharSessaoLocal();
    },
  };
}
