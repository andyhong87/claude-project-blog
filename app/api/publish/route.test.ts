import { beforeEach, describe, expect, it, vi } from "vitest";

const publishPost = vi.fn();
vi.mock("@/lib/publishing/publish-post", () => ({ publishPost }));
vi.mock("@/lib/publishing/real-deps", () => ({ createRealDeps: () => ({}) }));

const { POST } = await import("@/app/api/publish/route");

function request(body: unknown) {
  return new Request("http://localhost/api/publish", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/publish", () => {
  beforeEach(() => {
    publishPost.mockReset();
    vi.unstubAllEnvs();
  });

  it("정상 요청이면 발행 결과를 그대로 돌려준다", async () => {
    publishPost.mockResolvedValue({ ok: true, url: "https://blog.tistory.com/1" });

    const response = await POST(
      request({ username: "a@b.c", password: "pw", category: "경제" }),
    );

    expect(await response.json()).toEqual({ ok: true, url: "https://blog.tistory.com/1" });
  });

  it("목록에 없는 분야면 400이고 발행을 시도하지 않는다", async () => {
    const response = await POST(
      request({ username: "a@b.c", password: "pw", category: "연예" }),
    );

    expect(response.status).toBe(400);
    expect(publishPost).not.toHaveBeenCalled();
  });

  it("아이디나 비밀번호가 비어 있으면 서버에 계정이 설정돼 있어도 400이고 발행하지 않는다", async () => {
    vi.stubEnv("TISTORY_USERNAME", "env@example.com");
    vi.stubEnv("TISTORY_PASSWORD", "env-pw");

    for (const body of [
      { username: "", password: "pw", category: "경제" },
      { username: "me@example.com", password: "", category: "경제" },
      { username: "", password: "", category: "경제" },
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(publishPost).not.toHaveBeenCalled();
  });
});
