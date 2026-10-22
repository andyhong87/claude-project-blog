import { bodyLength, MAX_BODY_LENGTH } from "@/lib/publishing/post-html";
import type { Category, Post } from "@/lib/publishing/types";

export type ComposeRequest = {
  category: Category;
  // 이전 초안이 너무 길 때, 그 초안의 본문 글자 수.
  shortenFrom?: number;
};

export type ComposeDeps = {
  // 뉴스 검색과 글 작성을 거쳐 글 JSON 문자열을 돌려주는 모델 호출.
  complete(request: ComposeRequest): Promise<string>;
};

// 기본 모델(Gemini)이 과부하 등으로 실패할 때만 대체 모델(Claude)로 같은 요청을 다시 보낸다.
export function withFallback(
  primary: ComposeDeps["complete"],
  fallback: ComposeDeps["complete"] | undefined,
): ComposeDeps["complete"] {
  return async (request) => {
    try {
      return await primary(request);
    } catch (primaryError) {
      if (!fallback) throw primaryError;
      const first =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      console.warn("[compose] 기본 모델 실패, 대체 모델로 다시 씁니다:", first);
      try {
        return await fallback(request);
      } catch (fallbackError) {
        const second =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`기본 모델 실패: ${first} / 대체 모델 실패: ${second}`);
      }
    }
  };
}

function parsePost(raw: string): Post {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("글 형식(JSON)이 아닌 응답을 받았습니다");
  }

  const data = JSON.parse(raw.slice(start, end + 1)) as Partial<Post>;
  if (!data.source?.url || !data.source?.name) {
    throw new Error("원문 출처가 없는 글입니다");
  }
  if (!data.title || !data.intro || !data.conclusion || !data.sections?.length) {
    throw new Error("제목, 도입, 섹션, 결론 중 빠진 부분이 있는 글입니다");
  }
  return data as Post;
}

export async function composePost(
  category: Category,
  deps: ComposeDeps,
): Promise<Post> {
  let post = parsePost(await deps.complete({ category }));

  if (bodyLength(post) > MAX_BODY_LENGTH) {
    post = parsePost(
      await deps.complete({ category, shortenFrom: bodyLength(post) }),
    );
  }
  if (bodyLength(post) > MAX_BODY_LENGTH) {
    throw new Error(`본문이 ${MAX_BODY_LENGTH}자를 넘습니다`);
  }
  return post;
}
