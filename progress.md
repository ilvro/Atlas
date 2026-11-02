# Atlas — andamento

Atualizado em 2 de novembro de 2026.

## Fase 0 — Planejamento (2 de novembro) — concluída

- Decisões com o usuário: vista de cima com profundidade falsa; arte ilustrada sombria procedural com modo pixel opcional (clima do Enigma do Medo); mapas de cena primeiro; site estático offline.
- Documentos: [VISAO.md](docs/VISAO.md), [ARQUITETURA.md](docs/ARQUITETURA.md), [INTERFACE.md](docs/INTERFACE.md), [ROADMAP.md](docs/ROADMAP.md) e [AGENTS.md](AGENTS.md).
- Sem código.
- Revisão com as referências do usuário (mapas de Inkarnate das temporadas anteriores, em docs/referencias/): paredes caixa no lugar da inclinação 3/4; acabamento da cena, fundo e identidade por cômodo; objetos de coleção própria (procedural + acervo gerado ou achado com licença livre), importação só opcional.
- Segunda revisão: mapas de qualquer gênero (o horror é um clima, não o foco); identidade própria (névoa com memória em esboço, luz como protagonista com climas, pincéis de presença); engine de renderização com descrição única por asset e renderizadores Ilustrado e Pixel, incluindo sprites animados.
- Terceira revisão: interface com a identidade da Ficha Ordem II (fluida e integrada; INTERFACE.md); climas como "o mesmo mapa, vários momentos" (dia, tempestade, noite, apagão) com luzes que reagem sozinhas; roadmap detalhado em 9 fases com etapas.

## Fase 1 — Protótipo técnico (2 de novembro) — concluída

Protótipo em [spikes/estilos/](spikes/estilos/README.md), com PixiJS 8.22.0 e Vite 7.3.6.

- Concluído: etapas 1.1–1.8. Mapa semântico (sala + biblioteca em L), descrição de desenho única para todos os objetos, renderizadores Ilustrado e Pixel (12/16/24 px por célula), paredes caixa e sólidas, luz com sombras das paredes, luz pelas janelas, visão e névoa com memória em esboço, porta que abre, quatro climas com transição (dia, tempestade com chuva/relâmpago/trovão, noite, apagão com falha das luzes), lanterna, sprite paramétrico andando, painel no tema da Ficha (Ordem e Prata), toasts e transições.
- Validação: `npm run build` sem erros; `npm run medir` em 1920×1080 na RX 580: 60 fps (p5 = 60) nas 10 combinações, sem erros no console; capturas em `spikes/estilos/medicao/`.
- Respostas: as seis perguntas da fase deram sim; detalhes e lições no README do protótipo.
- Pendências: fonte pixel própria para a cartela; transição animada da memória; borda suave da névoa no Ilustrado; sprite opcional no Ilustrado; luzes vindas das receitas; assar em worker.

## Plataforma (2 de novembro) — planejada

- Decisão com o usuário: todos os projetos no mesmo GitHub Pages (`ilvro.github.io`) falam um contrato comum. Novo documento [PLATAFORMA.md](docs/PLATAFORMA.md): Refs, banco da campanha `mesa-campanha-v1`, barramento `mesa:eventos`, manifestos `mesa.json`, tema `mesa:tema`, biblioteca `mesa-core` e o hub "Mesa". O contrato Ateliê ↔ Tabletop v1 vira parte dele, sem mudança.
- Roadmap: contrato e campanha entram na Fase 2 (2.7, 2.8); notas por cômodo na Fase 3 (3.10); Fase 9 virou "Plataforma e tutoriais".
- Obsidian e Miro ficam como possibilidades em aberto, sem desenho.

## Próximo

Fase 2 — fundação (etapas 2.1–2.6 do roadmap), aplicando as lições do protótipo.

## Pendências

- Nenhuma no momento.
