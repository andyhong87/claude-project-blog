import type { Photo } from "@/lib/publishing/types";

const SEARCH_URL = "https://api.unsplash.com/search/photos";
// Unsplash 이용 규칙상 작가·Unsplash 링크에 앱 이름을 utm_source로 붙인다.
const UTM = "utm_source=tistory_autopost&utm_medium=referral";

type SearchResult = {
  alt_description?: string | null;
  urls: { regular: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

export type UnsplashDeps = {
  accessKey: string | undefined;
  fetch: typeof fetch;
};

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

// 검색어에 맞는 가로 사진 한 장을 찾는다. 찾지 못하면 null을 돌려주고, 호출한 쪽이 대체 이미지를 쓴다.
export async function findPhoto(
  query: string,
  deps: UnsplashDeps,
): Promise<Photo | null> {
  if (!deps.accessKey) return null;

  const headers = {
    Authorization: `Client-ID ${deps.accessKey}`,
    "Accept-Version": "v1",
  };
  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    per_page: "1",
    content_filter: "high",
  });

  try {
    const response = await deps.fetch(`${SEARCH_URL}?${params}`, { headers });
    if (!response.ok) {
      console.warn("[unsplash] 검색 실패", response.status);
      return null;
    }
    const body = (await response.json()) as { results?: SearchResult[] };
    const result = body.results?.[0];
    if (!result) return null;

    // 사진을 쓸 때는 다운로드 집계 주소를 호출해야 한다(Unsplash 이용 규칙).
    await deps
      .fetch(result.links.download_location, { headers })
      .catch(() => undefined);

    return {
      url: result.urls.regular,
      alt: result.alt_description ?? query,
      photographer: result.user.name,
      photographerUrl: withUtm(result.user.links.html),
      unsplashUrl: withUtm("https://unsplash.com/"),
    };
  } catch (error) {
    console.warn("[unsplash] 요청 오류", error instanceof Error ? error.message : error);
    return null;
  }
}
