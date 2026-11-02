import { contornar } from './raster.js';
import { tom } from './materiais.js';

// Gerador paramétrico de personagem em pixel art: 16 × 24 pixels por quadro.
// Linhas da folha: baixo, esquerda, direita, cima. Colunas: parado 0–1, andando 0–3.
export const QUADRO = [16, 24];
export const DIRECOES = ['baixo', 'esq', 'dir', 'cima'];

function quadro(ctx, ox, oy, s, dir, pose, passo) {
  const p = (x, y, w, h, cor) => { ctx.fillStyle = cor; ctx.fillRect(ox + x, oy + y, w, h); };
  const lado = dir === 'esq' || dir === 'dir', costas = dir === 'cima';
  const bob = pose === 'andar' && passo % 2 === 1 ? 1 : pose === 'parado' && passo === 1 ? 1 : 0;
  const pele = s.pele, peleS = tom(s.pele, -0.18), cab = s.cabelo, cabS = tom(s.cabelo, -0.25), roupa = s.roupa, roupaS = tom(s.roupa, -0.3), roupaL = tom(s.roupa, 0.18);
  const calca = s.calca, sapato = '#16131c';

  // Pernas (não sobem com o balanço).
  const ab = pose === 'andar' ? [0, 1, 0, -1][passo] : 0;
  if (lado) {
    p(6 + ab, 17, 2, 3, calca); p(8 - ab, 17, 2, 3, tom(calca, -0.2));
    p(6 + ab, 20, 2, 1, sapato); p(8 - ab, 20, 2, 1, sapato);
  } else {
    p(5, 17 - Math.max(0, ab), 2, 3 + Math.max(0, ab) - Math.max(0, -ab), calca); p(9, 17 - Math.max(0, -ab), 2, 3 + Math.max(0, -ab) - Math.max(0, ab), calca);
    p(5, 20 - Math.max(0, -ab), 2, 1, sapato); p(9, 20 - Math.max(0, ab), 2, 1, sapato);
  }
  const y = bob;
  // Capa e tronco.
  if (lado) {
    p(5, 10 + y, 6, 8, roupa); p(5, 10 + y, 1, 8, roupaL); p(10, 11 + y, 1, 7, roupaS);
    p(7, 11 + y, 2, 5, roupaS); p(7, 15 + y, 2, 1, pele);
  } else {
    p(4, 10 + y, 8, 8, roupa); p(4, 10 + y, 1, 8, roupaL); p(11, 10 + y, 1, 8, roupaS);
    if (!costas) { p(7, 11 + y, 2, 6, s.roupa2); p(3, 11 + y, 1, 4, roupa); p(12, 11 + y, 1, 4, roupaS); p(3, 15 + y, 1, 1, pele); p(12, 15 + y, 1, 1, pele); }
    else { p(5, 12 + y, 6, 1, roupaS); p(3, 11 + y, 1, 4, roupaS); p(12, 11 + y, 1, 4, roupaS); }
  }
  // Cabeça.
  if (costas) {
    p(4, 3 + y, 8, 8, cab); p(4, 3 + y, 8, 1, tom(cab, 0.15)); p(5, 7 + y, 1, 4, cabS); p(10, 7 + y, 1, 4, cabS);
    if (s.estiloCabelo === 'longo') p(5, 11 + y, 6, 2, cab);
  } else if (lado) {
    p(5, 4 + y, 6, 6, pele); p(5, 9 + y, 5, 1, peleS);
    p(6, 3 + y, 6, 2, cab); p(9, 5 + y, 3, 5, cab); p(10, 10 + y, 2, s.estiloCabelo === 'longo' ? 3 : 1, cabS);
    p(5, 5 + y, 2, 1, cab); p(6, 7 + y, 1, 1, s.olhos);
  } else {
    p(5, 4 + y, 6, 6, pele); p(5, 9 + y, 6, 1, peleS);
    p(4, 3 + y, 8, 2, cab); p(4, 5 + y, 1, s.estiloCabelo === 'longo' ? 8 : 4, cab); p(11, 5 + y, 1, s.estiloCabelo === 'longo' ? 8 : 4, cabS);
    p(5, 5 + y, 2, 1, cab); p(9, 5 + y, 2, 1, cab);
    p(6, 7 + y, 1, 1, s.olhos); p(9, 7 + y, 1, 1, s.olhos);
  }
  // Acessório: tiara com galhada.
  if (s.acessorio === 'galhada') {
    const ouro = '#d9a75e', chifre = '#93592c';
    p(4, 4 + y, 8, 1, ouro);
    if (lado) { p(7, 2 + y, 1, 2, chifre); p(6, 1 + y, 1, 1, chifre); p(8, 0 + y, 1, 2, chifre); p(9, 1 + y, 1, 1, chifre); }
    else { p(4, 2 + y, 1, 2, chifre); p(3, 0 + y, 1, 2, chifre); p(5, 1 + y, 1, 1, chifre); p(11, 2 + y, 1, 2, chifre); p(12, 0 + y, 1, 2, chifre); p(10, 1 + y, 1, 1, chifre); }
  }
}

/** Folha de quadros do personagem, com contorno de 1 pixel. Sem sombra: o renderizador a desenha embaixo. */
export function gerarFolha(spec) {
  const [w, h] = QUADRO, canvas = document.createElement('canvas');
  canvas.width = w * 6; canvas.height = h * 4;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  DIRECOES.forEach((dir, linha) => {
    for (let c = 0; c < 6; c++) {
      const pose = c < 2 ? 'parado' : 'andar', passo = c < 2 ? c : c - 2, d = dir === 'dir' ? 'esq' : dir;
      if (dir === 'dir') {
        const t = document.createElement('canvas'); t.width = w; t.height = h;
        quadro(t.getContext('2d'), 0, 0, spec, d, pose, passo);
        ctx.save(); ctx.translate(c * w + w, linha * h); ctx.scale(-1, 1); ctx.drawImage(t, 0, 0); ctx.restore();
      } else quadro(ctx, c * w, linha * h, spec, d, pose, passo);
    }
  });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height); contornar(img); ctx.putImageData(img, 0, 0);
  return canvas;
}
