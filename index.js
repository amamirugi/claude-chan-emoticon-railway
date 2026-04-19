#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

// ─── 감정 목록 (26종, 에셋 파일명과 일치) ───
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

// ─── MCP 서버 생성 ───
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
      const html = fs.readFileSync(path.join(DIST_DIR, "index.html"), "utf-8");
      return {
        contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    }
  );

  return server;
}

// ─── HTTP 서버 (가이드의 stdio 대체) ───
const app = express();
app.use(express.json());

const sessions = new Map();

// health check (Railway / 배포 확인용)
app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "claude-chan-emoticon", version: "3.0.0" });
});

// MCP Streamable HTTP — POST
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  // 기존 세션이 있으면 재사용
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    await transport.handleRequest(req, res);
    return;
  }

  // 새 세션 생성
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  transport.onSessionInitialized = (sid) => {
    sessions.set(sid, transport);
  };

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) sessions.delete(sid);
  };

  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// MCP Streamable HTTP — GET (SSE 스트림)
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  const transport = sessions.get(sessionId);
  await transport.handleRequest(req, res);
});

// MCP Streamable HTTP — DELETE (세션 종료)
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
    return;
  }
  res.status(400).json({ error: "Invalid or missing session ID" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP emoticon server listening on port ${PORT}`);
});
