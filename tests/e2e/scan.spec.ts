import { expect, test } from "@playwright/test"
import { expectStillOnApp, qrPng, twoQrPng, uploadImage, waitForReport } from "./helpers"

test.describe("scanning and analysis", () => {
  test("paste URL → real stage progress → explainable report", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "Analyze a URL" }).click()
    await expect(page.getByRole("tab", { name: /Paste URL/ })).toHaveAttribute(
      "data-state",
      "active",
    )
    await page
      .getByLabel("Web address to analyze")
      .fill("  http://secure-account-verify.example/login/update?session=expired  ")
    await page.getByRole("button", { name: "Analyze URL" }).click()

    await expect(page).toHaveURL(/\/analyze\?u=/)
    await waitForReport(page)
    expectStillOnApp(page)

    await expect(page.getByTestId("risk-band")).toHaveText(/Risk/)
    await expect(page.locator('[data-finding-id="no_https"]')).toBeVisible()
    await expect(page.locator('[data-finding-id="suspicious_keywords"]')).toBeVisible()
    // Network is disabled in the test server: these stages must say so instead of pretending.
    await expect(page.locator('[data-stage="redirects"]')).toHaveAttribute("data-status", "skipped")
    await expect(page.locator('[data-stage="domain"]')).toHaveAttribute("data-status", "skipped")
    await expect(page.locator('[data-stage="decode"]')).toHaveAttribute("data-status", "skipped")
    await expect(page.getByText("Not checked").first()).toBeVisible()
    await expect(page.getByTestId("ml-panel")).toContainText("%")

    // Expand a finding to see evidence
    await page.locator('[data-finding-id="no_https"] button').click()
    await expect(page.locator('[data-finding-id="no_https"]')).toContainText("Scheme: http")
  })

  test("rejects unsupported schemes without navigating", async ({ page }) => {
    await page.goto("/#scan-url")
    await page.getByLabel("Web address to analyze").fill("javascript:alert(document.cookie)")
    await page.getByRole("button", { name: "Analyze URL" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "javascript:" })).toBeVisible()
    await expect(page).toHaveURL(/\/(#scan-url)?$/)
  })

  test("upload a QR image → decoded locally → analyzed", async ({ page }) => {
    await uploadImage(
      page,
      await qrPng("https://paypal.com.account-security.example/signin/verify"),
    )
    await expect(page).toHaveURL(/src=upload/, { timeout: 20_000 })
    await waitForReport(page)
    await expect(page.locator('[data-stage="decode"]')).toHaveAttribute("data-status", "done")
    await expect(page.locator('[data-finding-id="brand_impersonation"]')).toBeVisible()
    expectStillOnApp(page)
  })

  test("multiple QR codes in one image → user chooses which to analyze", async ({ page }) => {
    await uploadImage(page, await twoQrPng("https://first.example/a", "http://203.0.113.45/second"))
    const group = page.getByRole("group", { name: "Multiple QR codes found" })
    await expect(group).toBeVisible({ timeout: 20_000 })
    await group.getByRole("button", { name: /203\.0\.113\.45/ }).click()
    await waitForReport(page)
    await expect(page.locator('[data-finding-id="ip_host"]')).toBeVisible()
  })

  test("image without a QR code shows a clear error", async ({ page }) => {
    const { PNG } = await import("pngjs")
    const blank = new PNG({ width: 120, height: 120 })
    blank.data.fill(255)
    await uploadImage(page, PNG.sync.write(blank), "blank.png")
    await expect(page.getByRole("alert").filter({ hasText: "No QR code was found" })).toBeVisible({
      timeout: 20_000,
    })
  })

  test("non-URL QR content is shown as inert text", async ({ page }) => {
    await uploadImage(page, await qrPng("WIFI:T:WPA;S:CafeGuest;P:hunter2;;"))
    const panel = page.getByTestId("content-result")
    await expect(panel).toBeVisible({ timeout: 20_000 })
    await expect(panel).toContainText("Wi-Fi network credentials")
    await expect(panel).toContainText("CafeGuest")
    await expect(panel).toContainText("Included (hidden)")
    await expect(panel).not.toContainText("Included (hidden)hunter2")
  })

  test("UPI payment QR explains the payment risk", async ({ page }) => {
    await uploadImage(
      page,
      await qrPng("upi://pay?pa=shop@examplebank&pn=Corner%20Shop&am=250&cu=INR"),
    )
    const panel = page.getByTestId("content-result")
    await expect(panel).toContainText("UPI payment request", { timeout: 20_000 })
    await expect(panel).toContainText("shop@examplebank")
  })

  test("camera tab explains permission handling when no camera is available", async ({ page }) => {
    await page.goto("/#scan")
    await page.getByRole("button", { name: "Start camera" }).click()
    // Headless Chromium has no camera: we must land in a handled state with an upload fallback.
    await expect(
      page.getByText(/No camera available|permission was denied|could not be started/),
    ).toBeVisible()
    await page.getByRole("button", { name: "Upload an image instead" }).click()
    await expect(page.getByRole("tab", { name: /Upload/ })).toHaveAttribute("data-state", "active")
  })
})

test.describe("report actions", () => {
  test("copy, PDF, inspect and save toggle all work", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(
      `/analyze?u=${encodeURIComponent("http://203.0.113.45/bank/login.php")}&src=demo`,
    )
    await waitForReport(page)

    await page.getByRole("button", { name: "Copy summary" }).click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain("QRShield security report")
    expect(clip).toContain("IP address used instead of a domain name")

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download PDF" }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(
      /^qrshield-report-203\.0\.113\.45-\d{4}-\d{2}-\d{2}\.pdf$/,
    )
    const pdf = await (await file.createReadStream()).toArray()
    expect(Buffer.concat(pdf).subarray(0, 5).toString()).toBe("%PDF-")

    await page.getByRole("button", { name: "Inspect details" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Raw report JSON")
    await expect(dialog).toContainText('"ip_host"')
    await page.keyboard.press("Escape")

    const save = page.getByRole("button", { name: /history/ })
    await expect(save).toHaveAttribute("aria-pressed", "true") // auto-saved
    await save.click()
    await expect(save).toHaveAttribute("aria-pressed", "false")
  })
})

test.describe("api", () => {
  test("validates input and exposes status without secrets", async ({ request }) => {
    const bad = await request.post("/api/analyze", { data: { input: "" } })
    expect(bad.status()).toBe(400)
    const status = await (await request.get("/api/status")).json()
    expect(status.network).toBe(false)
    expect(JSON.stringify(status)).not.toMatch(/key=|Bearer/i)
    const stream = await request.post("/api/analyze", { data: { input: "file:///etc/passwd" } })
    expect(stream.status()).toBe(200)
    expect(await stream.text()).toContain('"type":"error"')
  })
})
