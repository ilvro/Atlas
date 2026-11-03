import type { Ref } from '#mesa';
import { ceuNoHorario } from '../domain/clima.ts';
import { ErroDeValidacao } from '../domain/esquema.ts';
import { clonar, produzir } from './imutavel.ts';
import type { Acabamento, Clima, Estilo, Fundo, Grade, Memoria, MapaAtlas, NomeColecao, Ponto } from '../domain/mapa.ts';
import { atualizarSalasDosObjetos } from '../domain/geometria.ts';
import { presetDeClima } from '../domain/presets.ts';
import { validarMapa } from '../domain/validacao.ts';
import { aplicarConstrucao, ehComandoDeConstrucao, ErroDeComando, ROTULOS_CONSTRUIR, type ComandoConstruir, type ParcialProfundo } from './comandos-construir.ts';

/** Coleções que os comandos genéricos manipulam. Cômodos, paredes e aberturas têm comandos próprios (Fase 3). */
export const COLECOES_LIVRES = ['props', 'lights', 'tokens', 'regions', 'presence'] as const;
export type ColecaoLivre = (typeof COLECOES_LIVRES)[number];

export { ErroDeComando };
export type { ParcialProfundo };
export interface AlvoMovel { colecao: ColecaoLivre; id: string }

export type Comando =
  | ComandoConstruir
  | { tipo: 'mapa.renomear'; nome: string }
  | { tipo: 'mapa.notas'; texto: string }
  | { tipo: 'mapa.campanha'; campanhaId: string | null }
  | { tipo: 'grade.atualizar'; patch: ParcialProfundo<Grade> }
  | { tipo: 'limites.atualizar'; largura: number; altura: number }
  | { tipo: 'estilo.atualizar'; patch: ParcialProfundo<Estilo> }
  | { tipo: 'clima.aplicar'; patch: ParcialProfundo<Clima> }
  | { tipo: 'clima.predefinir'; id: string }
  | { tipo: 'clima.salvar'; nome: string; id?: string }
  | { tipo: 'clima.esquecer'; id: string }
  | { tipo: 'clima.audio'; id: string; ref: Ref | null }
  | { tipo: 'acabamento.atualizar'; patch: ParcialProfundo<Acabamento> }
  | { tipo: 'fundo.atualizar'; patch: ParcialProfundo<Fundo> }
  | { tipo: 'memoria.atualizar'; patch: ParcialProfundo<Memoria> }
  | { tipo: 'item.adicionar'; colecao: ColecaoLivre; item: { id: string } & Record<string, unknown> }
  | { tipo: 'item.atualizar'; colecao: ColecaoLivre; id: string; patch: Record<string, unknown> }
  | { tipo: 'item.remover'; colecao: ColecaoLivre; id: string }
  | { tipo: 'selecao.mover'; alvos: AlvoMovel[]; delta: Ponto };

const nao = (msg: string): never => { throw new ErroDeComando(msg); };

const ehPlano = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Mistura `patch` em `alvo`: objetos entram por dentro, o resto substitui. `undefined` apaga o campo. */
function mesclar(alvo: Record<string, any>, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete alvo[k];
    else if (ehPlano(v) && ehPlano(alvo[k])) mesclar(alvo[k], v);
    else alvo[k] = clonar(v);
  }
}

function existente(m: MapaAtlas, colecao: ColecaoLivre, id: string): Record<string, any> {
  const item = (m[colecao] as Record<string, any>)[id];
  return item ?? nao(`Não existe “${id}” em ${colecao}.`);
}

/** Remove um item e tudo que dependia dele, para o documento nunca ficar com referências soltas. */
function remover(m: MapaAtlas, colecao: ColecaoLivre, id: string): void {
  existente(m, colecao, id);
  delete (m[colecao] as Record<string, unknown>)[id];
  if (colecao === 'props' || colecao === 'tokens') {
    // Luzes que pertenciam ao item vão com ele; o token que usava a luz fica sem lanterna.
    for (const luz of Object.values(m.lights)) if (luz.ownerId === id) remover(m, 'lights', luz.id);
    if (colecao === 'tokens' && m.session.initiative) {
      const ordem = m.session.initiative.order.filter(x => x.tokenId !== id);
      m.session.initiative = ordem.length ? { ...m.session.initiative, order: ordem, current: Math.min(m.session.initiative.current, ordem.length - 1) } : null;
    }
  }
  if (colecao === 'lights') for (const t of Object.values(m.tokens)) if (t.lightId === id) t.lightId = null;
  m.session.revealed = m.session.revealed.filter(x => x !== id);
}

function aplicar(m: MapaAtlas, c: Comando): void {
  if (ehComandoDeConstrucao(c)) { aplicarConstrucao(m, c); return; }
  switch (c.tipo) {
    case 'mapa.renomear': m.name = c.nome; break;
    case 'mapa.notas': m.notes = c.texto; break;
    case 'mapa.campanha': m.campanhaId = c.campanhaId; break;
    case 'grade.atualizar': mesclar(m.grid, c.patch); break;
    case 'limites.atualizar': m.bounds.width = c.largura; m.bounds.height = c.altura; break;
    case 'estilo.atualizar': mesclar(m.style, c.patch); break;
    case 'clima.aplicar': {
      const patch: Record<string, unknown> = { ...c.patch };
      // Mexer no horário move o sol (ou a lua) e o ambiente, a menos que o próprio comando diga como ficam.
      if (typeof patch.time === 'string') {
        let ceu; try { ceu = ceuNoHorario(patch.time); } catch { return nao(`Horário inválido: “${patch.time}”. Use HH:MM.`); }
        if (patch.sun === undefined) patch.sun = ceu.sun;          // `sun: null` é uma escolha (sem sol), não um "não informado"
        if (patch.ambient === undefined) patch.ambient = ceu.ambient;
      }
      mesclar(m.climate, patch); break;
    }
    case 'clima.predefinir': {
      const feito = presetDeClima(c.id), salvo = m.customClimates[c.id];
      if (feito) { m.climate = { preset: feito.id, ...clonar(feito.climate) } as Clima; m.finish = clonar(feito.finish); }
      else if (salvo) { m.climate = { preset: salvo.id, ...clonar(salvo.climate) } as Clima; m.finish = { preset: 'personalizado', ...clonar(salvo.finish) } as Acabamento; }
      else nao(`Clima desconhecido: “${c.id}”.`);
      break;
    }
    case 'clima.salvar': {
      const nome = c.nome.trim(); if (!nome) nao('Dê um nome ao clima.');
      const id = c.id ?? `usuario-${crypto.randomUUID()}`;
      if (m.customClimates[id]) nao('Já existe um clima com esse identificador.');
      const { preset: _p, ...clima } = clonar(m.climate), { preset: _f, ...acab } = clonar(m.finish);
      m.customClimates[id] = { id, name: nome, climate: clima, finish: acab };
      break;
    }
    case 'clima.audio': {
      if (!presetDeClima(c.id) && !m.customClimates[c.id]) nao('Esse clima não existe.');
      const id = presetDeClima(c.id)?.id ?? c.id;
      if (c.ref === null) delete m.climateAudio[id]; else m.climateAudio[id] = clonar(c.ref); break;
    }
    case 'clima.esquecer': {
      if (!m.customClimates[c.id]) nao('Esse clima salvo não existe.');
      delete m.customClimates[c.id]; delete m.climateAudio[c.id]; break;
    }
    case 'acabamento.atualizar': mesclar(m.finish, c.patch); break;
    case 'fundo.atualizar': mesclar(m.backdrop, c.patch); break;
    case 'memoria.atualizar': mesclar(m.memory, c.patch); break;
    case 'item.adicionar': {
      if (!(COLECOES_LIVRES as readonly string[]).includes(c.colecao)) nao(`“${c.colecao}” não aceita itens genéricos.`);
      const colecao = m[c.colecao] as Record<string, unknown>;
      if (colecao[c.item.id]) nao(`Já existe “${c.item.id}” em ${c.colecao}.`);
      colecao[c.item.id] = clonar(c.item);
      if (c.colecao === 'props') atualizarSalasDosObjetos(m);
      break;
    }
    case 'item.atualizar': {
      const item = existente(m, c.colecao, c.id);
      if ('id' in c.patch && c.patch.id !== c.id) nao('O identificador não muda.');
      mesclar(item, c.patch);
      if (c.colecao === 'props') atualizarSalasDosObjetos(m);
      break;
    }
    case 'item.remover': remover(m, c.colecao, c.id); break;
    case 'selecao.mover': {
      const [dx, dy] = c.delta;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) nao('Deslocamento inválido.');
      for (const { colecao, id } of c.alvos) {
        const item = existente(m, colecao, id);
        if (colecao === 'regions') item.polygon = item.polygon.map(([x, y]: Ponto) => [x + dx, y + dy]);
        else if (item.position) item.position = [item.position[0] + dx, item.position[1] + dy];
        else nao(`“${id}” não tem posição.`);
      }
      atualizarSalasDosObjetos(m);
      break;
    }
    default: { const _fim: never = c; nao(`Comando desconhecido: ${JSON.stringify(_fim)}`); }
  }
}

/**
 * Aplicação pura e atômica: devolve o documento novo (congelado, compartilhando o que não mudou) ou lança,
 * deixando o recebido intacto. O resultado inteiro é validado antes de ser aceito.
 */
export function aplicarComando(mapa: MapaAtlas, comando: Comando): MapaAtlas {
  const proximo = produzir(mapa, rascunho => aplicar(rascunho, comando));
  if (proximo === mapa) return mapa;
  try { validarMapa(proximo); } catch (erro) {
    if (erro instanceof ErroDeValidacao) throw new ErroDeComando(`O comando deixaria o mapa inválido — ${erro.message}`);
    throw erro;
  }
  return proximo;
}

export const ROTULOS: Record<Comando['tipo'], string> = {
  ...ROTULOS_CONSTRUIR,
  'mapa.renomear': 'Renomear mapa', 'mapa.notas': 'Editar notas', 'mapa.campanha': 'Ligar à campanha', 'grade.atualizar': 'Ajustar grade',
  'limites.atualizar': 'Redimensionar mapa', 'estilo.atualizar': 'Mudar estilo', 'clima.aplicar': 'Mudar clima', 'clima.predefinir': 'Aplicar clima', 'clima.salvar': 'Salvar clima', 'clima.esquecer': 'Esquecer clima', 'clima.audio': 'Som do clima', 'acabamento.atualizar': 'Ajustar acabamento',
  'fundo.atualizar': 'Ajustar fundo', 'memoria.atualizar': 'Ajustar memória', 'item.adicionar': 'Adicionar', 'item.atualizar': 'Editar',
  'item.remover': 'Remover', 'selecao.mover': 'Mover',
};

export type { NomeColecao };
