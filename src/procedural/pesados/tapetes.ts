import { elipse, poli, ret, type DescricaoDePiso, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import type { GeradorPesado } from './index.ts';

interface Paleta { campo: string; borda: string; ouro: string; motivo: string; medalhao: string }
const PALETAS: Record<string, Paleta> = {
  vinho: { campo: '#6e1f2a', borda: '#1a2440', ouro: '#c9a45a', motivo: '#e6d3a8', medalhao: '#2a3f6b' },
  verde: { campo: '#2f4a32', borda: '#14221a', ouro: '#d9c98e', motivo: '#c49a4a', medalhao: '#6b4f1a' },
  creme: { campo: '#d9c7a0', borda: '#a5502f', ouro: '#7a3b1f', motivo: '#8a5a35', medalhao: '#b9653a' },
};
const VARIANTES = [{ nome: 'vinho e azul-marinho', sufixo: 'vinho' }, { nome: 'verde e ouro', sufixo: 'verde' }, { nome: 'creme e terracota', sufixo: 'creme' }];

const Z = 0.02, base = { semSombra: true, contorno: false as const };
const losango = (cx: number, cy: number, w: number, h: number, mat: string, z: number): Parte => poli([cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy], mat, z, { ...base, detalhe: 2 });
/** Os pontos de um quadrante espelhados nos quatro (o tapete é simétrico nos dois eixos). */
const espelhar = (pontos: [number, number][]): [number, number][] => pontos.flatMap(([x, y]) => [[x, y], [-x, y], [x, -y], [-x, -y]] as [number, number][]);

interface Forma { w: number; h: number; oval: boolean; passadeira: boolean }

/** Tapete persa visto de cima: franja nas pontas menores, três faixas de borda, campo com medalhão central, cantoneiras e flores; desgaste leve. */
function tapete(f: Forma, pal: Paleta, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), { w, h } = f, partes: Parte[] = [], forma = f.oval ? elipse : ret;
  const camada = (inset: number, mat: string, z: number, extra: Partial<Parte> = {}) => partes.push(forma(0, 0, w - 2 * inset, h - 2 * inset, mat, z, { ...base, ...extra }));
  // Franja nas pontas menores (nos lados de menor medida), saindo para fora da borda.
  const compridoEmX = w >= h, ponta = compridoEmX ? h : w, nFranjas = Math.round(ponta / 0.045);
  if (!f.oval) for (let i = 0; i < nFranjas; i++) for (const lado of [-1, 1]) {
    const t = -ponta / 2 + (i + 0.5) * (ponta / nFranjas), x = compridoEmX ? lado * (w / 2 + 0.05) : t, y = compridoEmX ? t : lado * (h / 2 + 0.05);
    partes.push(ret(x, y, compridoEmX ? 0.1 : 0.012, compridoEmX ? 0.012 : 0.1, '#e8dcc0', 0.005, { ...base, detalhe: 3 }));
  }
  camada(0, pal.borda, Z, { contorno: 'leve' }); camada(0.04, pal.ouro, Z + 0.001); camada(0.07, pal.borda, Z + 0.002);
  camada(0.09, tom(pal.borda, 0.12), Z + 0.003);                                   // faixa principal da borda
  camada(0.27, pal.ouro, Z + 0.004); camada(0.295, pal.campo, Z + 0.005);          // fio de ouro e campo
  // Motivos em losango na faixa principal, dando a volta.
  const passo = 0.2, topo = (w - 0.4) / 2, lado = (h - 0.4) / 2;
  if (!f.oval) {
    for (let x = -topo + 0.1; x <= topo - 0.05; x += passo) for (const s of [-1, 1]) partes.push(losango(x, s * (h / 2 - 0.18), 0.1, 0.1, pal.motivo, Z + 0.006));
    for (let y = -lado + 0.1; y <= lado - 0.05; y += passo) for (const s of [-1, 1]) partes.push(losango(s * (w / 2 - 0.18), y, 0.1, 0.1, pal.motivo, Z + 0.006));
  } else {
    const n = 34; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; partes.push(losango(Math.cos(a) * (w / 2 - 0.18), Math.sin(a) * (h / 2 - 0.18), 0.1, 0.1, pal.motivo, Z + 0.006)); }
  }
  const campoW = w - 0.6, campoH = h - 0.6;
  // Medalhão: anéis concêntricos, estrela de oito pontas e miolo; na passadeira, três em fila.
  const medalhao = (cx: number, cy: number, raio: number) => {
    partes.push(elipse(cx, cy, raio * 2, raio * 1.5, pal.ouro, Z + 0.007, base), elipse(cx, cy, raio * 1.85, raio * 1.35, pal.medalhao, Z + 0.008, base));
    const estrela: number[] = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? raio * 0.55 : raio * 0.95; estrela.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75); }
    partes.push(poli(estrela, pal.motivo, Z + 0.009, { ...base, detalhe: 2 }), elipse(cx, cy, raio * 0.7, raio * 0.52, pal.campo, Z + 0.01, base), losango(cx, cy, raio * 0.75, raio * 0.55, pal.ouro, Z + 0.011), elipse(cx, cy, raio * 0.22, raio * 0.18, pal.medalhao, Z + 0.012, base));
    for (const s of [-1, 1]) partes.push(losango(cx + s * raio * 1.25, cy, raio * 0.4, raio * 0.28, pal.motivo, Z + 0.009), losango(cx, cy + s * raio * 1.05, raio * 0.28, raio * 0.4, pal.motivo, Z + 0.009));
  };
  if (f.passadeira) { const n = Math.max(1, Math.round(campoW / 1.0)); for (let i = 0; i < n; i++) medalhao(-campoW / 2 + (i + 0.5) * (campoW / n), 0, Math.min(campoH * 0.34, campoW / n * 0.3)); }
  else medalhao(0, 0, Math.min(campoW, campoH * 1.3) * 0.22);
  // Cantoneiras e flores espalhadas, simétricas.
  const quadrante: [number, number][] = [];
  const nFlores = f.passadeira ? 6 : Math.round(8 + w * h * 1.6);
  for (let i = 0; i < nFlores; i++) quadrante.push([(0.08 + r() * 0.92) * campoW / 2 * 0.92, (0.08 + r() * 0.92) * campoH / 2 * 0.92]);
  for (const [x, y] of espelhar(quadrante)) {
    if (Math.hypot(x / (campoW * 0.3), y / (campoH * 0.34)) < 1) continue;           // não invade o medalhão
    const tam = 0.06 + r() * 0.04;
    partes.push(elipse(x, y, tam, tam, pal.motivo, Z + 0.006, { ...base, detalhe: 3 }), elipse(x, y, tam * 0.45, tam * 0.45, pal.ouro, Z + 0.007, { ...base, detalhe: 3 }));
  }
  if (!f.passadeira) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const cx = sx * (campoW / 2 - 0.12), cy = sy * (campoH / 2 - 0.12);
    partes.push(elipse(cx, cy, 0.3, 0.3, pal.medalhao, Z + 0.006, base), elipse(cx, cy, 0.18, 0.18, pal.ouro, Z + 0.007, base), losango(cx, cy, 0.16, 0.16, pal.campo, Z + 0.008));
  }
  // Desgaste leve: manchinhas do tom do campo, mais claras ou mais escuras.
  for (let i = 0; i < (f.passadeira ? 6 : 22); i++) { const x = (r() - 0.5) * (w - 0.3), y = (r() - 0.5) * (h - 0.3), t = 0.05 + r() * 0.07; partes.push(elipse(x, y, t, t * (0.5 + r() * 0.5), tom(pal.campo, r() < 0.5 ? 0.07 : -0.08), Z + 0.013, { ...base, detalhe: 3 })); }
  return { tipo: 'piso', pegada: [w, h], partes };
}

const tapeteGerador = (id: string, nome: string, funcoes: string[], f: Forma): GeradorPesado => ({
  id, nome, categoria: 'tapetes', funcoes, tags: ['tapete', 'persa', 'ornamentado'], generos: ['investigacao', 'fantasia'], kit: 'investigacao', versao: 2,
  variantes: VARIANTES.map((v, i) => ({ ...v, params: { paleta: v.sufixo }, seed: 61 + i })),
  gerar: p => tapete(f, PALETAS[String(p.params.paleta)] ?? PALETAS.vinho!, p.seed),
});

export const TAPETES: GeradorPesado[] = [
  tapeteGerador('tapete-persa-p', 'Tapete persa com medalhão (3 × 2 m)', ['sala', 'quarto', 'biblioteca', 'escritorio'], { w: 3, h: 2, oval: false, passadeira: false }),
  tapeteGerador('tapete-persa-g', 'Tapete persa com medalhão (4 × 2,8 m)', ['sala', 'biblioteca'], { w: 4, h: 2.8, oval: false, passadeira: false }),
  tapeteGerador('tapete-oval', 'Tapete oval', ['sala', 'quarto'], { w: 2.4, h: 1.6, oval: true, passadeira: false }),
  tapeteGerador('passadeira', 'Passadeira de corredor', ['corredor'], { w: 3, h: 0.9, oval: false, passadeira: true }),
];
