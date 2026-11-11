import { signal } from '@preact/signals';
import type { Ref } from '#mesa';
import type { AlvoDeCamera, EfeitoDeCena, Momento, PassoDeMomento } from '../domain/momentos.ts';

export interface SaidasDeMomento {
  som(ref: Ref): void;
  silencio(ms: number): void;
  efeito(e: EfeitoDeCena): void;
  clima(id: string): void;
  tela(acao: 'escurecer' | 'clarear', ms: number): void;
  letreiro(l: Extract<PassoDeMomento, { tipo: 'letreiro' }> | null): void; // null = tira da tela
  camera(alvo: AlvoDeCamera): void;
  revelar(ids: string[]): void;
  interagir(id: string): void;
  luz(ids: string[], acao: 'ligar' | 'desligar' | 'alternar'): void;
  objeto(ids: string[], acao: 'mostrar' | 'esconder'): void;
  pista(ref: Ref, mostrar: boolean): void;
  nota(texto: string): void;
}

export interface Relogio {
  esperar(ms: number, sinal: AbortSignal): Promise<void>;
}

export const momentoEmCurso = signal<{
  mapaId: string;
  id: string;
  nome: string;
  passo: number;
  total: number;
} | null>(null);

export const ultimoMomentoTocadoId = signal<string | null>(null);

const relogioPadrao: Relogio = {
  esperar(ms, sinal) {
    if (sinal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sinal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      sinal.addEventListener('abort', onAbort, { once: true });
    });
  },
};

interface ContextoExecucao {
  abortController: AbortController;
  saidas: SaidasDeMomento;
  usouTelaEscura: boolean;
  usouLetreiro: boolean;
}

let contextoAtual: ContextoExecucao | null = null;

/** Executa um passo instantâneo do momento; passos do tipo `esperar` são ignorados. */
export function executarPasso(p: PassoDeMomento, saidas: SaidasDeMomento): void {
  switch (p.tipo) {
    case 'esperar':
      break;
    case 'som':
      saidas.som(p.ref);
      break;
    case 'silencio':
      saidas.silencio(p.ms);
      break;
    case 'efeito':
      saidas.efeito(p.efeito);
      break;
    case 'clima':
      saidas.clima(p.clima);
      break;
    case 'tela':
      saidas.tela(p.acao, p.ms);
      break;
    case 'letreiro':
      saidas.letreiro(p);
      break;
    case 'camera':
      saidas.camera(p.alvo);
      break;
    case 'revelar':
      saidas.revelar(p.ids);
      break;
    case 'interagir':
      saidas.interagir(p.id);
      break;
    case 'luz':
      saidas.luz(p.ids, p.acao);
      break;
    case 'objeto':
      saidas.objeto(p.ids, p.acao);
      break;
    case 'pista':
      saidas.pista(p.ref, p.mostrar);
      break;
    case 'nota':
      saidas.nota(p.texto);
      break;
  }
}

/**
 * Toca um momento passo a passo. Tocar outro momento cancela o anterior antes de começar.
 * Cada passo roda isolado; falhas são avisadas e o momento segue.
 */
export async function tocarMomento(
  mapaId: string,
  m: Momento,
  saidas: SaidasDeMomento,
  relogio?: Relogio,
): Promise<'fim' | 'cancelado'> {
  if (contextoAtual) {
    pararMomento();
  }

  const ctx: ContextoExecucao = {
    abortController: new AbortController(),
    saidas,
    usouTelaEscura: false,
    usouLetreiro: false,
  };
  contextoAtual = ctx;
  const rel = relogio ?? relogioPadrao;
  const sinal = ctx.abortController.signal;

  const total = m.passos.length;
  ultimoMomentoTocadoId.value = m.id;

  for (let i = 0; i < total; i++) {
    if (sinal.aborted) {
      if (contextoAtual === ctx) pararMomento();
      return 'cancelado';
    }

    momentoEmCurso.value = {
      mapaId,
      id: m.id,
      nome: m.nome,
      passo: i + 1,
      total,
    };

    const passo = m.passos[i]!;
    if (passo.tipo === 'esperar') {
      try {
        await rel.esperar(passo.ms, sinal);
      } catch {
        if (sinal.aborted) {
          if (contextoAtual === ctx) pararMomento();
          return 'cancelado';
        }
      }
    } else {
      if (passo.tipo === 'tela') {
        if (passo.acao === 'escurecer') ctx.usouTelaEscura = true;
        else if (passo.acao === 'clarear') ctx.usouTelaEscura = false;
      } else if (passo.tipo === 'letreiro') {
        ctx.usouLetreiro = true;
      }
      try {
        executarPasso(passo, saidas);
      } catch (erro) {
        console.warn('Atlas: erro ao executar passo de momento', erro);
      }
    }

    if (sinal.aborted) {
      if (contextoAtual === ctx) pararMomento();
      return 'cancelado';
    }
  }

  if (contextoAtual === ctx) {
    contextoAtual = null;
    momentoEmCurso.value = null;
  }

  return 'fim';
}

/**
 * Aborta o momento em curso e limpa cortina escura ou letreiro se foram disparados durante o momento.
 */
export function pararMomento(): void {
  if (!contextoAtual) return;
  const ctx = contextoAtual;
  contextoAtual = null;
  ctx.abortController.abort();
  if (ctx.usouTelaEscura) {
    try {
      ctx.saidas.tela('clarear', 300);
    } catch (e) {
      console.warn('Atlas: erro ao clarear tela ao parar momento', e);
    }
  }
  if (ctx.usouLetreiro) {
    try {
      ctx.saidas.letreiro(null);
    } catch (e) {
      console.warn('Atlas: erro ao limpar letreiro ao parar momento', e);
    }
  }
  momentoEmCurso.value = null;
}
