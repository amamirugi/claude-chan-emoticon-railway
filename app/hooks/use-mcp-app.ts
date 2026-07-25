"use client";

import { useSyncExternalStore } from "react";
import type { App } from "@modelcontextprotocol/ext-apps";

let connectedState = false;
let toolInputState: Record<string, unknown> | null = null;
let toolResultState: Record<string, unknown> | null = null;
let singletonApp: App | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureConnected() {
  if (singletonApp) return;

  const { App } = await import("@modelcontextprotocol/ext-apps");
  const app = new App(
    { name: "claude-chan-emoticon-viewer", version: "0.1.0" },
    {},
    { autoResize: true },
  );

  app.ontoolinput = (params) => {
    toolInputState = params.arguments ?? null;
    notify();
  };

  app.ontoolresult = (result) => {
    toolResultState =
      (result.structuredContent as Record<string, unknown> | undefined) ?? null;
    notify();
  };

  app.onerror = (error) => {
    console.error("[claude-chan] MCP App error", error);
  };

  try {
    await app.connect();
    singletonApp = app;
    connectedState = true;
    notify();
  } catch (error) {
    console.warn("[claude-chan] MCP App bridge unavailable", error);
  }
}

if (typeof window !== "undefined" && window.self !== window.top) {
  void ensureConnected();
}

export function useMcpApp() {
  const connected = useSyncExternalStore(
    subscribe,
    () => connectedState,
    () => false,
  );
  const toolInput = useSyncExternalStore(
    subscribe,
    () => toolInputState,
    () => null,
  );
  const toolResult = useSyncExternalStore(
    subscribe,
    () => toolResultState,
    () => null,
  );

  return { connected, toolInput, toolResult };
}
