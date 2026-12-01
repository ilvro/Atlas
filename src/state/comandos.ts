import type { Ref } from '#mesa';
import { ceuNoHorario } from '../domain/clima.ts';
import { camadaDoObjeto } from '../domain/camadas.ts';
import { ErroDeValidacao } from '../domain/esquema.ts';
import { clonar, produzir } from './imutavel.ts';
import { COLECOES_LIVRES, type Acabamento, type Andar, type Clima, type ColecaoLivre, type Estilo, type Fundo, type Grade, type Luz, type Memoria, type MapaAtlas, type ModoTelhadosSessao, type NomeColecao, type Objeto, type Peca, type Ponto, type Presenca, type Regiao } from '../domain/mapa.ts';
import { andarDe, mapaDoAndar } from '../domain/andares.ts';
import { atualizarSalasDosObjetos } from '../domain/geometria.ts';
import { desvincularLuz, sincronizarLuzesProprias } from '../domain/luz-propria.ts';
import { alvosDoInterruptor } from '../domain/interagiveis.ts';
import { definirValor, iniciar, passo, podar } from '../domain/iniciativa.ts';
import { celulasVisiveis, exploradoAgora, modoDeVisaoDaPeca, RES_NEVOA } from '../domain/nevoa.ts';
import { anguloDoMovimento, bloqueioNoCaminho, centroDaCelula, ladoDoMovimento } from '../domain/movimento.ts';
import { presetDeClima } from '../domain/presets.ts';
import { validarMapa } from '../domain/validacao.ts';
import { momentoValido, type Momento } from '../domain/momentos.ts';
import { aplicarConstrucao, ehComandoDeConstrucao, ErroDeComando, ROTULOS_CONSTRUIR, type ComandoConstruir, type ParcialProfundo } from './comandos-construir.ts';

export { COLECOES_LIVRES, type ColecaoLivre };

export { ErroDeComando };
export type { ParcialProfundo };
export type EntidadeLivre = Objeto | Luz | Peca | Regiao | Presenca;
export type ItemParaAdicionar = EntidadeLivre | ({ id: string } & Record<string, unknown>);
export type PatchDeItem =
  | ParcialProfundo<Objeto>
  | ParcialProfundo<Luz>
  | ParcialProfundo<Peca>
  | ParcialProfundo<Regiao>
  | ParcialProfundo<Presenca>
  | Record<string, unknown>;

export interface AlvoMovel { colecao: ColecaoLivre; id: string }

export type Comando =
  | ComandoConstruir
  | { tipo: 'mapa.renomear'; nome: string }
  | { tipo: 'mapa.notas'; texto: string }
  | { tipo: 'mapa.campanha'; campanhaId: string | null }
  | { tipo: 'grade.atualizar'; patch: ParcialProfundo<Grade> }
  | { tipo: 'limites.atualizar'; largura: number; altura: number }
  | { tipo: 'estilo.atualizar'; patch: ParcialProfundo<Estilo> }
  | { tipo: 'clima.aplicar'; patch: ParcialProfundo<Clima> }
  | { tipo: 'clima.predefinir'; id: string }
  | { tipo: 'clima.salvar'; nome: string; id?: string }
  | { tipo: 'clima.esquecer'; id: string }
  | { tipo: 'momento.salvar'; momento: Momento }
  | { tipo: 'momento.remover'; id: string }
  | { tipo: 'clima.audio'; id: string; ref: Ref | null }
  /** A cena sonora do mapa (toca ao abrir o mapa na sessão); `null` tira. */
  | { tipo: 'mapa.audio'; ref: Ref | null }
  | { tipo: 'acabamento.atualizar'; patch: ParcialProfundo<Acabamento> }
  | { tipo: 'fundo.atualizar'; patch: ParcialProfundo<Fundo> }
  | { tipo: 'memoria.atualizar'; patch: ParcialProfundo<Memoria> }
  | { tipo: 'item.adicionar'; colecao: ColecaoLivre; item: ItemParaAdicionar }
  | { tipo: 'item.atualizar'; colecao: ColecaoLivre; id: string; patch: PatchDeItem }
  | { tipo: 'item.remover'; colecao: ColecaoLivre; id: string }
  /** Muda a camada dos objetos: `frente`/`tras` passam por cima/por baixo de todos; `subir`/`descer` andam uma camada. */
  | { tipo: 'objeto.camada'; ids: string[]; modo: 'frente' | 'tras' | 'subir' | 'descer' }
  /** Liga, desliga ou alterna luzes diretamente ou pelos objetos donos (tochas, lampiões). */
  | { tipo: 'luz.estado'; ids: string[]; acao: 'ligar' | 'desligar' | 'alternar' }
  /** Mostra ou esconde objetos (escondido dos jogadores no projetor). */
  | { tipo: 'objeto.visibilidade'; ids: string[]; acao: 'mostrar' | 'esconder' }
  /** Uma sugestão do assistente aceita: vários comandos como UMA entrada de histórico. Não aninha. */
  | { tipo: 'proposta.aceitar'; rotulo: string; comandos: Comando[] }
  | { tipo: 'selecao.mover'; alvos: AlvoMovel[]; delta: Ponto }
  /** Anda com uma peça: encaixa no centro da célula (a menos que `semGrade`) e recusa atravessar parede ou porta fechada (a menos que `livre`). `emArrasto` pula a atualização da memória explorada nos quadros intermediários. */
  | { tipo: 'peca.mover'; id: string; para: Ponto; livre?: boolean; semGrade?: boolean; emArrasto?: boolean; direcao?: number }
  /** Gira o cone da lanterna da peça para `direcao` (rad), sem mover a peça. */
  | { tipo: 'peca.virar'; id: string; direcao: number }
  /** Transfere uma peça para outro andar (por uma escada) e, opcionalmente, para uma nova posição. */
  | { tipo: 'peca.mudarAndar'; id: string; levelId: string | null; position?: Ponto }
  /** Zera o que as peças já exploraram ("Recomeçar a exploração"). */
  | { tipo: 'sessao.esquecer'; andar?: string | null }
  /** Revela cômodos inteiros (contam como explorados) ou portas secretas aos jogadores, ou os esconde de novo. */
  | { tipo: 'sessao.revelar'; ids: string[] }
  | { tipo: 'sessao.ocultar'; ids: string[] }
  /** Soma ao explorado o que as peças de jogador veem agora (abrir ou fechar uma porta muda o que elas veem). */
  | { tipo: 'sessao.explorar' }
  /** Controla os telhados durante a sessão ('auto' abre ao entrar; 'fechados' mantém cobertos; 'abertos' abre todos). */
  | { tipo: 'sessao.telhados'; modo: ModoTelhadosSessao }
  /** Começa um combate com estas peças (do maior valor para o menor). */
  /** Usa um objeto interativo: o interruptor liga ou desliga as luzes dele, a gaveta abre ou fecha. */
  | { tipo: 'interagir'; id: string }
  | { tipo: 'iniciativa.iniciar'; entradas: { tokenId: string; value: number }[] }
  | { tipo: 'iniciativa.passo'; passo: 1 | -1 }
  | { tipo: 'iniciativa.valor'; tokenId: string; value: number }
  | { tipo: 'iniciativa.encerrar' }
  | { tipo: 'andar.criar'; andar: Andar }
  | { tipo: 'andar.atualizar'; id: string | null; patch: { name?: string; order?: number } }
  | { tipo: 'andar.remover'; id: string };

const nao = (msg: string): never => { throw new ErroDeComando(msg); };

const ehPlano = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Mistura `patch` em `alvo`: objetos entram por dentro, o resto substitui. `undefined` apaga o campo. */
function mesclar(alvo: Record<string, any>, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete alvo[k];
    else if (ehPlano(v) && ehPlano(alvo[k])) mesclar(alvo[k], v);
    else alvo[k] = clonar(v);
  }
}

function existente(m: MapaAtlas, colecao: ColecaoLivre, id: string): Record<string, any> {
  const item = (m[colecao] as Record<string, any>)[id];
  return item ?? nao(`Não existe “${id}” em ${colecao}.`);
}

/** Remove um item e tudo que dependia dele, para o documento nunca ficar com referências soltas. */
function remover(m: MapaAtlas, colecao: ColecaoLivre, id: string): void {
  existente(m, colecao, id);
  delete (m[colecao] as Record<string, unknown>)[id];
  if (colecao === 'props' || colecao === 'tokens') {
    // Luzes que pertenciam ao item vão com ele; o token que usava a luz fica sem lanterna.
    for (const luz of Object.values(m.lights)) if (luz.ownerId === id) remover(m, 'lights', luz.id);
    if (colecao === 'tokens') m.session.initiative = podar(m.session.initiative, t => t !== id);
  }
  if (colecao === 'lights') desvincularLuz(m, id);
  if (m.session.revealed.includes(id)) m.session.revealed = m.session.revealed.filter(x => x !== id);
}

function aplicar(m: MapaAtlas, c: Comando): void {
  if (ehComandoDeConstrucao(c)) { aplicarConstrucao(m, c); return; }
  switch (c.tipo) {
    case 'proposta.aceitar': {
      if (!c.comandos.length) nao('A sugestão está vazia.');
      for (const filho of c.comandos) { if (filho.tipo === 'proposta.aceitar') nao('Uma sugestão não pode conter outra.'); aplicar(m, filho); }
      break;
    }
    case 'mapa.renomear': m.name = c.nome; break;
    case 'mapa.notas': m.notes = c.texto; break;
    case 'mapa.campanha': m.campanhaId = c.campanhaId; break;
    case 'grade.atualizar': mesclar(m.grid, c.patch); break;
    case 'limites.atualizar': m.bounds.width = c.largura; m.bounds.height = c.altura; break;
    case 'estilo.atualizar': mesclar(m.style, c.patch); break;
    case 'clima.aplicar': {
      const patch: Record<string, unknown> = { ...c.patch };
      // Mexer no horário move o sol (ou a lua) e o ambiente, a menos que o próprio comando diga como ficam.
      if (typeof patch.time === 'string') {
        let ceu; try { ceu = ceuNoHorario(patch.time); } catch { return nao(`Horário inválido: “${patch.time}”. Use HH:MM.`); }
        if (patch.sun === undefined) patch.sun = ceu.sun;          // `sun: null` é uma escolha (sem sol), não um "não informado"
        if (patch.ambient === undefined) patch.ambient = ceu.ambient;
      }
      mesclar(m.climate, patch); break;
    }
    case 'clima.predefinir': {
      const feito = presetDeClima(c.id), salvo = m.customClimates[c.id];
      if (feito) { m.climate = { preset: feito.id, ...clonar(feito.climate) } as Clima; m.finish = clonar(feito.finish); }
      else if (salvo) { m.climate = { preset: salvo.id, ...clonar(salvo.climate) } as Clima; m.finish = { preset: 'personalizado', ...clonar(salvo.finish) } as Acabamento; }
      else nao(`Clima desconhecido: “${c.id}”.`);
      break;
    }
    case 'clima.salvar': {
      const nome = c.nome.trim(); if (!nome) nao('Dê um nome ao clima.');
      const id = c.id ?? `usuario-${crypto.randomUUID()}`;
      if (m.customClimates[id]) nao('Já existe um clima com esse identificador.');
      const { preset: _p, ...clima } = clonar(m.climate), { preset: _f, ...acab } = clonar(m.finish);
      m.customClimates[id] = { id, name: nome, climate: clima, finish: acab };
      break;
    }
    case 'mapa.audio': m.audioCue = c.ref === null ? null : clonar(c.ref); break;
    case 'clima.audio': {
      if (!presetDeClima(c.id) && !m.customClimates[c.id]) nao('Esse clima não existe.');
      const id = presetDeClima(c.id)?.id ?? c.id;
      if (c.ref === null) delete m.climateAudio[id]; else m.climateAudio[id] = clonar(c.ref); break;
    }
    case 'clima.esquecer': {
      if (!m.customClimates[c.id]) nao('Esse clima salvo não existe.');
      delete m.customClimates[c.id]; delete m.climateAudio[c.id]; break;
    }
    case 'momento.salvar': {
      const erro = momentoValido(c.momento);
      if (erro) nao(erro);
      m.moments[c.momento.id] = clonar(c.momento);
      break;
    }
    case 'momento.remover': {
      if (!m.moments[c.id]) nao('Esse momento não existe.');
      delete m.moments[c.id];
      break;
    }
    case 'acabamento.atualizar': mesclar(m.finish, c.patch); break;
    case 'fundo.atualizar': mesclar(m.backdrop, c.patch); break;
    case 'memoria.atualizar': {
      mesclar(m.memory, c.patch);
      if (c.patch.mode === undefined && typeof c.patch.sketch === 'boolean') {
        m.memory.mode = c.patch.sketch ? 'sketch' : 'shroud';
      }
      break;
    }
    case 'item.adicionar': {
      if (!(COLECOES_LIVRES as readonly string[]).includes(c.colecao)) nao(`“${c.colecao}” não aceita itens genéricos.`);
      const colecao = m[c.colecao] as Record<string, unknown>;
      if (colecao[c.item.id]) nao(`Já existe “${c.item.id}” em ${c.colecao}.`);
      colecao[c.item.id] = clonar(c.item);
      if (c.colecao === 'props') atualizarSalasDosObjetos(m);
      break;
    }
    case 'item.atualizar': {
      const item = existente(m, c.colecao, c.id);
      const patch = c.patch as Record<string, unknown>;
      if ('id' in patch && patch.id !== c.id) nao('O identificador não muda.');
      mesclar(item, patch);
      if (c.colecao === 'props') atualizarSalasDosObjetos(m);
      break;
    }
    case 'item.remover': remover(m, c.colecao, c.id); break;
    case 'objeto.camada': {
      const alvos = c.ids.map(id => m.props[id] ?? nao(`Não existe “${id}” em props.`));
      const outras = Object.values(m.props).filter(o => !c.ids.includes(o.id)).map(camadaDoObjeto);
      if (c.modo === 'frente') { const topo = Math.max(0, ...outras) + 1; for (const o of alvos) o.layer = topo; }
      else if (c.modo === 'tras') { const base = Math.min(0, ...outras) - 1; for (const o of alvos) o.layer = base; }
      else for (const o of alvos) o.layer = camadaDoObjeto(o) + (c.modo === 'subir' ? 1 : -1);
      break;
    }
    case 'selecao.mover': {
      const [dx, dy] = c.delta;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) nao('Deslocamento inválido.');
      const luzesNosAlvos = new Set(c.alvos.filter(a => a.colecao === 'lights').map(a => a.id));
      const luzesMovidas = new Set<string>();
      for (const { colecao, id } of c.alvos) {
        const item = existente(m, colecao, id);
        if (colecao === 'regions') item.polygon = item.polygon.map(([x, y]: Ponto) => [x + dx, y + dy]);
        else if (item.position) item.position = [item.position[0] + dx, item.position[1] + dy];
        else nao(`“${id}” não tem posição.`);
        if (colecao === 'props' && item.wall) {
          item.wall = null;
          if (item.elevation === 'wall') item.elevation = 'floor';
        }
        if (colecao === 'tokens') {
          const t = item as Peca;
          const luz = t.lightId ? m.lights[t.lightId] : undefined;
          if (luz && !luzesNosAlvos.has(luz.id) && !luzesMovidas.has(luz.id)) {
            luz.position = [luz.position[0] + dx, luz.position[1] + dy];
            luzesMovidas.add(luz.id);
          }
        }
      }
      atualizarSalasDosObjetos(m);
      break;
    }
    case 'peca.mover': {
      const t = m.tokens[c.id] ?? nao(`A peça “${c.id}” não existe.`);
      if (!c.para.every(Number.isFinite)) nao('Destino inválido.');
      const destino: Ponto = c.semGrade ? [c.para[0], c.para[1]] : centroDaCelula(m, c.para), de: Ponto = [t.position[0], t.position[1]];
      if (destino[0] < 0 || destino[1] < 0 || destino[0] > m.bounds.width || destino[1] > m.bounds.height) nao('Fora do mapa.');
      if (Math.hypot(destino[0] - de[0], destino[1] - de[1]) < 1e-6) break;
      const nivel = andarDe(t);
      const antesNivel = mapaDoAndar(m as unknown as MapaAtlas, nivel, true);
      if (!c.livre) { const motivo = bloqueioNoCaminho(antesNivel, de, destino, { levelId: nivel }); if (motivo) nao(motivo); }
      // O que a peça de jogador via de onde estava também fica explorado (antes de ela sair do lugar).
      const res = antesNivel.session.explored?.res ?? RES_NEVOA;
      const viam = t.player && !c.emArrasto ? celulasVisiveis(antesNivel, res) : [];
      const anguloMov = typeof c.direcao === 'number' && Number.isFinite(c.direcao) ? c.direcao : anguloDoMovimento(de, destino);
      const atualizarDirecao = !c.emArrasto || typeof c.direcao === 'number' || Math.hypot(destino[0] - de[0], destino[1] - de[1]) >= 0.08;
      t.position = destino;
      if (atualizarDirecao) {
        t.facing = typeof c.direcao === 'number' && Number.isFinite(c.direcao)
          ? ladoDoMovimento([0, 0], [Math.cos(c.direcao), Math.sin(c.direcao)])
          : ladoDoMovimento(de, destino);
      }
      // A lanterna vai junto e aponta para onde a peça andou.
      const luz = t.lightId ? m.lights[t.lightId] : undefined;
      if (luz) {
        luz.position = [destino[0], destino[1]];
        if (luz.cone && atualizarDirecao) luz.cone.direction = anguloMov;
        if (nivel !== null) luz.levelId = nivel; else delete luz.levelId;
      }
      if ((t.vision.direction !== undefined || modoDeVisaoDaPeca(m, t) === 'cone') && atualizarDirecao) {
        t.vision.direction = anguloMov;
      }
      if (t.player && !c.emArrasto) {
        const exp = exploradoAgora(mapaDoAndar(m as unknown as MapaAtlas, nivel, true), viam);
        if (nivel === null) m.session.explored = exp;
        else { m.session.exploredLevels ??= {}; m.session.exploredLevels[nivel] = exp; }
      }
      break;
    }
    case 'peca.virar': {
      const t = m.tokens[c.id] ?? nao(`A peça “${c.id}” não existe.`);
      if (!Number.isFinite(c.direcao)) nao('Direção inválida.');
      const luz = t.lightId ? m.lights[t.lightId] : undefined;
      const emConeDeVisao = modoDeVisaoDaPeca(m, t) === 'cone' || t.vision.direction !== undefined;
      if (!luz?.cone && !emConeDeVisao) nao('Esta peça não carrega uma lanterna.');
      if (luz?.cone) luz.cone.direction = c.direcao;
      if (emConeDeVisao || luz?.cone) t.vision.direction = c.direcao;
      t.facing = ladoDoMovimento([0, 0], [Math.cos(c.direcao), Math.sin(c.direcao)]);
      break;
    }
    case 'peca.mudarAndar': {
      const t = m.tokens[c.id] ?? nao(`A peça “${c.id}” não existe.`);
      if (c.levelId !== null && !m.levels?.[c.levelId]) nao(`O andar “${c.levelId}” não existe.`);
      const prox = c.position ? centroDaCelula(m, c.position) : t.position;
      if (!prox.every(Number.isFinite) || prox[0] < 0 || prox[1] < 0 || prox[0] > m.bounds.width || prox[1] > m.bounds.height) nao('Fora do mapa.');
      if (c.levelId === null) delete t.levelId;
      else t.levelId = c.levelId;
      t.position = [prox[0], prox[1]];
      const luz = t.lightId ? m.lights[t.lightId] : undefined;
      if (luz) {
        luz.position = [t.position[0], t.position[1]];
        if (c.levelId === null) delete luz.levelId;
        else luz.levelId = c.levelId;
      }
      if (t.player) {
        const escopo = mapaDoAndar(m as unknown as MapaAtlas, c.levelId, true);
        const res = escopo.session.explored?.res ?? RES_NEVOA;
        const exp = exploradoAgora(escopo, celulasVisiveis(escopo, res));
        if (c.levelId === null) m.session.explored = exp;
        else { m.session.exploredLevels ??= {}; m.session.exploredLevels[c.levelId] = exp; }
      }
      break;
    }
    case 'sessao.esquecer': {
      if (c.andar === undefined) {
        m.session.explored = null;
        delete m.session.exploredLevels;
      } else if (c.andar === null) {
        m.session.explored = null;
      } else if (m.session.exploredLevels) {
        delete m.session.exploredLevels[c.andar];
        if (!Object.keys(m.session.exploredLevels).length) delete m.session.exploredLevels;
      }
      break;
    }
    case 'sessao.revelar': {
      for (const id of c.ids) if (!m.rooms[id] && !m.openings[id] && !m.props[id] && !m.regions[id]) nao(`“${id}” não é um cômodo, uma abertura, um objeto nem uma região deste mapa.`);
      m.session.revealed = [...new Set([...m.session.revealed, ...c.ids])];
      break;
    }
    case 'luz.estado': {
      const luzesParaAlterar = new Set<Luz>();
      for (const id of c.ids) {
        let achou = false;
        if (m.lights[id]) { luzesParaAlterar.add(m.lights[id]); achou = true; }
        for (const l of Object.values(m.lights)) {
          if (l.ownerId === id) { luzesParaAlterar.add(l); achou = true; }
        }
        if (!achou && !m.props[id]) nao(`“${id}” não é uma luz nem um objeto deste mapa.`);
      }
      for (const l of luzesParaAlterar) {
        if (c.acao === 'ligar') l.on = true;
        else if (c.acao === 'desligar') l.on = false;
        else if (c.acao === 'alternar') l.on = !l.on;
      }
      break;
    }
    case 'objeto.visibilidade': {
      for (const id of c.ids) {
        const o = m.props[id] ?? nao(`O objeto “${id}” não existe.`);
        o.oculto = c.acao === 'esconder';
      }
      break;
    }
    case 'sessao.explorar': {
      const niveis = new Set<string | null>();
      for (const t of Object.values(m.tokens)) if (t.player) niveis.add(andarDe(t));
      for (const nivel of niveis) {
        const exp = exploradoAgora(mapaDoAndar(m as unknown as MapaAtlas, nivel, true));
        if (nivel === null) m.session.explored = exp;
        else { m.session.exploredLevels ??= {}; m.session.exploredLevels[nivel] = exp; }
      }
      break;
    }
    case 'sessao.ocultar': m.session.revealed = m.session.revealed.filter(id => !c.ids.includes(id)); break;
    case 'sessao.telhados': {
      if (c.modo === 'auto') delete m.session.roofs;
      else m.session.roofs = c.modo;
      break;
    }
    case 'interagir': {
      const o = m.props[c.id] ?? nao(`O objeto “${c.id}” não existe.`), i = o.interaction;
      if (!i) nao('Este objeto não é interativo.');
      else if (i.kind === 'clue') nao('As pistas chegam com a Fase 9.');
      else if (i.kind === 'note' || i.kind === 'stairs') {
        // Uma nota ou escada não altera o documento por interagir
      } else {
        i.on = !i.on;
        if (i.kind === 'switch') for (const id of alvosDoInterruptor(m, o)) { const l = m.lights[id]; if (l) l.on = i.on; }
      }
      break;
    }
    case 'iniciativa.iniciar': {
      if (!c.entradas.length) nao('Escolha ao menos uma peça.');
      if (c.entradas.length > 64) nao('Peças demais na iniciativa.');
      const vistos = new Set<string>();
      for (const x of c.entradas) {
        if (!m.tokens[x.tokenId]) nao(`A peça “${x.tokenId}” não existe.`);
        if (vistos.has(x.tokenId)) nao('Uma peça só entra uma vez na iniciativa.');
        if (!Number.isFinite(x.value) || Math.abs(x.value) > 999) nao('Valor de iniciativa inválido.');
        vistos.add(x.tokenId);
      }
      m.session.initiative = iniciar(c.entradas); break;
    }
    case 'iniciativa.passo': {
      if (!m.session.initiative) nao('Não há iniciativa em andamento.');
      else m.session.initiative = passo(m.session.initiative, c.passo === -1 ? -1 : 1);
      break;
    }
    case 'iniciativa.valor': {
      const ini = m.session.initiative;
      if (!ini) nao('Não há iniciativa em andamento.');
      else if (!ini.order.some(x => x.tokenId === c.tokenId)) nao('Essa peça não está na iniciativa.');
      else if (!Number.isFinite(c.value) || Math.abs(c.value) > 999) nao('Valor de iniciativa inválido.');
      else m.session.initiative = definirValor(ini, c.tokenId, c.value);
      break;
    }
    case 'iniciativa.encerrar': {
      if (!m.session.initiative) nao('Não há iniciativa em andamento.');
      m.session.initiative = null; break;
    }
    case 'andar.criar': {
      const { andar } = c;
      if (m.levels?.[andar.id]) nao(`Já existe o andar “${andar.id}”.`);
      if (!Number.isInteger(andar.order) || andar.order === 0) nao('A ordem do andar deve ser inteiro diferente de 0.');
      if (Object.values(m.levels ?? {}).some(a => a.order === andar.order)) nao('Já existe um andar nessa posição.');
      m.levels ??= {};
      m.levels[andar.id] = clonar(andar);
      break;
    }
    case 'andar.atualizar': {
      if (c.id === null) {
        if (c.patch.order !== undefined) nao('O térreo tem ordem fixa (0).');
        if (c.patch.name !== undefined) {
          const n = c.patch.name.trim();
          if (!n) nao('Dê um nome ao andar.');
          m.groundLevelName = n;
        }
        break;
      }
      const a = m.levels?.[c.id] ?? nao(`O andar “${c.id}” não existe.`);
      if (c.patch.name !== undefined) a.name = c.patch.name;
      if (c.patch.order !== undefined) {
        if (!Number.isInteger(c.patch.order) || c.patch.order === 0) nao('A ordem do andar deve ser inteiro diferente de 0.');
        if (Object.values(m.levels ?? {}).some(outro => outro.id !== c.id && outro.order === c.patch.order)) nao('Já existe um andar nessa posição.');
        a.order = c.patch.order;
      }
      break;
    }
    case 'andar.remover': {
      const levels = m.levels;
      if (!levels || !levels[c.id]) return nao(`O andar “${c.id}” não existe.`);
      delete levels[c.id];
      if (!Object.keys(levels).length) delete m.levels;
      for (const [id, x] of Object.entries(m.rooms)) if (andarDe(x) === c.id) { delete m.rooms[id]; delete m.comodosExtra[id]; }
      for (const [id, w] of Object.entries(m.walls)) if (andarDe(w) === c.id) {
        delete m.walls[id];
        for (const [oid, o] of Object.entries(m.openings)) if (o.wallId === id) delete m.openings[oid];
      }
      for (const [id, o] of Object.entries(m.props)) {
        if (andarDe(o) === c.id) delete m.props[id];
        else if (o.interaction?.kind === 'stairs' && o.interaction.toLevel === c.id) o.interaction = null;
      }
      for (const [id, l] of Object.entries(m.lights)) if (andarDe(l) === c.id) { delete m.lights[id]; desvincularLuz(m, id); }
      for (const [id, r] of Object.entries(m.regions)) if (andarDe(r) === c.id) delete m.regions[id];
      for (const [id, p] of Object.entries(m.presence)) if (andarDe(p) === c.id) delete m.presence[id];
      for (const [id, t] of Object.entries(m.tokens)) if (andarDe(t) === c.id) delete m.tokens[id];
      if (m.session.exploredLevels) {
        delete m.session.exploredLevels[c.id];
        if (!Object.keys(m.session.exploredLevels).length) delete m.session.exploredLevels;
      }
      m.session.initiative = podar(m.session.initiative, id => !!m.tokens[id]);
      m.session.revealed = m.session.revealed.filter(id => !!(m.rooms[id] || m.walls[id] || m.openings[id] || m.props[id] || m.lights[id] || m.regions[id] || m.presence[id] || m.tokens[id]));
      break;
    }
    default: { const _fim: never = c; nao(`Comando desconhecido: ${JSON.stringify(_fim)}`); }
  }
}

/**
 * Aplicação pura e atômica: devolve o documento novo (congelado, compartilhando o que não mudou) ou lança,
 * deixando o recebido intacto. O resultado inteiro é validado antes de ser aceito (ou ao concluir um gesto contínuo).
 */
export function aplicarComando(mapa: MapaAtlas, comando: Comando): MapaAtlas {
  const proximo = produzir(mapa, rascunho => { aplicar(rascunho, comando); sincronizarLuzesProprias(rascunho); });
  if (proximo === mapa) return mapa;
  if (!(comando.tipo === 'peca.mover' && comando.emArrasto === true)) {
    try { validarMapa(proximo); } catch (erro) {
      if (erro instanceof ErroDeValidacao) throw new ErroDeComando(`O comando deixaria o mapa inválido — ${erro.message}`);
      throw erro;
    }
  }
  return proximo;
}

export const ROTULOS: Record<Comando['tipo'], string> = {
  ...ROTULOS_CONSTRUIR,
  'mapa.renomear': 'Renomear mapa', 'mapa.notas': 'Editar notas', 'mapa.campanha': 'Ligar à campanha', 'grade.atualizar': 'Ajustar grade',
  'limites.atualizar': 'Redimensionar mapa', 'estilo.atualizar': 'Mudar estilo', 'mapa.audio': 'Som do mapa', 'clima.aplicar': 'Mudar clima', 'clima.predefinir': 'Aplicar clima', 'clima.salvar': 'Salvar clima', 'clima.esquecer': 'Esquecer clima', 'clima.audio': 'Som do clima', 'momento.salvar': 'Salvar momento', 'momento.remover': 'Remover momento', 'acabamento.atualizar': 'Ajustar acabamento',
  'fundo.atualizar': 'Ajustar fundo', 'memoria.atualizar': 'Ajustar memória', 'item.adicionar': 'Adicionar', 'item.atualizar': 'Editar',
  'item.remover': 'Remover', 'objeto.camada': 'Mudar a camada', 'luz.estado': 'Luzes', 'objeto.visibilidade': 'Visibilidade de objetos', 'selecao.mover': 'Mover', 'peca.mover': 'Mover peça', 'peca.virar': 'Virar a lanterna', 'peca.mudarAndar': 'Mudar peça de andar', 'sessao.esquecer': 'Recomeçar a exploração', 'sessao.revelar': 'Revelar', 'sessao.ocultar': 'Esconder cômodos', 'sessao.explorar': 'Explorar', 'sessao.telhados': 'Telhados da sessão', 'interagir': 'Usar', 'iniciativa.iniciar': 'Começar a iniciativa', 'iniciativa.passo': 'Passar a vez', 'iniciativa.valor': 'Valor de iniciativa', 'iniciativa.encerrar': 'Encerrar a iniciativa', 'proposta.aceitar': 'Aceitar sugestão',
  'andar.criar': 'Criar andar', 'andar.atualizar': 'Editar andar', 'andar.remover': 'Remover andar',
};

export type { NomeColecao };
