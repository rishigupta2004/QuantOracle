"use client"

import { useEffect, useState } from "react"

type MacroEvent = {
  time: string
  event: string
  impact: "high" | "medium" | "low"
  country: string
}

export function MacroCalendar() {
  const [events, setEvents] = useState<MacroEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mockEvents: MacroEvent[] = [
      { time: "09:00", event: "RBI Repo Rate Decision", impact: "high", country: "IN" },
      { time: "14:30", event: "US CPI Data", impact: "high", country: "US" },
      { time: "18:00", event: "FII/DII Flow Data", impact: "medium", country: "IN" },
      { time: "20:30", event: "US Fed Minutes", impact: "high", country: "US" },
      { time: "09:00", event: "GST Collection", impact: "medium", country: "IN" },
    ]
    
    setEvents(mockEvents)
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="macro-panel terminal-panel">
        <div className="macro-title">MACRO CALENDAR</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  return (
    <div className="macro-panel terminal-panel">
      <div className="macro-title">MACRO CALENDAR</div>
      {events.slice(0, 5).map((event, idx) => (
        <div key={idx} className="macro-event">
          <span className="macro-time">{event.time}</span>
          <span className="macro-event-name">{event.event}</span>
          <span className={`macro-impact ${event.impact}`}>{event.impact.toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}
