# Claude-chan Emoticon Revival

## Goal

Rebuild the Claude.ai emoticon experience around the current MCP Apps model and Vercel-hosted Streamable HTTP endpoint.

## P1 vertical slice

This branch intentionally supports one thing only:

1. Claude.ai connects to `/mcp`.
2. Claude calls `express_emotion({ emotion: "happy" })`.
3. The tool returns text + structured data only.
4. Claude.ai resolves the linked `ui://` MCP App resource.
5. The inline App renders `assets/happy.webp`.

## Explicitly removed from the runtime path

- raw `type: "image"` tool-result fallback
- SSE transport
- in-process MCP session maps
- dynamic base64 image serving
- Railway-specific Express server lifecycle

The legacy files remain on this branch for comparison while P1 is tested, but they are not used by the Next.js/Vercel build.

## Success criterion

In a fresh Claude.ai conversation with the connector enabled, invoking `express_emotion` must display the happy emoticon as an inline MCP App instead of trapping the image inside the tool-result/reasoning disclosure.

## Endpoint

After Vercel deployment, register:

`https://<deployment-domain>/mcp`

as the remote MCP connector endpoint.
