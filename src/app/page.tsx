'use client'

import React, { useState, useEffect } from 'react'
import { JoinSession } from '@/components/JoinSession'
import { GameInterface } from '@/components/GameInterface'
import { useGameStore } from '@/lib/store'
import { GameSession } from '@/types'
import { loadSessionFromStorage } from '@/lib/session'

export default function Home() {
  const { session, currentUserId, setSession } = useGameStore()

  useEffect(() => {
    // Check if there's an existing session
    const stored = loadSessionFromStorage()
    if (stored?.currentSession && stored?.userId) {
      setSession(stored.currentSession, stored.userId)
    }
  }, [setSession])

  const handleSessionJoined = (session: GameSession, userId: string) => {
    setSession(session, userId)
  }

  if (session && currentUserId) {
    return <GameInterface />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Planning Poker
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Collaborative story point estimation for agile teams
        </p>
        <JoinSession onSessionJoined={handleSessionJoined} />
      </div>
    </div>
  )
} 