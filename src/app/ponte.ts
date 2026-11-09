// Só em desenvolvimento: importado por `main.tsx` dentro de `if (import.meta.env.DEV)`; o Vite elimina o chunk do build.
import { conectarPonte, ferramentasDaCampanha } from '#mesa/ponte';
import { abrirMapa, servicos, sessao } from './app.ts';
import { ferramentasDeLeitura } from './ponte-leitura.ts';

const obterRepositorio = async () => {
  const c = servicos.value?.campanhas;
  if (!c) throw new Error('O banco da campanha não está disponível neste navegador.');
  return c;
};

conectarPonte({
  app: 'atlas', titulo: 'Atlas',
  ferramentas: [
    ...ferramentasDaCampanha(obterRepositorio),
    ...ferramentasDeLeitura({ repo: () => servicos.value?.repo ?? null, mapaAberto: () => sessao.value?.doc.value ?? null, abrirMapa }),
  ],
});
