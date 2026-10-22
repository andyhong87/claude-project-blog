import { describe, expect, it } from "vitest";

import { bodyLength, buildPostHtml, photoHtml } from "@/lib/publishing/post-html";
import type { Post } from "@/lib/publishing/types";

const post: Post = {
  title: "금리 동결…시장은 숨 고르기",
  intro: "오늘 한국은행이 기준금리를 동결했습니다.",
  sections: [
    { emoji: "📊", heading: "핵심 요약", body: "금리가 3.5%로 유지됐습니다." },
    { emoji: "🔮", heading: "전망", body: "당분간 관망세가 이어질 전망입니다." },
  ],
  conclusion: "결국 방향은 물가가 정합니다.",
  source: { name: "서울경제", url: "https://example.com/news/1" },
};

describe("buildPostHtml", () => {
  it("썸네일을 본문 맨 위에 넣는다", () => {
    const html = buildPostHtml(post, '<img src="thumb.png" alt="썸네일">');

    expect(html.startsWith('<img src="thumb.png" alt="썸네일">')).toBe(true);
  });

  it("섹션마다 이모지가 붙은 소제목을 만든다", () => {
    const html = buildPostHtml(post, "");

    expect(html).toContain("<h2>📊 핵심 요약</h2>");
    expect(html).toContain("<h2>🔮 전망</h2>");
  });

  it("마지막에 원문 출처 링크를 넣는다", () => {
    const html = buildPostHtml(post, "");

    expect(html.trimEnd().endsWith("</p>")).toBe(true);
    expect(html).toContain('<a href="https://example.com/news/1"');
    expect(html).toContain("서울경제");
  });

  it("본문에 들어간 HTML 특수문자는 이스케이프한다", () => {
    const html = buildPostHtml(
      { ...post, intro: "<script>alert(1)</script>" },
      "",
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("photoHtml", () => {
  const photo = {
    url: "https://images.unsplash.com/photo-1?w=1080",
    alt: "stock chart",
    photographer: "Markus Spiske",
    photographerUrl: "https://unsplash.com/@markusspiske?utm_source=tistory_autopost&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/?utm_source=tistory_autopost&utm_medium=referral",
  };

  it("Unsplash 사진 주소를 그대로 이미지로 건다", () => {
    expect(photoHtml(photo)).toContain(
      '<img src="https://images.unsplash.com/photo-1?w=1080" alt="stock chart"',
    );
  });

  it("사진 아래에 작가와 Unsplash 링크가 있는 출처를 표기한다", () => {
    const html = photoHtml(photo);

    expect(html).toContain("Photo by");
    expect(html).toContain(
      '<a href="https://unsplash.com/@markusspiske?utm_source=tistory_autopost&amp;utm_medium=referral"',
    );
    expect(html).toContain(">Markus Spiske</a>");
    expect(html).toContain(">Unsplash</a>");
  });
});

describe("bodyLength", () => {
  it("제목과 출처를 뺀 본문 글자 수를 센다", () => {
    const small: Post = {
      title: "제목은 세지 않는다",
      intro: "가나다",
      sections: [{ emoji: "📊", heading: "라마", body: "바사" }],
      conclusion: "아자",
      source: { name: "출처", url: "https://example.com" },
    };

    // intro 3 + heading 2 + body 2 + conclusion 2
    expect(bodyLength(small)).toBe(9);
  });
});
