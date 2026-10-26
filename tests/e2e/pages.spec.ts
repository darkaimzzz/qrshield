import { expect, test } from "@playwright/test"
import { waitForReport } from "./helpers"

test.describe("history", () => {
  test("persists across reloads; search, filter, open, delete and clear", async ({ page }) => {
    for (const u of ["http://203.0.113.45/login", "https://www.example.org/"]) {
      await page.goto(`/analyze?u=${encodeURIComponent(u)}&src=url`)
      await waitForReport(page)
    }
    await page.goto("/history")
    await expect(page.getByTestId("history-row")).toHaveCount(2)
    await page.reload()
    await expect(page.getByTestId("history-row")).toHaveCount(2)

    await page.getByLabel("Search scans").fill("203.0")
    await expect(page.getByTestId("history-row")).toHaveCount(1)
    await page.getByLabel("Search scans").fill("")

    await page.getByLabel("Filter by severity").click()
    await page.getByRole("option", { name: "Low Detected Risk" }).click()
    await expect(page.getByTestId("history-row")).toHaveCount(1)
    await expect(page.getByTestId("history-row")).toContainText("example.org")

    await page.getByTestId("history-row").getByRole("link").first().click()
    await expect(page).toHaveURL(/\/analyze\?id=/)
    await waitForReport(page)
    await page.goBack()

    await page.getByLabel("Filter by severity").click()
    await page.getByRole("option", { name: "All severities" }).click()
    await page.getByRole("button", { name: /Delete scan of 203\.0\.113\.45/ }).click()
    await expect(page.getByTestId("history-row")).toHaveCount(1)

    await page.getByRole("button", { name: "Clear all" }).click()
    await page.getByRole("button", { name: "Delete everything" }).click()
    await expect(page.getByText("No saved scans yet")).toBeVisible()
    await page.reload()
    await expect(page.getByText("No saved scans yet")).toBeVisible()
  })

  test("autosave can be turned off", async ({ page }) => {
    await page.goto("/history")
    await page.getByLabel("Save new scans automatically").click()
    await page.goto(`/analyze?u=${encodeURIComponent("https://www.example.org/")}&src=url`)
    await waitForReport(page)
    await expect(page.getByRole("button", { name: "Save to history" })).toBeVisible()
    await page.goto("/history")
    await expect(page.getByText("No saved scans yet")).toBeVisible()
  })
})

test.describe("demo, intelligence and methodology", () => {
  test("demo cases run through the real engine", async ({ page }) => {
    await page.goto("/demo")
    await expect(page.getByTestId("demo-case")).toHaveCount(5)
    await page.getByTestId("demo-case").nth(4).getByRole("link", { name: "Analyze" }).click()
    await waitForReport(page)
    await expect(page.locator('[data-finding-id="unusual_encoding"]')).toBeVisible()
    await expect(page.locator('[data-finding-id="embedded_redirect_param"]')).toBeVisible()
  })

  test("QR generator output decodes back through the on-device decoder", async ({ page }) => {
    await page.goto("/demo")
    await page.getByTestId("demo-case").nth(3).getByRole("button", { name: "Generate QR" }).click()
    await expect(page.getByTestId("generated-qr")).toBeVisible()
    await page.getByRole("button", { name: /Decode & analyze this QR/ }).click()
    await waitForReport(page)
    await expect(page).toHaveURL(/203\.0\.113\.45/)
    await expect(page.locator('[data-stage="decode"]')).toHaveAttribute("data-status", "done")
  })

  test("intelligence page runs examples and dissects URLs", async ({ page }) => {
    await page.goto("/intelligence")
    await expect(page.getByTestId("url-anatomy")).toContainText("secure-verify.example")
    await page.getByLabel("URL to dissect").fill("https://shop.example.co.uk/cart?id=1")
    await expect(page.getByText("This link is controlled by")).toContainText("example.co.uk")
    await page.getByRole("button", { name: "Run engine on example" }).nth(6).click() // homograph
    await expect(page.getByTestId("attack-result")).toContainText("Possible brand impersonation")
    await expect(page.getByText("No local scans to chart yet")).toBeVisible()
  })

  test("methodology shows real model metrics and the weight table", async ({ page }) => {
    await page.goto("/methodology")
    await expect(page.getByRole("heading", { name: "Methodology", level: 1 })).toBeVisible()
    await expect(page.getByText("PhiUSIIL Phishing URL Dataset")).toBeVisible()
    await expect(
      page.getByRole("cell", { name: "IP address used instead of a domain name" }),
    ).toBeVisible()
  })
})
