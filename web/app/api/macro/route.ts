import { NextResponse } from "next/server"

import { getMacroSnapshot } from "@/lib/macro"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const payload = await getMacroSnapshot()
  return NextResponse.json(payload)
}
