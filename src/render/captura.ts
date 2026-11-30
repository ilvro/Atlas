import { Rectangle, type Application } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';
import { enquadrar as calcularEnquadre, mundoParaTela, type Camera, type Tela } from './camera.ts';
import type { Cena } from './cena.ts';
import type { Caixa } from './selecao.ts';

/** O resultado de `capturar`: a imagem e como ler coordenadas nela (a origem da caixa é o canto superior esquerdo da imagem). */
export interface Captura {
  dataUrl: string;
  largura: number;
  altura: number;
  pxPorMetro: number;
  caixa: Caixa;
  /** Tamanho do JPEG em bytes. */
  bytes: number;
  /** Qualidade JPEG usada (0 a 1). */
  qualidade: number;
  /** Aviso se a cena não acalmou a tempo. */
  aviso?: string;
}

export interface ContextoDeCaptura {
  app: Application;
  cena: Pick<Cena, 'forcarTelhados' | 'pintando' | 'descarregarPendencias'>;
  doc(): MapaAtlas;
  tela(): Tela;
  camera(): Camera;
  definirCamera(c: Camera): void;
  modoProjetor(): boolean;
  projetor(ligado: boolean): void;
  limparAnimacaoCamera(): void;
  pintandoSimulado(): number | null;
}

function esperarQuadro(): Promise<void> {
  return new Promise<void>(resolve => {
    let resolvido = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf: number | null = null;
    const concluir = () => {
      if (resolvido) return;
      resolvido = true;
      if (timer !== null) clearTimeout(timer);
      if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') {
      raf = requestAnimationFrame(concluir);
    }
    timer = setTimeout(concluir, 50);
  });
}

export async function capturarViewport(
  ctx: ContextoDeCaptura,
  opcoes: { caixa?: Caixa; ladoMaximo?: number; vista?: 'planta' | 'telhados' } = {},
): Promise<Captura> {
  const m = ctx.doc();
  const pedida = opcoes.caixa ?? { x0: 0, y0: 0, x1: m.bounds.width, y1: m.bounds.height };
  const caixa: Caixa = {
    x0: Math.max(0, Math.min(pedida.x0, pedida.x1)),
    y0: Math.max(0, Math.min(pedida.y0, pedida.y1)),
    x1: Math.min(m.bounds.width, Math.max(pedida.x0, pedida.x1)),
    y1: Math.min(m.bounds.height, Math.max(pedida.y0, pedida.y1)),
  };
  if (caixa.x1 - caixa.x0 < 0.5 || caixa.y1 - caixa.y0 < 0.5) {
    throw new Error('A caixa está fora do mapa ou é pequena demais.');
  }
  const ladoMaximo = Math.max(64, Math.round(opcoes.ladoMaximo ?? 1280));
  const vista = opcoes.vista ?? 'planta';
  const camera0 = ctx.camera();
  const modo0 = ctx.modoProjetor();
  try {
    ctx.limparAnimacaoCamera();
    ctx.projetor(true);
    if (vista === 'telhados') ctx.cena.forcarTelhados(1);
    ctx.definirCamera(calcularEnquadre({ x: caixa.x0, y: caixa.y0, largura: caixa.x1 - caixa.x0, altura: caixa.y1 - caixa.y0 }, ctx.tela(), 0));
    const limite = performance.now() + 8_000;
    let calmos = 0;
    let aviso: string | undefined;
    while (calmos < 3) {
      if (performance.now() >= limite) {
        aviso = 'a cena ainda estava pintando; a imagem pode estar incompleta';
        break;
      }
      await esperarQuadro();
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        ctx.app.ticker.update();
      }
      calmos = (ctx.pintandoSimulado() ?? ctx.cena.pintando) === 0 ? calmos + 1 : 0;
    }
    await new Promise<void>(r => setTimeout(r, 250));
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      ctx.app.ticker.update();
    }
    ctx.cena.descarregarPendencias();
    ctx.app.renderer.render(ctx.app.stage);
    const cam = ctx.camera();
    const [ax, ay] = mundoParaTela(cam, [caixa.x0, caixa.y0]);
    const [bx, by] = mundoParaTela(cam, [caixa.x1, caixa.y1]);
    const x = Math.max(0, Math.floor(ax));
    const y = Math.max(0, Math.floor(ay));
    const w = Math.max(1, Math.min(ctx.app.screen.width, Math.ceil(bx)) - x);
    const h = Math.max(1, Math.min(ctx.app.screen.height, Math.ceil(by)) - y);
    const resolucao = Math.min(2, ladoMaximo / Math.max(w, h));
    const tela_ = ctx.app.renderer.extract.canvas({
      target: ctx.app.stage,
      frame: new Rectangle(x, y, w, h),
      resolution: resolucao,
      clearColor: ctx.app.renderer.background.color,
    });
    // JPEG com teto de tamanho (o app do Claude recusa resultados grandes): baixa a qualidade e depois o lado.
    const LIMITE_BASE64 = 700_000;
    let fonte = tela_ as HTMLCanvasElement;
    let lado = Math.max(fonte.width, fonte.height);
    let dataUrl = '';
    let qualidade = 0.85;
    for (;;) {
      for (const q of [0.85, 0.75, 0.65]) {
        qualidade = q;
        dataUrl = fonte.toDataURL('image/jpeg', q);
        if (dataUrl.length - dataUrl.indexOf(',') - 1 <= LIMITE_BASE64) break;
      }
      if (dataUrl.length - dataUrl.indexOf(',') - 1 <= LIMITE_BASE64 || lado <= 512) break;
      lado = Math.max(512, Math.round(lado * 0.8));
      const f = lado / Math.max(fonte.width, fonte.height);
      const menor = document.createElement('canvas');
      menor.width = Math.max(1, Math.round(fonte.width * f));
      menor.height = Math.max(1, Math.round(fonte.height * f));
      const g = menor.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(fonte, 0, 0, menor.width, menor.height);
      fonte = menor;
    }
    const b64 = dataUrl.length - dataUrl.indexOf(',') - 1;
    const bytes = Math.floor(b64 * 3 / 4) - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0);
    const reducao = fonte.width / tela_.width;
    return {
      dataUrl,
      largura: fonte.width,
      altura: fonte.height,
      pxPorMetro: Math.round(cam.zoom * resolucao * reducao * 100) / 100,
      caixa,
      bytes,
      qualidade,
      ...(aviso ? { aviso } : {}),
    };
  } finally {
    if (vista === 'telhados') ctx.cena.forcarTelhados(null);
    ctx.projetor(modo0);
    ctx.definirCamera(camera0);
  }
}
