"use client"

import { useEffect, useState } from "react"

/**
 * Types `lines` out character by character with a blinking block cursor. The full text is always
 * in the DOM for screen readers and crawlers; an invisible copy reserves the final layout so
 * nothing shifts while typing. Reduced-motion users get the full text immediately.
 */
export function Typewriter({
  lines,
  lineClassNames = [],
  speedMs = 32,
}: {
  lines: string[]
  lineClassNames?: string[]
  speedMs?: number
}) {
  const total = lines.reduce((n, l) => n + l.length, 0)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const id = window.setInterval(
      () =>
        setShown((n) => {
          const next = reduce ? total : n + 1
          if (next >= total) window.clearInterval(id)
          return Math.min(next, total)
        }),
      reduce ? 0 : speedMs,
    )
    return () => window.clearInterval(id)
  }, [total, speedMs])

  const done = shown >= total
  // Characters already typed before each line starts.
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length, 0))

  return (
    <span className="relative block">
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true" className="invisible block">
        {lines.map((l, i) => (
          <span key={i} className={`block ${lineClassNames[i] ?? ""}`}>
            {l}&nbsp;
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="absolute inset-0 block">
        {lines.map((l, i) => {
          const budget = shown - starts[i]
          const visible = l.slice(0, Math.max(0, budget))
          const typingHere = !done && budget >= 0 && (budget < l.length || i === lines.length - 1)
          const isLastWithCursor = done ? i === lines.length - 1 : typingHere
          return (
            <span key={i} className={`block ${lineClassNames[i] ?? ""}`}>
              {visible}
              {isLastWithCursor && (
                <span className="cursor-blink bg-primary ml-1 inline-block h-[0.85em] w-[0.5em] translate-y-[0.08em] align-baseline" />
              )}
            </span>
          )
        })}
      </span>
    </span>
  )
}
