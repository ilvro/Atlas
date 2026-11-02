# Atlas

- Leia docs/VISAO.md, docs/ARQUITETURA.md e docs/ROADMAP.md antes de implementar. Uma fase por vez.
- Não commite. Ao fim de cada fase, resuma o que foi implementado, a validação e as pendências.
- Mantenha progress.md atualizado: concluído, em andamento, validação e pendências reais.
- O documento do mapa guarda significado (cômodos, paredes, receitas, IDs de assets), nunca pixels de objetos. Toda automação produz entidades comuns e editáveis.
- O app tem de ser completo só com a coleção da casa (procedural + public/colecao/). Todo asset achado tem licença que permite redistribuir e entra em docs/LICENCAS.md. Importações do mestre ficam em data-private/ ou no IndexedDB: nunca no git, em public/ ou em dist/.
- docs/referencias/ é só para consulta interna; nada dali vai para o build.
- Um asset é descrito uma vez (descrição de desenho); os renderizadores Ilustrado e Pixel o interpretam. Não crie versões separadas por estilo, exceto `pixelSrc` manual opcional para imagens.
- O Atlas é para mapas de qualquer gênero; horror é um clima (luz, paleta, acabamento), não um padrão fixo.
- `src/domain` não importa render, UI nem Pixi. Construção inteligente e sessão produzem comandos ou propostas.
- Código adaptado do Tabletop, da Ficha ou do Ateliê é copiado e ajustado; não importe entre projetos.
- Integrações passam pelo contrato da mesa (docs/PLATAFORMA.md): Refs, banco `mesa-campanha-v1`, barramento `mesa:eventos`, manifesto, tema. Nada de pontes ponto a ponto novas.
- Não altere Ficha, Ateliê, Jukebox ou Tabletop sem autorização do usuário. Contratos existentes não mudam sem mudar os dois lados.
