import { jogadorSeguido, seguirJogadores } from '../app/projetor.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';

/** Escolhe quem o projetor segue: todos os jogadores ou uma peça só. Escolher uma peça liga o seguimento. */
export function SeletorDeJogadorSeguido({ s, testid }: { s: SessaoDeEdicao; testid: string }) {
  const jogadores = Object.values(s.doc.value.tokens).filter(t => t.player);
  const atual = jogadores.some(t => t.id === jogadorSeguido.value) ? jogadorSeguido.value! : '';
  return (
    <select
      class="dock-seletor-seguir"
      data-testid={testid}
      aria-label="Quem o projetor segue"
      value={atual}
      onClick={e => e.stopPropagation()}
      onChange={e => {
        const v = (e.target as HTMLSelectElement).value;
        jogadorSeguido.value = v || null;
        if (v) seguirJogadores.value = true;
      }}
    >
      <option value="">Todos os jogadores</option>
      {jogadores.map(t => <option key={t.id} value={t.id}>{t.name || 'Jogador sem nome'}</option>)}
    </select>
  );
}
