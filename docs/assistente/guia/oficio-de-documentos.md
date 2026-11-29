> resumo: ofício de fazer documentos (pistas) memoráveis no Ateliê: contexto, especificidade, voz, suporte variado, as duas origens, segredo sob UV e conferência final.

### Ofício de documentos

Leia antes de criar documentos pela primeira vez na conversa. O modelo é só o papel; o que faz a pista ser lembrada é o que você escreve nele e o suporte que escolhe.

1. **Uma pista, muito contexto.** O documento existe no mundo por um motivo: quem escreveu, para quem, quando, por que foi guardado ou perdido. Escreva isso em uma frase antes de escolher o modelo. Se não sabe dizer, o documento vai sair genérico.
2. **Específico vence genérico.** Nomes completos, endereços, números de protocolo, horários quebrados (03:17, não 03:00), valores na moeda da época, erros de grafia de quem escreve à pressa, abreviações de repartição. Proibido: lorem, `[nome]` e "Documento confidencial" como título.
3. **Voz de época e de pessoa.** Telegrama com STOP; ofício com "Vimos por meio desta"; bilhete com a frase cortada; adolescente sem pontuação; médico com letra de receita. Cada campo tem quem fala.
4. **Ruído que esconde o sinal.** A pista mora no meio de texto plausível, não sozinha. Diga ao mestre o trecho exato onde ela está.
5. **Varie o suporte.** Numa leva de 4 ou mais documentos, no máximo 2 do mesmo tipo de papel ou modelo. Misture papel, objeto e, quando houver, tela.
6. **Procure nas duas origens.** A casa e as expansões (como Arquivos Confidenciais) vêm intercaladas em `atelie_modelos_listar`; use `origem: 'expansao'` para ver só as expansões e `pagina` para passar dos 40 primeiros. Prefira o modelo cuja `descricao` mais se aproxima da cena. Em modelo de expansão, `campos` pode vir `null` (`camposAoCriar: true`): crie e leia os rótulos com `atelie_documento_ler`. Modelo com `era` ou `tom` desconhecidos vem depois, marcado (`eraDesconhecida`): olhe a descrição. `pendente: true` ainda converte sozinho ao criar, só leva mais tempo.
7. **Segredo sob UV** responde ou contradiz o texto visível; nunca o repete. A carta fala de saudade; sob UV, o endereço de quem ela tenta esquecer.
8. **Cena → suportes que funcionam.**

   | Cena | Suportes |
   |---|---|
   | Investigação policial | boletim de ocorrência, ficha criminal, laudo pericial, recorte de jornal, cartão de evidência, mandado |
   | Horror cósmico | diário, página de grimório, carta envelhecida, prontuário de sanatório, recorte de jornal, polaroide |
   | Fantasia medieval | pergaminho com selo, édito real, mapa rasgado, cartaz de procurado, página de grimório |
   | Terror moderno | conversa de celular, e-mail impresso, bilhete de caderno, polaroide, receita |
   | Conspiração corporativa | e-mail impresso, relatório, recibo, cartão de visita, telegrama ou bilhete interno, terminal |

   Confirme os nomes reais com `atelie_modelos_listar`; a tabela é ponto de partida, não catálogo.
9. **Antes de entregar, confira:** tem nome, data e lugar? Tem algo que o jogador vai querer reler? Parece com o último documento que você fez? Se sim, troque o suporte. Ao terminar, diga ao mestre o id de cada documento e onde está a pista dentro dele.
