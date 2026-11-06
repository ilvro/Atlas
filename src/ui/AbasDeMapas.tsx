import { useState, useRef, useEffect } from 'preact/hooks';
import { abasAbertas, fecharAba } from '../app/abas.ts';
import { criarMapaNovo, navegar, renomearMapaAberto, resumos, sessao, atualizarLista } from '../app/app.ts';
import { tituloDoEstado } from '../app/sessao.ts';
import { filtrar } from '../app/busca.ts';
import { Icone } from './Icone.tsx';

export function AbasDeMapas() {
  const s = sessao.value;
  const abas = abasAbertas.value;
  const ativoId = s?.doc.value.id;

  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const botaoMaisRef = useRef<HTMLButtonElement>(null);
  const abaAtivaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    abaAtivaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [ativoId]);

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
    const proximoId = fecharAba(id);
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

  const outros = resumos.value.filter(r => !listaAbas.some(a => a.id === r.id));
  const filtrados = filtrar(outros, busca, r => r.nome);

  return (
    <div class="abas-de-mapas" role="tablist" aria-label="Mapas abertos">
      <div class="abas-lista">
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
                  {outros.length === 0 ? 'Nenhum outro mapa salvo' : 'Nenhum mapa encontrado'}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
