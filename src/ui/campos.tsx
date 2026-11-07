import type { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { avisar } from '../app/toasts.ts';
import { tocar } from '../fx/som.ts';

/** Um campo do inspetor: rótulo à esquerda, controle à direita. */
export const Linha = ({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ComponentChildren }) => (
  <label class="linha" title={dica} data-campo={rotulo}><span class="linha-rotulo">{rotulo}</span><span class="linha-controle">{children}</span></label>
);

/** Rodar uma edição: se o comando for recusado, mostra o motivo e o campo volta ao valor do mapa. */
export function tentar(fn: () => void): boolean {
  try { fn(); return true; } catch (erro) {
    avisar(erro instanceof Error ? erro.message.replace(/^O comando deixaria o mapa inválido — /, 'Valor inválido — ') : String(erro), { tipo: 'erro' }); tocar('erro'); return false;
  }
}

interface BaseCampo { rotulo: string; dica?: string; id?: string }

export function CampoTexto({ rotulo, dica, id, valor, aoConfirmar, maximo = 120 }: BaseCampo & { valor: string; aoConfirmar: (v: string) => boolean | void; maximo?: number }) {
  const sal = useSignal(0);
  return <Linha rotulo={rotulo} dica={dica}><input id={id} key={`${valor}:${sal.value}`} type="text" maxLength={maximo} defaultValue={valor}
    onChange={e => { if (aoConfirmar((e.target as HTMLInputElement).value) === false) sal.value++; }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></Linha>;
}

export function CampoNumero({ rotulo, dica, id, valor, aoConfirmar, min, max, passo = 1, unidade }: BaseCampo & { valor: number; aoConfirmar: (v: number) => boolean | void; min?: number; max?: number; passo?: number; unidade?: string }) {
  const sal = useSignal(0);
  return <Linha rotulo={rotulo} dica={dica}>
    <input id={id} data-testid={id} key={`${valor}:${sal.value}`} type="number" step={passo} {...(min !== undefined ? { min } : {})} {...(max !== undefined ? { max } : {})} defaultValue={Math.round(valor * 1000) / 1000}
      onChange={e => { const v = Number((e.target as HTMLInputElement).value); if (!Number.isFinite(v) || aoConfirmar(v) === false) sal.value++; }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    {unidade && <span class="unidade">{unidade}</span>}
  </Linha>;
}

export function CampoCaixa({ rotulo, dica, id, valor, aoMudar }: BaseCampo & { valor: boolean; aoMudar: (v: boolean) => void }) {
  return <Linha rotulo={rotulo} dica={dica}><input id={id} data-testid={id} type="checkbox" checked={valor} onChange={e => aoMudar((e.target as HTMLInputElement).checked)} /></Linha>;
}

export function CampoOpcoes<T extends string>({ rotulo, dica, id, valor, opcoes, aoMudar }: BaseCampo & { valor: T; opcoes: readonly (readonly [T, string])[]; aoMudar: (v: T) => void }) {
  return <Linha rotulo={rotulo} dica={dica}><select id={id} data-testid={id} value={valor} onChange={e => aoMudar((e.target as HTMLSelectElement).value as T)}>{opcoes.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select></Linha>;
}

/** Cor com prévia ao vivo: o arrastar do seletor vira UM item de histórico. */
export function CampoCor({ rotulo, dica, valor, aoPrevia, aoConfirmar, aoCancelar }: BaseCampo & { valor: string; aoPrevia: (v: string) => void; aoConfirmar: () => void; aoCancelar?: () => void }) {
  return <Linha rotulo={rotulo} dica={dica}><input type="color" value={valor} onInput={e => aoPrevia((e.target as HTMLInputElement).value)} onChange={aoConfirmar} onBlur={aoCancelar} /><code class="valor-cor">{valor}</code></Linha>;
}
