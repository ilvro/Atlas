import { mulberry32 } from './ruido.js';

// Descrição de desenho: partes com forma, material e altura (z, em metros). Coordenadas locais em metros,
// com origem no centro do objeto e a frente voltada para +y. Objetos de parede descrevem também a `face`
// (u ao longo da parede, z do chão para cima) e o `topo` (projeção vista de cima, colada à parede).

const ret = (x, y, w, h, mat, z, extra = {}) => ({ forma: 'ret', x, y, w, h, mat, z, ...extra });
const elipse = (x, y, w, h, mat, z, extra = {}) => ({ forma: 'elipse', x, y, w, h, mat, z, ...extra });
const poli = (pts, mat, z, extra = {}) => ({ forma: 'poli', pts, mat, z, ...extra });

const CAPAS = ['#7a1f24', '#2a3f6b', '#2f4a32', '#93592c', '#3a2244', '#b97d3d', '#1a2440', '#4a1418', '#d9a75e', '#46291b'];

function papeis(r, cx, cy, n, espalhar) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = cx + (r() - 0.5) * espalhar, y = cy + (r() - 0.5) * espalhar * 0.7, a = (r() - 0.5) * 1.2, w = 0.21, h = 0.29;
    const c = Math.cos(a), s = Math.sin(a), p = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
    out.push(poli(p, 'papel.folha', 0.78 + i * 0.002, { detalhe: 2, sombraLeve: true }));
  }
  return out;
}

export const RECEITAS = {
  'mesa.redonda': ({ seed }) => {
    const r = mulberry32(seed);
    return { pegada: [1.3, 1.3], partes: [
      elipse(0, 0, 1.26, 1.26, 'tecido.linho', 0.76),
      elipse(0, 0, 1.0, 1.0, 'tecido.linho', 0.761, { contorno: 'leve', detalhe: 2 }),
      ...papeis(r, -0.22, 0.18, 2, 0.3),
      ret(0.28, 0.2, 0.18, 0.26, 'couro.marrom', 0.8, { detalhe: 2, raio: 0.01 }),
      elipse(0, 0, 0.2, 0.2, 'latao', 0.9),
      elipse(0, 0, 0.12, 0.12, 'vidro', 1.05, { detalhe: 2 }),
    ] };
  },
  cadeira: () => ({ pegada: [0.5, 0.5], partes: [
    ret(0, 0.02, 0.46, 0.44, 'madeira.media', 0.45, { raio: 0.04 }),
    ret(0, 0.04, 0.34, 0.32, 'tecido.veludo-vinho', 0.5, { raio: 0.05, detalhe: 2 }),
    ret(0, -0.21, 0.48, 0.08, 'madeira.escura', 0.92, { raio: 0.03 }),
  ] }),
  aparador: ({ seed }) => {
    const r = mulberry32(seed);
    return { pegada: [1.7, 0.5], partes: [
      ret(0, 0, 1.66, 0.46, 'madeira.escura', 0.85, { raio: 0.02, dir: 0 }),
      elipse(-0.55, 0, 0.2, 0.2, 'latao', 1.1),
      elipse(-0.55, 0, 0.11, 0.11, 'tecido.veludo-vinho', 1.15, { detalhe: 2 }),
      ret(0.1, -0.02, 0.32, 0.24, 'couro.marrom', 0.9, { raio: 0.01 }),
      ret(0.12, -0.04, 0.28, 0.2, CAPAS[Math.floor(r() * CAPAS.length)], 0.95, { raio: 0.01, detalhe: 2 }),
      elipse(0.55, 0.02, 0.08, 0.08, 'papel.folha', 1.0, { detalhe: 2 }),
    ] };
  },
  'tapete.persa': ({ tam }) => ({ pegada: tam, partes: [ret(0, 0, tam[0], tam[1], 'tapete.persa', 0.01, { semSombra: true, contorno: 'leve' })] }),
  poltrona: () => ({ pegada: [1, 1], partes: [
    ret(0, 0.02, 0.92, 0.86, 'couro.marrom', 0.42, { raio: 0.14 }),
    ret(0, 0.08, 0.6, 0.56, 'couro.marrom', 0.5, { raio: 0.1, detalhe: 2 }),
    ret(-0.39, 0.06, 0.16, 0.74, 'couro.marrom', 0.65, { raio: 0.07 }),
    ret(0.39, 0.06, 0.16, 0.74, 'couro.marrom', 0.65, { raio: 0.07 }),
    ret(0, -0.34, 0.92, 0.2, 'couro.marrom', 0.95, { raio: 0.08 }),
  ] }),
  mesinha: ({ seed }) => {
    const r = mulberry32(seed);
    return { pegada: [0.6, 0.6], partes: [
      elipse(0, 0, 0.56, 0.56, 'madeira.media', 0.55),
      ret(-0.06, 0.04, 0.2, 0.15, CAPAS[Math.floor(r() * CAPAS.length)], 0.6, { raio: 0.01, detalhe: 2 }),
      elipse(0.12, -0.1, 0.1, 0.1, 'papel.folha', 0.62, { detalhe: 2 }),
    ] };
  },
  escrivaninha: ({ seed }) => {
    const r = mulberry32(seed);
    return { pegada: [1.5, 0.8], partes: [
      ret(0, 0, 1.44, 0.72, 'madeira.escura', 0.76, { raio: 0.02 }),
      ...papeis(r, -0.15, 0.02, 4, 0.55),
      ret(-0.5, -0.12, 0.26, 0.3, CAPAS[2], 0.82, { raio: 0.01, detalhe: 2 }),
      elipse(0.08, -0.2, 0.06, 0.06, 'pedra.escura', 0.82, { detalhe: 3 }),
      elipse(0.5, 0.05, 0.36, 0.36, 'tecido.linho', 1.25),
      elipse(0.5, 0.05, 0.1, 0.1, 'latao', 1.27, { detalhe: 2 }),
    ] };
  },

  // Objetos de parede: `face` em (u, z) e `topo` em (u, profundidade a partir da parede).
  quadro: ({ largura }) => ({
    face: [ret(0, 1.65, largura, 0.72, 'moldura.dourada', 0.03), ret(0, 1.65, largura - 0.14, 0.58, 'pintura.paisagem', 0.04)],
    topo: [ret(0, 0.03, largura, 0.05, 'moldura.dourada', 1.6)],
  }),
  estante: ({ largura, seed }) => {
    const r = mulberry32(seed), face = [ret(0, 1.1, largura, 2.2, 'madeira.escura', 0.35)], topo = [ret(0, 0.18, largura, 0.36, 'madeira.escura', 2.2)];
    const prateleiras = 5, alt = 2.05 / prateleiras;
    for (let i = 0; i < prateleiras; i++) {
      const z0 = 0.08 + i * alt;
      face.push(ret(0, z0 + alt / 2, largura - 0.1, alt - 0.05, 'pedra.escura', 0.36, { contorno: false }));
      for (let u = -largura / 2 + 0.07; u < largura / 2 - 0.12;) {
        const w = 0.06 + r() * 0.07, h = alt * (0.6 + r() * 0.3);
        if (r() < 0.08) { u += w * 2; continue; }
        face.push(ret(u + w / 2, z0 + h / 2 + 0.02, w, h, CAPAS[Math.floor(r() * CAPAS.length)], 0.37, { detalhe: 2, contorno: 'leve' }));
        u += w + 0.004;
      }
    }
    for (let u = -largura / 2 + 0.1; u < largura / 2 - 0.1; u += 0.08 + r() * 0.06) topo.push(ret(u, 0.2, 0.06, 0.24, CAPAS[Math.floor(r() * CAPAS.length)], 2.21, { detalhe: 2, contorno: false }));
    return { face, topo };
  },
  janela: ({ largura }) => ({
    face: [
      ret(0, 1.55, largura * 0.82, 1.3, 'madeira.media', 0.04),
      ret(0, 1.55, largura * 0.68, 1.16, 'vidro', 0.05, { vidro: true }),
      ret(0, 1.55, 0.04, 1.16, 'madeira.media', 0.06), ret(0, 1.55, largura * 0.68, 0.04, 'madeira.media', 0.06),
      ret(-largura * 0.4, 1.5, 0.22, 1.5, 'cortina.vinho', 0.08), ret(largura * 0.4, 1.5, 0.22, 1.5, 'cortina.vinho', 0.08),
      ret(0, 0.88, largura * 0.9, 0.07, 'madeira.escura', 0.09),
    ],
    topo: [ret(0, 0, largura * 0.82, 0.1, 'vidro', 2.6, { vidro: true })],
  }),
  porta: ({ largura }) => ({ pegada: [largura, 0.08], partes: [
    ret(largura / 2, 0, largura, 0.07, 'madeira.media', 2.1, { raio: 0.01, semSombra: true }),
    elipse(largura * 0.88, 0, 0.06, 0.06, 'latao', 2.12, { detalhe: 2 }),
  ] }),
};

export function receita(id, params) {
  const f = RECEITAS[id];
  if (!f) throw new Error(`Receita desconhecida: ${id}`);
  return f(params);
}
