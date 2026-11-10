# Ponte do assistente (só desenvolvimento)

O servidor MCP `mesa` (`scripts/ponte/mcp.ts`) liga o app do Claude à ponte do `mesa-dev` (`/__ponte`). Ele conecta em `ws://127.0.0.1:${MESA_PORTA ?? 5100}/__ponte` com o token de `Atlas/.ponte/token` (relido a cada reconexão, pois muda a cada partida do `mesa-dev`) e reconecta em silêncio. A ferramenta `ponte_estado` sempre existe; as demais vêm das abas abertas.

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

## Teste de fumaça

```
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | timeout 5 node scripts/ponte/mcp.ts
```

Stdout só leva o protocolo; os logs vão para stderr.
