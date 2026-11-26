import { andarDe, ehReceitaDeEscada } from './andares.ts';
import { nomeDoAlvo } from './fabrica.ts';
import { arredondar, centroDaAbertura, comprimentoDaParede, normalParaDentro, pontoNaParede, salasDaAbertura } from './geometria.ts';
import type { Abertura, MapaAtlas, Objeto, Peca, Ponto, TransicaoDeMapa } from './mapa.ts';

/** Alcance padrão (em metros) para uma peça acionar uma transição de porta ou escada. */
export const ALCANCE_DE_TRANSICAO = 1.5;

/** Deslocamento padrão (em metros) para dentro do piso/cômodo ao chegar por uma porta ou arco. */
export const DESLOCAMENTO_DE_CHEGADA_PORTA = 0.9;

export interface EntradaDeTransicao {
  id: string;
  colecao: 'openings' | 'props';
  nome: string;
  levelId: string | null;
  posicao: Ponto;
}

export interface ChegadaResolvida {
  levelId: string | null;
  posicao: Ponto;
  alvoId: string | null;
}

export interface TransicaoProxima {
  colecao: 'openings' | 'props';
  id: string;
  transicao: TransicaoDeMapa;
}

/** Extrai o vínculo de transição entre mapas de uma abertura (`door`, `arch`, `secret`), ou `null` se não houver. */
export function transicaoDaAbertura(a: Pick<Abertura, 'transition'>): TransicaoDeMapa | null {
  const t = a.transition;
  if (!t || typeof t.toMapId !== 'string' || !t.toMapId.trim()) return null;
  return {
    toMapId: t.toMapId,
    ...(t.toLevel !== undefined ? { toLevel: t.toLevel } : {}),
    ...(t.toTargetId !== undefined ? { toTargetId: t.toTargetId } : {}),
    ...(t.toPosition !== undefined ? { toPosition: [t.toPosition[0], t.toPosition[1]] } : {}),
    ...(t.label !== undefined ? { label: t.label } : {}),
  };
}

/** Extrai o vínculo de transição entre mapas de um objeto com interação `stairs` e `toMapId`, ou `null` se for só intra-mapa. */
export function transicaoDoObjeto(o: Pick<Objeto, 'interaction'>): TransicaoDeMapa | null {
  const i = o.interaction;
  if (!i || i.kind !== 'stairs' || typeof i.toMapId !== 'string' || !i.toMapId.trim()) return null;
  return {
    toMapId: i.toMapId,
    ...(i.toLevel !== undefined ? { toLevel: i.toLevel } : {}),
    ...(i.toTargetId !== undefined ? { toTargetId: i.toTargetId } : {}),
    ...(i.toPosition !== undefined ? { toPosition: [i.toPosition[0], i.toPosition[1]] } : {}),
  };
}

function limitarAoMapa(bounds: { width: number; height: number }, p: Ponto, margem = 0.5): Ponto {
  const mx = Math.min(margem, bounds.width / 2);
  const my = Math.min(margem, bounds.height / 2);
  return [
    arredondar(Math.max(mx, Math.min(bounds.width - mx, p[0]))),
    arredondar(Math.max(my, Math.min(bounds.height - my, p[1]))),
  ];
}

/**
 * Lista todas as portas/arcos (`openings`, exceto janelas) e escadas/alçapões (`props`) de um mapa
 * com suas coordenadas em metros e o andar correspondente.
 */
export function entradasDeTransicao(m: MapaAtlas): EntradaDeTransicao[] {
  const entradas: EntradaDeTransicao[] = [];

  for (const a of Object.values(m.openings)) {
    if (a.kind === 'window') continue;
    const parede = m.walls[a.wallId];
    if (!parede) continue;
    const dist = centroDaAbertura(parede, a);
    const { ponto } = pontoNaParede(parede, dist);
    const posicao: Ponto = [arredondar(ponto[0]), arredondar(ponto[1])];
    const levelId = andarDe(parede);
    const base = nomeDoAlvo('openings', a);
    const salas = salasDaAbertura(m, a)
      .map(id => m.rooms[id]?.name)
      .filter((n): n is string => !!n);
    const nome = salas.length > 0 ? `${base} (${salas.join(' ↔ ')})` : base;
    entradas.push({ id: a.id, colecao: 'openings', nome, levelId, posicao });
  }

  for (const o of Object.values(m.props)) {
    const ehEscada = o.interaction?.kind === 'stairs' || (o.source.kind === 'recipe' && ehReceitaDeEscada(o.source.recipe));
    if (!ehEscada) continue;
    const base = nomeDoAlvo('props', o);
    const nomeSala = o.roomId ? m.rooms[o.roomId]?.name : undefined;
    const nome = nomeSala ? `${base} (${nomeSala})` : base;
    entradas.push({
      id: o.id,
      colecao: 'props',
      nome,
      levelId: andarDe(o),
      posicao: [arredondar(o.position[0]), arredondar(o.position[1])],
    });
  }

  return entradas;
}

/**
 * Calcula a posição e o andar de chegada no mapa de destino:
 * 1. Se `toTargetId` existir em `destino.openings`, devolve o andar da parede e um ponto deslocado 0,9 m para dentro do cômodo/piso.
 * 2. Se `toTargetId` existir em `destino.props`, devolve o andar e a posição do objeto.
 * 3. Senão, usa `toPosition` e `toLevel ?? null` (ou o centro de `destino.bounds` no térreo quando nada disso existir).
 */
export function resolverChegada(destino: MapaAtlas, transicao: TransicaoDeMapa): ChegadaResolvida {
  const alvoId = transicao.toTargetId ?? null;

  if (alvoId) {
    const abertura = destino.openings[alvoId];
    if (abertura) {
      const parede = destino.walls[abertura.wallId];
      if (parede) {
        const dist = centroDaAbertura(parede, abertura);
        const { ponto, tangente } = pontoNaParede(parede, dist);
        const salas = salasDaAbertura(destino, abertura);
        let normal: Ponto | null = null;
        for (const salaId of salas) {
          normal = normalParaDentro(destino, parede, dist, salaId);
          if (normal) break;
        }
        if (!normal) {
          normal = abertura.swing === 'b' ? [tangente[1], -tangente[0]] : [-tangente[1], tangente[0]];
        }
        const deslocado: Ponto = [
          ponto[0] + normal[0] * DESLOCAMENTO_DE_CHEGADA_PORTA,
          ponto[1] + normal[1] * DESLOCAMENTO_DE_CHEGADA_PORTA,
        ];
        return {
          levelId: andarDe(parede),
          posicao: limitarAoMapa(destino.bounds, deslocado),
          alvoId: abertura.id,
        };
      }
    }

    const prop = destino.props[alvoId];
    if (prop) {
      return {
        levelId: andarDe(prop),
        posicao: limitarAoMapa(destino.bounds, [prop.position[0], prop.position[1]]),
        alvoId: prop.id,
      };
    }
  }

  if (transicao.toPosition) {
    return {
      levelId: transicao.toLevel ?? null,
      posicao: limitarAoMapa(destino.bounds, [transicao.toPosition[0], transicao.toPosition[1]]),
      alvoId: null,
    };
  }

  return {
    levelId: transicao.toLevel ?? null,
    posicao: [arredondar(destino.bounds.width / 2), arredondar(destino.bounds.height / 2)],
    alvoId: null,
  };
}

/**
 * Distribui `n` peças de jogador em formação compacta ao redor de `centro`,
 * respeitando `destino.bounds` e `destino.grid.size`.
 */
export function posicoesDeChegadaDasPecas(destino: Pick<MapaAtlas, 'bounds' | 'grid'>, centro: Ponto, n: number): Ponto[] {
  if (n <= 0) return [];
  const passo = Math.max(0.5, destino.grid.size);
  const margem = Math.min(passo / 2, destino.bounds.width / 2, destino.bounds.height / 2);
  const base = limitarAoMapa(destino.bounds, centro, margem);
  if (n === 1) return [base];

  const candidatos: [number, number][] = [[0, 0]];
  const maxRaio = Math.ceil(Math.sqrt(n)) + 2;
  for (let r = 1; r <= maxRaio; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        candidatos.push([dx, dy]);
      }
    }
  }
  candidatos.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

  const saida: Ponto[] = [];
  const vistos = new Set<string>();
  for (const [dx, dy] of candidatos) {
    if (saida.length >= n) break;
    const p = limitarAoMapa(destino.bounds, [base[0] + dx * passo, base[1] + dy * passo], margem);
    const chave = `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(p);
  }

  while (saida.length < n) {
    saida.push([base[0], base[1]]);
  }

  return saida;
}

/** O ponto do segmento a→b mais perto de p. */
function pontoMaisPerto(p: Ponto, a: Ponto, b: Ponto): Ponto {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy;
  const u = q < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q));
  return [a[0] + dx * u, a[1] + dy * u];
}

/**
 * Encontra a porta/arco ou escada/alçapão vinculada a outro mapa a até `alcance` (padrão 1,5 m)
 * da peça no mesmo andar, priorizando a mais próxima.
 */
export function transicaoPertoDaPeca(
  m: Pick<MapaAtlas, 'walls' | 'openings' | 'props'>,
  peca: Pick<Peca, 'position' | 'facing' | 'levelId'>,
  alcance = ALCANCE_DE_TRANSICAO,
): TransicaoProxima | null {
  const andar = andarDe(peca);
  const p = peca.position;
  let melhor: { item: TransicaoProxima; dist: number } | null = null;

  for (const a of Object.values(m.openings)) {
    const transicao = transicaoDaAbertura(a);
    if (!transicao) continue;
    const parede = m.walls[a.wallId];
    if (!parede || andarDe(parede) !== andar) continue;
    const c = centroDaAbertura(parede, a), meia = a.width / 2, comp = comprimentoDaParede(parede);
    const p0 = pontoNaParede(parede, Math.max(0, c - meia)).ponto;
    const p1 = pontoNaParede(parede, Math.min(comp, c + meia)).ponto;
    const perto = pontoMaisPerto(p, p0, p1);
    const dist = Math.hypot(perto[0] - p[0], perto[1] - p[1]);
    if (dist <= alcance && (!melhor || dist < melhor.dist)) {
      melhor = { item: { colecao: 'openings', id: a.id, transicao }, dist };
    }
  }

  for (const o of Object.values(m.props)) {
    if (andarDe(o) !== andar) continue;
    const transicao = transicaoDoObjeto(o);
    if (!transicao) continue;
    const dist = Math.hypot(o.position[0] - p[0], o.position[1] - p[1]);
    if (dist <= alcance && (!melhor || dist < melhor.dist)) {
      melhor = { item: { colecao: 'props', id: o.id, transicao }, dist };
    }
  }

  return melhor ? melhor.item : null;
}
