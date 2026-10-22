import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "@/app/page";

test("홈 화면은 티스토리 계정·분야 입력과 발행 버튼을 보여준다", () => {
  render(<Home />);

  expect(screen.getByLabelText("티스토리 아이디")).toBeInTheDocument();
  expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  expect(screen.getByLabelText("분야")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "지금 발행" })).toBeEnabled();
});
