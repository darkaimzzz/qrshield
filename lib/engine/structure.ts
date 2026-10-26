import { impersonationFindings, isBrandOwned } from "./impersonation"
import { extractLexical, lexicalFindings, URL_SHORTENERS } from "./lexical"
import { makeFinding } from "./indicators"
import type { Finding, LexicalFeatures, ParsedUrl } from "./types"

/**
 * Offline analysis of the URL text: lexical features, structural findings and impersonation.
 * Isomorphic (no Node APIs), so the education pages can run the real engine in the browser.
 */
export function analyzeStructure(parsed: ParsedUrl): { lexical: LexicalFeatures; findings: Finding[] } {
  const lexical = extractLexical(parsed)
  const brandOwned = isBrandOwned(parsed) !== null
  const findings = impersonationFindings(parsed, lexical)
  const host = parsed.registrableDomain ?? parsed.hostname
  if (URL_SHORTENERS.has(host) || URL_SHORTENERS.has(parsed.hostname)) {
    findings.push(
      makeFinding(
        "shortener",
        "The QR code points to a link-shortening or dynamic-QR service, which hides the real destination until it redirects. Shorteners are widely used legitimately, but they also let attackers disguise and quickly swap destinations.",
        [`Shortener: ${parsed.hostname}`],
      ),
    )
  }
  findings.push(...lexicalFindings(parsed, lexical, { brandOwned, otherSignals: findings.length }))
  return { lexical, findings }
}
