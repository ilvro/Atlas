import { novoIdEntidade } from '../domain/fabrica.ts';
import { GENEROS, TIPOS_DE_COMODO, generoDe } from '../domain/presets.ts';
import { receitaDe } from '../procedural/receitas.ts';
import { gerarLayout } from './layout.ts';
import { novaProposta, type Proposta } from './proposta.ts';
import { regrasPara } from './regras-mobilia.ts';
import type { Contexto } from './sugestoes.ts';

export interface MateriaisDoComodo { pisos: string[]; papeis: string[] }
export interface Paleta { nome: string; madeira: string; /** O segundo é sempre o linho (toalhas). */ tecidos: string[]; tapete: string }

const SEM_PAR = (funcao: string): MateriaisDoComodo => {
  const t = TIPOS_DE_COMODO.find(x => x.funcao === funcao);
  return { pisos: t ? [t.piso] : ['tabuas.carvalho'], papeis: t ? [t.papel] : ['papel.liso-claro'] };
};

/** Pisos e papéis por gênero e função; para a investigação, o par atual de `TIPOS_DE_COMODO` vem primeiro (é o que a pílula de função já pôs). */
export const MATERIAIS_POR_GENERO: Readonly<Record<string, Record<string, MateriaisDoComodo>>> = {
  investigacao: Object.fromEntries(TIPOS_DE_COMODO.map(t => {
    const extra: Record<string, MateriaisDoComodo> = {
      sala: { pisos: ['tabuas.escuras'], papeis: ['papel.listras-musgo'] }, cozinha: { pisos: ['azulejo.branco'], papeis: ['reboco.branco'] }, quarto: { pisos: ['tabuas.carvalho'], papeis: ['papel.damasco-vinho'] },
      biblioteca: { pisos: ['tabuas.escuras'], papeis: ['papel.damasco-vinho'] }, escritorio: { pisos: ['tabuas.carvalho'], papeis: ['papel.listras-musgo'] }, banheiro: { pisos: ['ladrilho.cozinha'], papeis: ['papel.liso-claro'] },
      corredor: { pisos: ['tabuas.escuras'], papeis: ['papel.damasco-azul'] }, hospital: { pisos: ['azulejo.branco'], papeis: ['papel.liso-claro'] }, taverna: { pisos: ['tabuas.carvalho'], papeis: ['tijolo'] }, porao: { pisos: ['concreto'], papeis: ['tijolo'] },
    };
    const e = extra[t.funcao]!; return [t.funcao, { pisos: [t.piso, ...e.pisos], papeis: [t.papel, ...e.papeis] }];
  })),
  moderno: Object.fromEntries(TIPOS_DE_COMODO.map(t => [t.funcao, t.funcao === 'banheiro' || t.funcao === 'hospital' ? { pisos: ['azulejo.branco', 'ladrilho.cozinha'], papeis: ['reboco.branco', 'papel.liso-claro'] }
    : t.funcao === 'porao' ? { pisos: ['concreto', 'carpete.cinza'], papeis: ['reboco.branco', 'papel.liso-escuro'] } : { pisos: ['tabuas.claras', 'carpete.cinza', 'concreto'], papeis: ['papel.liso-claro', 'reboco.branco', 'papel.liso-escuro'] }])),
  fantasia: Object.fromEntries(TIPOS_DE_COMODO.map(t => [t.funcao, t.funcao === 'quarto' || t.funcao === 'biblioteca' || t.funcao === 'escritorio' ? { pisos: ['tabuas.escuras', 'tabuas.carvalho'], papeis: ['tijolo', 'papel.damasco-vinho'] } : { pisos: ['laje.pedra', 'tabuas.escuras'], papeis: ['tijolo', 'papel.liso-escuro'] }])),
};

export const PALETAS_POR_GENERO: Readonly<Record<string, Paleta[]>> = {
  investigacao: [
    { nome: 'Vinho e carvalho', madeira: 'madeira.escura', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Azul e nogueira', madeira: 'madeira.media', tecidos: ['tecido.veludo-azul', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Verde e pinho', madeira: 'madeira.clara', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
  moderno: [
    { nome: 'Linho e pinho', madeira: 'madeira.clara', tecidos: ['tecido.linho', 'tecido.linho'], tapete: 'tapete.verde' },
    { nome: 'Azul e pinho', madeira: 'madeira.clara', tecidos: ['tecido.veludo-azul', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Verde e nogueira', madeira: 'madeira.media', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
  fantasia: [
    { nome: 'Couro e carvalho', madeira: 'madeira.escura', tecidos: ['couro.marrom', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Vinho e nogueira', madeira: 'madeira.media', tecidos: ['tecido.veludo-vinho', 'tecido.linho'], tapete: 'tapete.persa' },
    { nome: 'Verde e carvalho', madeira: 'madeira.escura', tecidos: ['tecido.verde', 'tecido.linho'], tapete: 'tapete.verde' },
  ],
};

export const materiaisDe = (genero: string, funcao: string): MateriaisDoComodo => (MATERIAIS_POR_GENERO[generoDe(genero).id] ?? MATERIAIS_POR_GENERO.investigacao!)[funcao] ?? SEM_PAR(funcao);
export const paletaDe = (genero: string, semente: number): Paleta => { const l = PALETAS_POR_GENERO[generoDe(genero).id]!; return l[Math.abs(semente) % l.length]!; };

/** Os parâmetros de material de uma receita, tirados da paleta: tecido nos estofados, colchas e toalhas; madeira nos móveis; um tapete que combina. */
export function paramsDaPaleta(paleta: Paleta, receita: string): Record<string, unknown> {
  const campos = receitaDe(receita)?.campos ?? [], params: Record<string, unknown> = {};
  for (const c of campos) {
    if (c.tipo !== 'material' || c.uso !== 'objeto') continue;
    if (c.id === 'estofado' || c.id === 'cobertor') params[c.id] = paleta.tecidos[0];
    else if (c.id === 'toalha') params[c.id] = paleta.tecidos[1] ?? paleta.tecidos[0];
    else if (c.id === 'madeira') params[c.id] = paleta.madeira;
    else if (c.id === 'material') params[c.id] = paleta.tapete;
  }
  return params;
}

/**
 * A proposta de mobiliar um cômodo: piso e papel do gênero (só se ainda são os de um tipo de cômodo, ou seja, não escolhidos à mão),
 * mais os móveis que faltam, numa paleta só. `null` se o cômodo não tem função, não há regra ou o layout trouxe menos de 2 objetos.
 */
export function propostaDeMobilia(c: Contexto, roomId: string): Proposta | null {
  const sala = c.m.rooms[roomId]; if (!sala?.function) return null;
  const genero = generoDe(c.m.style.genre).id; if (!regrasPara(sala.function, genero).length) return null;
  const paleta = paletaDe(genero, c.semente), gerarId = c.gerarId ?? novoIdEntidade;
  const layout = gerarLayout(c.m, { roomId, funcao: sala.function, genero, semente: c.semente, gerarId, params: r => paramsDaPaleta(paleta, r) });
  if (layout.objetos.length < 2) return null;
  const comandos: Proposta['comandos'] = [];
  const mat = materiaisDe(genero, sala.function), piso = mat.pisos[c.semente % mat.pisos.length]!, papel = mat.papeis[c.semente % mat.papeis.length]!;
  const ehDeTipo = TIPOS_DE_COMODO.some(t => t.piso === sala.floor.material && t.papel === (sala.wallpaper?.material ?? null));
  if (ehDeTipo && (piso !== sala.floor.material || papel !== sala.wallpaper?.material)) {
    comandos.push({ tipo: 'comodo.atualizar', id: roomId, patch: { floor: { material: piso }, wallpaper: { material: papel, seed: sala.wallpaper?.seed ?? sala.floor.seed } } as never });
  }
  for (const o of layout.objetos) comandos.push({ tipo: 'item.adicionar', colecao: 'props', item: o as never });
  return novaProposta({ tipo: 'mobiliar', rotulo: `Mobiliar a ${sala.name}`, comandos, versaoEsperada: c.versao, roomId, semente: c.semente });
}

export { GENEROS };
