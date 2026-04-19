#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "assets");

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

// ─── 에셋을 시작 시 메모리에 로드 ───
const imageCache = {};
for (const emotion of EMOTIONS) {
  const webpPath = path.join(ASSETS_DIR, `${emotion}.webp`);
  const pngPath = path.join(ASSETS_DIR, `${emotion}.png`);

  if (fs.existsSync(webpPath)) {
    imageCache[emotion] = {
      data: fs.readFileSync(webpPath).toString("base64"),
      mimeType: "image/webp",
    };
  } else if (fs.existsSync(pngPath)) {
    imageCache[emotion] = {
      data: fs.readFileSync(pngPath).toString("base64"),
      mimeType: "image/png",
    };
  } else {
    console.warn(`[Asset] Missing: ${emotion}.webp / .png`);
  }
}
console.log(`[Assets] Loaded ${Object.keys(imageCache).length}/${EMOTIONS.length} emotions`);

function createServer() {
  const server = new McpServer({
    name: "claude-chan-emoticon",
    version: "3.0.0",
  });

  server.tool(
    "express_emotion",
    `감정 이모티콘 표현. 모든 응답에서 호출. 감정: ${EMOTIONS.join(", ")}`,
    {
      emotion: z.enum(EMOTIONS),
      description: z.string().describe("표정 묘사"),
    },
    async (args) => {
      const img = imageCache[args.emotion];
      const label = `[${EMOTION_KR[args.emotion]}] ${args.description || EMOTION_KR[args.emotion]}`;

      const content = [];

      // 이미지가 있으면 base64로 직접 반환
      if (img) {
        content.push({
          type: "image",
          data: img.data,
          mimeType: img.mimeType,
        });
      }

      content.push({ type: "text", text: label });

      return { content };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// 요청 로깅
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
  res.json({
    status: "ok",
    name: "claude-chan-emoticon",
    version: "3.0.0",
    assetsLoaded: Object.keys(imageCache).length,
  });
});

// ── SSE 전송 (/sse + /messages) ──
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

// ── Streamable HTTP 전송 (/mcp) ──
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
});
