import { effect, signal } from '@preact/signals';
import type { MapaAtlas } from '../domain/mapa.ts';
import { projetarParaJogadores } from '../domain/projecao.ts';
import type { EventoDeCena } from '../render/eventos-de-cena.ts';
import type { Caixa } from '../render/selecao.ts';
import type { SessaoDeEdicao } from './sessao.ts';

/**
 * O projetor é uma segunda janela do próprio Atlas (`#/projetor/{mapaId}`) que só recebe: o mestre publica a projeção do mapa
 * (`projetarParaJogadores`), a câmera, os eventos de cena e os retratos por um BroadcastChannel; o projetor não abre o banco.
 */
export const nomeDoCanalDoProjetor = (mapaId: string): string => `atlas:projetor:${mapaId}`;

export type MensagemDoMestre =
  | { tipo: 'estado'; doc: MapaAtlas; versao: number }
  | { tipo: 'camera'; caixa: Caixa }
  | { tipo: 'evento'; nome: EventoDeCena }
  | { tipo: 'relampago' }
  | { tipo: 'retrato'; id: string; blob: Blob };
export type MensagemDoProjetor =
  | { tipo: 'ola'; largura: number; altura: number }
  | { tipo: 'tamanho'; largura: number; altura: number }
  | { tipo: 'tchau' };

/** O retângulo do mapa que o projetor mostra (null até haver projetor). Mexer nele move a câmera do projetor, não a do mestre. */
export const caixaDoProjetor = signal<Caixa | null>(null);
export const projetorConectado = signal(false);
/** Enquadrar sempre as peças de jogador. */
export const seguirJogadores = signal(false);
export const aspectoDoProjetor = signal(16 / 9);
/** Mostrar o quadro do projetor sobre o mapa do mestre. */
export const mostrarQuadroDoProjetor = signal(true);

/** Estica a caixa até ter a proporção `asp`, sem tirar nada dela e mantendo o centro. */
export function ajustarAoAspecto(c: Caixa, asp: number): Caixa {
  const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, w = Math.max(c.x1 - c.x0, (c.y1 - c.y0) * asp), h = w / asp;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

/** A caixa que enquadra as peças de jogador com folga (ou o mapa todo, se não houver). */
export function caixaDosJogadores(m: MapaAtlas, asp: number, margem = 5): Caixa {
  const pecas = Object.values(m.tokens).filter(t => t.player);
  if (!pecas.length) return ajustarAoAspecto({ x0: 0, y0: 0, x1: m.bounds.width, y1: m.bounds.height }, asp);
  const xs = pecas.map(t => t.position[0]), ys = pecas.map(t => t.position[1]);
  return ajustarAoAspecto({ x0: Math.min(...xs) - margem, y0: Math.min(...ys) - margem, x1: Math.max(...xs) + margem, y1: Math.max(...ys) + margem }, asp);
}

export interface Publicador {
  evento(nome: EventoDeCena): void;
  relampago(): void;
  parar(): void;
}

/** Começa a publicar o mapa aberto para um projetor que apareça. Não faz nada pesado enquanto nenhum projetor estiver ligado. */
export function iniciarPublicacao(s: SessaoDeEdicao, lerAsset: (id: string) => Promise<Blob | null>): Publicador {
  const id = s.store.documento.id;
  if (typeof BroadcastChannel !== 'function') return { evento() {}, relampago() {}, parar() {} };
  const canal = new BroadcastChannel(nomeDoCanalDoProjetor(id));
  const enviar = (m: MensagemDoMestre) => canal.postMessage(m);
  let retratosEnviados = new Set<string>(), temporizador: ReturnType<typeof setTimeout> | null = null, parado = false;
  caixaDoProjetor.value = null; projetorConectado.value = false;

  const enviarRetratos = (m: MapaAtlas) => {
    for (const t of Object.values(m.tokens)) {
      const rid = t.portrait?.id; if (!rid || retratosEnviados.has(rid)) continue;
      retratosEnviados.add(rid);
      void lerAsset(rid).then(blob => { if (blob && !parado) enviar({ tipo: 'retrato', id: rid, blob }); else retratosEnviados.delete(rid); }).catch(() => retratosEnviados.delete(rid));
    }
  };
  const enviarEstado = () => {
    if (!projetorConectado.peek() || parado) return;
    const m = s.store.documento;
    enviarRetratos(m);
    enviar({ tipo: 'estado', doc: projetarParaJogadores(m), versao: s.store.versaoEdicao });
  };
  const agendar = () => { if (temporizador) return; temporizador = setTimeout(() => { temporizador = null; enviarEstado(); }, 100); };

  canal.onmessage = (e: MessageEvent<MensagemDoProjetor>) => {
    const msg = e.data;
    if (msg.tipo === 'ola' || msg.tipo === 'tamanho') {
      if (msg.largura > 0 && msg.altura > 0) aspectoDoProjetor.value = msg.largura / msg.altura;
      if (msg.tipo === 'ola') { retratosEnviados = new Set(); projetorConectado.value = true; }
      const atual = caixaDoProjetor.peek(), asp = aspectoDoProjetor.peek();
      caixaDoProjetor.value = atual ? ajustarAoAspecto(atual, asp) : caixaDosJogadores(s.store.documento, asp);
      enviarEstado();
      if (caixaDoProjetor.peek()) enviar({ tipo: 'camera', caixa: caixaDoProjetor.peek()! });
    } else if (msg.tipo === 'tchau') { projetorConectado.value = false; caixaDoProjetor.value = null; }
  };

  const sair = s.store.assinar(e => {
    agendar();
    if (seguirJogadores.peek() && projetorConectado.peek() && (e.mudancas.completo || e.mudancas.colecoes.tokens)) caixaDoProjetor.value = caixaDosJogadores(e.documento, aspectoDoProjetor.peek());
  });
  // Ligar "seguir os jogadores" enquadra na hora; a caixa publicada segue qualquer mudança (arrastar o quadro, seguir).
  const parar1 = effect(() => { if (seguirJogadores.value && projetorConectado.peek()) caixaDoProjetor.value = caixaDosJogadores(s.store.documento, aspectoDoProjetor.peek()); });
  const parar2 = effect(() => { const c = caixaDoProjetor.value; if (c && projetorConectado.peek()) enviar({ tipo: 'camera', caixa: c }); });

  return {
    evento: nome => { if (projetorConectado.peek()) enviar({ tipo: 'evento', nome }); },
    relampago: () => { if (projetorConectado.peek()) enviar({ tipo: 'relampago' }); },
    parar() { parado = true; sair(); parar1(); parar2(); if (temporizador) clearTimeout(temporizador); canal.close(); caixaDoProjetor.value = null; projetorConectado.value = false; },
  };
}

/** Abre (ou traz à frente) a janela do projetor deste mapa. */
export function abrirJanelaDoProjetor(mapaId: string): void {
  const url = new URL(location.href); url.hash = `#/projetor/${encodeURIComponent(mapaId)}`;
  window.open(url.href, `atlas-projetor-${mapaId}`, 'popup,width=1280,height=720');
}
