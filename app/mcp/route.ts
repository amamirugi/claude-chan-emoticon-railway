import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

const UI_VERSION = "2026-07-25-p1-bridge-fix-1";
const RESOURCE_URI = `ui://claude-chan-emoticon/index.html?v=${UI_VERSION}`;

async function fetchPageHtml(): Promise<string> {
  const response = await fetch(baseURL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load MCP App HTML: ${response.status}`);
  }
  return response.text();
}

const handler = createMcpHandler(async (server) => {
  registerAppResource(
    server,
    "claude-chan-emoticon-viewer",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await fetchPageHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [baseURL],
                resourceDomains: [baseURL],
              },
            },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "express_emotion",
    {
      title: "감정 표현",
      description:
        "Claude-chan 이모티콘을 대화 안의 MCP App으로 표시한다. 현재 P1에서는 happy만 지원한다.",
      inputSchema: {
        emotion: z.literal("happy").describe("P1 고정 감정: happy"),
        description: z
          .string()
          .max(80)
          .optional()
          .describe("이미지 아래에 표시할 짧은 설명"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
      },
    },
    async ({ emotion, description }) => ({
      content: [
        {
          type: "text" as const,
          text: `Displayed Claude-chan emotion: ${emotion}`,
        },
      ],
      structuredContent: {
        emotion,
        description: description ?? "기뻐요!",
      },
    }),
  );
});

export const GET = handler;
export const POST = handler;
