import { signal } from '@preact/signals';
import type { RegraDeDiagonal } from '../domain/regua.ts';
import type { Ferramenta } from '../render/pincel.ts';

/**
 * O modo do aplicativo: Construir (editar o mapa) ou Sessão (jogar o mapa). É estado do aplicativo, não do documento: o mapa é o mesmo, a
 * sessão só usa outras ferramentas e mostra outras coisas. Abrir outro mapa volta a Construir.
 */
export type Modo = 'construir' | 'sessao';
export const modo = signal<Modo>('construir');
/** A aba aberta no inspetor (o tutor confere e abre). */
export const abaDoInspetor = signal<'mapa' | 'selecao' | 'historico'>('selecao');
export const emSessao = (): boolean => modo.value === 'sessao';

/** As ferramentas que existem na Sessão. */
export const FERRAMENTAS_DA_SESSAO: readonly Ferramenta[] = ['selecionar', 'mao', 'regua'];
/** Preferência local (não vai no mapa): como a régua conta as diagonais. */
const CHAVE_REGUA = 'atlas:regua-diagonal';
let regraInicial: RegraDeDiagonal = 'simples';
try { if (localStorage.getItem(CHAVE_REGUA) === 'alternada') regraInicial = 'alternada'; } catch { /* sem armazenamento: padrão simples */ }
export const regraDaRegua = signal<RegraDeDiagonal>(regraInicial);
export function definirRegraDaRegua(r: RegraDeDiagonal): void { regraDaRegua.value = r; try { localStorage.setItem(CHAVE_REGUA, r); } catch { /* ignora */ } }
/** Preferência local: quanto dura a transição entre dois climas, em ms (`null` = o padrão do viewport). */
const CHAVE_DURACAO = 'atlas:duracao-do-clima';
let duracaoInicial: number | null = null;
try { const v = Number(localStorage.getItem(CHAVE_DURACAO)); if (Number.isFinite(v) && v > 0) duracaoInicial = v; } catch { /* sem armazenamento: padrão */ }
export const duracaoDoClima = signal<number | null>(duracaoInicial);
export function definirDuracaoDoClima(ms: number): void { duracaoDoClima.value = ms; try { localStorage.setItem(CHAVE_DURACAO, String(ms)); } catch { /* ignora */ } }
export const ROTULO_DO_MODO: Record<Modo, string> = { construir: 'Construir', sessao: 'Sessão' };

/** Na Sessão, ver o mapa como os jogadores veem (névoa). Em Construir o mestre vê sempre tudo. */
export const vistaDeJogador = signal(false);
export const vistaAtual = (): 'construir' | 'mestre' | 'jogador' => (modo.value !== 'sessao' ? 'construir' : vistaDeJogador.value ? 'jogador' : 'mestre');
