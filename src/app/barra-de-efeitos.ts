import { signal } from '@preact/signals';
import {
  type BarraDeEfeitos,
  type EspacoDaBarra,
  BARRA_PADRAO,
  lerBarra,
} from '../domain/barra-de-efeitos.ts';
import type { PassoDeMomento } from '../domain/momentos.ts';
import { executarPassoAvulso, tocarMomentoDoMapa, sessao } from './app.ts';
import { avisar } from './toasts.ts';

export const CHAVE_BARRA_EFEITOS = 'atlas:barra-de-efeitos';

function carregarBarra(): BarraDeEfeitos {
  try {
    const bruto = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_BARRA_EFEITOS) : null;
    return bruto ? lerBarra(JSON.parse(bruto)) : structuredClone(BARRA_PADRAO);
  } catch {
    return structuredClone(BARRA_PADRAO);
  }
}

function salvarBarra(barra: BarraDeEfeitos): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHAVE_BARRA_EFEITOS, JSON.stringify(barra));
    }
  } catch {
    /* ignora cota ou indisponibilidade de localStorage */
  }
}

export const barraDeEfeitos = signal<BarraDeEfeitos>(carregarBarra());

/** Último espaço disparado e timestamp, para a barra visual piscar feedback ao usuário. */
export const ultimoDisparo = signal<{ i: number; quando: number } | null>(null);

/** Define o conteúdo de um espaço específico da barra (0 a 8) e persiste. */
export function definirEspaco(i: number, espaco: EspacoDaBarra | null): void {
  if (i < 0 || i >= 9) return;
  const nova = [...barraDeEfeitos.peek()];
  nova[i] = espaco;
  barraDeEfeitos.value = nova;
  salvarBarra(nova);
}

/** Troca o conteúdo de dois espaços (0 a 8) e persiste. */
export function trocarEspacos(a: number, b: number): void {
  if (a < 0 || a >= 9 || b < 0 || b >= 9 || a === b) return;
  const nova = [...barraDeEfeitos.peek()];
  const temp = nova[a]!;
  nova[a] = nova[b]!;
  nova[b] = temp;
  barraDeEfeitos.value = nova;
  salvarBarra(nova);
}

export interface SaidasDeDisparo {
  executarPasso?: (p: PassoDeMomento) => void;
  tocarMomento?: (id: string) => void;
  avisar?: (texto: string, opcoes?: { tipo?: string }) => void;
  momentoExiste?: (id: string) => boolean;
}

/**
 * Dispara o espaço correspondente da barra de efeitos (0 a 8):
 * - passo avulso: executa imediatamente;
 * - momento: toca o momento do mapa ativo, ou avisa caso não exista no mapa.
 */
export function dispararEspaco(i: number, injetadas?: SaidasDeDisparo): boolean {
  if (i < 0 || i >= 9) return false;
  const espaco = barraDeEfeitos.peek()[i];
  if (!espaco) return false;

  ultimoDisparo.value = { i, quando: Date.now() };

  if (espaco.acao.tipo === 'passo') {
    if (injetadas?.executarPasso) {
      injetadas.executarPasso(espaco.acao.passo);
    } else {
      executarPassoAvulso(espaco.acao.passo);
    }
    return true;
  }

  if (espaco.acao.tipo === 'momento') {
    const id = espaco.acao.id;
    const existe = injetadas?.momentoExiste
      ? injetadas.momentoExiste(id)
      : !!sessao.peek()?.doc.value.moments?.[id];

    if (!existe) {
      const msg = 'Este momento não existe neste mapa.';
      if (injetadas?.avisar) {
        injetadas.avisar(msg, { tipo: 'erro' });
      } else {
        avisar(msg, { tipo: 'erro' });
      }
      return false;
    }

    if (injetadas?.tocarMomento) {
      injetadas.tocarMomento(id);
    } else {
      void tocarMomentoDoMapa(id);
    }
    return true;
  }

  return false;
}
