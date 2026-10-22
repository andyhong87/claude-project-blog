import type { Photo, Post } from "@/lib/publishing/types";

export const MAX_BODY_LENGTH = 2000;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

// 제목과 출처를 뺀, 독자가 읽는 본문의 글자 수.
export function bodyLength(post: Post): number {
  const parts = [
    post.intro,
    ...post.sections.flatMap((s) => [s.heading, s.body]),
    post.conclusion,
  ];
  return parts.reduce((sum, text) => sum + [...text].length, 0);
}

// Unsplash 사진을 핫링크하고 바로 아래에 작가와 Unsplash 출처를 표기한다(Unsplash 이용 규칙).
export function photoHtml(photo: Photo): string {
  const link = (href: string, text: string) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  return [
    `<p><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt)}" /></p>`,
    `<p>Photo by ${link(photo.photographerUrl, photo.photographer)} on ${link(photo.unsplashUrl, "Unsplash")}</p>`,
  ].join("\n");
}

export function buildPostHtml(post: Post, thumbnailHtml: string): string {
  const sections = post.sections
    .map(
      (s) =>
        `<h2>${escapeHtml(s.emoji)} ${escapeHtml(s.heading)}</h2>\n${paragraphs(s.body)}`,
    )
    .join("\n");

  return [
    thumbnailHtml,
    paragraphs(post.intro),
    sections,
    paragraphs(post.conclusion),
    `<p>📌 원문 출처: <a href="${escapeHtml(post.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.source.name)}</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");
}
