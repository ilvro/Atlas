import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { buscarAcoes, executarAcao } from '../app/acoes.ts';
import { paletaAberta } from '../app/app.ts';
import { mostrarAtalho } from '../app/atalhos.ts';

/** Ctrl+K: acha qualquer ação pelo nome, sem acento, e a executa. Não é um modal: Esc ou um clique fora fecham. */
export function Paleta() {
  const consulta = useSignal(''), ativo = useSignal(0), entrada = useRef<HTMLInputElement>(null);
  useEffect(() => { if (paletaAberta.value) { consulta.value = ''; ativo.value = 0; setTimeout(() => entrada.current?.focus(), 0); } }, [paletaAberta.value]);
  if (!paletaAberta.value) return null;
  const resultados = buscarAcoes(consulta.value).slice(0, 12);
  const fechar = () => { paletaAberta.value = false; };
  const rodar = (i: number) => { const a = resultados[i]; if (!a) return; fechar(); setTimeout(() => executarAcao(a), 0); };
  return (
    <div class="paleta-fundo" onPointerDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div class="paleta" role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-owns="paleta-lista" data-testid="paleta">
        <input ref={entrada} class="paleta-campo" type="text" placeholder="O que você quer fazer?" aria-label="Buscar comando" aria-controls="paleta-lista" autocomplete="off" spellcheck={false}
          aria-activedescendant={resultados[ativo.value] ? `acao-${resultados[ativo.value]!.id}` : undefined}
          value={consulta.value} onInput={e => { consulta.value = (e.target as HTMLInputElement).value; ativo.value = 0; }}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); ativo.value = (ativo.value + 1) % Math.max(1, resultados.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); ativo.value = (ativo.value - 1 + resultados.length) % Math.max(1, resultados.length); }
            else if (e.key === 'Enter') { e.preventDefault(); rodar(ativo.value); }
          }} />
        <ul id="paleta-lista" class="paleta-lista" role="listbox">
          {resultados.map((a, i) => (
            <li key={a.id} id={`acao-${a.id}`} role="option" aria-selected={i === ativo.value} class={i === ativo.value ? 'ativo' : ''} onMouseMove={() => { ativo.value = i; }} onClick={() => rodar(i)}>
              <span class="paleta-grupo">{a.grupo}</span><span class="paleta-nome">{a.nome}</span>
              {a.atalhos?.[0] && <kbd>{mostrarAtalho(a.atalhos[0])}</kbd>}
            </li>
          ))}
          {!resultados.length && <li class="paleta-vazio">Nenhum comando com “{consulta.value}”.</li>}
        </ul>
      </div>
    </div>
  );
}
