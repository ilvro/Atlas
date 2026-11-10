# Documentos da campanha (painel do Atlas) ✅

Plano técnico para execução por um agente de código. Escrito em 10/11/2026 contra o código do Atlas desse dia. Siga na ordem, um passo por vez. Rode as verificações do fim antes de dizer que terminou.

## 1. Contexto

- **Projeto:** `/home/ilvro/Documents/Projects/Atlas`, TypeScript `strict`, Preact + `@preact/signals`, CSS próprio em `src/ui/estilo.css`. Identificadores, comentários e textos da interface em **português**. Leia `Atlas/AGENTS.md` antes de começar.
- **Testes:** `node --test` com `fake-indexeddb` (veja `tests/unit/pistas.test.ts`). Comandos: `npm run typecheck` e `npm test`.
- **O painel de hoje:** o Atlas já tem **Mapa > Pistas** (`src/ui/Pistas.tsx`, aberto pelo `src/ui/Dock.tsx`, seção `{ id: 'pistas' }`). Ele lista os documentos do Ateliê lidos do banco de troca `mesa-handouts-v1` (`src/data/pistas.ts`: `listarPistas`, tipo `Pista`; `src/app/pistas.ts`: signals `pistas` e `pistasCarregadas`, `recarregarPistas`, `adicionarPista`). O Atlas só lê esse banco, nunca escreve nele.
- **O problema:** o painel mostra **todos** os documentos entregues ao Atlas, sem relação com a campanha ativa. E documentos da campanha que ainda não foram entregues (registrados como entidade, mas fora do banco de troca) não aparecem.
- **A campanha:** banco `mesa-campanha-v1`, acessado por `servicos.peek()?.campanhas` (interface `RepositorioCampanha` em `mesa-core/src/campanha.ts`). A campanha ativa é `campanhaAtiva` (`src/app/campanha.ts`). Um documento da campanha é uma **entidade** com um Ref `{ app: 'atelie', tipo: 'documento', id }`. Normalmente o tipo dela é `'pista'`, mas aceite qualquer tipo. Para montar e ler esse Ref, use `refDaPista(id)` e `idDaPista(ref)` (`src/data/pistas.ts`).
- **Regra de dono:** o Atlas pode **criar** entidades (elas saem com `criadaPor: 'atlas'`) e não altera nem remove as dos outros apps.

## 2. Objetivo

O painel passa a se chamar **Documentos** e ganha duas abas:

1. **Da campanha** (padrão quando há campanha ativa): os documentos que são entidades da campanha.
   - Com o documento no banco de troca: miniatura, nome, selo UV e "Pôr no mapa", como hoje.
   - Sem ele no banco de troca: sem miniatura, com o texto "Ainda não entregue ao Atlas" e o botão "Abrir no Ateliê".
2. **Todos:** a lista de hoje. Cada item tem o selo "Na campanha", se já é da campanha, ou o botão "+ Campanha", que cria a entidade.

Pôr no mapa um documento que ainda não é da campanha também o acrescenta à campanha.

## 3. Não fazer

- Evite mexer em `src/ui/Personagens.tsx`, `src/app/fichas.ts` e `mesa-core/`, que acabaram de mudar com o elenco da campanha (`docs/plano/elenco.md`). Só toque neles se for preciso, por exemplo para reaproveitar um padrão de carga ou de filtro. Se tocar no `mesa-core`, rode `npm run build:core` e copie o `dist/` para o `vendor/mesa-core/` de Mesa, Ateliê, Dossiê e Jukebox. Não mexa em outros projetos.
- Não escreva no banco `mesa-handouts-v1`.
- Não remova nem altere entidades criadas por outro app.
- Não mude o `id` da seção do Dock (`'pistas'`) nem os `data-testid` existentes (`pistas`, `pistas-vazio`, `pista-<id>`, `pista-por-<id>`). Só acrescente novos.
- Não commite.

## 4. Passos

### Passo 1: funções puras em `src/app/pistas.ts`

Acrescente, sem mudar o que já existe:

```ts
import type { Entidade } from '#mesa';

/** Um documento da campanha: a entidade e, se o Ateliê já o entregou ao Atlas, o resumo do banco de troca. */
export interface DocumentoDaCampanha { entidade: Entidade; idDoDocumento: string; pista: Pista | null }

/** As entidades da campanha que apontam para um documento do Ateliê, cruzadas com as pistas entregues. Ordem: nome (pt-BR, sem acento atrapalhar). Uma entidade com dois Refs de documento vale pelo primeiro. Duas entidades do mesmo documento: fica a primeira. */
export function documentosDaCampanha(entidades: readonly Entidade[], entregues: readonly Pista[]): DocumentoDaCampanha[]

/** Os ids de documento que já são da campanha (para o selo "Na campanha" na aba Todos). */
export function idsNaCampanha(docs: readonly DocumentoDaCampanha[]): Set<string>
```

Implementação: para cada entidade, ache o primeiro Ref em que `idDaPista(ref)` não é `null`. Monte um `Map` das pistas entregues por `id`. Ordene com `localeCompare(…, 'pt-BR', { sensitivity: 'base' })`.

### Passo 2: estado e carga em `src/app/pistas.ts`

```ts
/** Os documentos da campanha ativa (recarregados ao trocar de campanha, ao acrescentar e quando o Ateliê avisa). */
export const documentosDaCampanhaAtiva = signal<DocumentoDaCampanha[]>([]);

export async function recarregarDocumentosDaCampanha(servicos: Servicos | null): Promise<void>
```

- Sem campanha ativa ou sem `servicos?.campanhas`: a lista fica `[]`.
- Com campanha: `listarEntidades(campanhaId)` **sem** filtro de tipo, depois `documentosDaCampanha(entidades, pistas.peek())`.
- Envolva em `try/catch`, como o `carregar()` de `Personagens.tsx`: em caso de falha, `console.warn('Atlas: …', erro)` e lista vazia.
- Em `recarregarPistas()`, depois de atualizar `pistas`, recalcule `documentosDaCampanhaAtiva.value` a partir das **entidades já carregadas**, sem nova consulta ao banco. Para isso, guarde as últimas entidades num `let` do módulo.

### Passo 3: acrescentar à campanha em `src/app/pistas.ts`

```ts
/** Torna o documento parte da campanha: cria a entidade `pista` (criadaPor 'atlas') se ainda não há uma com esse Ref. Devolve a entidade (nova ou a que já existia). */
export async function acrescentarDocumentoNaCampanha(servicos: Servicos | null, p: Pick<Pista, 'id' | 'name'>, campanhaId?: string): Promise<Entidade | null>
```

- O `campanhaId` padrão é `campanhaAtiva.peek()?.id`. Sem campanha ou sem repositório, devolve `null`.
- Primeiro chame `entidadeDaRef(campanhaId, refDaPista(p.id))`. Se existir, devolva-a. Se não, `criarEntidade({ campanhaId, tipo: 'pista', nome: p.name, refs: [refDaPista(p.id)] })`.
- Depois chame `recarregarDocumentosDaCampanha(servicos)`.
- Em `adicionarPista(...)`, ao lado de `void ligarPistaAoComodo(...)`, chame `void acrescentarDocumentoNaCampanha(servicos, p, m.campanhaId ?? undefined)`. **Atenção à ordem:** a ligação `esta-em` não depende da entidade, então as duas podem rodar em paralelo.

### Passo 4: abrir no Ateliê

Para documentos da campanha que não estão no banco de troca, siga o padrão de `abrirFicha` em `src/app/fichas.ts` (linha ~142), sem editar esse arquivo:

- Primeiro peça `atelie.abrir` pelo barramento com `{ ref }`.
- Se não houver resposta, abra o Ateliê numa aba, pelo manifesto ou pelo caminho `../Atelie/?handout=<id>`, como `src/app/inspecao.ts` faz com `pista.source`.

Escreva a função em `src/app/pistas.ts` como `abrirDocumentoNoAtelie(barramento, ref)` (sem acento no identificador). Antes de escrever, leia `src/app/fichas.ts` (linhas 130–160) e `src/app/inspecao.ts` para copiar o padrão de aviso (`avisar`).

### Passo 5: interface em `src/ui/Pistas.tsx`

- **Signal local:** `const aba = signal<'campanha' | 'todos'>('campanha')`, no nível do módulo, como `busca` em `Personagens.tsx`. Sem campanha ativa, mostre direto a aba "Todos" e não mostre a escolha de abas.
- **Efeitos:**
  - mantenha `useEffect(() => { void recarregarPistas(); }, [])`;
  - acrescente `useEffect(() => { void recarregarDocumentosDaCampanha(servicos.peek()); }, [campanhaAtiva.value?.id])`.
- **Escolha de abas:** dois botões com `class="botao-pilula"` e `aria-pressed`, e `data-testid="documentos-aba-campanha"` e `data-testid="documentos-aba-todos"`.
- **Aba "Da campanha":**
  - Vazia: `<p class="dica" data-testid="documentos-campanha-vazio">Nenhum documento nesta campanha. Na aba Todos, use “+ Campanha”, ou ponha um documento no mapa.</p>`.
  - Item com `pista`: o mesmo markup do item de hoje (reuse um componente `ItemDePista` extraído do `map` atual), com `data-testid="documento-campanha-<idDoDocumento>"`.
  - Item sem `pista`: `<div class="pista pista-pendente">` com a miniatura vazia, `entidade.nome`, `<small>Ainda não entregue ao Atlas</small>` e o botão "Abrir no Ateliê" (`data-testid="documento-abrir-<id>"`). Ele não é arrastável.
- **Aba "Todos":** a lista atual. Em cada item:
  - se `idsNaCampanha(...)` tem o id, `<b class="pista-na-campanha">Na campanha</b>`;
  - se não tem e há campanha ativa, o botão `+ Campanha` (`data-testid="pista-campanha-<id>"`), que chama `acrescentarDocumentoNaCampanha`.
- **Texto de vazio da aba Todos:** troque "neste navegador" por "neste aparelho", porque o app de desktop também usa esse painel.
- **`Dock.tsx`:** mude só o `titulo` da seção `pistas` de `'Pistas'` para `'Documentos'`. Procure outros lugares que mostram "Pistas" ao usuário referindo-se a esse painel (`grep -rn "'Pistas'\|>Pistas<" src/ui`) e ajuste só os textos visíveis.

### Passo 6: CSS em `src/ui/estilo.css`

Logo depois das regras `.pista*` (linha ~2086), acrescente regras curtas usando as variáveis existentes (`var(--linha)`, `var(--corpo)`):

- `.pistas-abas { display: flex; gap: 6px; margin-bottom: 6px; }`
- `.pista-pendente { cursor: default; opacity: .8; border-style: dashed; }`
- `.pista-pendente small { display: block; font: 500 11px var(--corpo); opacity: .7; }`
- `.pista-na-campanha { font: 700 10px var(--corpo); letter-spacing: .04em; text-transform: uppercase; opacity: .75; }`

Não invente cores novas.

### Passo 7: testes em `tests/unit/documentos-da-campanha.test.ts`

Use `node:test` e `assert/strict`, como `tests/unit/pistas.test.ts`. Teste as funções puras e o acréscimo com um repositório falso, um objeto com `listarEntidades`, `entidadeDaRef` e `criarEntidade` em memória.

1. `documentosDaCampanha`:
   - cruza entidades com pistas entregues;
   - o documento sem pista fica com `pista: null`;
   - ignora entidades sem Ref do Ateliê;
   - ordena por nome sem diferenciar acento;
   - dedupe por documento.
2. `idsNaCampanha` devolve os ids.
3. `acrescentarDocumentoNaCampanha`:
   - cria a entidade `pista` com o Ref certo;
   - chamar duas vezes não duplica;
   - sem campanha devolve `null` e não chama `criarEntidade`.

Para `Servicos`, monte só o mínimo (`{ campanhas: repoFalso } as unknown as Servicos`).

## 5. Verificação (obrigatória)

```bash
cd /home/ilvro/Documents/Projects/Atlas
npm run typecheck
npm test
```

As duas precisam passar sem erros. Depois, confira à mão com `npm run mesa-dev`, Atlas > Mapa > **Documentos**:

- com campanha ativa, a aba "Da campanha" aparece;
- "+ Campanha" na aba Todos move o documento para a aba da campanha, e ele aparece também na coleção da Mesa como pista;
- pôr no mapa um documento de fora da campanha o acrescenta à campanha.

## 6. Ao terminar

- Em `progress.md`, acrescente uma linha curta, no estilo das outras, numa seção "Documentos da campanha" no fim do arquivo.
- Neste arquivo, marque o título com ✅ e acrescente uma "Nota:" curta sobre o que divergiu do plano.
- Sugira a mensagem de commit: `campaign documents in the atlas documents panel`.

Nota: nenhuma divergência em relação às especificações do plano. Passos 1 a 7 implementados e testados integralmente.
