import { useEffect } from 'preact/hooks';
import { tratarTecla } from '../app/acoes.ts';
import { carregando, erroInicial, iniciar, rota, servicos, sessao } from '../app/app.ts';
import { Ajuda } from './Ajuda.tsx';
import { Cabecalho } from './Cabecalho.tsx';
import { Editor } from './Editor.tsx';
import { Galeria } from './Galeria.tsx';
import { MenuRadial } from './MenuRadial.tsx';
import { Paleta } from './Paleta.tsx';
import { Toasts } from './Toasts.tsx';

export function App() {
  useEffect(() => {
    void iniciar();
    const tecla = (e: KeyboardEvent) => { tratarTecla(e); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  if (erroInicial.value) return (
    <main class="erro-inicial" data-testid="erro-inicial"><div role="alert"><h1 class="faixa grande">Não consegui abrir o Atlas</h1><p>{erroInicial.value}</p><p class="meta">O Atlas guarda tudo no armazenamento do navegador (IndexedDB). Em janelas privadas de alguns navegadores ele fica indisponível.</p></div></main>
  );
  return (
    <>
      <Cabecalho />
      {!servicos.value ? <main class="carregando" aria-busy="true">Abrindo…</main>
        : sessao.value && rota.value.tipo === 'mapa' ? <Editor />
        : rota.value.tipo === 'mapa' && carregando.value ? <main class="carregando" aria-busy="true">Abrindo o mapa…</main>
        : <Galeria />}
      <Paleta /><MenuRadial /><Ajuda /><Toasts />
      <div id="transicao" class="transicao" aria-hidden="true"><i /><i /><i /></div>
    </>
  );
}
