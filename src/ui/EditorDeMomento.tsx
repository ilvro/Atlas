import { useSignal } from '@preact/signals';
import { criarRef } from '#mesa';
import type { Ponto } from '../domain/mapa.ts';
import {
  type Momento,
  type PassoDeMomento,
  adicionarPasso,
  atualizarPasso,
  descreverPasso,
  duplicarPasso,
  duracaoEstimada,
  momentoValido,
  moverPasso,
  removerPasso,
} from '../domain/momentos.ts';
import { tocarMomentoLocal } from '../app/app.ts';
import { pistas } from '../app/pistas.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { avisar } from '../app/toasts.ts';
import { refDaPista } from '../data/pistas.ts';
import { tocar } from '../fx/som.ts';
import { CamposDoPasso } from './CamposDoPasso.tsx';
import { PainelFlutuante } from './Dock.tsx';
import { Icone } from './Icone.tsx';
import { CORES_TEMA } from './Momentos.tsx';

/** Editor flutuante de um momento com sua lista de passos. */
export function EditorDeMomento({
  s,
  momento,
  aoFechar,
}: {
  s: SessaoDeEdicao;
  momento: Momento;
  aoFechar: () => void;
}) {
  const local = useSignal<Momento>(structuredClone(momento));
  const expandido = useSignal<number | null>(null);
  const menuAberto = useSignal<boolean>(false);

  const dur = duracaoEstimada(local.value);
  const durTxt = dur > 0 ? `${(dur / 1000).toFixed(1).replace(/\.0$/, '')} s` : 'instantâneo';

  const salvar = () => {
    const erro = momentoValido(local.value);
    if (erro) {
      avisar(erro, { tipo: 'erro' });
      tocar('erro');
      return;
    }
    try {
      s.store.executar(
        { tipo: 'momento.salvar', momento: local.value },
        { rotulo: `Salvar momento "${local.value.nome}"` },
      );
      tocar('pop');
      aoFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'erro' });
    }
  };

  const testar = () => {
    tocar('selecionar');
    void tocarMomentoLocal(local.value);
  };

  const excluir = () => {
    if (s.doc.value.moments[local.value.id]) {
      if (window.confirm(`Excluir o momento "${local.value.nome}"?`)) {
        s.store.executar(
          { tipo: 'momento.remover', id: local.value.id },
          { rotulo: `Excluir momento "${local.value.nome}"` },
        );
        tocar('pop');
        aoFechar();
      }
    } else {
      aoFechar();
    }
  };

  const adicionarNovoPasso = (p: PassoDeMomento) => {
    local.value = adicionarPasso(local.value, p);
    expandido.value = local.value.passos.length - 1;
    menuAberto.value = false;
    tocar('pop');
  };

  return (
    <PainelFlutuante
      id="editor-momento"
      titulo={`Momento: ${local.value.nome || 'Novo momento'}`}
      icone="anim"
      onFechar={aoFechar}
    >
      <div class="editor-momento" data-testid="editor-momento">
        {/* Nome e Cor */}
        <div class="editor-momento-campos-topo">
          <label class="dock-rotulo">
            Nome do momento:
            <input
              type="text"
              class="campo-texto"
              data-testid="editor-momento-nome"
              value={local.value.nome}
              maxLength={60}
              placeholder="Nome descritivo…"
              onInput={e => {
                local.value = { ...local.value, nome: (e.target as HTMLInputElement).value };
              }}
            />
          </label>

          <div class="editor-momento-cores">
            <span class="dock-rotulo">Cor:</span>
            <div class="dock-linha">
              <button
                type="button"
                class={`amostra-cor neutra ${!local.value.cor ? 'selecionada' : ''}`}
                title="Sem cor"
                onClick={() => { local.value = { ...local.value, cor: null }; }}
              >
                ✕
              </button>
              {CORES_TEMA.map(hex => (
                <button
                  type="button"
                  key={hex}
                  class={`amostra-cor ${local.value.cor === hex ? 'selecionada' : ''}`}
                  style={{ backgroundColor: hex }}
                  data-testid={`editor-momento-cor-${hex}`}
                  title={`Cor ${hex}`}
                  onClick={() => {
                    local.value = { ...local.value, cor: local.value.cor === hex ? null : hex };
                  }}
                />
              ))}
            </div>
          </div>

          <div class="editor-momento-meta">
            <span class="dock-rotulo">Duração estimada:</span>
            <span class="editor-momento-duracao-txt">{durTxt}</span>
          </div>
        </div>

        {/* Lista de passos */}
        <div class="editor-momento-passos">
          <span class="dock-rotulo">Passos ({local.value.passos.length}/60):</span>

          {local.value.passos.length === 0 ? (
            <p class="dock-dica" data-testid="editor-passos-vazio">
              Nenhum passo adicionado. Use o botão "+ Passo" abaixo.
            </p>
          ) : (
            local.value.passos.map((p, idx) => {
              const desc = descreverPasso(p, s.doc.value);
              const sumiu = desc.includes('(sumiu)');
              const estaExpandido = expandido.value === idx;

              return (
                <div
                  key={idx}
                  class={`passo-item ${estaExpandido ? 'expandido' : ''} ${sumiu ? 'passo-item-sumiu' : ''}`}
                  data-testid={`passo-item-${idx}`}
                >
                  <div class="passo-linha">
                    <button
                      type="button"
                      class="passo-chevron"
                      title={estaExpandido ? 'Recolher detalhes' : 'Expandir detalhes'}
                      onClick={() => {
                        expandido.value = estaExpandido ? null : idx;
                      }}
                    >
                      {estaExpandido ? '▾' : '▸'}
                    </button>
                    <span class="passo-numero">#{idx + 1}</span>
                    <span
                      class={`passo-desc ${sumiu ? 'passo-sumiu' : ''}`}
                      title={desc}
                      onClick={() => {
                        expandido.value = estaExpandido ? null : idx;
                      }}
                    >
                      {desc}
                    </span>
                    <div class="passo-acoes">
                      <button
                        type="button"
                        class="dock-painel-botao"
                        disabled={idx === 0}
                        title="Mover para cima"
                        onClick={() => {
                          local.value = moverPasso(local.value, idx, idx - 1);
                          if (expandido.value === idx) expandido.value = idx - 1;
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        class="dock-painel-botao"
                        disabled={idx === local.value.passos.length - 1}
                        title="Mover para baixo"
                        onClick={() => {
                          local.value = moverPasso(local.value, idx, idx + 1);
                          if (expandido.value === idx) expandido.value = idx + 1;
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        class="dock-painel-botao"
                        disabled={local.value.passos.length >= 60}
                        title="Duplicar passo"
                        onClick={() => {
                          local.value = duplicarPasso(local.value, idx);
                        }}
                      >
                        <Icone nome="duplicar" tamanho={12} />
                      </button>
                      <button
                        type="button"
                        class="dock-painel-botao dock-fechar"
                        title="Remover passo"
                        onClick={() => {
                          local.value = removerPasso(local.value, idx);
                          if (expandido.value === idx) expandido.value = null;
                        }}
                      >
                        <Icone nome="lixeira" tamanho={12} />
                      </button>
                    </div>
                  </div>

                  {estaExpandido && (
                    <div class="passo-detalhe">
                      <CamposDoPasso
                        s={s}
                        passo={p}
                        aoAtualizar={novoP => {
                          local.value = atualizarPasso(local.value, idx, novoP);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Botão + Passo com menu popup */}
        <div class="editor-momento-adicionar">
          <button
            type="button"
            class="dock-pilula destaque"
            data-testid="editor-momento-add-passo"
            onClick={() => { menuAberto.value = !menuAberto.value; }}
          >
            + Passo
          </button>

          {menuAberto.value && (
            <div class="menu-adicionar-passo" data-testid="menu-adicionar-passo">
              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Tempo</span>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-esperar"
                  onClick={() => adicionarNovoPasso({ tipo: 'esperar', ms: 1000 })}
                >
                  Esperar
                </button>
              </div>

              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Som</span>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-som-cena"
                  onClick={() => adicionarNovoPasso({ tipo: 'som', ref: criarRef('jukebox', 'cena', 'padrao') })}
                >
                  Cena do Jukebox
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-som-efeito"
                  onClick={() => adicionarNovoPasso({ tipo: 'som', ref: criarRef('jukebox', 'efeito', 'padrao') })}
                >
                  Efeito do Jukebox
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-silencio"
                  onClick={() => adicionarNovoPasso({ tipo: 'silencio', ms: 1000 })}
                >
                  Silêncio (fade)
                </button>
              </div>

              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Mapa</span>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-efeito"
                  onClick={() => adicionarNovoPasso({ tipo: 'efeito', efeito: 'relampago' })}
                >
                  Efeito de cena
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-clima"
                  onClick={() => adicionarNovoPasso({ tipo: 'clima', clima: 'noite' })}
                >
                  Clima
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-camera"
                  onClick={() => {
                    const salaId = Object.keys(s.doc.value.rooms)[0] ?? '';
                    adicionarNovoPasso({ tipo: 'camera', alvo: { colecao: 'rooms', id: salaId } });
                  }}
                >
                  Câmera
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-revelar"
                  onClick={() => adicionarNovoPasso({ tipo: 'revelar', ids: Object.keys(s.doc.value.rooms).slice(0, 1) })}
                >
                  Revelar cômodo
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-interagir"
                  onClick={() => {
                    const id = Object.keys(s.doc.value.openings)[0] ?? Object.keys(s.doc.value.props)[0] ?? '';
                    adicionarNovoPasso({ tipo: 'interagir', id });
                  }}
                >
                  Interagir (porta / objeto)
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-luz"
                  onClick={() => adicionarNovoPasso({ tipo: 'luz', ids: Object.keys(s.doc.value.lights).slice(0, 1), acao: 'alternar' })}
                >
                  Luz (ligar / desligar)
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-objeto"
                  onClick={() => adicionarNovoPasso({ tipo: 'objeto', ids: Object.keys(s.doc.value.props).slice(0, 1), acao: 'mostrar' })}
                >
                  Objeto (mostrar / esconder)
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-agua"
                  onClick={() => {
                    const selReg = s.selecao.value.find(item => item.colecao === 'regions');
                    const reg = selReg ? s.doc.value.regions[selReg.id] : null;
                    const poligono: Ponto[] = reg && reg.polygon.length >= 3
                      ? reg.polygon.map(p => [p[0], p[1]] as Ponto)
                      : [[0, 0], [5, 0], [5, 5], [0, 5]];
                    adicionarNovoPasso({ tipo: 'agua', poligono, material: 'agua.lago', ms: 3000, etapas: 6 });
                  }}
                >
                  Água que sobe
                </button>
              </div>

              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Projetor</span>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-tela"
                  onClick={() => adicionarNovoPasso({ tipo: 'tela', acao: 'escurecer', ms: 800 })}
                >
                  Cortina (tela preta)
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  data-testid="menu-add-letreiro"
                  onClick={() => adicionarNovoPasso({ tipo: 'letreiro', titulo: 'Capítulo', subtitulo: '', peca: null, estilo: 'capitulo', ms: 4000 })}
                >
                  Letreiro
                </button>
              </div>

              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Mestre</span>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => {
                    const p = pistas.value[0];
                    const ref = p ? refDaPista(p.id) : criarRef('atelie', 'documento', 'pista-1');
                    adicionarNovoPasso({ tipo: 'pista', ref, mostrar: true });
                  }}
                >
                  Pista
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => adicionarNovoPasso({ tipo: 'nota', texto: '' })}
                >
                  Nota
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de ações */}
        <div class="editor-momento-rodape">
          <button
            type="button"
            class="dock-pilula"
            data-testid="editor-momento-testar"
            title="Toca o momento localmente sem salvar"
            onClick={testar}
          >
            ▶ Testar
          </button>
          <button
            type="button"
            class="dock-pilula destaque"
            data-testid="editor-momento-salvar"
            onClick={salvar}
          >
            Salvar
          </button>
          {s.doc.value.moments[local.value.id] && (
            <button
              type="button"
              class="dock-pilula dock-pilula-perigo"
              data-testid="editor-momento-excluir"
              onClick={excluir}
            >
              Excluir
            </button>
          )}
          <button
            type="button"
            class="dock-pilula"
            data-testid="editor-momento-fechar"
            onClick={aoFechar}
          >
            Fechar
          </button>
        </div>
      </div>
    </PainelFlutuante>
  );
}
