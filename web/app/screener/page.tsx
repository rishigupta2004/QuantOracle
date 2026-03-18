import { ScreenerPanel } from "@/components/screener/ScreenerPanel"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
const clerkMiddlewareEnabled = process.env.NEXT_PUBLIC_CLERK_MIDDLEWARE_ACTIVE === "true"

export default async function ScreenerPage() {
  if (clerkConfigured && clerkMiddlewareEnabled) {
    const { userId } = await auth()
    if (!userId) {
      redirect("/sign-in?redirect_url=/screener")
    }
  }

  return <ScreenerPanel />
}
