import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AppShell } from "@/components/layout/app-shell"
import { Providers } from "@/components/layout/providers"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "QRShield: Scan Smarter. Stay Safer.", template: "%s · QRShield" },
  description:
    "Scan QR codes, uncover hidden destinations, and detect phishing threats with explainable security analysis.",
  applicationName: "QRShield",
}

export const viewport: Viewport = {
  themeColor: "#060a13",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
