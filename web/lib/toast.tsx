"use client"

import { useCallback, useEffect, useState } from "react"

type ToastType = "success" | "error" | "info"

type Toast = {
  id: string
  message: string
  type: ToastType
}

let toastListeners: ((toast: Toast) => void)[] = []

export function showToast(message: string, type: ToastType = "info"): void {
  const toast: Toast = {
    id: Math.random().toString(36).slice(2),
    message,
    type
  }
  toastListeners.forEach((listener) => listener(toast))
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 3500)
  }, [])

  useEffect(() => {
    toastListeners.push(addToast)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== addToast)
    }
  }, [addToast])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, dismissToast }
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="wm-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`wm-toast wm-toast-${toast.type}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
        >
          <span className="wm-toast-icon">
            {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
          </span>
          <span className="wm-toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
