import { StockDetail } from "@/components/stock/StockDetail"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
const clerkMiddlewareEnabled = process.env.NEXT_PUBLIC_CLERK_MIDDLEWARE_ACTIVE === "true"

interface PageProps {
  params: Promise<{ symbol: string }>
}

export default async function StockPage({ params }: PageProps) {
  const { symbol } = await params

  if (clerkConfigured && clerkMiddlewareEnabled) {
    const { userId } = await auth()
    if (!userId) {
      redirect(`/sign-in?redirect_url=/stock/${encodeURIComponent(symbol)}`)
    }
  }

  return <StockDetail symbol={symbol} />
}
