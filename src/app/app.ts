import { iniciarPistas } from './pistas.ts';
import { abrirInspecao, fecharInspecao, inspecao, mostrandoAosJogadores } from './inspecao.ts';
import type { Vista } from '../domain/inspecao.ts';
import { aoRolar, iniciarFichas, pecaDaFicha, recursosDasFichas, adicionarPersonagem } from './fichas.ts';
import { flutuarRolagem, ponto as pontoDaTela } from '../fx/fx.ts';
import { batch, effect, signal } from '@preact/signals';
import { criarRef, mesmaRef, type Ref } from '#mesa';
import { exportarBackup, importarBackup, lerPacote, nomeDoArquivo, type RelatorioImportacao } from '../data/backup.ts';
import { ErroDeBackup } from '../data/backup.ts';
import { ErroDeConflito, type ResumoMapa } from '../data/repositorio.ts';
import { duplicarParaNovaSessao, criarMapa, type MapaAtlas, type Ponto } from '../domain/mapa.ts';
import { copiasDe, novaLuz, novaPeca, novaRegiao, novoObjeto } from '../domain/fabrica.ts';
import { interagiveisPerto } from '../domain/interacao.ts';
import { ROTULO_DA_INTERACAO } from '../domain/interagiveis.ts';
import { secretaOculta } from '../domain/nevoa.ts';
import { presetDeClima } from '../domain/presets.ts';
import { faiscar, flutuar, ponto } from '../fx/fx.ts';
import { tocar } from '../fx/som.ts';
import { todosOsAlvos, caixaDe, caixaDaSelecao, ehMovel, type Alvo, type ColecaoSelecionavel } from '../render/selecao.ts';
import type { Viewport } from '../render/viewport.ts';
import type { ColecaoLivre, Comando } from '../state/comandos.ts';
import { embutido } from './embutido.ts';
import { campanhaAtiva, carregarCampanhas, desvincularMapa, entidadesDaCampanha, refDoMapa, revincularMapa, sincronizarMapaComCampanha } from './campanha.ts';
import { pedirCena, pedirSomDoClima, pedirSomDoMapa, tocarSomEscolhido } from './audio-do-clima.ts';
import { iniciarRegioes } from './regioes.ts';
import { modo, vistaDeJogador } from './modo.ts';
import { iniciarSugestoes } from './sugestoes.ts';
import { abrirJanelaDoProjetor, iniciarPublicacao, mapaNoProjetorId, projetorConectado, type Publicador } from './projetor.ts';
import type { EventoDeCena } from '../render/eventos-de-cena.ts';
import { lerRota, formatarRota, type Rota } from './rotas.ts';
import { iniciarServicos, type Servicos } from './servicos.ts';
import { criarSessao, type SessaoDeEdicao } from './sessao.ts';
import { iniciarTema } from './tema.ts';
import { avisar } from './toasts.ts';
import { comTransicao } from './transicao.ts';
import { abasAbertas, atualizarNomeDaAba, fecharAba, lembrarCameraDaAba, registrarAbaAberta } from './abas.ts';

// ---------- Estado global da interface ----------
export const servicos = signal<Servicos | null>(null);
export const erroInicial = signal<string | null>(null);
export const rota = signal<Rota>(lerRota(typeof location !== 'undefined' ? location.hash : ''));
export const sessao = signal<SessaoDeEdicao | null>(null);
export const mapaAusente = signal<string | null>(null);
export const carregando = signal(false);
export const resumos = signal<ResumoMapa[]>([]);
export const paletaAberta = signal(false);
export const ajudaAberta = signal(false);
export const menuRadial = signal<{ x: number; y: number; mundo: Ponto; alvo: Alvo | null; aberto: number } | null>(null);
/** Cômodo a enquadrar assim que o viewport estiver pronto (link profundo). */
export const focoPendente = signal<string | null>(null);

export const viewport: { atual: Viewport | null } = { atual: null };

/** Mostrar o acabamento da cena (vinheta, tinta…) no editor? Preferência de quem edita, não do mapa. */
const CHAVE_ACABAMENTO = 'atlas:acabamento';
let acabamentoInicial = true; try { acabamentoInicial = (typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_ACABAMENTO) : null) !== '0'; } catch { /* padrão ligado */ }
export const acabamentoLigado = signal(acabamentoInicial);
export function definirAcabamentoLigado(v: boolean): void { acabamentoLigado.value = v; try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_ACABAMENTO, v ? '1' : '0'); } catch { /* ignora */ } }

const SINGULAR: Record<ColecaoSelecionavel, string> = { lights: 'luz', props: 'objeto', tokens: 'peça', regions: 'região', presence: 'presença', rooms: 'cômodo', walls: 'parede', openings: 'abertura' };
const PLURAL: Record<ColecaoSelecionavel, string> = { lights: 'luzes', props: 'objetos', tokens: 'peças', regions: 'regiões', presence: 'presenças', rooms: 'cômodos', walls: 'paredes', openings: 'aberturas' };

// ---------- Início ----------
let iniciado = false;
export async function iniciar(): Promise<void> {
  if (iniciado) return; iniciado = true;
  iniciarTema();
  try {
    const s = await iniciarServicos();
    servicos.value = s;
    await carregarCampanhas(s);
    if (s.barramento) iniciarFichas(s.barramento);
    iniciarPistas();
    await atualizarLista();
    s.barramento?.atender('atlas.focar', dados => {
      const ref = (dados as { ref: { tipo: string; id: string } }).ref;
      if (ref.tipo === 'mapa') { navegar({ tipo: 'mapa', id: ref.id }); return { ok: true }; }
      if (ref.tipo === 'comodo') { const i = ref.id.indexOf('/'); if (i > 0) { navegar({ tipo: 'mapa', id: ref.id.slice(0, i), comodo: ref.id.slice(i + 1) }); return { ok: true }; } }
      return { ok: false, motivo: `O Atlas não abre ${ref.tipo}.` };
    });
    s.barramento?.atender('atlas.preparar-cena', dados => {
      return prepararCenaNoAtlas(s, dados as DadosPrepararCena);
    });
  } catch (erro) {
    erroInicial.value = erro instanceof Error ? erro.message : String(erro);
    return;
  }
  window.addEventListener('hashchange', () => { rota.value = lerRota(location.hash); void sincronizarRota(); });
  window.addEventListener('pagehide', () => { void sessao.value?.auto.descarregar(); });
  window.addEventListener('beforeunload', e => { if (sessao.value?.sujo.value && sessao.value.gravacao.value !== 'limpo') { e.preventDefault(); } });
  await sincronizarRota();
}

export function navegar(r: Rota): void {
  const alvo = formatarRota(r);
  if (typeof location === 'undefined') { rota.value = r; void sincronizarRota(); return; }
  if (location.hash === alvo || (alvo === '#/' && (location.hash === '' || location.hash === '#'))) { rota.value = r; void sincronizarRota(); return; }
  location.hash = alvo;
}

/**
 * Uma sincronização de cada vez: trocar de tela tem uma transição de ~170 ms, e um clique nesse intervalo (abrir um mapa logo ao
 * chegar na galeria) via a sessão antiga ainda aberta, desistia, e a transição então a fechava. Pedidos que chegam no meio
 * esperam e, depois, a rota mais recente é que vale.
 */
let sincronizando = false, rotaPendente = false;
async function sincronizarRota(): Promise<void> {
  if (sincronizando) { rotaPendente = true; return; }
  sincronizando = true;
  try { do { rotaPendente = false; await sincronizarRotaAtual(); } while (rotaPendente); } finally { sincronizando = false; }
}

async function sincronizarRotaAtual(): Promise<void> {
  const r = rota.value, s = servicos.value;
  if (!s) return;
  if (r.tipo === 'mapa') { await abrirMapa(r.id, r.comodo); return; }
  if (sessao.value) await comTransicao(fecharSessao);
  mapaAusente.value = null;
  await atualizarLista();
}

export async function atualizarLista(): Promise<void> {
  const s = servicos.value; if (!s) return;
  resumos.value = await s.repo.listar();
}

// ---------- Abrir e fechar mapas ----------
/** Troca entre Construir e Sessão: ao entrar na Sessão, a ferramenta volta a selecionar e a biblioteca fecha. */
export function alternarModo(): void {
  const s = sessao.value; if (!s || embutido) return;          // embutido: só Sessão
  const novo = modo.value === 'construir' ? 'sessao' : 'construir';
  batch(() => { modo.value = novo; if (novo === 'sessao' || s.ferramenta.value === 'regua') { s.ferramenta.value = 'selecionar'; s.biblioteca.value = false; } });
  tocar('selecionar'); avisar(novo === 'sessao' ? 'Modo Sessão' : 'Modo Construir', { duracao: 1200 });
}

let pararSugestoes: (() => void) | null = null;
/** Quem publica o mapa aberto para a janela do projetor. */
let publicador: Publicador | null = null, pararRegioes: (() => void) | null = null;
let mapaPublicadoId: string | null = null;

/** Cache em memória de até 3 sessões de edição abertas nas abas. */
export const cacheDeSessoes = new Map<string, SessaoDeEdicao>();

function adicionarAoCache(id: string, s: SessaoDeEdicao): void {
  if (cacheDeSessoes.has(id)) {
    cacheDeSessoes.delete(id);
    cacheDeSessoes.set(id, s);
    return;
  }
  while (cacheDeSessoes.size >= 3) {
    let candidatoId: string | null = null;
    for (const chave of cacheDeSessoes.keys()) {
      if (chave !== sessao.value?.doc.value.id && chave !== mapaNoProjetorId.value) {
        candidatoId = chave;
        break;
      }
    }
    if (!candidatoId) {
      for (const chave of cacheDeSessoes.keys()) {
        if (chave !== id) {
          candidatoId = chave;
          break;
        }
      }
    }
    if (candidatoId) {
      const despejado = cacheDeSessoes.get(candidatoId);
      cacheDeSessoes.delete(candidatoId);
      if (despejado) {
        void despejado.auto.descarregar().finally(() => despejado.fechar());
      }
    } else {
      break;
    }
  }
  cacheDeSessoes.set(id, s);
}

export function obterSessaoParaProjetor(): SessaoDeEdicao | null {
  const alvoId = mapaNoProjetorId.value ?? sessao.value?.doc.value.id ?? null;
  if (!alvoId) return null;
  if (sessao.value?.doc.value.id === alvoId) return sessao.value;
  return cacheDeSessoes.get(alvoId) ?? null;
}

export function sincronizarPublicador(): void {
  const s = servicos.value;
  const sessaoAlvo = obterSessaoParaProjetor();
  if (!sessaoAlvo) {
    publicador?.parar();
    publicador = null;
    mapaPublicadoId = null;
    return;
  }
  const alvoId = sessaoAlvo.doc.value.id;
  if (publicador && mapaPublicadoId === alvoId) {
    return;
  }
  publicador?.parar();
  publicador = null;
  mapaPublicadoId = alvoId;
  publicador = iniciarPublicacao(sessaoAlvo, async assetId => (await s?.repo.obterAsset(assetId))?.blob ?? null);
}

export async function projetarAba(id: string): Promise<void> {
  const s = servicos.value;
  mapaNoProjetorId.value = id;
  let sessaoAlvo = sessao.value?.doc.value.id === id ? sessao.value : cacheDeSessoes.get(id);
  if (!sessaoAlvo && s) {
    const mapa = await s.repo.obter(id);
    if (mapa) {
      sessaoAlvo = criarSessao(mapa, s.repo, { salvo: true });
      adicionarAoCache(id, sessaoAlvo);
    }
  }
  sincronizarPublicador();
  if (!projetorConectado.peek()) {
    abrirJanelaDoProjetor(id);
  }
}

export function fecharAbaComSessao(id: string): string | null {
  if (mapaNoProjetorId.value === id) {
    publicador?.parar();
    publicador = null;
    mapaPublicadoId = null;
    mapaNoProjetorId.value = null;
  }
  const s = cacheDeSessoes.get(id);
  if (s) {
    cacheDeSessoes.delete(id);
    void s.auto.descarregar().finally(() => s.fechar());
  }
  return fecharAba(id);
}

// Sincroniza publicador sempre que o alvo de projeção mudar
effect(() => {
  const projId = mapaNoProjetorId.value;
  void projId;
  sincronizarPublicador();
});

/** Um evento de cena (tremor, piscar…) no mapa do mestre e, junto, no projetor. */
export function dispararEventoDeCena(e: EventoDeCena): void { viewport.atual?.dispararEvento(e); publicador?.evento(e); }
export function relampagoNoProjetor(): void { publicador?.relampago(); }
export function abrirProjetor(): void {
  const ativo = sessao.value?.doc.value.id ?? null;
  if (mapaNoProjetorId.value === null && ativo) {
    mapaNoProjetorId.value = ativo;
  }
  const idParaAbrir = mapaNoProjetorId.value ?? ativo;
  if (idParaAbrir) {
    sincronizarPublicador();
    abrirJanelaDoProjetor(idParaAbrir);
  }
}

export function fecharSessao(): void {
  const atual = sessao.value; if (!atual) return;
  if (viewport.atual?.camera) {
    lembrarCameraDaAba(atual.doc.value.id, { ...viewport.atual.camera });
  }
  pararSugestoes?.(); pararSugestoes = null; pararRegioes?.(); pararRegioes = null;
  modo.value = 'construir'; vistaDeJogador.value = false;
  if (!cacheDeSessoes.has(atual.doc.value.id)) {
    void atual.auto.descarregar().finally(() => atual.fechar());
  }
  viewport.atual = null; sessao.value = null;
  sincronizarPublicador();
}

export async function abrirMapa(id: string, comodo?: string): Promise<void> {
  const s = servicos.value; if (!s) return;
  if (sessao.value?.doc.value.id === id) { focoPendente.value = comodo ?? null; focarNoComodo(); return; }
  carregando.value = true; mapaAusente.value = null;
  try {
    let nova = cacheDeSessoes.get(id);
    if (!nova) {
      const mapa = await s.repo.obter(id);
      if (!mapa) { await comTransicao(fecharSessao); mapaAusente.value = id; return; }
      nova = criarSessao(mapa, s.repo, { salvo: true });
    }
    await comTransicao(() => {
      if (sessao.value && viewport.atual?.camera) {
        lembrarCameraDaAba(sessao.value.doc.value.id, { ...viewport.atual.camera });
      }
      fecharSessao();
      adicionarAoCache(id, nova!);
      registrarAbaAberta(nova!.doc.value.id, nova!.doc.value.name);
      modo.value = embutido ? 'sessao' : 'construir'; vistaDeJogador.value = false;
      pararSugestoes = iniciarSugestoes(nova!, viewport);
      pararRegioes = iniciarRegioes(nova!, () => modo.peek() === 'sessao', {
        emitir: (tipo, dados) => { try { s.barramento?.emitir(tipo, dados); } catch (erro) { console.warn('Atlas: não consegui emitir', tipo, erro); } },
        pedirCena: ref => { pedirCena(s.barramento, ref); },
        avisar: texto => avisar(texto, { duracao: 4200 })
      });
      batch(() => {
        sessao.value = nova!;
        focoPendente.value = comodo ?? null;
        if (embutido) { nova!.ferramenta.value = 'selecionar'; nova!.biblioteca.value = false; }
      });
      sincronizarPublicador();
    });
    tocar('abrir');
    s.barramento?.emitir('atlas.cena-aberta', { mapa: refDoMapa(nova.doc.value) });
    const rascunho = await sessao.value?.auto.rascunhoParaRecuperar();
    if (rascunho && sessao.value) {
      const quando = new Date(rascunho.rascunho.salvoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      avisar(`Há alterações de ${quando} que não foram gravadas${rascunho.obsoleto ? ' (de uma versão anterior do mapa)' : ''}.`, {
        duracao: 15_000,
        acao: { rotulo: 'Recuperar', fazer: () => { if (sessao.value?.doc.value.id === id) { sessao.value.store.substituir(rascunho.rascunho.mapa, { base: sessao.value.doc.value }); tocar('refazer'); avisar('Rascunho recuperado.'); } } },
      });
    }
  } catch (erro) {
    avisar(`Não consegui abrir o mapa: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' });
    tocar('erro');
  } finally { carregando.value = false; }
}

/** Enquadra o cômodo do link profundo, quando já há viewport e mapa. */
export function focarNoComodo(): void {
  const id = focoPendente.value, v = viewport.atual, s = sessao.value;
  if (!id || !v || !s) return;
  focoPendente.value = null;
  const sala = s.doc.value.rooms[id] ?? Object.values(s.doc.value.rooms).find(r => r.name.toLowerCase() === id.toLowerCase());
  if (!sala) { avisar(`O cômodo “${id}” não existe neste mapa.`, { tipo: 'erro' }); return; }
  const t = s.doc.value.grid.size;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [y, fx, n] of sala.cells) { x0 = Math.min(x0, fx * t); x1 = Math.max(x1, (fx + n) * t); y0 = Math.min(y0, y * t); y1 = Math.max(y1, (y + 1) * t); }
  v.focarEm({ x0, y0, x1, y1 });
}

export interface DadosPrepararCena {
  mapa?: Ref | null;
  comodo?: string;
  clima?: string;
  fichas?: Ref[];
}

/** Prepara uma cena completa no Atlas a pedido da Mesa: abre o mapa, ajusta clima, foca cômodo e posiciona as fichas. */
export async function prepararCenaNoAtlas(
  s: Servicos,
  dados: DadosPrepararCena
): Promise<{ ok: boolean; motivo?: string }> {
  // 1. Abrir mapa ou focar cômodo
  if (dados.mapa) {
    let mapaId: string;
    let comodoId: string | undefined = dados.comodo;
    if (dados.mapa.tipo === 'comodo') {
      const i = dados.mapa.id.indexOf('/');
      if (i > 0) {
        mapaId = dados.mapa.id.slice(0, i);
        comodoId = dados.mapa.id.slice(i + 1);
      } else {
        mapaId = dados.mapa.id;
      }
    } else {
      mapaId = dados.mapa.id;
    }
    await abrirMapa(mapaId, comodoId);
  } else if (dados.comodo && sessao.value) {
    focoPendente.value = dados.comodo;
    focarNoComodo();
  }

  // 2. Aplicar clima
  if (dados.clima && sessao.value) {
    const temPreset = !!presetDeClima(dados.clima);
    const temCustom = !!sessao.value.doc.value.customClimates[dados.clima];
    if (temPreset || temCustom) {
      aplicarClima(dados.clima);
    }
  }

  // 3. Posicionar fichas
  if (Array.isArray(dados.fichas) && dados.fichas.length > 0 && sessao.value) {
    const sessaoAtual = sessao.value;
    const doc = sessaoAtual.store.documento;
    const t = doc.grid.size;

    let basePos: Ponto = [doc.bounds.width / 2, doc.bounds.height / 2];
    const comodoNome = dados.comodo;
    const targetRoom = comodoNome
      ? (doc.rooms[comodoNome] ?? Object.values(doc.rooms).find(r => r.name.toLowerCase() === comodoNome.toLowerCase()))
      : undefined;
    if (targetRoom && targetRoom.cells.length > 0) {
      let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
      for (const [y, fx, n] of targetRoom.cells) {
        rx0 = Math.min(rx0, fx * t);
        rx1 = Math.max(rx1, (fx + n) * t);
        ry0 = Math.min(ry0, y * t);
        ry1 = Math.max(ry1, (y + 1) * t);
      }
      basePos = [(rx0 + rx1) / 2, (ry0 + ry1) / 2];
    }

    const cid = doc.campanhaId ?? campanhaAtiva.value?.id;
    if (cid && s.campanhas && entidadesDaCampanha.peek().length === 0) {
      try {
        entidadesDaCampanha.value = await s.campanhas.listarEntidades(cid);
      } catch {
        /* ignora */
      }
    }

    let countPlaced = 0;
    for (const fichaRef of dados.fichas) {
      const jaNoMapa = pecaDaFicha(sessaoAtual.store.documento, fichaRef);
      if (jaNoMapa) continue;

      let entidade = entidadesDaCampanha.peek().find(e =>
        e.refs.some(r => mesmaRef(r, fichaRef)) || e.id === fichaRef.id
      );
      if (!entidade && s.campanhas && cid) {
        entidade = await s.campanhas.entidadeDaRef(cid, fichaRef).catch(() => undefined)
          ?? await s.campanhas.obterEntidade(fichaRef.id).catch(() => undefined);
      }

      const entFinal = entidade ?? {
        id: fichaRef.id,
        campanhaId: cid ?? '',
        tipo: 'personagem' as const,
        nome: fichaRef.id,
        refs: [fichaRef],
        tags: [],
        notas: '',
        criadaPor: fichaRef.app,
        criadaEm: Date.now(),
        atualizadaEm: Date.now(),
      };

      const pos: Ponto = [
        basePos[0] + (countPlaced % 3) * t,
        basePos[1] + Math.floor(countPlaced / 3) * t,
      ];
      adicionarPersonagem(sessaoAtual, entFinal, pos, s.repo);
      countPlaced++;
    }
  }

  return { ok: true };
}

// ---------- Mapas ----------
export async function criarMapaNovo(): Promise<void> {
  const s = servicos.value; if (!s) return;
  const mapa = criarMapa({ nome: 'Mapa sem nome', campanhaId: campanhaAtiva.value?.id ?? null });
  const gravado = await s.repo.salvar(mapa);
  await sincronizarMapaComCampanha(s, gravado);
  tocar('pop'); navegar({ tipo: 'mapa', id: gravado.id });
  setTimeout(() => document.getElementById('nome-do-mapa')?.focus(), 400);
}

export async function duplicarMapa(id: string): Promise<void> {
  const s = servicos.value; if (!s) return;
  const original = await s.repo.obter(id); if (!original) return;
  const copia = await s.repo.salvar(duplicarParaNovaSessao(original));
  await sincronizarMapaComCampanha(s, copia);
  await atualizarLista(); tocar('pop'); avisar(`“${copia.name}” criado.`);
}

export async function removerMapa(id: string): Promise<void> {
  const s = servicos.value; if (!s) return;
  const mapa = await s.repo.obter(id); if (!mapa) return;
  await s.repo.remover(id);
  fecharAba(id);
  const lugar = await desvincularMapa(s, mapa);
  await atualizarLista(); tocar('remover');
  avisar(`“${mapa.name}” removido.`, { duracao: 8000, acao: { rotulo: 'Desfazer', fazer: () => { void (async () => { await s.repo.restaurar(mapa); await revincularMapa(s, mapa, lugar); await atualizarLista(); tocar('refazer'); avisar('Mapa restaurado.'); })(); } } });
}

export async function renomearMapaAberto(nome: string): Promise<void> {
  const s = sessao.value; if (!s) return;
  const limpo = nome.trim().slice(0, 120);
  if (!limpo || limpo === s.doc.value.name) return;
  s.store.executar({ tipo: 'mapa.renomear', nome: limpo });
  atualizarNomeDaAba(s.doc.value.id, limpo);
}

// ---------- Gravar, exportar, importar ----------
export async function salvar(): Promise<void> {
  const atual = sessao.value, s = servicos.value; if (!atual || !s) return;
  try {
    const confirmado = await atual.auto.salvarAgora();
    tocar('salvar'); avisar('Mapa gravado.');
    await sincronizarMapaComCampanha(s, confirmado); await atualizarLista();
  } catch (erro) {
    tocar('erro');
    if (erro instanceof ErroDeConflito) {
      avisar('Este mapa foi alterado em outra aba. Gravar agora sobrescreve essa alteração.', { tipo: 'erro', duracao: 12_000, acao: { rotulo: 'Sobrescrever', fazer: () => { void atual.auto.salvarAgora({ forcar: true }).then(() => { tocar('salvar'); avisar('Mapa gravado.'); }); } } });
    } else avisar(`Não consegui gravar: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' });
  }
}

function baixar(nome: string, texto: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** `ids` vazio exporta tudo (cópia de segurança). Sem argumento, exporta o mapa aberto. */
export async function exportar(ids?: string[]): Promise<void> {
  const s = servicos.value; if (!s) return;
  const abertoId = sessao.value?.doc.value.id;
  const alvo = ids ?? (abertoId ? [abertoId] : undefined);
  if (abertoId && alvo?.includes(abertoId) && sessao.value?.sujo.value) await salvar();
  const pacote = await exportarBackup(s.repo, alvo ? { ids: alvo } : {});
  const nome = alvo?.length === 1 ? nomeDoArquivo((await s.repo.obter(alvo[0]!))?.name ?? 'mapa') : nomeDoArquivo('atlas-backup');
  baixar(nome, JSON.stringify(pacote));
  tocar('salvar'); avisar(alvo?.length === 1 ? 'Mapa exportado.' : `${pacote.mapas.length} mapa(s) exportado(s).`);
}

export function resumoDaImportacao(r: RelatorioImportacao): string {
  const partes = [`${r.importados.length} mapa(s) importado(s)`];
  if (r.assets) partes.push(`${r.assets} imagem(ns)`);
  if (r.pulados.length) partes.push(`${r.pulados.length} pulado(s)`);
  if (r.erros.length) partes.push(`${r.erros.length} com erro`);
  return partes.join(' · ');
}

export async function importarArquivo(arquivo: File): Promise<void> {
  const s = servicos.value; if (!s) return;
  try {
    const rel = await importarBackup(s.repo, lerPacote(await arquivo.text()), { conflito: 'copia' });
    await atualizarLista(); tocar(rel.erros.length && !rel.importados.length ? 'erro' : 'pop');
    for (const m of rel.importados) if (s.campanhas) { const g = await s.repo.obter(m.id); if (g) await sincronizarMapaComCampanha(s, g); }
    avisar(resumoDaImportacao(rel), { tipo: rel.erros.length && !rel.importados.length ? 'erro' : 'info', duracao: 6000 });
    for (const e of rel.erros.slice(0, 2)) avisar(`${e.nome ?? 'Item'}: ${e.motivo}`, { tipo: 'erro', duracao: 9000 });
  } catch (erro) {
    tocar('erro'); avisar(erro instanceof ErroDeBackup ? erro.message : `Não consegui importar: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' });
  }
}

export function escolherArquivoParaImportar(): void {
  const entrada = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  entrada.onchange = () => { const f = entrada.files?.[0]; if (f) void importarArquivo(f); };
  entrada.click();
}

// ---------- Edição ----------
function efeitoDeColocar(texto: string, mundo: Ponto): void {
  const v = viewport.atual; if (!v) return;
  const [x, y] = v.clientDe(mundo), r = ponto(x, y);
  flutuar(r, texto, { cor: 'var(--acento)', tamanho: 15 }); faiscar(r, { quantidade: 8, alcance: 26, cor: 'var(--acento)' });
}

/** Uma ferramenta de construção pôs algo: som e um efeito no lugar. */
export function aoColocar(rotulo: string, mundo: Ponto): void { tocar('pop'); efeitoDeColocar(`+ ${rotulo.toLowerCase()}`, mundo); }

export function adicionarEm(colecao: ColecaoLivre, mundo: Ponto): void {
  const s = sessao.value; if (!s) return;
  const doc = s.doc.value;
  const item = colecao === 'lights' ? novaLuz(mundo) : colecao === 'props' ? novoObjeto(mundo) : colecao === 'tokens' ? novaPeca(mundo, `Peça ${Object.keys(doc.tokens).length + 1}`) : colecao === 'regions' ? novaRegiao(mundo) : null;
  if (!item) return;
  try { s.store.executar({ tipo: 'item.adicionar', colecao, item: item as never }, { rotulo: `Adicionar ${SINGULAR[colecao]}` }); } catch (erro) { avisar(String(erro instanceof Error ? erro.message : erro), { tipo: 'erro' }); tocar('erro'); return; }
  s.selecao.value = [{ colecao, id: item.id }];
  tocar('pop'); efeitoDeColocar(`+ ${SINGULAR[colecao]}`, mundo);
}

/** Onde "adicionar aqui" cai: sob o ponteiro, ou no centro da vista. */
export function pontoDeAdicionar(base?: Ponto): Ponto {
  const v = viewport.atual, s = sessao.value;
  const p = base ?? v?.ponteiro() ?? v?.centro() ?? [0, 0] as Ponto, g = s?.doc.value.grid;
  if (!g || !g.visible) return p;
  const passo = g.size / 2;
  return [Math.round((p[0] - g.offset[0]) / passo) * passo + g.offset[0], Math.round((p[1] - g.offset[1]) / passo) * passo + g.offset[1]];
}

/** Troca o clima do mapa aberto: uma entrada de histórico, "Clima: <nome>". Serve ao seletor, à paleta e aos atalhos. */
export function aplicarClima(id: string): void {
  const s = sessao.value; if (!s) return;
  const nome = presetDeClima(id)?.nome ?? s.doc.value.customClimates[id]?.name ?? id;
  try { s.store.executar({ tipo: 'clima.predefinir', id }, { rotulo: `Clima: ${nome}` }); } catch (erro) { avisar(String(erro instanceof Error ? erro.message : erro), { tipo: 'erro' }); tocar('erro'); return; }
  tocar('selecionar'); avisar(`Clima: ${nome}`, { duracao: 1400 });
}

export function selecionarTudo(): void { const s = sessao.value; if (s) { s.selecao.value = todosOsAlvos(s.doc.value); tocar('selecionar'); } }

/** O comando que remove um item selecionado, qualquer que seja o tipo. */
function comandoDeRemocao(m: MapaAtlas, a: Alvo): Comando | null {
  if (a.colecao === 'rooms') return { tipo: 'comodo.remover', id: a.id };
  if (a.colecao === 'openings') return { tipo: 'abertura.remover', id: a.id };
  if (a.colecao === 'walls') return m.walls[a.id]?.source ? null : { tipo: 'parede.remover', id: a.id };
  return { tipo: 'item.remover', colecao: a.colecao, id: a.id };
}

export function removerSelecao(): void {
  const s = sessao.value; if (!s || !s.selecao.value.length) return;
  const alvos = [...s.selecao.value], doc = s.doc.value;
  const aRemover = alvos.filter(a => comandoDeRemocao(doc, a)), fixas = alvos.length - aRemover.length;
  if (!aRemover.length) { avisar('Paredes de cômodo seguem o cômodo: desanexe a parede para removê-la, ou mude o cômodo.'); tocar('erro'); return; }
  const centros = aRemover.map(a => { const c = caixaDe(doc, a); return c ? ([(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2] as Ponto) : null; });
  const v = viewport.atual, un = aRemover.length === 1;
  const rotulo = un ? `Remover ${SINGULAR[aRemover[0]!.colecao]}` : `Remover ${aRemover.length} itens`;
  try { s.store.transacao(rotulo, g => { for (const a of aRemover) { if (!existeAinda(s.store.documento, a)) continue; const c = comandoDeRemocao(s.store.documento, a); if (c) g.aplicar(c); } }); } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' }); tocar('erro'); return; }
  s.selecao.value = [];
  tocar('remover');
  for (const c of centros) if (c && v) { const [x, y] = v.clientDe(c); faiscar(ponto(x, y), { quantidade: 7, alcance: 28, cor: '#9aa0ad' }); }
  const nome = SINGULAR[aRemover[0]!.colecao];
  avisar(`${un ? `${nome[0]!.toUpperCase()}${nome.slice(1)} removid${nome.endsWith('a') ? 'a' : 'o'}.` : `${aRemover.length} itens removidos.`}${fixas ? ` ${fixas} parede(s) de cômodo ficaram.` : ''}`, { acao: { rotulo: 'Desfazer', fazer: desfazer } });
}

/** Remover um cômodo pode levar objetos e paredes junto: o que já sumiu não se remove de novo. */
const existeAinda = (m: MapaAtlas, a: Alvo): boolean => ((m[a.colecao] as unknown) as Record<string, unknown>)[a.id] !== undefined;

export function duplicarSelecao(): void {
  const s = sessao.value; if (!s) return;
  const { comandos, alvos } = copiasDe(s.doc.value, s.selecao.value, [s.doc.value.grid.size / 2, s.doc.value.grid.size / 2]);
  if (!comandos.length) { avisar('Só objetos, luzes, peças e regiões se duplicam.'); return; }
  s.store.transacao(comandos.length === 1 ? 'Duplicar' : `Duplicar ${comandos.length} itens`, g => { for (const c of comandos) g.aplicar(c as never); });
  s.selecao.value = alvos; tocar('pop');
  avisar(alvos.length === 1 ? 'Duplicado.' : `${alvos.length} itens duplicados.`);
}

export function alternarLuzes(): void {
  const s = sessao.value; if (!s) return;
  const luzes = s.selecao.value.filter(a => a.colecao === 'lights');
  if (!luzes.length) { avisar('Selecione uma luz primeiro.'); return; }
  const doc = s.doc.value, ligar = luzes.some(a => !doc.lights[a.id]!.on);
  s.store.transacao(ligar ? 'Acender' : 'Apagar', g => { for (const a of luzes) g.aplicar({ tipo: 'item.atualizar', colecao: 'lights', id: a.id, patch: { on: ligar } }); });
  tocar('pop'); avisar(ligar ? 'Luz acesa.' : 'Luz apagada.');
}

/** Muda a camada dos objetos selecionados (um tapete atrás da cama, uma xícara sobre a mesa). */
export function camadaDaSelecao(modo: 'frente' | 'tras' | 'subir' | 'descer'): void {
  const s = sessao.value; if (!s) return;
  const ids = s.selecao.value.filter(a => a.colecao === 'props').map(a => a.id);
  if (!ids.length) { avisar('Selecione um objeto primeiro.'); return; }
  const rotulo = { frente: 'Trazer para a frente', tras: 'Enviar para trás', subir: 'Subir uma camada', descer: 'Descer uma camada' }[modo];
  try { s.store.executar({ tipo: 'objeto.camada', ids, modo }, { rotulo }); } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro)); }
}

export function moverSelecao(dx: number, dy: number): void {
  const s = sessao.value; if (!s || !s.selecao.value.length) return;
  if (modo.value === 'sessao') {
    // Na sessão as setas levam as peças uma célula (sem atravessar paredes); o resto do mapa não anda.
    const pecas = s.selecao.value.filter(a => a.colecao === 'tokens'); if (!pecas.length) return;
    const g = s.doc.value.grid.size, passo = [Math.sign(dx) * g, Math.sign(dy) * g] as const;
    try {
      s.store.transacao(pecas.length > 1 ? 'Mover peças' : 'Mover peça', gesto => {
        for (const a of pecas) { const t = s.doc.value.tokens[a.id]; if (t) gesto.aplicar({ tipo: 'peca.mover', id: a.id, para: [t.position[0] + passo[0], t.position[1] + passo[1]] }); }
      });
    } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro)); }
    return;
  }
  const alvos = s.selecao.value.filter(ehMovel); if (!alvos.length) return;
  s.store.executar({ tipo: 'selecao.mover', alvos, delta: [dx, dy] }, { rotulo: 'Mover' });
}

/** Alguma peça selecionada carrega uma lanterna (uma luz em cone)? */
export function comLanterna(): boolean {
  const s = sessao.value; if (!s) return false;
  const m = s.doc.value;
  return s.selecao.value.some(a => { const l = a.colecao === 'tokens' ? m.tokens[a.id]?.lightId : null; return !!(l && m.lights[l]?.cone); });
}

/** Gira em `graus` o facho da lanterna das peças selecionadas, sem mover a peça (Q e E na Sessão). */
export function virarLanterna(graus: number): void {
  const s = sessao.value; if (!s) return;
  const m = s.doc.value, alvos = s.selecao.value.filter(a => a.colecao === 'tokens' && m.tokens[a.id]?.lightId && m.lights[m.tokens[a.id]!.lightId!]?.cone);
  if (!alvos.length) { avisar('Selecione uma peça com lanterna.'); return; }
  s.store.transacao('Virar a lanterna', g => { for (const a of alvos) g.aplicar({ tipo: 'peca.virar', id: a.id, direcao: m.lights[m.tokens[a.id]!.lightId!]!.cone!.direction + (graus * Math.PI) / 180 }); });
}

// ---------- Portas na sessão ----------
const ROTULO_DA_ABERTURA: Record<string, string> = { door: 'Porta', window: 'Janela', arch: 'Arco', secret: 'Porta secreta' };
/** Avisa os outros aplicativos da mesa que algo foi mostrado aos jogadores. Falhar aqui nunca atrapalha a sessão. */
function emitirRevelado(id: string, tipo = 'abertura'): void {
  const s = sessao.value, b = servicos.value?.barramento; if (!s || !b) return;
  const m = s.doc.value, nome = tipo === 'abertura' ? ROTULO_DA_ABERTURA[m.openings[id]?.kind ?? 'door'] : tipo === 'objeto' ? (m.props[id]?.interaction?.kind === 'clue' ? 'Pista' : 'Objeto') : undefined;
  // `nome` é um acréscimo opcional ao fato (o catálogo só exige `mapa` e `alvo`): é o que o registro da sessão da Mesa mostra.
  try { b.emitir('atlas.revelado', { mapa: refDoMapa(m), alvo: criarRef('atlas', tipo, `${m.id}/${id}`), ...(nome ? { nome } : {}) }); } catch (erro) { console.warn('Atlas: não consegui emitir atlas.revelado', erro); }
}

/** Abre ou fecha uma porta na sessão (e soma ao explorado o que ela passa a mostrar). Trancada não abre. Uma secreta que se abre é revelada junto. */
export function alternarPorta(id: string): void {
  const s = sessao.value; if (!s) return;
  const o = s.doc.value.openings[id]; if (!o || (o.kind !== 'door' && o.kind !== 'secret')) return;
  // O `som` da abertura (um efeito do Jukebox) toca no lugar do sintetizado, que fica de reserva (`tocarSomEscolhido`).
  if (o.state === 'locked') { avisar('Trancada', { duracao: 1600 }); tocar('trancada'); return; }
  const abrir = o.state !== 'open', revelarJunto = abrir && secretaOculta(s.doc.value, o);
  try {
    s.store.transacao(abrir ? 'Abrir a porta' : 'Fechar a porta', g => {
      g.aplicar({ tipo: 'abertura.atualizar', id, patch: { state: abrir ? 'open' : 'closed' } });
      if (revelarJunto) g.aplicar({ tipo: 'sessao.revelar', ids: [id] });
      g.aplicar({ tipo: 'sessao.explorar' });
    });
  } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' }); tocar('erro'); return; }
  void tocarSomEscolhido(servicos.peek()?.barramento, o.som, () => tocar(abrir ? 'porta-abrir' : 'porta-fechar'));
  if (revelarJunto) emitirRevelado(id);
}

/** Tranca ou destranca uma porta (uma porta aberta se fecha ao trancar). */
export function trancarPorta(id: string): void {
  const s = sessao.value; if (!s) return;
  const o = s.doc.value.openings[id]; if (!o || (o.kind !== 'door' && o.kind !== 'secret')) return;
  const trancar = o.state !== 'locked';
  try { s.store.transacao(trancar ? 'Trancar' : 'Destrancar', g => { g.aplicar({ tipo: 'abertura.atualizar', id, patch: { state: trancar ? 'locked' : 'closed' } }); g.aplicar({ tipo: 'sessao.explorar' }); }); } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' }); tocar('erro'); return; }
  tocar('trancada');
}

/** Mostra uma porta secreta aos jogadores: daí em diante ela é uma porta comum na vista deles. */
export function revelarPorta(id: string): void {
  const s = sessao.value; if (!s) return;
  const o = s.doc.value.openings[id]; if (!o || !secretaOculta(s.doc.value, o)) return;
  try { s.store.transacao('Revelar aos jogadores', g => { g.aplicar({ tipo: 'sessao.revelar', ids: [id] }); g.aplicar({ tipo: 'sessao.explorar' }); }); } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' }); tocar('erro'); return; }
  tocar('pop'); avisar('Porta revelada aos jogadores.', { duracao: 1800 }); emitirRevelado(id);
}

// ---------- Inspeção de pistas ----------
export function enviarEstadoDaInspecao(vista: Vista, lanterna: { x: number; y: number } | null): void { if (mostrandoAosJogadores.peek()) publicador?.inspecaoEstado(vista, lanterna); }
/** Mostra a inspeção aos jogadores: o projetor abre o mesmo documento, e a pista entra nos revelados (com `atlas.revelado`). */
export function mostrarInspecaoAosJogadores(vista: Vista, lanterna: { x: number; y: number } | null): void {
  const d = inspecao.value, s = sessao.value; if (!d || !s) return;
  publicador?.inspecao({ nome: d.pista.name, normal: d.blobNormal, uv: d.blobUv });
  publicador?.inspecaoEstado(vista, lanterna);
  mostrandoAosJogadores.value = true;
  if (d.objetoId && s.doc.value.props[d.objetoId] && !s.doc.value.session.revealed.includes(d.objetoId)) {
    try { s.store.executar({ tipo: 'sessao.revelar', ids: [d.objetoId] }, { rotulo: 'Revelar a pista' }); emitirRevelado(d.objetoId, 'objeto'); } catch (erro) { console.warn('Atlas: não consegui revelar a pista', erro); }
  }
}
export function pararDeMostrarInspecao(): void { if (mostrandoAosJogadores.peek()) publicador?.inspecao(null); mostrandoAosJogadores.value = false; }
export function fecharInspecaoDoMestre(): void { pararDeMostrarInspecao(); fecharInspecao(); }

/** Usa um objeto interativo (interruptor ou gaveta) na sessão; é UMA entrada de histórico. */
export function usarObjeto(id: string): void {
  const s = sessao.value; if (!s) return;
  const o = s.doc.value.props[id]; if (!o?.interaction) return;
  if (o.interaction.kind === 'clue') { void abrirInspecao(o.interaction.clue, o.id); return; }
  // O `sound` do objeto (um efeito do Jukebox) também toca no lugar do sintetizado.
  try { s.store.executar({ tipo: 'interagir', id }, { rotulo: ROTULO_DA_INTERACAO[o.interaction.kind] }); } catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' }); tocar('erro'); return; }
  const dele = o.interaction;
  void tocarSomEscolhido(servicos.peek()?.barramento, dele.sound, () => tocar(dele.kind === 'switch' ? 'interruptor' : 'gaveta'));
}

/** Enter com uma peça selecionada: interage com a porta mais perto (a que está à frente dela, se houver duas). */
export function interagirComPerto(): void {
  const s = sessao.value; if (!s) return;
  const m = s.doc.value, peca = s.selecao.value.map(a => (a.colecao === 'tokens' ? m.tokens[a.id] : undefined)).find(Boolean);
  if (!peca) { avisar('Selecione uma peça para interagir.', { duracao: 1600 }); return; }
  const alvo = interagiveisPerto(m, peca)[0];
  if (!alvo) { avisar('Não há nada ao alcance desta peça.', { duracao: 1600 }); return; }
  if (alvo.tipo === 'objeto') usarObjeto(alvo.id); else alternarPorta(alvo.id);
}

export function centralizarNaSelecao(): void {
  const s = sessao.value, v = viewport.atual; if (!s || !v) return;
  const caixa = caixaDaSelecao(s.doc.value, s.selecao.value);
  if (!caixa) { avisar('Nada selecionado.'); return; }
  v.focarEm(caixa);
}

export function desfazer(): void {
  const s = sessao.value; if (!s) return;
  if (!s.podeDesfazer.value && !s.store.emGesto) { avisar('Nada para desfazer.'); return; }
  const rotulo = s.rotuloDesfazer.value;
  s.store.desfazer(); tocar('desfazer');
  if (rotulo) avisar(`Desfeito: ${rotulo}`, { ...(s.podeRefazer.value ? { acao: { rotulo: 'Refazer', fazer: refazer } } : {}), duracao: 3200 });
}
export function refazer(): void {
  const s = sessao.value; if (!s) return;
  if (!s.podeRefazer.value) { avisar('Nada para refazer.'); return; }
  const rotulo = s.rotuloRefazer.value;
  s.store.refazer(); tocar('refazer');
  avisar(`Refeito: ${rotulo}`, { duracao: 2200 });
}

export const NOMES_COLECAO = { singular: SINGULAR, plural: PLURAL };

// Uma rolagem da Ficha: o resultado flutua sobre a peça ligada (no mapa e no projetor). Quem não tem peça no mapa vira um aviso discreto.
aoRolar(r => {
  const s = sessao.value, v = viewport.atual; if (!s) return;
  const peca = pecaDaFicha(s.doc.value, r.ficha);
  if (!peca || !v) { avisar(`Rolagem: ${r.titulo} ${r.total}`, { duracao: 2200 }); return; }
  const [x, y] = v.clientDe([peca.position[0], peca.position[1] - (peca.size * s.doc.value.grid.size) / 2]);
  flutuarRolagem(pontoDaTela(x, y), r.total, r.titulo, r.tom, getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || undefined);
  publicador?.rolagem(peca.id, r.titulo, r.total, r.tom);
});

// PV e PD novos vindos da Ficha: as peças ligadas refazem os pips (só elas).
effect(() => { void recursosDasFichas.value; viewport.atual?.redesenharPecas(); });

// Mantém o nome da aba sincronizado com as mudanças do documento (ex.: desfazer/refazer).
effect(() => {
  const s = sessao.value;
  if (s) {
    atualizarNomeDaAba(s.doc.value.id, s.doc.value.name);
  }
});

// Abrir o mapa na sessão pede ao Jukebox a cena do mapa (uma vez por mapa e por entrada na sessão).
let mapaDoSom: string | null = null;
effect(() => {
  const emSessao = modo.value === 'sessao', doc = sessao.value?.doc.peek() ?? null;
  if (!emSessao || !doc) { mapaDoSom = null; return; }
  if (mapaDoSom !== doc.id) { mapaDoSom = doc.id; pedirSomDoMapa(doc, servicos.peek()?.barramento); }
});

// Trocar de clima pede ao Jukebox a cena sonora daquele clima (se o mapa tiver uma). Abrir outro mapa não pede nada.
let mapaVisto: MapaAtlas | null = null;
effect(() => {
  const doc = sessao.value?.doc.value ?? null;
  if (mapaVisto && doc) pedirSomDoClima(mapaVisto, doc, servicos.peek()?.barramento);
  mapaVisto = doc;
});
