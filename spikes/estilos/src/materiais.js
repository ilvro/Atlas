import { mulberry32, noiseTile } from './ruido.js';

// Descrição única de cada material. Os dois renderizadores interpretam a mesma descrição.
export const MATERIAIS = {
  'tabuas.carvalho': { base: '#7a4a2a', escuro: '#3a2214', claro: '#a8703e', padrao: 'tabuas', largura: 0.2 },
  'ladrilho.xadrez': { base: '#d4c9b0', escuro: '#262226', claro: '#efe6cf', padrao: 'xadrez', lado: 0.5 },
  'papel.damasco-vinho': { base: '#4f1820', escuro: '#2c0c12', claro: '#7d2b33', padrao: 'damasco' },
  'papel.listras-musgo': { base: '#22362a', escuro: '#15211a', claro: '#3a5a40', padrao: 'listras', ouro: '#9a7a3a' },
  'madeira.escura': { base: '#3d2416', escuro: '#1e110a', claro: '#6b4024', padrao: 'veio' },
  'madeira.media': { base: '#74431f', escuro: '#3d2312', claro: '#a46a36', padrao: 'veio' },
  'tecido.linho': { base: '#e6dbc3', escuro: '#b9ab8c', claro: '#f6efdd', padrao: 'trama' },
  'tecido.veludo-vinho': { base: '#6e1f2a', escuro: '#3a0c14', claro: '#9a3440', padrao: 'trama' },
  'couro.marrom': { base: '#5c2f1a', escuro: '#2e160b', claro: '#8a4f2c', padrao: 'couro' },
  'latao': { base: '#c49a4a', escuro: '#6e5122', claro: '#f2d68c', padrao: 'metal' },
  'papel.folha': { base: '#eee4cb', escuro: '#bfb294', claro: '#fbf6e8', padrao: 'liso' },
  'vidro': { base: '#5b7a93', escuro: '#22303d', claro: '#a9c4d6', padrao: 'vidro' },
  'cortina.vinho': { base: '#521820', escuro: '#260a0f', claro: '#7c2a33', padrao: 'pregas' },
  'moldura.dourada': { base: '#a8822e', escuro: '#5a4316', claro: '#e0c06a', padrao: 'metal' },
  'pintura.paisagem': { base: '#2a3a3a', escuro: '#131a1c', claro: '#7a8a6a', padrao: 'pintura' },
  'tapete.persa': { base: '#7a1f24', escuro: '#1a2440', claro: '#e6d3a8', padrao: 'persa', borda: '#1a2440', meio: '#b2312e' },
  'parede.topo': { base: '#141218', escuro: '#08070a', claro: '#2a2630', padrao: 'liso' },
  'pedra.escura': { base: '#1b1d22', escuro: '#0c0d10', claro: '#2b2f37', padrao: 'liso' },
};

/** Material de cor pura ('#rrggbb'), usado por detalhes como lombadas de livros. */
export function material(id) {
  if (id?.startsWith('#')) return { base: id, escuro: tom(id, -0.45), claro: tom(id, 0.3), padrao: 'liso' };
  return MATERIAIS[id] ?? MATERIAIS['pedra.escura'];
}

export function tom(hex, t) {
  const p = parseInt(hex.slice(1), 16), alvo = t < 0 ? 0 : 255, k = Math.abs(t);
  const c = [16, 8, 0].map(s => Math.round(((p >> s) & 255) * (1 - k) + alvo * k));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

const ruidos = new Map();
function ruido(seed, celulas = 8) {
  // Poucas variações bastam: o padrão é deslocado e escalado em cada uso.
  seed = ((seed % 5) + 5) % 5;
  const k = `${seed}:${celulas}`;
  if (!ruidos.has(k)) ruidos.set(k, noiseTile(256, seed, celulas));
  return ruidos.get(k);
}

/** Padrão de ruído cobrindo `metros` por ladrilho, desenhado com o contexto em metros. */
function camadaRuido(ctx, area, seed, metros, alpha, modo = 'multiply', celulas = 8) {
  const padrao = ctx.createPattern(ruido(seed, celulas), 'repeat');
  padrao.setTransform(new DOMMatrix().translate((seed * 0.37) % 1 * metros, (seed * 0.61) % 1 * metros).scale(metros / 256));
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = modo; ctx.fillStyle = padrao;
  ctx.fillRect(area.x, area.y, area.w, area.h); ctx.restore();
}

const misturar = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/**
 * Renderizador Ilustrado: pinta o material na área (contexto em metros, já recortado).
 * `dir` gira o padrão (tábuas e veios seguem o comprimento do objeto).
 */
export function pintarIlustrado(ctx, id, area, seed = 1, { dir = 0 } = {}) {
  const m = material(id), r = mulberry32(seed * 7919 + 13);
  ctx.save();
  ctx.fillStyle = m.base; ctx.fillRect(area.x, area.y, area.w, area.h);
  if (dir) { const cx = area.x + area.w / 2, cy = area.y + area.h / 2; ctx.translate(cx, cy); ctx.rotate(dir); ctx.translate(-cx, -cy); }
  const diag = Math.hypot(area.w, area.h), A = { x: area.x + area.w / 2 - diag / 2, y: area.y + area.h / 2 - diag / 2, w: diag, h: diag };
  switch (m.padrao) {
    case 'tabuas': {
      for (let y = A.y, linha = 0; y < A.y + A.h; y += m.largura, linha++) {
        let x = A.x - r() * 2;
        while (x < A.x + A.w) {
          const comp = 1.4 + r() * 2.2;
          ctx.fillStyle = misturar(m.escuro, m.claro, 0.35 + r() * 0.35); ctx.fillRect(x, y, comp, m.largura);
          // veios
          ctx.strokeStyle = m.escuro; ctx.lineWidth = 0.006;
          for (let v = 0; v < 5; v++) {
            const yy = y + m.largura * (0.15 + r() * 0.7); ctx.globalAlpha = 0.18 + r() * 0.2; ctx.beginPath(); ctx.moveTo(x, yy);
            for (let t = 0.2; t <= comp; t += 0.2) ctx.lineTo(x + t, yy + (r() - 0.5) * 0.02);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.85; ctx.fillStyle = m.escuro; ctx.fillRect(x + comp - 0.008, y, 0.012, m.largura);
          if (r() < 0.25) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x + r() * comp, y + m.largura * (0.3 + r() * 0.4), 0.025 + r() * 0.02, 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1; x += comp;
        }
        ctx.fillStyle = m.escuro; ctx.globalAlpha = 0.9; ctx.fillRect(A.x, y - 0.006, A.w, 0.012); ctx.globalAlpha = 1;
      }
      camadaRuido(ctx, A, seed, 3, 0.35);
      break;
    }
    case 'xadrez': {
      const l = m.lado;
      for (let y = Math.floor(A.y / l) * l, j = 0; y < A.y + A.h; y += l, j++) for (let x = Math.floor(A.x / l) * l; x < A.x + A.w; x += l) {
        const escuro = (Math.round(x / l) + Math.round(y / l)) % 2 === 0;
        ctx.fillStyle = misturar(escuro ? m.escuro : m.base, escuro ? m.base : m.claro, r() * 0.12);
        ctx.fillRect(x + 0.006, y + 0.006, l - 0.012, l - 0.012);
      }
      camadaRuido(ctx, A, seed, 2.2, 0.45);
      camadaRuido(ctx, A, seed + 3, 6, 0.3, 'multiply', 4);
      break;
    }
    case 'damasco': {
      camadaRuido(ctx, A, seed, 2, 0.3);
      ctx.fillStyle = m.claro;
      for (let y = A.y; y < A.y + A.h + 0.5; y += 0.52) for (let x = A.x, k = 0; x < A.x + A.w + 0.5; x += 0.42, k++) {
        const cx = x + (Math.round(y / 0.52) % 2 ? 0.21 : 0), cy = y;
        ctx.globalAlpha = 0.55; ctx.beginPath();
        ctx.moveTo(cx, cy - 0.17); ctx.bezierCurveTo(cx + 0.12, cy - 0.08, cx + 0.12, cy + 0.06, cx, cy + 0.17);
        ctx.bezierCurveTo(cx - 0.12, cy + 0.06, cx - 0.12, cy - 0.08, cx, cy - 0.17); ctx.fill();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(cx, cy, 0.035, 0, 7); ctx.fillStyle = m.escuro; ctx.fill(); ctx.fillStyle = m.claro;
      }
      ctx.globalAlpha = 1; camadaRuido(ctx, A, seed + 1, 4, 0.4, 'multiply', 4);
      break;
    }
    case 'listras': {
      for (let x = A.x, k = 0; x < A.x + A.w; x += 0.12, k++) { ctx.fillStyle = k % 2 ? m.claro : m.base; ctx.globalAlpha = 0.7; ctx.fillRect(x, A.y, 0.12, A.h); }
      ctx.globalAlpha = 0.55; ctx.fillStyle = m.ouro; for (let x = A.x; x < A.x + A.w; x += 0.48) ctx.fillRect(x, A.y, 0.012, A.h);
      ctx.globalAlpha = 1; camadaRuido(ctx, A, seed, 3, 0.4, 'multiply', 4);
      break;
    }
    case 'veio': {
      ctx.strokeStyle = m.escuro; ctx.lineWidth = 0.008;
      for (let y = A.y; y < A.y + A.h; y += 0.025) { ctx.globalAlpha = 0.15 + r() * 0.25; ctx.beginPath(); ctx.moveTo(A.x, y); for (let x = A.x; x < A.x + A.w; x += 0.15) ctx.lineTo(x, y + Math.sin(x * 3 + y * 9) * 0.008); ctx.stroke(); }
      ctx.globalAlpha = 1; camadaRuido(ctx, A, seed, 1.5, 0.3);
      break;
    }
    case 'trama': camadaRuido(ctx, A, seed, 0.6, 0.35, 'multiply', 16); camadaRuido(ctx, A, seed + 2, 2, 0.25, 'soft-light'); break;
    case 'couro': camadaRuido(ctx, A, seed, 0.8, 0.4, 'multiply', 12); break;
    case 'metal': camadaRuido(ctx, A, seed, 0.5, 0.3, 'overlay', 6); break;
    case 'vidro': {
      const g = ctx.createLinearGradient(A.x, A.y, A.x + A.w, A.y + A.h);
      g.addColorStop(0, m.escuro); g.addColorStop(0.5, m.base); g.addColorStop(1, m.claro);
      ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h); break;
    }
    case 'pregas': {
      for (let x = A.x; x < A.x + A.w; x += 0.09) { const g = ctx.createLinearGradient(x, 0, x + 0.09, 0); g.addColorStop(0, m.escuro); g.addColorStop(0.5, m.claro); g.addColorStop(1, m.escuro); ctx.fillStyle = g; ctx.globalAlpha = 0.6; ctx.fillRect(x, A.y, 0.09, A.h); }
      ctx.globalAlpha = 1; break;
    }
    case 'pintura': {
      const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g.addColorStop(0, '#3a4a5a'); g.addColorStop(0.55, '#8a7a5a'); g.addColorStop(0.6, '#2a3a2a'); g.addColorStop(1, '#141c18');
      ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h); camadaRuido(ctx, A, seed, 0.4, 0.5, 'overlay', 8); break;
    }
    case 'persa': pintarPersa(ctx, m, area, r); break;
    default: camadaRuido(ctx, A, seed, 2, 0.15);
  }
  ctx.restore();
}

function pintarPersa(ctx, m, a, r) {
  const b = Math.min(a.w, a.h) * 0.11;
  ctx.fillStyle = m.borda; ctx.fillRect(a.x, a.y, a.w, a.h);
  ctx.fillStyle = m.base; ctx.fillRect(a.x + b, a.y + b, a.w - 2 * b, a.h - 2 * b);
  // faixas da borda
  ctx.strokeStyle = m.claro; ctx.lineWidth = 0.02;
  for (const k of [0.25, 0.75]) ctx.strokeRect(a.x + b * k, a.y + b * k, a.w - 2 * b * k, a.h - 2 * b * k);
  ctx.fillStyle = m.meio;
  for (let x = a.x + b * 0.5; x < a.x + a.w - b * 0.4; x += b * 0.6) for (const y of [a.y + b * 0.5, a.y + a.h - b * 0.5]) { ctx.beginPath(); ctx.arc(x, y, b * 0.16, 0, 7); ctx.fill(); }
  for (let y = a.y + b * 0.5; y < a.y + a.h - b * 0.4; y += b * 0.6) for (const x of [a.x + b * 0.5, a.x + a.w - b * 0.5]) { ctx.beginPath(); ctx.arc(x, y, b * 0.16, 0, 7); ctx.fill(); }
  // campo com motivos
  ctx.fillStyle = m.escuro; ctx.globalAlpha = 0.45;
  for (let y = a.y + b * 1.6; y < a.y + a.h - b * 1.2; y += 0.28) for (let x = a.x + b * 1.6; x < a.x + a.w - b * 1.2; x += 0.28) {
    ctx.beginPath(); ctx.moveTo(x, y - 0.07); ctx.lineTo(x + 0.05, y); ctx.lineTo(x, y + 0.07); ctx.lineTo(x - 0.05, y); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // medalhão
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2, rx = a.w * 0.2, ry = a.h * 0.28;
  ctx.fillStyle = m.borda; ctx.beginPath(); ctx.moveTo(cx - rx * 1.3, cy); ctx.lineTo(cx, cy - ry * 1.15); ctx.lineTo(cx + rx * 1.3, cy); ctx.lineTo(cx, cy + ry * 1.15); ctx.fill();
  ctx.fillStyle = m.claro; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.75, ry * 0.7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = m.meio; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.5, ry * 0.45, 0, 0, 7); ctx.fill();
  ctx.fillStyle = m.borda; for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; ctx.beginPath(); ctx.arc(cx + Math.cos(t) * rx * 0.62, cy + Math.sin(t) * ry * 0.58, Math.min(rx, ry) * 0.07, 0, 7); ctx.fill(); }
  // franjas
  ctx.strokeStyle = m.claro; ctx.lineWidth = 0.012; ctx.globalAlpha = 0.8;
  for (let y = a.y + 0.03; y < a.y + a.h; y += 0.05) for (const x of [a.x, a.x + a.w]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x === a.x ? -0.09 : 0.09), y + (r() - 0.5) * 0.02); ctx.stroke(); }
  ctx.globalAlpha = 1;
  camadaRuido(ctx, a, 7, 2, 0.35);
}

/**
 * Renderizador Pixel: pinta o mesmo material com padrões que cabem na grade de pixels.
 * `px` é o tamanho de um pixel em metros; os padrões se alinham a ele.
 */
export function pintarPixel(ctx, id, area, seed = 1, { dir = 0, px = 0.1 } = {}) {
  const m = material(id), r = mulberry32(seed * 7919 + 13);
  ctx.save();
  ctx.fillStyle = m.base; ctx.fillRect(area.x, area.y, area.w, area.h);
  if (dir) { const cx = area.x + area.w / 2, cy = area.y + area.h / 2; ctx.translate(cx, cy); ctx.rotate(dir); ctx.translate(-cx, -cy); }
  const diag = Math.hypot(area.w, area.h), A = { x: area.x + area.w / 2 - diag / 2, y: area.y + area.h / 2 - diag / 2, w: diag, h: diag };
  const snap = v => Math.round(v / px) * px;
  switch (m.padrao) {
    case 'tabuas': {
      const alt = Math.max(3, Math.round(m.largura / px) + 1) * px, junta = misturar(m.base, m.escuro, 0.45);
      for (let y = snap(A.y); y < A.y + A.h; y += alt) {
        let x = snap(A.x - r() * 2);
        while (x < A.x + A.w) {
          const comp = snap(1.4 + r() * 2.2);
          ctx.fillStyle = r() < 0.5 ? m.base : misturar(m.base, m.claro, 0.18); ctx.fillRect(x, y, comp, alt);
          ctx.fillStyle = junta; ctx.fillRect(x + comp - px, y, px, alt); x += comp;
        }
        ctx.fillStyle = junta; ctx.fillRect(A.x, y, A.w, px);
      }
      break;
    }
    case 'xadrez': {
      const l = Math.max(2, Math.round(m.lado / px)) * px;
      for (let y = Math.floor(A.y / l) * l; y < A.y + A.h; y += l) for (let x = Math.floor(A.x / l) * l; x < A.x + A.w; x += l) {
        ctx.fillStyle = (Math.round(x / l) + Math.round(y / l)) % 2 === 0 ? m.escuro : m.claro; ctx.fillRect(x, y, l, l);
      }
      break;
    }
    case 'damasco': {
      ctx.fillStyle = m.claro;
      for (let y = snap(A.y); y < A.y + A.h; y += 5 * px) for (let x = snap(A.x); x < A.x + A.w; x += 4 * px) {
        const ox = (Math.round(y / (5 * px)) % 2) * 2 * px;
        ctx.fillRect(x + ox, y, px, px * 2); ctx.fillRect(x + ox - px, y + px * 0.5, px * 3, px);
      }
      break;
    }
    case 'listras': for (let x = snap(A.x), k = 0; x < A.x + A.w; x += px * 2, k++) { ctx.fillStyle = k % 2 ? m.claro : m.base; ctx.fillRect(x, A.y, px * 2, A.h); } break;
    case 'persa': {
      const b = Math.max(2 * px, snap(Math.min(area.w, area.h) * 0.11));
      ctx.fillStyle = m.borda; ctx.fillRect(area.x, area.y, area.w, area.h);
      ctx.fillStyle = m.base; ctx.fillRect(area.x + b, area.y + b, area.w - 2 * b, area.h - 2 * b);
      ctx.fillStyle = m.claro; ctx.fillRect(area.x + px, area.y + px, area.w - 2 * px, px); ctx.fillRect(area.x + px, area.y + area.h - 2 * px, area.w - 2 * px, px);
      ctx.fillRect(area.x + px, area.y + px, px, area.h - 2 * px); ctx.fillRect(area.x + area.w - 2 * px, area.y + px, px, area.h - 2 * px);
      const cx = area.x + area.w / 2, cy = area.y + area.h / 2, rx = snap(area.w * 0.22), ry = snap(area.h * 0.3);
      ctx.fillStyle = m.borda; ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx, cy - ry); ctx.lineTo(cx + rx, cy); ctx.lineTo(cx, cy + ry); ctx.fill();
      ctx.fillStyle = m.claro; ctx.fillRect(snap(cx - rx * 0.35), snap(cy - ry * 0.25), snap(rx * 0.7), snap(ry * 0.5));
      ctx.fillStyle = m.meio; ctx.fillRect(snap(cx - px), snap(cy - px), 2 * px, 2 * px);
      break;
    }
    case 'vidro': ctx.fillStyle = m.claro; ctx.fillRect(area.x + px, area.y + px, px, area.h - 2 * px); break;
    case 'pregas': for (let x = snap(A.x), k = 0; x < A.x + A.w; x += px, k++) { ctx.fillStyle = k % 3 === 0 ? m.escuro : k % 3 === 1 ? m.base : m.claro; ctx.fillRect(x, A.y, px, A.h); } break;
    case 'pintura': ctx.fillStyle = '#3a4a5a'; ctx.fillRect(area.x, area.y, area.w, area.h * 0.55); ctx.fillStyle = '#1d2a1f'; ctx.fillRect(area.x, area.y + area.h * 0.55, area.w, area.h * 0.45); break;
    default: break;
  }
  ctx.restore();
}


