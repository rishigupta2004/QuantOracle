import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "var(--panel)",
        border: "var(--border)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px rgba(4,8,20,0.35)"
      }
    }
  },
  plugins: []
}

export default config
