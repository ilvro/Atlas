# Ponte do assistente (só desenvolvimento)

O servidor MCP `mesa` (`scripts/ponte/mcp.ts`) liga o app do Claude à ponte do `mesa-dev` (`/__ponte`). Ele conecta em `ws://127.0.0.1:${MESA_PORTA ?? 5100}/__ponte` com o token de `Atlas/.ponte/token` (relido a cada reconexão, pois muda a cada partida do `mesa-dev`) e reconecta em silêncio. As ferramentas `ponte_estado` e `plataforma_guia` (guia sob demanda, de `docs/assistente/guia/`) sempre existem; o servidor envia `docs/assistente/nucleo.md` como instruções; as demais vêm das abas abertas.

Para usar: `npm run mesa-dev` no Atlas, abrir a Mesa ou o Atlas em http://127.0.0.1:5100/ e ter o servidor registrado abaixo.

## Registro no app do Claude

Arquivo: `~/.config/Claude/claude_desktop_config.json`.

1. **Feche o app do Claude** (ele reescreve o arquivo enquanto roda).
2. Guarde uma cópia: `cp ~/.config/Claude/claude_desktop_config.json ~/.config/Claude/claude_desktop_config.json.bak`.
3. Acrescente a chave `mcpServers.mesa` (mantendo o que já existe no arquivo), com o caminho absoluto do `mcp.ts`:

```json
{
  "mcpServers": {
    "mesa": {
      "command": "node",
      "args": ["/home/ilvro/Documents/Projects/Atlas/scripts/ponte/mcp.ts"]
    }
  }
}
```

4. Valide o JSON: `python3 -m json.tool ~/.config/Claude/claude_desktop_config.json`.
5. Abra o app: o servidor `mesa` aparece nas ferramentas da conversa; `ponte_estado` responde com e sem o `mesa-dev`.

Se o `mesa-dev` usa outra porta, acrescente `"env": { "MESA_PORTA": "5101" }` à entrada. O caminho do `mcp.ts` não depende da pasta de onde o app lança o processo.

## Claude Code (opcional)

Um `.mcp.json` na pasta onde o Claude Code roda, com a mesma entrada:

```json
{
  "mcpServers": {
    "mesa": { "command": "node", "args": ["/home/ilvro/Documents/Projects/Atlas/scripts/ponte/mcp.ts"] }
  }
}
```

## Catálogo base

O catálogo base (`scripts/ponte/catalogo-base.json`) permite que o Claude enxergue as ferramentas de todos os aplicativos da plataforma assim que conecta, mesmo antes de cada aba ser aberta.

Todos os apps são montados direto do código, sem depender do cache nem de o app estar aberto:
- `atlas_*`: `ferramentasDeLeitura` e `ferramentasDeEscrita` do próprio Atlas, com contexto falso.
- Mesa, Dossiê (`ficha`), Ateliê e Jukebox: o gerador importa o código dos repositórios irmãos em `../Mesa` (`ferramentasDaMesa`, em `src/app/ponte-ferramentas.ts`), `../Dossie` (`ferramentasDoDossie`), `../Atelie` (`ferramentasDoAtelie`) e `../Jukebox` (`ferramentasDaJukebox`), também com contexto falso (lista em `IRMAOS_DO_CATALOGO`, `catalogo.ts`).

Se um repositório irmão não existir (ou a importação falhar), o gerador avisa no terminal e usa, para aquele app, o cache `.ponte/ferramentas.json` (gravado pelo servidor MCP quando o app conecta) e, sem ele, o catálogo base atual. Ao final, o terminal mostra a fonte de cada app (`código`, `cache` ou `catálogo atual`). As ferramentas internas (`FERRAMENTAS_INTERNAS`) nunca entram.

Testes (`tests/unit/ponte-mcp.test.ts`) falham se nome, descrição, esquema ou anotações de alguma ferramenta do Atlas divergirem do catálogo base; o mesmo vale para cada app irmão, e o teste daquele app é pulado quando o repositório não existe.

Quando uma ferramenta de qualquer app for criada, removida ou tiver descrição, esquema ou anotações alterados: rode `npm run ponte:catalogo` (com os repositórios irmãos ao lado do Atlas) e faça commit de `scripts/ponte/catalogo-base.json`.

## Teste de fumaça

```
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | timeout 5 node scripts/ponte/mcp.ts
```

Stdout só leva o protocolo; os logs vão para stderr. A resposta de `initialize` traz `instructions` enviadas pelo servidor.
