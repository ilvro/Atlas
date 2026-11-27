import { Tutor } from './Tutor.tsx';
import { embutido } from '../app/embutido.ts';
import { emConstrucaoRemota } from '../app/construcao-remota.ts';
import { useEffect } from 'preact/hooks';
import { tratarTecla } from '../app/acoes.ts';
import { carregando, erroInicial, iniciar, iniciarModoConstrucaoRemota, rota, servicos, sessao } from '../app/app.ts';
import { Ajuda } from './Ajuda.tsx';
import { Cabecalho } from './Cabecalho.tsx';
import { Editor } from './Editor.tsx';
import { Galeria } from './Galeria.tsx';
import { MenuRadial } from './MenuRadial.tsx';
import { Projetor } from './Projetor.tsx';
import { Paleta } from './Paleta.tsx';
import { Toasts } from './Toasts.tsx';

export function App() {
  useEffect(() => {
    const r = rota.value;
    if (r.tipo === 'construir-remoto') {
      const pararRemoto = iniciarModoConstrucaoRemota(r.sala);
      const tecla = (e: KeyboardEvent) => { tratarTecla(e); };
      window.addEventListener('keydown', tecla);
      return () => {
        pararRemoto();
        window.removeEventListener('keydown', tecla);
      };
    }
    const soProjeta = r.tipo === 'projetor' || r.tipo === 'projetor-remoto';
    if (!soProjeta) void iniciar();     // o projetor não abre o banco: só recebe do mestre
    if (r.tipo === 'projetor-remoto') return;     // sem atalhos de mestre no projetor remoto
    const tecla = (e: KeyboardEvent) => { tratarTecla(e); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  if (rota.value.tipo === 'projetor') return <Projetor mapaId={rota.value.id} />;
  if (rota.value.tipo === 'projetor-remoto') return <Projetor mapaId="remoto" salaId={rota.value.sala} />;
  if (erroInicial.value) return (
    <main class="erro-inicial" data-testid="erro-inicial"><div role="alert"><h1 class="faixa grande">Não consegui abrir o Atlas</h1><p>{erroInicial.value}</p><p class="meta">O Atlas guarda tudo no armazenamento do navegador (IndexedDB). Em janelas privadas de alguns navegadores ele fica indisponível.</p></div></main>
  );
  return (
    <>
      <Cabecalho />
      {!servicos.value ? <main class="carregando" aria-busy="true">Abrindo…</main>
        : sessao.value && (rota.value.tipo === 'mapa' || emConstrucaoRemota.value) ? <Editor />
        : emConstrucaoRemota.value ? <main class="carregando" data-testid="construcao-espera" aria-busy="true">Aguardando o mapa de construção…</main>
        : rota.value.tipo === 'mapa' && carregando.value ? <main class="carregando" aria-busy="true">Abrindo o mapa…</main>
        : embutido ? <main class="vazio-embutido" data-testid="vazio-embutido"><h2 class="faixa grande">Sem mapa</h2><p>Escolha um mapa na Mesa: ele abre aqui, direto em Sessão.</p></main>
        : <Galeria />}
      <Paleta /><MenuRadial /><Ajuda /><Toasts />{!emConstrucaoRemota.value && <Tutor />}
      <div id="transicao" class="transicao" aria-hidden="true"><i /><i /><i /></div>
    </>
  );
}
