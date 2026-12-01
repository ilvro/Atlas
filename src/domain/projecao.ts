import { mapaDoAndar } from './andares.ts';
import { podar } from './iniciativa.ts';
import type { MapaAtlas } from './mapa.ts';
import { celulasExploradas, pecaSempreVisivel, pontoVisivelAgora, RES_NEVOA, secretaOculta, type FiltroDeVisao } from './nevoa.ts';

/**
 * O que é do mestre e nunca vai para quem vê o mapa pelo projetor. Quem acrescentar um campo ao documento
 * que o jogador não deve ver precisa tratá-lo em `projetarParaJogadores` e listá-lo aqui.
 *
 * - `notes`, `comodosExtra` (leitura e notas dos cômodos), `campanhaId`
 * - `audioCue`, `climateAudio`, `customClimates` (o que toca e os climas guardados)
 * - regiões e presenças `gmOnly`; `payload` e `refs` de qualquer região
 * - portas secretas que ninguém revelou (a parede fica contínua)
 * - objetos ocultos para jogadores e as luzes que carregam
 * - peças que não são de jogador e estão fora do visível, com a luz que carregam e a vez na iniciativa
 * - a pista (`clue`) de um interagível que não foi revelado
 */
export const CAMPOS_DO_MESTRE = ['notes', 'comodosExtra', 'campanhaId', 'audioCue', 'climateAudio', 'customClimates', 'moments', 'regions.gmOnly', 'regions.payload', 'regions.refs', 'presence.gmOnly', 'openings.secret', 'props.oculto', 'tokens.foraDaVista', 'props.interaction.clue'] as const;

/** O mapa que os jogadores podem ver em um dado andar (`null` = térreo). Pura: não muda `m`. */
export function projetarParaJogadores(m: MapaAtlas, andar: string | null = null, filtro?: FiltroDeVisao | null): MapaAtlas {
  const escopo = mapaDoAndar(m, andar, true);
  const p = structuredClone(escopo);
  const res = escopo.session.explored?.res ?? RES_NEVOA;
  const exploradas = celulasExploradas(escopo);
  if (escopo.session.explored !== null || exploradas.length > 0) {
    p.session.explored = { res, cells: exploradas };
  } else {
    p.session.explored = null;
  }
  delete p.session.exploredLevels;

  delete p.terrain.submerged; // o que a água cobriu é histórico de edição, não vai à vista
  p.notes = ''; p.comodosExtra = {}; p.campanhaId = null; p.audioCue = null; p.climateAudio = {}; p.customClimates = {}; p.moments = {};
  for (const [id, r] of Object.entries(p.regions)) { if (r.gmOnly) delete p.regions[id]; else { r.payload = {}; r.refs = []; } }
  for (const [id, x] of Object.entries(p.presence)) if (x.gmOnly) delete p.presence[id];
  for (const [id, a] of Object.entries(p.openings)) if (secretaOculta(escopo, a)) delete p.openings[id];
  for (const [id, o] of Object.entries(p.props)) {
    if (o.oculto) {
      delete p.props[id];
      for (const [lid, l] of Object.entries(p.lights)) if (l.ownerId === id) delete p.lights[lid];
    }
  }

  // Quem os jogadores não veem agora não é enviado (nem a posição, nem a luz).
  for (const [id, t] of Object.entries(p.tokens)) {
    if (pecaSempreVisivel(t, filtro) || pontoVisivelAgora(escopo, t.position, t.size * escopo.grid.size * 0.35, filtro)) continue;
    delete p.tokens[id];
    for (const [lid, l] of Object.entries(p.lights)) if (l.ownerId === id || lid === t.lightId) delete p.lights[lid];
  }
  p.session.initiative = podar(p.session.initiative, id => !!p.tokens[id]);

  const revelados = new Set(escopo.session.revealed);
  for (const o of Object.values(p.props)) {
    if (!o.interaction) continue;
    if (o.interaction.targets.length) {
      o.interaction.targets = o.interaction.targets.filter(lid => !!p.lights[lid]);
    }
    if (!revelados.has(o.id)) o.interaction.clue = null;
    if (o.interaction.gmOnly) {
      delete o.interaction.note;
      delete o.interaction.noteTitle;
      o.interaction.clue = null;
    }
  }
  p.session.revealed = p.session.revealed.filter(id => ['rooms', 'openings', 'props', 'tokens', 'regions'].some(c => (p as unknown as Record<string, Record<string, unknown>>)[c]![id]));
  return p;
}
