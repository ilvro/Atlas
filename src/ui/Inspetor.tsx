import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { chaveDaRef, formatarRef, lerRef, type Entidade, type Ref } from '#mesa';
import { campanhaAtiva, campanhas, refDoComodo } from '../app/campanha.ts';
import { servicos } from '../app/app.ts';
import { avisar } from '../app/toasts.ts';
import { NOMES_COLECAO, desfazer, duplicarSelecao, refazer, removerSelecao, sessao } from '../app/app.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { aguaEm } from '../domain/agua.ts';
import { area } from '../domain/celulas.ts';
import { PALETAS_PIXEL } from '../domain/paletas.ts';
import { nomeDoAlvo, novaLuz } from '../domain/fabrica.ts';
import { alvosDoInterruptor } from '../domain/interagiveis.ts';
import { ROTULOS_DE_ESTADO } from '../domain/figuras.ts';
import { ESTADOS_FIGURA, type Abertura, type Acabamento, type Clima, type Comodo, type Estilo, type Luz, type MapaAtlas, type Objeto, type Parede, type Peca, type Presenca, type Regiao } from '../domain/mapa.ts';
import { GENEROS, generoDe, PRESETS_DE_ACABAMENTO, PRESETS_DE_CLIMA, PRESETS_DE_LUZ, TIPOS_DE_COMODO, camposDoPreset, posicaoDeTitulo, pincelDePresenca, presetDeAcabamento, presetDeClima } from '../domain/presets.ts';
import { acabamentoLigado, aplicarClima, definirAcabamentoLigado } from '../app/app.ts';
import { abaDoInspetor, definirRegraDaRegua, modo, regraDaRegua } from '../app/modo.ts';
import { ROTULO_DA_REGRA, type RegraDeDiagonal } from '../domain/regua.ts';
import { definirSugestoesLigadas, sugestoesLigadas } from '../app/sugestoes.ts';
import { COLECAO } from '../procedural/colecao.ts';
import { receitaDe } from '../procedural/receitas/index.ts';
import { materialDe, materiaisDo } from '../procedural/materiais.ts';
import { Amostra } from './campos-material.tsx';
import { tocar } from '../fx/som.ts';
import { chaveDoAlvo, type Alvo } from '../render/selecao.ts';
import type { ParcialProfundo } from '../state/comandos.ts';
import type { Gesto } from '../state/store.ts';
import { useGestoDeCor } from './gesto-de-cor.ts';
import { PainelDoSprite } from './PainelDoSprite.tsx';
import { Personagens } from './Personagens.tsx';
import { EscolherCena } from './EscolherCena.tsx';
import { pistas, pistasCarregadas } from '../app/pistas.ts';
import { idDaPista, refDaPista } from '../data/pistas.ts';
import { abrirFicha, recursosDasFichas } from '../app/fichas.ts';
import { refDaFicha, textoDeRecursos } from '../domain/fichas.ts';
import { CampoCaixa, CampoCor, Linha, CampoNumero, CampoOpcoes, CampoTexto, tentar } from './campos.tsx';
import { Icone } from './Icone.tsx';

const graus = (rad: number) => Math.round((rad * 180) / Math.PI * 10) / 10;
const radianos = (g: number) => (g * Math.PI) / 180;

/** O que as peças de jogador já viram, com o botão de recomeçar (pede confirmação, porque apaga a memória do grupo). */
function ExploracaoDoMapa({ s }: { s: SessaoDeEdicao }) {
  const confirmando = useSignal(false), e = s.doc.value.session.explored, res = e?.res ?? 0.5, metros = e ? Math.round(area(e.cells) * res * res) : 0;
  return (<>
    <h3 class="faixa pequena">Exploração</h3>
    <p class="dica" data-testid="exploracao-area">{metros ? `Os jogadores já viram cerca de ${metros} m².` : 'Os jogadores ainda não exploraram nada.'}</p>
    {confirmando.value
      ? <div class="acoes-selecao"><button type="button" class="botao-pilula perigo" data-testid="exploracao-confirmar" onClick={() => { confirmando.value = false; tentar(() => s.store.executar({ tipo: 'sessao.esquecer' })); }}>Apagar a memória</button><button type="button" class="botao-pilula" onClick={() => { confirmando.value = false; }}>Cancelar</button></div>
      : <div class="acoes-selecao"><button type="button" class="botao-pilula" disabled={!e} data-testid="exploracao-recomecar" onClick={() => { confirmando.value = true; }}>Recomeçar a exploração</button></div>}
  </>);
}

const PIXELS_POR_CELULA = [12, 16, 24, 32];

/** Ilustrado ou Pixel, e os ajustes do Pixel. Trocar é um passo de histórico: desfazer volta ao estilo anterior. */
function EstiloDoMapa({ s }: { s: SessaoDeEdicao }) {
  const st = s.store, e = s.doc.value.style, pixel = e.renderer === 'pixel';
  const atualizar = (patch: ParcialProfundo<Estilo>) => tentar(() => st.executar({ tipo: 'estilo.atualizar', patch }, { rotulo: 'Estilo do mapa' }));
  const tamanhos = PIXELS_POR_CELULA.includes(e.pixel.pixelsPerCell) ? PIXELS_POR_CELULA : [...PIXELS_POR_CELULA, e.pixel.pixelsPerCell].sort((a, b) => a - b);
  return (<>
    <h3 class="faixa pequena">Estilo</h3>
    <CampoOpcoes rotulo="Renderizador" dica="O mesmo mapa em outro estilo de desenho; nada no mapa muda." valor={e.renderer} opcoes={[['illustrated', 'Ilustrado'], ['pixel', 'Pixel']]} aoMudar={v => atualizar({ renderer: v })} />
    {pixel && <>
      <CampoOpcoes rotulo="Pixels por célula" valor={String(e.pixel.pixelsPerCell)} opcoes={tamanhos.map(n => [String(n), String(n)] as const)} aoMudar={v => atualizar({ pixel: { pixelsPerCell: Number(v) } })} />
      <CampoOpcoes rotulo="Paleta" valor={PALETAS_PIXEL.some(p => p.id === e.palette) ? e.palette : PALETAS_PIXEL[0]!.id} opcoes={PALETAS_PIXEL.map(p => [p.id, p.nome] as const)} aoMudar={v => atualizar({ palette: v })} />
      <CampoOpcoes rotulo="Dithering" valor={e.pixel.dither} opcoes={[['bayer4', 'Bayer 4×4'], ['none', 'Nenhum']]} aoMudar={v => atualizar({ pixel: { dither: v } })} />
      <CampoCaixa rotulo="Contorno" dica="Um pixel de tinta em volta dos objetos." valor={e.pixel.outline} aoMudar={v => atualizar({ pixel: { outline: v } })} />
    </>}
  </>);
}

function PainelDoMapa({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, st = s.store;
  return (
    <div class="painel-corpo" data-testid="painel-mapa">
      {modo.value === 'construir' && <>
      <h3 class="faixa pequena">Mapa</h3>
      <CampoTexto rotulo="Nome" valor={m.name} aoConfirmar={v => v.trim() ? tentar(() => st.executar({ tipo: 'mapa.renomear', nome: v.trim() })) : false} />
      <CampoOpcoes rotulo="Gênero" dica={generoDe(m.style.genre).descricao} valor={generoDe(m.style.genre).id} opcoes={GENEROS.map(g => [g.id, g.nome] as const)} aoMudar={v => tentar(() => st.executar({ tipo: 'estilo.atualizar', patch: { genre: v } }, { rotulo: 'Gênero do mapa' }))} />
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
      <EstiloDoMapa s={s} />
      <h3 class="faixa pequena">Personagens</h3>
      <Personagens s={s} />
      <h3 class="faixa pequena">Som</h3>
      <SomDoMapa s={s} />
      <h3 class="faixa pequena">Tamanho</h3>
      <CampoNumero id="largura-mapa" rotulo="Largura" unidade="m" valor={m.bounds.width} min={3} max={600} passo={1.5} aoConfirmar={v => tentar(() => st.executar({ tipo: 'limites.atualizar', largura: v, altura: m.bounds.height }))} />
      <CampoNumero id="altura-mapa" rotulo="Altura" unidade="m" valor={m.bounds.height} min={3} max={600} passo={1.5} aoConfirmar={v => tentar(() => st.executar({ tipo: 'limites.atualizar', largura: m.bounds.width, altura: v }))} />
      <h3 class="faixa pequena">Fundo</h3>
      <CampoOpcoes rotulo="Tipo" valor={m.backdrop.kind} opcoes={[['solid', 'Cor'], ['texture', 'Textura']]} aoMudar={v => tentar(() => st.executar({ tipo: 'fundo.atualizar', patch: v === 'texture' ? { kind: v, material: m.backdrop.material ?? 'terra' } : { kind: v } }, { rotulo: 'Tipo de fundo' }))} />
      {m.backdrop.kind === 'texture'
        ? <CampoOpcoes rotulo="Textura" valor={m.backdrop.material ?? 'terra'} opcoes={materiaisDo('terreno').map(x => [x.id, x.nome] as const)} aoMudar={v => tentar(() => st.executar({ tipo: 'fundo.atualizar', patch: { material: v } }, { rotulo: 'Textura do fundo' }))} />
        : <CorDoFundo s={s} />}
      {m.backdrop.kind === 'texture' && m.terrain.base !== 'vazio' && <p class="dica">O terreno base cobre a textura: ponha a base em “Vazio” para vê-la.</p>}
      <CartelaDeTitulo s={s} />
      <h3 class="faixa pequena">Terreno</h3>
      <CampoOpcoes rotulo="Base" valor={m.terrain.base} opcoes={[['vazio', 'Vazio (o fundo)'], ...(m.terrain.base !== 'vazio' && !materiaisDo('terreno').some(x => x.id === m.terrain.base) ? [[m.terrain.base, materialDe(m.terrain.base).nome] as const] : []), ...materiaisDo('terreno').map(x => [x.id, x.nome] as const)]} aoMudar={v => tentar(() => st.executar({ tipo: 'terreno.base', material: v }))} />
      {m.terrain.base !== 'vazio' && materialDe(m.terrain.base).padrao === 'grama' && (
        <CampoCor
          rotulo="Tom da base"
          dica="Personalize a cor da grama da base do mapa"
          valor={materialDe(m.terrain.base).base}
          aoPrevia={cor => {
            st.executar({ tipo: 'terreno.base', material: `grama#${cor.replace('#', '')}` });
          }}
          aoConfirmar={() => {}}
        />
      )}
      </>}
      {modo.value === 'sessao' && <>
        <h3 class="faixa pequena">Régua</h3>
        <CampoOpcoes rotulo="Diagonal" dica="Como a régua conta as diagonais. Só para você: não muda o mapa." valor={regraDaRegua.value} opcoes={(Object.keys(ROTULO_DA_REGRA) as RegraDeDiagonal[]).map(r => [r, ROTULO_DA_REGRA[r]] as const)} aoMudar={v => definirRegraDaRegua(v as RegraDeDiagonal)} />
      </>}
      {Object.values(m.tokens).some(t => t.player) && <ExploracaoDoMapa s={s} />}
      <h3 class="faixa pequena">Clima</h3>
      <SeletorDeClima s={s} />
      <h3 class="faixa pequena">Acabamento</h3>
      {modo.value === 'construir' && <CampoCaixa rotulo="Sugestões do assistente" dica="Só para quem edita: uma pílula sugere o próximo passo do cômodo. Não muda o mapa." valor={sugestoesLigadas.value} aoMudar={definirSugestoesLigadas} />}
      <CampoCaixa rotulo="Ver atmosfera no editor" dica="Só para quem edita: não muda o mapa." valor={acabamentoLigado.value} aoMudar={definirAcabamentoLigado} />
      <CampoOpcoes rotulo="Estilo" valor={m.finish.preset} opcoes={[...PRESETS_DE_ACABAMENTO.map(p => [p.id, p.nome] as const), ...(PRESETS_DE_ACABAMENTO.some(p => p.id === m.finish.preset) ? [] : [[m.finish.preset, 'Personalizado'] as const])]} aoMudar={v => { const p = presetDeAcabamento(v); if (p) tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { preset: v, ...p.valores } }, { rotulo: 'Acabamento' })); }} />
      <CampoNumero rotulo="Vinheta" valor={m.finish.vignette} min={0} max={1} passo={0.05} aoConfirmar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { vignette: v } }))} />
      <CampoNumero rotulo="Grão" valor={m.finish.grain} min={0} max={1} passo={0.05} aoConfirmar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { grain: v } }))} />
      <CampoNumero rotulo="Halo das luzes" valor={m.finish.glow} min={0} max={1} passo={0.05} aoConfirmar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { glow: v } }, { rotulo: 'Halo das luzes' }))} />
      <CampoOpcoes rotulo="Bordas" dica="Fecha as beiradas do mapa com nuvens, escuridão ou neblina." valor={m.finish.edges.kind} opcoes={[['none', 'Nenhuma'], ['clouds', 'Nuvens'], ['dark', 'Escuro'], ['fog', 'Neblina']]}
        aoMudar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { edges: { kind: v as Acabamento['edges']['kind'], amount: v !== 'none' && m.finish.edges.amount <= 0 ? 0.5 : m.finish.edges.amount } } }, { rotulo: 'Bordas do mapa' }))} />
      {m.finish.edges.kind !== 'none' && <CampoNumero rotulo="Quanto entra" valor={m.finish.edges.amount} min={0} max={1} passo={0.05} aoConfirmar={v => tentar(() => st.executar({ tipo: 'acabamento.atualizar', patch: { edges: { kind: m.finish.edges.kind, amount: v } } }, { rotulo: 'Bordas do mapa' }))} />}
      {Object.keys(m.presence).length > 0 && <>
        <h3 class="faixa pequena">Presença</h3>
        {Object.values(m.presence).map(p => <CamposDaPresenca key={p.id} s={s} p={p} />)}
      </>}
      <h3 class="faixa pequena">Notas</h3>
      <textarea class="notas" aria-label="Notas do mapa" rows={5} placeholder="Anotações do mestre sobre este mapa…" key={m.notes} defaultValue={m.notes}
        onBlur={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== m.notes) tentar(() => st.executar({ tipo: 'mapa.notas', texto: v })); }} />
      <p class="meta">{Object.keys(m.rooms).length} cômodo(s) · {Object.keys(m.props).length} objeto(s) · {Object.keys(m.lights).length} luz(es) · {Object.keys(m.tokens).length} peça(s) · {Object.keys(m.regions).length} região(ões)</p>
    </div>
  );
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const canais = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
/** Uma amostra do clima: o matiz do ambiente, tingido pelo acabamento, mais escuro quanto menos luz houver. */
export function amostraDoClima(c: Omit<Clima, 'preset'>, f: Omit<Acabamento, 'preset'>): string {
  const a = canais(c.ambient.color), t = canais(f.tint), cor = (v: number[]) => `rgb(${v.map(x => Math.round(clamp01(x) * 255)).join(',')})`;
  const base = a.map((x, i) => x * t[i]! * (0.3 + 0.7 * clamp01(c.ambient.intensity))), brilho = c.sun ? canais(c.sun.color).map(x => x * (0.35 + 0.65 * clamp01(c.sun!.intensity))) : base;
  return `linear-gradient(135deg, ${cor(base)} 0%, ${cor(base)} 55%, ${cor(brilho)} 100%)`;
}

/** Escolher o clima: predefinições e os salvos pelo mestre, mais os ajustes finos do momento. */
/** A cena do Jukebox que toca neste clima (a escolha é do `EscolherCena`). */
function SomDoClima({ s, clima }: { s: SessaoDeEdicao; clima: string }) {
  return <EscolherCena s={s} id="som-do-clima" rotulo="Som deste clima" dica="Ao trocar para este clima, o Atlas pede ao Jukebox que toque esta cena." valor={s.doc.value.climateAudio[clima] ?? null}
    aoEscolher={ref => tentar(() => s.store.executar({ tipo: 'clima.audio', id: clima, ref }, { rotulo: 'Som do clima' }))} />;
}

/** A cena do Jukebox que toca ao abrir este mapa na sessão. */
function SomDoMapa({ s }: { s: SessaoDeEdicao }) {
  return <EscolherCena s={s} id="som-do-mapa" rotulo="Som do mapa" dica="Ao abrir este mapa na sessão, o Atlas pede ao Jukebox que toque esta cena." valor={s.doc.value.audioCue}
    aoEscolher={ref => tentar(() => s.store.executar({ tipo: 'mapa.audio', ref }, { rotulo: 'Som do mapa' }))} />;
}

function SeletorDeClima({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, st = s.store, nomeando = useSignal(false), nome = useSignal('');
  const ativo = presetDeClima(m.climate.preset)?.id ?? m.climate.preset;
  const ajustar = (patch: Record<string, unknown>, rotulo: string) => tentar(() => st.executar({ tipo: 'clima.aplicar', patch: patch as never }, { rotulo }));
  const guardar = () => {
    const n = nome.value.trim(); if (!n) { avisar('Dê um nome ao clima.', { tipo: 'erro' }); return; }
    if (tentar(() => st.executar({ tipo: 'clima.salvar', nome: n }, { rotulo: `Salvar clima: ${n}` }))) { nomeando.value = false; nome.value = ''; tocar('pop'); }
  };
  const chip = (id: string, rotulo: string, c: Omit<Clima, 'preset'>, f: Omit<Acabamento, 'preset'>, dica: string, extra?: preact.ComponentChildren) => (
    <span key={id} class="chip-clima-par">
      <button type="button" class={`chip-clima ${ativo === id ? 'ativo' : ''}`} aria-pressed={ativo === id} title={dica} data-testid={`clima-${id}`} onClick={() => aplicarClima(id)}>
        <i class="amostra-clima" style={{ background: amostraDoClima(c, f) }} aria-hidden="true" />{rotulo}</button>{extra}
    </span>
  );
  const salvos = Object.values(m.customClimates);
  return (<>
    <div class="grade-de-climas" role="group" aria-label="Climas" data-testid="seletor-de-clima">
      {PRESETS_DE_CLIMA.map((p, i) => chip(p.id, p.nome, p.climate, p.finish, `${p.descricao} (Alt+${i + 1})`))}
      {salvos.map(c => chip(c.id, c.name, c.climate, c.finish, 'Um clima seu',
        <button type="button" class="botao-icone chip-esquecer" aria-label={`Esquecer o clima ${c.name}`} title="Esquecer" data-testid={`esquecer-${c.id}`} onClick={() => { if (tentar(() => st.executar({ tipo: 'clima.esquecer', id: c.id }, { rotulo: `Esquecer clima: ${c.name}` }))) avisar(`Clima “${c.name}” esquecido.`); }}><Icone nome="fechar" tamanho={12} /></button>))}
    </div>
    {nomeando.value
      ? <div class="linha-salvar-clima"><input type="text" aria-label="Nome do clima" placeholder="Nome do clima…" maxLength={60} value={nome.value} autoFocus data-testid="nome-do-clima" onInput={e => { nome.value = (e.target as HTMLInputElement).value; }}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); else if (e.key === 'Escape') { e.stopPropagation(); nomeando.value = false; } }} />
          <button type="button" class="botao-pilula destaque" onClick={guardar} data-testid="confirmar-clima">Salvar</button></div>
      : <button type="button" class="botao-pilula" onClick={() => { nomeando.value = true; }} data-testid="salvar-clima"><Icone nome="novo" tamanho={14} />Salvar este clima…</button>}
    <CampoTexto id="horario-do-clima" rotulo="Horário" dica="HH:MM. Muda a luz do sol ou da lua." valor={m.climate.time} maximo={5} aoConfirmar={v => ajustar({ time: v.trim() }, 'Horário')} />
    <CampoNumero rotulo="Chuva" valor={m.climate.weather.rain} min={0} max={1} passo={0.05} aoConfirmar={v => ajustar({ weather: { rain: v } }, 'Chuva')} />
    <CampoNumero rotulo="Neve" valor={m.climate.weather.snow} min={0} max={1} passo={0.05} aoConfirmar={v => ajustar({ weather: { snow: v } }, 'Neve')} />
    <CampoNumero rotulo="Neblina" valor={m.climate.weather.fog} min={0} max={1} passo={0.05} aoConfirmar={v => ajustar({ weather: { fog: v } }, 'Neblina')} />
    <CampoNumero rotulo="Vento" dica="De −1 (para a esquerda) a 1 (para a direita)." valor={m.climate.weather.wind} min={-1} max={1} passo={0.1} aoConfirmar={v => ajustar({ weather: { wind: v } }, 'Vento')} />
    <CampoNumero rotulo="Relâmpagos" valor={m.climate.weather.lightning} min={0} max={1} passo={0.05} aoConfirmar={v => ajustar({ weather: { lightning: v } }, 'Relâmpagos')} />
    <CampoCaixa rotulo="Energia da rede" dica="Desligada, as luzes de rede elétrica apagam (apagão)." valor={m.climate.gridPower} aoMudar={v => ajustar({ gridPower: v }, v ? 'Religar a rede' : 'Cortar a rede')} />
    <SomDoClima s={s} clima={ativo} />
  </>);
}

/** Cor com prévia: arrastar o seletor muda o fundo na hora e vira UM item de histórico. */
function CorDoFundo({ s }: { s: SessaoDeEdicao }) {
  const g = useGestoDeCor(s, 'Cor do fundo');
  return <CampoCor rotulo="Cor" valor={s.doc.value.backdrop.color} aoPrevia={v => g.previa(x => x.aplicar({ tipo: 'fundo.atualizar', patch: { color: v } }))} aoConfirmar={g.confirmar} />;
}

const FONTES_DO_TITULO = [['Cinzel', 'Cinzel (títulos)'], ['Special Elite', 'Máquina de escrever'], ['Hanken Grotesk Variable', 'Hanken Grotesk']] as const;
const POSICOES_DO_TITULO = [['superior-esquerdo', 'Em cima, à esquerda'], ['topo', 'Em cima, no centro'], ['superior-direito', 'Em cima, à direita'], ['inferior-esquerdo', 'Embaixo, à esquerda'], ['inferior-direito', 'Embaixo, à direita']] as const;
type PosicaoDoTitulo = (typeof POSICOES_DO_TITULO)[number][0];

/** A cartela de título do mapa: texto, fonte e canto. Some quando o texto fica vazio. */
function CartelaDeTitulo({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value, t = m.backdrop.title, st = s.store, onde = useSignal<PosicaoDoTitulo>('inferior-direito');
  const por = (texto: string, fonte: string, pos: PosicaoDoTitulo) => {
    const comprimento = Math.max(3, texto.length * 0.55 + 1);
    return tentar(() => st.executar({ tipo: 'fundo.atualizar', patch: { title: { text: texto, font: fonte, position: posicaoDeTitulo(m.bounds.width, m.bounds.height, pos, comprimento) } } }, { rotulo: 'Cartela de título' }));
  };
  return (<>
    <h3 class="faixa pequena">Cartela de título</h3>
    <CampoTexto id="titulo-do-mapa" rotulo="Texto" valor={t?.text ?? ''} maximo={120} aoConfirmar={v => { const x = v.trim(); if (!x) return tentar(() => st.executar({ tipo: 'fundo.atualizar', patch: { title: null } }, { rotulo: 'Tirar a cartela' })); return por(x, t?.font ?? 'Cinzel', onde.value); }} />
    {t && <>
      <CampoOpcoes rotulo="Fonte" valor={t.font} opcoes={FONTES_DO_TITULO} aoMudar={v => por(t.text, v, onde.value)} />
      <CampoOpcoes rotulo="Canto" valor={onde.value} opcoes={POSICOES_DO_TITULO} aoMudar={v => { onde.value = v; por(t.text, t.font, v); }} />
    </>}
  </>);
}

/** Uma mancha de presença: o quanto ela cresceu, se só o mestre vê, e tirar. Não tem posição, então vive na aba Mapa. */
function CamposDaPresenca({ s, p }: { s: SessaoDeEdicao; p: Presenca }) {
  const nome = pincelDePresenca(p.brush)?.nome ?? p.brush, editar = (patch: Record<string, unknown>, rotulo: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'presence', id: p.id, patch }, { rotulo }));
  return (<div class="grupo-presenca" data-testid={`presenca-item-${p.id}`}>
    <Linha rotulo={nome}><button type="button" class="botao-pilula" onClick={() => tentar(() => s.store.executar({ tipo: 'item.remover', colecao: 'presence', id: p.id }, { rotulo: `Remover ${nome.toLowerCase()}` }))}>Remover</button></Linha>
    <CampoNumero rotulo="Intensidade" dica="0 recolhe a mancha; 1 a espalha por tudo o que foi pintado." valor={p.intensity} min={0} max={1} passo={0.05} aoConfirmar={v => editar({ intensity: v }, `Intensidade de ${nome.toLowerCase()}`)} />
    <CampoCaixa rotulo="Só o mestre vê" valor={p.gmOnly} aoMudar={v => editar({ gmOnly: v }, 'Visibilidade da presença')} />
  </div>);
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
      <CampoCaixa rotulo="Raios visíveis" dica="Feixes de luz visíveis no facho." valor={l.rays} aoMudar={v => editar({ rays: v }, 'Raios da luz')} />
    </>}
  </>);
}

/** Reduz uma imagem para um retrato de até 256 px (WebP), recortada ao quadrado pelo centro: o banco guarda retratos leves. */
async function reduzirParaRetrato(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo), lado = Math.min(bitmap.width, bitmap.height), alvo = Math.min(256, lado);
  const tela = document.createElement('canvas'); tela.width = tela.height = alvo;
  tela.getContext('2d')!.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, alvo, alvo); bitmap.close();
  return new Promise((ok, falha) => tela.toBlob(b => (b ? ok(b) : falha(new Error('Não consegui converter a imagem.'))), 'image/webp', 0.9));
}

/** As luzes que uma peça pode carregar, e para onde o facho aponta (rad) quando a peça olha para cada lado. */
const LANTERNAS_DA_PECA = ['lanterna', 'lamparina', 'vela'];
const DIRECAO_DO_LADO: Record<Peca['facing'], number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/** Se a peça é de uma ficha: PV e PD (vindos da Ficha pelo barramento, nunca gravados no mapa) e o atalho para abri-la. */
function FichaDaPeca({ t }: { t: Peca }) {
  const ref = refDaFicha(t.refs); if (!ref) return null;
  const rec = recursosDasFichas.value[chaveDaRef(ref)];
  return (
    <Linha rotulo="Ficha" dica={formatarRef(ref)}>
      <span data-testid="inspetor-recursos">{rec ? textoDeRecursos(rec) : 'Sem dados da ficha'}</span>
      <button type="button" class="botao-pilula" data-testid="inspetor-abrir-ficha" onClick={() => void abrirFicha(servicos.value?.barramento, ref)}>Abrir ficha</button>
    </Linha>
  );
}

function CamposDaPeca({ s, t }: { s: SessaoDeEdicao; t: Peca }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch }, rotulo ? { rotulo } : {}));
  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const repo = servicos.value?.repo; if (!repo) { avisar('O banco de imagens não está disponível.', { tipo: 'erro' }); return; }
    try { const ref = await repo.salvarAsset(await reduzirParaRetrato(arquivo)); editar({ portrait: ref }, 'Retrato da peça'); } catch (erro) { avisar(`Não consegui usar essa imagem: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' }); }
  };
  const luz = t.lightId ? s.doc.value.lights[t.lightId] : undefined;
  const lanterna = luz ? (luz.preset && LANTERNAS_DA_PECA.includes(luz.preset) ? luz.preset : 'outra') : 'nenhuma';
  const opcoesDeLanterna: readonly (readonly [string, string])[] = [['nenhuma', 'Nenhuma'], ...LANTERNAS_DA_PECA.map(id => [id, PRESETS_DE_LUZ.find(p => p.id === id)!.nome] as const), ...(lanterna === 'outra' ? [['outra', 'Personalizada'] as const] : [])];
  /** Escolher cria a luz da peça (e tira a anterior) numa transação só; "nenhuma" a remove. */
  const trocarLanterna = (id: string) => {
    if (id === lanterna || id === 'outra') return;
    const preset = PRESETS_DE_LUZ.find(p => p.id === id), direcao = DIRECAO_DO_LADO[t.facing];
    tentar(() => s.store.transacao(preset ? `Lanterna: ${preset.nome.toLowerCase()}` : 'Tirar a lanterna', g => {
      if (t.lightId && s.doc.value.lights[t.lightId]) g.aplicar({ tipo: 'item.remover', colecao: 'lights', id: t.lightId });
      if (!preset) return;
      const nova = novaLuz([t.position[0], t.position[1]], { ...camposDoPreset(preset, direcao), ownerId: t.id });
      g.aplicar({ tipo: 'item.adicionar', colecao: 'lights', item: nova as never });
      g.aplicar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch: { lightId: nova.id } });
    }));
  };
  return (<>
    <CampoTexto rotulo="Nome" valor={t.name} aoConfirmar={v => v.trim() ? editar({ name: v.trim() }, 'Renomear peça') : false} />
    <Linha rotulo="Retrato" dica="Uma imagem quadrada fica melhor; o Atlas recorta em círculo.">
      <label class="botao-pilula" data-testid="retrato-enviar"><Icone nome="novo" tamanho={14} />{t.portrait ? 'Trocar…' : 'Enviar…'}<input type="file" accept="image/*" hidden data-testid="retrato-arquivo" onChange={e => { const campo = e.target as HTMLInputElement; void enviar(campo.files?.[0]); campo.value = ''; }} /></label>
      {t.portrait && <button type="button" class="botao-pilula" onClick={() => editar({ portrait: null }, 'Tirar o retrato')} data-testid="retrato-remover">Tirar</button>}
    </Linha>
    <PainelDoSprite s={s} t={t} />
    <FichaDaPeca t={t} />
    <CampoCaixa rotulo="Jogador" dica="A névoa e a visão da sessão vêm das peças de jogador." valor={t.player} aoMudar={v => editar({ player: v }, v ? 'Peça de jogador' : 'Peça do mestre')} />
    <CampoNumero rotulo="Tamanho" unidade="células" valor={t.size} min={0.5} max={4} passo={0.5} aoConfirmar={v => editar({ size: v }, 'Tamanho da peça')} />
    <CampoNumero rotulo="Visão" unidade="m" valor={t.vision.radius} min={0} max={200} passo={1} aoConfirmar={v => editar({ vision: { radius: v } }, 'Visão da peça')} />
    <CampoOpcoes rotulo="Lanterna" dica="A luz anda com a peça e aponta para onde ela andou. Q e E giram o facho na Sessão." valor={lanterna} opcoes={opcoesDeLanterna} aoMudar={trocarLanterna} />
    <CampoOpcoes rotulo="Estado" valor={t.figure.state} opcoes={ESTADOS_FIGURA.map(e => [e, ROTULOS_DE_ESTADO[e]] as const)} aoMudar={v => editar({ figure: { state: v } }, 'Estado da peça')} />
  </>);
}

/** O que o mestre pode acionar no objeto durante a sessão: um interruptor (acende e apaga luzes) ou uma gaveta (abre e fecha). */
/** Qual documento do Ateliê este objeto mostra; se o documento sumiu do banco, o objeto fica e o aviso aparece. */
function PistaDoObjeto({ i, aoEscolher }: { i: NonNullable<Objeto['interaction']>; aoEscolher: (ref: Ref | null) => void }) {
  const id = idDaPista(i.clue), lista = pistas.value, achou = !!id && lista.some(p => p.id === id), sumiu = !!id && pistasCarregadas.value && !achou;
  return (<>
    <CampoOpcoes rotulo="Documento" dica="Um documento entregue pelo Ateliê (Compartilhar com o Tabletop)." valor={id ?? ''} opcoes={[['', 'Escolha…'], ...lista.map(p => [p.id, p.name] as const), ...(id && !achou ? [[id, '(documento ausente)'] as const] : [])]}
      aoMudar={v => aoEscolher(v ? refDaPista(v) : null)} />
    {sumiu && <p class="dica aviso" data-testid="pista-ausente">Documento não encontrado no banco do Ateliê. O objeto continua aqui; entregue o documento de novo pelo Ateliê.</p>}
  </>);
}

function InteracaoDoObjeto({ s, o }: { s: SessaoDeEdicao; o: Objeto }) {
  const m = s.doc.value, i = o.interaction;
  const editar = (interaction: Objeto['interaction'] | undefined, rotulo: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'props', id: o.id, patch: { interaction: interaction as never } }, { rotulo }));
  const efetivas = i?.kind === 'switch' ? alvosDoInterruptor(m, o) : [];
  const trocar = (id: string, marcar: boolean) => editar({ ...i!, targets: marcar ? [...new Set([...efetivas, id])] : efetivas.filter(x => x !== id) }, 'Luzes do interruptor');
  return (<>
    <CampoOpcoes rotulo="Interação" dica="O que o mestre aciona na sessão, clicando no objeto ou com Enter ao lado de uma peça." valor={i?.kind ?? ''}
      opcoes={[['', 'Nenhuma'], ['switch', 'Interruptor'], ['drawer', 'Gaveta'], ['clue', 'Pista do Ateliê']] as never}
      aoMudar={v => editar(v ? { kind: v as 'switch' | 'drawer' | 'clue', on: v === 'clue' ? false : i?.on ?? true, targets: [], sound: i?.sound ?? null, clue: v === 'clue' ? i?.clue ?? null : null } : null, 'Interação do objeto')} />
    {(i?.kind === 'switch' || i?.kind === 'drawer') && <EscolherCena s={s} tipo="efeito" id="som-do-objeto" rotulo="Som" dica="Um efeito do Jukebox toca ao usar. Sem escolha (ou com o Jukebox fechado), vale o som do Atlas." valor={i.sound} aoEscolher={ref => editar({ ...i, sound: ref }, 'Som do objeto')} />}
    {i?.kind === 'clue' && <PistaDoObjeto i={i} aoEscolher={ref => editar({ ...i, clue: ref }, 'Pista do objeto')} />}
    {i?.kind === 'switch' && (<div data-testid="luzes-do-interruptor">
      <p class="dica">{i.targets.length ? 'Controla as luzes marcadas.' : 'Sem escolha, controla as luzes de rede deste cômodo (as de fogo ficam de fora).'}</p>
      {Object.values(m.lights).map(l => <CampoCaixa key={l.id} rotulo={nomeDoAlvo('lights', l)} valor={efetivas.includes(l.id)} aoMudar={v => trocar(l.id, v)} />)}
      {i.targets.length > 0 && <button type="button" class="botao-pilula" onClick={() => editar({ ...i, targets: [] }, 'Luzes do interruptor')}>Voltar ao padrão</button>}
    </div>)}
  </>);
}

function CamposDoObjeto({ s, o }: { s: SessaoDeEdicao; o: Objeto }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'props', id: o.id, patch }, rotulo ? { rotulo } : {}));
  const receita = o.source.kind === 'recipe' ? receitaDe(o.source.recipe) : null;
  const item = o.source.kind === 'asset' ? COLECAO.find(i => i.id === (o.source as { assetId: string }).assetId) ?? null : null;
  const origem = item ? (item.origem.tipo === 'gerado' ? 'gerado pelo Atlas' : `achado: ${item.origem.autor}, ${item.origem.licenca}`) : null;
  return (<>
    {o.source.kind === 'asset' && <div class="item-da-colecao" data-testid="item-da-colecao"><strong>{item?.nome ?? o.source.assetId}</strong><span class="dica">{item ? `Coleção da casa · ${origem}` : 'Este item não está na coleção desta versão do Atlas: aparece como marcador.'}</span></div>}
    {o.source.kind === 'asset' && <CampoCaixa rotulo="Harmonizar com o mapa" dica="Recorta o vazio, põe contorno e sombra e puxa a cor para a do gênero do mapa. Vale para imagens achadas; as geradas já nascem no traço da casa." valor={o.harmonize} aoMudar={v => editar({ harmonize: v }, 'Harmonizar objeto')} />}
    {o.source.kind === 'recipe' && <Linha rotulo={receita?.nome ?? o.source.recipe}><button type="button" class="botao-pilula" data-testid="variar" onClick={() => editar({ source: { seed: (o.source.kind === 'recipe' ? o.source.seed : 0) + 1 } }, 'Variar o objeto')}>Variar</button></Linha>}
    <CampoNumero rotulo="Rotação" unidade="°" valor={graus(o.rotation)} min={-360} max={360} passo={15} aoConfirmar={v => editar({ rotation: radianos(v) }, 'Girar')} />
    <Linha rotulo="Camada"><div class="acoes-selecao" data-testid="camadas">
      <button type="button" class="botao-pilula" data-testid="camada-tras" title="Enviar para trás (Ctrl+Shift+[)" onClick={() => tentar(() => s.store.executar({ tipo: 'objeto.camada', ids: [o.id], modo: 'tras' }, { rotulo: 'Enviar para trás' }))}>Para trás</button>
      <button type="button" class="botao-pilula" data-testid="camada-descer" title="Descer uma camada (Ctrl+[)" onClick={() => tentar(() => s.store.executar({ tipo: 'objeto.camada', ids: [o.id], modo: 'descer' }, { rotulo: 'Descer uma camada' }))}>↓</button>
      <button type="button" class="botao-pilula" data-testid="camada-subir" title="Subir uma camada (Ctrl+])" onClick={() => tentar(() => s.store.executar({ tipo: 'objeto.camada', ids: [o.id], modo: 'subir' }, { rotulo: 'Subir uma camada' }))}>↑</button>
      <button type="button" class="botao-pilula" data-testid="camada-frente" title="Trazer para a frente (Ctrl+Shift+])" onClick={() => tentar(() => s.store.executar({ tipo: 'objeto.camada', ids: [o.id], modo: 'frente' }, { rotulo: 'Trazer para a frente' }))}>Para frente</button>
    </div></Linha>
    <CampoNumero rotulo="Escala" valor={o.scale} min={0.05} max={50} passo={0.1} aoConfirmar={v => editar({ scale: v }, 'Escala do objeto')} />
    <InteracaoDoObjeto s={s} o={o} />
    <CampoCaixa rotulo="Bloqueia o movimento" valor={o.blocks.move} aoMudar={v => editar({ blocks: { move: v } })} />
    <CampoCaixa rotulo="Projeta sombra" valor={o.castsShadow} aoMudar={v => editar({ castsShadow: v })} />
    {(o.elevation === 'underwater' || (o.elevation === 'floor' && aguaEm(s.doc.value, o.position))) && <CampoCaixa rotulo="Submerso" dica="Fica sob a água: tingido pela cor do fundo e mais apagado quanto mais fundo; não projeta sombra." valor={o.elevation === 'underwater'} aoMudar={v => editar({ elevation: v ? 'underwater' : 'floor', castsShadow: v ? false : o.castsShadow }, v ? 'Submergir objeto' : 'Emergir objeto')} />}
  </>);
}

function CamposDaRegiao({ s, r }: { s: SessaoDeEdicao; r: Regiao }) {
  const editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'regions', id: r.id, patch }, rotulo ? { rotulo } : {}));
  return (<>
    <CampoOpcoes rotulo="Tipo" valor={r.kind} opcoes={[['note', 'Anotação'], ['trigger', 'Gatilho'], ['reveal', 'Revelação'], ['audio', 'Áudio']]} aoMudar={v => editar({ kind: v }, 'Tipo da região')} />
    <CampoCaixa rotulo="Só o mestre vê" valor={r.gmOnly} aoMudar={v => editar({ gmOnly: v })} />
    {r.kind === 'trigger' && <CampoTexto rotulo="Texto do gatilho" dica="Aparece para o mestre quando uma peça de jogador entra na região." valor={typeof r.payload.texto === 'string' ? r.payload.texto : ''} aoConfirmar={v => editar({ payload: { texto: v.trim() } }, 'Texto do gatilho')} maximo={400} />}
    {r.kind === 'audio' && <EscolherCena s={s} id="som-da-regiao" rotulo="Cena da região" dica="Quando uma peça de jogador entra na região, o Atlas pede ao Jukebox que toque esta cena." valor={r.refs.find(x => x.app === 'jukebox') ?? null}
      aoEscolher={ref => editar({ refs: [...r.refs.filter(x => x.app !== 'jukebox'), ...(ref ? [ref] : [])] }, 'Cena da região')} />}
  </>);
}

/** Ligações do cômodo: o que, nos outros aplicativos, pertence a este lugar (ficha de um NPC, cena sonora, documento…). */
function LigacoesDoComodo({ s, c }: { s: SessaoDeEdicao; c: Comodo }) {
  const m = s.doc.value, refs = m.comodosExtra[c.id]?.refs ?? [], entidades = useSignal<Entidade[]>([]), texto = useSignal('');
  useEffect(() => {
    let vivo = true; entidades.value = [];
    const repo = servicos.value?.campanhas;
    if (repo && m.campanhaId) void repo.listarEntidades(m.campanhaId).then(l => { if (vivo) entidades.value = l.filter(e => e.refs.some(r => r.app !== 'atlas')); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [m.campanhaId]);
  const gravar = (novas: Ref[], rotulo: string) => tentar(() => s.store.executar({ tipo: 'comodo.notas', id: c.id, patch: { refs: novas } }, { rotulo }));
  const juntar = (r: Ref) => { if (refs.some(x => chaveDaRef(x) === chaveDaRef(r))) { avisar('Esta ligação já existe.', { tipo: 'erro' }); return false; } return gravar([...refs, r], 'Ligar ao cômodo'); };
  return (<>
    <h3 class="faixa pequena">Ligações</h3>
    {refs.length ? <ul class="lista-itens" data-testid="ligacoes">{refs.map(r => (
      <li key={chaveDaRef(r)} class="ligacao"><span class="tipo-item">{r.app}</span><span class="ligacao-nome" title={formatarRef(r)}>{r.tipo} · {r.id}</span>
        <button type="button" class="botao-icone" aria-label="Remover a ligação" onClick={() => gravar(refs.filter(x => chaveDaRef(x) !== chaveDaRef(r)), 'Desligar do cômodo')}><Icone nome="fechar" tamanho={14} /></button></li>))}</ul>
      : <p class="dica">Nada ligado. Cole uma referência <code>mesa:app/tipo/id</code> ou escolha algo da campanha.</p>}
    {entidades.value.length > 0 && <label class="linha"><span class="linha-rotulo">Da campanha</span><span class="linha-controle">
      <select aria-label="Ligar algo da campanha" value="" onChange={e => { const ent = entidades.value.find(x => x.id === (e.target as HTMLSelectElement).value); const r = ent?.refs.find(x => x.app !== 'atlas'); if (r) juntar(r); (e.target as HTMLSelectElement).value = ''; }}>
        <option value="">Escolher…</option>{entidades.value.map(x => <option key={x.id} value={x.id}>{x.nome} ({x.tipo})</option>)}</select></span></label>}
    <label class="linha"><span class="linha-rotulo">Colar</span><span class="linha-controle">
      <input type="text" aria-label="Colar uma referência" placeholder="mesa:ficha/personagem/…" value={texto.value} onInput={e => { texto.value = (e.target as HTMLInputElement).value; }}
        onKeyDown={e => { if (e.key !== 'Enter') return; const r = lerRef(texto.value); if (!r) { avisar('Isso não parece uma referência da mesa (mesa:app/tipo/id).', { tipo: 'erro' }); return; } if (juntar(r)) texto.value = ''; }} /></span></label>
    <div class="acoes-selecao"><button type="button" class="botao-pilula" data-testid="copiar-ref" onClick={() => { const t = formatarRef(refDoComodo(m, c.id)); void navigator.clipboard?.writeText(t).then(() => avisar('Referência do cômodo copiada.'), () => avisar(t)); }}><Icone nome="copiar" tamanho={14} />Copiar referência</button></div>
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
    <CampoOpcoes rotulo="Telhado" dica="Na vista dos jogadores, cobre o cômodo até alguém entrar nele." valor={c.roof.material ?? ''} opcoes={[['', 'Nenhum'], ...materiaisDo('telhado').map(x => [x.id, x.nome] as const)]} aoMudar={v => editar({ roof: { material: v || null } }, 'Telhado')} />
    <CampoCaixa rotulo="Telhado visível" valor={c.roof.visible} aoMudar={v => editar({ roof: { visible: v } }, 'Telhado')} />
    <h3 class="faixa pequena">Texto de leitura</h3>
    <textarea class="notas" aria-label="Texto de leitura do cômodo" rows={3} placeholder="O que os jogadores percebem ao entrar…" key={`l:${extra?.leitura ?? ''}`} defaultValue={extra?.leitura ?? ''}
      onChange={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== (extra?.leitura ?? '')) notas({ leitura: v }); }}
      onBlur={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== (extra?.leitura ?? '')) notas({ leitura: v }); }} />
    <LigacoesDoComodo s={s} c={c} />
    <h3 class="faixa pequena">Notas do mestre</h3>
    <textarea class="notas" aria-label="Notas do mestre do cômodo" rows={3} placeholder="Só você vê…" key={`n:${extra?.notasMestre ?? ''}`} defaultValue={extra?.notasMestre ?? ''}
      onChange={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== (extra?.notasMestre ?? '')) notas({ notasMestre: v }); }}
      onBlur={e => { const v = (e.target as HTMLTextAreaElement).value; if (v !== (extra?.notasMestre ?? '')) notas({ notasMestre: v }); }} />
  </>);
}

function CamposDaParede({ s, w }: { s: SessaoDeEdicao; w: Parede }) {
  const avulsa = w.kind === 'cliff' && !w.source;
  const st = s.store, editar = (patch: Record<string, unknown>, rotulo?: string) => tentar(() => st.executar({ tipo: 'parede.atualizar', id: w.id, patch: patch as never }, rotulo ? { rotulo } : {}));
  return (<>
    <CampoOpcoes rotulo="Tipo" valor={w.kind} opcoes={[['wall', 'Parede'], ['low', 'Muro baixo'], ['fence', 'Cerca'], ['cliff', 'Escarpa']] as never}
      aoMudar={v => editar(v === 'cliff' ? { kind: v, drop: w.drop ?? 'b', material: materialDe(w.material).uso === 'macico' ? w.material : 'rocha.cinza', blocks: { sight: false, light: false } } : { kind: v }, 'Tipo da parede')} />
    {avulsa && <p class="dica">Lado baixo: a seta no mapa. <button type="button" class="botao-pilula" data-testid="escarpa-lado" onClick={() => editar({ drop: (w.drop ?? 'b') === 'a' ? 'b' : 'a' }, 'Lado baixo da escarpa')}>Trocar o lado</button></p>}
    <CampoNumero rotulo="Altura" unidade="m" valor={w.height} min={avulsa ? 0.5 : 0.1} max={avulsa ? 12 : 20} passo={avulsa ? 0.5 : 0.1} aoConfirmar={v => editar({ height: v }, 'Altura da parede')} />
    {avulsa && <CampoOpcoes rotulo="Rocha" valor={materialDe(w.material).uso === 'macico' ? w.material : 'rocha.cinza'} opcoes={materiaisDo('macico').map(x => [x.id, x.nome] as const)} aoMudar={v => editar({ material: v }, 'Rocha da escarpa')} />}
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
    {porta && <EscolherCena s={s} tipo="efeito" id="som-da-porta" rotulo="Som da porta" dica="Um efeito do Jukebox toca ao abrir e ao fechar. Sem escolha (ou com o Jukebox fechado), vale o som do Atlas." valor={o.som} aoEscolher={ref => editar({ som: ref }, 'Som da porta')} />}
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
    if (total) return <div class="painel-corpo" data-testid="painel-selecao"><p class="dica">Clique em algo no mapa para ver e ajustar. Arraste no vazio para selecionar vários.</p></div>;
    return (
      <div class="painel-corpo" data-testid="painel-selecao">
        <h3 class="faixa pequena">Primeiros passos</h3>
        <ol class="passos-iniciais">
          <li><kbd>C</kbd><span><b>Pinte um cômodo</b><small>Arraste na grade; o piso e as paredes vêm juntos.</small></span></li>
          <li><kbd>W</kbd><span><b>Ajuste as paredes</b><small>Desenhe, ou apague onde sobrou.</small></span></li>
          <li><kbd>D</kbd><span><b>Abra portas e janelas</b><small>Clique numa parede para pôr a abertura.</small></span></li>
          <li><kbd>O</kbd><span><b>Mobilie</b><small>Objetos da biblioteca, com o estilo do mapa.</small></span></li>
          <li><kbd>L</kbd><span><b>Acenda as luzes</b><small>Depois troque o clima e veja a cena mudar.</small></span></li>
        </ol>
        <p class="dica">Clique com o botão direito para o menu radial, ou <kbd>Ctrl</kbd> <kbd>K</kbd> para buscar qualquer ação.</p>
      </div>
    );
  }
  const unico = alvos.length === 1 ? alvos[0]! : null;
  return (
    <div class="painel-corpo" data-testid="painel-selecao">
      <h3 class="faixa pequena" data-testid="titulo-selecao">{unico ? nomeDoAlvo(unico.colecao, (m[unico.colecao] as Record<string, { id: string }>)[unico.id]!) : `${alvos.length} itens`}</h3>
      {unico ? (modo.value === 'sessao' && unico.colecao !== 'tokens' ? <p class="dica" data-testid="dica-sessao">Na Sessão só as peças se ajustam aqui. Para editar isto, volte ao modo Construir (M).</p> : <Detalhe s={s} m={m} a={unico} />) : (
        <ul class="lista-itens">{alvos.map(a => <li key={chaveDoAlvo(a)}><button type="button" onClick={() => { s.selecao.value = [a]; }}>
          <span class="tipo-item">{NOMES_COLECAO.singular[a.colecao]}</span> {nomeDoAlvo(a.colecao, (m[a.colecao] as Record<string, { id: string }>)[a.id]!)}</button></li>)}</ul>
      )}
      {modo.value === 'construir' && <div class="acoes-selecao">
        <button type="button" class="botao-pilula" onClick={duplicarSelecao} data-testid="duplicar"><Icone nome="duplicar" tamanho={14} />Duplicar</button>
        <button type="button" class="botao-pilula perigo" onClick={removerSelecao} data-testid="remover"><Icone nome="lixeira" tamanho={14} />Remover</button>
      </div>}
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
  const s = sessao.value, aba = abaDoInspetor;
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
