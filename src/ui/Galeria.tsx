import { Aprender, aprenderAberto } from './Aprender.tsx';
import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { campanhaAtiva, campanhas, criarCampanha, escolherCampanha } from '../app/campanha.ts';
import { criarMapaNovo, duplicarMapa, escolherArquivoParaImportar, exportar, mapaAusente, navegar, removerMapa, resumos, servicos } from '../app/app.ts';
import type { ResumoMapa } from '../data/repositorio.ts';
import { desenharMiniatura } from '../render/miniatura.ts';
import { avisar } from '../app/toasts.ts';
import { Icone } from './Icone.tsx';
import { tema } from '../app/tema.ts';

function Miniatura({ r }: { r: ResumoMapa }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let vivo = true;
    void servicos.value?.repo.obter(r.id).then(m => { if (vivo && m && ref.current) desenharMiniatura(ref.current, m, getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || '#e91d25'); }).catch(() => { /* a miniatura é só um enfeite */ });
    return () => { vivo = false; };
  }, [r.id, r.revisao, tema.value.id, tema.value.acento]);
  return <canvas ref={ref} width={320} height={200} class="miniatura" aria-hidden="true" />;
}

const quando = (t: number) => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function Cartao({ r }: { r: ResumoMapa }) {
  const campanha = r.campanhaId ? campanhas.value.find(c => c.id === r.campanhaId) : undefined;
  if (r.erro) return (
    <article class="cartao com-erro" data-testid="cartao-erro">
      <div class="cartao-corpo"><h3>{r.nome}</h3><p class="erro-texto"><Icone nome="aviso" tamanho={14} /> Não consegui ler este mapa.</p><p class="meta">{r.erro}</p></div>
      <div class="cartao-acoes"><button type="button" class="botao-pilula" onClick={() => void removerMapa(r.id)}><Icone nome="lixeira" tamanho={14} />Remover</button></div>
    </article>
  );
  return (
    <article class="cartao" data-testid="cartao-mapa" data-id={r.id}>
      <a class="cartao-link" href={`#/mapa/${encodeURIComponent(r.id)}`} onClick={e => { e.preventDefault(); navegar({ tipo: 'mapa', id: r.id }); }} aria-label={`Abrir ${r.nome}`}>
        <Miniatura r={r} />
        <div class="cartao-corpo"><h3>{r.nome}</h3>
          <p class="meta">{r.comodos} cômodo(s) · {r.objetos} objeto(s) · {r.luzes} luz(es) · {r.pecas} peça(s)</p>
          <p class="meta">{r.celulas[0]}×{r.celulas[1]} células · gravado {quando(r.atualizadoEm)}</p>
          {campanha && <p class="selo"><Icone nome="campanha" tamanho={12} /> {campanha.nome}</p>}
        </div>
      </a>
      <div class="cartao-acoes">
        <button type="button" class="botao-icone" title="Duplicar" onClick={() => void duplicarMapa(r.id)}><Icone nome="duplicar" /></button>
        <button type="button" class="botao-icone" title="Exportar" onClick={() => void exportar([r.id])}><Icone nome="exportar" /></button>
        <button type="button" class="botao-icone perigo" title="Remover" data-testid="remover-mapa" onClick={() => void removerMapa(r.id)}><Icone nome="lixeira" /></button>
      </div>
    </article>
  );
}

function BlocoDeCampanha() {
  const criando = useSignal(false);
  if (!servicos.value?.campanhas) return <p class="meta" data-testid="sem-campanha">O banco da campanha não está disponível neste navegador; os mapas funcionam normalmente.</p>;
  const confirmar = async (nome: string) => {
    criando.value = false;
    if (!nome.trim()) return;
    try { await criarCampanha(servicos.value!, nome.trim()); avisar(`Campanha “${nome.trim()}” criada.`); } catch (erro) { avisar(String(erro instanceof Error ? erro.message : erro), { tipo: 'erro' }); }
  };
  return (
    <div class="lateral-campanha">
      <select aria-label="Campanha ativa" data-testid="campanha-ativa" value={campanhaAtiva.value?.id ?? ''} onChange={e => escolherCampanha((e.target as HTMLSelectElement).value || null)}>
        <option value="">Sem campanha</option>
        {campanhas.value.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      {criando.value
        ? <input class="campo-inline" data-testid="nova-campanha-nome" placeholder="Nome da campanha e Enter" ref={el => el?.focus()} maxLength={120}
            onKeyDown={e => { if (e.key === 'Enter') void confirmar((e.target as HTMLInputElement).value); else if (e.key === 'Escape') { e.stopPropagation(); criando.value = false; } }} onBlur={() => { criando.value = false; }} />
        : <button type="button" class="lateral-item" data-testid="nova-campanha" onClick={() => { criando.value = true; }}><Icone nome="novo" tamanho={16} />Nova campanha</button>}
    </div>
  );
}

function Lateral({ total }: { total: number }) {
  return (
    <aside class="lateral" aria-label="Navegação">
      <nav class="lateral-grupo">
        <h2 class="lateral-titulo">Biblioteca</h2>
        <a class="lateral-item ativo" href="#/" aria-current="page" onClick={e => { e.preventDefault(); aprenderAberto.value = false; }}><Icone nome="regiao" tamanho={16} />Mapas<span class="lateral-conta">{total}</span></a>
        <button type="button" class="lateral-item" data-testid="aprender" aria-expanded={aprenderAberto.value} onClick={() => { aprenderAberto.value = !aprenderAberto.value; }}><Icone nome="ajuda" tamanho={16} />Aprender</button>
      </nav>
      <div class="lateral-grupo">
        <h2 class="lateral-titulo">Campanha</h2>
        <BlocoDeCampanha />
      </div>
      <div class="lateral-grupo">
        <h2 class="lateral-titulo">Arquivo</h2>
        <button type="button" class="lateral-item" onClick={escolherArquivoParaImportar} data-testid="importar"><Icone nome="importar" tamanho={16} />Importar</button>
        <button type="button" class="lateral-item" onClick={() => void exportar([])} disabled={!total} data-testid="exportar-tudo"><Icone nome="exportar" tamanho={16} />Exportar tudo</button>
      </div>
      <p class="lateral-rodape"><Icone nome="gaveta" tamanho={13} /> Tudo fica guardado neste navegador. Exporte uma cópia de vez em quando.</p>
    </aside>
  );
}

const ATALHOS_DE_INICIO = [
  { id: 'em-branco', icone: 'novo', titulo: 'Mapa em branco', texto: 'Comece do zero: cômodos, paredes, luzes e peças.' },
  { id: 'tutorial', icone: 'ajuda', titulo: 'Aprender fazendo', texto: 'Tutoriais guiados em um mapa de treino.' },
  { id: 'cartas', icone: 'importar', titulo: 'Importar cópia', texto: 'Traga mapas de uma cópia de segurança.' },
] as const;

function Comecar() {
  const agir = (id: (typeof ATALHOS_DE_INICIO)[number]['id']) => { if (id === 'em-branco') void criarMapaNovo(); else if (id === 'tutorial') aprenderAberto.value = true; else escolherArquivoParaImportar(); };
  return (
    <section class="comecar" aria-label="Começar">
      {ATALHOS_DE_INICIO.map(a => (
        <button type="button" key={a.id} class="comecar-cartao" data-testid={`comecar-${a.id}`} onClick={() => agir(a.id)}>
          <span class="comecar-icone"><Icone nome={a.icone} tamanho={20} /></span>
          <span class="comecar-texto"><b>{a.titulo}</b><small>{a.texto}</small></span>
        </button>
      ))}
    </section>
  );
}

function Numeros({ lista }: { lista: ResumoMapa[] }) {
  const ok = lista.filter(r => !r.erro), soma = (f: (r: ResumoMapa) => number) => ok.reduce((n, r) => n + f(r), 0);
  const itens: [string, number][] = [['Mapas', ok.length], ['Cômodos', soma(r => r.comodos)], ['Objetos', soma(r => r.objetos)], ['Luzes', soma(r => r.luzes)], ['Peças', soma(r => r.pecas)]];
  return <dl class="numeros" aria-label="Resumo">{itens.map(([nome, n]) => <div key={nome}><dd>{n}</dd><dt>{nome}</dt></div>)}</dl>;
}

function Continuar({ r }: { r: ResumoMapa }) {
  return (
    <section class="continuar" aria-labelledby="titulo-continuar" data-testid="continuar">
      <a class="continuar-miniatura" href={`#/mapa/${encodeURIComponent(r.id)}`} tabIndex={-1} aria-hidden="true" onClick={e => { e.preventDefault(); navegar({ tipo: 'mapa', id: r.id }); }}><Miniatura r={r} /></a>
      <div class="continuar-corpo">
        <p class="continuar-rotulo" id="titulo-continuar">Continuar de onde parou</p>
        <h2>{r.nome}</h2>
        <p class="meta">{r.comodos} cômodo(s) · {r.objetos} objeto(s) · {r.luzes} luz(es) · {r.pecas} peça(s) · gravado {quando(r.atualizadoEm)}</p>
        <button type="button" class="botao-pilula destaque" data-testid="continuar-abrir" onClick={() => navegar({ tipo: 'mapa', id: r.id })}>Abrir mapa</button>
      </div>
    </section>
  );
}

function Vazio() {
  return (
    <section class="vazio" data-testid="galeria-vazia">
      <svg class="vazio-desenho" viewBox="0 0 220 130" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 20h180v90H20z" opacity=".35" /><path d="M20 55h70M90 20v60M90 80h110M150 80v30" />
          <path d="M60 55v0M100 20v0" /><circle cx="52" cy="38" r="3" /><path d="M118 98l8-8 8 8-8 8z" /><path d="M165 40l14 0M172 33v14" opacity=".7" />
        </g>
        <circle cx="52" cy="38" r="22" fill="currentColor" opacity=".08" />
      </svg>
      <h2>Nenhum mapa ainda</h2>
      <p>Comece por um mapa em branco. Cada cômodo, luz e peça fica guardado como significado, não como imagem, e pode mudar de clima e de estilo depois.</p>
      <button type="button" class="botao-pilula destaque" onClick={() => void criarMapaNovo()}><Icone nome="novo" tamanho={15} />Criar o primeiro mapa</button>
    </section>
  );
}

export function Galeria() {
  const lista = resumos.value, busca = useSignal(''), q = busca.value.trim().toLowerCase();
  const recente = lista.filter(r => !r.erro).reduce<ResumoMapa | null>((m, r) => (!m || r.atualizadoEm > m.atualizadoEm ? r : m), null);
  const visiveis = q ? lista.filter(r => r.nome.toLowerCase().includes(q)) : lista;
  const hora = new Date().getHours(), saudacao = hora < 6 ? 'Boa madrugada' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <div class="plataforma">
      <Lateral total={lista.length} />
      <main class="galeria" aria-labelledby="titulo-galeria">
        <header class="galeria-topo">
          <div class="galeria-titulos">
            <p class="galeria-saudacao">{saudacao}{campanhaAtiva.value ? ` · ${campanhaAtiva.value.nome}` : ''}</p>
            <h1 id="titulo-galeria" class="faixa grande">Mapas</h1>
          </div>
          <div class="galeria-acoes">
            <button type="button" class="botao-pilula destaque" data-testid="novo-mapa" onClick={() => void criarMapaNovo()}><Icone nome="novo" tamanho={15} />Novo mapa</button>
          </div>
        </header>
        <Aprender />
        {mapaAusente.value && <p class="aviso" role="alert" data-testid="mapa-ausente"><Icone nome="aviso" tamanho={16} /> O mapa “{mapaAusente.value}” não existe neste navegador. Ele pode estar em outro computador: importe a cópia de segurança.</p>}
        {lista.length ? <Numeros lista={lista} /> : null}
        {recente && !q ? <Continuar r={recente} /> : null}
        {lista.length ? (<>
          <div class="galeria-secao">
            <h2 class="faixa pequena">Todos os mapas</h2>
            <input type="search" class="busca-mapas" placeholder="Buscar por nome" aria-label="Buscar mapas" value={busca.value} onInput={e => { busca.value = (e.target as HTMLInputElement).value; }} data-testid="buscar-mapas" />
          </div>
          {visiveis.length
            ? <div class="cartoes" data-testid="lista-mapas">{visiveis.map(r => <Cartao key={r.id} r={r} />)}</div>
            : <p class="dica" data-testid="busca-sem-resultado">Nenhum mapa com “{busca.value}”.</p>}
          <h2 class="faixa pequena">Começar</h2>
          <Comecar />
        </>) : (<><Vazio /><Comecar /></>)}
      </main>
    </div>
  );
}
