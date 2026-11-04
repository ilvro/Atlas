import { signal } from '@preact/signals';
import { criarMapa, type MapaAtlas } from '../domain/mapa.ts';
import type { EstadoDoTutor } from '../tutorial/condicoes.ts';
import { LICOES } from '../tutorial/licoes.ts';
import { criarTutor } from '../tutorial/tutor.ts';
import { atualizarLista, navegar, removerMapa, servicos, sessao } from './app.ts';
import { abaDoInspetor, modo, vistaDeJogador } from './modo.ts';
import { projetorConectado } from './projetor.ts';
import { definirSugestoesLigadas, sugestoesLigadas } from './sugestoes.ts';
import { avisar } from './toasts.ts';
import { effect } from '@preact/signals';

const vazio = criarMapa({ id: 'tutor-sem-mapa', agora: 0 });

/** O estado que as condições leem: o mapa aberto (ou um vazio, antes de abrir) e o do editor. */
export function estadoDoTutor(): EstadoDoTutor {
  const s = sessao.peek();
  return { doc: s?.doc.value ?? vazio, modo: modo.value, aba: abaDoInspetor.value, ferramenta: s?.ferramenta.value ?? 'selecionar', selecao: s?.selecao.value ?? [], projetor: projetorConectado.value, vistaDeJogador: vistaDeJogador.value, sujo: s?.sujo.value ?? false, espalhar: s ? { conjunto: s.pincel.value.espalhar.conjunto, raio: s.pincel.value.espalhar.raio } : undefined };
}

export const tutor = criarTutor({ licoes: LICOES, estado: estadoDoTutor });

/** O mapa de treino da lição em curso (criado pela lição: o mapa do mestre nunca é tocado). */
export const mapaDeTreino = signal<{ id: string; nome: string } | null>(null);

// As sugestões do assistente se calam durante as lições que não são dele, e a preferência da pessoa volta quando a lição acaba.
let sugestoesAntes: boolean | null = null;
effect(() => {
  void tutor.versao.value;
  if (!tutor.info() && sugestoesAntes !== null) { definirSugestoesLigadas(sugestoesAntes); sugestoesAntes = null; }
});

/** Cria o mapa de treino, abre e começa a lição. Se a lição já está em curso neste mapa, só a retoma do passo `de`. */
export async function iniciarLicao(id: string, de = 0): Promise<boolean> {
  const licao = LICOES.find(l => l.id === id), s = servicos.peek(); if (!licao || !s) return false;
  tutor.parar(); tutor.fecharFim();
  const mapa: MapaAtlas = criarMapa({ nome: `Treino · ${licao.titulo}` });
  if (licao.mapa) mapa.bounds = { width: licao.mapa.largura, height: licao.mapa.altura };
  const gravado = await s.repo.salvar(mapa);
  mapaDeTreino.value = { id: gravado.id, nome: gravado.name };
  navegar({ tipo: 'mapa', id: gravado.id });
  for (let i = 0; i < 100 && sessao.peek()?.doc.value.id !== gravado.id; i++) await new Promise(r => setTimeout(r, 50));
  if (sessao.peek()?.doc.value.id !== gravado.id) { avisar('Não consegui abrir o mapa de treino.', { tipo: 'erro' }); return false; }
  modo.value = 'construir'; abaDoInspetor.value = 'mapa';
  if (sugestoesAntes === null) sugestoesAntes = sugestoesLigadas.peek();
  definirSugestoesLigadas(!!licao.assistente);
  return tutor.iniciar(id, de);
}

/** Apaga o mapa de treino (a lição acabou e a pessoa não quer guardá-lo) e volta à galeria. */
export async function apagarMapaDeTreino(): Promise<void> {
  const t = mapaDeTreino.peek(); if (!t) return;
  mapaDeTreino.value = null; await removerMapa(t.id); navegar({ tipo: 'galeria' }); await atualizarLista();
}

/** Baixa o relatório dos tutoriais (onde as pessoas travam, pulam e pedem ajuda), guardado só neste navegador. */
export function exportarRelatorioDosTutoriais(): void {
  const blob = new Blob([JSON.stringify(tutor.relatorio(), null, 2)], { type: 'application/json' }), a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'atlas-tutoriais-relatorio.json' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
