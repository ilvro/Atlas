import { decodificar, normalizar, subtrair, type Celula, type Faixa } from '../domain/celulas.ts';
import { idDaLuzPropria, luzDoObjeto } from '../domain/luz-propria.ts';
import type { Comodo, MapaAtlas, Objeto, Parede, Peca, Presenca } from '../domain/mapa.ts';
import { aplicarComando, ErroDeComando, ROTULOS, type Comando } from '../state/comandos.ts';
import type { CelulaDoComando, ComandoConstruir } from '../state/comandos-construir.ts';
import { clonar } from '../state/imutavel.ts';

export type OrigemOperacaoColaborativa = 'normal' | 'desfazer' | 'refazer';

export interface EntradaPilhaColaborativa {
  rotulo: string;
  desfazer: Comando[];
  refazer: Comando[];
}

export interface ResultadoPrepararDesfazer {
  rotulo: string;
  comandos: Comando[];
}

export interface PilhaDesfazerColaborativo {
  readonly podeDesfazer: boolean;
  readonly podeRefazer: boolean;
  readonly rotuloDesfazer: string;
  readonly rotuloRefazer: string;
  registrarPendente(
    opId: string,
    rotulo: string,
    mapaAntes: MapaAtlas,
    mapaDepois: MapaAtlas,
    comandos: readonly Comando[],
    origem?: OrigemOperacaoColaborativa,
  ): void;
  descartarPendente(opId: string): void;
  confirmar(opId: string): boolean;
  prepararDesfazer(mapaAtual: MapaAtlas): ResultadoPrepararDesfazer | null;
  prepararRefazer(mapaAtual: MapaAtlas): ResultadoPrepararDesfazer | null;
  limpar(): void;
}

interface OperacaoPendenteDesfazer {
  rotulo: string;
  mapaAntes: MapaAtlas;
  mapaDepois: MapaAtlas;
  comandos: Comando[];
  origem: OrigemOperacaoColaborativa;
}

const ehPlano = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const idDaCamadaTerreno = (material: string) =>
  `t_${material.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;

const idDaPresenca = (brush: string, levelId: string | null = null) => {
  const base = `p_${brush.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;
  return levelId ? `${base}_${levelId}`.slice(0, 64) : base;
};

const sementeDaPresenca = (texto: string) => {
  let h = 2166136261;
  for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 2 ** 31;
};

function calcularPatchInverso(
  antes: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const inverso: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    const valAntes = antes[k];
    if (v === undefined) {
      if (k in antes && valAntes !== undefined) inverso[k] = clonar(valAntes);
      continue;
    }
    if (ehPlano(v) && ehPlano(valAntes)) {
      const sub = calcularPatchInverso(valAntes, v);
      if (Object.keys(sub).length > 0) inverso[k] = sub;
    } else if (k in antes && valAntes !== undefined) {
      inverso[k] = clonar(valAntes);
    } else {
      inverso[k] = undefined;
    }
  }
  return inverso;
}

function comandosRestaurarComodo(
  mapaAntes: MapaAtlas,
  sala: Comodo,
  celulasOverride?: readonly Celula[],
): Comando[] {
  const cmds: Comando[] = [];
  const { visible: roofVisible, ...telhadoResto } = sala.roof;
  const criar: Extract<ComandoConstruir, { tipo: 'comodo.criar' }> = {
    tipo: 'comodo.criar',
    id: sala.id,
    nome: sala.name,
    funcao: sala.function,
    piso: clonar(sala.floor),
    papel: sala.wallpaper ? clonar(sala.wallpaper) : null,
    ...(sala.wallFace !== undefined ? { wallFace: sala.wallFace } : {}),
    telhado: clonar(telhadoResto),
    celulas: celulasOverride ?? decodificar(sala.cells),
    ...(sala.outline !== undefined ? { outline: clonar(sala.outline) } : {}),
    levelId: sala.levelId,
  };
  cmds.push(criar);

  const patchExtra: Record<string, unknown> = {};
  if (!roofVisible) patchExtra.roof = { visible: false };
  if (sala.wallStyle !== null) patchExtra.wallStyle = sala.wallStyle;
  if (sala.palette !== null) patchExtra.palette = sala.palette;
  if (Object.keys(patchExtra).length > 0) {
    cmds.push({
      tipo: 'comodo.atualizar',
      id: sala.id,
      patch: patchExtra as Extract<ComandoConstruir, { tipo: 'comodo.atualizar' }>['patch'],
    });
  }

  const notas = mapaAntes.comodosExtra[sala.id];
  if (notas) {
    cmds.push({
      tipo: 'comodo.notas',
      id: sala.id,
      patch: {
        leitura: notas.leitura,
        notasMestre: notas.notasMestre,
        refs: clonar(notas.refs),
      },
    });
  }

  if (mapaAntes.session.revealed.includes(sala.id)) {
    cmds.push({ tipo: 'sessao.revelar', ids: [sala.id] });
  }
  return cmds;
}

function comandosRestaurarCelulasRoubadas(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
  nivel: string | null,
  ignorarId?: string,
): Comando[] {
  const cmds: Comando[] = [];
  for (const outra of Object.values(mapaAntes.rooms)) {
    if (outra.id === ignorarId || (outra.levelId ?? null) !== nivel) continue;
    const depoisOutra = mapaDepois.rooms[outra.id];
    const roubadas = depoisOutra ? subtrair(outra.cells, depoisOutra.cells) : outra.cells;
    if (!roubadas.length) continue;
    if (depoisOutra) {
      cmds.push({ tipo: 'comodo.pintar', id: outra.id, celulas: decodificar(roubadas) });
    } else {
      cmds.push(...comandosRestaurarComodo(mapaAntes, outra, decodificar(roubadas)));
    }
  }
  return cmds;
}

function comandosRestaurarLuzesDoDono(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
  dono: { id: string },
  colecaoDono: 'props' | 'tokens',
): Comando[] {
  const cmds: Comando[] = [];
  const idPropria = colecaoDono === 'props' ? idDaLuzPropria(dono.id) : null;
  const temPropriaAuto =
    colecaoDono === 'props' && luzDoObjeto(dono as Objeto) !== null;

  for (const luz of Object.values(mapaAntes.lights)) {
    if (luz.ownerId !== dono.id || mapaDepois.lights[luz.id]) continue;
    if (idPropria && luz.id === idPropria && temPropriaAuto) {
      if (!luz.on) {
        cmds.push({ tipo: 'item.atualizar', colecao: 'lights', id: luz.id, patch: { on: false } });
      }
      continue;
    }
    cmds.push({ tipo: 'item.adicionar', colecao: 'lights', item: clonar(luz) });
  }
  return cmds;
}

function comandoParedeSemSource(parede: Parede): Omit<Parede, 'source'> {
  const { source: _source, ...semSource } = clonar(parede);
  return semSource;
}

function mapaDeMaterialPorCelula(
  layers: MapaAtlas['terrain']['layers'],
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const camada of Object.values(layers)) {
    for (const [x, y] of decodificar(camada.cells)) {
      mapa.set(`${x},${y}`, camada.material);
    }
  }
  return mapa;
}

function celulasAlteradasDeTerreno(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
  candidatas?: readonly CelulaDoComando[],
): Celula[] {
  if (candidatas && candidatas.length > 0) {
    return normalizar(candidatas.map(([x, y]) => [x, y] as const));
  }
  const todas = new Map<string, Celula>();
  const antesIds = new Set(Object.keys(mapaAntes.terrain.layers));
  const depoisIds = new Set(Object.keys(mapaDepois.terrain.layers));
  for (const id of new Set([...antesIds, ...depoisIds])) {
    const a = mapaAntes.terrain.layers[id]?.cells ?? [];
    const d = mapaDepois.terrain.layers[id]?.cells ?? [];
    for (const [x, y] of decodificar(subtrair(a, d))) todas.set(`${x},${y}`, [x, y]);
    for (const [x, y] of decodificar(subtrair(d, a))) todas.set(`${x},${y}`, [x, y]);
  }
  return [...todas.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function inverterTerrenoPorDiferenca(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
  cels: readonly Celula[],
): Comando[] {
  const antesMat = mapaDeMaterialPorCelula(mapaAntes.terrain.layers);
  const depoisMat = mapaDeMaterialPorCelula(mapaDepois.terrain.layers);

  const paraApagar: Celula[] = [];
  const porMaterial = new Map<string, Celula[]>();

  for (const [x, y] of cels) {
    const k = `${x},${y}`;
    const mAntes = antesMat.get(k) ?? null;
    const mDepois = depoisMat.get(k) ?? null;
    if (mAntes === mDepois) continue;
    if (mAntes === null) {
      paraApagar.push([x, y]);
    } else {
      const lista = porMaterial.get(mAntes);
      if (lista) lista.push([x, y]);
      else porMaterial.set(mAntes, [[x, y]]);
    }
  }

  const cmds: Comando[] = [];
  if (paraApagar.length > 0) {
    cmds.push({ tipo: 'terreno.apagar', celulas: paraApagar });
  }
  for (const [material, grupo] of porMaterial) {
    cmds.push({ tipo: 'terreno.pintar', material, celulas: grupo });
    const camadaAntes = mapaAntes.terrain.layers[idDaCamadaTerreno(material)];
    const camadaDepois = mapaDepois.terrain.layers[idDaCamadaTerreno(material)];
    if (camadaAntes?.flow && !camadaDepois) {
      cmds.push({
        tipo: 'terreno.correnteza',
        material,
        flow: clonar(camadaAntes.flow),
      });
    }
  }
  return cmds;
}

function inverterRelevo(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
): Comando[] {
  const antesPat = mapaAntes.terrain.relief?.patamares ?? {};
  const depoisPat = mapaDepois.terrain.relief?.patamares ?? {};

  const antesPorCel = new Map<string, number>();
  const depoisPorCel = new Map<string, number>();
  const tocadas = new Map<string, Celula>();

  for (const p of Object.values(antesPat)) {
    for (const [x, y] of decodificar(p.cells)) {
      const k = `${x},${y}`;
      antesPorCel.set(k, p.altura);
      tocadas.set(k, [x, y]);
    }
  }
  for (const p of Object.values(depoisPat)) {
    for (const [x, y] of decodificar(p.cells)) {
      const k = `${x},${y}`;
      depoisPorCel.set(k, p.altura);
      tocadas.set(k, [x, y]);
    }
  }

  const paraApagar: Celula[] = [];
  const porAltura = new Map<number, Celula[]>();
  for (const [k, cel] of tocadas) {
    const hAntes = antesPorCel.get(k) ?? 0;
    const hDepois = depoisPorCel.get(k) ?? 0;
    if (hAntes === hDepois) continue;
    if (hAntes === 0) {
      paraApagar.push(cel);
    } else {
      const lista = porAltura.get(hAntes);
      if (lista) lista.push(cel);
      else porAltura.set(hAntes, [cel]);
    }
  }

  const cmds: Comando[] = [];
  if (paraApagar.length > 0) cmds.push({ tipo: 'relevo.apagar', celulas: paraApagar });
  for (const [altura, celulas] of porAltura) {
    cmds.push({ tipo: 'relevo.pintar', altura, celulas });
  }
  return cmds;
}

function calcularInversoUnico(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
  cmd: Comando,
): Comando[] {
  switch (cmd.tipo) {
    case 'proposta.aceitar':
      return calcularInversoComandos(mapaAntes, mapaDepois, cmd.comandos);

    case 'item.adicionar':
      return [{ tipo: 'item.remover', colecao: cmd.colecao, id: cmd.item.id }];

    case 'item.remover': {
      const anterior = (mapaAntes[cmd.colecao] as Record<string, any>)[cmd.id];
      if (!anterior) return [];
      const cmds: Comando[] = [];
      let lightIdParaRestaurar: string | null = null;
      if (cmd.colecao === 'tokens') {
        const peca = clonar(anterior as Peca);
        if (peca.lightId && !mapaDepois.lights[peca.lightId]) {
          lightIdParaRestaurar = peca.lightId;
          peca.lightId = null;
        }
        cmds.push({ tipo: 'item.adicionar', colecao: 'tokens', item: peca });
      } else {
        cmds.push({ tipo: 'item.adicionar', colecao: cmd.colecao, item: clonar(anterior) });
      }

      if (cmd.colecao === 'props' || cmd.colecao === 'tokens') {
        cmds.push(...comandosRestaurarLuzesDoDono(mapaAntes, mapaDepois, anterior, cmd.colecao));
      }
      if (lightIdParaRestaurar) {
        cmds.push({
          tipo: 'item.atualizar',
          colecao: 'tokens',
          id: cmd.id,
          patch: { lightId: lightIdParaRestaurar },
        });
      }
      if (cmd.colecao === 'lights') {
        for (const t of Object.values(mapaAntes.tokens)) {
          if (t.lightId === cmd.id && mapaDepois.tokens[t.id] && mapaDepois.tokens[t.id]!.lightId !== cmd.id) {
            cmds.push({
              tipo: 'item.atualizar',
              colecao: 'tokens',
              id: t.id,
              patch: { lightId: cmd.id },
            });
          }
        }
      }
      if (
        (cmd.colecao === 'props' || cmd.colecao === 'regions') &&
        mapaAntes.session.revealed.includes(cmd.id) &&
        !mapaDepois.session.revealed.includes(cmd.id)
      ) {
        cmds.push({ tipo: 'sessao.revelar', ids: [cmd.id] });
      }
      return cmds;
    }

    case 'item.atualizar': {
      const anterior = (mapaAntes[cmd.colecao] as Record<string, any>)[cmd.id];
      if (!anterior) return [];
      const patch = calcularPatchInverso(anterior, cmd.patch as Record<string, unknown>);
      if (!Object.keys(patch).length) return [];
      return [{ tipo: 'item.atualizar', colecao: cmd.colecao, id: cmd.id, patch }];
    }

    case 'selecao.mover':
      return [
        {
          tipo: 'selecao.mover',
          alvos: clonar(cmd.alvos),
          delta: [-cmd.delta[0], -cmd.delta[1]],
        },
      ];

    case 'objeto.camada': {
      const cmds: Comando[] = [];
      for (const id of cmd.ids) {
        const anterior = mapaAntes.props[id];
        if (!anterior) continue;
        cmds.push({
          tipo: 'item.atualizar',
          colecao: 'props',
          id,
          patch: { layer: anterior.layer },
        });
      }
      return cmds;
    }

    case 'luz.estado': {
      const alvos = new Set<string>();
      for (const id of cmd.ids) {
        if (mapaAntes.lights[id]) alvos.add(id);
        for (const l of Object.values(mapaAntes.lights)) {
          if (l.ownerId === id) alvos.add(l.id);
        }
      }
      const cmds: Comando[] = [];
      for (const id of alvos) {
        const lAntes = mapaAntes.lights[id];
        const lDepois = mapaDepois.lights[id];
        if (!lAntes || !lDepois || lAntes.on === lDepois.on) continue;
        cmds.push({
          tipo: 'item.atualizar',
          colecao: 'lights',
          id,
          patch: { on: lAntes.on },
        });
      }
      return cmds;
    }

    case 'objeto.visibilidade': {
      const cmds: Comando[] = [];
      for (const id of cmd.ids) {
        const anterior = mapaAntes.props[id];
        if (!anterior) continue;
        cmds.push({
          tipo: 'item.atualizar',
          colecao: 'props',
          id,
          patch: { oculto: anterior.oculto },
        });
      }
      return cmds;
    }

    case 'comodo.criar': {
      const criado = mapaDepois.rooms[cmd.id];
      if (!criado) return [];
      const cmds: Comando[] = [{ tipo: 'comodo.remover', id: cmd.id }];
      cmds.push(...comandosRestaurarCelulasRoubadas(mapaAntes, mapaDepois, criado.levelId ?? null, cmd.id));
      return cmds;
    }

    case 'comodo.remover': {
      const antigo = mapaAntes.rooms[cmd.id];
      if (!antigo) return [];
      return comandosRestaurarComodo(mapaAntes, antigo);
    }

    case 'comodo.pintar': {
      const antesSala = mapaAntes.rooms[cmd.id];
      const depoisSala = mapaDepois.rooms[cmd.id];
      if (!antesSala || !depoisSala) return [];
      const nivel = antesSala.levelId ?? null;
      const ganhas = subtrair(depoisSala.cells, antesSala.cells);
      if (!ganhas.length) return [];

      const cmds: Comando[] = [];
      const roubadasPorSala = new Map<string, Faixa[]>();
      let restantes = ganhas;

      for (const outra of Object.values(mapaAntes.rooms)) {
        if (outra.id === cmd.id || (outra.levelId ?? null) !== nivel) continue;
        const depoisOutra = mapaDepois.rooms[outra.id];
        const roubadas = depoisOutra
          ? subtrair(outra.cells, depoisOutra.cells)
          : subtrair(outra.cells, subtrair(outra.cells, ganhas));
        if (!roubadas.length) continue;
        roubadasPorSala.set(outra.id, roubadas);
        restantes = subtrair(restantes, roubadas);
      }

      if (restantes.length > 0) {
        cmds.push({
          tipo: 'comodo.apagar',
          celulas: decodificar(restantes),
          levelId: nivel,
        });
      }
      for (const [outraId, roubadas] of roubadasPorSala) {
        if (mapaDepois.rooms[outraId]) {
          cmds.push({ tipo: 'comodo.pintar', id: outraId, celulas: decodificar(roubadas) });
        } else {
          cmds.push(...comandosRestaurarComodo(mapaAntes, mapaAntes.rooms[outraId]!, decodificar(roubadas)));
        }
      }
      return cmds;
    }

    case 'comodo.apagar': {
      const nivel = cmd.levelId ?? null;
      const tocadas = normalizar(cmd.celulas.map(([x, y]) => [x, y] as const));
      if (!tocadas.length) return [];
      const cmds: Comando[] = [];
      for (const sala of Object.values(mapaAntes.rooms)) {
        if ((sala.levelId ?? null) !== nivel) continue;
        const depoisSala = mapaDepois.rooms[sala.id];
        const perdidas = depoisSala ? subtrair(sala.cells, depoisSala.cells) : sala.cells;
        if (!perdidas.length) continue;
        if (depoisSala) {
          cmds.push({ tipo: 'comodo.pintar', id: sala.id, celulas: decodificar(perdidas) });
        } else {
          cmds.push(...comandosRestaurarComodo(mapaAntes, sala, decodificar(perdidas)));
        }
      }
      return cmds;
    }

    case 'comodo.atualizar': {
      const antesSala = mapaAntes.rooms[cmd.id];
      const depoisSala = mapaDepois.rooms[cmd.id];
      if (!antesSala) return [];
      const { outline: novoContorno, ...resto } = cmd.patch;
      const patch = calcularPatchInverso(antesSala as unknown as Record<string, unknown>, resto as Record<string, unknown>);
      const cmds: Comando[] = [];

      if ('outline' in cmd.patch) {
        if (antesSala.outline !== undefined) {
          patch.outline = clonar(antesSala.outline);
        } else {
          patch.outline = null;
        }
      }

      if (Object.keys(patch).length > 0) {
        cmds.push({
          tipo: 'comodo.atualizar',
          id: cmd.id,
          patch: patch as Extract<ComandoConstruir, { tipo: 'comodo.atualizar' }>['patch'],
        });
      }

      if ('outline' in cmd.patch && depoisSala && antesSala.outline === undefined) {
        const extras = subtrair(depoisSala.cells, antesSala.cells);
        if (extras.length > 0) {
          cmds.push({
            tipo: 'comodo.apagar',
            celulas: decodificar(extras),
            levelId: antesSala.levelId ?? null,
          });
        }
        const faltando = subtrair(antesSala.cells, depoisSala.cells);
        if (faltando.length > 0) {
          cmds.push({
            tipo: 'comodo.pintar',
            id: cmd.id,
            celulas: decodificar(faltando),
          });
        }
      }

      if (novoContorno !== undefined) {
        cmds.push(...comandosRestaurarCelulasRoubadas(mapaAntes, mapaDepois, antesSala.levelId ?? null, cmd.id));
      }
      return cmds;
    }

    case 'comodo.notas': {
      const antesExtra = mapaAntes.comodosExtra[cmd.id];
      const patch: Extract<ComandoConstruir, { tipo: 'comodo.notas' }>['patch'] = {};
      if (cmd.patch.leitura !== undefined) patch.leitura = antesExtra?.leitura ?? '';
      if (cmd.patch.notasMestre !== undefined) patch.notasMestre = antesExtra?.notasMestre ?? '';
      if (cmd.patch.refs !== undefined) patch.refs = clonar(antesExtra?.refs ?? []);
      if (!Object.keys(patch).length) return [];
      return [{ tipo: 'comodo.notas', id: cmd.id, patch }];
    }

    case 'parede.adicionar':
      return [{ tipo: 'parede.remover', id: cmd.parede.id }];

    case 'parede.atualizar': {
      const antes = mapaAntes.walls[cmd.id];
      if (!antes) return [];
      const patch = calcularPatchInverso(antes as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      if (!Object.keys(patch).length) return [];
      return [{ tipo: 'parede.atualizar', id: cmd.id, patch }];
    }

    case 'parede.remover': {
      const antes = mapaAntes.walls[cmd.id];
      if (!antes) return [];
      const cmds: Comando[] = [{ tipo: 'parede.adicionar', parede: comandoParedeSemSource(antes) }];
      for (const a of Object.values(mapaAntes.openings)) {
        if (a.wallId === cmd.id && !mapaDepois.openings[a.id]) {
          cmds.push({ tipo: 'abertura.adicionar', abertura: clonar(a) });
          if (mapaAntes.session.revealed.includes(a.id) && !mapaDepois.session.revealed.includes(a.id)) {
            cmds.push({ tipo: 'sessao.revelar', ids: [a.id] });
          }
        }
      }
      for (const o of Object.values(mapaAntes.props)) {
        if (o.wall?.wallId === cmd.id && !mapaDepois.props[o.id]) {
          cmds.push({ tipo: 'item.adicionar', colecao: 'props', item: clonar(o) });
          cmds.push(...comandosRestaurarLuzesDoDono(mapaAntes, mapaDepois, o, 'props'));
          if (mapaAntes.session.revealed.includes(o.id) && !mapaDepois.session.revealed.includes(o.id)) {
            cmds.push({ tipo: 'sessao.revelar', ids: [o.id] });
          }
        }
      }
      return cmds;
    }

    case 'parede.desanexar': {
      const antes = mapaAntes.walls[cmd.id];
      if (antes?.source && 'roomId' in antes.source && mapaAntes.rooms[antes.source.roomId]) {
        return [{ tipo: 'parede.remover', id: cmd.id }];
      }
      return [];
    }

    case 'abertura.adicionar':
      return [{ tipo: 'abertura.remover', id: cmd.abertura.id }];

    case 'abertura.atualizar': {
      const antes = mapaAntes.openings[cmd.id];
      if (!antes) return [];
      const patch = calcularPatchInverso(antes as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      if (!Object.keys(patch).length) return [];
      return [{ tipo: 'abertura.atualizar', id: cmd.id, patch }];
    }

    case 'abertura.remover': {
      const antes = mapaAntes.openings[cmd.id];
      if (!antes) return [];
      const cmds: Comando[] = [{ tipo: 'abertura.adicionar', abertura: clonar(antes) }];
      if (mapaAntes.session.revealed.includes(cmd.id) && !mapaDepois.session.revealed.includes(cmd.id)) {
        cmds.push({ tipo: 'sessao.revelar', ids: [cmd.id] });
      }
      return cmds;
    }

    case 'terreno.pintar': {
      const alteradas = celulasAlteradasDeTerreno(
        mapaAntes,
        mapaDepois,
        cmd.suavizar ? undefined : cmd.celulas,
      );
      if (!alteradas.length) return [];
      if (cmd.lembrar) {
        return [{ tipo: 'terreno.emergir', material: cmd.material, celulas: alteradas }];
      }
      return inverterTerrenoPorDiferenca(mapaAntes, mapaDepois, alteradas);
    }

    case 'terreno.apagar': {
      const alteradas = celulasAlteradasDeTerreno(mapaAntes, mapaDepois, cmd.celulas);
      if (!alteradas.length) return [];
      return inverterTerrenoPorDiferenca(mapaAntes, mapaDepois, alteradas);
    }

    case 'terreno.emergir': {
      const alteradas = celulasAlteradasDeTerreno(mapaAntes, mapaDepois);
      if (!alteradas.length) return [];
      return [{ tipo: 'terreno.pintar', material: cmd.material, celulas: alteradas, lembrar: true }];
    }

    case 'terreno.base':
      return [{ tipo: 'terreno.base', material: mapaAntes.terrain.base }];

    case 'terreno.correnteza': {
      const camada = mapaAntes.terrain.layers[idDaCamadaTerreno(cmd.material)];
      return [
        {
          tipo: 'terreno.correnteza',
          material: cmd.material,
          flow: camada?.flow ? clonar(camada.flow) : null,
        },
      ];
    }

    case 'relevo.pintar':
    case 'relevo.apagar':
      return inverterRelevo(mapaAntes, mapaDepois);

    case 'presenca.pintar': {
      const nivel = cmd.levelId ?? null;
      const id = idDaPresenca(cmd.brush, nivel);
      const antes = mapaAntes.presence[id];
      const depois = mapaDepois.presence[id];
      if (!depois) return [];
      const cmds: Comando[] = [];
      const adicionadas = subtrair(depois.cells, antes?.cells ?? []);
      if (adicionadas.length > 0) {
        cmds.push({
          tipo: 'presenca.apagar',
          brush: cmd.brush,
          celulas: decodificar(adicionadas),
          levelId: nivel,
        });
      }
      if (antes && antes.intensity !== depois.intensity) {
        cmds.push({
          tipo: 'item.atualizar',
          colecao: 'presence',
          id,
          patch: { intensity: antes.intensity },
        });
      }
      return cmds;
    }

    case 'presenca.apagar': {
      const nivel = cmd.levelId ?? null;
      const cmds: Comando[] = [];
      for (const p of Object.values(mapaAntes.presence)) {
        if ((p.levelId ?? null) !== nivel) continue;
        if (cmd.brush !== null && p.brush !== cmd.brush) continue;
        const depois = mapaDepois.presence[p.id];
        const removidas = depois ? subtrair(p.cells, depois.cells) : p.cells;
        if (!removidas.length) continue;
        cmds.push({
          tipo: 'presenca.pintar',
          brush: p.brush,
          celulas: decodificar(removidas),
          intensidade: p.intensity,
          levelId: nivel,
        });
        if (!depois && (p.gmOnly || p.seed !== sementeDaPresenca(p.brush))) {
          cmds.push({
            tipo: 'item.atualizar',
            colecao: 'presence',
            id: p.id,
            patch: { gmOnly: p.gmOnly, seed: p.seed },
          });
        }
      }
      return cmds;
    }

    case 'mapa.renomear':
      return [{ tipo: 'mapa.renomear', nome: mapaAntes.name }];

    case 'mapa.notas':
      return [{ tipo: 'mapa.notas', texto: mapaAntes.notes }];

    case 'mapa.campanha':
      return [{ tipo: 'mapa.campanha', campanhaId: mapaAntes.campanhaId }];

    case 'mapa.audio':
      return [{ tipo: 'mapa.audio', ref: mapaAntes.audioCue ? clonar(mapaAntes.audioCue) : null }];

    case 'grade.atualizar': {
      const patch = calcularPatchInverso(mapaAntes.grid as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      return Object.keys(patch).length ? [{ tipo: 'grade.atualizar', patch }] : [];
    }

    case 'limites.atualizar':
      return [{ tipo: 'limites.atualizar', largura: mapaAntes.bounds.width, altura: mapaAntes.bounds.height }];

    case 'estilo.atualizar': {
      const patch = calcularPatchInverso(mapaAntes.style as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      return Object.keys(patch).length ? [{ tipo: 'estilo.atualizar', patch }] : [];
    }

    case 'clima.aplicar': {
      const patch = calcularPatchInverso(mapaAntes.climate as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      if (typeof cmd.patch.time === 'string') {
        if (patch.sun === undefined && JSON.stringify(mapaAntes.climate.sun) !== JSON.stringify(mapaDepois.climate.sun)) {
          patch.sun = clonar(mapaAntes.climate.sun);
        }
        if (patch.ambient === undefined && JSON.stringify(mapaAntes.climate.ambient) !== JSON.stringify(mapaDepois.climate.ambient)) {
          patch.ambient = clonar(mapaAntes.climate.ambient);
        }
      }
      return Object.keys(patch).length ? [{ tipo: 'clima.aplicar', patch }] : [];
    }

    case 'clima.predefinir': {
      const cmds: Comando[] = [];
      const patchClima = calcularPatchInverso(
        mapaAntes.climate as unknown as Record<string, unknown>,
        mapaDepois.climate as unknown as Record<string, unknown>,
      );
      if (Object.keys(patchClima).length) cmds.push({ tipo: 'clima.aplicar', patch: patchClima });
      const patchAcab = calcularPatchInverso(
        mapaAntes.finish as unknown as Record<string, unknown>,
        mapaDepois.finish as unknown as Record<string, unknown>,
      );
      if (Object.keys(patchAcab).length) cmds.push({ tipo: 'acabamento.atualizar', patch: patchAcab });
      return cmds;
    }

    case 'clima.salvar': {
      for (const id of Object.keys(mapaDepois.customClimates)) {
        if (!mapaAntes.customClimates[id]) return [{ tipo: 'clima.esquecer', id }];
      }
      return [];
    }

    case 'clima.audio':
      return [
        {
          tipo: 'clima.audio',
          id: cmd.id,
          ref: mapaAntes.climateAudio[cmd.id] ? clonar(mapaAntes.climateAudio[cmd.id]!) : null,
        },
      ];

    case 'momento.salvar': {
      const anterior = mapaAntes.moments[cmd.momento.id];
      return anterior
        ? [{ tipo: 'momento.salvar', momento: clonar(anterior) }]
        : [{ tipo: 'momento.remover', id: cmd.momento.id }];
    }

    case 'momento.remover': {
      const anterior = mapaAntes.moments[cmd.id];
      return anterior ? [{ tipo: 'momento.salvar', momento: clonar(anterior) }] : [];
    }

    case 'acabamento.atualizar': {
      const patch = calcularPatchInverso(mapaAntes.finish as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      return Object.keys(patch).length ? [{ tipo: 'acabamento.atualizar', patch }] : [];
    }

    case 'fundo.atualizar': {
      const patch = calcularPatchInverso(mapaAntes.backdrop as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      return Object.keys(patch).length ? [{ tipo: 'fundo.atualizar', patch }] : [];
    }

    case 'memoria.atualizar': {
      const patch = calcularPatchInverso(mapaAntes.memory as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      if (cmd.patch.mode === undefined && typeof cmd.patch.sketch === 'boolean' && mapaAntes.memory.mode !== mapaDepois.memory.mode) {
        patch.mode = mapaAntes.memory.mode;
      }
      return Object.keys(patch).length ? [{ tipo: 'memoria.atualizar', patch }] : [];
    }

    case 'andar.criar':
      return [{ tipo: 'andar.remover', id: cmd.andar.id }];

    case 'andar.atualizar': {
      if (cmd.id === null) {
        if (cmd.patch.name === undefined) return [];
        return [{ tipo: 'andar.atualizar', id: null, patch: { name: mapaAntes.groundLevelName ?? 'Térreo' } }];
      }
      const antes = mapaAntes.levels?.[cmd.id];
      if (!antes) return [];
      const patch = calcularPatchInverso(antes as unknown as Record<string, unknown>, cmd.patch as Record<string, unknown>);
      return Object.keys(patch).length ? [{ tipo: 'andar.atualizar', id: cmd.id, patch }] : [];
    }

    case 'andar.remover': {
      const antes = mapaAntes.levels?.[cmd.id];
      if (!antes) return [];
      const cmds: Comando[] = [{ tipo: 'andar.criar', andar: clonar(antes) }];
      for (const s of Object.values(mapaAntes.rooms)) {
        if ((s.levelId ?? null) === cmd.id) cmds.push(...comandosRestaurarComodo(mapaAntes, s));
      }
      for (const w of Object.values(mapaAntes.walls)) {
        if ((w.levelId ?? null) === cmd.id && w.source === null) {
          cmds.push({ tipo: 'parede.adicionar', parede: comandoParedeSemSource(w) });
        }
      }
      for (const a of Object.values(mapaAntes.openings)) {
        const w = mapaAntes.walls[a.wallId];
        if (w && (w.levelId ?? null) === cmd.id && !mapaDepois.openings[a.id]) {
          cmds.push({ tipo: 'abertura.adicionar', abertura: clonar(a) });
        }
      }
      for (const o of Object.values(mapaAntes.props)) {
        if ((o.levelId ?? null) === cmd.id) {
          cmds.push({ tipo: 'item.adicionar', colecao: 'props', item: clonar(o) });
          cmds.push(...comandosRestaurarLuzesDoDono(mapaAntes, mapaDepois, o, 'props'));
        } else if (o.interaction?.kind === 'stairs' && o.interaction.toLevel === cmd.id && mapaDepois.props[o.id]) {
          cmds.push({
            tipo: 'item.atualizar',
            colecao: 'props',
            id: o.id,
            patch: { interaction: clonar(o.interaction) },
          });
        }
      }
      for (const l of Object.values(mapaAntes.lights)) {
        if ((l.levelId ?? null) === cmd.id && !l.ownerId) {
          cmds.push({ tipo: 'item.adicionar', colecao: 'lights', item: clonar(l) });
        }
      }
      for (const r of Object.values(mapaAntes.regions)) {
        if ((r.levelId ?? null) === cmd.id) cmds.push({ tipo: 'item.adicionar', colecao: 'regions', item: clonar(r) });
      }
      for (const p of Object.values(mapaAntes.presence)) {
        if ((p.levelId ?? null) === cmd.id) cmds.push({ tipo: 'item.adicionar', colecao: 'presence', item: clonar(p as Presenca) });
      }
      for (const t of Object.values(mapaAntes.tokens)) {
        if ((t.levelId ?? null) === cmd.id) {
          const peca = clonar(t);
          const lId = peca.lightId;
          if (lId && mapaAntes.lights[lId]?.ownerId === t.id) peca.lightId = null;
          cmds.push({ tipo: 'item.adicionar', colecao: 'tokens', item: peca });
          cmds.push(...comandosRestaurarLuzesDoDono(mapaAntes, mapaDepois, t, 'tokens'));
          if (lId && peca.lightId === null) {
            cmds.push({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch: { lightId: lId } });
          }
        }
      }
      return cmds;
    }

    case 'sessao.telhados':
      return [{ tipo: 'sessao.telhados', modo: mapaAntes.session.roofs ?? 'auto' }];

    case 'sessao.revelar': {
      const adicionados = cmd.ids.filter(id => !mapaAntes.session.revealed.includes(id));
      return adicionados.length ? [{ tipo: 'sessao.ocultar', ids: adicionados }] : [];
    }

    case 'sessao.ocultar': {
      const removidos = cmd.ids.filter(id => mapaAntes.session.revealed.includes(id));
      return removidos.length ? [{ tipo: 'sessao.revelar', ids: removidos }] : [];
    }

    default:
      return [];
  }
}

/**
 * Calcula a sequência de comandos compensatórios puros para reverter `comandos`
 * aplicados entre `mapaAntes` e `mapaDepois`, na ordem reversa dos passos.
 */
export function calcularInversoComandos(
  mapaAntes: MapaAtlas,
  mapaDepois: MapaAtlas,
  comandos: readonly Comando[],
): Comando[] {
  if (comandos.length === 0) return [];
  if (comandos.length === 1) {
    return calcularInversoUnico(mapaAntes, mapaDepois, comandos[0]!);
  }

  const inversosPorPasso: Comando[][] = [];
  let atual = mapaAntes;
  for (const cmd of comandos) {
    let proximo: MapaAtlas;
    try {
      proximo = aplicarComando(atual, cmd);
    } catch (erro) {
      if (erro instanceof ErroDeComando) continue;
      throw erro;
    }
    if (proximo === atual) continue;
    const inv = calcularInversoUnico(atual, proximo, cmd);
    if (inv.length > 0) inversosPorPasso.push(inv);
    atual = proximo;
  }

  const saida: Comando[] = [];
  for (let i = inversosPorPasso.length - 1; i >= 0; i--) {
    saida.push(...inversosPorPasso[i]!);
  }
  return saida;
}

/**
 * Filtra/adapta comandos compensatórios contra o `mapaAtual` (que pode conter edições de outros
 * participantes), pulando comandos que lançarem `ErroDeComando` e preservando apenas alvos existentes.
 */
export function filtrarComandosCompensatorios(
  mapaAtual: MapaAtlas,
  comandos: readonly Comando[],
): Comando[] {
  const validos: Comando[] = [];
  let atual = mapaAtual;

  for (const cmd of comandos) {
    let candidato = cmd;
    if (candidato.tipo === 'selecao.mover') {
      const alvos = candidato.alvos.filter(
        a => (atual[a.colecao] as Record<string, unknown>)[a.id] !== undefined,
      );
      if (!alvos.length) continue;
      candidato = { ...candidato, alvos };
    } else if (candidato.tipo === 'objeto.camada' || candidato.tipo === 'objeto.visibilidade') {
      const ids = candidato.ids.filter(id => atual.props[id] !== undefined);
      if (!ids.length) continue;
      candidato = { ...candidato, ids };
    } else if (candidato.tipo === 'luz.estado') {
      const ids = candidato.ids.filter(
        id =>
          atual.lights[id] !== undefined ||
          atual.props[id] !== undefined ||
          Object.values(atual.lights).some(l => l.ownerId === id),
      );
      if (!ids.length) continue;
      candidato = { ...candidato, ids };
    }

    try {
      const proximo = aplicarComando(atual, candidato);
      validos.push(clonar(candidato));
      atual = proximo;
    } catch (erro) {
      if (erro instanceof ErroDeComando) continue;
      throw erro;
    }
  }

  return validos;
}

/**
 * Pilha de desfazer/refazer por autor para o modo construção colaborativo:
 * guarda apenas comandos compensatórios mínimos das operações próprias confirmadas (`opId`),
 * sem reverter edições de outros participantes.
 */
export function criarPilhaDesfazerColaborativo(limite = 100): PilhaDesfazerColaborativo {
  const maxEntradas = Math.max(1, limite);
  const pendentes = new Map<string, OperacaoPendenteDesfazer>();
  let pilhaDesfazer: EntradaPilhaColaborativa[] = [];
  let pilhaRefazer: EntradaPilhaColaborativa[] = [];

  return {
    get podeDesfazer() {
      return pilhaDesfazer.length > 0;
    },
    get podeRefazer() {
      return pilhaRefazer.length > 0;
    },
    get rotuloDesfazer() {
      return pilhaDesfazer.at(-1)?.rotulo ?? '';
    },
    get rotuloRefazer() {
      return pilhaRefazer.at(-1)?.rotulo ?? '';
    },

    registrarPendente(opId, rotulo, mapaAntes, mapaDepois, comandos, origem = 'normal') {
      if (!opId || comandos.length === 0) return;
      const rotuloFinal = rotulo || ROTULOS[comandos[0]!.tipo];
      pendentes.set(opId, {
        rotulo: rotuloFinal,
        mapaAntes,
        mapaDepois,
        comandos: clonar(comandos) as Comando[],
        origem,
      });
    },

    descartarPendente(opId) {
      pendentes.delete(opId);
    },

    confirmar(opId) {
      const pend = pendentes.get(opId);
      if (!pend) return false;
      pendentes.delete(opId);
      if (pend.origem === 'normal') {
        const desfazer = calcularInversoComandos(pend.mapaAntes, pend.mapaDepois, pend.comandos);
        if (desfazer.length === 0) return false;
        pilhaDesfazer.push({
          rotulo: pend.rotulo,
          desfazer,
          refazer: clonar(pend.comandos) as Comando[],
        });
        while (pilhaDesfazer.length > maxEntradas) pilhaDesfazer.shift();
        pilhaRefazer = [];
      }
      return true;
    },

    prepararDesfazer(mapaAtual) {
      const entrada = pilhaDesfazer.pop();
      if (!entrada) return null;
      const comandos = filtrarComandosCompensatorios(mapaAtual, entrada.desfazer);
      pilhaRefazer.push(entrada);
      return { rotulo: entrada.rotulo, comandos };
    },

    prepararRefazer(mapaAtual) {
      const entrada = pilhaRefazer.pop();
      if (!entrada) return null;
      const comandos = filtrarComandosCompensatorios(mapaAtual, entrada.refazer);
      pilhaDesfazer.push(entrada);
      while (pilhaDesfazer.length > maxEntradas) pilhaDesfazer.shift();
      return { rotulo: entrada.rotulo, comandos };
    },

    limpar() {
      pendentes.clear();
      pilhaDesfazer = [];
      pilhaRefazer = [];
    },
  };
}
