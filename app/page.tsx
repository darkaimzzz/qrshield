import Link from "next/link"
import {
  ArrowRight,
  CreditCard,
  Fingerprint,
  FlaskConical,
  Globe,
  KeyRound,
  Link2,
  Network,
  Radar,
  ScanLine,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from "lucide-react"
import { RecentScans } from "@/components/dashboard/recent-scans"
import { ScanPanel } from "@/components/scanner/scan-panel"

const CATEGORIES = [
  { icon: KeyRound, title: "Credential harvesting", body: "Fake login pages that collect passwords and one-time codes." },
  { icon: CreditCard, title: "Payment fraud", body: "Codes that redirect payments or request money via UPI or card." },
  { icon: Fingerprint, title: "Brand impersonation", body: "Look-alike domains that borrow the name of a bank or service." },
  { icon: Shuffle, title: "Hidden redirects", body: "Shorteners and redirect chains that hide where a code really leads." },
]

const STEPS = [
  { icon: ScanLine, title: "Decode", body: "QR images are decoded on your device. Nothing is opened." },
  { icon: Link2, title: "Inspect the URL", body: "Structure, encoding, look-alike brands and keywords." },
  { icon: Network, title: "Investigate", body: "Redirects (SSRF-safe), domain age via RDAP, threat lists." },
  { icon: ShieldCheck, title: "Explain", body: "A weighted, explainable score plus a separate ML estimate." },
]

const EDUCATION = [
  { title: "Check for stickers", body: "Attackers paste their own codes over legitimate ones on parking meters, posters and menus. Run a finger over the code." },
  { title: "Read the real domain", body: "Only the part right before the first single “/” decides where you land. Brand names elsewhere in the link mean nothing." },
  { title: "No QR needed to receive money", body: "Payment QR codes are only for sending money. Anyone asking you to scan to receive a refund is scamming." },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <section className="relative overflow-hidden rounded-3xl border border-border px-5 py-10 sm:px-10 sm:py-14">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" aria-hidden="true" />
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Explainable QR &amp; link security analysis
          </span>
          <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            Every QR Code Has a Destination.{" "}
            <span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">
              Know the Risk Before You Go.
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Scan QR codes, uncover hidden destinations, and detect phishing threats with intelligent security analysis.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#scan"
              className="glow-cyan inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <ScanLine className="size-5" /> Scan a QR Code
            </a>
            <a
              href="#scan-url"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-6 font-medium transition hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Globe className="size-5 text-primary" /> Analyze a URL
            </a>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ScanPanel />
        <div className="flex flex-col gap-6">
          <RecentScans />
          <Link
            href="/demo"
            className="surface group flex items-center gap-4 p-5 transition hover:border-violet/50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet">
              <FlaskConical className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Try a Demo Scan</span>
              <span className="block text-sm text-muted-foreground">
                Five synthetic cases plus a QR generator, analyzed by the real engine.
              </span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        </div>
      </div>

      <section aria-labelledby="process-heading">
        <h2 id="process-heading" className="mb-4 text-lg font-semibold tracking-tight">How an analysis works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="surface relative p-5">
              <span className="absolute top-4 right-4 font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <Icon className="mb-3 size-5 text-primary" />
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="threats-heading" className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="threats-heading" className="font-semibold">Threat categories</h2>
            <Link href="/intelligence" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Radar className="size-3.5" /> Learn more
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border border-border bg-background/40 p-4">
                <Icon className="mb-2 size-4 text-violet" />
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="edu-heading" className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="edu-heading" className="font-semibold">Stay safer with QR codes</h2>
            <Link href="/methodology" className="text-sm text-primary hover:underline">Methodology</Link>
          </div>
          <ul className="flex flex-col gap-3">
            {EDUCATION.map((e) => (
              <li key={e.title} className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{e.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
