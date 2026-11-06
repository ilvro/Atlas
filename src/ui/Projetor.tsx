import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import { iniciarTema } from '../app/tema.ts';
import { CANAL_PROJETOR_GLOBAL, nomeDoCanalDoProjetor, type MensagemDoMestre, type MensagemDoProjetor } from '../app/projetor.ts';
import type { Recursos } from '../domain/fichas.ts';
import { criarMapa, type MapaAtlas } from '../domain/mapa.ts';
import { flutuarRolagem, ponto } from '../fx/fx.ts';
import { silenciarNestaJanela } from '../fx/som.ts';
import { criarViewport, type Viewport } from '../render/viewport.ts';
import { criarStore, type Store } from '../state/store.ts';
import { FaixaDeIniciativa } from './FaixaDeIniciativa.tsx';
import { Icone } from './Icone.tsx';
import { VISTA_INICIAL } from '../domain/inspecao.ts';
import { VisorDeDocumento, suavizarEstado, type EstadoDoVisor } from './VisorDeDocumento.tsx';

const doc = signal<MapaAtlas | null>(null);
const botaoVisivel = signal(true);
/** Os retratos que o mestre enviou, por id de asset. */
const retratos = new Map<string, Blob>();
/** A inspeção de um documento que o mestre abriu para os jogadores. O alvo chega em saltos; a vista exibida o alcança suavemente. */
const documentoDoProjetor = signal<{ nome: string; normal: ImageBitmap; uv: ImageBitmap | null } | null>(null);
let alvoDaInspecao: EstadoDoVisor = { vista: VISTA_INICIAL, lanterna: null };
let exibidoDaInspecao: EstadoDoVisor = { vista: VISTA_INICIAL, lanterna: null }, ultimoQuadroDaInspecao = 0;
async function abrirInspecaoNoProjetor(nome: string, normal: Blob, uv: Blob | null): Promise<void> {
  const [n, u] = await Promise.all([createImageBitmap(normal), uv ? createImageBitmap(uv) : Promise.resolve(null)]);
  fecharInspecaoNoProjetor(); alvoDaInspecao = { vista: VISTA_INICIAL, lanterna: null }; exibidoDaInspecao = alvoDaInspecao; ultimoQuadroDaInspecao = 0;
  documentoDoProjetor.value = { nome, normal: n, uv: u };
}
function fecharInspecaoNoProjetor(): void { const d = documentoDoProjetor.value; documentoDoProjetor.value = null; if (d) setTimeout(() => { d.normal.close(); d.uv?.close(); }, 400); }
const estadoDaInspecao = (): EstadoDoVisor => {
  const agora = performance.now(), dt = ultimoQuadroDaInspecao ? Math.min(0.1, (agora - ultimoQuadroDaInspecao) / 1000) : 1; ultimoQuadroDaInspecao = agora;
  return (exibidoDaInspecao = suavizarEstado(exibidoDaInspecao, alvoDaInspecao, dt));
};

/** PV e PD por peça que o mestre decidiu mostrar (vazio quando não quer). */
const recursosLocais = new Map<string, Recursos>();
const lerRetratoLocal = async (id: string): Promise<Blob | null> => retratos.get(id) ?? null;

/** A janela do projetor: só mostra o que o mestre publica (a projeção, a câmera, os eventos). Não abre o banco e não edita. */
export function Projetor({ mapaId }: { mapaId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    silenciarNestaJanela();                                   // o áudio não toca no projetor
    const sairTema = iniciarTema();
    document.body.classList.add('projetor');
    retratos.clear(); recursosLocais.clear(); fecharInspecaoNoProjetor();
    const canalEspecifico = new BroadcastChannel(nomeDoCanalDoProjetor(mapaId));
    const canalGlobal = new BroadcastChannel(CANAL_PROJETOR_GLOBAL);
    let vp: Viewport | null = null, store: Store | null = null, morto = false, caixa: Parameters<Viewport['enquadrarCaixa']>[0] | null = null, primeira = true;
    let seqProjetor = 0;
    const dizer = (m: MensagemDoProjetor) => {
      const comSeq = { ...m, _seq: ++seqProjetor };
      try { canalEspecifico.postMessage(comSeq); } catch { /* ignora */ }
      try { canalGlobal.postMessage(comSeq); } catch { /* ignora */ }
    };
    const tamanho = () => ({ largura: ref.current?.clientWidth ?? innerWidth, altura: ref.current?.clientHeight ?? innerHeight });
    const ola = () => dizer({ tipo: 'ola', ...tamanho() });

    void criarViewport(ref.current!, {
      store: (store = criarStore(criarMapa({ id: mapaId, nome: 'Aguardando…' }), { salvo: false })),
      somenteLeitura: true, selecao: () => [], definirSelecao() {}, ferramenta: () => 'selecionar', definirFerramenta() {}, pincel: () => ({}) as never, definirPincel() {},
      adicionar() {}, aoColocar() {}, aviso() {}, aoMenuContexto() {}, acabamento: () => true, vista: () => 'jogador',
      lerRetrato: lerRetratoLocal,
      recursosDaPeca: t => recursosLocais.get(t.id) ?? null,
    }).then(v => {
      if (morto) { v.destruir(); return; }
      vp = v;
      Object.defineProperty(window, '__projetor', { value: Object.freeze({ doc: () => doc.value, viewport: () => vp, retratos: () => [...retratos.keys()] }), configurable: true });
      ola();
    });

    let ultimoSeqMestre = -1;
    const tratarMensagem = (msg: MensagemDoMestre & { _seq?: number }) => {
      if (morto) return;
      if (msg._seq !== undefined) {
        if (msg._seq === ultimoSeqMestre) return;
        ultimoSeqMestre = msg._seq;
      }
      if (msg.tipo === 'estado') { doc.value = msg.doc; store!.projetar(msg.doc); }
      else if (msg.tipo === 'camera') { caixa = msg.caixa; vp?.enquadrarCaixa(msg.caixa, !primeira); primeira = false; }
      else if (msg.tipo === 'evento') vp?.dispararEvento(msg.nome);
      else if (msg.tipo === 'relampago') vp?.relampagoAgora();
      else if (msg.tipo === 'recursos') { recursosLocais.clear(); for (const [id, r] of Object.entries(msg.por)) recursosLocais.set(id, r); vp?.redesenharPecas(); }
      else if (msg.tipo === 'inspecao') void abrirInspecaoNoProjetor(msg.nome, msg.normal, msg.uv);
      else if (msg.tipo === 'inspecao-estado') alvoDaInspecao = { vista: msg.vista, lanterna: msg.lanterna };
      else if (msg.tipo === 'inspecao-fim') fecharInspecaoNoProjetor();
      else if (msg.tipo === 'rolagem') { const t = doc.value?.tokens[msg.peca]; if (t && vp) { const [x, y] = vp.clientDe([t.position[0], t.position[1] - t.size * (doc.value?.grid.size ?? 1.5) / 2]); flutuarRolagem(ponto(x, y), msg.total, msg.titulo, msg.tom); } }
      else if (msg.tipo === 'retrato') { retratos.set(msg.id, msg.blob); if (doc.value) store!.projetar({ ...doc.value }); }
    };
    canalEspecifico.onmessage = (e: MessageEvent<MensagemDoMestre>) => tratarMensagem(e.data);
    canalGlobal.onmessage = (e: MessageEvent<MensagemDoMestre>) => tratarMensagem(e.data);

    // Enquanto o mestre não responde, pergunta de novo (ele pode abrir o mapa depois).
    const insistir = setInterval(() => { if (!doc.value) ola(); }, 1500);
    const aoRedimensionar = () => { dizer({ tipo: 'tamanho', ...tamanho() }); if (caixa) vp?.enquadrarCaixa(caixa, false); };
    window.addEventListener('resize', aoRedimensionar);
    const aoSair = () => dizer({ tipo: 'tchau' });
    window.addEventListener('pagehide', aoSair);
    // O botão de tela cheia some depois de 3 s sem mexer o mouse.
    let sumir: ReturnType<typeof setTimeout>;
    const mexeu = () => { botaoVisivel.value = true; clearTimeout(sumir); sumir = setTimeout(() => { botaoVisivel.value = false; }, 3000); };
    window.addEventListener('pointermove', mexeu); mexeu();
    return () => {
      morto = true; clearInterval(insistir); clearTimeout(sumir); aoSair();
      canalEspecifico.close(); canalGlobal.close();
      sairTema(); vp?.destruir(); store?.dispor();
      window.removeEventListener('resize', aoRedimensionar); window.removeEventListener('pagehide', aoSair); window.removeEventListener('pointermove', mexeu);
      document.body.classList.remove('projetor');
    };
  }, [mapaId]);

  const m = doc.value;
  const pecas = m?.tokens ?? {};
  return (
    <main class={`projetor${m?.style.renderer === 'pixel' ? ' projetor-pixel' : ''}`} data-testid="projetor">
      <div class="projetor-mapa" ref={ref} />
      <div class="projetor-moldura" aria-hidden="true"><i /><i /></div>
      {documentoDoProjetor.value && <div class="projetor-inspecao" data-testid="projetor-inspecao"><h2>{documentoDoProjetor.value.nome}</h2><VisorDeDocumento normal={documentoDoProjetor.value.normal} uv={documentoDoProjetor.value.uv} estado={estadoDaInspecao} testid="projetor-visor" /></div>}
      {m ? <h1 class="projetor-titulo faixa" data-testid="projetor-titulo">{m.name}</h1> : <p class="projetor-espera" data-testid="projetor-espera">Aguardando o mestre…</p>}
      {m?.session.initiative && <div class="projetor-iniciativa"><FaixaDeIniciativa ini={m.session.initiative} pecas={pecas} lerRetrato={lerRetratoLocal} /></div>}
      <button type="button" class={`projetor-tela-cheia ${botaoVisivel.value ? '' : 'oculto'}`} aria-label="Tela cheia" title="Tela cheia" data-testid="projetor-tela-cheia"
        onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }}><Icone nome="enquadrar" tamanho={20} /></button>
    </main>
  );
}
