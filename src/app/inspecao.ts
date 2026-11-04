import { signal } from '@preact/signals';
import { criarRef, type Ref } from '#mesa';
import { idDaPista, lerAssado, refDaPista, type Pista } from '../data/pistas.ts';
import { avisar } from './toasts.ts';
import { pistas, recarregarPistas } from './pistas.ts';

/** O documento aberto na inspeção do mestre, com os dois assados já decodificados. */
export interface DocumentoAberto { pista: Pista; objetoId: string | null; normal: ImageBitmap; uv: ImageBitmap | null; blobNormal: Blob; blobUv: Blob | null }
export const inspecao = signal<DocumentoAberto | null>(null);
/** O mestre mostrou a inspeção aos jogadores (o projetor a está exibindo). */
export const mostrandoAosJogadores = signal(false);

/** Abre a inspeção de uma pista pelo Ref do documento do Ateliê. Sem documento no banco, avisa e não abre nada. */
export async function abrirInspecao(ref: Ref | null | undefined, objetoId: string | null = null): Promise<boolean> {
  const id = idDaPista(ref); if (!id) { avisar('Esta pista ainda não aponta para um documento.', { duracao: 2200 }); return false; }
  let pista = pistas.peek().find(p => p.id === id);
  if (!pista) { await recarregarPistas(); pista = pistas.peek().find(p => p.id === id); }
  const normal = pista ? await lerAssado(id, 'normal') : undefined;
  if (!pista || !normal) { avisar('Documento não encontrado no banco do Ateliê.', { tipo: 'erro', duracao: 3000 }); return false; }
  const uv = pista.hasUv ? await lerAssado(id, 'uv') : undefined;
  const [bn, bu] = await Promise.all([createImageBitmap(normal.blob), uv ? createImageBitmap(uv.blob) : Promise.resolve(null)]);
  soltar(inspecao.value);
  inspecao.value = { pista, objetoId, normal: bn, uv: bu, blobNormal: normal.blob, blobUv: uv?.blob ?? null };
  mostrandoAosJogadores.value = false;
  return true;
}

export function fecharInspecao(): void {
  const atual = inspecao.value; if (!atual) return;
  inspecao.value = null; soltar(atual);
}

/** Solta as imagens um instante depois: o visor ainda pode desenhar um último quadro antes de sair da tela. */
function soltar(d: DocumentoAberto | null): void { if (d) setTimeout(() => { d.normal.close(); d.uv?.close(); }, 400); }

/** O Ref do objeto-pista no mapa, para o `atlas.revelado`. */
export const refDoObjeto = (mapaId: string, objetoId: string): Ref => criarRef('atlas', 'objeto', `${mapaId}/${objetoId}`);

/** Abre o documento no Ateliê: pede `atelie.abrir` pelo barramento e, sem resposta, abre o endereço do Ateliê que gerou o documento. */
export async function editarNoAtelie(pista: Pista, barramento: { pedir(tipo: string, dados: unknown): Promise<{ ok: boolean }> } | null | undefined): Promise<'aberto' | 'aba' | 'falhou'> {
  const r = barramento ? await barramento.pedir('atelie.abrir', { ref: refDaPista(pista.id) }).catch(() => null) : null;
  if (r?.ok) return 'aberto';
  if (pista.source) { try { window.open(new URL(`?handout=${encodeURIComponent(pista.id)}`, pista.source).href, '_blank'); return 'aba'; } catch { /* endereço inválido */ } }
  avisar('O Ateliê não respondeu e o documento não diz de onde veio.', { tipo: 'erro', duracao: 3200 });
  return 'falhou';
}
