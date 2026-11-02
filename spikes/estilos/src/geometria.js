import { CELULA } from './mapa.js';

const key = (x, y) => `${x},${y}`;

/** Chave da aresta unitária de cada lado de uma célula. */
export const arestaDoLado = (x, y, lado) => ({ topo: `h:${x}:${y}`, base: `h:${x}:${y + 1}`, esq: `v:${x}:${y}`, dir: `v:${x + 1}:${y}` })[lado];

/** Segmento em metros de uma aresta unitária. */
export function segmentoDaAresta(aresta) {
  const [t, xs, ys] = aresta.split(':'), x = +xs * CELULA, y = +ys * CELULA;
  return t === 'h' ? { a: { x, y }, b: { x: x + CELULA, y } } : { a: { x, y }, b: { x, y: y + CELULA } };
}

/**
 * Contorno de um cômodo a partir das células: laços de arestas orientadas, com vértices em metros e a normal
 * interna de cada aresta. Arestas colineares viram uma só. Cada aresta guarda as chaves unitárias que cobre.
 */
export function contorno(cells) {
  const dentro = new Set(cells.map(([x, y]) => key(x, y)));
  const arestas = [];
  for (const [x, y] of cells) {
    if (!dentro.has(key(x, y - 1))) arestas.push({ de: [x + 1, y], para: [x, y], n: [0, 1], k: `h:${x}:${y}` });
    if (!dentro.has(key(x - 1, y))) arestas.push({ de: [x, y], para: [x, y + 1], n: [1, 0], k: `v:${x}:${y}` });
    if (!dentro.has(key(x, y + 1))) arestas.push({ de: [x, y + 1], para: [x + 1, y + 1], n: [0, -1], k: `h:${x}:${y + 1}` });
    if (!dentro.has(key(x + 1, y))) arestas.push({ de: [x + 1, y + 1], para: [x + 1, y], n: [-1, 0], k: `v:${x + 1}:${y}` });
  }
  const porInicio = new Map(arestas.map(e => [key(...e.de), e])), usadas = new Set(), lacos = [];
  for (const inicio of arestas) {
    if (usadas.has(inicio)) continue;
    const laco = [];
    for (let e = inicio; e && !usadas.has(e); e = porInicio.get(key(...e.para))) { usadas.add(e); laco.push(e); }
    // Junta colineares consecutivas (mesma normal).
    const juntas = [];
    for (const e of laco) {
      const ultima = juntas.at(-1);
      if (ultima && ultima.n[0] === e.n[0] && ultima.n[1] === e.n[1]) { ultima.para = e.para; ultima.ks.push(e.k); }
      else juntas.push({ de: e.de, para: e.para, n: e.n, ks: [e.k] });
    }
    if (juntas.length > 1) { const p = juntas[0], u = juntas.at(-1); if (p.n[0] === u.n[0] && p.n[1] === u.n[1]) { u.para = p.para; u.ks.push(...p.ks); juntas.shift(); } }
    lacos.push(juntas.map(e => ({
      a: { x: e.de[0] * CELULA, y: e.de[1] * CELULA }, b: { x: e.para[0] * CELULA, y: e.para[1] * CELULA },
      n: { x: e.n[0], y: e.n[1] }, ks: e.ks,
    })));
  }
  return lacos;
}

/** Faces internas (estilo caixa): trapézio de cada aresta, com cantos em meia-esquadria, `prof` metros para dentro. */
export function faces(laco, prof) {
  const m = laco.length;
  const desloc = laco.map((e, i) => {
    const anterior = laco[(i - 1 + m) % m];
    return { x: e.a.x + prof * (anterior.n.x + e.n.x), y: e.a.y + prof * (anterior.n.y + e.n.y) };
  });
  return laco.map((e, i) => ({ aresta: e, quad: [e.a, e.b, desloc[(i + 1) % m], desloc[i]] }));
}

/** Arestas unitárias de parede (sem duplicar as compartilhadas), com os cômodos de cada lado. */
export function arestasDeParede(comodos) {
  const mapa = new Map();
  for (const c of comodos) for (const laco of contorno(c.cells)) for (const e of laco) for (const k of e.ks) {
    const item = mapa.get(k) ?? { k, comodos: [] }; item.comodos.push(c.id); mapa.set(k, item);
  }
  return [...mapa.values()];
}

/** Segmentos que bloqueiam luz e visão: paredes, menos janelas e portas abertas. */
export function oclusores(paredes, aberturas) {
  const livres = new Set(aberturas.filter(a => a.tipo === 'janela' || (a.tipo === 'porta' && a.aberta > 0.15)).map(a => a.aresta));
  return paredes.filter(p => !livres.has(p.k)).map(p => segmentoDaAresta(p.k));
}

function raio(o, dx, dy, segs) {
  let melhor = Infinity;
  for (const s of segs) {
    const sx = s.b.x - s.a.x, sy = s.b.y - s.a.y, den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((s.a.x - o.x) * sy - (s.a.y - o.y) * sx) / den, u = ((s.a.x - o.x) * dy - (s.a.y - o.y) * dx) / den;
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && t < melhor) melhor = t;
  }
  return melhor;
}

/**
 * Polígono de visibilidade a partir de `o`, limitado a `alcance` metros. Com `cone`, só entre
 * `cone.dir ± cone.abertura/2` e com o próprio `o` como vértice.
 */
export function visibilidade(o, segs, alcance, cone = null) {
  const angulos = [];
  for (const s of segs) for (const p of [s.a, s.b]) {
    if (Math.hypot(p.x - o.x, p.y - o.y) > alcance * 1.5) continue;
    const a = Math.atan2(p.y - o.y, p.x - o.x); angulos.push(a - 1e-4, a, a + 1e-4);
  }
  for (let i = 0; i < 96; i++) angulos.push(-Math.PI + i * Math.PI * 2 / 96);
  let lista = angulos;
  if (cone) {
    const rel = a => { let d = a - cone.dir; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI; return d; };
    const meia = cone.abertura / 2;
    lista = angulos.map(rel).filter(d => Math.abs(d) <= meia);
    lista.push(-meia, meia);
    lista.sort((a, b) => a - b);
    lista = lista.map(d => d + cone.dir);
  } else lista.sort((a, b) => a - b);
  const pontos = cone ? [o.x, o.y] : [];
  for (const a of lista) {
    const dx = Math.cos(a), dy = Math.sin(a), t = Math.min(alcance, raio(o, dx, dy, segs));
    pontos.push(o.x + dx * t, o.y + dy * t);
  }
  return pontos;
}

/** Caminho em células (busca em largura) atravessando só arestas sem parede ou portas abertas. */
export function caminho(de, para, celulasLivres, bloqueadas) {
  const alvo = key(...para); if (!celulasLivres.has(alvo)) return null;
  const vindo = new Map([[key(...de), null]]), fila = [de];
  while (fila.length) {
    const [x, y] = fila.shift();
    if (key(x, y) === alvo) break;
    for (const [dx, dy, aresta] of [[1, 0, `v:${x + 1}:${y}`], [-1, 0, `v:${x}:${y}`], [0, 1, `h:${x}:${y + 1}`], [0, -1, `h:${x}:${y}`]]) {
      const k = key(x + dx, y + dy);
      if (!celulasLivres.has(k) || vindo.has(k) || bloqueadas.has(aresta)) continue;
      vindo.set(k, [x, y]); fila.push([x + dx, y + dy]);
    }
  }
  if (!vindo.has(alvo)) return null;
  const rota = []; for (let c = para; c; c = vindo.get(key(...c))) rota.unshift(c);
  return rota;
}

export const pontoNoPoligono = (x, y, pts) => {
  let dentro = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
