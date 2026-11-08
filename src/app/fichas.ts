import { signal } from '@preact/signals';
import { chaveDaRef, criarRef, descobrir, enderecoDaRef, mesmaRef, type Barramento, type Entidade, type Ref } from '#mesa';
import { novaPeca } from '../domain/fabrica.ts';
import { extrairNumeroDoToken, proximoNomeDeAmeaca, refDaFicha, type Recursos, type TomDaRolagem, tomDaRolagem } from '../domain/fichas.ts';
import type { MapaAtlas, Peca, Ponto } from '../domain/mapa.ts';
import { centroDaCelula } from '../domain/movimento.ts';
import type { SessaoDeEdicao } from './sessao.ts';
import { avisar } from './toasts.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';

export { extrairNumeroDoToken, proximoNomeDeAmeaca };

/** O último `ficha.recursos` recebido, por Ref da ficha (memória da sessão, não documento). */
export const recursosDasFichas = signal<Record<string, Recursos>>({});

export interface Rolagem { ficha: Ref; titulo: string; total: number; modificador: number; tom: TomDaRolagem }
const ouvintesDeRolagem = new Set<(r: Rolagem) => void>();
/** Quem quer saber das rolagens (o efeito sobre a peça, o registro). Devolve o cancelamento. */
export const aoRolar = (fn: (r: Rolagem) => void): (() => void) => { ouvintesDeRolagem.add(fn); return () => { ouvintesDeRolagem.delete(fn); }; };

const CHAVE_PV_NO_PROJETOR = 'atlas:pv-no-projetor';
let pvInicial = false; try { pvInicial = localStorage.getItem(CHAVE_PV_NO_PROJETOR) === '1'; } catch { /* sem armazenamento */ }
/** Mostrar PV e PD das peças também no projetor? Preferência local do mestre. */
export const mostrarPvNoProjetor = signal(pvInicial);
export function definirMostrarPvNoProjetor(v: boolean): void { mostrarPvNoProjetor.value = v; try { localStorage.setItem(CHAVE_PV_NO_PROJETOR, v ? '1' : '0'); } catch { /* ignora */ } }

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Escuta a Ficha pelo barramento: `ficha.recursos` atualiza os pips das peças ligadas e `ficha.rolagem` avisa quem estiver ouvindo.
 * Devolve a função que para de escutar.
 */
export function iniciarFichas(b: Pick<Barramento, 'ouvir'>): () => void {
  const parar1 = b.ouvir('ficha.recursos', e => {
    const d = e.dados as { ficha: Ref } & Recursos;
    if (![d.pv, d.pvMax, d.pd, d.pdMax].every(ehNumero)) return;
    recursosDasFichas.value = { ...recursosDasFichas.peek(), [chaveDaRef(d.ficha)]: { pv: d.pv, pvMax: d.pvMax, pd: d.pd, pdMax: d.pdMax } };
  });
  const parar2 = b.ouvir('ficha.rolagem', e => {
    const d = e.dados as { ficha: Ref; titulo: string; total: number; modificador?: number };
    const r: Rolagem = { ficha: d.ficha, titulo: d.titulo, total: d.total, modificador: d.modificador ?? 0, tom: tomDaRolagem(d.total, d.modificador ?? 0) };
    for (const f of ouvintesDeRolagem) { try { f(r); } catch (erro) { console.warn('Atlas: ouvinte de rolagem falhou', erro); } }
  });
  return () => { parar1(); parar2(); };
}

/** Os recursos da ficha ligada a uma peça, ou `null`. */
export function recursosDaPeca(p: Pick<Peca, 'refs'> & { hp?: { pv: number; pvMax: number } | null }): Recursos | null {
  if (p.hp) return { pv: p.hp.pv, pvMax: p.hp.pvMax, pd: 0, pdMax: 0 };
  const ref = refDaFicha(p.refs); return ref ? recursosDasFichas.value[chaveDaRef(ref)] ?? null : null;
}

/**
 * A peça do mapa que representa uma ficha, se houver.
 * Se `preferidasIds` for passado, prioriza qualquer peça correspondente que esteja nessa lista (ex.: tokens selecionados).
 * Se houver iniciativa ativa com turno corrente, prioriza a peça do turno caso corresponda à ficha.
 */
export function pecaDaFicha(
  m: Pick<MapaAtlas, 'tokens'> & { session?: MapaAtlas['session'] },
  ref: Ref,
  preferidasIds?: readonly string[],
): Peca | undefined {
  const chave = chaveDaRef(ref);
  if (preferidasIds?.length) {
    for (const id of preferidasIds) {
      const t = m.tokens[id];
      if (t && t.refs.some(r => chaveDaRef(r) === chave)) return t;
    }
  }
  const ini = m.session?.initiative;
  if (ini && ini.order.length > 0) {
    const turnoTokenId = ini.order[ini.current]?.tokenId;
    if (turnoTokenId) {
      const t = m.tokens[turnoTokenId];
      if (t && t.refs.some(r => chaveDaRef(r) === chave)) return t;
    }
  }
  return Object.values(m.tokens).find(t => t.refs.some(r => chaveDaRef(r) === chave));
}

/** Os personagens da campanha que têm ficha (entidades `personagem` com um Ref do aplicativo `ficha`). */
export const personagensComFicha = (lista: readonly Entidade[]): Entidade[] => lista.filter(e => e.tipo === 'personagem' && refDaFicha(e.refs));
/** As ameaças (monstros) da campanha que têm ficha: entidades `ameaca` com um Ref do aplicativo `ficha`. Em ordem alfabética, sem acento atrapalhar. */
export const ameacasComFicha = (lista: readonly Entidade[]): Entidade[] => lista.filter(e => e.tipo === 'ameaca' && refDaFicha(e.refs)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/**
 * Põe o personagem ou a ameaça no mapa como peça ligada à ficha.
 * Para personagens de jogador (`personagem`): 1 peça por personagem (adicionar de novo apenas seleciona a existente).
 * Para ameaças (`ameaca`): sempre adiciona uma nova peça numerada (ex.: Zumbi 1, Zumbi 2) com HP independente.
 */
export function adicionarPersonagem(s: SessaoDeEdicao, e: Entidade, onde?: Ponto, repo?: Pick<RepositorioMapas, 'salvarAsset'> | null): Peca | null {
  const ref = refDaFicha(e.refs); if (!ref || (e.tipo !== 'personagem' && e.tipo !== 'ameaca')) return null;
  const m = s.store.documento, existente = pecaDaFicha(m, ref);

  if (e.tipo === 'personagem') {
    if (existente) { s.selecao.value = [{ colecao: 'tokens', id: existente.id }]; avisar(`${e.nome} já está no mapa.`, { duracao: 1800 }); return existente; }
    const centro = (m.grid.snap === false && onde) ? onde : centroDaCelula(m, onde ?? [m.bounds.width / 2, m.bounds.height / 2]);
    const peca = novaPeca(centro, e.nome, { player: true, refs: [ref] });
    s.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca as never }, { rotulo: `Pôr ${e.nome} no mapa` });
    s.selecao.value = [{ colecao: 'tokens', id: peca.id }];
    if (e.retrato && repo) void repo.salvarAsset(e.retrato).then(portrait => { if (s.store.documento.tokens[peca.id]) s.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: peca.id, patch: { portrait } }, { rotulo: `Retrato de ${e.nome}` }); }).catch(erro => console.warn('Atlas: não consegui guardar o retrato', erro));
    return peca;
  }

  // Ameaça: sempre permite adicionar mais uma peça numerada com HP independente
  const pecasExistentes = Object.values(m.tokens);
  const infoNome = proximoNomeDeAmeaca(e.nome, pecasExistentes, ref);

  // Se agora é o número 2 e a primeira ainda se chamava só nomeBase, renomeia a primeira para "<nomeBase> 1"
  if (infoNome.numero === 2) {
    const primeira = pecasExistentes.find(p => p.refs.some(r => mesmaRef(r, ref)));
    if (primeira && primeira.name === e.nome) {
      s.store.executar(
        { tipo: 'item.atualizar', colecao: 'tokens', id: primeira.id, patch: { name: `${e.nome} 1` } },
        { rotulo: `Numerar ${e.nome} 1` }
      );
    }
  }

  const rec = recursosDasFichas.peek()[chaveDaRef(ref)];
  const maxPv = (rec && rec.pvMax > 0) ? rec.pvMax : 20;
  const hp = { pv: maxPv, pvMax: maxPv };

  // Posição: se houver mais de uma peça da mesma ameaça e onde foi fornecido, distribui nas células livres vizinhas
  const pecasIguais = pecasExistentes.filter(p => p.refs.some(r => mesmaRef(r, ref)));
  let baseCentro = (m.grid.snap === false && onde) ? onde : centroDaCelula(m, onde ?? [m.bounds.width / 2, m.bounds.height / 2]);
  if (pecasIguais.length > 0 && onde) {
    baseCentro = [
      baseCentro[0] + (pecasIguais.length % 3) * m.grid.size,
      baseCentro[1] + Math.floor(pecasIguais.length / 3) * m.grid.size,
    ];
  }

  const peca = novaPeca(baseCentro, infoNome.nome, { player: false, refs: [ref], hp });
  s.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca as never }, { rotulo: `Pôr ${infoNome.nome} no mapa` });
  s.selecao.value = [{ colecao: 'tokens', id: peca.id }];
  if (e.retrato && repo) void repo.salvarAsset(e.retrato).then(portrait => { if (s.store.documento.tokens[peca.id]) s.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: peca.id, patch: { portrait } }, { rotulo: `Retrato de ${infoNome.nome}` }); }).catch(erro => console.warn('Atlas: não consegui guardar o retrato', erro));
  return peca;
}

/** Pede ao Dossiê (o aplicativo das fichas) que abra a ficha; sem resposta, tenta abri-lo pelo manifesto numa aba nova. */
export async function abrirFicha(b: Pick<Barramento, 'pedir'> | null | undefined, ref: Ref): Promise<'aberta' | 'aba' | 'falhou'> {
  const r = b ? await b.pedir('ficha.abrir', { ref }).catch(() => null) : null;
  if (r?.ok) return 'aberta';
  try {
    const base = new URL('../Dossie/', location.href), manifesto = await descobrir(base), url = manifesto ? enderecoDaRef(manifesto, ref, base) : null;
    if (url) { window.open(url, '_blank'); avisar('O Dossiê não estava aberto: abri numa aba nova.', { duracao: 2600 }); return 'aba'; }
  } catch { /* cai no aviso */ }
  avisar('O Dossiê não respondeu. Abra o Dossiê da campanha e tente de novo.', { tipo: 'erro', duracao: 3200 });
  return 'falhou';
}

export interface AjusteRecursoPatch {
  deltaPv?: number;
  deltaPd?: number;
  pv?: number;
  pd?: number;
}

/**
 * Ajusta PV e/ou PD de uma ficha: aplica atualização otimista imediata em `recursosDasFichas`
 * e despacha o pedido `ficha.ajustar-recursos` ao Dossiê pelo barramento.
 */
export function ajustarRecursos(
  b: Pick<Barramento, 'pedir'> | null | undefined,
  ref: Ref,
  patch: AjusteRecursoPatch,
): void {
  const chave = chaveDaRef(ref);
  const atual = recursosDasFichas.peek()[chave];
  if (atual) {
    let novoPv = atual.pv;
    let novoPd = atual.pd;

    if (patch.pv !== undefined) novoPv = patch.pv;
    else if (patch.deltaPv !== undefined) novoPv = atual.pv + patch.deltaPv;

    if (patch.pd !== undefined) novoPd = patch.pd;
    else if (patch.deltaPd !== undefined) novoPd = atual.pd + patch.deltaPd;

    novoPv = Math.max(0, Math.min(atual.pvMax, novoPv));
    novoPd = Math.max(0, Math.min(atual.pdMax, novoPd));

    recursosDasFichas.value = {
      ...recursosDasFichas.peek(),
      [chave]: {
        ...atual,
        pv: novoPv,
        pd: novoPd,
      },
    };
  }

  void b?.pedir('ficha.ajustar-recursos', { ficha: ref, ...patch }).catch(() => {
    /* falha silenciosa se não atendido */
  });
}

/**
 * Ajusta os recursos de uma peça: se a peça possui HP independente no mapa (ou é ameaça com ref),
 * altera diretamente o `hp` da peça no store do documento Atlas; se for personagem de jogador ligado
 * à ficha, envia o ajuste ao Dossiê via `ajustarRecursos`.
 */
export function ajustarRecursosDaPeca(
  s: SessaoDeEdicao,
  peca: Peca,
  patch: AjusteRecursoPatch,
  b?: Pick<Barramento, 'pedir'> | null,
): void {
  const ref = refDaFicha(peca.refs);
  if ((peca.hp !== undefined && peca.hp !== null) || (!peca.player && ref)) {
    const recFicha = ref ? recursosDasFichas.peek()[chaveDaRef(ref)] : undefined;
    const curHp = peca.hp ?? { pv: recFicha?.pv ?? 20, pvMax: recFicha?.pvMax ?? 20 };
    let novoPv = curHp.pv;
    if (patch.pv !== undefined) novoPv = patch.pv;
    else if (patch.deltaPv !== undefined) novoPv = curHp.pv + patch.deltaPv;
    novoPv = Math.max(0, Math.min(curHp.pvMax, novoPv));
    const novoHp = { pv: novoPv, pvMax: curHp.pvMax };
    s.store.executar(
      { tipo: 'item.atualizar', colecao: 'tokens', id: peca.id, patch: { hp: novoHp } },
      { rotulo: `PV de ${peca.name}: ${novoPv}/${curHp.pvMax}` },
    );
    return;
  }
  if (ref) {
    ajustarRecursos(b, ref, patch);
  }
}

export { criarRef };
