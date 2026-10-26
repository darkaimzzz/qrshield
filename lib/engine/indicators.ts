import type { Finding, FindingCategory, Severity } from "./types"

/**
 * The weighted evidence model. Weights are engineering heuristics (not validated probabilities);
 * they are rendered verbatim on the methodology page so the score is reproducible by hand.
 *
 * `group` marks indicators that describe overlapping evidence. Within a group only the strongest
 * indicator counts in full; the others count at GROUP_DAMPING (see score.ts).
 */
interface IndicatorMeta {
  title: string
  weight: number
  severity: Severity
  category: FindingCategory
  group?: string
}

export const INDICATORS = {
  threat_intel_match: {
    title: "Known malicious URL match",
    weight: 70,
    severity: "critical",
    category: "threat_intel",
    group: "threat_intel",
  },
  threat_intel_domain: {
    title: "Domain listed on a phishing blocklist",
    weight: 40,
    severity: "high",
    category: "threat_intel",
    group: "threat_intel",
  },
  domain_new_30: {
    title: "Domain registered within the last 30 days",
    weight: 25,
    severity: "high",
    category: "domain_age",
    group: "domain_age",
  },
  domain_new_180: {
    title: "Domain registered within the last 180 days",
    weight: 12,
    severity: "medium",
    category: "domain_age",
    group: "domain_age",
  },
  ip_host: {
    title: "IP address used instead of a domain name",
    weight: 24,
    severity: "high",
    category: "structure",
  },
  brand_impersonation: {
    title: "Possible brand impersonation",
    weight: 20,
    severity: "high",
    category: "impersonation",
    group: "impersonation",
  },
  homograph: {
    title: "Internationalized or look-alike characters in hostname",
    weight: 15,
    severity: "high",
    category: "impersonation",
    group: "impersonation",
  },
  credentials_in_url: {
    title: "Embedded credentials / misleading “@” syntax",
    weight: 18,
    severity: "high",
    category: "obfuscation",
    group: "deceptive_structure",
  },
  domain_in_subdomain: {
    title: "Misleading hostname structure",
    weight: 10,
    severity: "medium",
    category: "structure",
    group: "deceptive_structure",
  },
  excessive_subdomains: {
    title: "Excessive number of subdomains",
    weight: 8,
    severity: "low",
    category: "structure",
    group: "deceptive_structure",
  },
  lure_domain_name: {
    title: "Domain name built from lure words",
    weight: 10,
    severity: "medium",
    category: "social_engineering",
    group: "deceptive_structure",
  },
  hyphenated_host: {
    title: "Heavily hyphenated hostname",
    weight: 5,
    severity: "low",
    category: "structure",
    group: "deceptive_structure",
  },
  suspicious_keywords: {
    title: "Account-verification or urgency language",
    weight: 12,
    severity: "medium",
    category: "social_engineering",
  },
  shortener: {
    title: "Known URL shortener",
    weight: 12,
    severity: "medium",
    category: "redirect",
    group: "redirect",
  },
  cross_domain_redirect: {
    title: "Redirects to a different domain",
    weight: 12,
    severity: "medium",
    category: "redirect",
    group: "redirect",
  },
  redirect_downgrade: {
    title: "Redirect downgrades HTTPS to HTTP",
    weight: 8,
    severity: "medium",
    category: "redirect",
    group: "redirect",
  },
  long_redirect_chain: {
    title: "Long redirect chain",
    weight: 6,
    severity: "low",
    category: "redirect",
    group: "redirect",
  },
  embedded_redirect_param: {
    title: "Another URL embedded in the query string",
    weight: 6,
    severity: "low",
    category: "redirect",
    group: "redirect",
  },
  no_https: {
    title: "No HTTPS encryption",
    weight: 10,
    severity: "medium",
    category: "transport",
  },
  unusual_encoding: {
    title: "Unusual encoding or invisible characters",
    weight: 8,
    severity: "medium",
    category: "obfuscation",
  },
  executable_download: {
    title: "Direct link to an executable or installer",
    weight: 10,
    severity: "medium",
    category: "download",
  },
  long_url: {
    title: "Abnormally long URL",
    weight: 7,
    severity: "low",
    category: "structure",
  },
  nonstandard_port: {
    title: "Non-standard network port",
    weight: 6,
    severity: "low",
    category: "structure",
  },
  random_hostname: {
    title: "Random-looking hostname",
    weight: 5,
    severity: "low",
    category: "structure",
  },
  unusual_tld: {
    title: "Top-level domain frequently abused",
    weight: 5,
    severity: "low",
    category: "structure",
  },
} as const satisfies Record<string, IndicatorMeta>

export type IndicatorId = keyof typeof INDICATORS

export function makeFinding(id: IndicatorId, explanation: string, evidence: string[]): Finding {
  const meta: IndicatorMeta = INDICATORS[id]
  return {
    id,
    category: meta.category,
    severity: meta.severity,
    title: meta.title,
    explanation,
    evidence,
    weight: meta.weight,
    contribution: meta.weight,
    group: meta.group,
  }
}
