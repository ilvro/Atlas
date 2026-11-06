import { useEffect, useRef } from 'preact/hooks';
import { alinhandoGrade } from '../app/modo.ts';
import { CORES_DE_GRADE } from '../domain/mapa.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import type { Gesto } from '../state/store.ts';
import { tocar } from '../fx/som.ts';

export { CORES_DE_GRADE };

export function ConfiguracaoDeGrade({
  s,
  aoFechar,
}: {
  s: SessaoDeEdicao;
  aoFechar: () => void;
}) {
  const m = s.doc.value;
  const gestoOpacidade = useRef<Gesto | null>(null);
  const gestoEspessura = useRef<Gesto | null>(null);

  useEffect(() => {
    return () => {
      if (gestoOpacidade.current?.ativo) gestoOpacidade.current.concluir();
      if (gestoEspessura.current?.ativo) gestoEspessura.current.concluir();
    };
  }, []);

  const aoMudarOpacidade = (v: number) => {
    if (!gestoOpacidade.current || !gestoOpacidade.current.ativo) {
      gestoOpacidade.current = s.store.iniciarGesto('Opacidade da grade');
    }
    gestoOpacidade.current.aplicar({ tipo: 'grade.atualizar', patch: { opacity: v } });
  };

  const aoConcluirOpacidade = (v: number) => {
    if (gestoOpacidade.current?.ativo) {
      gestoOpacidade.current.concluir();
      gestoOpacidade.current = null;
    } else {
      s.store.executar({ tipo: 'grade.atualizar', patch: { opacity: v } }, { rotulo: 'Opacidade da grade' });
    }
  };

  const aoMudarEspessura = (v: number) => {
    if (!gestoEspessura.current || !gestoEspessura.current.ativo) {
      gestoEspessura.current = s.store.iniciarGesto('Espessura da grade');
    }
    gestoEspessura.current.aplicar({ tipo: 'grade.atualizar', patch: { lineWidth: v } });
  };

  const aoConcluirEspessura = (v: number) => {
    if (gestoEspessura.current?.ativo) {
      gestoEspessura.current.concluir();
      gestoEspessura.current = null;
    } else {
      s.store.executar({ tipo: 'grade.atualizar', patch: { lineWidth: v } }, { rotulo: 'Espessura da grade' });
    }
  };

  return (
    <div
      class="popover-barra-inferior popover-configuracao-grade"
      role="dialog"
      aria-label="Configurações da Grade"
      data-testid="popover-grade"
      onClick={e => e.stopPropagation()}
    >
      <div class="configuracao-grade-cabecalho">
        <span class="configuracao-grade-titulo">Configurações da Grade</span>
        <div class="configuracao-grade-acoes">
          <button
            type="button"
            class={`botao-alinhamento ${alinhandoGrade.value ? 'ativo' : ''}`}
            data-testid="grade-modo-alinhamento"
            title="Calibrar posição e tamanho da grade com o mouse"
            onClick={() => {
              alinhandoGrade.value = !alinhandoGrade.value;
              tocar('pop');
            }}
          >
            <span>✥</span>
            <span>Modo de Alinhamento</span>
          </button>
          <button
            type="button"
            class="botao-fechar-grade"
            aria-label="Fechar configurações da grade"
            data-testid="grade-fechar"
            onClick={aoFechar}
          >
            ×
          </button>
        </div>
      </div>

      <div class="grade-colunas">
        {/* Coluna Esquerda: Parâmetros e Modos */}
        <div class="grade-coluna-esquerda">
          <label class="grade-linha-toggle">
            <span>Mostrar grade</span>
            <input
              type="checkbox"
              data-testid="grade-mostrar"
              checked={m.grid.visible}
              onChange={e => {
                const checked = (e.target as HTMLInputElement).checked;
                s.store.executar(
                  { tipo: 'grade.atualizar', patch: { visible: checked } },
                  { rotulo: checked ? 'Mostrar a grade' : 'Esconder a grade' }
                );
              }}
            />
          </label>

          <label class="grade-linha-toggle">
            <span>Encaixar na grade</span>
            <input
              type="checkbox"
              data-testid="grade-encaixar"
              checked={m.grid.snap}
              onChange={e => {
                const checked = (e.target as HTMLInputElement).checked;
                s.store.executar(
                  { tipo: 'grade.atualizar', patch: { snap: checked } },
                  { rotulo: checked ? 'Encaixar na grade' : 'Desencaixar da grade' }
                );
              }}
            />
          </label>

          <label class="grade-campo-select">
            <span>Tipo de grade</span>
            <select
              data-testid="grade-tipo"
              value={m.grid.kind}
              onChange={e => {
                const v = (e.target as HTMLSelectElement).value as 'square' | 'hex';
                s.store.executar(
                  { tipo: 'grade.atualizar', patch: { kind: v } },
                  { rotulo: 'Tipo de grade' }
                );
              }}
            >
              <option value="square">Quadrada</option>
              <option value="hex">Hexagonal</option>
            </select>
          </label>

          <label class="grade-campo-select">
            <span>Estilo da linha</span>
            <select
              data-testid="grade-estilo-linha"
              value={m.grid.lineStyle}
              onChange={e => {
                const v = (e.target as HTMLSelectElement).value as 'solid' | 'dashed' | 'dotted' | 'corners';
                s.store.executar(
                  { tipo: 'grade.atualizar', patch: { lineStyle: v } },
                  { rotulo: 'Estilo da grade' }
                );
              }}
            >
              <option value="solid">Sólida</option>
              <option value="dashed">Tracejada</option>
              <option value="dotted">Pontilhada</option>
              <option value="corners">Cantos</option>
            </select>
          </label>

          <div class="grade-campo-slider">
            <div class="slider-topo">
              <span>Opacidade</span>
              <b>{Math.round(m.grid.opacity * 100)}%</b>
            </div>
            <input
              type="range"
              data-testid="grade-opacidade"
              min={0.05}
              max={1}
              step={0.05}
              value={m.grid.opacity}
              onInput={e => aoMudarOpacidade(Number((e.target as HTMLInputElement).value))}
              onChange={e => aoConcluirOpacidade(Number((e.target as HTMLInputElement).value))}
              onPointerUp={e => aoConcluirOpacidade(Number((e.target as HTMLInputElement).value))}
            />
          </div>

          <div class="grade-campo-slider">
            <div class="slider-topo">
              <span>Espessura da linha</span>
              <b>{m.grid.lineWidth} px</b>
            </div>
            <input
              type="range"
              data-testid="grade-espessura"
              min={0.5}
              max={5}
              step={0.5}
              value={m.grid.lineWidth}
              onInput={e => aoMudarEspessura(Number((e.target as HTMLInputElement).value))}
              onChange={e => aoConcluirEspessura(Number((e.target as HTMLInputElement).value))}
              onPointerUp={e => aoConcluirEspessura(Number((e.target as HTMLInputElement).value))}
            />
          </div>

          <label class="grade-campo-numero">
            <span>Tamanho da célula</span>
            <div class="numero-com-unidade">
              <input
                type="number"
                data-testid="grade-tamanho"
                step={0.25}
                min={0.25}
                max={10}
                value={m.grid.size}
                onChange={e => {
                  const v = Number((e.target as HTMLInputElement).value);
                  if (Number.isFinite(v) && v >= 0.25 && v <= 10) {
                    s.store.executar(
                      { tipo: 'grade.atualizar', patch: { size: v } },
                      { rotulo: 'Tamanho da célula' }
                    );
                  }
                }}
              />
              <span class="unidade">m</span>
            </div>
          </label>
        </div>

        {/* Coluna Direita: Cores */}
        <div class="grade-coluna-direita">
          <div class="grade-secao-rotulo">Cor</div>
          <div class="grade-cores-grid" role="radiogroup" aria-label="Cor da grade">
            {CORES_DE_GRADE.map(cor => {
              const ativo = m.grid.color === cor;
              const ehAuto = cor === 'auto';
              const testeId = ehAuto ? 'grade-cor-auto' : `grade-cor-${cor.replace('#', '')}`;
              const textoCor = cor === '#ffffff' || cor === '#ffff00' || cor === '#1fff1f' ? '#07080b' : '#ffffff';

              return (
                <button
                  type="button"
                  key={cor}
                  role="radio"
                  aria-checked={ativo}
                  title={ehAuto ? 'Auto-contraste P&B (sombra escura + linha clara)' : cor}
                  class={`swatch-cor ${ehAuto ? 'swatch-auto' : ''} ${ativo ? 'ativo' : ''}`}
                  style={!ehAuto ? { backgroundColor: cor } : undefined}
                  data-testid={testeId}
                  onClick={() => {
                    s.store.executar(
                      { tipo: 'grade.atualizar', patch: { color: cor } },
                      { rotulo: 'Cor da grade' }
                    );
                  }}
                >
                  {ativo && (
                    <span class="swatch-check" style={{ color: textoCor }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
