import { signal } from '@preact/signals';
import { criarRef, mesmaRef, type Campanha, type Entidade, type Ref } from '#mesa';
import type { MapaAtlas } from '../domain/mapa.ts';
import type { Servicos } from './servicos.ts';
import { gerarMiniaturaDoMapa } from '../ui/previa.ts';

/** A campanha em que o mestre está trabalhando. Chave compartilhada com os outros aplicativos da mesa. */
export const CHAVE_CAMPANHA_ATIVA = 'mesa:campanha-ativa';

export const campanhaAtiva = signal<Campanha | null>(null);
export const campanhas = signal<Campanha[]>([]);

export const refDoMapa = (mapa: Pick<MapaAtlas, 'id'>): Ref => criarRef('atlas', 'mapa', mapa.id);
export const refDoComodo = (mapa: Pick<MapaAtlas, 'id'>, comodoId: string): Ref => criarRef('atlas', 'comodo', `${mapa.id}/${comodoId}`);

export async function carregarCampanhas(s: Servicos): Promise<void> {
  if (!s.campanhas) { campanhas.value = []; campanhaAtiva.value = null; return; }
  const lista = await s.campanhas.listarCampanhas();
  campanhas.value = lista;
  let id: string | null = null;
  try { id = localStorage.getItem(CHAVE_CAMPANHA_ATIVA); } catch { /* sem armazenamento */ }
  campanhaAtiva.value = lista.find(c => c.id === id) ?? null;
}

export function escolherCampanha(id: string | null): void {
  campanhaAtiva.value = campanhas.value.find(c => c.id === id) ?? null;
  try { if (id) localStorage.setItem(CHAVE_CAMPANHA_ATIVA, id); else localStorage.removeItem(CHAVE_CAMPANHA_ATIVA); } catch { /* ignora */ }
}

export async function criarCampanha(s: Servicos, nome: string): Promise<Campanha> {
  if (!s.campanhas) throw new Error('O banco da campanha não está disponível neste navegador.');
  const c = await s.campanhas.criarCampanha({ nome, sistema: 'ordem-paranormal', tema: null });
  campanhas.value = [c, ...campanhas.value];
  escolherCampanha(c.id);
  return c;
}

/** A entidade "lugar" que representa o mapa na campanha. Criada pelo Atlas, que é o dono dela. */
export async function entidadeDoMapa(s: Servicos, mapa: MapaAtlas): Promise<Entidade | undefined> {
  if (!s.campanhas || !mapa.campanhaId) return undefined;
  return s.campanhas.entidadeDaRef(mapa.campanhaId, refDoMapa(mapa));
}

/** Garante a entidade "lugar" do mapa e mantém o nome em dia. Falhas da plataforma nunca atrapalham o mapa. */
export async function sincronizarMapaComCampanha(
  s: Servicos,
  mapa: MapaAtlas,
  gerarRetrato: (m: MapaAtlas) => Promise<Blob | undefined> = gerarMiniaturaDoMapa
): Promise<void> {
  if (!s.campanhas || !mapa.campanhaId) return;
  try {
    if (!await s.campanhas.obterCampanha(mapa.campanhaId)) return;
    const existente = await entidadeDoMapa(s, mapa);
    const retrato = await gerarRetrato(mapa).catch(() => undefined);
    if (!existente) {
      await s.campanhas.criarEntidade({
        campanhaId: mapa.campanhaId,
        tipo: 'lugar',
        nome: mapa.name,
        refs: [refDoMapa(mapa)],
        ...(retrato ? { retrato } : {}),
      });
    } else if (existente.criadaPor === 'atlas') {
      const mudouNome = existente.nome !== mapa.name;
      const mudouRetrato = !!retrato;
      if (mudouNome || mudouRetrato) {
        await s.campanhas.salvarEntidade({
          ...existente,
          nome: mapa.name,
          ...(retrato ? { retrato } : (existente.retrato ? { retrato: existente.retrato } : {})),
        });
      }
    }
  } catch (erro) { console.warn('Atlas: não consegui sincronizar o mapa com a campanha', erro); }
}

/**
 * Tirar o mapa da galeria não apaga o lugar da campanha: o lugar existe no mundo do jogo, com ou sem mapa.
 * Só a referência do Atlas sai. Devolve o id da entidade, para o "Desfazer" poder religá-la.
 */
export async function desvincularMapa(s: Servicos, mapa: MapaAtlas): Promise<string | null> {
  try {
    const e = await entidadeDoMapa(s, mapa);
    if (!e || !s.campanhas) return null;
    await s.campanhas.salvarEntidade({ ...e, refs: e.refs.filter(r => !mesmaRef(r, refDoMapa(mapa))) });
    return e.id;
  } catch (erro) { console.warn('Atlas: não consegui desligar o mapa do lugar', erro); return null; }
}

export async function revincularMapa(s: Servicos, mapa: MapaAtlas, entidadeId: string | null): Promise<void> {
  try {
    const e = entidadeId && s.campanhas ? await s.campanhas.obterEntidade(entidadeId) : undefined;
    if (e && s.campanhas) await s.campanhas.salvarEntidade({ ...e, refs: [...e.refs.filter(r => !mesmaRef(r, refDoMapa(mapa))), refDoMapa(mapa)] });
    else await sincronizarMapaComCampanha(s, mapa);
  } catch (erro) { console.warn('Atlas: não consegui religar o mapa ao lugar', erro); }
}
