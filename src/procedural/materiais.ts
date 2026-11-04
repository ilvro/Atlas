import type { Contexto } from './canvas.ts';
import { ladrilhoDeRuido, mulberry32 } from './ruido.ts';

export type Padrao = 'tabuas' | 'xadrez' | 'damasco' | 'listras' | 'veio' | 'trama' | 'couro' | 'metal' | 'vidro' | 'pregas' | 'pintura' | 'persa' | 'laje' | 'liso' | 'grama' | 'terra' | 'areia' | 'pedra' | 'neve' | 'lama' | 'espinha' | 'marmore' | 'losango' | 'hexagono' | 'floral' | 'lambri';
export interface Material {
  id: string; nome: string; /** Para onde o material vai: piso, papel de parede, objeto ou terreno. */ uso: 'piso' | 'papel' | 'objeto' | 'terreno' | 'telhado';
  base: string; escuro: string; claro: string; padrao: Padrao; largura?: number; lado?: number; ouro?: string; borda?: string; meio?: string;
}

const m = (id: string, nome: string, uso: Material['uso'], base: string, escuro: string, claro: string, padrao: Padrao, extra: Partial<Material> = {}): [string, Material] => [id, { id, nome, uso, base, escuro, claro, padrao, ...extra }];

/** Uma descrição por material. O renderizador Ilustrado pinta; o Pixel (Fase 8) pintará a mesma descrição com a paleta. */
export const MATERIAIS: Readonly<Record<string, Material>> = Object.fromEntries([
  // Pisos
  m('tabuas.carvalho', 'Tábuas de carvalho', 'piso', '#7a4a2a', '#3a2214', '#a8703e', 'tabuas', { largura: 0.2 }),
  m('tabuas.escuras', 'Tábuas escuras', 'piso', '#4a2e1e', '#20120a', '#6d4630', 'tabuas', { largura: 0.18 }),
  m('tabuas.claras', 'Tábuas claras', 'piso', '#b98d5a', '#6e4a28', '#dcb888', 'tabuas', { largura: 0.22 }),
  m('ladrilho.xadrez', 'Xadrez preto e branco', 'piso', '#d4c9b0', '#262226', '#efe6cf', 'xadrez', { lado: 0.5 }),
  m('ladrilho.cozinha', 'Ladrilho de cozinha', 'piso', '#c9c1a8', '#8a8266', '#e9e3cf', 'xadrez', { lado: 0.3 }),
  m('ladrilho.azul', 'Ladrilho azul', 'piso', '#5d7d96', '#2c4358', '#9bb8cc', 'xadrez', { lado: 0.3 }),
  m('azulejo.branco', 'Azulejo branco', 'piso', '#dcdcd6', '#9a9a92', '#f5f5f0', 'xadrez', { lado: 0.25 }),
  m('laje.pedra', 'Lajes de pedra', 'piso', '#6b6e75', '#2e3036', '#9a9da5', 'laje'),
  m('concreto', 'Concreto', 'piso', '#6c6a66', '#34322f', '#8d8a85', 'liso'),
  m('carpete.vinho', 'Carpete vinho', 'piso', '#5a1b25', '#2c0c12', '#7d2b36', 'trama'),
  m('carpete.cinza', 'Carpete cinza', 'piso', '#4d4f55', '#272830', '#6c6e76', 'trama'),
  m('parquet.espinha', 'Parquet em espinha de peixe', 'piso', '#8a5a34', '#4a2e18', '#c08a54', 'espinha'),
  m('marmore.branco', 'Mármore branco', 'piso', '#d4d2cb', '#8d8b84', '#efede6', 'marmore', { lado: 0.9 }),
  m('marmore.xadrez-diagonal', 'Mármore preto e branco em diagonal', 'piso', '#dcd8cf', '#25232a', '#f2eee4', 'losango', { lado: 0.5 }),
  m('hexagono.salvia', 'Hexágonos verde-sálvia', 'piso', '#8a9a7b', '#4a5642', '#b5c3a6', 'hexagono', { lado: 0.2 }),
  m('hexagono.terracota', 'Hexágonos de terracota', 'piso', '#b9653a', '#6b3018', '#d68c5e', 'hexagono', { lado: 0.2 }),
  m('tabuas.cinza', 'Tábuas cinza (pintadas)', 'piso', '#7d8186', '#3d4044', '#a9adb2', 'tabuas', { largura: 0.2 }),
  // Papéis e paredes
  m('papel.damasco-vinho', 'Damasco vinho', 'papel', '#4f1820', '#2c0c12', '#7d2b33', 'damasco'),
  m('papel.damasco-azul', 'Damasco azul', 'papel', '#1f3350', '#0e1a2b', '#3a5a86', 'damasco'),
  m('papel.listras-musgo', 'Listras verde-musgo', 'papel', '#22362a', '#15211a', '#3a5a40', 'listras', { ouro: '#9a7a3a' }),
  m('papel.listras-creme', 'Listras creme', 'papel', '#cdbf9c', '#8a7e60', '#e8dcba', 'listras', { ouro: '#a88a4a' }),
  m('papel.liso-claro', 'Liso claro', 'papel', '#b7ab90', '#7f755f', '#d4c9ac', 'liso'),
  m('papel.liso-escuro', 'Liso escuro', 'papel', '#2c2a30', '#16151a', '#46434d', 'liso'),
  m('reboco.branco', 'Reboco branco', 'papel', '#cfcbc0', '#8c8878', '#e8e5db', 'liso'),
  m('tijolo', 'Tijolo aparente', 'papel', '#7a3f30', '#3d1d15', '#a35a46', 'laje'),
  m('papel.floral-azul', 'Floral azul', 'papel', '#d4dce6', '#8b98ad', '#3f5f8e', 'floral', { ouro: '#c9a45a' }),
  m('papel.floral-rosa', 'Floral rosa', 'papel', '#e6d2d2', '#a98a8a', '#a8465f', 'floral', { ouro: '#b08a3a' }),
  m('papel.verde-esmeralda', 'Damasco verde-esmeralda', 'papel', '#1d4a3a', '#0e261e', '#3d7a5e', 'damasco'),
  m('papel.bordo-listras', 'Listras bordô', 'papel', '#4a1820', '#25090e', '#8a2d3a', 'listras', { ouro: '#b08a3a' }),
  m('papel.azul-listras', 'Listras azul-marinho', 'papel', '#1f3350', '#0e1a2b', '#4a6a96', 'listras', { ouro: '#c9a45a' }),
  m('boiserie.escura', 'Boiserie de madeira escura', 'papel', '#4a2e1e', '#20120a', '#7a4e32', 'lambri'),
  m('boiserie.verde', 'Boiserie verde-musgo', 'papel', '#2f4a38', '#15261c', '#4f7a5c', 'lambri'),
  // Objetos
  m('madeira.escura', 'Madeira escura', 'objeto', '#3d2416', '#1e110a', '#6b4024', 'veio'),
  m('madeira.media', 'Madeira média', 'objeto', '#74431f', '#3d2312', '#a46a36', 'veio'),
  m('madeira.clara', 'Madeira clara', 'objeto', '#b88a55', '#6e4a28', '#dcb888', 'veio'),
  m('tecido.linho', 'Linho', 'objeto', '#e6dbc3', '#b9ab8c', '#f6efdd', 'trama'),
  m('tecido.veludo-vinho', 'Veludo vinho', 'objeto', '#6e1f2a', '#3a0c14', '#9a3440', 'trama'),
  m('tecido.veludo-azul', 'Veludo azul', 'objeto', '#233e63', '#10203a', '#3c609a', 'trama'),
  m('tecido.verde', 'Tecido verde', 'objeto', '#2f4a32', '#172a1a', '#4f7346', 'trama'),
  m('tecido.cinza', 'Tecido cinza', 'objeto', '#6b6f76', '#34363b', '#9a9ea6', 'trama'),
  m('tecido.mostarda', 'Tecido mostarda', 'objeto', '#b8892a', '#6b4d10', '#dcb04e', 'trama'),
  m('tecido.salvia', 'Tecido verde-sálvia', 'objeto', '#8a9a7b', '#4a5642', '#b5c3a6', 'trama'),
  m('couro.marrom', 'Couro marrom', 'objeto', '#5c2f1a', '#2e160b', '#8a4f2c', 'couro'),
  m('latao', 'Latão', 'objeto', '#c49a4a', '#6e5122', '#f2d68c', 'metal'),
  m('ferro', 'Ferro', 'objeto', '#3b3d44', '#17181c', '#6a6d77', 'metal'),
  m('porcelana', 'Porcelana', 'objeto', '#e7e7e2', '#a6a6a0', '#ffffff', 'liso'),
  m('papel.folha', 'Folha de papel', 'objeto', '#eee4cb', '#bfb294', '#fbf6e8', 'liso'),
  m('vidro', 'Vidro', 'objeto', '#5b7a93', '#22303d', '#a9c4d6', 'vidro'),
  m('cortina.vinho', 'Cortina vinho', 'objeto', '#521820', '#260a0f', '#7c2a33', 'pregas'),
  m('moldura.dourada', 'Moldura dourada', 'objeto', '#a8822e', '#5a4316', '#e0c06a', 'metal'),
  m('pintura.paisagem', 'Pintura de paisagem', 'objeto', '#2a3a3a', '#131a1c', '#7a8a6a', 'pintura'),
  m('tapete.persa', 'Tapete persa', 'objeto', '#7a1f24', '#1a2440', '#e6d3a8', 'persa', { borda: '#1a2440', meio: '#b2312e' }),
  m('tapete.verde', 'Tapete persa verde', 'objeto', '#2f4a32', '#14221a', '#d9c98e', 'persa', { borda: '#14221a', meio: '#4f7346' }),
  m('telha.barro', 'Telha de barro', 'telhado', '#8a4a32', '#5a2e20', '#b0674a', 'listras'),
  m('telha.ardosia', 'Ardósia', 'telhado', '#3d444f', '#232830', '#5a6475', 'laje'),
  m('telha.palha', 'Palha', 'telhado', '#a8884a', '#6e5830', '#cdae6a', 'trama'),
  m('folhagem', 'Folhagem', 'objeto', '#2f5a34', '#14301a', '#5f9a4e', 'grama'),
  m('parede.topo', 'Topo de parede', 'objeto', '#141218', '#08070a', '#2a2630', 'liso'),
  m('pedra.escura', 'Pedra escura', 'objeto', '#1b1d22', '#0c0d10', '#2b2f37', 'liso'),
  // Terreno
  m('grama', 'Grama', 'terreno', '#3f6b34', '#234a1f', '#6a9a4a', 'grama'),
  m('terra', 'Terra', 'terreno', '#6a4d33', '#3b2a1a', '#8d6c49', 'terra'),
  m('areia', 'Areia', 'terreno', '#c8b27c', '#9a8650', '#e6d6a4', 'areia'),
  m('pedregulho', 'Pedregulho', 'terreno', '#6f6c66', '#3a3834', '#a09c94', 'pedra'),
  m('lama', 'Lama', 'terreno', '#4a3a28', '#2a1f14', '#6a5640', 'lama'),
  m('neve', 'Neve', 'terreno', '#e6ecf2', '#aab8c8', '#ffffff', 'neve'),
  m('calcada', 'Calçada', 'terreno', '#7d7b78', '#45433f', '#a8a5a0', 'laje'),
].map(([id, mat]) => [id as string, mat as Material])) as Record<string, Material>;

export const materialDe = (id: string): Material => {
  if (id.startsWith('#')) return { id, nome: id, uso: 'objeto', base: id, escuro: tom(id, -0.45), claro: tom(id, 0.3), padrao: 'liso' };
  return MATERIAIS[id] ?? MATERIAIS['pedra.escura']!;
};
export const materiaisDo = (uso: Material['uso']): Material[] => Object.values(MATERIAIS).filter(x => x.uso === uso);

/** Clareia (`t > 0`) ou escurece (`t < 0`) uma cor #rrggbb. */
export function tom(hex: string, t: number): string {
  const p = parseInt(hex.slice(1), 16), alvo = t < 0 ? 0 : 255, k = Math.abs(t);
  return '#' + [16, 8, 0].map(s => Math.round(((p >> s) & 255) * (1 - k) + alvo * k).toString(16).padStart(2, '0')).join('');
}
const misturar = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = [16, 8, 0].map(s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Poucas variações de ruído bastam: o padrão é deslocado e escalado em cada uso (gerar um ladrilho por parte levou o protótipo a 20 s).
const ruidos = new Map<string, ReturnType<typeof ladrilhoDeRuido>>();
function ruido(seed: number, celulas: number) {
  const s = ((seed % 5) + 5) % 5, k = `${s}:${celulas}`;
  let t = ruidos.get(k); if (!t) { t = ladrilhoDeRuido(256, s, celulas); ruidos.set(k, t); }
  return t;
}

export interface Area { x: number; y: number; w: number; h: number }

function camadaDeRuido(ctx: Contexto, area: Area, seed: number, metros: number, alpha: number, modo: GlobalCompositeOperation = 'multiply', celulas = 8): void {
  const padrao = ctx.createPattern(ruido(seed, celulas), 'repeat'); if (!padrao) return;
  padrao.setTransform(new DOMMatrix().translate(((seed * 0.37) % 1) * metros, ((seed * 0.61) % 1) * metros).scale(metros / 256));
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = modo; ctx.fillStyle = padrao; ctx.fillRect(area.x, area.y, area.w, area.h); ctx.restore();
}

/**
 * Renderizador Ilustrado: pinta o material em `area` (o contexto já está em metros e recortado).
 * `dir` gira o padrão (tábuas e veios seguem o comprimento do objeto).
 */
export function pintarMaterial(ctx: Contexto, id: string, area: Area, seed = 1, { dir = 0 }: { dir?: number } = {}): void {
  const mat = materialDe(id), r = mulberry32(seed * 7919 + 13);
  ctx.save();
  ctx.fillStyle = mat.base; ctx.fillRect(area.x, area.y, area.w, area.h);
  if (dir) { const cx = area.x + area.w / 2, cy = area.y + area.h / 2; ctx.translate(cx, cy); ctx.rotate(dir); ctx.translate(-cx, -cy); }
  const diag = Math.hypot(area.w, area.h), A: Area = { x: area.x + area.w / 2 - diag / 2, y: area.y + area.h / 2 - diag / 2, w: diag, h: diag };
  switch (mat.padrao) {
    case 'tabuas': {
      const larg = mat.largura ?? 0.2;
      for (let y = A.y; y < A.y + A.h; y += larg) {
        let x = A.x - r() * 2;
        while (x < A.x + A.w) {
          const comp = 1.4 + r() * 2.2;
          ctx.fillStyle = misturar(mat.escuro, mat.claro, 0.35 + r() * 0.35); ctx.fillRect(x, y, comp, larg);
          ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.006;
          for (let v = 0; v < 5; v++) { const yy = y + larg * (0.15 + r() * 0.7); ctx.globalAlpha = 0.18 + r() * 0.2; ctx.beginPath(); ctx.moveTo(x, yy); for (let t = 0.2; t <= comp; t += 0.2) ctx.lineTo(x + t, yy + (r() - 0.5) * 0.02); ctx.stroke(); }
          ctx.globalAlpha = 0.85; ctx.fillStyle = mat.escuro; ctx.fillRect(x + comp - 0.008, y, 0.012, larg);
          if (r() < 0.25) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x + r() * comp, y + larg * (0.3 + r() * 0.4), 0.025 + r() * 0.02, 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1; x += comp;
        }
        ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.9; ctx.fillRect(A.x, y - 0.006, A.w, 0.012); ctx.globalAlpha = 1;
      }
      camadaDeRuido(ctx, A, seed, 3, 0.35); break;
    }
    case 'xadrez': {
      const l = mat.lado ?? 0.5;
      for (let y = Math.floor(A.y / l) * l; y < A.y + A.h; y += l) for (let x = Math.floor(A.x / l) * l; x < A.x + A.w; x += l) {
        const escuro = (Math.round(x / l) + Math.round(y / l)) % 2 === 0;
        ctx.fillStyle = misturar(escuro ? mat.escuro : mat.base, escuro ? mat.base : mat.claro, r() * 0.12); ctx.fillRect(x + 0.006, y + 0.006, l - 0.012, l - 0.012);
      }
      camadaDeRuido(ctx, A, seed, 2.2, 0.45); camadaDeRuido(ctx, A, seed + 3, 6, 0.3, 'multiply', 4); break;
    }
    case 'laje': {
      // Lajes irregulares: fileiras de alturas diferentes, juntas escuras.
      for (let y = A.y; y < A.y + A.h; y += 0.42 + r() * 0.2) {
        const alt = 0.42 + r() * 0.2; let x = A.x - r();
        while (x < A.x + A.w) { const comp = 0.5 + r() * 0.8; ctx.fillStyle = misturar(mat.base, mat.claro, r() * 0.45); ctx.fillRect(x + 0.012, y + 0.012, comp - 0.024, alt - 0.024); x += comp; }
        ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.7; ctx.fillRect(A.x, y, A.w, 0.02); ctx.globalAlpha = 1;
      }
      camadaDeRuido(ctx, A, seed, 1.4, 0.5, 'multiply', 6); break;
    }
    case 'damasco': {
      camadaDeRuido(ctx, A, seed, 2, 0.3); ctx.fillStyle = mat.claro;
      for (let y = A.y; y < A.y + A.h + 0.5; y += 0.52) for (let x = A.x; x < A.x + A.w + 0.5; x += 0.42) {
        const cx = x + (Math.round(y / 0.52) % 2 ? 0.21 : 0), cy = y;
        ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(cx, cy - 0.17); ctx.bezierCurveTo(cx + 0.12, cy - 0.08, cx + 0.12, cy + 0.06, cx, cy + 0.17); ctx.bezierCurveTo(cx - 0.12, cy + 0.06, cx - 0.12, cy - 0.08, cx, cy - 0.17); ctx.fill();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(cx, cy, 0.035, 0, 7); ctx.fillStyle = mat.escuro; ctx.fill(); ctx.fillStyle = mat.claro;
      }
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed + 1, 4, 0.4, 'multiply', 4); break;
    }
    case 'listras': {
      for (let x = A.x, k = 0; x < A.x + A.w; x += 0.12, k++) { ctx.fillStyle = k % 2 ? mat.claro : mat.base; ctx.globalAlpha = 0.7; ctx.fillRect(x, A.y, 0.12, A.h); }
      ctx.globalAlpha = 0.55; ctx.fillStyle = mat.ouro ?? mat.claro; for (let x = A.x; x < A.x + A.w; x += 0.48) ctx.fillRect(x, A.y, 0.012, A.h);
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed, 3, 0.4, 'multiply', 4); break;
    }
    case 'veio': {
      ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.008;
      for (let y = A.y; y < A.y + A.h; y += 0.025) { ctx.globalAlpha = 0.15 + r() * 0.25; ctx.beginPath(); ctx.moveTo(A.x, y); for (let x = A.x; x < A.x + A.w; x += 0.15) ctx.lineTo(x, y + Math.sin(x * 3 + y * 9) * 0.008); ctx.stroke(); }
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed, 1.5, 0.3); break;
    }
    case 'espinha': {
      // Espinha de peixe: tábuas 2:1 em degraus (horizontal onde i+j é par, vertical onde é ímpar), com o conjunto girado 45°.
      const u = 0.13, cx = A.x + A.w / 2, cy = A.y + A.h / 2, n = Math.ceil(diag / u / 2) + 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
        const h = (i + j) % 2 === 0, x = i * u, y = j * u, w = h ? 2 * u : u, l = h ? u : 2 * u;
        ctx.fillStyle = misturar(mat.escuro, mat.claro, 0.3 + r() * 0.5); ctx.fillRect(x + 0.004, y + 0.004, w - 0.008, l - 0.008);
        ctx.globalAlpha = 0.25; ctx.fillStyle = mat.escuro; ctx.fillRect(x + (h ? 0 : u * 0.25), y + (h ? u * 0.25 : 0), h ? w : 0.006, h ? 0.006 : l); ctx.globalAlpha = 1;
      }
      ctx.restore(); camadaDeRuido(ctx, A, seed, 2.5, 0.3); break;
    }
    case 'marmore': {
      // Lajes grandes de mármore com veios e juntas finas.
      const l = mat.lado ?? 0.8;
      for (let y = Math.floor(A.y / l) * l; y < A.y + A.h; y += l) for (let x = Math.floor(A.x / l) * l; x < A.x + A.w; x += l) {
        ctx.fillStyle = misturar(mat.base, mat.claro, r() * 0.6); ctx.fillRect(x + 0.008, y + 0.008, l - 0.016, l - 0.016);
        ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.006;
        for (let v = 0; v < 3; v++) { ctx.globalAlpha = 0.2 + r() * 0.3; ctx.beginPath(); ctx.moveTo(x + r() * l, y); ctx.bezierCurveTo(x + r() * l, y + l * 0.3, x + r() * l, y + l * 0.6, x + r() * l, y + l); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      camadaDeRuido(ctx, A, seed, 1.6, 0.25, 'soft-light', 6); break;
    }
    case 'losango': {
      // Xadrez em diagonal (mármore preto e branco).
      const l = mat.lado ?? 0.5, cx = A.x + A.w / 2, cy = A.y + A.h / 2, n = Math.ceil(diag / l / 2) + 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) { const escuro = (i + j) % 2 === 0; ctx.fillStyle = misturar(escuro ? mat.escuro : mat.base, escuro ? mat.base : mat.claro, r() * 0.14); ctx.fillRect(i * l + 0.005, j * l + 0.005, l - 0.01, l - 0.01); }
      ctx.restore(); camadaDeRuido(ctx, A, seed, 2.2, 0.4); break;
    }
    case 'hexagono': {
      const R = mat.lado ?? 0.2, dx = R * 1.732, dy = R * 1.5;
      for (let j = Math.floor(A.y / dy) - 1; j * dy < A.y + A.h + dy; j++) for (let i = Math.floor(A.x / dx) - 1; i * dx < A.x + A.w + dx; i++) {
        const cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * dy; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * (R - 0.01), cy + Math.sin(a) * (R - 0.01)); }
        ctx.closePath(); ctx.fillStyle = misturar(mat.base, r() < 0.5 ? mat.claro : mat.escuro, r() * 0.35); ctx.fill();
      }
      camadaDeRuido(ctx, A, seed, 1.8, 0.4, 'multiply', 6); break;
    }
    case 'floral': {
      // Papel de parede florido: flores de cinco pétalas em meia-queda, com folhas.
      camadaDeRuido(ctx, A, seed, 2, 0.25);
      for (let y = A.y; y < A.y + A.h + 0.4; y += 0.34) for (let x = A.x; x < A.x + A.w + 0.4; x += 0.34) {
        const cx = x + (Math.round(y / 0.34) % 2 ? 0.17 : 0) + (r() - 0.5) * 0.02, cy = y;
        ctx.globalAlpha = 0.5; ctx.fillStyle = mat.escuro; for (const a of [0.8, 2.4]) { ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 0.08, cy + Math.sin(a) * 0.08, 0.05, 0.022, a, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.75; ctx.fillStyle = mat.claro; for (let k = 0; k < 5; k++) { const a = (k * Math.PI * 2) / 5; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 0.04, cy + Math.sin(a) * 0.04, 0.032, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.9; ctx.fillStyle = mat.ouro ?? mat.escuro; ctx.beginPath(); ctx.arc(cx, cy, 0.016, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed + 1, 4, 0.35, 'multiply', 4); break;
    }
    case 'lambri': {
      // Boiserie: painéis de madeira com moldura, em duas fileiras, e rodapé.
      const w = 0.62, h = 1.1;
      for (let x = A.x; x < A.x + A.w; x += w + 0.06) for (let y = A.y; y < A.y + A.h; y += h + 0.06) {
        ctx.fillStyle = misturar(mat.base, mat.claro, 0.15 + r() * 0.15); ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.012; ctx.globalAlpha = 0.8; ctx.strokeRect(x + 0.05, y + 0.05, w - 0.1, h - 0.1);
        ctx.strokeStyle = mat.claro; ctx.globalAlpha = 0.4; ctx.strokeRect(x + 0.075, y + 0.075, w - 0.15, h - 0.15); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.6; for (let y = A.y; y < A.y + A.h; y += h + 0.06) ctx.fillRect(A.x, y + h, A.w, 0.06); ctx.globalAlpha = 1;
      camadaDeRuido(ctx, A, seed, 1.8, 0.4); break;
    }
    case 'trama': camadaDeRuido(ctx, A, seed, 0.6, 0.35, 'multiply', 16); camadaDeRuido(ctx, A, seed + 2, 2, 0.25, 'soft-light'); break;
    case 'couro': camadaDeRuido(ctx, A, seed, 0.8, 0.4, 'multiply', 12); break;
    case 'metal': camadaDeRuido(ctx, A, seed, 0.5, 0.3, 'overlay', 6); break;
    case 'vidro': { const g = ctx.createLinearGradient(A.x, A.y, A.x + A.w, A.y + A.h); g.addColorStop(0, mat.escuro); g.addColorStop(0.5, mat.base); g.addColorStop(1, mat.claro); ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h); break; }
    case 'pregas': {
      for (let x = A.x; x < A.x + A.w; x += 0.09) { const g = ctx.createLinearGradient(x, 0, x + 0.09, 0); g.addColorStop(0, mat.escuro); g.addColorStop(0.5, mat.claro); g.addColorStop(1, mat.escuro); ctx.fillStyle = g; ctx.globalAlpha = 0.6; ctx.fillRect(x, A.y, 0.09, A.h); }
      ctx.globalAlpha = 1; break;
    }
    case 'pintura': { const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g.addColorStop(0, '#3a4a5a'); g.addColorStop(0.55, '#8a7a5a'); g.addColorStop(0.6, '#2a3a2a'); g.addColorStop(1, '#141c18'); ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h); camadaDeRuido(ctx, A, seed, 0.4, 0.5, 'overlay', 8); break; }
    case 'persa': pintarPersa(ctx, mat, area, r); break;
    case 'grama': {
      camadaDeRuido(ctx, A, seed, 1.2, 0.5, 'multiply', 8);
      for (let i = 0; i < Math.min(4000, (A.w * A.h) * 18); i++) { ctx.fillStyle = misturar(mat.escuro, mat.claro, r()); ctx.globalAlpha = 0.25 + r() * 0.35; ctx.fillRect(A.x + r() * A.w, A.y + r() * A.h, 0.02, 0.07 + r() * 0.06); }
      ctx.globalAlpha = 1; break;
    }
    case 'terra': case 'lama': case 'areia': {
      camadaDeRuido(ctx, A, seed, mat.padrao === 'areia' ? 0.9 : 1.6, 0.55, 'multiply', 10); camadaDeRuido(ctx, A, seed + 2, 5, 0.3, 'overlay', 5);
      for (let i = 0; i < Math.min(1500, A.w * A.h * 6); i++) { ctx.fillStyle = r() < 0.5 ? mat.escuro : mat.claro; ctx.globalAlpha = 0.2 + r() * 0.3; ctx.beginPath(); ctx.arc(A.x + r() * A.w, A.y + r() * A.h, 0.012 + r() * 0.03, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; break;
    }
    case 'pedra': {
      camadaDeRuido(ctx, A, seed, 0.9, 0.5, 'multiply', 8);
      for (let i = 0; i < Math.min(900, A.w * A.h * 3); i++) { const cx = A.x + r() * A.w, cy = A.y + r() * A.h, rr = 0.04 + r() * 0.12; ctx.fillStyle = misturar(mat.escuro, mat.claro, r()); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; break;
    }
    case 'neve': camadaDeRuido(ctx, A, seed, 2.5, 0.35, 'multiply', 6); camadaDeRuido(ctx, A, seed + 1, 0.7, 0.2, 'soft-light', 10); break;
    default: camadaDeRuido(ctx, A, seed, 2, 0.15);
  }
  ctx.restore();
}

function pintarPersa(ctx: Contexto, mat: Material, a: Area, r: () => number): void {
  const b = Math.min(a.w, a.h) * 0.11, borda = mat.borda ?? mat.escuro, meio = mat.meio ?? mat.claro;
  ctx.fillStyle = borda; ctx.fillRect(a.x, a.y, a.w, a.h); ctx.fillStyle = mat.base; ctx.fillRect(a.x + b, a.y + b, a.w - 2 * b, a.h - 2 * b);
  ctx.strokeStyle = mat.claro; ctx.lineWidth = 0.02;
  for (const k of [0.25, 0.75]) ctx.strokeRect(a.x + b * k, a.y + b * k, a.w - 2 * b * k, a.h - 2 * b * k);
  ctx.fillStyle = meio;
  for (let x = a.x + b * 0.5; x < a.x + a.w - b * 0.4; x += b * 0.6) for (const y of [a.y + b * 0.5, a.y + a.h - b * 0.5]) { ctx.beginPath(); ctx.arc(x, y, b * 0.16, 0, 7); ctx.fill(); }
  for (let y = a.y + b * 0.5; y < a.y + a.h - b * 0.4; y += b * 0.6) for (const x of [a.x + b * 0.5, a.x + a.w - b * 0.5]) { ctx.beginPath(); ctx.arc(x, y, b * 0.16, 0, 7); ctx.fill(); }
  ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.45;
  for (let y = a.y + b * 1.6; y < a.y + a.h - b * 1.2; y += 0.28) for (let x = a.x + b * 1.6; x < a.x + a.w - b * 1.2; x += 0.28) { ctx.beginPath(); ctx.moveTo(x, y - 0.07); ctx.lineTo(x + 0.05, y); ctx.lineTo(x, y + 0.07); ctx.lineTo(x - 0.05, y); ctx.fill(); }
  ctx.globalAlpha = 1;
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2, rx = a.w * 0.2, ry = a.h * 0.28;
  ctx.fillStyle = borda; ctx.beginPath(); ctx.moveTo(cx - rx * 1.3, cy); ctx.lineTo(cx, cy - ry * 1.15); ctx.lineTo(cx + rx * 1.3, cy); ctx.lineTo(cx, cy + ry * 1.15); ctx.fill();
  ctx.fillStyle = mat.claro; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.75, ry * 0.7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = meio; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.5, ry * 0.45, 0, 0, 7); ctx.fill();
  ctx.fillStyle = borda; for (let i = 0; i < 8; i++) { const t = (i * Math.PI) / 4; ctx.beginPath(); ctx.arc(cx + Math.cos(t) * rx * 0.62, cy + Math.sin(t) * ry * 0.58, Math.min(rx, ry) * 0.07, 0, 7); ctx.fill(); }
  ctx.strokeStyle = mat.claro; ctx.lineWidth = 0.012; ctx.globalAlpha = 0.8;
  for (let y = a.y + 0.03; y < a.y + a.h; y += 0.05) for (const x of [a.x, a.x + a.w]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x === a.x ? -0.09 : 0.09), y + (r() - 0.5) * 0.02); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
