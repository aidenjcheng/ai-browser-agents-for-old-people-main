"use client"

import { ChatHistory } from "@/components/chat/chat-history";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarProvider, Sidebar, SidebarContent, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useChatHistory } from "@/lib/use-chat-history";
import { LogOut, Brain } from "lucide-react";
import { PromptInputBasic } from "@/components/prompt-input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

function HomeContent() {
  const { user, signOut } = useAuth();
  const { hasChats } = useChatHistory();
  const [showMemoriesDialog, setShowMemoriesDialog] = useState(false);
  const [userMemories, setUserMemories] = useState<string[]>([]);

  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const fetchUserMemories = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('memories')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching memories:', error);
        return;
      }

      if (data?.memories) {
        setUserMemories(data.memories);
      } else {
        setUserMemories([]);
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
      setUserMemories([]);
    }
  };

  useEffect(() => {
    if (showMemoriesDialog && user?.id) {
      fetchUserMemories();
    }
  }, [showMemoriesDialog, user?.id]);

  return (
    <SidebarProvider>
      <div className="flex max-h-screen w-full bg-sidebar">
        {hasChats && <AppSidebar />}
        <main className={`${hasChats ? 'flex-1' : 'w-full'} flex flex-col border-l mt-1 border-t rounded-xl bg-background h-fit min-h-screen`}>
          {/* Header */}
          <header className="flex items-center justify-between pl-2 pt-2 pb-4 pr-4">
            <div className="flex items-center space-x-3">
              {hasChats && <SidebarTrigger />}

            </div>

            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="size-8">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || ''} />
                      <AvatarFallback className="text-xs">
                        {user?.email ? getUserInitials(user.email) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuItem onClick={() => setShowMemoriesDialog(true)}>
                    <Brain className="mr-2 h-4 w-4" />
                    <span>View Memories</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 flex pt-20 justify-center px-8">
            <div className="max-w-2xl w-full space-y-8">
              <div className="text-left space-y-4">
                <h2 className="text-3xl font-bold">L2 AI</h2>
                <p className="text-lg text-muted-foreground">
                  Describe what you want the browser to do and I'll help you automate it.
                </p>
              </div>

              <PromptInputBasic />
            </div>
          </div>
        </main>
      </div>

      {/* Memories Dialog */}
      <Dialog open={showMemoriesDialog} onOpenChange={setShowMemoriesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Your Memories
            </DialogTitle>
            <DialogDescription>
              Personalization insights learned from your interactions. These help the AI understand your preferences and behavior patterns.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {userMemories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No memories yet</p>
                <p className="text-sm">Memories will be created as you interact with the AI and complete tasks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userMemories.map((memory, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{memory}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent className=" mx-2 mt-5">
        <ChatHistory showHeader={false} />
      </SidebarContent>
    </Sidebar>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}

