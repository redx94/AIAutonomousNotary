const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export type DocumentRecord = { documentHash: string; tokenId: string; documentType: string; notaryAddress: string; registeredAt: string; ipfsCid?: string }
export type AnalysisResult = { riskScore: number; fraudSignals: string[]; recommendation: string; analysisId: string }
export type PortfolioItem = { tokenId: string; vaultId: string; shares: string; value: string }
export type MarketOrder = { orderId: string; tokenAddress: string; price: string; quantity: string; status: number }

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function uploadDocument(formData: FormData): Promise<DocumentRecord> {
  const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", body: formData })
  return handleResponse<DocumentRecord>(res)
}

export async function getDocument(hash: string): Promise<DocumentRecord | null> {
  const res = await fetch(`${API_BASE}/documents/${hash}`)
  if (res.status === 404) return null
  return handleResponse<DocumentRecord>(res)
}

export async function analyzeDocument(hash: string, content: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/documents/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash, content }) })
  return handleResponse<AnalysisResult>(res)
}

export async function getPortfolio(address: string): Promise<PortfolioItem[]> {
  const res = await fetch(`${API_BASE}/portfolio/${address}`)
  return handleResponse<PortfolioItem[]>(res)
}

export async function getMarketOrders(page = 1, limit = 20): Promise<{ orders: MarketOrder[]; total: number }> {
  const res = await fetch(`${API_BASE}/marketplace/orders?page=${page}&limit=${limit}`)
  return handleResponse<{ orders: MarketOrder[]; total: number }>(res)
}

export async function getNonce(address: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/nonce/${address}`)
  return handleResponse<string>(res)
}

export async function verifySignature(address: string, message: string, signature: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, message, signature }) })
  return handleResponse<{ token: string }>(res)
}
