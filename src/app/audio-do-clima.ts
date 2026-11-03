import type { Barramento } from '#mesa';
import { presetDeClima } from '../domain/presets.ts';
import type { MapaAtlas } from '../domain/mapa.ts';

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
