"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function AuthCodeError() {
  const [errorDetails, setErrorDetails] = useState<{
    error: string
    error_code: string
    error_description: string
  } | null>(null)

  useEffect(() => {
    // Parse error from URL hash
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)

    setErrorDetails({
      error: params.get('error') || 'unknown_error',
      error_code: params.get('error_code') || 'unknown',
      error_description: params.get('error_description') || 'An unknown error occurred'
    })
  }, [])

  if (!errorDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p>Loading error details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Authentication Error</h1>
          <p className="text-muted-foreground">
            There was a problem with your authentication
          </p>
        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2">
          <div className="text-sm">
            <span className="font-medium">Error:</span> {errorDetails.error}
          </div>
          <div className="text-sm">
            <span className="font-medium">Code:</span> {errorDetails.error_code}
          </div>
          <div className="text-sm">
            <span className="font-medium">Description:</span> {errorDetails.error_description}
          </div>
        </div>

        <div className="space-y-3">
          <Link href="/" className="block">
            <Button className="w-full">
              Try Again
            </Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            If this problem persists, please contact support
          </p>
        </div>
      </div>
    </div>
  )
}
