import { useLayoutEffect } from 'preact/hooks';
import { itensDoMenuRadial } from '../app/acoes.ts';
import { menuRadial } from '../app/app.ts';
import { mostrarAtalho } from '../app/atalhos.ts';
import { Icone } from './Icone.tsx';

/** Clique direito: até 8 ações em volta do cursor, escolhidas pelo que está sob ele. Dígitos 1–8 também escolhem. */
export function MenuRadial() {
  const info = menuRadial.value;
  useLayoutEffect(() => {
    if (!info) return;
    const itens = itensDoMenuRadial(info.alvo, info.mundo);
    const fechar = () => { menuRadial.value = null; };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fechar(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= itens.length) { e.preventDefault(); e.stopPropagation(); fechar(); itens[n - 1]!.fazer(); }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [info]);
  if (!info) return null;
  const itens = itensDoMenuRadial(info.alvo, info.mundo), raio = itens.length > 5 ? 86 : 72;
  // Mantém o menu inteiro dentro da janela.
  const x = Math.max(raio + 40, Math.min(innerWidth - raio - 40, info.x)), y = Math.max(raio + 40, Math.min(innerHeight - raio - 40, info.y));
  return (
    <div class="radial-fundo" onPointerDown={e => { if (e.target === e.currentTarget) menuRadial.value = null; }} onContextMenu={e => { e.preventDefault(); /* o navegador dispara este evento logo depois de soltar o botão que abriu o menu */ if (Date.now() - info.aberto > 400) menuRadial.value = null; }}>
      <div class="radial" style={{ left: `${x}px`, top: `${y}px` }} role="menu" aria-label="Ações" data-testid="menu-radial">
        <span class="radial-centro" aria-hidden="true" />
        {itens.map((item, i) => {
          const ang = -Math.PI / 2 + (i / itens.length) * Math.PI * 2;
          return (
            <button type="button" key={item.id} role="menuitem" class="radial-item" style={{ transform: `translate(${Math.cos(ang) * raio}px, ${Math.sin(ang) * raio}px)`, animationDelay: `${i * 18}ms` }}
              title={item.atalho ? `${item.rotulo} (${mostrarAtalho(item.atalho)})` : item.rotulo} onClick={() => { menuRadial.value = null; item.fazer(); }}>
              <Icone nome={item.icone} /><span class="radial-rotulo">{item.rotulo}</span><span class="radial-numero">{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
