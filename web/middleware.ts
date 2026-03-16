import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher([
  '/portfolio(.*)',
  '/api/watchlist(.*)',
  '/api/ai(.*)',
])

// Check if Clerk is configured
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export default clerkMiddleware((auth, req) => {
  // Skip Clerk auth if not configured (for local development)
  if (!clerkConfigured) {
    return
  }
  if (isProtectedRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
