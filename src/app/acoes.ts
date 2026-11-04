import { signal } from '@preact/signals';
import { combina } from './atalhos.ts';
import { filtrar } from './busca.ts';
import * as app from './app.ts';
import { avisar } from './toasts.ts';
import { trocarTema } from './tema.ts';
import { definirFx, fxPreferido } from '../fx/fx.ts';
import { definirSom, somPreferido, tocar } from '../fx/som.ts';
import { ROTULO_DA_FERRAMENTA, type Ferramenta } from '../render/pincel.ts';
import { colecaoDaFerramenta } from '../render/viewport.ts';
import { campanhaAtiva } from './campanha.ts';
import { PRESETS_DE_CLIMA } from '../domain/presets.ts';
import { FERRAMENTAS_DA_SESSAO, modo, vistaDeJogador } from './modo.ts';
import { aceitarSugestao, definirSugestoesLigadas, dispensarSugestao, outraSugestao, sugestao, sugestoesLigadas } from './sugestoes.ts';
import type { Alvo } from '../render/selecao.ts';
import type { Ponto } from '../domain/mapa.ts';

/** Uma coisa que o mestre pode mandar o Atlas fazer. A paleta, os atalhos e o menu radial leem a mesma lista. */
export interface Acao {
  id: string;
  nome: string;
  grupo: string;
  atalhos?: string[];
  /** Palavras extras para a busca da paleta. */
  palavras?: string;
  habilitada?: () => boolean;
  executar: () => void | Promise<void>;
}

export const fxLigado = signal(fxPreferido());
export const somLigado = signal(somPreferido());

const noEditor = () => app.sessao.value !== null;
const comSelecao = () => (app.sessao.value?.selecao.value.length ?? 0) > 0;
const passoDeSetas = (grande: boolean) => { const g = app.sessao.value?.doc.value.grid.size ?? 1.5; return grande ? g : g / 2; };

/** Ferramentas que têm uma biblioteca de escolhas (a gaveta abre sozinha). */
const COM_BIBLIOTECA: readonly Ferramenta[] = ['comodo', 'parede', 'abertura', 'objeto', 'luz', 'terreno', 'presenca', 'espalhar'];

export function usarFerramenta(f: Ferramenta): void {
  const s = app.sessao.value; if (!s) return;
  if (modo.value === 'sessao' && !FERRAMENTAS_DA_SESSAO.includes(f)) return;
  s.ferramenta.value = f; s.biblioteca.value = COM_BIBLIOTECA.includes(f);
  avisar(ROTULO_DA_FERRAMENTA[f], { duracao: 1400 });
}
const adicionar = (f: Ferramenta) => () => { const c = colecaoDaFerramenta(f); if (c) app.adicionarEm(c, app.pontoDeAdicionar()); };

/** Gira o que a ferramenta carrega (objeto, direção da luz) ou, sem ferramenta de pôr, os objetos selecionados. */
function girar(graus: number): void {
  const s = app.sessao.value; if (!s) return;
  const rad = (graus * Math.PI) / 180, f = s.ferramenta.value, p = s.pincel.value;
  if (f === 'objeto') { s.pincel.value = { ...p, objeto: { ...p.objeto, rotacao: p.objeto.rotacao + rad } }; return; }
  if (f === 'luz') { s.pincel.value = { ...p, luz: { ...p.luz, direcao: p.luz.direcao + rad } }; return; }
  const objetos = s.selecao.value.filter(a => a.colecao === 'props'), luzes = s.selecao.value.filter(a => a.colecao === 'lights' && s.doc.value.lights[a.id]?.cone);
  if (!objetos.length && !luzes.length) { avisar('Selecione um objeto ou uma lanterna para girar.', { duracao: 1600 }); return; }
  s.store.transacao(objetos.length + luzes.length === 1 ? 'Girar' : 'Girar itens', g => {
    for (const a of objetos) g.aplicar({ tipo: 'item.atualizar', colecao: 'props', id: a.id, patch: { rotation: s.doc.value.props[a.id]!.rotation + rad } });
    for (const a of luzes) { const l = s.store.documento.lights[a.id]!; g.aplicar({ tipo: 'item.atualizar', colecao: 'lights', id: a.id, patch: { cone: { direction: l.cone!.direction + rad } } }); }
  });
  tocar('selecionar');
}

function mudarRaio(delta: number): void {
  const s = app.sessao.value; if (!s) return;
  const p = s.pincel.value, chave = s.ferramenta.value === 'presenca' ? 'presenca' : s.ferramenta.value === 'espalhar' ? 'espalhar' : 'terreno', raio = Math.max(0.25, Math.min(12, p[chave].raio + delta));
  s.pincel.value = { ...p, [chave]: { ...p[chave], raio } }; avisar(`Pincel de ${raio.toFixed(2).replace(/\.?0+$/, '')} m`, { duracao: 900 });
}

/** Um clima por atalho (Alt+1 a Alt+9, na ordem das predefinições) e um por busca na paleta. */
const ACOES_DE_CLIMA: readonly Acao[] = PRESETS_DE_CLIMA.map((p, i) => ({
  id: `clima-${p.id}`, nome: `Clima: ${p.nome}`, grupo: 'Clima', palavras: `${p.descricao} atmosfera tempo luz momento`, atalhos: i < 9 ? [`Alt+${i + 1}`] : [],
  habilitada: noEditor, executar: () => app.aplicarClima(p.id),
}));

export const ACOES: readonly Acao[] = [
  ...ACOES_DE_CLIMA,
  { id: 'relampago', nome: 'Clima: relâmpago agora', grupo: 'Clima', palavras: 'raio trovao tempestade clarao', habilitada: noEditor, executar: () => { if (!app.acabamentoLigado.value) avisar('Ligue “Ver atmosfera no editor” para ver o relâmpago.'); app.viewport.atual?.relampagoAgora(); } },
  { id: 'paleta', nome: 'Abrir a paleta de comandos', grupo: 'Geral', atalhos: ['Ctrl+K'], executar: () => { app.paletaAberta.value = !app.paletaAberta.value; } },
  { id: 'ajuda', nome: 'Mostrar os atalhos', grupo: 'Geral', atalhos: ['?'], executar: () => { app.ajudaAberta.value = !app.ajudaAberta.value; } },
  { id: 'galeria', nome: 'Ir para a galeria de mapas', grupo: 'Geral', palavras: 'inicio voltar mapas', atalhos: ['Alt+G'], habilitada: noEditor, executar: () => app.navegar({ tipo: 'galeria' }) },
  { id: 'novo-mapa', nome: 'Novo mapa', grupo: 'Geral', atalhos: ['Alt+N'], executar: () => app.criarMapaNovo() },
  { id: 'gravar', nome: 'Gravar o mapa', grupo: 'Geral', atalhos: ['Ctrl+S'], habilitada: noEditor, executar: () => app.salvar() },
  { id: 'exportar', nome: 'Exportar este mapa (.atlas.json)', grupo: 'Geral', palavras: 'baixar arquivo', atalhos: ['Ctrl+E'], habilitada: noEditor, executar: () => app.exportar() },
  { id: 'exportar-tudo', nome: 'Exportar tudo (cópia de segurança)', grupo: 'Geral', palavras: 'backup baixar', executar: () => app.exportar([]) },
  { id: 'importar', nome: 'Importar mapa ou cópia de segurança…', grupo: 'Geral', palavras: 'abrir arquivo backup', executar: () => app.escolherArquivoParaImportar() },

  { id: 'desfazer', nome: 'Desfazer', grupo: 'Editar', atalhos: ['Ctrl+Z'], habilitada: noEditor, executar: app.desfazer },
  { id: 'refazer', nome: 'Refazer', grupo: 'Editar', atalhos: ['Ctrl+Shift+Z', 'Ctrl+Y'], habilitada: noEditor, executar: app.refazer },
  { id: 'selecionar-tudo', nome: 'Selecionar tudo', grupo: 'Editar', atalhos: ['Ctrl+A'], habilitada: noEditor, executar: app.selecionarTudo },
  { id: 'limpar', nome: 'Limpar a seleção', grupo: 'Editar', atalhos: ['Esc'], habilitada: noEditor, executar: () => {
    const s = app.sessao.value; if (!s) return;
    if (app.menuRadial.value) { app.menuRadial.value = null; return; }
    if (s.ferramenta.value !== 'selecionar') { s.ferramenta.value = 'selecionar'; s.biblioteca.value = false; return; }
    s.selecao.value = [];
  } },
  { id: 'remover', nome: 'Remover a seleção', grupo: 'Editar', atalhos: ['Delete', 'Backspace'], habilitada: comSelecao, executar: app.removerSelecao },
  { id: 'duplicar', nome: 'Duplicar a seleção', grupo: 'Editar', atalhos: ['Ctrl+D'], habilitada: comSelecao, executar: app.duplicarSelecao },
  { id: 'luz-acesa', nome: 'Acender ou apagar a luz selecionada', grupo: 'Editar', palavras: 'ligar desligar lampada', atalhos: ['I'], habilitada: comSelecao, executar: app.alternarLuzes },
  { id: 'mover-esq', nome: 'Mover a seleção para a esquerda', grupo: 'Editar', atalhos: ['ArrowLeft'], habilitada: comSelecao, executar: () => app.moverSelecao(-passoDeSetas(false), 0) },
  { id: 'mover-dir', nome: 'Mover a seleção para a direita', grupo: 'Editar', atalhos: ['ArrowRight'], habilitada: comSelecao, executar: () => app.moverSelecao(passoDeSetas(false), 0) },
  { id: 'mover-cima', nome: 'Mover a seleção para cima', grupo: 'Editar', atalhos: ['ArrowUp'], habilitada: comSelecao, executar: () => app.moverSelecao(0, -passoDeSetas(false)) },
  { id: 'mover-baixo', nome: 'Mover a seleção para baixo', grupo: 'Editar', atalhos: ['ArrowDown'], habilitada: comSelecao, executar: () => app.moverSelecao(0, passoDeSetas(false)) },
  { id: 'mover-esq-g', nome: 'Mover a seleção uma célula para a esquerda', grupo: 'Editar', atalhos: ['Shift+ArrowLeft'], habilitada: comSelecao, executar: () => app.moverSelecao(-passoDeSetas(true), 0) },
  { id: 'mover-dir-g', nome: 'Mover a seleção uma célula para a direita', grupo: 'Editar', atalhos: ['Shift+ArrowRight'], habilitada: comSelecao, executar: () => app.moverSelecao(passoDeSetas(true), 0) },
  { id: 'mover-cima-g', nome: 'Mover a seleção uma célula para cima', grupo: 'Editar', atalhos: ['Shift+ArrowUp'], habilitada: comSelecao, executar: () => app.moverSelecao(0, -passoDeSetas(true)) },
  { id: 'mover-baixo-g', nome: 'Mover a seleção uma célula para baixo', grupo: 'Editar', atalhos: ['Shift+ArrowDown'], habilitada: comSelecao, executar: () => app.moverSelecao(0, passoDeSetas(true)) },

  { id: 'ferr-selecionar', nome: 'Ferramenta: selecionar', grupo: 'Ferramentas', atalhos: ['V', '1'], habilitada: noEditor, executar: () => usarFerramenta('selecionar') },
  { id: 'ferr-mao', nome: 'Ferramenta: mover a vista', grupo: 'Ferramentas', palavras: 'mao pan arrastar', atalhos: ['H', '2'], habilitada: noEditor, executar: () => usarFerramenta('mao') },
  { id: 'ferr-comodo', nome: 'Pintar cômodo', grupo: 'Construir', palavras: 'sala quarto piso paredes', atalhos: ['C', '3'], habilitada: noEditor, executar: () => usarFerramenta('comodo') },
  { id: 'ferr-borracha', nome: 'Apagar cômodo', grupo: 'Construir', palavras: 'borracha remover piso', atalhos: ['X', '4'], habilitada: noEditor, executar: () => usarFerramenta('borracha') },
  { id: 'ferr-parede', nome: 'Desenhar parede', grupo: 'Construir', palavras: 'muro cerca', atalhos: ['W', '5'], habilitada: noEditor, executar: () => usarFerramenta('parede') },
  { id: 'ferr-abertura', nome: 'Pôr porta ou janela', grupo: 'Construir', palavras: 'porta janela arco abertura', atalhos: ['D', '6'], habilitada: noEditor, executar: () => usarFerramenta('abertura') },
  { id: 'ferr-objeto', nome: 'Pôr objeto', grupo: 'Construir', palavras: 'movel mesa cadeira cama biblioteca', atalhos: ['O', '7'], habilitada: noEditor, executar: () => usarFerramenta('objeto') },
  { id: 'ferr-luz', nome: 'Pôr luz', grupo: 'Construir', palavras: 'lampada lamparina lanterna vela tocha', atalhos: ['L', '8'], habilitada: noEditor, executar: () => usarFerramenta('luz') },
  { id: 'ferr-peca', nome: 'Pôr peça', grupo: 'Construir', palavras: 'token personagem', atalhos: ['T', '9'], habilitada: noEditor, executar: () => usarFerramenta('peca') },
  { id: 'ferr-regiao', nome: 'Pôr região', grupo: 'Construir', palavras: 'area gatilho', atalhos: ['R'], habilitada: noEditor, executar: () => usarFerramenta('regiao') },
  { id: 'ferr-terreno', nome: 'Pintar terreno', grupo: 'Construir', palavras: 'grama terra areia neve lama natureza', atalhos: ['N'], habilitada: noEditor, executar: () => usarFerramenta('terreno') },
  { id: 'ferr-espalhar', nome: 'Espalhar objetos', grupo: 'Construir', palavras: 'papelada caixotes plantas pincel conjunto bagunca', atalhos: ['S'], habilitada: noEditor, executar: () => usarFerramenta('espalhar') },
  { id: 'ferr-presenca', nome: 'Pintar presença', grupo: 'Construir', palavras: 'musgo mofo sangue corrupcao sombra paranormal ordem mancha', atalhos: ['P'], habilitada: noEditor, executar: () => usarFerramenta('presenca') },
  { id: 'sugestao-aceitar', nome: 'Aceitar a sugestão', grupo: 'Assistente', palavras: 'assistente pilula sugerir', habilitada: () => sugestao.value !== null, executar: aceitarSugestao },
  { id: 'sugestao-outra', nome: 'Outra sugestão', grupo: 'Assistente', palavras: 'assistente pilula gerar de novo', habilitada: () => sugestao.value !== null, executar: outraSugestao },
  { id: 'sugestao-dispensar', nome: 'Dispensar a sugestão', grupo: 'Assistente', palavras: 'assistente pilula agora nao', habilitada: () => sugestao.value !== null, executar: dispensarSugestao },
  { id: 'sugestoes-alternar', nome: 'Ligar ou desligar sugestões', grupo: 'Assistente', palavras: 'assistente pilula', habilitada: noEditor, executar: () => definirSugestoesLigadas(!sugestoesLigadas.value) },
  { id: 'modo', nome: 'Alternar modo: Construir / Sessão', grupo: 'Geral', palavras: 'jogar mestre construir sessao editar', atalhos: ['M'], habilitada: noEditor, executar: () => app.alternarModo() },
  { id: 'biblioteca', nome: 'Abrir ou fechar a biblioteca', grupo: 'Construir', palavras: 'gaveta itens catalogo', atalhos: ['B'], habilitada: noEditor, executar: () => { const s = app.sessao.value; if (s) s.biblioteca.value = !s.biblioteca.value; } },
  { id: 'vista-jogador', nome: 'Ver como jogador (névoa) / ver tudo', grupo: 'Sessão', palavras: 'visao nevoa mestre jogadores', atalhos: ['J'], habilitada: () => modo.value === 'sessao', executar: () => { vistaDeJogador.value = !vistaDeJogador.value; avisar(vistaDeJogador.value ? 'Vista dos jogadores.' : 'Vista do mestre.', { duracao: 1400 }); } },
  { id: 'ferr-regua', nome: 'Ferramenta: régua (medir em quadrados)', grupo: 'Sessão', palavras: 'medir distancia metros quadrados', atalhos: ['R'], habilitada: () => modo.value === 'sessao', executar: () => usarFerramenta('regua') },
  { id: 'interagir', nome: 'Interagir (abrir ou fechar a porta ao lado da peça)', grupo: 'Sessão', palavras: 'porta abrir fechar usar peca', atalhos: ['Enter'], habilitada: () => modo.value === 'sessao' && (app.sessao.value?.selecao.value.some(a => a.colecao === 'tokens') ?? false), executar: () => app.interagirComPerto() },
  { id: 'virar-lanterna-esq', nome: 'Virar a lanterna para a esquerda (45°)', grupo: 'Sessão', palavras: 'facho cone luz peça', atalhos: ['Q'], habilitada: () => modo.value === 'sessao' && app.comLanterna(), executar: () => app.virarLanterna(-45) },
  { id: 'virar-lanterna-dir', nome: 'Virar a lanterna para a direita (45°)', grupo: 'Sessão', palavras: 'facho cone luz peça', atalhos: ['E'], habilitada: () => modo.value === 'sessao' && app.comLanterna(), executar: () => app.virarLanterna(45) },
  { id: 'girar-dir', nome: 'Girar para a direita (90°)', grupo: 'Construir', palavras: 'rotacionar', atalhos: ['E'], habilitada: noEditor, executar: () => girar(90) },
  { id: 'girar-esq', nome: 'Girar para a esquerda (90°)', grupo: 'Construir', palavras: 'rotacionar', atalhos: ['Q'], habilitada: noEditor, executar: () => girar(-90) },
  { id: 'girar-dir-fino', nome: 'Girar para a direita (15°)', grupo: 'Construir', atalhos: ['Shift+E'], habilitada: noEditor, executar: () => girar(15) },
  { id: 'girar-esq-fino', nome: 'Girar para a esquerda (15°)', grupo: 'Construir', atalhos: ['Shift+Q'], habilitada: noEditor, executar: () => girar(-15) },
  { id: 'pincel-menor', nome: 'Pincel de terreno menor', grupo: 'Construir', atalhos: ['['], habilitada: noEditor, executar: () => mudarRaio(-0.5) },
  { id: 'pincel-maior', nome: 'Pincel de terreno maior', grupo: 'Construir', atalhos: [']'], habilitada: noEditor, executar: () => mudarRaio(0.5) },
  { id: 'aqui-luz', nome: 'Pôr uma luz aqui', grupo: 'Adicionar', habilitada: noEditor, executar: adicionar('luz') },
  { id: 'aqui-objeto', nome: 'Pôr um objeto aqui', grupo: 'Adicionar', habilitada: noEditor, executar: adicionar('objeto') },
  { id: 'aqui-peca', nome: 'Pôr uma peça aqui', grupo: 'Adicionar', habilitada: noEditor, executar: adicionar('peca') },
  { id: 'aqui-regiao', nome: 'Pôr uma região aqui', grupo: 'Adicionar', habilitada: noEditor, executar: adicionar('regiao') },

  { id: 'enquadrar', nome: 'Enquadrar o mapa inteiro', grupo: 'Vista', atalhos: ['F'], habilitada: noEditor, executar: () => app.viewport.atual?.enquadrar() },
  { id: 'centralizar', nome: 'Centralizar na seleção', grupo: 'Vista', atalhos: ['Z'], habilitada: comSelecao, executar: app.centralizarNaSelecao },
  { id: 'zoom-mais', nome: 'Aproximar', grupo: 'Vista', atalhos: ['+', '='], habilitada: noEditor, executar: () => app.viewport.atual?.zoomPor(1.25) },
  { id: 'zoom-menos', nome: 'Afastar', grupo: 'Vista', atalhos: ['-'], habilitada: noEditor, executar: () => app.viewport.atual?.zoomPor(0.8) },
  { id: 'grade', nome: 'Mostrar ou esconder a grade', grupo: 'Vista', atalhos: ['G'], habilitada: noEditor, executar: () => {
    const s = app.sessao.value; if (!s) return;
    s.store.executar({ tipo: 'grade.atualizar', patch: { visible: !s.doc.value.grid.visible } }, { rotulo: s.doc.value.grid.visible ? 'Esconder a grade' : 'Mostrar a grade' }); tocar('selecionar');
  } },

  { id: 'tema-ordem', nome: 'Tema Ordem', grupo: 'Aparência', palavras: 'vermelho', executar: () => trocarTema({ id: 'ordem' }) },
  { id: 'tema-prata', nome: 'Tema Prata', grupo: 'Aparência', palavras: 'cinza vigilia', executar: () => trocarTema({ id: 'prata' }) },
  { id: 'tema-neutro', nome: 'Tema Neutro', grupo: 'Aparência', palavras: 'ambar', executar: () => trocarTema({ id: 'neutro' }) },
  { id: 'fx', nome: 'Ligar ou desligar as animações', grupo: 'Aparência', palavras: 'efeitos movimento', executar: () => { fxLigado.value = !fxLigado.value; definirFx(fxLigado.value); avisar(fxLigado.value ? 'Animações ligadas.' : 'Animações desligadas.'); } },
  { id: 'som', nome: 'Ligar ou desligar os sons', grupo: 'Aparência', executar: () => { somLigado.value = !somLigado.value; definirSom(somLigado.value); tocar('pop'); avisar(somLigado.value ? 'Sons ligados.' : 'Sons desligados.'); } },
];

/** O que só existe em Construir: tudo o que muda o mapa (ferramentas de pôr, biblioteca, assistente, remover, duplicar, grade). Na Sessão fica desabilitado. */
const GRUPOS_SO_DE_CONSTRUIR = new Set(['Construir', 'Adicionar', 'Assistente']), IDS_SO_DE_CONSTRUIR = new Set(['remover', 'duplicar', 'luz-acesa', 'grade']);
const soEmConstruir = (a: Acao) => GRUPOS_SO_DE_CONSTRUIR.has(a.grupo) || IDS_SO_DE_CONSTRUIR.has(a.id);
const HABILITADA = (a: Acao) => (modo.value === 'sessao' && soEmConstruir(a) ? false : a.habilitada ? a.habilitada() : true);
export const acaoPorId = (id: string): Acao | undefined => ACOES.find(a => a.id === id);

export function executarAcao(a: Acao): void {
  if (!HABILITADA(a)) { avisar('Isso não está disponível agora.', { duracao: 1400 }); return; }
  try { const r = a.executar(); if (r instanceof Promise) r.catch(erro => avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' })); }
  catch (erro) { avisar(erro instanceof Error ? erro.message : String(erro), { tipo: 'erro' }); tocar('erro'); }
}

/** Ações da paleta que casam com a consulta e estão disponíveis, mais úteis primeiro. */
export function buscarAcoes(consulta: string): Acao[] {
  return filtrar(ACOES.filter(HABILITADA), consulta, a => `${a.nome} ${a.grupo} ${a.palavras ?? ''}`);
}

const TIPOS_SEM_TEXTO = new Set(['checkbox', 'radio', 'button', 'color', 'range', 'submit', 'reset', 'file']);
/** Só campos que recebem texto roubam as teclas; uma caixa de seleção ou um botão não. */
export function recebeTexto(el: Element | null): boolean {
  const campo = el?.closest?.('input, textarea, select, [contenteditable="true"]') as HTMLInputElement | null;
  if (!campo) return false;
  return campo.tagName === 'INPUT' ? !TIPOS_SEM_TEXTO.has(campo.type) : true;
}

/** Trata uma tecla: acha a ação do atalho e a executa. Devolve se tratou. */
export function tratarTecla(e: KeyboardEvent): boolean {
  const emCampo = recebeTexto(e.target as HTMLElement | null);
  const k = e.key.toLowerCase();
  // Dentro de um campo de texto só valem os atalhos com Ctrl (e Esc), para não roubar a digitação.
  if (emCampo && !(e.ctrlKey || e.metaKey) && k !== 'escape') return false;
  if (app.paletaAberta.value && k !== 'escape' && !(e.ctrlKey && k === 'k')) return false;
  for (const a of ACOES) {
    if (!a.atalhos?.some(t => combina(t, e))) continue;
    if (!HABILITADA(a)) continue;
    e.preventDefault(); executarAcao(a); return true;
  }
  return false;
}

export interface ItemRadial { id: string; rotulo: string; icone: string; atalho?: string; fazer: () => void }

/** As ações do clique direito: o que faz sentido sobre o item, ou sobre o espaço vazio. */
export function itensDoMenuRadial(alvo: Alvo | null, mundo: Ponto): ItemRadial[] {
  const s = app.sessao.value; if (!s) return [];
  const item = (id: string, rotulo: string, icone: string, atalho?: string): ItemRadial => ({ id, rotulo, icone, ...(atalho ? { atalho } : {}), fazer: () => { const a = acaoPorId(id); if (a) executarAcao(a); } });
  if (alvo) {
    const luz = alvo.colecao === 'lights';
    return [
      item('duplicar', 'Duplicar', 'duplicar', 'Ctrl+D'), item('remover', 'Remover', 'lixeira', 'Del'),
      ...(luz ? [item('luz-acesa', s.doc.value.lights[alvo.id]?.on ? 'Apagar' : 'Acender', 'luz', 'I')] : []),
      item('centralizar', 'Centralizar', 'alvo', 'Z'), item('desfazer', 'Desfazer', 'desfazer', 'Ctrl+Z'),
    ];
  }
  // "Aqui" é onde o botão direito foi clicado, não onde o ponteiro estiver quando o item for escolhido.
  const aqui = (id: string, rotulo: string, icone: string, f: Ferramenta): ItemRadial => ({ id, rotulo, icone, fazer: () => { const c = colecaoDaFerramenta(f); if (c) app.adicionarEm(c, app.pontoDeAdicionar(mundo)); } });
  return [aqui('aqui-luz', 'Luz aqui', 'luz', 'luz'), aqui('aqui-objeto', 'Objeto aqui', 'objeto', 'objeto'), aqui('aqui-peca', 'Peça aqui', 'peca', 'peca'), aqui('aqui-regiao', 'Região aqui', 'regiao', 'regiao'), item('enquadrar', 'Enquadrar', 'enquadrar', 'F'), item('selecionar-tudo', 'Selecionar tudo', 'selecionar', 'Ctrl+A'), item('grade', 'Grade', 'grade', 'G')];
}

export const campanhaNome = () => campanhaAtiva.value?.nome ?? null;
