import type { Finding, RiskBand } from "./types"

/** Secondary indicators in the same correlation group count at this fraction of their weight. */
export const GROUP_DAMPING = 0.5
/** A verified URL-level threat-intelligence match puts the score at least in the Critical band. */
export const THREAT_MATCH_FLOOR = 75

export const BANDS: { band: RiskBand; min: number; label: string }[] = [
  { band: "critical", min: 75, label: "Critical Risk" },
  { band: "high", min: 50, label: "High Risk" },
  { band: "moderate", min: 25, label: "Moderate Risk" },
  { band: "low", min: 0, label: "Low Detected Risk" },
]

export function bandFor(score: number): RiskBand {
  return BANDS.find((b) => score >= b.min)!.band
}

export function bandLabel(band: RiskBand): string {
  return BANDS.find((b) => b.band === band)!.label
}

/**
 * Deterministic score: sum of finding weights, where within each correlation group the strongest
 * finding counts fully and the rest are damped, capped at 100. Checks that did not run contribute
 * nothing: missing evidence is reported separately (Report.checks), never scored as "passed".
 * Returns findings with their actual `contribution` filled in, sorted by contribution.
 */
export function scoreFindings(findings: Finding[]): {
  score: number
  band: RiskBand
  findings: Finding[]
} {
  const seenGroups = new Set<string>()
  const scored = [...findings]
    .sort((a, b) => b.weight - a.weight)
    .map((f) => {
      let contribution = f.weight
      if (f.group) {
        if (seenGroups.has(f.group)) contribution = Math.round(f.weight * GROUP_DAMPING * 10) / 10
        seenGroups.add(f.group)
      }
      return { ...f, contribution }
    })

  let score = Math.min(100, Math.round(scored.reduce((s, f) => s + f.contribution, 0)))
  if (scored.some((f) => f.id === "threat_intel_match")) score = Math.max(score, THREAT_MATCH_FLOOR)
  return { score, band: bandFor(score), findings: scored }
}
