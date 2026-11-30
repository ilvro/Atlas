import { effect, signal } from '@preact/signals';
import { andarDe, andaresDosJogadores } from '../domain/andares.ts';
import type { Recursos } from '../domain/fichas.ts';
import type { Vista } from '../domain/inspecao.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import type { PassoDeMomento } from '../domain/momentos.ts';
import { mostrarPvNoProjetor, recursosDaPeca, recursosDasFichas } from './fichas.ts';
import { controleJogadores, movimentoLivre, type ControleJogadores } from './modo.ts';
import { recursosParaOProjetor } from '../domain/fichas.ts';
import { projetarParaJogadores } from '../domain/projecao.ts';
import { projetarParaRemoto } from '../domain/projecao-remota.ts';
import { pecaSempreVisivel, pontoVisivelAgora, type FiltroDeVisao } from '../domain/nevoa.ts';
import type { EventoDeCena } from '../render/eventos-de-cena.ts';
import type { Caixa } from '../render/selecao.ts';
import type { SessaoDeEdicao } from './sessao.ts';

/**
 * O projetor é uma segunda janela do próprio Atlas (`#/projetor/{mapaId}`) que só recebe: o mestre publica a projeção do mapa
 * (`projetarParaJogadores`), a câmera, os eventos de cena e os retratos por um BroadcastChannel; o projetor não abre o banco.
 */
export const CANAL_PROJETOR_GLOBAL = 'atlas:projetor:ativo';
/**
 * O destino remoto (a ponte da mesa online) é separado do projetor local: tem o próprio canal, o próprio estado de conectado
 * e recebe a projeção remota (`projetarParaRemoto`: só o que os jogadores já viram). O `ola`, o `tamanho` e o `tchau` dele chegam por aqui.
 */
export const CANAL_PROJETOR_REMOTO = 'atlas:projetor:remoto';
export const nomeDoCanalDoProjetor = (mapaId: string): string => `atlas:projetor:${mapaId}`;
/** O canal único do projetor remoto (a casca do jogador): prefixado pela sala, nunca os canais do mestre. */
export const nomeDoCanalDaSala = (salaId: string): string => `sala:${salaId}:atlas:projetor`;
/** O canal de eventos do barramento da sala (R15): onde o projetor remoto pede `atlas.mover-peca` e recebe `mesa.resposta`. */
export const nomeDoCanalEventosDaSala = (salaId: string): string => `sala:${salaId}:mesa:eventos`;
/** Os canais em que o projetor ouve e fala: no modo remoto só o da sala; no local, o do mapa e o global. */
export const canaisDoProjetor = (mapaId: string, salaId?: string): string[] =>
  salaId ? [nomeDoCanalDaSala(salaId)] : [nomeDoCanalDoProjetor(mapaId), CANAL_PROJETOR_GLOBAL];
/** O que o projetor pode dizer: no modo remoto `ola`, `pedir-retrato` e `alternar-porta` (a casca filtra); o resto (`tamanho`, `soltou`, `tchau`) é do mestre. */
export const projetorPodeDizer = (m: { tipo: string }, remoto: boolean): boolean =>
  !remoto || m.tipo === 'ola' || m.tipo === 'pedir-retrato' || m.tipo === 'alternar-porta';

/** ID do mapa que o projetor está exibindo (desacoplado da aba ativa no editor). */
export const mapaNoProjetorId = signal<string | null>(null);
/** ID da ficha projetada em tela cheia na Activity (`null` = mostra o mapa normal). */
export const fichaProjetadaId = signal<string | null>(null);
/** Projeta uma ficha em tela cheia para os jogadores (`null` para encerrar a projeção). */
export function projetarFicha(fichaId: string | null): void {
  fichaProjetadaId.value = fichaId;
}
const pulsoFocoRemoto = signal(0);
/** Força o reenquadramento imediato da câmera remota na visão atual do mestre. */
export function forcarCameraRemota(): void {
  pulsoFocoRemoto.value++;
}

/**
 * Depois de iniciar ou passar a iniciativa: seleciona a peça do turno, passa a seguir essa peça e,
 * com "Seguindo" ligado, reenquadra a câmera da Activity nela.
 */
export function focarTurnoAtualDaIniciativa(s: SessaoDeEdicao): void {
  const ini = s.store.documento.session.initiative;
  const tokenId = ini?.order[ini.current]?.tokenId;
  if (!tokenId || !s.store.documento.tokens[tokenId]) return;
  s.selecao.value = [{ colecao: 'tokens', id: tokenId }];
  jogadorSeguido.value = tokenId;
  if (seguirJogadores.peek()) forcarCameraRemota();
}

export type MensagemDoMestre =
  | { tipo: 'estado'; doc: MapaAtlas; versao: number; emGesto?: boolean; controleJogadores?: ControleJogadores }
  | { tipo: 'controle-jogadores'; modo: ControleJogadores }
  | { tipo: 'visao-remota'; filtro: FiltroDeVisao }
  | { tipo: 'projetar-ficha'; fichaId: string | null }
  | { tipo: 'peca-gesto'; id: string; position: [number, number]; facing: MapaAtlas['tokens'][string]['facing']; lightDirection?: number; caixa?: Caixa; seguir?: boolean }
  | { tipo: 'camera'; caixa: Caixa; seguir?: boolean; imediata?: boolean; forcar?: boolean }
  | { tipo: 'evento'; nome: EventoDeCena }
  | { tipo: 'relampago' }
  | { tipo: 'retrato'; id: string; blob: Blob }
  /** Cortina preta e letreiros para momentos de cena */
  | { tipo: 'tela'; acao: 'escurecer' | 'clarear'; ms: number }
  | { tipo: 'letreiro'; titulo: string; subtitulo: string; estilo: 'apresentacao' | 'capitulo'; retrato: string | null; ms: number }
  | { tipo: 'letreiro-fim' }
  /** PV e PD por peça (só quando o mestre quer mostrá-los no projetor; vazio esconde). */
  | { tipo: 'recursos'; por: Record<string, Recursos> }
  /** Uma rolagem da Ficha sobre a peça. */
  /** A inspeção de um documento aberta para os jogadores (os dois assados), a vista e a lanterna UV (frações da imagem), e o fim. */
  | { tipo: 'inspecao'; nome: string; normal: Blob; uv: Blob | null }
  | { tipo: 'inspecao-estado'; vista: Vista; lanterna: { x: number; y: number } | null }
  | { tipo: 'inspecao-fim' }
  | { tipo: 'rolagem'; peca: string; titulo: string; total: number; tom: 'alto' | 'baixo' | 'normal' };
export type MensagemDoProjetor =
  | { tipo: 'ola'; largura: number; altura: number; remoto?: boolean }
  | { tipo: 'tamanho'; largura: number; altura: number }
  | { tipo: 'soltou' }
  | { tipo: 'tchau' }
  | { tipo: 'pedir-retrato'; id: string }
  | { tipo: 'alternar-porta'; id: string };

/** O que o publicador manda só à ponte remota: o mapa está sem névoa, e o `estado` dele não deve sair até o mestre confirmar. `nome` é só para a tela do mestre. */
export interface AvisoSemNevoa { tipo: 'aviso-sem-nevoa'; mapa: string; nome: string }
/** O destino remoto (ponte da mesa online) está ligado? */
export const projetorRemotoConectado = signal(false);

/** O retângulo do mapa que o projetor mostra (null até haver projetor). Mexer nele move a câmera do projetor, não a do mestre. */
export const caixaDoProjetor = signal<Caixa | null>(null);
export const projetorConectado = signal(false);
/** Indica se a tela do projetor está escurecida pela cortina preta (visível no Dock para o mestre). */
export const telaEscura = signal(false);
/** Enquadrar sempre as peças de jogador. */
export const seguirJogadores = signal(false);
/** Com "seguir os jogadores" ligado, enquadra só esta peça de jogador (`null` = todos). */
export const jogadorSeguido = signal<string | null>(null);
/** Filtro de visão ativa na tela dos jogadores (todos, foco em um personagem ou visão individual/grupos). */
export const filtroDeVisao = signal<FiltroDeVisao>({ tipo: 'todos' });
export function definirFiltroDeVisao(f: FiltroDeVisao): void {
  filtroDeVisao.value = f;
}
export const aspectoDoProjetor = signal(16 / 9);
/** Mostrar o quadro do projetor sobre o mapa do mestre. */
export const mostrarQuadroDoProjetor = signal(true);
/** Override manual do andar mostrado no projetor (`undefined` = automático). */
export const andarManualDoProjetor = signal<string | null | undefined>(undefined);
/** Andar efetivo que o projetor está exibindo agora (`null` = térreo). */
export const andarDoProjetor = signal<string | null>(null);

/** Resolve qual andar o projetor deve exibir com base no override manual ou na última peça de jogador movida. */
export function resolverAndarDoProjetor(
  m: MapaAtlas,
  ultimoMovido?: string | null,
  manual?: string | null,
): string | null {
  if (manual !== undefined && (manual === null || !!m.levels?.[manual])) return manual;
  const andares = andaresDosJogadores(m);
  if (!andares.length) return null;
  if (andares.length === 1) return andares[0]!.id;
  if (ultimoMovido !== undefined && andares.some(a => a.id === ultimoMovido)) return ultimoMovido;
  return andares[0]!.id;
}

/** Estica a caixa até ter a proporção `asp`, sem tirar nada dela e mantendo o centro. */
export function ajustarAoAspecto(c: Caixa, asp: number): Caixa {
  const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, w = Math.max(c.x1 - c.x0, (c.y1 - c.y0) * asp), h = w / asp;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

/**
 * A peça que o projetor pode seguir: um jogador, ou um combatente da iniciativa ativa.
 * Anti-spoiler: uma ameaça só é seguida enquanto os jogadores a veem; fora da vista, o enquadre fica nos jogadores.
 */
export function alvoSeguivel(m: MapaAtlas, id: string | null): MapaAtlas['tokens'][string] | undefined {
  const t = id ? m.tokens[id] : undefined;
  if (!t) return undefined;
  if (t.player) return t;
  if (!m.session.initiative?.order.some(e => e.tokenId === t.id)) return undefined;
  const filtro = filtroDeVisao.peek();
  return pontoVisivelAgora(m, t.position, t.size * m.grid.size * 0.35, filtro.tipo === 'foco' ? filtro : undefined) ? t : undefined;
}

/** A caixa que enquadra as peças de jogador com folga (ou o mapa todo, se não houver). */
export function caixaDosJogadores(m: MapaAtlas, asp: number, margem = 5, andar?: string | null, jogadorId: string | null = null): Caixa {
  const alvo = alvoSeguivel(m, jogadorId);
  const pecas = alvo ? [alvo] : Object.values(m.tokens).filter(t => t.player && (andar === undefined || andarDe(t) === andar));
  if (!pecas.length) return ajustarAoAspecto({ x0: 0, y0: 0, x1: m.bounds.width, y1: m.bounds.height }, asp);
  const xs = pecas.map(t => t.position[0]), ys = pecas.map(t => t.position[1]);
  return ajustarAoAspecto({ x0: Math.min(...xs) - margem, y0: Math.min(...ys) - margem, x1: Math.max(...xs) + margem, y1: Math.max(...ys) + margem }, asp);
}

export interface Publicador {
  evento(nome: EventoDeCena): void;
  relampago(): void;
  rolagem(peca: string, titulo: string, total: number, tom: 'alto' | 'baixo' | 'normal'): void;
  /** Abre (ou, com `null`, fecha) a inspeção de um documento no projetor. */
  inspecao(d: { nome: string; normal: Blob; uv: Blob | null } | null): void;
  inspecaoEstado(vista: Vista, lanterna: { x: number; y: number } | null): void;
  tela(acao: 'escurecer' | 'clarear', ms: number): void;
  letreiro(l: Extract<PassoDeMomento, { tipo: 'letreiro' }> | null): void;
  parar(): void;
}

/** Começa a publicar o mapa aberto para um projetor que apareça. Não faz nada pesado enquanto nenhum projetor estiver ligado. */
export function iniciarPublicacao(
  s: SessaoDeEdicao,
  lerAsset: (id: string) => Promise<Blob | null>,
  aoAlternarPorta?: (id: string) => void,
): Publicador {
  const id = s.store.documento.id;
  if (typeof BroadcastChannel !== 'function') {
    return {
      evento() {}, relampago() {}, rolagem() {}, inspecao() {}, inspecaoEstado() {},
      tela() {}, letreiro() {}, parar() {},
    };
  }
  const canalEspecifico = new BroadcastChannel(nomeDoCanalDoProjetor(id));
  const canalGlobal = new BroadcastChannel(CANAL_PROJETOR_GLOBAL);
  const canalRemoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const semNevoaAvisados = new Set<string>();
  const algum = () => projetorConectado.peek() || projetorRemotoConectado.peek();
  let seqMestre = 0;
  let ultimoEstadoTela: { acao: 'escurecer' | 'clarear'; ms: number } | null = null;
  /** Manda a cada destino que está ligado: o projetor local (canais do mapa e global) e/ou o remoto. */
  const enviar = (m: MensagemDoMestre | AvisoSemNevoa, onde: 'local' | 'remoto' | 'ambos' = 'ambos') => {
    const comSeq = { ...m, _seq: ++seqMestre };
    if (onde !== 'remoto' && projetorConectado.peek()) {
      try { canalEspecifico.postMessage(comSeq); } catch { /* ignora */ }
      try { canalGlobal.postMessage(comSeq); } catch { /* ignora */ }
    }
    if (onde !== 'local' && projetorRemotoConectado.peek()) {
      try { canalRemoto.postMessage(comSeq); } catch { /* ignora */ }
    }
  };
  let retratosEnviadosLocal = new Set<string>(), retratosEnviadosRemoto = new Set<string>();
  let temporizador: ReturnType<typeof setTimeout> | null = null, parado = false;
  let ultimoAndarMovido: string | null | undefined = undefined;
  let ultimosJogadores = new Map<string, { x: number; y: number; andar: string | null }>();
  const registrarJogadores = (m: MapaAtlas) => {
    const prox = new Map<string, { x: number; y: number; andar: string | null }>();
    for (const t of Object.values(m.tokens)) {
      if (!t.player) continue;
      const atual = { x: t.position[0], y: t.position[1], andar: andarDe(t) };
      prox.set(t.id, atual);
      const ant = ultimosJogadores.get(t.id);
      if (ant && (ant.x !== atual.x || ant.y !== atual.y || ant.andar !== atual.andar)) {
        ultimoAndarMovido = atual.andar;
      }
    }
    ultimosJogadores = prox;
  };
  registrarJogadores(s.store.documento);
  const andarAtual = (m: MapaAtlas): string | null => {
    const seguido = seguirJogadores.peek() ? alvoSeguivel(m, jogadorSeguido.peek()) : undefined;
    const resolvido = seguido && andarManualDoProjetor.peek() === undefined
      ? andarDe(seguido)
      : resolverAndarDoProjetor(m, ultimoAndarMovido, andarManualDoProjetor.peek());
    andarDoProjetor.value = resolvido;
    return resolvido;
  };
  andarManualDoProjetor.value = undefined;
  andarAtual(s.store.documento);
  caixaDoProjetor.value = null; projetorConectado.value = false; projetorRemotoConectado.value = false;

  const enviarRetratoPorId = (rid: string, onde: 'local' | 'remoto' | 'ambos', forcar = false) => {
    const querLocal = onde !== 'remoto' && projetorConectado.peek() && (forcar || !retratosEnviadosLocal.has(rid));
    const querRemoto = onde !== 'local' && projetorRemotoConectado.peek() && (forcar || !retratosEnviadosRemoto.has(rid));
    if (!querLocal && !querRemoto) return;
    if (querLocal) retratosEnviadosLocal.add(rid);
    if (querRemoto) retratosEnviadosRemoto.add(rid);
    const destino: 'local' | 'remoto' | 'ambos' = querLocal && querRemoto ? 'ambos' : querLocal ? 'local' : 'remoto';
    void lerAsset(rid).then(blob => {
      if (blob && !parado) enviar({ tipo: 'retrato', id: rid, blob }, destino);
      else {
        if (querLocal) retratosEnviadosLocal.delete(rid);
        if (querRemoto) retratosEnviadosRemoto.delete(rid);
      }
    }).catch(() => {
      if (querLocal) retratosEnviadosLocal.delete(rid);
      if (querRemoto) retratosEnviadosRemoto.delete(rid);
    });
  };
  const enviarRetratos = (m: MapaAtlas, onde: 'local' | 'remoto' | 'ambos' = 'ambos', forcar = false) => {
    for (const t of Object.values(m.tokens)) {
      const rid = t.portrait?.id;
      if (rid) enviarRetratoPorId(rid, onde, forcar);
    }
  };
  /** PV e PD por peça de jogador, ou nada se o mestre não quer mostrá-los. */
  const enviarRecursos = () => {
    if (!algum() || parado) return;
    enviar({ tipo: 'recursos', por: recursosParaOProjetor(s.store.documento.tokens, recursosDaPeca, mostrarPvNoProjetor.peek()) });
  };
  // Ameaças (peças que não são de jogador) presentes no último `estado` enviado a cada destino: o gesto leve só vale para elas.
  let ameacasNoEstadoLocal = new Set<string>();
  let ameacasNoEstadoRemoto = new Set<string>();
  // O que o remoto recebeu por último (projeção + modo): se o novo `estado` sai igual, não vai de novo pela rede.
  let ultimoEstadoRemotoJson: string | null = null;
  const ameacasDoEstado = (d: MapaAtlas, filtro?: FiltroDeVisao | null) => new Set(Object.values(d.tokens).filter(x => !pecaSempreVisivel(x, filtro)).map(x => x.id));
  const enviarEstado = (onde: 'local' | 'remoto' | 'ambos' = 'ambos', forcarRetratos = false) => {
    const m = s.store.documento;
    const andar = andarAtual(m);
    const local = onde !== 'remoto' && projetorConectado.peek(), remoto = onde !== 'local' && projetorRemotoConectado.peek();
    if ((!local && !remoto) || parado) return;
    enviarRetratos(m, onde, forcarRetratos);
    const extra = { versao: s.store.versaoEdicao, ...(s.store.emGesto ? { emGesto: true } : {}) };
    const livre = movimentoLivre.peek();
    const comModo = (d: MapaAtlas): MapaAtlas => (livre && d.grid.snap ? { ...d, grid: { ...d.grid, snap: false } } : d);
    const filtro = filtroDeVisao.peek();
    const filtroFoco = filtro.tipo === 'foco' ? filtro : undefined;
    if (local) {
      const doc = comModo(projetarParaJogadores(m, andar, filtroFoco));
      ameacasNoEstadoLocal = ameacasDoEstado(doc, filtroFoco);
      enviar({ tipo: 'estado', doc, ...extra }, 'local');
    }
    if (remoto) {
      const doc = comModo(projetarParaRemoto(m, andar, filtroFoco));
      ameacasNoEstadoRemoto = ameacasDoEstado(doc, filtroFoco);
      // Sem névoa o mestre mostra o mapa todo: a ponte pede a confirmação dele, uma vez por mapa, e segura o `estado` até lá.
      if (doc.session.explored === null) {
        if (!semNevoaAvisados.has(m.id)) { semNevoaAvisados.add(m.id); enviar({ tipo: 'aviso-sem-nevoa', mapa: m.id, nome: m.name }, 'remoto'); }
      } else semNevoaAvisados.delete(m.id);
      const conteudo = JSON.stringify([doc, extra.emGesto === true, controleJogadores.peek()]);
      if (conteudo !== ultimoEstadoRemotoJson) {
        ultimoEstadoRemotoJson = conteudo;
        enviar({ tipo: 'estado', doc, ...extra, controleJogadores: controleJogadores.peek() }, 'remoto');
      }
    }
    enviarRecursos();
  };
  const agendar = (ms = 100) => {
    if (temporizador) return;
    temporizador = setTimeout(() => { temporizador = null; enviarEstado(); }, ms);
    if (typeof temporizador?.unref === 'function') temporizador.unref();
  };

  let ultimoSeqProjetor = -1;
  const aoMensagem = (e: MessageEvent<MensagemDoProjetor & { _seq?: number }>) => {
    if (parado) return;
    const msg = e.data;
    if (msg.tipo === 'ola' && msg.remoto) return; // o remoto só entra pelo canal dele
    if (msg._seq !== undefined) {
      if (msg._seq === ultimoSeqProjetor) return;
      ultimoSeqProjetor = msg._seq;
    }
    if (msg.tipo === 'ola' || msg.tipo === 'tamanho') {
      if (msg.largura > 0 && msg.altura > 0) aspectoDoProjetor.value = msg.largura / msg.altura;
      const ehOla = msg.tipo === 'ola';
      if (ehOla) { retratosEnviadosLocal = new Set(); projetorConectado.value = true; }
      const atual = caixaDoProjetor.peek(), asp = aspectoDoProjetor.peek(), m = s.store.documento;
      const caixa = seguirJogadores.peek() || !atual ? caixaDosJogadores(m, asp, 5, andarAtual(m), jogadorSeguido.peek()) : ajustarAoAspecto(atual, asp);
      caixaDoProjetor.value = caixa;
      enviarEstado('local', ehOla);
      if (ehOla) enviar({ tipo: 'visao-remota', filtro: filtroDeVisao.peek() }, 'local');
      enviar({ tipo: 'camera', caixa, ...(seguirJogadores.peek() ? { seguir: true } : {}) }, 'local');
      if (ehOla && ultimoEstadoTela?.acao === 'escurecer') {
        enviar({ tipo: 'tela', acao: 'escurecer', ms: ultimoEstadoTela.ms }, 'local');
      }
      if (ehOla && fichaProjetadaId.peek()) {
        enviar({ tipo: 'projetar-ficha', fichaId: fichaProjetadaId.peek() }, 'local');
      }
    } else if (msg.tipo === 'pedir-retrato' && typeof msg.id === 'string' && msg.id) {
      if (projetorConectado.peek()) enviarRetratoPorId(msg.id, 'local', true);
    } else if (msg.tipo === 'soltou') { seguirJogadores.value = false; }
    else if (msg.tipo === 'tchau') { projetorConectado.value = false; caixaDoProjetor.value = null; }
  };
  canalEspecifico.onmessage = aoMensagem;
  canalGlobal.onmessage = aoMensagem;

  // O destino remoto: `ola`, `tamanho` e `tchau` da ponte, com estado de conectado próprio (o `tchau` local não o desliga).
  let ultimoSeqRemoto = -1, aspectoRemoto = 16 / 9;
  /** A câmera do destino remoto: a mesma lógica do local (seguir os jogadores ou o quadro do mestre), no aspecto do `ola` remoto. */
  const caixaRemota = (m: MapaAtlas): Caixa => {
    const atual = caixaDoProjetor.peek();
    return seguirJogadores.peek() || !atual ? caixaDosJogadores(m, aspectoRemoto, 5, andarAtual(m), jogadorSeguido.peek()) : ajustarAoAspecto(atual, aspectoRemoto);
  };
  const enviarCameraRemota = (m: MapaAtlas = s.store.documento, opcoes?: { forcar?: boolean; imediata?: boolean }) => {
    if (!projetorRemotoConectado.peek() || parado) return;
    enviar(
      {
        tipo: 'camera',
        caixa: caixaRemota(m),
        ...(seguirJogadores.peek() ? { seguir: true } : {}),
        ...(opcoes?.forcar ? { forcar: true } : {}),
        ...(opcoes?.imediata ? { imediata: true } : {}),
      },
      'remoto',
    );
  };
  canalRemoto.onmessage = (e: MessageEvent<MensagemDoProjetor & { _seq?: number }>) => {
    if (parado) return;
    const msg = e.data;
    if (msg._seq !== undefined) { if (msg._seq === ultimoSeqRemoto) return; ultimoSeqRemoto = msg._seq; }
    if (msg.tipo === 'ola' || msg.tipo === 'tamanho') {
      const ehOla = msg.tipo === 'ola';
      if (ehOla) { retratosEnviadosRemoto = new Set(); ultimoEstadoRemotoJson = null; semNevoaAvisados.clear(); projetorRemotoConectado.value = true; if (mapaNoProjetorId.peek() === null) mapaNoProjetorId.value = id; }
      if (!projetorRemotoConectado.peek()) return;
      if (msg.largura > 0 && msg.altura > 0) {
        aspectoRemoto = msg.largura / msg.altura;
        if (!projetorConectado.peek()) aspectoDoProjetor.value = aspectoRemoto;
      }
      const m = s.store.documento;
      if (!caixaDoProjetor.peek()) {
        caixaDoProjetor.value = caixaDosJogadores(m, aspectoRemoto, 5, andarAtual(m), jogadorSeguido.peek());
      }
      enviarEstado('remoto', ehOla);
      enviar({ tipo: 'controle-jogadores', modo: controleJogadores.peek() }, 'remoto');
      if (ehOla) enviar({ tipo: 'visao-remota', filtro: filtroDeVisao.peek() }, 'remoto');
      enviarCameraRemota(m, controleJogadores.peek() === 'mestre' ? { forcar: true } : undefined);
      if (ehOla && ultimoEstadoTela?.acao === 'escurecer') enviar({ tipo: 'tela', acao: 'escurecer', ms: ultimoEstadoTela.ms }, 'remoto');
      if (ehOla && fichaProjetadaId.peek()) enviar({ tipo: 'projetar-ficha', fichaId: fichaProjetadaId.peek() }, 'remoto');
    } else if (msg.tipo === 'pedir-retrato' && typeof msg.id === 'string' && msg.id) {
      if (projetorRemotoConectado.peek()) enviarRetratoPorId(msg.id, 'remoto', true);
    } else if (msg.tipo === 'alternar-porta' && typeof msg.id === 'string' && msg.id) {
      if (controleJogadores.peek() !== 'livres') return;
      const m = s.store.documento;
      const o = m.openings[msg.id];
      if (!o || (o.kind !== 'door' && o.kind !== 'secret') || o.state === 'locked') return;
      if (o.kind === 'secret' && !m.session.revealed.includes(o.id)) return;
      aoAlternarPorta?.(msg.id);
    } else if (msg.tipo === 'tchau') { projetorRemotoConectado.value = false; ultimoEstadoRemotoJson = null; }
  };
  canalRemoto.postMessage({ tipo: 'precisa-ola' });

  let cameraEmGesto = false;
  let ultimoEnvioGesto = 0;
  const sair = s.store.assinar(e => {
    if (e.mudancas.completo || e.mudancas.colecoes.tokens) registrarJogadores(e.documento);
    andarAtual(e.documento);
    const apenasSessao = e.mudancas.campos.every(c => c === 'session');
    if (
      e.tipo === 'gesto'
      && e.mudancas.colecoes.tokens?.length === 1
      && !e.mudancas.completo
      && apenasSessao
      && Object.keys(e.mudancas.colecoes).every(k => k === 'tokens' || k === 'lights')
    ) {
      const tokenId = e.mudancas.colecoes.tokens[0]!;
      const t = e.documento.tokens[tokenId];
      const seguir = seguirJogadores.peek();
      if (seguir && (projetorConectado.peek() || projetorRemotoConectado.peek())) {
        const asp = projetorConectado.peek() ? aspectoDoProjetor.peek() : aspectoRemoto;
        cameraEmGesto = true;
        caixaDoProjetor.value = caixaDosJogadores(e.documento, asp, 5, andarAtual(e.documento), jogadorSeguido.peek());
        cameraEmGesto = false;
      }
      if (algum() && !parado && t && andarDe(t) === andarDoProjetor.peek()) {
        // Anti-spoiler: ameaça só viaja no gesto enquanto os jogadores a veem; entrar/sair da vista pede um `estado`.
        const filtro = filtroDeVisao.peek();
        const livre = pecaSempreVisivel(t, filtro);
        const visivel = livre || pontoVisivelAgora(e.documento, t.position, t.size * e.documento.grid.size * 0.35, filtro.tipo === 'foco' ? filtro : undefined);
        const noLocal = livre || ameacasNoEstadoLocal.has(tokenId), noRemoto = livre || ameacasNoEstadoRemoto.has(tokenId);
        if (!livre && ((projetorConectado.peek() && visivel !== noLocal) || (projetorRemotoConectado.peek() && visivel !== noRemoto))) agendar(80);
        const agora = performance.now();
        if (visivel && agora - ultimoEnvioGesto >= 12) {
          ultimoEnvioGesto = agora;
          const luz = t.lightId ? e.documento.lights[t.lightId] : undefined;
          const alvoSeguido = t.player || jogadorSeguido.peek() === tokenId;
          const c = seguir && alvoSeguido ? caixaDoProjetor.peek() ?? undefined : undefined;
          const base = {
            tipo: 'peca-gesto' as const,
            id: tokenId,
            position: [t.position[0], t.position[1]] as [number, number],
            facing: t.facing,
            ...(luz?.cone ? { lightDirection: luz.cone.direction } : {}),
          };
          if (noLocal) enviar({ ...base, ...(c ? { caixa: c, seguir: true } : {}) }, 'local');
          if (noRemoto) enviar({ ...base, ...(seguir && alvoSeguido ? { caixa: caixaRemota(e.documento), seguir: true } : {}) }, 'remoto');
        }
      }
      // Durante o arrasto o `peca-gesto` leve mantém o movimento; fog e terreno atualizam ~3×/s. Ao soltar, vai quase na hora.
      if (e.mudancas.campos.includes('session')) agendar(350);
      return;
    }
    if (e.tipo === 'concluir' && temporizador) { clearTimeout(temporizador); temporizador = null; }   // soltou a peça: não espera o ritmo do arrasto
    agendar(e.tipo === 'concluir' ? 50 : 100);
    if (e.mudancas.completo || e.mudancas.colecoes.tokens) enviarCameraRemota(e.documento);
    if (seguirJogadores.peek() && (projetorConectado.peek() || projetorRemotoConectado.peek()) && (e.mudancas.completo || e.mudancas.colecoes.tokens)) {
      const asp = projetorConectado.peek() ? aspectoDoProjetor.peek() : aspectoRemoto;
      caixaDoProjetor.value = caixaDosJogadores(e.documento, asp, 5, andarAtual(e.documento), jogadorSeguido.peek());
    }
  });
  // Ligar "seguir os jogadores" enquadra na hora; a caixa publicada segue qualquer mudança (arrastar o quadro, seguir).
  const parar1 = effect(() => {
    const seguir = seguirJogadores.value, conectado = projetorConectado.value, remoto = projetorRemotoConectado.value, asp = aspectoDoProjetor.value, quem = jogadorSeguido.value;
    if (seguir && (conectado || remoto)) {
      const m = s.store.documento;
      const antesAndar = andarDoProjetor.peek();
      const novoAndar = andarAtual(m);
      caixaDoProjetor.value = caixaDosJogadores(m, conectado ? asp : aspectoRemoto, 5, novoAndar, quem);
      if (conectado || novoAndar !== antesAndar) enviarEstado();
    }
  });
  const parar4 = effect(() => {
    void andarManualDoProjetor.value;
    const m = s.store.documento;
    const andar = andarAtual(m);
    if (algum() && !parado) {
      enviarEstado();
      if (seguirJogadores.peek()) {
        const asp = projetorConectado.peek() ? aspectoDoProjetor.peek() : aspectoRemoto;
        caixaDoProjetor.value = caixaDosJogadores(m, asp, 5, andar, jogadorSeguido.peek());
      }
    }
  });
  // O destino remoto acompanha a câmera do mestre: seguir, jogador seguido, andar e o quadro dele (no aspecto do remoto).
  let ultimoSeguir = seguirJogadores.peek();
  let ultimoJogadorSeguido = jogadorSeguido.peek();
  const parar5 = effect(() => {
    const seguir = seguirJogadores.value, quem = jogadorSeguido.value;
    void andarDoProjetor.value; void caixaDoProjetor.value;
    const remoto = projetorRemotoConectado.value;
    const mudouFoco = (seguir && !ultimoSeguir) || (seguir && quem !== ultimoJogadorSeguido);
    ultimoSeguir = seguir;
    ultimoJogadorSeguido = quem;
    if (remoto && !cameraEmGesto) enviarCameraRemota(s.store.documento, mudouFoco ? { forcar: true } : undefined);
  });
  const parar3 = effect(() => { void recursosDasFichas.value; void mostrarPvNoProjetor.value; enviarRecursos(); });
  const parar2 = effect(() => { const c = caixaDoProjetor.value; if (c && projetorConectado.peek() && !cameraEmGesto) enviar({ tipo: 'camera', caixa: c, ...(seguirJogadores.peek() ? { seguir: true } : {}) }, 'local'); });
  const parar6 = effect(() => { void movimentoLivre.value; if (algum() && !parado) enviarEstado(); });
  let ultimoPulsoFoco = pulsoFocoRemoto.peek();
  const parar7 = effect(() => {
    const modo = controleJogadores.value;
    const pulso = pulsoFocoRemoto.value;
    const forcado = pulso !== ultimoPulsoFoco;
    ultimoPulsoFoco = pulso;
    if (projetorRemotoConectado.peek() && !parado) {
      enviar({ tipo: 'controle-jogadores', modo }, 'remoto');
      if (modo === 'mestre' || forcado) {
        const m = s.store.documento;
        if (!caixaDoProjetor.peek()) {
          caixaDoProjetor.value = caixaDosJogadores(m, aspectoRemoto, 5, andarAtual(m), jogadorSeguido.peek());
        }
        enviarCameraRemota(m, { forcar: true });
      }
    }
  });
  const parar8 = effect(() => {
    const fichaId = fichaProjetadaId.value;
    if (algum() && !parado) enviar({ tipo: 'projetar-ficha', fichaId });
  });
  let ultimoTipoFiltro = filtroDeVisao.peek().tipo;
  const parar9 = effect(() => {
    const filtro = filtroDeVisao.value;
    const eraFoco = ultimoTipoFiltro === 'foco';
    ultimoTipoFiltro = filtro.tipo;
    if (algum() && !parado) {
      enviar({ tipo: 'visao-remota', filtro });
      if (filtro.tipo === 'foco' || eraFoco) enviarEstado();
    }
  });

  return {
    evento: nome => { if (algum()) enviar({ tipo: 'evento', nome }); },
    relampago: () => { if (algum()) enviar({ tipo: 'relampago' }); },
    rolagem: (peca, titulo, total, tom) => { if (algum()) enviar({ tipo: 'rolagem', peca, titulo, total, tom }); },
    inspecao: d => { if (algum()) enviar(d ? { tipo: 'inspecao', nome: d.nome, normal: d.normal, uv: d.uv } : { tipo: 'inspecao-fim' }); },
    inspecaoEstado: (vista, lanterna) => { if (algum()) enviar({ tipo: 'inspecao-estado', vista, lanterna }); },
    tela: (acao, ms) => {
      ultimoEstadoTela = { acao, ms };
      telaEscura.value = (acao === 'escurecer');
      if (algum()) enviar({ tipo: 'tela', acao, ms });
    },
    letreiro: l => {
      if (!l) {
        if (algum()) enviar({ tipo: 'letreiro-fim' });
        return;
      }
      if (!algum()) return;
      const peca = l.peca ? s.store.documento.tokens[l.peca] : null;
      const rid = peca?.portrait?.id ?? null;
      const precisaEnviar = rid && (
        (projetorConectado.peek() && !retratosEnviadosLocal.has(rid))
        || (projetorRemotoConectado.peek() && !retratosEnviadosRemoto.has(rid))
      );
      if (rid && precisaEnviar) {
        const querLocal = projetorConectado.peek() && !retratosEnviadosLocal.has(rid);
        const querRemoto = projetorRemotoConectado.peek() && !retratosEnviadosRemoto.has(rid);
        if (querLocal) retratosEnviadosLocal.add(rid);
        if (querRemoto) retratosEnviadosRemoto.add(rid);
        const destino: 'local' | 'remoto' | 'ambos' = querLocal && querRemoto ? 'ambos' : querLocal ? 'local' : 'remoto';
        void lerAsset(rid).then(blob => {
          if (blob && !parado) enviar({ tipo: 'retrato', id: rid, blob }, destino);
          else {
            if (querLocal) retratosEnviadosLocal.delete(rid);
            if (querRemoto) retratosEnviadosRemoto.delete(rid);
          }
          if (!parado && algum()) {
            enviar({
              tipo: 'letreiro',
              titulo: l.titulo,
              subtitulo: l.subtitulo,
              estilo: l.estilo,
              retrato: rid,
              ms: l.ms,
            });
          }
        }).catch(() => {
          if (querLocal) retratosEnviadosLocal.delete(rid);
          if (querRemoto) retratosEnviadosRemoto.delete(rid);
          if (!parado && algum()) {
            enviar({
              tipo: 'letreiro',
              titulo: l.titulo,
              subtitulo: l.subtitulo,
              estilo: l.estilo,
              retrato: null,
              ms: l.ms,
            });
          }
        });
      } else {
        enviar({
          tipo: 'letreiro',
          titulo: l.titulo,
          subtitulo: l.subtitulo,
          estilo: l.estilo,
          retrato: rid,
          ms: l.ms,
        });
      }
    },
    parar() {
      parado = true; sair(); parar1(); parar2(); parar3(); parar4(); parar5(); parar6(); parar7(); parar8(); parar9();
      if (temporizador) clearTimeout(temporizador);
      canalEspecifico.close();
      canalGlobal.close();
      canalRemoto.close();
      caixaDoProjetor.value = null;
      projetorConectado.value = false;
      projetorRemotoConectado.value = false;
      andarManualDoProjetor.value = undefined;
      andarDoProjetor.value = null;
      telaEscura.value = false;
      ultimoEstadoTela = null;
    },
  };
}

/** Abre (ou traz à frente) a janela do projetor deste mapa. */
export function abrirJanelaDoProjetor(mapaId: string): void {
  mapaNoProjetorId.value = mapaId;
  const url = new URL(location.href); url.searchParams.delete('embutido'); url.hash = `#/projetor/${encodeURIComponent(mapaId)}`;
  window.open(url.href, 'atlas-projetor', 'popup,width=1280,height=720');
}
