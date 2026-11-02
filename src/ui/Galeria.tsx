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

function BarraDeCampanha() {
  const criando = useSignal(false);
  if (!servicos.value?.campanhas) return <p class="meta" data-testid="sem-campanha">O banco da campanha não está disponível neste navegador; os mapas funcionam normalmente.</p>;
  const confirmar = async (nome: string) => {
    criando.value = false;
    if (!nome.trim()) return;
    try { await criarCampanha(servicos.value!, nome.trim()); avisar(`Campanha “${nome.trim()}” criada.`); } catch (erro) { avisar(String(erro instanceof Error ? erro.message : erro), { tipo: 'erro' }); }
  };
  return (
    <div class="barra-campanha">
      <label class="linha-campanha"><Icone nome="campanha" tamanho={16} /><span>Campanha</span>
        <select aria-label="Campanha ativa" data-testid="campanha-ativa" value={campanhaAtiva.value?.id ?? ''} onChange={e => escolherCampanha((e.target as HTMLSelectElement).value || null)}>
          <option value="">Sem campanha</option>
          {campanhas.value.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      {criando.value
        ? <input class="campo-inline" data-testid="nova-campanha-nome" placeholder="Nome da campanha e Enter" ref={el => el?.focus()} maxLength={120}
            onKeyDown={e => { if (e.key === 'Enter') void confirmar((e.target as HTMLInputElement).value); else if (e.key === 'Escape') { e.stopPropagation(); criando.value = false; } }} onBlur={() => { criando.value = false; }} />
        : <button type="button" class="botao-pilula" data-testid="nova-campanha" onClick={() => { criando.value = true; }}><Icone nome="novo" tamanho={14} />Campanha</button>}
    </div>
  );
}

export function Galeria() {
  const lista = resumos.value;
  return (
    <main class="galeria" aria-labelledby="titulo-galeria">
      <div class="galeria-topo">
        <h1 id="titulo-galeria" class="faixa grande">Mapas</h1>
        <div class="galeria-acoes">
          <button type="button" class="botao-pilula destaque" data-testid="novo-mapa" onClick={() => void criarMapaNovo()}><Icone nome="novo" tamanho={15} />Novo mapa</button>
          <button type="button" class="botao-pilula" onClick={escolherArquivoParaImportar} data-testid="importar"><Icone nome="importar" tamanho={15} />Importar</button>
          <button type="button" class="botao-pilula" onClick={() => void exportar([])} disabled={!lista.length} data-testid="exportar-tudo"><Icone nome="exportar" tamanho={15} />Exportar tudo</button>
        </div>
      </div>
      <BarraDeCampanha />
      {mapaAusente.value && <p class="aviso" role="alert" data-testid="mapa-ausente"><Icone nome="aviso" tamanho={16} /> O mapa “{mapaAusente.value}” não existe neste navegador. Ele pode estar em outro computador: importe a cópia de segurança.</p>}
      {lista.length
        ? <div class="cartoes" data-testid="lista-mapas">{lista.map(r => <Cartao key={r.id} r={r} />)}</div>
        : <section class="vazio" data-testid="galeria-vazia"><h2>Nenhum mapa ainda</h2><p>Comece por um mapa em branco. Cada cômodo, luz e peça fica guardado como significado, não como imagem, e pode mudar de clima e de estilo depois.</p>
            <button type="button" class="botao-pilula destaque" onClick={() => void criarMapaNovo()}><Icone nome="novo" tamanho={15} />Criar o primeiro mapa</button></section>}
    </main>
  );
}
