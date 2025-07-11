'use client'

import React, { useState, useEffect } from 'react'
import { PlayerGrid, VotingCard, Button, Card, Modal } from '@/components/ui'
import { GameSettings } from '@/components/GameSettings'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { EmojiProjectile, Celebration, EmojiSelector } from '@/components/EmojiProjectile'
import { CountdownAnimation, MiniCountdown } from '@/components/CountdownAnimation'
import { useGameStore } from '@/lib/store'
import { useConnectionStatus } from '@/lib/realtime'
import { VOTING_SYSTEMS, Player } from '@/types'

export const GameInterface: React.FC = () => {
  const {
    session,
    currentUserId,
    isVoting,
    selectedVote,
    showResults,
    startVoting,
    submitVote,
    revealVotes,
    clearVotes,
    clearSession,
    getAvailableCards,
    calculateResults,
    canRevealVotes,
    realTimeSync,
    initializeRealTimeSync,
    connectToSession
  } = useGameStore()

  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [newIssueName, setNewIssueName] = useState('')
  
  // Fun features state
  const [showEmojiSelector, setShowEmojiSelector] = useState(false)
  const [targetPlayer, setTargetPlayer] = useState<Player | null>(null)
  const [projectiles, setProjectiles] = useState<Array<{
    id: string
    emoji: string
    fromPosition: { x: number; y: number }
    toPosition: { x: number; y: number }
  }>>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)

  // Always call hooks unconditionally
  const connectionStatus = useConnectionStatus(realTimeSync)

  // Initialize real-time sync when component mounts
  useEffect(() => {
    if (!realTimeSync) {
      initializeRealTimeSync()
    }
  }, [realTimeSync, initializeRealTimeSync])

    // Connect to session when real-time sync is ready (only once)
  useEffect(() => {
    if (realTimeSync && session && currentUserId && connectionStatus === 'disconnected') {
      connectToSession()
    }
  }, [realTimeSync, session, currentUserId, connectionStatus])

  // Show celebration when there's agreement
  useEffect(() => {
    if (session && showResults && session.settings.enableFunFeatures && !showCelebration) {
      const results = calculateResults()
      if (results?.hasAgreement) {
        const timer = setTimeout(() => setShowCelebration(true), 500)
        return () => clearTimeout(timer)
      }
    }
  }, [showResults, session?.settings.enableFunFeatures, showCelebration, calculateResults])

  if (!session || !currentUserId) {
    return null
  }

  const currentPlayer = session.players.find(p => p.id === currentUserId)
  const availableCards = getAvailableCards()
  const results = calculateResults()
  const votedCount = session.players.filter(p => p.hasVoted).length
  const canReveal = canRevealVotes() && votedCount > 0

  const handleStartVoting = () => {
    startVoting(newIssueName.trim() || undefined)
    setNewIssueName('')
  }

  const handleVoteSubmit = (vote: string | number) => {
    submitVote(vote)
    
    // Check if auto-reveal is enabled and all players have voted
    if (session.settings.autoReveal) {
      // Use setTimeout to check after state update
      setTimeout(() => {
        const updatedSession = useGameStore.getState().session
        if (updatedSession?.players.every(p => p.hasVoted)) {
          revealVotes()
        }
      }, 100)
    }
  }

  const handleRevealVotes = () => {
    if (session.settings.showCountdown) {
      setShowCountdown(true)
    } else {
      revealVotes()
    }
  }

  const handleCountdownComplete = () => {
    setShowCountdown(false)
    revealVotes()
  }

  const handleNewVoting = () => {
    clearVotes()
  }

  const handlePlayerClick = (player: Player, element: HTMLElement) => {
    if (!session.settings.enableFunFeatures) return
    
    setTargetPlayer(player)
    setShowEmojiSelector(true)
  }

  const handleEmojiSelect = (emoji: string) => {
    if (!targetPlayer) return

    // Get current user position (approximate center of screen)
    const currentUserElement = document.querySelector('.current-user')
    const targetElement = document.querySelector(`[data-player-id="${targetPlayer.id}"]`)
    
    if (currentUserElement && targetElement) {
      const fromRect = currentUserElement.getBoundingClientRect()
      const toRect = targetElement.getBoundingClientRect()
      
      const fromPosition = {
        x: fromRect.left + fromRect.width / 2,
        y: fromRect.top + fromRect.height / 2
      }
      
      const toPosition = {
        x: toRect.left + toRect.width / 2,
        y: toRect.top + toRect.height / 2
      }

      const projectile = {
        id: `projectile-${Date.now()}`,
        emoji,
        fromPosition,
        toPosition
      }

      setProjectiles(prev => [...prev, projectile])
    }

    setTargetPlayer(null)
  }

  const handleProjectileComplete = (projectileId: string) => {
    setProjectiles(prev => prev.filter(p => p.id !== projectileId))
  }



  const getCentralPrompt = () => {
    if (showResults) {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Results</h2>
          <div className="space-y-4">
            {session.settings.showAverage && (
              <div className="text-4xl font-bold text-primary-600">
                Average: {results.average.toFixed(1)}
              </div>
            )}
            {results.hasAgreement && (
              <div className="flex items-center justify-center text-green-600">
                <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-lg font-semibold">Agreement!</span>
              </div>
            )}

            <Button onClick={handleNewVoting} className="mt-4">
              Start New Voting
            </Button>
          </div>
        </div>
      )
    }

    if (isVoting) {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pick your cards!</h2>
          {session.currentVote?.issueName && (
            <p className="text-lg text-gray-600 mb-4">
              Issue: {session.currentVote.issueName}
            </p>
          )}
          <div className="text-sm text-gray-500">
            {votedCount} / {session.players.length} voted
          </div>
          {canReveal && (
            <MiniCountdown
              isVisible={session.settings.showCountdown && showCountdown}
              duration={3}
              onComplete={handleCountdownComplete}
            >
              <Button onClick={handleRevealVotes} className="mt-4">
                {session.settings.showCountdown ? 'Reveal Votes (3s countdown)' : 'Reveal Votes'}
              </Button>
            </MiniCountdown>
          )}
        </div>
      )
    }

    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start</h2>
        <div className="space-y-4">
          <input
            type="text"
            value={newIssueName}
            onChange={(e) => setNewIssueName(e.target.value)}
            placeholder="Issue name (optional)"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <Button onClick={handleStartVoting}>
            Start New Voting
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-600">
                  Session ID: <span className="font-mono font-bold">{session.id}</span>
                </p>
                <ConnectionStatus status={connectionStatus} />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
              >
                Voting History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                Game Settings
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={clearSession}
              >
                Leave Session
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Player Grid */}
          <div className="mb-8">
            <PlayerGrid
              players={session.players}
              showVotes={showResults}
              maxPlayers={10}
              enableFunFeatures={session.settings.enableFunFeatures}
              onPlayerClick={handlePlayerClick}
            />
          </div>

          {/* Central Prompt */}
          <div className="mb-8">
            <Card className="max-w-2xl mx-auto text-center">
              {getCentralPrompt()}
            </Card>
          </div>

          {/* Voting Cards */}
          {isVoting && (
            <div className="max-w-2xl mx-auto">
              <Card padding="sm">
                <h3 className="text-lg font-semibold text-center mb-4">Choose your card</h3>
                <div className="grid grid-cols-5 gap-3">
                  {availableCards.map((card) => (
                    <VotingCard
                      key={card}
                      value={card}
                      isSelected={selectedVote === card}
                      onClick={() => handleVoteSubmit(card)}
                      disabled={false} // Allow vote changes during voting
                    />
                  ))}
                </div>
                {currentPlayer?.hasVoted && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-green-600 font-medium">
                      ✓ Vote submitted: {selectedVote} (You can change your vote)
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <GameSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Voting History"
        size="xl"
      >
        <div className="space-y-4">
          {session.history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No voting history yet. Start your first vote!
            </p>
          ) : (
            session.history.map((round, index) => (
              <div key={round.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">
                    {round.issueName || `Vote #${index + 1}`}
                  </h4>
                  <div className="text-sm text-gray-500">
                    {round.startTime.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span>Average: {round.average?.toFixed(1) || 'N/A'}</span>
                  <span>Votes: {Object.keys(round.votes).length}</span>
                  {round.hasAgreement && (
                    <span className="text-green-600">✓ Agreement</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Fun Features */}
      {session.settings.enableFunFeatures && (
        <>
          <EmojiSelector
            isOpen={showEmojiSelector}
            onClose={() => {
              setShowEmojiSelector(false)
              setTargetPlayer(null)
            }}
            onEmojiSelect={handleEmojiSelect}
            targetPlayerName={targetPlayer?.name || ''}
          />

          {projectiles.map((projectile) => (
            <EmojiProjectile
              key={projectile.id}
              emoji={projectile.emoji}
              fromPosition={projectile.fromPosition}
              toPosition={projectile.toPosition}
              onComplete={() => handleProjectileComplete(projectile.id)}
            />
          ))}

          <Celebration
            isVisible={showCelebration}
            onComplete={() => setShowCelebration(false)}
          />
        </>
      )}

      {/* Countdown Animation */}
      <CountdownAnimation
        isVisible={showCountdown}
        duration={3}
        onComplete={handleCountdownComplete}
      />
    </div>
  )
} 