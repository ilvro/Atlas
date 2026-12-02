import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { Entidade } from '#mesa';
import { campanhaAtiva, escolherCampanha } from '../app/campanha.ts';
import { servicos, viewport } from '../app/app.ts';
import { adicionarPersonagem, abrirMesa, ameacasComFicha, dadosDaRespostaDaSala, mesclarPersonagensDaSala, organizarPainelDePersonagens, personagensDoElenco, recursosDasFichas, type PainelDePersonagensOrganizado, type RespostaSalaFichas } from '../app/fichas.ts';
import { refDaFicha, textoDeRecursos } from '../domain/fichas.ts';
import { chaveDaRef } from '#mesa';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { tentar } from './campos.tsx';

const lista = signal<Entidade[]>([]);
const ameacas = signal<Entidade[]>([]);
const donosDaSala = signal<Record<string, string>>({});
const retratosUrlDaSala = signal<Record<string, string>>({});
const painelSessao = signal<PainelDePersonagensOrganizado>({
  online: false,
  naSala: [],
  jogadoresSemFicha: [],
  locais: [],
  donosPorFicha: {},
  retratosUrlPorFicha: {},
});
const abaSessao = signal<'sala' | 'locais' | 'ameacas'>('sala');
const busca = signal('');
const buscaPersonagem = signal('');
/** Quantas ameaças a lista mostra de uma vez: a campanha pode ter centenas (a Ficha traz as dela e as que você criar). A busca acha as outras. */
const LIMITE_DE_AMEACAS = 40;
const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
export const TIPO_ARRASTE = 'application/x-atlas-personagem';

async function carregar(): Promise<void> {
  const c = campanhaAtiva.peek(), srv = servicos.peek(), r = srv?.campanhas;
  if (!c || !r) {
    lista.value = [];
    ameacas.value = [];
    donosDaSala.value = {};
    retratosUrlDaSala.value = {};
    painelSessao.value = { online: false, naSala: [], jogadoresSemFicha: [], locais: [], donosPorFicha: {}, retratosUrlPorFicha: {} };
    return;
  }
  try {
    const fresca = (await r.obterCampanha?.(c.id)) ?? c;
    if (fresca.atualizadaEm !== c.atualizadaEm || JSON.stringify(fresca.elenco) !== JSON.stringify(c.elenco)) {
      campanhaAtiva.value = fresca;
    }
    const [todasPersonagens, todasAmeacas, respSala] = await Promise.all([
      r.listarEntidades(c.id, { tipo: 'personagem' }),
      r.listarEntidades(c.id, { tipo: 'ameaca' }),
      srv?.barramento ? srv.barramento.pedir('sala.fichas', {}, { prazoMs: 350 }).catch(() => null) : Promise.resolve(null),
    ]);
    const salaDados = respSala && respSala.ok ? dadosDaRespostaDaSala(respSala.resposta) : null;
    const mesclado = mesclarPersonagensDaSala(personagensDoElenco(todasPersonagens, fresca), salaDados, c.id, todasPersonagens);
    lista.value = mesclado.lista;
    donosDaSala.value = mesclado.donosPorFicha;
    retratosUrlDaSala.value = mesclado.retratosUrlPorFicha;
    painelSessao.value = organizarPainelDePersonagens({
      todasPersonagens,
      campanha: fresca,
      sala: salaDados,
      campanhaId: c.id,
    });
    ameacas.value = ameacasComFicha(todasAmeacas);
  } catch (erro) {
    console.warn('Atlas: não consegui listar os personagens', erro);
    lista.value = [];
    ameacas.value = [];
    donosDaSala.value = {};
    retratosUrlDaSala.value = {};
    painelSessao.value = { online: false, naSala: [], jogadoresSemFicha: [], locais: [], donosPorFicha: {}, retratosUrlPorFicha: {} };
  }
}

/** Os personagens da campanha que têm ficha: arrastar para o mapa (ou "Pôr no mapa") cria a peça ligada à ficha. */
function Item({
  s,
  e,
  pecas,
  donos = donosDaSala.value,
  retratosUrl = retratosUrlDaSala.value,
}: {
  s: SessaoDeEdicao;
  e: Entidade;
  pecas: SessaoDeEdicao['doc']['value']['tokens'];
  donos?: Record<string, string>;
  retratosUrl?: Record<string, string>;
}) {
  const ameaca = e.tipo === 'ameaca', pref = ameaca ? 'ameaca' : 'personagem';
  const ref = refDaFicha(e.refs)!;
  const pecasDaEntidade = Object.values(pecas).filter(t => t.refs.some(r => chaveDaRef(r) === chaveDaRef(ref)));
  const noMapa = pecasDaEntidade.length > 0;
  const rec = recursosDasFichas.value[chaveDaRef(ref)];
  const tagDono = !ameaca ? e.tags.find(t => t.startsWith('dono:')) : undefined;
  const donoDaTag = tagDono ? tagDono.slice(5).replace(/^Dono:\s*/i, '') : null;
  const dono = !ameaca ? (donos[ref.id] ?? (donoDaTag && donoDaTag !== 'você' ? donoDaTag : null)) : null;
  const textoBotao = ameaca
    ? (noMapa ? `+1 no mapa (×${pecasDaEntidade.length})` : 'Pôr no mapa')
    : (noMapa ? 'Selecionar' : 'Pôr no mapa');
  const retratoUrl = !ameaca ? retratosUrl[ref.id] : undefined;
  return (
    <div class={`personagem${ameaca ? ' ameaca' : ''}`} draggable data-testid={`${pref}-${e.id}`} title="Arraste para o mapa"
      onDragStart={ev => { ev.dataTransfer?.setData(TIPO_ARRASTE, e.id); ev.dataTransfer?.setData('text/plain', e.nome); }}>
      <span class="personagem-nome">
        {e.nome}
        {dono && <span class="personagem-dono" data-testid={`personagem-dono-${e.id}`}> · {dono}</span>}
      </span>
      {rec && <span class="personagem-recursos" data-testid={`${pref}-recursos-${e.id}`}>{textoDeRecursos(rec)}</span>}
      <button type="button" class="botao-pilula" data-testid={`${pref}-por-${e.id}`} onClick={() => tentar(() => { adicionarPersonagem(s, e, viewport.atual?.centro(), servicos.value?.repo, retratoUrl ? { retratoUrl } : undefined); })}>{textoBotao}</button>
    </div>
  );
}

function ListaDeAmeacas({
  s,
  pecas,
  mostradas,
  achadas,
}: {
  s: SessaoDeEdicao;
  pecas: SessaoDeEdicao['doc']['value']['tokens'];
  mostradas: readonly Entidade[];
  achadas: readonly Entidade[];
}) {
  return (
    <>
      <input
        type="search"
        class="busca-ameacas"
        placeholder="Buscar ameaça"
        aria-label="Buscar ameaça"
        data-testid="ameacas-busca"
        value={busca.value}
        onInput={ev => { busca.value = (ev.target as HTMLInputElement).value; }}
      />
      {mostradas.map(e => <Item key={e.id} s={s} e={e} pecas={pecas} />)}
      {achadas.length === 0 && <p class="dock-dica" data-testid="ameacas-nenhuma">Nenhuma ameaça com esse nome.</p>}
      {achadas.length > mostradas.length && <p class="dock-dica" data-testid="ameacas-mais">Mostrando {mostradas.length} de {achadas.length}: use a busca.</p>}
    </>
  );
}

/**
 * Os personagens da campanha que têm ficha e, abaixo, as ameaças (monstros) que a Ficha publicou: arrastar para o mapa (ou "Pôr no mapa") cria a peça
 * ligada à ficha. No modo `sessao` (Dock), separa as fichas carregadas pelos jogadores na sala (`Na Sala`) das fichas locais (`Locais`) e `Ameaças` em abas no topo.
 */
export function Personagens({ s, contexto = 'construir' }: { s: SessaoDeEdicao; contexto?: 'construir' | 'sessao' }) {
  useEffect(() => {
    if (s.doc.value.campanhaId && s.doc.value.campanhaId !== campanhaAtiva.value?.id) {
      escolherCampanha(s.doc.value.campanhaId, servicos.value ?? undefined);
    }
  }, [s.doc.value.campanhaId]);

  const barramentoAtual = servicos.value?.barramento ?? null;
  useEffect(() => { void carregar(); }, [campanhaAtiva.value?.id, JSON.stringify(campanhaAtiva.value?.elenco), barramentoAtual]);
  useEffect(() => {
    const aoFocar = () => { void carregar(); };
    const aoVisibilidade = () => { if (document.visibilityState === 'visible') void carregar(); };
    const aoStorage = (e: StorageEvent) => {
      if (e.key === 'mesa:campanha-ativa' || e.key === 'mesa:campanha-atualizada' || e.key === 'mesa:sala-atualizada') void carregar();
    };
    const pararSala = barramentoAtual ? [
      barramentoAtual.ouvir('sala.conexao', () => { void carregar(); }),
      barramentoAtual.ouvir('sala.ficha-atualizada', () => { void carregar(); }),
      barramentoAtual.ouvir('sala.ficha-removida', () => { void carregar(); }),
    ] : [];
    window.addEventListener('focus', aoFocar);
    document.addEventListener('visibilitychange', aoVisibilidade);
    window.addEventListener('storage', aoStorage);
    return () => {
      for (const parar of pararSala) parar();
      window.removeEventListener('focus', aoFocar);
      document.removeEventListener('visibilitychange', aoVisibilidade);
      window.removeEventListener('storage', aoStorage);
    };
  }, [barramentoAtual]);
  const campanha = campanhaAtiva.value, pecas = s.doc.value.tokens;
  if (!campanha) return <p class="dock-dica" data-testid="personagens-vazio">Escolha uma campanha na aba Mapa para ver os personagens.</p>;
  const termo = semAcento(busca.value).trim(), achadas = ameacas.value.filter(e => !termo || semAcento(e.nome).includes(termo)), mostradas = achadas.slice(0, LIMITE_DE_AMEACAS);

  const aoCarregarIframe = () => {
    const t1 = setTimeout(() => void carregar(), 600);
    const t2 = setTimeout(() => void carregar(), 1500);
    if (typeof t1 === 'object' && t1 && 'unref' in t1) (t1 as any).unref();
    if (typeof t2 === 'object' && t2 && 'unref' in t2) (t2 as any).unref();
  };

  if (contexto === 'sessao') {
    const org = painelSessao.value;
    const abaAtual = abaSessao.value;
    const termoLocal = semAcento(buscaPersonagem.value).trim();
    const locaisFiltrados = org.locais.filter(p => !termoLocal || semAcento(p.nome).includes(termoLocal));
    const semNadaLocal = org.naSala.length === 0 && org.locais.length === 0 && ameacas.value.length === 0;

    return (
      <div class="personagens" data-testid="personagens">
        <div class="personagens-abas" role="tablist" aria-label="Origem das fichas">
          <button
            type="button"
            role="tab"
            class="botao-pilula"
            data-testid="personagens-aba-sala"
            aria-selected={abaAtual === 'sala'}
            aria-pressed={abaAtual === 'sala'}
            onClick={() => { abaSessao.value = 'sala'; }}
          >
            Na Sala ({org.naSala.length})
          </button>
          <button
            type="button"
            role="tab"
            class="botao-pilula"
            data-testid="personagens-aba-locais"
            aria-selected={abaAtual === 'locais'}
            aria-pressed={abaAtual === 'locais'}
            onClick={() => { abaSessao.value = 'locais'; }}
          >
            Locais ({org.locais.length})
          </button>
          <button
            type="button"
            role="tab"
            class="botao-pilula"
            data-testid="personagens-aba-ameacas"
            aria-selected={abaAtual === 'ameacas'}
            aria-pressed={abaAtual === 'ameacas'}
            onClick={() => { abaSessao.value = 'ameacas'; }}
          >
            Ameaças ({ameacas.value.length})
          </button>
        </div>

        {abaAtual === 'sala' && (
          <>
            {!org.online && (
              <p class="dock-dica" data-testid="personagens-sala-offline">
                Sem sala online conectada: usando o elenco local da campanha.
                {campanha.elenco === undefined && (
                  <>
                    {' '}
                    <button
                      type="button"
                      class="link-discreto"
                      data-testid="escolher-elenco-mesa"
                      onClick={() => void abrirMesa()}
                    >
                      Escolher elenco na Mesa
                    </button>
                  </>
                )}
              </p>
            )}
            {org.naSala.map(e => <Item key={e.id} s={s} e={e} pecas={pecas} donos={org.donosPorFicha} retratosUrl={org.retratosUrlPorFicha} />)}
            {org.jogadoresSemFicha.map(j => (
              <div key={j.discordId} class="personagem personagem-pendente" data-testid={`jogador-sem-ficha-${j.discordId}`}>
                <span class="personagem-nome">{j.nome}</span>
                <span class="personagem-status">sem ficha escolhida</span>
              </div>
            ))}
            {org.naSala.length === 0 && org.jogadoresSemFicha.length === 0 && (
              <p class="dock-dica" data-testid="personagens-vazio">
                {org.online
                  ? 'Nenhum jogador carregou ficha na sala ainda. Para adicionar algo de fora, use Locais ou Ameaças acima.'
                  : (campanha.elenco !== undefined
                    ? 'Nenhum personagem no elenco desta campanha.'
                    : 'Nenhum personagem com ficha nesta campanha ainda.')}
              </p>
            )}
          </>
        )}

        {abaAtual === 'locais' && (
          <>
            {org.locais.length > 0 ? (
              <>
                <input
                  type="search"
                  class="busca-personagens"
                  data-testid="busca-personagens"
                  placeholder="Buscar ficha local…"
                  aria-label="Buscar ficha local"
                  value={buscaPersonagem.value}
                  onInput={ev => { buscaPersonagem.value = (ev.target as HTMLInputElement).value; }}
                />
                {locaisFiltrados.map(e => <Item key={e.id} s={s} e={e} pecas={pecas} donos={org.donosPorFicha} retratosUrl={org.retratosUrlPorFicha} />)}
                {locaisFiltrados.length === 0 && (
                  <p class="dock-dica" data-testid="personagens-nenhum">Nenhum personagem com “{buscaPersonagem.value}”.</p>
                )}
              </>
            ) : (
              <>
                <p class="dock-dica" data-testid="personagens-locais-vazio">
                  {org.naSala.length > 0
                    ? 'Nenhuma outra ficha local fora da sala.'
                    : 'Nenhuma ficha local nesta campanha ainda.'}
                </p>
                {semNadaLocal && (
                  <>
                    <iframe
                      src="../Dossie/?compacto=1"
                      title="Sincronização em segundo plano"
                      style={{ display: 'none', width: 0, height: 0, border: 'none' }}
                      onLoad={aoCarregarIframe}
                    />
                    <button
                      type="button"
                      class="botao-pilula"
                      data-testid="abrir-dossie-btn"
                      onClick={() => window.open('../Dossie/', '_blank')}
                    >
                      Abrir Dossiê
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {abaAtual === 'ameacas' && (
          ameacas.value.length > 0 ? (
            <section class="ameacas" data-testid="ameacas">
              <ListaDeAmeacas s={s} pecas={pecas} mostradas={mostradas} achadas={achadas} />
            </section>
          ) : (
            <p class="dock-dica" data-testid="ameacas-vazio">Nenhuma ameaça publicada pelo Dossiê ainda.</p>
          )
        )}

        <button type="button" class="botao-pilula" data-testid="personagens-atualizar" onClick={() => void carregar()}>Atualizar</button>
      </div>
    );
  }

  const termoP = semAcento(buscaPersonagem.value).trim(), achadosPersonagens = lista.value.filter(p => !termoP || semAcento(p.nome).includes(termoP));
  const vazio = lista.value.length === 0 && ameacas.value.length === 0;

  return (
    <div class="personagens" data-testid="personagens">
      {campanha.elenco === undefined && (
        <p class="dock-dica" data-testid="aviso-elenco-indefinido">
          <button
            type="button"
            class="link-discreto"
            data-testid="escolher-elenco-mesa"
            onClick={() => void abrirMesa()}
          >
            Escolha o elenco na Mesa
          </button>
        </p>
      )}
      {vazio ? (
        <>
          <p class="dock-dica" data-testid="personagens-vazio">
            {campanha.elenco !== undefined
              ? 'Nenhum personagem no elenco desta campanha.'
              : 'Nenhum personagem com ficha nesta campanha ainda.'}
          </p>
          <iframe
            src="../Dossie/?compacto=1"
            title="Sincronização em segundo plano"
            style={{ display: 'none', width: 0, height: 0, border: 'none' }}
            onLoad={aoCarregarIframe}
          />
          <button
            type="button"
            class="botao-pilula"
            data-testid="abrir-dossie-btn"
            onClick={() => window.open('../Dossie/', '_blank')}
          >
            Abrir Dossiê
          </button>
        </>
      ) : (
        lista.value.length === 0 && (
          <p class="dock-dica" data-testid="personagens-vazio">
            {campanha.elenco !== undefined
              ? 'Nenhum personagem no elenco desta campanha.'
              : 'Nenhum personagem com ficha nesta campanha ainda.'}
          </p>
        )
      )}
      {lista.value.length > 0 && (
        <input
          type="search"
          class="busca-personagens"
          data-testid="busca-personagens"
          placeholder="Buscar personagem…"
          aria-label="Buscar personagem"
          value={buscaPersonagem.value}
          onInput={ev => { buscaPersonagem.value = (ev.target as HTMLInputElement).value; }}
        />
      )}
      {achadosPersonagens.map(e => <Item key={e.id} s={s} e={e} pecas={pecas} />)}
      {lista.value.length > 0 && achadosPersonagens.length === 0 && (
        <p class="dock-dica" data-testid="personagens-nenhum">Nenhum personagem com “{buscaPersonagem.value}”.</p>
      )}
      {ameacas.value.length > 0 && (
        <section class="ameacas" data-testid="ameacas">
          <h4 class="dock-subtitulo">Ameaças <span class="meta">({ameacas.value.length})</span></h4>
          <ListaDeAmeacas s={s} pecas={pecas} mostradas={mostradas} achadas={achadas} />
        </section>
      )}
      <button type="button" class="botao-pilula" data-testid="personagens-atualizar" onClick={() => void carregar()}>Atualizar</button>
    </div>
  );
}

/** Solta um personagem arrastado sobre o mapa: a peça nasce onde foi solto. */
export function soltarPersonagem(s: SessaoDeEdicao, evento: DragEvent): void {
  const id = evento.dataTransfer?.getData(TIPO_ARRASTE); if (!id) return;
  evento.preventDefault();
  const org = painelSessao.peek();
  const e = [...org.naSala, ...org.locais, ...lista.peek(), ...ameacas.peek()].find(x => x.id === id);
  const mundo = viewport.atual?.mundoDe(evento.clientX, evento.clientY);
  if (e) {
    const ref = refDaFicha(e.refs);
    const retratoUrl = ref ? (org.retratosUrlPorFicha[ref.id] ?? retratosUrlDaSala.peek()[ref.id]) : undefined;
    tentar(() => { adicionarPersonagem(s, e, mundo, servicos.value?.repo, retratoUrl ? { retratoUrl } : undefined); });
  }
}
