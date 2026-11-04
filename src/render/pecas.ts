import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { aparenciaDoEstado } from '../domain/figuras.ts';
import type { Peca, Ponto } from '../domain/mapa.ts';
import { corDoNome, hexParaNumero } from './cores.ts';

/** Uma peça no mapa: retrato em círculo (ou a inicial), anel, e a cara do estado (deitada, acinzentada, pulsando, tremendo, com X). */
export interface PecaVisual {
  readonly c: Container;
  /** Refaz o desenho com os dados da peça; `tex` é o retrato (ou `null`). */
  atualizar(t: Peca, tamanhoDaCelula: number, acento: number, tex: Texture | null, animar?: boolean, sprite?: { folha: Texture | null; pixel: boolean }): void;
  /** Animação do pulso, do tremor, do deslize e da trilha; `ms` é o relógio. Parada com `efeitos` desligados. */
  quadro(ms: number, efeitos: boolean): void;
  /** É a vez desta peça na iniciativa? Ganha um anel pulsante por fora. */
  definirVez(vez: boolean): void;
  /** Para os testes e o diagnóstico. */
  estado(): { vez: boolean; retrato: boolean; deitada: boolean; raio: number; deslizando: boolean; trilha: number; /** O quadro do sprite agora (linha: baixo, esquerda, direita, cima), ou `null` sem sprite. */ quadro: { linha: number; coluna: number } | null };
}

const MS_POR_CELULA = 160, MS_MAXIMO = 600, MS_DA_TRILHA = 2000;
const [QW, QH] = [16, 24], LINHA_DO_LADO = { down: 0, left: 1, right: 2, up: 3 } as const;
/** O quadro parado alterna a 2 Hz; andando, 4 quadros a 8 Hz. */
const MS_PARADO = 500, MS_ANDANDO = 125;

export function criarPeca(): PecaVisual {
  const c = new Container(), trilha = new Graphics(), corpo = new Container(), anel = new Graphics(), marca = new Graphics(), vezG = new Graphics();
  c.addChild(trilha, vezG, corpo, anel, marca);
  let vez = false;
  let desliza: { de: Ponto; para: Ponto; t0: number; dur: number } | null = null, rastro: { de: Ponto; para: Ponto; t0: number }[] = [], alvo: Ponto | null = null, cor0 = 0xffffff, grade0 = 1;
  let pulso = 0, tremor = 0, raio = 0.5, tem = false, deitada = false, semente = Math.random() * 100;
  // O sprite: a folha (96 × 96) fatiada em quadros, o sprite que mostra o quadro e a linha do lado para onde a peça olha.
  let pxDoSprite = 1, tintaNum = 0xffffff, folhaAtual: Texture | null = null, quadros: Texture[][] = [], spriteRef: Sprite | null = null, ladoParado = 0, corrente: { linha: number; coluna: number } | null = null;
  const fatiar = (folha: Texture): Texture[][] => Array.from({ length: 4 }, (_, l) => Array.from({ length: 6 }, (_, k) => new Texture({ source: folha.source, frame: new Rectangle(k * QW, l * QH, QW, QH) })));

  return {
    c,
    atualizar(t, grade, acento, tex, animar = false, comSprite = { folha: null, pixel: false }) {
      const ap = aparenciaDoEstado(t.figure.state), r = (t.size * grade * 0.9) / 2;
      raio = r; deitada = ap.deitado; pulso = ap.pulso; tremor = ap.tremor;
      for (const f of corpo.removeChildren()) f.destroy({ children: true });
      const tinta = ap.tinta ? hexParaNumero(ap.tinta) : 0xffffff;
      const fundo = new Graphics().circle(0, 0, r).fill(ap.tinta ? tingir(corDoNome(t.name, 0.5, 0.4), tinta) : corDoNome(t.name, 0.5, 0.4));
      // O Pixel usa o sprite quando há; o Ilustrado só quando a peça não tem retrato.
      const folha = comSprite.folha, usaSprite = !!folha && !!t.sprite && (comSprite.pixel || !tex);
      if (folha !== folhaAtual) { for (const q of quadros.flat()) q.destroy(false); quadros = folha ? fatiar(folha) : []; folhaAtual = folha; }
      spriteRef = null; ladoParado = LINHA_DO_LADO[t.facing]; corrente = null;
      if (!usaSprite) corpo.addChild(fundo);
      tem = !!tex && !usaSprite;
      if (usaSprite) {
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
      } else if (tex) {
        const sp = new Sprite(tex), cobrir = Math.max((2 * r) / tex.width, (2 * r) / tex.height);
        sp.anchor.set(0.5); sp.scale.set(cobrir); sp.tint = tinta;
        // No Pixel o retrato já vem derivado: recortado em círculo, na paleta e com contorno.
        if (comSprite.pixel) corpo.addChild(sp); else { const mascara = new Graphics().circle(0, 0, r).fill(0xffffff); sp.mask = mascara; corpo.addChild(sp, mascara); }
      } else {
        const rotulo = new Text({ text: (t.name.trim()[0] ?? '?').toUpperCase(), style: { fontFamily: 'Hanken Grotesk Variable, Hanken Grotesk, sans-serif', fontSize: 64, fontWeight: '800', fill: 0xffffff } });
        rotulo.anchor.set(0.5); rotulo.scale.set((r * 1.1) / 64); corpo.addChild(rotulo);
      }
      corpo.rotation = ap.deitado ? Math.PI / 2 : 0;
      const cor = ap.anel ? hexParaNumero(ap.anel) : acento;
      if (usaSprite && ap.deitado) anel.clear();
      else if (usaSprite) anel.clear().ellipse(0, 0.21 * grade * t.size, 0.4 * grade * t.size, 0.17 * grade * t.size).stroke({ width: 0.05, color: cor });
      else anel.clear().circle(0, 0, r).stroke({ width: 0.07, color: cor }).circle(0, 0, r * 0.82).stroke({ width: 0.02, color: 0xffffff, alpha: 0.35 });
      marca.clear();
      if (ap.marca === 'x') { const k = r * 0.55; marca.moveTo(-k, -k).lineTo(k, k).moveTo(k, -k).lineTo(-k, k).stroke({ width: 0.09, color: 0x120a0a, alpha: 0.85, cap: 'round' }).moveTo(-k, -k).lineTo(k, k).moveTo(k, -k).lineTo(-k, k).stroke({ width: 0.045, color: 0xe0342c, cap: 'round' }); }
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
        vezG.clear().circle(0, 0, raio * (1.18 + 0.16 * f)).stroke({ width: 0.09, color: 0xffd23f, alpha: 0.95 - 0.5 * f });
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
      if (!efeitos || (!pulso && !tremor)) { if (anel.alpha !== 1 || corpo.x !== 0) { anel.alpha = 1; anel.scale.set(1); corpo.position.set(0, 0); } return; }
      const t = ms / 1000;
      if (pulso) { const f = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.4); anel.alpha = 0.45 + 0.55 * f; anel.scale.set(1 + 0.1 * f * pulso); }
      if (tremor) corpo.position.set(...(spriteRef ? [Math.round(Math.sin(t * 47 + semente)) * pxDoSprite, Math.round(Math.cos(t * 53 + semente * 1.7)) * pxDoSprite] as const : [Math.sin(t * 47 + semente) * 0.035 * tremor * (raio / 0.5), Math.cos(t * 53 + semente * 1.7) * 0.035 * tremor * (raio / 0.5)] as const));
    },
    definirVez(v) { vez = v; if (!v) vezG.clear(); },
    estado: () => ({ retrato: tem, vez, deitada, raio, deslizando: !!desliza, trilha: rastro.length, quadro: spriteRef ? corrente : null }),
  };
}

/** Mistura uma cor com a tinta (multiplicação), para acinzentar o fundo da inicial. */
function tingir(cor: number, tinta: number): number {
  const m = (a: number, b: number) => Math.round((a * b) / 255);
  return (m((cor >> 16) & 255, (tinta >> 16) & 255) << 16) | (m((cor >> 8) & 255, (tinta >> 8) & 255) << 8) | m(cor & 255, tinta & 255);
}
