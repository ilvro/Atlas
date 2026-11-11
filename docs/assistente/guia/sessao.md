> resumo: planejar uma sessão: ler a campanha, plano aprovado, entidades, mapas, cenas, roteiro, resumo; abrir apps, falhas e dono de cada coisa.

## Planejar uma sessão

Quando o mestre pedir para preparar uma sessão (por exemplo, "prepare a próxima a partir das notas da anterior"), siga este fluxo. Ele junta a Mesa (campanha, cenas, sessões) e o Atlas (mapas e momentos).

### 1. Leia antes de propor

- `mesa_campanha_atual`: a campanha selecionada na Mesa (id, nome, sistema). Sem campanha, peça ao mestre para escolher uma.
- `campanha_ler` com esse id: entidades por tipo e a lista de sessões. `campanha_entidade_ler` aprofunda uma entidade (notas e ligações).
- `mesa_sessoes_listar`: as sessões, da mais recente para a mais antiga, com roteiro e se já têm registro.
- `campanha_sessao_ler` na última sessão: o registro do que aconteceu e as notas do roteiro. É daí que saem os ganchos da próxima.

### 2. Converse e escreva o plano, sem construir nada

Com o que leu, proponha ao mestre um plano curto: cenas (o que acontece e onde), NPCs e ameaças, pistas (o que revelam e a quem), ritmo (abertura, tensão, respiro, desfecho) e os mapas e momentos que vai precisar. Pergunte o que ajustar. Não registre entidade, não crie mapa, não monte cena nem crie sessão antes da aprovação explícita do mestre. Se ele aprovar só uma parte, construa só ela.

### 3. Com o plano aprovado, construa nesta ordem

1. **Entidades, documentos e fichas.** As pistas viram documentos no Ateliê (`atelie_documento_criar`, que já registra a pista na campanha); os NPCs e as ameaças viram fichas no Dossiê (`dossie_ficha_criar`, `dossie_ameaca_criar`) e aparecem na campanha sozinhos: não os duplique com `mesa_entidade_criar`. Veja a seção `documentos-fichas-trilha` do guia. Para o resto (lugares, facções, cenas, notas), `mesa_entidade_criar` (`tipo`: `personagem`, `lugar`, `pista`, `faccao`, `sessao`, `nota`, `cena` ou `ameaca`; `nome`; `tags`; `notas`). Nas notas, `[[Nome]]` cria a ligação "menciona" com outra entidade, e o nome precisa existir: crie primeiro o que será citado. Para outras relações use `mesa_ligar` (`de`, `para`, `tipo` entre `aparece-em`, `esta-em`, `revela`, `toca-em`, `pertence-a`, `menciona`; as pontas são referências `mesa:mesa/entidade/<id>`, devolvidas na resposta de `mesa_entidade_criar`). Cada cena do plano vira uma entidade `cena`; marque combates com a tag `encontro`.
2. **Mapas e momentos, no Atlas.** Se o Atlas não estiver aberto, veja "Abrir os apps que faltam". Siga as seções `mapas` e `momentos` do guia, com `atlas_ver_mapa` depois de cada bloco. Passe `campanhaId` em `atlas_mapa_criar`: o mapa vira uma entidade `lugar` na campanha, que a Mesa usa nas cenas e no roteiro (confira com `campanha_ler`). Crie os momentos que as cenas abrirão e teste-os.
3. **Cenas.** `mesa_cena_montar` (`cenaId`; `mapa`, `trilha`, `participantes`, `pistas`, `momento`, `encontro`). Os ids são de entidades da campanha: `mapa` é um `lugar` do Atlas, `trilha` uma cena sonora ou efeito do Jukebox (as referências `mesa:jukebox/cena-sonora/<id>` vêm de `jukebox_listar`), `participantes` são personagens e ameaças, `pistas` são pistas. `mapa` e `trilha` trocam o anterior; participantes e pistas se acrescentam. O `momento` é o NOME (ou o id) de um momento que existe no mapa vinculado à cena: monte a cena com o `mapa` antes, ou na mesma chamada. Confira o resultado com `mesa_cena_ler`.
4. **Sessão.** `mesa_sessao_criar` (`nome`, `data` opcional em AAAA-MM-DD): ela aparece no Diário da Mesa e não começa a gravar. Depois `mesa_sessao_editar` (`id`) com `roteiro.acrescentar` (as cenas, mapas e demais itens, na ordem de jogo, no máximo 64, sem repetir), `roteiro.ordem` se precisar reordenar e `notas` (uma `{ ref, texto }` por item do roteiro: o que o mestre deve lembrar ali). O que não coube volta em `ignorados`: leia-o.

### 4. Termine com um resumo

Liste o que foi criado, com nomes: entidades (por tipo), mapas e momentos (com o que cada momento faz), cenas (com mapa, participantes e momento), a sessão e a ordem do roteiro. Diga o que ficou de fora e o que vale revisar. Lembre que tudo se desfaz pelo painel ou na interface da Mesa e do Atlas.

### Abrir os apps que faltam

`ponte_estado` mostra quais apps estão conectados. Para abrir os que faltam, use `mesa_abrir_apps` (`apps`: `atlas`, `ficha`, `atelie`, `jukebox`). Se a resposta trouxer `bloqueado`, o navegador recusou a aba: a Mesa mostrou um aviso com o botão "Abrir". Peça ao mestre para clicar nele e espere a confirmação (`ponte_estado`) antes de seguir. Com `indisponivel`, o app não foi achado ao lado da Mesa: peça ao mestre para subir ou abrir.

### Quando uma ferramenta falha

Leia o erro inteiro: ele diz o que está errado (id inexistente, nome que não existe para o `[[ligação]]`, tipo inválido com a lista dos aceitos, roteiro cheio). Corrija a causa e tente de novo; nunca repita a mesma chamada às cegas. Se o erro for "veja o aviso na Mesa", peça ao mestre para ler o aviso. Se não souber corrigir, pare e conte o que aconteceu.

### De quem é cada coisa

A Mesa só edita o que ela mesma criou. `mesa_entidade_editar` recusa entidades de outros apps e diz o dono: fichas e ameaças são do Dossiê, documentos e pistas do Ateliê, cenas sonoras do Jukebox, mapas do Atlas. Nesse caso, peça ao mestre para alterar no app dono; não crie uma cópia para contornar. Use `acrescentarNotas` (soma ao fim) em vez de `notas` (troca o texto) quando a entidade já tiver texto do mestre, e leia antes com `campanha_entidade_ler`. A Mesa não remove entidades: isso fica com o mestre.

