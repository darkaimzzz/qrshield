"use client"

/** Client-side QR decoding of images (ZXing C++ compiled to WebAssembly, served from /wasm). */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]

let ready: Promise<typeof import("zxing-wasm/reader")> | null = null

function loadReader() {
  ready ??= import("zxing-wasm/reader").then((mod) => {
    mod.prepareZXingModule({
      overrides: {
        // Self-hosted: images and the decoder never leave this origin.
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? `/wasm/${path}` : prefix + path,
      },
    })
    return mod
  })
  return ready
}

export class DecodeError extends Error {}

export function validateImage(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type))
    return "Unsupported file type. Use a PNG, JPG or WebP image."
  if (file.size > MAX_IMAGE_BYTES) return "Image is larger than 8 MB."
  if (file.size === 0) return "The file is empty."
  return null
}

/** Returns the distinct QR payloads found in the image (possibly empty). */
export async function decodeQrImage(blob: Blob): Promise<string[]> {
  const { readBarcodes } = await loadReader()
  let results
  try {
    results = await readBarcodes(blob, {
      formats: ["QRCode"],
      tryHarder: true,
      maxNumberOfSymbols: 8,
    })
  } catch {
    throw new DecodeError(
      "This image could not be read. It may be corrupted or in an unsupported format.",
    )
  }
  return [...new Set(results.filter((r) => r.isValid && r.text).map((r) => r.text))]
}
