"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2,  } from "lucide-react"
import { PromptInputComponent } from "@/components/prompt-input"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Loader } from "@/components/ui/loader"
import ReactMarkdown from 'react-markdown'

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

interface TaskChatInterfaceProps {
  taskId?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  type?: 'thinking' | 'final_answer' | 'stats'
}

export function TaskChatInterface({ taskId }: TaskChatInterfaceProps = {}) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPolling, setIsPolling] = useState(!!taskId) // Only poll if we have a taskId
  const [isWorking, setIsWorking] = useState(false)
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // Connect to SSE stream for real-time logs
  const connectToLogStream = (taskIdToStream?: string) => {
    if (eventSourceRef.current) return

    const actualTaskId = taskIdToStream || taskId
    const eventSource = new EventSource(`${API_BASE_URL}/api/tasks/${actualTaskId}/logs`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = async (event) => {
      const logEntry = event.data

      if (logEntry === 'keepalive') return

      // Display the clean goal messages (already filtered and cleaned on backend)
      addAssistantMessage(logEntry, 'thinking')
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      eventSource.close()
      eventSourceRef.current = null
    }
  }

  // Initialize with existing chat messages and associated task data
  useEffect(() => {
    if (taskId && user) {
      const initialize = async () => {
        try {
          // Load chat data including messages
          const { data: chatData, error: chatError } = await supabase
            .from('chats')
            .select('task_id, messages')
            .eq('id', taskId)
            .single()

          if (chatError) {
            console.error('Error loading chat:', chatError)
            return
          }

          // Load messages from JSONB column if they exist
          if (chatData?.messages && Array.isArray(chatData.messages) && chatData.messages.length > 0) {
            const allMessages: ChatMessage[] = chatData.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
              timestamp: msg.timestamp,
              type: msg.type as 'thinking' | 'final_answer' | 'stats' | undefined
            }))

            // Separate final answer messages from regular messages
            const regularMessages = allMessages.filter(msg => msg.type !== 'final_answer')
            const finalAnswerMessage = allMessages.find(msg => msg.type === 'final_answer')

            setMessages(regularMessages)

            // Set final answer if it exists
            if (finalAnswerMessage) {
              setFinalAnswer(finalAnswerMessage.content)
            }

            // If there's an active task, connect to it
            if (chatData.task_id) {
              const status = await checkTaskStatus(chatData.task_id)
              if (status && ["running", "pending"].includes(status.status)) {
                connectToLogStream(chatData.task_id)
                startPolling(chatData.task_id)
              }
            }
          } else if (chatData?.task_id) {
            // No messages but task exists, check if it's running
            const status = await checkTaskStatus(chatData.task_id)
            if (status?.task) {
              setMessages([{
                id: 'initial-user',
                role: 'user',
                content: status.task,
                timestamp: status.started_at || new Date().toISOString()
              }])
              connectToLogStream(chatData.task_id)
              startPolling(chatData.task_id)
            }
          }
        } catch (error) {
          console.error('Error initializing chat:', error)
        }
      }

      initialize()
    }

    return () => {
      stopPolling()
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [taskId, user])

  const checkTaskStatus = async (taskIdToCheck?: string): Promise<TaskStatus | null> => {
    const actualTaskId = taskIdToCheck || taskId
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${actualTaskId}`)
      if (!response.ok) {
        if (response.status === 404) {
          return null
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

  const startPolling = (taskIdToPoll?: string) => {
    if (pollingIntervalRef.current) return

    pollingIntervalRef.current = setInterval(async () => {
      const status = await checkTaskStatus(taskIdToPoll)
      if (status) {
        // Set working state
        if (status.status === 'running') {
          setIsWorking(true)
        }

        if (status && ["finished", "failed", "stopped"].includes(status.status)) {
          stopPolling()
          setIsWorking(false)

          if (status.status === 'finished') {
            // Extract final answer from output
            const output = status.output || ""

            const answerMatch = output.match(/<answer>([\s\S]*?)<\/answer>/)
            const cleanAnswer = answerMatch ? answerMatch[1].trim() : output

            setFinalAnswer(cleanAnswer)

            // Save the final answer (addAssistantMessage handles the Supabase saving)
            addAssistantMessage(cleanAnswer, 'final_answer')

            // Stats messages removed - user doesn't want them
          } else if (status.status === 'failed') {
            setFinalAnswer(`❌ Task failed: ${status.error || 'Unknown error'}`)
          } else {
            setFinalAnswer(`⏹️ Task stopped`)
          }
        }
      }
    }, 2000)
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }

  const addAssistantMessage = async (content: string, type: 'thinking' | 'final_answer' | 'stats' = 'thinking') => {
    const message: ChatMessage = {
      id: `${type === 'final_answer' ? 'final-answer' : 'assistant'}-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      type
    }
    setMessages(prev => [...prev, message])

    // Save to Supabase if we have a chat ID
    if (taskId) {
      try {
        // Get current messages and append the new one
        const { data: currentChat } = await supabase
          .from('chats')
          .select('messages')
          .eq('id', taskId)
          .single()

        const currentMessages = currentChat?.messages || []
        const updatedMessages = [...currentMessages, message]

        await supabase
          .from('chats')
          .update({ messages: updatedMessages })
          .eq('id', taskId)
      } catch (error) {
        console.error('Error saving assistant message to Supabase:', error)
      }
    }
  }

  const addUserMessage = (content: string) => {
    const message: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, message])
  }

  const handleNewTask = async (taskDescription: string) => {
    if (!user) return

    addUserMessage(taskDescription)
    setIsWorking(true)
    setFinalAnswer(null)

    try {
        // If we have an existing chat (taskId prop), continue in that chat
      if (taskId) {
        // Create a new task for the follow-up request
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task: taskDescription,
            user_id: user?.id,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const taskResponse = await response.json()
        const newTaskId = taskResponse.id

        // Update the chat to reference the new task and add the user message
        const userMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: taskDescription,
          timestamp: new Date().toISOString()
        }

        // Get current messages and append the new one
        const { data: currentChat } = await supabase
          .from('chats')
          .select('messages')
          .eq('id', taskId)
          .single()

        const currentMessages = currentChat?.messages || []
        const updatedMessages = [...currentMessages, userMessage]

        await supabase
          .from('chats')
          .update({
            task_id: newTaskId,
            messages: updatedMessages
          })
          .eq('id', taskId)

        // Connect to the new task's log stream and start polling
        connectToLogStream(newTaskId)
        startPolling(newTaskId)

      } else {
        // No existing chat, create a new one
        // Create the task first to get the task ID
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task: taskDescription,
            user_id: user?.id,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const taskResponse = await response.json()
        const newTaskId = taskResponse.id

        // Create a separate chat with its own ID, linked to the task
        const initialMessages = [{
          id: `user-${Date.now()}`,
          role: 'user',
          content: taskDescription,
          timestamp: new Date().toISOString()
        }]

        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .insert({
            user_id: user.id,
            task_id: newTaskId, // Reference to the task
            title: `Task: ${taskDescription.slice(0, 50)}${taskDescription.length > 50 ? '...' : ''}`,
            messages: initialMessages
          })
          .select()
          .single()

        if (chatError) {
          console.error('Error creating chat:', chatError)
          throw chatError
        }

        const newChatId = chatData.id

        // Navigate to the chat page using the chat ID
        router.push(`/chat/${newChatId}`)
      }

    } catch (error) {
      console.error("Error running new task:", error)
      setIsWorking(false)
      addAssistantMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'thinking')
    }
  }

  return (
    <div className="space-y-6 w-full ">
      {/* Header */}
      <div className="flex items-center justify-between">


        {/* {taskStatus && (
          <div className="flex items-center space-x-2">
            <span className="text-sm">Status:</span>
            <span className={`text-sm font-medium ${getStatusColor(taskStatus.status)}`}>
              {taskStatus.status}
            </span>
            {isPolling && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        )} */}
      </div>

      {/* Chat Messages */}
      <div className='w-full max-w-(--breakpoint-md) mx-auto relative mb-52'>
      <div className="space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Starting task execution...</p>
          </div>
        ) : (
          <>
            {messages.map((message, i) => {
              const isLastMessage = i === messages.length - 1;
              const isLastAssistantMessage = isLastMessage && message.role === 'assistant' && isWorking;
              const isFirstThinkingMessage = message.role === 'assistant' && i > 0 && messages[i-1].role === 'user';

              return (
                <div key={i}>
                  {/* Thinking icon appears before first thinking message, after user messages */}
                  {isFirstThinkingMessage && (
                    <div className="flex justify-start mb-2">
                      <img src="/thinking.png" alt="Thinking" className="h-8  object-cover" />
                    </div>
                  )}

                  <div className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'user' ? (
                      <div className="max-w-[75%] rounded-xl px-3 py-1.5 bg-primary text-primary-foreground">
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      </div>
                    ) : isLastAssistantMessage ? (
                      <div className="flex items-center space-x-2">
                      <Loader variant="pulse" size="sm"/>
                      <Loader variant="text-shimmer" text={message.content} className="font-medium"/>
                      </div>
                    ) : (
                      <div className="max-w-[75%] px-3 py-1.5">
                        <div className="text-sm whitespace-pre-wrap text-foreground font-medium">{message.content}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Final Answer */}
        {finalAnswer && (
          <div className="mt-6 pt-4 border-t ">
            <div className=" rounded-lg px-3 py-1.5 w-fit border bg-background">
              <div className="text-sm">
                <ReactMarkdown>
                  {finalAnswer}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Continue Prompting */}
      <div className="space-y-4 fixed bottom-2 bg-gradient-to-b to-background from-background/0 to-90% w-full max-w-(--breakpoint-md) mx-auto pt-8">

        <PromptInputComponent
          onSubmit={handleNewTask}
          placeholder="Ask for another task or continue the conversation..."
          showSuggestions={false}
          className="w-full"
          tooltip="Send Message"
        />
      </div>
      </div>
    </div>
  )
}
