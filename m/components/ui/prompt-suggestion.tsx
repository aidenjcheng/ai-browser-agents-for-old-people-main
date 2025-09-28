"use client"

import { cn } from "@/lib/utils"

interface PromptSuggestionProps {
  children: React.ReactNode
  onClick: () => void
  className?: string
}

export function PromptSuggestion({ children, onClick, className }: PromptSuggestionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border border-input bg-background px-3 py-1 text-[13px] shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}
