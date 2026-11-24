# Viewport único entre abas

## Contexto

Hoje `AreaDoMapa` em `src/ui/Editor.tsx` recria o `Viewport` inteiro (`criarViewport` → `new Application()` + `app.init()`) sempre que a sessão `s` muda. Embora os workers de assado já sejam reaproveitados e o `destruir()` libere os recursos globais do Pixi, trocar de aba ou abrir vários mapas ainda cria e destrói contextos WebGL, o que gera lentidão na troca e pressão de GPU/navegador após abrir várias abas.

A solução é manter um único `Application` (e o mesmo `baker`) vivo enquanto o editor estiver montado, trocando apenas a ponte/sessão e a `Cena` ao mudar de aba.

---

### V1 — Separar o ciclo de vida do `Application` do ciclo de vida do mapa  ⬜
Objetivo: manter um único `Application` e `Baker` no editor, trocando apenas a cena e a ponte ao alternar entre abas de mapa.
Depende de: —
Ler: `src/render/viewport.ts`, `src/ui/Editor.tsx` (`AreaDoMapa`), `src/render/cena.ts`, `src/render/eventos-de-cena.ts`, `src/render/retratos.ts`, `src/render/fantasma-proposta.ts`, `src/render/linhas-de-nivel.ts`.
Arquivos: mudar `src/render/viewport.ts`, `src/ui/Editor.tsx`.
Como:
- Em `src/render/viewport.ts`:
  - Trocar `ponte` e `store` de `const` para `let` mutáveis (`ponteAtual`, `store`) usadas por todos os helpers e callbacks do viewport (`completo()`, `andarAtual()`, `acabamento()`, `capturar`, handlers de ponteiro, teclado e `aoQuadro`).
  - Adicionar `trocarMapa(novaPonte: PonteViewport): void` à interface `Viewport`.
  - Extrair `desconectarMapa()`: incrementar um contador `geracao` (para descartar callbacks assíncronos de `lerRetrato` em voo), cancelar `rafArrastoPeca`, cancelar qualquer `interacao` ativa (chamando `gesto.cancelar()` se houver), limpar `regua` e `camAnim`, chamar `cancelarAssinatura()`, resetar `transicao` (`pararTransicao()`), `exibido`, `tremorAtual`, `eventos` e `clarao`, limpar `fantasmaSprite`, `fantasmaDaProposta`, `linhasDeNivel` e `retratos.limpar()`, destruir `cena` (`cena.destruir()`) e remover `cena.raiz` de `mundo`.
  - Extrair `conectarMapa(novaPonte: PonteViewport)`: atualizar `ponteAtual` e `store`, recriar `cena = criarCena({ baker, renderer: app.renderer, ... })` reinserindo `cena.raiz` em `mundo` na posição original (entre `area_` e `pixelizacao.sprite`), reiniciar `vistoDoDoc`, `ultimoAndar`, `ultimoConstruir`, `duracaoDaTransicao` e `ultimoAlinhandoGrade`, assinar `store.assinar(aoEvento)`, aplicar `cena.definirModoProjetor(somenteLeitura)` e `cena.definirVista(...)`, rodar `redesenharTudo()` e aplicar `novaPonte.cameraInicial` (ou `enquadrarMapa()`).
  - Fazer `trocarMapa(novaPonte)` chamar `desconectarMapa()` e `conectarMapa(novaPonte)` (ignorando se `destruido`); fazer `destruir()` chamar `desconectarMapa()` antes de encerrar `baker`, `pixelizacao`, `app.ticker` e `app.destroy(...)`.
- Em `src/ui/Editor.tsx` (`AreaDoMapa`):
  - Criar o `Viewport` apenas na montagem (`useEffect(..., [])`) e destruí-lo apenas na desmontagem, guardando em uma ref a sessão `s` mais recente para tratar trocas de aba que ocorram enquanto `criarViewport` (`await app.init()`) ainda está pendente.
  - Em `useEffect(..., [s])`, quando o viewport já existir, chamar `vp.trocarMapa(ponteDa(s))`, `vp.atualizarSobreposicoes()` e `focarNoComodo()`.
Não fazer: não alterar `src/ui/Projetor.tsx` (que roda em janela própria com um único mapa) nem `src/procedural/baker.ts`; não mexer no comportamento de `somenteLeitura`.
Testes: `npm run typecheck`, `npm test` e teste unitário/e2e garantindo que `trocarMapa` limpa interações/eventos em andamento, troca a `store` assinada sem vazar listeners e mantém um único `Application` ao alternar entre 3+ mapas.
Pronto quando: alternar entre múltiplos mapas no editor mantém apenas 1 contexto WebGL ativo, sem vazamento de estado visual, gestos, retratos ou assinaturas da aba anterior.
Commit: (performance) reuse single Pixi Application across map tabs
