# Pendências da Fase 3

Independentes entre si e da Fase 4; podem entrar em qualquer momento. As transições automáticas entre terrenos (3.1) ficam na tarefa 5.4 (espalhamento), onde o mesmo código de máscara é usado.

### P3a — Cartela de título editável  ⬜
Objetivo: o mestre liga, escreve e posiciona a cartela de título pela aba Mapa do inspetor.
Depende de: —
Ler: `src/ui/Inspetor.tsx` (`PainelDoMapa`, `CorDoFundo`); `src/domain/presets.ts` (`posicaoDeTitulo`); `src/render/cena.ts` (`sincronizarTitulo`).
Arquivos: mudar `src/ui/Inspetor.tsx`.
Como:
1. Na seção Mapa do `PainelDoMapa`, uma caixa "Cartela de título". Ligar executa `fundo.atualizar` com `title: { text: m.name, font: 'Cinzel', position: posicaoDeTitulo(m.bounds.width, m.bounds.height, 'inferior-direito') }`; desligar, `title: null`.
2. Ligada: campo de texto (confirma ao sair/Enter) e `CampoOpcoes` de posição com as cinco opções de `posicaoDeTitulo`; o comprimento estimado é `texto.length * 0.45 + 1`.
3. Rótulos de histórico: "Cartela de título".
Não fazer: arrastar a cartela no mapa; fontes diferentes.
Testes: e2e opcional; unitário não precisa (só interface sobre comando existente).
Pronto quando: ligar, editar e desligar a cartela aparece no mapa e cada mudança é uma entrada de histórico.
Commit: edit title card in inspector

### P3b — Fundo por textura  ⬜
Objetivo: `backdrop.kind: 'texture'` desenha um material procedural atrás dos cômodos.
Depende de: —
Ler: `src/render/viewport.ts` (`desenharBase`); `src/render/cena.ts` (`sincronizarTerreno`, como pede textura ao baker); `src/procedural/materiais.ts` (`materiaisDo('terreno')`).
Arquivos: mudar `src/render/cena.ts`, `src/ui/Inspetor.tsx`.
Como:
1. Em `cena.ts`, um `fundoC` antes de `terrenoC`: com `kind === 'texture'` e `material`, um `TilingSprite` do tamanho de `bounds`, textura vinda do baker como o terreno base faz; com `solid`, vazio.
2. Ressincronizar quando `campos('backdrop', 'bounds')`.
3. No inspetor, ao lado de `CorDoFundo`: opções "Cor" / "Textura" e, em textura, `materiaisDo(...)` de terreno (reaproveite `CampoMaterial` de `ui/campos-material.tsx`).
Não fazer: textura no projetor (Fase 7).
Testes: unitário de validação aceitando `kind: 'texture'` com material; captura manual.
Pronto quando: escolher "Textura → pedra" muda o fundo ao vivo e desfaz.
Commit: textured map backdrop

### P3c — Parâmetros da receita no inspetor  ⬜
Objetivo: depois de pôr um objeto, o inspetor edita os parâmetros da receita (hoje só "Variar").
Depende de: —
Ler: `src/ui/Biblioteca.tsx` (como os parâmetros aparecem antes de pôr); `src/procedural/receitas.ts` (definição dos parâmetros); `src/ui/Inspetor.tsx` (`CamposDoObjeto`).
Arquivos: mudar `src/ui/Inspetor.tsx`; extrair os campos de parâmetro da Biblioteca para `src/ui/campos-receita.tsx` se forem reaproveitados.
Como: para `source.kind === 'recipe'`, renderizar os mesmos campos da Biblioteca (linhas com `CampoNumero`/`CampoMaterial` em `Biblioteca.tsx`); cada mudança executa `item.atualizar` em `props` com `source.params` novo (rótulo "Ajustar objeto"); arrastar um controle deslizante é um gesto (uma entrada).
Não fazer: trocar a receita de um objeto já posto.
Testes: unitário de comando atualizando `source.params` e revalidando.
Pronto quando: mudar a cor/tamanho de uma mesa posta redesenha só ela e desfaz numa entrada.
Commit: edit recipe params in inspector

### P3d — Ligações do cômodo com a campanha  ⬜
Objetivo: o cômodo ganha `refs` escolhidos entre as entidades da campanha ativa.
Depende de: —
Ler: `src/app/campanha.ts`; `mesa-core/src/campanha.ts` (`listarEntidades(campanhaId)`); `src/state/comandos-construir.ts` (`comodo.notas`); PLATAFORMA.md §4.
Arquivos: mudar `src/state/comandos-construir.ts`, `src/ui/Inspetor.tsx` (`CamposDoComodo`), `src/app/campanha.ts`.
Como:
1. `comodo.notas` passa a aceitar `refs` no patch (ou comando `comodo.refs`), validado como lista de `Ref`.
2. No inspetor do cômodo: lista dos refs (chip com nome da entidade) e botão "Ligar…" que abre busca nas entidades da campanha ativa (sem campanha: botão desabilitado com dica).
3. Remover um ref é um clique no chip.
Não fazer: abrir o documento ligado em outro app (Fase 9).
Testes: unitário do comando com refs válidos e inválidos.
Pronto quando: ligar uma entidade, recarregar e ela continua no cômodo.
Commit: link rooms to campaign entities
