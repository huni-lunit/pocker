'use client'

import React, { useState } from 'react'
import { Button, Input, Card } from '@/components/ui'
import { useGameStore } from '@/lib/store'
import { createSession } from '@/lib/session'
import { GameSession } from '@/types'

interface JoinSessionProps {
  onSessionJoined: (session: GameSession, userId: string) => void
}

export const JoinSession: React.FC<JoinSessionProps> = ({ onSessionJoined }) => {
  const { setSession } = useGameStore()
  const [playerName, setPlayerName] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [mode, setMode] = useState<'join' | 'create'>('create')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleCreateSession = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    if (!sessionName.trim()) {
      setError('Please enter a session name')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Store player name in localStorage for WebSocket connection
      localStorage.setItem(`userName`, playerName.trim())
      
      // Create session on signaling server
      const serverUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:8080'
      const facilitatorId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const response = await fetch(`${serverUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName.trim(),
          facilitatorId,
          facilitatorName: playerName.trim()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create session on server')
      }

      const serverSession = await response.json()
      
      // Convert server session to client session format with proper name
      const session = {
        ...serverSession,
        name: sessionName.trim(), // Use the name from the form
        players: serverSession.players.map((p: any) => ({
          ...p,
          isCurrentUser: p.id === facilitatorId
        }))
      }
      
      setSession(session, facilitatorId)
      onSessionJoined(session, facilitatorId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinSession = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    if (!sessionId.trim()) {
      setError('Please enter a session ID')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Store player name in localStorage for WebSocket connection
      localStorage.setItem(`userName`, playerName.trim())
      
      // Create a temporary session for joining
      // The real session will be received from the server
      const tempSession = createSession('Joining...', playerName.trim())
      const playerId = tempSession.players[0].id
      
      // Override the session ID with the one we're joining
      const sessionToJoin = {
        ...tempSession,
        id: sessionId.trim()
      }
      
      setSession(sessionToJoin, playerId)
      onSessionJoined(sessionToJoin, playerId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <h2 className="text-2xl font-semibold mb-6 text-center">Planning Poker</h2>
        
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('create')}
          >
            Create Session
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'join'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('join')}
          >
            Join Session
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label="Your Name"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            helperText="This will be your display name in the session"
          />

          {mode === 'create' ? (
            <Input
              label="Session Name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Sprint #4"
              helperText="Give your session a descriptive name"
            />
          ) : (
            <Input
              label="Session ID"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter session ID"
              helperText="Ask your facilitator for the session ID"
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={mode === 'create' ? handleCreateSession : handleJoinSession}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : mode === 'create' ? 'Create Session' : 'Join Session'}
          </Button>
        </div>

        {mode === 'create' && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600">
              💡 You&apos;ll be the facilitator and can manage game settings
            </p>
          </div>
        )}
      </Card>
    </div>
  )
} 