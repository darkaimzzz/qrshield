// ponytail: in-memory per-instance token bucket; on multi-instance hosting (Vercel) each instance
// counts separately. Swap for a shared store (e.g. Upstash Redis) if abuse becomes a problem.
const CAPACITY = 20
const REFILL_PER_MS = 20 / 60_000
const buckets = new Map<string, { tokens: number; at: number }>()

export function rateLimit(key: string, now = Date.now()): boolean {
  const b = buckets.get(key) ?? { tokens: CAPACITY, at: now }
  b.tokens = Math.min(CAPACITY, b.tokens + (now - b.at) * REFILL_PER_MS)
  b.at = now
  if (buckets.size > 10_000) buckets.clear()
  buckets.set(key, b)
  if (b.tokens < 1) return false
  b.tokens -= 1
  return true
}
