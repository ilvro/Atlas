import { useEffect } from 'preact/hooks';
import { ACOES, executarAcao } from '../app/acoes.ts';
import { ajudaAberta, rota } from '../app/app.ts';
import { mostrarAtalho } from '../app/atalhos.ts';
import { aprenderAberto } from './Aprender.tsx';

/** Mapa de atalhos: tudo que a paleta faz, agrupado. `?` abre, Esc fecha. */
export function Ajuda() {
  const aberta = ajudaAberta.value;

  useEffect(() => {
    if (!aberta) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        ajudaAberta.value = false;
      }
    };
    window.addEventListener('keydown', aoTecla, true);
    return () => window.removeEventListener('keydown', aoTecla, true);
  }, [aberta]);

  if (!aberta) return null;
  const grupos = new Map<string, typeof ACOES[number][]>();
  for (const a of ACOES) if (a.atalhos?.length) grupos.set(a.grupo, [...(grupos.get(a.grupo) ?? []), a]);

  const abrirTutoriais = () => {
    ajudaAberta.value = false;
    rota.value = { tipo: 'galeria' };
    aprenderAberto.value = true;
  };

  return (
    <div class="ajuda-fundo" onPointerDown={e => { if (e.target === e.currentTarget) ajudaAberta.value = false; }}>
      <section class="ajuda" aria-label="Atalhos do teclado" data-testid="ajuda">
        <header class="ajuda-cabecalho">
          <h2 class="faixa">Atalhos</h2>
          <button
            type="button"
            class="botao-pilula"
            data-testid="ajuda-abrir-tutoriais"
            onClick={abrirTutoriais}
          >
            Abrir Tutoriais (Aprender)
          </button>
          <button type="button" class="ajuda-fechar" aria-label="Fechar" onClick={() => { ajudaAberta.value = false; }}>×</button>
        </header>
        <div class="ajuda-grade">
          {[...grupos].map(([grupo, acoes]) => (
            <div key={grupo}><h3>{grupo}</h3>
              <ul>{acoes.map(a => (
                <li
                  key={a.id}
                  class="ajuda-item-clicavel"
                  title="Clique para executar esta ação"
                  onClick={() => {
                    ajudaAberta.value = false;
                    executarAcao(a);
                  }}
                >
                  <span>{a.nome}</span>
                  <span class="ajuda-teclas">{a.atalhos!.slice(0, 2).map(t => <kbd key={t}>{mostrarAtalho(t)}</kbd>)}</span>
                </li>
              ))}</ul>
            </div>
          ))}
          <div><h3>Mouse</h3><ul>
            <li><span>Selecionar vários</span><span class="ajuda-teclas"><kbd>arrastar no vazio</kbd></span></li>
            <li><span>Selecionar com laço</span><span class="ajuda-teclas"><kbd>Alt+arrastar</kbd></span></li>
            <li><span>Somar à seleção</span><span class="ajuda-teclas"><kbd>Shift+clique</kbd></span></li>
            <li><span>Mover sem encaixar na grade</span><span class="ajuda-teclas"><kbd>Alt+arrastar item</kbd></span></li>
            <li><span>Mover a vista</span><span class="ajuda-teclas"><kbd>botão direito</kbd><kbd>Espaço+arrastar</kbd></span></li>
            <li><span>Menu de ações</span><span class="ajuda-teclas"><kbd>clique direito</kbd></span></li>
          </ul></div>
        </div>
      </section>
    </div>
  );
}
