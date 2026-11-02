import { CELULA } from './mapa.js';
import { contorno, faces, arestasDeParede, segmentoDaAresta } from './geometria.js';
import { pintarIlustrado, pintarPixel, material, tom } from './materiais.js';
import { desenharPartes, desenharObjetoPixel, limiar } from './raster.js';
import { receita } from './receitas.js';
import { mulberry32 } from './ruido.js';

const PROF_CAIXA = 0.55;     // quanto a face de uma parede de 2,6 m avança para dentro do cômodo, em metros

function novaTela(w, h) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}

function tracarLacos(ctx, lacos) {
  for (const laco of lacos) { ctx.moveTo(laco[0].a.x, laco[0].a.y); for (const e of laco) ctx.lineTo(e.b.x, e.b.y); ctx.closePath(); }
}

/** Posição (u) de uma aresta unitária dentro da aresta mesclada de um contorno. */
function posicaoNaFace(e, k) {
  const s = segmentoDaAresta(k), dx = Math.sign(e.b.x - e.a.x), dy = Math.sign(e.b.y - e.a.y);
  const u0 = (s.a.x - e.a.x) * dx + (s.a.y - e.a.y) * dy, u1 = (s.b.x - e.a.x) * dx + (s.b.y - e.a.y) * dy;
  return [Math.min(u0, u1), Math.max(u0, u1)];
}

/** Converte partes de face (u, z) para o espaço da face (u, w), onde w = distância a partir do topo da parede. */
function paraFace(partes, u0, H) {
  return partes.map(p => p.forma === 'poli'
    ? { ...p, pts: p.pts.map((v, i) => i % 2 ? H - v : u0 + v) }
    : { ...p, x: u0 + p.x, y: H - p.y });
}

/** Texto nítido para o Pixel: superamostragem 4× e redução por maioria. */
function textoPixel(texto, cor, altura, largura) {
  const k = 4, g = document.createElement('canvas'); g.width = Math.ceil(largura * k); g.height = Math.ceil(altura * 1.4 * k);
  const c = g.getContext('2d', { willReadFrequently: true });
  c.font = `800 ${Math.round(altura * k)}px "Hanken Grotesk", sans-serif`; c.textBaseline = 'top'; c.fillStyle = '#fff';
  c.fillText(texto, 0, altura * 0.15 * k, g.width);
  const src = c.getImageData(0, 0, g.width, g.height).data, w = Math.ceil(g.width / k), h = Math.ceil(g.height / k);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d'), img = o.createImageData(w, h), [r, gg, b] = [1, 3, 5].map(i => parseInt(cor.slice(i, i + 2), 16));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let soma = 0; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) soma += src[(((y * k + dy) * g.width) + x * k + dx) * 4 + 3];
    if (soma / (k * k) > 255 * 0.38) { const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255; }
  }
  o.putImageData(img, 0, 0);
  return out;
}

/**
 * Assa as camadas estáticas do mapa para um renderizador.
 * `estilo`: 'ilustrado' | 'pixel'. `paredes`: 'caixa' | 'solida'. `res`: pixels por metro.
 */
export function assar(mapa, { estilo, paredes: estiloParede, res, tema }) {
  const t0 = performance.now(), W = mapa.largura * res, H = mapa.altura * res, pixel = estilo === 'pixel';
  const pintar = pixel ? (ctx, id, area, seed, o = {}) => pintarPixel(ctx, id, area, seed, { ...o, px: 1 / res }) : pintarIlustrado;
  const alturaParede = mapa.paredes.altura, esp = estiloParede === 'caixa' ? mapa.paredes.espessura : mapa.paredes.espessura * 1.6;
  const comodos = mapa.comodos.map(c => ({ ...c, lacos: contorno(c.cells) }));
  const arestas = arestasDeParede(mapa.comodos);
  const porAresta = new Map(mapa.aberturas.map(a => [a.aresta, a]));

  // ---- Estático: pisos, faces, objetos, topo das paredes ----
  const estatico = novaTela(W, H), ctx = estatico.getContext('2d', { willReadFrequently: pixel });
  ctx.imageSmoothingEnabled = !pixel;
  ctx.setTransform(res, 0, 0, res, 0, 0);

  // Ilhas: sombra e contorno grosso por fora de cada cômodo, sobre o fundo.
  ctx.save();
  if (!pixel) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 0.6 * res; ctx.shadowOffsetY = 0.15 * res; }
  ctx.fillStyle = '#050406'; ctx.strokeStyle = '#050406'; ctx.lineWidth = esp + 0.22; ctx.lineJoin = 'miter';
  for (const c of comodos) { ctx.beginPath(); tracarLacos(ctx, c.lacos); ctx.fill(); ctx.stroke(); }
  ctx.restore();

  for (const c of comodos) {
    ctx.save(); ctx.beginPath(); tracarLacos(ctx, c.lacos); ctx.clip();
    const xs = c.cells.map(([x]) => x), ys = c.cells.map(([, y]) => y);
    const area = { x: Math.min(...xs) * CELULA, y: Math.min(...ys) * CELULA, w: (Math.max(...xs) + 1 - Math.min(...xs)) * CELULA, h: (Math.max(...ys) + 1 - Math.min(...ys)) * CELULA };
    pintar(ctx, c.piso.material, area, c.piso.seed);
    // Oclusão no encontro do piso com as paredes.
    if (!pixel) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 0.35 * res; ctx.lineWidth = 0.25; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); tracarLacos(ctx, c.lacos); ctx.stroke(); }
    if (estiloParede === 'solida') { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 0.5 * res; ctx.shadowOffsetX = 0.12 * res; ctx.shadowOffsetY = 0.18 * res; ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); tracarLacos(ctx, c.lacos); ctx.stroke(); }
    ctx.restore();
  }
  if (pixel) { const img = ctx.getImageData(0, 0, estatico.width, estatico.height); limiar(img); ctx.putImageData(img, 0, 0); }

  // Faces internas (caixa) com papel de parede, lambri, aberturas e objetos de parede.
  const objetosParede = mapa.objetosParede.map(o => ({ ...o, desc: receita(o.receita, o) }));
  if (estiloParede === 'caixa') {
    for (const c of comodos) for (const laco of c.lacos) for (const f of faces(laco, PROF_CAIXA)) {
      const e = f.aresta, comp = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y), dx = (e.b.x - e.a.x) / comp, dy = (e.b.y - e.a.y) / comp, k = PROF_CAIXA / alturaParede;
      ctx.save();
      ctx.setTransform(res, 0, 0, res, 0, 0); ctx.beginPath(); ctx.moveTo(f.quad[0].x, f.quad[0].y); for (const q of f.quad.slice(1)) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.clip();
      ctx.setTransform(dx * res, dy * res, e.n.x * k * res, e.n.y * k * res, e.a.x * res, e.a.y * res);
      const sementeFace = Math.round(e.a.x * 13 + e.a.y * 7);
      pintar(ctx, c.papel.material, { x: 0, y: 0, w: comp, h: alturaParede }, c.papel.seed + sementeFace);
      // Lambri na parte de baixo.
      pintar(ctx, 'madeira.escura', { x: 0, y: alturaParede - 0.9, w: comp, h: 0.9 }, 3 + sementeFace, { dir: 0 });
      ctx.fillStyle = tom(material('madeira.media').base, 0.1); ctx.fillRect(0, alturaParede - 0.93, comp, 0.05);
      if (!pixel) {
        const g = ctx.createLinearGradient(0, 0, 0, alturaParede);
        g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.35, 'rgba(0,0,0,0.12)'); g.addColorStop(0.9, 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, comp, alturaParede);
      } else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, comp, 0.35); }
      // Aberturas nesta face.
      for (const kAresta of e.ks) {
        const ab = porAresta.get(kAresta); if (!ab) continue;
        const [u0, u1] = posicaoNaFace(e, kAresta), meio = (u0 + u1) / 2;
        if (ab.tipo === 'porta') {
          ctx.fillStyle = '#0a080b'; ctx.fillRect(u0 + 0.12, alturaParede - 2.15, u1 - u0 - 0.24, 2.15);
          desenharPartes(ctx, paraFace([
            { forma: 'ret', x: -(u1 - u0) / 2 + 0.08, y: 1.08, w: 0.1, h: 2.16, mat: 'madeira.media', z: 0.1 },
            { forma: 'ret', x: (u1 - u0) / 2 - 0.08, y: 1.08, w: 0.1, h: 2.16, mat: 'madeira.media', z: 0.1 },
            { forma: 'ret', x: 0, y: 2.18, w: u1 - u0 - 0.06, h: 0.1, mat: 'madeira.media', z: 0.1 },
          ], meio, alturaParede), { estilo, res, seed: 5, sombras: false });
        } else if (ab.tipo === 'janela') {
          desenharPartes(ctx, paraFace(receita('janela', { largura: u1 - u0 }).face, meio, alturaParede), { estilo, res, seed: 9, sombras: !pixel });
        }
      }
      for (const o of objetosParede) {
        if (o.comodo !== c.id || !e.ks.includes(o.aresta)) continue;
        const [u0, u1] = posicaoNaFace(e, o.aresta), u = u0 + (u1 - u0) * o.em;
        desenharPartes(ctx, paraFace(o.desc.face, u, alturaParede), { estilo, res, seed: o.seed, sombras: !pixel });
      }
      ctx.restore();
    }
  }

  // Objetos do piso (tapetes primeiro).
  const objetos = [...mapa.objetos].sort((a, b) => (b.receita.startsWith('tapete') ? 1 : 0) - (a.receita.startsWith('tapete') ? 1 : 0));
  for (const o of objetos) {
    const d = receita(o.receita, o);
    ctx.save(); ctx.setTransform(res, 0, 0, res, 0, 0); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
    if (pixel) desenharObjetoPixel(ctx, d.partes, { res, seed: o.seed }); else desenharPartes(ctx, d.partes, { estilo, res, seed: o.seed });
    ctx.restore();
  }

  // Estilo sólido: objetos de parede vistos de cima, colados à parede.
  if (estiloParede === 'solida') for (const o of objetosParede) {
    const c = comodos.find(x => x.id === o.comodo), e = c.lacos.flat().find(x => x.ks.includes(o.aresta)); if (!e) continue;
    const [u0, u1] = posicaoNaFace(e, o.aresta), comp = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y), dx = (e.b.x - e.a.x) / comp, dy = (e.b.y - e.a.y) / comp;
    const u = u0 + (u1 - u0) * o.em;
    ctx.save(); ctx.setTransform(dx * res, dy * res, e.n.x * res, e.n.y * res, (e.a.x + dx * u + e.n.x * esp / 2) * res, (e.a.y + dy * u + e.n.y * esp / 2) * res);
    if (pixel) desenharObjetoPixel(ctx, o.desc.topo, { res, seed: o.seed }); else desenharPartes(ctx, o.desc.topo, { estilo, res, seed: o.seed });
    ctx.restore();
  }

  // Topo das paredes: faixa escura em cada aresta unitária; janelas viram vidro na faixa; a porta fica aberta.
  ctx.setTransform(res, 0, 0, res, 0, 0);
  const topo = material('parede.topo');
  for (const p of arestas) {
    const ab = porAresta.get(p.k), s = segmentoDaAresta(p.k), hz = s.a.y === s.b.y;
    const x = Math.min(s.a.x, s.b.x) - esp / 2, y = Math.min(s.a.y, s.b.y) - esp / 2, w = hz ? CELULA + esp : esp, h = hz ? esp : CELULA + esp;
    if (ab?.tipo === 'porta') {
      ctx.fillStyle = topo.base;
      if (hz) { ctx.fillRect(x, y, esp + 0.1, h); ctx.fillRect(x + w - esp - 0.1, y, esp + 0.1, h); } else { ctx.fillRect(x, y, w, esp + 0.1); ctx.fillRect(x, y + h - esp - 0.1, w, esp + 0.1); }
      continue;
    }
    ctx.fillStyle = topo.base; ctx.fillRect(x, y, w, h);
    if (!pixel) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; hz ? ctx.fillRect(x, y, w, 0.03) : ctx.fillRect(x, y, 0.03, h); }
    if (ab?.tipo === 'janela') {
      const m = 0.18, vw = hz ? CELULA - 2 * m : esp * 0.45, vh = hz ? esp * 0.45 : CELULA - 2 * m;
      const vx = hz ? s.a.x + m : s.a.x - vw / 2, vy = hz ? s.a.y - vh / 2 : Math.min(s.a.y, s.b.y) + m;
      ctx.fillStyle = material('madeira.media').base; ctx.fillRect(vx - 0.04, vy - 0.04, vw + 0.08, vh + 0.08);
      ctx.fillStyle = pixel ? material('vidro').claro : material('vidro').base; ctx.fillRect(vx, vy, vw, vh);
    }
  }
  if (pixel) { const img = ctx.getImageData(0, 0, estatico.width, estatico.height); limiar(img); ctx.putImageData(img, 0, 0); }

  // ---- Memória: o que já foi explorado, em esboço sobre papel ----
  const memoria = novaTela(W, H), m = memoria.getContext('2d', { willReadFrequently: pixel });
  m.setTransform(res, 0, 0, res, 0, 0);
  const papel = '#a89b7c', tinta = '#241b14', r = mulberry32(77);
  for (const c of comodos) {
    m.save(); m.beginPath(); tracarLacos(m, c.lacos); m.fillStyle = papel; m.fill(); m.clip();
    if (!pixel) {
      m.strokeStyle = tinta; m.globalAlpha = 0.13; m.lineWidth = 0.02;
      for (let d = -30; d < 60; d += 0.22) { m.beginPath(); m.moveTo(d, 0); m.lineTo(d + 20, 20); m.stroke(); }
      m.globalAlpha = 1;
    }
    m.restore();
  }
  const traco = (pts, larg = 0.03, alpha = 1) => {
    for (const passada of pixel ? [0] : [0, 1]) {
      m.beginPath(); m.strokeStyle = tinta; m.globalAlpha = passada ? alpha * 0.45 : alpha; m.lineWidth = pixel ? 1 / res : larg * (passada ? 0.5 : 1);
      pts.forEach(([x, y], i) => { const jx = pixel ? 0 : (r() - 0.5) * 0.04, jy = pixel ? 0 : (r() - 0.5) * 0.04; i ? m.lineTo(x + jx, y + jy) : m.moveTo(x + jx, y + jy); });
      m.stroke();
    }
    m.globalAlpha = 1;
  };
  for (const p of arestas) {
    const ab = porAresta.get(p.k), s = segmentoDaAresta(p.k);
    if (ab?.tipo === 'porta') {
      const r0 = CELULA; m.beginPath(); m.strokeStyle = tinta; m.lineWidth = pixel ? 1 / res : 0.02; m.setLineDash(pixel ? [] : [0.08, 0.06]);
      m.arc(s.a.x, s.a.y, r0, 0, Math.PI / 2); m.stroke(); m.setLineDash([]); continue;
    }
    traco([[s.a.x, s.a.y], [s.b.x, s.b.y]], 0.06);
    if (ab?.tipo === 'janela') { const hz = s.a.y === s.b.y, o = 0.08; traco(hz ? [[s.a.x + 0.2, s.a.y - o], [s.b.x - 0.2, s.b.y - o]] : [[s.a.x - o, s.a.y + 0.2], [s.b.x - o, s.b.y - 0.2]], 0.015); traco(hz ? [[s.a.x + 0.2, s.a.y + o], [s.b.x - 0.2, s.b.y + o]] : [[s.a.x + o, s.a.y + 0.2], [s.b.x + o, s.b.y - 0.2]], 0.015); }
  }
  // Objetos fixos em contorno.
  for (const o of mapa.objetos) {
    const d = receita(o.receita, o), [w, h] = d.pegada;
    m.save(); m.translate(o.x, o.y); m.rotate(o.rot);
    const pts = o.receita === 'mesa.redonda' || o.receita === 'mesinha'
      ? Array.from({ length: 25 }, (_, i) => [Math.cos(i / 24 * Math.PI * 2) * w / 2, Math.sin(i / 24 * Math.PI * 2) * h / 2])
      : [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]];
    traco(pts, 0.018, o.receita.startsWith('tapete') ? 0.5 : 0.85);
    m.restore();
  }
  if (!pixel) {
    m.fillStyle = tinta; m.textAlign = 'center'; m.textBaseline = 'middle';
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0);
    for (const c of comodos) {
      const xs = c.cells.map(([x]) => x), ys = c.cells.map(([, y]) => y);
      m.font = `${Math.round(0.5 * res)}px "Special Elite", "Courier New", monospace`; m.globalAlpha = 0.75;
      m.fillText(c.nome.toUpperCase(), (Math.min(...xs) + 1.6) * CELULA * res, (Math.max(...ys) + 0.62) * CELULA * res);
    }
    m.restore();
    m.globalAlpha = 1;
  }
  if (pixel) { const img = m.getImageData(0, 0, memoria.width, memoria.height); limiar(img); m.putImageData(img, 0, 0); }

  // ---- Fundo e cartela de título ----
  const fundo = novaTela(W, H), f = fundo.getContext('2d');
  f.setTransform(res, 0, 0, res, 0, 0);
  f.fillStyle = tema.fundo; f.fillRect(0, 0, mapa.largura, mapa.altura);
  if (!pixel) {
    const rf = mulberry32(5);
    for (let i = 0; i < 260; i++) {
      const x = rf() * mapa.largura, y0 = rf() * mapa.altura - 3, comp = 2 + rf() * 6;
      f.strokeStyle = rf() < 0.5 ? tema.fundoTraco : '#000'; f.globalAlpha = 0.08 + rf() * 0.12; f.lineWidth = 0.05 + rf() * 0.25;
      f.beginPath(); f.moveTo(x, y0); f.bezierCurveTo(x + (rf() - 0.5) * 0.4, y0 + comp / 3, x + (rf() - 0.5) * 0.4, y0 + comp * 2 / 3, x + (rf() - 0.5) * 0.3, y0 + comp); f.stroke();
    }
    f.globalAlpha = 1;
  } else {
    const rf = mulberry32(5); f.fillStyle = tema.fundoTraco;
    for (let i = 0; i < 35; i++) f.fillRect(Math.round(rf() * mapa.largura * res) / res, Math.round(rf() * mapa.altura * res) / res, 1 / res, (2 + Math.round(rf() * 8)) / res);
  }
  // Cartela: faixa rasgada com o nome do lugar, como os rótulos da Ficha.
  const tx = 16.6, ty = 12.7;
  f.save(); f.translate(tx, ty);
  f.fillStyle = tema.acento; f.beginPath(); f.moveTo(-0.2, -0.55); f.lineTo(6.9, -0.62); f.lineTo(7.1, -0.2); f.lineTo(6.95, 0.5); f.lineTo(0.1, 0.58); f.lineTo(-0.15, 0.2); f.closePath(); f.fill();
  f.setTransform(1, 0, 0, 1, tx * res, ty * res);
  if (pixel) {
    // Texto em pixel: desenhado 4× maior e reduzido por maioria, para os traços não sumirem no limiar.
    f.drawImage(textoPixel(mapa.nome.toUpperCase(), tema.acentoTexto, 0.8 * res, 6.6 * res), Math.round(0.15 * res), Math.round(-0.5 * res));
  } else {
    f.fillStyle = tema.acentoTexto; f.font = `700 ${Math.round(0.56 * res)}px "Cinzel", Georgia, serif`; f.textBaseline = 'middle'; f.fillText(mapa.nome.toUpperCase(), 0.2 * res, 0.02 * res, 6.6 * res);
    f.fillStyle = '#cfc8bb'; f.globalAlpha = 0.8; f.font = `600 ${Math.max(6, Math.round(0.3 * res))}px "Hanken Grotesk", sans-serif`; f.fillText('ATLAS · PROTÓTIPO DE ESTILOS', 0.25 * res, 1.05 * res);
  }
  f.restore();
  if (pixel) { const img = f.getImageData(0, 0, fundo.width, fundo.height); limiar(img); f.putImageData(img, 0, 0); }

  // ---- Máscara do lado de fora (para chuva e relâmpago) ----
  const fora = novaTela(W, H), o = fora.getContext('2d');
  o.fillStyle = '#fff'; o.fillRect(0, 0, W, H); o.setTransform(res, 0, 0, res, 0, 0); o.globalCompositeOperation = 'destination-out';
  for (const c of comodos) { o.beginPath(); tracarLacos(o, c.lacos); o.lineWidth = esp; o.fill(); o.stroke(); }

  // ---- Folha da porta (dinâmica) ----
  const porta = mapa.aberturas.find(a => a.tipo === 'porta'), dp = receita('porta', { largura: CELULA });
  const folha = novaTela((CELULA + 0.2) * res, 0.4 * res), fc = folha.getContext('2d', { willReadFrequently: pixel });
  fc.setTransform(res, 0, 0, res, 0.1 * res, 0.2 * res);
  if (pixel) desenharObjetoPixel(fc, dp.partes, { res, seed: 1 }); else desenharPartes(fc, dp.partes, { estilo, res, seed: 1 });

  return { estatico, memoria, fundo, fora, folha, folhaPivo: [0.1 * res, 0.2 * res], porta, tempo: performance.now() - t0 };
}
