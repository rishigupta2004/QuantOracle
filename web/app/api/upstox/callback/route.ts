import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

async function exchangeCode(code: string) {
  const clientId = (process.env.UPSTOX_CLIENT_ID ?? "").trim()
  const clientSecret = (process.env.UPSTOX_CLIENT_SECRET ?? "").trim()
  const redirectUri = (process.env.UPSTOX_REDIRECT_URI ?? "").trim()

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      ok: false,
      error: "Set UPSTOX_CLIENT_ID, UPSTOX_CLIENT_SECRET, and UPSTOX_REDIRECT_URI in Vercel env."
    }
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  })

  const r = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  })
  const data = (await r.json()) as Record<string, unknown>
  if (!r.ok) {
    return { ok: false, error: data.message ?? "Token exchange failed", raw: data }
  }
  return {
    ok: true,
    access_token: data.access_token,
    expires_at: data.expires_at,
    user_id: data.user_id
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")

  if (!code) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing authorization code.",
        hint: "Authorize via Upstox and retry callback with ?code=..."
      },
      { status: 400 }
    )
  }

  try {
    const result = await exchangeCode(code)
    return NextResponse.json({
      ...result,
      state: state || null,
      next_step: result.ok
        ? "Copy access_token into Vercel env var UPSTOX_ACCESS_TOKEN and redeploy."
        : "Fix env vars or auth code flow and retry."
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected callback error"
      },
      { status: 500 }
    )
  }
}
