import { novaLuz, novoIdEntidade } from '../domain/fabrica.ts';
import type { Luz, Ponto } from '../domain/mapa.ts';
import { camposDoPreset, generoDe, presetDeLuz } from '../domain/presets.ts';
import { insightDoComodo } from './insight.ts';
import { malhaDoComodo } from './malha.ts';
import { novaProposta, type Proposta } from './proposta.ts';
import type { Contexto } from './sugestoes.ts';

/** Que predefinição (de `PRESETS_DE_LUZ`) cada gênero usa para a luz principal e para as pequenas. */
export const LUZES_POR_GENERO: Readonly<Record<string, { principal: string; pequena: string }>> = {
  investigacao: { principal: 'lamparina', pequena: 'vela' },
  moderno: { principal: 'lampada', pequena: 'lampada' },
  fantasia: { principal: 'tocha', pequena: 'vela' },
};

export interface LuzDaFuncao {
  /** Um ponto de luz a cada tanto de área (m²). */
  m2PorLuz: number;
  /** Corredor: um a cada tanto de comprimento (m), no lugar da área. */
  aCadaMetros?: number;
  tamanho: 'principal' | 'pequena';
  /** Receitas em que a luz prefere ficar (sobre a mesa, o balcão…). */
  sobre: string[];
}
export const LUZES_POR_FUNCAO: Readonly<Record<string, LuzDaFuncao>> = {
  quarto: { m2PorLuz: 20, tamanho: 'pequena', sobre: ['mesinha', 'comoda'] },
  sala: { m2PorLuz: 18, tamanho: 'principal', sobre: ['mesinha', 'aparador'] },
  cozinha: { m2PorLuz: 18, tamanho: 'principal', sobre: ['mesa.retangular', 'mesa.redonda', 'balcao'] },
  biblioteca: { m2PorLuz: 14, tamanho: 'pequena', sobre: ['escrivaninha', 'mesa.redonda', 'mesinha', 'poltrona'] },
  escritorio: { m2PorLuz: 20, tamanho: 'principal', sobre: ['escrivaninha', 'escrivaninha.verde'] },
  banheiro: { m2PorLuz: 20, tamanho: 'pequena', sobre: ['pia.pedestal', 'balcao'] },
  'sala-de-jantar': { m2PorLuz: 16, tamanho: 'principal', sobre: ['mesa.oval', 'cristaleira'] },
  'sala-de-jogos': { m2PorLuz: 14, tamanho: 'principal', sobre: ['mesa.bilhar'] },
  corredor: { m2PorLuz: 20, aCadaMetros: 6, tamanho: 'pequena', sobre: [] },
  hospital: { m2PorLuz: 15, tamanho: 'principal', sobre: ['mesinha'] },
  taverna: { m2PorLuz: 15, tamanho: 'principal', sobre: ['mesa.redonda', 'balcao'] },
  varanda: { m2PorLuz: 12, tamanho: 'pequena', sobre: ['urna.pedestal', 'pilar'] },
  capela: { m2PorLuz: 14, tamanho: 'pequena', sobre: ['altar'] },
  forja: { m2PorLuz: 14, tamanho: 'principal', sobre: ['bigorna', 'lareira.pedra'] },
  porao: { m2PorLuz: 18, tamanho: 'principal', sobre: [] },
};

const DISTANCIA_MINIMA = 2;
const distancia = (a: Ponto, b: Ponto) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * As luzes de um cômodo pela função e pelo gênero, de preferência sobre as mesas (a luz leva o dono: se o objeto sair, ela vai junto).
 * `null` se o cômodo já tem luz ou não tem função.
 */
export function propostaDeLuzes(c: Contexto, roomId: string): Proposta | null {
  const sala = c.m.rooms[roomId], ins = insightDoComodo(c.m, roomId), regra = sala?.function ? LUZES_POR_FUNCAO[sala.function] : null;
  if (!sala || !ins || !regra || ins.luzes.length) return null;
  const preset = presetDeLuz(LUZES_POR_GENERO[generoDe(c.m.style.genre).id]![regra.tamanho]); if (!preset) return null;
  const gerarId = c.gerarId ?? novoIdEntidade, comprimento = Math.max(ins.caixa.x1 - ins.caixa.x0, ins.caixa.y1 - ins.caixa.y0);
  const quantas = Math.max(1, regra.aCadaMetros ? Math.round(comprimento / regra.aCadaMetros) : Math.round(ins.area / regra.m2PorLuz));
  const escolhidas: { pos: Ponto; dono: string | null }[] = [];
  // Primeiro, sobre os objetos preferidos (cada um com no máximo uma luz, e longe das outras).
  for (const o of ins.objetos) {
    if (escolhidas.length >= quantas) break;
    if (!o.receita || !regra.sobre.includes(o.receita) || o.elevation === 'wall') continue;
    const obj = c.m.props[o.id]!; if (escolhidas.some(e => distancia(e.pos, obj.position) < DISTANCIA_MINIMA)) continue;
    escolhidas.push({ pos: obj.position, dono: o.id });
  }
  // O que faltar: nos pontos livres mais afastados entre si, a partir do centro da área livre.
  if (escolhidas.length < quantas) {
    const malha = malhaDoComodo(c.m, ins), livres: Ponto[] = [];
    for (let l = 0; l < malha.linhas; l += 2) for (let col = 0; col < malha.colunas; col += 2) {
      const i = l * malha.colunas + col;
      if (malha.dentro[i] && !malha.ocupada[i]) livres.push([malha.x0 + (col + 0.5) * malha.res, malha.y0 + (l + 0.5) * malha.res]);
    }
    if (livres.length) {
      const centro: Ponto = [(ins.caixa.x0 + ins.caixa.x1) / 2, (ins.caixa.y0 + ins.caixa.y1) / 2];
      while (escolhidas.length < quantas) {
        const pontos = escolhidas.map(e => e.pos);
        const melhor = pontos.length ? livres.reduce((b, p) => (Math.min(...pontos.map(q => distancia(p, q))) > Math.min(...pontos.map(q => distancia(b, q))) ? p : b))
          : livres.reduce((b, p) => (distancia(p, centro) < distancia(b, centro) ? p : b));
        if (pontos.length && Math.min(...pontos.map(q => distancia(melhor, q))) < DISTANCIA_MINIMA) break;
        escolhidas.push({ pos: melhor, dono: null });
      }
    }
  }
  if (!escolhidas.length) return null;
  const luzes: Luz[] = escolhidas.map(e => novaLuz([Math.round(e.pos[0] * 100) / 100, Math.round(e.pos[1] * 100) / 100], { id: gerarId('l'), ownerId: e.dono, on: true, nightOnly: false, ...camposDoPreset(preset) }));
  return novaProposta({ tipo: 'luz', rotulo: `Iluminar a ${sala.name}`, comandos: luzes.map(l => ({ tipo: 'item.adicionar' as const, colecao: 'lights' as const, item: l as never })), versaoEsperada: c.versao, roomId, semente: c.semente });
}

export const textoDeLuzes = (c: Contexto, roomId: string): string | null => (propostaDeLuzes(c, roomId) ? `Iluminar a ${c.m.rooms[roomId]!.name}?` : null);
