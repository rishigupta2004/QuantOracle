"use client"

import { useEffect, useState, useMemo } from "react"
import Image from "next/image"
import { getCompanyName } from "@/lib/universe"

type NewsItem = {
  title: string
  link: string
  pubDate: string
  source_id?: string
  description?: string
  keywords?: string[]
}

type SocialItem = {
  id: number
  user: { name: string; username: string }
  body: string
  sentiment?: 'bullish' | 'bearish'
  created_at: number
  likes: number
}

type ClipItem = {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    publishedAt: string
    thumbnails: { medium?: { url: string } }
  }
}

type Props = {
  symbol?: string
}

type Tab = 'news' | 'social' | 'clips'

export function NewsPanel({ symbol = "RELIANCE.NS" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('news')
  const [news, setNews] = useState<NewsItem[]>([])
  const [social, setSocial] = useState<SocialItem[]>([])
  const [clips, setClips] = useState<ClipItem[]>([])
  const [loading, setLoading] = useState({ news: true, social: true, clips: true })
  const [sentiment, setSentiment] = useState<{ bullish: number; bearish: number; total: number } | null>(null)

  const companyName = useMemo(() => getCompanyName(symbol), [symbol])

  // Fetch news
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(l => ({ ...l, news: true }))
      try {
        const res = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`)
        if (!res.ok) {
          setNews([])
          setLoading(l => ({ ...l, news: false }))
          return
        }
        const data = await res.json()
        if (data.results) {
          // Filter to symbol-relevant news
          const relevant = data.results.filter((item: NewsItem) => {
            const searchText = `${item.title} ${item.description || ''}`.toLowerCase()
            return searchText.includes(symbol.toLowerCase().replace('.NS', '').toLowerCase()) ||
                   searchText.includes(companyName.toLowerCase())
          })
          
          // If not enough relevant, use all news
          setNews(relevant.length >= 3 ? relevant : data.results.slice(0, 20))
          
          // Calculate sentiment
          const bullishKeywords = ['surge', 'jump', 'gain', 'rise', 'rally', 'bullish', 'buy', 'upgrade', 'outperform']
          const bearishKeywords = ['fall', 'drop', 'crash', 'sell', 'downgrade', 'bearish', 'weak', 'loss']
          
          let bullish = 0, bearish = 0
          data.results.forEach((item: NewsItem) => {
            const text = `${item.title} ${item.description || ''}`.toLowerCase()
            if (bullishKeywords.some(k => text.includes(k))) bullish++
            if (bearishKeywords.some(k => text.includes(k))) bearish++
          })
          
          if (bullish + bearish > 0) {
            setSentiment({ bullish, bearish, total: bullish + bearish })
          }
        }
      } catch (err) {
        console.error("News fetch error:", err)
      } finally {
        setLoading(l => ({ ...l, news: false }))
      }
    }
    fetchNews()
  }, [symbol, companyName])

  // Fetch social
  useEffect(() => {
    const fetchSocial = async () => {
      setLoading(l => ({ ...l, social: true }))
      try {
        const res = await fetch(`/api/social/${encodeURIComponent(symbol)}`)
        if (!res.ok) {
          setSocial([])
          setLoading(l => ({ ...l, social: false }))
          return
        }
        const data = await res.json()
        if (data.messages) {
          setSocial(data.messages.slice(0, 10))
        }
      } catch (err) {
        console.error("Social fetch error:", err)
      } finally {
        setLoading(l => ({ ...l, social: false }))
      }
    }
    fetchSocial()
  }, [symbol])

  // Fetch clips
  useEffect(() => {
    const fetchClips = async () => {
      setLoading(l => ({ ...l, clips: true }))
      try {
        const res = await fetch(`/api/clips?symbol=${encodeURIComponent(symbol)}`)
        if (!res.ok) {
          setClips([])
          setLoading(l => ({ ...l, clips: false }))
          return
        }
        const data = await res.json()
        if (data.videos) {
          setClips(data.videos.slice(0, 6))
        }
      } catch (err) {
        console.error("Clips fetch error:", err)
      } finally {
        setLoading(l => ({ ...l, clips: false }))
      }
    }
    fetchClips()
  }, [symbol])

  const formatTimeAgo = (dateStr: string | number) => {
    const date = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr)
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const getFaviconUrl = (sourceId?: string) => {
    if (!sourceId) return null
    return `https://www.google.com/s2/favicons?domain=${sourceId}&sz=16`
  }

  return (
    <div className="news-panel terminal-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sentiment Summary */}
      {sentiment && activeTab === 'news' && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-dim)',
          fontSize: '10px',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {symbol.replace('.NS', '')} — Last 24h 
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ flex: 1, height: '6px', background: 'var(--signal-buy)', borderRadius: '2px' }} />
            <span style={{ color: 'var(--signal-buy)', fontWeight: 500 }}>
              {Math.round(sentiment.bullish / sentiment.total * 100)}% BULLISH
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <span style={{ color: 'var(--signal-sell)', fontWeight: 500 }}>
              {Math.round(sentiment.bearish / sentiment.total * 100)}% BEARISH
            </span>
          </div>
          <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>
            Based on {sentiment.total} articles
          </span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-dim)' }}>
        <button
          className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          NEWS 20
        </button>
        <button
          className={`tab-btn ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => setActiveTab('social')}
        >
          SOCIAL
        </button>
        <button
          className={`tab-btn ${activeTab === 'clips' ? 'active' : ''}`}
          onClick={() => setActiveTab('clips')}
        >
          VIDEOS
        </button>
      </div>

      {/* Tab Content */}
      <div className="panel-content" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        
        {/* NEWS TAB */}
        {activeTab === 'news' && (
          <div className="tab-news">
            {loading.news ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <span className="pixel-loader" />
              </div>
            ) : (
              news.slice(0, 20).map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-item"
                  style={{
                    display: 'block',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-dim)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {getFaviconUrl(item.source_id) && (
                      <Image 
                        src={getFaviconUrl(item.source_id)!} 
                        alt=""
                        width={14}
                        height={14}
                        style={{ marginTop: '2px', borderRadius: '2px' }}
                        unoptimized
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', lineHeight: 1.4, fontWeight: 500 }}>
                        {item.title.slice(0, 100)}{item.title.length > 100 ? '...' : ''}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {item.source_id} · {formatTimeAgo(item.pubDate)}
                      </div>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {/* SOCIAL TAB */}
        {activeTab === 'social' && (
          <div className="tab-social">
            {loading.social ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <span className="pixel-loader" />
              </div>
            ) : social.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                No social data available for {symbol.replace('.NS', '')}
              </div>
            ) : (
              social.map((item) => (
                <div
                  key={item.id}
                  className="social-item"
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-dim)',
                    borderLeft: item.sentiment === 'bullish' ? '3px solid var(--signal-buy)' :
                               item.sentiment === 'bearish' ? '3px solid var(--signal-sell)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      @{item.user.username}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                      {formatTimeAgo(item.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '4px', lineHeight: 1.4 }}>
                    {item.body.slice(0, 120)}{item.body.length > 120 ? '...' : ''}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    ♥ {item.likes} {item.sentiment && (
                      <span style={{ 
                        marginLeft: '8px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        background: item.sentiment === 'bullish' ? 'var(--signal-buy)' : 'var(--signal-sell)',
                        color: '#fff',
                      }}>
                        {item.sentiment.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {/* Twitter Section */}
            <div style={{
              padding: '12px',
              borderBottom: '1px solid var(--border-dim)',
              background: 'var(--bg-raised)',
            }}>
              <a
                href={`https://twitter.com/search?q=%24${symbol.replace('.NS', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '10px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-dim)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '9px',
                }}
              >
                View ${symbol.replace('.NS', '')} on Twitter →
              </a>
            </div>
          </div>
        )}

        {/* CLIPS TAB */}
        {activeTab === 'clips' && (
          <div className="tab-clips">
            {loading.clips ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <span className="pixel-loader" />
              </div>
            ) : clips.length === 0 ? (
              <div style={{ padding: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '12px', textAlign: 'center' }}>
                  No videos available for {symbol.replace('.NS', '')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { name: 'Akshat Shrivastava', handle: '@AkshatShrivastava', url: 'https://youtube.com/@AkshatShrivastava' },
                    { name: 'CA Rachana Ranade', handle: '@CARachanaRanade', url: 'https://youtube.com/@CARachanaRanade' },
                    { name: 'Finology Ticker', handle: '@FinologyTicker', url: 'https://youtube.com/@FinologyTicker' },
                    { name: 'CNBC TV18', handle: '@CNBCTV18', url: 'https://youtube.com/@CNBCTV18' },
                    { name: 'Groww', handle: '@Groww', url: 'https://youtube.com/@Groww' },
                    { name: 'Zerodha', handle: '@ZerodhaLive', url: 'https://youtube.com/@ZerodhaLive' },
                  ].map((channel) => (
                    <a
                      key={channel.handle}
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '10px',
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 600, marginBottom: '2px' }}>
                        {channel.name}
                      </div>
                      <div style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>
                        {channel.handle}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px' }}>
                {clips.map((clip) => (
                  <a
                    key={clip.id.videoId}
                    href={`https://www.youtube.com/watch?v=${clip.id.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clip-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ position: 'relative' }}>
                      <Image
                        src={clip.snippet.thumbnails.medium?.url || '/placeholder.png'}
                        alt={clip.snippet.title}
                        width={160}
                        height={90}
                        style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ fontSize: '9px', marginTop: '4px', lineHeight: 1.3 }}>
                      {clip.snippet.title.slice(0, 50)}{clip.snippet.title.length > 50 ? '...' : ''}
                    </div>
                    <div style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {clip.snippet.channelTitle}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .tab-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-pixel);
          font-size: 10px;
          padding: 8px 12px;
          cursor: pointer;
          borderBottom: 2px solid transparent;
        }
        .tab-btn.active {
          color: var(--text-primary);
          borderBottom: 2px solid var(--accent-primary);
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .news-item:hover {
          background: var(--bg-hover);
        }
        .social-item:hover {
          background: var(--bg-hover);
        }
        .clip-card:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  )
}
