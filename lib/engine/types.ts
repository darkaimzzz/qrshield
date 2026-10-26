import { z } from "zod"

/** Shared report contract between the analysis API, the UI, history storage and PDF export. */

export const REPORT_VERSION = 1

export const inputSources = ["camera", "upload", "url", "demo"] as const
export type InputSource = (typeof inputSources)[number]

export const analyzeRequestSchema = z.object({
  input: z.string().min(1, "Enter a URL to analyze").max(4096, "Input is too long"),
  source: z.enum(inputSources).default("url"),
})
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>

export type Severity = "info" | "low" | "medium" | "high" | "critical"
export type RiskBand = "low" | "moderate" | "high" | "critical"

export type FindingCategory =
  | "structure"
  | "obfuscation"
  | "impersonation"
  | "transport"
  | "redirect"
  | "domain_age"
  | "threat_intel"
  | "social_engineering"
  | "download"

export interface Finding {
  id: string
  category: FindingCategory
  severity: Severity
  title: string
  explanation: string
  /** Concrete values observed in the input that triggered the finding. */
  evidence: string[]
  /** Configured weight of the indicator. */
  weight: number
  /** Points actually added to the score after correlation-group damping. */
  contribution: number
  /** Indicators in the same group describe overlapping evidence and are damped together. */
  group?: string
}

export interface ParsedUrl {
  original: string
  normalized: string
  protocol: "http:" | "https:"
  hostname: string
  hostnameUnicode: string
  subdomain: string
  registrableDomain: string | null
  publicSuffix: string | null
  isIcannSuffix: boolean
  port: string
  effectivePort: number
  pathname: string
  search: string
  hash: string
  isIp: boolean
  ipVersion: 4 | 6 | null
  hadCredentials: boolean
  credentialUser: string
  assumedProtocol: boolean
}

export interface LexicalFeatures {
  urlLength: number
  hostnameLength: number
  pathLength: number
  queryLength: number
  subdomainCount: number
  pathDepth: number
  specialCharRatio: number
  digitLetterRatio: number
  hostnameHyphens: number
  hostnameDigits: number
  repeatedSeparators: number
  percentEncodedCount: number
  doubleEncoded: boolean
  hostnameEntropy: number
  pathEntropy: number
  atSymbol: boolean
  doubleSlashInPath: boolean
  isPunycode: boolean
  nonAsciiHost: boolean
  mixedScriptLabel: string | null
  invisibleChars: number
  suspiciousKeywords: string[]
  embeddedUrlInQuery: boolean
  executableExtension: string | null
  tldIsUnusual: boolean
}

export type CheckStatus = "done" | "failed" | "skipped" | "not_configured"

export const stageIds = [
  "decode",
  "structure",
  "domain",
  "redirects",
  "threat_intel",
  "scoring",
  "report",
] as const
export type StageId = (typeof stageIds)[number]

export interface RedirectHop {
  url: string
  hostname: string
  status: number | null
  /** Registrable domain differs from the previous hop. */
  crossDomain: boolean
  error?: string
}

export interface RedirectResult {
  status: CheckStatus
  hops: RedirectHop[]
  finalUrl: string | null
  loop: boolean
  truncated: boolean
  detail: string
}

export interface DomainInfo {
  status: CheckStatus
  domain: string | null
  registrationDate: string | null
  expirationDate: string | null
  lastChangedDate: string | null
  registrar: string | null
  ageDays: number | null
  source: string | null
  detail: string
}

export type ProviderStatus = "match" | "no_match" | "not_checked" | "error"

export interface ProviderResult {
  id: string
  name: string
  status: ProviderStatus
  detail: string
}

export interface ThreatIntelResult {
  status: CheckStatus
  providers: ProviderResult[]
}

export interface MlResult {
  status: "available" | "unavailable"
  /** Uncalibrated model output in [0, 1]. */
  probability: number | null
  modelName: string | null
  detail: string
  topFactors: { feature: string; impact: number }[]
}

export interface CheckSummary {
  id: StageId
  label: string
  status: CheckStatus
  detail: string
}

export interface Explanation {
  summary: string
  recommendations: string[]
  generatedBy: "template" | "llm"
  model: string | null
}

export interface Report {
  version: typeof REPORT_VERSION
  id: string
  createdAt: string
  source: InputSource
  input: string
  parsed: ParsedUrl
  lexical: LexicalFeatures
  redirects: RedirectResult
  domain: DomainInfo
  threatIntel: ThreatIntelResult
  findings: Finding[]
  score: number
  band: RiskBand
  checks: CheckSummary[]
  ml: MlResult
  explanation: Explanation
  limitations: string[]
}

/** Events streamed (as NDJSON) by POST /api/analyze. */
export type AnalyzeEvent =
  | { type: "stage"; stage: StageId; status: "running" | CheckStatus; detail?: string }
  | { type: "report"; report: Report }
  | { type: "error"; message: string }
