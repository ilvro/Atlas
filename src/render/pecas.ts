import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { aparenciaDoEstado } from '../domain/figuras.ts';
import type { Peca, Ponto } from '../domain/mapa.ts';
import { corDoNome, hexParaNumero } from './cores.ts';

/** Uma peça no mapa: retrato em círculo (ou a inicial), anel, e a cara do estado (deitada, acinzentada, pulsando, tremendo, com X). */
export interface PecaVisual {
  readonly c: Container;
  /** Refaz o desenho com os dados da peça; `tex` é o retrato (ou `null`). */
  atualizar(t: Peca, tamanhoDaCelula: number, acento: number, tex: Texture | null, animar?: boolean): void;
  /** Animação do pulso, do tremor, do deslize e da trilha; `ms` é o relógio. Parada com `efeitos` desligados. */
  quadro(ms: number, efeitos: boolean): void;
  /** Para os testes e o diagnóstico. */
  estado(): { retrato: boolean; deitada: boolean; raio: number; deslizando: boolean; trilha: number };
}

const MS_POR_CELULA = 160, MS_MAXIMO = 600, MS_DA_TRILHA = 2000;

export function criarPeca(): PecaVisual {
  const c = new Container(), trilha = new Graphics(), corpo = new Container(), anel = new Graphics(), marca = new Graphics();
  c.addChild(trilha, corpo, anel, marca);
  let desliza: { de: Ponto; para: Ponto; t0: number; dur: number } | null = null, rastro: { de: Ponto; para: Ponto; t0: number }[] = [], alvo: Ponto | null = null, cor0 = 0xffffff, grade0 = 1;
  let pulso = 0, tremor = 0, raio = 0.5, tem = false, deitada = false, semente = Math.random() * 100;

  return {
    c,
    atualizar(t, grade, acento, tex, animar = false) {
      const ap = aparenciaDoEstado(t.figure.state), r = (t.size * grade * 0.9) / 2;
      raio = r; deitada = ap.deitado; pulso = ap.pulso; tremor = ap.tremor;
      for (const f of corpo.removeChildren()) f.destroy({ children: true });
      const tinta = ap.tinta ? hexParaNumero(ap.tinta) : 0xffffff;
      const fundo = new Graphics().circle(0, 0, r).fill(ap.tinta ? tingir(corDoNome(t.name, 0.5, 0.4), tinta) : corDoNome(t.name, 0.5, 0.4));
      corpo.addChild(fundo);
      tem = !!tex;
      if (tex) {
        const sp = new Sprite(tex), cobrir = Math.max((2 * r) / tex.width, (2 * r) / tex.height);
        sp.anchor.set(0.5); sp.scale.set(cobrir); sp.tint = tinta;
        const mascara = new Graphics().circle(0, 0, r).fill(0xffffff); sp.mask = mascara; corpo.addChild(sp, mascara);
      } else {
        const rotulo = new Text({ text: (t.name.trim()[0] ?? '?').toUpperCase(), style: { fontFamily: 'Hanken Grotesk Variable, Hanken Grotesk, sans-serif', fontSize: 64, fontWeight: '800', fill: 0xffffff } });
        rotulo.anchor.set(0.5); rotulo.scale.set((r * 1.1) / 64); corpo.addChild(rotulo);
      }
      corpo.rotation = ap.deitado ? Math.PI / 2 : 0;
      const cor = ap.anel ? hexParaNumero(ap.anel) : acento;
      anel.clear().circle(0, 0, r).stroke({ width: 0.07, color: cor }).circle(0, 0, r * 0.82).stroke({ width: 0.02, color: 0xffffff, alpha: 0.35 });
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
      if (desliza) {
        const k = Math.min(1, (ms - desliza.t0) / desliza.dur), e = 1 - (1 - k) ** 3;
        c.position.set(desliza.de[0] + (desliza.para[0] - desliza.de[0]) * e, desliza.de[1] + (desliza.para[1] - desliza.de[1]) * e);
        if (k >= 1) desliza = null;
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
      if (!efeitos || (!pulso && !tremor)) { if (anel.alpha !== 1 || corpo.x !== 0) { anel.alpha = 1; anel.scale.set(1); corpo.position.set(0, 0); } return; }
      const t = ms / 1000;
      if (pulso) { const f = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.4); anel.alpha = 0.45 + 0.55 * f; anel.scale.set(1 + 0.1 * f * pulso); }
      if (tremor) corpo.position.set(Math.sin(t * 47 + semente) * 0.035 * tremor * (raio / 0.5), Math.cos(t * 53 + semente * 1.7) * 0.035 * tremor * (raio / 0.5));
    },
    estado: () => ({ retrato: tem, deitada, raio, deslizando: !!desliza, trilha: rastro.length }),
  };
}

/** Mistura uma cor com a tinta (multiplicação), para acinzentar o fundo da inicial. */
function tingir(cor: number, tinta: number): number {
  const m = (a: number, b: number) => Math.round((a * b) / 255);
  return (m((cor >> 16) & 255, (tinta >> 16) & 255) << 16) | (m((cor >> 8) & 255, (tinta >> 8) & 255) << 8) | m(cor & 255, tinta & 255);
}
