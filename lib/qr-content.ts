import { parseUrl } from "@/lib/engine/parse"

/**
 * Classifies decoded QR text. Only web URLs go to URL analysis; other payloads are shown as
 * inert, decoded text with an explanation (never executed, opened or dialed).
 */
export type QrContent =
  | { kind: "url"; text: string }
  | { kind: "upi"; text: string; fields: { label: string; value: string }[] }
  | { kind: "wifi"; text: string; fields: { label: string; value: string }[] }
  | {
      kind: "tel" | "sms" | "email" | "geo" | "contact"
      text: string
      fields: { label: string; value: string }[]
    }
  | { kind: "blocked_scheme"; text: string; scheme: string }
  | { kind: "text"; text: string }

function field(label: string, value: string | null | undefined) {
  return value ? [{ label, value }] : []
}

function wifiField(text: string, key: string): string | undefined {
  // WIFI:T:WPA;S:name;P:pass;H:true;; with backslash escapes
  const m = new RegExp(`(?:^WIFI:|;)${key}:((?:\\\\.|[^;])*)`, "i").exec(text)
  return m?.[1].replace(/\\(.)/g, "$1")
}

export function classifyQrContent(raw: string): QrContent {
  const text = raw.trim()
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1]?.toLowerCase()

  if (scheme === "upi") {
    try {
      const u = new URL(text)
      const p = u.searchParams
      return {
        kind: "upi",
        text,
        fields: [
          ...field("Payee UPI ID", p.get("pa")),
          ...field("Payee name (as written in the QR)", p.get("pn")),
          ...field("Amount", p.get("am") ? `${p.get("am")} ${p.get("cu") ?? "INR"}` : null),
          ...field("Note", p.get("tn")),
          ...field("Merchant code", p.get("mc")),
        ],
      }
    } catch {
      return { kind: "text", text }
    }
  }
  if (/^WIFI:/i.test(text)) {
    return {
      kind: "wifi",
      text,
      fields: [
        ...field("Network name (SSID)", wifiField(text, "S")),
        ...field("Security", wifiField(text, "T") || "None (open network)"),
        ...field("Password", wifiField(text, "P") ? "Included (hidden)" : null),
        ...field("Hidden network", wifiField(text, "H") === "true" ? "Yes" : null),
      ],
    }
  }
  if (scheme === "tel") return { kind: "tel", text, fields: field("Phone number", text.slice(4)) }
  if (scheme === "sms" || scheme === "smsto") {
    const [, num, body] = /^smsto?:([^:?]*)[:?]?(?:body=)?(.*)$/i.exec(text) ?? []
    return {
      kind: "sms",
      text,
      fields: [...field("Recipient", num), ...field("Prefilled message", decodeSafe(body))],
    }
  }
  if (scheme === "mailto" || /^MATMSG:/i.test(text)) {
    return {
      kind: "email",
      text,
      fields: field("Address", text.replace(/^mailto:/i, "").split("?")[0]),
    }
  }
  if (scheme === "geo") return { kind: "geo", text, fields: field("Coordinates", text.slice(4)) }
  if (/^BEGIN:VCARD/i.test(text) || /^MECARD:/i.test(text)) {
    const name = /(?:^|\n)FN:(.*)/i.exec(text)?.[1] ?? /MECARD:N:([^;]*)/i.exec(text)?.[1]
    return { kind: "contact", text, fields: field("Name", name) }
  }

  if (
    scheme &&
    scheme !== "http" &&
    scheme !== "https" &&
    !/^[^/?#:@]+:\d{1,5}(?:[/?#]|$)/.test(text)
  ) {
    return { kind: "blocked_scheme", text, scheme }
  }
  return parseUrl(text).ok ? { kind: "url", text } : { kind: "text", text }
}

function decodeSafe(s: string | undefined) {
  if (!s) return s
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export const CONTENT_GUIDANCE: Record<
  Exclude<QrContent["kind"], "url">,
  { title: string; body: string }
> = {
  upi: {
    title: "UPI payment request",
    body: "This QR code asks your payment app to send money. Scanning a QR code is never required to receive money. Before paying, check that the payee name your UPI app shows matches who you intend to pay, and be wary of codes stuck over a shop's original QR.",
  },
  wifi: {
    title: "Wi-Fi network credentials",
    body: "Joining this network gives its operator visibility into your unencrypted traffic. Only join networks you expect, such as the venue's official Wi-Fi.",
  },
  tel: {
    title: "Phone number",
    body: "Scanning would offer to call this number. Scam codes sometimes point to premium-rate or fake support lines; verify the number through an official source.",
  },
  sms: {
    title: "Pre-written text message",
    body: "Scanning would draft an SMS. Check the recipient and message before sending; premium SMS services can charge you.",
  },
  email: {
    title: "Email address",
    body: "Scanning would draft an email. This is generally low risk, but don't send personal information to unfamiliar addresses.",
  },
  geo: { title: "Map location", body: "This QR code contains coordinates for a map location." },
  contact: {
    title: "Contact card",
    body: "This QR code contains contact details. Any links inside the card are not analyzed automatically. Paste them into URL analysis if needed.",
  },
  blocked_scheme: {
    title: "Non-web link",
    body: "This QR code uses a link type that is not a web address. Links like javascript:, data:, file: or app-specific intents can run code or open apps directly, so QRShield does not open or execute them.",
  },
  text: {
    title: "Plain text",
    body: "This QR code contains text rather than a web address, so URL analysis is not applicable. QRShield never runs or opens decoded content.",
  },
}
