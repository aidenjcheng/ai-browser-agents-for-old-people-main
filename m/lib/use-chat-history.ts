"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export function useChatHistory() {
  const { user } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchChats = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(20)

        if (error) throw error
        setChats(data || [])
      } catch (error) {
        console.error('Error fetching chats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchChats()

    // Subscribe to chat updates
    const chatsSubscription = supabase
      .channel('user-chats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChats(prev => [payload.new as Chat, ...prev.filter(c => c.id !== payload.new.id)])
        } else if (payload.eventType === 'UPDATE') {
          setChats(prev => prev.map(chat =>
            chat.id === payload.new.id ? payload.new as Chat : chat
          ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
        }
      })
      .subscribe()

    return () => {
      chatsSubscription.unsubscribe()
    }
  }, [user])

  const hasChats = chats.length > 0

  return {
    chats,
    loading,
    hasChats
  }
}
