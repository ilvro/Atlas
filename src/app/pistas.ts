import { signal } from '@preact/signals';
import { mesmaRef, type Entidade } from '#mesa';
import { novoObjeto } from '../domain/fabrica.ts';
import { comodoEm } from '../domain/geometria.ts';
import type { MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { centroDaCelula } from '../domain/movimento.ts';
import { escutarPistas, idDaPista, listarPistas, refDaPista, type Pista } from '../data/pistas.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { campanhaAtiva, refDoComodo } from './campanha.ts';
import type { Servicos } from './servicos.ts';
import type { SessaoDeEdicao } from './sessao.ts';

/** Um documento da campanha: a entidade e, se o Ateliê já o entregou ao Atlas, o resumo do banco de troca. */
export interface DocumentoDaCampanha { entidade: Entidade; idDoDocumento: string; pista: Pista | null }

/** As entidades da campanha que apontam para um documento do Ateliê, cruzadas com as pistas entregues. Ordem: nome (pt-BR, sem acento atrapalhar). Uma entidade com dois Refs de documento vale pelo primeiro. Duas entidades do mesmo documento: fica a primeira. */
export function documentosDaCampanha(entidades: readonly Entidade[], entregues: readonly Pista[]): DocumentoDaCampanha[] {
  const porId = new Map<string, Pista>(entregues.map(p => [p.id, p]));
  const vistos = new Set<string>();
  const docs: DocumentoDaCampanha[] = [];

  for (const entidade of entidades) {
    let idDoDocumento: string | null = null;
    for (const ref of entidade.refs) {
      const id = idDaPista(ref);
      if (id) {
        idDoDocumento = id;
        break;
      }
    }
    if (!idDoDocumento || vistos.has(idDoDocumento)) continue;
    vistos.add(idDoDocumento);
    docs.push({
      entidade,
      idDoDocumento,
      pista: porId.get(idDoDocumento) ?? null,
    });
  }

  return docs.sort((a, b) => (
    a.entidade.nome.localeCompare(b.entidade.nome, 'pt-BR', { sensitivity: 'base' }) ||
    a.entidade.nome.localeCompare(b.entidade.nome, 'pt-BR') ||
    a.entidade.id.localeCompare(b.entidade.id)
  ));
}

/** Os ids de documento que já são da campanha (para o selo "Na campanha" na aba Todos). */
export function idsNaCampanha(docs: readonly DocumentoDaCampanha[]): Set<string> {
  return new Set(docs.map(d => d.idDoDocumento));
}

/** Os documentos que o Ateliê entregou neste navegador (lidos do banco de troca; o Atlas nunca escreve ali). */
export const pistas = signal<Pista[]>([]);
/** Já olhou o banco ao menos uma vez? (Sem isso, “documento não encontrado” apareceria antes da hora.) */
export const pistasCarregadas = signal(false);

/** Os documentos da campanha ativa (recarregados ao trocar de campanha, ao acrescentar e quando o Ateliê avisa). */
export const documentosDaCampanhaAtiva = signal<DocumentoDaCampanha[]>([]);

let ultimasEntidades: Entidade[] = [];

export async function recarregarPistas(): Promise<void> {
  pistas.value = await listarPistas();
  pistasCarregadas.value = true;
  documentosDaCampanhaAtiva.value = documentosDaCampanha(ultimasEntidades, pistas.peek());
}

export async function recarregarDocumentosDaCampanha(servicos: Servicos | null): Promise<void> {
  const c = campanhaAtiva.peek();
  if (!c || !servicos?.campanhas) {
    ultimasEntidades = [];
    documentosDaCampanhaAtiva.value = [];
    return;
  }
  try {
    ultimasEntidades = await servicos.campanhas.listarEntidades(c.id);
    documentosDaCampanhaAtiva.value = documentosDaCampanha(ultimasEntidades, pistas.peek());
  } catch (erro) {
    console.warn('Atlas: não consegui listar os documentos da campanha', erro);
    ultimasEntidades = [];
    documentosDaCampanhaAtiva.value = [];
  }
}

/** Começa a acompanhar o Ateliê: lê o banco agora e de novo a cada aviso do canal. Devolve o cancelamento. */
export function iniciarPistas(): () => void { void recarregarPistas(); return escutarPistas(() => void recarregarPistas()); }

/**
 * Põe uma pista no mapa: um objeto "papéis soltos" com a interação `clue` apontando para o documento do Ateliê (`mesa:atelie/documento/<id>`).
 * Se há campanha, registra a ligação `esta-em` (pista → cômodo) no banco da campanha.
 */
export function adicionarPista(s: SessaoDeEdicao, p: Pista, servicos: Servicos | null, onde?: Ponto): Objeto {
  const m = s.store.documento, pos = (m.grid.snap === false && onde) ? onde : centroDaCelula(m, onde ?? [m.bounds.width / 2, m.bounds.height / 2]), ref = refDaPista(p.id);
  const objeto = novoObjeto(pos, {
    source: ACERVO.fonte('papeis', Math.floor(Math.random() * 2 ** 31)), roomId: comodoEm(m, pos), blocks: { move: false, sight: false }, castsShadow: false,
    interaction: { kind: 'clue', on: false, targets: [], sound: null, clue: ref },
  });
  s.store.executar({ tipo: 'item.adicionar', colecao: 'props', item: objeto as never }, { rotulo: `Pôr a pista “${p.name}”` });
  s.selecao.value = [{ colecao: 'props', id: objeto.id }];
  void ligarPistaAoComodo(m, objeto, servicos);
  return objeto;
}

/** `esta-em`: o documento (pista) está no cômodo. Falhas da plataforma nunca atrapalham o mapa. */
async function ligarPistaAoComodo(m: MapaAtlas, o: Objeto, servicos: Servicos | null): Promise<void> {
  const campanhaId = m.campanhaId ?? campanhaAtiva.peek()?.id, ref = o.interaction?.clue;
  if (!servicos?.campanhas || !campanhaId || !ref || !o.roomId) return;
  try {
    const para = refDoComodo(m, o.roomId), ja = (await servicos.campanhas.listarLigacoes(campanhaId, ref)).some(l => l.tipo === 'esta-em' && mesmaRef(l.para, para));
    if (!ja) await servicos.campanhas.ligar({ campanhaId, de: ref, para, tipo: 'esta-em' });
  } catch (erro) { console.warn('Atlas: não consegui ligar a pista ao cômodo', erro); }
}
