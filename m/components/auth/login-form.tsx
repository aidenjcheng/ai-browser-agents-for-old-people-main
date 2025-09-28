"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { Mail, Loader2 } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { signIn } = useAuth()

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setMessage('')

    const { error } = await signIn(email.trim())

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Magic link sent! Check your email for the login link.')
    }

    setIsLoading(false)
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-left space-y-2">

        <h1 className="text-xl font-bold">Login</h1>
        <p className="text-muted-foreground">
          Sign in with your email to continue
        </p>
      </div>

      <form onSubmit={handleSendMagicLink} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <Button type="submit" className="w-full" variant="outline" disabled={isLoading || !email.trim()}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Magic Link
        </Button>
      </form>

      {message && (
        <div className={`text-center text-sm p-3 rounded-lg ${
          message.includes('error') || message.includes('Error') || message.includes('Invalid')
            ? 'bg-destructive/10 text-destructive'
            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        }`}>
          {message}
        </div>
      )}


    </div>
  )
}
