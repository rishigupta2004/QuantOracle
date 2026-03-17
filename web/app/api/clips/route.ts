import { NextRequest } from 'next/server'
import { cachedResponse } from '@/lib/cache'
import { checkDataRateLimit } from '@/lib/ratelimit'
import { getCompanyName } from '@/lib/universe'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'RELIANCE'
  
  // Rate limit check
  const rateLimit = checkDataRateLimit('clips', request)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  
  if (!apiKey) {
    // Return fallback with hardcoded finance channels
    return cachedResponse({
      source: 'fallback',
      videos: [],
      channels: [
        { name: 'Akshat Shrivastava', url: 'https://youtube.com/@AkshatShrivastava' },
        { name: 'CA Rachana Ranade', url: 'https://youtube.com/@CARachanaRanade' },
        { name: 'Groww', url: 'https://youtube.com/@Groww' },
        { name: 'CNBC-TV18', url: 'https://youtube.com/c/CNBCTV18' },
      ],
      message: 'Add YOUTUBE_API_KEY to enable video search'
    }, 'clips')
  }

  try {
    const companyName = getCompanyName(symbol)
    const searchTerms = [
      `${companyName} stock analysis`,
      `${companyName} Q4 results`,
      `${symbol.replace('.NS', '')} nifty analysis`,
    ]
    
    const query = searchTerms[0]
    
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=6&order=date&videoDuration=medium&key=${apiKey}`
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 14400 } // 4 hours cache
    })
    
    if (!res.ok) {
      const error = await res.text()
      console.error("YouTube API error:", res.status, error)
      
      // Check for quota exceeded
      if (res.status === 403 && error.includes('quotaExceeded')) {
        return cachedResponse({
          source: 'quota_exceeded',
          videos: [],
          message: 'YouTube API quota exceeded. Try again tomorrow.',
        }, 'clips')
      }
      
      throw new Error(`YouTube API returned ${res.status}`)
    }
    
    const data = await res.json()
    
    const videos = (data.items || []).map((item: any) => ({
      id: {
        videoId: item.id.videoId
      },
      snippet: {
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnails: item.snippet.thumbnails,
      }
    }))
    
    return cachedResponse({
      source: 'youtube',
      videos,
      query,
    }, 'clips')
  } catch (err) {
    console.error("Clips API error:", err)
    return Response.json(
      { error: 'Failed to fetch clips', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
