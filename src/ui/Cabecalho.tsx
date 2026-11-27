import type { ComponentType } from 'preact';
import { mostrarAtalho } from '../app/atalhos.ts';
import { embutido } from '../app/embutido.ts';
import { emConstrucaoRemota } from '../app/construcao-remota.ts';
import { acaoPorId, executarAcao, fxLigado, somLigado } from '../app/acoes.ts';
import { abrirProjetor, ajudaAberta, definirTelhadosNoEditor, navegar, paletaAberta, renomearMapaAberto, rota, sessao, telhadosNoEditor } from '../app/app.ts';
import { ROTULO_DO_MODO, modo, vistaDeJogador, type Modo } from '../app/modo.ts';
import { andarDoProjetor, andarManualDoProjetor } from '../app/projetor.ts';
import { seloDoAssistente } from '../app/assistente-slot.ts';
import { tema, trocarTema } from '../app/tema.ts';
import { TEMAS, type TemaId } from '#mesa';
import { andaresDosJogadores, ehMultiandar, listaDeAndares } from '../domain/andares.ts';
import { MODOS_TELHADOS_SESSAO, type ModoTelhadosSessao } from '../domain/mapa.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import { Icone } from './Icone.tsx';
import { AbasDeMapas } from './AbasDeMapas.tsx';

const ROTULO_TELHADOS: Record<ModoTelhadosSessao, string> = {
  auto: 'Telhados: automático',
  fechados: 'Telhados: sempre',
  abertos: 'Telhados: abertos',
};

function BotaoTelhadosSessao({ s }: { s: SessaoDeEdicao }) {
  const atual: ModoTelhadosSessao = s.doc.value.session.roofs ?? 'auto';
  const proximo = MODOS_TELHADOS_SESSAO[(MODOS_TELHADOS_SESSAO.indexOf(atual) + 1) % MODOS_TELHADOS_SESSAO.length]!;
  return (
    <button
      type="button"
      class="botao-pilula botao-vista"
      aria-pressed={atual !== 'auto'}
      title="Alternar telhados na sessão (automático, sempre cobertos ou todos abertos)"
      onClick={() => s.store.executar({ tipo: 'sessao.telhados', modo: proximo })}
      data-testid="sessao-telhados"
      data-modo-telhados={atual}
    >
      <Icone nome="telhado" tamanho={14} />{ROTULO_TELHADOS[atual]}
    </button>
  );
}

/** No modo Construir: mostra ou esconde os telhados enquanto se constrói (preferência de quem edita; Shift+T). */
function BotaoTelhadosConstruir() {
  const ligado = telhadosNoEditor.value;
  return (
    <button type="button" class={`botao-pilula botao-vista ${ligado ? 'ligado' : ''}`} aria-pressed={ligado}
      title={`${ligado ? 'Esconder' : 'Mostrar'} os telhados enquanto constrói (Shift+T). Para tirar o telhado de uma casa, selecione um cômodo e desmarque “Telhado visível”.`}
      onClick={() => definirTelhadosNoEditor(!ligado)} data-testid="construir-telhados">
      <Icone nome="telhado" tamanho={14} />{ligado ? 'Telhados à mostra' : 'Telhados escondidos'}
    </button>
  );
}

function SeletorAndarProjetor({ s }: { s: SessaoDeEdicao }) {
  const m = s.doc.value;
  if (!ehMultiandar(m) || andaresDosJogadores(m).length <= 1) return null;
  const lista = listaDeAndares(m);
  const manual = andarManualDoProjetor.value;
  const efetivo = andarDoProjetor.value;
  const nomeEfetivo = lista.find(a => a.id === efetivo)?.nome ?? lista[0]?.nome ?? 'Térreo';
  const valor = manual === undefined ? '__auto' : (manual ?? '__terreo');
  return (
    <label class="botao-pilula projetor-andar" title="Andar exibido na janela do projetor" data-testid="projetor-andar">
      <span>Projetor:</span>
      <select
        aria-label="Andar do projetor"
        data-testid="projetor-andar-select"
        value={valor}
        onChange={e => {
          const v = (e.target as HTMLSelectElement).value;
          andarManualDoProjetor.value = v === '__auto' ? undefined : v === '__terreo' ? null : v;
        }}
      >
        <option value="__auto">{nomeEfetivo} (auto)</option>
        {lista.map(a => <option key={a.id ?? '__terreo'} value={a.id ?? '__terreo'}>{a.nome}</option>)}
      </select>
    </label>
  );
}

const executar = (id: string) => () => { const a = acaoPorId(id); if (a) executarAcao(a); };
const dica = (nome: string, id: string) => { const t = acaoPorId(id)?.atalhos?.[0]; return t ? `${nome} (${mostrarAtalho(t)})` : nome; };

/** O cabeçalho dentro da Mesa (`?embutido=1`): só o nome do mapa, a vista de jogador, o projetor e os sons. */
function CabecalhoEmbutido({ Selo }: { Selo: ComponentType | null }) {
  const s = sessao.value, noEditor = rota.value.tipo === 'mapa' && s;
  return (
    <header class="cabecalho compacto em-sessao" data-testid="cabecalho-embutido" data-modo={noEditor ? 'sessao' : undefined}>
      <span class="marca" aria-label="Atlas"><span class="marca-escudo" aria-hidden="true">◈</span> ATLAS</span>
      {noEditor && s ? <span class="nome-do-mapa-fixo" data-testid="nome-do-mapa-embutido">{s.doc.value.name}</span> : <span class="meta">sem mapa</span>}
      <span class="espaco" />
      {Selo ? <Selo /> : null}
      {noEditor ? <button type="button" class="botao-pilula botao-vista" aria-pressed={vistaDeJogador.value} title={dica('Ver como jogador', 'vista-jogador')} onClick={executar('vista-jogador')} data-testid="vista-jogador">Jogador</button> : null}
      {noEditor && s ? <BotaoTelhadosSessao s={s} /> : null}
      {noEditor && s ? <SeletorAndarProjetor s={s} /> : null}
      {noEditor ? <button type="button" class="botao-pilula" title="Abrir a janela do projetor para os jogadores" onClick={abrirProjetor} data-testid="embutido-projetor">Projetor</button> : null}
      <button type="button" class={`botao-icone ${fxLigado.value ? 'ligado' : ''}`} title="Animações" aria-pressed={fxLigado.value} onClick={executar('fx')} data-testid="alternar-fx"><Icone nome="anim" /></button>
      <button type="button" class={`botao-icone ${somLigado.value ? 'ligado' : ''}`} title="Sons" aria-pressed={somLigado.value} onClick={executar('som')} data-testid="alternar-som"><Icone nome={somLigado.value ? 'som' : 'mudo'} /></button>
      <button type="button" class="botao-icone" title={dica('Atalhos', 'ajuda')} aria-pressed={ajudaAberta.value} onClick={executar('ajuda')} data-testid="ajuda-botao"><Icone nome="ajuda" /></button>
    </header>
  );
}

export function Cabecalho() {
  const Selo = seloDoAssistente.value;
  const remoto = emConstrucaoRemota.value;
  if (embutido && !remoto) return <CabecalhoEmbutido Selo={Selo} />;
  const s = sessao.value, noEditor = (rota.value.tipo === 'mapa' || remoto) && s;
  return (
    <header class={`cabecalho ${noEditor && modo.value === 'sessao' ? 'em-sessao' : ''}`} data-modo={noEditor ? modo.value : undefined}>
      {remoto
        ? <span class="marca" aria-label="Atlas"><span class="marca-escudo" aria-hidden="true">◈</span> ATLAS</span>
        : <a class="marca" href="#/" onClick={e => { e.preventDefault(); navegar({ tipo: 'galeria' }); }} aria-label="Atlas: ir para a galeria"><span class="marca-escudo" aria-hidden="true">◈</span> ATLAS</a>}
      {!remoto && noEditor && s ? <AbasDeMapas /> : null}
      {remoto && noEditor && s ? (
        <input
          id="nome-do-mapa"
          class="nome-do-mapa"
          key={s.doc.value.id + s.doc.value.name}
          defaultValue={s.doc.value.name}
          aria-label="Nome do mapa"
          data-testid="nome-do-mapa-remoto"
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
      ) : null}
      {!remoto && noEditor && modo.value === 'sessao' ? <span class="faixa-sessao" data-testid="faixa-sessao">SESSÃO</span> : null}
      {!remoto && noEditor && modo.value === 'sessao' ? <button type="button" class="botao-pilula botao-vista" aria-pressed={vistaDeJogador.value} title={dica('Ver como jogador', 'vista-jogador')} onClick={executar('vista-jogador')} data-testid="vista-jogador"><Icone nome="olho" tamanho={14} />Ver como jogador</button> : null}
      {!remoto && noEditor && s && modo.value === 'sessao' ? <BotaoTelhadosSessao s={s} /> : null}
      {noEditor && s && modo.value === 'construir' ? <BotaoTelhadosConstruir /> : null}
      {!remoto && noEditor && s && modo.value === 'sessao' ? <SeletorAndarProjetor s={s} /> : null}
      <span class="espaco" />
      {!remoto && noEditor && s ? (<div class="grupo chave-de-modo" role="radiogroup" aria-label="Modo" data-testid="chave-de-modo">
        {(['construir', 'sessao'] as Modo[]).map(id => <button type="button" key={id} role="radio" aria-checked={modo.value === id} class={`ficha ${modo.value === id ? 'ativa' : ''}`} title={dica(`Modo ${ROTULO_DO_MODO[id]}`, 'modo')} data-testid={`modo-${id}`} onClick={() => { if (modo.value !== id) executar('modo')(); }}>{ROTULO_DO_MODO[id]}</button>)}
      </div>) : null}
      {noEditor && s ? (<div class="grupo">
        <button type="button" class="botao-icone" title={s.rotuloDesfazer.value ? `Desfazer: ${s.rotuloDesfazer.value} (Ctrl+Z)` : 'Desfazer (Ctrl+Z)'} disabled={!s.podeDesfazer.value} onClick={executar('desfazer')} data-testid="desfazer"><Icone nome="desfazer" /></button>
        <button type="button" class="botao-icone" title={s.rotuloRefazer.value ? `Refazer: ${s.rotuloRefazer.value} (Ctrl+Shift+Z)` : 'Refazer (Ctrl+Shift+Z)'} disabled={!s.podeRefazer.value} onClick={executar('refazer')} data-testid="refazer"><Icone nome="refazer" /></button>
        {!remoto ? <button type="button" class="botao-pilula" title={dica('Gravar o mapa', 'gravar')} onClick={executar('gravar')} data-testid="gravar"><Icone nome="gravar" tamanho={15} />Gravar</button> : null}
      </div>) : null}
      {!remoto && Selo ? <Selo /> : null}
      <div class="grupo" role="radiogroup" aria-label="Tema">
        {(Object.keys(TEMAS) as TemaId[]).map(id => <button type="button" key={id} role="radio" aria-checked={tema.value.id === id} class={`ficha ${tema.value.id === id ? 'ativa' : ''}`} onClick={() => trocarTema({ id })} data-testid={`tema-${id}`}>{TEMAS[id].nome}</button>)}
      </div>
      <div class="grupo">
        <button type="button" class={`botao-icone ${fxLigado.value ? 'ligado' : ''}`} title="Animações" aria-pressed={fxLigado.value} onClick={executar('fx')} data-testid="alternar-fx"><Icone nome="anim" /></button>
        <button type="button" class={`botao-icone ${somLigado.value ? 'ligado' : ''}`} title="Sons" aria-pressed={somLigado.value} onClick={executar('som')} data-testid="alternar-som"><Icone nome={somLigado.value ? 'som' : 'mudo'} /></button>
        <button type="button" class="botao-icone" title="Atalhos (?)" aria-pressed={ajudaAberta.value} onClick={executar('ajuda')} data-testid="ajuda-botao"><Icone nome="ajuda" /></button>
        <button type="button" class="botao-pilula" title={dica('Paleta de comandos', 'paleta')} aria-pressed={paletaAberta.value} onClick={executar('paleta')} data-testid="abrir-paleta"><Icone nome="paleta" tamanho={15} />Ctrl+K</button>
      </div>
    </header>
  );
}
