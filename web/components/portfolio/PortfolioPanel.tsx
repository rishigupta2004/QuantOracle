"use client"

import { useUser } from "@clerk/nextjs"

export function PortfolioPanel() {
  const { user, isLoaded } = useUser()

  return (
    <div className="portfolio-panel terminal-panel" style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="portfolio-title">PORTFOLIO TRACKER</div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "400px" }}>
        Track your positions, P&L, and portfolio metrics across all your brokerage accounts.
      </p>
      {!isLoaded ? (
        <div style={{ marginTop: "20px" }}><span className="pixel-loader" /></div>
      ) : user ? (
        <a 
          href="/portfolio"
          style={{ 
            marginTop: "20px", 
            padding: "12px 24px", 
            background: "var(--text-accent)", 
            color: "var(--bg-void)", 
            fontFamily: "var(--font-pixel)", 
            fontSize: "10px",
            textDecoration: "none"
          }}
        >
          OPEN PORTFOLIO
        </a>
      ) : (
        <a 
          href="/sign-in"
          style={{ 
            marginTop: "20px", 
            padding: "12px 24px", 
            background: "transparent", 
            border: "1px solid var(--border-mid)", 
            color: "var(--text-secondary)", 
            fontFamily: "var(--font-mono)", 
            fontSize: "12px",
            textDecoration: "none"
          }}
        >
          Sign in to track portfolio
        </a>
      )}
    </div>
  )
}
