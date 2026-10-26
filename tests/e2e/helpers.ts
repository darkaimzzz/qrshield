import QRCode from "qrcode"
import { PNG } from "pngjs"
import { expect, type Page } from "@playwright/test"

/** QR code PNG generated at test time (no binary fixtures in the repo). */
export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", margin: 4, width: 300 })
}

/** Two QR codes side by side on one white canvas. */
export async function twoQrPng(a: string, b: string): Promise<Buffer> {
  const [pa, pb] = await Promise.all([qrPng(a), qrPng(b)]).then((bufs) =>
    bufs.map((x) => PNG.sync.read(x)),
  )
  const out = new PNG({ width: pa.width + pb.width + 60, height: Math.max(pa.height, pb.height) })
  out.data.fill(255)
  PNG.bitblt(pa, out, 0, 0, pa.width, pa.height, 0, 0)
  PNG.bitblt(pb, out, 0, 0, pb.width, pb.height, pa.width + 60, 0)
  return PNG.sync.write(out)
}

export async function uploadImage(page: Page, buffer: Buffer, name = "qr.png") {
  await page.goto("/#scan-upload")
  await expect(page.getByRole("tab", { name: /Upload/ })).toHaveAttribute("data-state", "active")
  await page.getByTestId("qr-upload-input").setInputFiles({ name, mimeType: "image/png", buffer })
}

export async function waitForReport(page: Page) {
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 })
}

/** The browser must never navigate to the analyzed destination. */
export function expectStillOnApp(page: Page) {
  expect(new URL(page.url()).host).toMatch(/^localhost(:\d+)?$|qrshield/)
}
