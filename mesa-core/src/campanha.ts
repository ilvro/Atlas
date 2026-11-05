import { abrirBanco, obterTudo, promessa, transacao } from './idb.ts';
import { ehApp, ehRef, mesmaRef, type AppId, type Ref } from './refs.ts';

export const BANCO_CAMPANHA = 'mesa-campanha-v1';
export const VERSAO_BANCO_CAMPANHA = 1;

/** `ameaca`: um monstro ou inimigo (a ficha de ameaça da Ficha); diferente de `personagem`, que é de jogador. */
export const TIPOS_ENTIDADE = ['personagem', 'ameaca', 'lugar', 'pista', 'cena', 'efeito', 'sessao', 'faccao', 'nota'] as const;
export type TipoEntidade = (typeof TIPOS_ENTIDADE)[number];

export interface Campanha {
  id: string;
  nome: string;
  /** Ex.: 'ordem-paranormal'. Texto livre. */
  sistema: string;
  tema: 'ordem' | 'prata' | 'neutro' | null;
  capa: string | null;
  criadaEm: number;
  atualizadaEm: number;
}

/** Algo da campanha: o que cada aplicativo mostra dela está em `refs`. */
export interface Entidade {
  id: string;
  campanhaId: string;
  tipo: TipoEntidade;
  nome: string;
  refs: Ref[];
  tags: string[];
  notas: string;
  /** O retrato (uma imagem pequena, de até 512 KB), publicado por quem criou a entidade; os outros aplicativos só leem. Opcional. */
  retrato?: Blob;
  criadaPor: AppId;
  criadaEm: number;
  atualizadaEm: number;
}

export const TIPOS_LIGACAO = ['aparece-em', 'esta-em', 'revela', 'toca-em', 'pertence-a', 'menciona'] as const;
export type TipoLigacao = (typeof TIPOS_LIGACAO)[number];

export interface Ligacao {
  id: string;
  campanhaId: string;
  de: Ref;
  para: Ref;
  tipo: TipoLigacao;
  criadaPor: AppId;
  criadaEm: number;
}

export interface Sessao {
  id: string;
  campanhaId: string;
  nome: string;
  data: number;
  /** Mapas, cenas sonoras, documentos… na ordem em que devem acontecer. */
  roteiro: Ref[];
  /** Uma nota por item do roteiro, pela chave do Ref (`app/tipo/id`, a de `chaveDaRef`). Opcional; sessões antigas não têm. */
  roteiroNotas?: Record<string, string>;
  registro: string;
  criadaEm: number;
  atualizadaEm: number;
}

export class ErroCampanha extends Error {
  readonly caminho: string;
  constructor(mensagem: string, caminho = '') { super(caminho ? `${caminho}: ${mensagem}` : mensagem); this.name = 'ErroCampanha'; this.caminho = caminho; }
}

function falha(cond: unknown, msg: string, caminho: string): asserts cond { if (!cond) throw new ErroCampanha(msg, caminho); }
function texto(v: unknown, caminho: string, max = 200): void { falha(typeof v === 'string' && v.length <= max, `Texto de até ${max} caracteres.`, caminho); }
function tempo(v: unknown, caminho: string): void { falha(typeof v === 'number' && Number.isFinite(v) && v >= 0, 'Instante inválido.', caminho); }
function refs(v: unknown, caminho: string): void { falha(Array.isArray(v) && v.length <= 64, 'Lista de referências inválida.', caminho); (v as unknown[]).forEach((r, i) => falha(ehRef(r), 'Referência inválida.', `${caminho}[${i}]`)); }
const soCampos = (o: object, campos: string[], caminho: string): void => { for (const k of Object.keys(o)) falha(campos.includes(k), `Campo desconhecido: ${k}.`, `${caminho}.${k}`); };
function objeto(v: unknown, caminho: string): asserts v is Record<string, unknown> { falha(!!v && typeof v === 'object' && !Array.isArray(v), 'Objeto inválido.', caminho); }

export function validarCampanha(v: unknown): asserts v is Campanha {
  objeto(v, 'campanha'); soCampos(v, ['id', 'nome', 'sistema', 'tema', 'capa', 'criadaEm', 'atualizadaEm'], 'campanha');
  falha(typeof v.id === 'string' && v.id.length > 0, 'Identificador ausente.', 'campanha.id');
  texto(v.nome, 'campanha.nome'); falha(String(v.nome).trim().length > 0, 'Dê um nome à campanha.', 'campanha.nome');
  texto(v.sistema, 'campanha.sistema', 80);
  falha(v.tema === null || ['ordem', 'prata', 'neutro'].includes(String(v.tema)), 'Tema inválido.', 'campanha.tema');
  falha(v.capa === null || typeof v.capa === 'string', 'Capa inválida.', 'campanha.capa');
  tempo(v.criadaEm, 'campanha.criadaEm'); tempo(v.atualizadaEm, 'campanha.atualizadaEm');
}

export function validarEntidade(v: unknown): asserts v is Entidade {
  objeto(v, 'entidade'); soCampos(v, ['id', 'campanhaId', 'tipo', 'nome', 'refs', 'tags', 'notas', 'retrato', 'criadaPor', 'criadaEm', 'atualizadaEm'], 'entidade');
  falha(v.retrato === undefined || (typeof Blob !== 'undefined' && v.retrato instanceof Blob && v.retrato.size <= 512 * 1024), 'O retrato deve ser uma imagem de até 512 KB.', 'entidade.retrato');
  falha(typeof v.id === 'string' && v.id.length > 0 && typeof v.campanhaId === 'string' && v.campanhaId.length > 0, 'Identificador ausente.', 'entidade.id');
  falha((TIPOS_ENTIDADE as readonly string[]).includes(String(v.tipo)), 'Tipo de entidade inválido.', 'entidade.tipo');
  texto(v.nome, 'entidade.nome'); falha(String(v.nome).trim().length > 0, 'Dê um nome.', 'entidade.nome');
  refs(v.refs, 'entidade.refs');
  falha(Array.isArray(v.tags) && v.tags.length <= 50 && v.tags.every(t => typeof t === 'string' && t.length <= 40), 'Etiquetas inválidas.', 'entidade.tags');
  texto(v.notas, 'entidade.notas', 200_000);
  falha(ehApp(v.criadaPor), 'Aplicativo de origem inválido.', 'entidade.criadaPor');
  tempo(v.criadaEm, 'entidade.criadaEm'); tempo(v.atualizadaEm, 'entidade.atualizadaEm');
}

export function validarLigacao(v: unknown): asserts v is Ligacao {
  objeto(v, 'ligacao'); soCampos(v, ['id', 'campanhaId', 'de', 'para', 'tipo', 'criadaPor', 'criadaEm'], 'ligacao');
  falha(typeof v.id === 'string' && v.id.length > 0 && typeof v.campanhaId === 'string' && v.campanhaId.length > 0, 'Identificador ausente.', 'ligacao.id');
  falha(ehRef(v.de) && ehRef(v.para), 'Referência inválida.', 'ligacao.de');
  falha(!mesmaRef(v.de as Ref, v.para as Ref), 'Uma coisa não se liga a si mesma.', 'ligacao.para');
  falha((TIPOS_LIGACAO as readonly string[]).includes(String(v.tipo)), 'Tipo de ligação inválido.', 'ligacao.tipo');
  falha(ehApp(v.criadaPor), 'Aplicativo de origem inválido.', 'ligacao.criadaPor'); tempo(v.criadaEm, 'ligacao.criadaEm');
}

export function validarSessao(v: unknown): asserts v is Sessao {
  objeto(v, 'sessao'); soCampos(v, ['id', 'campanhaId', 'nome', 'data', 'roteiro', 'roteiroNotas', 'registro', 'criadaEm', 'atualizadaEm'], 'sessao');
  falha(typeof v.id === 'string' && v.id.length > 0 && typeof v.campanhaId === 'string' && v.campanhaId.length > 0, 'Identificador ausente.', 'sessao.id');
  texto(v.nome, 'sessao.nome'); tempo(v.data, 'sessao.data'); refs(v.roteiro, 'sessao.roteiro'); texto(v.registro, 'sessao.registro', 200_000);
  if (v.roteiroNotas !== undefined) {
    objeto(v.roteiroNotas, 'sessao.roteiroNotas');
    const notas = Object.entries(v.roteiroNotas);
    falha(notas.length <= 64, 'Notas demais no roteiro.', 'sessao.roteiroNotas');
    for (const [chave, nota] of notas) { falha(chave.length > 0 && chave.length <= 400, 'Chave de nota inválida.', `sessao.roteiroNotas.${chave}`); texto(nota, `sessao.roteiroNotas.${chave}`, 300); }
  }
  tempo(v.criadaEm, 'sessao.criadaEm'); tempo(v.atualizadaEm, 'sessao.atualizadaEm');
}

export interface OpcoesRepositorio {
  /** O aplicativo que está escrevendo: decide quem pode alterar o quê. */
  app: AppId;
  idb?: IDBFactory;
  agora?: () => number;
  novoId?: () => string;
}

export interface RepositorioCampanha {
  listarCampanhas(): Promise<Campanha[]>;
  obterCampanha(id: string): Promise<Campanha | undefined>;
  salvarCampanha(campanha: Campanha): Promise<void>;
  /** Remove a campanha e tudo que pertence a ela (entidades, ligações, sessões). */
  removerCampanha(id: string): Promise<void>;
  criarCampanha(dados: { nome: string; sistema?: string; tema?: Campanha['tema'] }): Promise<Campanha>;

  listarEntidades(campanhaId: string, filtro?: { tipo?: TipoEntidade; ref?: Ref }): Promise<Entidade[]>;
  obterEntidade(id: string): Promise<Entidade | undefined>;
  criarEntidade(dados: { campanhaId: string; tipo: TipoEntidade; nome: string; refs?: Ref[]; tags?: string[]; notas?: string; retrato?: Blob }): Promise<Entidade>;
  /**
   * Quem criou a entidade altera tudo. Os demais aplicativos só mexem nas referências do próprio aplicativo
   * (acrescentar, trocar, tirar); qualquer outra diferença é recusada.
   */
  salvarEntidade(entidade: Entidade): Promise<void>;
  /** Remove a entidade e as ligações que partem dela ou chegam nela. Só o criador remove. */
  removerEntidade(id: string): Promise<void>;
  /** Acha a entidade que uma referência de outro aplicativo representa. */
  entidadeDaRef(campanhaId: string, ref: Ref): Promise<Entidade | undefined>;

  ligar(dados: { campanhaId: string; de: Ref; para: Ref; tipo: TipoLigacao }): Promise<Ligacao>;
  listarLigacoes(campanhaId: string, ref?: Ref): Promise<Ligacao[]>;
  removerLigacao(id: string): Promise<void>;

  listarSessoes(campanhaId: string): Promise<Sessao[]>;
  salvarSessao(sessao: Sessao): Promise<void>;
  removerSessao(id: string): Promise<void>;
  fechar(): void;
}

const chaveRef = (r: Ref) => `${r.app}/${r.tipo}/${r.id}`;

export async function abrirRepositorioCampanha(opcoes: OpcoesRepositorio): Promise<RepositorioCampanha> {
  const agora = opcoes.agora ?? Date.now, novoId = opcoes.novoId ?? (() => crypto.randomUUID());
  const banco = await abrirBanco(BANCO_CAMPANHA, VERSAO_BANCO_CAMPANHA, [
    { nome: 'campanhas', chave: 'id' },
    { nome: 'entidades', chave: 'id', indices: [{ nome: 'campanhaId', caminho: 'campanhaId' }] },
    { nome: 'ligacoes', chave: 'id', indices: [{ nome: 'campanhaId', caminho: 'campanhaId' }] },
    { nome: 'sessoes', chave: 'id', indices: [{ nome: 'campanhaId', caminho: 'campanhaId' }] },
  ], opcoes.idb);

  const porCampanha = <T>(tx: IDBTransaction, store: string, campanhaId: string) => obterTudo<T>(tx.objectStore(store).index('campanhaId'), campanhaId);

  const repo: RepositorioCampanha = {
    listarCampanhas: () => transacao(banco, ['campanhas'], 'readonly', async tx => (await obterTudo<Campanha>(tx.objectStore('campanhas'))).sort((a, b) => b.atualizadaEm - a.atualizadaEm)),
    obterCampanha: id => transacao(banco, ['campanhas'], 'readonly', tx => promessa(tx.objectStore('campanhas').get(id)) as Promise<Campanha | undefined>),
    salvarCampanha: campanha => { validarCampanha(campanha); return transacao(banco, ['campanhas'], 'readwrite', async tx => { await promessa(tx.objectStore('campanhas').put(campanha)); }); },
    async criarCampanha({ nome, sistema = '', tema = null }) {
      const t = agora(), campanha: Campanha = { id: novoId(), nome, sistema, tema, capa: null, criadaEm: t, atualizadaEm: t };
      await repo.salvarCampanha(campanha); return campanha;
    },
    removerCampanha: id => transacao(banco, ['campanhas', 'entidades', 'ligacoes', 'sessoes'], 'readwrite', async tx => {
      for (const store of ['entidades', 'ligacoes', 'sessoes']) for (const item of await porCampanha<{ id: string }>(tx, store, id)) await promessa(tx.objectStore(store).delete(item.id));
      await promessa(tx.objectStore('campanhas').delete(id));
    }),

    listarEntidades: (campanhaId, filtro) => transacao(banco, ['entidades'], 'readonly', async tx => {
      let lista = await porCampanha<Entidade>(tx, 'entidades', campanhaId);
      if (filtro?.tipo) lista = lista.filter(e => e.tipo === filtro.tipo);
      if (filtro?.ref) lista = lista.filter(e => e.refs.some(r => mesmaRef(r, filtro.ref!)));
      return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }),
    obterEntidade: id => transacao(banco, ['entidades'], 'readonly', tx => promessa(tx.objectStore('entidades').get(id)) as Promise<Entidade | undefined>),
    async criarEntidade({ campanhaId, tipo, nome, refs = [], tags = [], notas = '', retrato }) {
      const t = agora(), entidade: Entidade = { id: novoId(), campanhaId, tipo, nome, refs, tags, notas, ...(retrato ? { retrato } : {}), criadaPor: opcoes.app, criadaEm: t, atualizadaEm: t };
      validarEntidade(entidade);
      await transacao(banco, ['campanhas', 'entidades'], 'readwrite', async tx => {
        falha(await promessa(tx.objectStore('campanhas').getKey(campanhaId)) !== undefined, 'A campanha não existe.', 'entidade.campanhaId');
        await promessa(tx.objectStore('entidades').add(entidade));
      });
      return entidade;
    },
    async salvarEntidade(entidade) {
      validarEntidade(entidade);
      await transacao(banco, ['entidades'], 'readwrite', async tx => {
        const store = tx.objectStore('entidades'), antes = await promessa(store.get(entidade.id)) as Entidade | undefined;
        if (antes) {
          falha(antes.campanhaId === entidade.campanhaId && antes.criadaPor === entidade.criadaPor && antes.criadaEm === entidade.criadaEm, 'Origem e campanha não mudam.', 'entidade');
          if (antes.criadaPor !== opcoes.app) {
            const alheias = (e: Entidade) => JSON.stringify(e.refs.filter(r => r.app !== opcoes.app));
            const semRefsProprias = (e: Entidade) => JSON.stringify({ ...e, refs: undefined, atualizadaEm: undefined });
            falha(semRefsProprias(antes) === semRefsProprias(entidade) && alheias(antes) === alheias(entidade), `${opcoes.app} só altera as próprias referências de uma entidade criada por ${antes.criadaPor}.`, 'entidade');
          }
        } else falha(entidade.criadaPor === opcoes.app, 'Uma entidade nova nasce do aplicativo que a salva.', 'entidade.criadaPor');
        await promessa(store.put({ ...entidade, atualizadaEm: agora() }));
      });
    },
    removerEntidade: id => transacao(banco, ['entidades', 'ligacoes'], 'readwrite', async tx => {
      const store = tx.objectStore('entidades'), entidade = await promessa(store.get(id)) as Entidade | undefined;
      if (!entidade) return;
      falha(entidade.criadaPor === opcoes.app, `Só ${entidade.criadaPor} remove esta entidade.`, 'entidade');
      const chaves = new Set(entidade.refs.map(chaveRef));
      for (const l of await porCampanha<Ligacao>(tx, 'ligacoes', entidade.campanhaId)) if (chaves.has(chaveRef(l.de)) || chaves.has(chaveRef(l.para))) await promessa(tx.objectStore('ligacoes').delete(l.id));
      await promessa(store.delete(id));
    }),
    async entidadeDaRef(campanhaId, ref) { return (await repo.listarEntidades(campanhaId, { ref }))[0]; },

    async ligar({ campanhaId, de, para, tipo }) {
      const ligacao: Ligacao = { id: novoId(), campanhaId, de, para, tipo, criadaPor: opcoes.app, criadaEm: agora() };
      validarLigacao(ligacao);
      return transacao(banco, ['ligacoes'], 'readwrite', async tx => {
        const existentes = await porCampanha<Ligacao>(tx, 'ligacoes', campanhaId);
        const igual = existentes.find(l => l.tipo === tipo && mesmaRef(l.de, de) && mesmaRef(l.para, para));
        if (igual) return igual;
        await promessa(tx.objectStore('ligacoes').add(ligacao)); return ligacao;
      });
    },
    listarLigacoes: (campanhaId, ref) => transacao(banco, ['ligacoes'], 'readonly', async tx => {
      const lista = await porCampanha<Ligacao>(tx, 'ligacoes', campanhaId);
      return ref ? lista.filter(l => mesmaRef(l.de, ref) || mesmaRef(l.para, ref)) : lista;
    }),
    removerLigacao: id => transacao(banco, ['ligacoes'], 'readwrite', async tx => {
      const store = tx.objectStore('ligacoes'), l = await promessa(store.get(id)) as Ligacao | undefined;
      if (!l) return;
      falha(l.criadaPor === opcoes.app, `Só ${l.criadaPor} remove esta ligação.`, 'ligacao');
      await promessa(store.delete(id));
    }),

    listarSessoes: campanhaId => transacao(banco, ['sessoes'], 'readonly', async tx => (await porCampanha<Sessao>(tx, 'sessoes', campanhaId)).sort((a, b) => b.data - a.data)),
    salvarSessao: sessao => { validarSessao(sessao); return transacao(banco, ['sessoes'], 'readwrite', async tx => { await promessa(tx.objectStore('sessoes').put({ ...sessao, atualizadaEm: agora() })); }); },
    removerSessao: id => transacao(banco, ['sessoes'], 'readwrite', async tx => { await promessa(tx.objectStore('sessoes').delete(id)); }),
    fechar: () => banco.close(),
  };
  return repo;
}
