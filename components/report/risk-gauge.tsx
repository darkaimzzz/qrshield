"use client"

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { useEffect, useState } from "react"
import type { RiskBand } from "@/lib/engine/types"
import { BAND_STYLE } from "@/lib/risk-ui"

const TICKS = 36
const START_DEG = 135 // 270° sweep from bottom-left, clockwise
const SWEEP_DEG = 270

const ticks = Array.from({ length: TICKS }, (_, i) => {
  const a = ((START_DEG + (i * SWEEP_DEG) / (TICKS - 1)) * Math.PI) / 180
  return {
    x1: 60 + 43 * Math.cos(a),
    y1: 60 + 43 * Math.sin(a),
    x2: 60 + 55 * Math.cos(a),
    y2: 60 + 55 * Math.sin(a),
  }
})

const litFor = (v: number) => Math.round((v / 100) * TICKS)

/** Segmented LED-style gauge: ticks light up as the score counts in. */
export function RiskGauge({ score, band }: { score: number; band: RiskBand }) {
  const reduce = useReducedMotion()
  const value = useMotionValue(reduce ? score : 0)
  const rounded = useTransform(value, (v) => Math.round(v))
  const [lit, setLit] = useState(() => (reduce ? litFor(score) : 0))
  const color = BAND_STYLE[band].hex

  useMotionValueEvent(value, "change", (v) => setLit(litFor(v)))

  useEffect(() => {
    if (reduce) return value.set(score)
    const controls = animate(value, score, { duration: 1.2, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [score, reduce, value])

  return (
    <div
      className="relative size-44 shrink-0"
      role="img"
      aria-label={`Risk score ${score} out of 100, ${BAND_STYLE[band].label}`}
    >
      <svg viewBox="0 0 120 120" className="size-full" shapeRendering="crispEdges">
        <circle
          cx="60"
          cy="60"
          r="38"
          fill="none"
          stroke="rgb(0 255 102 / 0.12)"
          strokeDasharray="1 3"
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            {...t}
            strokeWidth="3.2"
            stroke={i < lit ? color : "rgb(0 255 102 / 0.12)"}
            style={i < lit ? { filter: `drop-shadow(0 0 3px ${color})` } : undefined}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-bold tracking-tight tabular-nums"
          style={{ color, textShadow: `0 0 12px ${color}99` }}
          data-testid="risk-score"
        >
          {rounded}
        </motion.span>
        <span className="text-muted-foreground text-[10px] tracking-[0.25em] uppercase">/ 100</span>
      </div>
    </div>
  )
}
