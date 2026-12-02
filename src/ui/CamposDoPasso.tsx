import { useSignal } from '@preact/signals';
import { criarRef } from '#mesa';
import type { Objeto, Regiao } from '../domain/mapa.ts';
import type { EfeitoDeCena, PassoDeMomento } from '../domain/momentos.ts';
import { PRESETS_DE_CLIMA } from '../domain/presets.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { pistas } from '../app/pistas.ts';
import { idDaPista, refDaPista } from '../data/pistas.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { COLECAO } from '../procedural/colecao.ts';
import { materiaisDo } from '../procedural/materiais.ts';
import { EVENTOS_DE_CENA, ROTULO_DO_EVENTO } from '../render/eventos-de-cena.ts';
import { EscolherCena } from './EscolherCena.tsx';

function nomeLegivelDoObjeto(pr: Objeto): string {
  if (pr.source.kind === 'recipe') {
    return ACERVO.item(pr.source.recipe)?.nome ?? pr.source.recipe;
  }
  const assetId = pr.source.assetId;
  return ACERVO.item(`casa:${assetId}`)?.nome ?? COLECAO.find(i => i.id === assetId)?.nome ?? assetId;
}

function nomeRegiao(r: Regiao): string {
  const nome = (r.payload as Record<string, unknown> | undefined)?.nome;
  return typeof nome === 'string' && nome.trim() ? nome.trim() : `Região ${r.id}`;
}

function CamposDoSom({
  s,
  passo,
  aoAtualizar,
}: {
  s: SessaoDeEdicao;
  passo: Extract<PassoDeMomento, { tipo: 'som' }>;
  aoAtualizar: (novoPasso: PassoDeMomento) => void;
}) {
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
      <div class="campos-passo-linha">
        <label class="dock-rotulo" style={{ flex: 1 }}>
          Ou ID do áudio:
          <input
            type="text"
            class="campo-texto"
            data-testid="passo-som-id"
            placeholder="ex: grito, trovao, porta…"
            value={passo.ref.id}
            onInput={e => {
              const id = (e.target as HTMLInputElement).value.trim();
              if (id) aoAtualizar({ ...passo, ref: criarRef('jukebox', tipoSom.value, id) });
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Formulário para editar campos específicos de um passo de momento. */
export function CamposDoPasso({
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

    case 'som':
      return <CamposDoSom s={s} passo={passo} aoAtualizar={aoAtualizar} />;

    case 'silencio': {
      const atalhosMs = [0, 500, 1000, 2000, 5000];
      return (
        <div class="campos-passo campos-silencio">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Fade:</span>
            {atalhosMs.map(ms => (
              <button
                type="button"
                key={ms}
                class={`dock-pilula ${passo.ms === ms ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, ms })}
              >
                {ms === 0 ? 'Instantâneo' : `${ms / 1000} s`}
              </button>
            ))}
          </div>
          <div class="campos-passo-linha">
            <label class="dock-rotulo">
              Duração do fade (segundos):
              <input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={(passo.ms / 1000).toString()}
                class="campo-numero"
                onChange={e => {
                  const seg = Number((e.target as HTMLInputElement).value);
                  const ms = Math.max(0, Math.min(30000, Math.round(seg * 1000)));
                  aoAtualizar({ ...passo, ms });
                }}
              />
            </label>
          </div>
        </div>
      );
    }

    case 'efeito': {
      const opcoes: EfeitoDeCena[] = ['relampago', ...EVENTOS_DE_CENA];
      const intensidade = passo.intensidade ?? 1;
      const rotuloIntensidade =
        intensidade <= 0.5 ? 'Fraco' : intensidade <= 1.2 ? 'Médio' : intensidade <= 1.9 ? 'Forte' : 'Intenso';
      return (
        <div class="campos-passo campos-efeito">
          <label class="dock-rotulo">
            Efeito visual de cena:
            <select
              value={passo.efeito}
              class="campo-select"
              onChange={e => {
                const novo = (e.target as HTMLSelectElement).value as EfeitoDeCena;
                const proximo: Extract<PassoDeMomento, { tipo: 'efeito' }> = { tipo: 'efeito', efeito: novo };
                if ((novo === 'relampago' || novo === 'tremor') && passo.som === false) proximo.som = false;
                if (novo === 'tremor' && passo.intensidade !== undefined) proximo.intensidade = passo.intensidade;
                aoAtualizar(proximo);
              }}
            >
              {opcoes.map(ef => (
                <option key={ef} value={ef}>
                  {ef === 'relampago' ? '⚡ Relâmpago' : (ROTULO_DO_EVENTO[ef] ?? ef)}
                </option>
              ))}
            </select>
          </label>
          {passo.efeito === 'tremor' && (
            <label class="dock-rotulo">
              Intensidade do tremor ({Math.round(intensidade * 100)}% · {rotuloIntensidade}):
              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.1}
                value={intensidade}
                data-testid="passo-efeito-intensidade"
                onInput={e => {
                  aoAtualizar({ ...passo, intensidade: Number((e.target as HTMLInputElement).value) });
                }}
              />
            </label>
          )}
          {(passo.efeito === 'relampago' || passo.efeito === 'tremor') && (
            <label class="dock-rotulo" style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={passo.som !== false}
                data-testid="passo-efeito-som"
                onChange={e => {
                  const comSom = (e.target as HTMLInputElement).checked;
                  const proximo: Extract<PassoDeMomento, { tipo: 'efeito' }> = { ...passo };
                  if (comSom) delete proximo.som;
                  else proximo.som = false;
                  aoAtualizar(proximo);
                }}
              />
              <span>{passo.efeito === 'relampago' ? 'Tocar som de trovão' : 'Tocar som de tremor'}</span>
            </label>
          )}
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
      const regioes = Object.values(doc.regions).map(r => ({ colecao: 'regions' as const, id: r.id, nome: `Região: ${nomeRegiao(r)}` }));
      const alvos = [...salas, ...pecas, ...regioes];
      const sel = s.selecao.value[0];
      const alvoSel = sel && (sel.colecao === 'rooms' || sel.colecao === 'tokens' || sel.colecao === 'regions')
        ? { colecao: sel.colecao, id: sel.id }
        : null;

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
                  if (colecao === 'rooms' || colecao === 'tokens' || colecao === 'regions') {
                    if (id) aoAtualizar({ ...passo, alvo: { colecao, id } });
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
              disabled={!alvoSel}
              title="Focar no item atualmente selecionado"
              onClick={() => {
                if (alvoSel) {
                  aoAtualizar({ ...passo, alvo: alvoSel });
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
      const salas = Object.values(doc.rooms).map(r => ({ id: r.id, nome: r.name }));
      const regioes = Object.values(doc.regions).filter(r => r.kind === 'reveal').map(r => ({ id: r.id, nome: nomeRegiao(r) }));
      const alvos = [...salas, ...regioes];
      const sel = s.selecao.value.filter(item => item.colecao === 'rooms' || (item.colecao === 'regions' && doc.regions[item.id]?.kind === 'reveal')).map(item => item.id);

      const alternarId = (id: string) => {
        const novos = passo.ids.includes(id)
          ? passo.ids.filter(x => x !== id)
          : [...passo.ids, id];
        aoAtualizar({ ...passo, ids: novos });
      };

      return (
        <div class="campos-passo campos-revelar">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Cômodos e regiões a revelar:</span>
            <button
              type="button"
              class="dock-pilula"
              disabled={sel.length === 0}
              onClick={() => {
                const uniao = Array.from(new Set([...passo.ids, ...sel]));
                aoAtualizar({ ...passo, ids: uniao });
              }}
            >
              Usar seleção atual
            </button>
          </div>
          <div class="lista-comodos-revelar">
            {alvos.length === 0 ? (
              <p class="dock-dica">Nenhum cômodo nem região de revelação no mapa.</p>
            ) : (
              alvos.map(item => (
                <label key={item.id} class="item-checkbox-revelar">
                  <input
                    type="checkbox"
                    checked={passo.ids.includes(item.id)}
                    onChange={() => alternarId(item.id)}
                  />
                  <span>{item.nome}</span>
                </label>
              ))
            )}
          </div>
        </div>
      );
    }

    case 'interagir': {
      const portas = Object.values(doc.openings).map(o => ({ id: o.id, nome: o.kind === 'secret' ? 'Porta secreta' : o.kind === 'door' ? 'Porta' : `Abertura (${o.kind})` }));
      const props = Object.values(doc.props).map(pr => ({ id: pr.id, nome: pr.source.kind === 'recipe' ? pr.source.recipe : pr.source.assetId }));
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

    case 'luz': {
      const acoes: Array<'ligar' | 'desligar' | 'alternar'> = ['ligar', 'desligar', 'alternar'];
      const rotulosAcao = { ligar: 'Ligar', desligar: 'Desligar', alternar: 'Alternar' };
      const luzesDoMapa = Object.values(doc.lights).map(l => ({
        id: l.id,
        nome: l.preset ? `Luz: ${l.preset}` : 'Luz',
      }));
      const donosDeLuz = new Set(Object.values(doc.lights).map(l => l.ownerId).filter(Boolean));
      const objetosComLuz = Object.values(doc.props)
        .filter(pr => donosDeLuz.has(pr.id))
        .map(pr => ({
          id: pr.id,
          nome: `Objeto: ${nomeLegivelDoObjeto(pr)}`,
        }));
      const alvosLuz = [...luzesDoMapa, ...objetosComLuz];
      const selLuzes = s.selecao.value.filter(item => item.colecao === 'lights' || (item.colecao === 'props' && donosDeLuz.has(item.id))).map(item => item.id);

      const alternarId = (id: string) => {
        const novos = passo.ids.includes(id)
          ? passo.ids.filter(x => x !== id)
          : [...passo.ids, id];
        aoAtualizar({ ...passo, ids: novos });
      };

      return (
        <div class="campos-passo campos-luz">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Ação:</span>
            {acoes.map(a => (
              <button
                type="button"
                key={a}
                class={`dock-pilula ${passo.acao === a ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, acao: a })}
              >
                {rotulosAcao[a]}
              </button>
            ))}
          </div>
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Luzes / tochas:</span>
            <button
              type="button"
              class="dock-pilula"
              disabled={selLuzes.length === 0}
              onClick={() => {
                const uniao = Array.from(new Set([...passo.ids, ...selLuzes]));
                aoAtualizar({ ...passo, ids: uniao });
              }}
            >
              Usar seleção atual
            </button>
          </div>
          <div class="lista-comodos-revelar">
            {alvosLuz.length === 0 ? (
              <p class="dock-dica">Nenhuma luz nem objeto no mapa.</p>
            ) : (
              alvosLuz.map(item => (
                <label key={item.id} class="item-checkbox-revelar">
                  <input
                    type="checkbox"
                    checked={passo.ids.includes(item.id)}
                    onChange={() => alternarId(item.id)}
                  />
                  <span>{item.nome}</span>
                </label>
              ))
            )}
          </div>
        </div>
      );
    }

    case 'objeto': {
      const acoes: Array<'mostrar' | 'esconder'> = ['mostrar', 'esconder'];
      const rotulosAcao = { mostrar: 'Mostrar', esconder: 'Esconder' };
      const objetosDoMapa = Object.values(doc.props).map(pr => ({
        id: pr.id,
        nome: nomeLegivelDoObjeto(pr),
      }));
      const selObjetos = s.selecao.value.filter(item => item.colecao === 'props').map(item => item.id);

      const alternarId = (id: string) => {
        const novos = passo.ids.includes(id)
          ? passo.ids.filter(x => x !== id)
          : [...passo.ids, id];
        aoAtualizar({ ...passo, ids: novos });
      };

      return (
        <div class="campos-passo campos-objeto">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Ação:</span>
            {acoes.map(a => (
              <button
                type="button"
                key={a}
                class={`dock-pilula ${passo.acao === a ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, acao: a })}
              >
                {rotulosAcao[a]}
              </button>
            ))}
          </div>
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Objetos:</span>
            <button
              type="button"
              class="dock-pilula"
              disabled={selObjetos.length === 0}
              onClick={() => {
                const uniao = Array.from(new Set([...passo.ids, ...selObjetos]));
                aoAtualizar({ ...passo, ids: uniao });
              }}
            >
              Usar objetos selecionados
            </button>
          </div>
          <div class="lista-comodos-revelar">
            {objetosDoMapa.length === 0 ? (
              <p class="dock-dica">Nenhum objeto no mapa.</p>
            ) : (
              objetosDoMapa.map(item => (
                <label key={item.id} class="item-checkbox-revelar">
                  <input
                    type="checkbox"
                    checked={passo.ids.includes(item.id)}
                    onChange={() => alternarId(item.id)}
                  />
                  <span>{item.nome}</span>
                </label>
              ))
            )}
          </div>
        </div>
      );
    }

    case 'agua': {
      const materiaisDeAgua = materiaisDo('agua');
      const selReg = s.selecao.value.find(item => item.colecao === 'regions');
      const regiao = selReg ? doc.regions[selReg.id] : null;
      const atalhosS = [1, 2, 3, 5, 8];

      const baixando = passo.acao === 'baixar';
      return (
        <div class="campos-passo campos-agua">
          <div class="campos-passo-linha">
            <span class="dock-rotulo">Ação:</span>
            <button
              type="button"
              class={`dock-pilula ${!baixando ? 'ativa' : ''}`}
              onClick={() => { const { acao: _a, deixar: _d, ...resto } = passo; aoAtualizar({ ...resto, acao: 'subir' }); }}
            >
              Subir
            </button>
            <button
              type="button"
              class={`dock-pilula ${baixando ? 'ativa' : ''}`}
              onClick={() => aoAtualizar({ ...passo, acao: 'baixar' })}
            >
              Baixar
            </button>
          </div>
          {baixando && (
            <div class="campos-passo-linha">
              <label class="dock-rotulo" style={{ flex: 1 }}>
                O que fica:
                <select
                  class="campo-select"
                  value={passo.deixar ?? ''}
                  onChange={e => {
                    const v = (e.target as HTMLSelectElement).value;
                    const { deixar: _d, ...resto } = passo;
                    aoAtualizar(v ? { ...resto, deixar: v } : resto);
                  }}
                >
                  <option value="">O terreno de antes</option>
                  {materiaisDo('terreno').map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div class="campos-passo-linha">
            <label class="dock-rotulo" style={{ flex: 1 }}>
              Material de água:
              <select
                class="campo-select"
                value={passo.material}
                onChange={e => {
                  aoAtualizar({ ...passo, material: (e.target as HTMLSelectElement).value });
                }}
              >
                {materiaisDeAgua.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div class="campos-passo-linha">
            <span class="dock-rotulo">Duração:</span>
            {atalhosS.map(seg => (
              <button
                type="button"
                key={seg}
                class={`dock-pilula ${passo.ms === seg * 1000 ? 'ativa' : ''}`}
                onClick={() => aoAtualizar({ ...passo, ms: seg * 1000 })}
              >
                {seg} s
              </button>
            ))}
          </div>

          <div class="campos-passo-linha">
            <label class="dock-rotulo" style={{ flex: 1 }}>
              Duração (segundos):
              <input
                type="number"
                min={0.1}
                max={120}
                step={0.5}
                value={(passo.ms / 1000).toString()}
                class="campo-numero"
                onChange={e => {
                  const ms = Math.max(100, Math.min(120_000, Math.round(Number((e.target as HTMLInputElement).value) * 1000)));
                  aoAtualizar({ ...passo, ms });
                }}
              />
            </label>
            <label class="dock-rotulo" style={{ flex: 1 }}>
              Etapas (anéis):
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={passo.etapas ?? 6}
                class="campo-numero"
                onChange={e => {
                  const etapas = Math.max(1, Math.min(60, Math.round(Number((e.target as HTMLInputElement).value))));
                  aoAtualizar({ ...passo, etapas });
                }}
              />
            </label>
          </div>

          <div class="campos-passo-linha">
            <span class="dock-rotulo">Polígono: {passo.poligono.length} pontos</span>
            <button
              type="button"
              class="dock-pilula"
              disabled={!regiao || regiao.polygon.length < 3}
              title="Copia os pontos da região selecionada no mapa"
              onClick={() => {
                if (regiao && regiao.polygon.length >= 3) {
                  aoAtualizar({ ...passo, poligono: structuredClone(regiao.polygon) });
                }
              }}
            >
              Usar região selecionada
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
