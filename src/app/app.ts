import { batch, signal } from '@preact/signals';
import { exportarBackup, importarBackup, lerPacote, nomeDoArquivo, type RelatorioImportacao } from '../data/backup.ts';
import { ErroDeBackup } from '../data/backup.ts';
import { ErroDeConflito, type ResumoMapa } from '../data/repositorio.ts';
import { duplicarParaNovaSessao, criarMapa, type Ponto } from '../domain/mapa.ts';
import { novaLuz, novaPeca, novaRegiao, novoObjeto, novoIdEntidade } from '../domain/fabrica.ts';
import { faiscar, flutuar, ponto } from '../fx/fx.ts';
import { tocar } from '../fx/som.ts';
import { todosOsAlvos, caixaDe, caixaDaSelecao, type Alvo } from '../render/selecao.ts';
import type { Viewport } from '../render/viewport.ts';
import type { ColecaoLivre } from '../state/comandos.ts';
import { campanhaAtiva, carregarCampanhas, desvincularMapa, refDoMapa, revincularMapa, sincronizarMapaComCampanha } from './campanha.ts';
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

const SINGULAR: Record<ColecaoLivre, string> = { lights: 'luz', props: 'objeto', tokens: 'peça', regions: 'região', presence: 'presença' };
const PLURAL: Record<ColecaoLivre, string> = { lights: 'luzes', props: 'objetos', tokens: 'peças', regions: 'regiões', presence: 'presenças' };

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

async function sincronizarRota(): Promise<void> {
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
export function fecharSessao(): void {
  const atual = sessao.value; if (!atual) return;
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
function ancora(colecao: ColecaoLivre, mundo: Ponto): void {
  const v = viewport.atual; if (!v) return;
  const [x, y] = v.clientDe(mundo), r = ponto(x, y);
  flutuar(r, `+ ${SINGULAR[colecao]}`, { cor: 'var(--acento)', tamanho: 15 }); faiscar(r, { quantidade: 8, alcance: 26, cor: 'var(--acento)' });
}

export function adicionarEm(colecao: ColecaoLivre, mundo: Ponto): void {
  const s = sessao.value; if (!s) return;
  const doc = s.doc.value;
  const item = colecao === 'lights' ? novaLuz(mundo) : colecao === 'props' ? novoObjeto(mundo) : colecao === 'tokens' ? novaPeca(mundo, `Peça ${Object.keys(doc.tokens).length + 1}`) : colecao === 'regions' ? novaRegiao(mundo) : null;
  if (!item) return;
  try { s.store.executar({ tipo: 'item.adicionar', colecao, item: item as never }, { rotulo: `Adicionar ${SINGULAR[colecao]}` }); } catch (erro) { avisar(String(erro instanceof Error ? erro.message : erro), { tipo: 'erro' }); tocar('erro'); return; }
  s.selecao.value = [{ colecao, id: item.id }];
  tocar('pop'); ancora(colecao, mundo);
}

/** Onde "adicionar aqui" cai: sob o ponteiro, ou no centro da vista. */
export function pontoDeAdicionar(base?: Ponto): Ponto {
  const v = viewport.atual, s = sessao.value;
  const p = base ?? v?.ponteiro() ?? v?.centro() ?? [0, 0] as Ponto, g = s?.doc.value.grid;
  if (!g) return p;
  const passo = g.size / 2;
  return [Math.round((p[0] - g.offset[0]) / passo) * passo + g.offset[0], Math.round((p[1] - g.offset[1]) / passo) * passo + g.offset[1]];
}

export function selecionarTudo(): void { const s = sessao.value; if (s) { s.selecao.value = todosOsAlvos(s.doc.value); tocar('selecionar'); } }

export function removerSelecao(): void {
  const s = sessao.value; if (!s || !s.selecao.value.length) return;
  const alvos = [...s.selecao.value], doc = s.doc.value;
  const centros = alvos.map(a => { const c = caixaDe(doc, a); return c ? ([(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2] as Ponto) : null; });
  const v = viewport.atual;
  const rotulo = alvos.length === 1 ? `Remover ${SINGULAR[alvos[0]!.colecao]}` : `Remover ${alvos.length} itens`;
  s.store.transacao(rotulo, g => { for (const a of alvos) g.aplicar({ tipo: 'item.remover', colecao: a.colecao, id: a.id }); });
  s.selecao.value = [];
  tocar('remover');
  for (const c of centros) if (c && v) { const [x, y] = v.clientDe(c); faiscar(ponto(x, y), { quantidade: 7, alcance: 28, cor: '#9aa0ad' }); }
  avisar(alvos.length === 1 ? `${SINGULAR[alvos[0]!.colecao][0]!.toUpperCase()}${SINGULAR[alvos[0]!.colecao].slice(1)} removida.` : `${alvos.length} itens removidos.`, { acao: { rotulo: 'Desfazer', fazer: desfazer } });
}

export function duplicarSelecao(): void {
  const s = sessao.value; if (!s || !s.selecao.value.length) return;
  const doc = s.doc.value, d = doc.grid.size / 2, novos: Alvo[] = [];
  s.store.transacao(s.selecao.value.length === 1 ? 'Duplicar' : `Duplicar ${s.selecao.value.length} itens`, g => {
    for (const a of s.selecao.value) {
      const original = ((doc[a.colecao] as unknown) as Record<string, Record<string, unknown>>)[a.id]; if (!original) continue;
      const copia = structuredClone(original) as Record<string, unknown> & { id: string };
      copia.id = novoIdEntidade(a.colecao[0]);
      if (a.colecao === 'regions') copia.polygon = (copia.polygon as Ponto[]).map(([x, y]) => [x + d, y + d]);
      else copia.position = [(copia.position as Ponto)[0] + d, (copia.position as Ponto)[1] + d];
      if (a.colecao === 'tokens') { copia.name = `${String(copia.name)} (cópia)`; copia.lightId = null; }
      if (a.colecao === 'lights') copia.ownerId = null;
      g.aplicar({ tipo: 'item.adicionar', colecao: a.colecao, item: copia });
      novos.push({ colecao: a.colecao, id: copia.id });
    }
  });
  s.selecao.value = novos; tocar('pop');
  avisar(novos.length === 1 ? 'Duplicado.' : `${novos.length} itens duplicados.`);
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
  s.store.executar({ tipo: 'selecao.mover', alvos: s.selecao.value as never, delta: [dx, dy] }, { rotulo: 'Mover' });
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
