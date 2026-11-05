import { movimentoReduzido, fxPreferido } from '../fx/fx.ts';

/** Transição entre telas: glitch no tema Ordem, mancha de tinta na Vigília, fade no Neutro. A troca acontece no meio. */
export function comTransicao<T>(trocar: () => T | Promise<T>): Promise<T> {
  const el = document.getElementById('transicao');
  if (!el || movimentoReduzido() || !fxPreferido()) return Promise.resolve(trocar());
  const tipo = document.documentElement.dataset.transicao ?? 'fade';
  el.className = `transicao ${tipo} ativa`;
  return new Promise((resolver, rejeitar) => {
    setTimeout(async () => {
      try { resolver(await trocar()); } catch (erro) { rejeitar(erro); } finally { setTimeout(() => { el.className = 'transicao'; }, 240); }
    }, 170);
  });
}
