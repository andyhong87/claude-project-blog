import { describe, expect, it, vi } from "vitest";

import { composePost, withFallback } from "@/lib/publishing/compose-post";

const draft = {
  title: "금리 동결…시장은 숨 고르기",
  intro: "오늘 한국은행이 기준금리를 동결했습니다.",
  sections: [{ emoji: "📊", heading: "핵심 요약", body: "금리가 3.5%로 유지됐습니다." }],
  conclusion: "결국 방향은 물가가 정합니다.",
  source: { name: "서울경제", url: "https://example.com/news/1" },
};

describe("withFallback", () => {
  const request = { category: "경제" as const };

  it("기본 모델이 성공하면 대체 모델을 부르지 않는다", async () => {
    const primary = vi.fn(async () => "gemini");
    const fallback = vi.fn(async () => "claude");

    const result = await withFallback(primary, fallback)(request);

    expect(result).toBe("gemini");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("기본 모델이 실패하면 같은 요청으로 대체 모델을 부른다", async () => {
    const primary = vi.fn(async () => {
      throw new Error("Gemini가 일시적으로 응답하지 않습니다 (503)");
    });
    const fallback = vi.fn(async () => "claude");

    const result = await withFallback(primary, fallback)(request);

    expect(result).toBe("claude");
    expect(fallback).toHaveBeenCalledWith(request);
  });

  it("대체 모델이 없으면 기본 모델의 오류를 그대로 낸다", async () => {
    const primary = vi.fn(async () => {
      throw new Error("503");
    });

    await expect(withFallback(primary, undefined)(request)).rejects.toThrow("503");
  });

  it("둘 다 실패하면 두 오류를 함께 알린다", async () => {
    const primary = vi.fn(async () => {
      throw new Error("Gemini 503");
    });
    const fallback = vi.fn(async () => {
      throw new Error("Claude 529");
    });

    await expect(withFallback(primary, fallback)(request)).rejects.toThrow(
      /Gemini 503.*Claude 529/,
    );
  });
});

describe("composePost", () => {
  it("모델이 돌려준 JSON을 글로 읽는다", async () => {
    const complete = vi.fn(async () => JSON.stringify(draft));

    const post = await composePost("경제", { complete });

    expect(post).toEqual(draft);
  });

  it("선택한 분야를 요청에 담는다", async () => {
    const complete = vi.fn(async (_request: { category: string }) =>
      JSON.stringify(draft),
    );

    await composePost("IT·기술", { complete });

    expect(complete.mock.calls[0][0].category).toBe("IT·기술");
  });

  it("본문이 2,000자를 넘으면 줄여 달라고 한 번 다시 요청한다", async () => {
    const long = { ...draft, intro: "가".repeat(2100) };
    const complete = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(long))
      .mockResolvedValueOnce(JSON.stringify(draft));

    const post = await composePost("경제", { complete });

    expect(post).toEqual(draft);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][0].shortenFrom).toBeGreaterThan(2000);
  });

  it("다시 요청해도 2,000자를 넘으면 실패한다", async () => {
    const long = { ...draft, intro: "가".repeat(2100) };
    const complete = vi.fn(async () => JSON.stringify(long));

    await expect(composePost("경제", { complete })).rejects.toThrow("2000");
  });

  it("원문 출처가 없으면 실패한다", async () => {
    const complete = vi.fn(async () =>
      JSON.stringify({ ...draft, source: { name: "", url: "" } }),
    );

    await expect(composePost("경제", { complete })).rejects.toThrow("출처");
  });

  it("JSON이 아닌 응답이면 실패한다", async () => {
    const complete = vi.fn(async () => "죄송합니다, 쓸 수 없습니다");

    await expect(composePost("경제", { complete })).rejects.toThrow();
  });
});
