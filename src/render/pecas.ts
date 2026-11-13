import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { aparenciaDoEstado } from '../domain/figuras.ts';
import { emEstadoCritico, extrairNumeroDoToken, pipsCheios, temPd, type Recursos } from '../domain/fichas.ts';
import type { Peca, Ponto } from '../domain/mapa.ts';
import { corDoNome, hexParaNumero } from './cores.ts';
import { criarFiltroDeRespiracao, type ParametrosRespiracao } from './respiracao.ts';

/** Uma peça no mapa: retrato em círculo (ou a inicial), anel, e a cara do estado (deitada, acinzentada, pulsando, tremendo, com X). */
export interface PecaVisual {
  readonly c: Container;
  /** Refaz o desenho com os dados da peça; `tex` é o retrato (ou `null`). */
  atualizar(t: Peca, tamanhoDaCelula: number, acento: number, tex: Texture | null, animar?: boolean, sprite?: { folha: Texture | null; pixel: boolean }, recursos?: Recursos | null): void;
  /** Animação do pulso, do tremor, do deslize e da trilha; `ms` é o relógio. Parada com `efeitos` desligados. */
  quadro(ms: number, efeitos: boolean): void;
  /** É a vez desta peça na iniciativa? Ganha um anel pulsante por fora. */
  definirVez(vez: boolean): void;
  /** Para os testes e o diagnóstico. */
  estado(): { vez: boolean; retrato: boolean; deitada: boolean; raio: number; deslizando: boolean; trilha: number; /** O quadro do sprite agora (linha: baixo, esquerda, direita, cima), ou `null` sem sprite. */ quadro: { linha: number; coluna: number } | null; /** Os PV e PD que os pips mostram, ou `null`. */ pips: Recursos | null; /** O estado de aparência desta peça agora (pode ser "ferido" só na tela, por PV baixo). */ estadoVisto: string; tokenStyle?: string; portraitScale?: number };
}

const MS_POR_CELULA = 160, MS_MAXIMO = 600, MS_DA_TRILHA = 2000;
const [QW, QH] = [16, 24], LINHA_DO_LADO = { down: 0, left: 1, right: 2, up: 3 } as const;
/** O quadro parado alterna a 2 Hz; andando, 4 quadros a 8 Hz. */
const MS_PARADO = 500, MS_ANDANDO = 125;

export function criarPeca(): PecaVisual {
  const c = new Container(), trilha = new Graphics(), corpo = new Container(), anel = new Graphics(), marca = new Graphics(), vezG = new Graphics(), pips = new Graphics(), badge = new Container();
  c.addChild(trilha, vezG, corpo, anel, marca, pips, badge);
  // Os pips de PV (vermelho) e PD (azul): piscam por um instante quando o valor cai.
  let ultimoRecursos: Recursos | null = null, piscaAte = 0;
  let vez = false;
  let desliza: { de: Ponto; para: Ponto; t0: number; dur: number } | null = null, rastro: { de: Ponto; para: Ponto; t0: number }[] = [], alvo: Ponto | null = null, cor0 = 0xffffff, grade0 = 1;
  let pulso = 0, tremor = 0, raio = 0.5, tem = false, deitada = false, semente = Math.random() * 100;
  let estiloToken: 'coin' | 'immersive' = 'coin', escalaVisual = 1, rBase = 0.5, eImersivo = false;
  let respiracao: ReturnType<typeof criarFiltroDeRespiracao> | null = null;
  let retratoImersivo: Sprite | null = null;
  let paramsRespiracao: ParametrosRespiracao = { period: 4.2, amp: 1, tremor: 0 };
  // O sprite: a folha (96 × 96) fatiada em quadros, o sprite que mostra o quadro e a linha do lado para onde a peça olha.
  let estadoVisto = 'normal', pxDoSprite = 1, tintaNum = 0xffffff, folhaAtual: Texture | null = null, quadros: Texture[][] = [], spriteRef: Sprite | null = null, ladoParado = 0, corrente: { linha: number; coluna: number } | null = null;
  const fatiar = (folha: Texture): Texture[][] => Array.from({ length: 4 }, (_, l) => Array.from({ length: 6 }, (_, k) => new Texture({ source: folha.source, frame: new Rectangle(k * QW, l * QH, QW, QH) })));

  return {
    c,
    atualizar(t, grade, acento, tex, animar = false, comSprite = { folha: null, pixel: false }, recursos = null) {
      estadoVisto = t.figure.state;
      estiloToken = t.tokenStyle ?? 'coin';
      escalaVisual = typeof t.portraitScale === 'number' && Number.isFinite(t.portraitScale) ? Math.max(0.5, Math.min(3, t.portraitScale)) : 1;
      rBase = (t.size * grade * 0.88) / 2;
      const r = rBase * escalaVisual;
      const ap = aparenciaDoEstado(t.figure.state);
      raio = r; deitada = ap.deitado; pulso = ap.pulso; tremor = ap.tremor;
      if (retratoImersivo) { retratoImersivo.filters = []; retratoImersivo = null; }
      for (const f of corpo.removeChildren()) f.destroy({ children: true });
      for (const f of badge.removeChildren()) f.destroy({ children: true });
      const tinta = ap.tinta ? hexParaNumero(ap.tinta) : 0xffffff;
      // O Pixel usa o sprite quando há; o Ilustrado só quando a peça não tem retrato.
      const folha = comSprite.folha, usaSprite = !!folha && !!t.sprite && (comSprite.pixel || !tex);
      if (folha !== folhaAtual) { for (const q of quadros.flat()) q.destroy(false); quadros = folha ? fatiar(folha) : []; folhaAtual = folha; }
      spriteRef = null; ladoParado = LINHA_DO_LADO[t.facing]; corrente = null;
      tem = !!tex && !usaSprite;
      eImersivo = estiloToken === 'immersive' && (!!tex || usaSprite);

      if (eImersivo) {
        const fundo = new Graphics().ellipse(0, rBase * 0.65, rBase * 0.85, rBase * 0.32).fill({ color: 0x000000, alpha: 0.45 });
        corpo.addChild(fundo);
      } else {
        const fundo = new Graphics().circle(0, 0, r).fill(ap.tinta ? tingir(corDoNome(t.name, 0.5, 0.4), tinta) : corDoNome(t.name, 0.5, 0.4));
        if (!usaSprite) corpo.addChild(fundo);
      }

      if (usaSprite) {
        if (eImersivo) {
          const escala = ((grade * t.size) / QW) * escalaVisual;
          const sp = new Sprite(quadros[ladoParado]![0]);
          sp.anchor.set(ap.deitado ? 0.5 : 0.5, ap.deitado ? 0.6 : 0.72);
          sp.position.set(0, rBase * 0.65);
          sp.scale.set(escala);
          sp.tint = tinta;
          spriteRef = sp;
          corrente = { linha: ladoParado, coluna: 0 };
          pxDoSprite = escala;
          tintaNum = tinta;
          corpo.addChild(sp);
          const marcas = new Graphics(), ox = ap.deitado ? 8 : 8, oy = ap.deitado ? 14.4 : 20.64;
          const pxl = (x: number, y: number, cor: number) => marcas.rect(x - ox, y - oy, 1, 1).fill(cor);
          if (t.figure.state === 'hurt' || t.figure.state === 'dying') { pxl(6, 13, 0xe0342c); pxl(9, 15, 0xe0342c); }
          if (ap.marca === 'x') for (const [x, y] of [[7, 12], [9, 12], [8, 13], [7, 14], [9, 14]] as const) pxl(x, y, 0x7a1010);
          sp.addChild(marcas);
        } else {
          const escala = (grade * t.size) / QW, sombra = new Graphics().ellipse(0, 0.21 * grade * t.size, 0.34 * grade * t.size, 0.14 * grade * t.size).fill({ color: 0x000000, alpha: 0.4 });
          const sp = new Sprite(quadros[ladoParado]![0]); sp.anchor.set(ap.deitado ? 0.5 : 0.5, ap.deitado ? 0.6 : 0.86); sp.scale.set(escala); sp.tint = tinta; spriteRef = sp; corrente = { linha: ladoParado, coluna: 0 };
          pxDoSprite = escala; tintaNum = tinta;
          // Deitada (inconsciente ou morta): o quadro parado girado, sem a sombra. Ferida: 2 pixels vermelhos no tronco. Morta: um X de 3 px.
          if (!ap.deitado) corpo.addChild(sombra);
          corpo.addChild(sp);
          const marcas = new Graphics(), ox = ap.deitado ? 8 : 8, oy = ap.deitado ? 14.4 : 20.64;
          const pxl = (x: number, y: number, cor: number) => marcas.rect(x - ox, y - oy, 1, 1).fill(cor);
          if (t.figure.state === 'hurt' || t.figure.state === 'dying') { pxl(6, 13, 0xe0342c); pxl(9, 15, 0xe0342c); }
          if (ap.marca === 'x') for (const [x, y] of [[7, 12], [9, 12], [8, 13], [7, 14], [9, 14]] as const) pxl(x, y, 0x7a1010);
          sp.addChild(marcas);
        }
      } else if (tex) {
        if (eImersivo) {
          const sp = new Sprite(tex);
          const ladoAlvo = 2 * rBase * 1.35 * escalaVisual;
          const esc = ladoAlvo / Math.max(tex.width, tex.height);
          sp.scale.set(esc);
          sp.anchor.set(0.5, 0.72);
          sp.position.set(0, rBase * 0.65);
          sp.tint = tinta;
          if (!ap.deitado) {
            respiracao ??= criarFiltroDeRespiracao();
            const criticoPv = t.figure.state === 'hurt' || t.figure.state === 'dying' || (recursos !== null && emEstadoCritico(recursos));
            paramsRespiracao = criticoPv
              ? { period: 2.4, amp: 1.7, tremor: 0 }
              : t.figure.state === 'maddened'
                ? { period: 3.2, amp: 0.75, tremor: 1 }
                : { period: 4.2, amp: 1, tremor: 0 };
            sp.filters = [respiracao.filtro];
            retratoImersivo = sp;
          }
          corpo.addChild(sp);
        } else {
          const sp = new Sprite(tex), cobrir = Math.max((2 * r) / tex.width, (2 * r) / tex.height);
          sp.scale.set(cobrir); sp.tint = tinta;
          if (tex.height > tex.width * 1.12) {
            sp.anchor.set(0.5, 0.36);
          } else {
            sp.anchor.set(0.5, 0.5);
          }
          // No Pixel o retrato já vem derivado: recortado em círculo, na paleta e com contorno.
          if (comSprite.pixel) corpo.addChild(sp); else { const mascara = new Graphics().circle(0, 0, r * 0.93).fill(0xffffff); sp.mask = mascara; corpo.addChild(sp, mascara); }
        }
      } else {
        const rotulo = new Text({ text: (t.name.trim()[0] ?? '?').toUpperCase(), style: { fontFamily: 'Hanken Grotesk Variable, Hanken Grotesk, sans-serif', fontSize: 64, fontWeight: '800', fill: 0xffffff } });
        rotulo.anchor.set(0.5); rotulo.scale.set((r * 1.1) / 64); corpo.addChild(rotulo);
      }
      corpo.rotation = ap.deitado ? Math.PI / 2 : 0;
      const cor = ap.anel ? hexParaNumero(ap.anel) : acento;
      if (eImersivo) anel.clear();
      else if (usaSprite && ap.deitado) anel.clear();
      else if (usaSprite) anel.clear().ellipse(0, 0.21 * grade * t.size, 0.4 * grade * t.size, 0.17 * grade * t.size).stroke({ width: 0.05, color: cor });
      else {
        anel.clear().circle(0, 0, r).stroke({ width: 0.07, color: cor }).circle(0, 0, r * 0.92).stroke({ width: 0.02, color: 0xffffff, alpha: 0.35 });
      }
      marca.clear();
      if (ap.marca === 'x') {
        const k = r * 0.55;
        const my = eImersivo ? rBase * 0.3 : 0;
        marca.moveTo(-k, my - k).lineTo(k, my + k).moveTo(k, my - k).lineTo(-k, my + k).stroke({ width: 0.09, color: 0x120a0a, alpha: 0.85, cap: 'round' }).moveTo(-k, my - k).lineTo(k, my + k).moveTo(k, my - k).lineTo(-k, my + k).stroke({ width: 0.045, color: 0xe0342c, cap: 'round' });
      }
      const numBadge = extrairNumeroDoToken(t.name);
      if (numBadge) {
        const bx = r * 0.68, by = -r * 0.68;
        const br = Math.max(0.12 * grade, r * 0.34);
        const bg = new Graphics().circle(bx, by, br).fill(0x1a1a24).stroke({ width: Math.max(0.02 * grade, br * 0.15), color: 0xffffff, alpha: 0.85 });
        const rotulo = new Text({
          text: numBadge,
          style: {
            fontFamily: 'Hanken Grotesk Variable, Hanken Grotesk, sans-serif',
            fontSize: 48,
            fontWeight: '800',
            fill: 0xffffff,
          },
        });
        rotulo.anchor.set(0.5);
        rotulo.scale.set((br * 1.3) / 48);
        rotulo.position.set(bx, by);
        badge.addChild(bg, rotulo);
      }
      pips.clear();
      if (recursos) {
        const largura = Math.min(2 * r * 1.05, Math.max(grade * 0.86, 2 * r * 0.92));
        const altura = Math.max(0.095 * grade, 0.115 * r);
        const x0 = -largura / 2;
        const y0 = (usaSprite ? 0.21 * grade * t.size + 0.18 * grade * t.size : r) + 0.09 * grade;
        const raioBorda = altura * 0.45;
        const critico = emEstadoCritico(recursos);
        const corPv = critico ? 0xff3b30 : 0xe0342c;

        const barra = (y: number, valor: number, maximo: number, corBarra: number) => {
          const f = maximo > 0 ? Math.max(0, Math.min(1, valor / maximo)) : 0;
          pips.roundRect(x0, y, largura, altura, raioBorda).fill({ color: 0x0b0d13, alpha: 0.88 }).stroke({ color: 0x000000, alpha: 0.9, width: 0.02 * grade });
          if (f > 0) {
            pips.roundRect(x0, y, Math.max(altura * 0.6, largura * f), altura, raioBorda).fill({ color: corBarra, alpha: 0.96 });
            pips.roundRect(x0 + 0.01 * grade, y + 0.01 * grade, Math.max(0, largura * f - 0.02 * grade), altura * 0.35, raioBorda * 0.5).fill({ color: 0xffffff, alpha: 0.18 });
          }
        };

        barra(y0, recursos.pv, recursos.pvMax, corPv);
        if (temPd(recursos)) {
          barra(y0 + altura + 0.035 * grade, recursos.pd, recursos.pdMax, 0x3e8fe0);
        }
        if (ultimoRecursos && (recursos.pv < ultimoRecursos.pv || recursos.pd < ultimoRecursos.pd)) piscaAte = performance.now() + 1200;
      }
      ultimoRecursos = recursos; pips.visible = !!recursos;
      cor0 = acento; grade0 = grade;
      const novo: Ponto = [t.position[0], t.position[1]];
      if (alvo && animar && (Math.abs(novo[0] - alvo[0]) > 1e-6 || Math.abs(novo[1] - alvo[1]) > 1e-6)) {
        const agora = performance.now(), de: Ponto = desliza ? [c.x, c.y] : alvo;
        const celulas = Math.hypot(novo[0] - alvo[0], novo[1] - alvo[1]) / grade;
        desliza = { de, para: novo, t0: agora, dur: Math.min(MS_MAXIMO, Math.max(MS_POR_CELULA, celulas * MS_POR_CELULA)) };
        rastro.push({ de: alvo, para: novo, t0: agora });
      } else if (!desliza || !animar) { desliza = null; c.position.set(novo[0], novo[1]); }
      alvo = novo;
    },
    quadro(ms, efeitos) {
      if (pips.visible) pips.alpha = efeitos && ms < piscaAte ? (Math.floor(ms / 120) % 2 ? 0.25 : 1) : 1;
      if (spriteRef) {
        // Parado alterna 2 quadros; deslizando anda na direção do movimento (a linha vem do vetor, e `facing` vale quando para).
        let linha = ladoParado, coluna = efeitos ? Math.floor(ms / MS_PARADO) % 2 : 0;
        if (desliza) { const dx = desliza.para[0] - desliza.de[0], dy = desliza.para[1] - desliza.de[1]; linha = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); coluna = 2 + (Math.floor((ms - desliza.t0) / MS_ANDANDO) % 4); }
        if (!corrente || corrente.linha !== linha || corrente.coluna !== coluna) { corrente = { linha, coluna }; spriteRef.texture = quadros[linha]![coluna]!; }
      }
      if (desliza) {
        const k = Math.min(1, (ms - desliza.t0) / desliza.dur), e = 1 - (1 - k) ** 3;
        c.position.set(desliza.de[0] + (desliza.para[0] - desliza.de[0]) * e, desliza.de[1] + (desliza.para[1] - desliza.de[1]) * e);
        if (k >= 1) desliza = null;
      }
      if (vez) {
        const f = efeitos ? 0.5 + 0.5 * Math.sin((ms / 1000) * Math.PI * 2) : 0.5;
        if (eImersivo) {
          vezG.clear().ellipse(0, rBase * 0.65, rBase * (0.95 + 0.12 * f), rBase * (0.38 + 0.06 * f)).stroke({ width: 0.08, color: 0xffd23f, alpha: 0.95 - 0.5 * f });
        } else {
          vezG.clear().circle(0, 0, raio * (1.18 + 0.16 * f)).stroke({ width: 0.09, color: 0xffd23f, alpha: 0.95 - 0.5 * f });
        }
      }
      rastro = rastro.filter(r => ms - r.t0 < MS_DA_TRILHA);
      trilha.clear();
      for (const r of rastro) {
        const idade = (ms - r.t0) / MS_DA_TRILHA, comp = Math.hypot(r.para[0] - r.de[0], r.para[1] - r.de[1]), n = Math.max(1, Math.round(comp / (grade0 * 0.25)));
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          trilha.circle(r.de[0] + (r.para[0] - r.de[0]) * f - c.x, r.de[1] + (r.para[1] - r.de[1]) * f - c.y, grade0 * 0.06).fill({ color: cor0, alpha: 0.75 * (1 - idade) });
        }
      }
      // Morrendo: o sprite pisca em vermelho (o anel pulsa por baixo).
      if (spriteRef && pulso) spriteRef.tint = efeitos && Math.floor(ms / 180) % 2 ? 0xff6a5a : tintaNum;
      if (respiracao && retratoImersivo) {
        respiracao.filtro.enabled = efeitos && !deitada;
        if (respiracao.filtro.enabled) respiracao.atualizar(ms / 1000, semente, paramsRespiracao);
      }
      if (!efeitos || (!pulso && !tremor)) { if (anel.alpha !== 1 || corpo.x !== 0) { anel.alpha = 1; anel.scale.set(1); corpo.position.set(0, 0); } return; }
      const t = ms / 1000;
      if (pulso) { const f = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.4); anel.alpha = 0.45 + 0.55 * f; anel.scale.set(1 + 0.1 * f * pulso); }
      if (tremor) corpo.position.set(...(spriteRef ? [Math.round(Math.sin(t * 47 + semente)) * pxDoSprite, Math.round(Math.cos(t * 53 + semente * 1.7)) * pxDoSprite] as const : [Math.sin(t * 47 + semente) * 0.035 * tremor * (raio / 0.5), Math.cos(t * 53 + semente * 1.7) * 0.035 * tremor * (raio / 0.5)] as const));
    },
    definirVez(v) { vez = v; if (!v) vezG.clear(); },
    estado: () => ({
      retrato: tem,
      vez,
      deitada,
      raio,
      deslizando: !!desliza,
      trilha: rastro.length,
      quadro: spriteRef ? corrente : null,
      pips: pips.visible ? ultimoRecursos : null,
      estadoVisto,
      tokenStyle: estiloToken,
      portraitScale: escalaVisual,
    }),
  };
}

/** Mistura uma cor com a tinta (multiplicação), para acinzentar o fundo da inicial. */
function tingir(cor: number, tinta: number): number {
  const m = (a: number, b: number) => Math.round((a * b) / 255);
  return (m((cor >> 16) & 255, (tinta >> 16) & 255) << 16) | (m((cor >> 8) & 255, (tinta >> 8) & 255) << 8) | m(cor & 255, tinta & 255);
}
