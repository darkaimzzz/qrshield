import { expect, test } from "@playwright/test"
import { waitForReport } from "./helpers"

const PAGES = [
  "/",
  "/history",
  "/intelligence",
  "/demo",
  "/methodology",
  `/analyze?u=${encodeURIComponent("https://paypal.com.account-security.example/signin/verify")}&src=url`,
]

for (const path of PAGES) {
  test(`no horizontal overflow on ${path.split("?")[0]}`, async ({ page }) => {
    await page.goto(path)
    if (path.startsWith("/analyze")) await waitForReport(page)
    await page.waitForLoadState("networkidle")
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("mobile navigation exposes the scan action", async ({ page }) => {
  await page.goto("/history")
  const nav = page.getByRole("navigation", { name: "Mobile" })
  await expect(nav).toBeVisible()
  await nav.getByRole("link", { name: "Scan", exact: true }).click()
  await expect(page).toHaveURL(/\/#scan$/)
  await expect(page.getByRole("tab", { name: /Camera/ })).toHaveAttribute("data-state", "active")
})
