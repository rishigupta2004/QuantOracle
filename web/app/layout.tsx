import type { Metadata } from "next"
import { IBM_Plex_Mono, JetBrains_Mono, Press_Start_2P } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import "./globals.css"
import "@/styles/terminal.css"
import { TickerStrip } from "@/components/shell/TickerStrip"

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" })
const pressStart = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" })

export const metadata: Metadata = {
  title: "QuantOracle Command Center",
  description: "WorldMonitor-style market command center with workspace plans and usage insights."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${mono.variable} ${jetbrains.variable} ${pressStart.variable}`}>
        <body className="font-mono antialiased">
          <TickerStrip />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
