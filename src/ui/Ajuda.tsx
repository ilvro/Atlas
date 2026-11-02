import { ACOES } from '../app/acoes.ts';
import { ajudaAberta } from '../app/app.ts';
import { mostrarAtalho } from '../app/atalhos.ts';

/** Mapa de atalhos: tudo que a paleta faz, agrupado. `?` abre, Esc fecha. */
export function Ajuda() {
  if (!ajudaAberta.value) return null;
  const grupos = new Map<string, typeof ACOES[number][]>();
  for (const a of ACOES) if (a.atalhos?.length) grupos.set(a.grupo, [...(grupos.get(a.grupo) ?? []), a]);
  return (
    <div class="ajuda-fundo" onPointerDown={e => { if (e.target === e.currentTarget) ajudaAberta.value = false; }} onKeyDown={e => { if (e.key === 'Escape') ajudaAberta.value = false; }}>
      <section class="ajuda" aria-label="Atalhos do teclado" data-testid="ajuda">
        <h2 class="faixa">Atalhos</h2>
        <button type="button" class="ajuda-fechar" aria-label="Fechar" onClick={() => { ajudaAberta.value = false; }}>×</button>
        <div class="ajuda-grade">
          {[...grupos].map(([grupo, acoes]) => (
            <div key={grupo}><h3>{grupo}</h3>
              <ul>{acoes.map(a => <li key={a.id}><span>{a.nome}</span><span class="ajuda-teclas">{a.atalhos!.slice(0, 2).map(t => <kbd key={t}>{mostrarAtalho(t)}</kbd>)}</span></li>)}</ul>
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
