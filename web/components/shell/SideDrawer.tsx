"use client"

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react"

type Props = {
  side: "left" | "right"
  title: string
  open: boolean
  width?: number
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void
  children: ReactNode
}

export function SideDrawer({ side, title, open, width, onResizeStart, children }: Props) {
  return (
    <aside className={`wm-drawer ${side} ${open ? "open" : "closed"}`} style={open && width ? { width } : undefined}>
      {open && onResizeStart ? (
        <div
          className={`wm-resizer ${side}`}
          role="separator"
          aria-label={`${side} drawer resize handle`}
          onPointerDown={onResizeStart}
        />
      ) : null}
      <div className="wm-drawer-header">{title}</div>
      <div className="wm-drawer-body">{children}</div>
    </aside>
  )
}
