import { useState } from 'preact/hooks';
import { definirAndarAtivo } from '../app/app.ts';
import { modo } from '../app/modo.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { andarDe, ehMultiandar, listaDeAndares } from '../domain/andares.ts';
import { novoIdEntidade } from '../domain/fabrica.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { Icone } from './Icone.tsx';
import { tentar } from './campos.tsx';

function contarItensDoAndar(m: MapaAtlas, nivel: string): number {
  let n = 0;
  for (const dic of [m.rooms, m.props, m.lights, m.regions, m.presence, m.tokens]) {
    for (const item of Object.values(dic)) {
      if (andarDe(item) === nivel) n++;
    }
  }
  for (const w of Object.values(m.walls)) {
    if (andarDe(w) === nivel && !w.source) n++;
  }
  return n;
}

export function SeletorDeAndar({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value;
  const ativo = s.andarAtivo.value;
  const construir = modo.value === 'construir';
  const multi = ehMultiandar(m);
  const [menuNovo, setMenuNovo] = useState(false);
  const [editando, setEditando] = useState<string | null | undefined>(undefined);
  const [rascunho, setRascunho] = useState('');
  const [confirmando, setConfirmando] = useState<string | null>(null);

  if (!multi && !construir) return null;

  const lista = listaDeAndares(m);
  const jogadoresPorAndar = new Map<string | null, number>();
  if (!construir) {
    for (const t of Object.values(m.tokens)) {
      if (t.player) jogadoresPorAndar.set(andarDe(t), (jogadoresPorAndar.get(andarDe(t)) ?? 0) + 1);
    }
  }

  const criarAndar = (direcao: 1 | -1) => {
    const orders = lista.map(a => a.order);
    const order = direcao > 0 ? Math.max(0, ...orders) + 1 : Math.min(0, ...orders) - 1;
    const nSub = Math.abs(order);
    const name = order > 0 ? `Andar ${order}` : nSub === 1 ? 'Porão' : `Subsolo ${nSub}`;
    const id = novoIdEntidade('n');
    if (tentar(() => s.store.executar({ tipo: 'andar.criar', andar: { id, name, order } }, { rotulo: `Criar ${name}` }))) {
      definirAndarAtivo(id);
      setMenuNovo(false);
    }
  };

  if (!multi) {
    return (
      <div class="seletor-de-andar" data-testid="seletor-de-andar">
        <button
          type="button"
          class="andar-gatilho"
          data-testid="botao-criar-andar"
          onClick={() => setMenuNovo(v => !v)}
          title="Adicionar outro andar ao mapa"
        >
          <Icone nome="mais" tamanho={13} />
          <span>Andar</span>
        </button>
        {menuNovo && (
          <div class="andar-menu-novo">
            <button type="button" data-testid="andar-mais-acima" onClick={() => criarAndar(1)}>+ Andar acima</button>
            <button type="button" data-testid="andar-mais-porao" onClick={() => criarAndar(-1)}>+ Porão</button>
          </div>
        )}
      </div>
    );
  }

  const salvarNome = (id: string | null) => {
    const limpo = rascunho.trim();
    setEditando(undefined);
    if (!limpo) return;
    const atual = lista.find(a => a.id === id)?.nome;
    if (atual === limpo) return;
    tentar(() => s.store.executar({ tipo: 'andar.atualizar', id, patch: { name: limpo } }, { rotulo: 'Renomear andar' }));
  };

  const removerAndar = (id: string, nome: string) => {
    setConfirmando(null);
    if (tentar(() => s.store.executar({ tipo: 'andar.remover', id }, { rotulo: `Remover ${nome}` }))) {
      if (ativo === id) definirAndarAtivo(null);
    }
  };

  const contagens = confirmando ? contarItensDoAndar(m, confirmando) : 0;
  const itemConfirmar = confirmando ? lista.find(a => a.id === confirmando) : null;

  return (
    <div class="seletor-de-andar painel-andares" data-testid="seletor-de-andar">
      <div class="andares-lista" role="listbox" aria-label="Andares do mapa">
        {[...lista].reverse().map(item => {
          const ehAtivo = item.id === ativo;
          const estaEditando = editando !== undefined && editando === item.id;
          return (
            <div key={item.id ?? '__terreo'} class={`andar-linha ${ehAtivo ? 'ativo' : ''}`} data-testid={`andar-item-${item.id ?? 'terreo'}`}>
              {estaEditando ? (
                <input
                  type="text"
                  class="andar-input"
                  value={rascunho}
                  autoFocus
                  maxLength={40}
                  data-testid="andar-input-nome"
                  onInput={e => setRascunho((e.target as HTMLInputElement).value)}
                  onBlur={() => salvarNome(item.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') salvarNome(item.id);
                    else if (e.key === 'Escape') setEditando(undefined);
                  }}
                />
              ) : (
                <button
                  type="button"
                  class="andar-nome"
                  aria-current={ehAtivo ? 'true' : undefined}
                  onClick={() => definirAndarAtivo(item.id)}
                  onDblClick={() => { if (construir) { setEditando(item.id); setRascunho(item.nome); } }}
                >
                  <span class="andar-ordem">{item.order === 0 ? 'T' : item.order > 0 ? `+${item.order}` : item.order}</span>
                  <span>{item.nome}</span>
                  {!construir && (jogadoresPorAndar.get(item.id) ?? 0) > 0 && (
                    <span class="andar-jogadores" data-testid={`andar-jogadores-${item.id ?? 'terreo'}`}>
                      {jogadoresPorAndar.get(item.id)} {jogadoresPorAndar.get(item.id) === 1 ? 'peça' : 'peças'}
                    </span>
                  )}
                </button>
              )}
              {construir && !estaEditando && (
                <span class="andar-acoes">
                  <button
                    type="button"
                    class="andar-btn"
                    title="Renomear andar"
                    aria-label={`Renomear ${item.nome}`}
                    data-testid={`renomear-andar-${item.id ?? 'terreo'}`}
                    onClick={() => { setEditando(item.id); setRascunho(item.nome); }}
                  >
                    ✎
                  </button>
                  {item.id !== null && (
                    <button
                      type="button"
                      class="andar-btn perigo"
                      title="Remover andar"
                      aria-label={`Remover ${item.nome}`}
                      data-testid={`remover-andar-${item.id}`}
                      onClick={() => setConfirmando(item.id!)}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {confirmando && itemConfirmar && (
        <div class="andar-confirmar" data-testid="confirmar-remover-andar">
          <span>Apagar {itemConfirmar.nome} ({contagens} {contagens === 1 ? 'item' : 'itens'})?</span>
          <div class="andar-confirmar-botoes">
            <button type="button" class="andar-btn-confirmar" data-testid="botao-confirmar-remover-andar" onClick={() => removerAndar(itemConfirmar.id!, itemConfirmar.nome)}>Apagar</button>
            <button type="button" onClick={() => setConfirmando(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {construir && (
        <div class="andar-rodape">
          <button type="button" data-testid="andar-mais-acima" onClick={() => criarAndar(1)} title="Adicionar andar acima">+ Acima</button>
          <button type="button" data-testid="andar-mais-porao" onClick={() => criarAndar(-1)} title="Adicionar porão abaixo">+ Porão</button>
        </div>
      )}
    </div>
  );
}
