import type { Browser } from "playwright-core";

import type { Post } from "@/lib/publishing/types";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// 글 제목을 담은 1200x630 카드 이미지를 만든다.
export async function renderThumbnail(
  browser: Browser,
  post: Post,
): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  try {
    await page.setContent(`
      <style>
        body { margin: 0; width: 1200px; height: 630px; display: flex; flex-direction: column;
          justify-content: center; gap: 28px; padding: 0 90px; box-sizing: border-box;
          background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #fff;
          font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
        .tag { font-size: 30px; opacity: .75; letter-spacing: 2px; }
        h1 { margin: 0; font-size: 64px; line-height: 1.3; word-break: keep-all; }
      </style>
      <div class="tag">${escapeHtml(post.sections[0]?.emoji ?? "📰")} NEWS BRIEFING</div>
      <h1>${escapeHtml(post.title)}</h1>
    `);
    return await page.screenshot({ type: "png" });
  } finally {
    await page.close();
  }
}
