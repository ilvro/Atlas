import { effect, signal } from '@preact/signals';
import { andarDe, andaresDosJogadores } from '../domain/andares.ts';
import type { Recursos } from '../domain/fichas.ts';
import type { Vista } from '../domain/inspecao.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import type { PassoDeMomento } from '../domain/momentos.ts';
import { mostrarPvNoProjetor, recursosDaPeca, recursosDasFichas } from './fichas.ts';
import { recursosParaOProjetor } from '../domain/fichas.ts';
import { projetarParaJogadores } from '../domain/projecao.ts';
import { projetarParaRemoto } from '../domain/projecao-remota.ts';
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
/** O que o projetor pode dizer: no modo remoto só o `ola` (a casca o usa para reenviar o último estado); o resto (`tamanho`, `soltou`, `tchau`) é do mestre. */
export const projetorPodeDizer = (m: { tipo: string }, remoto: boolean): boolean => !remoto || m.tipo === 'ola';

/** ID do mapa que o projetor está exibindo (desacoplado da aba ativa no editor). */
export const mapaNoProjetorId = signal<string | null>(null);

export type MensagemDoMestre =
  | { tipo: 'estado'; doc: MapaAtlas; versao: number; emGesto?: boolean }
  | { tipo: 'peca-gesto'; id: string; position: [number, number]; facing: MapaAtlas['tokens'][string]['facing']; lightDirection?: number; caixa?: Caixa; seguir?: boolean }
  | { tipo: 'camera'; caixa: Caixa; seguir?: boolean; imediata?: boolean }
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
  | { tipo: 'tchau' };

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

/** A caixa que enquadra as peças de jogador com folga (ou o mapa todo, se não houver). */
export function caixaDosJogadores(m: MapaAtlas, asp: number, margem = 5, andar?: string | null, jogadorId: string | null = null): Caixa {
  const alvo = jogadorId ? m.tokens[jogadorId] : undefined;
  const pecas = alvo?.player ? [alvo] : Object.values(m.tokens).filter(t => t.player && (andar === undefined || andarDe(t) === andar));
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
export function iniciarPublicacao(s: SessaoDeEdicao, lerAsset: (id: string) => Promise<Blob | null>): Publicador {
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
  let retratosEnviados = new Set<string>(), temporizador: ReturnType<typeof setTimeout> | null = null, parado = false;
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
    const seguido = seguirJogadores.peek() ? m.tokens[jogadorSeguido.peek() ?? ''] : undefined;
    const resolvido = seguido?.player && andarManualDoProjetor.peek() === undefined
      ? andarDe(seguido)
      : resolverAndarDoProjetor(m, ultimoAndarMovido, andarManualDoProjetor.peek());
    andarDoProjetor.value = resolvido;
    return resolvido;
  };
  andarManualDoProjetor.value = undefined;
  andarAtual(s.store.documento);
  caixaDoProjetor.value = null; projetorConectado.value = false; projetorRemotoConectado.value = false;

  const enviarRetratos = (m: MapaAtlas) => {
    for (const t of Object.values(m.tokens)) {
      const rid = t.portrait?.id; if (!rid || retratosEnviados.has(rid)) continue;
      retratosEnviados.add(rid);
      void lerAsset(rid).then(blob => { if (blob && !parado) enviar({ tipo: 'retrato', id: rid, blob }); else retratosEnviados.delete(rid); }).catch(() => retratosEnviados.delete(rid));
    }
  };
  /** PV e PD por peça de jogador, ou nada se o mestre não quer mostrá-los. */
  const enviarRecursos = () => {
    if (!algum() || parado) return;
    enviar({ tipo: 'recursos', por: recursosParaOProjetor(s.store.documento.tokens, recursosDaPeca, mostrarPvNoProjetor.peek()) });
  };
  const enviarEstado = (onde: 'local' | 'remoto' | 'ambos' = 'ambos') => {
    const m = s.store.documento;
    const andar = andarAtual(m);
    const local = onde !== 'remoto' && projetorConectado.peek(), remoto = onde !== 'local' && projetorRemotoConectado.peek();
    if ((!local && !remoto) || parado) return;
    enviarRetratos(m);
    const extra = { versao: s.store.versaoEdicao, ...(s.store.emGesto ? { emGesto: true } : {}) };
    if (local) enviar({ tipo: 'estado', doc: projetarParaJogadores(m, andar), ...extra }, 'local');
    if (remoto) {
      const doc = projetarParaRemoto(m, andar);
      // Sem névoa o mestre mostra o mapa todo: a ponte pede a confirmação dele, uma vez por mapa, e segura o `estado` até lá.
      if (doc.session.explored === null) {
        if (!semNevoaAvisados.has(m.id)) { semNevoaAvisados.add(m.id); enviar({ tipo: 'aviso-sem-nevoa', mapa: m.id, nome: m.name }, 'remoto'); }
      } else semNevoaAvisados.delete(m.id);
      enviar({ tipo: 'estado', doc, ...extra }, 'remoto');
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
      if (msg.tipo === 'ola') { retratosEnviados = new Set(); projetorConectado.value = true; }
      const atual = caixaDoProjetor.peek(), asp = aspectoDoProjetor.peek(), m = s.store.documento;
      const caixa = seguirJogadores.peek() || !atual ? caixaDosJogadores(m, asp, 5, andarAtual(m), jogadorSeguido.peek()) : ajustarAoAspecto(atual, asp);
      caixaDoProjetor.value = caixa;
      enviarEstado('local');
      enviar({ tipo: 'camera', caixa, ...(seguirJogadores.peek() ? { seguir: true } : {}) }, 'local');
      if (msg.tipo === 'ola' && ultimoEstadoTela?.acao === 'escurecer') {
        enviar({ tipo: 'tela', acao: 'escurecer', ms: ultimoEstadoTela.ms }, 'local');
      }
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
  const enviarCameraRemota = (m: MapaAtlas = s.store.documento) => {
    if (!projetorRemotoConectado.peek() || parado) return;
    enviar({ tipo: 'camera', caixa: caixaRemota(m), ...(seguirJogadores.peek() ? { seguir: true } : {}) }, 'remoto');
  };
  canalRemoto.onmessage = (e: MessageEvent<MensagemDoProjetor & { _seq?: number }>) => {
    if (parado) return;
    const msg = e.data;
    if (msg._seq !== undefined) { if (msg._seq === ultimoSeqRemoto) return; ultimoSeqRemoto = msg._seq; }
    if (msg.tipo === 'ola' || msg.tipo === 'tamanho') {
      if (msg.tipo === 'ola') { retratosEnviados = new Set(); semNevoaAvisados.clear(); projetorRemotoConectado.value = true; }
      if (!projetorRemotoConectado.peek()) return;
      if (msg.largura > 0 && msg.altura > 0) aspectoRemoto = msg.largura / msg.altura;
      const m = s.store.documento;
      enviarEstado('remoto');
      enviarCameraRemota(m);
      if (msg.tipo === 'ola' && ultimoEstadoTela?.acao === 'escurecer') enviar({ tipo: 'tela', acao: 'escurecer', ms: ultimoEstadoTela.ms }, 'remoto');
    } else if (msg.tipo === 'tchau') projetorRemotoConectado.value = false;
  };

  let cameraEmGesto = false;
  let ultimoEnvioGesto = 0;
  const sair = s.store.assinar(e => {
    if (e.mudancas.completo || e.mudancas.colecoes.tokens) registrarJogadores(e.documento);
    andarAtual(e.documento);
    if (e.tipo === 'gesto' && e.mudancas.colecoes.tokens?.length === 1 && !e.mudancas.completo && !e.mudancas.campos.length) {
      const tokenId = e.mudancas.colecoes.tokens[0]!;
      const t = e.documento.tokens[tokenId];
      const seguir = seguirJogadores.peek();
      if (seguir && projetorConectado.peek()) {
        cameraEmGesto = true;
        caixaDoProjetor.value = caixaDosJogadores(e.documento, aspectoDoProjetor.peek(), 5, andarAtual(e.documento), jogadorSeguido.peek());
        cameraEmGesto = false;
      }
      if (algum() && !parado && t && t.player && andarDe(t) === andarDoProjetor.peek()) {
        const agora = performance.now();
        if (agora - ultimoEnvioGesto >= 16) {
          ultimoEnvioGesto = agora;
          const luz = t.lightId ? e.documento.lights[t.lightId] : undefined;
          const c = seguir ? caixaDoProjetor.peek() ?? undefined : undefined;
          const base = {
            tipo: 'peca-gesto' as const,
            id: tokenId,
            position: [t.position[0], t.position[1]] as [number, number],
            facing: t.facing,
            ...(luz?.cone ? { lightDirection: luz.cone.direction } : {}),
          };
          enviar({ ...base, ...(c ? { caixa: c, seguir: true } : {}) }, 'local');
          // O remoto recebe a peça sem a caixa do local (aspecto diferente) e a câmera própria, no aspecto dele.
          enviar(base, 'remoto');
          if (seguir || !caixaDoProjetor.peek()) enviarCameraRemota(e.documento);
        }
      }
      return;
    }
    agendar(100);
    if (e.mudancas.completo || e.mudancas.colecoes.tokens) enviarCameraRemota(e.documento);
    if (seguirJogadores.peek() && projetorConectado.peek() && (e.mudancas.completo || e.mudancas.colecoes.tokens)) {
      caixaDoProjetor.value = caixaDosJogadores(e.documento, aspectoDoProjetor.peek(), 5, andarAtual(e.documento), jogadorSeguido.peek());
    }
  });
  // Ligar "seguir os jogadores" enquadra na hora; a caixa publicada segue qualquer mudança (arrastar o quadro, seguir).
  const parar1 = effect(() => {
    const seguir = seguirJogadores.value, conectado = projetorConectado.value, asp = aspectoDoProjetor.value, quem = jogadorSeguido.value;
    if (seguir && conectado) {
      const m = s.store.documento;
      caixaDoProjetor.value = caixaDosJogadores(m, asp, 5, andarAtual(m), quem);
      enviarEstado();
    }
  });
  const parar4 = effect(() => {
    void andarManualDoProjetor.value;
    const m = s.store.documento;
    const andar = andarAtual(m);
    if (algum() && !parado) {
      enviarEstado();
      if (seguirJogadores.peek()) caixaDoProjetor.value = caixaDosJogadores(m, aspectoDoProjetor.peek(), 5, andar, jogadorSeguido.peek());
    }
  });
  // O destino remoto acompanha a câmera do mestre: seguir, jogador seguido, andar e o quadro dele (no aspecto do remoto).
  const parar5 = effect(() => {
    void seguirJogadores.value; void jogadorSeguido.value; void andarDoProjetor.value; void caixaDoProjetor.value;
    if (projetorRemotoConectado.value) enviarCameraRemota();
  });
  const parar3 = effect(() => { void recursosDasFichas.value; void mostrarPvNoProjetor.value; enviarRecursos(); });
  const parar2 = effect(() => { const c = caixaDoProjetor.value; if (c && projetorConectado.peek() && !cameraEmGesto) enviar({ tipo: 'camera', caixa: c, ...(seguirJogadores.peek() ? { seguir: true } : {}) }, 'local'); });

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
      if (rid && !retratosEnviados.has(rid)) {
        retratosEnviados.add(rid);
        void lerAsset(rid).then(blob => {
          if (blob && !parado) enviar({ tipo: 'retrato', id: rid, blob });
          else retratosEnviados.delete(rid);
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
          retratosEnviados.delete(rid);
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
      parado = true; sair(); parar1(); parar2(); parar3(); parar4(); parar5();
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
