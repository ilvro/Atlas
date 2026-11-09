// Só em desenvolvimento: importado por `main.tsx` dentro de `if (import.meta.env.DEV)`; o Vite elimina o chunk do build.
import { conectarPonte, ferramentasDaCampanha } from '#mesa/ponte';
import { telaParaMundo } from '../render/camera.ts';
import { SeloDoAssistente, estadoDaPonte } from '../ui/SeloDoAssistente.tsx';
import { abrirMapa, servicos, sessao, viewport } from './app.ts';
import { seloDoAssistente } from './assistente-slot.ts';
import { modo } from './modo.ts';
import { ferramentasDeLeitura } from './ponte-leitura.ts';

const obterRepositorio = async () => {
  const c = servicos.value?.campanhas;
  if (!c) throw new Error('O banco da campanha não está disponível neste navegador.');
  return c;
};

const cliente = conectarPonte({
  app: 'atlas', titulo: 'Atlas',
  ferramentas: [
    ...ferramentasDaCampanha(obterRepositorio),
    ...ferramentasDeLeitura({ repo: () => servicos.value?.repo ?? null, mapaAberto: () => sessao.value?.doc.value ?? null, abrirMapa, capturar: o => viewport.atual?.capturar(o) ?? null,
      modo: () => modo.value, selecao: () => sessao.value?.selecao.value ?? [],
      caixaVisivel: () => { const v = viewport.atual; if (!v) return null; const [x0, y0] = telaParaMundo(v.camera, [0, 0]), [x1, y1] = telaParaMundo(v.camera, [v.tela.largura, v.tela.altura]); return { x0, y0, x1, y1 }; } }),
  ],
});

estadoDaPonte.value = cliente.estado();
cliente.aoMudarEstado(e => { estadoDaPonte.value = e; });
seloDoAssistente.value = SeloDoAssistente;
