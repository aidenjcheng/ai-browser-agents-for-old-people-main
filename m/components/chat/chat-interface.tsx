"use client"

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PromptInputComponent } from '@/components/prompt-input'

interface Message {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ChatInterfaceProps {
  messages: Message[]
  chatId: string
}

interface TaskResponse {
  id: string
  status: string
  task?: string
  message?: string
  output?: string
  error?: string
  started_at?: string
  completed_at?: string
  urls_visited?: string[]
  actions?: string[]
  steps?: number
}

interface TaskStatus {
  id: string
  status: string
  task?: string
  started_at?: string
  completed_at?: string
  output?: string
  error?: string
  urls_visited?: string[]
  actions?: string[]
  steps?: number
}

export function ChatInterface({ messages, chatId }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentTask, setCurrentTask] = useState<TaskResponse | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const runTask = async (taskDescription: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: taskDescription,
          metadata: { source: "manus-ai-frontend" }
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const taskResponse: TaskResponse = await response.json()
      setCurrentTask(taskResponse)
      return taskResponse
    } catch (error) {
      console.error("Error running task:", error)
      return null
    }
  }

  const checkTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`)
      if (!response.ok) {
        if (response.status === 404) {
          return null // Task not found
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const status: TaskStatus = await response.json()
      setTaskStatus(status)
      return status
    } catch (error) {
      console.error("Error checking task status:", error)
      return null
    }
  }

  const pollTaskStatus = async (taskId: string) => {
    const status = await checkTaskStatus(taskId)
    if (status && ["finished", "failed", "stopped"].includes(status.status)) {
      // Task completed, add assistant response
      const resultText = status.output || status.error || "Task completed"

      // Add assistant message to chat
      // await supabase
      //   .from('messages')
      //   .insert({
      //     chat_id: chatId,
      //     role: 'assistant',
      //     content: resultText
      //   })

      setCurrentTask(status)
      setIsLoading(false)
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    const messageContent = input.trim()
    setInput('')
    setIsLoading(true)
    setCurrentTask(null)
    setTaskStatus(null)

    try {
      // Add user message to chat
      // await supabase
      //   .from('messages')
      //   .insert({
      //     chat_id: chatId,
      //     role: 'user',
      //     content: messageContent
      //   })

      // Execute the task
      const taskResponse = await runTask(messageContent)

      if (taskResponse && taskResponse.id) {
        // Start polling for status updates
        pollingIntervalRef.current = setInterval(() => {
          pollTaskStatus(taskResponse.id)
        }, 2000) // Poll every 2 seconds

        // Initial status check
        await pollTaskStatus(taskResponse.id)
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error:', error)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl w-full mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Describe what you want the browser to do and I'll help you automate it.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex w-full ${
                message.role === 'user' ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-3xl px-3 py-1 ${
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground ml-4 text-base"
                    : "bg-muted mr-4"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>

              </div>
            </div>
            
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-background p-4 bg-gradient-to-b from-background to-background/10">
        <div className="max-w-4xl mx-auto">
          <PromptInputComponent
            onSubmit={handleSubmit}
            placeholder="Continue the conversation..."
            showSuggestions={false}
            className="w-full"
            tooltip="Send Message"
          />
          <p>{currentTask?.status}</p>
          <p>{taskStatus?.status}</p>

        </div>
      </div>
    </div>
  )
}
