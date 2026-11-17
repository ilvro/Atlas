import { signal } from '@preact/signals';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import {
  type Momento,
  novoMomento,
  duracaoEstimada,
  descreverPasso,
} from '../domain/momentos.ts';
import {
  tocarMomentoDoMapa,
  pararMomento,
  momentoEmCurso,
  telaEscura,
  clarearTela,
} from '../app/app.ts';
import { tocar } from '../fx/som.ts';

export const CORES_TEMA = ['#9fe0b6', '#5aa9e6', '#ffd23f', '#ff7b72', '#b388ff', '#ff9e80'] as const;

export const momentoEmEdicao = signal<Momento | null>(null);

/** Seção "Momentos" no Dock (lista de momentos, tocar/parar, criar, atalho de clarear tela). */
export function SecaoDeMomentos({ s }: { s: SessaoDeEdicao }) {
  const momentos = Object.values(s.doc.value.moments);
  const emCurso = momentoEmCurso.value;

  const criarNovo = () => {
    const id = 'momento-' + Math.random().toString(36).slice(2, 8);
    momentoEmEdicao.value = novoMomento(id, 'Novo momento');
    tocar('pop');
  };

  return (
    <div class="dock-momentos" data-testid="dock-painel-momentos">
      {telaEscura.value && (
        <div class="dock-linha dock-linha-aviso">
          <button
            type="button"
            class="dock-pilula destaque"
            data-testid="dock-clarear-tela"
            onClick={() => clarearTela(300)}
          >
            Tela escura · Clarear
          </button>
        </div>
      )}

      <div class="dock-momentos-lista">
        {momentos.length === 0 ? (
          <p class="dock-dica" data-testid="dock-momentos-vazio">
            Nenhum momento criado neste mapa.
          </p>
        ) : (
          momentos.map(m => {
            const estaEmCurso = emCurso?.id === m.id;
            const dur = duracaoEstimada(m);
            const durTxt = dur > 0 ? `${(dur / 1000).toFixed(1).replace(/\.0$/, '')} s` : '0 s';
            const passoAtual = estaEmCurso && emCurso ? m.passos[emCurso.passo - 1] : null;

            return (
              <div
                key={m.id}
                class={`dock-momento-item ${estaEmCurso ? 'em-curso' : ''}`}
                data-testid={`dock-momento-${m.id}`}
              >
                <div class="dock-momento-topo">
                  <span
                    class="dock-momento-amostra"
                    style={{
                      backgroundColor: m.cor ?? 'transparent',
                      borderColor: m.cor ? m.cor : 'var(--linha-forte)',
                    }}
                    aria-hidden="true"
                  />
                  <span
                    class="dock-momento-nome"
                    title={m.nome}
                    onClick={() => { momentoEmEdicao.value = structuredClone(m); }}
                  >
                    {m.nome}
                  </span>
                  <span class="dock-momento-duracao" title="Duração estimada">{durTxt}</span>
                  <div class="dock-momento-acoes">
                    <button
                      type="button"
                      class="dock-painel-botao"
                      data-testid={`dock-momento-editar-${m.id}`}
                      title="Editar momento"
                      aria-label={`Editar ${m.nome}`}
                      onClick={() => { momentoEmEdicao.value = structuredClone(m); }}
                    >
                      ✎
                    </button>
                    {estaEmCurso ? (
                      <button
                        type="button"
                        class="dock-pilula destaque dock-momento-parar"
                        data-testid={`dock-momento-parar-${m.id}`}
                        title="Parar momento"
                        aria-label="Parar momento"
                        onClick={() => pararMomento()}
                      >
                        ■
                      </button>
                    ) : (
                      <button
                        type="button"
                        class="dock-pilula dock-momento-tocar"
                        data-testid="dock-momento-tocar"
                        title="Tocar momento"
                        aria-label={`Tocar ${m.nome}`}
                        onClick={() => void tocarMomentoDoMapa(m.id)}
                      >
                        ▶
                      </button>
                    )}
                  </div>
                </div>

                {estaEmCurso && emCurso && (
                  <div class="dock-momento-progresso" data-testid="dock-momento-progresso">
                    <div class="dock-momento-barra">
                      <div
                        class="dock-momento-barra-preenchimento"
                        style={{ width: `${(emCurso.passo / emCurso.total) * 100}%` }}
                      />
                    </div>
                    <span class="dock-momento-passo-texto">
                      Passo {emCurso.passo}/{emCurso.total}
                      {passoAtual ? ` · ${descreverPasso(passoAtual, s.doc.value)}` : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div class="dock-linha dock-linha-novo">
        <button
          type="button"
          class="dock-pilula destaque"
          data-testid="dock-novo-momento"
          onClick={criarNovo}
        >
          + Novo momento
        </button>
      </div>
    </div>
  );
}
