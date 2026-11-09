# Atlas

- Uma tarefa por vez, pela ficha em docs/plano/fase-N.md (como trabalhar: docs/plano/README.md). Leia a ficha, os arquivos que ela cita e este arquivo; VISAO, ARQUITETURA e ROADMAP só quando a ficha mandar ou para planejar uma fase.
- Não decida arquitetura fora da ficha. Se a ficha não bate com o código, pare e reporte.
- Para cada mudança é feito um commit. Ao fim de cada tarefa: typecheck e testes passando, ficha marcada ✅ e uma linha no progress.md.
- Opus planeja (fichas em docs/plano/) e delega a implementação ao Sonnet (esforço medium), uma tarefa por subagente; o Opus só implementa direto quando o usuário pedir (ex.: mapas de exemplo). Ver ../CLAUDE.md.
- Ao fim de cada fase, resuma no progress.md o que foi implementado, a validação e as pendências reais.
- O documento do mapa guarda significado (cômodos, paredes, receitas, IDs de assets), nunca pixels de objetos. Toda automação produz entidades comuns e editáveis.
- O app tem de ser completo só com a coleção da casa (procedural + public/colecao/). Todo asset achado tem licença que permite redistribuir e entra em docs/LICENCAS.md. Importações do mestre ficam em data-private/ ou no IndexedDB: nunca no git, em public/ ou em dist/.
- docs/referencias/ é só para consulta interna; nada dali vai para o build.
- Um asset é descrito uma vez (descrição de desenho); os renderizadores Ilustrado e Pixel o interpretam. Não crie versões separadas por estilo, exceto `pixelSrc` manual opcional para imagens.
- O Atlas é para mapas de qualquer gênero; horror é um clima (luz, paleta, acabamento), não um padrão fixo.
- TypeScript `strict` e Preact com signals. O mapa é Pixi puro, fora do Preact; componentes leem o store por signals e alteram só por comandos. CSS próprio, sem Tailwind.
- `src/domain` não importa render, UI nem Pixi. Construção inteligente e sessão produzem comandos ou propostas.
- Código adaptado do Tabletop, da Ficha ou do Ateliê é copiado e ajustado; não importe entre projetos.
- Integrações passam pelo contrato da mesa (docs/PLATAFORMA.md): Refs, banco `mesa-campanha-v1`, barramento `mesa:eventos`, manifesto, tema. Nada de pontes ponto a ponto novas.
- Não altere Ficha, Ateliê, Jukebox ou Tabletop sem autorização do usuário. Contratos existentes não mudam sem mudar os dois lados.
