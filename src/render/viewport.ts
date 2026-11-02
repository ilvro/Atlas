import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Luz, MapaAtlas, Objeto, Peca, Ponto, Regiao } from '../domain/mapa.ts';
import { fxAtivo } from '../fx/fx.ts';
import type { EventoStore, Gesto, Store } from '../state/store.ts';
import type { ColecaoLivre } from '../state/comandos.ts';
import { enquadrar as calcularEnquadre, mundoParaTela, panear, telaParaMundo, zoomEm, type Camera, type Tela } from './camera.ts';
import { corDoNome, hexParaNumero } from './cores.ts';
import { deltaEncaixado, encaixar, linhasDaGrade } from './grade.ts';
import { alvoEm, alvosNaCaixa, alvosNoLaco, caixaDaSelecao, caixaDe, combinarSelecao, mesmoAlvo, type Alvo, type Caixa } from './selecao.ts';

export type Ferramenta = 'selecionar' | 'mao' | 'luz' | 'objeto' | 'peca' | 'regiao';
export const FERRAMENTAS_DE_ADICIONAR: readonly Ferramenta[] = ['luz', 'objeto', 'peca', 'regiao'];
export const colecaoDaFerramenta = (f: Ferramenta): ColecaoLivre | null => ({ luz: 'lights', objeto: 'props', peca: 'tokens', regiao: 'regions' } as Partial<Record<Ferramenta, ColecaoLivre>>)[f] ?? null;

/** O que o viewport precisa do resto do aplicativo. Ele não conhece Preact nem signals. */
export interface PonteViewport {
  store: Store;
  selecao(): readonly Alvo[];
  definirSelecao(alvos: Alvo[]): void;
  ferramenta(): Ferramenta;
  definirFerramenta(f: Ferramenta): void;
  /** Clique com uma ferramenta de adicionar: o aplicativo cria a entidade (com som, efeito e seleção). */
  adicionar(colecao: ColecaoLivre, mundo: Ponto): void;
  aoMenuContexto(info: { tela: Ponto; mundo: Ponto; alvo: Alvo | null }): void;
  aoCamera?(c: Camera): void;
}

export interface Viewport {
  readonly camera: Camera;
  readonly tela: Tela;
  ponteiro(): Ponto | null;
  centro(): Ponto;
  enquadrar(): void;
  focarEm(caixa: Caixa): void;
  zoomPor(fator: number): void;
  /** Posição na tela do navegador (px de `client`) de um ponto do mundo, para ancorar efeitos DOM. */
  clientDe(mundo: Ponto): Ponto;
  /** Refaz tudo (mudou o tema, por exemplo). */
  redesenhar(): void;
  /** Só a seleção, o fantasma e a grade: a seleção ou a ferramenta mudaram fora do viewport. */
  atualizarSobreposicoes(): void;
  destruir(): void;
}

const LIMIAR_ARRASTO = 4;
const COR_PADRAO_ACENTO = 0xe91d25;

type Interacao =
  | { tipo: 'pan'; botao: number; x0: number; y0: number; camera0: Camera; moveu: boolean }
  | { tipo: 'mover'; hit: Alvo; alvos: Alvo[]; origem: Ponto; ref: Ponto; aplicado: Ponto; gesto: Gesto | null; x0: number; y0: number; somar: boolean; estavaNaSelecao: boolean }
  | { tipo: 'retangulo'; ini: Ponto; atual: Ponto; modo: 'trocar' | 'somar'; x0: number; y0: number; moveu: boolean }
  | { tipo: 'laco'; pontos: Ponto[]; modo: 'trocar' | 'somar' };

export async function criarViewport(host: HTMLElement, ponte: PonteViewport): Promise<Viewport> {
  const app = new Application();
  await app.init({ resizeTo: host, background: '#07080b', antialias: true, resolution: Math.min(globalThis.devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
  app.canvas.setAttribute('role', 'application');
  app.canvas.setAttribute('aria-label', 'Mapa. Clique para selecionar, arraste para mover, role para aproximar, botão direito para opções.');
  app.canvas.setAttribute('data-testid', 'mapa');
  host.appendChild(app.canvas);

  const store = ponte.store;
  const mundo = new Container(), area_ = new Graphics(), comodos = new Graphics(), grade = new Graphics(), paredes = new Graphics();
  const camadas: Record<ColecaoLivre, Container> = { regions: new Container(), presence: new Container(), props: new Container(), lights: new Container(), tokens: new Container() };
  const selecaoG = new Graphics(), fantasma = new Graphics(), laco = new Graphics();
  mundo.addChild(area_, comodos, grade, paredes, camadas.regions, camadas.props, camadas.lights, camadas.tokens, selecaoG, fantasma, laco);
  app.stage.addChild(mundo);

  let camera: Camera = { x: 0, y: 0, zoom: 20 };
  let ponteiro: Ponto | null = null, interacao: Interacao | null = null, espaco = false, camadaSuja = true, destruido = false;
  const entidades: Record<ColecaoLivre, Map<string, Container>> = { regions: new Map(), presence: new Map(), props: new Map(), lights: new Map(), tokens: new Map() };
  const animacoes: { alvo: Container; t0: number; dur: number }[] = [];
  const doc = (): MapaAtlas => store.documento;
  const tela = (): Tela => ({ largura: app.screen.width, altura: app.screen.height });
  const acento = (): number => { const v = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? hexParaNumero(v) : COR_PADRAO_ACENTO; };
  const px = (n: number) => n / camera.zoom;

  // ---------- Desenho das entidades (marcadores provisórios; a Fase 3 os troca pelos renderizadores de verdade) ----------
  function desenharObjeto(c: Container, o: Objeto): void {
    const g = (c.getChildByLabel('g') as Graphics | null) ?? c.addChild(Object.assign(new Graphics(), { label: 'g' })), s = 0.8 * o.scale, cor = corDoNome(o.source.kind === 'recipe' ? o.source.recipe : o.source.assetId, 0.35, 0.34);
    g.clear().roundRect(-s / 2, -s / 2, s, s, 0.12 * s).fill(cor).stroke({ width: 0.04, color: 0x000000, alpha: 0.65 });
    g.moveTo(-s * 0.22, 0).lineTo(s * 0.22, 0).stroke({ width: 0.03, color: 0xffffff, alpha: 0.25 });
    c.position.set(o.position[0], o.position[1]); c.rotation = o.rotation;
  }
  function desenharLuz(c: Container, l: Luz): void {
    const g = (c.getChildByLabel('g') as Graphics | null) ?? c.addChild(Object.assign(new Graphics(), { label: 'g' })), cor = hexParaNumero(l.color), apagada = !l.on;
    g.clear();
    const brilho = Math.min(l.radius, 3.2);
    for (const [k, a] of [[1, 0.05], [0.66, 0.07], [0.33, 0.1]] as const) g.circle(0, 0, brilho * k).fill({ color: cor, alpha: apagada ? a * 0.3 : a });
    if (l.cone) {
      const ang = l.cone.angle / 2, d = l.cone.direction, r = Math.min(l.radius, 4);
      g.moveTo(0, 0).arc(0, 0, r, d - ang, d + ang).lineTo(0, 0).fill({ color: cor, alpha: apagada ? 0.04 : 0.16 }).stroke({ width: 0.03, color: cor, alpha: 0.6 });
    }
    g.circle(0, 0, 0.2).fill(apagada ? 0x3a3a44 : cor).stroke({ width: 0.04, color: 0x000000, alpha: 0.7 });
    c.position.set(l.position[0], l.position[1]);
  }
  function desenharPeca(c: Container, t: Peca, m: MapaAtlas): void {
    const g = (c.getChildByLabel('g') as Graphics | null) ?? c.addChild(Object.assign(new Graphics(), { label: 'g' })), r = (t.size * m.grid.size * 0.9) / 2, cor = corDoNome(t.name, 0.5, 0.4);
    g.clear().circle(0, 0, r).fill(cor).stroke({ width: 0.07, color: acento(), alpha: 1 }).circle(0, 0, r * 0.82).stroke({ width: 0.02, color: 0xffffff, alpha: 0.35 });
    let rotulo = c.getChildByLabel('t') as Text | null;
    if (!rotulo) { rotulo = Object.assign(new Text({ text: '', style: { fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 64, fontWeight: '800', fill: 0xffffff } }), { label: 't' }); rotulo.anchor.set(0.5); c.addChild(rotulo); }
    rotulo.text = (t.name.trim()[0] ?? '?').toUpperCase(); rotulo.scale.set((r * 1.1) / 64);
    c.position.set(t.position[0], t.position[1]);
  }
  function desenharRegiao(c: Container, r: Regiao): void {
    const g = (c.getChildByLabel('g') as Graphics | null) ?? c.addChild(Object.assign(new Graphics(), { label: 'g' })), cor = r.gmOnly ? 0xd9a23b : 0x5aa9e6;
    g.clear().poly(r.polygon.flat()).fill({ color: cor, alpha: 0.1 }).stroke({ width: 0.04, color: cor, alpha: 0.7 });
  }
  function desenharEntidade(colecao: ColecaoLivre, c: Container, id: string, m: MapaAtlas): void {
    if (colecao === 'props') desenharObjeto(c, m.props[id]!);
    else if (colecao === 'lights') desenharLuz(c, m.lights[id]!);
    else if (colecao === 'tokens') desenharPeca(c, m.tokens[id]!, m);
    else if (colecao === 'regions') desenharRegiao(c, m.regions[id]!);
  }

  function sincronizarColecao(colecao: ColecaoLivre, m: MapaAtlas, ids: readonly string[] | null, comPop: boolean): void {
    const dados = m[colecao] as Record<string, unknown>, mapa = entidades[colecao];
    for (const id of ids ?? [...new Set([...mapa.keys(), ...Object.keys(dados)])]) {
      const existe = dados[id] !== undefined, c = mapa.get(id);
      if (!existe) { if (c) { c.destroy({ children: true }); mapa.delete(id); } continue; }
      if (colecao === 'presence') continue;
      const novo = c ?? new Container();
      if (!c) { novo.label = id; camadas[colecao].addChild(novo); mapa.set(id, novo); if (comPop && fxAtivo() && colecao !== 'regions') { novo.scale.set(0.6); animacoes.push({ alvo: novo, t0: performance.now(), dur: 180 }); } }
      desenharEntidade(colecao, novo, id, m);
    }
  }

  function desenharBase(m: MapaAtlas): void {
    const fundo = hexParaNumero(m.backdrop.color);
    app.renderer.background.color = fundo;
    area_.clear().rect(0, 0, m.bounds.width, m.bounds.height).fill({ color: 0xffffff, alpha: 0.035 }).stroke({ width: px(1.5), color: 0xffffff, alpha: 0.14 });
    comodos.clear();
    for (const sala of Object.values(m.rooms)) {
      const cor = corDoNome(sala.floor.material, 0.32, 0.26), t = m.grid.size;
      for (const [y, x0, n] of sala.cells) comodos.rect(x0 * t, y * t, n * t, t).fill(cor);
    }
    comodos.rect(0, 0, 0, 0).fill({ color: 0, alpha: 0 });
    paredes.clear();
    for (const p of Object.values(m.walls)) {
      paredes.moveTo(p.path[0]![0], p.path[0]![1]);
      for (const q of p.path.slice(1)) paredes.lineTo(q[0], q[1]);
      paredes.stroke({ width: p.thickness, color: 0x6b6780, alpha: 0.9, join: 'round', cap: 'round' });
    }
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
    traco(l.verticais.filter(v => !maior(v, m.grid.offset[0])), true, 0.07); traco(l.horizontais.filter(v => !maior(v, m.grid.offset[1])), false, 0.07);
    traco(l.verticais.filter(v => maior(v, m.grid.offset[0])), true, 0.15); traco(l.horizontais.filter(v => maior(v, m.grid.offset[1])), false, 0.15);
  }

  function desenharSelecao(): void {
    const m = doc(), cor = acento(), alvos = ponte.selecao().filter(a => caixaDe(m, a));
    selecaoG.clear();
    const pad = px(5);
    for (const a of alvos) {
      const c = caixaDe(m, a)!;
      selecaoG.roundRect(c.x0 - pad, c.y0 - pad, c.x1 - c.x0 + 2 * pad, c.y1 - c.y0 + 2 * pad, px(3)).stroke({ width: px(2), color: cor });
    }
    const u = caixaDaSelecao(m, alvos);
    if (u && alvos.length > 1) {
      selecaoG.rect(u.x0 - pad * 2, u.y0 - pad * 2, u.x1 - u.x0 + 4 * pad, u.y1 - u.y0 + 4 * pad).stroke({ width: px(1), color: cor, alpha: 0.55 });
      for (const [x, y] of [[u.x0, u.y0], [u.x1, u.y0], [u.x0, u.y1], [u.x1, u.y1]] as const) selecaoG.rect(x - pad * 2 - px(3), y - pad * 2 - px(3), px(6), px(6)).fill(0xffffff).stroke({ width: px(1), color: cor });
    }
  }

  function desenharLaco(): void {
    laco.clear();
    const cor = acento();
    if (interacao?.tipo === 'retangulo' && interacao.moveu) {
      const { ini, atual } = interacao;
      laco.rect(Math.min(ini[0], atual[0]), Math.min(ini[1], atual[1]), Math.abs(ini[0] - atual[0]), Math.abs(ini[1] - atual[1])).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 });
    } else if (interacao?.tipo === 'laco' && interacao.pontos.length > 1) {
      laco.poly(interacao.pontos.flat()).fill({ color: cor, alpha: 0.1 }).stroke({ width: px(1.5), color: cor, alpha: 0.9 });
    }
  }

  function desenharFantasma(): void {
    fantasma.clear();
    const f = ponte.ferramenta(), colecao = colecaoDaFerramenta(f);
    if (!colecao || !ponteiro || interacao) return;
    const m = doc(), p: Ponto = [encaixar(ponteiro[0], m.grid, 0), encaixar(ponteiro[1], m.grid, 1)], cor = acento();
    if (colecao === 'lights') fantasma.circle(p[0], p[1], 0.2).fill({ color: cor, alpha: 0.6 }).circle(p[0], p[1], 1.2).stroke({ width: px(1), color: cor, alpha: 0.5 });
    else if (colecao === 'tokens') fantasma.circle(p[0], p[1], m.grid.size * 0.45).fill({ color: cor, alpha: 0.35 }).stroke({ width: px(1.5), color: cor, alpha: 0.8 });
    else if (colecao === 'regions') fantasma.rect(p[0] - 1.5, p[1] - 1.5, 3, 3).fill({ color: cor, alpha: 0.12 }).stroke({ width: px(1.5), color: cor, alpha: 0.8 });
    else fantasma.roundRect(p[0] - 0.4, p[1] - 0.4, 0.8, 0.8, 0.1).fill({ color: cor, alpha: 0.35 }).stroke({ width: px(1.5), color: cor, alpha: 0.8 });
  }

  function aplicarCamera(): void { mundo.position.set(camera.x, camera.y); mundo.scale.set(camera.zoom); camadaSuja = true; ponte.aoCamera?.(camera); }
  function definirCamera(c: Camera): void { camera = c; aplicarCamera(); }

  function redesenharTudo(): void {
    const m = doc();
    desenharBase(m); desenharGrade(); desenharSelecao(); desenharLaco(); desenharFantasma();
    for (const colecao of Object.keys(camadas) as ColecaoLivre[]) sincronizarColecao(colecao, m, null, false);
  }

  function aoEvento(e: EventoStore): void {
    if (destruido) return;
    const m = e.documento;
    if (e.mudancas.completo) { redesenharTudo(); if (e.tipo === 'substituir') enquadrarMapa(); return; }
    const mudou = e.mudancas;
    if (mudou.campos.some(c => ['backdrop', 'bounds', 'grid'].includes(c)) || mudou.colecoes.rooms || mudou.colecoes.walls) { desenharBase(m); camadaSuja = true; }
    const pop = e.tipo === 'executar' || e.tipo === 'refazer';
    for (const colecao of Object.keys(camadas) as ColecaoLivre[]) { const ids = mudou.colecoes[colecao]; if (ids) sincronizarColecao(colecao, m, ids, pop); }
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
  const posicaoDe = (m: MapaAtlas, a: Alvo): Ponto => {
    if (a.colecao === 'regions') return m.regions[a.id]!.polygon[0]!;
    return (m[a.colecao] as Record<string, { position: Ponto }>)[a.id]!.position;
  };
  const cursor = () => {
    const f = ponte.ferramenta();
    canvas.style.cursor = interacao?.tipo === 'pan' ? 'grabbing' : (f === 'mao' || espaco) ? 'grab' : f === 'selecionar' ? (interacao?.tipo === 'mover' ? 'move' : 'default') : 'crosshair';
  };

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    definirCamera(zoomEm(camera, telaDe(e), Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015))));
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    if (interacao) return;
    canvas.setPointerCapture(e.pointerId);
    const [tx, ty] = telaDe(e), m = doc(), f = ponte.ferramenta();
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (f === 'mao' || espaco))) {
      interacao = { tipo: 'pan', botao: e.button, x0: tx, y0: ty, camera0: camera, moveu: false }; cursor(); return;
    }
    if (e.button !== 0) return;
    const p = mundoDe(e);
    const colecao = colecaoDaFerramenta(f);
    if (colecao) { ponte.adicionar(colecao, [encaixar(p[0], m.grid, 0, 0.5, e.altKey), encaixar(p[1], m.grid, 1, 0.5, e.altKey)]); return; }
    const hit = alvoEm(m, p, px(8)), sel = ponte.selecao();
    if (hit) {
      const naSelecao = sel.some(a => mesmoAlvo(a, hit));
      if (e.shiftKey) { ponte.definirSelecao(combinarSelecao(sel, [hit], 'alternar')); return; }
      const alvos = naSelecao ? [...sel] : [hit];
      if (!naSelecao) ponte.definirSelecao(alvos);
      interacao = { tipo: 'mover', hit, alvos, origem: p, ref: posicaoDe(m, hit), aplicado: [0, 0], gesto: null, x0: tx, y0: ty, somar: e.shiftKey, estavaNaSelecao: naSelecao };
      cursor(); return;
    }
    interacao = e.altKey
      ? { tipo: 'laco', pontos: [p], modo: e.shiftKey ? 'somar' : 'trocar' }
      : { tipo: 'retangulo', ini: p, atual: p, modo: e.shiftKey ? 'somar' : 'trocar', x0: tx, y0: ty, moveu: false };
  });

  canvas.addEventListener('pointermove', e => {
    ponteiro = mundoDe(e);
    const [tx, ty] = telaDe(e);
    if (!interacao) { camadaSuja = true; return; }
    if (interacao.tipo === 'pan') {
      if (Math.hypot(tx - interacao.x0, ty - interacao.y0) > LIMIAR_ARRASTO) interacao.moveu = true;
      if (interacao.moveu) definirCamera(panear({ ...interacao.camera0 }, tx - interacao.x0, ty - interacao.y0));
    } else if (interacao.tipo === 'mover') {
      const i = interacao;
      if (!i.gesto) {
        if (Math.hypot(tx - i.x0, ty - i.y0) <= LIMIAR_ARRASTO) return;
        i.gesto = store.iniciarGesto(i.alvos.length > 1 ? `Mover ${i.alvos.length} itens` : 'Mover');
      }
      const p = ponteiro, d = deltaEncaixado(i.ref, [p[0] - i.origem[0], p[1] - i.origem[1]], doc().grid, 0.5, e.altKey);
      const passo: Ponto = [d[0] - i.aplicado[0], d[1] - i.aplicado[1]];
      if (Math.abs(passo[0]) > 1e-9 || Math.abs(passo[1]) > 1e-9) { i.gesto.aplicar({ tipo: 'selecao.mover', alvos: i.alvos, delta: passo }); i.aplicado = d; }
    } else if (interacao.tipo === 'retangulo') {
      interacao.atual = ponteiro;
      if (Math.hypot(tx - interacao.x0, ty - interacao.y0) > LIMIAR_ARRASTO) interacao.moveu = true;
    } else if (interacao.tipo === 'laco') {
      const ultimo = interacao.pontos.at(-1)!;
      if (Math.hypot(ponteiro[0] - ultimo[0], ponteiro[1] - ultimo[1]) > px(3)) interacao.pontos.push(ponteiro);
    }
    camadaSuja = true;
  });

  function terminar(e: PointerEvent, cancelado: boolean): void {
    const i = interacao; if (!i) return;
    interacao = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    const m = doc(), sel = ponte.selecao();
    if (i.tipo === 'pan') {
      if (!i.moveu && i.botao === 2 && !cancelado) { const p = mundoDe(e); ponte.aoMenuContexto({ tela: [e.clientX, e.clientY], mundo: p, alvo: alvoEm(m, p, px(8)) }); }
    } else if (i.tipo === 'mover') {
      if (i.gesto) { if (cancelado) i.gesto.cancelar(); else i.gesto.concluir(); }
      else if (!cancelado && i.estavaNaSelecao && sel.length > 1) ponte.definirSelecao([i.hit]);
    } else if (i.tipo === 'retangulo') {
      if (cancelado) { /* nada */ }
      else if (!i.moveu) { if (i.modo === 'trocar' && sel.length) ponte.definirSelecao([]); }
      else ponte.definirSelecao(combinarSelecao(sel, alvosNaCaixa(m, { x0: i.ini[0], y0: i.ini[1], x1: i.atual[0], y1: i.atual[1] }), i.modo));
    } else if (i.tipo === 'laco' && !cancelado) {
      ponte.definirSelecao(combinarSelecao(sel, alvosNoLaco(m, i.pontos), i.modo));
    }
    camadaSuja = true; cursor();
  }
  canvas.addEventListener('pointerup', e => terminar(e, false));
  canvas.addEventListener('pointercancel', e => terminar(e, true));
  canvas.addEventListener('pointerleave', () => { ponteiro = null; camadaSuja = true; });

  const aoTeclar = (e: KeyboardEvent) => {
    const emCampo = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === ' ' && !emCampo) { if (!e.repeat) { espaco = true; cursor(); } e.preventDefault(); return; }
    // Esc durante um arrasto ou seleção em andamento cancela só isso, antes de qualquer outro atalho.
    if (e.key === 'Escape' && interacao) {
      e.stopImmediatePropagation();
      const i = interacao; interacao = null;
      if (i.tipo === 'mover' && i.gesto) i.gesto.cancelar();
      camadaSuja = true; cursor();
    }
  };
  const aoSoltar = (e: KeyboardEvent) => { if (e.key === ' ') { espaco = false; cursor(); } };
  window.addEventListener('keydown', aoTeclar, true);
  window.addEventListener('keyup', aoSoltar);

  // ---------- Laço do desenho ----------
  const aoQuadro = () => {
    const agora = performance.now();
    for (let i = animacoes.length - 1; i >= 0; i--) {
      const a = animacoes[i]!, t = Math.min(1, (agora - a.t0) / a.dur), e = 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;   // easeOutBack
      if (a.alvo.destroyed) { animacoes.splice(i, 1); continue; }
      a.alvo.scale.set(0.6 + 0.4 * e); if (t >= 1) { a.alvo.scale.set(1); animacoes.splice(i, 1); }
    }
    if (!camadaSuja) return;
    camadaSuja = false;
    desenharGrade(); desenharSelecao(); desenharLaco(); desenharFantasma(); cursor();
  };
  app.ticker.add(aoQuadro);

  // Seleção e ferramenta vivem fora do viewport: quem mudar avisa por `atualizarSobreposicoes()`.
  const observador = new ResizeObserver(() => { camadaSuja = true; });
  observador.observe(host);

  redesenharTudo();
  enquadrarMapa();

  return {
    get camera() { return camera; },
    get tela() { return tela(); },
    ponteiro: () => ponteiro,
    centro: () => telaParaMundo(camera, [app.screen.width / 2, app.screen.height / 2]),
    enquadrar: enquadrarMapa, focarEm, zoomPor,
    clientDe: m => { const r = retangulo(), [x, y] = mundoParaTela(camera, m); return [r.left + x, r.top + y]; },
    redesenhar: () => { redesenharTudo(); },
    atualizarSobreposicoes: () => { camadaSuja = true; },
    destruir() {
      destruido = true; cancelarAssinatura(); observador.disconnect();
      window.removeEventListener('keydown', aoTeclar, true); window.removeEventListener('keyup', aoSoltar);
      app.ticker.remove(aoQuadro); app.destroy(true, { children: true });
    },
  };
}
