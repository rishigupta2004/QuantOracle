import { LabShell } from "@/components/lab/LabShell"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Quant Lab — QuantOracle",
  description: "Build and validate your own quantitative models",
}

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export default async function LabPage() {
  if (clerkConfigured) {
    const { userId } = await auth()
    if (!userId) {
      redirect("/sign-in?redirect_url=/lab")
    }
  }

  return <LabShell />
}
