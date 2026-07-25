# Claude-chan Emoticon Revival — Handoff

> Snapshot: 2026-07-25
> Repository: `amamirugi/claude-chan-emoticon-railway`
> Active branch: `vercel-revival`
> Base branch: `main`
> Current verified production commit: `30a5b85b56453fc102f42c4a4d48e745d3556780`

## Objective

Revive the old Claude-chan emoticon MCP so that Claude.ai can render an emotion image reliably **inside the conversation as an MCP App inline UI**, instead of having the image appear inconsistently inside tool/reasoning disclosures.

The current direction is a Vercel-hosted remote MCP using Streamable HTTP and the current MCP Apps model.

## Background / prior failure mode

The original local Claude Desktop MCP was modified so its assets could be hosted remotely and connected to Claude.ai. It partially worked, but behavior was inconsistent:

- some chats/environments loaded the image and others did not;
- image output could become trapped inside Claude's expandable reasoning/tool-call area;
- the behavior sometimes disappeared after previously working.

The old Railway implementation mixed multiple rendering paths in one tool result, including raw base64 `type: "image"` content plus an MCP Apps `ui://` resource. That mixture is a strong suspect for the image being treated as a tool result instead of as the intended inline App UI.

The historical PDF comments also describe earlier Claude Web iframe/permission failures. Those comments predate the current remote MCP + MCP Apps support model and are no longer treated as a proof of impossibility.

## Confirmed decisions

### 1. Rebuild around Vercel + current MCP Apps

The revival should target Vercel rather than preserve the Railway runtime architecture.

Reason:

- Vercel has a current MCP Apps Next.js starter/reference implementation;
- the desired MCP is effectively stateless;
- Streamable HTTP fits Vercel better than the old persistent SSE/session-map design;
- static WebP assets are a natural fit for the Vercel deployment.

Changing this architectural direction requires Taehyun's approval.

### 2. Use a minimal vertical slice before restoring all emotions

P1 supports only `happy`.

Target flow:

```text
Claude.ai
  -> https://<deployment>/mcp
  -> express_emotion({ emotion: "happy" })
  -> structuredContent + linked ui:// resource
  -> MCP App iframe
  -> happy.webp inline in the conversation
```

Do not restore the full 26-emotion system before this path works reliably.

### 3. Do not return raw image content from the tool

The revival path must not use the old base64 `type: "image"` fallback.

The image is presentation-layer UI and should be rendered by the MCP App.

This is intended to prevent the image from being captured by Claude's ordinary tool-result/reasoning disclosure UI.

### 4. Streamable HTTP only for the new path

The new Vercel path does not depend on:

- SSE transport;
- process-local transport/session Maps;
- a long-lived Express/Railway server process.

### 5. Preserve legacy files until P1 is proven

The existing Railway-era files remain in the branch for comparison while P1 is being tested.

Do not delete the legacy implementation yet. Cleanup happens only after the vertical slice is confirmed in Claude.ai.

## Rejected / superseded approaches

### Preserve the Railway implementation and patch around its current behavior

Rejected for the revival baseline.

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

This confirms the core revival hypothesis: the `happy.webp` presentation can render through MCP Apps inline UI without returning raw `type: "image"` content. The production deployment was created by manually promoting commit `30a5b85`; Production Branch tracking has not yet been confirmed and must not be assumed.

## Exact current state

### Done

- feasibility research for current Claude.ai remote MCP + MCP Apps direction;
- Vercel chosen as the revival target;
- `vercel-revival` branch created;
- minimal `happy` vertical slice implemented and committed;
- compatible MCP package versions pinned;
- Vercel build succeeded for commit `30a5b85`;
- successful deployment promoted from Preview to Production;
- public `/mcp` endpoint accepted by Claude.ai after promotion;
- Claude.ai custom connector registration succeeded;
- real `express_emotion({ emotion: "happy" })` call succeeded;
- Claude.ai reported that the tool call rendered an interactive widget in the chat;
- no raw `type: "image"` fallback is used by the revival path.

### Not yet done

- reproduce the same result in an additional fresh Claude.ai conversation;
- confirm repeated-call behavior;
- confirm Vercel Production Branch tracking / future automatic deployment behavior;
- mobile and Desktop compatibility testing;
- restoration of the remaining emotions;
- legacy cleanup;
- final README and deployment documentation.

## Tooling limitation encountered during deployment

The Vercel MCP/connector was not callable from this ChatGPT conversation, so Vercel-side deployment actions were performed manually by Taehyun in the Vercel dashboard.

This limitation affected only automation from this conversation. It does **not** change the verified result: commit `30a5b85` was built successfully, promoted to Production, accepted by Claude.ai as a custom connector, and used for a successful interactive MCP App render.

Future instances must not assume they can call the Vercel connector merely because it is configured; verify with a harmless real read call first.

## Next step — highest priority

Treat the core P1 vertical slice as technically proven, then verify reproducibility before expanding scope.

Recommended sequence:

1. Open a completely fresh Claude.ai conversation with the production connector enabled.
2. Call `express_emotion({ emotion: "happy" })` again.
3. Confirm the interactive MCP App widget renders again.
4. Test a second call in the same conversation to catch state or resource-caching problems.
5. Confirm the Vercel project's Production Branch tracking before relying on automatic deployments; the currently working production deployment was manually promoted.
6. If reproducibility passes, begin restoring the remaining emotion enum and assets in small batches while preserving the same structured-content + `ui://` resource path.

## P1 result

The core P1 path has passed in a real Claude.ai conversation:

- Claude.ai connected to the promoted production `/mcp` endpoint;
- `express_emotion` was callable;
- the `happy` call returned successfully;
- Claude.ai rendered an interactive MCP App widget in the chat;
- the revival path did not depend on raw tool-result image content.

One strict reliability check remains before calling the vertical slice fully closed: reproduce the same result in a fresh conversation and on a repeated call.

## After P1 succeeds

Only then proceed to P2/P3:

- test repeated calls and fresh conversations;
- test Web / mobile / Desktop host behavior;
- restore the full emotion enum and assets;
- restore/tune emotion invocation rules;
- improve App presentation;
- remove obsolete Railway/SSE/base64 fallback code;
- update README and deployment instructions;
- decide whether the repository should be renamed away from `-railway` after the Vercel migration is stable.

## Source documents to read first in the next session

1. `DECISIONS.md` — this handoff / decision record.
2. `REVIVAL.md` — concise P1 implementation goal and success criterion.
3. `app/mcp/route.ts` — current MCP vertical slice.
4. `app/page.tsx` and the MCP App UI files under `app/`.
5. `package.json`.
6. Legacy `index.js` only for comparison; do not treat it as the target architecture.

Do not restart feasibility research unless a concrete implementation failure contradicts the current findings.
