"use client"

import { useEffect, useRef } from "react"

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF<>/{}[]=+*:"
const CELL = 16
const FRAME_MS = 60

/**
 * Decorative "digital rain" behind the app. Low opacity, ~16 fps, paused while the tab is hidden,
 * and not drawn at all for users who prefer reduced motion.
 */
export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let drops: number[] = []
    let raf = 0
    let last = 0
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = "#000502"
      ctx.fillRect(0, 0, w, h)
      drops = Array.from({ length: Math.ceil(w / CELL) }, () => -Math.random() * (h / CELL))
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (t - last < FRAME_MS) return
      last = t
      ctx.fillStyle = "rgba(0, 5, 2, 0.12)" // fade previous frame into trails
      ctx.fillRect(0, 0, w, h)
      ctx.font = `${CELL - 2}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * CELL
        if (y > 0) {
          ctx.fillStyle = Math.random() > 0.96 ? "#d6ffe2" : "#00ff66"
          ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * CELL, y)
        }
        drops[i] = y > h && Math.random() > 0.97 ? 0 : drops[i] + 1
      }
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }

    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 size-full opacity-[0.17]"
    />
  )
}
