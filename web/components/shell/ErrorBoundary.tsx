"use client"

import { Component, ErrorInfo, ReactNode } from "react"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0a0a0f",
          color: "#ccc",
          fontFamily: "monospace",
          padding: "20px",
        }}>
          <div style={{ fontSize: "14px", marginBottom: "16px", color: "#ff7070" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: "11px", color: "#888", marginBottom: "16px", maxWidth: "400px", textAlign: "center" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#ccc",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
