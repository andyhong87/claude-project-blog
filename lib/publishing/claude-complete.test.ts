import { describe, expect, it } from "vitest";

import { pickSource } from "@/lib/publishing/claude-complete";

const results = [
  { url: "https://blog.example.com/post/1", title: "어느 블로그" },
  { url: "https://www.yna.co.kr/view/AKR2026102200001", title: "한은 기준금리 동결" },
  { url: "https://www.sedaily.com/article/123", title: "금리 동결 분석" },
];

describe("pickSource", () => {
  it("모델이 고른 주소가 검색 결과에 있으면 그 주소를 쓰고 이름은 언론사 이름으로 붙인다", () => {
    const source = pickSource(
      { name: "서경", url: "https://www.sedaily.com/article/123" },
      results,
    );

    expect(source).toEqual({ name: "서울경제", url: "https://www.sedaily.com/article/123" });
  });

  it("모델이 고른 주소가 검색 결과에 없으면 검색 결과 중 주요 언론사 기사를 쓴다", () => {
    const source = pickSource(
      { name: "연합뉴스", url: "https://www.yna.co.kr/view/MADE-UP" },
      results,
    );

    expect(source).toEqual({
      name: "연합뉴스",
      url: "https://www.yna.co.kr/view/AKR2026102200001",
    });
  });

  it("주요 언론사가 없으면 첫 검색 결과를 쓰고 이름은 도메인으로 붙인다", () => {
    const source = pickSource({ name: "", url: "" }, [results[0]]);

    expect(source).toEqual({ name: "blog.example.com", url: "https://blog.example.com/post/1" });
  });

  it("검색 결과가 없으면 실패한다", () => {
    expect(() => pickSource({ name: "x", url: "https://x.com" }, [])).toThrow("검색");
  });
});
