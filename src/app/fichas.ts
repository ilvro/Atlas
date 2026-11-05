import { signal } from '@preact/signals';
import { chaveDaRef, criarRef, descobrir, enderecoDaRef, type Barramento, type Entidade, type Ref } from '#mesa';
import { novaPeca } from '../domain/fabrica.ts';
import { refDaFicha, type Recursos, type TomDaRolagem, tomDaRolagem } from '../domain/fichas.ts';
import type { MapaAtlas, Peca, Ponto } from '../domain/mapa.ts';
import { centroDaCelula } from '../domain/movimento.ts';
import type { SessaoDeEdicao } from './sessao.ts';
import { avisar } from './toasts.ts';
import type { RepositorioMapas } from '../data/repositorio.ts';

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
export function recursosDaPeca(p: Pick<Peca, 'refs'>): Recursos | null {
  const ref = refDaFicha(p.refs); return ref ? recursosDasFichas.peek()[chaveDaRef(ref)] ?? null : null;
}

/** A peça do mapa que representa uma ficha, se houver. */
export const pecaDaFicha = (m: Pick<MapaAtlas, 'tokens'>, ref: Ref): Peca | undefined => Object.values(m.tokens).find(t => t.refs.some(r => chaveDaRef(r) === chaveDaRef(ref)));

/** Os personagens da campanha que têm ficha (entidades `personagem` com um Ref do aplicativo `ficha`). */
export const personagensComFicha = (lista: readonly Entidade[]): Entidade[] => lista.filter(e => e.tipo === 'personagem' && refDaFicha(e.refs));
/** As ameaças (monstros) da campanha que têm ficha: entidades `ameaca` com um Ref do aplicativo `ficha`. Em ordem alfabética, sem acento atrapalhar. */
export const ameacasComFicha = (lista: readonly Entidade[]): Entidade[] => lista.filter(e => e.tipo === 'ameaca' && refDaFicha(e.refs)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/**
 * Põe o personagem ou a ameaça no mapa como peça ligada à ficha (no centro da célula de `onde`, ou do centro do mapa). Personagem vira peça de
 * jogador; ameaça vira peça de inimigo (`player: false`: não dá visão nem explorado, e some do projetor fora da vista dos jogadores). Há uma peça
 * por ficha: pôr de novo só a seleciona (a vida vem da ficha, então dois monstros iguais pedem duas fichas: duplique a ficha na Ficha). Devolve a peça.
 */
export function adicionarPersonagem(s: SessaoDeEdicao, e: Entidade, onde?: Ponto, repo?: Pick<RepositorioMapas, 'salvarAsset'> | null): Peca | null {
  const ref = refDaFicha(e.refs); if (!ref || (e.tipo !== 'personagem' && e.tipo !== 'ameaca')) return null;
  const m = s.store.documento, existente = pecaDaFicha(m, ref);
  if (existente) { s.selecao.value = [{ colecao: 'tokens', id: existente.id }]; avisar(`${e.nome} já está no mapa.`, { duracao: 1800 }); return existente; }
  const centro = centroDaCelula(m, onde ?? [m.bounds.width / 2, m.bounds.height / 2]);
  const peca = novaPeca(centro, e.nome, { player: e.tipo === 'personagem', refs: [ref] });
  s.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca as never }, { rotulo: `Pôr ${e.nome} no mapa` });
  s.selecao.value = [{ colecao: 'tokens', id: peca.id }];
  // O retrato que a Ficha publicou vira o retrato da peça (a imagem fica no banco de assets; o documento guarda só a referência).
  if (e.retrato && repo) void repo.salvarAsset(e.retrato).then(portrait => { if (s.store.documento.tokens[peca.id]) s.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: peca.id, patch: { portrait } }, { rotulo: `Retrato de ${e.nome}` }); }).catch(erro => console.warn('Atlas: não consegui guardar o retrato', erro));
  return peca;
}

/** Pede à Ficha que abra a ficha; sem resposta, tenta abrir a Ficha pelo manifesto numa aba nova. */
export async function abrirFicha(b: Pick<Barramento, 'pedir'> | null | undefined, ref: Ref): Promise<'aberta' | 'aba' | 'falhou'> {
  const r = b ? await b.pedir('ficha.abrir', { ref }).catch(() => null) : null;
  if (r?.ok) return 'aberta';
  try {
    const base = new URL('../Ficha/', location.href), manifesto = await descobrir(base), url = manifesto ? enderecoDaRef(manifesto, ref, base) : null;
    if (url) { window.open(url, '_blank'); avisar('A Ficha não estava aberta: abri numa aba nova.', { duracao: 2600 }); return 'aba'; }
  } catch { /* cai no aviso */ }
  avisar('A Ficha não respondeu. Abra a Ficha da campanha e tente de novo.', { tipo: 'erro', duracao: 3200 });
  return 'falhou';
}

export { criarRef };
