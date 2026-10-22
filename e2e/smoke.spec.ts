import { expect, test } from "@playwright/test";

test("홈 화면이 열리고 발행 입력 폼이 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("티스토리 아이디")).toBeVisible();
  await expect(page.getByLabel("분야")).toBeVisible();
  await expect(page.getByRole("button", { name: "지금 발행" })).toBeEnabled();
});
