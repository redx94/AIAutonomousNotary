'use client'
import { useState, useCallback } from 'react'

export function useDocumentHash() {
  const [hash, setHash] = useState<string | null>(null)
  const [isHashing, setIsHashing] = useState(false)

  const computeHash = useCallback(async (file: File): Promise<string> => {
    setIsHashing(true)
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    setHash(hashHex)
    setIsHashing(false)
    return hashHex
  }, [])

  return { hash, isHashing, computeHash }
}
