import type { Comodo, MapaAtlas } from '../domain/mapa.ts';
import { camadaDoObjeto } from '../domain/camadas.ts';
import { aguasDe, formaDe } from '../domain/telhado-geometria.ts';
import { assarDescricao } from '../procedural/assar.ts';
import { ehPadraoDeCobertura, texturaDeCobertura } from '../procedural/coberturas.ts';
import { descricaoDoDetalhe, posicoesDosDetalhes } from '../procedural/detalhes-de-telhado.ts';
import { estiloDe } from '../procedural/estilos/index.ts';
import { materialDe } from '../procedural/materiais.ts';
import { corDoNome, hexParaNumero } from './cores.ts';

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Prévia do mapa para a galeria, em Canvas 2D: fundo, cômodos, paredes, luzes e peças. Os mesmos dados que o viewport usa. */
export function desenharMiniatura(canvas: HTMLCanvasElement | OffscreenCanvas, m: MapaAtlas, acento = '#e91d25'): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const w = canvas.width, h = canvas.height, margem = 10, esc = Math.min((w - 2 * margem) / m.bounds.width, (h - 2 * margem) / m.bounds.height);
  const ox = (w - m.bounds.width * esc) / 2, oy = (h - m.bounds.height * esc) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = m.backdrop.color; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(ox, oy, m.bounds.width * esc, m.bounds.height * esc);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, m.bounds.width * esc, m.bounds.height * esc);
  const t = m.grid.size * esc;
  for (const sala of Object.values(m.rooms)) { ctx.fillStyle = css(corDoNome(sala.floor.material, 0.32, 0.3)); for (const [y, x0, n] of sala.cells) ctx.fillRect(ox + x0 * t, oy + y * t, n * t + 0.5, t + 0.5); }
  ctx.strokeStyle = '#16141a'; ctx.lineCap = 'round';
  for (const p of Object.values(m.walls)) { ctx.lineWidth = Math.max(1.5, p.thickness * esc); ctx.beginPath(); p.path.forEach(([x, y], i) => i ? ctx.lineTo(ox + x * esc, oy + y * esc) : ctx.moveTo(ox + x * esc, oy + y * esc)); ctx.stroke(); }
  for (const l of Object.values(m.lights)) { const g = ctx.createRadialGradient(ox + l.position[0] * esc, oy + l.position[1] * esc, 0, ox + l.position[0] * esc, oy + l.position[1] * esc, Math.max(6, Math.min(l.radius, 4) * esc)); g.addColorStop(0, `${l.color}aa`); g.addColorStop(1, `${l.color}00`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  for (const o of Object.values(m.props).sort((a, b) => camadaDoObjeto(a) - camadaDoObjeto(b))) { ctx.fillStyle = css(corDoNome(o.source.kind === 'recipe' ? o.source.recipe : o.source.assetId, 0.35, 0.38)); ctx.fillRect(ox + o.position[0] * esc - 2, oy + o.position[1] * esc - 2, 4, 4); }
  for (const p of Object.values(m.tokens)) { ctx.fillStyle = css(hexParaNumero(acento)); ctx.beginPath(); ctx.arc(ox + p.position[0] * esc, oy + p.position[1] * esc, 3.5, 0, 7); ctx.fill(); }
}

/** Prévia de um telhado num quadrado 2×2 para o seletor de estilos do inspetor (mesmas faces, cobertura, luz e detalhes da cena). */
export function desenharMiniaturaDoTelhado(canvas: HTMLCanvasElement | OffscreenCanvas, roof: Omit<Comodo['roof'], 'visible'>): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!roof.material) return;

  const esc = Math.min(w, h) / 3.0;
  ctx.save();
  ctx.translate((w - 2 * esc) / 2, (h - 2 * esc) / 2);
  ctx.scale(esc, esc);

  const beiral = 0.2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-beiral + 0.16, -beiral + 0.16, 2 + beiral * 2, 2 + beiral * 2);

  const mat = materialDe(roof.material);
  const { faces, cumeeiras } = aguasDe([0, 0, 2, 2], roof, beiral);
  const pat = ehPadraoDeCobertura(mat.padrao) ? (() => {
    const cob = texturaDeCobertura(mat, 'illustrated', 1);
    return { p: ctx.createPattern(cob.tela as CanvasImageSource, 'repeat'), escala: cob.metros / cob.tela.width };
  })() : null;
  const dir: [number, number] = [-Math.SQRT1_2, -Math.SQRT1_2];
  const alfaBase = roof.steep ? 0.28 : 0.18;

  for (const face of faces) {
    if (face.platibanda) {
      ctx.beginPath();
      const o = face.pontos.slice(0, 4), i = face.pontos.slice(5, 9);
      ctx.moveTo(o[0]![0], o[0]![1]);
      for (let k = 1; k < o.length; k++) ctx.lineTo(o[k]![0], o[k]![1]);
      ctx.closePath();
      ctx.moveTo(i[0]![0], i[0]![1]);
      for (let k = 1; k < i.length; k++) ctx.lineTo(i[k]![0], i[k]![1]);
      ctx.closePath();
      ctx.fillStyle = mat.escuro;
      ctx.fill('evenodd');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.fillRect(0.05, 0.05, 1.9, 0.18);
      ctx.fillRect(0.05, 0.23, 0.18, 1.72);
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(face.pontos[0]![0], face.pontos[0]![1]);
    for (let k = 1; k < face.pontos.length; k++) ctx.lineTo(face.pontos[k]![0], face.pontos[k]![1]);
    ctx.closePath();
    if (pat?.p) {
      const deg = ((Math.atan2(face.queda[1], face.queda[0]) - Math.PI / 2) * 180) / Math.PI;
      pat.p.setTransform(new DOMMatrix().rotate(deg).scale(pat.escala));
      ctx.fillStyle = pat.p;
    } else {
      ctx.fillStyle = mat.base;
    }
    ctx.fill();

    const dot = face.normal[0] * dir[0] + face.normal[1] * dir[1];
    if (Math.abs(dot) > 0.001) {
      ctx.fillStyle = dot > 0 ? `rgba(255, 255, 255, ${alfaBase * dot})` : `rgba(0, 0, 0, ${alfaBase * -dot})`;
      ctx.fill();
    }
  }

  if (cumeeiras.length) {
    ctx.strokeStyle = mat.claro;
    ctx.lineWidth = 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [[x0, y0], [x1, y1]] of cumeeiras) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke();
  }

  const forma = formaDe(roof);
  if (forma.shape === 'duas-aguas') {
    ctx.strokeStyle = mat.escuro;
    ctx.lineWidth = 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (forma.ridge === 'v') {
      ctx.moveTo(-beiral, -beiral); ctx.lineTo(2 + beiral, -beiral);
      ctx.moveTo(-beiral, 2 + beiral); ctx.lineTo(2 + beiral, 2 + beiral);
    } else {
      ctx.moveTo(-beiral, -beiral); ctx.lineTo(-beiral, 2 + beiral);
      ctx.moveTo(2 + beiral, -beiral); ctx.lineTo(2 + beiral, 2 + beiral);
    }
    ctx.stroke();
  }

  const trecho = { salas: ['miniatura'], celulas: [[0, 0], [1, 0], [0, 1], [1, 1]] as [number, number][], roof: { ...roof, visible: true } };
  const estilo = estiloDe('illustrated');
  for (const pos of posicoesDosDetalhes(trecho, { size: 1, offset: [0, 0] }, 1)) {
    const assado = assarDescricao(descricaoDoDetalhe(pos.detalhe, { cobertura: mat.id, semente: 1 }), 1, 24, estilo);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.ang);
    ctx.drawImage(assado.tela as CanvasImageSource, assado.origem[0], assado.origem[1], assado.tela.width / assado.res, assado.tela.height / assado.res);
    ctx.restore();
  }
  ctx.restore();
}
