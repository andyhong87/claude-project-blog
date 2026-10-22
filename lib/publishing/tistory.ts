import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-core";

import { buildPostHtml, photoHtml } from "@/lib/publishing/post-html";
import type { TistorySession } from "@/lib/publishing/publish-post";
import type { Thumbnail } from "@/lib/publishing/types";

const LOGIN_URL = "https://www.tistory.com/auth/login";
const DEBUG_DIR = path.join(process.cwd(), ".tmp", "tistory-debug");
// 로그인 쿠키가 담긴 세션 파일. .tmp는 git에서 제외된다.
const SESSION_DIR = path.join(process.cwd(), ".tmp", "tistory-session");
const LOGIN_WAIT_MS = 3 * 60 * 1000;

// 실패 지점의 화면을 로컬 폴더(.tmp, git 제외)에 남겨 원인을 볼 수 있게 한다.
async function saveDebugShot(page: Page, name: string): Promise<void> {
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    await page.screenshot({ path: path.join(DEBUG_DIR, `${name}.png`) });
    // 어떤 요소가 있었는지 볼 수 있도록 주소와 페이지 구조(입력 칸, 버튼, iframe)도 남긴다.
    const outline = await page.evaluate(() => {
      const describe = (el: Element) => {
        const e = el as HTMLElement;
        return `${e.tagName.toLowerCase()}#${e.id}.${e.className?.toString().slice(0, 60)} ${(e.innerText ?? "").trim().slice(0, 30)}`;
      };
      return [
        ...document.querySelectorAll("input, button, iframe, [role=button], .CodeMirror"),
      ].map(describe);
    });
    await writeFile(
      path.join(DEBUG_DIR, `${name}.txt`),
      [page.url(), ...outline].join("\n"),
    );
  } catch {
    // 디버그 화면 저장 실패는 본래 오류를 가리지 않는다.
  }
}

async function launchBrowser(): Promise<Browser> {
  // 카카오 로그인은 headless 브라우저를 막을 수 있어 기본은 창을 띄운다.
  const headless = process.env.TISTORY_HEADLESS === "1";
  for (const channel of ["msedge", "chrome"] as const) {
    try {
      return await chromium.launch({ channel, headless });
    } catch {
      // 다음 브라우저를 시도한다.
    }
  }
  throw new Error("Edge 또는 Chrome을 찾지 못해 브라우저를 열 수 없습니다");
}

async function login(
  page: Page,
  credentials: { username: string; password: string },
): Promise<void> {
  await page.goto(LOGIN_URL);
  await page.locator("a.btn_login.link_kakao_id").click();

  await page.locator('input[name="loginId"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').first().click();

  // 캡차가 나오면 사용자가 띄워진 창에서 직접 푼다. 그동안 기다릴 수 있게 넉넉히 둔다.
  // 티스토리 첫 화면은 광고 때문에 load가 오래 걸리므로 주소가 바뀌었는지만 본다.
  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    const url = new URL(page.url());
    if (url.hostname === "www.tistory.com" && !url.pathname.startsWith("/auth")) {
      return;
    }

    const errorShown = await page
      .locator(".txt_error, .error_message, .wrap_error")
      .first()
      .isVisible()
      .catch(() => false);
    if (errorShown && !(await captchaShown(page))) {
      await saveDebugShot(page, "login-failed");
      throw new Error("카카오 로그인에 실패했습니다 (아이디나 비밀번호를 확인하세요)");
    }
    await page.waitForTimeout(1000);
  }

  await saveDebugShot(page, "login-failed");
  throw new Error(
    "카카오 로그인이 끝나지 않았습니다 (캡차나 추가 인증을 창에서 마쳤는지 확인하세요)",
  );
}

// 캡차 화면에서도 안내 문구가 오류 영역에 뜰 수 있어, 그때는 실패로 보지 않고 계속 기다린다.
async function captchaShown(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const text = document.body?.innerText ?? "";
      return (
        /자동입력|보안문자|캡차|captcha|로봇이 아닙니다/i.test(text) ||
        !!document.querySelector('iframe[src*="captcha"], iframe[title*="reCAPTCHA"], [class*="captcha"]')
      );
    })
    .catch(() => false);
}

// 저장된 세션으로 이미 로그인된 상태인지 본다. 로그인 상태면 첫 화면에 내 블로그 "글쓰기" 탭이 있다.
async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto("https://www.tistory.com/", { waitUntil: "domcontentloaded" });
  return page
    .locator("a.link_tab", { hasText: "글쓰기" })
    .first()
    .waitFor({ state: "attached", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
}

// 계정마다 세션 파일을 따로 둔다. 파일 이름에 아이디가 드러나지 않게 해시를 쓴다.
function sessionPath(username: string): string {
  const id = createHash("sha256").update(username).digest("hex").slice(0, 16);
  return path.join(SESSION_DIR, `${id}.json`);
}

async function loadSession(file: string): Promise<string | undefined> {
  try {
    await access(file);
    return file;
  } catch {
    return undefined;
  }
}

async function saveSession(context: BrowserContext, file: string): Promise<void> {
  try {
    await mkdir(SESSION_DIR, { recursive: true });
    await context.storageState({ path: file });
  } catch {
    // 세션 저장에 실패해도 이번 발행은 계속한다. 다음에 다시 로그인하면 된다.
  }
}

type TinyWindow = {
  tinymce: {
    activeEditor: {
      getContent(): string;
      setContent(html: string): void;
      insertContent(html: string): void;
      focus(): void;
      nodeChanged(): void;
      undoManager: { add(): void };
      fire(event: string): void;
    };
  };
};

// 기본 모드에서 이미지를 첨부하면 티스토리가 올리고 본문에 넣어 준다. 그 이미지 코드를 돌려준다.
async function uploadImage(page: Page, image: Buffer): Promise<string> {
  const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
  await page.locator("#mceu_0-open").click();
  await page.locator("#attach-image").click();
  await (await chooser).setFiles({
    name: "thumbnail.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page
    .frameLocator("#editor-tistory_ifr")
    .locator("body img")
    .first()
    .waitFor({ timeout: 30000 });

  // 이미지가 보여도 업로드가 끝나기 전에는 getContent가
  // "이미지 업로드가 완료된 후 시도해 주세요" 오류를 던지므로, 읽힐 때까지 기다린다.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const html = await page.evaluate(() => {
      try {
        return (window as unknown as TinyWindow).tinymce.activeEditor.getContent();
      } catch {
        return "";
      }
    });
    if (html.trim()) return html.trim();
    await page.waitForTimeout(1000);
  }
  throw new Error("썸네일 이미지 업로드가 끝나지 않았습니다");
}

async function downloadImage(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new Error(`대표 이미지로 쓸 사진을 받지 못했습니다 (${response.status})`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") ?? "image/jpeg",
  };
}

// 발행 창의 "대표이미지 추가" 칸에 이미지를 올리고, 미리보기가 뜰 때까지 기다린다.
async function setRepresentativeImage(
  page: Page,
  image: { buffer: Buffer; mimeType: string },
): Promise<void> {
  // 업로드가 끝나면 "대표이미지 추가" 칸이 .thumb_g 미리보기(배경 이미지)로 바뀐다.
  const box = page.locator(".box_thumb").first();
  await box.locator('input[type="file"]').setInputFiles({
    name: `thumbnail.${image.mimeType.includes("png") ? "png" : "jpg"}`,
    mimeType: image.mimeType,
    buffer: image.buffer,
  });
  await box
    .locator('.thumb_g[style*="background-image"]')
    .waitFor({ state: "attached", timeout: 30000 })
    .catch(() => {
      throw new Error("대표 이미지 업로드가 끝나지 않았습니다");
    });
}

// 로그인한 티스토리 첫 화면 상단의 "글쓰기" 탭이 내 블로그 에디터를 가리킨다.
// (첫 화면에는 다른 사람 블로그로 가는 추천 링크도 많아 링크를 넓게 찾으면 안 된다.)
async function newPostUrl(page: Page): Promise<string> {
  await page.goto("https://www.tistory.com/", { waitUntil: "domcontentloaded" });
  const href = await page
    .locator("a.link_tab", { hasText: "글쓰기" })
    .first()
    .getAttribute("href", { timeout: 15000 });
  if (!href || !/\.tistory\.com\/manage\/newpost/.test(href)) {
    throw new Error("내 블로그의 글쓰기 주소를 찾지 못했습니다");
  }
  return href;
}

async function publishOnPage(
  page: Page,
  post: Parameters<TistorySession["publish"]>[0]["post"],
  thumbnail: Thumbnail,
): Promise<string> {
  const editorUrl = await newPostUrl(page);
  const base = new URL(editorUrl).origin;

  // 이전 임시저장 글 불러오기 같은 확인 창은 새로 쓰기 위해 거절한다.
  page.on("dialog", (dialog) => {
    dialog.dismiss().catch(() => {});
  });

  await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
  // 에디터(TinyMCE)가 다 뜨기 전에 본문을 넣으면 반영되지 않는다.
  await page.waitForFunction(
    () => {
      const editor = (
        window as unknown as { tinymce?: { activeEditor?: { initialized?: boolean } } }
      ).tinymce?.activeEditor;
      return Boolean(editor?.initialized);
    },
    undefined,
    { timeout: 30000 },
  );
  await page.locator("#post-title-inp").fill(post.title);

  // 본문은 기본 모드 에디터(TinyMCE)에 직접 넣는다. HTML 모드 편집기(CodeMirror)에
  // 코드로 넣은 값은 티스토리 본문에 반영되지 않아 빈 글이 발행된다.
  // Unsplash 사진은 핫링크하고, 대체 제목 카드는 첨부해서 올린 뒤 그 이미지 코드를 쓴다.
  const thumbnailHtml =
    thumbnail.kind === "photo"
      ? photoHtml(thumbnail.photo)
      : await uploadImage(page, thumbnail.image);

  const bodyHtml = buildPostHtml(post, thumbnailHtml);
  // setContent만 쓰면 에디터 화면에는 보여도 티스토리가 저장하는 본문에는 반영되지 않는다(빈 글 발행).
  // 사람이 입력할 때처럼 insertContent로 넣고 입력 이벤트를 발생시켜야 저장 내용이 갱신된다.
  const written = await page.evaluate((html) => {
    const editor = (window as unknown as TinyWindow).tinymce.activeEditor;
    editor.setContent("");
    editor.focus();
    editor.insertContent(html);
    editor.undoManager.add();
    editor.nodeChanged();
    for (const event of ["input", "keyup", "change"]) editor.fire(event);
    return editor.getContent();
  }, bodyHtml);
  // 에디터가 HTML을 다시 직렬화하므로 주소처럼 인코딩이 바뀔 수 있는 값 대신 마지막 소제목 글자로 확인한다.
  const lastHeading = post.sections.at(-1)?.heading ?? post.title;
  if (!written.includes(lastHeading)) {
    throw new Error("본문이 에디터에 들어가지 않았습니다");
  }
  if (thumbnail.kind === "photo" && !written.includes("images.unsplash.com")) {
    throw new Error("Unsplash 사진이 본문에 들어가지 않았습니다");
  }

  await page.locator("#publish-layer-btn").click();
  await page.locator("#open20").check({ timeout: 10000 });
  // 티스토리는 본문에 핫링크한 외부 사진을 대표 이미지로 쓰지 않는다.
  // 그래서 발행 창의 "대표이미지 추가"에 같은 사진을 따로 올린다(사용자가 Unsplash 규칙 위험을 감수하기로 함).
  if (thumbnail.kind === "photo") {
    await setRepresentativeImage(page, await downloadImage(thumbnail.photo.url));
  }
  await page.locator("#publish-btn").click();
  await page.waitForURL((url) => !url.pathname.includes("/manage/newpost"), {
    timeout: 30000,
  });

  // 발행된 글 주소는 글 관리 목록에서 같은 제목의 링크로 찾는다.
  await page.goto(`${base}/manage/posts/`, { waitUntil: "domcontentloaded" });
  const link = page
    .locator('a[href*="/entry/"], a[href*=".tistory.com/"]')
    .filter({ hasText: post.title })
    .first();
  const url = await link.getAttribute("href", { timeout: 15000 });
  if (!url) throw new Error("발행된 글을 글 목록에서 찾지 못했습니다");
  const postUrl = new URL(url, base).href;

  // 에디터에서 확인한 내용과 실제 저장된 글이 다를 수 있어, 발행된 글을 열어 본문을 확인한다.
  await page.goto(postUrl, { waitUntil: "domcontentloaded" });
  const published = await page
    .locator(".tt_article_useless_p_margin")
    .first()
    .innerText({ timeout: 15000 })
    .catch(() => "");
  if (!published.includes(lastHeading)) {
    throw new Error(`글은 발행됐지만 본문이 비어 있습니다: ${postUrl}`);
  }
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content")
    .catch(() => null);
  if (!ogImage || ogImage.includes("opengraph.png")) {
    throw new Error(`글은 발행됐지만 대표 이미지가 지정되지 않았습니다: ${postUrl}`);
  }
  return postUrl;
}

export async function openTistory(credentials: {
  username: string;
  password: string;
}): Promise<TistorySession & { browser: Browser }> {
  const browser = await launchBrowser();
  const sessionFile = sessionPath(credentials.username);
  const storageState = await loadSession(sessionFile);
  const context = await browser.newContext(storageState ? { storageState } : {});
  const page = await context.newPage();

  try {
    // 저장된 세션이 살아 있으면 로그인(과 캡차)을 건너뛴다.
    if (!(storageState && (await isLoggedIn(page)))) {
      await context.clearCookies();
      await login(page, credentials);
    }
    await saveSession(context, sessionFile);
  } catch (error) {
    await saveDebugShot(page, "login-failed");
    await browser.close();
    throw error;
  }

  return {
    browser,
    async publish({ post, thumbnail }) {
      try {
        const url = await publishOnPage(page, post, thumbnail);
        // 발행하는 동안 갱신된 쿠키를 다음 실행을 위해 다시 저장한다.
        await saveSession(context, sessionFile);
        return { url };
      } catch (error) {
        await saveDebugShot(page, "publish-failed");
        throw error;
      }
    },
    async close() {
      await browser.close();
    },
  };
}
