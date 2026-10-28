import type { Metadata, Viewport } from "next"
import { JetBrains_Mono } from "next/font/google"
import { AppShell } from "@/components/layout/app-shell"
import { MatrixRain } from "@/components/layout/matrix-rain"
import { Providers } from "@/components/layout/providers"
import "./globals.css"

const term = JetBrains_Mono({ variable: "--font-term", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "QRShield: Scan Smarter. Stay Safer.", template: "%s · QRShield" },
  description:
    "Scan QR codes, uncover hidden destinations, and detect phishing threats with explainable security analysis.",
  applicationName: "QRShield",
}

export const viewport: Viewport = {
  themeColor: "#000502",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${term.variable} antialiased`}>
      <body className="min-h-dvh">
        <MatrixRain />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
