import { useState, useRef, useEffect } from 'preact/hooks';
import { abasAbertas } from '../app/abas.ts';
import { mapaNoProjetorId } from '../app/projetor.ts';
import {
  criarMapaNovo,
  navegar,
  renomearMapaAberto,
  resumos,
  sessao,
  atualizarLista,
  projetarAba,
  fecharAbaComSessao,
} from '../app/app.ts';
import { tituloDoEstado } from '../app/sessao.ts';
import { filtrar } from '../app/busca.ts';
import { campanhaAtiva, campanhas } from '../app/campanha.ts';
import { mapasDaCampanha, mapasDeOutrasCampanhas } from '../app/mapas-da-campanha.ts';
import { Icone } from './Icone.tsx';
import { movimentoReduzido } from '../fx/fx.ts';

export function AbasDeMapas() {
  const s = sessao.value;
  const abas = abasAbertas.value;
  const ativoId = s?.doc.value.id;

  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [verOutras, setVerOutras] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const botaoMaisRef = useRef<HTMLButtonElement>(null);
  const abaAtivaRef = useRef<HTMLDivElement>(null);

  const listaRef = useRef<HTMLDivElement>(null);
  const [escondeEsq, setEscondeEsq] = useState(false);
  const [escondeDir, setEscondeDir] = useState(false);

  useEffect(() => {
    abaAtivaRef.current?.scrollIntoView({ behavior: movimentoReduzido() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
  }, [ativoId]);

  const medirTransbordo = () => {
    const el = listaRef.current;
    if (!el) return;
    // Sem espaço para as setas (cabeçalho espremido), não mostra nenhuma.
    const cabe = el.clientWidth >= 96;
    setEscondeEsq(cabe && el.scrollLeft > 1);
    setEscondeDir(cabe && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // Recalcula ao rolar, ao redimensionar a lista e (abaixo) quando as abas mudam.
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    el.addEventListener('scroll', medirTransbordo, { passive: true });
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medirTransbordo) : null;
    obs?.observe(el);
    // Roda vertical sobre a lista rola na horizontal; só impede a rolagem da página se a lista de fato andou.
    const aoRolarRoda = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
      const antes = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== antes) e.preventDefault();
    };
    el.addEventListener('wheel', aoRolarRoda, { passive: false });
    medirTransbordo();
    return () => {
      el.removeEventListener('scroll', medirTransbordo);
      el.removeEventListener('wheel', aoRolarRoda);
      obs?.disconnect();
    };
  }, []);

  const rolarAbas = (sentido: -1 | 1) => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth * 0.7, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (!popoverAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(alvo) && !botaoMaisRef.current?.contains(alvo)) {
        setPopoverAberto(false);
      }
    };
    const aoPressionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverAberto(false);
    };
    window.addEventListener('mousedown', aoClicarFora);
    window.addEventListener('keydown', aoPressionarTecla);
    return () => {
      window.removeEventListener('mousedown', aoClicarFora);
      window.removeEventListener('keydown', aoPressionarTecla);
    };
  }, [popoverAberto]);

  const aoFecharAba = (id: string) => {
    const proximoId = fecharAbaComSessao(id);
    if (id === ativoId) {
      if (proximoId) {
        navegar({ tipo: 'mapa', id: proximoId });
      } else {
        navegar({ tipo: 'galeria' });
      }
    }
  };

  const listaAbas = abas.some(a => a.id === ativoId)
    ? abas
    : (s ? [...abas, { id: s.doc.value.id, nome: s.doc.value.name }] : abas);

  const assinaturaAbas = listaAbas.map(a => `${a.id}:${a.nome}`).join('|');
  useEffect(() => {
    medirTransbordo();
  }, [assinaturaAbas]);

  const cid = campanhaAtiva.value?.id ?? null;
  const fechadas = resumos.value.filter(r => !listaAbas.some(a => a.id === r.id));
  const outros = mapasDaCampanha(fechadas, cid);
  const filtrados = filtrar(outros, busca, r => r.nome);
  const deOutras = filtrar(mapasDeOutrasCampanhas(fechadas, cid), busca, r => r.nome);
  const nomeDaCampanha = (id: string | null) => (id ? campanhas.value.find(c => c.id === id)?.nome : undefined) ?? 'Sem campanha';

  return (
    <div class="abas-de-mapas" role="tablist" aria-label="Mapas abertos">
      <div class="abas-rolagem" data-esconde-esq={escondeEsq} data-esconde-dir={escondeDir}>
        {escondeEsq ? (
          <button type="button" class="aba-seta esq" aria-label="Abas anteriores" title="Abas anteriores" data-testid="abas-rolar-esquerda" onClick={() => rolarAbas(-1)}>‹</button>
        ) : null}
      <div class="abas-lista" ref={listaRef}>
        {listaAbas.map(aba => {
          const ehAtiva = aba.id === ativoId;
          if (ehAtiva && s) {
            return (
              <div
                class="aba-mapa ativa"
                key={aba.id}
                ref={abaAtivaRef}
                role="tab"
                aria-selected="true"
                data-aba-id={aba.id}
              >
                <input
                  id="nome-do-mapa"
                  class="nome-do-mapa"
                  key={s.doc.value.id + s.doc.value.name}
                  defaultValue={s.doc.value.name}
                  aria-label="Nome do mapa"
                  maxLength={120}
                  spellcheck={false}
                  onFocus={e => (e.target as HTMLInputElement).select()}
                  onChange={e => {
                    const v = (e.target as HTMLInputElement).value;
                    if (!v.trim()) (e.target as HTMLInputElement).value = s.doc.value.name;
                    else void renomearMapaAberto(v);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
                <span
                  class={`estado ${s.gravacao.value}${s.sujo.value ? ' sujo' : ''}`}
                  data-testid="estado-gravacao"
                  data-estado={s.gravacao.value}
                  data-sujo={String(s.sujo.value)}
                  role="status"
                  title={tituloDoEstado(s.gravacao.value, s.sujo.value)}
                >
                  <i aria-hidden="true" />
                  {tituloDoEstado(s.gravacao.value, s.sujo.value)}
                </span>
                <button
                  type="button"
                  class={`botao-aba-projetor ${mapaNoProjetorId.value === aba.id ? 'projetando' : ''}`}
                  title={`Mostrar ${aba.nome} na visão dos jogadores`}
                  aria-label={`Mostrar ${aba.nome} na visão dos jogadores`}
                  aria-pressed={mapaNoProjetorId.value === aba.id}
                  data-testid={`aba-projetor-${aba.id}`}
                  onClick={e => {
                    e.stopPropagation();
                    void projetarAba(aba.id);
                  }}
                >
                  <Icone nome="olho" tamanho={13} />
                </button>
                <button
                  type="button"
                  class="botao-fechar-aba"
                  title={`Fechar aba “${s.doc.value.name}”`}
                  aria-label={`Fechar aba “${s.doc.value.name}”`}
                  data-testid={`fechar-aba-${aba.id}`}
                  onClick={e => {
                    e.stopPropagation();
                    aoFecharAba(aba.id);
                  }}
                >
                  <Icone nome="fechar" tamanho={11} />
                </button>
              </div>
            );
          }
          return (
            <div
              class="aba-mapa"
              key={aba.id}
              role="tab"
              aria-selected="false"
              data-aba-id={aba.id}
              onClick={() => navegar({ tipo: 'mapa', id: aba.id })}
              title={`Ir para ${aba.nome}`}
            >
              <span class="aba-rotulo">{aba.nome}</span>
              <button
                type="button"
                class={`botao-aba-projetor ${mapaNoProjetorId.value === aba.id ? 'projetando' : ''}`}
                title={`Mostrar ${aba.nome} na visão dos jogadores`}
                aria-label={`Mostrar ${aba.nome} na visão dos jogadores`}
                aria-pressed={mapaNoProjetorId.value === aba.id}
                data-testid={`aba-projetor-${aba.id}`}
                onClick={e => {
                  e.stopPropagation();
                  void projetarAba(aba.id);
                }}
              >
                <Icone nome="olho" tamanho={13} />
              </button>
              <button
                type="button"
                class="botao-fechar-aba"
                title={`Fechar aba “${aba.nome}”`}
                aria-label={`Fechar aba “${aba.nome}”`}
                data-testid={`fechar-aba-${aba.id}`}
                onClick={e => {
                  e.stopPropagation();
                  aoFecharAba(aba.id);
                }}
              >
                <Icone nome="fechar" tamanho={11} />
              </button>
            </div>
          );
        })}
      </div>
        {escondeDir ? (
          <button type="button" class="aba-seta dir" aria-label="Próximas abas" title="Próximas abas" data-testid="abas-rolar-direita" onClick={() => rolarAbas(1)}>›</button>
        ) : null}
      </div>

      <div class="aba-mais-container">
        <button
          ref={botaoMaisRef}
          type="button"
          class="aba-mais"
          title="Abrir mapa em nova aba"
          aria-label="Abrir mapa em nova aba"
          aria-expanded={popoverAberto}
          data-testid="abrir-nova-aba"
          onClick={() => {
            if (!popoverAberto) {
              void atualizarLista();
              setBusca('');
              setVerOutras(false);
            }
            setPopoverAberto(!popoverAberto);
          }}
        >
          <Icone nome="novo" tamanho={13} />
        </button>

        {popoverAberto ? (
          <div class="popover-nova-aba" ref={popoverRef}>
            <input
              type="search"
              class="busca-nova-aba"
              placeholder="Buscar mapa..."
              value={busca}
              onInput={e => setBusca((e.target as HTMLInputElement).value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Escape') setPopoverAberto(false);
              }}
            />
            <button
              type="button"
              class="item-criar-novo"
              data-testid="criar-novo-mapa-aba"
              onClick={async () => {
                setPopoverAberto(false);
                await criarMapaNovo();
              }}
            >
              <Icone nome="novo" tamanho={14} />
              Criar novo mapa
            </button>
            <div class="lista-mapas-aba">
              {filtrados.length > 0 ? (
                filtrados.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    class="item-mapa-aba"
                    onClick={() => {
                      setPopoverAberto(false);
                      navegar({ tipo: 'mapa', id: r.id });
                    }}
                  >
                    <span class="item-mapa-nome">{r.nome}</span>
                  </button>
                ))
              ) : (
                <div class="popover-vazio">
                  {outros.length === 0 ? (cid ? 'Nenhum outro mapa nesta campanha' : 'Nenhum outro mapa salvo') : 'Nenhum mapa encontrado'}
                </div>
              )}
              {deOutras.length > 0 ? (
                <>
                  <button type="button" class="item-outras-campanhas" data-testid="aba-outras-campanhas" aria-expanded={verOutras} onClick={() => setVerOutras(!verOutras)}>
                    Outras campanhas ({deOutras.length}) {verOutras ? '▾' : '▸'}
                  </button>
                  {verOutras ? deOutras.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      class="item-mapa-aba"
                      data-testid="item-mapa-outra-campanha"
                      onClick={() => {
                        setPopoverAberto(false);
                        navegar({ tipo: 'mapa', id: r.id });
                      }}
                    >
                      <span class="item-mapa-nome">{r.nome}</span>
                      <span class="item-mapa-campanha">{nomeDaCampanha(r.campanhaId)}</span>
                    </button>
                  )) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
