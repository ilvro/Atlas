import { abrirMapa, cacheDeSessoes, resumos, servicos, sessao, sincronizarPublicador, viewport } from './app.ts';
import { refDoMapa } from './campanha.ts';
import { modo } from './modo.ts';
import { mapaNoProjetorId, projetorConectado, projetorRemotoConectado } from './projetor.ts';
import { avisar } from './toasts.ts';
import type { TransicaoDeMapa } from '../domain/mapa.ts';
import { resolverChegada, transferirJogadoresParaMapa } from '../domain/transicao-mapa.ts';

/** Nome amigável do mapa de destino para botões e menus de transição. */
export function nomeDoMapaDestino(toMapId: string, fallbackLabel?: string): string {
  const aberta = cacheDeSessoes.get(toMapId)?.doc.value.name;
  if (aberta) return aberta;
  const resumo = resumos.value.find(r => r.id === toMapId);
  if (resumo?.nome) return resumo.nome;
  if (fallbackLabel?.trim()) return fallbackLabel.trim();
  return 'outro mapa';
}

export interface OpcoesViajarParaMapa {
  levarJogadores?: boolean;
  pecaId?: string;
}

/**
 * Executa a transição para o mapa de destino:
 * - transfere opcionalmente as peças dos jogadores (e suas lanternas) posicionando-as na entrada de chegada;
 * - abre ou alterna para a aba do mapa de destino preservando o modo Sessão;
 * - seleciona o andar de chegada e centraliza a câmera na entrada;
 * - atualiza o projetor (`mapaNoProjetorId`) e emite `atlas.cena-aberta`.
 */
export async function viajarParaMapa(
  transicao: TransicaoDeMapa,
  opcoes?: OpcoesViajarParaMapa,
): Promise<boolean> {
  const s = servicos.value;
  if (!s) return false;

  const sessaoOrigem = sessao.value;
  const mapaOrigemId = sessaoOrigem?.doc.value.id ?? null;
  const modoAnterior = modo.value;

  const sessaoDestinoCache = cacheDeSessoes.get(transicao.toMapId);
  let destino = sessaoDestinoCache?.doc.value ?? (await s.repo.obter(transicao.toMapId));
  if (!destino) {
    avisar('Mapa de destino não encontrado.', { tipo: 'erro' });
    return false;
  }

  let chegada = resolverChegada(destino, transicao);

  if (opcoes?.levarJogadores && sessaoOrigem) {
    const transf = transferirJogadoresParaMapa(sessaoOrigem.doc.value, destino, transicao, {
      ...(opcoes.pecaId ? { pecaId: opcoes.pecaId } : {}),
    });
    destino = transf.mapa;
    chegada = transf.chegada;

    if (sessaoDestinoCache) {
      sessaoDestinoCache.store.substituir(destino);
    }
    try {
      destino = await s.repo.salvar(destino, { forcar: true });
      if (sessaoDestinoCache) {
        sessaoDestinoCache.store.marcarSalvo(destino);
      }
    } catch {
      // Se falhar a persistência imediata no banco, a sessão em memória ainda mantém o estado atualizado
    }
  }

  const projetandoOrigem =
    (mapaOrigemId !== null && mapaNoProjetorId.value === mapaOrigemId)
    || projetorConectado.peek()
    || projetorRemotoConectado.peek();

  await abrirMapa(transicao.toMapId);

  if (modoAnterior === 'sessao') {
    modo.value = 'sessao';
  }

  const sessaoAtual = sessao.value;
  if (sessaoAtual && sessaoAtual.doc.value.id === transicao.toMapId) {
    const andarValido = chegada.levelId !== null && !sessaoAtual.doc.value.levels?.[chegada.levelId]
      ? null
      : chegada.levelId;
    sessaoAtual.andarAtivo.value = andarValido;
  }

  const [cx, cy] = chegada.posicao;
  viewport.atual?.focarEm({ x0: cx - 6, y0: cy - 4, x1: cx + 6, y1: cy + 4 });

  if (projetandoOrigem) {
    mapaNoProjetorId.value = transicao.toMapId;
    sincronizarPublicador();
  }

  try {
    s.barramento?.emitir('atlas.cena-aberta', { mapa: refDoMapa(destino) });
  } catch {
    // Ignora falha de barramento opcional
  }

  return true;
}
