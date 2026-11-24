import { useEffect, useMemo, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import { iniciarTema } from '../app/tema.ts';
import { criarBarramento, type CanalLike } from '#mesa';
import { canaisDoProjetor, nomeDoCanalEventosDaSala, projetorPodeDizer, type MensagemDoMestre, type MensagemDoProjetor } from '../app/projetor.ts';
import { andarDe } from '../domain/andares.ts';
import type { Recursos } from '../domain/fichas.ts';
import { criarMapa, type MapaAtlas } from '../domain/mapa.ts';
import { pecasDoJogador } from '../domain/projecao-remota.ts';
import { flutuarRolagem, ponto } from '../fx/fx.ts';
import { silenciarNestaJanela } from '../fx/som.ts';
import { criarViewport, type Viewport } from '../render/viewport.ts';
import { zoomEm, type Camera } from '../render/camera.ts';
import { CAMERA_REMOTA_INICIAL, decidirCamera, type EventoDaCameraRemota } from '../app/camera-remota.ts';
import { criarStore, type Store } from '../state/store.ts';
import { FaixaDeIniciativa } from './FaixaDeIniciativa.tsx';
import { Icone } from './Icone.tsx';
import { VISTA_INICIAL } from '../domain/inspecao.ts';
import { VisorDeDocumento, suavizarEstado, type EstadoDoVisor } from './VisorDeDocumento.tsx';
import { LetreiroDoProjetor, type DadosDoLetreiro } from './LetreiroDoProjetor.tsx';

const doc = signal<MapaAtlas | null>(null);
const botaoVisivel = signal(true);
/** Cortina preta para transições de cena. */
const cortina = signal<{ escurecer: boolean; ms: number }>({ escurecer: false, ms: 0 });
/** Letreiro de apresentação ou capítulo em exibição no projetor. */
const letreiroDoProjetor = signal<DadosDoLetreiro | null>(null);
/** Aviso breve no projetor remoto quando um pedido é recusado (R15). */
const avisoRemoto = signal<string | null>(null);
let relogioAvisoRemoto: ReturnType<typeof setTimeout> | undefined;
function mostrarAvisoRemoto(texto: string): void {
  clearTimeout(relogioAvisoRemoto);
  avisoRemoto.value = texto;
  relogioAvisoRemoto = setTimeout(() => { avisoRemoto.value = null; }, 2200);
}
/** Enquanto segue o mestre, a câmera dele enquadra o projetor; o arrasto aqui solta o projetor até "Seguir o mestre". */
const seguindo = signal(true);
let caixaDoMestre: Parameters<Viewport['enquadrarCaixa']>[0] | null = null, vpAtual: Viewport | null = null;
/** "Seguir o mestre" do projetor remoto (definido pelo efeito do componente). */
let seguirMestreRemoto: () => void = () => {};
/** Zoom local do projetor (1 = o enquadre do mestre; >1 aproxima). Sobrevive ao seguimento: só o arrasto o solta. */
let zoomLocal = 1;
const caixaComZoom = (c: NonNullable<typeof caixaDoMestre>) => {
  if (zoomLocal === 1) return c;
  const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, w = (c.x1 - c.x0) / zoomLocal, h = (c.y1 - c.y0) / zoomLocal;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
};
/** Os retratos que o mestre enviou, por id de asset. */
const retratos = new Map<string, Blob>();
const versaoRetratos = signal(0);
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
export function Projetor({ mapaId, salaId }: { mapaId: string; salaId?: string }) {
  const remoto = salaId !== undefined;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    silenciarNestaJanela();                                   // o áudio não toca no projetor
    const sairTema = iniciarTema();
    document.body.classList.add('projetor');
    seguindo.value = true; caixaDoMestre = null; zoomLocal = 1;
    retratos.clear(); recursosLocais.clear(); fecharInspecaoNoProjetor();
    cortina.value = { escurecer: false, ms: 0 };
    letreiroDoProjetor.value = null;
    const canais = canaisDoProjetor(mapaId, salaId).map(n => new BroadcastChannel(n));
    const barramento = salaId ? criarBarramento({ app: 'atlas', criarCanal: () => new BroadcastChannel(nomeDoCanalEventosDaSala(salaId)) as unknown as CanalLike }) : null;
    let vp: Viewport | null = null, store: Store | null = null, morto = false, caixa: Parameters<Viewport['enquadrarCaixa']>[0] | null = null, primeira = true;
    let seqProjetor = 0;
    // No projetor remoto, a lógica de "livre ou seguindo" é a função pura `decidirCamera`; o `seguindo` só espelha o modo para a interface.
    let estadoCam = CAMERA_REMOTA_INICIAL;
    const decidirRemoto = (ev: EventoDaCameraRemota, suave = false) => {
      const r = decidirCamera(estadoCam, ev); estadoCam = r.estado; seguindo.value = estadoCam.modo === 'seguindo';
      if (r.caixa) { caixa = caixaDoMestre = r.caixa; vp?.enquadrarCaixa(r.caixa, suave && !primeira); primeira = false; }
    };
    seguirMestreRemoto = () => decidirRemoto({ tipo: 'seguir-mestre' }, true);
    const dizer = (m: MensagemDoProjetor) => {
      if (!projetorPodeDizer(m, remoto)) return;
      const comSeq = { ...m, _seq: ++seqProjetor };
      for (const c of canais) { try { c.postMessage(comSeq); } catch { /* ignora */ } }
    };
    const tamanho = () => ({ largura: ref.current?.clientWidth ?? innerWidth, altura: ref.current?.clientHeight ?? innerHeight });
    const ola = () => dizer({ tipo: 'ola', ...tamanho() });
    let fichasDoJogador: string[] = [];

    let ultimoPingEm = 0;
    const sairPing = barramento?.ouvir('mesa.ping', evento => {
      const d = evento.dados as { mapa?: string; ponto?: [number, number]; levelId?: string | null };
      if (!d || typeof d.mapa !== 'string' || d.mapa !== doc.value?.id || !d.ponto) return;
      vp?.dispararPing({
        id: evento.id,
        mapa: d.mapa,
        ponto: d.ponto,
        levelId: d.levelId ?? null,
        discordId: evento.autor?.discordId ?? 'mestre',
        nome: evento.autor?.nome ?? 'Mestre',
        papel: evento.autor?.papel ?? 'mestre',
        em: Date.now(),
      });
    });
    void criarViewport(ref.current!, {
      store: (store = criarStore(criarMapa({ id: mapaId, nome: 'Aguardando…' }), { salvo: false })),
      somenteLeitura: true, selecao: () => [], definirSelecao() {}, ferramenta: () => 'selecionar', definirFerramenta() {}, pincel: () => ({}) as never, definirPincel() {},
      adicionar() {}, aoColocar() {}, aviso() {}, aoMenuContexto() {}, acabamento: () => true, vista: () => 'jogador',
      lerRetrato: lerRetratoLocal,
      recursosDaPeca: t => recursosLocais.get(t.id) ?? null,
      pecaDoJogador: t => remoto && pecasDoJogador({ tokens: { [t.id]: t } }, fichasDoJogador).has(t.id),
      aoArrastarPecaRemota: remoto && barramento
        ? async (peca, para) => {
            const atual = doc.value;
            if (!atual) return false;
            const andar = andarDe(peca);
            const r = await barramento.pedir(
              'atlas.mover-peca',
              { mapa: atual.id, peca: peca.id, position: para, ...(andar ? { levelId: andar } : {}) },
              { prazoMs: 5000 },
            );
            if (!r.ok) {
              mostrarAvisoRemoto(r.motivo === 'recusado' && r.detalhe ? `Não deu: ${r.detalhe}` : 'Não deu para mover a peça.');
              return false;
            }
            return true;
          }
        : undefined,
      aoPingar: remoto && barramento
        ? pontoPing => {
            const atual = doc.value;
            if (!atual) return;
            const agora = Date.now();
            if (agora - ultimoPingEm < 1000) return;
            ultimoPingEm = agora;
            const ev = barramento.emitir('mesa.ping', { mapa: atual.id, ponto: pontoPing });
            vp?.dispararPing({
              id: ev.id,
              mapa: atual.id,
              ponto: pontoPing,
              levelId: null,
              discordId: 'eu',
              nome: 'Você',
              papel: 'jogador',
              em: agora,
            });
          }
        : undefined,
    }).then(v => {
      if (morto) { v.destruir(); return; }
      vp = v; vpAtual = v;
      // A câmera pode ter chegado antes do viewport ficar pronto (corrida): aplica a última agora.
      if (caixa && seguindo.peek()) { v.enquadrarCaixa(caixaComZoom(caixa), false); primeira = false; }
      Object.defineProperty(window, '__projetor', {
        value: Object.freeze({
          doc: () => doc.value,
          viewport: () => vp,
          retratos: () => [...retratos.keys()],
          cortina: () => cortina.value,
          letreiro: () => letreiroDoProjetor.value,
        }),
        configurable: true,
      });
      ola();
    });

    let ultimoSeqMestre = -1;
    const tratarMensagem = (msg: MensagemDoMestre & { _seq?: number }) => {
      if (morto) return;
      if (msg._seq !== undefined) {
        if (msg._seq === ultimoSeqMestre) return;
        ultimoSeqMestre = msg._seq;
      }
      if (msg.tipo === 'estado') { doc.value = msg.doc; store!.projetar(msg.doc, { emGesto: msg.emGesto }); }
      else if (msg.tipo === 'peca-gesto') {
        const atual = store?.documento;
        const t = atual?.tokens[msg.id];
        if (atual && t) {
          const luz = t.lightId ? atual.lights[t.lightId] : undefined;
          const novoDoc: MapaAtlas = {
            ...atual,
            tokens: { ...atual.tokens, [msg.id]: { ...t, position: msg.position, facing: msg.facing } },
            ...(luz ? {
              lights: {
                ...atual.lights,
                [luz.id]: {
                  ...luz,
                  position: msg.position,
                  ...(luz.cone && msg.lightDirection !== undefined ? { cone: { ...luz.cone, direction: msg.lightDirection } } : {}),
                },
              },
            } : {}),
          };
          doc.value = novoDoc;
          store!.projetar(novoDoc, { emGesto: true, pularValidacao: true });
        }
        if (msg.caixa && remoto) { caixa = msg.caixa; decidirRemoto({ tipo: 'camera', caixa: msg.caixa }); }
        else if (msg.caixa) {
          caixa = caixaDoMestre = msg.caixa;
          if (msg.seguir) seguindo.value = true;
          if (seguindo.peek()) { vp?.enquadrarCaixa(caixaComZoom(msg.caixa), false); primeira = false; }
        }
      }
      else if (msg.tipo === 'camera' && remoto) { caixa = msg.caixa; decidirRemoto({ tipo: 'camera', caixa: msg.caixa, ...(msg.imediata ? { imediata: true } : {}) }, !msg.imediata); }
      else if (msg.tipo === 'camera') { caixa = caixaDoMestre = msg.caixa; if (msg.seguir) seguindo.value = true; if (seguindo.peek()) { vp?.enquadrarCaixa(caixaComZoom(msg.caixa), !primeira && !msg.imediata); primeira = false; } }
      else if (msg.tipo === 'evento') vp?.dispararEvento(msg.nome);
      else if (msg.tipo === 'relampago') vp?.relampagoAgora();
      else if (msg.tipo === 'tela') { cortina.value = { escurecer: msg.acao === 'escurecer', ms: msg.ms }; }
      else if (msg.tipo === 'letreiro') { letreiroDoProjetor.value = { titulo: msg.titulo, subtitulo: msg.subtitulo, estilo: msg.estilo, retrato: msg.retrato, ms: msg.ms }; }
      else if (msg.tipo === 'letreiro-fim') { letreiroDoProjetor.value = null; }
      else if (msg.tipo === 'recursos') { recursosLocais.clear(); for (const [id, r] of Object.entries(msg.por)) recursosLocais.set(id, r); vp?.redesenharPecas(); }
      else if (msg.tipo === 'inspecao') void abrirInspecaoNoProjetor(msg.nome, msg.normal, msg.uv);
      else if (msg.tipo === 'inspecao-estado') alvoDaInspecao = { vista: msg.vista, lanterna: msg.lanterna };
      else if (msg.tipo === 'inspecao-fim') fecharInspecaoNoProjetor();
      else if (msg.tipo === 'rolagem') { const t = doc.value?.tokens[msg.peca]; if (t && vp) { const [x, y] = vp.clientDe([t.position[0], t.position[1] - t.size * (doc.value?.grid.size ?? 1.5) / 2]); flutuarRolagem(ponto(x, y), msg.total, msg.titulo, msg.tom); } }
      else if (msg.tipo === 'retrato') { retratos.set(msg.id, msg.blob); versaoRetratos.value++; vp?.redesenharPecas(); }
    };
    for (const c of canais) c.onmessage = (e: MessageEvent<MensagemDoMestre>) => tratarMensagem(e.data);
    const aoMensagem = (ev: MessageEvent) => {
      if (!remoto || ev.origin !== location.origin) return;
      if (window.parent !== window && ev.source !== window.parent) return;
      const d = ev.data as { tipo?: unknown; fichas?: unknown } | null;
      if (!d || typeof d !== 'object' || d.tipo !== 'jogador' || !Array.isArray(d.fichas)) return;
      fichasDoJogador = d.fichas.filter((x): x is string => typeof x === 'string');
      vp?.redesenharPecas();
    };
    if (remoto) window.addEventListener('message', aoMensagem);

    // Enquanto o mestre não responde, pergunta de novo (ele pode abrir o mapa depois).
    const insistir = setInterval(() => { if (!doc.value) ola(); }, 1500);
    const aoRedimensionar = () => { dizer({ tipo: 'tamanho', ...tamanho() }); if (caixa && seguindo.peek()) vp?.enquadrarCaixa(caixaComZoom(caixa), false); };
    window.addEventListener('resize', aoRedimensionar);
    const aoSair = () => dizer({ tipo: 'tchau' });
    window.addEventListener('pagehide', aoSair);
    // A roda (inclusive sobre o canvas) dá zoom sem soltar o projetor: enquanto segue, o zoom é um fator sobre o enquadre do mestre.
    const aoRolarJanela = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.projetor-inspecao')) return;
      e.preventDefault(); e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const fator = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015));
      if (remoto) {   // zoom centrado no cursor, com os limites do editor (`zoomEm`); mexer solta a câmera
        if (!vp || !ref.current) return;
        soltarSeguimento();
        const r = ref.current.getBoundingClientRect();
        vp.definirCamera(zoomEm(vp.camera, [e.clientX - r.left, e.clientY - r.top], fator));
        return;
      }
      if (seguindo.peek() && caixaDoMestre) { zoomLocal = Math.min(20, Math.max(0.05, zoomLocal * fator)); vp?.enquadrarCaixa(caixaComZoom(caixaDoMestre), false); }
      else vp?.zoomPor(fator);
    };
    window.addEventListener('wheel', aoRolarJanela, { passive: false, capture: true });
    // Só o arrasto de mais de 4 px solta o projetor da câmera do mestre.
    function soltarSeguimento() { if (remoto) { estadoCam = decidirCamera(estadoCam, { tipo: 'mexeu' }).estado; seguindo.value = false; return; } if (!seguindo.peek()) return; seguindo.value = false; dizer({ tipo: 'soltou' }); }
    let apertado: { x: number; y: number } | null = null;
    const aoApertar = (e: PointerEvent) => { apertado = { x: e.clientX, y: e.clientY }; };
    const aoArrastar = (e: PointerEvent) => { if (apertado && Math.hypot(e.clientX - apertado.x, e.clientY - apertado.y) > 4) { soltarSeguimento(); apertado = null; } };
    const aoSoltar = (e?: PointerEvent) => { apertado = null; if (e) dedos.delete(e.pointerId); pinca = null; };
    // Pinça (remoto): com dois dedos, o ponto entre eles e a distância movem e dão zoom na câmera local.
    const dedos = new Map<number, { x: number; y: number }>();
    let pinca: { dist: number; cam: Camera; mx: number; my: number } | null = null;
    const aoApertarDedo = (e: PointerEvent) => { if (e.pointerType === 'touch') { dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinca = null; } };
    const aoMoverDedo = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size !== 2 || !vp || !ref.current) return;
      const [a, b] = [...dedos.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const r = ref.current.getBoundingClientRect(), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top, dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if (!pinca) { pinca = { dist, cam: vp.camera, mx, my }; return; }
      soltarSeguimento(); apertado = null;
      const base = zoomEm(pinca.cam, [pinca.mx, pinca.my], dist / pinca.dist);   // o zoom em torno do ponto inicial, com os limites do editor
      vp.definirCamera({ ...base, x: base.x + mx - pinca.mx, y: base.y + my - pinca.my });
    };
    const hospedeiro = ref.current;
    hospedeiro?.addEventListener('pointerdown', aoApertar); window.addEventListener('pointermove', aoArrastar);
    if (remoto) { hospedeiro?.addEventListener('pointerdown', aoApertarDedo); window.addEventListener('pointermove', aoMoverDedo); } window.addEventListener('pointerup', aoSoltar); window.addEventListener('pointercancel', aoSoltar);
    // O botão de tela cheia some depois de 3 s sem mexer o mouse.
    let sumir: ReturnType<typeof setTimeout>;
    const mexeu = () => { botaoVisivel.value = true; clearTimeout(sumir); sumir = setTimeout(() => { botaoVisivel.value = false; }, 3000); };
    window.addEventListener('pointermove', mexeu); mexeu();
    return () => {
      morto = true; clearInterval(insistir); clearTimeout(sumir); clearTimeout(relogioAvisoRemoto); avisoRemoto.value = null; aoSair();
      for (const c of canais) c.close();
      sairPing?.();
      barramento?.fechar();
      if (remoto) window.removeEventListener('message', aoMensagem);
      sairTema(); vp?.destruir(); store?.dispor();
      window.removeEventListener('resize', aoRedimensionar); window.removeEventListener('pagehide', aoSair); window.removeEventListener('pointermove', mexeu);
      window.removeEventListener('wheel', aoRolarJanela, { capture: true });
      hospedeiro?.removeEventListener('pointerdown', aoApertar); hospedeiro?.removeEventListener('pointerdown', aoApertarDedo); window.removeEventListener('pointermove', aoMoverDedo); window.removeEventListener('pointermove', aoArrastar); window.removeEventListener('pointerup', aoSoltar); window.removeEventListener('pointercancel', aoSoltar);
      vpAtual = null; seguirMestreRemoto = () => {};
      seguindo.value = true;
      versaoRetratos.value = 0;
      cortina.value = { escurecer: false, ms: 0 };
      letreiroDoProjetor.value = null;
      document.body.classList.remove('projetor');
    };
  }, [mapaId, salaId]);

  const lerRetrato = useMemo(() => (id: string) => lerRetratoLocal(id), [versaoRetratos.value]);
  const m = doc.value;
  const pecas = m?.tokens ?? {};
  return (
    <main class={`projetor${m?.style.renderer === 'pixel' ? ' projetor-pixel' : ''}`} data-testid="projetor">
      <div class="projetor-mapa" ref={ref} />
      <div class="projetor-moldura" aria-hidden="true"><i /><i /></div>
      {documentoDoProjetor.value && <div class="projetor-inspecao" data-testid="projetor-inspecao"><h2>{documentoDoProjetor.value.nome}</h2><VisorDeDocumento normal={documentoDoProjetor.value.normal} uv={documentoDoProjetor.value.uv} estado={estadoDaInspecao} testid="projetor-visor" /></div>}
      {m ? !remoto && <h1 class="projetor-titulo faixa" data-testid="projetor-titulo">{m.name}</h1> : <p class="projetor-espera" data-testid="projetor-espera">Aguardando o mestre…</p>}
      {m?.session.initiative && <div class="projetor-iniciativa"><FaixaDeIniciativa ini={m.session.initiative} pecas={pecas} lerRetrato={lerRetrato} /></div>}
      <div
        class="projetor-cortina"
        data-testid="projetor-cortina"
        style={{
          opacity: cortina.value.escurecer ? 1 : 0,
          transition: cortina.value.ms > 0 ? `opacity ${cortina.value.ms}ms ease-in-out` : 'none',
        }}
        aria-hidden="true"
      />
      {letreiroDoProjetor.value && (
        <LetreiroDoProjetor
          dados={letreiroDoProjetor.value}
          lerRetrato={lerRetrato}
          aoTerminar={() => { letreiroDoProjetor.value = null; }}
        />
      )}
      {!seguindo.value && <button type="button" class={`projetor-seguir${remoto ? ' remoto' : ` ${botaoVisivel.value ? '' : 'oculto'}`}`} data-testid="projetor-seguir"
        onClick={() => { if (remoto) { seguirMestreRemoto(); return; } seguindo.value = true; zoomLocal = 1; if (caixaDoMestre) vpAtual?.enquadrarCaixa(caixaDoMestre, true); }}>Seguir o mestre</button>}
      {avisoRemoto.value && <div class="projetor-aviso-remoto" role="status" data-testid="projetor-aviso-remoto">{avisoRemoto.value}</div>}
      {!remoto && <button type="button" class={`projetor-tela-cheia ${botaoVisivel.value ? '' : 'oculto'}`} aria-label="Tela cheia" title="Tela cheia" data-testid="projetor-tela-cheia"
        onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }}><Icone nome="enquadrar" tamanho={20} /></button>}
    </main>
  );
}
