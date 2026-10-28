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
  Terminal,
} from "lucide-react"
import { Typewriter } from "@/components/brand/typewriter"
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
      <section className="surface relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <p
            className="text-muted-foreground mb-6 space-y-0.5 text-[11px] leading-relaxed sm:text-xs"
            aria-hidden="true"
          >
            <span className="block">
              <span className="text-primary">[ OK ]</span> engine loaded: parser · lexical ·
              impersonation · redirects · rdap · intel · ml
            </span>
            <span className="block">
              <span className="text-primary">[ OK ]</span> ssrf guard armed · decoded content is
              never executed
            </span>
            <span className="block">
              <span className="text-signal">[ .. ]</span> awaiting target
            </span>
          </p>
          <span className="border-primary/40 text-primary mb-5 inline-flex items-center gap-2 border px-2.5 py-1 text-[11px] tracking-[0.2em] uppercase">
            <Terminal className="size-3.5" /> Explainable QR &amp; link security analysis
          </span>
          <h1 className="no-prompt text-2xl leading-[1.15] font-bold tracking-tight uppercase sm:text-[2.6rem]">
            <Typewriter
              lines={["Every QR Code Has a Destination.", "Know the Risk Before You Go."]}
              lineClassNames={["text-foreground", "text-primary text-glow"]}
            />
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-sm sm:text-base">
            Scan QR codes, uncover hidden destinations, and detect phishing threats with intelligent
            security analysis.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#scan"
              className="glow bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-12 items-center justify-center gap-2 px-6 text-sm font-bold tracking-[0.12em] uppercase transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ScanLine className="size-5" /> Scan a QR Code
            </a>
            <a
              href="#scan-url"
              className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-ring inline-flex h-12 items-center justify-center gap-2 border px-6 text-sm font-bold tracking-[0.12em] uppercase transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <Globe className="size-5" /> Analyze a URL
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
            className="surface group hover:border-signal/50 flex items-center gap-4 p-5 transition"
          >
            <span className="border-signal/40 text-signal flex size-11 shrink-0 items-center justify-center border">
              <FlaskConical className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold tracking-[0.12em] uppercase">
                Try a Demo Scan
              </span>
              <span className="text-muted-foreground block text-sm">
                Five synthetic cases plus a QR generator, analyzed by the real engine.
              </span>
            </span>
            <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <section aria-labelledby="process-heading">
        <h2 id="process-heading" className="mb-4 text-sm font-bold tracking-[0.18em] uppercase">
          <span className="text-primary" aria-hidden="true">
            {"// "}
          </span>
          How an analysis works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="surface relative p-5">
              <span className="text-primary/70 absolute top-4 right-4 text-xs">[0{i + 1}]</span>
              <Icon className="text-primary mb-3 size-5" />
              <p className="text-sm font-bold tracking-wider uppercase">{title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="threats-heading" className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="threats-heading" className="text-sm font-bold tracking-[0.18em] uppercase">
              <span className="text-primary" aria-hidden="true">
                {"// "}
              </span>
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
              <li key={title} className="border-border bg-background/40 border p-4">
                <Icon className="text-signal mb-2 size-4" />
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground mt-1 text-xs">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="edu-heading" className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="edu-heading" className="text-sm font-bold tracking-[0.18em] uppercase">
              <span className="text-primary" aria-hidden="true">
                {"// "}
              </span>
              Stay safer with QR codes
            </h2>
            <Link href="/methodology" className="text-primary text-sm hover:underline">
              Methodology
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {EDUCATION.map((e) => (
              <li key={e.title} className="border-border bg-background/40 border p-4">
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
