"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader } from '@/components/ui/sidebar'
import { Home, Search } from 'lucide-react'

import { useChatHistory } from '@/lib/use-chat-history'
import { NewChatCommandDialog } from '@/components/command-dialog'

interface ChatHistoryProps {
  currentChatId?: string
  onNewChat?: () => void
  showHeader?: boolean
}

export function ChatHistory({ currentChatId, onNewChat, showHeader = true }: ChatHistoryProps) {
  const router = useRouter()
  const { chats, loading } = useChatHistory()
  const [commandDialogOpen, setCommandDialogOpen] = useState(false)

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

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
    <div className="space-y-2">
      <SidebarMenu>
        <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => router.push(`/`)}
                className="w-full justify-start"
              >
                <div className="flex-1 min-w-0 text-left flex gap-2 items-center">
                <Home className="h-4 w-4" />
                  <p className="text-sm font-medium truncate"> New Chat</p>
                  
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setCommandDialogOpen(true)}
                className="w-full justify-start"
              >
                <div className="flex-1 min-w-0 text-left flex gap-2 items-center">
                <Search className="h-4 w-4" />
                  <p className="text-sm font-medium truncate">Search Chats</p>

                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          <SidebarHeader className="text-xs font-medium text-muted-foreground pb-0 mb-0">Chats</SidebarHeader>

          {chats.map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton
                onClick={() => router.push(`/chat/${chat.id}`)}
                isActive={currentChatId === chat.id}
                className="w-full justify-start"
              >
                <div className="flex-1 min-w-0 text-left flex justify-between items-center">
                  <p className="text-sm font-medium truncate max-w-[75%]">{chat.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(chat.updated_at)}
                  </p>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>

      <NewChatCommandDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
      />
    </>
  )
}
