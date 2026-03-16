export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'quantoracle-artifacts'
    const url = `${supabaseUrl}/storage/v1/object/public/${bucket}/eod/nifty50/screener.json`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('No screener data')
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ rankings: [], error: 'Screener data unavailable' })
  }
}
