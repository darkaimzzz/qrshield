import type { InputSource, RiskBand, Severity } from "@/lib/engine/types"

export const BAND_STYLE: Record<
  RiskBand,
  { label: string; text: string; bg: string; border: string; hex: string }
> = {
  low: {
    label: "Low Detected Risk",
    text: "text-risk-low",
    bg: "bg-risk-low/10",
    border: "border-risk-low/30",
    hex: "#10b981",
  },
  moderate: {
    label: "Moderate Risk",
    text: "text-risk-moderate",
    bg: "bg-risk-moderate/10",
    border: "border-risk-moderate/30",
    hex: "#f59e0b",
  },
  high: {
    label: "High Risk",
    text: "text-risk-high",
    bg: "bg-risk-high/10",
    border: "border-risk-high/30",
    hex: "#f97316",
  },
  critical: {
    label: "Critical Risk",
    text: "text-risk-critical",
    bg: "bg-risk-critical/10",
    border: "border-risk-critical/30",
    hex: "#ef4444",
  },
}

export const SEVERITY_STYLE: Record<Severity, string> = {
  info: "border-border bg-muted text-muted-foreground",
  low: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  medium: "border-risk-moderate/30 bg-risk-moderate/10 text-amber-300",
  high: "border-risk-high/30 bg-risk-high/10 text-orange-300",
  critical: "border-risk-critical/30 bg-risk-critical/10 text-red-300",
}

export const SOURCE_LABEL: Record<InputSource, string> = {
  camera: "Camera",
  upload: "Image upload",
  url: "Pasted URL",
  demo: "Demo",
}

export const CATEGORY_LABEL: Record<string, string> = {
  structure: "URL structure",
  obfuscation: "Obfuscation",
  impersonation: "Impersonation",
  transport: "Transport security",
  redirect: "Redirects",
  domain_age: "Domain age",
  threat_intel: "Threat intelligence",
  social_engineering: "Social engineering",
  download: "Malicious download",
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}
