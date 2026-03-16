"use client"

import { useUser } from "@clerk/nextjs"

export function ScreenerPanel() {
  const { user, isLoaded } = useUser()

  return (
    <div className="screener-panel terminal-panel" style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="screener-title">STOCK SCREENER</div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "400px" }}>
        Filter stocks by P/E, P/B, ROE, momentum, and custom factor combinations.
      </p>
      {!isLoaded ? (
        <div style={{ marginTop: "20px" }}><span className="pixel-loader" /></div>
      ) : user ? (
        <a 
          href="/screener"
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
          OPEN SCREENER
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
          Sign in to access screener
        </a>
      )}
    </div>
  )
}
