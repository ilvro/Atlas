import type { MapaAtlas } from '../domain/mapa.ts';
import { TIPOS_DE_COMODO } from '../domain/presets.ts';
import { funcaoProvavel } from './funcao.ts';
import { insightDoComodo } from './insight.ts';
import { propostaDeLuzes, textoDeLuzes } from './luzes.ts';
import { propostaDeMobilia } from './mobiliar.ts';
import { propostaDePorta, textoDaPorta } from './portas.ts';
import { novaProposta, type Proposta } from './proposta.ts';

/** O que um gerador precisa saber: o mapa, a versão de edição (a proposta só vale para ela), a semente e de onde tirar ids. */
export interface Contexto { m: MapaAtlas; versao: number; semente: number; gerarId?: (prefixo: string) => string }

export interface TipoDeSugestao {
  tipo: 'funcao' | 'porta' | 'mobiliar' | 'luz';
  /** "Outra" muda alguma coisa (a semente muda o resultado)? Senão o botão não aparece. */
  variavel: boolean;
  /** Texto da pílula, ou `null` se a sugestão não se aplica a este cômodo. */
  texto(c: Contexto, roomId: string): string | null;
  gerar(c: Contexto, roomId: string): Proposta | null;
}

const tipoDaFuncao = (funcao: string) => TIPOS_DE_COMODO.find(t => t.funcao === funcao);

/** A função que o nome do cômodo indica, se for clara (confiança ≥ 0,6) e diferente da que ele já tem. */
function funcaoSugerida(c: Contexto, roomId: string): { funcao: string; nome: string } | null {
  const ins = insightDoComodo(c.m, roomId), sala = c.m.rooms[roomId]; if (!ins || !sala) return null;
  const palpite = funcaoProvavel(ins);
  if (!palpite || palpite.motivo !== 'nome' || palpite.confianca < 0.6 || palpite.funcao === sala.function) return null;
  const tipo = tipoDaFuncao(palpite.funcao); return tipo ? { funcao: palpite.funcao, nome: tipo.nome } : null;
}

const SUGESTAO_DE_FUNCAO: TipoDeSugestao = {
  tipo: 'funcao', variavel: false,
  texto: (c, roomId) => { const f = funcaoSugerida(c, roomId); return f ? `Usar como ${f.nome}?` : null; },
  gerar(c, roomId) {
    const f = funcaoSugerida(c, roomId), sala = c.m.rooms[roomId], tipo = f && tipoDaFuncao(f.funcao); if (!f || !sala || !tipo) return null;
    const patch: Record<string, unknown> = { function: f.funcao };
    // Troca piso e papel só se ainda são exatamente os de um tipo de cômodo: o que o mestre escolheu à mão não se mexe.
    if (TIPOS_DE_COMODO.some(t => t.piso === sala.floor.material && t.papel === (sala.wallpaper?.material ?? null))) {
      patch.floor = { material: tipo.piso }; patch.wallpaper = { material: tipo.papel, seed: sala.wallpaper?.seed ?? sala.floor.seed };
    }
    return novaProposta({ tipo: 'funcao', rotulo: `Usar como ${f.nome}`, comandos: [{ tipo: 'comodo.atualizar', id: roomId, patch: patch as never }], versaoEsperada: c.versao, roomId, semente: c.semente });
  },
};

const SUGESTAO_DE_PORTA: TipoDeSugestao = { tipo: 'porta', variavel: true, texto: textoDaPorta, gerar: propostaDePorta };

const SUGESTAO_DE_LUZ: TipoDeSugestao = { tipo: 'luz', variavel: false, texto: textoDeLuzes, gerar: propostaDeLuzes };

const SUGESTAO_DE_MOBILIA: TipoDeSugestao = {
  tipo: 'mobiliar', variavel: true,
  texto: (c, roomId) => (propostaDeMobilia(c, roomId) ? `Mobiliar a ${c.m.rooms[roomId]!.name}?` : null),
  gerar: propostaDeMobilia,
};

/** Em ordem de prioridade: só a primeira que se aplica aparece. */
export const TIPOS_DE_SUGESTAO: TipoDeSugestao[] = [SUGESTAO_DE_FUNCAO, SUGESTAO_DE_PORTA, SUGESTAO_DE_MOBILIA, SUGESTAO_DE_LUZ];

export const chaveDeDispensa = (tipo: string, roomId: string): string => `${tipo}:${roomId}`;

/** A sugestão que vale agora para o cômodo, pulando as dispensadas (`${tipo}:${roomId}`). */
export function proximaSugestao(c: Contexto, roomId: string, dispensadas: ReadonlySet<string>): Proposta | null {
  for (const t of TIPOS_DE_SUGESTAO) {
    if (dispensadas.has(chaveDeDispensa(t.tipo, roomId)) || t.texto(c, roomId) === null) continue;
    const p = t.gerar(c, roomId); if (p) return p;
  }
  return null;
}

/** O texto da pílula de uma proposta já gerada. */
export const textoDaSugestao = (c: Contexto, p: Proposta): string => (p.roomId ? TIPOS_DE_SUGESTAO.find(t => t.tipo === p.tipo)?.texto(c, p.roomId) : null) ?? p.rotulo;

/** Outra do mesmo tipo (semente seguinte): o que "gerar de novo" faz. */
export function outraDoMesmoTipo(c: Contexto, p: Proposta): Proposta | null {
  const t = TIPOS_DE_SUGESTAO.find(x => x.tipo === p.tipo); if (!t || !p.roomId) return null;
  return t.gerar({ ...c, semente: p.semente + 1 }, p.roomId);
}
