import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { chaveDaRef, type Entidade, type Ref } from '#mesa';
import { servicos } from '../app/app.ts';
import { pedirCena, pedirEfeito } from '../app/audio-do-clima.ts';
import { campanhaAtiva } from '../app/campanha.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { Linha } from './campos.tsx';

const semAcento = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const refDoJukebox = (e: Entidade): Ref => e.refs.find(r => r.app === 'jukebox')!;

/** As cenas sonoras do Jukebox que a campanha conhece (entidades `cena` com um Ref do Jukebox). */
export const cenasDoJukebox = (lista: readonly Entidade[], tipo: 'cena' | 'efeito' = 'cena'): Entidade[] => lista.filter(e => e.tipo === tipo && e.refs.some(r => r.app === 'jukebox'));

/**
 * Escolhe uma cena do Jukebox entre as da campanha: busca (quando são muitas), "Ouvir" (pede `jukebox.tocar`) e "Nenhuma". Serve ao som do mapa,
 * ao de cada clima e ao de uma região de áudio.
 */
export function EscolherCena({ s, rotulo, dica, valor, aoEscolher, id, tipo = 'cena' }: { s: SessaoDeEdicao; rotulo: string; dica: string; valor: Ref | null; aoEscolher: (ref: Ref | null) => void; id: string; /** `efeito`: os efeitos avulsos do Jukebox (faixas `sfx`) em vez das cenas. */ tipo?: 'cena' | 'efeito' }) {
  const cenas = useSignal<Entidade[]>([]), busca = useSignal(''), campanhaId = s.doc.value.campanhaId ?? campanhaAtiva.value?.id ?? null;
  useEffect(() => {
    let vivo = true; cenas.value = [];
    const repo = servicos.value?.campanhas;
    if (repo && campanhaId) void repo.listarEntidades(campanhaId).then(l => { if (vivo) cenas.value = cenasDoJukebox(l, tipo); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [campanhaId, tipo]);
  if (!campanhaId) return <p class="dica">{rotulo} vem do Jukebox da campanha: ligue este mapa a uma campanha para escolher.</p>;
  const filtro = semAcento(busca.value.trim()), visiveis = cenas.value.filter(e => !filtro || semAcento(e.nome).includes(filtro));
  const opcoes: (readonly [string, string])[] = [['', 'Nenhuma'], ...visiveis.map(e => [chaveDaRef(refDoJukebox(e)), e.nome] as const)];
  if (valor && !opcoes.some(([k]) => k === chaveDaRef(valor))) opcoes.push([chaveDaRef(valor), cenas.value.find(e => chaveDaRef(refDoJukebox(e)) === chaveDaRef(valor))?.nome ?? `Outra (${valor.id})`]);
  const escolher = (k: string) => aoEscolher(k ? cenas.value.map(refDoJukebox).find(r => chaveDaRef(r) === k) ?? valor : null);
  return (<>
    {cenas.value.length > 8 && <Linha rotulo="Buscar cena"><input type="search" data-testid={`${id}-busca`} value={busca.value} placeholder="nome da cena…" onInput={e => { busca.value = (e.target as HTMLInputElement).value; }} /></Linha>}
    <Linha rotulo={rotulo} dica={dica}>
      <select data-testid={id} value={valor ? chaveDaRef(valor) : ''} onChange={e => escolher((e.target as HTMLSelectElement).value)}>{opcoes.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select>
      <button type="button" class="botao-pilula" disabled={!valor} data-testid={`${id}-ouvir`} title={tipo === 'efeito' ? 'Pede ao Jukebox que toque este efeito' : 'Pede ao Jukebox que toque esta cena'} onClick={() => (tipo === 'efeito' ? pedirEfeito : pedirCena)(servicos.peek()?.barramento, valor)}>Ouvir</button>
    </Linha>
    {cenas.value.length === 0 && <p class="dica">{tipo === 'efeito' ? 'A campanha ainda não tem efeitos do Jukebox (abra o Jukebox com esta campanha ativa e carregue faixas com o gênero sfx).' : 'A campanha ainda não tem cenas do Jukebox (abra o Jukebox com esta campanha ativa).'}</p>}
  </>);
}
