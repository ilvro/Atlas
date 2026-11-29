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

export const ALCANCE_MIN_LUZ_PECA = 1;
export const ALCANCE_MAX_LUZ_PECA = 40;
const COR_HEX = /^#[0-9a-f]{6}$/i;

/**
 * Ajusta o alcance (m, entre 1 e 40) e/ou a cor (`#rrggbb`) da luz portada pela peça.
 * Edições seguidas da mesma luz se fundem num passo só do histórico (arrastar o controle não enche o Ctrl+Z).
 */
export function atualizarLuzDaPeca(store: Store, pecaId: string, patch: { radius?: number; color?: string }): boolean {
  const t = store.documento.tokens[pecaId];
  const luz = t?.lightId ? store.documento.lights[t.lightId] : undefined;
  if (!luz) return false;
  const campos: { radius?: number; color?: string } = {};
  if (patch.radius !== undefined) {
    if (!Number.isFinite(patch.radius)) return false;
    campos.radius = Math.min(ALCANCE_MAX_LUZ_PECA, Math.max(ALCANCE_MIN_LUZ_PECA, patch.radius));
  }
  if (patch.color !== undefined) {
    if (!COR_HEX.test(patch.color)) return false;
    campos.color = patch.color.toLowerCase();
  }
  if (campos.radius === undefined && campos.color === undefined) return false;
  store.executar(
    { tipo: 'item.atualizar', colecao: 'lights', id: luz.id, patch: campos },
    { rotulo: 'Ajustar luz da peça', fusao: `luz-peca:${luz.id}` },
  );
  return true;
}

/** Devolve o alcance e a cor da luz da peça aos valores do preset de origem. */
export function restaurarPadraoLuzDaPeca(store: Store, pecaId: string): boolean {
  const t = store.documento.tokens[pecaId];
  const luz = t?.lightId ? store.documento.lights[t.lightId] : undefined;
  const preset = luz?.preset ? presetDeLuz(luz.preset) : undefined;
  if (!luz || !preset) return false;
  store.executar(
    { tipo: 'item.atualizar', colecao: 'lights', id: luz.id, patch: { radius: preset.radius, color: preset.color } },
    { rotulo: 'Restaurar luz da peça' },
  );
  return true;
}
