import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublishForm } from "@/components/publish-form";

function mockFetch(handler: () => Promise<unknown>) {
  const fetchMock = vi.fn(async () => ({ json: handler }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillAndSubmit(category = "경제") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("티스토리 아이디"), "me@example.com");
  await user.type(screen.getByLabelText("비밀번호"), "pw-1234");
  await user.selectOptions(screen.getByLabelText("분야"), category);
  await user.click(screen.getByRole("button", { name: "지금 발행" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("PublishForm", () => {
  it("분야는 경제, IT·기술, 시사 중에서 고른다", () => {
    render(<PublishForm />);

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["경제", "IT·기술", "시사"]);
  });

  it("입력한 계정과 분야로 발행을 요청한다", async () => {
    const fetchMock = mockFetch(async () => ({ ok: true, url: "https://b.tistory.com/1" }));
    render(<PublishForm />);

    await fillAndSubmit("IT·기술");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/publish");
    expect(JSON.parse(init.body as string)).toEqual({
      username: "me@example.com",
      password: "pw-1234",
      category: "IT·기술",
    });
  });

  it("발행하는 동안 버튼이 비활성화되고 진행 중임을 보여준다", async () => {
    mockFetch(() => new Promise(() => {}));
    render(<PublishForm />);

    await fillAndSubmit();

    const button = await screen.findByRole("button", { name: /발행 중/ });
    expect(button).toBeDisabled();
  });

  it("성공하면 발행된 글로 가는 링크를 보여준다", async () => {
    mockFetch(async () => ({ ok: true, url: "https://b.tistory.com/1" }));
    render(<PublishForm />);

    await fillAndSubmit();

    const link = await screen.findByRole("link", { name: /발행된 글 보기/ });
    expect(link).toHaveAttribute("href", "https://b.tistory.com/1");
  });

  it("실패하면 막힌 단계를 보여주고 다시 시도할 수 있다", async () => {
    mockFetch(async () => ({ ok: false, stage: "login", message: "로그인 실패" }));
    render(<PublishForm />);

    await fillAndSubmit();

    expect(await screen.findByText(/로그인 단계에서 실패/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 발행" })).toBeEnabled();
  });

  it("글 작성 단계 실패와 발행 단계 실패를 구분해 보여준다", async () => {
    mockFetch(async () => ({ ok: false, stage: "publish", message: "에디터 오류" }));
    render(<PublishForm />);

    await fillAndSubmit();

    expect(await screen.findByText(/발행 단계에서 실패/)).toBeInTheDocument();
  });

  it("아이디나 비밀번호가 비어 있으면 요청하지 않고 바로 실패를 보여준다", async () => {
    const fetchMock = mockFetch(async () => ({ ok: true, url: "https://b.tistory.com/1" }));
    render(<PublishForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("티스토리 아이디"), "me@example.com");
    await user.click(screen.getByRole("button", { name: "지금 발행" }));

    expect(
      await screen.findByText("티스토리 아이디와 비밀번호를 입력하세요."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서버 계정 사용 안내 문구를 보여주지 않는다", () => {
    render(<PublishForm />);

    expect(screen.queryByText(/\.env\.local/)).not.toBeInTheDocument();
  });

  it("서버에 닿지 못해도 실패로 보여준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    render(<PublishForm />);

    await fillAndSubmit();

    expect(await screen.findByText(/서버에 연결하지 못했습니다/)).toBeInTheDocument();
  });
});
