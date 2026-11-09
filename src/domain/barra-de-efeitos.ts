import { IDENT } from './esquema.ts';
import { passoValido, type PassoDeMomento } from './momentos.ts';

export type AcaoDoEspaco =
  | { tipo: 'passo'; passo: PassoDeMomento }
  | { tipo: 'momento'; id: string };

export interface EspacoDaBarra {
  rotulo: string;
  acao: AcaoDoEspaco;
}

export type BarraDeEfeitos = (EspacoDaBarra | null)[]; // sempre 9

export const BARRA_PADRAO: BarraDeEfeitos = [
  { rotulo: 'Relâmpago', acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'relampago' } } },
  { rotulo: 'Tremor', acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'tremor' } } },
  { rotulo: 'Luzes piscam', acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'piscar' } } },
  { rotulo: 'Escurecer', acao: { tipo: 'passo', passo: { tipo: 'tela', acao: 'escurecer', ms: 800 } } },
  { rotulo: 'Clarão', acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'clarao' } } },
  null,
  null,
  null,
  null,
];

/**
 * Lê uma configuração de barra tolerante:
 * - completa até exatamente 9 espaços;
 * - descarta itens inválidos;
 * - 'esperar' não é aceito como passo de espaço.
 */
export function lerBarra(bruto: unknown): BarraDeEfeitos {
  if (!Array.isArray(bruto)) {
    return structuredClone(BARRA_PADRAO);
  }

  const resultado: BarraDeEfeitos = [];
  for (let i = 0; i < 9; i++) {
    const item = bruto[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      resultado.push(null);
      continue;
    }

    const rec = item as Record<string, unknown>;
    const rotulo = typeof rec.rotulo === 'string' ? rec.rotulo.trim() : '';
    const acao = rec.acao as Record<string, unknown> | undefined;

    if (!acao || typeof acao !== 'object') {
      resultado.push(null);
      continue;
    }

    if (acao.tipo === 'momento') {
      const id = typeof acao.id === 'string' ? acao.id.trim() : '';
      if (id && IDENT.test(id)) {
        resultado.push({
          rotulo: rotulo || 'Momento',
          acao: { tipo: 'momento', id },
        });
      } else {
        resultado.push(null);
      }
    } else if (acao.tipo === 'passo') {
      const passo = acao.passo as PassoDeMomento | undefined;
      if (!passo || typeof passo !== 'object' || passo.tipo === 'esperar' || passoValido(passo) !== null) {
        resultado.push(null);
      } else {
        resultado.push({
          rotulo: rotulo || 'Passo',
          acao: { tipo: 'passo', passo: structuredClone(passo) },
        });
      }
    } else {
      resultado.push(null);
    }
  }

  return resultado;
}

/** Retorna o identificador do ícone para visualização do espaço. */
export function obterIconeDoEspaco(espaco: EspacoDaBarra): string {
  if (espaco.acao.tipo === 'momento') return 'play';
  const p = espaco.acao.passo;
  switch (p.tipo) {
    case 'efeito':
      if (p.efeito === 'relampago') return 'anim';
      if (p.efeito === 'tremor') return 'tremor';
      if (p.efeito === 'piscar') return 'luz';
      if (p.efeito === 'clarao') return 'sol';
      return 'anim';
    case 'som':
      return 'som';
    case 'clima':
      return 'sol';
    case 'tela':
      return 'olho';
    case 'letreiro':
      return 'texto';
    case 'nota':
      return 'nota';
    default:
      return 'anim';
  }
}
