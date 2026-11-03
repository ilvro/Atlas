import { batch, effect, signal } from '@preact/signals';
import { exportarBackup, importarBackup, lerPacote, nomeDoArquivo, type RelatorioImportacao } from '../data/backup.ts';
import { ErroDeBackup } from '../data/backup.ts';
import { ErroDeConflito, type ResumoMapa } from '../data/repositorio.ts';
import { duplicarParaNovaSessao, criarMapa, type MapaAtlas, type Ponto } from '../domain/mapa.ts';
import { copiasDe, novaLuz, novaPeca, novaRegiao, novoObjeto } from '../domain/fabrica.ts';
import { presetDeClima } from '../domain/presets.ts';
import { faiscar, flutuar, ponto } from '../fx/fx.ts';
import { tocar } from '../fx/som.ts';
import { todosOsAlvos, caixaDe, caixaDaSelecao, ehMovel, type Alvo, type ColecaoSelecionavel } from '../render/selecao.ts';
import type { Viewport } from '../render/viewport.ts';
import type { ColecaoLivre, Comando } from '../state/comandos.ts';
import { campanhaAtiva, carregarCampanhas, desvincularMapa, refDoMapa, revincularMapa, sincronizarMapaComCampanha } from './campanha.ts';
import { pedirSomDoClima } from './audio-do-clima.ts';
import { iniciarSugestoes } from './sugestoes.ts';
import { lerRota, formatarRota, type Rota } from './rotas.ts';
import { iniciarServicos, type Servicos } from './servicos.ts';
import { criarSessao, type SessaoDeEdicao } from './sessao.ts';
import { iniciarTema } from './tema.ts';
import { avisar } from './toasts.ts';
import { comTransicao } from './transicao.ts';

// ---------- Estado global da interface ----------
export const servicos = signal<Servicos | null>(null);
export const erroInicial = signal<string | null>(null);
export const rota = signal<Rota>(lerRota(location.hash));
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
let acabamentoInicial = true; try { acabamentoInicial = localStorage.getItem(CHAVE_ACABAMENTO) !== '0'; } catch { /* padrão ligado */ }
export const acabamentoLigado = signal(acabamentoInicial);
export function definirAcabamentoLigado(v: boolean): void { acabamentoLigado.value = v; try { localStorage.setItem(CHAVE_ACABAMENTO, v ? '1' : '0'); } catch { /* ignora */ } }

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
    await atualizarLista();
    s.barramento?.atender('atlas.focar', dados => {
      const ref = (dados as { ref: { tipo: string; id: string } }).ref;
      if (ref.tipo === 'mapa') { navegar({ tipo: 'mapa', id: ref.id }); return { ok: true }; }
      if (ref.tipo === 'comodo') { const i = ref.id.indexOf('/'); if (i > 0) { navegar({ tipo: 'mapa', id: ref.id.slice(0, i), comodo: ref.id.slice(i + 1) }); return { ok: true }; } }
      return { ok: false, motivo: `O Atlas não abre ${ref.tipo}.` };
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
let pararSugestoes: (() => void) | null = null;
export function fecharSessao(): void {
  const atual = sessao.value; if (!atual) return;
  pararSugestoes?.(); pararSugestoes = null;
  void atual.auto.descarregar().finally(() => atual.fechar());
  viewport.atual = null; sessao.value = null;
}

async function abrirMapa(id: string, comodo?: string): Promise<void> {
  const s = servicos.value; if (!s) return;
  if (sessao.value?.doc.value.id === id) { focoPendente.value = comodo ?? null; focarNoComodo(); return; }
  carregando.value = true; mapaAusente.value = null;
  try {
    const mapa = await s.repo.obter(id);
    if (!mapa) { await comTransicao(fecharSessao); mapaAusente.value = id; return; }
    await comTransicao(() => {
      fecharSessao();
      const nova = criarSessao(mapa, s.repo, { salvo: true });
      pararSugestoes = iniciarSugestoes(nova, viewport);
      batch(() => { sessao.value = nova; focoPendente.value = comodo ?? null; });
    });
    tocar('abrir');
    s.barramento?.emitir('atlas.cena-aberta', { mapa: refDoMapa(mapa) });
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
  const sala = s.doc.value.rooms[id];
  if (!sala) { avisar(`O cômodo “${id}” não existe neste mapa.`, { tipo: 'erro' }); return; }
  const t = s.doc.value.grid.size;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [y, fx, n] of sala.cells) { x0 = Math.min(x0, fx * t); x1 = Math.max(x1, (fx + n) * t); y0 = Math.min(y0, y * t); y1 = Math.max(y1, (y + 1) * t); }
  v.focarEm({ x0, y0, x1, y1 });
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
  const lugar = await desvincularMapa(s, mapa);
  await atualizarLista(); tocar('remover');
  avisar(`“${mapa.name}” removido.`, { duracao: 8000, acao: { rotulo: 'Desfazer', fazer: () => { void (async () => { await s.repo.restaurar(mapa); await revincularMapa(s, mapa, lugar); await atualizarLista(); tocar('refazer'); avisar('Mapa restaurado.'); })(); } } });
}

export async function renomearMapaAberto(nome: string): Promise<void> {
  const s = sessao.value; if (!s) return;
  const limpo = nome.trim().slice(0, 120);
  if (!limpo || limpo === s.doc.value.name) return;
  s.store.executar({ tipo: 'mapa.renomear', nome: limpo });
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
  if (!g) return p;
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

export function moverSelecao(dx: number, dy: number): void {
  const s = sessao.value; if (!s || !s.selecao.value.length) return;
  const alvos = s.selecao.value.filter(ehMovel); if (!alvos.length) return;
  s.store.executar({ tipo: 'selecao.mover', alvos, delta: [dx, dy] }, { rotulo: 'Mover' });
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

// Trocar de clima pede ao Jukebox a cena sonora daquele clima (se o mapa tiver uma). Abrir outro mapa não pede nada.
let mapaVisto: MapaAtlas | null = null;
effect(() => {
  const doc = sessao.value?.doc.value ?? null;
  if (mapaVisto && doc) pedirSomDoClima(mapaVisto, doc, servicos.peek()?.barramento);
  mapaVisto = doc;
});
