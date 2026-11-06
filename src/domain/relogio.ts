import { signal } from '@preact/signals';

/**
 * Funções puras de formatação de cronômetro, avanço de horário do clima
 * e persistência dos contadores dramáticos de sessão.
 */

export interface ContadorDramatico {
  rotulo: string;
  valor: number;
}

export const CONTADOR_PADRAO: ContadorDramatico = {
  rotulo: 'Tensão',
  valor: 0,
};

/** Estado em memória do cronômetro (não grava no histórico de undo da Store). */
export const estadoCronometro = signal<{ segundos: number; rodando: boolean }>({
  segundos: 0,
  rodando: false,
});

/** Formata segundos em MM:SS ou HH:MM:SS quando ultrapassa 1 hora. */
export function formatarCronometro(segundosTotais: number): string {
  const s = Math.max(0, Math.floor(segundosTotais || 0));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const segundos = s % 60;

  const mm = String(minutos).padStart(2, '0');
  const ss = String(segundos).padStart(2, '0');

  if (horas > 0) {
    const hh = String(horas).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Lê um horário no formato HH:MM e adiciona minutos (positivo ou negativo),
 * rotacionando em 24h (1440 minutos). Devolve sempre HH:MM.
 */
export function avancarHorario(horarioAtual: string, minutosDelta: number): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((horarioAtual || '').trim());
  let horas = 12;
  let minutos = 0;
  if (m) {
    horas = Number(m[1]);
    minutos = Number(m[2]);
  }

  const minutosAtuais = horas * 60 + minutos;
  const delta = Math.round(minutosDelta || 0);
  const totalMinutos = ((minutosAtuais + delta) % 1440 + 1440) % 1440;

  const novoH = Math.floor(totalMinutos / 60);
  const novoM = totalMinutos % 60;

  return `${String(novoH).padStart(2, '0')}:${String(novoM).padStart(2, '0')}`;
}

export function chaveContador(mapaId: string): string {
  return `atlas:contador:${mapaId}`;
}

export function carregarContador(
  mapaId: string,
  storage?: Pick<Storage, 'getItem'>,
): ContadorDramatico {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    const bruto = s?.getItem(chaveContador(mapaId));
    if (!bruto) return { ...CONTADOR_PADRAO };
    const dados = JSON.parse(bruto);
    const rotulo =
      typeof dados?.rotulo === 'string' && dados.rotulo.trim()
        ? dados.rotulo.trim()
        : CONTADOR_PADRAO.rotulo;
    const valor =
      typeof dados?.valor === 'number' && Number.isFinite(dados.valor)
        ? Math.max(0, Math.floor(dados.valor))
        : 0;
    return { rotulo, valor };
  } catch {
    return { ...CONTADOR_PADRAO };
  }
}

export function salvarContador(
  mapaId: string,
  dados: ContadorDramatico,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    s?.setItem(chaveContador(mapaId), JSON.stringify(dados));
  } catch {
    // ignorar quota de armazenamento
  }
}
