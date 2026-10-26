"use client"

import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3 } from "lucide-react"
import type { RiskBand } from "@/lib/engine/types"
import { useHistory, useHydrated } from "@/lib/history"
import { BAND_STYLE, CATEGORY_LABEL } from "@/lib/risk-ui"

const GRID = "rgb(148 163 184 / 0.12)"
const TICK = { fill: "#8b98ad", fontSize: 12 }
const PRIMARY = "#22d3ee"

function ChartCard({
  title,
  subtitle,
  children,
  table,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  table: [string, number][]
}) {
  return (
    <figure className="surface min-w-0 p-5">
      <figcaption className="mb-3">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </figcaption>
      <div className="h-56" aria-hidden="true">
        {children}
      </div>
      <details className="text-muted-foreground mt-2 text-xs">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {table.map(([k, v]) => (
              <tr key={k} className="border-border border-t">
                <td className="py-1">{k}</td>
                <td className="py-1 text-right tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border-border bg-popover rounded-lg border px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium tabular-nums">
        {payload[0].value} scan{payload[0].value === 1 ? "" : "s"}
      </p>
    </div>
  )
}

export function LocalAnalytics() {
  const history = useHistory()
  const hydrated = useHydrated()

  if (!hydrated) return <div className="bg-muted/40 h-72 animate-pulse rounded-2xl" />

  const bands = (Object.keys(BAND_STYLE) as RiskBand[]).map((b) => ({
    name: BAND_STYLE[b].label.replace(" Detected", "").replace(" Risk", ""),
    band: b,
    count: history.filter((r) => r.band === b).length,
  }))

  const catCounts = new Map<string, number>()
  for (const r of history)
    for (const c of new Set(r.findings.map((f) => f.category)))
      catCounts.set(c, (catCounts.get(c) ?? 0) + 1)
  const categories = [...catCounts.entries()]
    .map(([c, count]) => ({ name: CATEGORY_LABEL[c] ?? c, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (13 - i))
    return d
  })
  const activity = days.map((d) => ({
    name: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: history.filter((r) => {
      const t = new Date(r.createdAt)
      return t >= d && t.getTime() < d.getTime() + 86_400_000
    }).length,
  }))

  return (
    <section aria-labelledby="analytics-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="analytics-heading" className="text-lg font-semibold tracking-tight">
            Your scan analytics
          </h2>
          <p className="text-muted-foreground text-sm">
            Computed from {history.length} scan{history.length === 1 ? "" : "s"} saved on this
            device. This is your own history, not global threat data.
          </p>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 p-10 text-center">
          <BarChart3 className="text-muted-foreground size-8" />
          <p className="font-medium">No local scans to chart yet</p>
          <p className="text-muted-foreground max-w-md text-sm">
            Charts of your risk distribution, common warning categories and recent activity appear
            once you have analyzed a few links.
          </p>
          <Link href="/demo" className="text-primary text-sm hover:underline">
            Try the demo cases
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            title="Risk distribution"
            subtitle="Saved scans per risk level"
            table={bands.map((b) => [b.name, b.count])}
          >
            <ResponsiveContainer>
              <BarChart data={bands} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "rgb(148 163 184 / 0.06)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {bands.map((b) => (
                    <Cell key={b.band} fill={BAND_STYLE[b.band].hex} />
                  ))}
                  <LabelList dataKey="count" position="top" fill="#c7d2e2" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Most common warning categories"
            subtitle="Scans with at least one finding in the category"
            table={categories.map((c) => [c.name, c.count])}
          >
            {categories.length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No warnings recorded yet.
              </p>
            ) : (
              <ResponsiveContainer>
                <BarChart
                  data={categories}
                  layout="vertical"
                  margin={{ top: 0, right: 28, left: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={118}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "rgb(148 163 184 / 0.06)" }} />
                  <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={18}>
                    <LabelList dataKey="count" position="right" fill="#c7d2e2" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Recent activity"
            subtitle="Scans per day, last 14 days"
            table={activity.map((a) => [a.name, a.count])}
          >
            <ResponsiveContainer>
              <BarChart data={activity} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} interval={3} />
                <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "rgb(148 163 184 / 0.06)" }} />
                <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </section>
  )
}
