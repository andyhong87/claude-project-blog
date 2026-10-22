import { createComplete as createClaudeComplete } from "@/lib/publishing/claude-complete";
import { composePost, withFallback } from "@/lib/publishing/compose-post";
import { createComplete as createGeminiComplete } from "@/lib/publishing/gemini-complete";
import type { PublishDeps } from "@/lib/publishing/publish-post";
import { renderThumbnail } from "@/lib/publishing/thumbnail";
import { openTistory } from "@/lib/publishing/tistory";
import { findPhoto } from "@/lib/publishing/unsplash";

// 요청 한 번마다 새로 만든다. 대체 제목 카드는 로그인한 브라우저를 그대로 써서 만든다.
export function createRealDeps(): PublishDeps {
  let session: Awaited<ReturnType<typeof openTistory>> | undefined;
  // Gemini로 먼저 쓰고, Gemini가 실패했을 때만 Claude로 다시 쓴다(ANTHROPIC_API_KEY가 있을 때).
  const complete = withFallback(
    createGeminiComplete(),
    process.env.ANTHROPIC_API_KEY ? createClaudeComplete() : undefined,
  );

  return {
    async openTistory(credentials) {
      session = await openTistory(credentials);
      return session;
    },
    compose: (category) => composePost(category, { complete }),
    async makeThumbnail(post) {
      // 글 내용에 맞는 Unsplash 사진을 먼저 찾고, 키가 없거나 결과가 없으면 제목 카드로 대신한다.
      const photo = await findPhoto(post.imageQuery || post.title, {
        accessKey: process.env.UNSPLASH_ACCESS_KEY,
        fetch,
      });
      if (photo) return { kind: "photo", photo };
      console.warn(
        "[thumbnail] Unsplash 사진을 찾지 못해 제목 카드로 대신합니다",
        JSON.stringify({
          keySet: Boolean(process.env.UNSPLASH_ACCESS_KEY),
          query: post.imageQuery ?? null,
        }),
      );

      if (!session) throw new Error("브라우저가 열려 있지 않습니다");
      return { kind: "upload", image: await renderThumbnail(session.browser, post) };
    },
  };
}
