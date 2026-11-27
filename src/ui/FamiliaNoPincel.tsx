import { useEffect, useRef } from 'preact/hooks';
import { signal, useSignal } from '@preact/signals';
import { tocar } from '../fx/som.ts';
import { ACERVO, itemBloqueiaMovimentoPorPadrao } from '../procedural/acervo.ts';
import { BIOMAS, GRUPOS_DE_OBJETOS, familiasVisiveis, type Familia } from '../procedural/familias.ts';
import { GENEROS, generoDe } from '../domain/presets.ts';
import { definirFiltroDeBioma, definirFiltroDeEpoca, filtroDeBioma, filtroDeEpoca, generoDoFiltro } from '../app/filtros.ts';
import { normalizar, pontuar } from '../app/busca.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { definirRecentesAbertos, recentesAbertos } from '../app/preferencias.ts';
import { alternarFavoritoDaFamilia, favoritos, recentes } from '../app/recentes.ts';
import { desenharPrevia, pedirPrevia } from './previa.ts';

export function MiniReceita({ id, tamanho = 72 }: { id: string; tamanho?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let vivo = true; void pedirPrevia(id, {}, 3, tamanho).then(r => { if (vivo && ref.current) desenharPrevia(ref.current, r); }).catch(() => { /* a miniatura é só um enfeite */ }); return () => { vivo = false; }; }, [id, tamanho]);
  return <canvas ref={ref} width={tamanho} height={tamanho} class="mini-receita" style={tamanho === 72 ? undefined : { width: `${tamanho * 0.75}px`, height: `${tamanho * 0.75}px` }} aria-hidden="true" />;
}

/** Põe um item (a variante) no pincel, junto com a família dele. Mantém rotação, dado e semente. */
function pegarItem(s: SessaoDeEdicao, id: string, ferramenta = true): void {
  catalogoAberto.value = false;
  const o = s.pincel.value.objeto;
  if (ferramenta) s.ferramenta.value = 'objeto';
  s.pincel.value = { ...s.pincel.value, objeto: { ...o, item: id, params: {}, familia: ACERVO.familiaDoItem(id)?.id ?? null, bloqueia: itemBloqueiaMovimentoPorPadrao(id) } };
  tocar('selecionar');
}

/** `fora`: a família não combina com o filtro (só aparece na busca, que o ignora). */
interface Resultado { familia: Familia; item: string; nota: number; fora?: boolean }

export interface Filtro { genero: string | null; bioma: string | null }

/** Tags, funções e categoria só casam por trecho inteiro e valem menos que o nome: a busca por letras soltas num texto longo acharia quase tudo. */
const extrasDoItem = (id: string): string => { const r = ACERVO.item(id); return r ? normalizar(`${r.tags.join(' ')} ${r.funcoes.join(' ')} ${r.categoria}`) : ''; };
function notaDoItem(q: string, id: string): number {
  const r = ACERVO.item(id); if (!r) return 0;
  const doNome = pontuar(q, r.nome); if (doNome >= 100) return doNome;
  return q.split(/\s+/).every(p => extrasDoItem(id).includes(p)) ? 50 : 0;
}

/** Famílias do grupo que casam com a consulta (pelo nome da família, dos itens, das tags e das funções), com a primeira variante que casou (ou a primeira da família). */
export function buscarFamilias(consulta: string, grupo: string | null, filtro?: Filtro): Resultado[] {
  const q = normalizar(consulta), todas = ACERVO.familias().filter(f => !grupo || f.grupo === grupo);
  const visiveis = filtro ? new Set(familiasVisiveis(filtro.genero, filtro.bioma).map(f => f.id)) : null;
  // O filtro vale só sem busca: quem procura pelo nome quer achar o item, e o que está fora do filtro vem marcado.
  if (!q) return todas.filter(f => !visiveis || visiveis.has(f.id)).map(familia => ({ familia, item: familia.itens[0]!, nota: 1 }));
  const out: Resultado[] = [], lista = todas;
  lista.forEach(familia => {
    const notas = familia.itens.map(id => notaDoItem(q, id)), k = notas.findIndex(n => n > 0);
    const nota = Math.max(pontuar(q, familia.nome), ...notas);
    if (nota > 0) out.push({ familia, item: k >= 0 ? familia.itens[k]! : familia.itens[0]!, nota, ...(visiveis && !visiveis.has(familia.id) ? { fora: true } : {}) });
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
        <b data-testid="familia-nome">{familia && <button type="button" class={`estrela ${favoritos.value.includes(familia.id) ? 'ativa' : ''}`} aria-pressed={favoritos.value.includes(familia.id)} title="Fixar a família em Favoritos" aria-label="Favorita" onClick={() => alternarFavoritoDaFamilia(familia.id)} data-testid="familia-estrela">{favoritos.value.includes(familia.id) ? '★' : '☆'}</button>}{familia?.nome ?? item.nome}</b>
        <span class="familia-botoes">
          {n > 1 && <button type="button" class={`chip ${o.varianteAleatoria ? 'ativo' : ''}`} aria-pressed={o.varianteAleatoria} title="Sorteia a variante a cada objeto posto" onClick={() => { s.pincel.value = { ...s.pincel.value, objeto: { ...o, varianteAleatoria: !o.varianteAleatoria } }; tocar('selecionar'); }} data-testid="variante-dado">🎲</button>}
          {temReceita && <button type="button" class={`chip ${variarDesenho ? 'ativo' : ''}`} aria-pressed={variarDesenho} title="Variar o desenho: cada objeto sai com um desenho diferente" aria-label="Variar o desenho" onClick={() => { s.pincel.value = { ...s.pincel.value, objeto: { ...o, semente: variarDesenho ? 3 : null } }; tocar('selecionar'); }} data-testid="variar-desenho">🎨</button>}
        </span>
      </div>
      <div class="familia-corpo">
        <div class="familia-previa">
          <button type="button" class="familia-previa-abrir" title="Abrir o catálogo" aria-label="Abrir o catálogo" aria-expanded={catalogoAberto.value}
            onMouseEnter={() => agendarCatalogo(true, ABRIR_MS)} onMouseLeave={() => agendarCatalogo(false, FECHAR_MS)} onClick={() => { abrirPorClique.value = true; agendarCatalogo(true, 0); }} data-testid="abrir-catalogo">
            <MiniReceita id={o.item} tamanho={140} /><span class="familia-previa-rotulo">Catálogo</span>
          </button>
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

/** O selo de uma família achada fora do filtro: a época (ou o bioma) a que ela pertence. */
function seloDeFora(f: Familia): string {
  const g = f.generos?.[0], b = f.biomas?.[0];
  return g ? generoDe(g).nome : (BIOMAS.find(x => x.id === b)?.nome ?? '');
}

/** O filtro em vigor: a época (do mapa, escolhida ou todas) e o bioma, que só vale na Natureza. */
function filtroAtual(s: SessaoDeEdicao, grupo: string | null): Filtro {
  return { genero: generoDoFiltro(filtroDeEpoca.value, s.doc.value.style.genre), bioma: grupo === 'natureza' ? filtroDeBioma.value : null };
}

/** Bioma em `<select>` compacto (Natureza e gaveta de terreno). */
export function SeletorDeBioma() {
  return (
    <select class="filtro-select" aria-label="Bioma" value={filtroDeBioma.value ?? ''} onChange={e => definirFiltroDeBioma((e.target as HTMLSelectElement).value || null)} data-testid="filtro-bioma">
      <option value="">Todos os biomas</option>
      {BIOMAS.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
    </select>
  );
}

/** Busca, filtros de grupo e de época (em `<select>`) e a grade de famílias. */
export function CatalogoDeFamilias({ s }: { s: SessaoDeEdicao }) {
  const consulta = useSignal(''), grupo = useSignal<string | null>(null), atual = s.pincel.value.objeto;
  const lista = buscarFamilias(consulta.value, grupo.value, filtroAtual(s, grupo.value));
  const buscando = normalizar(consulta.value) !== '';
  // Grupos que o filtro esvazia somem dos chips (o grupo escolhido fica, para dar para voltar).
  const filtroSemGrupo = filtroAtual(s, null), grupos = GRUPOS_DE_OBJETOS.filter(g => grupo.value === g.id || buscando || buscarFamilias('', g.id, { ...filtroSemGrupo, bioma: g.id === 'natureza' ? filtroDeBioma.value : null }).length > 0);
  const vazio = !lista.length && !buscando;
  return (<>
    <input class="busca" type="search" placeholder="Buscar: mesa, cama, árvore…" aria-label="Buscar objeto" value={consulta.value} onInput={e => { consulta.value = (e.target as HTMLInputElement).value; }} data-testid="busca-objeto" />
    <div class="filtros-linha">
      <select class="filtro-select" aria-label="Grupo" value={grupo.value ?? ''} onChange={e => { grupo.value = (e.target as HTMLSelectElement).value || null; }} data-testid="filtro-grupo">
        <option value="">Todos os grupos</option>
        {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
      <select class="filtro-select" aria-label="Época" value={filtroDeEpoca.value} onChange={e => definirFiltroDeEpoca((e.target as HTMLSelectElement).value)} data-testid="filtro-epoca">
        <option value="mapa">Deste mapa ({generoDe(s.doc.value.style.genre).nome})</option>
        {GENEROS.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        <option value="todas">Todas as épocas</option>
      </select>
    </div>
    {grupo.value === 'natureza' && <div class="filtros-linha"><SeletorDeBioma /></div>}
    <div class="grade-receitas" data-testid="lista-receitas">
      {lista.map(({ familia, item, fora }) => (
        <button type="button" key={familia.id} class={`receita ${atual.familia === familia.id ? 'ativa' : ''}`} onClick={() => pegarItem(s, item)} title={`${familia.nome} · ${familia.itens.length} ${familia.itens.length === 1 ? 'variante' : 'variantes'}`} data-testid={`familia-${familia.id}`}>
          <MiniReceita id={item} /><span>{familia.nome}</span>{fora ? <i class="selo-acervo" title="Fora do filtro de época">{seloDeFora(familia)}</i> : familia.itens.length > 1 && <i class="selo-variantes">{familia.itens.length}</i>}
        </button>
      ))}
      {!lista.length && buscando && <p class="dica">Nada com “{consulta.value}”.</p>}
      {vazio && <p class="dica" data-testid="filtro-vazio">Nada desta época aqui — <button type="button" class="chip" onClick={() => { definirFiltroDeEpoca('todas'); definirFiltroDeBioma(null); }} data-testid="ver-todas">ver todas</button></p>}
    </div>
  </>);
}

/** Abas "Recentes | Favoritos": itens postos por último e famílias fixadas. */
export function RecentesEFavoritos({ s }: { s: SessaoDeEdicao }) {
  const aba = useSignal<'recentes' | 'favoritos'>('recentes'), atual = s.pincel.value.objeto;
  const itens = recentes.value.filter(id => ACERVO.item(id));
  const familias = favoritos.value.map(id => ACERVO.familias().find(f => f.id === id)).filter((f): f is Familia => !!f);
  const aberto = recentesAbertos.value;
  return (
    <div class="recentes-favoritos" data-testid="recentes-favoritos">
      <button type="button" class="chip ver-mais" aria-expanded={aberto} onClick={() => definirRecentesAbertos(!aberto)} data-testid="recentes-alternar">{aberto ? '▾' : '▸'} Recentes e favoritos</button>
      {aberto && <>
      <div class="chips" role="tablist">
        <button type="button" role="tab" aria-selected={aba.value === 'recentes'} class={`chip ${aba.value === 'recentes' ? 'ativo' : ''}`} onClick={() => { aba.value = 'recentes'; }} data-testid="aba-recentes">Recentes</button>
        <button type="button" role="tab" aria-selected={aba.value === 'favoritos'} class={`chip ${aba.value === 'favoritos' ? 'ativo' : ''}`} onClick={() => { aba.value = 'favoritos'; }} data-testid="aba-favoritos">Favoritos</button>
      </div>
      <div class="grade-receitas" data-testid={`lista-${aba.value}`}>
        {aba.value === 'recentes' && itens.map(id => { const r = ACERVO.item(id)!; return (
          <button type="button" key={id} class={`receita ${atual.item === id ? 'ativa' : ''}`} onClick={() => pegarItem(s, id)} title={r.nome} data-testid={`recente-${id}`}><MiniReceita id={id} /><span>{r.nome}</span></button>
        ); })}
        {aba.value === 'favoritos' && familias.map(f => (
          <button type="button" key={f.id} class={`receita ${atual.familia === f.id ? 'ativa' : ''}`} onClick={() => pegarItem(s, f.itens[0]!)} title={f.nome} data-testid={`favorito-${f.id}`}><MiniReceita id={f.itens[0]!} /><span>{f.nome}</span></button>
        ))}
        {aba.value === 'recentes' && !itens.length && <p class="dica">Os objetos que você puser aparecem aqui.</p>}
        {aba.value === 'favoritos' && !familias.length && <p class="dica">Toque na estrela da família na mão para fixá-la aqui.</p>}
      </div>
      </>}
    </div>
  );
}

/** O catálogo flutuante: abre ao parar o mouse sobre a prévia da família na mão (ou ao clicar nela) e fecha ao sair dele, com Esc ou ao escolher. */
export const catalogoAberto = signal(false);
/** Aberto por clique: a busca recebe o foco (por passagem do mouse, não rouba o teclado dos atalhos do mapa). */
const abrirPorClique = signal(false);
const ABRIR_MS = 220, FECHAR_MS = 450;
let relogio: ReturnType<typeof setTimeout> | undefined;
function agendarCatalogo(abrir: boolean, ms: number): void {
  clearTimeout(relogio);
  if (!abrir && !catalogoAberto.peek()) { abrirPorClique.value = false; return; }
  relogio = setTimeout(() => { catalogoAberto.value = abrir; if (!abrir) abrirPorClique.value = false; }, ms);
}

export function CatalogoFlutuante({ s }: { s: SessaoDeEdicao }) {
  const consulta = useSignal(''), busca = useRef<HTMLInputElement>(null), atual = s.pincel.value.objeto;
  const aberto = catalogoAberto.value;
  useEffect(() => {
    if (!aberto) return;
    if (abrirPorClique.peek()) busca.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); clearTimeout(relogio); catalogoAberto.value = false; } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aberto]);
  useEffect(() => () => { clearTimeout(relogio); catalogoAberto.value = false; }, []);
  if (!aberto) return null;
  const genero = generoDoFiltro(filtroDeEpoca.value, s.doc.value.style.genre), bioma = filtroDeBioma.value;
  const buscando = normalizar(consulta.value) !== '';
  const lista = buscarFamilias(consulta.value, null, { genero, bioma: null }).filter(r => buscando || !bioma || r.familia.grupo !== 'natureza' || !r.familia.biomas?.length || r.familia.biomas.includes(bioma));
  const secoes = buscando ? [{ id: 'busca', nome: `${lista.length} ${lista.length === 1 ? 'família' : 'famílias'}`, itens: lista }]
    : GRUPOS_DE_OBJETOS.map(g => ({ id: g.id, nome: g.nome, itens: lista.filter(r => r.familia.grupo === g.id) })).filter(x => x.itens.length);
  // Ficar com o foco na busca segura o catálogo aberto mesmo com o mouse fora.
  const sair = () => { if (document.activeElement !== busca.current) agendarCatalogo(false, FECHAR_MS); };
  return (
    <div class="catalogo-flutuante" role="dialog" aria-label="Catálogo de objetos" data-testid="catalogo-flutuante"
      onMouseEnter={() => clearTimeout(relogio)} onMouseLeave={sair}>
      <div class="catalogo-topo">
        <input ref={busca} class="busca" type="search" placeholder="Buscar no catálogo…" aria-label="Buscar no catálogo" value={consulta.value}
          onInput={e => { consulta.value = (e.target as HTMLInputElement).value; }} onBlur={e => { const p = (e.currentTarget as HTMLElement).closest('.catalogo-flutuante'); if (p && !p.matches(':hover')) agendarCatalogo(false, FECHAR_MS); }} data-testid="busca-catalogo" />
        <button type="button" class="botao-icone" aria-label="Fechar o catálogo" title="Fechar (Esc)" onClick={() => { clearTimeout(relogio); catalogoAberto.value = false; }}>✕</button>
      </div>
      <div class="catalogo-corpo">
        {secoes.map(sec => (
          <section key={sec.id} class="catalogo-secao">
            <h4 class="faixa pequena">{sec.nome} <span>({sec.itens.length})</span></h4>
            <div class="catalogo-grade">
              {sec.itens.map(({ familia, item, fora }) => (
                <button type="button" key={familia.id} class={`receita ${atual.familia === familia.id ? 'ativa' : ''}`} onClick={() => pegarItem(s, item)} title={`${familia.nome} · ${familia.itens.length} ${familia.itens.length === 1 ? 'variante' : 'variantes'}`} data-testid={`catalogo-${familia.id}`}>
                  <MiniReceita id={item} /><span>{familia.nome}</span>{fora ? <i class="selo-acervo" title="Fora do filtro de época">{seloDeFora(familia)}</i> : familia.itens.length > 1 && <i class="selo-variantes">{familia.itens.length}</i>}
                </button>
              ))}
            </div>
          </section>
        ))}
        {!lista.length && <p class="dica">Nada com “{consulta.value}”.</p>}
      </div>
    </div>
  );
}
