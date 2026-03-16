"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface MetricRowProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  trend?: "up" | "down" | "flat";
}

export function MetricRow({ label, value, delta, deltaLabel, trend }: MetricRowProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      return val.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      });
    }
    return val;
  };

  const getDeltaColor = () => {
    if (trend === "up") return "text-[var(--signal-buy)]";
    if (trend === "down") return "text-[var(--signal-sell)]";
    return "text-[var(--text-secondary)]";
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[var(--text-secondary)] text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[var(--text-primary)]">
          {formatValue(value)}
        </span>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs ${getDeltaColor()}`}>
            {trend === "up" && <ArrowUp className="w-3 h-3" />}
            {trend === "down" && <ArrowDown className="w-3 h-3" />}
            {trend === "flat" && <Minus className="w-3 h-3" />}
            {deltaLabel || `${Math.abs(delta).toFixed(2)}%`}
          </span>
        )}
      </div>
    </div>
  );
}
