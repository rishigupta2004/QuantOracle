"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl, { type GeoJSONSource } from "maplibre-gl"

import type { Quote } from "@/lib/client/types"

type Props = {
  quotes: Record<string, Quote>
  activeSymbol: string
  onSelectSymbol: (symbol: string) => void
}

type Marker = {
  symbol: string
  lon: number
  lat: number
}

const MARKERS: Marker[] = [
  { symbol: "RELIANCE.NS", lon: 72.8777, lat: 19.076 },
  { symbol: "TCS.NS", lon: 72.8777, lat: 19.076 },
  { symbol: "HDFCBANK.NS", lon: 77.5946, lat: 12.9716 },
  { symbol: "AAPL", lon: -122.0312, lat: 37.3329 },
  { symbol: "MSFT", lon: -122.1215, lat: 47.674 },
  { symbol: "NVDA", lon: -121.9624, lat: 37.3875 },
  { symbol: "BTC-USD", lon: 8.5417, lat: 47.3769 },
  { symbol: "ETH-USD", lon: 13.405, lat: 52.52 }
]

const MAP_STYLE = (() => {
  const envStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL
  if (envStyle) return envStyle

  const apiKey = process.env.STADIA_MAPS_API_KEY || ""
  if (apiKey) {
    return `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=${apiKey}`
  }
  return "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json"
})()

function pointColor(q: Quote | undefined, active: boolean): string {
  if (active) {
    return "#f8fafc"
  }
  if (!q || !q.available) {
    return "#f59e0b"
  }
  return q.change_pct >= 0 ? "#22c55e" : "#ef4444"
}

function pointRadius(q: Quote | undefined, active: boolean): number {
  if (active) {
    return 10
  }
  if (!q || !q.available) {
    return 6
  }
  return Math.min(9, Math.max(5, Math.abs(q.change_pct) * 1.25 + 4))
}

export function MapStage({ quotes, activeSymbol, onSelectSymbol }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const active = quotes[activeSymbol]

  const featureCollection = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: MARKERS.map((m) => {
        const q = quotes[m.symbol]
        const isActive = m.symbol === activeSymbol
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [m.lon, m.lat] as [number, number]
          },
          properties: {
            symbol: m.symbol,
            color: pointColor(q, isActive),
            radius: pointRadius(q, isActive),
            available: q?.available ? 1 : 0,
            stale: q?.stale ? 1 : 0,
            source: q?.source ?? "unavailable",
            price: q?.price ?? 0,
            change_pct: q?.change_pct ?? 0
          }
        }
      })
    }
  }, [quotes, activeSymbol])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [20, 22],
      zoom: 1.2,
      minZoom: 1,
      maxZoom: 7,
      attributionControl: false
    })

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        showZoom: true
      }),
      "top-right"
    )

    map.on("load", () => {
      setMapReady(true)
      map.addSource("wm-markers", {
        type: "geojson",
        data: featureCollection
      })

      map.addLayer({
        id: "wm-markers-glow",
        type: "circle",
        source: "wm-markers",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["+", ["get", "radius"], 8],
          "circle-opacity": 0.16,
          "circle-blur": 0.75
        }
      })

      map.addLayer({
        id: "wm-markers-core",
        type: "circle",
        source: "wm-markers",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "radius"],
          "circle-stroke-color": "#111111",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.96
        }
      })

      map.addLayer({
        id: "wm-markers-label",
        type: "symbol",
        source: "wm-markers",
        layout: {
          "text-field": ["get", "symbol"],
          "text-size": 10,
          "text-offset": [0, 1.6],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-font": ["Open Sans Semibold"]
        },
        paint: {
          "text-color": "#d4d4d4",
          "text-halo-color": "#0a0a0a",
          "text-halo-width": 1
        }
      })

      map.on("mouseenter", "wm-markers-core", () => {
        map.getCanvas().style.cursor = "pointer"
      })

      map.on("mouseleave", "wm-markers-core", () => {
        map.getCanvas().style.cursor = ""
      })

      map.on("click", "wm-markers-core", (evt) => {
        const symbol = evt.features?.[0]?.properties?.symbol
        if (typeof symbol === "string" && symbol) {
          onSelectSymbol(symbol)
        }
      })
    })

    map.on("error", () => {
      setMapError("map tiles unavailable")
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [featureCollection, onSelectSymbol])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const src = map.getSource("wm-markers") as GeoJSONSource | undefined
    if (!src) {
      return
    }
    src.setData(featureCollection)
  }, [featureCollection])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const selected = MARKERS.find((m) => m.symbol === activeSymbol)
    if (!selected) {
      return
    }
    map.easeTo({ center: [selected.lon, selected.lat], duration: 900, zoom: Math.max(map.getZoom(), 2.4) })
  }, [activeSymbol])

  return (
    <section className="wm-map-stage panel">
      <div className="wm-map-header">
        <span>GLOBAL THEATER</span>
        <span className="wm-map-sub">symbol focus: {activeSymbol}</span>
      </div>

      <div className="wm-map-canvas">
        <div ref={mapContainerRef} className="wm-map-view" />
        <div className="wm-map-vignette" />

        <div className="wm-map-overlay">
          <div className="wm-map-focus">{activeSymbol}</div>
          <div className="wm-map-line">
            {active?.available
              ? `${active.price.toFixed(2)} (${active.change_pct >= 0 ? "+" : ""}${active.change_pct.toFixed(2)}%)`
              : "No live quote"}
          </div>
          <div className="wm-map-line">
            source: {active?.source ?? "unavailable"} {active?.stale ? "(stale)" : ""}
          </div>
        </div>

        <div className="wm-map-legend">
          <span className="dot up" /> Up
          <span className="dot down" /> Down
          <span className="dot warn" /> Unavailable
          <span className="dot active" /> Active
          <span className={mapReady && !mapError ? "ok" : "warn"}>
            {mapReady && !mapError ? "map live" : mapError ?? "loading map"}
          </span>
        </div>
      </div>
    </section>
  )
}
