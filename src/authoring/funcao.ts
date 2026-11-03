import { TIPOS_DE_COMODO } from '../domain/presets.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { InsightDoComodo } from './insight.ts';

export interface Palpite { funcao: string; confianca: number; motivo: 'nome' | 'objetos' | 'tamanho' }

/** Sem acento e em minúsculas (a mesma regra da busca da paleta; `authoring` não importa `app`). */
const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const FUNCOES = new Set(TIPOS_DE_COMODO.map(t => t.funcao));

// Das mais específicas para as mais genéricas: a primeira palavra que bate decide.
const POR_NOME: readonly { palavras: string[]; funcao: string; confianca: number }[] = [
  { palavras: ['cozinha', 'copa'], funcao: 'cozinha', confianca: 0.9 },
  { palavras: ['quarto', 'dormitorio', 'suite', 'alcova'], funcao: 'quarto', confianca: 0.9 },
  { palavras: ['biblioteca'], funcao: 'biblioteca', confianca: 0.9 },
  { palavras: ['escritorio', 'gabinete', 'estudo'], funcao: 'escritorio', confianca: 0.9 },
  { palavras: ['banheiro', 'lavabo', 'banho', 'wc'], funcao: 'banheiro', confianca: 0.9 },
  { palavras: ['corredor', 'hall', 'passagem', 'vestibulo'], funcao: 'corredor', confianca: 0.9 },
  { palavras: ['enfermaria', 'consultorio', 'hospital'], funcao: 'hospital', confianca: 0.9 },
  { palavras: ['taverna', 'bar', 'estalagem', 'pub'], funcao: 'taverna', confianca: 0.9 },
  { palavras: ['capela', 'igreja', 'templo', 'santuario'], funcao: 'capela', confianca: 0.9 },
  { palavras: ['forja', 'ferraria', 'oficina'], funcao: 'forja', confianca: 0.9 },
  { palavras: ['porao', 'adega', 'cripta'], funcao: 'porao', confianca: 0.9 },
  { palavras: ['jantar', 'refeitorio'], funcao: 'sala-de-jantar', confianca: 0.9 },
  { palavras: ['jogos', 'bilhar', 'sinuca', 'fumar'], funcao: 'sala-de-jogos', confianca: 0.9 },
  { palavras: ['estar', 'salao'], funcao: 'sala', confianca: 0.9 },
];
const CONHECIDAS = new Set(POR_NOME.flatMap(r => r.palavras));
const LIGACOES = new Set(['de', 'do', 'da', 'dos', 'das']);
const bate = (palavra: string, chave: string) => palavra === chave || palavra === `${chave}s`;

/** Pelo nome: "Cozinha", "Quarto do Hugo", "Sala de jantar". "Sala" sozinha vale menos, e "sala de <coisa desconhecida>" não é sala. */
function pelaNome(nome: string): Palpite | null {
  const palavras = normalizar(nome).split(/[^a-z0-9]+/).filter(Boolean);
  for (const regra of POR_NOME) if (palavras.some(p => regra.palavras.some(k => bate(p, k)))) return { funcao: regra.funcao, confianca: regra.confianca, motivo: 'nome' };
  const i = palavras.findIndex(p => bate(p, 'sala'));
  if (i < 0) return null;
  if (LIGACOES.has(palavras[i + 1] ?? '') && palavras[i + 2] && !CONHECIDAS.has(palavras[i + 2]!)) return null;
  return { funcao: 'sala', confianca: 0.6, motivo: 'nome' };
}

// Sinais fortes: ter isto basta para a função (vale 3 votos).
const FORTES: readonly [(receita: string) => boolean, string][] = [
  [r => r.startsWith('cama.'), 'quarto'], [r => r === 'balcao', 'cozinha'], [r => r === 'estante' || r === 'estante.piso', 'biblioteca'], [r => r === 'escrivaninha' || r === 'escrivaninha.verde', 'escritorio'], [r => r === 'piano.cauda', 'sala'], [r => r === 'mesa.bilhar', 'sala-de-jogos'], [r => r === 'banheira.pes', 'banheiro'], [r => r === 'mesa.oval', 'sala-de-jantar'], [r => r === 'altar', 'capela'], [r => r === 'bigorna', 'forja'],
];
const FUNCOES_DA_RECEITA = new Map(ACERVO.lista().map(r => [r.id, r.funcoes]));

/** Pelos objetos: cada um vota nas funções da sua receita. */
function pelosObjetos(ins: InsightDoComodo): Palpite | null {
  const votos = new Map<string, number>(); let total = 0, contados = 0;
  for (const o of ins.objetos) {
    if (!o.receita) continue;
    const forte = FORTES.find(([ehForte]) => ehForte(o.receita!));
    const funcoes = FUNCOES_DA_RECEITA.get(o.receita) ?? [];
    if (!forte && !funcoes.length) continue;
    contados++;
    if (forte) { votos.set(forte[1], (votos.get(forte[1]) ?? 0) + 3); total += 3; continue; }
    for (const f of funcoes) { if (FUNCOES.has(f)) votos.set(f, (votos.get(f) ?? 0) + 1 / funcoes.length); }
    total += funcoes.filter(f => FUNCOES.has(f)).length / funcoes.length;
  }
  if (!total) return null;
  const [funcao, v] = [...votos].sort((a, b) => b[1] - a[1])[0]!;
  return { funcao, confianca: (v / total) * Math.min(1, contados / 3), motivo: 'objetos' };
}

function peloTamanho(ins: InsightDoComodo): Palpite | null {
  const w = ins.caixa.x1 - ins.caixa.x0, h = ins.caixa.y1 - ins.caixa.y0, menor = Math.min(w, h), maior = Math.max(w, h);
  if (menor > 0 && maior / menor >= 3 && menor <= 2) return { funcao: 'corredor', confianca: 0.5, motivo: 'tamanho' };
  if (ins.area <= 5) return { funcao: 'banheiro', confianca: 0.35, motivo: 'tamanho' };
  return null;
}

/** Para que serve o cômodo, com um grau de confiança: nome (≥ 0,6), depois objetos (≥ 0,5), depois tamanho. Só devolve funções de `TIPOS_DE_COMODO`. */
export function funcaoProvavel(ins: InsightDoComodo): Palpite | null {
  const nome = pelaNome(ins.nome); if (nome && nome.confianca >= 0.6) return nome;
  const objetos = pelosObjetos(ins); if (objetos && objetos.confianca >= 0.5) return objetos;
  return peloTamanho(ins);
}
