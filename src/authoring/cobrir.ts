import { decodificar } from '../domain/celulas.ts';
import type { Comodo, MapaAtlas } from '../domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE, telhadoPadrao } from '../domain/presets.ts';
import type { Comando } from '../state/comandos.ts';

const VIZINHOS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function compararId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function elegivel(s: Comodo): boolean {
  return s.roof.material === null && !(s.function && FUNCOES_AO_AR_LIVRE.has(s.function));
}

/** Gera comandos `comodo.atualizar` para cobrir cômodos sem telhado (exceto áreas ao ar livre), em ordem de vizinhança. */
export function cobrirCasas(m: Pick<MapaAtlas, 'rooms' | 'style'>): Comando[] {
  const porNivel = new Map<string | null, Comodo[]>();
  for (const s of Object.values(m.rooms)) {
    const nivel = s.levelId ?? null;
    const lista = porNivel.get(nivel);
    if (lista) lista.push(s);
    else porNivel.set(nivel, [s]);
  }

  const comandos: Comando[] = [];
  const niveis = [...porNivel.keys()].sort((a, b) => compararId(a ?? '', b ?? ''));

  for (const nivel of niveis) {
    const salasDoNivel = porNivel.get(nivel)!;
    const descobertas = salasDoNivel.filter(elegivel).sort((a, b) => compararId(a.id, b.id));
    if (!descobertas.length) continue;

    const roomsDoNivel: Record<string, Comodo> = Object.fromEntries(salasDoNivel.map(s => [s.id, s]));
    const celulasPorId = new Map<string, [number, number][]>();
    const dono = new Map<string, string>();
    const celulasCobertas = new Set<string>();

    for (const s of salasDoNivel) {
      const cels = decodificar(s.cells).map(([x, y]): [number, number] => [x, y]);
      celulasPorId.set(s.id, cels);
      if (s.roof.material) {
        for (const [x, y] of cels) celulasCobertas.add(`${x},${y}`);
      } else if (elegivel(s)) {
        for (const [x, y] of cels) dono.set(`${x},${y}`, s.id);
      }
    }

    const vizinhas = new Map<string, string[]>();
    const fila: string[] = [];
    const naFila = new Set<string>();

    for (const s of descobertas) {
      const adj = new Set<string>();
      let tocaCoberto = false;
      for (const [x, y] of celulasPorId.get(s.id)!) {
        for (const [dx, dy] of VIZINHOS) {
          const k = `${x + dx},${y + dy}`;
          if (celulasCobertas.has(k)) tocaCoberto = true;
          const outro = dono.get(k);
          if (outro && outro !== s.id) adj.add(outro);
        }
      }
      vizinhas.set(s.id, [...adj].sort(compararId));
      if (tocaCoberto) {
        fila.push(s.id);
        naFila.add(s.id);
      }
    }

    const processadas = new Set<string>();
    const proximoSemCobertura = () => descobertas.find(s => !processadas.has(s.id))?.id;

    while (processadas.size < descobertas.length) {
      if (!fila.length) {
        const inicio = proximoSemCobertura();
        if (!inicio) break;
        fila.push(inicio);
        naFila.add(inicio);
      }
      const id = fila.shift()!;
      if (processadas.has(id)) continue;
      processadas.add(id);

      const sala = roomsDoNivel[id]!;
      const cels = celulasPorId.get(id)!;
      const roof = telhadoPadrao({ style: m.style, rooms: roomsDoNivel }, sala.function, cels, nivel);
      if (roof) {
        comandos.push({
          tipo: 'comodo.atualizar',
          id,
          patch: { roof: { ...roof, visible: true } },
        });
        roomsDoNivel[id] = { ...sala, roof: { ...roof, visible: true } };
      }

      for (const vizId of vizinhas.get(id) ?? []) {
        if (!processadas.has(vizId) && !naFila.has(vizId)) {
          fila.push(vizId);
          naFila.add(vizId);
        }
      }
    }
  }

  return comandos;
}
