> resumo: criar e testar um momento (sequência curta de passos de cena).

## Momentos

Um momento é uma sequência curta de passos de cena que o mestre toca na sessão: abrir uma cena, revelar um lugar, um susto. Crie com `atlas_momento` (`nome`, `cor`, `passos`; com `id` refaz um momento seu). Mantenha-os curtos e com propósito: poucos passos, ritmo dado por passos de `esperar`, um efeito de cada vez. Ids de câmera, revelar, interagir e peças vêm de `atlas_mapa_ler`; confira os tipos de passo em `atlas_catalogo { parte: "momentos" }`.

Teste sempre com `atlas_momento_testar` (toca na aba, de verdade) e ajuste o que ficou longo, rápido ou confuso. Diga ao mestre o que o momento faz em uma frase; ele decide se fica.

### Passos de momento

- `tela`: `{ tipo: "tela", acao: "escurecer" | "clarear", ms?: number }`
- `letreiro`: `{ tipo: "letreiro", texto: string, subtitulo?: string, ms?: number }`
- `camera`: `{ tipo: "camera", alvo: { colecao: "rooms" | "tokens" | "regions", id: string } }`
- `revelar`: `{ tipo: "revelar", ids: string[] }` — revela cômodos e/ou regiões `kind: 'reveal'`
- `luz`: `{ tipo: "luz", ids: string[], acao: "ligar" | "desligar" | "alternar" }` — ids de luzes ou de objetos donos de luz
- `objeto`: `{ tipo: "objeto", ids: string[], acao: "mostrar" | "esconder" }` — revela ou esconde objetos marcados como `oculto`
- `agua`: `{ tipo: "agua", poligono: [number, number][], material: string, ms: number, etapas?: number, acao?: "subir" | "baixar", deixar?: string }` — sobe a água progressivamente em anéis concêntricos (do centro para a borda). Com `acao: "baixar"` ela recua da borda para o centro; `deixar` (material de chão, só em `baixar`, ex.: `lama`) é o que fica onde a água estava, e sem ele a água devolve o terreno que cobriu (grama, lama, areia em camadas; onde não havia nada, aparece a base). Só as células que hoje são dessa água mudam. Para uma enxurrada que inunda e recua: um passo `agua` subindo, um `esperar` e um `agua` baixando com o mesmo polígono e `deixar` de lama. Um momento inteiro é um passo de desfazer (um passo avulso também); se o mestre fizer outro comando no meio da execução, a fusão se quebra. `atlas_desfazer` desfaz o teste de um momento que mexe no terreno
- `clima`: `{ tipo: "clima", clima: string }`
- `som`: `{ tipo: "som", ref: Ref }`
- `silencio`: `{ tipo: "silencio", ms?: number }`
- `efeito`: `{ tipo: "efeito", efeito: string }`
- `interagir`: `{ tipo: "interagir", id: string }`
- `esperar`: `{ tipo: "esperar", ms: number }`
- `pista`: `{ tipo: "pista", ref: Ref, mostrar: boolean }`
- `nota`: `{ tipo: "nota", texto: string }`


