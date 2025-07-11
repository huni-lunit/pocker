'use client'

import React, { useState, useEffect } from 'react'

// Emoji projectile component
interface EmojiProjectileProps {
  emoji: string
  fromPosition: { x: number; y: number }
  toPosition: { x: number; y: number }
  onComplete: () => void
  targetPlayerId?: string
}

export const EmojiProjectile: React.FC<EmojiProjectileProps> = ({ 
  emoji, 
  fromPosition, 
  toPosition, 
  onComplete,
  targetPlayerId
}) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 500) // Duration of projectile animation

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div
      className="fixed pointer-events-none z-50 text-2xl animate-bounce"
      style={{
        left: fromPosition.x,
        top: fromPosition.y,
        transform: 'translate(-50%, -50%)',
        animation: `projectile-flight 1s ease-in-out forwards`,
        '--end-x': `${toPosition.x - fromPosition.x}px`,
        '--end-y': `${toPosition.y - fromPosition.y}px`,
      } as React.CSSProperties & { '--end-x': string; '--end-y': string }}
    >
      {emoji}
      <style jsx>{`
        @keyframes projectile-flight {
          to {
            transform: translate(calc(-50% + var(--end-x)), calc(-50% + var(--end-y)));
          }
        }
      `}</style>
    </div>
  )
}



// Celebration component for consensus
interface CelebrationProps {
  isVisible: boolean
  onComplete: () => void
}

export const Celebration: React.FC<CelebrationProps> = ({ isVisible, onComplete }) => {
  const [fireworks, setFireworks] = useState<Array<{ id: number; x: number; y: number; emoji: string }>>([])

  useEffect(() => {
    if (!isVisible) return

    const newFireworks = [{
      id: 0,
      x: window.innerWidth * 0.5, // Center of screen
      y: window.innerHeight * 0.3, // Upper portion of screen
      emoji: '🎇🎇🎇'
    }]

    setFireworks(newFireworks)

    // Quick animation - 300ms total duration
    const timer = setTimeout(() => {
      setFireworks([])
      onComplete()
    }, 500) // Very short duration - just a quick pop

    return () => clearTimeout(timer)
  }, [isVisible, onComplete])

  if (!isVisible || fireworks.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {fireworks.map((firework) => (
        <div
          key={firework.id}
          className="absolute animate-ping"
          style={{
            left: firework.x,
            top: firework.y,
            transform: 'translate(-50%, -50%)',
            fontSize: '2rem',
            animationDuration: '0.3s', // Quick ping animation
            animationIterationCount: '1' // Only once
          }}
        >
          {firework.emoji}
        </div>
      ))}
    </div>
  )
}

// Emoji selector for throwing projectiles
interface EmojiSelectorProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emoji: string) => void
  targetPlayerName: string
}

export const EmojiSelector: React.FC<EmojiSelectorProps> = ({
  isOpen,
  onClose,
  onEmojiSelect,
  targetPlayerName
}) => {
  const allowedEmojis = ['😊', '🙏', '😍', '❤️']

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-4 text-center">
          Send emoji to {targetPlayerName}
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {allowedEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onEmojiSelect(emoji)
                onClose()
              }}
              className="text-4xl p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-center"
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
} 

// Component to show emoji overlay on player cards
interface EmojiOverlayProps {
  emoji: string
  playerId: string
  onComplete: () => void
}

export const EmojiOverlay: React.FC<EmojiOverlayProps> = ({ emoji, playerId, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 1000) // Show for 1 second

    return () => clearTimeout(timer)
  }, [onComplete])

  const playerElement = document.querySelector(`[data-player-id="${playerId}"]`)
  if (!playerElement) return null

  const rect = playerElement.getBoundingClientRect()

  return (
    <div
      className="fixed pointer-events-none z-20 text-2xl animate-ping"
      style={{
        left: rect.right - 10,
        top: rect.top + 10,
        animationDuration: '0.5s',
        animationIterationCount: '2'
      }}
    >
      {emoji}
    </div>
  )
} 