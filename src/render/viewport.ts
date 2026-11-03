import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { celulasDoDisco, celulasEntre, decodificar } from '../domain/celulas.ts';
import { misturar, type EstadoDeClima, type MisturaDeClima } from '../domain/clima.ts';
import { conjuntoDeEspalhar, espalhar } from '../authoring/espalhar.ts';
import { copiasDe, novaLuz, novoIdEntidade, novoObjeto } from '../domain/fabrica.ts';
import { comprimentoDaParede, contornoDoComodo, encaixarNaParede, encaixarObjetoDeParede, indiceDeCelulas, pontoNaParede, salaDaCelula } from '../domain/geometria.ts';
import type { Abertura, MapaAtlas, Ponto } from '../domain/mapa.ts';
import { TIPOS_DE_COMODO, camposDoPreset, pincelDePresenca, presetDeLuz, tipoDeComodo } from '../domain/presets.ts';
import { fxAtivo } from '../fx/fx.ts';
import { criarBaker, type Baker } from '../procedural/baker.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { ColecaoLivre } from '../state/comandos.ts';
import type { EventoStore, Gesto, Store } from '../state/store.ts';
import { criarFiltroAcabamento } from './acabamento.ts';
import { enquadrar as calcularEnquadre, mundoParaTela, panear, telaParaMundo, zoomEm, type Camera, type Tela } from './camera.ts';
import { RES_OBJETO, criarCena, type Cena } from './cena.ts';
import { hexParaNumero } from './cores.ts';
import { chaveDoObjeto, pedidoDoObjeto } from './entradas.ts';
import { criarFantasmaDeProposta } from './fantasma-proposta.ts';
import { deltaEncaixado, encaixar, linhasDaGrade } from './grade.ts';
import { LARGURA_DA_ABERTURA, type Ferramenta, type Pincel } from './pincel.ts';
import { alvoEm, alvosNaCaixa, alvosNoLaco, caixaDaSelecao, caixaDe, combinarSelecao, ehMovel, mesmoAlvo, type Alvo, type Caixa } from './selecao.ts';

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
  /** Uma operação foi recusada (não cabe, fora do mapa…): o aplicativo mostra o motivo. */
  aviso(texto: string): void;
  aoMenuContexto(info: { tela: Ponto; mundo: Ponto; alvo: Alvo | null }): void;
  aoCamera?(c: Camera): void;
  /** Mostrar o acabamento (vinheta, tinta…) no editor? */
  acabamento(): boolean;
}

/** Quanto dura a transição entre dois climas, em milissegundos. */
const DURACAO_DA_TRANSICAO = 1600;

export interface Viewport {
  readonly camera: Camera;
  readonly tela: Tela;
  /** Quantos desenhos ainda estão sendo pintados no worker. */
  readonly pintando: number;
  ponteiro(): Ponto | null;
  centro(): Ponto;
  enquadrar(): void;
  focarEm(caixa: Caixa): void;
  zoomPor(fator: number): void;
  /** Posição na tela do navegador (px de `client`) de um ponto do mundo, para ancorar efeitos DOM e o cartão contextual. */
  clientDe(mundo: Ponto): Ponto;
  /** Refaz tudo (mudou o tema, por exemplo). */
  redesenhar(): void;
  /** Só a seleção, o fantasma e a grade: a seleção, a ferramenta ou o pincel mudaram fora do viewport. */
  atualizarSobreposicoes(): void;
  /** Dispara um relâmpago (e o trovão, se o som estiver ligado). Só vale com a atmosfera visível. */
  relampagoAgora(): void;
  /** Quantas partículas de cada tipo existem agora (diagnóstico e testes). */
  contagemDeParticulas(): ReturnType<Cena['contagemDeParticulas']>;
  contagemDePresencas(): number;
  /** Quantos objetos de piso já têm a textura pintada (para os testes). */
  objetosPintados(): number;
  /** Mostra, translúcido, o que `previa` acrescenta ao documento; `null` limpa. Quem chamou recalcula se o documento mudar. */
  mostrarProposta(previa: MapaAtlas | null): void;
  contagemDoFantasma(): number;
  destruir(): void;
}

const LIMIAR_ARRASTO = 4;
const COR_PADRAO_ACENTO = 0xe91d25;

type Interacao =
  | { tipo: 'pan'; botao: number; x0: number; y0: number; camera0: Camera; moveu: boolean }
  | { tipo: 'mover'; hit: Alvo; alvos: Alvo[]; origem: Ponto; ref: Ponto; aplicado: Ponto; gesto: Gesto | null; x0: number; y0: number; estavaNaSelecao: boolean; ctrl: boolean }
  | { tipo: 'deslizar'; id: string; gesto: Gesto | null; x0: number; y0: number }
  | { tipo: 'retangulo'; ini: Ponto; atual: Ponto; modo: 'trocar' | 'somar'; x0: number; y0: number; moveu: boolean }
  | { tipo: 'laco'; pontos: Ponto[]; modo: 'trocar' | 'somar' }
  | { tipo: 'cômodo'; apagar: boolean; sala: string; criado: boolean; gesto: Gesto; ini: [number, number]; atual: [number, number]; retangulo: boolean; visitadas: Set<number> }
  | { tipo: 'terreno'; apagar: boolean; gesto: Gesto; ultimo: Ponto; presenca: boolean }
  | { tipo: 'espalhar'; apagar: boolean; gesto: Gesto; ultimo: Ponto; semente: number }
  | { tipo: 'parede'; ini: Ponto; fim: Ponto };

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

  const store = ponte.store, baker: Baker = criarBaker();
  const mundo = new Container(), area_ = new Graphics(), grade = new Graphics(), selecaoG = new Graphics(), fantasmaC = new Container(), fantasmaG = new Graphics(), laco = new Graphics();
  let camera: Camera = { x: 0, y: 0, zoom: 20 };
  let ponteiro: Ponto | null = null, interacao: Interacao | null = null, espaco = false, camadaSuja = true, destruido = false;
  const doc = (): MapaAtlas => store.documento;
  const tela = (): Tela => ({ largura: app.screen.width, altura: app.screen.height });
  const acento = (): number => { const v = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? hexParaNumero(v) : COR_PADRAO_ACENTO; };
  const px = (n: number) => n / camera.zoom;

  const cena: Cena = criarCena({ baker, renderer: app.renderer, acento, efeitos: fxAtivo, aoPintar: () => { camadaSuja = true; } });
  const acabamento = criarFiltroAcabamento();
  fantasmaC.addChild(fantasmaG);
  const fantasmaDaProposta = criarFantasmaDeProposta({ baker, acento, efeitos: fxAtivo });
  mundo.addChild(area_, cena.raiz, grade, selecaoG, fantasmaC, fantasmaDaProposta.raiz, laco);
  app.stage.addChild(mundo);

  // ---------- Transição de clima ----------
  // O documento muda na hora; o que a cena exibe (luz, partículas, neblina, acabamento) caminha até ele em DURACAO_DA_TRANSICAO.
  let transicao: { de: EstadoDeClima; alvo: EstadoDeClima; inicio: number } | null = null;
  let exibido: MisturaDeClima | null = null;      // o estado misturado agora; null quando o exibido é o próprio documento
  const estadoDoDoc = (m: MapaAtlas): EstadoDeClima => ({ climate: m.climate, finish: m.finish });
  /** O clima que a cena exibe agora, em forma de estado (a rede ainda é ligada ou não: o piscar da queda é da luz). */
  let vistoDoDoc: EstadoDeClima = estadoDoDoc(doc());      // o clima do documento no último evento (o `doc()` já é o novo quando o evento chega)
  const estadoExibido = (): EstadoDeClima => exibido ? { climate: { ...exibido.climate, gridPower: doc().climate.gridPower }, finish: exibido.finish } : vistoDoDoc;
  /** O documento visto com o clima exibido (o próprio documento quando não há transição). */
  const visaoDoClima = (m: MapaAtlas): MapaAtlas => exibido ? { ...m, ...estadoExibido() } : m;
  const suave = (t: number) => t * t * (3 - 2 * t);

  function aplicarAcabamento(): void {
    const m = doc(), finish = (exibido ?? m).finish, ligado = ponte.acabamento() && (finish.preset !== 'nenhum' || exibido !== null);
    cena.definirAtmosfera(ponte.acabamento());
    cena.raiz.filters = ligado ? [acabamento.filtro] : [];
    if (ligado) acabamento.aplicar(finish, performance.now() / 1000);
  }

  function pararTransicao(): void { transicao = null; exibido = null; }
  function iniciarTransicao(de: EstadoDeClima, m: MapaAtlas): void {
    transicao = { de, alvo: estadoDoDoc(m), inicio: performance.now() };
    exibido = misturar(de, transicao.alvo, 0);
  }
  function passoDaTransicao(agora: number): void {
    if (!transicao) return;
    const t = Math.min(1, (agora - transicao.inicio) / DURACAO_DA_TRANSICAO), m = doc();
    if (t >= 1) { pararTransicao(); cena.atualizarAtmosfera(m); aplicarAcabamento(); return; }
    exibido = misturar(transicao.de, transicao.alvo, suave(t));
    cena.atualizarAtmosfera(visaoDoClima(m)); aplicarAcabamento();
  }

  function desenharBase(m: MapaAtlas): void {
    app.renderer.background.color = hexParaNumero(m.backdrop.color);
    area_.clear().rect(0, 0, m.bounds.width, m.bounds.height).fill({ color: 0xffffff, alpha: 0.03 }).stroke({ width: px(1.5), color: 0xffffff, alpha: 0.14 });
  }

  function desenharGrade(): void {
    const m = doc(); grade.clear();
    if (!m.grid.visible) return;
    const l = linhasDaGrade(camera, tela(), m.grid, m.bounds);
    const traco = (xs: number[], vertical: boolean, alpha: number) => {
      for (const v of xs) vertical ? grade.moveTo(v, 0).lineTo(v, m.bounds.height) : grade.moveTo(0, v).lineTo(m.bounds.width, v);
      grade.stroke({ width: px(1), color: 0xffffff, alpha });
    };
    const maior = (v: number, o: number) => Math.abs(Math.round((v - o) / (m.grid.size * l.passo * 5)) * (m.grid.size * l.passo * 5) - (v - o)) < 1e-6;
    traco(l.verticais.filter(v => !maior(v, m.grid.offset[0])), true, 0.06); traco(l.horizontais.filter(v => !maior(v, m.grid.offset[1])), false, 0.06);
    traco(l.verticais.filter(v => maior(v, m.grid.offset[0])), true, 0.14); traco(l.horizontais.filter(v => maior(v, m.grid.offset[1])), false, 0.14);
  }

  function desenharSelecao(): void {
    const m = doc(), cor = acento(), alvos = ponte.selecao().filter(a => caixaDe(m, a));
    selecaoG.clear();
    const pad = px(5);
    for (const a of alvos) {
      if (a.colecao === 'rooms') {
        for (const lc of contornoDoComodo(m, decodificar(m.rooms[a.id]!.cells))) { selecaoG.moveTo(lc[0]!.a[0], lc[0]!.a[1]); for (const s of lc) selecaoG.lineTo(s.b[0], s.b[1]); selecaoG.closePath(); }
        selecaoG.stroke({ width: px(2.5), color: cor, alpha: 0.95 }); continue;
      }
      if (a.colecao === 'walls') { const p = m.walls[a.id]!; selecaoG.moveTo(p.path[0]![0], p.path[0]![1]); for (const q of p.path.slice(1)) selecaoG.lineTo(q[0], q[1]); selecaoG.stroke({ width: p.thickness + px(6), color: cor, alpha: 0.55, cap: 'round', join: 'round' }); continue; }
      const c = caixaDe(m, a)!;
      selecaoG.roundRect(c.x0 - pad, c.y0 - pad, c.x1 - c.x0 + 2 * pad, c.y1 - c.y0 + 2 * pad, px(3)).stroke({ width: px(2), color: cor });
    }
    const u = caixaDaSelecao(m, alvos.filter(a => a.colecao !== 'rooms' && a.colecao !== 'walls'));
    if (u && alvos.length > 1) {
      selecaoG.rect(u.x0 - pad * 2, u.y0 - pad * 2, u.x1 - u.x0 + 4 * pad, u.y1 - u.y0 + 4 * pad).stroke({ width: px(1), color: cor, alpha: 0.55 });
      for (const [x, y] of [[u.x0, u.y0], [u.x1, u.y0], [u.x0, u.y1], [u.x1, u.y1]] as const) selecaoG.rect(x - pad * 2 - px(3), y - pad * 2 - px(3), px(6), px(6)).fill(0xffffff).stroke({ width: px(1), color: cor });
    }
  }

  function desenharLaco(): void {
    laco.clear();
    const cor = acento(), m = doc();
    if (interacao?.tipo === 'retangulo' && interacao.moveu) {
      const { ini, atual } = interacao;
      laco.rect(Math.min(ini[0], atual[0]), Math.min(ini[1], atual[1]), Math.abs(ini[0] - atual[0]), Math.abs(ini[1] - atual[1])).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 });
    } else if (interacao?.tipo === 'laco' && interacao.pontos.length > 1) {
      laco.poly(interacao.pontos.flat()).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 });
    } else if (interacao?.tipo === 'cômodo' && interacao.retangulo) {
      const t = m.grid.size, cor2 = interacao.apagar ? 0xff6b6b : cor;
      for (const [x, y] of retanguloDeCelulas(m, interacao.ini, interacao.atual)) laco.rect(m.grid.offset[0] + x * t, m.grid.offset[1] + y * t, t, t);
      laco.fill({ color: cor2, alpha: 0.28 }).stroke({ width: px(1), color: cor2, alpha: 0.6 });
    } else if (interacao?.tipo === 'parede') {
      laco.moveTo(interacao.ini[0], interacao.ini[1]).lineTo(interacao.fim[0], interacao.fim[1]).stroke({ width: 0.2, color: cor, alpha: 0.75, cap: 'round' });
      for (const q of [interacao.ini, interacao.fim]) laco.circle(q[0], q[1], px(5)).fill(0xffffff).stroke({ width: px(1.5), color: cor });
    }
  }

  // ---------- Fantasma: uma prévia do que a ferramenta ativa vai pôr ----------
  let semente = Math.floor(Math.random() * 2 ** 30), fantasmaChave = '', fantasmaSprite: Sprite | null = null, fantasmaTextura: Texture | null = null;
  const novaSemente = () => { semente = Math.floor(Math.random() * 2 ** 30); };
  const sementeAtual = (): number => ponte.pincel().objeto.semente ?? semente;

  function limparFantasmaSprite(): void {
    fantasmaC.getChildByLabel('fantasma-objeto')?.destroy({ children: true });
    fantasmaSprite = null; fantasmaTextura?.destroy(true); fantasmaTextura = null; fantasmaChave = '';
  }

  function desenharFantasma(): void {
    fantasmaG.clear();
    const f = ponte.ferramenta(), m = doc(), cor = acento(), pincel = ponte.pincel(), receita = ACERVO.item(pincel.objeto.item);
    const comSprite = f === 'objeto' && receita?.tipo === 'piso';
    if (!comSprite && fantasmaSprite) limparFantasmaSprite();
    const objetoFantasma = fantasmaC.getChildByLabel('fantasma-objeto');
    if (!ponteiro || interacao || !['objeto', 'luz', 'peca', 'regiao', 'abertura', 'comodo', 'borracha', 'terreno', 'presenca', 'espalhar'].includes(f)) { if (objetoFantasma) objetoFantasma.visible = false; return; }
    const p: Ponto = [encaixar(ponteiro[0], m.grid, 0), encaixar(ponteiro[1], m.grid, 1)];
    if (f === 'comodo' || f === 'borracha') {
      const [x, y] = celulaDe(m, ponteiro), t = m.grid.size, c = f === 'borracha' ? 0xff6b6b : cor;
      if (dentroDoMapa(m, [x, y])) fantasmaG.rect(m.grid.offset[0] + x * t, m.grid.offset[1] + y * t, t, t).fill({ color: c, alpha: 0.28 }).stroke({ width: px(1.5), color: c, alpha: 0.9 });
      return;
    }
    if (f === 'espalhar') { fantasmaG.circle(ponteiro[0], ponteiro[1], pincel.espalhar.raio).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 }); return; }
    if (f === 'presenca') { const cp = hexParaNumero(pincelDePresenca(pincel.presenca.brush)?.cor ?? '#ffffff'); fantasmaG.circle(ponteiro[0], ponteiro[1], pincel.presenca.raio).fill({ color: cp, alpha: 0.2 }).stroke({ width: px(1.5), color: cp, alpha: 0.9 }); return; }
    if (f === 'terreno') { fantasmaG.circle(ponteiro[0], ponteiro[1], pincel.terreno.raio).fill({ color: 0x6a9a4a, alpha: 0.18 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 }); return; }
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
      const l = LARGURA_DA_ABERTURA[pincel.abertura.tipo], e = encaixarNaParede(m, ponteiro, l);
      if (e) { const c = e.at * comprimentoDaParede(e.parede), a = pontoNaParede(e.parede, c - l / 2).ponto, b = pontoNaParede(e.parede, c + l / 2).ponto; fantasmaG.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: e.parede.thickness + 0.12, color: cor, alpha: 0.85, cap: 'butt' }); }
      return;
    }
    if (!receita) return;
    if (receita.tipo === 'parede') {
      const l = typeof pincel.objeto.params.largura === 'number' ? pincel.objeto.params.largura : receita.pegada[0], e = encaixarObjetoDeParede(m, ponteiro, l);
      if (e) { const c = e.at * comprimentoDaParede(e.parede), a = pontoNaParede(e.parede, Math.max(0, c - l / 2)).ponto, b = pontoNaParede(e.parede, Math.min(comprimentoDaParede(e.parede), c + l / 2)).ponto; fantasmaG.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: e.parede.thickness + 0.14, color: 0xd9a75e, alpha: 0.9, cap: 'butt' }); }
      return;
    }
    // Objeto de piso: o desenho de verdade, pela mesma fila de pintura dos objetos postos.
    const falso = { id: 'f', source: ACERVO.fonte(receita.id, sementeAtual(), pincel.objeto.params), position: p, rotation: 0, scale: 1, elevation: 'floor' as const, wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true };
    const chave = chaveDoObjeto(falso, RES_OBJETO, m.style.genre), pedido = pedidoDoObjeto(falso, RES_OBJETO, m.style.genre);
    if (chave && pedido && chave !== fantasmaChave) {
      fantasmaChave = chave;
      baker.pedir(chave, pedido).then(r => {
        if (destruido || fantasmaChave !== chave) return;
        limparFantasmaSprite(); fantasmaChave = chave;
        fantasmaTextura = Texture.from(r.bitmap); fantasmaSprite = new Sprite(fantasmaTextura); fantasmaSprite.alpha = 0.7; fantasmaSprite.position.set(r.origem[0], r.origem[1]); fantasmaSprite.scale.set(1 / r.res);
        const c = new Container(); c.label = 'fantasma-objeto'; c.addChild(fantasmaSprite); fantasmaC.addChild(c); camadaSuja = true;
      }).catch(() => { /* a prévia é só um enfeite */ });
    }
    const c = fantasmaC.getChildByLabel('fantasma-objeto');
    if (c && fantasmaSprite) { c.visible = true; c.position.set(p[0], p[1]); c.rotation = pincel.objeto.rotacao; }
    const [w, h] = receita.pegada;
    fantasmaG.roundRect(p[0] - w / 2, p[1] - h / 2, w, h, 0.05).stroke({ width: px(1.2), color: cor, alpha: fantasmaSprite ? 0.35 : 0.9 });
  }

  function aplicarCamera(): void { mundo.position.set(camera.x, camera.y); mundo.scale.set(camera.zoom); camadaSuja = true; ponte.aoCamera?.(camera); }
  function definirCamera(c: Camera): void { camera = c; aplicarCamera(); }

  function redesenharTudo(): void {
    const m = doc();
    pararTransicao(); vistoDoDoc = estadoDoDoc(m);
    desenharBase(m); desenharGrade(); desenharSelecao(); desenharLaco(); desenharFantasma(); aplicarAcabamento();
    cena.sincronizar(m, null, false);
  }

  function aoEvento(e: EventoStore): void {
    if (destruido) return;
    if (e.mudancas.completo) { redesenharTudo(); if (e.tipo === 'substituir') enquadrarMapa(); return; }
    const mud = e.mudancas;
    if (mud.campos.some(c => ['backdrop', 'bounds', 'grid'].includes(c))) desenharBase(e.documento);
    if (mud.campos.includes('climate') || mud.campos.includes('finish')) {
      // Só troca de clima (ou desfazer e refazer) anima; arrastar um controle fino do inspetor acompanha na hora.
      const antes = estadoExibido(), trocou = antes.climate.preset !== e.documento.climate.preset || e.tipo === 'desfazer' || e.tipo === 'refazer';
      if (trocou && ponte.acabamento() && fxAtivo()) iniciarTransicao(antes, e.documento); else pararTransicao();
    }
    if (mud.campos.includes('finish')) aplicarAcabamento();
    cena.sincronizar(e.documento, mud, e.tipo === 'executar' || e.tipo === 'refazer', visaoDoClima(e.documento));
    if (transicao) aplicarAcabamento();
    vistoDoDoc = estadoDoDoc(e.documento);
    camadaSuja = true;
  }
  const cancelarAssinatura = store.assinar(aoEvento);

  // ---------- Câmera ----------
  function enquadrarMapa(): void { const m = doc(); definirCamera(calcularEnquadre({ x: 0, y: 0, largura: m.bounds.width, altura: m.bounds.height }, tela(), 56)); }
  function focarEm(c: Caixa): void { definirCamera(calcularEnquadre({ x: c.x0, y: c.y0, largura: Math.max(c.x1 - c.x0, 3), altura: Math.max(c.y1 - c.y0, 3) }, tela(), 120)); }
  function zoomPor(fator: number): void { definirCamera(zoomEm(camera, [app.screen.width / 2, app.screen.height / 2], fator)); }

  // ---------- Entrada ----------
  const canvas = app.canvas;
  const retangulo = () => canvas.getBoundingClientRect();
  const telaDe = (e: { clientX: number; clientY: number }): Ponto => { const r = retangulo(); return [e.clientX - r.left, e.clientY - r.top]; };
  const mundoDe = (e: { clientX: number; clientY: number }): Ponto => telaParaMundo(camera, telaDe(e));
  const posicaoDe = (m: MapaAtlas, a: Alvo): Ponto => a.colecao === 'regions' ? m.regions[a.id]!.polygon[0]! : (m[a.colecao as ColecaoLivre] as Record<string, { position: Ponto }>)[a.id]!.position;
  const cursor = () => {
    const f = ponte.ferramenta();
    canvas.style.cursor = interacao?.tipo === 'pan' ? 'grabbing' : (f === 'mao' || espaco) ? 'grab' : f === 'selecionar' ? (interacao?.tipo === 'mover' || interacao?.tipo === 'deslizar' ? 'move' : 'default') : 'crosshair';
  };
  const tentar = (fazer: () => void): boolean => { try { fazer(); return true; } catch (erro) { ponte.aviso(erro instanceof Error ? erro.message.replace(/^O comando deixaria o mapa inválido — /, '') : String(erro)); return false; } };

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    definirCamera(zoomEm(camera, telaDe(e), Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015))));
  }, { passive: false });

  // Pincelada de cômodo ou de borracha.
  function comecarComodo(e: PointerEvent, p: Ponto, apagar: boolean): void {
    const m = doc(), c = celulaDe(m, p); if (!dentroDoMapa(m, c)) return;
    const existente = apagar ? null : salaDaCelula(indiceDeCelulas(m), c[0], c[1]), tipo = tipoDeComodo(ponte.pincel().comodo) ?? tipoDeComodo('sala')!;
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
    const m = doc(), tipo = tipoDeComodo(ponte.pincel().comodo) ?? tipoDeComodo('sala')!;
    const ok = tentar(() => {
      if (i.apagar) i.gesto.aplicar({ tipo: 'comodo.apagar', celulas: novas });
      else if (!i.criado) {
        const mesmos = Object.values(m.rooms).filter(s => s.function === tipo.funcao).length;
        i.gesto.aplicar({ tipo: 'comodo.criar', id: i.sala, nome: mesmos ? `${tipo.nome} ${mesmos + 1}` : tipo.nome, funcao: tipo.funcao, piso: { material: tipo.piso, seed: Math.floor(Math.random() * 1e6) }, papel: { material: tipo.papel, seed: Math.floor(Math.random() * 1e6) }, celulas: novas });
        i.criado = true;
      } else i.gesto.aplicar({ tipo: 'comodo.pintar', id: i.sala, celulas: novas });
    });
    if (!ok) { i.gesto.cancelar(); interacao = null; }
  }

  /** Uma pincelada de espalhar: põe (ou, com Alt, tira) os objetos do conjunto no círculo, dentro do gesto. */
  function espalharAqui(p: Ponto): void {
    const i = interacao; if (i?.tipo !== 'espalhar') return;
    const pincel = ponte.pincel().espalhar, conjunto = conjuntoDeEspalhar(pincel.conjunto); if (!conjunto) return;
    const antes = i.gesto, base = store.documento;
    if (i.apagar) {
      const receitas = new Set(conjunto.itens.map(x => x.receita));
      for (const o of Object.values(base.props)) if (o.source.kind === 'recipe' && receitas.has(o.source.recipe) && Math.hypot(o.position[0] - p[0], o.position[1] - p[1]) <= pincel.raio) if (!tentar(() => antes.aplicar({ tipo: 'item.remover', colecao: 'props', id: o.id }))) { antes.cancelar(); interacao = null; return; }
      return;
    }
    const novos = espalhar(base, { centro: p, raio: pincel.raio, conjunto: pincel.conjunto, semente: i.semente++ });
    for (const item of novos) if (!tentar(() => antes.aplicar({ tipo: 'item.adicionar', colecao: 'props', item: item as never }))) { antes.cancelar(); interacao = null; return; }
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
    const comando = i.presenca ? (i.apagar ? { tipo: 'presenca.apagar' as const, brush: null, celulas } : { tipo: 'presenca.pintar' as const, brush: pincel.presenca.brush, celulas })
      : i.apagar ? { tipo: 'terreno.apagar' as const, celulas } : { tipo: 'terreno.pintar' as const, material: pincel.terreno.material, celulas };
    if (!tentar(() => i.gesto.aplicar(comando))) { i.gesto.cancelar(); interacao = null; }
  }

  /** O ponto encaixado nos vértices da grade e, se `ini` existe, preso ao eixo mais próximo: paredes são retas na grade. */
  function pontoDeParede(m: MapaAtlas, p: Ponto, ini?: Ponto): Ponto {
    const q: Ponto = [encaixar(p[0], m.grid, 0, 1), encaixar(p[1], m.grid, 1, 1)];
    if (!ini) return q;
    return Math.abs(q[0] - ini[0]) >= Math.abs(q[1] - ini[1]) ? [q[0], ini[1]] : [ini[0], q[1]];
  }

  function colocar(e: PointerEvent, p: Ponto): void {
    const m = doc(), f = ponte.ferramenta(), pincel = ponte.pincel();
    const alvo: Ponto = [encaixar(p[0], m.grid, 0, 0.5, e.altKey), encaixar(p[1], m.grid, 1, 0.5, e.altKey)];
    if (f === 'comodo' || f === 'borracha') { comecarComodo(e, p, f === 'borracha'); return; }
    if (f === 'espalhar') {
      interacao = { tipo: 'espalhar', apagar: e.altKey, gesto: store.iniciarGesto(e.altKey ? 'Apagar espalhados' : 'Espalhar'), ultimo: p, semente: Math.floor(Math.random() * 1e6) };
      espalharAqui(p); return;
    }
    if (f === 'terreno' || f === 'presenca') {
      const presenca = f === 'presenca', nome = presenca ? 'presença' : 'terreno';
      interacao = { tipo: 'terreno', presenca, apagar: e.altKey, gesto: store.iniciarGesto(e.altKey ? `Apagar ${nome}` : `Pintar ${nome}`), ultimo: p }; pintarTerreno(p, null); return;
    }
    if (f === 'parede') { const q = pontoDeParede(m, p); interacao = { tipo: 'parede', ini: q, fim: q }; return; }
    if (f === 'abertura') {
      const largura = LARGURA_DA_ABERTURA[pincel.abertura.tipo], enc = encaixarNaParede(m, p, largura);
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
        const l = typeof pincel.objeto.params.largura === 'number' ? pincel.objeto.params.largura : receita.pegada[0], enc = encaixarObjetoDeParede(m, p, l);
        if (!enc) { ponte.aviso('Objetos de parede vão na face de um cômodo: aproxime-se de uma parede por dentro.'); return; }
        const item = novoObjeto(enc.ponto, { source: fonte, elevation: 'wall', wall: { wallId: enc.parede.id, at: enc.at, face: 'inner' }, roomId: enc.roomId, blocks: { move: false, sight: false }, castsShadow: false });
        if (tentar(() => store.executar({ tipo: 'item.adicionar', colecao: 'props', item: item as never }, { rotulo: `Pôr ${receita.nome.toLowerCase()}` }))) { ponte.definirSelecao([{ colecao: 'props', id: item.id }]); ponte.aoColocar(receita.nome, enc.ponto); novaSemente(); }
        return;
      }
      const item = novoObjeto(alvo, { source: fonte, rotation: pincel.objeto.rotacao });
      if (tentar(() => store.executar({ tipo: 'item.adicionar', colecao: 'props', item: item as never }, { rotulo: `Pôr ${receita.nome.toLowerCase()}` }))) { ponte.definirSelecao([{ colecao: 'props', id: item.id }]); ponte.aoColocar(receita.nome, alvo); novaSemente(); }
      return;
    }
    if (f === 'luz') {
      const preset = presetDeLuz(pincel.luz.preset); if (!preset) return;
      const item = novaLuz(alvo, camposDoPreset(preset, pincel.luz.direcao));
      if (tentar(() => store.executar({ tipo: 'item.adicionar', colecao: 'lights', item: item as never }, { rotulo: `Pôr ${preset.nome.toLowerCase()}` }))) { ponte.definirSelecao([{ colecao: 'lights', id: item.id }]); ponte.aoColocar(preset.nome, alvo); }
      return;
    }
    const colecao = colecaoDaFerramenta(f);
    if (colecao) ponte.adicionar(colecao, alvo);
  }

  canvas.addEventListener('pointerdown', e => {
    if (interacao) return;
    canvas.setPointerCapture(e.pointerId);
    const [tx, ty] = telaDe(e), m = doc(), f = ponte.ferramenta();
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (f === 'mao' || espaco))) { interacao = { tipo: 'pan', botao: e.button, x0: tx, y0: ty, camera0: camera, moveu: false }; cursor(); return; }
    if (e.button !== 0) return;
    const p = mundoDe(e);
    if (f !== 'selecionar') { colocar(e, p); cursor(); camadaSuja = true; return; }
    const hit = alvoEm(m, p, px(8)), sel = ponte.selecao();
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

  canvas.addEventListener('pointermove', e => {
    ponteiro = mundoDe(e);
    const [tx, ty] = telaDe(e), m = doc();
    if (!interacao) { camadaSuja = true; return; }
    const i = interacao;
    if (i.tipo === 'pan') {
      if (Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) i.moveu = true;
      if (i.moveu) definirCamera(panear({ ...i.camera0 }, tx - i.x0, ty - i.y0));
    } else if (i.tipo === 'mover') {
      if (!i.gesto) {
        if (Math.hypot(tx - i.x0, ty - i.y0) <= LIMIAR_ARRASTO || !i.alvos.length) return;
        i.gesto = store.iniciarGesto(i.alvos.length > 1 ? `Mover ${i.alvos.length} itens` : 'Mover');
        if (i.ctrl) {
          // Ctrl+arrastar: o que se arrasta é uma cópia; o original fica onde estava.
          const { comandos, alvos } = copiasDe(m, i.alvos, [0, 0]), gesto = i.gesto;
          if (!tentar(() => { for (const c of comandos) gesto.aplicar(c as never); })) { gesto.cancelar(); interacao = null; return; }
          i.alvos = alvos; ponte.definirSelecao(alvos);
        }
      }
      const d = deltaEncaixado(i.ref, [ponteiro[0] - i.origem[0], ponteiro[1] - i.origem[1]], doc().grid, 0.5, e.altKey), passo: Ponto = [d[0] - i.aplicado[0], d[1] - i.aplicado[1]];
      if (Math.abs(passo[0]) > 1e-9 || Math.abs(passo[1]) > 1e-9) { i.gesto.aplicar({ tipo: 'selecao.mover', alvos: i.alvos as never, delta: passo }); i.aplicado = d; }
    } else if (i.tipo === 'deslizar') {
      if (!i.gesto) { if (Math.hypot(tx - i.x0, ty - i.y0) <= LIMIAR_ARRASTO) return; i.gesto = store.iniciarGesto('Mover abertura'); }
      const a = m.openings[i.id]; if (!a) return;
      const enc = encaixarNaParede(m, ponteiro, a.width, 1.2);
      if (enc && (enc.parede.id !== a.wallId || Math.abs(enc.at - a.at) > 1e-6)) { try { i.gesto.aplicar({ tipo: 'abertura.atualizar', id: i.id, patch: { wallId: enc.parede.id, at: enc.at } }); } catch { /* ali não cabe: fica onde estava */ } }
    } else if (i.tipo === 'retangulo') {
      i.atual = ponteiro; if (Math.hypot(tx - i.x0, ty - i.y0) > LIMIAR_ARRASTO) i.moveu = true;
    } else if (i.tipo === 'laco') {
      const u = i.pontos.at(-1)!; if (Math.hypot(ponteiro[0] - u[0], ponteiro[1] - u[1]) > px(3)) i.pontos.push(ponteiro);
    } else if (i.tipo === 'cômodo') {
      const c = celulaDe(m, ponteiro);
      if (i.retangulo) i.atual = c; else { pintarCelulas(celulasEntre(i.atual, c).filter(x => dentroDoMapa(m, x))); i.atual = c; }
    } else if (i.tipo === 'terreno') { const antes = i.ultimo; i.ultimo = ponteiro; pintarTerreno(ponteiro, antes); }
    else if (i.tipo === 'espalhar') { if (Math.hypot(ponteiro[0] - i.ultimo[0], ponteiro[1] - i.ultimo[1]) >= ponte.pincel().espalhar.raio / 2) { i.ultimo = ponteiro; espalharAqui(ponteiro); } }
    else if (i.tipo === 'parede') i.fim = pontoDeParede(m, ponteiro, i.ini);
    camadaSuja = true;
  });

  /** Ctrl+clique num item: o pincel passa a ser como ele (receita, luz, tipo de cômodo, abertura). */
  function pipeta(a: Alvo): void {
    const m = doc();
    if (a.colecao === 'props') {
      const o = m.props[a.id]; if (!o) return;
      const id = ACERVO.idDaFonte(o.source); if (!ACERVO.item(id)) return;
      ponte.definirPincel({ objeto: { item: id, params: o.source.kind === 'recipe' ? structuredClone(o.source.params) : {}, semente: o.source.kind === 'recipe' ? o.source.seed : null, rotacao: o.rotation } }); ponte.definirFerramenta('objeto'); ponte.aviso(`Pincel: ${ACERVO.item(id)?.nome ?? id}`);
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
    const i = interacao; if (!i) return;
    interacao = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    const m = doc(), sel = ponte.selecao();
    if (i.tipo === 'pan') {
      if (!i.moveu && i.botao === 2 && !cancelado) { const p = mundoDe(e); ponte.aoMenuContexto({ tela: [e.clientX, e.clientY], mundo: p, alvo: alvoEm(m, p, px(8)) }); }
    } else if (i.tipo === 'mover') {
      if (i.gesto) { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); }
      else if (!cancelado && i.ctrl) pipeta(i.hit);
      else if (!cancelado && i.estavaNaSelecao && sel.length > 1) ponte.definirSelecao([i.hit]);
    } else if (i.tipo === 'deslizar') { if (i.gesto) { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); } }
    else if (i.tipo === 'retangulo') {
      if (cancelado) { /* nada */ } else if (!i.moveu) { if (i.modo === 'trocar' && sel.length) ponte.definirSelecao([]); }
      else ponte.definirSelecao(combinarSelecao(sel, alvosNaCaixa(m, { x0: i.ini[0], y0: i.ini[1], x1: i.atual[0], y1: i.atual[1] }), i.modo));
    } else if (i.tipo === 'laco' && !cancelado) ponte.definirSelecao(combinarSelecao(sel, alvosNoLaco(m, i.pontos), i.modo));
    else if (i.tipo === 'cômodo') {
      if (cancelado) i.gesto.cancelar();
      else { if (i.retangulo) { interacao = i; pintarCelulas(retanguloDeCelulas(m, i.ini, i.atual)); interacao = null; } if (i.gesto.ativo) i.gesto.concluir(); }
      if (!cancelado && !i.apagar) { const sala = doc().rooms[i.sala]; if (sala) { ponte.definirSelecao([{ colecao: 'rooms', id: i.sala }]); const c = caixaDe(doc(), { colecao: 'rooms', id: i.sala }); if (c) ponte.aoColocar(sala.name, [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]); } }
    } else if (i.tipo === 'terreno' || i.tipo === 'espalhar') { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); }
    else if (i.tipo === 'parede' && !cancelado) {
      if (Math.hypot(i.fim[0] - i.ini[0], i.fim[1] - i.ini[1]) >= 0.25) {
        const tipo = ponte.pincel().parede.tipo, id = novoIdEntidade('w');
        if (tentar(() => store.executar({ tipo: 'parede.adicionar', parede: { id, path: [i.ini, i.fim], height: tipo === 'wall' ? 2.6 : 1.1, thickness: tipo === 'wall' ? 0.2 : 0.14, material: 'parede.topo', kind: tipo, blocks: { move: true, sight: tipo === 'wall', light: tipo === 'wall' } } }, { rotulo: 'Desenhar parede' }))) { ponte.definirSelecao([{ colecao: 'walls', id }]); ponte.aoColocar('Parede', i.fim); }
      }
    }
    camadaSuja = true; cursor();
  }
  canvas.addEventListener('pointerup', e => terminar(e, false));
  canvas.addEventListener('pointercancel', e => terminar(e, true));
  canvas.addEventListener('pointerleave', () => { ponteiro = null; camadaSuja = true; });

  const aoTeclar = (e: KeyboardEvent) => {
    const emCampo = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === ' ' && !emCampo) { if (!e.repeat) { espaco = true; cursor(); } e.preventDefault(); return; }
    // Esc durante um arrasto ou uma pincelada cancela só isso, antes de qualquer outro atalho.
    if (e.key === 'Escape' && interacao) {
      e.stopImmediatePropagation();
      const i = interacao; interacao = null;
      if ((i.tipo === 'mover' || i.tipo === 'deslizar') && i.gesto) i.gesto.cancelar();
      else if (i.tipo === 'cômodo' || i.tipo === 'terreno' || i.tipo === 'espalhar') i.gesto.cancelar();
      camadaSuja = true; cursor();
    }
  };
  const aoSoltar = (e: KeyboardEvent) => { if (e.key === ' ') { espaco = false; cursor(); } };
  window.addEventListener('keydown', aoTeclar, true);
  window.addEventListener('keyup', aoSoltar);

  // ---------- Laço do desenho ----------
  const aoQuadro = () => {
    cena.quadro(performance.now()); fantasmaDaProposta.quadro(performance.now());
    if (transicao) passoDaTransicao(performance.now());
    else if (doc().finish.grain > 0 && cena.raiz.filters?.length) acabamento.aplicar(doc().finish, performance.now() / 1000);
    if (!camadaSuja) return;
    camadaSuja = false;
    desenharGrade(); desenharSelecao(); desenharLaco(); desenharFantasma(); cursor();
  };
  app.ticker.add(aoQuadro);
  const observador = new ResizeObserver(() => { camadaSuja = true; });
  observador.observe(host);

  redesenharTudo();
  enquadrarMapa();

  return {
    get camera() { return camera; },
    get tela() { return tela(); },
    get pintando() { return cena.pintando; },
    ponteiro: () => ponteiro,
    centro: () => telaParaMundo(camera, [app.screen.width / 2, app.screen.height / 2]),
    enquadrar: enquadrarMapa, focarEm, zoomPor,
    clientDe: m => { const r = retangulo(), [x, y] = mundoParaTela(camera, m); return [r.left + x, r.top + y]; },
    redesenhar: () => { redesenharTudo(); },
    atualizarSobreposicoes: () => { camadaSuja = true; aplicarAcabamento(); },
    relampagoAgora: () => cena.relampagoAgora(),
    contagemDeParticulas: () => cena.contagemDeParticulas(),
    contagemDePresencas: () => cena.contagemDePresencas(),
    objetosPintados: () => cena.objetosPintados(),
    mostrarProposta: previa => { fantasmaDaProposta.mostrar(doc(), previa); camadaSuja = true; },
    contagemDoFantasma: () => fantasmaDaProposta.contagem(),
    destruir() {
      destruido = true; cancelarAssinatura(); observador.disconnect();
      window.removeEventListener('keydown', aoTeclar, true); window.removeEventListener('keyup', aoSoltar);
      app.ticker.remove(aoQuadro); limparFantasmaSprite(); fantasmaDaProposta.destruir(); cena.destruir(); baker.encerrar(); app.destroy(true, { children: true });
    },
  };
}
