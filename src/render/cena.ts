import { Container, Graphics, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import { decodificar } from '../domain/celulas.ts';
import { comprimentoDaParede, pontoNaParede } from '../domain/geometria.ts';
import type { Abertura, Luz, MapaAtlas, Objeto, Parede, Peca, Ponto, Regiao } from '../domain/mapa.ts';
import { materialDe } from '../procedural/materiais.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { Baker } from '../procedural/baker.ts';
import type { PedidoDeBake, ResultadoDeBake } from '../procedural/executar.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { corDoNome, hexParaNumero } from './cores.ts';
import { chaveDoComodo, chaveDoObjeto, chaveDoTerreno, pedidoDoObjeto, contextoDeEntradas, entradaDoComodo, entradaDoTerreno, opcoesDoPixel, resolucaoDe } from './entradas.ts';
import { nivelDaLuz } from '../domain/clima.ts';
import { criarMapaDeLuz } from './mapa-de-luz.ts';
import { criarNevoa, type Vista } from './nevoa.ts';
import { secretaOculta } from '../domain/nevoa.ts';
import { criarNeblina } from './neblina.ts';
import { criarParticulas } from './particulas.ts';
import { criarTelhados } from './telhados.ts';
import { criarPeca, type PecaVisual } from './pecas.ts';
import { emEstadoCritico, type Recursos } from '../domain/fichas.ts';
import type { RetratoNoPixel } from './retratos.ts';
import { paletaDe } from '../domain/paletas.ts';
import { criarPresenca } from './presenca.ts';

export interface OpcoesDaCena {
  baker: Baker;
  /** O renderizador, para o mapa de luz (texturas fora da tela). */
  renderer: Renderer;
  acento(): number;
  /** Os efeitos de entrada (o "pop" do item novo) estão ligados? */
  efeitos(): boolean;
  /** Uma textura nova chegou do worker: o viewport precisa redesenhar. */
  aoPintar?(): void;
  /** O retrato de uma peça (pelo id do asset), ou `null` se ainda não chegou. */
  retrato?(id: string | null | undefined, pixel?: RetratoNoPixel): Texture | null;
  /** PV e PD da ficha ligada a uma peça (só do mestre, ou do projetor se ele quiser). */
  recursos?(t: Peca): Recursos | null;
}

export interface Cena {
  readonly raiz: Container;
  /** `mudancas === null` refaz tudo. */
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null, comPop: boolean, visaoDoClima?: MapaAtlas): void;
  /** Só a atmosfera (luz, neblina, partículas) com o clima de `visao`: o que a transição de clima chama a cada quadro. */
  atualizarAtmosfera(visao: MapaAtlas): void;
  /** Avança as animações de entrada e a tremulação das luzes. */
  quadro(agora: number): void;
  /** A atmosfera (luz, sombras) aparece? É do editor, não do mapa. */
  definirAtmosfera(ligada: boolean): void;
  /** Um relâmpago agora (com trovão, se o som estiver ligado). */
  relampagoAgora(): void;
  /** Eventos de cena: multiplicadores da intensidade das luzes e do ambiente. */
  definirEfeitosDeLuz(luzes: number, ambiente: number): void;
  /** No projetor: sem marcadores de luz nem regiões (são do mestre). */
  definirModoProjetor(ligado: boolean): void;
  /** Para os testes: a opacidade de cada telhado. */
  diagnosticoDosTelhados(): ReturnType<ReturnType<typeof criarTelhados>['diagnostico']>;
  /** Pelos olhos de quem se vê o mapa: Construir e mestre veem tudo; os jogadores só o que as suas peças enxergam, com os telhados fechados. */
  definirVista(v: Vista): void;
  /** Para os testes: como cada peça está desenhada agora (retrato, deitada, raio). */
  diagnosticoDasPecas(): { id: string; vez: boolean; retrato: boolean; deitada: boolean; raio: number; quadro: { linha: number; coluna: number } | null; pips: Recursos | null; estadoVisto: string }[];
  /** Quantos objetos de piso já têm a textura pintada (sem o marcador). */
  objetosPintados(): number;
  /** Refaz o desenho de todas as peças (chegaram PV e PD novos, por exemplo). */
  redesenharPecas(): void;
  /** Quantas presenças estão desenhadas agora. */
  contagemDePresencas(): number;
  /** Quantas partículas de cada tipo existem agora. */
  contagemDeParticulas(): ReturnType<ReturnType<typeof criarParticulas>['contagem']>;
  /** Quantos desenhos ainda estão sendo pintados no worker. */
  readonly pintando: number;
  destruir(): void;
}

interface Entrada { c: Container; placeholder: Graphics; sprite: Sprite | null; chave: string; chaveTextura: string | null }

export function criarCena(op: OpcoesDaCena): Cena {
  const raiz = new Container(), terrenoC = new Container(), comodosC = new Container(), objetosC = Object.assign(new Container(), { sortableChildren: true }), paredesG = new Graphics();
  const marcasG = new Graphics(), regioesC = new Container(), luzesC = new Container(), pecasC = new Container(), tituloC = new Container();
  const luz = criarMapaDeLuz(op.renderer), nevoa = criarNevoa(op.renderer), telhados = criarTelhados(), neblina = criarNeblina(), particulas = criarParticulas(), presenca = criarPresenca();
  // A luz multiplica tudo o que está embaixo (piso, objetos, paredes); marcadores, regiões e peças ficam por cima, sempre legíveis.
  raiz.addChild(terrenoC, comodosC, objetosC, paredesG, presenca.abaixo, luz.sprite, presenca.acima, neblina.raiz, particulas.raiz, regioesC, luzesC, marcasG, pecasC, nevoa.sprite, telhados.raiz, tituloC);

  let mapa: MapaAtlas | null = null, vistaDaCena: Vista = 'construir', destruida = false, pintandoAgora = 0, ultimoQuadro = -1;
  const salas = new Map<string, Entrada>(), objetos = new Map<string, Entrada>();
  const luzes = new Map<string, Container>(), pecas = new Map<string, Container>(), regioes = new Map<string, Container>();
  const animacoes: { alvo: Container; t0: number; dur: number; final: number }[] = [];
  let terreno: Entrada | null = null, terrenoTimer: ReturnType<typeof setTimeout> | null = null;

  // Texturas compartilhadas por chave, com contagem de uso: quando ninguém mais usa, saem da GPU.
  const texturas = new Map<string, { tex: Texture; usos: number }>();
  const adquirir = (chave: string, r: ResultadoDeBake): Texture => {
    let t = texturas.get(chave); if (!t) { t = { tex: Texture.from(r.bitmap), usos: 0 }; if (chave.startsWith('pixel|')) t.tex.source.scaleMode = 'nearest'; texturas.set(chave, t); }
    t.usos++; return t.tex;
  };
  const soltar = (chave: string | null) => { if (!chave) return; const t = texturas.get(chave); if (t && --t.usos <= 0) { t.tex.destroy(true); texturas.delete(chave); } };

  /** Pede a pintura e, quando chega, troca o desenho — a menos que a coisa já tenha mudado de novo. */
  function pintar(e: Entrada, chave: string, pedido: PedidoDeBake, aplicar: (s: Sprite, r: ResultadoDeBake) => void): void {
    if (e.chave === chave) return;
    e.chave = chave; pintandoAgora++;
    op.baker.pedir(chave, pedido).then(r => {
      if (destruida || e.chave !== chave || e.c.destroyed) return;
      const tex = adquirir(chave, r), antiga = e.chaveTextura;
      if (!e.sprite) { e.sprite = new Sprite(tex); e.c.addChild(e.sprite); } else e.sprite.texture = tex;
      aplicar(e.sprite, r); e.chaveTextura = chave; e.placeholder.visible = false; soltar(antiga); op.aoPintar?.();
    }).catch(erro => console.warn('Atlas: falha ao pintar', erro)).finally(() => { pintandoAgora--; });
  }

  const novaEntrada = (pai: Container): Entrada => { const c = new Container(), placeholder = new Graphics(); c.addChild(placeholder); pai.addChild(c); return { c, placeholder, sprite: null, chave: '', chaveTextura: null }; };
  const removerEntrada = (e: Entrada) => { soltar(e.chaveTextura); e.c.destroy({ children: true }); };

  // ---------- Terreno ----------
  function sincronizarTerreno(m: MapaAtlas): void {
    const e = entradaDoTerreno(m), temAlgo = e.base !== 'vazio' || e.camadas.length > 0;
    if (!temAlgo) { if (terreno) { removerEntrada(terreno); terreno = null; } return; }
    terreno ??= novaEntrada(terrenoC);
    const estilo = m.style.renderer, res = resolucaoDe(m, 'terreno'), chave = chaveDoTerreno(e, res, estilo);
    if (terreno.chave === chave) return;
    const alvo = terreno;
    // Durante a pincelada o terreno muda a cada movimento: espera uma pausa antes de pedir a pintura.
    if (terrenoTimer) clearTimeout(terrenoTimer);
    terrenoTimer = setTimeout(() => { terrenoTimer = null; if (!destruida && terreno === alvo) pintar(alvo, chave, { tipo: 'terreno', entrada: e, res, estilo }, (s, r) => { s.position.set(r.origem[0], r.origem[1]); s.scale.set(1 / r.res); }); }, 140);
  }

  // ---------- Cômodos ----------
  function sincronizarComodos(m: MapaAtlas): void {
    const ctx = contextoDeEntradas(m), vivos = new Set(Object.keys(m.rooms));
    for (const [id, e] of salas) if (!vivos.has(id)) { removerEntrada(e); salas.delete(id); }
    for (const sala of Object.values(m.rooms)) {
      let e = salas.get(sala.id); if (!e) { e = novaEntrada(comodosC); salas.set(sala.id, e); }
      // Marcador até a textura chegar: o cômodo aparece na hora, com a cor do piso.
      if (!e.sprite || e.placeholder.visible) {
        e.placeholder.clear();
        const t = m.grid.size, [ox, oy] = m.grid.offset;
        for (const [x, y] of decodificar(sala.cells)) e.placeholder.rect(ox + x * t, oy + y * t, t + 0.01, t + 0.01);
        e.placeholder.fill({ color: hexParaNumero(materialDe(sala.floor.material).base), alpha: 0.95 });
      }
      const entrada = entradaDoComodo(m, sala, ctx);
      const estilo = m.style.renderer, res = resolucaoDe(m, 'comodo');
      pintar(e, chaveDoComodo(entrada, res, estilo), { tipo: 'comodo', entrada, res, estilo }, (s, r) => { s.position.set(r.origem[0], r.origem[1]); s.scale.set(1 / r.res); });
    }
  }

  // ---------- Paredes, aberturas e marcas de objetos de parede ----------
  const COR_TOPO = 0x15131a, COR_TOPO_CLARO = 0x2b2833;
  /** No Pixel (px por metro > 0) os traços têm largura ímpar em pixels e o desenho anda meio pixel: o traço de 3 px cobre 3 pixels inteiros e o fio claro do meio é de 1 px. */
  let pixelRes = 0;
  const lw = (w: number): number => (pixelRes ? Math.max(1, 2 * Math.round((w * pixelRes - 1) / 2) + 1) / pixelRes : w);
  function pontoEm(p: Pick<Parede, 'path'>, dist: number): Ponto { return pontoNaParede(p, dist).ponto; }

  /** Na vista de jogador, uma porta secreta já revelada é uma porta como as outras; a que não foi revelada é só parede (não se desenha nada). */
  const secretaRevelada = (m: MapaAtlas, a: Abertura): boolean => a.kind === 'secret' && vistaDaCena === 'jogador' && !secretaOculta(m, a);

  function desenharAbertura(g: Graphics, p: Parede, a: Abertura, m: MapaAtlas): void {
    if (a.kind === 'secret' && vistaDaCena === 'jogador' && secretaOculta(m, a)) return;
    if (secretaRevelada(m, a)) a = { ...a, kind: 'door' };
    const c = a.at * comprimentoDaParede(p), { ponto, tangente } = pontoNaParede(p, c), nx = -tangente[1], ny = tangente[0], meia = a.width / 2;
    const ini = pontoEm(p, c - meia), fim = pontoEm(p, c + meia);
    if (a.kind === 'window') {
      g.moveTo(ini[0], ini[1]).lineTo(fim[0], fim[1]).stroke({ width: lw(p.thickness * 0.5), color: 0x9bc3dc, alpha: 0.95, cap: 'butt' });
      g.moveTo(ini[0], ini[1]).lineTo(fim[0], fim[1]).stroke({ width: lw(p.thickness * 0.14), color: 0xe6f3fb, alpha: 0.9, cap: 'butt' });
      return;
    }
    if (a.kind === 'secret') { g.moveTo(ini[0], ini[1]).lineTo(fim[0], fim[1]).stroke({ width: lw(p.thickness * 0.2), color: 0xd9a23b, alpha: pixelRes ? 1 : 0.4, cap: 'butt' }); return; }
    // Porta e arco abrem um vão: a parede é desenhada fora dele (ver `desenharParede`). A folha da porta fica por cima.
    const folha = 0x8a5226, lado = a.swing === 'a' ? 1 : -1;
    if (a.kind === 'arch') { for (const q of [ini, fim]) g.circle(q[0], q[1], p.thickness * 0.55).fill({ color: COR_TOPO_CLARO }); return; }
    if (a.state === 'open') {
      const hx = ini[0], hy = ini[1], fx = hx + nx * lado * a.width, fy = hy + ny * lado * a.width;
      g.moveTo(hx, hy).arc(hx, hy, a.width, Math.atan2(fim[1] - ini[1], fim[0] - ini[0]), Math.atan2(ny * lado, nx * lado), lado < 0).stroke({ width: 0.02, color: 0xffffff, alpha: 0.22 });
      g.moveTo(hx, hy).lineTo(fx, fy).stroke({ width: lw(0.09), color: folha, cap: pixelRes ? 'butt' : 'round' });
    } else {
      g.moveTo(ini[0], ini[1]).lineTo(fim[0], fim[1]).stroke({ width: lw(0.09), color: folha, cap: 'butt' });
      if (a.state === 'locked') g.circle(ponto[0], ponto[1], 0.11).fill(0xe91d25).stroke({ width: 0.03, color: 0x000000, alpha: 0.7 });
    }
  }

  function desenharParede(g: Graphics, m: MapaAtlas, p: Parede): void {
    // A parede é traçada em trechos, pulando o vão das portas e dos arcos.
    const comp = comprimentoDaParede(p), vaos = Object.values(m.openings).filter(a => a.wallId === p.id && (a.kind === 'door' || a.kind === 'arch' || secretaRevelada(m, a))).map(a => [a.at * comp - a.width / 2, a.at * comp + a.width / 2] as const).sort((x, y) => x[0] - y[0]);
    let pos = 0;
    const trecho = (d0: number, d1: number) => {
      if (d1 - d0 < 1e-4) return;
      // Percorre os vértices da parede entre d0 e d1.
      const pts: Ponto[] = [pontoEm(p, d0)]; let acum = 0;
      for (let i = 0; i + 1 < p.path.length; i++) { const l = Math.hypot(p.path[i + 1]![0] - p.path[i]![0], p.path[i + 1]![1] - p.path[i]![1]); acum += l; if (acum > d0 && acum < d1) pts.push(p.path[i + 1]!); }
      pts.push(pontoEm(p, d1));
      g.moveTo(pts[0]![0], pts[0]![1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]);
    };
    for (const [a, b] of vaos) { trecho(pos, Math.max(pos, a)); pos = b; }
    trecho(pos, comp);
    const baixa = p.kind === 'low' || p.kind === 'fence';
    g.stroke({ width: lw(p.thickness * (baixa ? 0.7 : 1)), color: baixa ? 0x4a4658 : COR_TOPO, alpha: p.kind === 'fence' ? 0.8 : 1, join: 'miter', cap: 'butt' });
  }

  function desenharParedes(m: MapaAtlas): void {
    paredesG.clear();
    pixelRes = m.style.renderer === 'pixel' ? m.style.pixel.pixelsPerCell / m.grid.size : 0;
    paredesG.position.set(pixelRes ? 0.5 / pixelRes : 0, pixelRes ? 0.5 / pixelRes : 0);
    for (const p of Object.values(m.walls)) {
      desenharParede(paredesG, m, p);
      // Um fio claro no meio do topo dá volume à faixa escura.
      if (p.kind === 'wall') { paredesG.moveTo(p.path[0]![0], p.path[0]![1]); for (const q of p.path.slice(1)) paredesG.lineTo(q[0], q[1]); paredesG.stroke({ width: lw(p.thickness * 0.14), color: COR_TOPO_CLARO, alpha: pixelRes ? 1 : 0.9, cap: 'butt' }); }
    }
    for (const a of Object.values(m.openings)) { const p = m.walls[a.wallId]; if (p) desenharAbertura(paredesG, p, a, m); }
    // Objetos de parede aparecem na faixa da parede como uma marca, e inteiros na face do cômodo.
    for (const o of Object.values(m.props) as Objeto[]) {
      if (!o.wall) continue; const p = m.walls[o.wall.wallId]; if (!p) continue;
      const c = o.wall.at * comprimentoDaParede(p), { tangente } = pontoNaParede(p, c), meia = (o.source.kind === 'recipe' && typeof o.source.params.largura === 'number' ? (o.source.params.largura as number) : 0.8) / 2;
      const a = pontoEm(p, Math.max(0, c - meia)), b = pontoEm(p, Math.min(comprimentoDaParede(p), c + meia));
      paredesG.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: lw(p.thickness * 0.34), color: 0xd9a75e, alpha: pixelRes ? 1 : 0.9, cap: 'butt' }); void tangente;
    }
  }

  // ---------- Objetos de piso ----------
  function desenharMarcadorDeObjeto(e: Entrada, o: Objeto): void {
    const [w, h] = ACERVO.pegadaDaFonte(o.source);
    e.placeholder.clear().roundRect(-w / 2, -h / 2, w, h, 0.08).fill({ color: corDoNome(o.source.kind === 'recipe' ? o.source.recipe : o.source.assetId, 0.35, 0.34), alpha: 0.7 });
  }

  function sincronizarObjetos(m: MapaAtlas, ids: readonly string[] | null, comPop: boolean): void {
    for (const id of ids ?? [...new Set([...objetos.keys(), ...Object.keys(m.props)])]) {
      const o = m.props[id] as Objeto | undefined, e = objetos.get(id);
      const res = resolucaoDe(m, 'objeto'), chave = o ? chaveDoObjeto(o, res, m.style.genre, m.style.renderer, opcoesDoPixel(m)) : null;
      if (!o || chave === null) { if (e) { removerEntrada(e); objetos.delete(id); } continue; }
      let entrada = e;
      if (!entrada) {
        entrada = novaEntrada(objetosC); objetos.set(id, entrada); desenharMarcadorDeObjeto(entrada, o);
        if (comPop && op.efeitos()) { entrada.c.scale.set(0.6); animacoes.push({ alvo: entrada.c, t0: performance.now(), dur: 180, final: o.scale }); }
      }
      entrada.c.position.set(o.position[0], o.position[1]); entrada.c.rotation = o.rotation; entrada.c.zIndex = o.layer ?? 0;
      if (!animacoes.some(a => a.alvo === entrada!.c)) entrada.c.scale.set(o.scale);
      const pedido = pedidoDoObjeto(o, res, m.style.genre, m.style.renderer, opcoesDoPixel(m));
      if (pedido) pintar(entrada, chave, pedido, (sp, r) => { sp.position.set(r.origem[0], r.origem[1]); sp.scale.set(1 / r.res); });
    }
  }

  // ---------- Luzes, peças, regiões ----------
  const grafico = (c: Container): Graphics => (c.getChildByLabel('g') as Graphics | null) ?? c.addChild(Object.assign(new Graphics(), { label: 'g' }));

  function desenharLuz(c: Container, l: Luz, m: MapaAtlas): void {
    // Apagada pelo clima (rede caída, só-noturna de dia): o marcador mostra "apagada" e um aro tracejado, para o mestre entender por quê.
    const cor = hexParaNumero(l.color), apagadaPeloClima = l.on && nivelDaLuz(l, m) === 0, ligada = l.on && !apagadaPeloClima;
    const g = grafico(c).clear();
    if (apagadaPeloClima) for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI * 2; g.arc(0, 0, 0.34, a0, a0 + Math.PI / 12).stroke({ width: 0.04, color: cor, alpha: 0.85 }); }
    if (l.cone) { const meia = l.cone.angle / 2, r = Math.min(l.radius, 5); g.moveTo(0, 0).arc(0, 0, r, l.cone.direction - meia, l.cone.direction + meia).lineTo(0, 0).stroke({ width: 0.03, color: cor, alpha: ligada ? 0.7 : 0.25 }); }
    g.circle(0, 0, 0.2).fill(ligada ? cor : 0x3a3a44).stroke({ width: 0.04, color: 0x000000, alpha: 0.75 });
    if (l.cone) g.moveTo(0, 0).lineTo(Math.cos(l.cone.direction) * 0.5, Math.sin(l.cone.direction) * 0.5).stroke({ width: 0.05, color: 0x000000, alpha: 0.8 });
    c.position.set(l.position[0], l.position[1]);
  }

  const visuais = new WeakMap<Container, PecaVisual>();
  // As folhas de sprite das peças: pedidas ao baker, com a chave do spec; a antiga fica até a nova chegar.
  const folhaDaPeca = new Map<string, string>();
  const chaveDoSprite = (t: Peca): string | null => (t.sprite ? `pixel|sprite|${JSON.stringify(t.sprite)}` : null);
  function folhaDe(t: Peca, redesenhar: () => void): Texture | null {
    const chave = chaveDoSprite(t), atual = folhaDaPeca.get(t.id) ?? null;
    if (!chave) { if (atual) { soltar(atual); folhaDaPeca.delete(t.id); } return null; }
    if (chave !== atual) {
      const spec = t.sprite!;
      op.baker.pedir(chave, { tipo: 'sprite', spec }).then(r => {
        if (destruida || chaveDoSprite(mapa?.tokens[t.id] ?? ({ sprite: null } as Peca)) !== chave) return;
        const antes = folhaDaPeca.get(t.id) ?? null; adquirir(chave, r); folhaDaPeca.set(t.id, chave); soltar(antes); redesenhar();
      }).catch(erro => console.warn('Atlas: falha ao pintar o sprite', erro));
    }
    const pronta = folhaDaPeca.get(t.id); return pronta ? texturas.get(pronta)?.tex ?? null : null;
  }
  function desenharPeca(c: Container, t: Peca, m: MapaAtlas): void {
    let v = visuais.get(c); if (!v) { v = criarPeca(); visuais.set(c, v); c.addChild(v.c); }
    const folha = folhaDe(t, () => { if (!destruida && !c.destroyed && mapa?.tokens[t.id]) desenharPeca(c, mapa.tokens[t.id]!, mapa); });
    const pixel = m.style.renderer === 'pixel', px = m.style.pixel;
    const noPixel: RetratoNoPixel | undefined = pixel ? { chave: `${m.style.palette}|${px.pixelsPerCell}|${t.size}|${px.dither}|${px.outline}`, lado: Math.max(8, Math.round(t.size * px.pixelsPerCell * 0.9)), paleta: paletaDe(m.style.palette).cores, dither: px.dither === 'bayer4', contorno: px.outline } : undefined;
    const rec = op.recursos?.(t) ?? null, aparente = rec && emEstadoCritico(rec) && t.figure.state === 'normal' ? { ...t, figure: { state: 'hurt' as const } } : t;      // PV baixo: "ferida" só na tela
    v.atualizar(aparente, m.grid.size, op.acento(), op.retrato?.(t.portrait?.id, noPixel) ?? null, op.efeitos(), { folha, pixel }, rec);
  }

  function desenharRegiao(c: Container, r: Regiao): void {
    const cor = r.gmOnly ? 0xd9a23b : 0x5aa9e6;
    grafico(c).clear().poly(r.polygon.flat()).fill({ color: cor, alpha: 0.1 }).stroke({ width: 0.04, color: cor, alpha: 0.7 });
  }

  function sincronizarSimples<T extends { id: string }>(mapaDeObjetos: Map<string, Container>, pai: Container, dados: Record<string, T>, ids: readonly string[] | null, desenhar: (c: Container, item: T) => void, comPop: boolean): void {
    for (const id of ids ?? [...new Set([...mapaDeObjetos.keys(), ...Object.keys(dados)])]) {
      const item = dados[id], atual = mapaDeObjetos.get(id);
      if (!item) { atual?.destroy({ children: true }); mapaDeObjetos.delete(id); continue; }
      let c = atual;
      if (!c) { c = new Container(); pai.addChild(c); mapaDeObjetos.set(id, c); if (comPop && op.efeitos() && pai !== regioesC) { c.scale.set(0.6); animacoes.push({ alvo: c, t0: performance.now(), dur: 180, final: 1 }); } }
      desenhar(c, item);
    }
  }

  // ---------- Marcas dos interativos (só para o mestre) ----------
  let modoDoProjetor = false;
  const marcasVisiveis = () => { marcasG.visible = !modoDoProjetor && vistaDaCena !== 'jogador'; };
  function desenharMarcas(m: MapaAtlas): void {
    marcasG.clear();
    for (const o of Object.values(m.props) as Objeto[]) {
      const i = o.interaction; if (!i || i.kind === 'clue') continue;
      const [x, y] = o.position, cor = i.kind === 'switch' ? (i.on ? 0xffd23f : 0x6b6f80) : (i.on ? 0x4fc3f7 : 0x6b6f80);
      marcasG.circle(x, y, 0.2).fill({ color: 0x0c0c12, alpha: 0.85 }).stroke({ width: 0.04, color: cor });
      if (i.kind === 'switch') marcasG.moveTo(x, y + 0.08).lineTo(x, y - 0.1).stroke({ width: 0.05, color: cor, cap: 'round' });
      else marcasG.rect(x - 0.09, y - 0.07, 0.18, 0.14).stroke({ width: 0.035, color: cor }).moveTo(x - 0.03, y).lineTo(x + 0.03, y).stroke({ width: 0.035, color: cor });
    }
  }

  // ---------- Cartela de título ----------
  let chaveDoTitulo = '';
  function sincronizarTitulo(m: MapaAtlas): void {
    const t = m.backdrop.title, pixel = m.style.renderer === 'pixel', ppm = m.style.pixel.pixelsPerCell / m.grid.size, chave = JSON.stringify([t, op.acento(), pixel ? ppm : 0]);
    if (chave === chaveDoTitulo) return; chaveDoTitulo = chave;
    for (const f of tituloC.removeChildren()) f.destroy({ children: true });
    if (!t) return;
    // Uma faixa rasgada, como os rótulos da Ficha: fica pequena e legível mesmo bem afastada.
    // No Pixel o texto usa a fonte pixel em tamanho inteiro (em pixels do Pixel), resolução 1 e `nearest`, e anda de pixel em pixel.
    const tamanho = pixel ? Math.max(12, Math.round(0.85 * ppm)) : 64;
    const texto = new Text({ text: t.text.toUpperCase(), resolution: pixel ? 1 : undefined, textureStyle: pixel ? { scaleMode: 'nearest' } : undefined, style: { fontFamily: pixel ? 'Pixelify Sans, monospace' : `${t.font}, Georgia, serif`, fontSize: tamanho, fontWeight: '700', fill: 0xffffff, letterSpacing: pixel ? 0 : 2 } });
    const escala = pixel ? 1 / ppm : 0.62 / 64, larg = texto.width * escala + 1.0, alt = 1.1, g = new Graphics();
    g.poly([-0.2, -0.45, larg - 0.2, -0.5, larg, -0.2, larg - 0.15, 0.4, 0.1, 0.5, -0.15, 0.2]).fill(op.acento());
    texto.scale.set(escala); texto.position.set(0.3, pixel ? -(tamanho * escala) / 2 - 0.02 : -0.31); texto.alpha = pixel ? 1 : 0.97;
    tituloC.addChild(g, texto); tituloC.position.set(t.position[0], t.position[1] + alt / 2);
  }

  // ---------- Orquestração ----------
  function chavesEmUso(): Set<string> {
    const s = new Set<string>();
    for (const e of [...salas.values(), ...objetos.values(), ...(terreno ? [terreno] : [])]) { if (e.chave) s.add(e.chave); }
    return s;
  }

  return {
    raiz,
    get pintando() { return pintandoAgora + op.baker.pendentes; },
    sincronizar(m, mud, comPop, visaoDoClima) {
      mapa = m;
      const tudo = !mud || mud.completo, campos = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x)), colecao = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c];
      if (campos('terrain', 'bounds', 'grid', 'backdrop', 'style')) sincronizarTerreno(m);
      if (tudo || colecao('rooms') || colecao('walls') || colecao('openings') || colecao('props') || campos('style', 'grid')) sincronizarComodos(m);
      if (tudo || colecao('rooms') || colecao('walls') || colecao('openings') || colecao('props') || campos('grid', 'session', 'style')) desenharParedes(m);
      if (tudo || colecao('props') || campos('style')) sincronizarObjetos(m, tudo || campos('style') ? null : mud!.colecoes.props ?? null, comPop);
      if (tudo || colecao('props')) desenharMarcas(m);
      presenca.sincronizar(m, mud); nevoa.sincronizar(m, mud); telhados.sincronizar(m, mud);
      const v = visaoDoClima ?? m;
      luz.sincronizar(v, mud); neblina.sincronizar(v, mud); particulas.sincronizar(v, mud);
      // Os marcadores das luzes também refletem o clima (apagada pela rede ou pelo dia), então refazem quando ele muda.
      if (tudo || colecao('lights') || campos('climate')) sincronizarSimples(luzes, luzesC, m.lights, tudo || campos('climate') ? null : mud!.colecoes.lights ?? null, (c, l) => desenharLuz(c, l, m), comPop);
      if (tudo || colecao('tokens') || campos('grid', 'style')) sincronizarSimples(pecas, pecasC, m.tokens, tudo || campos('grid', 'style') ? null : mud!.colecoes.tokens ?? null, (c, t) => desenharPeca(c, t, m), comPop);
      for (const id of [...folhaDaPeca.keys()]) if (!m.tokens[id]) { soltar(folhaDaPeca.get(id)!); folhaDaPeca.delete(id); }
      { const vezDe = m.session.initiative?.order[m.session.initiative.current]?.tokenId; for (const [id, c] of pecas) visuais.get(c)?.definirVez(id === vezDe); }
      if (tudo || colecao('regions')) sincronizarSimples(regioes, regioesC, m.regions, tudo ? null : mud!.colecoes.regions ?? null, desenharRegiao, comPop);
      if (tudo || campos('backdrop', 'bounds', 'style', 'grid')) sincronizarTitulo(m);
      op.baker.coletar(chavesEmUso());
    },
    atualizarAtmosfera(visao) {
      const mud: Mudancas = { completo: false, colecoes: {}, campos: ['climate'] };
      luz.sincronizar(visao, mud); neblina.sincronizar(visao, mud); particulas.sincronizar(visao, mud);
    },
    definirAtmosfera: ligada => { luz.definirLigado(ligada); neblina.definirLigado(ligada); particulas.definirLigado(ligada); },
    relampagoAgora: () => luz.relampagoAgora(),
    definirModoProjetor: ligado => { modoDoProjetor = ligado; marcasVisiveis(); luzesC.visible = !ligado; regioesC.visible = !ligado; },
    definirEfeitosDeLuz: (luzes, ambiente) => luz.definirEfeitos(luzes, ambiente),
    definirVista: v => { nevoa.definirVista(v); telhados.definirVista(v); if (v !== vistaDaCena) { vistaDaCena = v; if (mapa) desenharParedes(mapa); } marcasVisiveis(); },
    diagnosticoDosTelhados: () => telhados.diagnostico(),
    redesenharPecas() { if (mapa) sincronizarSimples(pecas, pecasC, mapa.tokens, null, (c, t) => desenharPeca(c, t, mapa!), false); },
    contagemDeParticulas: () => particulas.contagem(),
    contagemDePresencas: () => presenca.contagem(),
    diagnosticoDasPecas: () => [...pecas.entries()].map(([id, c]) => ({ id, ...(visuais.get(c)?.estado() ?? { vez: false, retrato: false, deitada: false, raio: 0, deslizando: false, trilha: 0, quadro: null, pips: null, estadoVisto: 'normal' }) })),
    objetosPintados: () => [...objetos.values()].filter(e => e.sprite !== null && !e.placeholder.visible).length,
    quadro(agora) {
      luz.quadro(agora); nevoa.quadro(agora); telhados.quadro(agora);
      for (const c of pecas.values()) visuais.get(c)?.quadro(agora, op.efeitos());
      const dt = ultimoQuadro < 0 ? 0 : (agora - ultimoQuadro) / 1000; ultimoQuadro = agora; neblina.quadro(dt); particulas.quadro(dt); presenca.quadro(dt);
      for (let i = animacoes.length - 1; i >= 0; i--) {
        const a = animacoes[i]!, t = Math.min(1, (agora - a.t0) / a.dur), e = 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;   // easeOutBack
        if (a.alvo.destroyed) { animacoes.splice(i, 1); continue; }
        a.alvo.scale.set(a.final * (0.6 + 0.4 * e));
        if (t >= 1) { a.alvo.scale.set(a.final); animacoes.splice(i, 1); }
      }
    },
    destruir() {
      destruida = true; if (terrenoTimer) clearTimeout(terrenoTimer);
      for (const e of [...salas.values(), ...objetos.values(), ...(terreno ? [terreno] : [])]) soltar(e.chaveTextura);
      for (const t of texturas.values()) t.tex.destroy(true); texturas.clear();
      luz.destruir(); nevoa.destruir(); telhados.destruir(); neblina.destruir(); particulas.destruir(); presenca.destruir(); raiz.destroy({ children: true });
    },
  };
}

export type { PedidoDeBake };
