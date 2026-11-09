import { ehRef, type Ref } from '#mesa';
import { HEX, IDENT } from './esquema.ts';
import { EVENTOS_DE_CENA, ROTULO_DO_EVENTO, type EventoDeCena } from './eventos-de-cena.ts';
import type { MapaAtlas } from './mapa.ts';

export type EfeitoDeCena = EventoDeCena | 'relampago';

export type AlvoDeCamera = { colecao: 'rooms' | 'regions' | 'tokens'; id: string };

export type PassoDeMomento =
  | { tipo: 'esperar'; ms: number }                                   // 100..120000
  | { tipo: 'som'; ref: Ref }                                         // jukebox cena-sonora ou efeito
  | { tipo: 'efeito'; efeito: EfeitoDeCena }
  | { tipo: 'clima'; clima: string }                                  // id de predefinição ou de customClimates
  | { tipo: 'tela'; acao: 'escurecer' | 'clarear'; ms: number }      // fade da cortina preta no projetor, 0..10000
  | { tipo: 'letreiro'; titulo: string; subtitulo: string; peca: string | null; estilo: 'apresentacao' | 'capitulo'; ms: number } // ms 1000..20000
  | { tipo: 'camera'; alvo: AlvoDeCamera }
  | { tipo: 'revelar'; ids: string[] }                                // ids de cômodos (comando sessao.revelar)
  | { tipo: 'interagir'; id: string }                                 // porta/interagível (comando interagir)
  | { tipo: 'pista'; ref: Ref; mostrar: boolean }                     // documento do Ateliê; mostrar = já projeta
  | { tipo: 'nota'; texto: string };                                  // aviso só para o mestre, ≤ 400

export interface Momento {
  id: string;
  nome: string;
  cor: string | null;
  passos: PassoDeMomento[];
}

export function novoMomento(id: string, nome: string): Momento {
  return { id, nome, cor: null, passos: [] };
}

/**
 * Duração estimada de um momento: soma das esperas, mais o fim do último letreiro ou corte de tela
 * a partir do instante em que foi disparado.
 */
export function duracaoEstimada(m: Momento): number {
  let tempoAtual = 0;
  let fim = 0;
  for (const p of m.passos) {
    if (p.tipo === 'esperar') {
      tempoAtual += p.ms;
      fim = Math.max(fim, tempoAtual);
    } else if (p.tipo === 'letreiro' || p.tipo === 'tela') {
      fim = Math.max(fim, tempoAtual + p.ms);
    }
  }
  return fim;
}

/**
 * Resumo descritivo de um passo em português para a interface,
 * apontando quando o alvo no mapa não existe mais.
 */
export function descreverPasso(p: PassoDeMomento, mapa?: MapaAtlas): string {
  switch (p.tipo) {
    case 'esperar': {
      const s = (p.ms / 1000).toString().replace('.', ',');
      return `Esperar ${s} s`;
    }
    case 'som':
      return `Som: ${p.ref.id}`;
    case 'efeito': {
      const nome = p.efeito === 'relampago' ? 'Relâmpago' : (ROTULO_DO_EVENTO[p.efeito] ?? p.efeito);
      return `Efeito: ${nome}`;
    }
    case 'clima': {
      const nome = mapa?.customClimates[p.clima]?.name ?? p.clima;
      return `Clima: ${nome}`;
    }
    case 'tela': {
      const s = (p.ms / 1000).toString().replace('.', ',');
      return p.acao === 'escurecer' ? `Tela: Escurecer (${s} s)` : `Tela: Clarear (${s} s)`;
    }
    case 'letreiro': {
      if (p.titulo.trim()) return `Letreiro: ${p.titulo.trim()}`;
      if (p.peca) {
        if (mapa) {
          const t = mapa.tokens[p.peca];
          return `Letreiro: ${t ? t.name : '(sumiu)'}`;
        }
        return `Letreiro: ${p.peca}`;
      }
      return 'Letreiro';
    }
    case 'camera': {
      if (!mapa) return `Câmera: ${p.alvo.id}`;
      if (p.alvo.colecao === 'rooms') {
        const r = mapa.rooms[p.alvo.id];
        return r ? `Câmera: ${r.name}` : 'Câmera: (sumiu)';
      }
      if (p.alvo.colecao === 'tokens') {
        const t = mapa.tokens[p.alvo.id];
        return t ? `Câmera: ${t.name}` : 'Câmera: (sumiu)';
      }
      if (p.alvo.colecao === 'regions') {
        const reg = mapa.regions[p.alvo.id];
        return reg ? `Câmera: Região ${p.alvo.id}` : 'Câmera: (sumiu)';
      }
      return 'Câmera: (sumiu)';
    }
    case 'revelar': {
      if (!mapa) return `Revelar: ${p.ids.join(', ') || 'nenhum'}`;
      const nomes = p.ids.map(id => {
        if (mapa.rooms[id]) return mapa.rooms[id].name;
        if (mapa.openings[id]) return 'Porta';
        return '(sumiu)';
      });
      return `Revelar: ${nomes.join(', ') || 'nenhum'}`;
    }
    case 'interagir': {
      if (!mapa) return `Interagir: ${p.id}`;
      const o = mapa.props[p.id];
      if (o) {
        const nome = o.source.kind === 'recipe' ? o.source.recipe : 'Objeto';
        return `Interagir: ${nome}`;
      }
      if (mapa.openings[p.id]) {
        return 'Interagir: Porta';
      }
      return 'Interagir: (sumiu)';
    }
    case 'pista':
      return `Pista: ${p.ref.id}`;
    case 'nota': {
      const texto = p.texto.length > 30 ? p.texto.slice(0, 30) + '…' : p.texto;
      return `Nota: ${texto}`;
    }
  }
}

/** Valida um único passo de momento. Devolve a mensagem do primeiro erro ou null se válido. */
export function passoValido(p: unknown): string | null {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Passo inválido.';
  const passo = p as Record<string, any>;
  switch (passo.tipo) {
    case 'esperar': {
      if (typeof passo.ms !== 'number' || !Number.isFinite(passo.ms) || passo.ms < 100 || passo.ms > 120_000) {
        return 'Tempo de espera deve ser entre 100 ms e 120.000 ms.';
      }
      return null;
    }
    case 'som': {
      if (!passo.ref || typeof passo.ref !== 'object' || !ehRef(passo.ref)) {
        return 'O som deve ser uma referência da mesa.';
      }
      if (passo.ref.app !== 'jukebox' || (passo.ref.tipo !== 'cena-sonora' && passo.ref.tipo !== 'efeito')) {
        return 'O som deve ser uma referência a cena sonora ou efeito do Jukebox.';
      }
      return null;
    }
    case 'efeito': {
      if (passo.efeito !== 'relampago' && !EVENTOS_DE_CENA.includes(passo.efeito)) {
        return 'Efeito de cena desconhecido.';
      }
      return null;
    }
    case 'clima': {
      if (typeof passo.clima !== 'string' || !passo.clima.trim() || passo.clima.length > 60) {
        return 'Identificador de clima inválido.';
      }
      return null;
    }
    case 'tela': {
      if (passo.acao !== 'escurecer' && passo.acao !== 'clarear') {
        return 'Ação de tela deve ser "escurecer" ou "clarear".';
      }
      if (typeof passo.ms !== 'number' || !Number.isFinite(passo.ms) || passo.ms < 0 || passo.ms > 10_000) {
        return 'Duração da tela deve ser entre 0 e 10.000 ms.';
      }
      return null;
    }
    case 'letreiro': {
      if (typeof passo.titulo !== 'string' || !passo.titulo.trim()) {
        return 'O letreiro precisa de um título.';
      }
      if (passo.titulo.length > 120) {
        return 'Título do letreiro longo demais (máximo 120 caracteres).';
      }
      if (typeof passo.subtitulo !== 'string' || passo.subtitulo.length > 200) {
        return 'Subtítulo do letreiro longo demais (máximo 200 caracteres).';
      }
      if (passo.peca !== null && (typeof passo.peca !== 'string' || !passo.peca.trim() || passo.peca.length > 64)) {
        return 'Identificador de peça do letreiro inválido.';
      }
      if (passo.estilo !== 'apresentacao' && passo.estilo !== 'capitulo') {
        return 'Estilo de letreiro deve ser "apresentacao" ou "capitulo".';
      }
      if (typeof passo.ms !== 'number' || !Number.isFinite(passo.ms) || passo.ms < 1_000 || passo.ms > 20_000) {
        return 'Duração do letreiro deve ser entre 1.000 e 20.000 ms.';
      }
      return null;
    }
    case 'camera': {
      if (!passo.alvo || typeof passo.alvo !== 'object') {
        return 'Alvo de câmera inválido.';
      }
      if (!['rooms', 'regions', 'tokens'].includes(passo.alvo.colecao)) {
        return 'Coleção de câmera inválida.';
      }
      if (typeof passo.alvo.id !== 'string' || !passo.alvo.id.trim() || passo.alvo.id.length > 64) {
        return 'Identificador de alvo de câmera inválido.';
      }
      return null;
    }
    case 'revelar': {
      if (!Array.isArray(passo.ids)) {
        return 'Lista de identificadores para revelar inválida.';
      }
      if (passo.ids.length > 100) {
        return 'Muitos cômodos para revelar (máximo 100).';
      }
      if (!passo.ids.every((id: unknown) => typeof id === 'string' && id.trim().length > 0 && id.length <= 64)) {
        return 'Identificador inválido na lista de revelação.';
      }
      return null;
    }
    case 'interagir': {
      if (typeof passo.id !== 'string' || !passo.id.trim() || passo.id.length > 64) {
        return 'Identificador do alvo de interação inválido.';
      }
      return null;
    }
    case 'pista': {
      if (!passo.ref || typeof passo.ref !== 'object' || !ehRef(passo.ref)) {
        return 'A pista deve ser uma referência da mesa.';
      }
      if (passo.ref.app !== 'atelie' || passo.ref.tipo !== 'documento') {
        return 'A pista deve ser uma referência a documento do Ateliê.';
      }
      if (typeof passo.mostrar !== 'boolean') {
        return 'Campo "mostrar" da pista deve ser booleano.';
      }
      return null;
    }
    case 'nota': {
      if (typeof passo.texto !== 'string' || passo.texto.length > 400) {
        return 'Texto da nota inválido (máximo 400 caracteres).';
      }
      return null;
    }
    default:
      return `Tipo de passo desconhecido: "${passo.tipo}".`;
  }
}

/** Valida um momento completo. Devolve a mensagem do primeiro erro ou null se válido. */
export function momentoValido(m: unknown): string | null {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'Momento deve ser um objeto.';
  const momento = m as Record<string, any>;
  if (typeof momento.id !== 'string' || !IDENT.test(momento.id)) {
    return 'Identificador do momento inválido.';
  }
  if (typeof momento.nome !== 'string' || !momento.nome.trim() || momento.nome.length > 60) {
    return 'Nome do momento inválido (1 a 60 caracteres).';
  }
  if (momento.cor !== null && (typeof momento.cor !== 'string' || !HEX.test(momento.cor))) {
    return 'Cor do momento deve ser hexadecimal (#rrggbb) ou nula.';
  }
  if (!Array.isArray(momento.passos)) {
    return 'Passos do momento devem ser uma lista.';
  }
  if (momento.passos.length > 60) {
    return 'Momento pode ter no máximo 60 passos.';
  }
  for (let i = 0; i < momento.passos.length; i++) {
    const erro = passoValido(momento.passos[i]);
    if (erro) return `Passo ${i + 1}: ${erro}`;
  }
  return null;
}
