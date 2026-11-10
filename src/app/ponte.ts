// Só em desenvolvimento: importado por `main.tsx` dentro de `if (import.meta.env.DEV)`; o Vite elimina o chunk do build.
import { conectarPonte, ferramentasDaCampanha } from '#mesa/ponte';
import { telaParaMundo } from '../render/camera.ts';
import { SeloDoAssistente, estadoDaPonte } from '../ui/SeloDoAssistente.tsx';
import { abrirMapa, navegar, pararMomento, servicos, sessao, tocarMomentoDoMapa, viewport } from './app.ts';
import { campanhaAtiva, sincronizarMapaComCampanha } from './campanha.ts';
import { pedirConfirmacao } from './atividade-do-assistente.ts';
import { seloDoAssistente } from './assistente-slot.ts';
import { modo } from './modo.ts';
import { ferramentasDeEscrita } from './ponte-escrita.ts';
import { ferramentasDeLeitura } from './ponte-leitura.ts';

const obterRepositorio = async () => {
  const c = servicos.value?.campanhas;
  if (!c) throw new Error('O banco da campanha não está disponível neste navegador.');
  return c;
};

/** Abre o mapa pelo mesmo caminho do "novo mapa" (rota) e espera a sessão dele subir. */
async function abrirPelaRota(id: string): Promise<void> {
  navegar({ tipo: 'mapa', id });
  for (let i = 0; i < 100 && sessao.value?.doc.value.id !== id; i++) await new Promise(r => setTimeout(r, 50));
  if (sessao.value?.doc.value.id !== id) throw new Error('O mapa foi criado, mas a aba não conseguiu abri-lo a tempo; use atlas_abrir.');
}

const cliente = conectarPonte({
  app: 'atlas', titulo: 'Atlas',
  ferramentas: [
    ...ferramentasDaCampanha(obterRepositorio),
    ...ferramentasDeLeitura({ repo: () => servicos.value?.repo ?? null, mapaAberto: () => sessao.value?.doc.value ?? null, abrirMapa, capturar: o => viewport.atual?.capturar(o) ?? null,
      modo: () => modo.value, selecao: () => sessao.value?.selecao.value ?? [],
      caixaVisivel: () => { const v = viewport.atual; if (!v) return null; const [x0, y0] = telaParaMundo(v.camera, [0, 0]), [x1, y1] = telaParaMundo(v.camera, [v.tela.largura, v.tela.altura]); return { x0, y0, x1, y1 }; } }),
    ...ferramentasDeEscrita({
      store: () => sessao.value?.store ?? null, repo: () => servicos.value?.repo ?? null, abrirMapa: abrirPelaRota,
      sincronizarCampanha: async m => { const s = servicos.value; if (s) await sincronizarMapaComCampanha(s, m); },
      campanhaAtiva: () => campanhaAtiva.value?.id ?? null,
      tocarMomento: tocarMomentoDoMapa, pararMomento, confirmar: d => pedirConfirmacao(d),
    }),
  ],
});

estadoDaPonte.value = cliente.estado();
cliente.aoMudarEstado(e => { estadoDaPonte.value = e; });
seloDoAssistente.value = SeloDoAssistente;
