import { StockDetail } from "@/components/stock/StockDetail"

interface PageProps {
  params: Promise<{ symbol: string }>
}

export default async function StockPage({ params }: PageProps) {
  const { symbol } = await params

  return <StockDetail symbol={symbol} />
}
