/**
 * Construção completa de edifícios por programa (`plantaDoEdificio` -> cômodos -> portas/janelas -> mobília/luzes)
 * como função pura: encadeia uma cópia do mapa e isola falhas por edifício para os válidos entrarem juntos numa transação.
 */
import { novoIdEntidade } from '../domain/fabrica.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE } from '../domain/presets.ts';
import type { Comando } from '../state/comandos.ts';
import { aplicarEmCopia, comodos, portas, type Construcao, type GeradorDeId, type PedidoDeComodo } from './construcao.ts';
import { aberturasDoEdificio, plantaDoEdificio, type Frente, type ProgramaDeEdificio } from './edificio.ts';
import { mobiliarLote } from './mobiliar-lote.ts';

export interface PedidoDeEdificio extends ProgramaDeEdificio {
  telhado?: string | null;
  piso?: string;
  mobiliar?: boolean;
  luzes?: boolean;
}

const LADO_POR_EXTENSO: Record<Frente, string> = {
  n: 'ao norte',
  s: 'ao sul',
  l: 'a leste',
  o: 'a oeste',
};

const fmtNum = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
};

/** Constrói uma lista de edifícios por programa, devolvendo todos os comandos numa única transação e o relatório em texto. */
export function construirEdificios(
  m: MapaAtlas,
  pedidos: readonly PedidoDeEdificio[],
  semente = 1,
  gerarId: GeradorDeId = novoIdEntidade,
): Construcao & { descricoes: string[] } {
  const sementeBase = Math.floor(semente) || 1;
  let atual = m;
  const comandos: Comando[] = [];
  const ids: string[] = [];
  const descricoes: string[] = [];
  const grade = m.grid.size || 1.5;

  pedidos.forEach((pedido, idx) => {
    const s = sementeBase + idx * 97;
    try {
      const planta = plantaDoEdificio(atual, pedido, s);
      const pedidosComodo: PedidoDeComodo[] = planta.comodos.map(cm => {
        const aoArLivre = FUNCOES_AO_AR_LIVRE.has(cm.tipo);
        return {
          rets: cm.rets,
          tipo: cm.tipo,
          nome: cm.nome,
          ...(pedido.piso && !aoArLivre ? { piso: pedido.piso } : {}),
          ...(!aoArLivre && pedido.telhado !== undefined ? { telhado: pedido.telhado } : {}),
        };
      });

      const resComodos = comodos(atual, pedidosComodo, s, gerarId);
      let proximo = aplicarEmCopia(atual, resComodos.comandos);
      const comandosEdificio: Comando[] = [...resComodos.comandos];
      const idsEdificio: string[] = [...resComodos.ids];

      const ab = aberturasDoEdificio(planta, grade);
      const todosVaos = [...ab.portas, ...ab.janelas];
      if (todosVaos.length) {
        const resPortas = portas(proximo, todosVaos, s, gerarId);
        proximo = aplicarEmCopia(proximo, resPortas.comandos);
        comandosEdificio.push(...resPortas.comandos);
        idsEdificio.push(...resPortas.ids);
      }

      if (pedido.mobiliar !== false) {
        const mob = mobiliarLote(proximo, {
          comodos: resComodos.ids,
          luzes: pedido.luzes ?? true,
          semente: s,
          gerarId,
        });
        if (mob.comandos.length) {
          proximo = aplicarEmCopia(proximo, mob.comandos);
          comandosEdificio.push(...mob.comandos);
          idsEdificio.push(...mob.ids);
        }
      }

      atual = proximo;
      comandos.push(...comandosEdificio);
      ids.push(...idsEdificio);

      const resumoComodos = planta.comodos.map(cm => {
        const cel = cm.rets.reduce((acc, r) => acc + (r[2] - r[0]) * (r[3] - r[1]), 0);
        const areaM2 = cel * grade * grade;
        return cm.tipo === 'varanda' ? 'varanda' : `${cm.tipo} ${fmtNum(areaM2)} m²`;
      });
      const areaTotal = planta.comodos.reduce(
        (acc, cm) => acc + cm.rets.reduce((a, r) => a + (r[2] - r[0]) * (r[3] - r[1]), 0),
        0,
      ) * grade * grade;
      const entradaPonto = ab.portas[0]?.perto ?? [0, 0];
      const salaPrincipal = proximo.rooms[resComodos.ids[0]!];
      const telhadoTexto = pedido.telhado === null
        ? 'sem telhado'
        : pedido.telhado ?? (salaPrincipal?.roof.material ?? 'sem telhado');

      descricoes.push(
        `${pedido.nome}: ${planta.comodos.length} cômodos (${resumoComodos.join(', ')}), ${fmtNum(areaTotal)} m², em ${planta.forma}; entrada ${LADO_POR_EXTENSO[planta.entrada.lado]} em [${fmtNum(entradaPonto[0])}, ${fmtNum(entradaPonto[1])}]; telhado ${telhadoTexto}`,
      );
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      descricoes.push(`${pedido.nome} (erro): ${msg}`);
    }
  });

  return { comandos, ids, descricoes };
}
