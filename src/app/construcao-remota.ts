import { batch, computed, signal, type ReadonlySignal } from '@preact/signals';
import {
  deveEnviarCursor,
  INTERVALO_ENVIO_CURSOR_MS,
  registrarCursorRemoto,
  type CursorRemoto,
} from '../domain/cursores-remotos.ts';
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
import {
  criarPilhaDesfazerColaborativo,
  type OrigemOperacaoColaborativa,
} from './desfazer-colaborativo.ts';
import {
  criarReconciliador,
  type ComandoRemoto,
  type EntradaAplicada,
  type Reconciliador,
} from './reconciliacao.ts';
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

export interface InfoCursorRemoto {
  x: number;
  y: number;
  levelId: string | null;
  ferramenta: string;
  pintando?: boolean;
}

/** Cursores colaborativos dos participantes no modo construção remoto (S5). */
export const cursoresRemotos = signal<CursorRemoto[]>([]);

/** Discord ID do participante local na sessão de construção remota (S5). */
export const meuDiscordIdRemoto = signal<string | null>(null);

let emissorCursorAtivo: ((info: InfoCursorRemoto) => void) | null = null;

/** Envia a posição e estado do cursor local para os colegas da construção remota (com throttle). */
export function enviarCursorRemoto(info: InfoCursorRemoto): void {
  emissorCursorAtivo?.(info);
}

/** Estado reativo da pilha de desfazer/refazer por autor no modo construção remoto (S6). */
export const podeDesfazerRemoto = signal(false);
export const rotuloDesfazerRemoto = signal('');
export const podeRefazerRemoto = signal(false);
export const rotuloRefazerRemoto = signal('');

let controladorDesfazerAtivo: {
  desfazer: () => string | null;
  refazer: () => string | null;
} | null = null;

/** Desfaz a última operação confirmada deste participante no modo construção remoto (ou cancela o gesto ativo). */
export function desfazerConstrucaoRemota(): string | null {
  return controladorDesfazerAtivo?.desfazer() ?? null;
}

/** Refaz a última operação desfeita deste participante no modo construção remoto. */
export function refazerConstrucaoRemota(): string | null {
  return controladorDesfazerAtivo?.refazer() ?? null;
}

export interface OpcoesConstrucaoRemota {
  salaId: string;
  criarCanal?: (nome: string) => CanalConstrucaoLike;
  postarPai?: (msg: unknown, origem: string) => void;
  origemPai?: string;
  repo?: RepositorioMapas;
  gerarOpId?: () => string;
  limiarSnapshot?: number;
  meuDiscordId?: string;
  agora?: () => number;
}

export interface PonteConstrucaoRemota {
  readonly rev: number;
  readonly mapaId: string | null;
  readonly pendentes: number;
  parar(): void;
}

const MAX_COMANDOS_POR_OP = 100;
const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function fatiarComandos(comandos: readonly Comando[], limite: number): Comando[][] {
  if (comandos.length <= limite) return [[...comandos]];
  const lotes: Comando[][] = [];
  for (let i = 0; i < comandos.length; i += limite) {
    lotes.push(comandos.slice(i, i + limite));
  }
  return lotes;
}

function filtrarComandosAplicaveis(mapaInicial: MapaAtlas, comandos: readonly Comando[]): Comando[] {
  const validos: Comando[] = [];
  let atual = mapaInicial;
  for (const cmd of comandos) {
    try {
      atual = aplicarComando(atual, cmd);
      validos.push(cmd);
    } catch (erro) {
      if (erro instanceof ErroDeComando) continue;
      throw erro;
    }
  }
  return validos;
}

/**
 * Conecta o editor remoto do Atlas ao canal `sala:<salaId>:atlas:construcao`, anuncia que está
 * pronto (no canal e via `postMessage` para `window.parent` quando em `iframe`), aplica `construcao.estado`
 * (validando com `lerMapa` e aplicando `ops` em ordem), reconcilia edições locais/remotas com
 * `criarReconciliador`, envia `construcao.comando` / `construcao.ressincronizar` / `construcao.snapshot`
 * e limpa a sessão quando recebe `construcao.fechada`.
 */
export function iniciarConstrucaoRemota(opcoes: OpcoesConstrucaoRemota): PonteConstrucaoRemota {
  const nomeCanal = canalConstrucaoDaSala(opcoes.salaId);
  const canal: CanalConstrucaoLike | null = opcoes.criarCanal
    ? opcoes.criarCanal(nomeCanal)
    : typeof BroadcastChannel === 'function'
      ? (new BroadcastChannel(nomeCanal) as unknown as CanalConstrucaoLike)
      : null;

  const repo = opcoes.repo ?? criarRepositorioMemoria();
  const agoraFn = opcoes.agora ?? (() => Date.now());
  let morto = false;
  let reconciliador: Reconciliador | null = null;
  let sessaoLocal: SessaoDeEdicao | null = null;
  let projecaoPendente = false;
  let ressincronizando = false;
  let ultimoEnvioCursorEm = -Infinity;
  let ultimoPintando = false;
  const pilhaDesfazer = criarPilhaDesfazerColaborativo();

  const sincronizarSignalsDesfazer = () => {
    batch(() => {
      podeDesfazerRemoto.value = pilhaDesfazer.podeDesfazer;
      rotuloDesfazerRemoto.value = pilhaDesfazer.rotuloDesfazer;
      podeRefazerRemoto.value = pilhaDesfazer.podeRefazer;
      rotuloRefazerRemoto.value = pilhaDesfazer.rotuloRefazer;
    });
  };

  const limparDesfazer = () => {
    pilhaDesfazer.limpar();
    sincronizarSignalsDesfazer();
  };

  cursoresRemotos.value = [];
  meuDiscordIdRemoto.value = opcoes.meuDiscordId ?? null;
  limparDesfazer();

  const postarNoCanal = (msg: unknown) => {
    if (!canal || morto) return;
    try {
      canal.postMessage(msg);
    } catch {
      /* ignora erro de postMessage */
    }
  };

  const emitirCursor = (info: InfoCursorRemoto) => {
    if (morto || !canal) return;
    const agora = agoraFn();
    const pintandoAgora = Boolean(info.pintando);
    if (!deveEnviarCursor(ultimoEnvioCursorEm, agora, ultimoPintando, pintandoAgora, INTERVALO_ENVIO_CURSOR_MS)) {
      return;
    }
    ultimoEnvioCursorEm = agora;
    ultimoPintando = pintandoAgora;
    postarNoCanal({
      tipo: 'construcao.cursor',
      x: info.x,
      y: info.y,
      levelId: info.levelId,
      ferramenta: info.ferramenta,
      pintando: pintandoAgora,
    });
  };
  emissorCursorAtivo = emitirCursor;

  const projetarSemEco = (mapa: MapaAtlas) => {
    if (!sessaoLocal) return;
    sessaoLocal.store.projetar(mapa, { pularValidacao: false });
  };

  const enviarLotesLocais = (
    comandos: readonly Comando[],
    rotulo: string,
    origem: OrigemOperacaoColaborativa,
  ): { enviou: boolean; teveErro: boolean } => {
    if (!reconciliador) return { enviou: false, teveErro: false };
    let enviou = false;
    let teveErro = false;
    for (const lote of fatiarComandos(comandos, MAX_COMANDOS_POR_OP)) {
      const mapaAntes = reconciliador.mapaVisivel;
      try {
        const { mensagem, mapaVisivel } = reconciliador.aoEditarLocal(lote, rotulo);
        pilhaDesfazer.registrarPendente(mensagem.opId, rotulo, mapaAntes, mapaVisivel, lote, origem);
        postarNoCanal(mensagem);
        enviou = true;
      } catch (erro) {
        if (!(erro instanceof ErroDeComando)) throw erro;
        teveErro = true;
        const validos = filtrarComandosAplicaveis(mapaAntes, lote);
        if (validos.length > 0) {
          const { mensagem, mapaVisivel } = reconciliador.aoEditarLocal(validos, rotulo);
          pilhaDesfazer.registrarPendente(mensagem.opId, rotulo, mapaAntes, mapaVisivel, validos, origem);
          postarNoCanal(mensagem);
          enviou = true;
        }
      }
    }
    return { enviou, teveErro };
  };

  const aoExecutarComandos = (comandos: Comando[], rotulo: string) => {
    if (morto || !reconciliador || !sessaoLocal || comandos.length === 0) return;
    const { teveErro } = enviarLotesLocais(comandos, rotulo, 'normal');
    if (projecaoPendente || teveErro) {
      projecaoPendente = false;
      projetarSemEco(reconciliador.mapaVisivel);
    }
  };

  const executarDesfazerRefazer = (tipo: 'desfazer' | 'refazer'): string | null => {
    if (morto || !reconciliador || !sessaoLocal) return null;
    if (tipo === 'desfazer' && sessaoLocal.store.emGesto) {
      sessaoLocal.store.desfazer();
      return '';
    }
    if (sessaoLocal.store.emGesto) return null;
    const preparado =
      tipo === 'desfazer'
        ? pilhaDesfazer.prepararDesfazer(reconciliador.mapaVisivel)
        : pilhaDesfazer.prepararRefazer(reconciliador.mapaVisivel);
    if (!preparado) {
      sincronizarSignalsDesfazer();
      return null;
    }
    const { enviou } =
      preparado.comandos.length > 0
        ? enviarLotesLocais(preparado.comandos, preparado.rotulo, tipo)
        : { enviou: false };
    if (enviou || projecaoPendente) {
      projecaoPendente = false;
      projetarSemEco(reconciliador.mapaVisivel);
    }
    sincronizarSignalsDesfazer();
    return preparado.rotulo;
  };

  const controladorDesfazer = {
    desfazer: () => executarDesfazerRefazer('desfazer'),
    refazer: () => executarDesfazerRefazer('refazer'),
  };
  controladorDesfazerAtivo = controladorDesfazer;

  const aoTerminarGesto = () => {
    if (morto || !reconciliador || !sessaoLocal || !projecaoPendente || sessaoLocal.store.emGesto) return;
    projecaoPendente = false;
    projetarSemEco(reconciliador.mapaVisivel);
  };

  const fecharSessaoLocal = () => {
    reconciliador = null;
    projecaoPendente = false;
    ressincronizando = false;
    ultimoEnvioCursorEm = -Infinity;
    ultimoPintando = false;
    cursoresRemotos.value = [];
    limparDesfazer();
    if (emissorCursorAtivo === emitirCursor) emissorCursorAtivo = null;
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
    if (ehObj(msg.eu) && typeof msg.eu.discordId === 'string' && msg.eu.discordId) {
      meuDiscordIdRemoto.value = msg.eu.discordId;
    }
    if (!ehObj(msg.mapa)) return;
    let doc: MapaAtlas;
    try {
      doc = lerMapa(msg.mapa);
    } catch (erro) {
      console.warn('Atlas: mapa de construção inválido', erro);
      avisar('Não consegui abrir o mapa de construção recebido.', { tipo: 'erro' });
      return;
    }

    const revInicial = typeof msg.rev === 'number' && Number.isFinite(msg.rev) ? msg.rev : 0;
    const opsIniciais: EntradaAplicada[] = [];
    if (Array.isArray(msg.ops)) {
      for (const op of msg.ops) {
        if (!ehObj(op) || !Array.isArray(op.comandos)) continue;
        if (typeof op.rev !== 'number' || !Number.isFinite(op.rev)) continue;
        opsIniciais.push({
          rev: op.rev,
          opId: typeof op.opId === 'string' ? op.opId : '',
          comandos: op.comandos as readonly ComandoRemoto[],
          ...(typeof op.rotulo === 'string' ? { rotulo: op.rotulo } : {}),
        });
      }
    }

    const proximoReconciliador = criarReconciliador(doc, revInicial, opsIniciais, {
      ...(opcoes.gerarOpId ? { gerarOpId: opcoes.gerarOpId } : {}),
      ...(opcoes.limiarSnapshot !== undefined ? { limiarSnapshot: opcoes.limiarSnapshot } : {}),
    });
    reconciliador = proximoReconciliador;
    projecaoPendente = false;
    ressincronizando = false;
    emissorCursorAtivo = emitirCursor;
    controladorDesfazerAtivo = controladorDesfazer;
    limparDesfazer();

    const docVisivel = proximoReconciliador.mapaVisivel;
    batch(() => {
      modo.value = 'construir';
      vistaDeJogador.value = false;
      const ativa = sessao.peek();
      if (sessaoLocal && ativa === sessaoLocal && sessaoLocal.doc.peek().id === docVisivel.id) {
        sessaoLocal.store.substituir(docVisivel, { salvo: true });
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
        sessaoLocal = criarSessao(docVisivel, repo, {
          salvo: true,
          aoExecutarComandos,
          aoTerminarGesto,
        });
        sessao.value = sessaoLocal;
      }
    });
  };

  const aplicarRemota = (msg: Record<string, unknown>) => {
    if (!reconciliador || !sessaoLocal) return;
    if (typeof msg.rev !== 'number' || !Number.isInteger(msg.rev) || msg.rev < 1) return;
    if (typeof msg.opId !== 'string' || !msg.opId || !Array.isArray(msg.comandos)) return;

    const res = reconciliador.aoReceberAplicada({
      rev: msg.rev,
      opId: msg.opId,
      comandos: msg.comandos as readonly ComandoRemoto[],
      ...(typeof msg.rotulo === 'string' ? { rotulo: msg.rotulo } : {}),
    });

    if (res.precisaRessincronizar) {
      if (!ressincronizando) {
        ressincronizando = true;
        postarNoCanal({ tipo: 'construcao.ressincronizar' });
      }
      return;
    }

    if (res.ignorada) return;

    for (const descartada of res.descartadas) {
      pilhaDesfazer.descartarPendente(descartada.opId);
    }
    if (pilhaDesfazer.confirmar(msg.opId)) {
      sincronizarSignalsDesfazer();
    }

    if (sessaoLocal.store.emGesto) {
      projecaoPendente = true;
    } else {
      projecaoPendente = false;
      projetarSemEco(res.mapaVisivel);
    }

    if (res.snapshotSugerido) {
      const { rev, mapa } = res.snapshotSugerido;
      postarNoCanal({
        tipo: 'construcao.snapshot',
        rev,
        mapa,
        nome: mapa.name,
      });
      reconciliador.marcarSnapshotEnviado(rev);
    }
  };

  const aplicarCursorRemoto = (msg: Record<string, unknown>) => {
    if (!ehObj(msg.autor)) return;
    if (typeof msg.autor.discordId !== 'string' || !msg.autor.discordId) return;
    if (typeof msg.autor.nome !== 'string') return;
    if (typeof msg.x !== 'number' || !Number.isFinite(msg.x)) return;
    if (typeof msg.y !== 'number' || !Number.isFinite(msg.y)) return;
    if (msg.levelId !== null && typeof msg.levelId !== 'string') return;
    if (typeof msg.ferramenta !== 'string') return;
    if (msg.pintando !== undefined && typeof msg.pintando !== 'boolean') return;

    const papel = msg.autor.papel === 'mestre' || msg.autor.papel === 'jogador' ? msg.autor.papel : 'jogador';
    const agora = agoraFn();
    cursoresRemotos.value = registrarCursorRemoto(
      cursoresRemotos.value,
      {
        discordId: msg.autor.discordId,
        nome: msg.autor.nome,
        papel,
        x: msg.x,
        y: msg.y,
        levelId: msg.levelId,
        ferramenta: msg.ferramenta,
        ...(msg.pintando !== undefined ? { pintando: msg.pintando } : {}),
        atualizadoEm: agora,
      },
      agora,
    );
  };

  if (canal) {
    canal.onmessage = ev => {
      if (morto || !ehObj(ev?.data) || typeof ev.data.tipo !== 'string') return;
      if (ev.data.tipo === 'construcao.estado') {
        aplicarEstado(ev.data);
      } else if (ev.data.tipo === 'construcao.identidade') {
        if (typeof ev.data.discordId === 'string' && ev.data.discordId) {
          meuDiscordIdRemoto.value = ev.data.discordId;
        }
      } else if (ev.data.tipo === 'construcao.aplicada') {
        aplicarRemota(ev.data);
      } else if (ev.data.tipo === 'construcao.cursor') {
        aplicarCursorRemoto(ev.data);
      } else if (ev.data.tipo === 'construcao.fechada') {
        fecharSessaoLocal();
      }
    };

    const pronto = { tipo: 'atlas-construcao.pronto' };
    postarNoCanal(pronto);
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
      return reconciliador?.baseRev ?? 0;
    },
    get mapaId() {
      return sessaoLocal?.doc.peek().id ?? null;
    },
    get pendentes() {
      return reconciliador?.pendentes.length ?? 0;
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
      if (controladorDesfazerAtivo === controladorDesfazer) controladorDesfazerAtivo = null;
      meuDiscordIdRemoto.value = null;
    },
  };
}
