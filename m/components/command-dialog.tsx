"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Home, MessageSquare } from "lucide-react"
import { useChatHistory } from "@/lib/use-chat-history"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewChatCommandDialog({ open, onOpenChange }: CommandDialogProps) {
  const router = useRouter()
  const { chats } = useChatHistory()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search chats or create new..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              router.push('/')
              onOpenChange(false)
            }}
          >
            <Home className="h-4 w-4" />
            <span>New Chat</span>
          </CommandItem>
        </CommandGroup>

        {chats.length > 0 && (
          <CommandGroup heading="Recent Chats">
            {chats.slice(0, 10).map((chat) => (
              <CommandItem
                key={chat.id}
                onSelect={() => {
                  router.push(`/chat/${chat.id}`)
                  onOpenChange(false)
                }}
              >
                <MessageSquare className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(chat.updated_at)}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}