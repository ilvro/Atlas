import { Application, Container, Sprite, Graphics, Texture, RenderTexture, Rectangle, BlurFilter } from 'pixi.js';
import { mapa, CELULA } from './mapa.js';
import { contorno, arestasDeParede, oclusores, visibilidade, caminho, segmentoDaAresta } from './geometria.js';
import { assar } from './assar.js';
import { gerarFolha, QUADRO, DIRECOES } from './sprite.js';
import { filtroAcabamento, filtroPaleta, filtroFaixas } from './filtros.js';
import { CLIMAS, misturarClimas } from './climas.js';
import { valueNoise2D } from './ruido.js';
import { montarPainel, toast, transicao } from './ui.js';

const TEMAS = {
  ordem: { acento: '#e91d25', acentoTexto: '#ffffff', fundo: '#07080b', fundoTraco: '#1a2a30' },
  prata: { acento: '#d8dbe2', acentoTexto: '#0b0c10', fundo: '#08090c', fundoTraco: '#23262e' },
};

const RES_ILUSTRADO = 96;          // pixels por metro
const RES_LUZ = 24, RES_NEVOA = 16;

const estado = { estilo: 'ilustrado', paredes: 'caixa', clima: 'noite', visao: 'jogadores', ppc: 16, tema: 'ordem', grade: false, lanterna: false, som: true };
const res = () => estado.estilo === 'pixel' ? estado.ppc / CELULA : RES_ILUSTRADO;

const app = new Application();
await app.init({ preference: 'webgl', resizeTo: window, background: '#040405', antialias: false, resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
document.getElementById('palco').appendChild(app.canvas);
await Promise.all(['700 1em Cinzel', '600 1em "Hanken Grotesk"', '1em "Special Elite"'].map(f => document.fonts.load(f).catch(() => {})));

// ---------- Dados derivados do documento ----------
const paredes = arestasDeParede(mapa.comodos);
const aberturas = mapa.aberturas.map(a => ({ ...a, aberta: a.estado === 'aberta' ? 1 : 0, alvo: a.estado === 'aberta' ? 1 : 0 }));
const porta = aberturas.find(a => a.tipo === 'porta'), segPorta = segmentoDaAresta(porta.aresta);
const celulasLivres = new Set(mapa.comodos.flatMap(c => c.cells.map(([x, y]) => `${x},${y}`)));
const lacosPorComodo = new Map(mapa.comodos.map(c => [c.id, contorno(c.cells)]));
function normalInterna(aresta) {
  for (const lacos of lacosPorComodo.values()) for (const laco of lacos) for (const e of laco) if (e.ks.includes(aresta)) return e.n;
  return { x: 0, y: 1 };
}

// ---------- Texturas auxiliares ----------
function texturaRadial(tamanho, paradas) {
  const c = document.createElement('canvas'); c.width = c.height = tamanho;
  const g = c.getContext('2d'), gr = g.createRadialGradient(tamanho / 2, tamanho / 2, 0, tamanho / 2, tamanho / 2, tamanho / 2);
  for (const [o, cor] of paradas) gr.addColorStop(o, cor);
  g.fillStyle = gr; g.fillRect(0, 0, tamanho, tamanho);
  return Texture.from(c);
}
const texLuz = texturaRadial(256, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.75)'], [0.6, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]);
const texBrilho = texturaRadial(128, [[0, 'rgba(255,230,180,0.9)'], [0.2, 'rgba(255,170,90,0.45)'], [1, 'rgba(255,120,40,0)']]);
const texSombra = texturaRadial(64, [[0, 'rgba(0,0,0,0.6)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);

const imgRetrato = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = './muirenn.png'; });
function texturaRetrato(acento) {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 2, 0, 7); g.fillStyle = '#0b0a10'; g.fill();
  g.save(); g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 18, 0, 7); g.clip();
  g.fillStyle = '#1d1824'; g.fillRect(0, 0, n, n);
  if (imgRetrato) { const r = 250; g.drawImage(imgRetrato, 440 - r, 360 - r, r * 2, r * 2, 18, 18, n - 36, n - 36); }
  g.restore();
  g.lineWidth = 12; g.strokeStyle = acento; g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 12, 0, 7); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 19, 0, 7); g.stroke();
  return Texture.from(c);
}
const folhaSprite = Texture.from(gerarFolha(mapa.token.sprite)); folhaSprite.source.scaleMode = 'nearest';
const quadros = DIRECOES.map((_, l) => Array.from({ length: 6 }, (_, c) => new Texture({ source: folhaSprite.source, frame: new Rectangle(c * QUADRO[0], l * QUADRO[1], QUADRO[0], QUADRO[1]) })));

// ---------- Render targets persistentes ----------
const W = mapa.largura, H = mapa.altura;
const visivelRT = RenderTexture.create({ width: W * RES_NEVOA, height: H * RES_NEVOA });
const exploradoRT = RenderTexture.create({ width: W * RES_NEVOA, height: H * RES_NEVOA });
const luzBrutaRT = RenderTexture.create({ width: W * RES_LUZ, height: H * RES_LUZ });
const luzRT = RenderTexture.create({ width: W * RES_LUZ, height: H * RES_LUZ });
// Pixel: a luz composta passa por uma passada de faixas (luz em degraus) antes de multiplicar a cena.
const luzFaixasRT = RenderTexture.create({ width: W * RES_LUZ, height: H * RES_LUZ });
const passadaFaixas = new Sprite(luzRT); passadaFaixas.filters = [filtroFaixas(5)];
let mundoRT = null;

// Visão: polígono do token, em metros.
const visRaiz = new Container(); visRaiz.scale.set(RES_NEVOA);
const visPoligono = new Graphics(); visRaiz.addChild(visPoligono);

// Luz: cada fonte é um gradiente aditivo recortado pelo seu polígono de visibilidade.
const luzRaiz = new Container(); luzRaiz.scale.set(RES_LUZ);
const composicaoLuz = new Container();
const luzBrutaS = new Sprite(luzBrutaRT); luzBrutaS.blendMode = 'add';
const blurLuz = new BlurFilter({ strength: 5, quality: 3 }); blurLuz.blendMode = 'add';
composicaoLuz.addChild(luzBrutaS);
function criarLuz(base) {
  const c = new Container(), s = new Sprite(texLuz), m = new Graphics();
  s.anchor.set(0.5); s.blendMode = 'add'; s.mask = m; c.addChild(s, m); luzRaiz.addChild(c);
  return { ...base, c, s, m, nivel: 1 };
}
const luzes = mapa.luzes.map(criarLuz);
const luzesJanela = aberturas.filter(a => a.tipo === 'janela').map(a => {
  const s = segmentoDaAresta(a.aresta), n = normalInterna(a.aresta), mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
  return criarLuz({ id: a.id, x: mx - n.x * 0.3, y: my - n.y * 0.3, raio: 9.5, cor: [1, 1, 1], intensidade: 1, energia: 'ceu', cone: { dir: Math.atan2(n.y, n.x), abertura: 2.1 } });
});
const lanterna = criarLuz({ id: 'lanterna', x: 0, y: 0, raio: 8.5, cor: [1, 0.93, 0.8], intensidade: 1, energia: 'bateria', cone: { dir: 0, abertura: 1.05 } });
const luzPessoal = criarLuz({ id: 'pessoal', x: 0, y: 0, raio: 1.8, cor: [0.7, 0.75, 0.9], intensidade: 0.35, energia: 'bateria' });

// ---------- Mundo ----------
const camera = new Container(); app.stage.addChild(camera);
const vista = new Sprite(); camera.addChild(vista);
const acabamento = filtroAcabamento(), paleta = filtroPaleta();

let mundo = null, refs = {};
const cacheAssado = new Map();
const tempos = {};

function construir() {
  const r = res(), chave = `${estado.estilo}:${estado.paredes}:${estado.ppc}:${estado.tema}`, pixel = estado.estilo === 'pixel';
  let assado = cacheAssado.get(chave);
  if (!assado) {
    assado = assar(mapa, { estilo: estado.estilo, paredes: estado.paredes, res: r, tema: TEMAS[estado.tema] });
    const tex = k => { const t = Texture.from(assado[k]); t.source.scaleMode = pixel ? 'nearest' : 'linear'; return t; };
    assado.tex = { estatico: tex('estatico'), memoria: tex('memoria'), fundo: tex('fundo'), fora: tex('fora'), folha: tex('folha') };
    cacheAssado.set(chave, assado); tempos[chave] = Math.round(assado.tempo);
  }
  if (mundo) mundo.destroy({ children: true });
  mundoRT?.destroy(true);
  mundoRT = RenderTexture.create({ width: Math.round(W * r), height: Math.round(H * r), scaleMode: pixel ? 'nearest' : 'linear' });
  for (const t of [visivelRT, exploradoRT, luzRT, luzFaixasRT]) t.source.scaleMode = pixel ? 'nearest' : 'linear';

  mundo = new Container(); mundo.scale.set(r);
  const emMetros = (tex, escala) => { const s = new Sprite(tex); s.scale.set(1 / escala); return s; };
  const fundo = emMetros(assado.tex.fundo, r);
  const chuva = new Container(), foraChuva = emMetros(assado.tex.fora, r); chuva.mask = foraChuva;
  const clarao = new Sprite(Texture.WHITE); clarao.width = W; clarao.height = H; clarao.blendMode = 'add'; clarao.alpha = 0; clarao.tint = 0xc8d4ff;
  const foraClarao = emMetros(assado.tex.fora, r); clarao.mask = foraClarao;
  const memoria = emMetros(assado.tex.memoria, r), explorado = emMetros(exploradoRT, RES_NEVOA); memoria.mask = explorado; memoria.alpha = 0.78;
  const iluminado = new Container(), visivel = emMetros(visivelRT, RES_NEVOA);
  const estatico = emMetros(assado.tex.estatico, r);
  const folha = new Sprite(assado.tex.folha); folha.scale.set(1 / r); folha.pivot.set(...assado.folhaPivo); folha.position.set(segPorta.a.x, segPorta.a.y);
  const tokenC = new Container();
  const sombraToken = new Sprite(texSombra); sombraToken.anchor.set(0.5); sombraToken.width = 1.1; sombraToken.height = 0.55;
  const corpo = pixel ? new Sprite(quadros[0][0]) : new Sprite(texturaRetrato(TEMAS[estado.tema].acento));
  if (pixel) { corpo.anchor.set(0.5, 0.86); corpo.scale.set(CELULA / QUADRO[0]); } else { corpo.anchor.set(0.5); corpo.width = corpo.height = 1.25; }
  tokenC.addChild(sombraToken, corpo);
  const luz = emMetros(pixel ? luzFaixasRT : luzRT, RES_LUZ); luz.blendMode = 'multiply';
  const brilhos = new Container();
  const chamas = luzes.filter(l => l.chama).map(l => { const s = new Sprite(texBrilho); s.anchor.set(0.5); s.blendMode = 'add'; s.position.set(l.x, l.y); s.width = s.height = 1.1; brilhos.addChild(s); return { l, s }; });
  const grade = new Graphics();
  for (let x = 0; x <= W; x += CELULA) grade.moveTo(x, 0).lineTo(x, H);
  for (let y = 0; y <= H; y += CELULA) grade.moveTo(0, y).lineTo(W, y);
  grade.stroke({ width: pixel ? 1 / r : 0.02, color: 0xffffff, alpha: pixel ? 0.12 : 0.1 });
  grade.visible = estado.grade;

  iluminado.addChild(estatico, folha, tokenC, luz, brilhos, grade);
  mundo.addChild(fundo, chuva, clarao, memoria, iluminado, foraChuva, foraClarao, explorado, visivel);
  aplicarVisao(memoria, explorado, iluminado, visivel);
  acabamento.resources.acabamento.uniforms.uPixel = pixel ? 1 : 0;
  mundo.filters = pixel ? [acabamento, paleta] : [acabamento];
  composicaoLuz.filters = pixel ? [] : [blurLuz];

  vista.texture = mundoRT; vista.scale.set(1 / r);
  refs = { chuva, clarao, memoria, explorado, iluminado, visivel, folha, tokenC, corpo, sombraToken, chamas, grade, gotas: criarChuva(chuva, pixel, r) };
  ajustarZoom(zoom);
}

function aplicarVisao(memoria = refs.memoria, explorado = refs.explorado, iluminado = refs.iluminado, visivel = refs.visivel) {
  const mestre = estado.visao === 'mestre';
  memoria.visible = !mestre; memoria.mask = mestre ? null : explorado; iluminado.mask = mestre ? null : visivel;
  explorado.visible = !mestre; visivel.visible = !mestre;
}

function criarChuva(container, pixel, r) {
  const g = new Graphics();
  if (pixel) g.rect(0, 0, 1, 3).fill({ color: 0xc7d6e6, alpha: 1 }); else g.rect(0, 0, 3, 34).fill({ color: 0xd6e2f0, alpha: 0.85 });
  const tex = app.renderer.generateTexture(g);
  const gotas = [];
  for (let i = 0; i < 650; i++) {
    const s = new Sprite(tex); s.scale.set(1 / (pixel ? r : 96)); s.rotation = 0.22;
    s.position.set(Math.random() * W, Math.random() * H); s.alpha = 0.4 + Math.random() * 0.6; container.addChild(s); gotas.push({ s, v: 14 + Math.random() * 8 });
  }
  return gotas;
}

// ---------- Token ----------
const token = { x: (mapa.token.celula[0] + 0.5) * CELULA, y: (mapa.token.celula[1] + 0.5) * CELULA, rota: [], dir: 'baixo', angulo: Math.PI / 2, andando: false, t: 0 };
const celulaDe = (x, y) => [Math.floor(x / CELULA), Math.floor(y / CELULA)];
const bloqueadas = () => new Set(paredes.map(p => p.k).filter(k => !(k === porta.aresta && porta.aberta > 0.9)));
function irPara(celula) {
  const rota = caminho(celulaDe(token.x, token.y), celula, celulasLivres, bloqueadas());
  if (!rota) { toast('Sem caminho até lá'); return; }
  token.rota = rota.slice(1).map(([x, y]) => ({ x: (x + 0.5) * CELULA, y: (y + 0.5) * CELULA }));
}
function alternarPorta() {
  porta.alvo = porta.alvo ? 0 : 1;
  toast(porta.alvo ? 'Porta aberta' : 'Porta fechada');
}

// ---------- Clima ----------
let climaDe = CLIMAS[estado.clima], climaPara = CLIMAS[estado.clima], climaT = 1, falhaRede = 0;
let clima = misturarClimas(climaDe, climaPara, 1);
let flash = 0, proximoRaio = 4, trovoes = [];
function definirClima(id) {
  if (id === estado.clima) return;
  climaDe = clima_snapshot(); climaPara = CLIMAS[id]; climaT = 0;
  if (CLIMAS[estado.clima].rede > 0.5 && climaPara.rede < 0.5) falhaRede = 1.1;
  estado.clima = id;
  if (climaPara.lanterna && !estado.lanterna) { estado.lanterna = true; toast('Lanterna acesa'); }
  toast(`Clima: ${climaPara.nome}`);
  painel.atualizar(estado);
}
const clima_snapshot = () => ({ ...clima, acabamento: { ...clima.acabamento } });
function relampago() { flash = 1; if (estado.som) trovoes.push(0.4 + Math.random() * 1.2); }

let audio = null;
function trovao() {
  try {
    audio ??= new AudioContext();
    const dur = 2.6, buf = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate), d = buf.getChannelData(0);
    let v = 0; for (let i = 0; i < d.length; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = v * Math.pow(1 - i / d.length, 2); }
    const src = audio.createBufferSource(), lp = audio.createBiquadFilter(), g = audio.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 180; g.gain.value = 0.5; src.buffer = buf; src.connect(lp).connect(g).connect(audio.destination); src.start();
  } catch { /* som é opcional */ }
}

// ---------- Câmera ----------
let zoom = 1;
function ajustarZoom(z, foco = null) {
  const antes = zoom;
  if (estado.estilo === 'pixel') { const passo = res() / app.renderer.resolution; z = Math.max(passo, Math.round(z / passo) * passo); }
  zoom = Math.max(8, Math.min(400, z));
  if (foco) { camera.x = foco.x - (foco.x - camera.x) * zoom / antes; camera.y = foco.y - (foco.y - camera.y) * zoom / antes; }
  camera.scale.set(zoom);
}
function enquadrar() {
  zoom = Math.min(app.screen.width / (W + 1), app.screen.height / (H + 1)) * 0.92;
  ajustarZoom(zoom);
  camera.x = (app.screen.width - W * zoom) / 2 - 120; camera.y = (app.screen.height - H * zoom) / 2;
}

// ---------- Entrada ----------
let arrasto = null, espaco = false;
app.canvas.addEventListener('contextmenu', e => e.preventDefault());
app.canvas.addEventListener('pointerdown', e => {
  arrasto = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y, mover: e.button !== 0 || espaco, distancia: 0 };
});
window.addEventListener('pointermove', e => {
  if (!arrasto) return;
  arrasto.distancia = Math.max(arrasto.distancia, Math.hypot(e.clientX - arrasto.x, e.clientY - arrasto.y));
  if (arrasto.mover || arrasto.distancia > 6) { camera.x = arrasto.cx + e.clientX - arrasto.x; camera.y = arrasto.cy + e.clientY - arrasto.y; }
});
window.addEventListener('pointerup', e => {
  if (arrasto && !arrasto.mover && arrasto.distancia <= 6 && e.target === app.canvas) {
    const mx = (e.clientX - camera.x) / zoom, my = (e.clientY - camera.y) / zoom;
    const cx = (segPorta.a.x + segPorta.b.x) / 2, cy = (segPorta.a.y + segPorta.b.y) / 2;
    if (Math.hypot(mx - cx, my - cy) < 0.8) alternarPorta(); else irPara(celulaDe(mx, my));
  }
  arrasto = null;
});
app.canvas.addEventListener('wheel', e => { e.preventDefault(); ajustarZoom(zoom * Math.exp(-e.deltaY * 0.0015), { x: e.clientX, y: e.clientY }); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { espaco = true; e.preventDefault(); }
  const passo = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] }[k];
  if (passo && !token.rota.length) { const [cx, cy] = celulaDe(token.x, token.y); irPara([cx + passo[0], cy + passo[1]]); }
  const acoes = {
    e: () => { const cx = (segPorta.a.x + segPorta.b.x) / 2, cy = (segPorta.a.y + segPorta.b.y) / 2; if (Math.hypot(token.x - cx, token.y - cy) < 2.4) alternarPorta(); else toast('Chegue perto da porta'); },
    l: () => { estado.lanterna = !estado.lanterna; toast(estado.lanterna ? 'Lanterna acesa' : 'Lanterna apagada'); painel.atualizar(estado); },
    g: () => mudar({ grade: !estado.grade }), p: () => mudar({ estilo: estado.estilo === 'pixel' ? 'ilustrado' : 'pixel' }),
    b: () => mudar({ paredes: estado.paredes === 'caixa' ? 'solida' : 'caixa' }), m: () => mudar({ visao: estado.visao === 'mestre' ? 'jogadores' : 'mestre' }),
    r: () => relampago(), 1: () => definirClima('dia'), 2: () => definirClima('tempestade'), 3: () => definirClima('noite'), 4: () => definirClima('apagao'),
    f: () => enquadrar(),
  };
  acoes[k]?.();
});
window.addEventListener('keyup', e => { if (e.key === ' ') espaco = false; });
window.addEventListener('resize', () => setTimeout(enquadrar, 50));

// ---------- Mudanças de estado vindas do painel ----------
async function mudar(patch) {
  const rebuild = ['estilo', 'paredes', 'ppc', 'tema'].some(k => k in patch && patch[k] !== estado[k]);
  if ('clima' in patch) { definirClima(patch.clima); delete patch.clima; }
  if (!Object.keys(patch).length) return;
  if (rebuild) await transicao(estado.tema, () => { Object.assign(estado, patch); construir(); });
  else { Object.assign(estado, patch); if ('visao' in patch) aplicarVisao(); if ('grade' in patch) refs.grade.visible = estado.grade; }
  if ('tema' in patch) document.documentElement.dataset.tema = estado.tema;
  if ('estilo' in patch) toast(estado.estilo === 'pixel' ? `Renderizador Pixel · ${estado.ppc} px por célula` : 'Renderizador Ilustrado');
  if ('paredes' in patch) toast(estado.paredes === 'caixa' ? 'Paredes caixa' : 'Paredes sólidas');
  if ('visao' in patch) toast(estado.visao === 'mestre' ? 'Visão do mestre: tudo à mostra' : 'Visão dos jogadores');
  painel.atualizar(estado);
}

const painel = montarPainel({ estado, mudar, relampago: () => relampago(), lanterna: () => { estado.lanterna = !estado.lanterna; painel.atualizar(estado); }, porta: alternarPorta, enquadrar });

// ---------- Laço ----------
const ruidoChama = valueNoise2D(3);
let tempo = 0, fpsMedia = 60;
const amostrasFps = [];

function atualizarLuz(l, dt) {
  const segs = oclusores(paredes, aberturas);
  const pts = visibilidade({ x: l.x, y: l.y }, segs, l.raio, l.cone ?? null);
  l.m.clear().poly(pts).fill(0xffffff);
  l.s.position.set(l.x, l.y); l.s.width = l.s.height = l.raio * 2;
  const k = Math.max(0, Math.min(1, l.intensidade * l.nivel));
  l.s.tint = ((Math.round(l.cor[0] * 255) << 16) | (Math.round(l.cor[1] * 255) << 8) | Math.round(l.cor[2] * 255));
  l.s.alpha = k; l.c.visible = k > 0.01;
}

app.ticker.add(tk => {
  const dt = Math.min(0.05, tk.deltaMS / 1000); tempo += dt;
  fpsMedia = fpsMedia * 0.95 + (1000 / Math.max(1, tk.deltaMS)) * 0.05; amostrasFps.push(1000 / Math.max(1, tk.deltaMS)); if (amostrasFps.length > 600) amostrasFps.shift();

  // Clima em transição.
  if (climaT < 1) { climaT = Math.min(1, climaT + dt / 1.6); clima = misturarClimas(climaDe, climaPara, climaT * climaT * (3 - 2 * climaT)); }
  if (CLIMAS[estado.clima].relampago) { proximoRaio -= dt; if (proximoRaio <= 0) { relampago(); proximoRaio = 4 + Math.random() * 7; } }
  trovoes = trovoes.filter(t => { if (t - dt <= 0) { trovao(); return false; } return true; }).map(t => t - dt);
  const f = flash; flash = Math.max(0, flash - dt * 2.2);
  const clarao = f > 0 ? Math.max(0, Math.sin(f * Math.PI * 3)) * f : 0;

  // Porta.
  porta.aberta += Math.sign(porta.alvo - porta.aberta) * Math.min(Math.abs(porta.alvo - porta.aberta), dt * 3.2);
  const ab = porta.aberta * porta.aberta * (3 - 2 * porta.aberta);
  refs.folha.rotation = Math.PI / 2 - ab * Math.PI / 2 * 0.92;

  // Token.
  token.andando = token.rota.length > 0;
  if (token.andando) {
    const alvo = token.rota[0], dx = alvo.x - token.x, dy = alvo.y - token.y, d = Math.hypot(dx, dy), v = 4 * dt;
    if (d <= v) { token.x = alvo.x; token.y = alvo.y; token.rota.shift(); } else { token.x += dx / d * v; token.y += dy / d * v; }
    if (d > 0.01) { token.angulo = Math.atan2(dy, dx); token.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'dir' : 'esq') : (dy > 0 ? 'baixo' : 'cima'); }
  }
  token.t += dt;
  refs.tokenC.position.set(token.x, token.y);
  if (estado.estilo === 'pixel') {
    const linha = DIRECOES.indexOf(token.dir), col = token.andando ? 2 + Math.floor(token.t * 9) % 4 : Math.floor(token.t * 1.6) % 2;
    refs.corpo.texture = quadros[linha][col]; refs.sombraToken.position.set(0, 0.05);
  } else {
    refs.corpo.scale.y = refs.corpo.scale.x * (1 + (token.andando ? Math.sin(token.t * 18) * 0.03 : 0));
  }

  // Luzes: rede elétrica, fogo, céu pelas janelas, lanterna.
  let rede = clima.rede;
  if (falhaRede > 0) { falhaRede -= dt; rede = falhaRede > 0.25 ? (Math.sin(falhaRede * 38) > 0.2 ? 1 : 0.15) : 0; }
  for (const l of luzes) {
    l.nivel = l.energia === 'rede' ? rede : 1;
    if (l.tremula) l.nivel *= 0.86 + 0.14 * ruidoChama(tempo * 7, l.x);
    atualizarLuz(l, dt);
  }
  for (const l of luzesJanela) { l.cor = clima.ceu.map(c => Math.min(1, c + clarao * 0.6)); l.nivel = Math.min(1, clima.ceuIntensidade + clarao * 1.2); atualizarLuz(l, dt); }
  lanterna.x = token.x; lanterna.y = token.y; lanterna.cone.dir = token.angulo; lanterna.nivel = estado.lanterna ? 0.95 + 0.05 * ruidoChama(tempo * 20, 9) : 0; atualizarLuz(lanterna, dt);
  luzPessoal.x = token.x; luzPessoal.y = token.y; luzPessoal.nivel = 1; atualizarLuz(luzPessoal, dt);
  for (const { l, s } of refs.chamas) { s.alpha = 0.55 + 0.45 * l.nivel; s.scale.set((1.0 + 0.08 * ruidoChama(tempo * 9, 4)) / 128 * 1.1); }

  // Chuva e clarão.
  refs.chuva.visible = clima.chuva > 0.02; refs.chuva.alpha = clima.chuva;
  if (refs.chuva.visible) for (const g of refs.gotas) { g.s.y += g.v * dt; g.s.x -= g.v * dt * 0.22; if (g.s.y > H) { g.s.y = -1; g.s.x = Math.random() * (W + 4); } }
  refs.clarao.alpha = clarao * 0.55;

  // Acabamento.
  const u = acabamento.resources.acabamento.uniforms, a = clima.acabamento;
  u.uSaturacao = a.saturacao; u.uContraste = a.contraste; u.uTom = new Float32Array(a.tom); u.uVinheta = a.vinheta; u.uGrao = a.grao; u.uTempo = tempo;

  // Passes: luz bruta → luz (ambiente + luz bruta) → visão → explorado → mundo.
  const amb = clima.ambiente.map(v => Math.min(1, v + clarao * 0.35));
  app.renderer.render({ container: luzRaiz, target: luzBrutaRT, clear: true, clearColor: [0, 0, 0, 0] });
  app.renderer.render({ container: composicaoLuz, target: luzRT, clear: true, clearColor: [...amb, 1] });
  if (estado.estilo === 'pixel') app.renderer.render({ container: passadaFaixas, target: luzFaixasRT, clear: true, clearColor: [0, 0, 0, 1] });
  if (estado.visao !== 'mestre') {
    const segs = oclusores(paredes, aberturas);
    // O contorno da espessura da parede deixa a própria parede visível, sem revelar o outro lado.
    const pts = visibilidade({ x: token.x, y: token.y }, segs, mapa.token.visao);
    visPoligono.clear().poly(pts).fill(0xffffff).poly(pts).stroke({ width: mapa.paredes.espessura * (estado.paredes === 'caixa' ? 0.95 : 1.55), color: 0xffffff, join: 'round' });
    app.renderer.render({ container: visRaiz, target: visivelRT, clear: true, clearColor: [0, 0, 0, 0] });
    app.renderer.render({ container: visRaiz, target: exploradoRT, clear: false });
  }
  app.renderer.render({ container: mundo, target: mundoRT, clear: true, clearColor: [0, 0, 0, 1] });

  painel.diagnostico(`${Math.round(fpsMedia)} fps · ${estado.estilo === 'pixel' ? `${Math.round(W * res())}×${Math.round(H * res())}` : `${W * RES_ILUSTRADO}×${H * RES_ILUSTRADO}`} · assar ${tempos[`${estado.estilo}:${estado.paredes}:${estado.ppc}:${estado.tema}`] ?? '—'} ms`);
});

construir();
enquadrar();
document.documentElement.dataset.tema = estado.tema;
painel.atualizar(estado);

// API para a medição automatizada (scripts/medir.mjs).
window.atlas = {
  estado,
  mudar: async patch => { await mudar({ ...patch }); },
  clima: id => definirClima(id),
  irPara: c => irPara(c),
  porta: () => alternarPorta(),
  tempos,
  camadas: (nomes, visivel) => { for (const n of nomes) refs[n].visible = visivel; },
  debug: () => {
    const pts = visibilidade({ x: token.x, y: token.y }, oclusores(paredes, aberturas), mapa.token.visao);
    const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
    return { token: [token.x, token.y], n: pts.length / 2, caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], amostra: pts.slice(0, 40).map(v => +v.toFixed(2)) };
  },
  fps: ms => new Promise(ok => { amostrasFps.length = 0; setTimeout(() => { const v = [...amostrasFps].sort((a, b) => a - b); ok({ media: v.reduce((s, x) => s + x, 0) / v.length, p5: v[Math.floor(v.length * 0.05)] }); }, ms); }),
};
