import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { tocar } from '../fx/som.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { GRUPOS_DE_OBJETOS, type Familia } from '../procedural/familias.ts';
import { normalizar, pontuar } from '../app/busca.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { desenharPrevia, pedirPrevia } from './previa.ts';

export function MiniReceita({ id, tamanho = 72 }: { id: string; tamanho?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let vivo = true; void pedirPrevia(id, {}, 3, tamanho).then(r => { if (vivo && ref.current) desenharPrevia(ref.current, r); }).catch(() => { /* a miniatura é só um enfeite */ }); return () => { vivo = false; }; }, [id, tamanho]);
  return <canvas ref={ref} width={tamanho} height={tamanho} class="mini-receita" style={tamanho === 72 ? undefined : { width: `${tamanho * 0.75}px`, height: `${tamanho * 0.75}px` }} aria-hidden="true" />;
}

/** Põe um item (a variante) no pincel, junto com a família dele. Mantém rotação, dado e semente. */
function pegarItem(s: SessaoDeEdicao, id: string, ferramenta = true): void {
  const o = s.pincel.value.objeto;
  if (ferramenta) s.ferramenta.value = 'objeto';
  s.pincel.value = { ...s.pincel.value, objeto: { ...o, item: id, params: {}, familia: ACERVO.familiaDoItem(id)?.id ?? null } };
  tocar('selecionar');
}

const textoDoItem = (id: string): string => { const r = ACERVO.item(id); return r ? `${r.nome} ${r.tags.join(' ')} ${r.funcoes.join(' ')} ${r.categoria}` : ''; };

interface Resultado { familia: Familia; item: string; nota: number }

/** Famílias do grupo que casam com a consulta, com a primeira variante que casou (ou a primeira da família). */
export function buscarFamilias(consulta: string, grupo: string | null): Resultado[] {
  const q = normalizar(consulta), lista = ACERVO.familias().filter(f => !grupo || f.grupo === grupo);
  if (!q) return lista.map(familia => ({ familia, item: familia.itens[0]!, nota: 1 }));
  const out: Resultado[] = [];
  lista.forEach(familia => {
    const doNome = pontuar(q, familia.nome), casou = familia.itens.find(id => pontuar(q, textoDoItem(id)) > 0);
    const nota = Math.max(doNome, ...familia.itens.map(id => pontuar(q, textoDoItem(id))));
    if (nota > 0) out.push({ familia, item: casou ?? familia.itens[0]!, nota });
  });
  return out.map((r, i) => ({ r, i })).sort((a, b) => b.r.nota - a.r.nota || a.i - b.i).map(x => x.r);
}

/** A família na mão: prévia grande com setas, miniaturas das variantes, dado e “Variar o desenho”. */
export function FamiliaNaMao({ s }: { s: SessaoDeEdicao }) {
  const o = s.pincel.value.objeto, item = ACERVO.item(o.item);
  if (!item) return null;
  const familia = ACERVO.familiaDoItem(o.item), itens = familia?.itens ?? [o.item], n = itens.length, i = Math.max(0, itens.indexOf(o.item));
  const ir = (d: number) => pegarItem(s, itens[(i + d + n) % n]!);
  const temReceita = itens.some(id => ACERVO.item(id)?.fonte === 'receita');
  const variarDesenho = o.semente === null;
  return (
    <div class="familia-mao" data-testid="familia-na-mao">
      <div class="familia-titulo">
        <b data-testid="familia-nome">{familia?.nome ?? item.nome}</b>
        <span class="familia-botoes">
          {n > 1 && <button type="button" class={`chip ${o.varianteAleatoria ? 'ativo' : ''}`} aria-pressed={o.varianteAleatoria} title="Sorteia a variante a cada objeto posto" onClick={() => { s.pincel.value = { ...s.pincel.value, objeto: { ...o, varianteAleatoria: !o.varianteAleatoria } }; tocar('selecionar'); }} data-testid="variante-dado">🎲</button>}
          {temReceita && <button type="button" class={`chip ${variarDesenho ? 'ativo' : ''}`} aria-pressed={variarDesenho} title="Cada objeto sai com um desenho diferente" onClick={() => { s.pincel.value = { ...s.pincel.value, objeto: { ...o, semente: variarDesenho ? 3 : null } }; tocar('selecionar'); }} data-testid="variar-desenho">Variar o desenho</button>}
        </span>
      </div>
      <div class="familia-corpo">
        <div class="familia-previa">
          <MiniReceita id={o.item} tamanho={140} />
          {n > 1 && <div class="familia-setas">
            <button type="button" class="chip" onClick={() => ir(-1)} aria-label="Variante anterior" data-testid="variante-anterior">‹</button>
            <span data-testid="variante-posicao">{i + 1} / {n}</span>
            <button type="button" class="chip" onClick={() => ir(1)} aria-label="Próxima variante" data-testid="variante-proxima">›</button>
          </div>}
        </div>
        {n > 1 && <div class="familia-variantes">
          {itens.map((id, k) => { const r = ACERVO.item(id); return r && (
            <button type="button" key={id} class={`receita ${o.item === id ? 'ativa' : ''}`} onClick={() => pegarItem(s, id)} title={`${r.nome} · ${r.pegada[0]} × ${r.pegada[1]} m`} data-testid={`receita-${id}`}>
              <MiniReceita id={id} /><span>{k + 1}</span>{r.fonte === 'colecao' && <i class="selo-acervo" title="Imagem da coleção da casa">acervo</i>}
            </button>
          ); })}
        </div>}
      </div>
    </div>
  );
}

/** Busca, chips de grupo e a grade de famílias. */
export function CatalogoDeFamilias({ s }: { s: SessaoDeEdicao }) {
  const consulta = useSignal(''), grupo = useSignal<string | null>(null), atual = s.pincel.value.objeto;
  const lista = buscarFamilias(consulta.value, grupo.value);
  return (<>
    <input class="busca" type="search" placeholder="Buscar: mesa, cama, árvore…" aria-label="Buscar objeto" value={consulta.value} onInput={e => { consulta.value = (e.target as HTMLInputElement).value; }} data-testid="busca-objeto" />
    <div class="chips">
      <button type="button" class={`chip ${!grupo.value ? 'ativo' : ''}`} onClick={() => { grupo.value = null; }}>Todos</button>
      {GRUPOS_DE_OBJETOS.map(g => <button type="button" key={g.id} class={`chip ${grupo.value === g.id ? 'ativo' : ''}`} onClick={() => { grupo.value = grupo.value === g.id ? null : g.id; }} data-testid={`grupo-${g.id}`}>{g.nome}</button>)}
    </div>
    <div class="grade-receitas" data-testid="lista-receitas">
      {lista.map(({ familia, item }) => (
        <button type="button" key={familia.id} class={`receita ${atual.familia === familia.id ? 'ativa' : ''}`} onClick={() => pegarItem(s, item)} title={`${familia.nome} · ${familia.itens.length} ${familia.itens.length === 1 ? 'variante' : 'variantes'}`} data-testid={`familia-${familia.id}`}>
          <MiniReceita id={item} /><span>{familia.nome}</span>{familia.itens.length > 1 && <i class="selo-variantes">{familia.itens.length}</i>}
        </button>
      ))}
      {!lista.length && <p class="dica">Nada com “{consulta.value}”.</p>}
    </div>
  </>);
}
