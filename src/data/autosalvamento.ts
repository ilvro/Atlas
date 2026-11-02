import { conteudo, type MapaAtlas } from '../domain/mapa.ts';
import type { EventoStore, Store } from '../state/store.ts';
import { ErroDeConflito, type Rascunho, type RepositorioMapas } from './repositorio.ts';

export type EstadoDeGravacao = 'limpo' | 'pendente' | 'gravando' | 'conflito' | 'erro';

export interface Autosalvamento {
  readonly estado: EstadoDeGravacao;
  aoMudarEstado(ouvinte: (estado: EstadoDeGravacao) => void): () => void;
  /** Grava o mapa de verdade (Ctrl+S). Devolve o mapa confirmado. Em conflito, lança `ErroDeConflito`. */
  salvarAgora(opcoes?: { forcar?: boolean }): Promise<MapaAtlas>;
  /** Guarda já o rascunho, sem esperar a pausa (ao sair do mapa ou da aba). Não faz nada se o mapa está limpo. */
  descarregar(): Promise<void>;
  /** Um rascunho que vale oferecer ao abrir: existe, difere do gravado e não é lixo. */
  rascunhoParaRecuperar(): Promise<{ rascunho: Rascunho; obsoleto: boolean } | undefined>;
  fechar(): void;
}

export interface OpcoesAutosalvamento {
  store: Store;
  repo: RepositorioMapas;
  atrasoMs?: number;
  agendar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  aoErro?: (erro: unknown) => void;
}

const EVENTOS_QUE_EDITAM = new Set<EventoStore['tipo']>(['executar', 'desfazer', 'refazer', 'concluir', 'cancelar']);

/**
 * Rascunho automático: depois de uma pausa nas edições, o mapa vai para o armazenamento de rascunhos (sem tocar no
 * mapa gravado). Se o mapa voltar a ser igual ao gravado, o rascunho é apagado. Todas as gravações entram numa fila.
 */
export function criarAutosalvamento(opcoes: OpcoesAutosalvamento): Autosalvamento {
  const { store, repo } = opcoes, atraso = opcoes.atrasoMs ?? 1200;
  const agendar = opcoes.agendar ?? ((fn, ms) => setTimeout(fn, ms)), cancelar = opcoes.cancelar ?? (id => clearTimeout(id as ReturnType<typeof setTimeout>));
  const aoErro = opcoes.aoErro ?? (erro => console.error('Atlas: falha ao gravar', erro));
  let estado: EstadoDeGravacao = store.sujo ? 'pendente' : 'limpo', relogio: unknown = null, fila: Promise<unknown> = Promise.resolve(), fechado = false;
  const ouvintes = new Set<(e: EstadoDeGravacao) => void>();
  const mudar = (novo: EstadoDeGravacao) => { if (novo !== estado) { estado = novo; for (const o of [...ouvintes]) o(novo); } };
  const enfileirar = <T>(tarefa: () => Promise<T>): Promise<T> => { const p = fila.then(tarefa, tarefa); fila = p.catch(() => undefined); return p; };

  const parar = () => { if (relogio !== null) { cancelar(relogio); relogio = null; } };
  /** Sempre um único cronômetro: agendar de novo cancela o anterior. */
  const agendarRascunho = () => { parar(); relogio = agendar(() => { relogio = null; void gravarRascunho(); }, atraso); };

  const gravarRascunho = () => enfileirar(async () => {
    if (fechado) return;
    const doc = store.documento;
    if (!store.sujo) { await repo.descartarRascunho(doc.id); mudar('limpo'); return; }
    mudar('gravando');
    try { await repo.salvarRascunho(doc); mudar(store.sujo ? 'pendente' : 'limpo'); } catch (erro) { mudar('erro'); aoErro(erro); }
  });

  const parar_assinatura = store.assinar(evento => {
    if (fechado) return;
    if (evento.tipo === 'substituir') { parar(); mudar(store.sujo ? 'pendente' : 'limpo'); return; }
    if (!EVENTOS_QUE_EDITAM.has(evento.tipo)) return;
    if (!store.sujo) { parar(); void gravarRascunho(); return; }   // voltou ao gravado: apaga o rascunho
    mudar('pendente');
    agendarRascunho();
  });

  return {
    get estado() { return estado; },
    aoMudarEstado(ouvinte) { ouvintes.add(ouvinte); return () => { ouvintes.delete(ouvinte); }; },

    salvarAgora(extra = {}) {
      parar();
      return enfileirar(async () => {
        const enviado = store.documento;
        mudar('gravando');
        try {
          const confirmado = await repo.salvar(enviado, extra);
          store.marcarSalvo(confirmado);
          mudar(store.sujo ? 'pendente' : 'limpo');
          if (store.sujo) agendarRascunho();
          return confirmado;
        } catch (erro) {
          mudar(erro instanceof ErroDeConflito ? 'conflito' : 'erro');
          if (!(erro instanceof ErroDeConflito)) aoErro(erro);
          throw erro;
        }
      });
    },

    descarregar() { parar(); return store.sujo ? gravarRascunho() : Promise.resolve(); },

    async rascunhoParaRecuperar() {
      const id = store.documento.id, rascunho = await repo.obterRascunho(id);
      if (!rascunho) return undefined;
      const gravado = await repo.obter(id);
      if (gravado && conteudo(gravado) === conteudo(rascunho.mapa)) { await repo.descartarRascunho(id); return undefined; }
      return { rascunho, obsoleto: !!gravado && rascunho.mapa.revision < gravado.revision };
    },

    fechar() { fechado = true; parar(); ouvintes.clear(); parar_assinatura(); },
  };
}
