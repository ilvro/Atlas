import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import { iniciarTema } from '../app/tema.ts';
import { nomeDoCanalDoProjetor, type MensagemDoMestre, type MensagemDoProjetor } from '../app/projetor.ts';
import { criarMapa, type MapaAtlas } from '../domain/mapa.ts';
import { silenciarNestaJanela } from '../fx/som.ts';
import { criarViewport, type Viewport } from '../render/viewport.ts';
import { criarStore, type Store } from '../state/store.ts';
import { FaixaDeIniciativa } from './FaixaDeIniciativa.tsx';
import { Icone } from './Icone.tsx';

const doc = signal<MapaAtlas | null>(null);
const botaoVisivel = signal(true);
/** Os retratos que o mestre enviou, por id de asset. */
const retratos = new Map<string, Blob>();
const lerRetratoLocal = async (id: string): Promise<Blob | null> => retratos.get(id) ?? null;

/** A janela do projetor: só mostra o que o mestre publica (a projeção, a câmera, os eventos). Não abre o banco e não edita. */
export function Projetor({ mapaId }: { mapaId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    silenciarNestaJanela();                                   // o áudio não toca no projetor
    const sairTema = iniciarTema();
    document.body.classList.add('projetor');
    retratos.clear();
    const canal = new BroadcastChannel(nomeDoCanalDoProjetor(mapaId));
    let vp: Viewport | null = null, store: Store | null = null, morto = false, caixa: Parameters<Viewport['enquadrarCaixa']>[0] | null = null, primeira = true;
    const dizer = (m: MensagemDoProjetor) => canal.postMessage(m);
    const tamanho = () => ({ largura: ref.current?.clientWidth ?? innerWidth, altura: ref.current?.clientHeight ?? innerHeight });
    const ola = () => dizer({ tipo: 'ola', ...tamanho() });

    void criarViewport(ref.current!, {
      store: (store = criarStore(criarMapa({ id: mapaId, nome: 'Aguardando…' }), { salvo: false })),
      somenteLeitura: true, selecao: () => [], definirSelecao() {}, ferramenta: () => 'selecionar', definirFerramenta() {}, pincel: () => ({}) as never, definirPincel() {},
      adicionar() {}, aoColocar() {}, aviso() {}, aoMenuContexto() {}, acabamento: () => true, vista: () => 'jogador',
      lerRetrato: lerRetratoLocal,
    }).then(v => {
      if (morto) { v.destruir(); return; }
      vp = v;
      Object.defineProperty(window, '__projetor', { value: Object.freeze({ doc: () => doc.value, viewport: () => vp, retratos: () => [...retratos.keys()] }), configurable: true });
      ola();
    });

    canal.onmessage = (e: MessageEvent<MensagemDoMestre>) => {
      const msg = e.data;
      if (msg.tipo === 'estado') { doc.value = msg.doc; store!.projetar(msg.doc); }
      else if (msg.tipo === 'camera') { caixa = msg.caixa; vp?.enquadrarCaixa(msg.caixa, !primeira); primeira = false; }
      else if (msg.tipo === 'evento') vp?.dispararEvento(msg.nome);
      else if (msg.tipo === 'relampago') vp?.relampagoAgora();
      else if (msg.tipo === 'retrato') { retratos.set(msg.id, msg.blob); if (doc.value) store!.projetar({ ...doc.value }); }
    };
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
      morto = true; clearInterval(insistir); clearTimeout(sumir); aoSair(); canal.close(); sairTema(); vp?.destruir(); store?.dispor();
      window.removeEventListener('resize', aoRedimensionar); window.removeEventListener('pagehide', aoSair); window.removeEventListener('pointermove', mexeu);
      document.body.classList.remove('projetor');
    };
  }, [mapaId]);

  const m = doc.value;
  const pecas = m?.tokens ?? {};
  return (
    <main class="projetor" data-testid="projetor">
      <div class="projetor-mapa" ref={ref} />
      <div class="projetor-moldura" aria-hidden="true"><i /><i /></div>
      {m ? <h1 class="projetor-titulo faixa" data-testid="projetor-titulo">{m.name}</h1> : <p class="projetor-espera" data-testid="projetor-espera">Aguardando o mestre…</p>}
      {m?.session.initiative && <div class="projetor-iniciativa"><FaixaDeIniciativa ini={m.session.initiative} pecas={pecas} lerRetrato={lerRetratoLocal} /></div>}
      <button type="button" class={`projetor-tela-cheia ${botaoVisivel.value ? '' : 'oculto'}`} aria-label="Tela cheia" title="Tela cheia" data-testid="projetor-tela-cheia"
        onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }}><Icone nome="enquadrar" tamanho={20} /></button>
    </main>
  );
}
