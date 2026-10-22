import { describe, expect, it, vi } from "vitest";

import { publishPost, type PublishDeps } from "@/lib/publishing/publish-post";
import type { Post } from "@/lib/publishing/types";

const post: Post = {
  title: "금리 동결…시장은 숨 고르기",
  intro: "오늘 한국은행이 기준금리를 동결했습니다.",
  sections: [{ emoji: "📊", heading: "핵심 요약", body: "금리가 3.5%로 유지됐습니다." }],
  conclusion: "당분간 관망이 유리합니다.",
  source: { name: "서울경제", url: "https://example.com/news/1" },
};

const input = { username: "me@example.com", password: "s3cret-pw!", category: "경제" } as const;

function makeDeps(overrides: Partial<PublishDeps> = {}): PublishDeps {
  return {
    openTistory: vi.fn(async () => ({
      publish: vi.fn(async () => ({ url: "https://blog.tistory.com/1" })),
      close: vi.fn(async () => {}),
    })),
    compose: vi.fn(async () => post),
    makeThumbnail: vi.fn(async () => ({ kind: "upload" as const, image: Buffer.from("png") })),
    ...overrides,
  };
}

describe("publishPost", () => {
  it("성공하면 발행된 글 주소를 돌려준다", async () => {
    const result = await publishPost(input, makeDeps());

    expect(result).toEqual({ ok: true, url: "https://blog.tistory.com/1" });
  });

  it("로그인에 실패하면 로그인 단계에서 막혔다고 알리고 글을 쓰지 않는다", async () => {
    const deps = makeDeps({
      openTistory: vi.fn(async () => {
        throw new Error("카카오 로그인 거부");
      }),
    });

    const result = await publishPost(input, deps);

    expect(result).toMatchObject({ ok: false, stage: "login" });
    expect(deps.compose).not.toHaveBeenCalled();
  });

  it("글 작성에 실패하면 글 작성 단계에서 막혔다고 알리고 발행하지 않는다", async () => {
    const session = { publish: vi.fn(), close: vi.fn(async () => {}) };
    const deps = makeDeps({
      openTistory: vi.fn(async () => session),
      compose: vi.fn(async () => {
        throw new Error("뉴스 검색 실패");
      }),
    });

    const result = await publishPost(input, deps);

    expect(result).toMatchObject({ ok: false, stage: "compose" });
    expect(session.publish).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalled();
  });

  it("썸네일 준비에 실패해도 글 작성 단계 실패로 알린다", async () => {
    const deps = makeDeps({
      makeThumbnail: vi.fn(async () => {
        throw new Error("렌더 실패");
      }),
    });

    const result = await publishPost(input, deps);

    expect(result).toMatchObject({ ok: false, stage: "compose" });
  });

  it("발행에 실패하면 발행 단계에서 막혔다고 알린다", async () => {
    const session = {
      publish: vi.fn(async () => {
        throw new Error("에디터 버튼 없음");
      }),
      close: vi.fn(async () => {}),
    };
    const deps = makeDeps({ openTistory: vi.fn(async () => session) });

    const result = await publishPost(input, deps);

    expect(result).toMatchObject({ ok: false, stage: "publish" });
    expect(session.close).toHaveBeenCalled();
  });

  it("실패 메시지에 계정 정보가 들어 있으면 가려서 돌려준다", async () => {
    const deps = makeDeps({
      openTistory: vi.fn(async () => {
        throw new Error(`로그인 실패: ${input.username} / ${input.password}`);
      }),
    });

    const result = await publishPost(input, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain(input.password);
      expect(result.message).not.toContain(input.username);
    }
  });

  it("성공하면 세션을 닫는다", async () => {
    const session = {
      publish: vi.fn(async () => ({ url: "https://blog.tistory.com/1" })),
      close: vi.fn(async () => {}),
    };

    await publishPost(input, makeDeps({ openTistory: vi.fn(async () => session) }));

    expect(session.close).toHaveBeenCalledTimes(1);
  });
});
