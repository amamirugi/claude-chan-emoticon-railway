#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");

const EMOTIONS = [
  "neutral", "happy", "embarrassed", "sad",
  "angry", "surprised", "love", "smug",
  "confused", "crying", "excited", "proud",
  "scared", "sleepy", "thinking", "tired",
  "dead", "disappointed", "disgusted", "facepalm",
  "laughing", "nervous", "pout", "speechless",
  "wink", "chu",
];

const EMOTION_KR = {
  neutral: "기본", happy: "기쁨", embarrassed: "당황", sad: "슬픔",
  angry: "화남", surprised: "놀람", love: "사랑", smug: "득의",
  confused: "혼란", crying: "울음", excited: "신남", proud: "자랑",
  scared: "무서움", sleepy: "졸림", thinking: "생각", tired: "피곤",
  dead: "사망", disappointed: "실망", disgusted: "역겨움", facepalm: "한심",
  laughing: "폭소", nervous: "초조", pout: "삐짐", speechless: "말문막힘",
  wink: "윙크", chu: "뽀뽀",
};

const RESOURCE_URI = "ui://claude-chan-emoticon/app";

function createServer() {
  const server = new McpServer({
    name: "claude-chan-emoticon",
    version: "3.0.0",
  });

  registerAppTool(server, "express_emotion", {
    title: "감정 표현",
    description: `감정 이모티콘 표현. 모든 응답에서 호출. 감정: ${EMOTIONS.join(", ")}`,
    inputSchema: {
      emotion: z.enum(EMOTIONS),
      description: z.string().describe("표정 묘사"),
    },
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  }, async (args) => ({
    content: [
      { type: "text", text: `__emotion__:${args.emotion}` },
      { type: "text", text: `[${EMOTION_KR[args.emotion]}] ${args.description || EMOTION_KR[args.emotion]}` },
    ],
  }));

  server.resource(
    "감정 뷰어", RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const htmlPath = path.join(DIST_DIR, "index.html");
      if (!fs.existsSync(htmlPath)) {
        console.error(`[Resource] dist/index.html not found at ${htmlPath}`);
        return {
          contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: "<html><body>Build not found</body></html>" }],
        };
      }
      const html = fs.readFileSync(htmlPath, "utf-8");
      return {
        contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// 모든 요청 로깅 (디버깅용)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id, mcp-protocol-version");
  res.header("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "claude-chan-emoticon", version: "3.0.0" });
});

// OAuth 메타데이터 (claude.ai 커넥터가 자주 확인함, 공개 서버이므로 404로 응답)
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.status(404).json({ error: "not_supported" });
});
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.status(404).json({ error: "not_supported" });
});

// ═══════════════════════════════════════
// SSE 전송 (/sse + /messages)
// ═══════════════════════════════════════
const sseTransports = new Map();

app.get("/sse", async (req, res) => {
  console.log("[SSE] New connection");
  try {
    const transport = new SSEServerTransport("/messages", res);
    sseTransports.set(transport.sessionId, transport);

    transport.onclose = () => {
      console.log(`[SSE] Closed: ${transport.sessionId}`);
      sseTransports.delete(transport.sessionId);
    };

    const server = createServer();
    await server.connect(transport);
    console.log(`[SSE] Connected: ${transport.sessionId}`);
  } catch (e) {
    console.error("[SSE] Error:", e);
    if (!res.headersSent) res.status(500).end();
  }
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseTransports.get(sessionId);
  if (!transport) {
    console.log(`[SSE] Unknown session: ${sessionId}`);
    res.status(400).json({ error: "Unknown session" });
    return;
  }
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (e) {
    console.error("[SSE] handlePostMessage error:", e);
    if (!res.headersSent) res.status(500).json({ error: String(e) });
  }
});

// ═══════════════════════════════════════
// Streamable HTTP 전송 (/mcp)
// ═══════════════════════════════════════
const httpSessions = new Map();

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];

    if (sessionId && httpSessions.has(sessionId)) {
      const transport = httpSessions.get(sessionId);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    transport.onSessionInitialized = (sid) => {
      console.log(`[HTTP] Session initialized: ${sid}`);
      httpSessions.set(sid, transport);
    };

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        console.log(`[HTTP] Session closed: ${sid}`);
        httpSessions.delete(sid);
      }
    };

    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("[HTTP] Error:", e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: String(e) },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !httpSessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  const transport = httpSessions.get(sessionId);
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && httpSessions.has(sessionId)) {
    const transport = httpSessions.get(sessionId);
    await transport.handleRequest(req, res);
    httpSessions.delete(sessionId);
    return;
  }
  res.status(400).json({ error: "Invalid or missing session ID" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP emoticon server listening on port ${PORT}`);
  console.log(`  SSE transport:  GET /sse`);
  console.log(`  HTTP transport: POST /mcp`);
});
