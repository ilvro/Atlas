/**
 * Construção completa de edifícios por programa (`plantaDoEdificio` -> cômodos -> portas/janelas -> mobília/luzes)
 * como função pura: encadeia uma cópia do mapa e isola falhas por edifício para os válidos entrarem juntos numa transação.
 */
import { mapaDoAndar } from '../domain/andares.ts';
import { novoIdEntidade } from '../domain/fabrica.ts';
import { arredondar, comprimentoDaParede, contornoDoComodo, projetarNaParede } from '../domain/geometria.ts';
import type { MapaAtlas, Parede, Ponto } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE } from '../domain/presets.ts';
import type { Comando } from '../state/comandos.ts';
import { aplicarEmCopia, comodos, portas, type Construcao, type GeradorDeId, type PedidoDeComodo, type Ret } from './construcao.ts';
import { aberturasDoEdificio, plantaDoEdificio, type Frente, type ProgramaDeEdificio } from './edificio.ts';
import { mobiliarLote } from './mobiliar-lote.ts';

export interface PedidoDeEdificio extends ProgramaDeEdificio {
  telhado?: string | null;
  piso?: string;
  mobiliar?: boolean;
  luzes?: boolean;
  andar?: string | null;
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

function rotacionarPonto(p: Ponto, centro: Ponto, cos: number, sin: number): Ponto {
  const dx = p[0] - centro[0];
  const dy = p[1] - centro[1];
  return [arredondar(centro[0] + dx * cos - dy * sin), arredondar(centro[1] + dx * sin + dy * cos)];
}

function poligonoDeRets(m: Pick<MapaAtlas, 'grid'>, rets: readonly Ret[]): Ponto[] {
  const celulas: [number, number][] = [];
  for (const [x0, y0, x1, y1] of rets) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) celulas.push([x, y]);
    }
  }
  const laco = contornoDoComodo(m, celulas)[0] ?? [];
  return laco.map(s => s.a);
}

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
      const escopoAndar = mapaDoAndar(atual, pedido.andar ?? null, true);
      const planta = plantaDoEdificio(escopoAndar, pedido, s);
      const rotacao = pedido.rotacao ?? 0;
      const rotacionado = Math.abs(rotacao) > 1e-4;
      const ab = aberturasDoEdificio(planta, grade);
      const todosVaosOrto = [...ab.portas, ...ab.janelas].map(v => pedido.andar ? { ...v, andar: pedido.andar } : v);

      const pedidosComodoBase = planta.comodos.map(cm => {
        const aoArLivre = FUNCOES_AO_AR_LIVRE.has(cm.tipo);
        return {
          cm,
          base: {
            tipo: cm.tipo,
            nome: cm.nome,
            ...(pedido.piso && !aoArLivre ? { piso: pedido.piso } : {}),
            ...(!aoArLivre && pedido.telhado !== undefined ? { telhado: pedido.telhado } : {}),
            ...(pedido.andar ? { andar: pedido.andar } : {}),
          },
        };
      });

      let proximo: MapaAtlas;
      const comandosEdificio: Comando[] = [];
      const idsEdificio: string[] = [];
      let idsComodos: string[];
      let entradaPonto: Ponto = ab.portas[0]?.perto ?? [0, 0];

      if (!rotacionado) {
        const pedidosComodo: PedidoDeComodo[] = pedidosComodoBase.map(({ cm, base }) => ({ rets: cm.rets, ...base }));
        const resComodos = comodos(atual, pedidosComodo, s, gerarId);
        proximo = aplicarEmCopia(atual, resComodos.comandos);
        comandosEdificio.push(...resComodos.comandos);
        idsEdificio.push(...resComodos.ids);
        idsComodos = resComodos.ids;

        if (todosVaosOrto.length) {
          const resPortas = portas(proximo, todosVaosOrto, s, gerarId);
          proximo = aplicarEmCopia(proximo, resPortas.comandos);
          comandosEdificio.push(...resPortas.comandos);
          idsEdificio.push(...resPortas.ids);
        }

        if (pedido.mobiliar !== false) {
          const mob = mobiliarLote(proximo, {
            comodos: idsComodos,
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
      } else {
        const [cx0, cy0, cx1, cy1] = planta.caixa;
        const pivo: Ponto = [
          atual.grid.offset[0] + ((cx0 + cx1) * grade) / 2,
          atual.grid.offset[1] + ((cy0 + cy1) * grade) / 2,
        ];
        const cos = Math.cos(rotacao);
        const sin = Math.sin(rotacao);
        entradaPonto = rotacionarPonto(entradaPonto, pivo, cos, sin);

        // Roda mobília no espaço ortogonal isolado para preservar encaixe de cama/parede antes de girar o edifício inteiro.
        let mapaIdsOrto = new Map<string, string>();
        let ortoMobiliado: MapaAtlas | null = null;
        if (pedido.mobiliar !== false) {
          let seqTmp = 0;
          const idTmp: GeradorDeId = pref => `_rot_${++seqTmp}_${pref}`;
          const baseOrto: MapaAtlas = { ...atual, rooms: {}, walls: {}, openings: {}, props: {}, lights: {} };
          const pedidosOrto: PedidoDeComodo[] = pedidosComodoBase.map(({ cm, base }) => ({ rets: cm.rets, ...base }));
          const resComOrto = comodos(baseOrto, pedidosOrto, s, idTmp);
          let orto = aplicarEmCopia(baseOrto, resComOrto.comandos);
          if (todosVaosOrto.length) {
            orto = aplicarEmCopia(orto, portas(orto, todosVaosOrto, s, idTmp).comandos);
          }
          const mobOrto = mobiliarLote(orto, {
            comodos: resComOrto.ids,
            luzes: pedido.luzes ?? true,
            semente: s,
            gerarId: idTmp,
          });
          if (mobOrto.comandos.length) {
            ortoMobiliado = aplicarEmCopia(orto, mobOrto.comandos);
          }
          mapaIdsOrto = new Map(resComOrto.ids.map((idOrto, i) => [idOrto, String(i)]));
        }

        const pedidosRot: PedidoDeComodo[] = pedidosComodoBase.map(({ cm, base }) => ({
          poligono: poligonoDeRets(atual, cm.rets).map(q => rotacionarPonto(q, pivo, cos, sin)),
          ...base,
        }));
        const resComodos = comodos(atual, pedidosRot, s, gerarId);
        proximo = aplicarEmCopia(atual, resComodos.comandos);
        comandosEdificio.push(...resComodos.comandos);
        idsEdificio.push(...resComodos.ids);
        idsComodos = resComodos.ids;

        const todosVaosRot = todosVaosOrto.map(v => ({ ...v, perto: rotacionarPonto(v.perto, pivo, cos, sin) }));
        if (todosVaosRot.length) {
          const resPortas = portas(proximo, todosVaosRot, s, gerarId);
          proximo = aplicarEmCopia(proximo, resPortas.comandos);
          comandosEdificio.push(...resPortas.comandos);
          idsEdificio.push(...resPortas.ids);
        }

        if (ortoMobiliado) {
          const idRealPorOrto = new Map<string, string>();
          for (const [idOrto, idxStr] of mapaIdsOrto) {
            idRealPorOrto.set(idOrto, idsComodos[Number(idxStr)]!);
          }
          const mobComandos: Comando[] = [];
          const idPropPorOrto = new Map<string, string>();
          for (const obj of Object.values(ortoMobiliado.props)) {
            const posRot = rotacionarPonto(obj.position, pivo, cos, sin);
            let wall = obj.wall;
            if (obj.wall) {
              const nivelObj = obj.levelId ?? null;
              let melhor: { p: Parede; dist: number; d: number } | null = null;
              for (const p of Object.values(proximo.walls)) {
                if ((p.levelId ?? null) !== nivelObj) continue;
                const r = projetarNaParede(p, posRot);
                if (!melhor || r.distancia < melhor.d) melhor = { p, dist: r.dist, d: r.distancia };
              }
              if (!melhor || melhor.d > 0.6) continue;
              const comp = comprimentoDaParede(melhor.p);
              wall = {
                wallId: melhor.p.id,
                at: arredondar(comp > 1e-6 ? Math.max(0, Math.min(1, melhor.dist / comp)) : 0),
                face: obj.wall.face,
              };
            }
            const novoId = gerarId('o');
            idPropPorOrto.set(obj.id, novoId);
            const roomId = obj.roomId ? (idRealPorOrto.get(obj.roomId) ?? obj.roomId) : null;
            mobComandos.push({
              tipo: 'item.adicionar',
              colecao: 'props',
              item: {
                ...obj,
                id: novoId,
                position: posRot,
                rotation: arredondar(obj.rotation + rotacao),
                wall,
                roomId,
              },
            });
            idsEdificio.push(novoId);
          }
          for (const luz of Object.values(ortoMobiliado.lights)) {
            const novoId = gerarId('l');
            const ownerId = luz.ownerId ? (idPropPorOrto.get(luz.ownerId) ?? luz.ownerId) : null;
            mobComandos.push({
              tipo: 'item.adicionar',
              colecao: 'lights',
              item: {
                ...luz,
                id: novoId,
                position: rotacionarPonto(luz.position, pivo, cos, sin),
                cone: luz.cone ? { ...luz.cone, direction: arredondar(luz.cone.direction + rotacao) } : null,
                ownerId,
              },
            });
            idsEdificio.push(novoId);
          }
          if (mobComandos.length) {
            proximo = aplicarEmCopia(proximo, mobComandos);
            comandosEdificio.push(...mobComandos);
          }
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
      const salaPrincipal = proximo.rooms[idsComodos[0]!];
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
