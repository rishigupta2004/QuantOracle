import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

interface WatchlistItem {
  symbol: string
  addedAt: string
}

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js")
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const requestedUserId = url.searchParams.get("user_id")

    if (requestedUserId && requestedUserId !== clerkUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!hasSupabaseConfig()) {
      return NextResponse.json({ watchlist: [], preferences: {} })
    }

    const supabase = await getSupabaseClient()
    const { data, error } = await supabase
      .from("user_preferences")
      .select("watchlist, preferences")
      .eq("clerk_user_id", clerkUserId)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({
      watchlist: data?.watchlist || [],
      preferences: data?.preferences || {}
    })
  } catch (err) {
    console.error("Preferences GET error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { user_id, watchlist, preferences } = body

    if (user_id && user_id !== clerkUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!hasSupabaseConfig()) {
      return NextResponse.json({ success: true, synced: false })
    }

    const supabase = await getSupabaseClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (watchlist !== undefined) {
      updateData.watchlist = watchlist
    }

    if (preferences !== undefined) {
      updateData.preferences = preferences
    }

    const { error: upsertError } = await supabase
      .from("user_preferences")
      .upsert(
        {
          clerk_user_id: clerkUserId,
          watchlist: watchlist || [],
          preferences: preferences || {},
          updated_at: new Date().toISOString()
        },
        { onConflict: "clerk_user_id" }
      )

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({ success: true, synced: true })
  } catch (err) {
    console.error("Preferences POST error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
