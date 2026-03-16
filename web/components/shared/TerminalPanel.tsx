"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface TerminalPanelProps {
  id: string;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  isLive?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function TerminalPanel({
  id,
  title,
  subtitle,
  lastUpdated,
  isLive = false,
  isLoading = false,
  onRefresh,
  children,
}: TerminalPanelProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div
      id={id}
      className={`terminal-panel bg-[var(--bg-panel)] border border-[var(--border-dim)] ${
        isHovered ? "border-[var(--border-mid)]" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-dim)]">
        <div className="flex items-center gap-3">
          <span className="pixel-label font-[var(--font-pixel)] text-[8px] text-[var(--text-accent)] uppercase tracking-wider">
            {title}
          </span>
          {subtitle && (
            <span className="text-[var(--text-secondary)] text-sm font-mono">
              {subtitle}
            </span>
          )}
          {isLive && (
            <span className="status-live" title="Live data" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[var(--text-dim)] text-xs">
              {formatTimeAgo(lastUpdated)}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-[var(--text-secondary)] ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--bg-raised)] overflow-hidden">
            <div className="pixel-loader h-full bg-[var(--text-accent)]" />
          </div>
        )}
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
