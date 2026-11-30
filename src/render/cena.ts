import { raioDoOclusorDeToken } from '../domain/visibilidade.ts';
import { Container, Graphics, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import { listaDeAndares } from '../domain/andares.ts';
import { decodificar } from '../domain/celulas.ts';
import { pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import { comodoEm, comprimentoDaParede, centroDaAbertura, contornoDoComodo, indiceDeCelulas, pontoNaParede } from '../domain/geometria.ts';
import { transicaoDaAbertura, transicaoDoObjeto } from '../domain/transicao-mapa.ts';
import { AO_PADRAO, EXPOSICAO_PADRAO, RELEVO_PADRAO, type Abertura, type Luz, type MapaAtlas, type Objeto, type Parede, type Peca, type Ponto, type Regiao } from '../domain/mapa.ts';
import { alturaTopoDaFace } from '../procedural/faces-de-parede.ts';
import { materialDe, tom } from '../procedural/materiais.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { camadaDoObjeto } from '../domain/camadas.ts';
import { ErroDeBakeCancelado, type Baker } from '../procedural/baker.ts';
import type { PedidoDeBake, ResultadoDeBake } from '../procedural/executar.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { corDoNome, hexParaNumero } from './cores.ts';
import { chaveDaEscarpa, chaveDoComodo, chaveDoObjeto, ehEscarpaAvulsa, entradaDaEscarpa, chaveDoTerreno, pedidoDoObjeto, contextoDeEntradas, entradaDoComodo, entradaDoTerreno, ladrilhosDoTerreno, opcoesDoPixel, resolucaoDe } from './entradas.ts';
import { nivelDaLuz } from '../domain/clima.ts';
import { tintDoRelevo } from '../domain/relevo.ts';
import { baseDasTexturas, carregarCatalogo, catalogoLido, usaTextura } from '../procedural/texturas-carregadas.ts';
import { criarMapaDeLuz } from './mapa-de-luz.ts';
import { criarCenaDeAltura } from './cena-de-altura.ts';
import { criarComposicaoDeLuz } from './composicao-de-luz.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO } from './particulas-config.ts';
import { criarNevoa, type Vista } from './nevoa.ts';
import { objetoDinamicoDeVisao, pecaSempreVisivel, pontoVisivelAgora, secretaOculta, tokensDeVisaoAtivos, type FiltroDeVisao } from '../domain/nevoa.ts';
import { criarNeblina } from './neblina.ts';
import { criarBordas } from './bordas.ts';
import { criarHalos } from './halos.ts';
import { criarFumaca } from './fumaca.ts';
import { criarParticulas } from './particulas.ts';
import { criarTelhados } from './telhados.ts';
import { criarPeca, type PecaVisual } from './pecas.ts';
import { emEstadoCritico, type Recursos } from '../domain/fichas.ts';
import type { RetratoNoPixel } from './retratos.ts';
import { paletaDe } from '../domain/paletas.ts';
import { criarPresenca } from './presenca.ts';
import { criarAgua } from './agua.ts';
import { criarCachoeiras } from './cachoeiras.ts';
import { criarContatoExterno } from './contato-externo.ts';
import { criarTempoNoChao } from './tempo-no-chao.ts';
import { criarSombrasDoSol, ehSombraProjetada } from './sombras-do-sol.ts';

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
  /** A peça pertence ao jogador que está vendo o projetor remoto (R14)? */
  pecaDoJogador?(t: Peca): boolean;
  /** O que a câmera mostra agora (em metros, com margem), para assar primeiro o que está na tela; `null` quando não se sabe. */
  caixaVisivel?(): { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface ContextoDoAndar {
  completo: MapaAtlas;
  andar: string | null;
  construir: boolean;
}

export interface Cena {
  readonly raiz: Container;
  /** `mudancas === null` refaz tudo. */
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null, comPop: boolean, visaoDoClima?: MapaAtlas, contextoAndar?: ContextoDoAndar): void;
  /** Só a atmosfera (luz, neblina, partículas) com o clima de `visao`: o que a transição de clima chama a cada quadro. */
  atualizarAtmosfera(visao: MapaAtlas): void;
  /** Avança as animações de entrada e a tremulação das luzes. */
  quadro(agora: number): void;
  /** A câmera andou: sobe na fila de assado o que entrou na tela. */
  repriorizar(): void;
  /** Faz já o pós-processamento adiado (coleta do baker, altura dos objetos, sombras, tempo); o `quadro` faz o mesmo no início. */
  descarregarPendencias(): void;
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
  definirFiltroDeVisao?(filtro: FiltroDeVisao | null, minhasFichas?: readonly string[] | null): void;
  /** Força a opacidade dos telhados visíveis no mapa (ex.: captura na vista de telhados); `null` volta ao cálculo normal. */
  forcarTelhados(alfa: number | null): void;
  /** No modo Construir, mostra os telhados (das casas com telhado visível) em vez de escondê-los. */
  definirTelhadosNoEditor(v: boolean): void;
  /** Para os testes: como cada peça está desenhada agora (retrato, deitada, raio). */
  diagnosticoDasPecas(): { id: string; vez: boolean; retrato: boolean; deitada: boolean; raio: number; quadro: { linha: number; coluna: number } | null; pips: Recursos | null; estadoVisto: string }[];
  /** Quantos objetos de piso já têm a textura pintada (sem o marcador). */
  objetosPintados(): number;
  /** Tint atual (24 bits) do container de um objeto (para testes de relevo/submersão). */
  tintDeObjeto(id: string): number | null;
  /** Refaz o desenho de todas as peças (chegaram PV e PD novos, por exemplo). */
  redesenharPecas(): void;
  /** Quantas presenças estão desenhadas agora. */
  contagemDePresencas(): number;
  /** Quantas presenças submersas estão desenhadas agora. */
  contagemDePresencasSubmersas(): number;
  /** Quantas cachoeiras animadas estão desenhadas agora. */
  contagemDeCachoeiras(): number;
  /** Se a superfície animada da água está desenhada (para testes). */
  aguaAtiva(): boolean;
  /** Quantas partículas de cada tipo existem agora. */
  contagemDeParticulas(): ReturnType<ReturnType<typeof criarParticulas>['contagem']>;
  /** Quantos desenhos ainda estão sendo pintados no worker. */
  readonly pintando: number;
  destruir(): void;
}

/** Onde a coisa está no mapa e com que prioridade assar: `[na tela, fora da tela]`. */
/** Folga em volta do ponto de um objeto ao decidir se está na tela (objetos grandes: copa de árvore, mesa comprida). */
const RAIO_DE_VISAO = 1.5;

interface AlvoDeVisao { caixa: readonly [number, number, number, number]; prios: readonly [number, number] }

interface Entrada { c: Container; placeholder: Graphics; sprite: Sprite | null; texAltura: Texture | null; chave: string; chaveTextura: string | null; chavePrevia?: string | null; alphaAlvo?: number }

export function criarCena(op: OpcoesDaCena): Cena {
  const raiz = new Container(), mundoIluminado = new Container(), terrenoC = new Container(), veuTerrenoG = new Graphics(), submersosC = Object.assign(new Container(), { sortableChildren: true }), escarpasC = new Container(), comodosC = new Container(), objetosC = Object.assign(new Container(), { sortableChildren: true }), paredesG = new Graphics(), fantasmaAndarG = new Graphics();
  const marcasG = new Graphics(), regioesC = new Container(), luzesC = new Container(), pecasC = new Container(), tituloC = new Container();
  const luz = criarMapaDeLuz(op.renderer), cenaDeAltura = criarCenaDeAltura(), composicaoDeLuz = criarComposicaoDeLuz(op.renderer, luz, cenaDeAltura), nevoa = criarNevoa(op.renderer), telhados = criarTelhados({ baker: op.baker, renderer: op.renderer, luz, aoPintar: op.aoPintar, ...(op.caixaVisivel ? { caixaVisivel: op.caixaVisivel } : {}) }), neblina = criarNeblina({ textura: () => (luz.sprite.texture === Texture.EMPTY ? null : luz.sprite.texture), escala: () => luz.escala }), bordas = criarBordas(), particulas = criarParticulas(), presenca = criarPresenca(), agua = criarAgua(), cachoeiras = criarCachoeiras(), sombras = criarSombrasDoSol(op.renderer), contato = criarContatoExterno(op.renderer), tempo = criarTempoNoChao(op.renderer);
  const halos = criarHalos(luz, telhados), fumaca = criarFumaca();
  // A tinta do chão (presença natural) cobre o piso, mas não a face de rocha das escarpas, que sobe acima dela.
  // No Ilustrado, a composição de luz renderiza `mundoIluminado` em `corRT`, escreve HDR em `hdrRT` e aplica bloom em `composicaoDeLuz.sprite`; no Pixel, `luz.sprite` multiplica em 8 bits. Marcadores, regiões e peças ficam por cima.
  mundoIluminado.addChild(terrenoC, presenca.submerso, submersosC, agua.raiz, veuTerrenoG, comodosC, presenca.chao, tempo.chao, escarpasC, contato.raiz, sombras.raiz, objetosC, tempo.chapeus, cachoeiras.raiz, paredesG, fantasmaAndarG, presenca.abaixo);
  raiz.addChild(mundoIluminado, composicaoDeLuz.sprite, luz.sprite, presenca.acima, halos.raiz, fumaca.raiz, neblina.raiz, particulas.raiz, bordas.raiz, regioesC, luzesC, marcasG, telhados.fachadaRaiz, pecasC, telhados.raiz, nevoa.sprite, tituloC);

  let mapa: MapaAtlas | null = null, vistaDaCena: Vista = 'construir', destruida = false, pintandoAgora = 0, ultimoQuadro = -1;
  let filtroVisao: FiltroDeVisao | null = null, minhasFichas: readonly string[] | null = null;
  let ultimoContextoAndar: ContextoDoAndar | null = null, atmosferaLigada = true, ehPixel = false;
  const atualizarComposicaoDeLuz = () => {
    const ativo = atmosferaLigada && !ehPixel;
    if (!ativo) {
      mundoIluminado.renderable = true;
      composicaoDeLuz.sprite.visible = false;
    } else if (composicaoDeLuz.pronta) {
      mundoIluminado.renderable = false;
      composicaoDeLuz.sprite.visible = true;
    }
  };
  const salas = new Map<string, Entrada>(), objetos = new Map<string, Entrada>(), terrenos = new Map<string, Entrada>();
  const luzes = new Map<string, Container>(), pecas = new Map<string, Container>(), regioes = new Map<string, Container>();
  const animacoes: { alvo: Container; t0: number; dur: number; final: number }[] = [];
  let terrenoTimer: ReturnType<typeof setTimeout> | null = null;

  // Texturas compartilhadas por chave, com contagem de uso: quando ninguém mais usa, saem da GPU.
  const texturas = new Map<string, { tex: Texture; texAltura: Texture | null; usos: number }>();
  const adquirir = (chave: string, r: ResultadoDeBake): { tex: Texture; texAltura: Texture | null } => {
    let t = texturas.get(chave);
    if (!t) {
      t = { tex: Texture.from(r.bitmap), texAltura: r.altura ? Texture.from(r.altura) : null, usos: 0 };
      if (chave.startsWith('pixel|')) t.tex.source.scaleMode = 'nearest';
      texturas.set(chave, t);
    }
    t.usos++;
    return { tex: t.tex, texAltura: t.texAltura };
  };
  const soltar = (chave: string | null) => {
    if (!chave) return;
    const t = texturas.get(chave);
    if (t && --t.usos <= 0) {
      t.tex.destroy(true);
      t.texAltura?.destroy(true);
      texturas.delete(chave);
    }
  };

  // Pós-processamento adiado: pintar 60 objetos de uma vez rodava sombras, tempo e altura 60 vezes na main thread.
  let coletaSuja = false, alturaObjetosSuja = false, sombrasSuja = false, tempoSujo = false;
  function descarregarPendencias(): void {
    if (destruida) return;
    if (coletaSuja) { coletaSuja = false; op.baker.coletar(chavesEmUso()); }
    if (alturaObjetosSuja) { alturaObjetosSuja = false; cenaDeAltura.sincronizarObjetos(objetos, objetosC); }
    if (sombrasSuja && mapa) { sombrasSuja = false; sombras.atualizar(mapa, objetos, pixelRes0(mapa)); }
    if (tempoSujo && mapa) { tempoSujo = false; tempo.atualizar(mapa, objetos); }
  }

  /** Quem ainda espera o baker e tem uma região no mapa: a câmera andou, então o que entrou na tela sobe na fila. */
  const pendentes = new Map<string, { pedido: PedidoDeBake } & AlvoDeVisao>();
  function repriorizar(): void {
    if (destruida) return;
    for (const [chave, p] of pendentes) {
      const [x0, y0, x1, y1] = p.caixa;
      op.baker.repriorizar(chave, visivel(x0, y0, x1, y1) ? p.prios[0] : p.prios[1]);
    }
  }

  /** A caixa (em metros) está, ao menos em parte, dentro do que a câmera mostra? Sem câmera conhecida, tudo conta como visível. */
  function visivel(x0: number, y0: number, x1: number, y1: number): boolean {
    const v = op.caixaVisivel?.();
    return !v || (x1 >= v.x0 && x0 <= v.x1 && y1 >= v.y0 && y0 <= v.y1);
  }

  /** Pede a pintura e, quando chega, troca o desenho — a menos que a coisa já tenha mudado de novo. */
  function pintar(
    e: Entrada,
    chave: string,
    pedido: PedidoDeBake,
    aplicar: (s: Sprite, r: ResultadoDeBake) => void,
    prioridade?: number,
    previa?: { chave: string; pedido: PedidoDeBake },
    forcarPrevia = false,
    tipo: 'terreno' | 'escarpa' | 'comodo' | 'objeto' = 'objeto',
    visao?: AlvoDeVisao,
  ): void {
    if (e.chave === chave) return;
    const usarPrevia = !!previa && previa.chave !== chave && (!e.sprite || forcarPrevia);
    e.chave = chave;
    e.chavePrevia = usarPrevia ? previa.chave : null;

    const aplicarResultado = (chaveRecebida: string, r: ResultadoDeBake, ehPrevia: boolean) => {
      if (destruida || e.chave !== chave || e.c.destroyed) return;
      if (ehPrevia && (e.chavePrevia !== chaveRecebida || e.chaveTextura === chave)) return;
      const tinhaAltura = e.texAltura !== null;
      const { tex, texAltura } = adquirir(chaveRecebida, r), antiga = e.chaveTextura;
      if (!e.sprite) { e.sprite = new Sprite(tex); e.c.addChild(e.sprite); } else e.sprite.texture = tex;
      e.texAltura = texAltura;
      aplicar(e.sprite, r); e.chaveTextura = chaveRecebida; e.placeholder.visible = false;
      if (!ehPrevia) e.chavePrevia = null;
      soltar(antiga);
      // O pós-processamento é adiado e junta tudo o que chegou no mesmo quadro (ver `descarregarPendencias`).
      if (!ehPrevia) coletaSuja = true;
      if (tipo === 'objeto') {
        if (tinhaAltura || e.texAltura !== null) alturaObjetosSuja = true;
        const o = mapa?.props[e.c.label] as Objeto | undefined;
        if (o && (o.castsShadow || ehSombraProjetada(o)) && o.elevation === 'floor' && o.roomId === null) sombrasSuja = true;
        if (mapa && (mapa.climate.weather.snow > 0.2 || mapa.climate.weather.rain > 0.3)) tempoSujo = true;
      } else if (tipo === 'escarpa' || (tipo === 'terreno' && !ehPrevia && mapa && Object.keys(mapa.terrain.layers).length > 0)) {
        sombrasSuja = true;
      }
      op.aoPintar?.();
    };

    if (usarPrevia) {
      const chavePrevia = previa.chave;
      pintandoAgora++;
      op.baker.pedir(chavePrevia, previa.pedido, 0).then(r => {
        aplicarResultado(chavePrevia, r, true);
      }).catch(erro => { if (!(erro instanceof ErroDeBakeCancelado)) console.warn('Atlas: falha ao pintar prévia', erro); }).finally(() => { pintandoAgora--; });
    }

    pintandoAgora++;
    if (visao) pendentes.set(chave, { pedido, ...visao });
    op.baker.pedir(chave, pedido, usarPrevia ? 1 : prioridade).then(r => {
      aplicarResultado(chave, r, false);
    }).catch(erro => { if (!(erro instanceof ErroDeBakeCancelado)) console.warn('Atlas: falha ao pintar', erro); }).finally(() => { pintandoAgora--; pendentes.delete(chave); });
  }

  const pixelRes0 = (m: MapaAtlas): boolean => m.style.renderer === 'pixel';
  const novaEntrada = (pai: Container): Entrada => { const c = new Container(), placeholder = new Graphics(); c.addChild(placeholder); pai.addChild(c); return { c, placeholder, sprite: null, texAltura: null, chave: '', chaveTextura: null, chavePrevia: null }; };
  const removerEntrada = (e: Entrada) => { soltar(e.chaveTextura); e.texAltura = null; e.c.destroy({ children: true }); };

  // ---------- Terreno ----------
  function sincronizarTerreno(m: MapaAtlas): void {
    const e = entradaDoTerreno(m);
    // O hash do catálogo entra na chave de quem usa textura: lê o catálogo antes e sincroniza de novo (no-op sem material com textura).
    if (m.style.renderer === 'illustrated' && usaTextura(e) && !catalogoLido()) { void carregarCatalogo().then(() => { if (!destruida && mapa) sincronizarTerreno(mapa); }); return; }
    const temAlgo = e.base !== 'vazio' || e.camadas.length > 0 || !!e.relevo || !!e.assentamento;
    if (terrenoTimer) { clearTimeout(terrenoTimer); terrenoTimer = null; }
    if (!temAlgo) {
      for (const ent of terrenos.values()) removerEntrada(ent);
      terrenos.clear();
      cenaDeAltura.limparTerreno();
      agua.aplicar(undefined, m);
      return;
    }
    const estilo = m.style.renderer, res = resolucaoDe(m, 'terreno');
    // No projetor com névoa o terreno é recortado pelo que o jogador conhece: vale um passo só, não vai para o IndexedDB.
    const terrenoEfemero = modoDoProjetor && m.session.explored !== null;
    const ladrilhos = ladrilhosDoTerreno(e, res);
    const vivos = new Set(ladrilhos.map(l => `${l.i},${l.j}`));
    for (const [k, ent] of terrenos) {
      if (!vivos.has(k)) {
        cenaDeAltura.removerLadrilhoTerreno(k);
        removerEntrada(ent);
        terrenos.delete(k);
      }
    }
    if (!e.camadas.some(c => c.celulas.length > 0 && materialDe(c.material).uso === 'agua')) {
      agua.aplicar(undefined, m);
    }

    const mudados = ladrilhos.filter(l => {
      const k = `${l.i},${l.j}`, ent = terrenos.get(k);
      return !ent || ent.chave !== chaveDoTerreno(l.entrada, res, estilo);
    });
    if (!mudados.length) return;

    const pedirLadrilhos = () => {
      terrenoTimer = null;
      if (destruida) return;
      // Primeiro o que está na tela (e, entre eles, o mais perto do centro): os ladrilhos fora dela esperam.
      const vis = op.caixaVisivel?.() ?? null;
      const cx = vis ? (vis.x0 + vis.x1) / 2 : 0, cy = vis ? (vis.y0 + vis.y1) / 2 : 0;
      const dist = (l: (typeof ladrilhos)[number]): number => (l.caixa.x + l.caixa.w / 2 - cx) ** 2 + (l.caixa.y + l.caixa.h / 2 - cy) ** 2;
      const ordenados = vis ? [...ladrilhos].sort((a, b) => dist(a) - dist(b)) : ladrilhos;
      for (const l of ordenados) {
        const k = `${l.i},${l.j}`;
        const naTela = visivel(l.caixa.x, l.caixa.y, l.caixa.x + l.caixa.w, l.caixa.y + l.caixa.h);
        let alvo = terrenos.get(k);
        if (!alvo) { alvo = novaEntrada(terrenoC); terrenos.set(k, alvo); }
        const chave = chaveDoTerreno(l.entrada, res, estilo);
        if (alvo.chave === chave) continue;
        const caixa = l.caixa;
        const resPrevia = Math.max(1, res / 4);
        const baseTexturas = baseDasTexturas();
        const previa = naTela && estilo === 'illustrated' && (!alvo.sprite || modoDoProjetor)
          ? { chave: chaveDoTerreno(l.entrada, resPrevia, estilo), pedido: { tipo: 'terreno' as const, entrada: l.entrada, res: resPrevia, estilo, baseTexturas, ...(terrenoEfemero ? { semCache: true } : {}) } }
          : undefined;
        pintar(alvo, chave, { tipo: 'terreno', entrada: l.entrada, res, estilo, baseTexturas, ...(terrenoEfemero ? { semCache: true } : {}) }, (s, r) => {
          s.position.set(r.origem[0], r.origem[1]);
          s.scale.set(1 / r.res);
          cenaDeAltura.sincronizarLadrilhoTerreno(k, alvo!.texAltura, r.origem, r.res);
          if (mapa) {
            agua.aplicarLadrilho(caixa, r.agua, mapa);
            reaplicarSubmersos(mapa);
          }
        }, naTela ? 1 : 4, previa, modoDoProjetor, 'terreno', { caixa: [l.caixa.x, l.caixa.y, l.caixa.x + l.caixa.w, l.caixa.y + l.caixa.h], prios: [1, 4] });
      }
      op.baker.coletar(chavesEmUso());
    };

    // Na abertura do mapa e no projetor: assa de imediato; só no editor, durante pinceladas, espera 140 ms.
    if (terrenos.size === 0 || modoDoProjetor) pedirLadrilhos();
    else terrenoTimer = setTimeout(pedirLadrilhos, 140);
  }

  // ---------- Escarpas avulsas ----------
  const escarpas = new Map<string, Entrada>();
  function sincronizarEscarpas(m: MapaAtlas): void {
    const vivas = new Set(Object.values(m.walls).filter(ehEscarpaAvulsa).map(p => p.id));
    for (const [id, e] of escarpas) if (!vivas.has(id)) { removerEntrada(e); escarpas.delete(id); }
    const estilo = m.style.renderer, res = resolucaoDe(m, 'terreno');
    for (const id of vivas) {
      const p = m.walls[id]!, entrada = entradaDaEscarpa(p), origem = p.path[0]!;
      let e = escarpas.get(id); if (!e) { e = novaEntrada(escarpasC); escarpas.set(id, e); }
      e.c.position.set(origem[0], origem[1]);
      pintar(e, chaveDaEscarpa(entrada, res, estilo), { tipo: 'escarpa', entrada, res, estilo }, (s, r) => { s.position.set(r.origem[0], r.origem[1]); s.scale.set(1 / r.res); }, 0, undefined, false, 'escarpa');
    }
  }

  // ---------- Cômodos ----------
  function sincronizarComodos(m: MapaAtlas): void {
    const ctx = contextoDeEntradas(m), vivos = new Set(Object.keys(m.rooms));
    for (const [id, e] of salas) if (!vivos.has(id)) { cenaDeAltura.removerComodo(id); removerEntrada(e); salas.delete(id); }
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
      const alvo = e;
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      { const t = m.grid.size, [ox, oy] = m.grid.offset; for (const [x, y] of decodificar(sala.cells)) { bx0 = Math.min(bx0, ox + x * t); by0 = Math.min(by0, oy + y * t); bx1 = Math.max(bx1, ox + (x + 1) * t); by1 = Math.max(by1, oy + (y + 1) * t); } }
      const comodoNaTela = bx0 === Infinity || visivel(bx0, by0, bx1, by1);
      const resPrevia = Math.max(1, res / 4);
      const previa = comodoNaTela && estilo === 'illustrated' && !alvo.sprite
        ? { chave: chaveDoComodo(entrada, resPrevia, estilo), pedido: { tipo: 'comodo' as const, entrada, res: resPrevia, estilo } }
        : undefined;
      pintar(alvo, chaveDoComodo(entrada, res, estilo), { tipo: 'comodo', entrada, res, estilo }, (s, r) => { s.position.set(r.origem[0], r.origem[1]); s.scale.set(1 / r.res); cenaDeAltura.sincronizarComodo(sala.id, alvo.texAltura, r.origem, r.res); }, comodoNaTela ? 0 : 3, previa, false, 'comodo', bx0 === Infinity ? undefined : { caixa: [bx0, by0, bx1, by1], prios: [0, 3] });
    }
  }

  // ---------- Paredes, aberturas e marcas de objetos de parede ----------
  const COR_TOPO = 0x1a1820, COR_TOPO_CLARO = 0x2b2833, COR_BORDA_INTERNA = 0x4e485a, ESPESSURA_MINIMA_DE_COMODO = 0.34, ESPESSURA_MINIMA_ILUSTRADO = 0.38;
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

  function trechosDaParede(m: MapaAtlas, p: Parede): [number, number][] {
    // A parede é traçada em trechos, pulando o vão das portas e dos arcos.
    const comp = comprimentoDaParede(p), vaos = Object.values(m.openings).filter(a => a.wallId === p.id && (a.kind === 'door' || a.kind === 'arch' || secretaRevelada(m, a))).map(a => [a.at * comp - a.width / 2, a.at * comp + a.width / 2] as const).sort((x, y) => x[0] - y[0]);
    const trechos: [number, number][] = [];
    let pos = 0;
    for (const [a, b] of vaos) {
      const fim = Math.max(pos, a);
      if (fim - pos >= 1e-4) trechos.push([pos, fim]);
      pos = b;
    }
    if (comp - pos >= 1e-4) trechos.push([pos, comp]);
    return trechos;
  }

  function trazarTrechos(g: Graphics, p: Parede, trechos: readonly [number, number][], dx = 0, dy = 0): void {
    for (const [d0, d1] of trechos) {
      const pts: Ponto[] = [pontoEm(p, d0)];
      let acum = 0;
      for (let i = 0; i + 1 < p.path.length; i++) {
        const l = Math.hypot(p.path[i + 1]![0] - p.path[i]![0], p.path[i + 1]![1] - p.path[i]![1]);
        acum += l;
        if (acum > d0 && acum < d1) pts.push(p.path[i + 1]!);
      }
      pts.push(pontoEm(p, d1));
      g.moveTo(pts[0]![0] + dx, pts[0]![1] + dy);
      for (const q of pts.slice(1)) g.lineTo(q[0] + dx, q[1] + dy);
    }
  }

  const larguraDaParede = (p: Parede): number => {
    if (p.kind !== 'wall') return p.thickness;
    if (pixelRes === 0) return Math.max(p.thickness, p.source && 'roomId' in p.source ? ESPESSURA_MINIMA_ILUSTRADO : 0.3);
    return p.source && 'roomId' in p.source ? Math.max(p.thickness, ESPESSURA_MINIMA_DE_COMODO) : p.thickness;
  };

  function desenharParede(g: Graphics, m: MapaAtlas, p: Parede, temComodoEm?: (pt: Ponto, nivel: string | null) => boolean): void {
    const trechos = trechosDaParede(m, p);
    if (!trechos.length) return;

    if (p.kind === 'fence') {
      const matHex = p.material && p.material !== 'parede.topo' ? materialDe(p.material).base : '#7c5838';
      const corTravessa = hexParaNumero(matHex);
      const corPoste = hexParaNumero(tom(matHex, -0.32));
      const corMiolo = hexParaNumero(tom(matHex, 0.24));
      trazarTrechos(g, p, trechos, 0.05, 0.06);
      g.stroke({ width: lw(Math.max(0.08, p.thickness * 0.44)), color: 0x0e0c10, alpha: pixelRes ? 0.35 : 0.26, join: 'miter', cap: 'round' });
      trazarTrechos(g, p, trechos);
      g.stroke({ width: lw(Math.max(0.08, p.thickness * 0.42)), color: 0x1e1612, alpha: 0.96, join: 'miter', cap: 'butt' });
      trazarTrechos(g, p, trechos);
      g.stroke({ width: lw(Math.max(0.05, p.thickness * 0.24)), color: corTravessa, alpha: 0.96, join: 'miter', cap: 'butt' });
      const raio = Math.max(0.075, p.thickness * 0.42);
      for (const [d0, d1] of trechos) {
        const len = d1 - d0;
        const nPostes = Math.max(1, Math.round(len / 1.2));
        for (let k = 0; k <= nPostes; k++) {
          const [px, py] = pontoEm(p, d0 + (k / nPostes) * len);
          g.circle(px + 0.04, py + 0.05, raio).fill({ color: 0x0e0c10, alpha: pixelRes ? 0.35 : 0.24 });
          g.circle(px, py, raio).fill({ color: corPoste, alpha: 0.98 }).stroke({ width: lw(0.025), color: 0x16110e, alpha: 0.95 });
          g.circle(px - raio * 0.14, py - raio * 0.14, raio * 0.52).fill({ color: corMiolo, alpha: 0.92 });
        }
      }
      return;
    }

    if (p.kind === 'low') {
      const matHex = p.material && p.material !== 'parede.topo' ? materialDe(p.material).base : '#7b7780';
      trazarTrechos(g, p, trechos, 0.06, 0.08);
      g.stroke({ width: lw(p.thickness * 0.86), color: 0x0b0a0e, alpha: pixelRes ? 0.38 : 0.28, join: 'miter', cap: 'butt' });
      trazarTrechos(g, p, trechos);
      g.stroke({ width: lw(p.thickness * 0.84), color: 0x1e1c24, alpha: 0.96, join: 'miter', cap: 'butt' });
      trazarTrechos(g, p, trechos);
      g.stroke({ width: lw(p.thickness * 0.6), color: hexParaNumero(matHex), alpha: 0.96, join: 'miter', cap: 'butt' });
      trazarTrechos(g, p, trechos);
      g.stroke({ width: lw(p.thickness * 0.22), color: hexParaNumero(tom(matHex, 0.22)), alpha: pixelRes ? 0.85 : 0.65, join: 'miter', cap: 'butt' });
      return;
    }

    // Parede cheia: sombra de contato sutil, topo escuro, chanfro claro do lado da luz (noroeste) e aresta escura do
    // outro, e juntas espaçadas ao longo do topo — massa de alvenaria, não um traço chato de CAD.
    // Paredes de cômodo ganham corpo de alvenaria no desenho (no mínimo 0,34 m), como nas plantas de mapa de mesa.
    const t = larguraDaParede(p);
    if (p.kind === 'wall') { trazarTrechos(g, p, trechos, t * 0.18, t * 0.24); g.stroke({ width: lw(t * 1.15), color: 0x050408, alpha: pixelRes ? 0.3 : 0.2, join: 'miter', cap: 'butt' }); }
    trazarTrechos(g, p, trechos);
    g.stroke({ width: lw(t), color: COR_TOPO, alpha: 1, join: 'miter', cap: 'butt' });
    if (p.kind !== 'wall') return;
    const fino = pixelRes > 0 && t * pixelRes < 5;      // no Pixel, parede de poucos pixels fica só com o topo
    if (fino) return;
    const LUZ: Ponto = [-Math.SQRT1_2, -Math.SQRT1_2];
    for (const [d0, d1] of trechos) {
      const pts: Ponto[] = [pontoEm(p, d0)];
      let acum = 0;
      for (let i = 0; i + 1 < p.path.length; i++) { acum += Math.hypot(p.path[i + 1]![0] - p.path[i]![0], p.path[i + 1]![1] - p.path[i]![1]); if (acum > d0 && acum < d1) pts.push(p.path[i + 1]!); }
      pts.push(pontoEm(p, d1));
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]!, b = pts[i + 1]!, comp = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (comp < 1e-4) continue;
        const tx = (b[0] - a[0]) / comp, ty = (b[1] - a[1]) / comp;
        let nx = -ty, ny = tx, face = nx * LUZ[0] + ny * LUZ[1];
        if (face < 0) { nx = -nx; ny = -ny; face = -face; }      // n aponta para o lado iluminado
        const lado = (k: number, w: number, cor: number, alfa: number) =>
          g.moveTo(a[0] + nx * k, a[1] + ny * k).lineTo(b[0] + nx * k, b[1] + ny * k).stroke({ width: lw(w), color: cor, alpha: alfa, cap: 'butt' });
        lado(t * 0.3, t * 0.16, 0x4a4552, pixelRes ? 1 : 0.35 + 0.45 * face);
        lado(-t * 0.32, t * 0.14, 0x08070a, pixelRes ? 1 : 0.4 + 0.4 * face);
        if (pixelRes === 0 && temComodoEm) {
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dTeste = t * 0.5 + 0.25, nivel = p.levelId ?? null;
          if (temComodoEm([mx + nx * dTeste, my + ny * dTeste], nivel)) lado(t * 0.44, Math.max(0.025, t * 0.08), COR_BORDA_INTERNA, 0.78);
          if (temComodoEm([mx - nx * dTeste, my - ny * dTeste], nivel)) lado(-t * 0.44, Math.max(0.025, t * 0.08), COR_BORDA_INTERNA, 0.78);
        }
        // Juntas: traços curtos através do topo, com espaçamento irregular estável.
        if (comp < 0.5) continue;
        let h = Math.abs(Math.round(a[0] * 131 + a[1] * 71)) % 97;
        for (let d = 0.35 + (h % 7) * 0.04; d < comp - 0.2; d += 0.55 + ((h = (h * 37 + 11) % 97) % 9) * 0.04) {
          const cx = a[0] + tx * d, cy = a[1] + ty * d;
          g.moveTo(cx + nx * t * 0.36, cy + ny * t * 0.36).lineTo(cx - nx * t * 0.36, cy - ny * t * 0.36).stroke({ width: lw(Math.max(0.012, t * 0.05)), color: 0x2f2b36, alpha: pixelRes ? 1 : 0.55, cap: 'butt' });
        }
      }
    }
  }

  function desenharParedes(m: MapaAtlas): void {
    paredesG.clear();
    pixelRes = m.style.renderer === 'pixel' ? m.style.pixel.pixelsPerCell / m.grid.size : 0;
    paredesG.position.set(pixelRes ? 0.5 / pixelRes : 0, pixelRes ? 0.5 / pixelRes : 0);
    const indicePorNivel = new Map<string | null, Map<number, string>>();
    const temComodoEm = (pt: Ponto, nivel: string | null): boolean => {
      let idx = indicePorNivel.get(nivel);
      if (!idx) { idx = indiceDeCelulas(m, nivel); indicePorNivel.set(nivel, idx); }
      if (comodoEm(m, pt, idx)) return true;
      for (const s of Object.values(m.rooms)) {
        if ((s.levelId ?? null) === nivel && s.outline && pontoNoPoligono(pt, s.outline)) return true;
      }
      return false;
    };
    for (const p of Object.values(m.walls)) {
      if (p.source && 'terrainLayerId' in p.source) continue;      // contorno do maciço: o assar já mostra a rocha (a seleção traça a parede)
      if (ehEscarpaAvulsa(p)) continue;                              // escarpa avulsa: a face de rocha é assada à parte (`sincronizarEscarpas`)
      desenharParede(paredesG, m, p, temComodoEm);
      // No Pixel, um fio claro no meio do topo dá volume à faixa escura.
      if (pixelRes > 0 && p.kind === 'wall') { paredesG.moveTo(p.path[0]![0], p.path[0]![1]); for (const q of p.path.slice(1)) paredesG.lineTo(q[0], q[1]); paredesG.stroke({ width: lw(p.thickness * 0.14), color: COR_TOPO_CLARO, alpha: 1, cap: 'butt' }); }
    }
    for (const a of Object.values(m.openings)) { const p = m.walls[a.wallId]; if (p) desenharAbertura(paredesG, p, a, m); }
    // Objetos de parede aparecem na faixa da parede como uma marca, e inteiros na face do cômodo.
    for (const o of Object.values(m.props) as Objeto[]) {
      if (!o.wall) continue; const p = m.walls[o.wall.wallId]; if (!p) continue;
      const c = o.wall.at * comprimentoDaParede(p), { tangente } = pontoNaParede(p, c), meia = (o.source.kind === 'recipe' && typeof o.source.params.largura === 'number' ? (o.source.params.largura as number) : 0.8) / 2;
      const a = pontoEm(p, Math.max(0, c - meia)), b = pontoEm(p, Math.min(comprimentoDaParede(p), c + meia));
      paredesG.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: lw(p.thickness * 0.34), color: 0xd9a75e, alpha: pixelRes ? 1 : 0.9, cap: 'butt' }); void tangente;
    }
    cenaDeAltura.atualizarParedes((g, cor) => {
      if (pixelRes > 0) return;
      for (const p of Object.values(m.walls)) {
        if (p.kind !== 'wall') continue;
        if (p.source && 'terrainLayerId' in p.source) continue;
        if (ehEscarpaAvulsa(p)) continue;
        const trechos = trechosDaParede(m, p);
        if (!trechos.length) continue;
        trazarTrechos(g, p, trechos);
        const hCor = p.height > 0 ? (Math.round(alturaTopoDaFace(p.height) * 255) << 16) : cor;
        g.stroke({ width: larguraDaParede(p), color: hCor, alpha: 1, join: 'miter', cap: 'butt' });
      }
    });
  }

  // ---------- Objetos de piso ----------
  function desenharMarcadorDeObjeto(e: Entrada, o: Objeto): void {
    const [w, h] = ACERVO.pegadaDaFonte(o.source);
    e.placeholder.clear().roundRect(-w / 2, -h / 2, w, h, 0.08).fill({ color: corDoNome(o.source.kind === 'recipe' ? o.source.recipe : o.source.assetId, 0.35, 0.34), alpha: 0.7 });
  }

  const multiplicarTint = (a: number, b: number): number =>
    (Math.round(((a >> 16) & 255) * ((b >> 16) & 255) / 255) << 16) |
    (Math.round(((a >> 8) & 255) * ((b >> 8) & 255) / 255) << 8) |
    Math.round((a & 255) * (b & 255) / 255);

  /** Objeto submerso: tingido pela cor do fundo e esmaecido pela profundidade no ponto dele; abaixo do topo de relevo também recebe tom e névoa. */
  const espelharImagem = (o: Objeto | undefined): boolean => !!o?.flip && o.source.kind === 'asset';
  function aplicarSubmersao(c: Container, o: Objeto, m: MapaAtlas): void {
    const sub = o.elevation === 'underwater' ? agua.submersao(o.position[0], o.position[1]) : null;
    const tRel = tintDoRelevo(m, o.position);
    const opaco = o.opacity ?? 1;      // a opacidade do objeto compõe com a da submersão, e o oculto (×0,5) vem depois
    if (!sub) {
      if (o.elevation === 'underwater') { c.tint = multiplicarTint(0xb4c8d0, tRel); c.alpha = (m.style.renderer === 'pixel' ? 1 : 0.8) * opaco; }
      else { c.tint = tRel; c.alpha = opaco; }
      return;
    }
    const pixel = m.style.renderer === 'pixel', t = pixel ? (sub.profundidade < 0.17 ? 0.25 : sub.profundidade < 0.5 ? 0.6 : 1) : Math.min(1, 0.25 + sub.profundidade * 0.9);
    const canal = (sh: number) => Math.round(255 - (255 - Math.min(255, ((sub.cor >> sh) & 255) * 1.8 + 40)) * 0.8 * t);
    c.tint = multiplicarTint((canal(16) << 16) | (canal(8) << 8) | canal(0), tRel); c.alpha = (pixel ? 1 : 1 - 0.45 * t) * opaco;
  }
  function reaplicarSubmersos(m: MapaAtlas): void { for (const [id, e] of objetos) { const o = m.props[id] as Objeto | undefined; if (o?.elevation === 'underwater') { aplicarSubmersao(e.c, o, m); e.alphaAlvo = e.c.alpha; } } }

  // Cardumes (`animacao: 'nadar'`): o desenho inteiro gira devagar em volta do centro, com um leve vaivém, como carpas rodeando o lago.
  const nadadores = new Map<string, { c: Container; giro: number; fase: number }>();
  let tempoDeNado = 0;
  function nadar(dt: number): void {
    if (!nadadores.size) return;
    tempoDeNado += Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1);
    for (const n of nadadores.values()) {
      if (n.c.destroyed) continue;
      const sentido = n.fase < 0.5 ? 1 : -1, t = tempoDeNado + n.fase * 60;
      n.c.rotation = n.giro + sentido * t * (Math.PI * 2 / 70) + Math.sin(t * 0.6) * 0.05;
    }
  }

  function sincronizarObjetos(m: MapaAtlas, ids: readonly string[] | null, comPop: boolean): void {
    for (const id of ids ?? [...new Set([...objetos.keys(), ...Object.keys(m.props)])]) {
      const o = m.props[id] as Objeto | undefined, e = objetos.get(id);
      const res = resolucaoDe(m, 'objeto'), chave = o ? chaveDoObjeto(o, res, m.style.genre, m.style.renderer, opcoesDoPixel(m)) : null;
      if (!o || chave === null) { if (e) { removerEntrada(e); objetos.delete(id); } nadadores.delete(id); continue; }
      let entrada = e;
      if (!entrada) {
        entrada = novaEntrada(objetosC); entrada.c.label = id; objetos.set(id, entrada); desenharMarcadorDeObjeto(entrada, o);
        if (comPop && op.efeitos()) { entrada.c.scale.set(0.6); animacoes.push({ alvo: entrada.c, t0: performance.now(), dur: 180, final: o.scale }); }
      }
      const pai = o.elevation === 'underwater' ? submersosC : objetosC;      // o que está sob a água fica entre o leito e a superfície
      if (entrada.c.parent !== pai) pai.addChild(entrada.c);
      entrada.c.position.set(o.position[0], o.position[1]); entrada.c.rotation = o.rotation; entrada.c.zIndex = camadaDoObjeto(o);
      aplicarSubmersao(entrada.c, o, m);
      entrada.alphaAlvo = entrada.c.alpha;
      if (o.elevation === 'underwater' && ACERVO.item(ACERVO.idDaFonte(o.source))?.animacao === 'nadar') nadadores.set(id, { c: entrada.c, giro: o.rotation, fase: o.source.kind === 'recipe' ? (o.source.seed % 997) / 997 : 0 });
      else nadadores.delete(id);
      if (o.oculto) {
        entrada.c.visible = !modoDoProjetor && vistaDaCena !== 'jogador';
        entrada.c.alpha *= 0.5;
      } else {
        entrada.c.visible = true;
      }
      if (!animacoes.some(a => a.alvo === entrada!.c)) entrada.c.scale.set(o.scale);
      const naTela = visivel(o.position[0] - RAIO_DE_VISAO, o.position[1] - RAIO_DE_VISAO, o.position[0] + RAIO_DE_VISAO, o.position[1] + RAIO_DE_VISAO);
      const pedido = pedidoDoObjeto(o, res, m.style.genre, m.style.renderer, opcoesDoPixel(m));
      if (pedido) pintar(entrada, chave, pedido, (sp, r) => {
        sp.position.set(r.origem[0], r.origem[1]); sp.scale.set(1 / r.res);
        // Sombra projetada: a textura só serve à camada das sombras do sol; o objeto em si não aparece.
        sp.alpha = ehSombraProjetada(o) ? 0 : 1;
        if (espelharImagem(mapa?.props[id] as Objeto | undefined)) { sp.position.x = -sp.position.x; sp.scale.x = -sp.scale.x; }
      }, naTela ? 1 : 5, undefined, false, 'objeto', { caixa: [o.position[0] - RAIO_DE_VISAO, o.position[1] - RAIO_DE_VISAO, o.position[0] + RAIO_DE_VISAO, o.position[1] + RAIO_DE_VISAO], prios: [1, 5] });
      // Imagem da coleção: o espelho é do sprite (a chave não muda), então acompanha o `flip` sem novo assado. Receita: já vem espelhada do assado.
      const sp = entrada.sprite;
      if (sp && !sp.destroyed && (sp.scale.x < 0) !== espelharImagem(o)) { sp.position.x = -sp.position.x; sp.scale.x = -sp.scale.x; }
    }
    cenaDeAltura.sincronizarObjetos(objetos, objetosC);
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
      op.baker.pedir(chave, { tipo: 'sprite', spec }, 1).then(r => {
        if (destruida || chaveDoSprite(mapa?.tokens[t.id] ?? ({ sprite: null } as Peca)) !== chave) return;
        const antes = folhaDaPeca.get(t.id) ?? null; adquirir(chave, r); folhaDaPeca.set(t.id, chave); soltar(antes); redesenhar();
      }).catch(erro => console.warn('Atlas: falha ao pintar o sprite', erro));
    }
    const pronta = folhaDaPeca.get(t.id); return pronta ? texturas.get(pronta)?.tex ?? null : null;
  }
  function desenharPeca(c: Container, t: Peca, m: MapaAtlas, animar: boolean | 'gesto'): void {
    let v = visuais.get(c); if (!v) { v = criarPeca(); visuais.set(c, v); c.addChild(v.c); }
    const folha = folhaDe(t, () => { if (!destruida && !c.destroyed && mapa?.tokens[t.id]) desenharPeca(c, mapa.tokens[t.id]!, mapa, false); });
    const pixel = m.style.renderer === 'pixel', px = m.style.pixel;
    const noPixel: RetratoNoPixel | undefined = pixel ? { chave: `${m.style.palette}|${px.pixelsPerCell}|${t.size}|${px.dither}|${px.outline}`, lado: Math.max(8, Math.round(t.size * px.pixelsPerCell * 0.9)), paleta: paletaDe(m.style.palette).cores, dither: px.dither === 'bayer4', contorno: px.outline } : undefined;
    const rec = op.recursos?.(t) ?? null, aparente = rec && emEstadoCritico(rec) && t.figure.state === 'normal' ? { ...t, figure: { state: 'hurt' as const } } : t;      // PV baixo: "ferida" só na tela
    const animarPeca = animar === 'gesto' ? (op.efeitos() ? 'gesto' : false) : animar && op.efeitos();
    v.atualizar(aparente, m.grid.size, op.acento(), op.retrato?.(t.portrait?.id, noPixel) ?? null, animarPeca, { folha, pixel }, rec, op.pecaDoJogador?.(t) === true);
  }

  function atualizarLuzDasPecas(): void {
    for (const [id, c] of pecas) {
      const t = mapa?.tokens[id];
      const v = visuais.get(c);
      if (!t || !v) continue;
      if (!atmosferaLigada || vistaDaCena === 'construir') {
        v.definirLuzAmbiente([1, 1, 1], 1);
        continue;
      }
      const pos: Ponto = [v.c.x, v.c.y];
      const rgb = luz.amostrarPonto(pos, raioDoOclusorDeToken(t));
      const piso = vistaDaCena === 'jogador' || modoDoProjetor
        ? (t.player ? 0.12 : 0.02)
        : 0.28;
      v.definirLuzAmbiente(rgb, piso);
    }
  }

  function atualizarVisibilidadeDosObjetos(dtSeg: number, imediato: boolean): void {
    if (!mapa) return;
    const restringir = vistaDaCena === 'jogador' || modoDoProjetor;
    for (const [id, e] of objetos) {
      const o = mapa.props[id] as Objeto | undefined;
      if (!o) continue;
      const baseAlpha = e.alphaAlvo ?? (o.opacity ?? 1);
      if (o.oculto) {
        e.c.visible = !restringir;
        e.c.alpha = restringir ? 0 : baseAlpha * 0.5;
        continue;
      }
      if (!restringir || !objetoDinamicoDeVisao(o)) {
        e.c.alpha = baseAlpha;
        e.c.visible = true;
        continue;
      }
      const alvo = pontoVisivelAgora(mapa, o.position, 0.25, filtroVisao, minhasFichas) ? baseAlpha : 0;
      if (imediato) {
        e.c.alpha = alvo;
      } else if (dtSeg > 0) {
        e.c.alpha += (alvo - e.c.alpha) * (1 - Math.exp(-dtSeg / 0.15));
        if (Math.abs(alvo - e.c.alpha) < 0.01) e.c.alpha = alvo;
      }
      e.c.visible = e.c.alpha > 0.01;
    }
  }

  function atualizarVisibilidadeDasPecas(dtSeg: number, imediato: boolean): void {
    if (!mapa) return;
    const restringir = vistaDaCena === 'jogador' || modoDoProjetor;
    for (const [id, c] of pecas) {
      const t = mapa.tokens[id];
      if (!t) continue;
      if (!restringir || pecaSempreVisivel(t, filtroVisao)) {
        c.alpha = 1;
        c.visible = true;
        continue;
      }
      const v = visuais.get(c);
      const pos: Ponto = [v?.c.x || c.x || t.position[0], v?.c.y || c.y || t.position[1]];
      const alvo = pontoVisivelAgora(mapa, pos, t.size * mapa.grid.size * 0.35, filtroVisao, minhasFichas) ? 1 : 0;
      if (imediato) {
        c.alpha = alvo;
      } else if (dtSeg > 0) {
        c.alpha += (alvo - c.alpha) * (1 - Math.exp(-dtSeg / 0.15));
        if (Math.abs(alvo - c.alpha) < 0.01) c.alpha = alvo;
      }
      c.visible = c.alpha > 0.01;
    }
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
    const desenharSeloDeTransicao = (x: number, y: number) => {
      const cor = 0x38bdf8;
      marcasG.circle(x, y, 0.22).fill({ color: 0x0c0c12, alpha: 0.88 }).stroke({ width: 0.04, color: cor });
      marcasG
        .moveTo(x - 0.08, y + 0.08)
        .lineTo(x + 0.08, y - 0.08)
        .moveTo(x - 0.01, y - 0.08)
        .lineTo(x + 0.08, y - 0.08)
        .lineTo(x + 0.08, y + 0.01)
        .stroke({ width: 0.045, color: cor, cap: 'round', join: 'round' });
    };
    for (const o of Object.values(m.props) as Objeto[]) {
      if (transicaoDoObjeto(o)) {
        desenharSeloDeTransicao(o.position[0], o.position[1]);
        continue;
      }
      const i = o.interaction; if (!i || i.kind === 'clue') continue;
      const [x, y] = o.position, cor = i.kind === 'switch' ? (i.on ? 0xffd23f : 0x6b6f80) : (i.on ? 0x4fc3f7 : 0x6b6f80);
      marcasG.circle(x, y, 0.2).fill({ color: 0x0c0c12, alpha: 0.85 }).stroke({ width: 0.04, color: cor });
      if (i.kind === 'switch') marcasG.moveTo(x, y + 0.08).lineTo(x, y - 0.1).stroke({ width: 0.05, color: cor, cap: 'round' });
      else marcasG.rect(x - 0.09, y - 0.07, 0.18, 0.14).stroke({ width: 0.035, color: cor }).moveTo(x - 0.03, y).lineTo(x + 0.03, y).stroke({ width: 0.035, color: cor });
    }
    for (const a of Object.values(m.openings)) {
      if (!transicaoDaAbertura(a)) continue;
      const parede = m.walls[a.wallId];
      if (!parede) continue;
      const { ponto } = pontoNaParede(parede, centroDaAbertura(parede, a));
      desenharSeloDeTransicao(ponto[0], ponto[1]);
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
    for (const e of [...salas.values(), ...objetos.values(), ...terrenos.values(), ...escarpas.values()]) {
      if (e.chave) s.add(e.chave);
      if (e.chavePrevia) s.add(e.chavePrevia);
    }
    for (const c of telhados.chavesEmUso()) s.add(c);
    return s;
  }

  function tracoTracejado(g: Graphics, a: Ponto, b: Ponto, traco = 0.25, vao = 0.15): void {
    const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return;
    const ux = dx / dist, uy = dy / dist;
    for (let d = 0; d < dist; d += traco + vao) {
      const f = Math.min(dist, d + traco);
      g.moveTo(a[0] + ux * d, a[1] + uy * d).lineTo(a[0] + ux * f, a[1] + uy * f);
    }
  }

  function desenharOverlaysDeAndar(m: MapaAtlas, ctx?: ContextoDoAndar): void {
    veuTerrenoG.clear();
    fantasmaAndarG.clear();
    const completo = ctx?.completo ?? m, andar = ctx?.andar ?? null;
    const construir = ctx?.construir ?? vistaDaCena === 'construir';
    const ordem = andar === null ? 0 : (completo.levels?.[andar]?.order ?? 0);
    if (ordem > 0) {
      veuTerrenoG.rect(0, 0, m.bounds.width, m.bounds.height).fill({ color: 0x000000, alpha: 0.45 });
    }
    if (!construir || modoDoProjetor) { fantasmaAndarG.visible = false; return; }
    fantasmaAndarG.visible = true;
    const lista = listaDeAndares(completo);
    const idx = lista.findIndex(a => a.id === andar);
    const abaixo = idx > 0 ? lista[idx - 1]! : null;
    if (!abaixo) return;
    for (const sala of Object.values(completo.rooms)) {
      if ((sala.levelId ?? null) !== abaixo.id) continue;
      if (sala.outline && sala.outline.length >= 3) {
        const n = sala.outline.length;
        for (let k = 0; k < n; k++) tracoTracejado(fantasmaAndarG, sala.outline[k]!, sala.outline[(k + 1) % n]!);
      } else {
        for (const anel of contornoDoComodo(completo, decodificar(sala.cells))) {
          for (const seg of anel) tracoTracejado(fantasmaAndarG, seg.a, seg.b);
        }
      }
    }
    fantasmaAndarG.stroke({ width: 0.05, color: 0xe6edf7, alpha: 0.3, cap: 'butt' });
  }

  return {
    raiz,
    get pintando() { return pintandoAgora + op.baker.pendentes; },
    sincronizar(m, mud, comPop, visaoDoClima, contextoAndar) {
      mapa = m;
      ultimoContextoAndar = contextoAndar ?? null;
      const tudo = !mud || mud.completo, campos = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x)), colecao = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c];
      const refazerPorRelevo = !!m.terrain.relief && campos('climate', 'terrain');
      if (campos('terrain', 'bounds', 'grid', 'backdrop', 'style') || (m.style.settle !== false && (colecao('rooms') || colecao('walls') || colecao('openings'))) || refazerPorRelevo) sincronizarTerreno(m);
      if (tudo || colecao('walls') || campos('style')) sincronizarEscarpas(m);
      if (tudo || colecao('rooms') || colecao('walls') || colecao('openings') || colecao('props') || campos('style', 'grid') || refazerPorRelevo) sincronizarComodos(m);
      if (tudo || colecao('rooms') || colecao('walls') || colecao('openings') || colecao('props') || campos('grid', 'session', 'style')) desenharParedes(m);
      if (tudo || colecao('rooms') || colecao('walls') || colecao('openings') || campos('grid', 'style', 'climate')) contato.atualizar(m);
      if (tudo || colecao('rooms') || campos('levels', 'bounds', 'grid')) desenharOverlaysDeAndar(m, contextoAndar);
      if (tudo || colecao('props') || campos('style') || refazerPorRelevo) sincronizarObjetos(m, (tudo || campos('style') || refazerPorRelevo) ? null : mud!.colecoes.props ?? null, comPop);
      if (tudo || colecao('props') || campos('style', 'grid')) cachoeiras.sincronizar(m);
      if (tudo || colecao('props') || colecao('walls') || campos('climate', 'terrain', 'bounds', 'style')) sombras.atualizar(m, objetos, pixelRes0(m));
      if (tudo || colecao('props')) desenharMarcas(m);
      agua.sincronizar(m); if (tudo || colecao('props') || campos('style')) agua.objetos(m);
      presenca.sincronizar(m, mud); nevoa.sincronizar(m, mud); telhados.sincronizar(m, mud);
      const v = visaoDoClima ?? m;
      ehPixel = m.style.renderer === 'pixel';
      if (tudo || colecao('rooms') || colecao('props') || colecao('walls') || campos('climate', 'bounds', 'grid', 'style')) tempo.atualizar(v, objetos);
      luz.sincronizar(v, mud); telhados.atualizarClima?.(v); composicaoDeLuz.definirRelevo(v.finish.relief ?? RELEVO_PADRAO); composicaoDeLuz.definirAO(v.finish.ao ?? AO_PADRAO); composicaoDeLuz.definirGlow(v.finish.glow); composicaoDeLuz.definirExposicao(v.finish.exposure ?? EXPOSICAO_PADRAO); atualizarComposicaoDeLuz(); neblina.sincronizar(v, mud); fumaca.sincronizar(v, mud); bordas.sincronizar(v, mud); particulas.sincronizar(v, mud); halos.sincronizar(v, mud);
      // Os marcadores das luzes também refletem o clima (apagada pela rede ou pelo dia), então refazem quando ele muda.
      if (tudo || colecao('lights') || campos('climate')) sincronizarSimples(luzes, luzesC, m.lights, tudo || campos('climate') ? null : mud!.colecoes.lights ?? null, (c, l) => desenharLuz(c, l, m), comPop);
      if (tudo || colecao('tokens') || campos('grid', 'style')) {
        const animarPeca = comPop ? true : (modoDoProjetor && !tudo && mud?.colecoes.tokens?.length === 1 && !mud.campos.length ? 'gesto' : false);
        sincronizarSimples(pecas, pecasC, m.tokens, tudo || campos('grid', 'style') ? null : mud!.colecoes.tokens ?? null, (c, t) => desenharPeca(c, t, m, animarPeca), comPop);
      }
      for (const id of [...folhaDaPeca.keys()]) if (!m.tokens[id]) { soltar(folhaDaPeca.get(id)!); folhaDaPeca.delete(id); }
      { const vezDe = m.session.initiative?.order[m.session.initiative.current]?.tokenId; for (const [id, c] of pecas) visuais.get(c)?.definirVez(id === vezDe); }
      if (tudo || colecao('regions')) sincronizarSimples(regioes, regioesC, m.regions, tudo ? null : mud!.colecoes.regions ?? null, desenharRegiao, comPop);
      if (tudo || campos('backdrop', 'bounds', 'style', 'grid')) sincronizarTitulo(m);
      atualizarLuzDasPecas();
      atualizarVisibilidadeDasPecas(0, true);
      atualizarVisibilidadeDosObjetos(0, true);
      op.baker.coletar(chavesEmUso());
    },
    atualizarAtmosfera(visao) {
      const mud: Mudancas = { completo: false, colecoes: {}, campos: ['climate'] };
      tempo.atualizar(visao, objetos);
      luz.sincronizar(visao, mud); telhados.atualizarClima?.(visao); composicaoDeLuz.definirRelevo(visao.finish.relief ?? RELEVO_PADRAO); composicaoDeLuz.definirAO(visao.finish.ao ?? AO_PADRAO); composicaoDeLuz.definirGlow(visao.finish.glow); composicaoDeLuz.definirExposicao(visao.finish.exposure ?? EXPOSICAO_PADRAO); neblina.sincronizar(visao, mud); fumaca.sincronizar(visao, mud); bordas.sincronizar(visao, mud); particulas.sincronizar(visao, mud); halos.sincronizar(visao, mud);
      atualizarLuzDasPecas();
    },
    definirAtmosfera: ligada => { atmosferaLigada = ligada; sombras.definirLigado(ligada); contato.definirLigado(ligada); tempo.definirLigado(ligada, mapa, objetos); if (ligada && mapa) sombras.atualizar(mapa, objetos, pixelRes0(mapa)); luz.definirLigado(ligada); telhados.definirAtmosfera?.(ligada); atualizarComposicaoDeLuz(); neblina.definirLigado(ligada); fumaca.definirLigado(ligada); bordas.definirLigado(ligada); particulas.definirLigado(ligada); halos.definirLigado(ligada); atualizarLuzDasPecas(); },
    relampagoAgora: () => luz.relampagoAgora(),
    definirModoProjetor: ligado => { modoDoProjetor = ligado; marcasVisiveis(); luzesC.visible = !ligado; regioesC.visible = !ligado; if (mapa) { sincronizarObjetos(mapa, null, false); tempo.atualizar(mapa, objetos); desenharOverlaysDeAndar(mapa, ultimoContextoAndar ?? undefined); } atualizarLuzDasPecas(); atualizarVisibilidadeDasPecas(0, true); atualizarVisibilidadeDosObjetos(0, true); },
    definirEfeitosDeLuz: (luzes, ambiente) => luz.definirEfeitos(luzes, ambiente),
    definirVista: v => { nevoa.definirVista(v); telhados.definirVista(v); if (v !== vistaDaCena) { vistaDaCena = v; if (mapa) { desenharParedes(mapa); sincronizarObjetos(mapa, null, false); tempo.atualizar(mapa, objetos); desenharOverlaysDeAndar(mapa, ultimoContextoAndar ?? undefined); } } marcasVisiveis(); atualizarLuzDasPecas(); atualizarVisibilidadeDasPecas(0, true); atualizarVisibilidadeDosObjetos(0, true); },
    definirFiltroDeVisao: (f, fichas) => {
      filtroVisao = f ?? null;
      minhasFichas = fichas ?? null;
      nevoa.definirFiltroDeVisao?.(filtroVisao, minhasFichas);
      telhados.definirFiltroDeVisao?.(filtroVisao, minhasFichas);
      if (mapa) {
        atualizarVisibilidadeDasPecas(0, true);
        atualizarVisibilidadeDosObjetos(0, true);
      }
    },
    forcarTelhados: alfa => telhados.forcar(alfa),
    definirTelhadosNoEditor: v => telhados.definirNoEditor(v),
    diagnosticoDosTelhados: () => telhados.diagnostico(),
    redesenharPecas() { if (mapa) { sincronizarSimples(pecas, pecasC, mapa.tokens, null, (c, t) => desenharPeca(c, t, mapa!, false), false); atualizarLuzDasPecas(); } },
    contagemDeParticulas: () => particulas.contagem(),
    contagemDePresencas: () => presenca.contagem(),
    contagemDePresencasSubmersas: () => presenca.contagemSubmersas(),
    contagemDeCachoeiras: () => cachoeiras.contagem(),
    aguaAtiva: () => agua.ativa(),
    diagnosticoDasPecas: () => [...pecas.entries()].map(([id, c]) => ({ id, ...(visuais.get(c)?.estado() ?? { vez: false, retrato: false, deitada: false, raio: 0, deslizando: false, trilha: 0, quadro: null, pips: null, estadoVisto: 'normal' }) })),
    objetosPintados: () => [...objetos.values()].filter(e => e.sprite !== null && !e.placeholder.visible).length,
    tintDeObjeto: id => objetos.get(id)?.c.tint ?? null,
    descarregarPendencias,
    repriorizar,
    quadro(agora) {
      descarregarPendencias();
      const posicoesDeTokens = new Map<string, Ponto>();
      const tokensVivos = new Map<string, { position: Ponto; direction?: number }>();
      for (const [id, c] of pecas) {
        const v = visuais.get(c);
        if (!v) continue;
        v.quadro(agora, op.efeitos());
        const pos: Ponto = [v.c.x, v.c.y];
        posicoesDeTokens.set(id, pos);
      }
      luz.quadro(agora, posicoesDeTokens);
      if (mapa) {
        const ativos = new Set(tokensDeVisaoAtivos(mapa, filtroVisao, minhasFichas).map(t => t.id));
        for (const [id, c] of pecas) {
          const t = mapa.tokens[id];
          const v = visuais.get(c);
          if (!t || !ativos.has(id) || !v) continue;
          const pos: Ponto = [v.c.x, v.c.y];
          const deslizando = v.estado().deslizando;
          const luzToken = t.lightId ? mapa.lights[t.lightId] : undefined;
          const visLuz = t.lightId ? luz.estadoVisual(t.lightId) : null;
          const girandoLuz = Boolean(
            luzToken?.cone && visLuz?.direction !== null && visLuz?.direction !== undefined &&
            Math.abs(visLuz.direction - luzToken.cone.direction) > 1e-3,
          );
          if (deslizando || girandoLuz) {
            tokensVivos.set(id, {
              position: pos,
              ...(visLuz?.direction !== null && visLuz?.direction !== undefined ? { direction: visLuz.direction } : {}),
            });
          }
        }
      }
      nevoa.quadro(agora, tokensVivos.size > 0 ? tokensVivos : undefined);
      telhados.quadro(agora);
      atualizarLuzDasPecas();
      const dt = ultimoQuadro < 0 ? 0 : (agora - ultimoQuadro) / 1000; ultimoQuadro = agora;
      atualizarVisibilidadeDasPecas(dt, movimentoReduzido());
      atualizarVisibilidadeDosObjetos(dt, movimentoReduzido());
      neblina.quadro(dt); fumaca.quadro(dt); bordas.quadro(dt); particulas.quadro(dt); presenca.quadro(dt); agua.quadro(dt); cachoeiras.quadro(dt); nadar(dt); halos.quadro(agora, dt);
      let animouObjeto = false;
      for (let i = animacoes.length - 1; i >= 0; i--) {
        const a = animacoes[i]!, t = Math.min(1, (agora - a.t0) / a.dur), e = 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;   // easeOutBack
        if (a.alvo.destroyed) { animacoes.splice(i, 1); continue; }
        a.alvo.scale.set(a.final * (0.6 + 0.4 * e));
        if (a.alvo.parent === objetosC) animouObjeto = true;
        if (t >= 1) { a.alvo.scale.set(a.final); animacoes.splice(i, 1); }
      }
      if (animouObjeto) cenaDeAltura.sincronizarObjetos(objetos, objetosC);
      const ativo = atmosferaLigada && !ehPixel;
      cenaDeAltura.atualizar(op.renderer, mundoIluminado, ativo);
      composicaoDeLuz.definirDarkwood(vistaDaCena === 'jogador' && nevoa.modoDarkwood, nevoa.mascaraVisivel, mapa?.bounds ?? null);
      composicaoDeLuz.atualizar(mundoIluminado, ativo, movimentoReduzido() ? 0 : agora / 1000);
    },
    destruir() {
      destruida = true; if (terrenoTimer) clearTimeout(terrenoTimer);
      for (const e of [...salas.values(), ...objetos.values(), ...escarpas.values(), ...terrenos.values()]) soltar(e.chaveTextura);
      for (const t of texturas.values()) { t.tex.destroy(true); t.texAltura?.destroy(true); } texturas.clear();
      composicaoDeLuz.destruir(); cenaDeAltura.destruir();
      tempo.destruir(); sombras.destruir(); contato.destruir(); luz.destruir(); halos.destruir(); nevoa.destruir(); telhados.destruir(); neblina.destruir(); fumaca.destruir(); bordas.destruir(); particulas.destruir(); presenca.destruir(); agua.destruir(); cachoeiras.destruir(); raiz.destroy({ children: true });
    },
  };
}

export type { PedidoDeBake };
