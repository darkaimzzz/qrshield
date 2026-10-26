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
  {
    icon: KeyRound,
    title: "Credential harvesting",
    body: "Fake login pages that collect passwords and one-time codes.",
  },
  {
    icon: CreditCard,
    title: "Payment fraud",
    body: "Codes that redirect payments or request money via UPI or card.",
  },
  {
    icon: Fingerprint,
    title: "Brand impersonation",
    body: "Look-alike domains that borrow the name of a bank or service.",
  },
  {
    icon: Shuffle,
    title: "Hidden redirects",
    body: "Shorteners and redirect chains that hide where a code really leads.",
  },
]

const STEPS = [
  {
    icon: ScanLine,
    title: "Decode",
    body: "QR images are decoded on your device. Nothing is opened.",
  },
  {
    icon: Link2,
    title: "Inspect the URL",
    body: "Structure, encoding, look-alike brands and keywords.",
  },
  {
    icon: Network,
    title: "Investigate",
    body: "Redirects (SSRF-safe), domain age via RDAP, threat lists.",
  },
  {
    icon: ShieldCheck,
    title: "Explain",
    body: "A weighted, explainable score plus a separate ML estimate.",
  },
]

const EDUCATION = [
  {
    title: "Check for stickers",
    body: "Attackers paste their own codes over legitimate ones on parking meters, posters and menus. Run a finger over the code.",
  },
  {
    title: "Read the real domain",
    body: "Only the part right before the first single “/” decides where you land. Brand names elsewhere in the link mean nothing.",
  },
  {
    title: "No QR needed to receive money",
    body: "Payment QR codes are only for sending money. Anyone asking you to scan to receive a refund is scamming.",
  },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <section className="border-border relative overflow-hidden rounded-3xl border px-5 py-10 sm:px-10 sm:py-14">
        <div
          className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
          aria-hidden="true"
        />
        <div
          className="bg-primary/15 absolute -top-24 -right-24 size-72 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl">
          <span className="border-primary/30 bg-primary/10 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3.5" /> Explainable QR &amp; link security analysis
          </span>
          <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            Every QR Code Has a Destination.{" "}
            <span className="from-primary to-violet bg-gradient-to-r bg-clip-text text-transparent">
              Know the Risk Before You Go.
            </span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-base sm:text-lg">
            Scan QR codes, uncover hidden destinations, and detect phishing threats with intelligent
            security analysis.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#scan"
              className="glow-cyan bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 font-medium transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ScanLine className="size-5" /> Scan a QR Code
            </a>
            <a
              href="#scan-url"
              className="border-border bg-card/60 hover:border-primary/50 hover:bg-accent focus-visible:ring-ring inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-6 font-medium transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <Globe className="text-primary size-5" /> Analyze a URL
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
            className="surface group hover:border-violet/50 flex items-center gap-4 p-5 transition"
          >
            <span className="bg-violet/15 text-violet flex size-11 shrink-0 items-center justify-center rounded-xl">
              <FlaskConical className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Try a Demo Scan</span>
              <span className="text-muted-foreground block text-sm">
                Five synthetic cases plus a QR generator, analyzed by the real engine.
              </span>
            </span>
            <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <section aria-labelledby="process-heading">
        <h2 id="process-heading" className="mb-4 text-lg font-semibold tracking-tight">
          How an analysis works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="surface relative p-5">
              <span className="text-muted-foreground absolute top-4 right-4 font-mono text-xs">
                0{i + 1}
              </span>
              <Icon className="text-primary mb-3 size-5" />
              <p className="font-medium">{title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="threats-heading" className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="threats-heading" className="font-semibold">
              Threat categories
            </h2>
            <Link
              href="/intelligence"
              className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              <Radar className="size-3.5" /> Learn more
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="border-border bg-background/40 rounded-xl border p-4">
                <Icon className="text-violet mb-2 size-4" />
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground mt-1 text-xs">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="edu-heading" className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="edu-heading" className="font-semibold">
              Stay safer with QR codes
            </h2>
            <Link href="/methodology" className="text-primary text-sm hover:underline">
              Methodology
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {EDUCATION.map((e) => (
              <li key={e.title} className="border-border bg-background/40 rounded-xl border p-4">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">{e.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
