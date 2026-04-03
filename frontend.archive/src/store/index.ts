import { create } from "zustand"
import type { DocumentRecord, PortfolioItem } from "@/lib/api"

interface AppState {
  walletAddress: string | null
  documents: DocumentRecord[]
  portfolio: PortfolioItem[]
  isLoadingPortfolio: boolean
  authToken: string | null
  setWalletAddress: (address: string | null) => void
  addDocument: (doc: DocumentRecord) => void
  setPortfolio: (items: PortfolioItem[]) => void
  setLoadingPortfolio: (loading: boolean) => void
  setAuthToken: (token: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  walletAddress: null,
  documents: [],
  portfolio: [],
  isLoadingPortfolio: false,
  authToken: null,
  setWalletAddress: (address) => set({ walletAddress: address }),
  addDocument: (doc) => set((s) => ({ documents: [...s.documents, doc] })),
  setPortfolio: (items) => set({ portfolio: items }),
  setLoadingPortfolio: (loading) => set({ isLoadingPortfolio: loading }),
  setAuthToken: (token) => set({ authToken: token }),
}))
