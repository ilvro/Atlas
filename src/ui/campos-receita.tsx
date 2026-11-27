import type { CampoDeReceita } from '../procedural/receitas/index.ts';
import { CampoNumero } from './campos.tsx';
import { CampoMaterial } from './campos-material.tsx';

/** Campos de parâmetros de uma receita (números e materiais), compartilhados entre Biblioteca e Inspetor. */
export function CamposDaReceita({
  campos,
  params,
  aoMudar,
}: {
  campos: readonly CampoDeReceita[];
  params: Record<string, unknown>;
  aoMudar: (id: string, valor: number | string) => void;
}) {
  return (
    <>
      {campos.map(c =>
        c.tipo === 'numero'
          ? (
            <CampoNumero
              key={c.id}
              rotulo={c.rotulo}
              unidade="m"
              valor={typeof params[c.id] === 'number' ? (params[c.id] as number) : (c.padrao as number)}
              min={c.min ?? 0}
              max={c.max ?? 20}
              passo={c.passo ?? 0.1}
              aoConfirmar={v => aoMudar(c.id, v)}
            />
          )
          : (
            <CampoMaterial
              key={c.id}
              rotulo={c.rotulo}
              uso={c.uso ?? 'objeto'}
              valor={typeof params[c.id] === 'string' ? (params[c.id] as string) : (c.padrao as string)}
              aoMudar={v => { if (v) aoMudar(c.id, v); }}
            />
          ),
      )}
    </>
  );
}
