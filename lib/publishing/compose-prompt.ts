import type { ComposeRequest } from "@/lib/publishing/compose-post";

// 글 작성 모델(Gemini, Claude)이 함께 쓰는 요청문.
export function buildPrompt({ category, shortenFrom }: ComposeRequest): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `오늘은 ${today}입니다. 한국어 블로그 글 1편을 씁니다.`,
    `분야: ${category}`,
    "",
    "1. 웹 검색으로 이 분야에서 최근 1~2일 안에 나온, 신뢰도 높은 언론사의 뉴스나 기사 하나를 고릅니다. 사실관계는 검색한 기사에 나온 내용만 씁니다.",
    "2. 그 기사를 바탕으로, 15년 경력의 분석가가 독자에게 직접 말하듯(여러분) 전문가의 식견을 담아 씁니다. 권위 있지만 읽기 편한 어조입니다.",
    "3. 구조: title은 원인과 수치를 짝지은 뉴스 헤드라인 형식(예: '전쟁 장기화 우려에 기름값 상승…휘발유 1938원')입니다. intro는 한두 문장의 도입입니다. sections는 4~5개이고 각각 emoji와 heading, body를 가집니다(📊 핵심 요약, 🔍 배경 및 맥락 분석, 📈 영향 분석, 🔮 전망, 💡 시사점 같은 흐름). conclusion은 결론이 분명한 마무리입니다.",
    "4. intro, 각 section의 heading과 body, conclusion을 모두 합쳐 1,800자 이내로 씁니다. 결론이 나도록 끝맺습니다.",
    "5. source에는 근거로 쓴 기사의 언론사 이름(name)과 기사 주소(url)를 넣습니다. 주소를 지어내지 않습니다.",
    "6. 투자 권유로 읽히지 않게 쓰고, 확인되지 않은 수치는 쓰지 않습니다.",
    "7. imageQuery에는 글 주제를 보여 줄 대표 사진을 Unsplash에서 찾을 영어 키워드 2~3단어를 넣습니다(예: 'interest rate', 'oil price').",
    "",
    '응답은 설명 없이 JSON 객체 하나만 씁니다. 형식: {"title": string, "intro": string, "sections": [{"emoji": string, "heading": string, "body": string}], "conclusion": string, "source": {"name": string, "url": string}, "imageQuery": string}',
  ];
  if (shortenFrom) {
    lines.push(
      "",
      `이전 초안은 본문이 ${shortenFrom}자로 너무 길었습니다. 같은 기사로 1,800자 이내로 줄여 다시 씁니다.`,
    );
  }
  return lines.join("\n");
}

// 출처로 우선 고르는 주요 언론사 도메인과 이름.
const TRUSTED_OUTLETS: Record<string, string> = {
  "yna.co.kr": "연합뉴스",
  "newsis.com": "뉴시스",
  "newspim.com": "뉴스핌",
  "news1.kr": "뉴스1",
  "sedaily.com": "서울경제",
  "mk.co.kr": "매일경제",
  "hankyung.com": "한국경제",
  "edaily.co.kr": "이데일리",
  "mt.co.kr": "머니투데이",
  "fnnews.com": "파이낸셜뉴스",
  "fntimes.com": "한국금융신문",
  "heraldcorp.com": "헤럴드경제",
  "asiae.co.kr": "아시아경제",
  "chosun.com": "조선일보",
  "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보",
  "hani.co.kr": "한겨레",
  "khan.co.kr": "경향신문",
  "hankookilbo.com": "한국일보",
  "kbs.co.kr": "KBS",
  "imbc.com": "MBC",
  "sbs.co.kr": "SBS",
  "ytn.co.kr": "YTN",
  "etnews.com": "전자신문",
  "zdnet.co.kr": "ZDNet Korea",
  "bloter.net": "블로터",
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
};

// 도메인(예: m.yna.co.kr)이 주요 언론사면 그 이름을 돌려준다.
export function outletOf(domain = ""): string | undefined {
  const host = domain.replace(/^www\./, "");
  return Object.entries(TRUSTED_OUTLETS).find(
    ([outlet]) => host === outlet || host.endsWith(`.${outlet}`),
  )?.[1];
}
