import { signal } from '@preact/signals';
import { combina } from './atalhos.ts';
import { filtrar } from './busca.ts';
import * as app from './app.ts';
import { avisar } from './toasts.ts';
import { trocarTema } from './tema.ts';
import { definirFx, fxPreferido } from '../fx/fx.ts';
import { definirSom, somPreferido, tocar } from '../fx/som.ts';
import { colecaoDaFerramenta, type Ferramenta } from '../render/viewport.ts';
import { campanhaAtiva } from './campanha.ts';
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

function usarFerramenta(f: Ferramenta): void {
  const s = app.sessao.value; if (!s) return;
  s.ferramenta.value = f;
  const nomes: Record<Ferramenta, string> = { selecionar: 'Selecionar', mao: 'Mover a vista', luz: 'Adicionar luz', objeto: 'Adicionar objeto', peca: 'Adicionar peça', regiao: 'Adicionar região' };
  avisar(nomes[f], { duracao: 1400 });
}
const adicionar = (f: Ferramenta) => () => { const c = colecaoDaFerramenta(f); if (c) app.adicionarEm(c, app.pontoDeAdicionar()); };

export const ACOES: readonly Acao[] = [
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
    if (s.ferramenta.value !== 'selecionar') { s.ferramenta.value = 'selecionar'; return; }
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
  { id: 'ferr-luz', nome: 'Adicionar luz', grupo: 'Ferramentas', palavras: 'lampada lampiao lanterna', atalhos: ['L', '3'], habilitada: noEditor, executar: () => usarFerramenta('luz') },
  { id: 'ferr-objeto', nome: 'Adicionar objeto', grupo: 'Ferramentas', palavras: 'movel', atalhos: ['O', '4'], habilitada: noEditor, executar: () => usarFerramenta('objeto') },
  { id: 'ferr-peca', nome: 'Adicionar peça', grupo: 'Ferramentas', palavras: 'token personagem', atalhos: ['T', '5'], habilitada: noEditor, executar: () => usarFerramenta('peca') },
  { id: 'ferr-regiao', nome: 'Adicionar região', grupo: 'Ferramentas', palavras: 'area gatilho', atalhos: ['R', '6'], habilitada: noEditor, executar: () => usarFerramenta('regiao') },
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

const HABILITADA = (a: Acao) => (a.habilitada ? a.habilitada() : true);
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
