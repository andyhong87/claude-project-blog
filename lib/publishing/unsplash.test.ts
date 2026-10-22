import { describe, expect, it, vi } from "vitest";

import { findPhoto } from "@/lib/publishing/unsplash";

const result = {
  id: "abc",
  alt_description: "stock chart",
  urls: { regular: "https://images.unsplash.com/photo-1?w=1080" },
  user: { name: "Markus Spiske", links: { html: "https://unsplash.com/@markusspiske" } },
  links: {
    html: "https://unsplash.com/photos/abc",
    download_location: "https://api.unsplash.com/photos/abc/download?ixid=1",
  },
};

function fetchReturning(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response);
}

describe("findPhoto", () => {
  it("검색 결과 첫 사진의 주소와 작가 정보를 돌려준다", async () => {
    const fetch = fetchReturning({ results: [result] });

    const photo = await findPhoto("interest rate", { accessKey: "key", fetch });

    expect(photo).toMatchObject({
      url: "https://images.unsplash.com/photo-1?w=1080",
      alt: "stock chart",
      photographer: "Markus Spiske",
    });
  });

  it("작가와 Unsplash 링크에 출처 추적용 utm 값을 붙인다", async () => {
    const fetch = fetchReturning({ results: [result] });

    const photo = await findPhoto("interest rate", { accessKey: "key", fetch });

    expect(photo?.photographerUrl).toBe(
      "https://unsplash.com/@markusspiske?utm_source=tistory_autopost&utm_medium=referral",
    );
    expect(photo?.unsplashUrl).toBe(
      "https://unsplash.com/?utm_source=tistory_autopost&utm_medium=referral",
    );
  });

  it("사진을 쓰면 Unsplash 다운로드 집계 주소를 호출한다", async () => {
    const fetch = fetchReturning({ results: [result] });

    await findPhoto("interest rate", { accessKey: "key", fetch });

    const urls = fetch.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls).toContain("https://api.unsplash.com/photos/abc/download?ixid=1");
  });

  it("검색어를 담아 가로 사진을 요청하고 키를 헤더로 보낸다", async () => {
    const fetch = fetchReturning({ results: [result] });

    await findPhoto("oil price", { accessKey: "key", fetch });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("query=oil+price");
    expect(url).toContain("orientation=landscape");
    expect((init.headers as Record<string, string>).Authorization).toBe("Client-ID key");
  });

  it("키가 없으면 검색하지 않고 null을 돌려준다", async () => {
    const fetch = fetchReturning({ results: [result] });

    const photo = await findPhoto("x", { accessKey: "", fetch });

    expect(photo).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("결과가 없거나 요청이 실패하면 null을 돌려준다", async () => {
    expect(
      await findPhoto("x", { accessKey: "key", fetch: fetchReturning({ results: [] }) }),
    ).toBeNull();
    expect(
      await findPhoto("x", { accessKey: "key", fetch: fetchReturning({}, false) }),
    ).toBeNull();
    expect(
      await findPhoto("x", {
        accessKey: "key",
        fetch: vi.fn(async () => {
          throw new Error("network");
        }),
      }),
    ).toBeNull();
  });
});
