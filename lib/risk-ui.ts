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
    hex: "#00ff66",
  },
  moderate: {
    label: "Moderate Risk",
    text: "text-risk-moderate",
    bg: "bg-risk-moderate/10",
    border: "border-risk-moderate/30",
    hex: "#ffc400",
  },
  high: {
    label: "High Risk",
    text: "text-risk-high",
    bg: "bg-risk-high/10",
    border: "border-risk-high/30",
    hex: "#ff7a1a",
  },
  critical: {
    label: "Critical Risk",
    text: "text-risk-critical",
    bg: "bg-risk-critical/10",
    border: "border-risk-critical/30",
    hex: "#ff2e4d",
  },
}

export const SEVERITY_STYLE: Record<Severity, string> = {
  info: "border-border text-muted-foreground",
  low: "border-signal/40 text-signal",
  medium: "border-risk-moderate/50 text-risk-moderate",
  high: "border-risk-high/50 text-risk-high",
  critical: "border-risk-critical/60 bg-risk-critical/10 text-risk-critical",
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
