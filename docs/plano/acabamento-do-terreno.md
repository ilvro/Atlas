# Frente I — Acabamento do terreno e dos edifícios

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas** (render e procedural). Quem implementa: Gemini.

## O que estamos tentando fazer

Mesmo com telhados, relevo e edifícios bons, três defeitos de acabamento fazem o mapa parecer colagem. Todos aparecem em "Lysdal · a vila (neve)":

1. **O edifício não toca o chão.** A casa termina numa linha seca sobre a neve intacta. Num lugar habitado, em volta da casa há chão pisado, neve suja, uma soleira na porta e sombra junto das paredes de fora. Hoje as paredes externas só têm o traço escuro.
2. **O maciço grande vira camuflagem.** Em áreas grandes de rocha (as laterais do mapa de Lysdal), o interior fica coberto de manchas cinza e brancas no mesmo tamanho, sem leitura de montanha. A causa está em `src/procedural/macico.ts`: a altura é a distância à borda saturada em `ALTURA_DO_MACICO + 0,5` m, mais lóbulos de ruído de frequência fixa (`fbm(rGrande, mx * 0.34, …)` com amplitude 1,15), quantizados em 5 patamares. Perto da borda isso desenha bem a encosta; a 20 m da borda, só sobram os lóbulos, todos do mesmo tamanho.
3. **O que está ao ar livre não sente o clima.** Com neve caindo, o pátio, a varanda e o alpendre continuam com o piso limpo.

**Meta:** os edifícios assentam no chão, os maciços grandes leem como serra, e o tempo marca o que está ao ar livre. Tudo isso é **derivado** (calculado no render ou no bake a partir do documento), sem campo novo no documento.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| I1 | Chão pisado e soleira em volta dos edifícios | procedural + render |
| I2 | Sombra de contato do lado de fora das paredes | render |
| I3 | Maciço grande com leitura de serra | procedural |
| I4 | Neve e chuva no que está ao ar livre | procedural + render |

Ordem: qualquer. I1 depois de F1, se a frente F estiver em andamento (o aro respeita os patamares).

---

### I1 — Chão pisado e soleira em volta dos edifícios  ✅
Objetivo: a casa assenta no terreno com um aro de uso e uma soleira em cada porta externa.
Depende de: —.
Ler: `src/render/entradas.ts` (`entradaDoTerreno`, `chaveDoTerreno`), `src/procedural/assar.ts` (`assarTerreno`: como as camadas são pintadas com borda torcida e aro), `src/domain/edificios.ts`, `src/domain/geometria.ts` (aberturas e as paredes onde estão).
Arquivos: mudar `entradas.ts`, `assar.ts`; e2e em `tests/e2e/acabamento.test.ts` (novo).
Como:
1. `EntradaDeTerreno` ganha `assentamento?: { celulas: Faixa[]; material: string; soleiras: { centro: Ponto; normal: Ponto; largura: number }[] }`:
   - `celulas`: a dilatação de 0,75 m (3 células de 0,25 m) das células de todos os cômodos cobertos do térreo, menos as próprias células dos cômodos;
   - `material`: escolhido pela base do terreno sob o edifício: neve ou neve funda → `neve.pisada` (frente E; até lá, `neve` escurecido); grama → `terra`; terra ou areia → nenhum (sem aro); calçamento → nenhum;
   - `soleiras`: uma por porta externa (abertura `door` ou `arch` em parede com cômodo de um lado só), centrada na porta, do lado de fora.
2. Em `assarTerreno`, depois das camadas: pinte o aro com o material, com alfa que cai de 0,85 na parede a 0 na borda externa e com a borda torcida por ruído (o mesmo das camadas). Cada soleira é uma laje de pedra de largura da porta + 0,3 m e 0,5 m de fundo, mais um leque de chão gasto de 1,5 m saindo dela.
3. A chave do terreno inclui o assentamento.
4. Desligável: `Estilo.settle?: boolean` (padrão `true`; documentado como opcional, sem migração). Na interface, um interruptor "Assentar edifícios" na seção de estilo do mapa.
Testes (e2e): uma casa na neve: o pixel a 0,3 m da parede externa é mais escuro que o pixel a 3 m; a soleira aparece na frente da porta; com `settle: false`, a diferença some.
Pronto quando: as casas de Lysdal parecem habitadas, com o chão pisado em volta e as soleiras.
Commit: `buildings settle into terrain with trodden ground and thresholds`

### I2 — Sombra de contato do lado de fora das paredes  ⬜
Objetivo: a parede externa tem volume: sombra suave no chão do lado de fora.
Depende de: —.
Ler: `src/render/cena.ts` (`desenharParedes`, `desenharParede`, a ordem dos containers em `raiz.addChild`), `src/render/sombras-do-sol.ts` (se a parede já projeta sombra com o sol; não duplique).
Arquivos: mudar `cena.ts` (ou um módulo novo `src/render/contato-externo.ts`); e2e.
Como: para as paredes derivadas de cômodos que têm o lado de fora livre (aresta sem cômodo do outro lado), um traço de 0,35 m de largura deslocado 0,2 m para fora, preto com alfa 0,28 e desfoque de 4 px no Ilustrado (uma faixa dura de 2 px no Pixel), num container abaixo de `objetosC` e acima do terreno. Não desenhe sob portas abertas. Com sombra do sol ativa, reduza o alfa para 0,15 (a sombra do sol já escurece um lado).
Testes (e2e): o pixel logo fora da parede é mais escuro que o pixel a 2 m, com o sol desligado.
Pronto quando: as paredes de fora deixam de parecer um traço chapado.
Commit: `outer walls get contact shadow`

### I3 — Maciço grande com leitura de serra  ⬜
Objetivo: maciços grandes leem como montanha, com cristas e vales grandes, e não como camuflagem.
Depende de: —.
Ler: `src/procedural/macico.ts` inteiro (`sombrearMacico`, as constantes do topo), `src/procedural/profundidade.ts` (`distanciaAMargem`, `PROFUNDIDADE_MAXIMA`), `src/procedural/assar.ts` (onde o maciço é chamado), `tests/unit/` (procure testes do maciço) e as capturas dos exemplos da Fase 10 com maciço (gruta, entreposto).
Arquivos: mudar `macico.ts` e, se precisar, `profundidade.ts`; teste unitário de métrica e e2e de captura.
Como:
1. Calcule uma segunda distância à margem **sem saturação curta** (ou saturada em 30 m): `distLonga`.
2. A altura bruta passa a ter três termos: (a) a encosta perto da borda, como hoje (até `ALTURA_DO_MACICO`); (b) uma **crista** que cresce com `distLonga` (por exemplo `0,35 × suave(2, 25, distLonga)`), que faz o miolo subir em direção a uma linha de cumeada; (c) os lóbulos de ruído com **frequência inversa ao tamanho**, ou seja, `fbm` com escala `0,34 / (1 + distLonga / 12)` e amplitude que cai de 1,15 na borda para 0,5 no miolo profundo.
3. No miolo profundo (`distLonga` > 12 m), as estrias seguem a direção do gradiente de `distLonga` desfocado (descendo da cumeada para as bordas), o que desenha vales e esporões em vez de manchas.
4. Mantenha o resultado de maciços pequenos (até ~8 m de largura) praticamente igual ao de hoje: os exemplos da Fase 10 não podem mudar de cara. Compare as capturas antes e depois.
5. Métrica para o teste: num maciço de 60 × 40 m, conte as transições de patamar ao longo de uma linha horizontal no miolo. Hoje são muitas e curtas; depois, menos e mais longas (média de trechos ≥ 3 m). Meça hoje, fixe o alvo no teste e anote os números na ficha.
Testes: a métrica acima; a mesma semente dá o mesmo resultado; num maciço de 6 × 6 m, a diferença média de pixels contra a versão anterior fica abaixo de um limiar pequeno (gere a referência antes de mudar).
Pronto quando: as laterais de "Lysdal · a vila (neve)" leem como serra nevada, e a gruta e o entreposto da Fase 10 continuam iguais a olho.
Commit: `large rock masses read as ridges instead of camouflage`

### I4 — Neve e chuva no que está ao ar livre  ⬜
Objetivo: com neve, o que está ao ar livre embranquece; com chuva, fica molhado.
Depende de: —.
Ler: `src/render/mascara-de-comodos.ts` (onde chuva e neve sabem o que é coberto), `src/domain/presets.ts` (`FUNCOES_AO_AR_LIVRE`), `src/render/cena.ts` (o que reage a `climate.weather`), `src/render/agua.ts` (o brilho de superfície molhada, se houver algo reaproveitável).
Arquivos: criar `src/render/tempo-no-chao.ts`; mudar `cena.ts`; e2e.
Como:
1. Áreas ao ar livre: cômodos sem `roof.material` ou com função em `FUNCOES_AO_AR_LIVRE`, e objetos de piso fora de cômodos cobertos com tags de móvel (banco, mesa, carroça, barril, caixote).
2. Neve (`weather.snow` > 0,2): sobre os pisos ao ar livre, uma textura de neve (o material `neve` do terreno) com alfa `0,7 × snow`, com borda irregular e mais acumulada junto das paredes (use a distância à parede); sobre os objetos, um "chapéu" de neve (a silhueta do sprite deslocada −0,05 m em y, tingida de branco, com alfa `0,6 × snow`, recortada por cima). Recalcule só quando o clima ou o mapa mudarem.
3. Chuva (`weather.rain` > 0,3): os pisos ao ar livre escurecem 15% e ganham um brilho especular fraco (um véu claro de alfa 0,08 com ruído).
Testes (e2e): uma varanda com neve 0,8 fica mais clara que com neve 0; um banco ao ar livre ganha o chapéu de neve.
Pronto quando: o pátio da igreja de Lysdal fica branco com a neve caindo.
Commit: `weather marks open-air floors and props`
