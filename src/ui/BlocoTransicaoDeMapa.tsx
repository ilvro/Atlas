import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { resumos, servicos } from '../app/app.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { avisar } from '../app/toasts.ts';
import { objetoParaVincularMapa } from '../app/transicao-mapa.ts';
import { andarDe, andarVizinhoDeEscada, ehMultiandar, ehReceitaDeEscada, listaDeAndares } from '../domain/andares.ts';
import type { MapaAtlas, Ponto, TransicaoDeMapa } from '../domain/mapa.ts';
import {
  aplicarVinculoDeVolta,
  criarTransicaoDeRetorno,
  entradasDeTransicao,
  jaTemVinculoDeVolta,
  transicaoDaAbertura,
  transicaoDoObjeto,
} from '../domain/transicao-mapa.ts';
import { CampoNumero, Linha, tentar } from './campos.tsx';

export { objetoParaVincularMapa };

export interface PropsBlocoTransicaoDeMapa {
  s: SessaoDeEdicao;
  alvo: { colecao: 'openings' | 'props'; id: string };
}

export function BlocoTransicaoDeMapa({ s, alvo }: PropsBlocoTransicaoDeMapa) {
  const m = s.doc.value;
  const abertura = alvo.colecao === 'openings' ? m.openings[alvo.id] : undefined;
  const objeto = alvo.colecao === 'props' ? m.props[alvo.id] : undefined;
  const transicao = abertura
    ? transicaoDaAbertura(abertura)
    : objeto
      ? transicaoDoObjeto(objeto)
      : null;

  const mapaDestino = useSignal<MapaAtlas | null>(null);
  const vinculandoVolta = useSignal(false);

  const toMapId = transicao?.toMapId ?? '';
  const toTargetId = transicao?.toTargetId ?? '';

  useEffect(() => {
    let ativo = true;
    if (!toMapId) {
      mapaDestino.value = null;
      return;
    }
    const repo = servicos.value?.repo;
    if (!repo) {
      mapaDestino.value = null;
      return;
    }
    void repo.obter(toMapId).then(doc => {
      if (ativo) mapaDestino.value = doc ?? null;
    }).catch(() => {
      if (ativo) mapaDestino.value = null;
    });
    return () => { ativo = false; };
  }, [toMapId]);

  const outrosMapas = [...resumos.value]
    .filter(r => r.id !== m.id && !r.erro)
    .sort((a, b) => {
      const mesmaA = m.campanhaId && a.campanhaId === m.campanhaId ? 1 : 0;
      const mesmaB = m.campanhaId && b.campanhaId === m.campanhaId ? 1 : 0;
      if (mesmaA !== mesmaB) return mesmaB - mesmaA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

  const gravarTransicao = (nova: TransicaoDeMapa | null, rotulo = 'Vínculo com outro mapa') => {
    if (alvo.colecao === 'openings' && abertura) {
      tentar(() => s.store.executar({
        tipo: 'abertura.atualizar',
        id: abertura.id,
        patch: { transition: nova },
      }, { rotulo }));
      return;
    }
    if (alvo.colecao === 'props' && objeto) {
      const i = objeto.interaction;
      if (!nova) {
        const multi = ehMultiandar(m);
        if (multi) {
          const receita = objeto.source.kind === 'recipe' && ehReceitaDeEscada(objeto.source.recipe) ? objeto.source.recipe : null;
          const origem = andarDe(objeto);
          const outrosAndares = listaDeAndares(m).filter(a => a.id !== origem);
          const padrao = receita ? andarVizinhoDeEscada(m, origem, receita) : outrosAndares[0]?.id;
          tentar(() => s.store.executar({
            tipo: 'item.atualizar',
            colecao: 'props',
            id: objeto.id,
            patch: {
              interaction: {
                kind: 'stairs',
                on: false,
                targets: [],
                sound: i?.sound ?? null,
                clue: null,
                toLevel: padrao ?? null,
                toMapId: null,
                toTargetId: null,
              },
            },
          }, { rotulo }));
        } else {
          tentar(() => s.store.executar({
            tipo: 'item.atualizar',
            colecao: 'props',
            id: objeto.id,
            patch: { interaction: null },
          }, { rotulo }));
        }
        return;
      }
      tentar(() => s.store.executar({
        tipo: 'item.atualizar',
        colecao: 'props',
        id: objeto.id,
        patch: {
          interaction: {
            kind: 'stairs',
            on: false,
            targets: [],
            sound: i?.sound ?? null,
            clue: null,
            toMapId: nova.toMapId,
            toTargetId: nova.toTargetId ?? null,
            toLevel: nova.toLevel ?? null,
            toPosition: nova.toPosition,
          },
        },
      }, { rotulo }));
    }
  };

  const aoEscolherMapa = (novoMapId: string) => {
    if (!novoMapId) {
      gravarTransicao(null, 'Remover vínculo de mapa');
      return;
    }
    const resumo = outrosMapas.find(r => r.id === novoMapId);
    gravarTransicao({
      toMapId: novoMapId,
      toTargetId: null,
      toLevel: null,
      ...(resumo ? { label: resumo.nome } : {}),
    }, 'Vincular a outro mapa');
  };

  const dest = mapaDestino.value;
  const entradas = dest ? entradasDeTransicao(dest) : [];
  const entradaEscolhida = toTargetId ? entradas.find(e => e.id === toTargetId) : undefined;
  const andaresDestino = dest ? listaDeAndares(dest) : [];
  const multiDestino = dest ? ehMultiandar(dest) : false;

  const aoEscolherEntrada = (entradaId: string) => {
    if (!transicao) return;
    if (!entradaId) {
      const centro: Ponto = dest
        ? [Math.round((dest.bounds.width / 2) * 10) / 10, Math.round((dest.bounds.height / 2) * 10) / 10]
        : (transicao.toPosition ?? [10, 10]);
      gravarTransicao({
        ...transicao,
        toTargetId: null,
        toPosition: transicao.toPosition ?? centro,
      }, 'Ponto personalizado de chegada');
      return;
    }
    const entrada = entradas.find(e => e.id === entradaId);
    if (!entrada) return;
    gravarTransicao({
      ...transicao,
      toTargetId: entrada.id,
      toLevel: entrada.levelId,
      toPosition: [entrada.posicao[0], entrada.posicao[1]],
    }, 'Entrada de chegada');
  };

  const jaVinculadoVolta = !!(dest && toTargetId && jaTemVinculoDeVolta(dest, toTargetId, m.id, alvo.id));

  const vincularCaminhoDeVolta = async () => {
    const repo = servicos.value?.repo;
    if (!repo || !toMapId || !toTargetId) return;
    const retorno = criarTransicaoDeRetorno(m, alvo);
    if (!retorno) return;
    vinculandoVolta.value = true;
    try {
      const atual = (await repo.obter(toMapId)) ?? dest;
      if (!atual) {
        avisar('Mapa de destino não encontrado no repositório.', { tipo: 'erro' });
        return;
      }
      const atualizado = aplicarVinculoDeVolta(atual, toTargetId, retorno);
      if (!atualizado) {
        avisar('A entrada de chegada não foi encontrada no mapa de destino.', { tipo: 'erro' });
        return;
      }
      const salvo = await repo.salvar(atualizado, { forcar: true });
      mapaDestino.value = salvo;
      avisar(`Caminho de volta vinculado em ${salvo.name}`);
    } catch (erro) {
      avisar(`Não consegui vincular o caminho de volta: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' });
    } finally {
      vinculandoVolta.value = false;
    }
  };

  const posX = transicao?.toPosition?.[0] ?? (dest ? Math.round((dest.bounds.width / 2) * 10) / 10 : 0);
  const posY = transicao?.toPosition?.[1] ?? (dest ? Math.round((dest.bounds.height / 2) * 10) / 10 : 0);

  return (
    <div class="bloco-transicao-mapa" data-testid="bloco-transicao-mapa">
      <Linha rotulo="Leva a outro mapa" dica="Na Sessão, permite abrir o mapa de destino já centralizado na entrada de chegada e levar os jogadores.">
        <select
          data-testid="transicao-mapa-destino"
          aria-label="Leva a outro mapa"
          value={toMapId}
          onChange={e => aoEscolherMapa((e.target as HTMLSelectElement).value)}
        >
          <option value="">Nenhum (mesmo mapa)</option>
          {outrosMapas.map(r => (
            <option key={r.id} value={r.id}>
              {r.nome}{m.campanhaId && r.campanhaId === m.campanhaId ? ' ★' : ''}
            </option>
          ))}
          {toMapId && !outrosMapas.some(r => r.id === toMapId) && (
            <option value={toMapId}>{dest?.name ?? transicao?.label ?? toMapId}</option>
          )}
        </select>
      </Linha>

      {transicao && (
        <>
          <Linha rotulo="Entrada de chegada" dica="Porta ou escada onde o grupo desemboca no mapa de destino.">
            <select
              data-testid="transicao-mapa-entrada"
              aria-label="Entrada de chegada"
              value={toTargetId}
              onChange={e => aoEscolherEntrada((e.target as HTMLSelectElement).value)}
            >
              <option value="">Ponto personalizado</option>
              {entradas.map(ent => {
                const nomeAndar = multiDestino
                  ? andaresDestino.find(a => a.id === ent.levelId)?.nome
                  : undefined;
                return (
                  <option key={ent.id} value={ent.id}>
                    {ent.nome}{nomeAndar ? ` — ${nomeAndar}` : ''}
                  </option>
                );
              })}
              {toTargetId && !entradaEscolhida && (
                <option value={toTargetId}>(entrada ausente: {toTargetId})</option>
              )}
            </select>
          </Linha>

          {!toTargetId && (
            <>
              {multiDestino && (
                <Linha rotulo="Andar de chegada">
                  <select
                    data-testid="transicao-mapa-andar"
                    aria-label="Andar de chegada"
                    value={transicao.toLevel ?? '__terreo'}
                    onChange={e => {
                      const v = (e.target as HTMLSelectElement).value;
                      gravarTransicao({
                        ...transicao,
                        toLevel: v === '__terreo' ? null : v,
                      }, 'Andar de chegada');
                    }}
                  >
                    {andaresDestino.map(a => (
                      <option key={a.id ?? '__terreo'} value={a.id ?? '__terreo'}>{a.nome}</option>
                    ))}
                  </select>
                </Linha>
              )}
              <CampoNumero
                id="transicao-mapa-x"
                rotulo="Chegada X"
                unidade="m"
                valor={posX}
                min={0}
                max={dest?.bounds.width ?? 600}
                passo={0.5}
                aoConfirmar={x => gravarTransicao({
                  ...transicao,
                  toPosition: [x, posY],
                }, 'Coordenada de chegada')}
              />
              <CampoNumero
                id="transicao-mapa-y"
                rotulo="Chegada Y"
                unidade="m"
                valor={posY}
                min={0}
                max={dest?.bounds.height ?? 600}
                passo={0.5}
                aoConfirmar={y => gravarTransicao({
                  ...transicao,
                  toPosition: [posX, y],
                }, 'Coordenada de chegada')}
              />
            </>
          )}

          {toTargetId && entradaEscolhida && !jaVinculadoVolta && (
            <div class="acoes-selecao">
              <button
                type="button"
                class="botao-pilula"
                data-testid="transicao-vincular-volta"
                disabled={vinculandoVolta.value}
                onClick={() => void vincularCaminhoDeVolta()}
              >
                Vincular caminho de volta
              </button>
            </div>
          )}
          {toTargetId && entradaEscolhida && jaVinculadoVolta && (
            <p class="dica" data-testid="transicao-volta-ativa">
              ✓ Caminho de volta vinculado em {dest?.name ?? 'destino'}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
