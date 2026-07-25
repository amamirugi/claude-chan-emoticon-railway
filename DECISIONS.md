# Claude-chan Emoticon Vercel Revival — Decisions and Handoff

## Purpose

This document records the current Vercel revival direction for `amamirugi/claude-chan-emoticon-railway`, what has been decided, what has been discarded, what has been implemented, and the exact next steps for another AI instance.

Repository:

- `amamirugi/claude-chan-emoticon-railway`

Working branch:

- `vercel-revival`

Do not modify `main` during the revival work unless Taehyun explicitly asks.

## Current objective

Revive Claude-chan Emoticon as a remote MCP for Claude.ai using Vercel and the current MCP Apps path.

The target user experience is:

1. Claude calls `express_emotion`.
2. The tool returns structured data.
3. Claude.ai renders a proper MCP App inline in the conversation.
4. The emotion image appears in the App UI, not inside a collapsible raw tool-result block.

## Key decisions

### Hosting target

Use Vercel for the revival path.

Do not attempt to restore the old Railway deployment architecture as the primary target.

### Protocol / transport direction

Use Streamable HTTP at `/mcp`.

The revival path should be stateless where possible and should not recreate the legacy Express session maps unless a concrete need appears.

### UI direction

Use MCP Apps with:

- `registerAppTool`;
- `registerAppResource`;
- `structuredContent`;
- a `ui://` resource;
- a Next.js App UI.

Do not return raw `type: "image"` content in the new path.

### P1 scope

P1 is deliberately tiny:

- one tool: `express_emotion`;
- one supported emotion: `happy`;
- one existing asset: `assets/happy.webp`;
- one success criterion: the image must render inline as an MCP App in Claude.ai.

Do not restore the full emotion enum until this vertical slice is proven.

## Discarded approaches

### Restore the old Railway implementation as-is

Rejected.

Reason: the current implementation combines legacy transport/session assumptions and multiple image-rendering fallbacks, which makes failures difficult to isolate.

### Restore all emotion assets and prompt behavior immediately

Rejected for P1.

Reason: it creates unnecessary variables before the central question — reliable inline MCP App rendering in Claude.ai — has been proven.

### Keep raw `type: "image"` as a compatibility fallback

Rejected for the new runtime path.

Reason: this is a likely contributor to images appearing as tool-result content instead of as a clean inline App.

## Work completed in this session

### Repository investigation

The existing repo was read and compared against the current direction. Relevant legacy components include:

- `index.js` — Railway/Express MCP server with SSE + Streamable HTTP + image fallback;
- `app/index.html` and `app/main.js` — older UI implementation;
- `assets/` — existing WebP emotion assets, including `happy.webp`;
- `CLAUDE.md` — old emotion invocation rules.

The official `vercel-labs/mcp-apps-nextjs-starter` repository was also inspected, including its MCP route and App structure, and used as the reference for the new implementation.

### Branch created

`vercel-revival` was created from `main` at commit:

`602e84db09023f9f94b9db8c21e4ee9d3624f5ad`

### P1 implementation committed

Commit:

`cd271468feac945d9b5d40672143afce2f532fa5`

The branch now contains a Vercel/Next.js MCP Apps vertical slice, including:

- Next.js/Vercel project configuration;
- `/mcp` route;
- MCP App resource registration;
- `express_emotion` tool;
- `happy`-only structured output;
- inline App UI that uses the existing happy asset;
- `REVIVAL.md` describing P1 and its success criterion.

The old Railway files still exist, but are not intended to be part of the new Next.js/Vercel runtime path.

### Vercel build and Claude.ai validation

The first two Vercel builds exposed an MCP package peer-dependency conflict:

- `3fe22ce` failed because `@modelcontextprotocol/ext-apps` resolved to `1.7.5`, which required SDK `^1.29.0`, while the project pinned SDK `1.25.2`;
- `ee15a1a` failed after raising the SDK to `1.29.0`, because `mcp-handler@1.1.0` requires SDK exactly `1.26.0`.

The compatible package set was then pinned and committed:

- commit `30a5b85b56453fc102f42c4a4d48e745d3556780`;
- `@modelcontextprotocol/ext-apps@1.0.1`;
- `@modelcontextprotocol/sdk@1.26.0`;
- `mcp-handler@1.1.0`.

That commit built successfully on Vercel. The Preview deployment itself could not be registered in Claude.ai because Vercel Preview protection redirected the remote client into an OAuth/login flow. Promoting the same deployment to Production made the endpoint publicly reachable and Claude.ai custom connector registration succeeded.

A real Claude.ai tool call was then observed:

```text
express_emotion({ emotion: "happy" })
-> Displayed Claude-chan emotion: happy
-> interactive MCP App widget rendered in the chat
```

This initially looked successful, but later visual inspection showed the widget remained on `MCP host 연결 대기 중...` rather than displaying `happy.webp`.

## Exact current state

### Done

- feasibility research for current Claude.ai remote MCP + MCP Apps direction;
- Vercel chosen as the revival target;
- `vercel-revival` branch created;
- minimal `happy` vertical slice implemented and committed;
- Vercel build succeeded for commit `30a5b85`;
- successful deployment promoted from Preview to Production;
- public `/mcp` endpoint accepted by Claude.ai after promotion;
- Claude.ai custom connector registration succeeded;
- real `express_emotion({ emotion: "happy" })` call succeeded at the tool layer;
- Claude.ai created an interactive MCP App container;
- no raw `type: "image"` fallback is used by the revival path.

### Not yet done

- host bridge connection inside the MCP App;
- delivery of tool input/result into the App;
- actual inline rendering of `happy.webp`;
- reproduce the same result in an additional fresh Claude.ai conversation;
- confirm repeated-call behavior;
- confirm Vercel Production Branch tracking / future automatic deployment behavior;
- mobile and Desktop compatibility testing;
- restoration of the remaining emotions;
- legacy cleanup;
- final README and deployment documentation.

## Tooling limitation encountered during deployment

The Vercel MCP/connector was not callable from this ChatGPT conversation, so Vercel-side deployment actions were performed manually by Taehyun in the Vercel dashboard.

Future instances must not assume they can call the Vercel connector merely because it is configured; verify with a harmless real read call first.

## Correction — widget render was not yet successful

The earlier P1 success interpretation was too optimistic. Claude.ai did create an interactive widget container and the `express_emotion` tool call returned successfully, but the widget remained on `MCP host 연결 대기 중...` instead of rendering `happy.webp`.

Therefore the accurate state is:

- production `/mcp` endpoint reachable;
- Claude.ai connector registration successful;
- `express_emotion({ emotion: "happy" })` callable;
- MCP App iframe/container created;
- host bridge connection or tool-result delivery failed inside the App;
- `happy.webp` inline rendering is **not yet proven**.

A bridge-fix candidate is now committed. It restores the exact package line used by the official Vercel starter (`ext-apps 1.0.1`, SDK `1.25.2`, `mcp-handler 1.0.7`), syncs the starter hook implementation, and bumps the `ui://` resource version to invalidate the cached failed widget.

## Current next step

Deploy the latest `vercel-revival` commit, promote that deployment to Production, reconnect or refresh the Claude.ai connector, and call `express_emotion({ emotion: "happy" })` in a fresh conversation. P1 passes only when `happy.webp` replaces the waiting message inside the widget.

## Source documents to read first in the next session

1. `DECISIONS.md` — this handoff / decision record.
2. `REVIVAL.md` — concise P1 implementation goal and success criterion.
3. `app/mcp/route.ts` — current MCP vertical slice.
4. `app/page.tsx` and the MCP App UI files under `app/`.
5. `package.json`.
6. Legacy `index.js` only for comparison; do not treat it as the target architecture.

Do not restart feasibility research unless a concrete implementation failure contradicts the current findings.
