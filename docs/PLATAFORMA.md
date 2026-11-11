# Plataforma da mesa — contrato comum

Data: 2 de novembro de 2026. Proposta, versão 1. Nada aqui está implementado fora do que já existe entre Ateliê e Tabletop. Os outros projetos só mudam quando o usuário autorizar, um por vez. Este documento mora no Atlas até existir o repositório do hub; depois, passa para lá.

## 1. Objetivo

Fazer Atlas, Dossiê, Ateliê, Jukebox e Tabletop parecerem **uma plataforma para a campanha**, não cinco sites. A inspiração é o Atlas VTT para Obsidian: tudo da sessão à mão e ligado entre si, com descrição dos lugares, preparação, fichas, documentos e música.

**Nome:** o aplicativo das fichas se chamava Ficha e agora se chama **Dossiê** (pasta e repositório `Dossie`). O identificador do aplicativo no contrato continua `ficha` (está nas referências já guardadas, como `mesa:ficha/ficha/<id>`, e nos eventos `ficha.*`): é um id estável, não um nome de exibição.

Princípios:

1. **Cada aplicativo continua dono dos seus dados.** A Ficha é dona das fichas; o Ateliê, dos documentos; o Atlas, dos mapas. A plataforma **liga**, não centraliza.
2. **Um contrato, não N pontes.** Toda integração usa os mesmos IDs, o mesmo barramento e o mesmo banco de campanha. Um aplicativo novo entra conversando com todos.
3. **Funciona sem servidor.** Tudo no navegador, como já funciona hoje no GitHub Pages.
4. **Cada aplicativo funciona sozinho.** Sem os outros abertos ou publicados, nada quebra; os recursos integrados só aparecem quando há com quem falar.

## 2. Onde roda: uma origem só

Todos os projetos estão em `https://ilvro.github.io/<repositório>/`. A origem é a mesma (`https://ilvro.github.io`); só o caminho muda. Na mesma origem, os aplicativos compartilham **IndexedDB**, **BroadcastChannel**, **localStorage** e podem se embutir em `iframe` com acesso total. É o caminho A do [contrato Ateliê ↔ Tabletop](../../Atelie/docs/plano/CONTRATO-TABLETOP.md), que já funciona.

| Situação | Como fica |
| --- | --- |
| GitHub Pages (uso principal) | Mesma origem. Tudo funciona direto. |
| Desenvolvimento local | Um **servidor de desenvolvimento único** (`mesa-dev`, em `Atlas/scripts/mesa-dev.ts`) serve cada projeto num caminho da mesma porta (`http://127.0.0.1:5100/Atlas/`, `/Ficha/`…), repassando para o Vite de cada um. Reproduz o Pages. ✅ Implementado: cada projeto roda o Vite com `base: '/Nome/'` (no Atlas, `npm run dev:mesa`) e o proxy repassa o caminho inteiro, WebSocket do recarregamento ao vivo incluído; um projeto que serve na raiz entra como `Nome=porta@raiz`. `npm run mesa-dev` (sem argumentos) sobe Atlas, Mesa, Dossiê, Ateliê e Tabletop com o Vite sob o prefixo (`npm run dev:mesa` de cada um; Ateliê e Tabletop guardam no navegador, como o Pages, porque atrás do proxy não há servidor de API) e serve o **Jukebox como arquivos estáticos** (`Nome=estatico:pasta`). ✅ Implementado (9.1c). |
| Outra origem (domínio próprio, outra conta, Tabletop com servidor local) | Caminho B do contrato do Ateliê: janela + `postMessage`, com `nonce` e verificação de origem. Recursos reduzidos. |

**Exceção:** o Jukebox depende de um servidor para baixar e editar áudio. O player participa da plataforma no Pages; ações que precisam do servidor continuam no servidor.

**Limite:** dados no navegador são do navegador. Outro computador ou outro navegador começa vazio; a cópia de segurança de cada aplicativo (e a da campanha) é o transporte.

## 3. Identidade e referências

Toda coisa que pode ser ligada tem uma referência:

```js
Ref = { app: 'atlas' | 'ficha' | 'atelie' | 'jukebox' | 'tabletop' | 'mesa', tipo: 'mapa' | 'comodo' | 'ficha' | 'documento' | 'cena-sonora' | ..., id: string, rev?: number }
```

Forma em texto, para links e notas: `mesa:ficha/ficha/sheet-1730…`, `mesa:atlas/comodo/<mapa>/<comodo>`.

- IDs são estáveis e nunca reaproveitados. Nome nunca é vínculo (lição do Jukebox).
- `rev` só quando importa a versão exata (como os documentos assados do Ateliê).

## 4. Campanha: o núcleo que liga tudo

Banco IndexedDB **sem escopo de caminho**, ponto de encontro de todos: `mesa-campanha-v1`.

| Store | Chave | Conteúdo |
| --- | --- | --- |
| `campanhas` | `id` | Nome, sistema (Ordem Paranormal, outro), tema, capa, `elenco` (opcional: lista de ids de entidades `personagem` que fazem parte da campanha) |
| `entidades` | `id` | Personagem, lugar, pista, cena, sessão, facção, nota. Cada uma com `campanhaId`, `nome`, `tipo`, `refs: Ref[]` (o que a representa em cada aplicativo), `tags`, `notas` |
| `ligacoes` | `id` | `{ de: Ref, para: Ref, tipo: 'aparece-em' \| 'esta-em' \| 'revela' \| 'toca-em' \| ... }` |
| `sessoes` | `id` | Data, roteiro (lista de Refs: mapas, cenas sonoras, documentos), notas do roteiro (`roteiroNotas`, opcional, por chave de Ref), registro do que aconteceu |

Exemplos:

- **Personagem** "Muirenn": `refs` = ficha na Ficha, token no Atlas, figura no Tabletop. A Ficha cria a entidade e pode anexar `retrato` (um `Blob` de imagem, até 512 KB); os outros aplicativos só leem.
- **Lugar** "Casa dos Salgueiros": `refs` = mapa no Atlas, cena no Tabletop, cena sonora no Jukebox.
- **Pista** "Carta queimada": `refs` = documento no Ateliê; `ligacoes` → `esta-em` o cômodo "Biblioteca" do mapa.

Quem escreve: qualquer aplicativo, sempre por transação e pela biblioteca comum (§7). Cada um só altera as entidades que criou ou os `refs` dele.

**Notas:** texto rico com `[[ligações]]` para qualquer entidade ou Ref. Exportação em Markdown fica prevista (§10), mas a fonte é o banco.

## 5. Barramento de eventos

`BroadcastChannel('mesa:eventos')`, com envelope único:

```js
{ contrato: 1, app: 'ficha', tipo: 'ficha.rolagem', id: '<uuid>', em: 1730560000000, campanhaId, dados: { ... } }
```

- **Fatos** (aconteceu): `ficha.rolagem`, `ficha.recursos`, `atlas.cena-aberta`, `atlas.regiao-entrou`, `atlas.revelado`, `atelie.documento-salvo`, `jukebox.tocando`, `mesa.sessao-iniciada`.
- **Pedidos** (faça, se puder): `jukebox.tocar` `{ ref }` (uma cena sonora), `jukebox.efeito` `{ ref }` (um efeito avulso, uma faixa `sfx`, `mesa:jukebox/efeito/<titulo>`), `jukebox.prontidao` `{ ref }` (responde se a cena sonora tem todas as faixas carregadas: `{ ok, total, faltando, nome }`), `atlas.focar` `{ ref }`, `ficha.abrir` `{ ref }`, `atelie.abrir` `{ ref }`. Quem atende responde com um fato; sem resposta em 1,5 s, quem pediu avisa que o aplicativo não está aberto e oferece abri-lo.
- Catálogo versionado em `mesa-core`; quem recebe tipo ou versão desconhecida ignora e avisa uma vez no console.
- O canal `mesa:handout` e o banco `mesa-handouts-v1` do contrato do Ateliê **continuam valendo** e passam a fazer parte do contrato da mesa, sem mudança.

## 6. Manifesto de cada aplicativo

Cada aplicativo publica `mesa.json` na raiz:

```json
{ "app": "atlas", "nome": "Atlas", "contrato": 1, "icone": "./icone.svg",
  "rotas": { "mapa": "./#/mapa/{id}", "comodo": "./#/mapa/{pai}/comodo/{filho}" },
  "oferece": ["mapa", "comodo"], "emite": ["atlas.cena-aberta", "atlas.regiao-entrou"], "atende": ["atlas.focar"] }
```

Com isso o hub e os outros aplicativos descobrem quem existe (`fetch('../Ficha/mesa.json')`), abrem links profundos e sabem quais pedidos fazem sentido.

## 7. Biblioteca comum `mesa-core`

Um módulo pequeno, sem dependências: Refs, envelope e catálogo de eventos, acesso ao banco da campanha, manifesto, tema. Escrito em **TypeScript** e distribuído como **JavaScript compilado + `.d.ts`**: projetos em JavaScript (Ficha, Ateliê, Jukebox, Tabletop) usam sem migrar nada e ainda ganham autocompletar e checagem com JSDoc (`// @ts-check`).

- **Fonte única** no repositório do hub; cada aplicativo guarda uma **cópia com versão fixa** em `vendor/mesa-core/` (sem npm, sem depender de outro site estar no ar).
- Testes de contrato em cada aplicativo garantem que a cópia segue a versão.

## 8. Tema compartilhado

Chave `mesa:tema` no localStorage + os mesmos tokens CSS (`--acento`, `--acento-texto`, `--titulo`…) e os temas Ordem, Prata e Neutro de [INTERFACE.md](INTERFACE.md). Mudar o tema num aplicativo muda em todos, ao vivo, pelo evento `storage`.

## 9. O hub: "Mesa"

Um aplicativo leve, também no Pages (`/Mesa/`), que dá a cara de plataforma:

- **Início da campanha:** personagens, lugares, pistas, sessões, com busca e ligações.
- **Notas da campanha** com `[[ligações]]`, abrindo o que está ligado no aplicativo dono.
- **Modo sessão:** os aplicativos lado a lado em `iframe` (mapa do Atlas, fichas da Ficha, cena sonora do Jukebox), com o roteiro da sessão e o registro do que aconteceu.
- **Inventário de aplicativos** pelos manifestos, com link para cada um.

O nome "Mesa" funciona em português e inglês, como Jukebox e Ateliê. Pode mudar.

## 10. Possibilidades em aberto (fora do plano)

- **Obsidian:** exportar e importar notas e entidades como Markdown com `[[ligações]]`, se a campanha um dia for para um vault.
- **Miro:** hoje a preparação do usuário está no Miro. Uma importação de quadros ou exportação da campanha para um quadro é possível pela API do Miro, mas exige credenciais, que não cabem num site estático sem servidor. Fica registrado, sem desenho.
- **Vários dispositivos e jogadores:** exige servidor ou sincronização; fora do escopo.

## 10.1. Chaves e bancos compartilhados (v1, implementados no Atlas)

| O quê | Onde | Quem escreve |
| --- | --- | --- |
| Tema | `localStorage['mesa:tema']` → `{ v: 1, id: 'ordem'\|'prata'\|'neutro', acento?: '#rrggbb' }`; o evento `storage` avisa as outras abas | qualquer aplicativo |
| Campanha ativa | `localStorage['mesa:campanha-ativa']` → id da campanha | qualquer aplicativo |
| Campanha | IndexedDB `mesa-campanha-v1` (`campanhas`, `entidades`, `ligacoes`, `sessoes`), sem escopo de caminho | quem criou a entidade altera tudo; os outros só as próprias referências (aplicado pelo repositório e testado) |
| Eventos | `BroadcastChannel('mesa:eventos')`, envelope `{ contrato, app, tipo, id, em, campanhaId, dados, respondeA? }`; fatos só do dono, pedidos de qualquer um, resposta como `mesa.resposta` | todos |
| Mapas do Atlas | IndexedDB `atlas-v1:<caminho>`, **com** escopo de caminho (interno ao Atlas) | só o Atlas |

A implementação de referência é o `mesa-core` (`Atlas/mesa-core/`, TypeScript, 36 testes de contrato). `npm run build:core` o publica como JS + `.d.ts`; os outros projetos usam a cópia compilada em `vendor/mesa-core/`.

## 11. Ordem de adoção

| Passo | Quem | O quê |
| --- | --- | --- |
| 1 | Atlas (Fase 2) | Implementação de referência: `mesa-core` v1, Refs, banco da campanha, barramento, manifesto, tema. O Atlas nasce na plataforma. |
| 2 | Mesa | Hub mínimo: campanhas, entidades, notas com ligações, abrir aplicativos. `mesa-dev` para desenvolvimento local. |
| 3 | Ficha ✅ | Emitir `ficha.rolagem` e `ficha.recursos`; atender `ficha.abrir`; manifesto; publica as personagens (`personagem`) e as fichas de ameaça (`ameaca`, os monstros) com o retrato, e tira da campanha as de fichas apagadas. |
| 4 | Ateliê ✅ | Manifesto, `atelie.abrir` e `atelie.documento-salvo`; o contrato v1 continua como está. |
| 5 | Jukebox | Atender `jukebox.tocar` e emitir `jukebox.tocando` no player. Só com autorização. |
| 6 | Tabletop | Manifesto, Refs e barramento, reaproveitando as integrações que já tem. Só com autorização. |
| 7 | Mesa | Modo sessão com os aplicativos lado a lado. |

Nenhum contrato existente muda sem mudar os dois lados.
