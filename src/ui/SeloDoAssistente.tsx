// Só em desenvolvimento: importado por `app/ponte.ts` (que entra por `import()` sob `import.meta.env.DEV`); o estilo vai junto, num <style>, para não ir ao build.
import { signal } from '@preact/signals';
import { pedidos } from '../app/atividade-do-assistente.ts';
import { PainelDoAssistente } from './PainelDoAssistente.tsx';
import type { EstadoDaPonte } from '#mesa/ponte';

const painelAberto = signal(false);
export const estadoDaPonte = signal<EstadoDaPonte | null>(null);

const ESTILO = `
.selo-assistente { font-family: inherit; color: inherit; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid var(--linha); border-radius: 999px; background: var(--acento-suave); font-size: 12px; line-height: 1.4; cursor: pointer; user-select: none; }
.selo-assistente:hover, .selo-assistente[aria-expanded='true'] { border-color: var(--acento); }
.selo-assistente .pedidos { min-width: 16px; padding: 0 5px; border-radius: 999px; background: var(--acento); color: var(--acento-texto); font-weight: 700; text-align: center; }
.selo-assistente .ponto { width: 8px; height: 8px; border-radius: 50%; background: var(--sucesso); }
.selo-assistente.trabalhando .ponto { animation: selo-assistente-pulsa 1s ease-in-out infinite; }
@keyframes selo-assistente-pulsa { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(1.4); } }
@media (prefers-reduced-motion: reduce) { .selo-assistente.trabalhando .ponto { animation: none; box-shadow: 0 0 0 3px var(--acento-media); } }
`;

export function SeloDoAssistente() {
  const e = estadoDaPonte.value, esperando = pedidos.value.length;
  if (!e || e.conexao !== 'conectada') return null;
  const n = e.ferramentas;
  return (
    <>
      <button type="button" class={`selo-assistente ${e.ocupada ? 'trabalhando' : ''}`} data-testid="selo-assistente" aria-expanded={painelAberto.value} onClick={() => { painelAberto.value = !painelAberto.value; }}
        title={`Assistente conectado: esta aba oferece ${n} ${n === 1 ? 'ferramenta' : 'ferramentas'}${e.ocupada ? ' (trabalhando agora)' : ''}${esperando ? `; ${esperando} ${esperando === 1 ? 'pedido espera' : 'pedidos esperam'} a sua resposta` : ''}`}>
        <style>{ESTILO}</style>
        <span class="ponto" aria-hidden="true" />Assistente{esperando ? <span class="pedidos" data-testid="selo-pedidos">{esperando}</span> : null}
      </button>
      {painelAberto.value || esperando ? <PainelDoAssistente /> : null}
    </>
  );
}
