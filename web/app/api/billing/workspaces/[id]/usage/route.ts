import { NextRequest, NextResponse } from "next/server"

import { billingAuthValid, workspaceUsage } from "@/lib/workspace-store"

export const runtime = "nodejs"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!billingAuthValid(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = decodeURIComponent(params.id || "default").trim() || "default"
  const payload = await workspaceUsage(workspaceId)
  return NextResponse.json(payload)
}
