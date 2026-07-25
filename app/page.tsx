"use client";

import Image from "next/image";
import happyImg from "../assets/happy.webp";
import { useMcpApp } from "./hooks/use-mcp-app";

export default function Home() {
  const { connected, toolInput, toolResult } = useMcpApp();
  const data = (toolResult ?? toolInput) as Record<string, unknown> | null;
  const emotion = data?.emotion;
  const description = data?.description;
  const showHappy = emotion === "happy";

  return (
    <main>
      {showHappy ? (
        <>
          <Image
            className="emotion-image"
            src={happyImg}
            alt="Claude-chan happy emoticon"
            priority
          />
          <p className="label">
            {typeof description === "string" && description.length > 0
              ? description
              : "기뻐요!"}
          </p>
        </>
      ) : (
        <p className="waiting">
          {connected ? "감정 호출을 기다리는 중..." : "MCP host 연결 대기 중..."}
        </p>
      )}
    </main>
  );
}
