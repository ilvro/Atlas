import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { criarAutosalvamento, type Autosalvamento, type EstadoDeGravacao } from '../data/autosalvamento.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { podarSelecao, type Alvo } from '../render/selecao.ts';
import { PINCEL_PADRAO, type Ferramenta, type Pincel } from '../render/pincel.ts';
import { criarStore, type Store } from '../state/store.ts';

/** Tudo de um mapa aberto: o store, o autossalvamento e o estado de interface que depende dele, como signals. */
export interface SessaoDeEdicao {
  readonly store: Store;
  readonly auto: Autosalvamento;
  readonly doc: ReadonlySignal<MapaAtlas>;
  readonly sujo: ReadonlySignal<boolean>;
  readonly podeDesfazer: ReadonlySignal<boolean>;
  readonly podeRefazer: ReadonlySignal<boolean>;
  readonly rotuloDesfazer: ReadonlySignal<string>;
  readonly rotuloRefazer: ReadonlySignal<string>;
  readonly historico: ReadonlySignal<readonly string[]>;
  readonly gravacao: Signal<EstadoDeGravacao>;
  readonly selecao: Signal<Alvo[]>;
  readonly ferramenta: Signal<Ferramenta>;
  /** O que a ferramenta ativa carrega na mão: tipo de cômodo, objeto, luz, abertura… */
  readonly pincel: Signal<Pincel>;
  /** A biblioteca (gaveta com os itens da ferramenta) está aberta? */
  readonly biblioteca: Signal<boolean>;
  fechar(): void;
}

export function criarSessao(mapa: MapaAtlas, repo: RepositorioMapas, opcoes: { salvo: boolean }): SessaoDeEdicao {
  const store = criarStore(mapa, { salvo: opcoes.salvo });
  const auto = criarAutosalvamento({ store, repo });
  const doc = signal(store.documento), sujo = signal(store.sujo), podeDesfazer = signal(false), podeRefazer = signal(false);
  const rotuloDesfazer = signal(''), rotuloRefazer = signal(''), historico = signal<readonly string[]>([]);
  const gravacao = signal<EstadoDeGravacao>(auto.estado), selecao = signal<Alvo[]>([]), ferramenta = signal<Ferramenta>('selecionar');
  const pincel = signal<Pincel>(structuredClone(PINCEL_PADRAO)), biblioteca = signal(false);

  const sincronizar = () => {
    doc.value = store.documento; sujo.value = store.sujo; podeDesfazer.value = store.podeDesfazer; podeRefazer.value = store.podeRefazer;
    rotuloDesfazer.value = store.rotuloDesfazer; rotuloRefazer.value = store.rotuloRefazer; historico.value = store.historico;
    const podada = podarSelecao(store.documento, selecao.peek());
    if (podada.length !== selecao.peek().length) selecao.value = podada;
  };
  const sair = store.assinar(sincronizar);
  const sairGravacao = auto.aoMudarEstado(e => { gravacao.value = e; sincronizar(); });
  sincronizar();

  return {
    store, auto, doc, sujo, podeDesfazer, podeRefazer, rotuloDesfazer, rotuloRefazer, historico, gravacao, selecao, ferramenta, pincel, biblioteca,
    fechar() { sair(); sairGravacao(); auto.fechar(); store.dispor(); },
  };
}

export const tituloDoEstado = (e: EstadoDeGravacao, sujo: boolean): string =>
  e === 'gravando' ? 'Gravando…' : e === 'conflito' ? 'Conflito: o mapa mudou em outra aba' : e === 'erro' ? 'Não consegui gravar' : sujo ? 'Alterações não gravadas' : 'Tudo gravado';

export { computed };
