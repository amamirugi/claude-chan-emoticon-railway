"use client";

import { useSyncExternalStore } from "react";
import type { App } from "@modelcontextprotocol/ext-apps";

const STORAGE = {
  INPUT: "__mcp_tool_input",
  RESULT: "__mcp_tool_result",
  CONNECTED: "__mcp_connected",
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable in some hosts.
  }
}

let memConnected = read<boolean>(STORAGE.CONNECTED) ?? false;
let memToolInput = read<Record<string, unknown>>(STORAGE.INPUT);
let memToolResult = read<Record<string, unknown>>(STORAGE.RESULT);

const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let singletonApp: App | null = null;

async function ensureConnected() {
  if (singletonApp) return;

  const { App } = await import("@modelcontextprotocol/ext-apps");
  const app = new App(
    { name: "claude-chan-emoticon-viewer", version: "0.1.0" },
    {},
    { autoResize: true },
  );

  app.ontoolinput = (params) => {
    memToolInput = params.arguments ?? null;
    write(STORAGE.INPUT, memToolInput);
    notify();
  };

  app.ontoolresult = (result) => {
    memToolResult =
      (result.structuredContent as Record<string, unknown>) ?? null;
    write(STORAGE.RESULT, memToolResult);
    notify();
  };

  app.onerror = (error) => {
    console.error("[claude-chan] MCP App error", error);
  };

  try {
    await app.connect();
    singletonApp = app;
    memConnected = true;
    write(STORAGE.CONNECTED, true);
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
    () => memConnected,
    () => false,
  );
  const toolInput = useSyncExternalStore(
    subscribe,
    () => memToolInput,
    () => null,
  );
  const toolResult = useSyncExternalStore(
    subscribe,
    () => memToolResult,
    () => null,
  );

  return { app: singletonApp, connected, toolInput, toolResult };
}
