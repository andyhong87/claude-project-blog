import type {
  Category,
  Post,
  PublishInput,
  PublishResult,
  PublishStage,
  Thumbnail,
} from "@/lib/publishing/types";

export type TistorySession = {
  publish(args: { post: Post; thumbnail: Thumbnail }): Promise<{ url: string }>;
  close(): Promise<void>;
};

export type PublishDeps = {
  openTistory(credentials: {
    username: string;
    password: string;
  }): Promise<TistorySession>;
  compose(category: Category): Promise<Post>;
  makeThumbnail(post: Post): Promise<Thumbnail>;
};

// 오류 메시지에 계정 정보가 섞여 화면과 로그로 새지 않게 가린다.
function redact(message: string, secrets: string[]): string {
  return secrets
    .filter(Boolean)
    .reduce((text, secret) => text.split(secret).join("***"), message);
}

export async function publishPost(
  input: PublishInput,
  deps: PublishDeps,
): Promise<PublishResult> {
  const secrets = [input.username, input.password];
  let stage: PublishStage = "login";
  let session: TistorySession | undefined;

  try {
    session = await deps.openTistory({
      username: input.username,
      password: input.password,
    });

    stage = "compose";
    const post = await deps.compose(input.category);
    const thumbnail = await deps.makeThumbnail(post);

    stage = "publish";
    const { url } = await session.publish({ post, thumbnail });

    return { ok: true, url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, stage, message: redact(message, secrets) };
  } finally {
    await session?.close().catch(() => {});
  }
}
