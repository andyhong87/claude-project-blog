import Anthropic from "@anthropic-ai/sdk";

import { buildPrompt, outletOf } from "@/lib/publishing/compose-prompt";
import type { ComposeDeps } from "@/lib/publishing/compose-post";

const MODEL = "claude-sonnet-5-5";

type SearchResult = { url: string; title: string };

// 검색 도구가 실제로 찾은 기사만 출처로 인정한다. 모델이 쓴 주소는 지어낸 것일 수 있다.
export function pickSource(
  modelSource: { name?: string; url?: string } | undefined,
  results: SearchResult[],
): { name: string; url: string } {
  if (results.length === 0) {
    throw new Error("검색 결과에서 근거가 된 기사를 찾지 못했습니다");
  }
  const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");
  const chosen =
    results.find((r) => r.url === modelSource?.url) ??
    results.find((r) => outletOf(hostOf(r.url))) ??
    results[0];
  const host = hostOf(chosen.url);
  return { name: outletOf(host) || host, url: chosen.url };
}

function searchResultsOf(content: Anthropic.Beta.BetaContentBlock[]): SearchResult[] {
  return content.flatMap((block) =>
    block.type === "web_search_tool_result" && Array.isArray(block.content)
      ? block.content.map((r) => ({ url: r.url, title: r.title }))
      : [],
  );
}

export function createComplete(
  client: Anthropic = new Anthropic(),
): ComposeDeps["complete"] {
  return async (request) => {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: buildPrompt(request) },
    ];
    const results: SearchResult[] = [];

    // 검색 도구가 한 번에 끝내지 못하면 pause_turn으로 멈추므로 이어서 보낸다.
    for (let turn = 0; turn < 5; turn++) {
      const response = await client.beta.messages
        .stream({
          model: MODEL,
          max_tokens: 16000,
          // 안전 분류기가 거절하면 서버가 거절 유형에 맞는 다른 모델로 이어서 답하게 한다.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
          messages,
        })
        .finalMessage();
      results.push(...searchResultsOf(response.content));

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal") {
        throw new Error("모델이 이 요청에 응답하지 않았습니다");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("글이 길어 중간에 끊겼습니다");
      }

      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end <= start) return text;

      const post = JSON.parse(text.slice(start, end + 1)) as {
        source?: { name?: string; url?: string };
      };
      post.source = pickSource(post.source, results);
      return JSON.stringify(post);
    }
    throw new Error("뉴스 검색이 끝나지 않았습니다");
  };
}
