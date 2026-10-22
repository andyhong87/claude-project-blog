import { publishPost } from "@/lib/publishing/publish-post";
import { createRealDeps } from "@/lib/publishing/real-deps";
import { CATEGORIES, type Category } from "@/lib/publishing/types";

export const runtime = "nodejs";
// 로그인, 뉴스 검색, 글 작성, 발행을 한 요청에서 끝내므로 오래 걸린다.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
    category?: unknown;
  } | null;

  const { username, password, category } = body ?? {};
  if (
    typeof username !== "string" ||
    !username ||
    typeof password !== "string" ||
    !password ||
    !CATEGORIES.includes(category as Category)
  ) {
    return Response.json(
      { ok: false, message: "아이디, 비밀번호, 분야를 모두 입력하세요" },
      { status: 400 },
    );
  }

  const result = await publishPost(
    { username, password, category: category as Category },
    createRealDeps(),
  );
  // 결과에는 계정 정보가 가려진 메시지만 들어 있다.
  console.info("[publish]", JSON.stringify(result));
  return Response.json(result);
}
