import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { criarAutosalvamento, type Autosalvamento, type EstadoDeGravacao } from '../data/autosalvamento.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';
import { mapaDoAndar } from '../domain/andares.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { obterAndarDaAba } from './abas.ts';
import { podarSelecao, type Alvo } from '../render/selecao.ts';
import { PINCEL_PADRAO, type Ferramenta, type Pincel } from '../render/pincel.ts';
import { criarStore, type OpcoesStore, type Store } from '../state/store.ts';

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
  /** Identificador do andar ativo na tela (`null` = térreo). */
  readonly andarAtivo: Signal<string | null>;
  fechar(): void;
}

/** Sessão de edição aberta atualmente na interface (`null` na galeria ou enquanto aguarda construção remota). */
export const sessao = signal<SessaoDeEdicao | null>(null);

export interface OpcoesSessao extends OpcoesStore {
  salvo: boolean;
}

export function criarSessao(mapa: MapaAtlas, repo: RepositorioMapas, opcoes: OpcoesSessao): SessaoDeEdicao {
  const store = criarStore(mapa, opcoes);
  const auto = criarAutosalvamento({ store, repo });
  const doc = signal(store.documento), sujo = signal(store.sujo), podeDesfazer = signal(false), podeRefazer = signal(false);
  const rotuloDesfazer = signal(''), rotuloRefazer = signal(''), historico = signal<readonly string[]>([]);
  const gravacao = signal<EstadoDeGravacao>(auto.estado), selecao = signal<Alvo[]>([]), ferramenta = signal<Ferramenta>('selecionar');
  const pincel = signal<Pincel>(structuredClone(PINCEL_PADRAO)), biblioteca = signal(false);
  const salvoAndar = obterAndarDaAba(mapa.id);
  const andarAtivo = signal<string | null>(salvoAndar && mapa.levels?.[salvoAndar] ? salvoAndar : null);

  const sincronizar = () => {
    doc.value = store.documento;
    if (!store.emGesto) {
      sujo.value = store.sujo; podeDesfazer.value = store.podeDesfazer; podeRefazer.value = store.podeRefazer;
      rotuloDesfazer.value = store.rotuloDesfazer; rotuloRefazer.value = store.rotuloRefazer; historico.value = store.historico;
    } else {
      sujo.value = true;
    }
    const nivel = andarAtivo.peek();
    if (nivel !== null && !store.documento.levels?.[nivel]) andarAtivo.value = null;
    const podada = podarSelecao(mapaDoAndar(store.documento, andarAtivo.peek()), selecao.peek());
    if (podada.length !== selecao.peek().length) selecao.value = podada;
  };
  const sair = store.assinar(sincronizar);
  const sairGravacao = auto.aoMudarEstado(e => { gravacao.value = e; sincronizar(); });
  sincronizar();

  return {
    store, auto, doc, sujo, podeDesfazer, podeRefazer, rotuloDesfazer, rotuloRefazer, historico, gravacao, selecao, ferramenta, pincel, biblioteca, andarAtivo,
    fechar() { sair(); sairGravacao(); auto.fechar(); store.dispor(); },
  };
}

export const tituloDoEstado = (e: EstadoDeGravacao, sujo: boolean): string =>
  e === 'gravando' ? 'Gravando…' : e === 'conflito' ? 'Conflito: o mapa mudou em outra aba' : e === 'erro' ? 'Não consegui gravar' : sujo ? 'Alterações não gravadas' : 'Tudo gravado';

export { computed };
