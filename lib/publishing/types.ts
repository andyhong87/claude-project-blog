export const CATEGORIES = ["경제", "IT·기술", "시사"] as const;

export type Category = (typeof CATEGORIES)[number];

export type PublishStage = "login" | "compose" | "publish";

export type PostSection = {
  emoji: string;
  heading: string;
  body: string;
};

export type Post = {
  title: string;
  intro: string;
  sections: PostSection[];
  conclusion: string;
  source: { name: string; url: string };
  // 썸네일 사진 검색에 쓸 영어 키워드.
  imageQuery?: string;
};

// Unsplash에서 찾은 사진. 파일을 올리지 않고 주소를 그대로 링크(핫링크)한다.
export type Photo = {
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
};

// 글 맨 위에 둘 이미지. 사진을 찾으면 핫링크하고, 못 찾으면 제목 카드를 만들어 올린다.
export type Thumbnail =
  | { kind: "photo"; photo: Photo }
  | { kind: "upload"; image: Buffer };

export type PublishInput = {
  username: string;
  password: string;
  category: Category;
};

export type PublishResult =
  | { ok: true; url: string }
  | { ok: false; stage: PublishStage; message: string };
