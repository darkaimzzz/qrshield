"use client"

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { useEffect } from "react"
import type { RiskBand } from "@/lib/engine/types"
import { BAND_STYLE } from "@/lib/risk-ui"

const R = 52
const C = 2 * Math.PI * R
const ARC = 0.75 // 270° gauge

export function RiskGauge({ score, band }: { score: number; band: RiskBand }) {
  const reduce = useReducedMotion()
  const value = useMotionValue(reduce ? score : 0)
  const rounded = useTransform(value, (v) => Math.round(v))
  const offset = useTransform(value, (v) => C * ARC * (1 - v / 100))
  const color = BAND_STYLE[band].hex

  useEffect(() => {
    if (reduce) return value.set(score)
    const controls = animate(value, score, { duration: 1.1, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [score, reduce, value])

  return (
    <div
      className="relative size-44 shrink-0"
      role="img"
      aria-label={`Risk score ${score} out of 100, ${BAND_STYLE[band].label}`}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-[225deg]">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="rgb(148 163 184 / 0.15)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${C * ARC} ${C}`}
        />
        <motion.circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${C * ARC} ${C}`}
          style={{ strokeDashoffset: offset, filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-semibold tracking-tight tabular-nums"
          data-testid="risk-score"
        >
          {rounded}
        </motion.span>
        <span className="text-muted-foreground text-xs">out of 100</span>
      </div>
    </div>
  )
}
