import { novoIdEntidade } from '../domain/fabrica.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { generoDe } from '../domain/presets.ts';
import type { Comando } from '../state/comandos.ts';
import { aplicarEmCopia, type Construcao, type GeradorDeId } from './construcao.ts';
import { propostaDeLuzes } from './luzes.ts';
import { propostaDeMobilia } from './mobiliar.ts';
import { regrasPara } from './regras-mobilia.ts';
import type { Contexto } from './sugestoes.ts';

export interface PedidoDeMobiliarLote {
  comodos: readonly string[];
  luzes?: boolean;
  semente?: number;
  gerarId?: GeradorDeId;
}

export interface RelatorioDoComodo {
  id: string;
  nome: string;
  objetos: number;
  luzes: number;
  motivo?: string;
}

/** Formata o relatório de `mobiliarLote` em texto ("Casa Falk · sala: 9 objetos, 1 luz"). */
export function formatarRelatorioDeMobilia(relatorio: readonly RelatorioDoComodo[]): string {
  return relatorio.map(r => {
    if (!r.objetos && !r.luzes && r.motivo) return `${r.nome}: ${r.motivo}`;
    const obj = `${r.objetos} ${r.objetos === 1 ? 'objeto' : 'objetos'}`;
    const luz = `${r.luzes} ${r.luzes === 1 ? 'luz' : 'luzes'}`;
    return `${r.nome}: ${obj}, ${luz}${r.motivo ? ` (${r.motivo})` : ''}`;
  }).join('; ');
}

/**
 * Mobília e ilumina uma lista de cômodos em lote com o mesmo gerador da interface (`propostaDeMobilia` e `propostaDeLuzes`),
 * encadeando cada cômodo numa cópia do mapa para que o seguinte veja o anterior. Ids inexistentes ou cômodos sem proposta
 * não derrubam o lote: entram no `relatorio` com `motivo`.
 */
export function mobiliarLote(
  m: MapaAtlas,
  pedido: PedidoDeMobiliarLote,
): Construcao & { relatorio: RelatorioDoComodo[] } {
  const sementeBase = Math.floor(pedido.semente ?? 1) || 1;
  const gerarId = pedido.gerarId ?? novoIdEntidade;
  const genero = generoDe(m.style.genre).id;
  let atual = m;
  const comandos: Comando[] = [], ids: string[] = [], relatorio: RelatorioDoComodo[] = [];

  pedido.comodos.forEach((id, indice) => {
    const sala = atual.rooms[id];
    if (!sala) {
      relatorio.push({ id, nome: id, objetos: 0, luzes: 0, motivo: 'cômodo não existe' });
      return;
    }
    const semente = sementeBase + indice;
    const ctxMob: Contexto = { m: atual, versao: 0, semente, gerarId };
    const pMob = propostaDeMobilia(ctxMob, id);
    let objetos = 0;
    if (pMob) {
      atual = aplicarEmCopia(atual, pMob.comandos);
      comandos.push(...pMob.comandos);
      for (const c of pMob.comandos) {
        if (c.tipo === 'item.adicionar' && c.colecao === 'props') {
          ids.push(c.item.id);
          objetos++;
        }
      }
    }
    let luzes = 0;
    if (pedido.luzes !== false) {
      const ctxLuz: Contexto = { m: atual, versao: 0, semente, gerarId };
      const pLuz = propostaDeLuzes(ctxLuz, id);
      if (pLuz) {
        atual = aplicarEmCopia(atual, pLuz.comandos);
        comandos.push(...pLuz.comandos);
        for (const c of pLuz.comandos) {
          if (c.tipo === 'item.adicionar' && c.colecao === 'lights') {
            ids.push(c.item.id);
            luzes++;
          }
        }
      }
    }
    if (!pMob) {
      const motivo = !sala.function || !regrasPara(sala.function, genero).length
        ? 'função sem regras de mobília'
        : 'cômodo pequeno demais';
      relatorio.push({ id, nome: sala.name, objetos, luzes, motivo });
    } else {
      relatorio.push({ id, nome: sala.name, objetos, luzes });
    }
  });

  return { comandos, ids, relatorio };
}
