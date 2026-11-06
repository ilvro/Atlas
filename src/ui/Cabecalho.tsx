import { mostrarAtalho } from '../app/atalhos.ts';
import { embutido } from '../app/embutido.ts';
import { acaoPorId, executarAcao, fxLigado, somLigado } from '../app/acoes.ts';
import { abrirProjetor, ajudaAberta, navegar, paletaAberta, rota, sessao } from '../app/app.ts';
import { ROTULO_DO_MODO, modo, vistaDeJogador, type Modo } from '../app/modo.ts';
import { tema, trocarTema } from '../app/tema.ts';
import { TEMAS, type TemaId } from '#mesa';
import { Icone } from './Icone.tsx';
import { AbasDeMapas } from './AbasDeMapas.tsx';

const executar = (id: string) => () => { const a = acaoPorId(id); if (a) executarAcao(a); };
const dica = (nome: string, id: string) => { const t = acaoPorId(id)?.atalhos?.[0]; return t ? `${nome} (${mostrarAtalho(t)})` : nome; };

/** O cabeçalho dentro da Mesa (`?embutido=1`): só o nome do mapa, a vista de jogador, o projetor e os sons. */
function CabecalhoEmbutido() {
  const s = sessao.value, noEditor = rota.value.tipo === 'mapa' && s;
  return (
    <header class="cabecalho compacto em-sessao" data-testid="cabecalho-embutido" data-modo={noEditor ? 'sessao' : undefined}>
      <span class="marca" aria-label="Atlas"><span class="marca-escudo" aria-hidden="true">◈</span> ATLAS</span>
      {noEditor && s ? <span class="nome-do-mapa-fixo" data-testid="nome-do-mapa-embutido">{s.doc.value.name}</span> : <span class="meta">sem mapa</span>}
      <span class="espaco" />
      {noEditor ? <button type="button" class="botao-pilula botao-vista" aria-pressed={vistaDeJogador.value} title={dica('Ver como jogador', 'vista-jogador')} onClick={executar('vista-jogador')} data-testid="vista-jogador">Jogador</button> : null}
      {noEditor ? <button type="button" class="botao-pilula" title="Abrir a janela do projetor para os jogadores" onClick={abrirProjetor} data-testid="embutido-projetor">Projetor</button> : null}
      <button type="button" class={`botao-icone ${fxLigado.value ? 'ligado' : ''}`} title="Animações" aria-pressed={fxLigado.value} onClick={executar('fx')} data-testid="alternar-fx"><Icone nome="anim" /></button>
      <button type="button" class={`botao-icone ${somLigado.value ? 'ligado' : ''}`} title="Sons" aria-pressed={somLigado.value} onClick={executar('som')} data-testid="alternar-som"><Icone nome={somLigado.value ? 'som' : 'mudo'} /></button>
    </header>
  );
}

export function Cabecalho() {
  if (embutido) return <CabecalhoEmbutido />;
  const s = sessao.value, noEditor = rota.value.tipo === 'mapa' && s;
  return (
    <header class={`cabecalho ${noEditor && modo.value === 'sessao' ? 'em-sessao' : ''}`} data-modo={noEditor ? modo.value : undefined}>
      <a class="marca" href="#/" onClick={e => { e.preventDefault(); navegar({ tipo: 'galeria' }); }} aria-label="Atlas: ir para a galeria"><span class="marca-escudo" aria-hidden="true">◈</span> ATLAS</a>
      {noEditor && s ? <AbasDeMapas /> : null}
      {noEditor && modo.value === 'sessao' ? <span class="faixa-sessao" data-testid="faixa-sessao">SESSÃO</span> : null}
      {noEditor && modo.value === 'sessao' ? <button type="button" class="botao-pilula botao-vista" aria-pressed={vistaDeJogador.value} title={dica('Ver como jogador', 'vista-jogador')} onClick={executar('vista-jogador')} data-testid="vista-jogador"><Icone nome="olho" tamanho={14} />Ver como jogador</button> : null}
      <span class="espaco" />
      {noEditor && s ? (<div class="grupo chave-de-modo" role="radiogroup" aria-label="Modo" data-testid="chave-de-modo">
        {(['construir', 'sessao'] as Modo[]).map(id => <button type="button" key={id} role="radio" aria-checked={modo.value === id} class={`ficha ${modo.value === id ? 'ativa' : ''}`} title={dica(`Modo ${ROTULO_DO_MODO[id]}`, 'modo')} data-testid={`modo-${id}`} onClick={() => { if (modo.value !== id) executar('modo')(); }}>{ROTULO_DO_MODO[id]}</button>)}
      </div>) : null}
      {noEditor && s ? (<div class="grupo">
        <button type="button" class="botao-icone" title={s.rotuloDesfazer.value ? `Desfazer: ${s.rotuloDesfazer.value} (Ctrl+Z)` : 'Desfazer (Ctrl+Z)'} disabled={!s.podeDesfazer.value} onClick={executar('desfazer')} data-testid="desfazer"><Icone nome="desfazer" /></button>
        <button type="button" class="botao-icone" title={s.rotuloRefazer.value ? `Refazer: ${s.rotuloRefazer.value} (Ctrl+Shift+Z)` : 'Refazer (Ctrl+Shift+Z)'} disabled={!s.podeRefazer.value} onClick={executar('refazer')} data-testid="refazer"><Icone nome="refazer" /></button>
        <button type="button" class="botao-pilula" title={dica('Gravar o mapa', 'gravar')} onClick={executar('gravar')} data-testid="gravar"><Icone nome="gravar" tamanho={15} />Gravar</button>
      </div>) : null}
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
