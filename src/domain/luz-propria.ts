import { receitaDe } from '../procedural/receitas/index.ts';
import type { Luz, MapaAtlas, Objeto } from './mapa.ts';
import { novaLuz } from './fabrica.ts';
import { desvincularLuz } from './geometria.ts';

export { desvincularLuz };

function hashCurto(texto: string): string {
  let h1 = 2166136261;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ (c + i), 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/** O id da luz que um objeto traz consigo: derivado do dono, para valer igual em qualquer cópia do mapa e no desfazer. */
export const idDaLuzPropria = (objetoId: string): string =>
  objetoId.length <= 61 ? `lp-${objetoId}` : `lp-${hashCurto(objetoId)}`;

/** A luz que o objeto deveria ter agora (pela receita e pelos parâmetros), ou `null`. Não mexe no mapa. */
export function luzDoObjeto(o: Objeto): Luz | null {
  if (o.source.kind !== 'recipe') return null;
  const pedido = receitaDe(o.source.recipe)?.luz?.(o.source.params ?? {});
  if (!pedido) return null;
  const raio = Math.max(0.1, Math.min(200, pedido.raio * o.scale));
  return novaLuz([o.position[0], o.position[1]], {
    id: idDaLuzPropria(o.id), ownerId: o.id, radius: raio, color: pedido.cor, intensity: pedido.intensidade, flicker: pedido.flicker ?? 0.05,
    power: pedido.power ?? 'magic', preset: pedido.preset ?? null,
    ...(o.levelId != null ? { levelId: o.levelId } : {}),
  });
}

/**
 * Faz as luzes próprias do mapa baterem com os objetos: cria a de quem passou a brilhar, atualiza posição, andar, raio e cor da de quem
 * mudou, e tira a de quem parou de brilhar. Só mexe nas luzes de id `lp-…`; o interruptor (`on`) que o mestre mexeu fica como está.
 * Chamada depois de cada comando e pelos scripts que montam mapas direto. Devolve se algo mudou.
 */
export function sincronizarLuzesProprias(m: MapaAtlas): boolean {
  let mudou = false;
  const querida = new Set<string>();
  for (const o of Object.values(m.props)) {
    const alvo = luzDoObjeto(o); if (!alvo) continue;
    querida.add(alvo.id);
    const atual = m.lights[alvo.id];
    if (!atual) { m.lights[alvo.id] = alvo; mudou = true; continue; }
    const igual = atual.position[0] === alvo.position[0] && atual.position[1] === alvo.position[1] && atual.radius === alvo.radius && atual.color === alvo.color
      && atual.intensity === alvo.intensity && atual.flicker === alvo.flicker && atual.power === alvo.power && atual.preset === alvo.preset && (atual.levelId ?? null) === (alvo.levelId ?? null) && atual.ownerId === o.id;
    if (igual) continue;
    atual.position = alvo.position; atual.radius = alvo.radius; atual.color = alvo.color; atual.intensity = alvo.intensity; atual.flicker = alvo.flicker; atual.power = alvo.power; atual.preset = alvo.preset;
    atual.ownerId = o.id;
    if (alvo.levelId != null) atual.levelId = alvo.levelId; else delete atual.levelId;
    mudou = true;
  }
  for (const id of Object.keys(m.lights)) {
    if (id.startsWith('lp-') && !querida.has(id)) {
      delete m.lights[id];
      desvincularLuz(m, id);
      mudou = true;
    }
  }
  return mudou;
}
