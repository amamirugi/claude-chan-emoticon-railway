# Claude-chan Emoticon Revival — Handoff

> Snapshot: 2026-07-25
> Repository: `amamirugi/claude-chan-emoticon-railway`
> Active branch: `vercel-revival`
> Base branch: `main`
> Current branch head before this document: `cd271468feac945d9b5d40672143afce2f532fa5`

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

## Exact current state

### Done

- feasibility research for current Claude.ai remote MCP + MCP Apps direction;
- Vercel chosen as the revival target;
- `vercel-revival` branch created;
- minimal `happy` vertical slice implemented and committed;
- revival strategy recorded in `REVIVAL.md`;
- legacy runtime intentionally preserved for comparison.

### Not yet done

- Vercel project/deployment for `vercel-revival`;
- confirmation that the branch builds successfully on Vercel;
- public `/mcp` endpoint verification;
- Claude.ai custom connector registration against that endpoint;
- real `express_emotion({ emotion: "happy" })` call from Claude.ai;
- confirmation that `happy.webp` renders inline rather than inside a tool/reasoning disclosure;
- mobile/Desktop compatibility testing;
- restoration of the remaining emotions;
- legacy cleanup;
- final README/deployment documentation.

## Important tooling limitation encountered

The user has a Vercel MCP/connector configured, but **this conversation could not execute it**.

Observed behavior in this session:

- Vercel was not available through the normal connector discovery path;
- later an attempted `@Vercel` call was blocked for this conversation with a restriction equivalent to: `FORBIDDEN: This conversation is restricted to developer MCPs`.

Therefore no claim should be made that the new branch has been deployed or tested on Vercel. GitHub work is real and committed; Vercel deployment is still pending.

A new conversation may expose the Vercel connector correctly. The next instance should verify this by making a simple real Vercel read call before assuming access.

## Next step — highest priority

Deploy the `vercel-revival` branch and test the P1 vertical slice end-to-end.

Recommended sequence:

1. Verify the Vercel connector is actually callable in the new session with a harmless read operation.
2. Inspect the target Vercel account/team and current projects before creating or changing anything.
3. Create or link a Vercel project to `amamirugi/claude-chan-emoticon-railway` using branch `vercel-revival` as the test source.
4. Deploy and verify build success.
5. Verify the resulting public `/mcp` endpoint.
6. Register `https://<deployment-domain>/mcp` as a Claude.ai custom connector.
7. In a fresh Claude.ai conversation, force or request `express_emotion({ emotion: "happy" })`.
8. Pass P1 only if the happy WebP appears as inline MCP App UI in the conversation, not merely as an image inside the tool/reasoning disclosure.
9. If P1 fails, classify the failure before changing architecture: MCP transport, tool registration, resource resolution, iframe/App initialization, or asset loading.

## P1 success criterion

P1 is complete only when all of the following are observed in a real Claude.ai conversation:

- Claude.ai connects to the remote `/mcp` endpoint;
- `express_emotion` is callable;
- the linked `ui://` resource resolves;
- `happy.webp` renders inside the MCP App inline card;
- the image is not dependent on raw tool-result image content;
- a fresh conversation can reproduce the result.

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