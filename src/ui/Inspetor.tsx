import { useSignal } from '@preact/signals';
import { campanhaAtiva, campanhas } from '../app/campanha.ts';
import { NOMES_COLECAO, desfazer, duplicarSelecao, refazer, removerSelecao, sessao } from '../app/app.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { nomeDoAlvo } from '../domain/fabrica.ts';
import { ESTADOS_FIGURA, type Abertura, type Comodo, type Luz, type MapaAtlas, type Objeto, type Parede, type Peca, type Regiao } from '../domain/mapa.ts';
import { PRESETS_DE_ACABAMENTO, PRESETS_DE_LUZ, TIPOS_DE_COMODO, camposDoPreset, presetDeAcabamento } from '../domain/presets.ts';
import { acabamentoLigado, definirAcabamentoLigado } from '../app/app.ts';
import { receitaDe } from '../procedural/receitas.ts';
import { materiaisDo } from '../procedural/materiais.ts';
import { Amostra } from './campos-material.tsx';
import { tocar } from '../fx/som.ts';
import { chaveDoAlvo, type Alvo } from '../render/selecao.ts';
import type { Gesto } from '../state/store.ts';
import { CampoCaixa, CampoCor, Linha, CampoNumero, CampoOpcoes, CampoTexto, tentar } from './campos.tsx';
import { Icone } from './Icone.tsx';

const graus = (rad: number) => Math.round((rad * 180) / Math.PI * 10) / 10;
const radianos = (g: number) => (g * Math.PI) / 180;
const NOMES_ESTADO: Record<(typeof ESTADOS_FIGURA)[number], string> = { normal: 'Normal', hurt: 'Ferido', dying: 'Morrendo', unconscious: 'Inconsciente', dead: 'Morto', maddened: 'Enlouquecendo' };

function PainelDoMapa({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, st = s.store;
  return (
    <div class="painel-corpo" data-testid="painel-mapa">
      <h3 class="faixa pequena">Mapa</h3>
      <CampoTexto rotulo="Nome" valor={m.name} aoConfirmar={v => v.trim() ? tentar(() => st.executar({ tipo: 'mapa.renomear', nome: v.trim() })) : false} />
      <label class="linha"><span class="linha-rotulo">Campanha</span><span class="linha-controle">
        <select data-testid="campanha-do-mapa" value={m.campanhaId ?? ''} onChange={e => { const v = (e.target as HTMLSelectElement).value || null; tentar(() => st.executar({ tipo: 'mapa.campanha', campanhaId: v }, { rotulo: 'Ligar à campanha' })); }}>
          <option value="">Nenhuma</option>
          {campanhas.value.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          {m.campanhaId && !campanhas.value.some(c => c.id === m.campanhaId) && <option value={m.campanhaId}>(campanha ausente)</option>}
        </select></span></label>
      {!m.campanhaId && campanhaAtiva.value && <p class="dica">Este mapa não está em nenhuma campanha. A ativa é “{campanhaAtiva.value.nome}”.</p>}
      <h3 class="faixa pequena">Grade</h3>
      <CampoCaixa rotulo="Mostrar" valor={m.grid.visible} aoMudar={v => tentar(() => st.executar({ tipo: 'grade.atualizar', patch: { visible: v } }, { rotulo: v ? 'Mostrar a grade' : 'Esconder a grade' }))} />
      <CampoNumero id="grade-tamanho" rotulo="Célula" unidade="m" valor={m.grid.size} min={0.25} max={10} passo={0.25} aoConfirmar={v => tentar(() => st.executar({ tipo: 'grade.atualizar', patch: { size: v } }, { rotulo: 'Tamanho da célula' }))} />
      <h3 class="faixa pequena">Tamanho</h3>
      <CampoNumero id="largura-mapa" rotulo="Largura" unidade="m" valor={m.bounds.width} min={3} max={600} passo={1.5} aoConfirmar={v => tentar(() => st.executar({ tipo: 'limites.atualizar', largura: v, altura: m.bounds.height }))} />
      <CampoNumero id="altura-mapa" rotulo="Altura" unidade="m" valor={m.bounds.height} min={3} max={600} passo={1.5} aoConfirmar={v => tentar(() => st.executar({ tipo: 'limites.atualizar', largura: m.bounds.width, altura: v }))} />
      <h3 class="faixa pequena">Fundo</h3>
      <CorDoFundo s={s} />
      <h3 class="faixa pequena">Terreno</h3>
      <CampoOpcoes rotulo="Base" valor={m.terrain.base} opcoes={[['vazio', 'Vazio (o fundo)'], ...materiaisDo('terreno').map(x => [x.id, x.nome] as const)]} aoMudar={v => tentar(() => st.executar({ tipo: 'terreno.base', material: v }))} />
      <h3 class="faixa pequena">Acabamento</h3>
      <CampoCaixa rotulo="Ver no editor" dica="Só para quem edita: não muda o mapa." valor={acabamentoLigado.value} aoMudar={definirAcabamentoLigado} />
      <CampoOpcoes rotulo="Estilo" valor={m.finish.preset} opcoes={PRESETS_DE_ACABAMENTO.map(p => [p.id, p.nome] as const)} aoMudar={v => { const p = presetDeAcabamento(v); if (p) tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { preset: v, ...p.valores } }, { rotulo: 'Acabamento' })); }} />
      <CampoNumero rotulo="Vinheta" valor={m.finish.vignette} min={0} max={1} passo={0.05} aoConfirmar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { vignette: v } }))} />
      <CampoNumero rotulo="Grão" valor={m.finish.grain} min={0} max={1} passo={0.05} aoConfirmar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { grain: v } }))} />
      <h3 class="faixa pequena">Notas</h3>
      <textarea class="notas" aria-label="Notas do mapa" rows={5} placeholder="Anotações do mestre sobre este mapa…" key={m.notes} defaultValue={m.notes}
        onBlur={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== m.notes) tentar(() => st.executar({ tipo: 'mapa.notas', texto: v })); }} />
      <p class="meta">{Object.keys(m.rooms).length} cômodo(s) · {Object.keys(m.props).length} objeto(s) · {Object.keys(m.lights).length} luz(es) · {Object.keys(m.tokens).length} peça(s) · {Object.keys(m.regions).length} região(ões)</p>
    </div>
  );
}

/** Cor com prévia: arrastar o seletor muda o fundo na hora e vira UM item de histórico. */
function useGestoDeCor(s: SessaoDeEdicao, rotulo: string) {
  const gesto = useSignal<Gesto | null>(null);
  return {
    previa: (aplicar: (g: Gesto) => void) => { if (!gesto.value) { if (s.store.emGesto) return; gesto.value = s.store.iniciarGesto(rotulo); } tentar(() => aplicar(gesto.value!)); },
    confirmar: () => { gesto.value?.concluir(); gesto.value = null; },
  };
}

function CorDoFundo({ s }: { s: SessaoDeEdicao }) {
  const g = useGestoDeCor(s, 'Cor do fundo');
  return <CampoCor rotulo="Cor" valor={s.doc.value.backdrop.color} aoPrevia={v => g.previa(x => x.aplicar({ tipo: 'fundo.atualizar', patch: { color: v } }))} aoConfirmar={g.confirmar} />;
}

function CamposDaLuz({ s, l }: { s: SessaoDeEdicao; l: Luz }) {
  const st = s.store, editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => st.executar({ tipo: 'item.atualizar', colecao: 'lights', id: l.id, patch }, rotulo ? { rotulo } : {}));
  const g = useGestoDeCor(s, 'Cor da luz');
  return (<>
    <CampoOpcoes rotulo="Tipo" valor={l.preset ?? ''} opcoes={[['', 'Personalizada'], ...PRESETS_DE_LUZ.map(p => [p.id, p.nome] as const)]} aoMudar={v => { const p = PRESETS_DE_LUZ.find(x => x.id === v); if (p) editar({ ...camposDoPreset(p, l.cone?.direction ?? 0) }, `Virar ${p.nome.toLowerCase()}`); }} />
    <CampoCaixa rotulo="Acesa" valor={l.on} aoMudar={v => editar({ on: v }, v ? 'Acender' : 'Apagar')} />
    <CampoCor rotulo="Cor" valor={l.color} aoPrevia={v => g.previa(x => x.aplicar({ tipo: 'item.atualizar', colecao: 'lights', id: l.id, patch: { color: v } }))} aoConfirmar={g.confirmar} />
    <CampoNumero rotulo="Alcance" unidade="m" valor={l.radius} min={0.1} max={200} passo={0.5} aoConfirmar={v => editar({ radius: v }, 'Alcance da luz')} />
    <CampoNumero rotulo="Intensidade" valor={l.intensity} min={0} max={3} passo={0.1} aoConfirmar={v => editar({ intensity: v }, 'Intensidade da luz')} />
    <CampoNumero rotulo="Tremulação" valor={l.flicker} min={0} max={1} passo={0.05} aoConfirmar={v => editar({ flicker: v }, 'Tremulação da luz')} />
    <CampoOpcoes rotulo="Energia" valor={l.power} opcoes={[['grid', 'Rede elétrica'], ['fire', 'Fogo'], ['battery', 'Bateria'], ['magic', 'Mágica']]} aoMudar={v => editar({ power: v }, 'Energia da luz')} />
    <CampoCaixa rotulo="Só à noite" valor={l.nightOnly} aoMudar={v => editar({ nightOnly: v })} />
    <CampoCaixa rotulo="Facho (lanterna)" dica="Sem facho, a luz ilumina em círculo; com facho, em cone." valor={l.cone !== null} aoMudar={v => editar({ cone: v ? { angle: radianos(60), direction: 0 } : null }, v ? 'Virar lanterna' : 'Virar lamparina')} />
    {l.cone && <>
      <CampoNumero rotulo="Abertura" unidade="°" valor={graus(l.cone.angle)} min={3} max={360} passo={5} aoConfirmar={v => editar({ cone: { angle: radianos(v) } }, 'Abertura do facho')} />
      <CampoNumero rotulo="Direção" unidade="°" valor={graus(l.cone.direction)} min={-360} max={360} passo={15} aoConfirmar={v => editar({ cone: { direction: radianos(v) } }, 'Direção do facho')} />
    </>}
  </>);
}

function CamposDaPeca({ s, t }: { s: SessaoDeEdicao; t: Peca }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch }, rotulo ? { rotulo } : {}));
  return (<>
    <CampoTexto rotulo="Nome" valor={t.name} aoConfirmar={v => v.trim() ? editar({ name: v.trim() }, 'Renomear peça') : false} />
    <CampoNumero rotulo="Tamanho" unidade="células" valor={t.size} min={0.5} max={12} passo={0.5} aoConfirmar={v => editar({ size: v }, 'Tamanho da peça')} />
    <CampoNumero rotulo="Visão" unidade="m" valor={t.vision.radius} min={0} max={200} passo={1} aoConfirmar={v => editar({ vision: { radius: v } }, 'Visão da peça')} />
    <CampoOpcoes rotulo="Estado" valor={t.figure.state} opcoes={ESTADOS_FIGURA.map(e => [e, NOMES_ESTADO[e]] as const)} aoMudar={v => editar({ figure: { state: v } }, 'Estado da peça')} />
  </>);
}

function CamposDoObjeto({ s, o }: { s: SessaoDeEdicao; o: Objeto }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'props', id: o.id, patch }, rotulo ? { rotulo } : {}));
  const receita = o.source.kind === 'recipe' ? receitaDe(o.source.recipe) : null;
  return (<>
    {o.source.kind === 'recipe' && <Linha rotulo={receita?.nome ?? o.source.recipe}><button type="button" class="botao-pilula" data-testid="variar" onClick={() => editar({ source: { seed: (o.source.kind === 'recipe' ? o.source.seed : 0) + 1 } }, 'Variar o objeto')}>Variar</button></Linha>}
    <CampoNumero rotulo="Rotação" unidade="°" valor={graus(o.rotation)} min={-360} max={360} passo={15} aoConfirmar={v => editar({ rotation: radianos(v) }, 'Girar')} />
    <CampoNumero rotulo="Escala" valor={o.scale} min={0.05} max={50} passo={0.1} aoConfirmar={v => editar({ scale: v }, 'Escala do objeto')} />
    <CampoCaixa rotulo="Bloqueia o movimento" valor={o.blocks.move} aoMudar={v => editar({ blocks: { move: v } })} />
    <CampoCaixa rotulo="Projeta sombra" valor={o.castsShadow} aoMudar={v => editar({ castsShadow: v })} />
  </>);
}

function CamposDaRegiao({ s, r }: { s: SessaoDeEdicao; r: Regiao }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'regions', id: r.id, patch }, rotulo ? { rotulo } : {}));
  return (<>
    <CampoOpcoes rotulo="Tipo" valor={r.kind} opcoes={[['note', 'Anotação'], ['trigger', 'Gatilho'], ['reveal', 'Revelação'], ['audio', 'Áudio']]} aoMudar={v => editar({ kind: v }, 'Tipo da região')} />
    <CampoCaixa rotulo="Só o mestre vê" valor={r.gmOnly} aoMudar={v => editar({ gmOnly: v })} />
  </>);
}

function CamposDoComodo({ s, c }: { s: SessaoDeEdicao; c: Comodo }) {
  const st = s.store, m = s.doc.value, extra = m.comodosExtra[c.id];
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => st.executar({ tipo: 'comodo.atualizar', id: c.id, patch: patch as never }, rotulo ? { rotulo } : {}));
  const notas = (patch: { leitura?: string; notasMestre?: string }) => tentar(() => st.executar({ tipo: 'comodo.notas', id: c.id, patch }, { rotulo: 'Notas do cômodo' }));
  return (<>
    <CampoTexto rotulo="Nome" valor={c.name} aoConfirmar={v => v.trim() ? editar({ name: v.trim() }, 'Renomear cômodo') : false} />
    <CampoOpcoes rotulo="Função" valor={c.function ?? ''} opcoes={[['', 'Nenhuma'], ...TIPOS_DE_COMODO.map(t => [t.funcao, t.nome] as const)]} aoMudar={v => editar({ function: v || null }, 'Função do cômodo')} />
    <CampoOpcoes rotulo="Piso" valor={c.floor.material} opcoes={materiaisDo('piso').map(x => [x.id, x.nome] as const)} aoMudar={v => editar({ floor: { material: v } }, 'Trocar o piso')} />
    <CampoOpcoes rotulo="Papel" valor={c.wallpaper?.material ?? ''} opcoes={[['', 'Sem papel'], ...materiaisDo('papel').map(x => [x.id, x.nome] as const)]} aoMudar={v => editar({ wallpaper: v ? { material: v, seed: c.wallpaper?.seed ?? 1 } : null }, 'Papel de parede')} />
    <CampoOpcoes rotulo="Paredes" valor={c.wallStyle ?? ''} opcoes={[['', 'Do mapa'], ['box', 'Caixa'], ['solid', 'Sólidas']]} aoMudar={v => editar({ wallStyle: v || null }, 'Estilo das paredes')} />
    <CampoCaixa rotulo="Telhado visível" valor={c.roof.visible} aoMudar={v => editar({ roof: { visible: v } }, 'Telhado')} />
    <h3 class="faixa pequena">Texto de leitura</h3>
    <textarea class="notas" aria-label="Texto de leitura do cômodo" rows={3} placeholder="O que os jogadores percebem ao entrar…" key={`l:${extra?.leitura ?? ''}`} defaultValue={extra?.leitura ?? ''} onBlur={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== (extra?.leitura ?? '')) notas({ leitura: v }); }} />
    <h3 class="faixa pequena">Notas do mestre</h3>
    <textarea class="notas" aria-label="Notas do mestre do cômodo" rows={3} placeholder="Só você vê…" key={`n:${extra?.notasMestre ?? ''}`} defaultValue={extra?.notasMestre ?? ''} onBlur={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== (extra?.notasMestre ?? '')) notas({ notasMestre: v }); }} />
  </>);
}

function CamposDaParede({ s, w }: { s: SessaoDeEdicao; w: Parede }) {
  const st = s.store, editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => st.executar({ tipo: 'parede.atualizar', id: w.id, patch: patch as never }, rotulo ? { rotulo } : {}));
  return (<>
    <CampoOpcoes rotulo="Tipo" valor={w.kind} opcoes={[['wall', 'Parede'], ['low', 'Muro baixo'], ['fence', 'Cerca'], ['cliff', 'Penhasco']] as never} aoMudar={v => editar({ kind: v }, 'Tipo da parede')} />
    <CampoNumero rotulo="Altura" unidade="m" valor={w.height} min={0.1} max={20} passo={0.1} aoConfirmar={v => editar({ height: v }, 'Altura da parede')} />
    <CampoNumero rotulo="Espessura" unidade="m" valor={w.thickness} min={0.02} max={2} passo={0.02} aoConfirmar={v => editar({ thickness: v }, 'Espessura da parede')} />
    <CampoCaixa rotulo="Bloqueia a visão" valor={w.blocks.sight} aoMudar={v => editar({ blocks: { sight: v } })} />
    <CampoCaixa rotulo="Bloqueia a luz" valor={w.blocks.light} aoMudar={v => editar({ blocks: { light: v } })} />
    {w.source ? <p class="dica">Acompanha o contorno do cômodo. <button type="button" class="botao-pilula" data-testid="desanexar" onClick={() => tentar(() => st.executar({ tipo: 'parede.desanexar', id: w.id }))}>Desanexar</button></p> : <p class="dica">Parede sua: não muda sozinha com o cômodo.</p>}
  </>);
}

function CamposDaAbertura({ s, o }: { s: SessaoDeEdicao; o: Abertura }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'abertura.atualizar', id: o.id, patch: patch as never }, rotulo ? { rotulo } : {}));
  const porta = o.kind === 'door' || o.kind === 'secret';
  return (<>
    <CampoOpcoes rotulo="Tipo" valor={o.kind} opcoes={[['door', 'Porta'], ['window', 'Janela'], ['arch', 'Arco'], ['secret', 'Porta secreta']] as never} aoMudar={v => editar({ kind: v }, 'Tipo da abertura')} />
    {porta && <CampoOpcoes rotulo="Estado" valor={o.state} opcoes={[['closed', 'Fechada'], ['open', 'Aberta'], ['locked', 'Trancada']] as never} aoMudar={v => editar({ state: v }, 'Estado da porta')} />}
    {o.kind === 'door' && <CampoOpcoes rotulo="Abre para" valor={o.swing} opcoes={[['a', 'Um lado'], ['b', 'O outro lado']] as never} aoMudar={v => editar({ swing: v }, 'Lado da porta')} />}
    <CampoNumero rotulo="Largura" unidade="m" valor={o.width} min={0.4} max={6} passo={0.1} aoConfirmar={v => editar({ width: v }, 'Largura da abertura')} />
  </>);
}

function Detalhe({ s, m, a }: { s: SessaoDeEdicao; m: MapaAtlas; a: Alvo }) {
  if (a.colecao === 'lights') return <CamposDaLuz s={s} l={m.lights[a.id]!} />;
  if (a.colecao === 'tokens') return <CamposDaPeca s={s} t={m.tokens[a.id]!} />;
  if (a.colecao === 'props') return <CamposDoObjeto s={s} o={m.props[a.id]!} />;
  if (a.colecao === 'regions') return <CamposDaRegiao s={s} r={m.regions[a.id]!} />;
  if (a.colecao === 'rooms') return <CamposDoComodo s={s} c={m.rooms[a.id]!} />;
  if (a.colecao === 'walls') return <CamposDaParede s={s} w={m.walls[a.id]!} />;
  if (a.colecao === 'openings') return <CamposDaAbertura s={s} o={m.openings[a.id]!} />;
  return null;
}

function PainelDaSelecao({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, alvos = s.selecao.value;
  if (!alvos.length) {
    const total = Object.keys(m.props).length + Object.keys(m.lights).length + Object.keys(m.tokens).length + Object.keys(m.regions).length;
    return <div class="painel-corpo" data-testid="painel-selecao"><p class="dica">{total ? 'Clique em algo no mapa para ver e ajustar. Arraste no vazio para selecionar vários.' : 'O mapa está vazio. Use L, O, T ou R para adicionar uma luz, um objeto, uma peça ou uma região, ou clique com o botão direito.'}</p></div>;
  }
  const unico = alvos.length === 1 ? alvos[0]! : null;
  return (
    <div class="painel-corpo" data-testid="painel-selecao">
      <h3 class="faixa pequena" data-testid="titulo-selecao">{unico ? nomeDoAlvo(unico.colecao, (m[unico.colecao] as Record<string, { id: string }>)[unico.id]!) : `${alvos.length} itens`}</h3>
      {unico ? <Detalhe s={s} m={m} a={unico} /> : (
        <ul class="lista-itens">{alvos.map(a => <li key={chaveDoAlvo(a)}><button type="button" onClick={() => { s.selecao.value = [a]; }}>
          <span class="tipo-item">{NOMES_COLECAO.singular[a.colecao]}</span> {nomeDoAlvo(a.colecao, (m[a.colecao] as Record<string, { id: string }>)[a.id]!)}</button></li>)}</ul>
      )}
      <div class="acoes-selecao">
        <button type="button" class="botao-pilula" onClick={duplicarSelecao} data-testid="duplicar"><Icone nome="duplicar" tamanho={14} />Duplicar</button>
        <button type="button" class="botao-pilula perigo" onClick={removerSelecao} data-testid="remover"><Icone nome="lixeira" tamanho={14} />Remover</button>
      </div>
    </div>
  );
}

function PainelDoHistorico({ s }: { s: SessaoDeEdicao }) {
  const lista = [...s.historico.value].reverse();
  return (
    <div class="painel-corpo" data-testid="painel-historico">
      <div class="acoes-selecao">
        <button type="button" class="botao-pilula" disabled={!s.podeDesfazer.value} onClick={desfazer}><Icone nome="desfazer" tamanho={14} />Desfazer</button>
        <button type="button" class="botao-pilula" disabled={!s.podeRefazer.value} onClick={refazer}><Icone nome="refazer" tamanho={14} />Refazer</button>
      </div>
      {lista.length ? <ol class="historico">{lista.map((r, i) => <li key={`${lista.length - i}`} class={i === 0 ? 'atual' : ''}>{r}</li>)}</ol> : <p class="dica">Nada feito ainda. Cada ação, automática ou não, entra aqui e pode ser desfeita.</p>}
      <p class="meta">Guarda as últimas 150 ações.</p>
    </div>
  );
}

const ABAS = [['mapa', 'Mapa'], ['selecao', 'Seleção'], ['historico', 'Histórico']] as const;

export function Inspetor() {
  const s = sessao.value, aba = useSignal<(typeof ABAS)[number][0]>('selecao');
  if (!s) return null;
  const n = s.selecao.value.length;
  return (
    <aside class="inspetor" aria-label="Inspetor">
      <div class="abas" role="tablist">
        {ABAS.map(([id, nome]) => <button type="button" key={id} role="tab" aria-selected={aba.value === id} class={aba.value === id ? 'ativa' : ''} onClick={() => { aba.value = id; tocar('selecionar'); }} data-testid={`aba-${id}`}>{nome}{id === 'selecao' && n > 0 ? <b class="contador">{n}</b> : null}</button>)}
      </div>
      {aba.value === 'mapa' ? <PainelDoMapa s={s} /> : aba.value === 'selecao' ? <PainelDaSelecao s={s} /> : <PainelDoHistorico s={s} />}
    </aside>
  );
}
