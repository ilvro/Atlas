import type { Barramento } from '#mesa';
import { presetDeClima } from '../domain/presets.ts';
import type { MapaAtlas, Regiao } from '../domain/mapa.ts';
import type { Ref } from '#mesa';

/**
 * Trocou o clima do mesmo mapa e o novo tem uma cena do Jukebox? Pede para tocá-la. Sem resposta no prazo, ou recusado,
 * nada acontece na tela (o Jukebox pode estar fechado). Devolve se o pedido foi feito.
 */
export function pedirSomDoClima(antes: Pick<MapaAtlas, 'id' | 'climate'>, depois: Pick<MapaAtlas, 'id' | 'climate' | 'climateAudio'>, barramento: Pick<Barramento, 'pedir'> | null | undefined): boolean {
  if (!barramento || antes.id !== depois.id || antes.climate.preset === depois.climate.preset) return false;
  const preset = depois.climate.preset, ref = depois.climateAudio[presetDeClima(preset)?.id ?? preset];
  if (!ref) return false;
  void barramento.pedir('jukebox.tocar', { ref }).catch(() => undefined);
  return true;
}

/** Pede ao Jukebox que toque uma cena. Sem resposta ou recusado, nada acontece na tela (o Jukebox pode estar fechado). */
export function pedirCena(barramento: Pick<Barramento, 'pedir'> | null | undefined, ref: Ref | null | undefined): boolean {
  if (!barramento || !ref) return false;
  void barramento.pedir('jukebox.tocar', { ref }).catch(() => undefined);
  return true;
}

/** Pede ao Jukebox que toque um efeito avulso uma vez. */
export function pedirEfeito(barramento: Pick<Barramento, 'pedir'> | null | undefined, ref: Ref | null | undefined): boolean {
  if (!barramento || !ref) return false;
  void barramento.pedir('jukebox.efeito', { ref }).catch(() => undefined);
  return true;
}

/** Abriu o mapa na sessão e ele tem uma cena sonora? Pede para tocá-la. */
export const pedirSomDoMapa = (mapa: Pick<MapaAtlas, 'audioCue'>, barramento: Pick<Barramento, 'pedir'> | null | undefined): boolean => pedirCena(barramento, mapa.audioCue);

/** A cena do Jukebox de uma região de áudio (a primeira referência do Jukebox), ou `null`. */
export const cenaDaRegiao = (r: Pick<Regiao, 'kind' | 'refs'>): Ref | null => (r.kind === 'audio' ? r.refs.find(x => x.app === 'jukebox') ?? null : null);

/** A cena de fundo do mapa agora: a do clima, se há; senão a do mapa. É a que volta quando se sai de uma região de áudio. */
export function cenaDeFundo(m: Pick<MapaAtlas, 'climate' | 'climateAudio' | 'audioCue'>): Ref | null {
  return m.climateAudio[presetDeClima(m.climate.preset)?.id ?? m.climate.preset] ?? m.audioCue;
}

/** O Ref de um efeito avulso do Jukebox (`mesa:jukebox/efeito/<titulo>`)? */
export const ehEfeitoDoJukebox = (ref: Ref | null | undefined): ref is Ref => !!ref && ref.app === 'jukebox' && ref.tipo === 'efeito';

/**
 * Toca o som de uma porta ou de um interagível: o efeito escolhido do Jukebox (`jukebox.efeito`) e, se ele não atende (fechado, efeito
 * ausente) ou nenhum foi escolhido, o som sintetizado. `sintetizado` roda no máximo uma vez. Devolve a promessa do pedido (para os testes).
 */
export function tocarSomEscolhido(barramento: Pick<Barramento, 'pedir'> | null | undefined, ref: Ref | null | undefined, sintetizado: () => void): Promise<'efeito' | 'sintetizado'> {
  if (!barramento || !ehEfeitoDoJukebox(ref)) { sintetizado(); return Promise.resolve('sintetizado'); }
  return barramento.pedir('jukebox.efeito', { ref }, { prazoMs: 400 }).then(r => { if (r.ok) return 'efeito' as const; sintetizado(); return 'sintetizado' as const; }, () => { sintetizado(); return 'sintetizado' as const; });
}
