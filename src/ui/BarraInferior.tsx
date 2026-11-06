import { useState, useRef, useEffect } from 'preact/hooks';
import { acaoPorId, executarAcao } from '../app/acoes.ts';
import { mostrarAtalho } from '../app/atalhos.ts';
import { ROTULO_DA_FERRAMENTA, type Ferramenta } from '../render/pincel.ts';
import {
  FERRAMENTAS_DA_SESSAO,
  modo,
  regraDaRegua,
  definirRegraDaRegua,
  vistaDeJogador,
} from '../app/modo.ts';
import { ROTULO_DA_REGRA, type RegraDeDiagonal } from '../domain/regua.ts';
import { abrirProjetor } from '../app/app.ts';
import {
  projetorConectado,
  seguirJogadores,
  mostrarQuadroDoProjetor,
} from '../app/projetor.ts';
import { definirMostrarPvNoProjetor, mostrarPvNoProjetor } from '../app/fichas.ts';
import { abrirSecaoNoDock } from '../app/dock.ts';
import { Icone } from './Icone.tsx';
import { ConfiguracaoDeGrade } from './ConfiguracaoDeGrade.tsx';
import type { SessaoDeEdicao } from '../app/sessao.ts';

const FERRAMENTAS: { id: Ferramenta; icone: string }[] = [
  { id: 'selecionar', icone: 'selecionar' },
  { id: 'mao', icone: 'mao' },
  { id: 'comodo', icone: 'comodo' },
  { id: 'borracha', icone: 'borracha' },
  { id: 'parede', icone: 'parede' },
  { id: 'abertura', icone: 'porta' },
  { id: 'objeto', icone: 'objeto' },
  { id: 'luz', icone: 'luz' },
  { id: 'peca', icone: 'peca' },
  { id: 'regiao', icone: 'regiao' },
  { id: 'terreno', icone: 'terreno' },
  { id: 'presenca', icone: 'presenca' },
  { id: 'espalhar', icone: 'espalhar' },
  { id: 'regua', icone: 'regua' },
];

export function BarraInferior({ s }: { s: SessaoDeEdicao }) {
  const [menuAberto, setMenuAberto] = useState<'regua' | 'grade' | 'projetor' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(alvo)) {
        setMenuAberto(null);
      }
    };
    const aoPressionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(null);
    };
    window.addEventListener('mousedown', aoClicarFora);
    window.addEventListener('keydown', aoPressionarTecla);
    return () => {
      window.removeEventListener('mousedown', aoClicarFora);
      window.removeEventListener('keydown', aoPressionarTecla);
    };
  }, [menuAberto]);

  const executar = (id: string) => {
    const a = acaoPorId(id);
    if (a) executarAcao(a);
  };

  const ferramentasVisiveis = FERRAMENTAS.filter(
    f => modo.value === 'construir' || FERRAMENTAS_DA_SESSAO.includes(f.id)
  );

  return (
    <div class="barra-inferior-container" ref={containerRef} data-testid="barra-inferior">
      {/* Submenus flutuantes posicionados acima da barra */}
      {menuAberto === 'regua' && (
        <div class="popover-barra-inferior popover-regua" role="menu" data-testid="popover-regua">
          <div class="popover-titulo">Contagem de Diagonais</div>
          {(Object.keys(ROTULO_DA_REGRA) as RegraDeDiagonal[]).map(r => (
            <button
              type="button"
              key={r}
              class={`popover-item ${regraDaRegua.value === r ? 'ativo' : ''}`}
              role="menuitemradio"
              aria-checked={regraDaRegua.value === r}
              data-testid={`opcao-regua-${r}`}
              onClick={() => {
                definirRegraDaRegua(r);
                setMenuAberto(null);
              }}
            >
              <span>{ROTULO_DA_REGRA[r]}</span>
              {regraDaRegua.value === r && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}

      {menuAberto === 'grade' && (
        <ConfiguracaoDeGrade s={s} aoFechar={() => setMenuAberto(null)} />
      )}

      {menuAberto === 'projetor' && (
        <div class="popover-barra-inferior popover-projetor" role="menu" data-testid="popover-projetor">
          <div class="popover-titulo">Controles do Projetor</div>
          <button
            type="button"
            class="popover-item destaque"
            data-testid="barra-projetor-abrir"
            onClick={() => {
              abrirProjetor();
              setMenuAberto(null);
            }}
          >
            <Icone nome="enquadrar" tamanho={14} />
            <span>Abrir janela do projetor</span>
          </button>
          <div class="popover-item info">
            <span>Status:</span>
            <span class={`status-badge ${projetorConectado.value ? 'conectado' : ''}`}>
              {projetorConectado.value ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <button
            type="button"
            class={`popover-item ${seguirJogadores.value ? 'ativo' : ''}`}
            role="menuitemcheckbox"
            aria-checked={seguirJogadores.value}
            data-testid="barra-projetor-seguir"
            onClick={() => {
              seguirJogadores.value = !seguirJogadores.value;
            }}
          >
            <span>Seguir os jogadores</span>
            {seguirJogadores.value && <span aria-hidden="true">✓</span>}
          </button>
          <button
            type="button"
            class={`popover-item ${mostrarQuadroDoProjetor.value ? 'ativo' : ''}`}
            role="menuitemcheckbox"
            aria-checked={mostrarQuadroDoProjetor.value}
            data-testid="barra-projetor-quadro"
            onClick={() => {
              mostrarQuadroDoProjetor.value = !mostrarQuadroDoProjetor.value;
            }}
          >
            <span>Mostrar quadro no mapa</span>
            {mostrarQuadroDoProjetor.value && <span aria-hidden="true">✓</span>}
          </button>
          <button
            type="button"
            class={`popover-item ${mostrarPvNoProjetor.value ? 'ativo' : ''}`}
            role="menuitemcheckbox"
            aria-checked={mostrarPvNoProjetor.value}
            data-testid="barra-projetor-pv"
            onClick={() => {
              definirMostrarPvNoProjetor(!mostrarPvNoProjetor.value);
            }}
          >
            <span>Mostrar PV aos jogadores</span>
            {mostrarPvNoProjetor.value && <span aria-hidden="true">✓</span>}
          </button>
          {modo.value === 'sessao' && (
            <button
              type="button"
              class="popover-item"
              data-testid="barra-projetor-painel-dock"
              onClick={() => {
                abrirSecaoNoDock('projetor');
                setMenuAberto(null);
              }}
            >
              <Icone nome="gaveta" tamanho={13} />
              <span>Abrir painel no Dock</span>
            </button>
          )}
        </div>
      )}

      {/* Barra de utilidades unificada */}
      <div class="barra-inferior">
        {/* Bloco Esquerdo: Histórico (Desfazer / Refazer) */}
        <div class="barra-inferior-bloco barra-inferior-esquerda" aria-label="Histórico">
          <button
            type="button"
            class="barra-inferior-botao"
            title={s.rotuloDesfazer.value ? `Desfazer: ${s.rotuloDesfazer.value} (Ctrl+Z)` : 'Desfazer (Ctrl+Z)'}
            disabled={!s.podeDesfazer.value}
            onClick={() => executar('desfazer')}
            data-testid="barra-desfazer"
            aria-label="Desfazer"
          >
            <Icone nome="desfazer" tamanho={16} />
          </button>
          <button
            type="button"
            class="barra-inferior-botao"
            title={s.rotuloRefazer.value ? `Refazer: ${s.rotuloRefazer.value} (Ctrl+Shift+Z)` : 'Refazer (Ctrl+Shift+Z)'}
            disabled={!s.podeRefazer.value}
            onClick={() => executar('refazer')}
            data-testid="barra-refazer"
            aria-label="Refazer"
          >
            <Icone nome="refazer" tamanho={16} />
          </button>
        </div>

        <div class="barra-inferior-divisor" />

        {/* Bloco Central: Ferramentas e Utilidades */}
        <nav class="ferramentas" aria-label="Ferramentas">
          {ferramentasVisiveis.map((f, i) => {
            const atalhos = acaoPorId(`ferr-${f.id}`)?.atalhos ?? [];
            const letra = atalhos[0];
            const ativa = s.ferramenta.value === f.id;
            const temSubmenu = f.id === 'regua';

            return (
              <div key={f.id} class="item-ferramenta-grupo">
                <button
                  type="button"
                  class={`ferramenta ${ativa ? 'ativa' : ''}`}
                  aria-pressed={ativa}
                  title={`${ROTULO_DA_FERRAMENTA[f.id]}${letra ? ` (${atalhos.map(mostrarAtalho).join(' ou ')})` : ''}`}
                  data-testid={`ferramenta-${f.id}`}
                  onClick={() => executar(`ferr-${f.id}`)}
                >
                  <Icone nome={f.icone} tamanho={18} />
                  {i < 9 && f.id !== 'regua' && <span class="numero-ferramenta">{i + 1}</span>}
                </button>
                {temSubmenu && (
                  <button
                    type="button"
                    class={`submenu-gatilho ${menuAberto === 'regua' ? 'aberto' : ''}`}
                    title="Opções da régua"
                    aria-label="Opções da régua"
                    aria-expanded={menuAberto === 'regua'}
                    data-testid="submenu-regua"
                    onClick={e => {
                      e.stopPropagation();
                      setMenuAberto(menuAberto === 'regua' ? null : 'regua');
                    }}
                  >
                    ▾
                  </button>
                )}
              </div>
            );
          })}

          <span class="barra-inferior-separador" />

          {modo.value === 'construir' && (
            <button
              type="button"
              class={`ferramenta ${s.biblioteca.value ? 'ativa' : ''}`}
              aria-pressed={s.biblioteca.value}
              title="Biblioteca (B)"
              onClick={() => {
                s.biblioteca.value = !s.biblioteca.value;
              }}
              data-testid="alternar-biblioteca"
            >
              <Icone nome="gaveta" tamanho={18} />
            </button>
          )}

          <button
            type="button"
            class="ferramenta"
            title="Enquadrar o mapa (F)"
            onClick={() => executar('enquadrar')}
            data-testid="enquadrar"
          >
            <Icone nome="enquadrar" tamanho={18} />
          </button>

          {modo.value === 'construir' && (
            <div class="item-ferramenta-grupo">
              <button
                type="button"
                class={`ferramenta ${s.doc.value.grid.visible ? 'ativa' : ''}`}
                aria-pressed={s.doc.value.grid.visible}
                title="Grade (G)"
                onClick={() => executar('grade')}
                data-testid="alternar-grade"
              >
                <Icone nome="grade" tamanho={18} />
              </button>
              <button
                type="button"
                class={`submenu-gatilho ${menuAberto === 'grade' ? 'aberto' : ''}`}
                title="Opções da grade"
                aria-label="Opções da grade"
                aria-expanded={menuAberto === 'grade'}
                data-testid="submenu-grade"
                onClick={e => {
                  e.stopPropagation();
                  setMenuAberto(menuAberto === 'grade' ? null : 'grade');
                }}
              >
                ▾
              </button>
            </div>
          )}
        </nav>

        <div class="barra-inferior-divisor" />

        {/* Bloco Direito: Olho da Vista de Jogador & Opções do Projetor */}
        <div class="barra-inferior-bloco barra-inferior-direita" aria-label="Vista de jogador e projetor">
          <div class="grupo-vista-jogador">
            <button
              type="button"
              class={`botao-vista-jogador ${vistaDeJogador.value ? 'ativa' : ''}`}
              aria-pressed={vistaDeJogador.value}
              title="Ver como jogador (V)"
              data-testid="barra-vista-jogador"
              onClick={() => executar('vista-jogador')}
            >
              <Icone nome="olho" tamanho={15} />
              <span>Jogador</span>
            </button>
            <button
              type="button"
              class={`botao-chevron-projetor ${menuAberto === 'projetor' ? 'aberto' : ''}`}
              title="Opções do Projetor"
              aria-label="Opções do Projetor"
              aria-expanded={menuAberto === 'projetor'}
              data-testid="barra-projetor-menu"
              onClick={e => {
                e.stopPropagation();
                setMenuAberto(menuAberto === 'projetor' ? null : 'projetor');
              }}
            >
              ▾
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
