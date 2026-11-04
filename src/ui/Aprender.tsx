import { signal } from '@preact/signals';
import { exportarRelatorioDosTutoriais, iniciarLicao, tutor } from '../app/tutoriais.ts';
import { LICOES, PASTAS_DE_LICOES } from '../tutorial/licoes.ts';
import { porPasta } from '../tutorial/tutor.ts';

export const aprenderAberto = signal(false);

/** A lista de tutoriais, em pastas, com o que já foi feito e onde a pessoa parou. Cada lição acontece num mapa de treino. */
export function Aprender() {
  if (!aprenderAberto.value) return null;
  void tutor.versao.value;
  const progresso = tutor.progresso(), grupos = porPasta(LICOES, PASTAS_DE_LICOES);
  return (
    <section class="aprender" data-testid="aprender-lista" aria-label="Tutoriais">
      <p class="dica">Cada tutorial acontece num <b>mapa de treino</b> criado por ele: o tutor aponta, você faz, e o passo avança quando o resultado aparece. Os seus mapas não são tocados.</p>
      {grupos.map(({ pasta, licoes }) => (
        <div key={pasta.id ?? 'outros'} class="aprender-pasta">
          <h3 class="faixa pequena">{pasta.nome}</h3>{pasta.sobre && <p class="dica">{pasta.sobre}</p>}
          {licoes.map(l => {
            const p = progresso[l.id] ?? {}, retomar = !p.done && (p.step ?? 0) > 0;
            return (
              <article key={l.id} class="aprender-licao" data-testid={`licao-${l.id}`}>
                <h4>{l.titulo}{p.done && <span class="aprender-feita"> ✓ feita</span>}<small> · {l.minutos} min · {l.passos.length} passos</small></h4>
                {l.resumo && <p class="dica">{l.resumo}</p>}
                <div class="aprender-acoes">
                  <button type="button" class="botao-pilula destaque" data-testid={`licao-comecar-${l.id}`} onClick={() => void iniciarLicao(l.id)}>{p.done ? 'Refazer' : 'Começar'}</button>
                  {retomar && <button type="button" class="botao-pilula" data-testid={`licao-retomar-${l.id}`} onClick={() => void iniciarLicao(l.id, p.step ?? 0)}>Continuar do passo {(p.step ?? 0) + 1}</button>}
                </div>
              </article>
            );
          })}
        </div>
      ))}
      <button type="button" class="link" data-testid="tutoriais-relatorio" onClick={exportarRelatorioDosTutoriais}>Exportar relatório dos tutoriais</button>
    </section>
  );
}
