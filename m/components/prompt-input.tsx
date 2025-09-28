"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { PromptSuggestion } from "@/components/ui/prompt-suggestion"
import { Button } from "@/components/ui/button"
import { ArrowUp, Computer, Mic } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
// Deepgram speech-to-text implementation


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

interface PromptInputComponentProps {
  onSubmit?: (content: string) => void
  placeholder?: string
  showSuggestions?: boolean
  className?: string
  tooltip?: string
}

export function PromptInputComponent({
  onSubmit,
  placeholder = "Describe what you want the browser to do...",
  showSuggestions = true,
  className = "w-full max-w-(--breakpoint-md)",
  tooltip = "Start Chat"
}: PromptInputComponentProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentTask, setCurrentTask] = useState<TaskResponse | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [output, setOutput] = useState<string>("")
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTranscriptRef = useRef<string>("")
  const isRecordingActiveRef = useRef<boolean>(false)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()
  const { user } = useAuth()

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupDeepgram()
    }
  }, [])

  // Cleanup function for Deepgram connection
  const cleanupDeepgram = () => {
    // Immediately mark recording as inactive to stop message processing
    isRecordingActiveRef.current = false

    // Clear accumulated transcript immediately
    accumulatedTranscriptRef.current = ""

    // Clear countdown display and interval
    setCountdown(null)
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    // Clear any pending auto-send timeout
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current)
      autoSendTimeoutRef.current = null
    }

    // Stop media recorder first to prevent new data
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop()
      } catch (error) {
        // Ignore errors if already stopped
      }
      mediaRecorderRef.current = null
    }

    // Stop all audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
        } catch (error) {
          // Ignore errors if already stopped
        }
      })
      streamRef.current = null
    }

    // Close WebSocket connection
    if (socketRef.current) {
      try {
        socketRef.current.close()
      } catch (error) {
        // Ignore errors if already closed
      }
      socketRef.current = null
    }

    setIsRecording(false)
  }

  // Reset auto-send timeout when new speech is detected
  const resetAutoSendTimeout = () => {
    // Clear existing timeout and countdown
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current)
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    // Set countdown to 2 seconds and start counting down
    setCountdown(2)
    let remainingTime = 2

    countdownIntervalRef.current = setInterval(() => {
      remainingTime--
      setCountdown(remainingTime)

      if (remainingTime <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
      }
    }, 1000)

    autoSendTimeoutRef.current = setTimeout(() => {
      console.log('Auto-send timeout triggered, accumulated text:', accumulatedTranscriptRef.current)

      // Always stop recording after 2 seconds, regardless of whether there's text
      handleSpeechRecording()

      if (accumulatedTranscriptRef.current.trim()) {
        // Auto-append the accumulated transcript after 2 seconds of silence
        const newInput = input.trim()
          ? `${input.trim()} ${accumulatedTranscriptRef.current.trim()}`
          : accumulatedTranscriptRef.current.trim()
        console.log('Setting input to:', newInput)
        setInput(newInput)
        accumulatedTranscriptRef.current = ""
        setCountdown(null) // Clear countdown display

        // Small delay to ensure recording cleanup completes before submit/navigation
        setTimeout(() => {
          console.log('Triggering submit')
          handleSubmit() // Trigger submit like clicking the send button
        }, 100)
      } else {
        console.log('No speech detected, just stopping recording')
        setCountdown(null) // Clear countdown display
      }
    }, 2000) // 2 seconds of silence
  }

  const handleSpeechRecording = async () => {
    if (isRecording) {
      // Stop recording
      cleanupDeepgram()
    } else {
      // Start recording with Deepgram
      const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
      if (!deepgramApiKey) {
        console.error("Deepgram API key not found. Please set NEXT_PUBLIC_DEEPGRAM_API_KEY environment variable.")
        return
      }

      try {
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        // Create MediaRecorder
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder

        // Create WebSocket connection to Deepgram
        const socket = new WebSocket('wss://api.deepgram.com/v1/listen', [
          'token',
          deepgramApiKey
        ])
        socketRef.current = socket

        socket.onopen = () => {
          console.log('Deepgram connection opened')
          // Reset accumulated transcript for new recording session
          accumulatedTranscriptRef.current = ""

          // Start the auto-send timer immediately when recording begins
          resetAutoSendTimeout()

          // Set up MediaRecorder data handling
          mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
              socket.send(event.data)
            }
          })

          // Start recording in 250ms chunks
          mediaRecorder.start(250)
        }

        socket.onmessage = (message) => {
          // Don't process messages if recording has been stopped
          if (!isRecordingActiveRef.current) return

          try {
            const received = JSON.parse(message.data)
            const transcript = received.channel?.alternatives?.[0]?.transcript

            console.log('Deepgram message:', { transcript, is_final: received.is_final, type: received.type })

            if (transcript && received.is_final) {
              console.log('Adding final transcript:', transcript)
              // Add final transcript to accumulated text
              accumulatedTranscriptRef.current = accumulatedTranscriptRef.current
                ? `${accumulatedTranscriptRef.current} ${transcript}`
                : transcript

              // Reset auto-send timeout whenever we get final speech
              resetAutoSendTimeout()
            }
          } catch (error) {
            console.error('Error parsing Deepgram message:', error)
          }
        }

        socket.onclose = () => {
          console.log('Deepgram connection closed')
        }

        socket.onerror = (error) => {
          console.error('Deepgram connection error:', error)
        }

        isRecordingActiveRef.current = true
        setIsRecording(true)
      } catch (error) {
        console.error("Error starting recording:", error)
        cleanupDeepgram()
      }
    }
  }

  const runTask = async (taskDescription: string) => {
    try {
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

      const taskResponse: TaskResponse = await response.json()
      setCurrentTask(taskResponse)
      return taskResponse
    } catch (error) {
      console.error("Error running task:", error)
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return null
    }
  }

 
  const stopCurrentTask = async () => {
    if (currentTask?.id) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/${currentTask.id}/stop`, {
          method: "PUT",
        })

        if (response.ok) {
          console.log('Task stopped successfully')
          setCurrentTask(null)
          setTaskStatus(null)
        } else {
          console.error('Failed to stop task')
        }
      } catch (error) {
        console.error('Error stopping task:', error)
      }
    }
    // Also stop any ongoing recording
    if (isRecording) {
      handleSpeechRecording()
    }
    setIsLoading(false)
  }

  const handleSubmit = async () => {
    if (!input.trim() || !user) return

    // Clear input immediately
    const currentInput = input.trim()
    setInput("")
    setIsLoading(true)
    setOutput("Starting task...")
    setCurrentTask(null)
    setTaskStatus(null)

    try {
      console.log('Creating task with input:', currentInput)

      // Create the task first
      const taskResponse = await runTask(currentInput)
      console.log('Task response:', taskResponse)

      setCurrentTask(taskResponse)

      if (taskResponse && taskResponse.id) {
        const newTaskId = taskResponse.id
        console.log('Task created with ID:', newTaskId)

        // Create a chat with initial messages
        const initialMessages = [{
          id: `user-${Date.now()}`,
          role: 'user',
          content: currentInput,
          timestamp: new Date().toISOString()
          // user messages don't need a type field
        }]

        console.log('Creating chat in Supabase...')
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .insert({
            user_id: user.id,
            task_id: newTaskId,
            title: `Task: ${currentInput.slice(0, 50)}${currentInput.length > 50 ? '...' : ''}`,
            messages: initialMessages
          })
          .select()
          .single()

        if (chatError) {
          console.error('Error creating chat:', chatError)
          setOutput(`Error creating chat: ${chatError.message}`)
          setIsLoading(false)
          return
        }

        console.log('Chat created:', chatData.id)
        console.log('Navigating to:', `/chat/${chatData.id}`)

        // Navigate to the chat page
        router.push(`/chat/${chatData.id}`)
        return
      } else {
        console.error('No task response or missing ID')
        setOutput('Failed to create task')
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error)
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsLoading(false)
    }
  }

  const handleValueChange = (value: string) => {
    setInput(value)
  }

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case "finished": return "text-green-600"
  //     case "failed": return "text-red-600"
  //     case "running": return "text-blue-600"
  //     case "paused": return "text-yellow-600"
  //     default: return "text-gray-600"
  //   }
  // }

  return (
    <div className={`space-y-4 ${className}`}>
      {showSuggestions && (
        <div className="flex flex-wrap gap-2">
          <PromptSuggestion onClick={() => setInput("Search for the latest news about AI")}>
            Search for the latest news about AI
          </PromptSuggestion>
          <PromptSuggestion onClick={() => setInput("Take a screenshot of the current page")}>
            Take a screenshot of the current page
          </PromptSuggestion>
          <PromptSuggestion onClick={() => setInput("Fill out a contact form with test data")}>
            Fill out a contact form with test data
          </PromptSuggestion>
        </div>
      )}

      <PromptInput
        value={input}
        onValueChange={handleValueChange}
        isLoading={isLoading}
        onSubmit={() => {
          if (onSubmit) {
            onSubmit(input.trim())
            setInput("") // Clear input immediately when using onSubmit prop
          } else {
            handleSubmit()
          }
        }}
        className="w-full"
      >
        <PromptInputTextarea placeholder={placeholder} />

        <PromptInputActions className="justify-end pt-2">
          {/* Countdown timer display */}
          {countdown !== null && (
            <div className="mr-2 flex items-center gap-1 text-xs text-red-500 font-medium">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>{countdown}s</span>
            </div>
          )}

          {/* Stop button - appears when loading or when there's an active task */}
          {(isLoading || currentTask) && (
            <PromptInputAction tooltip="Stop Current Task">
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={stopCurrentTask}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </Button>
            </PromptInputAction>
          )}

        <PromptInputAction tooltip={isRecording ? "Stop Voice Input" : "Start Voice Input"} >
            <Button
              variant="default"
              size="icon"
              className={cn("h-8 rounded-full w-8 transition-colors relative", (isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-transparent hover:bg-accent text-muted-foreground"))}
              onClick={handleSpeechRecording}
              disabled={isLoading}
            >
              {isRecording && (
                <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
              )}
              <Mic className={cn("size-5 relative z-10", isRecording ? "text-white" : "")} strokeWidth={2.5}/>
            </Button>
          </PromptInputAction>
          <PromptInputAction tooltip={tooltip}>
            <Button
              variant="default"
              size="icon"
              className={cn("h-8 w-8 rounded-full", (isLoading || !input.trim() && "disabled:opacity-30 bg-black text-white"))}
              onClick={() => {
                if (onSubmit) {
                  onSubmit(input.trim())
                  setInput("") // Clear input immediately when using onSubmit prop
                } else {
                  handleSubmit()
                }
              }}
              disabled={isLoading || !input.trim()}
            >
              <ArrowUp className="size-5" strokeWidth={3}/>
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}

// Legacy component for backward compatibility
export function PromptInputBasic() {
  return <PromptInputComponent />
}
