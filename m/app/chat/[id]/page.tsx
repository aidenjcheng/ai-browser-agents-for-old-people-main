"use client"

import { useParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { TaskChatInterface } from '@/components/task-chat-interface'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/app/page'

function ChatPageContent() {
  const { id } = useParams()
  const router = useRouter()
  const chatId = Array.isArray(id) ? id[0] : id

  return (
    <SidebarProvider>
      <div className="flex max-h-screen w-full bg-sidebar">
<AppSidebar/>
        <main className="flex-1 flex flex-col border-l mt-1 border-t rounded-xl bg-background h-fit min-h-screen">
          {/* Header */}
          <header className="flex items-center justify-between pl-2 pt-2 pb-4 pr-4">
            <div className="flex items-center space-x-3">
              <SidebarTrigger />

            </div>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Home
            </button>
          </header>

          {/* Chat Interface */}
          <div className="flex-1 flex pt-20 flex-col">
            <TaskChatInterface taskId={chatId} />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}


export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatPageContent />
    </ProtectedRoute>
  )
}
