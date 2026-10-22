import { ApiError, GoogleGenAI } from "@google/genai";

import { buildPrompt, outletOf } from "@/lib/publishing/compose-prompt";
import type { ComposeDeps } from "@/lib/publishing/compose-post";

const DEFAULT_MODEL = "gemini-2.5-flash";

// 과부하(503)나 요청 한도(429)는 잠시 뒤 다시 시도하면 대개 풀린다.
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  // 실패하면 Claude로 넘어가므로 오래 붙잡지 않는다.
  const delays = [5000, 10000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      const transient = status === 429 || status >= 500;
      if (!transient || attempt >= delays.length) {
        throw new Error(
          transient
            ? `Gemini가 일시적으로 응답하지 않습니다 (${status}). 잠시 후 다시 시도하세요`
            : error instanceof Error
              ? error.message
              : String(error),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

// 검색 근거가 되는 링크는 구글이 중계 주소로 돌려주므로, 가능하면 실제 기사 주소로 풀어 둔다.
async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return response.url || url;
  } catch {
    return url;
  }
}

export function createComplete(
  ai: GoogleGenAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
): ComposeDeps["complete"] {
  return async (request) => {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        contents: buildPrompt(request),
        config: { tools: [{ googleSearch: {} }] },
      }),
    );

    const text = response.text;
    if (!text) throw new Error("모델이 빈 응답을 돌려줬습니다");

    // 검색 도구가 실제로 찾은 기사만 출처로 인정한다. 모델이 쓴 주소는 지어낸 것일 수 있다.
    const chunks = (
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
    ).filter((chunk) => chunk.web?.uri);
    if (chunks.length === 0) {
      throw new Error("검색 결과에서 근거가 된 기사를 찾지 못했습니다");
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return text;

    const post = JSON.parse(text.slice(start, end + 1)) as {
      source?: { name?: string; url?: string };
    };
    // 근거의 title은 도메인(예: yna.co.kr)이다. 주요 언론사 근거를 먼저 고르고,
    // 이름도 그 도메인으로 붙여 이름과 주소가 늘 같은 기사를 가리키게 한다.
    const matched =
      chunks.find((chunk) => outletOf(chunk.web?.title)) ?? chunks[0];
    const domain = matched.web?.title ?? "";
    post.source = {
      name: outletOf(domain) || domain || "원문",
      url: await resolveRedirect(matched.web!.uri!),
    };
    return JSON.stringify(post);
  };
}
