import { novaLuz } from '../domain/fabrica.ts';
import { luzesDisponiveisParaPeca, type Recursos } from '../domain/fichas.ts';
import { direcaoDeVisaoDaPeca } from '../domain/nevoa.ts';
import { camposDoPreset, PRESETS_DE_LUZ, presetDeLuz, type PresetDeLuz } from '../domain/presets.ts';
import type { Store } from '../state/store.ts';

export const ROTULO_LUZ_PECA: Readonly<Record<string, string>> = {
  lanterna: 'Lanterna',
  lamparina: 'Lamparina',
  tocha: 'Tocha',
  vela: 'Vela',
};

/** Rótulo legível para o item/preset de luz portado pela peça. */
export function rotuloDaLuz(preset: string | null): string {
  if (!preset) return 'Luz';
  return ROTULO_LUZ_PECA[preset] ?? PRESETS_DE_LUZ.find(p => p.id === preset)?.nome ?? 'Luz';
}

function resolverPreset(id: string): PresetDeLuz {
  return presetDeLuz(id) ?? presetDeLuz('lanterna') ?? PRESETS_DE_LUZ[0]!;
}

/**
 * Liga, desliga ou troca a fonte de luz portada por uma peça.
 * Se a peça ainda não possui luz vinculada, cria uma usando o preset pedido ou o primeiro item de luz da ficha (padrão `'lanterna'`).
 */
export function alternarLuzDaPeca(
  store: Store,
  pecaId: string,
  opcoes?: { preset?: string | null; recursos?: Recursos | null },
): { ligada: boolean; preset: string | null } | null {
  const m = store.documento;
  const t = m.tokens[pecaId];
  if (!t) return null;

  const luzAtual = t.lightId ? m.lights[t.lightId] : undefined;
  const presetPedido = typeof opcoes?.preset === 'string' && opcoes.preset.length > 0 ? opcoes.preset : null;

  if (presetPedido && presetPedido !== luzAtual?.preset) {
    const presetObj = resolverPreset(presetPedido);
    const direcao = direcaoDeVisaoDaPeca(m, t);
    store.transacao(`Trocar luz da peça: ${rotuloDaLuz(presetObj.id)}`, g => {
      if (luzAtual) {
        g.aplicar({ tipo: 'item.remover', colecao: 'lights', id: luzAtual.id });
      }
      const nova = novaLuz([t.position[0], t.position[1]], {
        ...camposDoPreset(presetObj, direcao),
        on: true,
        ownerId: t.id,
        ...(t.levelId ? { levelId: t.levelId } : {}),
      });
      g.aplicar({ tipo: 'item.adicionar', colecao: 'lights', item: nova });
      g.aplicar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch: { lightId: nova.id } });
    });
    return { ligada: true, preset: presetObj.id };
  }

  if (luzAtual) {
    const novoEstado = !luzAtual.on;
    store.executar(
      { tipo: 'item.atualizar', colecao: 'lights', id: luzAtual.id, patch: { on: novoEstado } },
      { rotulo: novoEstado ? 'Acender luz da peça' : 'Apagar luz da peça' },
    );
    return { ligada: novoEstado, preset: luzAtual.preset };
  }

  const info = luzesDisponiveisParaPeca(m, t, opcoes?.recursos ?? null);
  const presetObj = resolverPreset(presetPedido ?? info.presets[0] ?? 'lanterna');
  const direcao = direcaoDeVisaoDaPeca(m, t);
  store.transacao('Acender luz da peça', g => {
    const nova = novaLuz([t.position[0], t.position[1]], {
      ...camposDoPreset(presetObj, direcao),
      on: true,
      ownerId: t.id,
      ...(t.levelId ? { levelId: t.levelId } : {}),
    });
    g.aplicar({ tipo: 'item.adicionar', colecao: 'lights', item: nova });
    g.aplicar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch: { lightId: nova.id } });
  });
  return { ligada: true, preset: presetObj.id };
}

/** Aponta o facho/visão da peça para `direcaoRad` (radianos) usando `peca.virar`. */
export function mirarLuzDaPeca(store: Store, pecaId: string, direcaoRad: number): boolean {
  if (!Number.isFinite(direcaoRad) || !store.documento.tokens[pecaId]) return false;
  try {
    store.executar(
      { tipo: 'peca.virar', id: pecaId, direcao: direcaoRad },
      { rotulo: 'Virar lanterna', fusao: `peca-virar:${pecaId}` },
    );
    return true;
  } catch {
    return false;
  }
}
