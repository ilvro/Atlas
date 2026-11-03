import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { modo } from '../app/modo.ts';
import { tocar } from '../fx/som.ts';
import { TIPOS_DE_COMODO, PRESETS_DE_LUZ, PACOTES_DE_PRESENCA, PINCEIS_DE_PRESENCA } from '../domain/presets.ts';
import type { Pincel } from '../render/pincel.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { materialDe, materiaisDo } from '../procedural/materiais.ts';
import { ACERVO, type ItemDoAcervo } from '../procedural/acervo.ts';
import { CATEGORIAS } from '../procedural/receitas/index.ts';
import { filtrar } from '../app/busca.ts';
import { CampoNumero } from './campos.tsx';
import { TODOS_OS_CONJUNTOS } from '../authoring/espalhar.ts';
import { Amostra, CampoMaterial } from './campos-material.tsx';
import { Icone } from './Icone.tsx';
import { desenharPrevia, pedirPrevia } from './previa.ts';

function MiniReceita({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let vivo = true; void pedirPrevia(id).then(r => { if (vivo && ref.current) desenharPrevia(ref.current, r); }).catch(() => { /* a miniatura é só um enfeite */ }); return () => { vivo = false; }; }, [id]);
  return <canvas ref={ref} width={72} height={72} class="mini-receita" aria-hidden="true" />;
}

function mudar(s: SessaoDeEdicao, patch: Partial<Pincel>): void { s.pincel.value = { ...s.pincel.value, ...patch }; tocar('selecionar'); }

function Comodos({ s }: { s: SessaoDeEdicao }) {
  return (<>
    <p class="dica">Pinte no mapa. Comece sobre um cômodo para estendê-lo; <kbd>Shift</kbd> pinta um retângulo.</p>
    <div class="lista-cartas">
      {TIPOS_DE_COMODO.map(t => (
        <button type="button" key={t.id} class={`carta ${s.pincel.value.comodo === t.id ? 'ativa' : ''}`} onClick={() => mudar(s, { comodo: t.id })} title={t.descricao} data-testid={`comodo-${t.id}`}>
          <span class="carta-amostras"><Amostra id={t.piso} tamanho={22} /><Amostra id={t.papel} tamanho={22} /></span><span class="carta-nome">{t.nome}</span><span class="carta-desc">{t.descricao}</span>
        </button>
      ))}
    </div>
  </>);
}

function Objetos({ s }: { s: SessaoDeEdicao }) {
  const consulta = useSignal(''), categoria = useSignal<string | null>(null), atual = s.pincel.value.objeto, receita = ACERVO.item(atual.item);
  const lista = filtrar(ACERVO.lista().filter(r => !categoria.value || r.categoria === categoria.value), consulta.value, r => `${r.nome} ${r.tags.join(' ')} ${r.funcoes.join(' ')} ${r.categoria}`);
  const escolher = (r: ItemDoAcervo) => { s.ferramenta.value = 'objeto'; s.pincel.value = { ...s.pincel.value, objeto: { item: r.id, params: {}, semente: null, rotacao: s.pincel.value.objeto.rotacao } }; tocar('selecionar'); };
  return (<>
    <input class="busca" type="search" placeholder="Buscar: mesa, cama, livros…" aria-label="Buscar objeto" value={consulta.value} onInput={e => { consulta.value = (e.target as HTMLInputElement).value; }} data-testid="busca-objeto" />
    <div class="chips">
      <button type="button" class={`chip ${!categoria.value ? 'ativo' : ''}`} onClick={() => { categoria.value = null; }}>Todos</button>
      {CATEGORIAS.map(([id, nome]) => <button type="button" key={id} class={`chip ${categoria.value === id ? 'ativo' : ''}`} onClick={() => { categoria.value = categoria.value === id ? null : id; }}>{nome}</button>)}
    </div>
    <div class="grade-receitas" data-testid="lista-receitas">
      {lista.map(r => <button type="button" key={r.id} class={`receita ${atual.item === r.id ? 'ativa' : ''}`} onClick={() => escolher(r)} title={`${r.nome} · ${r.pegada[0]} × ${r.pegada[1]} m`} data-testid={`receita-${r.id}`}><MiniReceita id={r.id} /><span>{r.nome}</span>{r.fonte === 'colecao' && <i class="selo-acervo" title="Imagem da coleção da casa">acervo</i>}</button>)}
      {!lista.length && <p class="dica">Nada com “{consulta.value}”.</p>}
    </div>
    {receita && <div class="ajustes"><h4>{receita.nome}</h4>
      <p class="dica"><kbd>Q</kbd> <kbd>E</kbd> giram. <kbd>Ctrl</kbd>+clique num objeto copia o pincel. <kbd>Alt</kbd> põe fora da grade.</p>
      {receita.campos.map(c => c.tipo === 'numero'
        ? <CampoNumero key={c.id} rotulo={c.rotulo} unidade="m" valor={typeof atual.params[c.id] === 'number' ? atual.params[c.id] as number : c.padrao as number} min={c.min ?? 0} max={c.max ?? 20} passo={c.passo ?? 0.1} aoConfirmar={v => { s.pincel.value = { ...s.pincel.value, objeto: { ...atual, params: { ...atual.params, [c.id]: v } } }; }} />
        : <CampoMaterial key={c.id} rotulo={c.rotulo} uso={c.uso ?? 'objeto'} valor={typeof atual.params[c.id] === 'string' ? atual.params[c.id] as string : c.padrao as string} aoMudar={v => { if (v) s.pincel.value = { ...s.pincel.value, objeto: { ...atual, params: { ...atual.params, [c.id]: v } } }; }} />)}
    </div>}
  </>);
}

function Luzes({ s }: { s: SessaoDeEdicao }) {
  return (<>
    <p class="dica">Em círculo ou em cone. <kbd>Q</kbd> <kbd>E</kbd> giram o facho. Depois de posta, cor e alcance ajustam no inspetor.</p>
    <div class="lista-cartas">
      {PRESETS_DE_LUZ.map(p => (
        <button type="button" key={p.id} class={`carta ${s.pincel.value.luz.preset === p.id ? 'ativa' : ''}`} onClick={() => { s.ferramenta.value = 'luz'; mudar(s, { luz: { ...s.pincel.value.luz, preset: p.id } }); }} title={p.descricao} data-testid={`luz-${p.id}`}>
          <span class="carta-amostras"><i class="bolinha" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} /></span>
          <span class="carta-nome">{p.nome}</span><span class="carta-desc">{p.cone === null ? `círculo · ${p.radius} m` : `cone de ${p.cone}° · ${p.radius} m`}</span>
        </button>
      ))}
    </div>
  </>);
}

const ABERTURAS: { tipo: Pincel['abertura']['tipo']; nome: string; icone: string; desc: string }[] = [
  { tipo: 'door', nome: 'Porta', icone: 'porta', desc: 'Abre e fecha; o lado de abertura vem de onde o mouse está' }, { tipo: 'window', nome: 'Janela', icone: 'janela', desc: 'Deixa a luz do dia entrar' },
  { tipo: 'arch', nome: 'Arco', icone: 'arco', desc: 'Vão livre, sem folha' }, { tipo: 'secret', nome: 'Porta secreta', icone: 'secreta', desc: 'Parece parede até ser revelada' },
];

function Aberturas({ s }: { s: SessaoDeEdicao }) {
  return (<>
    <p class="dica">Clique numa parede: a abertura fica no meio da célula mais próxima. Arraste uma abertura para deslizá-la.</p>
    <div class="lista-cartas">{ABERTURAS.map(a => <button type="button" key={a.tipo} class={`carta ${s.pincel.value.abertura.tipo === a.tipo ? 'ativa' : ''}`} onClick={() => mudar(s, { abertura: { tipo: a.tipo } })} title={a.desc} data-testid={`abertura-${a.tipo}`}><span class="carta-amostras"><Icone nome={a.icone} tamanho={22} /></span><span class="carta-nome">{a.nome}</span><span class="carta-desc">{a.desc}</span></button>)}</div>
  </>);
}

function Paredes({ s }: { s: SessaoDeEdicao }) {
  const tipos: { tipo: Pincel['parede']['tipo']; nome: string; desc: string }[] = [{ tipo: 'wall', nome: 'Parede', desc: 'Bloqueia movimento, visão e luz' }, { tipo: 'low', nome: 'Muro baixo', desc: 'Bloqueia o movimento; dá para ver por cima' }, { tipo: 'fence', nome: 'Cerca', desc: 'Bloqueia o movimento; vê-se através' }];
  return (<>
    <p class="dica">Arraste de um canto a outro (as paredes seguem a grade). As paredes dos cômodos já nascem sozinhas; use esta ferramenta para muros, cercas e divisórias.</p>
    <div class="lista-cartas">{tipos.map(t => <button type="button" key={t.tipo} class={`carta ${s.pincel.value.parede.tipo === t.tipo ? 'ativa' : ''}`} onClick={() => mudar(s, { parede: { tipo: t.tipo } })} data-testid={`parede-${t.tipo}`}><span class="carta-amostras"><Icone nome="parede" tamanho={22} /></span><span class="carta-nome">{t.nome}</span><span class="carta-desc">{t.desc}</span></button>)}</div>
  </>);
}

function Terreno({ s }: { s: SessaoDeEdicao }) {
  const p = s.pincel.value.terreno;
  return (<>
    <p class="dica">Pinte o chão ao ar livre. As bordas se misturam sozinhas. <kbd>Alt</kbd> apaga; <kbd>[</kbd> e <kbd>]</kbd> mudam o pincel.</p>
    <div class="lista-cartas">{materiaisDo('terreno').map(m => <button type="button" key={m.id} class={`carta ${p.material === m.id ? 'ativa' : ''}`} onClick={() => mudar(s, { terreno: { ...p, material: m.id } })} data-testid={`terreno-${m.id}`}><span class="carta-amostras"><Amostra id={m.id} tamanho={26} /></span><span class="carta-nome">{m.nome}</span></button>)}</div>
    <CampoNumero rotulo="Pincel" unidade="m" valor={p.raio} min={0.25} max={12} passo={0.5} aoConfirmar={v => { mudar(s, { terreno: { ...p, raio: v } }); }} />
    <CampoMaterial rotulo="Base do mapa" dica="Cobre o mapa todo, por baixo de tudo" uso="terreno" valor={s.doc.value.terrain.base === 'vazio' ? null : s.doc.value.terrain.base} comNenhum="Nenhuma (fundo escuro)" aoMudar={v => { s.store.executar({ tipo: 'terreno.base', material: v ?? 'vazio' }); }} />
  </>);
}

function Espalhar({ s }: { s: SessaoDeEdicao }) {
  const p = s.pincel.value.espalhar;
  return (<>
    <p class="dica">Arraste para espalhar o conjunto: cada pincelada é uma ação. A papelada vai sobre as mesas, os caixotes junto das paredes, as pedras sob as árvores. Nunca na frente de portas. <kbd>Alt</kbd> apaga; <kbd>[</kbd> e <kbd>]</kbd> mudam o pincel.</p>
    <div class="lista-cartas">{TODOS_OS_CONJUNTOS.map(c => <button type="button" key={c.id} class={`carta ${p.conjunto === c.id ? 'ativa' : ''}`} onClick={() => mudar(s, { espalhar: { ...p, conjunto: c.id } })} data-testid={`espalhar-${c.id}`}><span class="carta-nome">{c.nome}</span><span class="carta-desc">{c.descricao}</span></button>)}</div>
    <CampoNumero rotulo="Pincel" unidade="m" valor={p.raio} min={0.25} max={12} passo={0.5} aoConfirmar={v => { mudar(s, { espalhar: { ...p, raio: v } }); }} />
  </>);
}

function Presenca({ s }: { s: SessaoDeEdicao }) {
  const p = s.pincel.value.presenca;
  return (<>
    <p class="dica">Pinte o que cresce ou se espalha: musgo, sangue, corrupção. Por cima do desenho, vivo e animado. <kbd>Alt</kbd> apaga; <kbd>[</kbd> e <kbd>]</kbd> mudam o pincel.</p>
    {PACOTES_DE_PRESENCA.map(pac => (<div key={pac.id}>
      <h4 class="faixa pequena">{pac.nome}</h4>
      <div class="lista-cartas">{PINCEIS_DE_PRESENCA.filter(b => b.pacote === pac.id).map(b => <button type="button" key={b.id} class={`carta ${p.brush === b.id ? 'ativa' : ''}`} onClick={() => mudar(s, { presenca: { ...p, brush: b.id } })} data-testid={`presenca-${b.id}`}><span class="carta-amostras"><i class={`amostra-presenca ${b.brilho ? 'brilha' : ''}`} style={{ '--cor': b.cor }} /></span><span class="carta-nome">{b.nome}</span></button>)}</div>
    </div>))}
    <CampoNumero rotulo="Pincel" unidade="m" valor={p.raio} min={0.25} max={12} passo={0.5} aoConfirmar={v => { mudar(s, { presenca: { ...p, raio: v } }); }} />
  </>);
}

const TITULOS: Record<string, string> = { comodo: 'Cômodos', abertura: 'Portas e janelas', parede: 'Paredes', objeto: 'Objetos', luz: 'Luzes', terreno: 'Terreno', presenca: 'Presença', espalhar: 'Espalhar' };

/** A gaveta da ferramenta ativa: o que se pode pôr com ela, e os ajustes do que está na mão. */
export function Biblioteca({ s }: { s: SessaoDeEdicao }) {
  const f = s.ferramenta.value;
  if (modo.value === 'sessao' || !s.biblioteca.value || !TITULOS[f]) return null;
  return (
    <aside class="biblioteca" aria-label={`Biblioteca: ${TITULOS[f]}`} data-testid="biblioteca">
      <div class="biblioteca-topo"><h3 class="faixa pequena">{TITULOS[f]}</h3><button type="button" class="botao-icone" aria-label="Fechar a biblioteca" title="Fechar (B)" onClick={() => { s.biblioteca.value = false; }}><Icone nome="fechar" tamanho={16} /></button></div>
      <div class="biblioteca-corpo">
        {f === 'comodo' && <Comodos s={s} />}{f === 'objeto' && <Objetos s={s} />}{f === 'luz' && <Luzes s={s} />}
        {f === 'abertura' && <Aberturas s={s} />}{f === 'parede' && <Paredes s={s} />}{f === 'terreno' && <Terreno s={s} />}{f === 'presenca' && <Presenca s={s} />}{f === 'espalhar' && <Espalhar s={s} />}
      </div>
    </aside>
  );
}

export { materialDe };
