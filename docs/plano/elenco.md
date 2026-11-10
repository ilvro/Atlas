# Elenco da campanha

"Cada campanha com os seus personagens." Planejado em 10 de novembro de 2026.

**Problema:** o Dossiê não sabe a que campanha cada ficha pertence. Por isso publica todas as fichas na campanha ativa (`Dossie/src/mesa.js`, `sincronizar`), e o painel Mapa > Personagens do Atlas mostra os personagens de todas as campanhas.

**Decisão:** o Dossiê continua publicando tudo, e a **Mesa escolhe o elenco** da campanha. O painel do Atlas mostra só o elenco. As ameaças (monstros) continuam todas.

## Decisões (não rediscutir na implementação)

- **Onde fica:** `Campanha.elenco?: string[]`, uma lista de ids de entidades `personagem`. O campo fica na campanha, e não nas entidades, porque as entidades são do Dossiê e a regra de dono não deixa a Mesa marcá-las. O campo é opcional e entra no contrato do `mesa-core` (`validarCampanha` aceita o campo; ids repetidos ou que não são texto são recusados).
- **Campanha sem `elenco`** (nunca configurada) mostra todos os personagens, como hoje, mais o aviso "Escolha o elenco na Mesa". Com o elenco definido, mesmo vazio, vale só o elenco.
- **Ficha apagada no Dossiê:** a entidade some e o id fica sobrando no elenco. Quem lê ignora ids sem entidade, e a Mesa os poda ao salvar.
- **Ameaças** não entram no elenco: aparecem todas, como hoje.
- **`vendor`:** como o contrato muda, copiar o `mesa-core` novo para Mesa, Ateliê, Dossiê e Jukebox. Um app com a cópia antiga recusaria salvar uma campanha com `elenco`.

## Tarefas

### E1 — Contrato e Mesa: escolher o elenco  ✅
Objetivo: na Mesa, o mestre marca quais personagens do Dossiê fazem parte da campanha, e o assistente também consegue mexer no elenco.
Ler: `mesa-core/src/campanha.ts` (`Campanha`, `validarCampanha`, `salvarCampanha`), `docs/PLATAFORMA.md` §4, `../Mesa/src/app/campanha.ts`, a tela da campanha e a coleção da Mesa (`../Mesa/src/ui/`), `../Mesa/src/app/ponte-escrita.ts`.
Arquivos: `mesa-core/src/campanha.ts` e os testes de contrato, `docs/PLATAFORMA.md`; na Mesa, `src/app/campanha.ts`, a tela da campanha, `src/app/ponte-escrita.ts`, `src/app/ponte.ts` e os testes; `npm run build:core` e copiar para o `vendor/` de Mesa, Ateliê, Dossiê e Jukebox.
Como:
- **Contrato:** `elenco?: string[]` em `Campanha`. Documentar em PLATAFORMA §4.
- **Mesa:**
  - Na tela da campanha, uma seção "Elenco" com os personagens que têm ficha (entidades `personagem` com Ref `ficha`), cada um com retrato, nome e um botão para entrar ou sair. Os do elenco aparecem primeiro.
  - Enquanto a campanha não tem elenco, um botão "Definir elenco" cria a lista vazia.
  - Na coleção, um filtro "só o elenco" para os personagens.
- **Assistente:** `mesa_elenco { acrescentar?: string[], remover?: string[] }`, com id, ref ou nome, devolvendo o elenco com nomes. `mesa_elenco_ler` lista o elenco e os personagens fora dele.
- **Instruções:** ao criar uma ficha de personagem com `dossie_ficha_criar` para a campanha, pôr no elenco.
Testes: o contrato aceita `elenco` e recusa ids repetidos ou que não são texto; entrar e sair do elenco; podar ids sem entidade; `mesa_elenco` por nome.
Commit: campaign cast chosen in mesa

### E2 — Atlas: o painel mostra o elenco  ⬜
Objetivo: Mapa > Personagens mostra só os personagens do elenco da campanha ativa.
Depende de: E1
Ler: `src/ui/Personagens.tsx` (`carregar`, a lista), `src/app/fichas.ts` (`personagensComFicha`), `src/app/campanha.ts` (como lê a campanha ativa e quando atualiza).
Arquivos: `src/app/fichas.ts` (função pura `personagensDoElenco(entidades, campanha)`), `src/ui/Personagens.tsx` e os testes.
Como:
- **Com elenco:** só os personagens dele, na ordem do elenco.
- **Sem elenco:** todos, como hoje, com uma linha discreta "Escolha o elenco na Mesa", que abre a Mesa pelo manifesto como os outros atalhos do Atlas.
- **Atualização:** a lista acompanha a mudança do elenco feita na Mesa (o mesmo gatilho que já recarrega o painel quando a campanha muda; conferir se ele dispara com `salvarCampanha` ou se precisa de um evento).
- **Ameaças:** como estão.
Testes: `personagensDoElenco` com elenco, sem elenco, com id órfão e na ordem do elenco.
Pronto quando: com o elenco "Henrike e Muirenn" definido na Mesa, o painel do Atlas mostra só os dois, e as ameaças continuam todas.
Commit: atlas characters panel shows the campaign cast
