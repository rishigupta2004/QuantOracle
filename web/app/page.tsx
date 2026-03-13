"use client"

import { CommandShell } from "@/components/shell/CommandShell"
import { useCommandData } from "@/lib/client/useCommandData"
import { useShellState } from "@/lib/client/useShellState"

const WATCHLIST = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "AAPL",
  "MSFT",
  "NVDA",
  "BTC-USD",
  "ETH-USD"
]

export default function Page() {
  const workspaceId = process.env.NEXT_PUBLIC_WORKSPACE_ID || "default"
  const shell = useShellState(WATCHLIST[0])
  const data = useCommandData(workspaceId, WATCHLIST)

  return (
    <CommandShell
      workspaceId={workspaceId}
      watchlist={WATCHLIST}
      usage={data.usage}
      quotes={data.quotes}
      macro={data.macro}
      news={data.news}
      status={data.status}
      errors={data.errors}
      isLoading={data.isLoading}
      refreshAll={data.refreshAll}
      leftOpen={shell.leftOpen}
      rightOpen={shell.rightOpen}
      commandOpen={shell.commandOpen}
      upgradeOpen={shell.upgradeOpen}
      activeSymbol={shell.activeSymbol}
      density={shell.density}
      activePanel={shell.activePanel}
      layoutPreset={shell.layoutPreset}
      panelOrder={shell.panelOrder}
      layoutSlots={shell.layoutSlots}
      leftWidth={shell.leftWidth}
      rightWidth={shell.rightWidth}
      setLeftOpen={shell.setLeftOpen}
      setRightOpen={shell.setRightOpen}
      setCommandOpen={shell.setCommandOpen}
      setUpgradeOpen={shell.setUpgradeOpen}
      setActiveSymbol={shell.setActiveSymbol}
      setDensity={shell.setDensity}
      setActivePanel={shell.setActivePanel}
      setLayoutPreset={shell.setLayoutPreset}
      setPanelOrder={shell.setPanelOrder}
      resetPanelOrder={shell.resetPanelOrder}
      saveLayoutSlot={shell.saveLayoutSlot}
      loadLayoutSlot={shell.loadLayoutSlot}
      resetLayoutSlots={shell.resetLayoutSlots}
      setLeftWidth={shell.setLeftWidth}
      setRightWidth={shell.setRightWidth}
    />
  )
}
