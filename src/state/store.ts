import { conteudo, type MapaAtlas } from '../domain/mapa.ts';
import { validarMapa } from '../domain/validacao.ts';
import { aplicarComando, ROTULOS, type Comando } from './comandos.ts';
import { compartilhar, congelar } from './imutavel.ts';
import { MUDANCA_COMPLETA, diferencas, type Mudancas } from './mudancas.ts';

export type TipoEvento = 'executar' | 'desfazer' | 'refazer' | 'gesto' | 'concluir' | 'cancelar' | 'substituir' | 'salvo';

export interface EventoStore {
  tipo: TipoEvento;
  documento: MapaAtlas;
  mudancas: Mudancas;
  versaoEdicao: number;
  /** Rótulo legível da ação (para o toast "Desfeito: …"). */
  rotulo: string;
}

export interface Gesto {
  readonly ativo: boolean;
  /** Aplica na hora (o mapa muda e os assinantes são avisados), mas sem entrar no histórico. */
  aplicar(comando: Comando): MapaAtlas;
  /** Fecha o gesto como UMA entrada de histórico. Se nada mudou, não cria entrada. */
  concluir(): MapaAtlas;
  /** Volta ao mapa de antes do gesto. */
  cancelar(): MapaAtlas;
}

export interface Store {
  readonly documento: MapaAtlas;
  readonly versaoEdicao: number;
  readonly sujo: boolean;
  readonly emGesto: boolean;
  readonly podeDesfazer: boolean;
  readonly podeRefazer: boolean;
  readonly rotuloDesfazer: string;
  readonly rotuloRefazer: string;
  /** Rótulos do histórico, do mais antigo ao mais novo. */
  readonly historico: readonly string[];
  assinar(ouvinte: (evento: EventoStore) => void): () => void;
  /**
   * `fusao`: chave de fusão. Se a entrada do topo do histórico tem a mesma chave, o comando é fundido nela (um só desfazer);
   * qualquer outro comando no meio quebra a fusão.
   */
  executar(comando: Comando, opcoes?: { rotulo?: string; versaoEsperada?: number; fusao?: string }): MapaAtlas;
  iniciarGesto(rotulo: string, opcoes?: { fusao?: string }): Gesto;
  /** Troca o documento por outra versão do MESMO mapa (a projeção recebida pelo projetor), avisando só o que mudou. Sem histórico. */
  projetar(mapa: MapaAtlas): MapaAtlas;
  /** Vários comandos como uma só entrada de histórico; se `corpo` lançar, nada do que fez fica. */
  transacao<T>(rotulo: string, corpo: (gesto: Gesto) => T, opcoes?: { fusao?: string }): T;
  desfazer(): MapaAtlas;
  refazer(): MapaAtlas;
  /**
   * Troca o mapa (abrir, importar, recuperar rascunho). Zera o histórico. Com `base`, o mapa entra como edição não gravada
   * sobre aquele mapa do disco: revisão e carimbos vêm dele, e `sujo` compara com ele.
   */
  substituir(mapa: MapaAtlas, opcoes?: { salvo?: boolean; base?: MapaAtlas }): MapaAtlas;
  /** O repositório confirmou a gravação. Aceita edições feitas enquanto gravava. */
  marcarSalvo(confirmado: MapaAtlas): void;
  dispor(): void;
}

export class ErroDeStore extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = 'ErroDeStore'; }
}

interface Entrada { antes: MapaAtlas; depois: MapaAtlas; rotulo: string; fusao?: string }
const LIMITE_HISTORICO = 150;

export function criarStore(inicial: MapaAtlas, opcoes: { salvo?: boolean } = {}): Store {
  validarMapa(inicial);
  let documento = congelar(inicial), versao = 0;
  let confirmado = { revision: documento.revision, createdAt: documento.createdAt, updatedAt: documento.updatedAt };
  let conteudoSalvo: string | null = opcoes.salvo === false ? null : conteudo(documento);
  let desfazer: Entrada[] = [], refazer: Entrada[] = [];
  let gestoAtual: { antes: MapaAtlas; rotulo: string; ativo: boolean } | null = null;
  const assinantes = new Set<(e: EventoStore) => void>();
  const cache = new WeakMap<MapaAtlas, string>();
  const conteudoDe = (m: MapaAtlas) => { let c = cache.get(m); if (c === undefined) { c = conteudo(m); cache.set(m, c); } return c; };

  const avisar = (tipo: TipoEvento, antes: MapaAtlas | null, rotulo: string) => {
    const evento: EventoStore = { tipo, documento, mudancas: tipo === 'substituir' ? MUDANCA_COMPLETA : diferencas(antes, documento), versaoEdicao: versao, rotulo };
    for (const ouvinte of [...assinantes]) ouvinte(evento);
  };
  /** Desfazer e refazer devolvem snapshots antigos: os carimbos de gravação são do disco, não da edição. */
  const restaurar = (snapshot: MapaAtlas) => congelar({ ...snapshot, ...confirmado });

  const store: Store = {
    get documento() { return documento; },
    get versaoEdicao() { return versao; },
    get sujo() { return conteudoSalvo === null || conteudoDe(documento) !== conteudoSalvo; },
    get emGesto() { return gestoAtual?.ativo === true; },
    get podeDesfazer() { return desfazer.length > 0; },
    get podeRefazer() { return refazer.length > 0; },
    get rotuloDesfazer() { return desfazer.at(-1)?.rotulo ?? ''; },
    get rotuloRefazer() { return refazer.at(-1)?.rotulo ?? ''; },
    get historico() { return desfazer.map(e => e.rotulo); },
    assinar(ouvinte) { assinantes.add(ouvinte); return () => { assinantes.delete(ouvinte); }; },

    executar(comando, extra = {}) {
      if (store.emGesto) throw new ErroDeStore('Há um gesto em andamento; conclua ou cancele antes.');
      if (extra.versaoEsperada !== undefined && extra.versaoEsperada !== versao) throw new ErroDeStore('O mapa mudou; gere a sugestão novamente.');
      const antes = documento, proximo = aplicarComando(antes, comando);
      if (proximo === antes) return antes;
      const rotulo = extra.rotulo ?? ROTULOS[comando.tipo];
      const topo = desfazer.at(-1);
      if (extra.fusao !== undefined && topo && topo.fusao === extra.fusao) topo.depois = proximo;
      else {
        desfazer.push(extra.fusao !== undefined ? { antes, depois: proximo, rotulo, fusao: extra.fusao } : { antes, depois: proximo, rotulo });
        if (desfazer.length > LIMITE_HISTORICO) desfazer.shift();
      }
      refazer = []; documento = proximo; versao++;
      avisar('executar', antes, rotulo);
      return documento;
    },

    iniciarGesto(rotulo, opcoes = {}) {
      if (store.emGesto) throw new ErroDeStore('Já há um gesto em andamento.');
      const estado = { antes: documento, rotulo, ativo: true };
      gestoAtual = estado;
      const gesto: Gesto = {
        get ativo() { return estado.ativo; },
        aplicar(comando) {
          if (!estado.ativo) throw new ErroDeStore('O gesto já terminou.');
          const antes = documento, proximo = aplicarComando(antes, comando);
          if (proximo !== antes) { documento = proximo; versao++; avisar('gesto', antes, rotulo); }
          return documento;
        },
        concluir() {
          if (!estado.ativo) throw new ErroDeStore('O gesto já terminou.');
          estado.ativo = false; gestoAtual = null;
          if (documento === estado.antes) return documento;
          const topo = desfazer.at(-1), fusao = opcoes.fusao;
          if (fusao !== undefined && topo && topo.fusao === fusao) topo.depois = documento;
          else {
            desfazer.push(fusao !== undefined ? { antes: estado.antes, depois: documento, rotulo, fusao } : { antes: estado.antes, depois: documento, rotulo });
            if (desfazer.length > LIMITE_HISTORICO) desfazer.shift();
          }
          refazer = [];
          avisar('concluir', estado.antes, rotulo);
          return documento;
        },
        cancelar() {
          if (!estado.ativo) return documento;
          estado.ativo = false; gestoAtual = null;
          if (documento !== estado.antes) { const atual = documento; documento = estado.antes; versao++; avisar('cancelar', atual, rotulo); }
          return documento;
        },
      };
      return gesto;
    },

    transacao(rotulo, corpo, opcoes) {
      const gesto = store.iniciarGesto(rotulo, opcoes);
      try { const resultado = corpo(gesto); gesto.concluir(); return resultado; } catch (erro) { gesto.cancelar(); throw erro; }
    },

    desfazer() {
      // Ctrl+Z no meio de um gesto o cancela, em vez de desfazer a ação anterior.
      if (store.emGesto) return cancelarGestoAtivo();
      const entrada = desfazer.pop();
      if (!entrada) return documento;
      const antes = documento;
      documento = restaurar(entrada.antes); refazer.push(entrada); versao++;
      avisar('desfazer', antes, entrada.rotulo);
      return documento;
    },
    refazer() {
      if (store.emGesto) return documento;
      const entrada = refazer.pop();
      if (!entrada) return documento;
      const antes = documento;
      documento = restaurar(entrada.depois); desfazer.push(entrada); versao++;
      avisar('refazer', antes, entrada.rotulo);
      return documento;
    },

    projetar(mapa) {
      validarMapa(mapa);
      if (mapa.id !== documento.id) return store.substituir(mapa);
      const antes = documento, proximo = congelar(compartilhar(antes, mapa));
      if (proximo === antes) return antes;
      documento = proximo; versao++;
      avisar('executar', antes, 'Projeção');
      return documento;
    },

    substituir(mapa, extra = {}) {
      validarMapa(mapa);
      if (gestoAtual) gestoAtual.ativo = false;
      gestoAtual = null;
      const base = extra.base;
      if (base && base.id !== mapa.id) throw new ErroDeStore('A base é de outro mapa.');
      documento = congelar(base ? { ...mapa, revision: base.revision, createdAt: base.createdAt, updatedAt: base.updatedAt } : mapa); versao++;
      confirmado = { revision: documento.revision, createdAt: documento.createdAt, updatedAt: documento.updatedAt };
      conteudoSalvo = base ? conteudo(base) : extra.salvo === false ? null : conteudo(documento);
      desfazer = []; refazer = [];
      avisar('substituir', null, '');
      return documento;
    },

    marcarSalvo(confirmadoPeloRepositorio) {
      validarMapa(confirmadoPeloRepositorio);
      if (confirmadoPeloRepositorio.id !== documento.id) throw new ErroDeStore('Confirmação de outro mapa.');
      if (confirmadoPeloRepositorio.revision < confirmado.revision) throw new ErroDeStore('Confirmação de gravação obsoleta.');
      confirmado = { revision: confirmadoPeloRepositorio.revision, createdAt: confirmadoPeloRepositorio.createdAt, updatedAt: confirmadoPeloRepositorio.updatedAt };
      conteudoSalvo = conteudo(confirmadoPeloRepositorio);
      const antes = documento;
      documento = congelar({ ...documento, ...confirmado });
      avisar('salvo', antes, '');
    },

    dispor() { assinantes.clear(); },
  };

  function cancelarGestoAtivo(): MapaAtlas {
    const g = gestoAtual;
    if (!g) return documento;
    g.ativo = false; gestoAtual = null;
    if (documento !== g.antes) { const atual = documento; documento = g.antes; versao++; avisar('cancelar', atual, g.rotulo); }
    return documento;
  }

  return store;
}
