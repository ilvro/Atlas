import type { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { definirObjetosNaGrade, objetosNaGrade } from '../app/preferencias.ts';
import type { PincelDeObjeto, PropriedadesDoObjeto as Propriedades } from '../domain/pincel-de-objeto.ts';
import { CampoCaixa, CampoDeslizante, Linha } from './campos.tsx';

const graus = (rad: number) => Math.round((((rad * 180) / Math.PI) % 360 + 360) % 360 * 10) / 10;
const radianos = (g: number) => (g * Math.PI) / 180;

export type ValoresDoPainel = Propriedades & Partial<PincelDeObjeto>;

const Cartao = ({ titulo, id, children }: { titulo: string; id: string; children: ComponentChildren }) => (
  <section class="cartao-prop" data-testid={`prop-${id}`}><h4>{titulo}</h4>{children}</section>
);

const Dado = ({ ligado, aoAlternar, dica, id }: { ligado: boolean; aoAlternar: () => void; dica: string; id: string }) => (
  <button type="button" class={`chip dado ${ligado ? 'ativo' : ''}`} aria-pressed={ligado} title={dica} onClick={aoAlternar} data-testid={id}>🎲</button>
);

/**
 * O painel de propriedades do objeto, um só para os dois usos: no modo `pincel` edita o que vale ao pôr (inclui o dado de cada variação e a colocação);
 * no modo `selecao` edita o objeto (ou os objetos) já posto, e `aoMudar` recebe só o que mudou, num gesto.
 */
export function PropriedadesDoObjeto({ valores: v, aoMudar, modo }: { valores: ValoresDoPainel; aoMudar: (patch: Partial<PincelDeObjeto>) => void; modo: 'pincel' | 'selecao' }) {
  const pincel = modo === 'pincel', mais = useSignal(false);
  return (
    <div class="propriedades-objeto" data-testid="propriedades-objeto" data-modo={modo}>
      <Cartao titulo="Transformar" id="transformar">
        <CampoDeslizante rotulo="Escala" id="prop-escala" valor={Math.round(v.escala * 100)} min={10} max={300} passo={5} unidade="%" aoConfirmar={x => aoMudar({ escala: x / 100 })} />
        <CampoDeslizante rotulo="Rotação" id="prop-rotacao" valor={graus(v.rotacao)} min={0} max={360} passo={5} unidade="°" aoConfirmar={x => aoMudar({ rotacao: radianos(x) })}
          extra={pincel ? <Dado ligado={!!v.rotacaoAleatoria} aoAlternar={() => aoMudar({ rotacaoAleatoria: !v.rotacaoAleatoria })} dica="Gira por sorteio a cada objeto posto" id="prop-rotacao-dado" /> : undefined} />
        <CampoDeslizante rotulo="Camada" id="prop-camada" valor={v.camada ?? 0} min={-3} max={5} passo={1}
          dica="Ordem de empilhamento entre objetos: maior fica por cima. Sem escolha, vale a camada padrão do tipo."
          aoConfirmar={x => aoMudar({ camada: x })}
          extra={v.camada !== null ? <button type="button" class="chip" title="Voltar à camada padrão do tipo" onClick={() => aoMudar({ camada: null })} data-testid="prop-camada-padrao">padrão</button> : <span class="dica-curta">padrão</span>} />
        <Linha rotulo="Espelhar">
          <span class="acoes-selecao">
            <button type="button" class={`chip ${v.espelhado ? 'ativo' : ''}`} aria-pressed={v.espelhado} title="Espelhar na horizontal" onClick={() => aoMudar({ espelhado: !v.espelhado })} data-testid="prop-espelhar-h">↔</button>
            <button type="button" class="chip" title="Espelhar na vertical (inverte o espelho e gira 180°)" onClick={() => aoMudar({ espelhado: !v.espelhado, rotacao: v.rotacao + Math.PI })} data-testid="prop-espelhar-v">↕</button>
          </span>
        </Linha>
      </Cartao>
      <Cartao titulo="Aparência" id="aparencia">
        <CampoDeslizante rotulo="Opacidade" id="prop-opacidade" valor={Math.round(v.opacidade * 100)} min={10} max={100} passo={5} unidade="%" aoConfirmar={x => aoMudar({ opacidade: x / 100 })} />
        <CampoCaixa rotulo="Projeta sombra" valor={v.sombra} aoMudar={x => aoMudar({ sombra: x })} id="prop-sombra" />
        <CampoCaixa rotulo="Bloqueia o movimento" valor={v.bloqueia} aoMudar={x => aoMudar({ bloqueia: x })} id="prop-bloqueia" />
      </Cartao>
      {pincel && (
        <Cartao titulo="Colocação" id="colocacao">
          <Linha rotulo="Pôr">
            <span class="acoes-selecao" role="group" aria-label="Quantos objetos por clique">
              <button type="button" class={`chip ${v.colocar !== 'varios' ? 'ativo' : ''}`} onClick={() => aoMudar({ colocar: 'um' })} data-testid="prop-colocar-um">Um</button>
              <button type="button" class={`chip ${v.colocar === 'varios' ? 'ativo' : ''}`} onClick={() => aoMudar({ colocar: 'varios' })} title="Arrastar põe vários, ao longo do caminho" data-testid="prop-colocar-varios">Vários</button>
            </span>
          </Linha>
          <CampoCaixa rotulo="Selecionar ao pôr" valor={v.selecionarAoPor ?? true} aoMudar={x => aoMudar({ selecionarAoPor: x })} id="prop-selecionar" />
          <CampoCaixa rotulo="Encaixar na grade" dica="Preferência do editor, não do mapa. Com ela desligada, o objeto fica sob o cursor e Alt encaixa." valor={objetosNaGrade.value} aoMudar={definirObjetosNaGrade} id="prop-grade" />
          <button type="button" class="chip mais-opcoes" aria-expanded={mais.value} onClick={() => { mais.value = !mais.value; }} data-testid="prop-mais">{mais.value ? '▾' : '▸'} Mais opções</button>
          {mais.value && (<div data-testid="prop-mais-opcoes">
            <CampoDeslizante rotulo="Área" id="prop-area" valor={v.area ?? 0} min={0} max={20} passo={0.5} unidade="m" dica="Com área, cada carimbo espalha alguns objetos no círculo (modo Vários)." aoConfirmar={x => aoMudar({ area: x })} />
            <CampoDeslizante rotulo="Densidade" id="prop-densidade" valor={v.densidade ?? 1} min={0.1} max={4} passo={0.1} unidade="×" aoConfirmar={x => aoMudar({ densidade: x })} />
            <CampoCaixa rotulo="Espelho aleatório" valor={!!v.espelhoAleatorio} aoMudar={x => aoMudar({ espelhoAleatorio: x })} id="prop-espelho-aleatorio" />
            <CampoDeslizante rotulo="Escala aleatória" id="prop-escala-aleatoria" valor={Math.round((v.escalaAleatoria ?? 0) * 100)} min={0} max={50} passo={5} unidade="±%" aoConfirmar={x => aoMudar({ escalaAleatoria: x / 100 })} />
          </div>)}
        </Cartao>
      )}
    </div>
  );
}
