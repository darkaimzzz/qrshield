"use client"

import { MotionConfig } from "motion/react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </MotionConfig>
  )
}
