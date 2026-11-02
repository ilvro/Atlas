# Atlas — identidade da interface

Data: 2 de novembro de 2026. Como o Atlas deve parecer e responder. A referência é a **Ficha Ordem II** (`../Ficha teste - Ordem II`): o que faz a Ficha parecer um jogo é ser **fluida** e **integrada**, com muita qualidade de vida e interação em cada canto. Leia junto com [VISAO.md](VISAO.md).

## 1. O que a Ficha faz e o Atlas herda

Observado nas telas da Ficha (visões Vigília e Ordem 2 cinematográfica) e no código (`src/styles.css`, `src/app.js`, `src/systems/vigilia/vigilia-view.js`, `src/fx/`).

| Padrão da Ficha | Como aparece | No Atlas |
| --- | --- | --- |
| **Rótulos em faixa rasgada** | "ATRIBUTOS", "PERÍCIAS", "HABILIDADES" em faixas com `clip-path` irregular | Títulos de painel, de seção do inspetor e da ferramenta ativa |
| **Cor de destaque por tema** | `--cinematic-accent`; vermelho no Ordem 2, prata com moldura celta na Vigília | `--accent` trocável por campanha; o mapa e a interface podem ter acentos diferentes |
| **Títulos grandes em serifa** | Nome do personagem enorme, em caixa alta, com sombra | Nome do mapa e do cômodo selecionado em destaque; cartela na apresentação |
| **Moldura irregular** | `.cinematic-frame` com cortes e cantos em L; moldura ornamentada na Vigília | Moldura da área do mapa no modo Sessão e no projetor |
| **Ícones de dado facetados** | d4/d6/d8/d20 em SVG dentro do texto e nos botões | Ícones próprios das ferramentas e dos objetos no mesmo traço facetado |
| **Ações dentro do conteúdo** | Botões "Curar com Bálsamo (2d4 PV)" dentro da descrição da habilidade | Ações dentro do cartão do que está selecionado: "Mobiliar como cozinha", "Acender luzes", "Abrir porta" |
| **Pips e barras segmentadas** | PV/PD e Ímpeto como quadradinhos editáveis | PV/PD dos tokens, intensidade da presença, carga de lanterna |
| **Dock flutuante** | "+ PAVOR", "LESÕES", "TRAUMAS" como pílulas no canto | Dock da sessão: clima, eventos de cena, iniciativa, projetor |
| **Transições com glitch** | Troca de ficha com glitch e som | Troca Construir ↔ Sessão e troca de clima com transição própria (tinta ou glitch, por tema) |
| **Toasts** | Mais de duzentas mensagens curtas | Toast com **Desfazer** em toda ação automática |
| **Efeitos de jogo** | Números flutuantes, partículas, contagem com tique, críticos (`src/fx/ui-fx.js`) | Mesmo sistema, nas ações de construção e de sessão |
| **Fundo configurável** | Imagem ou vídeo com desfoque, zoom e sobreposição | Fundo do mapa e da interface |
| **Movimento reduzido** | `prefers-reduced-motion` e toggle de animações | Igual |

## 2. Temas

Um tema define cor de destaque, tipografia de títulos, forma das faixas, moldura e transição. Começam três:

| Tema | Destaque | Títulos | Faixas e moldura | Transição |
| --- | --- | --- | --- | --- |
| **Ordem** | Vermelho `#e91d25` | Serifa pesada, caixa alta | Rasgadas, retas, cantos em L | Glitch |
| **Prata** (como a Vigília) | Prata e branco | Cinzel / Cinzel Decorative | Moldura ornamentada, divisória celta própria | Tinta |
| **Neutro** | Âmbar | Serifa clássica | Discretas | Fade |

O usuário pode criar temas a partir de uma cor e de uma textura de fundo.

**Fontes:** só as de licença livre, auto-hospedadas em `public/fonts/` (o app funciona offline): Hanken Grotesk (interface), Cinzel e Cinzel Decorative (títulos), Special Elite (máquina de escrever), mais uma serifa de texto OFL. As fontes da Vigília que não são livres (Optima LT Pro, CartaMarina, Wak) não entram.

**Ornamentos:** molduras, divisórias e ícones desenhados pelo próprio Atlas em SVG. Nada copiado de livros ou da Ficha que não seja nosso.

## 3. Fluido: nunca esperar, nunca procurar

- **Tudo responde na hora.** Pré-visualização enquanto o mouse está em cima; o resultado aparece antes de soltar.
- **Nada bloqueia.** Sem diálogos modais para ações comuns; geração pesada em worker com o resultado anterior visível.
- **Desfazer sempre.** Toda ação, automática ou não, é uma entrada no histórico; toasts trazem "Desfazer".
- **Encaixe inteligente.** Fantasma de prévia, guias e estalo visual ao encaixar.
- **Movimento com peso.** Arrastar com leve inércia; objetos colocados dão um "pop"; portas abrem girando.
- **Transições que explicam.** Trocar de clima, de modo ou de renderizador anima a mudança, em vez de piscar.

## 4. Integrado: a próxima ação está onde você olha

- **Cartão contextual.** Selecionar um cômodo, uma parede, um objeto ou um token abre um cartão flutuante junto dele, com as propriedades principais e as ações que fazem sentido ali (como os botões de rolagem dentro da habilidade na Ficha). O inspetor completo fica na lateral para quem quiser.
- **Menu radial** no clique direito com as 6–8 ações do contexto.
- **Arrastar de qualquer lugar.** Da biblioteca para o mapa, de uma ficha para o mapa (vira token), de um documento do Ateliê para uma mesa (vira pista).
- **Token com a ficha dentro.** O cartão do token mostra PV/PD em pips, condições e as rolagens da ficha vinculada como botões; a rolagem aparece flutuando sobre o token no mapa e no projetor.
- **Paleta de comandos** (Ctrl+K) que acha ferramentas, objetos, cômodos, climas e ações.
- **Atalhos visíveis.** Cada botão mostra o atalho no tooltip; barra 1–9; ? abre o mapa de atalhos.
- **Sugestões no fluxo.** O assistente aparece como uma pílula discreta ("Mobiliar a cozinha?") junto do que acabou de ser feito, nunca como janela.

## 5. Telas

| Tela | Conteúdo |
| --- | --- |
| **Início** | Galeria cinematográfica dos mapas, com prévia no clima salvo, como a seleção de agentes da Ficha |
| **Construir** | Mapa ao centro; barra de ferramentas vertical à esquerda (como o trilho da Ficha); biblioteca e inspetor recolhíveis à direita; cartão contextual sobre o mapa |
| **Sessão** | Mapa com moldura; dock de sessão; iniciativa; tokens com cartões da ficha; controles de clima e eventos |
| **Projetor** | Só o mapa filtrado, moldura, iniciativa e eventos, no tema escolhido |

## 6. Critérios de aceite da interface

- Toda ação principal tem feedback visual em menos de 100 ms.
- Nenhuma ação comum abre diálogo modal.
- Toda ação automática pode ser desfeita a partir do toast.
- Os três temas trocam ao vivo sem recarregar.
- Com animações desligadas, tudo funciona igual, sem efeitos.
- Funciona offline com todas as fontes e ornamentos locais.
