import { contextoDe, criarTela, type Contexto } from './canvas.ts';
import { fbm, hash2D, ladrilhoDeRuido, mulberry32, valueNoise2D } from './ruido.ts';
import { celulasDeVoronoi, type Consulta } from './voronoi.ts';

export type Padrao = 'tabuas' | 'xadrez' | 'damasco' | 'listras' | 'veio' | 'trama' | 'couro' | 'metal' | 'vidro' | 'pregas' | 'pintura' | 'persa' | 'laje' | 'liso' | 'grama' | 'terra' | 'areia' | 'pedra' | 'neve' | 'lama' | 'espinha' | 'marmore' | 'losango' | 'hexagono' | 'floral' | 'lambri' | 'gelo' | 'dunas' | 'rachado' | 'cascalho';
export interface Material {
  id: string; nome: string; /** Para onde o material vai: piso, papel de parede, objeto ou terreno. */ uso: 'piso' | 'papel' | 'objeto' | 'terreno' | 'macico' | 'telhado';
  base: string; escuro: string; claro: string; padrao: Padrao; largura?: number; lado?: number; ouro?: string; borda?: string; meio?: string; /** Maciço: cor do topo (neve), onde a rocha passa de 70% da altura. */ topo?: string;
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
  m('gelo', 'Gelo', 'terreno', '#9cc7e0', '#5d93b8', '#e8f6ff', 'gelo'),
  m('neve.funda', 'Neve funda', 'terreno', '#eef3f8', '#b9c8da', '#ffffff', 'dunas'),
  m('rocha.rachada', 'Rocha rachada', 'terreno', '#5f6872', '#2b3138', '#8d98a3', 'rachado'),
  // Maciço: rocha com volume (o assar do terreno dá relevo, estrias e sombra de contato; o padrão serve de amostra)
  m('rocha.cinza', 'Rocha cinza', 'macico', '#6b6f75', '#25282d', '#a4a9ae', 'pedra'),
  m('rocha.caverna', 'Rocha de caverna', 'macico', '#566069', '#1b2128', '#8fa1ad', 'pedra'),
  m('rocha.nevada', 'Rocha nevada', 'macico', '#77808a', '#2d343c', '#b4bec8', 'pedra', { topo: '#f1f6fa' }),
  m('rocha.arenito', 'Arenito', 'macico', '#b49a72', '#5e4a30', '#e0c9a0', 'pedra'),
  m('cascalho', 'Cascalho', 'terreno', '#7a756c', '#3f3b36', '#b0aaa0', 'cascalho'),
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
    case 'gelo': pintarGelo(ctx, mat, A, seed, r, pxDe(ctx)); break;
    case 'dunas': camadaDeRuido(ctx, A, seed, 2.5, 0.16, 'multiply', 6); camadaDeRuido(ctx, A, seed + 1, 0.7, 0.2, 'soft-light', 10); pintarDunas(ctx, mat, A, seed); break;
    case 'rachado': pintarRachado(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'cascalho': pintarCascalho(ctx, mat, A, seed); break;
    case 'neve': camadaDeRuido(ctx, A, seed, 2.5, 0.35, 'multiply', 6); camadaDeRuido(ctx, A, seed + 1, 0.7, 0.2, 'soft-light', 10); break;
    default: camadaDeRuido(ctx, A, seed, 2, 0.15);
  }
  ctx.restore();
}

// ---------- Materiais de natureza: pintados pixel a pixel (sombreamento de verdade), em metros ----------
const rgbHex = (h: string): [number, number, number] => { const q = parseInt(h.slice(1), 16); return [(q >> 16) & 255, (q >> 8) & 255, q & 255]; };
const passo = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Tamanho de um pixel do dispositivo, em metros locais. */
const pxDe = (ctx: Contexto): number => 1 / (Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1);
type Cor3 = [number, number, number];
/** `o` ← a mistura de `a` e `b` (t = 0 dá `a`). */
const mez = (o: number[], a: Cor3, b: Cor3, t: number): void => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; };
/** `o` ← a cor `c` escurecida (k < 1) ou clareada (k > 1). */
const tomDe = (o: number[], c: Cor3, k: number): void => { o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; };

/**
 * Pinta `A` pixel a pixel numa tela do tamanho do dispositivo e a desenha. `fn(x, y, o)` recebe o ponto em metros e escreve
 * `o = [r, g, b, a]` (alfa começa em 255). A resolução segue a matriz do contexto, com um teto de ~9 milhões de pixels.
 */
function porPixel(ctx: Contexto, A: Area, fn: (x: number, y: number, o: number[]) => void): void {
  let s = pxDe(ctx) ** -1;
  if (A.w * A.h * s * s > 9e6) s = Math.sqrt(9e6 / (A.w * A.h));
  const W = Math.max(1, Math.ceil(A.w * s)), H = Math.max(1, Math.ceil(A.h * s)), tela = criarTela(W, H), c = contextoDe(tela), img = c.createImageData(W, H), d = img.data, o = [0, 0, 0, 255];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    o[3] = 255; fn(A.x + (i + 0.5) / s, A.y + (j + 0.5) / s, o);
    const k = (j * W + i) * 4; d[k] = o[0]!; d[k + 1] = o[1]!; d[k + 2] = o[2]!; d[k + 3] = o[3]!;
  }
  c.putImageData(img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(tela as CanvasImageSource, A.x, A.y, W / s, H / s); ctx.restore();
}

const novaConsulta = (): Consulta => ({ f1: 0, f2: 0, borda: 0, sitio: { x: 0, y: 0, i: 0, j: 0, azar: 0 } });

/** Rocha rachada: placas de Voronoi (0,45 m) com tom próprio, bisel claro do lado da luz, sombra de oclusão e fendas escuras; fendas maiores por cima. */
function pintarRachado(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 31 + 5), V1 = celulasDeVoronoi(A, 0.55, seed * 13 + 1), V2 = celulasDeVoronoi(A, 1.9, seed * 13 + 2), q1 = novaConsulta(), q2 = novaConsulta();
  const E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), w = Math.max(0.016, px * 1.25), tmp = [0, 0, 0];
  porPixel(ctx, A, (x, y, o) => {
    const xx = x + (fbm(rn, x * 2.4, y * 2.4, 2) - 0.5) * 0.17, yy = y + (fbm(rn, x * 2.4 + 37, y * 2.4 + 11, 2) - 0.5) * 0.17;
    V1.consultar(xx, yy, q1);
    const lado = (q1.sitio.x - xx) + (q1.sitio.y - yy);            // > 0: o ponto está acima e à esquerda do centro da placa (de frente para a luz)
    let t = 0.38 + 0.2 * q1.sitio.azar + lado / 0.55 * 0.08 - q1.f1 / 0.55 * 0.1;
    t += (fbm(rn, x * 3.1, y * 3.1, 4) - 0.5) * 0.5 + (fbm(rn, x * 0.5 + 90, y * 0.5, 3) - 0.5) * 0.75 + (hash2D(Math.floor(x / px), Math.floor(y / px), 3) - 0.5) * 0.05;
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    const b = q1.borda, frente = passo(-0.04, 0.12, lado);
    const ao = (1 - passo(w, w * 7, b)) * (0.18 + 0.22 * (1 - frente));
    const bisel = passo(w * 0.5, w * 1.2, b) * (1 - passo(w * 1.2, w * 4.5, b)) * frente * 0.4;
    o[0] = o[0]! * (1 - ao) + (C[0] - o[0]!) * bisel; o[1] = o[1]! * (1 - ao) + (C[1] - o[1]!) * bisel; o[2] = o[2]! * (1 - ao) + (C[2] - o[2]!) * bisel;
    tomDe(tmp, E, 0.55); const ck = (1 - passo(w * 0.3, w, b)) * 0.78;
    o[0] = o[0]! + (tmp[0]! - o[0]!) * ck; o[1] = o[1]! + (tmp[1]! - o[1]!) * ck; o[2] = o[2]! + (tmp[2]! - o[2]!) * ck;
    V2.consultar(x + (fbm(rn, x * 1.1 + 5, y * 1.1, 2) - 0.5) * 0.5, y + (fbm(rn, x * 1.1, y * 1.1 + 5, 2) - 0.5) * 0.5, q2);
    const g = (1 - passo(w * 0.4, w * 1.4, q2.borda)) * 0.8, aog = (1 - passo(w * 1.4, w * 8, q2.borda)) * 0.2;
    tomDe(tmp, E, 0.35); o[0] = (o[0]! * (1 - aog)) + (tmp[0]! - o[0]! * (1 - aog)) * g; o[1] = (o[1]! * (1 - aog)) + (tmp[1]! - o[1]! * (1 - aog)) * g; o[2] = (o[2]! * (1 - aog)) + (tmp[2]! - o[2]! * (1 - aog)) * g;
  });
}

/** Gelo: manchas largas de azul fundo e claro com bordas macias, geada difusa em faixas, poucas rachaduras quebradas que ramificam (traço claro com fio escuro ao lado). */
function pintarGelo(ctx: Contexto, mat: Material, A: Area, seed: number, r: () => number, px: number): void {
  const rn = valueNoise2D(seed * 17 + 3), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), fundo: Cor3 = [E[0] * 0.78, E[1] * 0.82, E[2] * 0.95], tmp = [0, 0, 0];
  porPixel(ctx, A, (x, y, o) => {
    const n1 = fbm(rn, x * 0.3, y * 0.3, 4), n2 = fbm(rn, x * 0.8 + 50, y * 0.8 + 9, 4), n3 = fbm(rn, x * 7, y * 7, 2);
    mez(o, B, E, 0.62 * passo(0.3, 0.68, n1)); mez(tmp, [o[0]!, o[1]!, o[2]!], fundo, 0.45 * passo(0.6, 0.88, n1));
    mez(o, [tmp[0]!, tmp[1]!, tmp[2]!], C, 0.8 * passo(0.4, 0.8, 1 - n1) * passo(0.35, 0.8, n2) + (n3 - 0.5) * 0.08);
    const a = (x - y) * 0.7071, b = (x + y) * 0.7071;
    const geada = passo(0.55, 0.88, fbm(rn, a * 3.2 + 300, b * 1.1, 3)) * 0.26 * (0.5 + 0.5 * passo(0.3, 0.7, n2)) + passo(0.8, 0.97, fbm(rn, a * 14 + 90, b * 0.6, 2)) * 0.12;
    mez(tmp, [o[0]!, o[1]!, o[2]!], C, Math.min(0.8, geada)); o[0] = tmp[0]!; o[1] = tmp[1]!; o[2] = tmp[2]!;
    if (hash2D(Math.floor(x / (px * 1.2)), Math.floor(y / (px * 1.2)), 11) > 0.998) mez(o, [o[0]!, o[1]!, o[2]!], [255, 255, 255], 0.85);
  });
  const trilhas: { pts: [number, number][]; prof: number }[] = [];
  const crescer = (x: number, y: number, ang: number, comp: number, prof: number): void => {
    const pts: [number, number][] = [[x, y]]; let a = ang;
    for (let d = 0; d < comp;) {
      const st = 0.18 + r() * 0.4; a += (r() - 0.5) * 0.18 + (r() < 0.28 ? (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.7) : 0); x += Math.cos(a) * st; y += Math.sin(a) * st; d += st; pts.push([x, y]);
      if (prof < 2 && r() < 0.16) crescer(x, y, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.9), (comp - d) * 0.65, prof + 1);
    }
    trilhas.push({ pts, prof });
  };
  for (let i = 0, n = Math.min(260, Math.round((A.w * A.h) / 7)); i < n; i++) crescer(A.x + r() * A.w, A.y + r() * A.h, r() * 6.283, 1 + r() * 2.8, 0);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Cada segmento tem espessura própria (afina nas pontas e nos ramos); passada escura deslocada e passada clara por cima.
  const tracar = (cor: string, alfa: number, larg: number, dx: number) => {
    ctx.strokeStyle = cor; ctx.globalAlpha = alfa;
    for (const t of trilhas) for (let k = 1; k < t.pts.length; k++) {
      const f = Math.sin((k / t.pts.length) * Math.PI) ** 0.6, v = 0.6 + 0.9 * hash2D(Math.round(t.pts[k]![0] * 50), Math.round(t.pts[k]![1] * 50), 4);
      ctx.lineWidth = Math.max(px * 0.6, larg * v * f * (t.prof === 0 ? 1 : 0.65)); ctx.beginPath(); ctx.moveTo(t.pts[k - 1]![0] + dx, t.pts[k - 1]![1] + dx); ctx.lineTo(t.pts[k]![0] + dx, t.pts[k]![1] + dx); ctx.stroke();
    }
  };
  tracar(mat.escuro, 0.45, px * 1.3, px * 1.5); tracar(mat.claro, 0.85, px * 2.1, 0);
  ctx.restore();
}

/** Neve funda: por cima da neve de sempre, cristas de vento (subida suave clara, queda curta em sombra azul) em faixas de 2 a 4 m, mais marolas finas. */
function pintarDunas(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const rn = valueNoise2D(seed * 19 + 1), E = rgbHex(mat.escuro), C = rgbHex(mat.claro), ang = 0.35 + (seed % 7) * 0.09, ux = Math.cos(ang), uy = Math.sin(ang);
  porPixel(ctx, A, (x, y, o) => {
    const grande = fbm(rn, x * 0.15, y * 0.15, 3), amp = 0.55 + 0.45 * passo(0.35, 0.58, fbm(rn, x * 0.18 + 90, y * 0.18 + 20, 2)), amp2 = 0.4 + 0.6 * passo(0.3, 0.6, fbm(rn, x * 0.3 + 11, y * 0.3 + 70, 2));
    const warp = (fbm(rn, x * 0.22 + 40, y * 0.22, 3) - 0.5) * 4.5, per = 1.9 + (grande - 0.5) * 1.2;
    let sc = (x * ux + y * uy + warp) / per; sc -= Math.floor(sc);
    let v = sc < 0.8 ? (sc / 0.8) ** 2 * 0.32 : sc < 0.88 ? 0.32 - ((sc - 0.8) / 0.08) * 0.72 : -0.4 * (1 - (sc - 0.88) / 0.12) ** 1.5;
    v *= amp;
    let m2 = (x * ux + y * uy + warp * 0.3) / 0.36; m2 -= Math.floor(m2);
    v += (m2 < 0.75 ? m2 / 0.75 * 0.5 - 0.1 : (1 - m2) / 0.25 * -0.5 + 0.4) * 0.1 * amp2;
    v += (fbm(rn, x * 1.7, y * 1.7, 2) - 0.5) * 0.14 * amp2;
    // trilhas finas de vento: linhas de nível de um ruído largo, quebradas e suaves
    const lv = fbm(rn, x * 0.28 + 200, y * 0.28 + 60, 3) * 9, tr = Math.abs(lv - Math.round(lv)), quebra = passo(0.4, 0.6, fbm(rn, x * 0.9 + 33, y * 0.9, 2));
    v -= (1 - passo(0.015, 0.07, tr)) * quebra * 0.3;
    // sombra azul de um lado (escura), luz do outro (clara): alfa proporcional à intensidade
    if (v < 0) { o[0] = E[0]; o[1] = E[1]; o[2] = E[2]; o[3] = Math.min(255, -v * 1.25 * 255); } else { o[0] = C[0]; o[1] = C[1]; o[2] = C[2]; o[3] = Math.min(255, v * 1.5 * 255); }
  });
}

/** Cascalho: pedrinhas elípticas (2 a 6 cm de semieixo) sobre terra escura, cada uma com volume (luz do alto à esquerda), sombra de contato e sombra lançada. */
function pintarCascalho(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const rn = valueNoise2D(seed * 23 + 7), V = celulasDeVoronoi(A, 0.15, seed * 13 + 3), q = novaConsulta(), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), tmp = [0, 0, 0];
  const L = [-0.5, -0.55, 0.67], ln = Math.hypot(L[0]!, L[1]!, L[2]!);
  porPixel(ctx, A, (x, y, o) => {
    V.consultar(x, y, q); const s = q.sitio, i = s.i, j = s.j, ang = s.azar * 6.283, asp = 0.62 + 0.3 * hash2D(i, j, 77), R = (0.03 + 0.034 * hash2D(i, j, 91)) * passo(0.3, 0.5, fbm(rn, s.x * 1.4 + 20, s.y * 1.4, 3)) + 0.004, co = Math.cos(ang), si = Math.sin(ang);
    const dx = x - s.x, dy = y - s.y, u = (dx * co + dy * si) / R, v = (-dx * si + dy * co) / (R * asp), d = Math.hypot(u, v) * (1 + (rn(x * 40, y * 40) - 0.5) * 0.14);
    // terra
    mez(tmp, E, B, 0.2 + 0.32 * fbm(rn, x * 6, y * 6, 3)); tomDe(o, [tmp[0]!, tmp[1]!, tmp[2]!] as Cor3, 0.62 + (rn(x * 70 + 5, y * 70) - 0.5) * 0.25);
    if (d < 1) {
      const h = Math.sqrt(1 - d * d), nx = (u * co - v * si) * 0.75, ny = (u * si + v * co) * 0.75, nl = Math.hypot(nx, ny, h);
      const lam = Math.max(0, (nx * L[0]! + ny * L[1]! + h * L[2]!) / (nl * ln)), tinta = 0.15 + 0.85 * hash2D(i, j, 5);
      const baseP: Cor3 = [0, 0, 0]; mez(baseP, E, B, 0.55 + 0.3 * tinta); mez(tmp, baseP, hash2D(i, j, 6) < 0.35 ? [190, 160, 120] : C, tinta * 0.6);
      const k = 0.3 + lam * 1.0 - passo(0.78, 1, d) * 0.25, brilho = Math.max(0, lam - 0.85) * 1.6;
      o[0] = Math.min(255, tmp[0]! * k + brilho * 90); o[1] = Math.min(255, tmp[1]! * k + brilho * 90); o[2] = Math.min(255, tmp[2]! * k + brilho * 90);
    } else {
      const sombra = (1 - passo(1, 1.5, d)) * 0.5 + (Math.hypot(u - 0.5 / asp * 0.5, v - 0.55) < 1.05 ? 0.22 : 0);
      const k = 1 - Math.min(0.75, sombra); o[0] = o[0]! * k; o[1] = o[1]! * k; o[2] = o[2]! * k;
    }
  });
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
