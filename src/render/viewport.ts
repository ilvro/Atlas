import { ladoBaixo } from '../procedural/escarpa.ts';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { capturarViewport, type Captura } from './captura.ts';
import { criarEventosDeCena, type EventoDeCena, type EstadoDosEventos } from './eventos-de-cena.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { distanciaDoPercurso, pontosDaRegua, textoDaRegua, type RegraDeDiagonal } from '../domain/regua.ts';
import { circulo, ehPoligonoSimples } from '../domain/formas-de-comodo.ts';
import { celulasDoDisco, celulasEntre, decodificar } from '../domain/celulas.ts';
import { misturar, type EstadoDeClima, type MisturaDeClima } from '../domain/clima.ts';
import { copiasDe, novaLuz, novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import { interacaoDeEscadaPadrao, mapaDoAndar } from '../domain/andares.ts';
import { livreParaObjeto } from '../domain/encaixe.ts';
import { comprimentoDaParede, contornoDoComodo, encaixarNaParede, encaixarObjetoDeParede, indiceDeCelulas, pontoNaParede, salaDaCelula } from '../domain/geometria.ts';
import type { Abertura, ColecaoLivre, MapaAtlas, Peca, Ponto } from '../domain/mapa.ts';
import type { Ping } from '../domain/pings.ts';
import { criarCamadaDePings } from './pings-camada.ts';
import type { Recursos } from '../domain/fichas.ts';
import { TIPOS_DE_COMODO, camposDoPreset, pincelDePresenca, presetDeLuz, telhadoPadrao, tipoDeComodo } from '../domain/presets.ts';
import { fxAtivo } from '../fx/fx.ts';
import { criarBaker, type Baker } from '../procedural/baker.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { sortearVariante } from '../procedural/familias.ts';
import { carimbar, type Ocupado } from '../domain/carimbar.ts';
import { camposDoPincel, pincelDoObjeto, type CamposDoPincel } from '../domain/pincel-de-objeto.ts';
import { materialDe } from '../procedural/materiais.ts';
import type { EventoStore, Gesto, Store } from '../state/store.ts';
import { criarFiltroAcabamento } from './acabamento.ts';
import { enquadrar as calcularEnquadre, limitarZoom, mundoParaTela, panear, telaParaMundo, zoomEm, type Camera, type Tela } from './camera.ts';
import { criarPixelizacao } from './pixelizar.ts';
import { criarCena, type Cena } from './cena.ts';
import { bloqueioNoCaminho, centroDaCelula } from '../domain/movimento.ts';
import { hexParaNumero } from './cores.ts';
import { chaveDoObjeto, opcoesDoPixel, pedidoDoObjeto, resolucaoDe } from './entradas.ts';
import { texturaPropria } from './textura-propria.ts';
import { criarFantasmaDeProposta } from './fantasma-proposta.ts';
import type { Vista } from './nevoa.ts';
import { criarRetratos } from './retratos.ts';
import { ajustarGradePorAlinhamento, celulasHexagonaisVisiveis, deltaEncaixado, encaixar, intersecoesDaGrade, linhasDaGrade, segmentosTracejados } from './grade.ts';
import { LARGURA_DA_ABERTURA, comandoDeComodoPorContorno, comandoDoPincelDeTerreno, pontoPreso45, type Ferramenta, type Pincel } from './pincel.ts';
import { corDaLinhaDeNivel, criarLinhasDeNivel } from './linhas-de-nivel.ts';
import { alvoEm, alvosNaCaixa, alvosNoLaco, caixaDaSelecao, caixaDe, combinarSelecao, ehMovel, mesmoAlvo, type Alvo, type AlvoMovel, type Caixa } from './selecao.ts';

export type { Ferramenta } from './pincel.ts';
export const colecaoDaFerramenta = (f: Ferramenta): ColecaoLivre | null => ({ luz: 'lights', objeto: 'props', peca: 'tokens', regiao: 'regions' } as Partial<Record<Ferramenta, ColecaoLivre>>)[f] ?? null;

/** O que o viewport precisa do resto do aplicativo. Ele não conhece Preact nem signals. */
export interface PonteViewport {
  store: Store;
  selecao(): readonly Alvo[];
  definirSelecao(alvos: Alvo[]): void;
  ferramenta(): Ferramenta;
  definirFerramenta(f: Ferramenta): void;
  pincel(): Pincel;
  definirPincel(p: Partial<Pincel>): void;
  /** Clique com a ferramenta de peça ou de região: o aplicativo cria o item (com som, efeito e seleção). */
  adicionar(colecao: ColecaoLivre, mundo: Ponto): void;
  /** Algo foi posto pelas ferramentas de construção: som e efeito. */
  aoColocar(rotulo: string, mundo: Ponto): void;
  /** Um objeto da biblioteca foi posto (id do item): alimenta os recentes. */
  aoPorObjeto?(itemId: string): void;
  /** Uma operação foi recusada (não cabe, fora do mapa…): o aplicativo mostra o motivo. */
  aviso(texto: string): void;
  aoMenuContexto(info: { tela: Ponto; mundo: Ponto; alvo: Alvo | null }): void;
  aoCamera?(c: Camera): void;
  /** Mostrar o acabamento (vinheta, tinta…) no editor? */
  acabamento(): boolean;
  /** Preferência: objetos e luzes encaixam na grade por padrão (ausente: livres, e `Alt` encaixa). */
  objetosNaGrade?(): boolean;
  /** Mostrar os telhados no modo Construir? (ausente: escondidos, como antes) */
  telhados?(): boolean;
  /** Lê a imagem guardada de um retrato (pelo id do asset). */
  lerRetrato?(id: string): Promise<Blob | null>;
  /** PV e PD da ficha ligada a uma peça, para os pips; sem a função (ou `null`) não há pips. */
  recursosDaPeca?(t: Peca): Recursos | null;
  /** A peça pertence ao jogador que está vendo o projetor remoto (R14)? */
  pecaDoJogador?(t: Peca): boolean;
  /** No projetor remoto, o jogador pode arrastar a própria peça? (ausente = sim). */
  podeMoverPecaRemota?(): boolean;
  /** No projetor remoto, a câmera está bloqueada para o jogador (controle do mestre)? */
  cameraBloqueada?(): boolean;
  /** No projetor remoto (R15), o jogador arrastou a própria peça até `para`; resolve `true` se o mestre aceitou. */
  aoArrastarPecaRemota?(peca: Peca, para: Ponto, emArrasto?: boolean): Promise<boolean>;
  /** No projetor remoto com jogadores livres, clicar numa porta pede para abri-la ou fechá-la. */
  aoAlternarPortaRemota?(id: string): void;
  /** Ping no mapa (R15b): Alt+clique (mestre/jogador) ou segurar 400 ms num ponto vazio (jogador remoto). */
  aoPingar?(ponto: Ponto): void;
  /** Na sessão, arrastar uma peça a leva de célula em célula e as outras coisas só se selecionam. */
  emSessao?(): boolean;
  /** Na sessão, mover peças sem encaixar na grade (com atualização em tempo real durante o arrasto). */
  movimentoLivre?(): boolean;
  /** Pelos olhos de quem se vê o mapa agora (o mestre em Construir vê sempre tudo). */
  vista?(): Vista;
  /** Quanto dura a transição entre dois climas, em ms (preferência local); sem a função vale o padrão. */
  duracaoDaTransicao?(): number | null;
  /** O projetor não edita nem seleciona nada: só mostra. */
  somenteLeitura?: boolean;
  /** O retângulo que o projetor enquadra, mostrado no mapa do mestre (na Sessão); `null` esconde. */
  caixaDoProjetor?(): Caixa | null;
  /** Modo de Alinhamento da grade: desenha gabarito 3x3 para calibrar offset e escala. */
  alinhandoGrade?(): boolean;
  /** Mostrar linhas de contorno do relevo mesmo fora do pincel de relevo (só em Construir). */
  mostrarRelevo?(): boolean;
  /** Proporção (largura / altura) da tela do projetor, para o retângulo ter a forma certa. */
  aspectoDoProjetor?(): number;
  aoMudarCaixaDoProjetor?(c: Caixa): void;
  /** Na sessão, clicar numa porta a abre ou fecha. */
  aoInteragir?(alvo: Alvo): void;
  /** Como a régua conta as diagonais (preferência local). */
  regraDaRegua?(): RegraDeDiagonal;
  /** Câmera salva para restaurar ao abrir o mapa (em vez de enquadrar do zero). */
  cameraInicial?: Camera;
  /** Andar exibido pelo editor/projetor (`null` = térreo). */
  andarAtivo?(): string | null;
  /** Gera comandos de uma pincelada de espalhar (ou apagar espalhados), fornecido pela camada de aplicativo. */
  espalhar?(base: MapaAtlas, mundo: Ponto, opcoes: { conjunto: string; raio: number; apagar: boolean; semente: number; andar: string | null }): readonly Parameters<Gesto['aplicar']>[0][];
}

/** Quanto dura a transição entre dois climas, em milissegundos, se ninguém escolheu outra. */
const DURACAO_PADRAO_DA_TRANSICAO = 1600;

export type { Captura } from './captura.ts';

export interface Viewport {
  readonly camera: Camera;
  readonly tela: Tela;
  /** Quantos desenhos ainda estão sendo pintados no worker. */
  readonly pintando: number;
  ponteiro(): Ponto | null;
  centro(): Ponto;
  enquadrar(): void;
  definirCamera(camera: Camera): void;
  focarEm(caixa: Caixa): void;
  zoomPor(fator: number): void;
  /** Posição na tela do navegador (px de `client`) de um ponto do mundo, para ancorar efeitos DOM e o cartão contextual. */
  clientDe(mundo: Ponto): Ponto;
  /** O ponto do mundo sob uma posição da tela do navegador (soltar um personagem arrastado). */
  mundoDe(clientX: number, clientY: number): Ponto;
  /** Refaz tudo (mudou o tema, por exemplo). */
  redesenhar(): void;
  /** Refaz só as peças (chegaram PV e PD novos). */
  redesenharPecas(): void;
  /** Só a seleção, o fantasma e a grade: a seleção, a ferramenta ou o pincel mudaram fora do viewport. */
  atualizarSobreposicoes(): void;
  /** Dispara um relâmpago (e o trovão, se o som estiver ligado). Só vale com a atmosfera visível. */
  relampagoAgora(): void;
  /** Exibe um ping animado no mapa (R15b). */
  dispararPing(ping: Ping): void;
  /** Quanto dura, daqui em diante, a transição entre dois climas. */
  definirDuracaoDaTransicao(ms: number): void;
  /** Enquadra `caixa` (em metros) na tela inteira; `suave` anima a câmera (o projetor). */
  enquadrarCaixa(caixa: Caixa, suave: boolean): void;
  /** Um evento de cena (tremor, piscar, escurecer, clarão): do render, não muda o documento. */
  dispararEvento(e: EventoDeCena): void;
  /** Para os testes: os eventos rodando agora e o que fazem. */
  diagnosticoDosEventos(): EstadoDosEventos;
  /** Quantas partículas de cada tipo existem agora (diagnóstico e testes). */
  contagemDeParticulas(): ReturnType<Cena['contagemDeParticulas']>;
  contagemDePresencas(): number;
  contagemDePresencasSubmersas(): number;
  contagemDeCachoeiras(): number;
  /** Se a superfície animada da água está desenhada (para os testes). */
  aguaAtiva(): boolean;
  /** Quantos objetos de piso já têm a textura pintada (para os testes). */
  objetosPintados(): number;
  tintDeObjeto(id: string): number | null;
  /** Para os testes: como cada peça está desenhada. */
  diagnosticoDasPecas(): ReturnType<Cena['diagnosticoDasPecas']>;
  diagnosticoDosTelhados(): ReturnType<Cena['diagnosticoDosTelhados']>;
  /** Mostra, translúcido, o que `previa` acrescenta ao documento; `null` limpa. Quem chamou recalcula se o documento mudar. */
  mostrarProposta(previa: MapaAtlas | null): void;
  contagemDoFantasma(): number;
  /** Visibilidade das prévias (ferramenta, sugestão, laço); todas somem no modo projetor. */
  fantasmasVisiveis(): { ferramenta: boolean; proposta: boolean; laco: boolean };
  /** Para os testes: o que a régua mede agora (ou `null` sem régua ou com um ponto só). */
  diagnosticoDaRegua(): { quadrados: number; texto: string; pontos: number } | null;
  /** Esconde ou mostra os marcadores de editor (grade, contorno da área, pinos de luz e regiões). */
  definirModoProjetor(ligado: boolean): void;
  /** Para os testes: simula um valor de pintando (> 0 ou null para desligar). */
  simularPintando?(n: number | null): void;
  /**
   * Fotografa o mapa como o mestre o vê, sem marcadores nem interface: guarda a câmera e o modo, liga o projetor, enquadra `caixa` (padrão: o mapa todo),
   * espera o assar terminar, extrai a cena e restaura tudo. Devolve um PNG (dataURL) cujo maior lado cabe em `ladoMaximo`, mais a escala e a caixa efetivas.
   */
  capturar(opcoes?: { caixa?: Caixa; ladoMaximo?: number; vista?: 'planta' | 'telhados' }): Promise<Captura>;
  destruir(): void;
}

const LIMIAR_ARRASTO = 4;
const COR_PADRAO_ACENTO = 0xe91d25;

type Interacao =
  | { tipo: 'pan'; botao: number; x0: number; y0: number; camera0: Camera; moveu: boolean; portaId?: string }
  | { tipo: 'mover'; hit: Alvo; alvos: AlvoMovel[]; origem: Ponto; ref: Ponto; aplicado: Ponto; gesto: Gesto | null; x0: number; y0: number; estavaNaSelecao: boolean; ctrl: boolean }
  | { tipo: 'peca'; id: string; de: Ponto; para: Ponto; offset: Ponto; dirRef: Ponto; dirAtual?: number; motivo: string | null; livre: boolean; semGrade: boolean; gesto: Gesto | null; pendente: boolean; x0: number; y0: number; moveu: boolean }
  | { tipo: 'peca-remota'; id: string; de: Ponto; para: Ponto; offset: Ponto; motivo: string | null; semGrade: boolean; x0: number; y0: number; moveu: boolean; ultimoEnvio?: number; emVoo?: boolean }
  | { tipo: 'deslizar'; id: string; gesto: Gesto | null; x0: number; y0: number }
  | { tipo: 'retangulo'; ini: Ponto; atual: Ponto; modo: 'trocar' | 'somar'; x0: number; y0: number; moveu: boolean }
  | { tipo: 'laco'; pontos: Ponto[]; modo: 'trocar' | 'somar' }
  | { tipo: 'cômodo'; apagar: boolean; sala: string; criado: boolean; gesto: Gesto; ini: [number, number]; atual: [number, number]; retangulo: boolean; visitadas: Set<number> }
  | { tipo: 'comodo-circulo'; centro: Ponto; atual: Ponto; lados: number; tipoComodo: string }
  | { tipo: 'comodo-poligono'; pontos: Ponto[]; atual: Ponto; tipoComodo: string }
  | { tipo: 'terreno'; apagar: boolean; gesto: Gesto; ultimo: Ponto; presenca: boolean }
  | { tipo: 'espalhar'; apagar: boolean; gesto: Gesto; ultimo: Ponto; semente: number }
  /** O pincel de objeto no modo Vários: arrastar carimba de novo a cada passo, tudo num desfazer só. */
  | { tipo: 'carimbar'; gesto: Gesto; ultimo: Ponto; livre: boolean; postos: string[]; nome: string }
  | { tipo: 'parede'; ini: Ponto; fim: Ponto }
  | { tipo: 'projetor'; modo: 'mover' | 'canto'; origem: Ponto; caixa0: Caixa; fixo: Ponto }
  | { tipo: 'alinhamento-grade'; modo: 'offset' | 'escala'; origem: Ponto; grade0: { size: number; offset: [number, number] }; gesto: Gesto }
  | { tipo: 'regua'; ini: Ponto; x0: number; y0: number; moveu: boolean };

/** A régua: os pontos já fixados (centros de célula) e, enquanto se espera o próximo clique, o ponto sob o ponteiro. Não é do documento. */
interface Regua { pontos: Ponto[]; atual: Ponto | null }

const chaveCel = (x: number, y: number) => y * 200_003 + x;

const colunasDe = (m: MapaAtlas) => Math.ceil(m.bounds.width / m.grid.size), linhasDe = (m: MapaAtlas) => Math.ceil(m.bounds.height / m.grid.size);
const celulaDe = (m: MapaAtlas, p: Ponto): [number, number] => [Math.floor((p[0] - m.grid.offset[0]) / m.grid.size), Math.floor((p[1] - m.grid.offset[1]) / m.grid.size)];
const dentroDoMapa = (m: MapaAtlas, c: readonly [number, number]) => c[0] >= 0 && c[1] >= 0 && c[0] < colunasDe(m) && c[1] < linhasDe(m);

function retanguloDeCelulas(m: MapaAtlas, a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const saida: [number, number][] = [];
  for (let y = Math.max(0, Math.min(a[1], b[1])); y <= Math.min(linhasDe(m) - 1, Math.max(a[1], b[1])); y++) for (let x = Math.max(0, Math.min(a[0], b[0])); x <= Math.min(colunasDe(m) - 1, Math.max(a[0], b[0])); x++) saida.push([x, y]);
  return saida;
}

export async function criarViewport(host: HTMLElement, ponte: PonteViewport): Promise<Viewport> {
  const app = new Application();
  await app.init({ resizeTo: host, background: '#07080b', antialias: true, resolution: Math.min(globalThis.devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
  app.canvas.setAttribute('role', 'application');
  app.canvas.setAttribute('aria-label', 'Mapa. Clique para selecionar, arraste para mover, role para aproximar, botão direito para opções.');
  app.canvas.setAttribute('data-testid', 'mapa');
  host.appendChild(app.canvas);

  const somenteLeitura = ponte.somenteLeitura === true;
  const clarao = new Graphics(); clarao.visible = false;
  let camAnim: { de: Camera; para: Camera; t0: number } | null = null;
  const store = ponte.store, baker: Baker = criarBaker({ reaproveitarWorkers: true });
  const mundo = new Container(), area_ = new Graphics(), grade = new Graphics(), selecaoG = new Graphics(), fantasmaC = new Container(), fantasmaG = new Graphics(), laco = new Graphics();
  let camera: Camera = { x: 0, y: 0, zoom: 20 };
  let ponteiro: Ponto | null = null, interacao: Interacao | null = null, espaco = false, camadaSuja = true, gradeSuja = true, destruido = false, regua: Regua | null = null, altPressionado = false, modoProjetor = somenteLeitura, sobrePecaDoJogador = false, sobrePortaRemota = false;
  let pecaRemotaPendente: { id: string; de: Ponto; para: Ponto; motivo: string | null; semGrade: boolean; relogio?: ReturnType<typeof setTimeout> } | null = null;
  const limparPecaRemotaPendente = () => {
    if (!pecaRemotaPendente) return;
    if (pecaRemotaPendente.relogio !== undefined) clearTimeout(pecaRemotaPendente.relogio);
    pecaRemotaPendente = null;
    camadaSuja = true;
  };
  let relogioPing: ReturnType<typeof setTimeout> | undefined;
  const cancelarRelogioPing = () => { if (relogioPing !== undefined) { clearTimeout(relogioPing); relogioPing = undefined; } };
  const reguaTexto = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: '600', fill: 0xffffff, stroke: { color: 0x07080b, width: 4 } } });
  reguaTexto.visible = false;
  const completo = (): MapaAtlas => store.documento;
  const andarAtual = (): string | null => ponte.andarAtivo?.() ?? null;
  const doc = (): MapaAtlas => mapaDoAndar(completo(), andarAtual());
  const objetosNaGrade = (): boolean => ponte.objetosNaGrade?.() === true;
  const ctxAndar = () => ({ completo: completo(), andar: andarAtual(), construir: !somenteLeitura && !modoProjetor && !ponte.emSessao?.() });
  let ultimoAndar: string | null = andarAtual();
  let ultimoConstruir = ctxAndar().construir;
  const tela = (): Tela => ({ largura: app.screen.width, altura: app.screen.height });
  const acento = (): number => { const v = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? hexParaNumero(v) : COR_PADRAO_ACENTO; };
  const px = (n: number) => n / camera.zoom;

  const retratos = criarRetratos(async id => (await ponte.lerRetrato?.(id)) ?? null, () => {
    // Chegou um retrato: redesenha as peças (só as peças, sem refazer o resto).
    if (destruido) return; const m = doc(); cena.sincronizar(m, { completo: false, colecoes: { tokens: Object.keys(m.tokens) }, campos: [] }, false, visaoDoClima(m), ctxAndar()); camadaSuja = true;
  });
  const cena: Cena = criarCena({ baker, renderer: app.renderer, acento, efeitos: fxAtivo, aoPintar: () => { camadaSuja = true; }, retrato: (id, pixel) => retratos.obter(id, pixel), recursos: t => ponte.recursosDaPeca?.(t) ?? null, pecaDoJogador: t => ponte.pecaDoJogador?.(t) ?? false });
  const acabamento = criarFiltroAcabamento();
  const pixelizacao = criarPixelizacao(app.renderer);
  let pixelAtivo = false, zoomLivre = camera.zoom;
  fantasmaC.addChild(fantasmaG);
  const fantasmaDaProposta = criarFantasmaDeProposta({ baker, acento, efeitos: fxAtivo });
  const linhasDeNivel = criarLinhasDeNivel();
  mundo.addChild(area_, cena.raiz, pixelizacao.sprite, grade, linhasDeNivel.container, selecaoG, fantasmaC, fantasmaDaProposta.raiz, laco, reguaTexto);
  const camadaPings = criarCamadaDePings();
  app.stage.addChild(mundo, clarao, camadaPings.raiz);

  // ---------- Transição de clima ----------
  // O documento muda na hora; o que a cena exibe (luz, partículas, neblina, acabamento) caminha até ele em `duracaoDaTransicao`.
  let duracaoDaTransicao = ponte.duracaoDaTransicao?.() ?? DURACAO_PADRAO_DA_TRANSICAO;
  const eventos = criarEventosDeCena(movimentoReduzido);
  let tremorAtual: [number, number] = [0, 0];
  let transicao: { de: EstadoDeClima; alvo: EstadoDeClima; inicio: number } | null = null;
  let exibido: MisturaDeClima | null = null;      // o estado misturado agora; null quando o exibido é o próprio documento
  const estadoDoDoc = (m: MapaAtlas): EstadoDeClima => ({ climate: m.climate, finish: m.finish });
  /** O clima que a cena exibe agora, em forma de estado (a rede ainda é ligada ou não: o piscar da queda é da luz). */
  let vistoDoDoc: EstadoDeClima = estadoDoDoc(doc());      // o clima do documento no último evento (o `doc()` já é o novo quando o evento chega)
  const estadoExibido = (): EstadoDeClima => exibido ? { climate: { ...exibido.climate, gridPower: doc().climate.gridPower }, finish: exibido.finish } : vistoDoDoc;
  /** O documento visto com o clima exibido (o próprio documento quando não há transição). */
  const visaoDoClima = (m: MapaAtlas): MapaAtlas => exibido ? { ...m, ...estadoExibido() } : m;
  const suave = (t: number) => t * t * (3 - 2 * t);

  const alvoDoAcabamento = () => (pixelAtivo ? pixelizacao.sprite : cena.raiz);

  function aplicarAcabamento(): void {
    const m = doc(), finish = (exibido ?? m).finish, ligado = ponte.acabamento() && (finish.preset !== 'nenhum' || exibido !== null);
    cena.definirAtmosfera(ponte.acabamento());
    cena.definirTelhadosNoEditor(ponte.telhados?.() ?? false);
    // No Pixel o acabamento vai sobre o sprite pixelizado (o filtro de paleta já rodou dentro dele); no Ilustrado, direto na raiz da cena.
    const alvo = alvoDoAcabamento(), outro = pixelAtivo ? cena.raiz : pixelizacao.sprite;
    outro.filters = []; alvo.filters = ligado ? [acabamento.filtro] : [];
    if (ligado) acabamento.aplicar(finish, performance.now() / 1000);
  }

  function pararTransicao(): void { transicao = null; exibido = null; }
  function iniciarTransicao(de: EstadoDeClima, m: MapaAtlas): void {
    transicao = { de, alvo: estadoDoDoc(m), inicio: performance.now() };
    exibido = misturar(de, transicao.alvo, 0);
  }
  function passoDaTransicao(agora: number): void {
    if (!transicao) return;
    const t = Math.min(1, (agora - transicao.inicio) / duracaoDaTransicao), m = doc();
    if (t >= 1) { pararTransicao(); cena.atualizarAtmosfera(m); aplicarAcabamento(); return; }
    exibido = misturar(transicao.de, transicao.alvo, suave(t));
    cena.atualizarAtmosfera(visaoDoClima(m)); aplicarAcabamento();
  }

  function desenharBase(m: MapaAtlas): void {
    area_.visible = !somenteLeitura;
    app.renderer.background.color = hexParaNumero(m.backdrop.color);
    area_.clear().rect(0, 0, m.bounds.width, m.bounds.height).fill({ color: 0xffffff, alpha: 0.03 }).stroke({ width: px(1.5), color: 0xffffff, alpha: 0.14 });
  }

  let ultimoAlinhandoGrade = Boolean(ponte.alinhandoGrade?.());
  function desenharGrade(): void {
    const m = doc(); grade.clear();
    if (somenteLeitura) return;
    const alinhando = ponte.alinhandoGrade?.() ?? false;
    ultimoAlinhandoGrade = alinhando;
    if (!m.grid.visible && !alinhando) return;

    const kind = m.grid.kind ?? 'square';
    const lineStyle = m.grid.lineStyle ?? 'solid';
    const lineWidth = px(m.grid.lineWidth ?? 1);
    const baseOpacity = m.grid.opacity ?? 0.1;
    const isAutoColor = m.grid.color === 'auto';
    const customColor = isAutoColor ? 0xffffff : hexParaNumero(m.grid.color);

    const desenharComEstilo = (desenharGeometria: (alpha: number, isShadow: boolean) => void) => {
      if (isAutoColor) {
        desenharGeometria(baseOpacity * 0.7, true);
        desenharGeometria(baseOpacity, false);
      } else {
        desenharGeometria(baseOpacity, false);
      }
    };

    if (m.grid.visible) {
      if (kind === 'hex') {
        const hexes = celulasHexagonaisVisiveis(camera, tela(), m.grid, m.bounds);
        desenharComEstilo((alpha, isShadow) => {
          for (const h of hexes) {
            grade.moveTo(h.vertices[0]![0], h.vertices[0]![1]);
            for (let k = 1; k < h.vertices.length; k++) {
              grade.lineTo(h.vertices[k]![0], h.vertices[k]![1]);
            }
            grade.closePath();
          }
          const cor = isShadow ? 0x07080b : customColor;
          const w = isShadow ? lineWidth + px(1) : lineWidth;
          grade.stroke({ width: w, color: cor, alpha });
        });
      } else {
        const l = linhasDaGrade(camera, tela(), m.grid, m.bounds);
        if (lineStyle === 'corners') {
          const inters = intersecoesDaGrade(l);
          const arm = Math.min(m.grid.size * 0.18, 0.25);
          desenharComEstilo((alpha, isShadow) => {
            for (const [x, y] of inters) {
              grade.moveTo(x - arm, y).lineTo(x + arm, y);
              grade.moveTo(x, y - arm).lineTo(x, y + arm);
            }
            const cor = isShadow ? 0x07080b : customColor;
            const w = isShadow ? lineWidth + px(1) : lineWidth;
            grade.stroke({ width: w, color: cor, alpha });
          });
        } else if (lineStyle === 'dashed' || lineStyle === 'dotted') {
          const comp = lineStyle === 'dotted' ? Math.max(px(2) / camera.zoom, 0.04) : m.grid.size * 0.2;
          const espaco = lineStyle === 'dotted' ? m.grid.size * 0.15 : m.grid.size * 0.15;
          desenharComEstilo((alpha, isShadow) => {
            for (const x of l.verticais) {
              const segs = segmentosTracejados(0, m.bounds.height, comp, espaco);
              for (const [y0, y1] of segs) grade.moveTo(x, y0).lineTo(x, y1);
            }
            for (const y of l.horizontais) {
              const segs = segmentosTracejados(0, m.bounds.width, comp, espaco);
              for (const [x0, x1] of segs) grade.moveTo(x0, y).lineTo(x1, y);
            }
            const cor = isShadow ? 0x07080b : customColor;
            const w = isShadow ? lineWidth + px(1) : lineWidth;
            grade.stroke({ width: w, color: cor, alpha });
          });
        } else {
          // 'solid'
          desenharComEstilo((alpha, isShadow) => {
            for (const v of l.verticais) grade.moveTo(v, 0).lineTo(v, m.bounds.height);
            for (const v of l.horizontais) grade.moveTo(0, v).lineTo(m.bounds.width, v);
            const cor = isShadow ? 0x07080b : customColor;
            const w = isShadow ? lineWidth + px(1) : lineWidth;
            grade.stroke({ width: w, color: cor, alpha });
          });
        }
      }
    }

    if (alinhando) {
      const centroTela = [tela().largura / 2, tela().altura / 2] as [number, number];
      const centroMundo = telaParaMundo(camera, centroTela);
      const celulas = 3;
      const tamTotal = m.grid.size * celulas;
      const cx0 = Math.floor((centroMundo[0] - m.grid.offset[0] - tamTotal / 2) / m.grid.size) * m.grid.size + m.grid.offset[0];
      const cy0 = Math.floor((centroMundo[1] - m.grid.offset[1] - tamTotal / 2) / m.grid.size) * m.grid.size + m.grid.offset[1];
      const cx1 = cx0 + tamTotal;
      const cy1 = cy0 + tamTotal;

      // Fundo e contorno do gabarito 3x3
      grade.rect(cx0, cy0, tamTotal, tamTotal).fill({ color: 0x00e5ff, alpha: 0.12 }).stroke({ width: px(2.5), color: 0x00e5ff, alpha: 0.9 });

      // Linhas internas da grade 3x3
      for (let k = 1; k < celulas; k++) {
        grade.moveTo(cx0 + k * m.grid.size, cy0).lineTo(cx0 + k * m.grid.size, cy1);
        grade.moveTo(cx0, cy0 + k * m.grid.size).lineTo(cx1, cy0 + k * m.grid.size);
      }
      grade.stroke({ width: px(1.5), color: 0x00e5ff, alpha: 0.5 });

      // Alça de escala no canto inferior direito
      const tamAlca = px(12);
      grade.rect(cx1 - tamAlca / 2, cy1 - tamAlca / 2, tamAlca, tamAlca).fill({ color: 0xffffff }).stroke({ width: px(2), color: 0x00e5ff });

      // Ponto no centro para arrastar offset
      const meioX = (cx0 + cx1) / 2, meioY = (cy0 + cy1) / 2;
      grade.circle(meioX, meioY, px(8)).fill({ color: 0x00e5ff, alpha: 0.8 }).stroke({ width: px(1.5), color: 0xffffff });
    }
  }

  function desenharSelecao(): void {
    if (somenteLeitura) return;
    const m = doc(), cor = acento(), alvos = ponte.selecao().filter(a => caixaDe(m, a));
    selecaoG.clear();
    const pad = px(5);
    for (const a of alvos) {
      if (a.colecao === 'rooms') {
        const s = m.rooms[a.id]!;
        for (const lc of contornoDoComodo(m, decodificar(s.cells), s.outline)) { selecaoG.moveTo(lc[0]!.a[0], lc[0]!.a[1]); for (const seg of lc) selecaoG.lineTo(seg.b[0], seg.b[1]); selecaoG.closePath(); }
        selecaoG.stroke({ width: px(2.5), color: cor, alpha: 0.95 }); continue;
      }
      if (a.colecao === 'walls') { const p = m.walls[a.id]!; selecaoG.moveTo(p.path[0]![0], p.path[0]![1]); for (const q of p.path.slice(1)) selecaoG.lineTo(q[0], q[1]); selecaoG.stroke({ width: p.thickness + px(6), color: cor, alpha: 0.55, cap: 'round', join: 'round' });
        if (p.kind === 'cliff' && !p.source) {      // seta para o lado baixo, a partir do meio do trecho mais longo
          let b = 0, bc = 0; for (let k = 0; k + 1 < p.path.length; k++) { const c = Math.hypot(p.path[k + 1]![0] - p.path[k]![0], p.path[k + 1]![1] - p.path[k]![1]); if (c > bc) { bc = c; b = k; } }
          const A = p.path[b]!, B = p.path[b + 1]!, n = ladoBaixo(A, B, p.drop ?? 'b'), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, L = px(34), ax = mx + n[0] * L, ay = my + n[1] * L, h = px(8);
          selecaoG.moveTo(mx, my).lineTo(ax, ay).moveTo(ax - n[0] * h - n[1] * h * 0.7, ay - n[1] * h + n[0] * h * 0.7).lineTo(ax, ay).lineTo(ax - n[0] * h + n[1] * h * 0.7, ay - n[1] * h - n[0] * h * 0.7).stroke({ width: px(2.5), color: cor, alpha: 0.95, cap: 'round', join: 'round' });
        }
        continue; }
      const c = caixaDe(m, a)!;
      selecaoG.roundRect(c.x0 - pad, c.y0 - pad, c.x1 - c.x0 + 2 * pad, c.y1 - c.y0 + 2 * pad, px(3)).stroke({ width: px(2), color: cor });
    }
    const u = caixaDaSelecao(m, alvos.filter(a => a.colecao !== 'rooms' && a.colecao !== 'walls'));
    if (u && alvos.length > 1) {
      selecaoG.rect(u.x0 - pad * 2, u.y0 - pad * 2, u.x1 - u.x0 + 4 * pad, u.y1 - u.y0 + 4 * pad).stroke({ width: px(1), color: cor, alpha: 0.55 });
      for (const [x, y] of [[u.x0, u.y0], [u.x1, u.y0], [u.x0, u.y1], [u.x1, u.y1]] as const) selecaoG.rect(x - pad * 2 - px(3), y - pad * 2 - px(3), px(6), px(6)).fill(0xffffff).stroke({ width: px(1), color: cor });
    }
  }

  /** Os pontos da régua, com o do ponteiro no fim enquanto se espera o próximo clique. */
  const pontosDaReguaAgora = (): Ponto[] => (regua ? (regua.atual ? [...regua.pontos, regua.atual] : regua.pontos) : []);
  function medidaDaRegua(): { quadrados: number; texto: string; pontos: number } | null {
    const pts = pontosDaReguaAgora(), m = doc();
    if (pts.length < 2) return null;
    const quadrados = distanciaDoPercurso(pts, m.grid.size, ponte.regraDaRegua?.() ?? 'simples');
    return { quadrados, texto: textoDaRegua(quadrados, m.grid.size), pontos: pts.length };
  }

  /** A linha da régua, as células que ela cruza e "6 quadrados · 9 m". Serve às duas vistas. */
  function desenharRegua(cor: number): void {
    const pts = pontosDaReguaAgora(), m = doc(), medida = medidaDaRegua();
    reguaTexto.visible = false;
    if (!pts.length) return;
    const t = m.grid.size;
    if (pts.length > 1) {
      for (const [x, y] of pontosDaRegua(pts, m.grid)) laco.rect(m.grid.offset[0] + x * t, m.grid.offset[1] + y * t, t, t);
      laco.fill({ color: cor, alpha: 0.16 });
      laco.moveTo(pts[0]![0], pts[0]![1]); for (const q of pts.slice(1)) laco.lineTo(q[0], q[1]);
      laco.stroke({ width: px(5), color: 0x07080b, alpha: 0.55, cap: 'round', join: 'round' });
      laco.moveTo(pts[0]![0], pts[0]![1]); for (const q of pts.slice(1)) laco.lineTo(q[0], q[1]);
      laco.stroke({ width: px(2.5), color: cor, alpha: 0.95, cap: 'round', join: 'round' });
    }
    for (const q of pts) laco.circle(q[0], q[1], px(4.5)).fill(0xffffff).stroke({ width: px(1.5), color: cor });
    if (medida) {
      const fim = pts.at(-1)!;
      reguaTexto.text = medida.texto; reguaTexto.scale.set(1 / camera.zoom); reguaTexto.position.set(fim[0] + px(12), fim[1] - px(26)); reguaTexto.visible = true;
    }
  }

  /** O quadro que o projetor enquadra, no mapa do mestre: contorno, cantos para redimensionar e o nome. */
  function desenharCaixaDoProjetor(cor: number): void {
    const c = ponte.emSessao?.() ? ponte.caixaDoProjetor?.() : null; if (!c) return;
    laco.rect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0).fill({ color: 0x4fc3f7, alpha: 0.05 }).stroke({ width: px(2), color: 0x4fc3f7, alpha: 0.95 });
    for (const [x, y] of [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]] as const) laco.rect(x - px(5), y - px(5), px(10), px(10)).fill(0xffffff).stroke({ width: px(1.5), color: 0x4fc3f7 });
    void cor;
  }

  function desenharPreviaDeArrasto(
    m: MapaAtlas,
    id: string,
    de: Ponto,
    para: Ponto,
    motivo: string | null,
    livre: boolean,
    semGrade: boolean,
  ): number {
    const t = m.grid.size, cor3 = motivo ? 0xe0342c : livre ? 0xd9a23b : 0x3fb950;
    if (semGrade) {
      const tam = (m.tokens[id]?.size ?? 1) * t * 0.44;
      laco.circle(para[0], para[1], tam).fill({ color: cor3, alpha: 0.22 }).stroke({ width: px(1.5), color: cor3, alpha: 0.9 });
    } else {
      laco.rect(para[0] - t / 2, para[1] - t / 2, t, t).fill({ color: cor3, alpha: 0.22 }).stroke({ width: px(1.5), color: cor3, alpha: 0.9 });
    }
    laco.moveTo(de[0], de[1]).lineTo(para[0], para[1]).stroke({ width: px(2.5), color: cor3, alpha: 0.9, cap: 'round' });
    return cor3;
  }

  function desenharLaco(): void {
    laco.clear();
    reguaTexto.visible = false;
    const m = doc();
    if (somenteLeitura) {
      const alvo = interacao?.tipo === 'peca-remota' && interacao.moveu ? interacao : pecaRemotaPendente;
      if (!alvo || alvo.semGrade) return;
      const cor3 = desenharPreviaDeArrasto(m, alvo.id, alvo.de, alvo.para, alvo.motivo, false, alvo.semGrade);
      const tam = (m.tokens[alvo.id]?.size ?? 1) * m.grid.size * 0.44;
      laco.circle(alvo.de[0], alvo.de[1], px(4)).fill(0xffffff).stroke({ width: px(1.5), color: cor3 });
      if (!alvo.semGrade) {
        laco.circle(alvo.para[0], alvo.para[1], tam).fill({ color: cor3, alpha: 0.14 }).stroke({ width: px(1.5), color: cor3, alpha: 0.7 });
      }
      const dist = Math.hypot(alvo.para[0] - alvo.de[0], alvo.para[1] - alvo.de[1]);
      if (alvo.motivo || dist > 1e-3) {
        const textoDist = alvo.semGrade
          ? `${String(Math.round(dist * 10) / 10).replace('.', ',')} m`
          : textoDaRegua(distanciaDoPercurso([alvo.de, alvo.para], m.grid.size, ponte.regraDaRegua?.() ?? 'simples'), m.grid.size);
        reguaTexto.text = alvo.motivo ?? textoDist;
        reguaTexto.scale.set(1 / camera.zoom);
        reguaTexto.position.set(alvo.para[0] + px(12), alvo.para[1] - px(26));
        reguaTexto.visible = true;
      }
      return;
    }
    const cor = acento();
    desenharCaixaDoProjetor(cor);
    desenharRegua(cor);
    if (interacao?.tipo === 'retangulo' && interacao.moveu) {
      const { ini, atual } = interacao;
      laco.rect(Math.min(ini[0], atual[0]), Math.min(ini[1], atual[1]), Math.abs(ini[0] - atual[0]), Math.abs(ini[1] - atual[1])).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 });
    } else if (interacao?.tipo === 'laco' && interacao.pontos.length > 1) {
      laco.poly(interacao.pontos.flat()).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 });
    } else if (interacao?.tipo === 'cômodo' && interacao.retangulo) {
      const t = m.grid.size, cor2 = interacao.apagar ? 0xff6b6b : cor;
      for (const [x, y] of retanguloDeCelulas(m, interacao.ini, interacao.atual)) laco.rect(m.grid.offset[0] + x * t, m.grid.offset[1] + y * t, t, t);
      laco.fill({ color: cor2, alpha: 0.28 }).stroke({ width: px(1), color: cor2, alpha: 0.6 });
    } else if (interacao?.tipo === 'comodo-circulo') {
      const r = Math.hypot(interacao.atual[0] - interacao.centro[0], interacao.atual[1] - interacao.centro[1]);
      if (r >= 0.1) {
        const pts = circulo(interacao.centro, r, interacao.lados);
        laco.poly(pts.flat()).fill({ color: cor, alpha: 0.2 }).stroke({ width: px(1.8), color: r >= 0.8 ? cor : 0xff6b6b, alpha: 0.9 });
      }
      laco.moveTo(interacao.centro[0], interacao.centro[1]).lineTo(interacao.atual[0], interacao.atual[1]).stroke({ width: px(1.5), color: cor, alpha: 0.8 });
      laco.circle(interacao.centro[0], interacao.centro[1], px(4.5)).fill(0xffffff).stroke({ width: px(1.5), color: cor });
    } else if (interacao?.tipo === 'comodo-poligono') {
      const pts = [...interacao.pontos, interacao.atual];
      const simples = pts.length < 3 || ehPoligonoSimples(pts);
      const corPol = simples ? cor : 0xff6b6b;
      if (pts.length >= 3) laco.poly(pts.flat()).fill({ color: corPol, alpha: 0.18 });
      laco.moveTo(pts[0]![0], pts[0]![1]);
      for (const q of pts.slice(1)) laco.lineTo(q[0], q[1]);
      laco.stroke({ width: px(1.8), color: corPol, alpha: 0.9, cap: 'round', join: 'round' });
      const pertoPrimeiro = interacao.pontos.length >= 3 && Math.hypot(interacao.atual[0] - interacao.pontos[0]![0], interacao.atual[1] - interacao.pontos[0]![1]) <= px(12);
      for (let k = 0; k < interacao.pontos.length; k++) {
        const q = interacao.pontos[k]!;
        laco.circle(q[0], q[1], px(k === 0 && pertoPrimeiro ? 7 : 4.5)).fill(k === 0 && pertoPrimeiro ? cor : 0xffffff).stroke({ width: px(1.5), color: corPol });
      }
    } else if (interacao?.tipo === 'peca' && interacao.moveu) {
      desenharPreviaDeArrasto(m, interacao.id, interacao.de, interacao.para, interacao.motivo, interacao.livre, interacao.semGrade);
    } else if (interacao?.tipo === 'parede') {
      laco.moveTo(interacao.ini[0], interacao.ini[1]).lineTo(interacao.fim[0], interacao.fim[1]).stroke({ width: 0.2, color: cor, alpha: 0.75, cap: 'round' });
      for (const q of [interacao.ini, interacao.fim]) laco.circle(q[0], q[1], px(5)).fill(0xffffff).stroke({ width: px(1.5), color: cor });
    }
  }

  // ---------- Fantasma: uma prévia do que a ferramenta ativa vai pôr ----------
  let semente = Math.floor(Math.random() * 2 ** 30), fantasmaChave = '', fantasmaSprite: Sprite | null = null, fantasmaTextura: Texture | null = null;
  const novaSemente = () => { semente = Math.floor(Math.random() * 2 ** 30); };
  /** Com o dado ligado, a próxima variante da família já vai para o pincel (o fantasma a mostra). */
  const sortearProximaVariante = () => {
    const o = ponte.pincel().objeto; if (!o.varianteAleatoria || !o.familia) return;
    const fam = ACERVO.familia(o.familia); if (!fam) return;
    ponte.definirPincel({ objeto: { ...o, item: sortearVariante(fam, o.item, Math.random), semente: o.semente } });
  };
  const sementeAtual = (): number => ponte.pincel().objeto.semente ?? semente;
  /** O sorteio das variações do pincel (rotação, escala, espelho): o mesmo para o fantasma e para o clique, e renovado depois de pôr. Refaz quando o ajuste do pincel muda. */
  let sorteio: { chave: string; campos: CamposDoPincel } | null = null;
  const camposDoSorteio = (): CamposDoPincel => {
    const { item: _i, params: _p, semente: _s, familia: _f, varianteAleatoria: _v, ...ajuste } = ponte.pincel().objeto, chave = JSON.stringify(ajuste);
    if (!sorteio || sorteio.chave !== chave) sorteio = { chave, campos: camposDoPincel(ponte.pincel().objeto, Math.random) };
    return sorteio.campos;
  };
  const renovarSorteio = () => { sorteio = null; };

  function limparFantasmaSprite(): void {
    fantasmaC.getChildByLabel('fantasma-objeto')?.destroy({ children: true });
    fantasmaSprite = null; fantasmaTextura?.destroy(true); fantasmaTextura = null; fantasmaChave = '';
  }

  function desenharFantasma(): void {
    if (somenteLeitura) return;
    fantasmaG.clear();
    const f = ponte.ferramenta(), m = doc(), cor = acento(), pincel = ponte.pincel(), receita = ACERVO.item(pincel.objeto.item);
    const comSprite = f === 'objeto' && receita?.tipo === 'piso';
    if (!comSprite && fantasmaSprite) limparFantasmaSprite();
    const objetoFantasma = fantasmaC.getChildByLabel('fantasma-objeto');
    if (!ponteiro || interacao || !['objeto', 'luz', 'peca', 'regiao', 'abertura', 'comodo', 'borracha', 'terreno', 'presenca', 'espalhar'].includes(f)) { if (objetoFantasma) objetoFantasma.visible = false; return; }
    const livre = f === 'objeto' || f === 'luz' ? livreParaObjeto(objetosNaGrade(), m.grid.snap, altPressionado) : !m.grid.snap || altPressionado;
    const p: Ponto = [encaixar(ponteiro[0], m.grid, 0, 0.5, livre), encaixar(ponteiro[1], m.grid, 1, 0.5, livre)];
    if (f === 'comodo' || f === 'borracha') {
      const forma = f === 'comodo' ? (pincel.comodoForma ?? 'celulas') : 'celulas';
      if (forma !== 'celulas') {
        const pt: Ponto = [encaixar(ponteiro[0], m.grid, 0, 1, livre), encaixar(ponteiro[1], m.grid, 1, 1, livre)];
        fantasmaG.circle(pt[0], pt[1], px(5)).fill({ color: cor, alpha: 0.85 }).stroke({ width: px(1.5), color: 0xffffff });
        return;
      }
      const [x, y] = celulaDe(m, ponteiro), t = m.grid.size, c = f === 'borracha' ? 0xff6b6b : cor;
      if (dentroDoMapa(m, [x, y])) fantasmaG.rect(m.grid.offset[0] + x * t, m.grid.offset[1] + y * t, t, t).fill({ color: c, alpha: 0.28 }).stroke({ width: px(1.5), color: c, alpha: 0.9 });
      return;
    }
    if (f === 'espalhar') { fantasmaG.circle(ponteiro[0], ponteiro[1], pincel.espalhar.raio).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 }); return; }
    if (f === 'presenca') { const cp = hexParaNumero(pincelDePresenca(pincel.presenca.brush)?.cor ?? '#ffffff'); fantasmaG.circle(ponteiro[0], ponteiro[1], pincel.presenca.raio).fill({ color: cp, alpha: 0.2 }).stroke({ width: px(1.5), color: cp, alpha: 0.9 }); return; }
    if (f === 'terreno') {
      const emRelevo = pincel.terreno.modo === 'relevo';
      const c = emRelevo ? corDaLinhaDeNivel(pincel.terreno.altura ?? 0) : hexParaNumero(materialDe(pincel.terreno.material).claro);
      fantasmaG.circle(ponteiro[0], ponteiro[1], pincel.terreno.raio).fill({ color: c, alpha: 0.18 }).stroke({ width: px(1.5), color: emRelevo ? c : cor, alpha: 0.9 });
      return;
    }
    if (f === 'luz') {
      const preset = presetDeLuz(pincel.luz.preset);
      if (preset) {
        const c = hexParaNumero(preset.color);
        if (preset.cone !== null) { const meia = (preset.cone * Math.PI) / 360, r = Math.min(preset.radius, 6); fantasmaG.moveTo(p[0], p[1]).arc(p[0], p[1], r, pincel.luz.direcao - meia, pincel.luz.direcao + meia).lineTo(p[0], p[1]).fill({ color: c, alpha: 0.18 }).stroke({ width: px(1.5), color: c, alpha: 0.8 }); }
        else fantasmaG.circle(p[0], p[1], Math.min(preset.radius, 6)).fill({ color: c, alpha: 0.12 }).stroke({ width: px(1.5), color: c, alpha: 0.7 });
        fantasmaG.circle(p[0], p[1], 0.2).fill(c).stroke({ width: 0.04, color: 0x000000, alpha: 0.7 });
      }
      return;
    }
    if (f === 'peca') { fantasmaG.circle(p[0], p[1], m.grid.size * 0.45).fill({ color: cor, alpha: 0.35 }).stroke({ width: px(1.5), color: cor, alpha: 0.8 }); return; }
    if (f === 'regiao') { fantasmaG.rect(p[0] - 1.5, p[1] - 1.5, 3, 3).fill({ color: cor, alpha: 0.12 }).stroke({ width: px(1.5), color: cor, alpha: 0.8 }); return; }
    if (f === 'abertura') {
      const l = LARGURA_DA_ABERTURA[pincel.abertura.tipo], e = encaixarNaParede(m, ponteiro, l, 0.75, livre, andarAtual());
      if (e) { const c = e.at * comprimentoDaParede(e.parede), a = pontoNaParede(e.parede, c - l / 2).ponto, b = pontoNaParede(e.parede, c + l / 2).ponto; fantasmaG.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: e.parede.thickness + 0.12, color: cor, alpha: 0.85, cap: 'butt' }); }
      return;
    }
    if (!receita) return;
    if (receita.tipo === 'parede') {
      const l = typeof pincel.objeto.params.largura === 'number' ? pincel.objeto.params.largura : receita.pegada[0], e = encaixarObjetoDeParede(m, ponteiro, l, livre, andarAtual());
      if (e) { const c = e.at * comprimentoDaParede(e.parede), a = pontoNaParede(e.parede, Math.max(0, c - l / 2)).ponto, b = pontoNaParede(e.parede, Math.min(comprimentoDaParede(e.parede), c + l / 2)).ponto; fantasmaG.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: e.parede.thickness + 0.14, color: 0xd9a75e, alpha: 0.9, cap: 'butt' }); }
      return;
    }
    // Objeto de piso: o desenho de verdade, pela mesma fila de pintura dos objetos postos.
    const campos = camposDoSorteio(), falso = { id: 'f', source: ACERVO.fonte(receita.id, sementeAtual(), pincel.objeto.params), position: p, rotation: 0, scale: 1, ...(campos.flip ? { flip: true } : {}), elevation: 'floor' as const, wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null };
    const res = resolucaoDe(m, 'objeto'), chave = chaveDoObjeto(falso, res, m.style.genre, m.style.renderer, opcoesDoPixel(m)), pedido = pedidoDoObjeto(falso, res, m.style.genre, m.style.renderer, opcoesDoPixel(m));
    if (chave && pedido && chave !== fantasmaChave) {
      fantasmaChave = chave;
      baker.pedir(chave, pedido).then(r => {
        if (destruido || fantasmaChave !== chave) return;
        limparFantasmaSprite(); fantasmaChave = chave;
        fantasmaTextura = texturaPropria(r.bitmap); fantasmaSprite = new Sprite(fantasmaTextura); fantasmaSprite.alpha = 0.7; fantasmaSprite.position.set(r.origem[0], r.origem[1]); fantasmaSprite.scale.set(1 / r.res);
        const c = new Container(); c.label = 'fantasma-objeto'; c.addChild(fantasmaSprite); fantasmaC.addChild(c); camadaSuja = true;
      }).catch(() => { /* a prévia é só um enfeite */ });
    }
    const c = fantasmaC.getChildByLabel('fantasma-objeto');
    // Receita: o espelho já vem no assado (`falso.flip`). Imagem da coleção: espelha o contêiner (antes da rotação).
    if (c && fantasmaSprite) { c.visible = true; c.position.set(p[0], p[1]); c.rotation = campos.rotation; c.scale.set(campos.scale * (campos.flip && falso.source.kind === 'asset' ? -1 : 1), campos.scale); fantasmaSprite.alpha = 0.7 * (campos.opacity ?? 1); }
    if (pincel.objeto.colocar === 'varios' && pincel.objeto.area > 0) fantasmaG.circle(p[0], p[1], pincel.objeto.area).fill({ color: cor, alpha: 0.08 }).stroke({ width: px(1.5), color: cor, alpha: 0.8 });
    const [w, h] = [receita.pegada[0] * campos.scale, receita.pegada[1] * campos.scale];
    fantasmaG.roundRect(p[0] - w / 2, p[1] - h / 2, w, h, 0.05).stroke({ width: px(1.2), color: cor, alpha: fantasmaSprite ? 0.35 : 0.9 });
  }

  /** No Pixel a posição do mundo cai na grade de pixels do dispositivo, para os pixels do Pixel não tremerem nem ficarem de tamanhos diferentes. */
  const naGrade = (v: number): number => (pixelAtivo ? Math.round(v * app.renderer.resolution) / app.renderer.resolution : v);
  const posicaoDoMundo = (): void => { mundo.position.set(naGrade(camera.x + tremorAtual[0]), naGrade(camera.y + tremorAtual[1])); };
  function aplicarCamera(): void { posicaoDoMundo(); mundo.scale.set(camera.zoom); camadaSuja = true; gradeSuja = true; ponte.aoCamera?.(camera); }
  /** No Pixel o zoom é múltiplo inteiro de pixels do dispositivo por pixel do Pixel; `zoomPedido` guarda o zoom contínuo (senão a roda travaria em passos pequenos). */
  function encaixarNoPixel(c: Camera): Camera {
    if (!pixelAtivo) return c;
    const passo = pixelizacao.res / app.renderer.resolution, zoom = Math.max(passo, Math.round(c.zoom / passo) * passo);
    if (zoom === c.zoom) return { ...c, x: naGrade(c.x), y: naGrade(c.y) };
    const [mx, my] = telaParaMundo(c, [app.screen.width / 2, app.screen.height / 2]);      // o centro da tela fica no mesmo ponto do mundo
    return { x: naGrade(app.screen.width / 2 - mx * zoom), y: naGrade(app.screen.height / 2 - my * zoom), zoom };
  }
  function definirCamera(c: Camera, zoomPedido = c.zoom): void { camera = encaixarNoPixel(c); zoomLivre = zoomPedido; aplicarCamera(); }
  function zoomarEm(foco: Ponto, fator: number): void {
    if (!pixelAtivo) { definirCamera(zoomEm(camera, foco, fator)); return; }
    const pedido = limitarZoom(zoomLivre * fator), [mx, my] = telaParaMundo(camera, foco), passo = pixelizacao.res / app.renderer.resolution;
    const zoom = Math.max(passo, Math.round(pedido / passo) * passo);
    definirCamera({ x: foco[0] - mx * zoom, y: foco[1] - my * zoom, zoom }, pedido);
  }

  /** O estilo do documento (Ilustrado ou Pixel) mudou, ou o tamanho do mapa: refaz a pixelização e o lugar da raiz da cena. */
  function aplicarEstilo(): void {
    const m = doc(), pixel = m.style.renderer === 'pixel';
    pixelizacao.definir(m, pixel);
    if (pixel !== pixelAtivo) {
      pixelAtivo = pixel;
      if (pixel) pixelizacao.renderizar(cena.raiz);       // a raiz sai do palco e passa a viver dentro da pixelização
      else mundo.addChildAt(cena.raiz, mundo.getChildIndex(pixelizacao.sprite));
    }
    aplicarAcabamento(); definirCamera(camera, pixelAtivo ? zoomLivre : camera.zoom);
  }

  function desenharRelevo(): void {
    const noEditor = !somenteLeitura && !modoProjetor && !ponte.emSessao?.() && (ponte.vista?.() ?? 'construir') === 'construir';
    const pincelAtivo = ponte.ferramenta() === 'terreno' && ponte.pincel().terreno.modo === 'relevo';
    const visivel = noEditor && (Boolean(ponte.mostrarRelevo?.()) || pincelAtivo);
    linhasDeNivel.atualizar(doc(), camera.zoom, visivel);
  }

  function redesenharTudo(): void {
    const m = doc();
    ultimoAndar = andarAtual();
    ultimoConstruir = ctxAndar().construir;
    pararTransicao(); vistoDoDoc = estadoDoDoc(m);
    desenharBase(m); desenharGrade(); gradeSuja = false; desenharRelevo(); desenharSelecao(); desenharLaco(); desenharFantasma(); aplicarEstilo();
    cena.sincronizar(m, null, false, visaoDoClima(m), ctxAndar());
  }

  function aoEvento(e: EventoStore): void {
    if (destruido) return;
    if (pecaRemotaPendente && (e.mudancas.completo || e.mudancas.colecoes.tokens?.includes(pecaRemotaPendente.id))) {
      limparPecaRemotaPendente();
    }
    if (e.mudancas.completo || ultimoAndar !== andarAtual()) { redesenharTudo(); if (e.tipo === 'substituir') enquadrarMapa(); return; }
    const mud = e.mudancas, mAndar = doc();
    if (mud.campos.some(c => ['backdrop', 'bounds', 'grid'].includes(c)) || mud.campos.includes('levels')) { desenharBase(mAndar); gradeSuja = true; }
    if (mud.campos.some(c => ['backdrop', 'bounds', 'grid', 'style'].includes(c))) aplicarEstilo();
    if (mud.campos.includes('climate') || mud.campos.includes('finish')) {
      // Só troca de clima (ou desfazer e refazer) anima; arrastar um controle fino do inspetor acompanha na hora.
      const antes = estadoExibido(), trocou = antes.climate.preset !== mAndar.climate.preset || e.tipo === 'desfazer' || e.tipo === 'refazer';
      if (trocou && ponte.acabamento() && fxAtivo()) iniciarTransicao(antes, mAndar); else pararTransicao();
    }
    if (mud.campos.includes('finish')) aplicarAcabamento();
    const mParaCena = interacao?.tipo === 'peca-remota' && interacao.semGrade && interacao.moveu && mAndar.tokens[interacao.id]
      ? { ...mAndar, tokens: { ...mAndar.tokens, [interacao.id]: { ...mAndar.tokens[interacao.id]!, position: interacao.para } } }
      : mAndar;
    cena.sincronizar(mParaCena, mud, e.tipo === 'executar' || e.tipo === 'refazer' || e.tipo === 'concluir', visaoDoClima(mAndar), ctxAndar());
    if (transicao) aplicarAcabamento();
    vistoDoDoc = estadoDoDoc(mAndar);
    camadaSuja = true;
  }
  const cancelarAssinatura = store.assinar(aoEvento);

  // ---------- Câmera ----------
  function enquadrarMapa(): void { const m = doc(); definirCamera(calcularEnquadre({ x: 0, y: 0, largura: m.bounds.width, altura: m.bounds.height }, tela(), 56)); }
  function focarEm(c: Caixa): void { definirCamera(calcularEnquadre({ x: c.x0, y: c.y0, largura: Math.max(c.x1 - c.x0, 3), altura: Math.max(c.y1 - c.y0, 3) }, tela(), 120)); }
  function zoomPor(fator: number): void { zoomarEm([app.screen.width / 2, app.screen.height / 2], fator); }

  // ---------- Entrada ----------
  const canvas = app.canvas;
  const retangulo = () => canvas.getBoundingClientRect();
  const telaDe = (e: { clientX: number; clientY: number }): Ponto => { const r = retangulo(); return [e.clientX - r.left, e.clientY - r.top]; };
  const mundoDe = (e: { clientX: number; clientY: number }): Ponto => telaParaMundo(camera, telaDe(e));
  const posicaoDe = (m: MapaAtlas, a: Alvo): Ponto => a.colecao === 'regions' ? m.regions[a.id]!.polygon[0]! : (m[a.colecao as ColecaoLivre] as Record<string, { position: Ponto }>)[a.id]!.position;
  const cursor = () => {
    if (somenteLeitura) {
      canvas.style.cursor = (interacao?.tipo === 'peca-remota' || (interacao?.tipo === 'pan' && !ponte.cameraBloqueada?.()))
        ? 'grabbing'
        : (sobrePecaDoJogador && ponte.podeMoverPecaRemota?.() !== false)
          ? 'grab'
          : (sobrePortaRemota && ponte.podeMoverPecaRemota?.() !== false)
            ? 'pointer'
            : 'default';
      return;
    }
    const f = ponte.ferramenta();
    canvas.style.cursor = interacao?.tipo === 'pan' ? 'grabbing' : (f === 'mao' || espaco) ? 'grab' : interacao?.tipo === 'alinhamento-grade' ? (interacao.modo === 'escala' ? 'nwse-resize' : 'move') : f === 'selecionar' ? (interacao?.tipo === 'mover' || interacao?.tipo === 'peca' || interacao?.tipo === 'deslizar' ? 'move' : 'default') : 'crosshair';
  };
  const tentar = (fazer: () => void): boolean => { try { fazer(); return true; } catch (erro) { ponte.aviso(erro instanceof Error ? erro.message.replace(/^O comando deixaria o mapa inválido — /, '') : String(erro)); return false; } };

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomarEm(telaDe(e), Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  function concluirContorno(outline: readonly Ponto[], tipoComodo: string): void {
    const id = novoIdEntidade('c'), andar = andarAtual();
    const cmd = comandoDeComodoPorContorno(doc(), outline, tipoComodo, id, undefined, andar);
    if (typeof cmd === 'string') { ponte.aviso(cmd); return; }
    if (tentar(() => store.executar(cmd, { rotulo: `Criar ${cmd.nome.toLowerCase()}` }))) {
      ponte.definirSelecao([{ colecao: 'rooms', id }]);
      const c = caixaDe(doc(), { colecao: 'rooms', id });
      if (c) ponte.aoColocar(cmd.nome, [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]);
    }
  }

  // Pincelada de cômodo ou de borracha.
  function comecarComodo(e: PointerEvent, p: Ponto, apagar: boolean): void {
    const m = doc(), pincel = ponte.pincel();
    if (!apagar) {
      const forma = pincel.comodoForma ?? 'celulas';
      const livre = !m.grid.snap || e.altKey;
      const pt: Ponto = [encaixar(p[0], m.grid, 0, 1, livre), encaixar(p[1], m.grid, 1, 1, livre)];
      if (forma === 'circulo') {
        const lados = Math.max(8, Math.min(48, Math.round(pincel.comodoLados ?? 24)));
        interacao = { tipo: 'comodo-circulo', centro: pt, atual: pt, lados, tipoComodo: pincel.comodo };
        return;
      }
      if (forma === 'poligono') {
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* ok */ }
        interacao = { tipo: 'comodo-poligono', pontos: [pt], atual: pt, tipoComodo: pincel.comodo };
        camadaSuja = true;
        return;
      }
    }
    const c = celulaDe(m, p); if (!dentroDoMapa(m, c)) return;
    const existente = apagar ? null : salaDaCelula(indiceDeCelulas(m), c[0], c[1]), tipo = tipoDeComodo(pincel.comodo) ?? tipoDeComodo('sala')!;
    interacao = {
      tipo: 'cômodo', apagar, sala: apagar ? '' : existente ?? novoIdEntidade('c'), criado: !!existente,
      gesto: store.iniciarGesto(apagar ? 'Apagar cômodo' : existente ? 'Pintar cômodo' : `Criar ${tipo.nome.toLowerCase()}`), ini: c, atual: c, retangulo: e.shiftKey, visitadas: new Set(),
    };
    if (!e.shiftKey) pintarCelulas([c]);
  }

  function pintarCelulas(celulas: readonly [number, number][]): void {
    const i = interacao; if (i?.tipo !== 'cômodo') return;
    const novas = celulas.filter(c => !i.visitadas.has(chaveCel(c[0], c[1])));
    if (!novas.length) return;
    for (const c of novas) i.visitadas.add(chaveCel(c[0], c[1]));
    const m = doc(), andar = andarAtual(), tipo = tipoDeComodo(ponte.pincel().comodo) ?? tipoDeComodo('sala')!;
    const ok = tentar(() => {
      if (i.apagar) i.gesto.aplicar({ tipo: 'comodo.apagar', celulas: novas, ...(andar !== null ? { levelId: andar } : {}) });
      else if (!i.criado) {
        const mesmos = Object.values(m.rooms).filter(s => s.function === tipo.funcao).length;
        i.gesto.aplicar({ tipo: 'comodo.criar', id: i.sala, nome: mesmos ? `${tipo.nome} ${mesmos + 1}` : tipo.nome, funcao: tipo.funcao, piso: { material: tipo.piso, seed: Math.floor(Math.random() * 1e6) }, papel: { material: tipo.papel, seed: Math.floor(Math.random() * 1e6) }, telhado: telhadoPadrao(m, tipo.funcao, novas), celulas: novas, ...(andar !== null ? { levelId: andar } : {}) });
        i.criado = true;
      } else i.gesto.aplicar({ tipo: 'comodo.pintar', id: i.sala, celulas: novas });
    });
    if (!ok) { i.gesto.cancelar(); interacao = null; }
  }

  /** Uma pincelada de espalhar: põe (ou, com Alt, tira) os objetos do conjunto no círculo, dentro do gesto. */
  function espalharAqui(p: Ponto): void {
    const i = interacao; if (i?.tipo !== 'espalhar' || !ponte.espalhar) return;
    const pincel = ponte.pincel().espalhar, andar = andarAtual(), base = doc();
    const comandos = ponte.espalhar(base, p, { conjunto: pincel.conjunto, raio: pincel.raio, apagar: i.apagar, semente: i.semente++, andar });
    for (const c of comandos) {
      if (!tentar(() => i.gesto.aplicar(c))) { i.gesto.cancelar(); interacao = null; return; }
    }
  }

  function pintarTerreno(p: Ponto, anterior: Ponto | null): void {
    const i = interacao; if (i?.tipo !== 'terreno') return;
    const m = doc(), pincel = ponte.pincel(), raio = i.presenca ? pincel.presenca.raio : pincel.terreno.raio, res = m.terrain.resolution, cols = Math.ceil(m.bounds.width / res), lins = Math.ceil(m.bounds.height / res);
    const pontos: Ponto[] = [];
    if (anterior) { const d = Math.hypot(p[0] - anterior[0], p[1] - anterior[1]), n = Math.max(1, Math.ceil(d / Math.max(0.1, raio / 2))); for (let k = 1; k <= n; k++) pontos.push([anterior[0] + ((p[0] - anterior[0]) * k) / n, anterior[1] + ((p[1] - anterior[1]) * k) / n]); } else pontos.push(p);
    const unicas = new Map<number, [number, number]>();
    for (const q of pontos) for (const c of celulasDoDisco(q, raio, res, cols, lins)) unicas.set(chaveCel(c[0], c[1]), c);
    if (!unicas.size) return;
    const celulas = [...unicas.values()];
    const andar = andarAtual();
    const comando = i.presenca
      ? (i.apagar ? { tipo: 'presenca.apagar' as const, brush: null, celulas, ...(andar !== null ? { levelId: andar } : {}) } : { tipo: 'presenca.pintar' as const, brush: pincel.presenca.brush, celulas, ...(andar !== null ? { levelId: andar } : {}) })
      : comandoDoPincelDeTerreno(pincel.terreno, celulas, i.apagar);
    if (!tentar(() => i.gesto.aplicar(comando))) { i.gesto.cancelar(); interacao = null; }
  }

  /** O ponto encaixado nos vértices da grade e, se `ini` existe, preso ao eixo mais próximo: paredes são retas na grade. */
  function pontoDeParede(m: MapaAtlas, p: Ponto, ini?: Ponto, desligado = !m.grid.snap): Ponto {
    const q: Ponto = [encaixar(p[0], m.grid, 0, 1, desligado), encaixar(p[1], m.grid, 1, 1, desligado)];
    if (!ini) return q;
    return Math.abs(q[0] - ini[0]) >= Math.abs(q[1] - ini[1]) ? [q[0], ini[1]] : [ini[0], q[1]];
  }

  /** Um carimbo do modo Vários: um objeto no ponto, ou vários no círculo da área, dentro do gesto. */
  function carimbarAqui(centro: Ponto): void {
    const i = interacao; if (i?.tipo !== 'carimbar') return;
    const m = doc(), pincel = ponte.pincel().objeto, andar = andarAtual(), familia = ACERVO.familiaDoItem(pincel.item) ?? null;
    const alcance = pincel.area + 12, ocupados: Ocupado[] = [];
    for (const o of Object.values(m.props)) {
      if (o.elevation === 'wall' || Math.hypot(o.position[0] - centro[0], o.position[1] - centro[1]) > alcance) continue;
      ocupados.push({ pos: o.position, raio: Math.max(...ACERVO.pegadaDaFonte(o.source)) * o.scale / 2 });
    }
    const primeiro = camposDoSorteio(), carimbos = carimbar(centro, pincel, familia, ocupados, Math.random, primeiro);
    for (const c of carimbos) {
      const receita = ACERVO.item(c.item); if (!receita || receita.tipo === 'parede') continue;
      const seed = c.item === pincel.item && pincel.semente !== null ? pincel.semente : Math.floor(Math.random() * 2 ** 30);
      const escada = interacaoDeEscadaPadrao(m, andar, receita.id);
      const item = novoObjeto(c.posicao, { source: ACERVO.fonte(receita.id, seed, c.item === pincel.item ? pincel.params : {}), ...(receita.submerso ? { elevation: 'underwater' as const, castsShadow: false, blocks: { move: false, sight: false } } : {}), ...(escada ? { interaction: escada } : {}), ...(andar !== null ? { levelId: andar } : {}), ...c.campos });
      if (!tentar(() => i.gesto.aplicar({ tipo: 'item.adicionar', colecao: 'props', item }))) { i.gesto.cancelar(); interacao = null; return; }
      i.postos.push(item.id); ponte.aoPorObjeto?.(receita.id);
    }
    if (carimbos.length) ponte.aoColocar(i.nome, centro);
    novaSemente(); renovarSorteio(); sortearProximaVariante();
  }

  function colocar(e: PointerEvent, p: Ponto): void {
    const m = doc(), f = ponte.ferramenta(), pincel = ponte.pincel(), andar = andarAtual();
    const livre = f === 'objeto' || f === 'luz' ? livreParaObjeto(objetosNaGrade(), m.grid.snap, e.altKey) : !m.grid.snap || e.altKey;
    const alvo: Ponto = [encaixar(p[0], m.grid, 0, 0.5, livre), encaixar(p[1], m.grid, 1, 0.5, livre)];
    if (f === 'comodo' || f === 'borracha') { comecarComodo(e, p, f === 'borracha'); return; }
    if (f === 'espalhar') {
      interacao = { tipo: 'espalhar', apagar: e.altKey, gesto: store.iniciarGesto(e.altKey ? 'Apagar espalhados' : 'Espalhar'), ultimo: p, semente: Math.floor(Math.random() * 1e6) };
      espalharAqui(p); return;
    }
    if (f === 'terreno' || f === 'presenca') {
      const presenca = f === 'presenca', nome = presenca ? 'presença' : pincel.terreno.modo === 'relevo' ? 'relevo' : 'terreno';
      interacao = { tipo: 'terreno', presenca, apagar: e.altKey, gesto: store.iniciarGesto(e.altKey ? `Apagar ${nome}` : `Pintar ${nome}`), ultimo: p }; pintarTerreno(p, null); return;
    }
    if (f === 'parede') { const q = pontoDeParede(m, p, undefined, livre); interacao = { tipo: 'parede', ini: q, fim: q }; return; }
    if (f === 'abertura') {
      const largura = LARGURA_DA_ABERTURA[pincel.abertura.tipo], enc = encaixarNaParede(m, p, largura, 0.75, livre, andar);
      if (!enc) { ponte.aviso('Chegue mais perto de uma parede.'); return; }
      const abertura: Abertura = { id: novoIdEntidade('a'), wallId: enc.parede.id, at: enc.at, width: largura, kind: pincel.abertura.tipo, state: 'closed', material: 'madeira.media', som: null, swing: enc.lado === 1 ? 'a' : 'b' };
      const nome = { door: 'Porta', window: 'Janela', arch: 'Arco', secret: 'Porta secreta' }[abertura.kind];
      if (tentar(() => store.executar({ tipo: 'abertura.adicionar', abertura }, { rotulo: `Pôr ${nome.toLowerCase()}` }))) { ponte.definirSelecao([{ colecao: 'openings', id: abertura.id }]); ponte.aoColocar(nome, enc.ponto); }
      return;
    }
    if (f === 'objeto') {
      const receita = ACERVO.item(pincel.objeto.item); if (!receita) { ponte.aviso('Escolha um objeto na biblioteca.'); return; }
      const sementeDoObjeto = sementeAtual(), fonte = ACERVO.fonte(receita.id, sementeDoObjeto, pincel.objeto.params);
      if (receita.tipo === 'parede') {
        const l = typeof pincel.objeto.params.largura === 'number' ? pincel.objeto.params.largura : receita.pegada[0], enc = encaixarObjetoDeParede(m, p, l, livre, andar);
        if (!enc) { ponte.aviso('Objetos de parede vão na face de um cômodo: aproxime-se de uma parede por dentro.'); return; }
        const item = novoObjeto(enc.ponto, { source: fonte, elevation: 'wall', wall: { wallId: enc.parede.id, at: enc.at, face: 'inner' }, roomId: enc.roomId, blocks: { move: false, sight: false }, castsShadow: false, ...(andar !== null ? { levelId: andar } : {}) });
        if (tentar(() => store.executar({ tipo: 'item.adicionar', colecao: 'props', item }, { rotulo: `Pôr ${receita.nome.toLowerCase()}` }))) { if (pincel.objeto.selecionarAoPor) ponte.definirSelecao([{ colecao: 'props', id: item.id }]); ponte.aoColocar(receita.nome, enc.ponto); ponte.aoPorObjeto?.(receita.id); novaSemente(); renovarSorteio(); sortearProximaVariante(); }
        return;
      }
      if (pincel.objeto.colocar === 'varios') {
        interacao = { tipo: 'carimbar', gesto: store.iniciarGesto(`Pôr ${(ACERVO.familiaDoItem(receita.id)?.nome ?? receita.nome).toLowerCase()}`), ultimo: alvo, livre, postos: [], nome: receita.nome };
        carimbarAqui(alvo); return;
      }
      const escada = interacaoDeEscadaPadrao(m, andar, receita.id);
      const campos = camposDoSorteio();
      const item = novoObjeto(alvo, { source: fonte, ...(receita.submerso ? { elevation: 'underwater' as const, castsShadow: false, blocks: { move: false, sight: false } } : {}), ...(escada ? { interaction: escada } : {}), ...(andar !== null ? { levelId: andar } : {}), ...campos });
      if (tentar(() => store.executar({ tipo: 'item.adicionar', colecao: 'props', item }, { rotulo: `Pôr ${receita.nome.toLowerCase()}` }))) { if (pincel.objeto.selecionarAoPor) ponte.definirSelecao([{ colecao: 'props', id: item.id }]); ponte.aoColocar(receita.nome, alvo); ponte.aoPorObjeto?.(receita.id); novaSemente(); renovarSorteio(); sortearProximaVariante(); }
      return;
    }
    if (f === 'luz') {
      const preset = presetDeLuz(pincel.luz.preset); if (!preset) return;
      const item = novaLuz(alvo, { ...camposDoPreset(preset, pincel.luz.direcao), ...(andar !== null ? { levelId: andar } : {}) });
      if (tentar(() => store.executar({ tipo: 'item.adicionar', colecao: 'lights', item }, { rotulo: `Pôr ${preset.nome.toLowerCase()}` }))) { ponte.definirSelecao([{ colecao: 'lights', id: item.id }]); ponte.aoColocar(preset.nome, alvo); }
      return;
    }
    const colecao = colecaoDaFerramenta(f);
    if (colecao) ponte.adicionar(colecao, alvo);
  }

  /** Na Sessão, pegar o quadro do projetor pelo canto (redimensiona) ou pela borda (move). */
  function pegarCaixaDoProjetor(p: Ponto): Interacao | null {
    const c = ponte.emSessao?.() ? ponte.caixaDoProjetor?.() : null; if (!c) return null;
    const r = px(9);
    for (const [x, y, fx, fy] of [[c.x0, c.y0, c.x1, c.y1], [c.x1, c.y0, c.x0, c.y1], [c.x0, c.y1, c.x1, c.y0], [c.x1, c.y1, c.x0, c.y0]] as const)
      if (Math.abs(p[0] - x) <= r && Math.abs(p[1] - y) <= r) return { tipo: 'projetor', modo: 'canto', origem: p, caixa0: c, fixo: [fx, fy] };
    const dentro = p[0] >= c.x0 - r && p[0] <= c.x1 + r && p[1] >= c.y0 - r && p[1] <= c.y1 + r, miolo = p[0] > c.x0 + r && p[0] < c.x1 - r && p[1] > c.y0 + r && p[1] < c.y1 - r;
    return dentro && !miolo ? { tipo: 'projetor', modo: 'mover', origem: p, caixa0: c, fixo: [0, 0] } : null;
  }

  canvas.addEventListener('pointerdown', e => {
    altPressionado = e.altKey;
    if (interacao?.tipo === 'comodo-poligono') {
      if (e.button === 2 || e.button === 1) { interacao = null; camadaSuja = true; cursor(); return; }
      if (e.button !== 0) return;
      const m = doc(), p = mundoDe(e), livre = !m.grid.snap || e.altKey;
      let pt: Ponto = [encaixar(p[0], m.grid, 0, 1, livre), encaixar(p[1], m.grid, 1, 1, livre)];
      const ultimo = interacao.pontos.at(-1)!;
      if (e.shiftKey) pt = pontoPreso45(ultimo, pt);
      const pertoPrimeiro = interacao.pontos.length >= 3 && Math.hypot(pt[0] - interacao.pontos[0]![0], pt[1] - interacao.pontos[0]![1]) <= px(12);
      if (pertoPrimeiro || (e.detail >= 2 && interacao.pontos.length >= 3)) {
        const pontos = interacao.pontos;
        interacao = null;
        concluirContorno(pontos, ponte.pincel().comodo);
        camadaSuja = true; cursor();
        return;
      }
      if (Math.hypot(pt[0] - ultimo[0], pt[1] - ultimo[1]) > px(4)) interacao.pontos.push(pt);
      interacao.atual = pt;
      camadaSuja = true;
      return;
    }
    if (interacao) return;
    if (somenteLeitura) {
      if (e.button === 0 && ponte.pecaDoJogador && ponte.aoArrastarPecaRemota && ponte.podeMoverPecaRemota?.() !== false) {
        const p = mundoDe(e), m = doc(), hit = alvoEm(m, p, px(8));
        const t = hit?.colecao === 'tokens' ? m.tokens[hit.id] : undefined;
        if (t && ponte.pecaDoJogador(t)) {
          e.stopPropagation();
          canvas.setPointerCapture(e.pointerId);
          const [tx, ty] = telaDe(e);
          interacao = { tipo: 'peca-remota', id: t.id, de: [t.position[0], t.position[1]], para: [t.position[0], t.position[1]], offset: [t.position[0] - p[0], t.position[1] - p[1]], motivo: null, semGrade: !m.grid.snap, x0: tx, y0: ty, moveu: false };
          cursor();
          return;
        }
      }
      if (e.button === 0 && e.altKey && ponte.aoPingar) {
        ponte.aoPingar(mundoDe(e));
        return;
      }
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        canvas.setPointerCapture(e.pointerId);
        const [tx, ty] = telaDe(e);
        const hitPorta = e.button === 0 && !e.altKey && ponte.aoAlternarPortaRemota && ponte.podeMoverPecaRemota?.() !== false
          ? alvoEm(doc(), mundoDe(e), px(8))
          : null;
        const portaId = hitPorta?.colecao === 'openings' && doc().openings[hitPorta.id]?.kind === 'door' ? hitPorta.id : undefined;
        interacao = { tipo: 'pan', botao: e.button, x0: tx, y0: ty, camera0: camera, moveu: false, ...(portaId ? { portaId } : {}) };
        if (e.button === 0 && ponte.aoPingar && !portaId) {
          const pontoPing = mundoDe(e);
          cancelarRelogioPing();
          relogioPing = setTimeout(() => {
            relogioPing = undefined;
            if (interacao?.tipo === 'pan' && !interacao.moveu) {
              interacao = null;
              cursor();
              ponte.aoPingar?.(pontoPing);
            }
          }, 400);
        }
        cursor();
      }
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    const [tx, ty] = telaDe(e), m = doc(), f = ponte.ferramenta();
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (f === 'mao' || espaco))) { interacao = { tipo: 'pan', botao: e.button, x0: tx, y0: ty, camera0: camera, moveu: false }; cursor(); return; }
    if (e.button !== 0) return;
    const p = mundoDe(e);
    if (ponte.alinhandoGrade?.()) {
      const centroTela = [tela().largura / 2, tela().altura / 2] as [number, number];
      const centroMundo = telaParaMundo(camera, centroTela);
      const celulas = 3;
      const tamTotal = m.grid.size * celulas;
      const cx0 = Math.floor((centroMundo[0] - m.grid.offset[0] - tamTotal / 2) / m.grid.size) * m.grid.size + m.grid.offset[0];
      const cy0 = Math.floor((centroMundo[1] - m.grid.offset[1] - tamTotal / 2) / m.grid.size) * m.grid.size + m.grid.offset[1];
      const cx1 = cx0 + tamTotal, cy1 = cy0 + tamTotal;
      const distCanto = Math.hypot(p[0] - cx1, p[1] - cy1);
      const tamAlca = px(16);
      if (distCanto <= tamAlca) {
        interacao = {
          tipo: 'alinhamento-grade',
          modo: 'escala',
          origem: [cx0, cy0],
          grade0: { size: m.grid.size, offset: [m.grid.offset[0], m.grid.offset[1]] },
          gesto: store.iniciarGesto('Calibrar tamanho da grade'),
        };
        cursor();
        return;
      }
      if (p[0] >= cx0 && p[0] <= cx1 && p[1] >= cy0 && p[1] <= cy1) {
        interacao = {
          tipo: 'alinhamento-grade',
          modo: 'offset',
          origem: p,
          grade0: { size: m.grid.size, offset: [m.grid.offset[0], m.grid.offset[1]] },
          gesto: store.iniciarGesto('Alinhar grade'),
        };
        cursor();
        return;
      }
    }
    const doProjetor = f === 'selecionar' ? pegarCaixaDoProjetor(p) : null;
    if (doProjetor) { interacao = doProjetor; cursor(); return; }
    if (f === 'regua') { interacao = { tipo: 'regua', ini: centroDaCelula(m, p), x0: tx, y0: ty, moveu: false }; camadaSuja = true; return; }
    if (f !== 'selecionar') { colocar(e, p); cursor(); camadaSuja = true; return; }
    const hit = alvoEm(m, p, px(8)), sel = ponte.selecao();
    if (ponte.emSessao?.()) {
      if (e.button === 0 && e.altKey && ponte.aoPingar && (!hit || hit.colecao !== 'tokens')) {
        ponte.aoPingar(p);
        return;
      }
      // Na sessão só as peças andam; o resto apenas se seleciona.
      if (hit?.colecao === 'tokens' && !e.shiftKey) {
        ponte.definirSelecao([hit]);
        const t = m.tokens[hit.id]; if (!t) return;
        const semGrade = !m.grid.snap || ponte.movimentoLivre?.() === true;
        interacao = { tipo: 'peca', id: hit.id, de: [t.position[0], t.position[1]], para: [t.position[0], t.position[1]], offset: [t.position[0] - p[0], t.position[1] - p[1]], dirRef: [t.position[0], t.position[1]], motivo: null, livre: e.altKey, semGrade, gesto: null, pendente: false, x0: tx, y0: ty, moveu: false };
        cursor(); return;
      }
      if (hit) {
        ponte.definirSelecao(e.shiftKey ? combinarSelecao(sel, [hit], 'alternar') : [hit]);
        const interacaoImediata = hit.colecao === 'openings' || (hit.colecao === 'props' && m.props[hit.id]?.interaction && m.props[hit.id]!.interaction!.kind !== 'clue' && m.props[hit.id]!.interaction!.kind !== 'note' && m.props[hit.id]!.interaction!.kind !== 'stairs');
        if (interacaoImediata && !e.shiftKey) ponte.aoInteragir?.(hit);   // clicar numa porta a abre ou fecha; Shift+clique só a seleciona
        return;
      }
      if (sel.length) ponte.definirSelecao([]);
      return;
    }
    if (hit) {
      const naSelecao = sel.some(a => mesmoAlvo(a, hit));
      if (e.shiftKey) { ponte.definirSelecao(combinarSelecao(sel, [hit], 'alternar')); return; }
      if (hit.colecao === 'openings' && !e.ctrlKey) { ponte.definirSelecao([hit]); interacao = { tipo: 'deslizar', id: hit.id, gesto: null, x0: tx, y0: ty }; cursor(); return; }
      if (!naSelecao || !ehMovel(hit)) ponte.definirSelecao([hit]);
      if (!ehMovel(hit) && !e.ctrlKey) return;
      const alvos = (naSelecao ? [...sel] : [hit]).filter(ehMovel);
      interacao = { tipo: 'mover', hit, alvos, origem: p, ref: ehMovel(hit) ? posicaoDe(m, hit) : p, aplicado: [0, 0], gesto: null, x0: tx, y0: ty, estavaNaSelecao: naSelecao, ctrl: e.ctrlKey };
      cursor(); return;
    }
    if (e.ctrlKey) return;
    interacao = e.altKey ? { tipo: 'laco', pontos: [p], modo: e.shiftKey ? 'somar' : 'trocar' } : { tipo: 'retangulo', ini: p, atual: p, modo: e.shiftKey ? 'somar' : 'trocar', x0: tx, y0: ty, moveu: false };
  });

  /** Aplica o passo de arrasto de peça em modo livre, atualizando a posição da peça na hora. */
  function aplicarArrastoDePeca(i: Extract<Interacao, { tipo: 'peca' }>): void {
    if (!i.semGrade || !i.moveu || !i.pendente || !i.gesto) return;
    i.pendente = false;
    const m = doc(), atual = m.tokens[i.id]?.position ?? i.de;
    const motivo = i.livre ? null : bloqueioNoCaminho(m, atual, i.para);
    i.motivo = motivo;
    if (!motivo && Math.hypot(i.para[0] - atual[0], i.para[1] - atual[1]) > 1e-6) {
      try { i.gesto.aplicar({ tipo: 'peca.mover', id: i.id, para: i.para, livre: i.livre, semGrade: true, emArrasto: true, ...(i.dirAtual !== undefined ? { direcao: i.dirAtual } : {}) }); } catch { /* bloqueado */ }
    }
  }

  let rafArrastoPeca = 0;

  canvas.addEventListener('pointermove', e => {
    ponteiro = mundoDe(e); altPressionado = e.altKey;
    const [tx, ty] = telaDe(e), m = doc();
    if (!interacao) {
      if (somenteLeitura) {
        const hit = alvoEm(m, ponteiro, px(8));
        const pode = ponte.podeMoverPecaRemota?.() !== false;
        const sobrePeca = !!ponte.pecaDoJogador && pode && hit?.colecao === 'tokens' && !!m.tokens[hit.id] && ponte.pecaDoJogador(m.tokens[hit.id]!);
        const sobrePorta = !!ponte.aoAlternarPortaRemota && pode && hit?.colecao === 'openings' && m.openings[hit.id]?.kind === 'door';
        if (sobrePeca !== sobrePecaDoJogador || sobrePorta !== sobrePortaRemota) {
          sobrePecaDoJogador = sobrePeca;
          sobrePortaRemota = sobrePorta;
          cursor();
        }
      }
      // Com um ponto só fixado, a régua acompanha o ponteiro até o próximo clique.
      if (regua && regua.pontos.length === 1 && ponte.ferramenta() === 'regua') regua.atual = centroDaCelula(m, ponteiro);
      camadaSuja = true; return;
    }
    const i = interacao;
    if (i.tipo === 'pan') {
      if (Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) { i.moveu = true; cancelarRelogioPing(); }
      if (i.moveu && !ponte.cameraBloqueada?.()) definirCamera(panear({ ...i.camera0 }, tx - i.x0, ty - i.y0));
    } else if (i.tipo === 'mover') {
      if (!i.gesto) {
        if (Math.hypot(tx - i.x0, ty - i.y0) <= LIMIAR_ARRASTO || !i.alvos.length) return;
        i.gesto = store.iniciarGesto(i.alvos.length > 1 ? `Mover ${i.alvos.length} itens` : 'Mover');
        if (i.ctrl) {
          // Ctrl+arrastar: o que se arrasta é uma cópia; o original fica onde estava.
          const { comandos, alvos } = copiasDe(m, i.alvos, [0, 0]), gesto = i.gesto;
          if (!tentar(() => { for (const c of comandos) gesto.aplicar(c); })) { gesto.cancelar(); interacao = null; return; }
          i.alvos = alvos; ponte.definirSelecao(alvos);
        }
      }
      const soObjetos = i.alvos.every(a => a.colecao === 'props' || a.colecao === 'lights');
      const livre = soObjetos ? livreParaObjeto(objetosNaGrade(), doc().grid.snap, e.altKey) : !doc().grid.snap || e.altKey;
      const d = deltaEncaixado(i.ref, [ponteiro[0] - i.origem[0], ponteiro[1] - i.origem[1]], doc().grid, 0.5, livre), passo: Ponto = [d[0] - i.aplicado[0], d[1] - i.aplicado[1]];
      if (Math.abs(passo[0]) > 1e-9 || Math.abs(passo[1]) > 1e-9) { i.gesto.aplicar({ tipo: 'selecao.mover', alvos: i.alvos, delta: passo }); i.aplicado = d; }
    } else if (i.tipo === 'peca') {
      if (Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) i.moveu = true;
      const semGrade = !m.grid.snap || ponte.movimentoLivre?.() === true;
      i.semGrade = semGrade;
      i.livre = !m.grid.snap || e.altKey;
      const alvoPos: Ponto = semGrade
        ? [Math.max(0, Math.min(m.bounds.width, ponteiro[0] + i.offset[0])), Math.max(0, Math.min(m.bounds.height, ponteiro[1] + i.offset[1]))]
        : i.livre
          ? [Math.max(0, Math.min(m.bounds.width, ponteiro[0])), Math.max(0, Math.min(m.bounds.height, ponteiro[1]))]
          : centroDaCelula(m, ponteiro);
      i.para = alvoPos;
      const dxDir = alvoPos[0] - i.dirRef[0], dyDir = alvoPos[1] - i.dirRef[1];
      const distDir = Math.hypot(dxDir, dyDir);
      if (distDir >= 0.2) {
        i.dirAtual = Math.atan2(dyDir, dxDir);
        const recuo = Math.min(0.12, distDir * 0.5);
        i.dirRef = [alvoPos[0] - (dxDir / distDir) * recuo, alvoPos[1] - (dyDir / distDir) * recuo];
      }
      if (semGrade && i.moveu) {
        if (!i.gesto) i.gesto = store.iniciarGesto('Mover peça');
        const atual = m.tokens[i.id]?.position ?? i.de;
        i.motivo = i.livre ? null : bloqueioNoCaminho(m, atual, alvoPos);
        i.pendente = true;
        if (!rafArrastoPeca) {
          if (typeof requestAnimationFrame === 'function') {
            rafArrastoPeca = requestAnimationFrame(() => {
              rafArrastoPeca = 0;
              if (interacao?.tipo === 'peca') aplicarArrastoDePeca(interacao);
            });
          } else {
            aplicarArrastoDePeca(i);
          }
        }
      } else {
        i.motivo = i.livre ? null : bloqueioNoCaminho(m, i.de, i.para);
      }
    } else if (i.tipo === 'peca-remota') {
      if (Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) i.moveu = true;
      const semGrade = !m.grid.snap;
      i.semGrade = semGrade;
      const alvoBruto: Ponto = semGrade
        ? [Math.max(0, Math.min(m.bounds.width, ponteiro[0] + i.offset[0])), Math.max(0, Math.min(m.bounds.height, ponteiro[1] + i.offset[1]))]
        : centroDaCelula(m, [Math.max(0, Math.min(m.bounds.width - 1e-4, ponteiro[0])), Math.max(0, Math.min(m.bounds.height - 1e-4, ponteiro[1]))]);
      const candidato: Ponto = [Math.max(0, Math.min(m.bounds.width, alvoBruto[0])), Math.max(0, Math.min(m.bounds.height, alvoBruto[1]))];
      if (semGrade) {
        const atual = m.tokens[i.id]?.position ?? i.de;
        const motivo = bloqueioNoCaminho(m, atual, candidato);
        i.motivo = motivo;
        if (!motivo) {
          i.para = candidato;
          const tLocal = completo().tokens[i.id];
          if (i.moveu && tLocal && Math.hypot(candidato[0] - atual[0], candidato[1] - atual[1]) > 1e-6) {
            store.projetar({ ...completo(), tokens: { ...completo().tokens, [i.id]: { ...tLocal, position: candidato } } }, { emGesto: true, pularValidacao: true });
            const agora = performance.now();
            if (ponte.aoArrastarPecaRemota && !i.emVoo && agora - (i.ultimoEnvio ?? 0) >= 40) {
              i.ultimoEnvio = agora;
              i.emVoo = true;
              void ponte.aoArrastarPecaRemota(tLocal, candidato, true).finally(() => { i.emVoo = false; });
            }
          }
        }
      } else {
        i.para = candidato;
        i.motivo = bloqueioNoCaminho(m, i.de, i.para);
      }
    } else if (i.tipo === 'deslizar') {
      if (!i.gesto) { if (Math.hypot(tx - i.x0, ty - i.y0) <= LIMIAR_ARRASTO) return; i.gesto = store.iniciarGesto('Mover abertura'); }
      const a = m.openings[i.id]; if (!a) return;
      const livre = !m.grid.snap || e.altKey;
      const enc = encaixarNaParede(m, ponteiro, a.width, 1.2, livre, andarAtual());
      if (enc && (enc.parede.id !== a.wallId || Math.abs(enc.at - a.at) > 1e-6)) { try { i.gesto.aplicar({ tipo: 'abertura.atualizar', id: i.id, patch: { wallId: enc.parede.id, at: enc.at } }); } catch { /* ali não cabe: fica onde estava */ } }
    } else if (i.tipo === 'projetor') {
      const c0 = i.caixa0;
      if (i.modo === 'mover') { const dx = ponteiro[0] - i.origem[0], dy = ponteiro[1] - i.origem[1]; ponte.aoMudarCaixaDoProjetor?.({ x0: c0.x0 + dx, y0: c0.y0 + dy, x1: c0.x1 + dx, y1: c0.y1 + dy }); }
      else {
        const asp = ponte.aspectoDoProjetor?.() ?? 16 / 9, [fx, fy] = i.fixo, sx = ponteiro[0] >= fx ? 1 : -1, sy = ponteiro[1] >= fy ? 1 : -1;
        const w = Math.max(3, Math.abs(ponteiro[0] - fx)), h = w / asp, x = fx + sx * w, y = fy + sy * h;
        ponte.aoMudarCaixaDoProjetor?.({ x0: Math.min(fx, x), y0: Math.min(fy, y), x1: Math.max(fx, x), y1: Math.max(fy, y) });
      }
    } else if (i.tipo === 'regua') {
      // Arrastar começa uma régua nova, do ponto onde se apertou; um clique sem arrastar só acrescenta um ponto (ao soltar).
      if (!i.moveu && Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) i.moveu = true;
      if (i.moveu) regua = { pontos: [i.ini], atual: centroDaCelula(m, ponteiro) };
    } else if (i.tipo === 'retangulo') {
      i.atual = ponteiro; if (Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) i.moveu = true;
    } else if (i.tipo === 'laco') {
      const u = i.pontos.at(-1)!; if (Math.hypot(ponteiro[0] - u[0], ponteiro[1] - u[1]) > px(3)) i.pontos.push(ponteiro);
    } else if (i.tipo === 'cômodo') {
      const c = celulaDe(m, ponteiro);
      if (i.retangulo) i.atual = c; else { pintarCelulas(celulasEntre(i.atual, c).filter(x => dentroDoMapa(m, x))); i.atual = c; }
    } else if (i.tipo === 'comodo-circulo') {
      const livre = !m.grid.snap || e.altKey;
      i.atual = [encaixar(ponteiro[0], m.grid, 0, 1, livre), encaixar(ponteiro[1], m.grid, 1, 1, livre)];
    } else if (i.tipo === 'comodo-poligono') {
      const livre = !m.grid.snap || e.altKey;
      let pt: Ponto = [encaixar(ponteiro[0], m.grid, 0, 1, livre), encaixar(ponteiro[1], m.grid, 1, 1, livre)];
      if (e.shiftKey) pt = pontoPreso45(i.pontos.at(-1)!, pt);
      i.atual = pt;
    } else if (i.tipo === 'terreno') { const antes = i.ultimo; i.ultimo = ponteiro; pintarTerreno(ponteiro, antes); }
    else if (i.tipo === 'carimbar') {
      const o = ponte.pincel().objeto, pegada = Math.max(...(ACERVO.item(o.item)?.pegada ?? [1, 1])) * o.escala, passo = Math.max(0.3, Math.max(pegada, o.area) / Math.max(0.1, o.densidade));
      const alvo: Ponto = [encaixar(ponteiro[0], m.grid, 0, 0.5, i.livre), encaixar(ponteiro[1], m.grid, 1, 0.5, i.livre)];
      if (Math.hypot(alvo[0] - i.ultimo[0], alvo[1] - i.ultimo[1]) >= passo) { i.ultimo = alvo; carimbarAqui(alvo); }
    }
    else if (i.tipo === 'espalhar') { if (Math.hypot(ponteiro[0] - i.ultimo[0], ponteiro[1] - i.ultimo[1]) >= ponte.pincel().espalhar.raio / 2) { i.ultimo = ponteiro; espalharAqui(ponteiro); } }
    else if (i.tipo === 'parede') i.fim = pontoDeParede(m, ponteiro, i.ini, !m.grid.snap || e.altKey);
    else if (i.tipo === 'alinhamento-grade') {
      const ajustado = ajustarGradePorAlinhamento(i.grade0, i.origem, ponteiro, i.modo, 3);
      if (i.modo === 'offset') {
        i.gesto.aplicar({ tipo: 'grade.atualizar', patch: { offset: ajustado.offset } });
      } else {
        i.gesto.aplicar({ tipo: 'grade.atualizar', patch: { size: ajustado.size } });
      }
    }
    camadaSuja = true;
  });

  /** Ctrl+clique num item: o pincel passa a ser como ele (receita, luz, tipo de cômodo, abertura). */
  function pipeta(a: Alvo): void {
    const m = doc();
    if (a.colecao === 'props') {
      const o = m.props[a.id]; if (!o) return;
      const id = ACERVO.idDaFonte(o.source); if (!ACERVO.item(id)) return;
      ponte.definirPincel({ objeto: pincelDoObjeto(o, ponte.pincel().objeto, id, ACERVO.familiaDoItem(id)?.id ?? null) }); ponte.definirFerramenta('objeto'); ponte.aviso(`Pincel: ${ACERVO.item(id)?.nome ?? id}`);
    } else if (a.colecao === 'lights') {
      const l = m.lights[a.id]; if (!l) return;
      ponte.definirPincel({ luz: { preset: l.preset && presetDeLuz(l.preset) ? l.preset : l.cone ? 'lanterna' : 'lamparina', direcao: l.cone?.direction ?? 0 } }); ponte.definirFerramenta('luz'); ponte.aviso('Pincel: luz copiada');
    } else if (a.colecao === 'rooms') {
      const s = m.rooms[a.id], tipo = s && TIPOS_DE_COMODO.find(t => t.funcao === s.function);
      if (tipo) { ponte.definirPincel({ comodo: tipo.id }); ponte.definirFerramenta('comodo'); ponte.aviso(`Pincel: ${tipo.nome}`); }
    } else if (a.colecao === 'openings') {
      const o = m.openings[a.id]; if (o) { ponte.definirPincel({ abertura: { tipo: o.kind } }); ponte.definirFerramenta('abertura'); ponte.aviso('Pincel: abertura copiada'); }
    }
  }

  function terminar(e: PointerEvent, cancelado: boolean): void {
    cancelarRelogioPing();
    const i = interacao; if (!i) return;
    if (i.tipo === 'comodo-poligono') {
      if (cancelado) { interacao = null; camadaSuja = true; cursor(); }
      return;
    }
    interacao = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    const m = doc(), sel = ponte.selecao();
    if (i.tipo === 'pan') {
      if (!i.moveu && i.botao === 2 && !cancelado) { const p = mundoDe(e); ponte.aoMenuContexto({ tela: [e.clientX, e.clientY], mundo: p, alvo: alvoEm(m, p, px(8)) }); }
      else if (!i.moveu && i.botao === 0 && !cancelado && i.portaId && ponte.aoAlternarPortaRemota && ponte.podeMoverPecaRemota?.() !== false) {
        ponte.aoAlternarPortaRemota(i.portaId);
      }
    } else if (i.tipo === 'mover') {
      if (i.gesto) { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); }
      else if (!cancelado && i.ctrl) pipeta(i.hit);
      else if (!cancelado && i.estavaNaSelecao && sel.length > 1) ponte.definirSelecao([i.hit]);
    } else if (i.tipo === 'peca') {
      if (i.gesto) {
        if (cancelado) i.gesto.cancelar();
        else {
          if (i.moveu && !i.motivo) {
            const atual = doc().tokens[i.id]?.position ?? i.de;
            if (Math.hypot(i.para[0] - atual[0], i.para[1] - atual[1]) > 1e-6) {
              try { i.gesto.aplicar({ tipo: 'peca.mover', id: i.id, para: i.para, livre: i.livre, semGrade: i.semGrade, ...(i.dirAtual !== undefined ? { direcao: i.dirAtual } : {}) }); } catch { /* ignora */ }
            } else if (doc().tokens[i.id]?.player) {
              try { i.gesto.aplicar({ tipo: 'sessao.explorar' }); } catch { /* ignora */ }
            }
          }
          i.gesto.concluir();
        }
      } else if (!cancelado && i.moveu && Math.hypot(i.para[0] - i.de[0], i.para[1] - i.de[1]) > 1e-6) {
        tentar(() => store.executar({ tipo: 'peca.mover', id: i.id, para: i.para, livre: i.livre, semGrade: i.semGrade, ...(i.dirAtual !== undefined ? { direcao: i.dirAtual } : {}) }));
      }
    } else if (i.tipo === 'peca-remota') {
      if (i.semGrade) {
        const t = m.tokens[i.id];
        if (cancelado) {
          const tComp = completo().tokens[i.id];
          if (tComp) store.projetar({ ...completo(), tokens: { ...completo().tokens, [i.id]: { ...tComp, position: i.de } } }, { emGesto: true, pularValidacao: true });
        } else if (i.moveu && t && ponte.aoArrastarPecaRemota && Math.hypot(i.para[0] - i.de[0], i.para[1] - i.de[1]) > 1e-6) {
          void ponte.aoArrastarPecaRemota(t, i.para, false).then(aceito => {
            if (!aceito) {
              const tComp = completo().tokens[i.id];
              if (tComp) store.projetar({ ...completo(), tokens: { ...completo().tokens, [i.id]: { ...tComp, position: i.de } } }, { emGesto: true, pularValidacao: true });
            }
          });
        }
      } else if (!cancelado && i.moveu && Math.hypot(i.para[0] - i.de[0], i.para[1] - i.de[1]) > 1e-6) {
        const t = m.tokens[i.id];
        if (t && ponte.aoArrastarPecaRemota) {
          limparPecaRemotaPendente();
          const pendente: NonNullable<typeof pecaRemotaPendente> = { id: i.id, de: i.de, para: i.para, motivo: i.motivo, semGrade: i.semGrade };
          pendente.relogio = setTimeout(() => {
            if (pecaRemotaPendente === pendente) limparPecaRemotaPendente();
          }, 1500);
          pecaRemotaPendente = pendente;
          void ponte.aoArrastarPecaRemota(t, i.para, false).then(
            aceito => {
              if (pecaRemotaPendente !== pendente) return;
              const posAtual = doc().tokens[pendente.id]?.position;
              const jaMoveu = posAtual && (Math.abs(posAtual[0] - pendente.de[0]) > 1e-6 || Math.abs(posAtual[1] - pendente.de[1]) > 1e-6);
              if (!aceito || jaMoveu) limparPecaRemotaPendente();
            },
            () => { if (pecaRemotaPendente === pendente) limparPecaRemotaPendente(); },
          );
        }
      }
    } else if (i.tipo === 'regua') {
      if (cancelado) { /* nada */ } else if (i.moveu) {
        const fim = regua?.atual ?? i.ini;
        regua = { pontos: Math.hypot(fim[0] - i.ini[0], fim[1] - i.ini[1]) < 1e-6 ? [i.ini] : [i.ini, fim], atual: null };
        if (regua.pontos.length === 1) regua.atual = fim;
      } else if (!regua || !regua.pontos.length) regua = { pontos: [i.ini], atual: i.ini };
      else {
        const ultimo = regua.pontos.at(-1)!;
        if (Math.hypot(i.ini[0] - ultimo[0], i.ini[1] - ultimo[1]) > 1e-6) regua = { pontos: [...regua.pontos, i.ini], atual: null };
      }
    } else if (i.tipo === 'projetor') { /* o quadro já foi atualizado durante o arrasto */
    } else if (i.tipo === 'deslizar') { if (i.gesto) { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); } }
    else if (i.tipo === 'retangulo') {
      if (cancelado) { /* nada */ } else if (!i.moveu) { if (i.modo === 'trocar' && sel.length) ponte.definirSelecao([]); }
      else ponte.definirSelecao(combinarSelecao(sel, alvosNaCaixa(m, { x0: i.ini[0], y0: i.ini[1], x1: i.atual[0], y1: i.atual[1] }), i.modo));
    } else if (i.tipo === 'laco' && !cancelado) ponte.definirSelecao(combinarSelecao(sel, alvosNoLaco(m, i.pontos), i.modo));
    else if (i.tipo === 'cômodo') {
      if (cancelado) i.gesto.cancelar();
      else { if (i.retangulo) { interacao = i; pintarCelulas(retanguloDeCelulas(m, i.ini, i.atual)); interacao = null; } if (i.gesto.ativo) i.gesto.concluir(); }
      if (!cancelado && !i.apagar) { const sala = doc().rooms[i.sala]; if (sala) { ponte.definirSelecao([{ colecao: 'rooms', id: i.sala }]); const c = caixaDe(doc(), { colecao: 'rooms', id: i.sala }); if (c) ponte.aoColocar(sala.name, [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]); } }
    } else if (i.tipo === 'comodo-circulo' && !cancelado) {
      const r = Math.hypot(i.atual[0] - i.centro[0], i.atual[1] - i.centro[1]);
      if (r >= 0.8) concluirContorno(circulo(i.centro, r, i.lados), i.tipoComodo);
    } else if (i.tipo === 'alinhamento-grade') {
      if (cancelado) i.gesto.cancelar(); else i.gesto.concluir();
    } else if (i.tipo === 'terreno' || i.tipo === 'espalhar') { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); }
    else if (i.tipo === 'carimbar') {
      if (cancelado) i.gesto.cancelar();
      else { i.gesto.concluir(); if (i.postos.length && ponte.pincel().objeto.selecionarAoPor) ponte.definirSelecao(i.postos.map(id => ({ colecao: 'props' as const, id }))); }
    }
    else if (i.tipo === 'parede' && !cancelado) {
      if (Math.hypot(i.fim[0] - i.ini[0], i.fim[1] - i.ini[1]) >= 0.25) {
        const tipo = ponte.pincel().parede.tipo, id = novoIdEntidade('w'), andar = andarAtual();
        if (tentar(() => store.executar({ tipo: 'parede.adicionar', parede: { id, path: [i.ini, i.fim], height: tipo === 'wall' ? 2.6 : tipo === 'cliff' ? 3 : 1.1, thickness: tipo === 'wall' ? 0.2 : tipo === 'cliff' ? 0.4 : 0.14, material: tipo === 'cliff' ? 'rocha.cinza' : 'parede.topo', kind: tipo, blocks: { move: true, sight: tipo === 'wall', light: tipo === 'wall' }, drop: tipo === 'cliff' ? 'b' : null, ...(andar !== null ? { levelId: andar } : {}) } }, { rotulo: 'Desenhar parede' }))) { ponte.definirSelecao([{ colecao: 'walls', id }]); ponte.aoColocar('Parede', i.fim); }
      }
    }
    camadaSuja = true; cursor();
  }
  canvas.addEventListener('pointerup', e => { altPressionado = e.altKey; terminar(e, false); });
  canvas.addEventListener('pointercancel', e => terminar(e, true));
  canvas.addEventListener('pointerleave', () => { ponteiro = null; camadaSuja = true; });

  const aoTeclar = (e: KeyboardEvent) => {
    const emCampo = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === ' ' && !emCampo) { if (!e.repeat) { espaco = true; cursor(); } e.preventDefault(); return; }
    if (e.key === 'Alt' && !altPressionado) { altPressionado = true; camadaSuja = true; }
    // Esc limpa a régua (e só isso: o próximo Esc volta à ferramenta de selecionar).
    if (e.key === 'Escape' && regua) { e.stopImmediatePropagation(); regua = null; if (interacao?.tipo === 'regua') interacao = null; camadaSuja = true; return; }
    if (e.key === 'Enter' && interacao?.tipo === 'comodo-poligono' && interacao.pontos.length >= 3) {
      e.stopImmediatePropagation();
      const { pontos, tipoComodo } = interacao; interacao = null;
      concluirContorno(pontos, tipoComodo);
      camadaSuja = true; cursor(); return;
    }
    // Esc durante um arrasto ou uma pincelada cancela só isso, antes de qualquer outro atalho.
    if (e.key === 'Escape' && interacao) {
      e.stopImmediatePropagation();
      const i = interacao; interacao = null;
      if ((i.tipo === 'mover' || i.tipo === 'peca' || i.tipo === 'deslizar' || i.tipo === 'alinhamento-grade') && i.gesto) i.gesto.cancelar();
      else if (i.tipo === 'cômodo' || i.tipo === 'terreno' || i.tipo === 'espalhar' || i.tipo === 'carimbar') i.gesto.cancelar();
      camadaSuja = true; cursor();
    }
  };
  const aoSoltar = (e: KeyboardEvent) => {
    if (e.key === ' ') { espaco = false; cursor(); }
    if (e.key === 'Alt') { altPressionado = false; camadaSuja = true; }
  };
  window.addEventListener('keydown', aoTeclar, true);
  window.addEventListener('keyup', aoSoltar);

  // ---------- Laço do desenho ----------
  const aoQuadro = () => {
    if (interacao?.tipo === 'peca') aplicarArrastoDePeca(interacao);
    if (camAnim) {
      const k = Math.min(1, (performance.now() - camAnim.t0) / 700), e = 1 - (1 - k) ** 3, { de, para } = camAnim;
      definirCamera({ x: de.x + (para.x - de.x) * e, y: de.y + (para.y - de.y) * e, zoom: de.zoom * (para.zoom / de.zoom) ** e });
      if (k >= 1) camAnim = null;
    }
    // Eventos de cena: sacodem a câmera, piscam as luzes, escurecem o ambiente ou cobrem tudo de branco.
    { const agora = performance.now(), ev = eventos.estado(agora);
      if (ev.tremor[0] !== tremorAtual[0] || ev.tremor[1] !== tremorAtual[1]) { tremorAtual = ev.tremor; posicaoDoMundo(); }
      cena.definirEfeitosDeLuz(ev.luzes, ev.ambiente);
      if (ev.clarao > 0.001) { clarao.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xffffff, alpha: ev.clarao }); clarao.visible = true; } else if (clarao.visible) { clarao.clear(); clarao.visible = false; } }
    cena.quadro(performance.now()); fantasmaDaProposta.quadro(performance.now());
    if (pixelAtivo) pixelizacao.renderizar(cena.raiz);
    if (transicao) passoDaTransicao(performance.now());
    else if (doc().finish.grain > 0 && alvoDoAcabamento().filters?.length) acabamento.aplicar(doc().finish, performance.now() / 1000);
    camadaPings.atualizar(camera, app.screen.width, app.screen.height, Date.now(), doc().climate.preset === 'night' || doc().climate.ambient.intensity < 0.55);
    if (regua && ponte.ferramenta() !== 'regua') { regua = null; camadaSuja = true; }   // trocar de ferramenta limpa a régua
    if (interacao?.tipo === 'comodo-poligono' && ponte.ferramenta() !== 'comodo') { interacao = null; camadaSuja = true; }
    if (!camadaSuja) return;
    camadaSuja = false;
    if (gradeSuja) { desenharGrade(); gradeSuja = false; }
    desenharRelevo(); desenharSelecao(); desenharLaco(); desenharFantasma(); cursor();
  };
  app.ticker.add(aoQuadro);
  const observador = new ResizeObserver(() => { camadaSuja = true; gradeSuja = true; });
  observador.observe(host);

  cena.definirModoProjetor(somenteLeitura);
  cena.definirVista(ponte.vista?.() ?? 'construir');      // o projetor já nasce na vista de jogador
  redesenharTudo();
  if (ponte.cameraInicial) {
    definirCamera(ponte.cameraInicial);
  } else {
    enquadrarMapa();
  }

  let pintandoSimulado: number | null = null;
  const capturar = (opcoes?: { caixa?: Caixa; ladoMaximo?: number; vista?: 'planta' | 'telhados' }): Promise<Captura> =>
    capturarViewport(
      {
        app,
        cena,
        doc,
        tela,
        camera: () => camera,
        definirCamera,
        modoProjetor: () => modoProjetor,
        projetor,
        limparAnimacaoCamera: () => { camAnim = null; },
        pintandoSimulado: () => pintandoSimulado,
      },
      opcoes,
    );
  function projetor(ligado: boolean): void { modoProjetor = ligado; cena.definirModoProjetor(ligado); grade.visible = !ligado; area_.visible = !ligado; selecaoG.visible = !ligado; fantasmaC.visible = !ligado; fantasmaDaProposta.raiz.visible = !ligado; laco.visible = !ligado; desenharRelevo(); }

  return {
    get camera() { return camera; },
    get tela() { return tela(); },
    get pintando() { return cena.pintando; },
    ponteiro: () => ponteiro,
    centro: () => telaParaMundo(camera, [app.screen.width / 2, app.screen.height / 2]),
    enquadrar: enquadrarMapa, focarEm, zoomPor,
    definirCamera: (c: Camera) => definirCamera(c),
    enquadrarCaixa(c, suave) {
      const alvo = calcularEnquadre({ x: c.x0, y: c.y0, largura: Math.max(c.x1 - c.x0, 1), altura: Math.max(c.y1 - c.y0, 1) }, tela(), 0);
      if (!suave || movimentoReduzido()) { camAnim = null; definirCamera(alvo); } else camAnim = { de: camera, para: alvo, t0: performance.now() };
    },
    mundoDe: (x, y) => { const r = retangulo(); return telaParaMundo(camera, [x - r.left, y - r.top]); },
    clientDe: m => { const r = retangulo(), [x, y] = mundoParaTela(camera, m); return [r.left + x, r.top + y]; },
    redesenhar: () => { redesenharTudo(); },
    redesenharPecas: () => { cena.redesenharPecas(); camadaSuja = true; },
    diagnosticoDosTelhados: () => cena.diagnosticoDosTelhados(),
    atualizarSobreposicoes: () => {
      if (ultimoAndar !== andarAtual() || ultimoConstruir !== ctxAndar().construir) { redesenharTudo(); return; }
      if (Boolean(ponte.alinhandoGrade?.()) !== ultimoAlinhandoGrade) gradeSuja = true;
      camadaSuja = true; cena.definirVista(ponte.vista?.() ?? 'construir'); aplicarAcabamento();
    },
    relampagoAgora: () => cena.relampagoAgora(),
    dispararPing: ping => camadaPings.adicionar(ping),
    definirDuracaoDaTransicao: ms => { duracaoDaTransicao = Math.max(0, ms); },
    dispararEvento: e => { eventos.disparar(e, performance.now()); },
    diagnosticoDosEventos: () => eventos.estado(performance.now()),
    contagemDeParticulas: () => cena.contagemDeParticulas(),
    contagemDePresencas: () => cena.contagemDePresencas(),
    contagemDePresencasSubmersas: () => cena.contagemDePresencasSubmersas(),
    contagemDeCachoeiras: () => cena.contagemDeCachoeiras(),
    aguaAtiva: () => cena.aguaAtiva(),
    objetosPintados: () => cena.objetosPintados(),
    tintDeObjeto: id => cena.tintDeObjeto(id),
    diagnosticoDasPecas: () => cena.diagnosticoDasPecas(),
    mostrarProposta: previa => { fantasmaDaProposta.mostrar(doc(), previa); camadaSuja = true; },
    contagemDoFantasma: () => fantasmaDaProposta.contagem(),
    fantasmasVisiveis: () => ({ ferramenta: fantasmaC.visible, proposta: fantasmaDaProposta.raiz.visible, laco: laco.visible }),
    diagnosticoDaRegua: medidaDaRegua,
    definirModoProjetor: projetor,
    simularPintando: (n: number | null) => { pintandoSimulado = n; },
    capturar,
    destruir() {
      destruido = true; if (rafArrastoPeca) { cancelAnimationFrame(rafArrastoPeca); rafArrastoPeca = 0; } cancelarAssinatura(); observador.disconnect();
      window.removeEventListener('keydown', aoTeclar, true); window.removeEventListener('keyup', aoSoltar);
      cancelarRelogioPing(); limparPecaRemotaPendente();
      camadaPings.destruir();
      app.ticker.remove(aoQuadro); limparFantasmaSprite(); fantasmaDaProposta.destruir(); linhasDeNivel.destruir(); retratos.limpar(); cena.destruir(); baker.encerrar(); pixelizacao.destruir(); app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    },
  };
}
