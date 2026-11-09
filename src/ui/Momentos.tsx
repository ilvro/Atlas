import { signal, useSignal } from '@preact/signals';
import { criarRef, type Ref } from '#mesa';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import {
  type Momento,
  type PassoDeMomento,
  type EfeitoDeCena,
  novoMomento,
  duracaoEstimada,
  descreverPasso,
  moverPasso,
  duplicarPasso,
  removerPasso,
  adicionarPasso,
  atualizarPasso,
  momentoValido,
} from '../domain/momentos.ts';
import { EVENTOS_DE_CENA, ROTULO_DO_EVENTO } from '../render/eventos-de-cena.ts';
import { PRESETS_DE_CLIMA } from '../domain/presets.ts';
import { pistas } from '../app/pistas.ts';
import { idDaPista, refDaPista } from '../data/pistas.ts';
import { EscolherCena } from './EscolherCena.tsx';
import { Icone } from './Icone.tsx';
import { PainelFlutuante } from './Dock.tsx';
import {
  tocarMomentoDoMapa,
  tocarMomentoLocal,
  pararMomento,
  momentoEmCurso,
  telaEscura,
  clarearTela,
} from '../app/app.ts';
import { avisar } from '../app/toasts.ts';
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
                        data-testid={`dock-momento-tocar-${m.id}`}
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

/** Formulário para editar campos específicos de um passo. */
function CamposDoPasso({
  s,
  passo,
  aoAtualizar,
}: {
  s: SessaoDeEdicao;
  passo: PassoDeMomento;
  aoAtualizar: (novoPasso: PassoDeMomento) => void;
}) {
  const doc = s.doc.value;

  switch (passo.tipo) {
    case 'esperar': {
      const atalhos = [0.5, 1, 2, 5];
      return (
        <div class="campos-passo campos-esperar">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Atalhos:</span>
            {atalhos.map(sVal => (
              <button
                type="button"
                key={sVal}
                class={`dock-pilula ${passo.ms === sVal * 1000 ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, ms: sVal * 1000 })}
              >
                {sVal} s
              </button>
            ))}
          </div>
          <div class="campos-passo-linha">
            <label class="dock-rotulo">
              Duração (segundos):
              <input
                type="number"
                min={0.1}
                max={120}
                step={0.1}
                value={(passo.ms / 1000).toString()}
                class="campo-numero"
                onChange={e => {
                  const seg = Number((e.target as HTMLInputElement).value);
                  const ms = Math.max(100, Math.min(120000, Math.round(seg * 1000)));
                  aoAtualizar({ ...passo, ms });
                }}
              />
            </label>
          </div>
        </div>
      );
    }

    case 'som': {
      const tipoSom = useSignal<'cena' | 'efeito'>(passo.ref.tipo === 'efeito' ? 'efeito' : 'cena');
      return (
        <div class="campos-passo campos-som">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Tipo:</span>
            <button
              type="button"
              class={`dock-pilula ${tipoSom.value === 'cena' ? 'ativa' : ''}`}
              onClick={() => { tipoSom.value = 'cena'; }}
            >
              Cena
            </button>
            <button
              type="button"
              class={`dock-pilula ${tipoSom.value === 'efeito' ? 'ativa' : ''}`}
              onClick={() => { tipoSom.value = 'efeito'; }}
            >
              Efeito
            </button>
          </div>
          <EscolherCena
            s={s}
            id="passo-som-jukebox"
            rotulo="Faixa do Jukebox"
            dica="Selecione a faixa sonora configurada na campanha"
            tipo={tipoSom.value}
            valor={passo.ref}
            aoEscolher={ref => {
              if (ref) aoAtualizar({ ...passo, ref });
            }}
          />
        </div>
      );
    }

    case 'efeito': {
      const opcoes: EfeitoDeCena[] = ['relampago', ...EVENTOS_DE_CENA];
      return (
        <div class="campos-passo campos-efeito">
          <label class="dock-rotulo">
            Efeito visual de cena:
            <select
              value={passo.efeito}
              class="campo-select"
              onChange={e => {
                aoAtualizar({ ...passo, efeito: (e.target as HTMLSelectElement).value as EfeitoDeCena });
              }}
            >
              {opcoes.map(ef => (
                <option key={ef} value={ef}>
                  {ef === 'relampago' ? '⚡ Relâmpago' : (ROTULO_DO_EVENTO[ef] ?? ef)}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    case 'clima': {
      const presets = PRESETS_DE_CLIMA.map(p => ({ id: p.id, nome: p.nome }));
      const customizados = Object.values(doc.customClimates).map(c => ({ id: c.id, nome: c.name }));
      const todos = [...presets, ...customizados];
      return (
        <div class="campos-passo campos-clima">
          <label class="dock-rotulo">
            Predefinição de clima:
            <select
              value={passo.clima}
              class="campo-select"
              onChange={e => {
                aoAtualizar({ ...passo, clima: (e.target as HTMLSelectElement).value });
              }}
            >
              {todos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    case 'tela': {
      const atalhosMs = [0, 300, 800, 1000, 2000];
      return (
        <div class="campos-passo campos-tela">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Ação:</span>
            <button
              type="button"
              class={`dock-pilula ${passo.acao === 'escurecer' ? 'ativa' : ''}`}
              onClick={() => aoAtualizar({ ...passo, acao: 'escurecer' })}
            >
              Escurecer
            </button>
            <button
              type="button"
              class={`dock-pilula ${passo.acao === 'clarear' ? 'ativa' : ''}`}
              onClick={() => aoAtualizar({ ...passo, acao: 'clarear' })}
            >
              Clarear
            </button>
          </div>
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Transição:</span>
            {atalhosMs.map(ms => (
              <button
                type="button"
                key={ms}
                class={`dock-pilula ${passo.ms === ms ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, ms })}
              >
                {ms === 0 ? 'Corte seco' : `${ms} ms`}
              </button>
            ))}
          </div>
          <div class="campos-passo-linha">
            <label class="dock-rotulo">
              Milissegundos (0 a 10000):
              <input
                type="number"
                min={0}
                max={10000}
                step={100}
                value={passo.ms}
                class="campo-numero"
                onChange={e => {
                  const ms = Math.max(0, Math.min(10000, Number((e.target as HTMLInputElement).value)));
                  aoAtualizar({ ...passo, ms });
                }}
              />
            </label>
          </div>
        </div>
      );
    }

    case 'letreiro': {
      const pecas = Object.values(doc.tokens);
      const selPeca = s.selecao.value.find(item => item.colecao === 'tokens');
      const atalhosMs = [2000, 3000, 4000, 6000];

      return (
        <div class="campos-passo campos-letreiro">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Estilo:</span>
            <button
              type="button"
              class={`dock-pilula ${passo.estilo === 'apresentacao' ? 'ativa' : ''}`}
              onClick={() => aoAtualizar({ ...passo, estilo: 'apresentacao' })}
            >
              Apresentação
            </button>
            <button
              type="button"
              class={`dock-pilula ${passo.estilo === 'capitulo' ? 'ativa' : ''}`}
              onClick={() => aoAtualizar({ ...passo, estilo: 'capitulo' })}
            >
              Capítulo
            </button>
          </div>

          <label class="dock-rotulo">
            Título:
            <input
              type="text"
              class="campo-texto"
              value={passo.titulo}
              placeholder={passo.estilo === 'apresentacao' ? 'Nome do personagem' : 'Ex: Capítulo 3'}
              onInput={e => {
                aoAtualizar({ ...passo, titulo: (e.target as HTMLInputElement).value });
              }}
            />
          </label>

          <label class="dock-rotulo">
            Subtítulo:
            <input
              type="text"
              class="campo-texto"
              value={passo.subtitulo}
              placeholder={passo.estilo === 'apresentacao' ? 'Ocultista misterioso' : 'O Porão Maldito'}
              onInput={e => {
                aoAtualizar({ ...passo, subtitulo: (e.target as HTMLInputElement).value });
              }}
            />
          </label>

          <div class="campos-passo-linha">
            <label class="dock-rotulo" style={{ flex: 1 }}>
              Peça com retrato:
              <select
                class="campo-select"
                value={passo.peca ?? ''}
                onChange={e => {
                  const v = (e.target as HTMLSelectElement).value;
                  aoAtualizar({ ...passo, peca: v || null });
                }}
              >
                <option value="">(Nenhuma)</option>
                {pecas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              class="dock-pilula"
              disabled={!selPeca}
              title="Usa a peça selecionada no mapa"
              onClick={() => {
                if (selPeca) aoAtualizar({ ...passo, peca: selPeca.id });
              }}
            >
              Usar seleção atual
            </button>
          </div>

          <div class="campos-passo-linha">
            <span class="dock-rotulo">Duração:</span>
            {atalhosMs.map(ms => (
              <button
                type="button"
                key={ms}
                class={`dock-pilula ${passo.ms === ms ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, ms })}
              >
                {ms / 1000} s
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'camera': {
      const salas = Object.values(doc.rooms).map(r => ({ colecao: 'rooms' as const, id: r.id, nome: `Cômodo: ${r.name}` }));
      const pecas = Object.values(doc.tokens).map(t => ({ colecao: 'tokens' as const, id: t.id, nome: `Peça: ${t.name}` }));
      const regioes = Object.values(doc.regions).map(r => ({ colecao: 'regions' as const, id: r.id, nome: `Região: ${r.id}` }));
      const alvos = [...salas, ...pecas, ...regioes];
      const sel = s.selecao.value[0];
      const podeUsarSel = sel && (sel.colecao === 'rooms' || sel.colecao === 'tokens' || sel.colecao === 'regions');

      const chaveAtual = `${passo.alvo.colecao}:${passo.alvo.id}`;

      return (
        <div class="campos-passo campos-camera">
          <div class="campos-passo-linha">
            <label class="dock-rotulo" style={{ flex: 1 }}>
              Focar câmera em:
              <select
                class="campo-select"
                value={chaveAtual}
                onChange={e => {
                  const [colecao, id] = (e.target as HTMLSelectElement).value.split(':');
                  if (colecao && id) {
                    aoAtualizar({ ...passo, alvo: { colecao: colecao as any, id } });
                  }
                }}
              >
                {alvos.map(a => (
                  <option key={`${a.colecao}:${a.id}`} value={`${a.colecao}:${a.id}`}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              class="dock-pilula"
              disabled={!podeUsarSel}
              title="Focar no item atualmente selecionado"
              onClick={() => {
                if (podeUsarSel) {
                  aoAtualizar({ ...passo, alvo: { colecao: sel.colecao as any, id: sel.id } });
                }
              }}
            >
              Usar seleção atual
            </button>
          </div>
        </div>
      );
    }

    case 'revelar': {
      const salas = Object.values(doc.rooms);
      const comodosSel = s.selecao.value.filter(item => item.colecao === 'rooms').map(item => item.id);

      const alternarSala = (id: string) => {
        const novos = passo.ids.includes(id)
          ? passo.ids.filter(x => x !== id)
          : [...passo.ids, id];
        aoAtualizar({ ...passo, ids: novos });
      };

      return (
        <div class="campos-passo campos-revelar">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Cômodos a revelar:</span>
            <button
              type="button"
              class="dock-pilula"
              disabled={comodosSel.length === 0}
              onClick={() => {
                const uniao = Array.from(new Set([...passo.ids, ...comodosSel]));
                aoAtualizar({ ...passo, ids: uniao });
              }}
            >
              Usar cômodos selecionados
            </button>
          </div>
          <div class="lista-comodos-revelar">
            {salas.length === 0 ? (
              <p class="dock-dica">Nenhum cômodo definido no mapa.</p>
            ) : (
              salas.map(r => (
                <label key={r.id} class="item-checkbox-revelar">
                  <input
                    type="checkbox"
                    checked={passo.ids.includes(r.id)}
                    onChange={() => alternarSala(r.id)}
                  />
                  <span>{r.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      );
    }

    case 'interagir': {
      const portas = Object.values(doc.openings).map(o => ({ id: o.id, nome: `Porta ${o.id} (${o.kind})` }));
      const props = Object.values(doc.props).map(pr => ({ id: pr.id, nome: `Objeto ${pr.id}` }));
      const alvos = [...portas, ...props];
      const sel = s.selecao.value[0];
      const podeUsar = sel && (sel.colecao === 'openings' || sel.colecao === 'props');

      return (
        <div class="campos-passo campos-interagir">
          <div class="campos-passo-linha">
            <label class="dock-rotulo" style={{ flex: 1 }}>
              Abrir/Fechar porta ou acionar:
              <select
                class="campo-select"
                value={passo.id}
                onChange={e => {
                  aoAtualizar({ ...passo, id: (e.target as HTMLSelectElement).value });
                }}
              >
                {alvos.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              class="dock-pilula"
              disabled={!podeUsar}
              onClick={() => {
                if (podeUsar) aoAtualizar({ ...passo, id: sel.id });
              }}
            >
              Usar seleção atual
            </button>
          </div>
        </div>
      );
    }

    case 'pista': {
      const listaPistas = pistas.value;
      const pid = idDaPista(passo.ref);

      return (
        <div class="campos-passo campos-pista">
          <label class="dock-rotulo">
            Pista do Ateliê:
            <select
              class="campo-select"
              value={pid ?? ''}
              onChange={e => {
                const id = (e.target as HTMLSelectElement).value;
                if (id) aoAtualizar({ ...passo, ref: refDaPista(id) });
              }}
            >
              <option value="">(Selecione uma pista)</option>
              {listaPistas.map(pi => (
                <option key={pi.id} value={pi.id}>
                  {pi.name}
                </option>
              ))}
            </select>
          </label>
          <label class="item-checkbox-revelar">
            <input
              type="checkbox"
              checked={passo.mostrar}
              onChange={e => {
                aoAtualizar({ ...passo, mostrar: (e.target as HTMLInputElement).checked });
              }}
            />
            <span>Mostrar aos jogadores no Projetor imediatamente</span>
          </label>
        </div>
      );
    }

    case 'nota': {
      return (
        <div class="campos-passo campos-nota">
          <label class="dock-rotulo">
            Mensagem para o mestre (até 400 caracteres):
            <textarea
              class="campo-textarea"
              maxLength={400}
              rows={3}
              value={passo.texto}
              placeholder="Aviso discreto que surge apenas para o mestre…"
              onInput={e => {
                aoAtualizar({ ...passo, texto: (e.target as HTMLTextAreaElement).value });
              }}
            />
          </label>
        </div>
      );
    }

    default:
      return null;
  }
}

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
                  onClick={() => adicionarNovoPasso({ tipo: 'som', ref: criarRef('jukebox', 'cena', 'padrao') })}
                >
                  Cena do Jukebox
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => adicionarNovoPasso({ tipo: 'som', ref: criarRef('jukebox', 'efeito', 'padrao') })}
                >
                  Efeito do Jukebox
                </button>
              </div>

              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Mapa</span>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => adicionarNovoPasso({ tipo: 'efeito', efeito: 'relampago' })}
                >
                  Efeito de cena
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => adicionarNovoPasso({ tipo: 'clima', clima: 'noite' })}
                >
                  Clima
                </button>
                <button
                  type="button"
                  class="menu-opcao"
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
                  onClick={() => adicionarNovoPasso({ tipo: 'revelar', ids: Object.keys(s.doc.value.rooms).slice(0, 1) })}
                >
                  Revelar cômodo
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => {
                    const id = Object.keys(s.doc.value.openings)[0] ?? Object.keys(s.doc.value.props)[0] ?? '';
                    adicionarNovoPasso({ tipo: 'interagir', id });
                  }}
                >
                  Interagir (porta / objeto)
                </button>
              </div>

              <div class="menu-grupo">
                <span class="menu-grupo-titulo">Projetor</span>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => adicionarNovoPasso({ tipo: 'tela', acao: 'escurecer', ms: 800 })}
                >
                  Cortina (tela preta)
                </button>
                <button
                  type="button"
                  class="menu-opcao"
                  onClick={() => adicionarNovoPasso({ tipo: 'letreiro', titulo: '', subtitulo: '', peca: null, estilo: 'apresentacao', ms: 4000 })}
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
