import { corDoSprite, type SpriteDaPeca } from '../domain/sprite.ts';
import { contextoDe, criarTela, type Contexto, type Tela } from './canvas.ts';
import { tom } from './materiais.ts';
import { contornarPixels } from './estilos/partes-pixel.ts';

/**
 * Gerador paramétrico de personagem em pixel art (porte do protótipo `spikes/estilos/src/sprite.js`): 16 × 24 pixels por quadro.
 * Linhas da folha: baixo, esquerda, direita (espelho da esquerda), cima. Colunas: parado 0–1, andando 0–3.
 */
export const QUADRO: readonly [number, number] = [16, 24];
export const DIRECOES = ['baixo', 'esq', 'dir', 'cima'] as const;
export type Direcao = typeof DIRECOES[number];
export const COLUNAS = 6;

interface Cores { pele: string; peleS: string; cab: string; cabS: string; cabL: string; roupa: string; roupaS: string; roupaL: string; roupa2: string; calca: string; olhos: string }
const SAPATO = '#16131c', OURO = '#d9a75e', CHIFRE = '#93592c', COURO = '#6b3e22', FERRO = '#8a8f9a', FERRO_S = '#4a4a5c', LUZ = '#f6e7c1';

function coresDe(s: SpriteDaPeca): Cores {
  const pele = corDoSprite(s, 'pele'), cab = corDoSprite(s, 'cabelo'), roupa0 = corDoSprite(s, 'roupa'), detalhe = corDoSprite(s, 'detalhe');
  const roupa = s.outfit === 'armadura' ? tom(FERRO, -0.1) : roupa0;
  return {
    pele, peleS: tom(pele, -0.18), cab, cabS: tom(cab, -0.25), cabL: tom(cab, 0.15), roupa, roupaS: tom(roupa, -0.3), roupaL: tom(roupa, 0.18), roupa2: s.outfit === 'armadura' ? detalhe : detalhe,
    calca: s.outfit === 'armadura' ? FERRO_S : tom(roupa0, -0.45), olhos: '#16131c',
  };
}

function quadro(ctx: Contexto, ox: number, oy: number, s: SpriteDaPeca, dir: 'baixo' | 'esq' | 'cima', pose: 'parado' | 'andar', passo: number): void {
  const p = (x: number, y: number, w: number, h: number, cor: string) => { ctx.fillStyle = cor; ctx.fillRect(ox + x, oy + y, w, h); };
  const lado = dir === 'esq', costas = dir === 'cima', c = coresDe(s), tem = (a: string) => s.accessories.includes(a);
  const bob = pose === 'andar' && passo % 2 === 1 ? 1 : pose === 'parado' && passo === 1 ? 1 : 0, y = bob;
  const bw = s.body === 'esguio' ? 6 : s.body === 'robusto' ? 10 : 8, bx = 8 - bw / 2, detalhe = corDoSprite(s, 'detalhe');
  const comprido = s.hair === 'longo', careca = s.hair === 'careca';

  // Capa por trás do corpo (de frente, só as pontas; de costas, inteira).
  if (tem('capa')) {
    const capa = tom(detalhe, -0.35);
    if (costas) p(bx - 1, 10 + y, bw + 2, 11, capa); else if (!lado) { p(bx - 1, 11 + y, 1, 9, capa); p(bx + bw, 11 + y, 1, 9, capa); } else p(9, 10 + y, 3, 10, capa);
  }
  // Pernas (não sobem com o balanço).
  const ab = pose === 'andar' ? [0, 1, 0, -1][passo]! : 0;
  if (lado) {
    p(6 + ab, 17, 2, 3, c.calca); p(8 - ab, 17, 2, 3, tom(c.calca, -0.2)); p(6 + ab, 20, 2, 1, SAPATO); p(8 - ab, 20, 2, 1, SAPATO);
  } else {
    p(5, 17 - Math.max(0, ab), 2, 3 + Math.max(0, ab) - Math.max(0, -ab), c.calca); p(9, 17 - Math.max(0, -ab), 2, 3 + Math.max(0, -ab) - Math.max(0, ab), c.calca);
    p(5, 20 - Math.max(0, -ab), 2, 1, SAPATO); p(9, 20 - Math.max(0, ab), 2, 1, SAPATO);
  }
  // Tronco (e a saia do vestido e a barra do manto).
  const largo = s.outfit === 'vestido' ? 2 : 0;
  if (lado) {
    p(5, 10 + y, 6, 8, c.roupa); p(5, 10 + y, 1, 8, c.roupaL); p(10, 11 + y, 1, 7, c.roupaS); p(7, 11 + y, 2, 5, c.roupaS); p(7, 15 + y, 2, 1, c.pele);
    if (s.outfit === 'vestido') p(4, 16 + y, 8, 4, c.roupa); if (s.outfit === 'manto') p(4, 17 + y, 8, 3, c.roupaS);
  } else {
    p(bx, 10 + y, bw, 8, c.roupa); p(bx, 10 + y, 1, 8, c.roupaL); p(bx + bw - 1, 10 + y, 1, 8, c.roupaS);
    if (!costas) { p(7, 11 + y, 2, 6, c.roupa2); p(bx - 1, 11 + y, 1, 4, c.roupa); p(bx + bw, 11 + y, 1, 4, c.roupaS); p(bx - 1, 15 + y, 1, 1, c.pele); p(bx + bw, 15 + y, 1, 1, c.pele); }
    else { p(5, 12 + y, 6, 1, c.roupaS); p(bx - 1, 11 + y, 1, 4, c.roupaS); p(bx + bw, 11 + y, 1, 4, c.roupaS); }
    if (s.outfit === 'vestido') { p(bx - 1 - largo / 2, 17 + y, bw + 2 + largo, 3, c.roupa); p(bx - 1 - largo / 2, 17 + y, 1, 3, c.roupaL); p(bx + bw + largo / 2, 17 + y, 1, 3, c.roupaS); }
    if (s.outfit === 'manto') p(bx - 1, 17 + y, bw + 2, 3, c.roupaS);
  }
  if (s.outfit === 'armadura') { p(lado ? 5 : bx - 1, 10 + y, 2, 2, c.roupa2); if (!lado) p(bx + bw - 1, 10 + y, 2, 2, c.roupa2); }
  // Mochila: nas costas inteira; de frente só as alças; de lado, atrás do corpo.
  if (tem('mochila')) { if (costas) p(5, 11 + y, 6, 6, COURO); else if (lado) p(10, 11 + y, 2, 5, COURO); else { p(bx + 1, 11 + y, 1, 5, COURO); p(bx + bw - 2, 11 + y, 1, 5, COURO); } }
  // Cabeça.
  if (costas) {
    p(4, 3 + y, 8, 8, c.cab); p(4, 3 + y, 8, 1, c.cabL); p(5, 7 + y, 1, 4, c.cabS); p(10, 7 + y, 1, 4, c.cabS);
    if (comprido) p(5, 11 + y, 6, 2, c.cab); if (careca) p(4, 3 + y, 8, 8, c.pele);
  } else if (lado) {
    p(5, 4 + y, 6, 6, c.pele); p(5, 9 + y, 5, 1, c.peleS);
    if (!careca) { p(6, 3 + y, 6, 2, c.cab); p(9, 5 + y, 3, 5, c.cab); p(10, 10 + y, 2, comprido ? 3 : 1, c.cabS); p(5, 5 + y, 2, 1, c.cab); }
    p(6, 7 + y, 1, 1, c.olhos);
  } else {
    p(5, 4 + y, 6, 6, c.pele); p(5, 9 + y, 6, 1, c.peleS);
    if (!careca) { p(4, 3 + y, 8, 2, c.cab); p(4, 5 + y, 1, comprido ? 8 : 4, c.cab); p(11, 5 + y, 1, comprido ? 8 : 4, c.cabS); p(5, 5 + y, 2, 1, c.cab); p(9, 5 + y, 2, 1, c.cab); }
    p(6, 7 + y, 1, 1, c.olhos); p(9, 7 + y, 1, 1, c.olhos);
  }
  if (s.hair === 'coque' && !careca) p(7, 1 + y, 2, 2, c.cabL);
  // Acessórios de cabeça.
  if (tem('oculos') && !costas) { const arm = '#16131c'; if (lado) p(5, 7 + y, 3, 1, arm); else { p(5, 7 + y, 3, 1, arm); p(8, 7 + y, 3, 1, arm); p(7, 7 + y, 2, 1, arm); p(6, 7 + y, 1, 1, LUZ); p(9, 7 + y, 1, 1, LUZ); } }
  if (tem('galhada')) {
    p(4, 4 + y, 8, 1, OURO);
    if (lado) { p(7, 2 + y, 1, 2, CHIFRE); p(6, 1 + y, 1, 1, CHIFRE); p(8, 0 + y, 1, 2, CHIFRE); p(9, 1 + y, 1, 1, CHIFRE); }
    else { p(4, 2 + y, 1, 2, CHIFRE); p(3, 0 + y, 1, 2, CHIFRE); p(5, 1 + y, 1, 1, CHIFRE); p(11, 2 + y, 1, 2, CHIFRE); p(12, 0 + y, 1, 2, CHIFRE); p(10, 1 + y, 1, 1, CHIFRE); }
  }
  if (tem('chapeu')) { const copa = tom(detalhe, -0.4); p(3, 3 + y, 10, 1, copa); p(5, 0 + y, 6, 3, copa); p(5, 2 + y, 6, 1, tom(copa, -0.25)); }
  // Lanterna na mão: de frente e de costas na mão direita do personagem; de lado, à frente do corpo.
  if (tem('lanterna')) { const x = lado ? 3 : bx + bw + 1; p(x, 14 + y, 2, 3, COURO); p(x, 13 + y, 2, 1, FERRO); p(x, 15 + y, 2, 1, LUZ); p(x - 1, 15 + y, 1, 1, tom(OURO, 0.2)); }
}

/** A folha de quadros do personagem (96 × 96 px), com contorno de 1 px (o desenho desce 1 px para o contorno caber no quadro). Sem sombra: quem desenha a põe embaixo. */
export function folhaDoSprite(spec: SpriteDaPeca): Tela {
  const [w, h] = QUADRO, tela = criarTela(w * COLUNAS, h * DIRECOES.length), ctx = contextoDe(tela, { willReadFrequently: true });
  DIRECOES.forEach((dir, linha) => {
    for (let col = 0; col < COLUNAS; col++) {
      const pose = col < 2 ? 'parado' : 'andar', passo = col < 2 ? col : col - 2;
      if (dir === 'dir') {
        const t = criarTela(w, h); quadro(contextoDe(t), 0, 1, spec, 'esq', pose, passo);
        ctx.save(); ctx.translate(col * w + w, linha * h); ctx.scale(-1, 1); ctx.drawImage(t as CanvasImageSource, 0, 0); ctx.restore();
      } else quadro(ctx, col * w, linha * h + 1, spec, dir, pose, passo);
    }
  });
  const img = ctx.getImageData(0, 0, tela.width, tela.height); contornarPixels(img.data, tela.width, tela.height); ctx.putImageData(img, 0, 0);
  return tela;
}

