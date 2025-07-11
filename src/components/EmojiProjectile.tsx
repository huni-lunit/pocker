'use client'

import React, { useState, useEffect } from 'react'

interface EmojiProjectileProps {
  emoji: string
  fromPosition: { x: number; y: number }
  toPosition: { x: number; y: number }
  onComplete: () => void
}

export const EmojiProjectile: React.FC<EmojiProjectileProps> = ({
  emoji,
  fromPosition,
  toPosition,
  onComplete
}) => {
  const [position, setPosition] = useState(fromPosition)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    setIsAnimating(true)
    
    const duration = 1000 // 1 second animation
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      
      const newX = fromPosition.x + (toPosition.x - fromPosition.x) * easeOutQuart
      const newY = fromPosition.y + (toPosition.y - fromPosition.y) * easeOutQuart
      
      setPosition({ x: newX, y: newY })
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        onComplete()
      }
    }
    
    requestAnimationFrame(animate)
  }, [fromPosition, toPosition, onComplete])

  return (
    <div
      className="fixed pointer-events-none z-50 text-2xl transition-all duration-1000 ease-out"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
        opacity: isAnimating ? 1 : 0
      }}
    >
      {emoji}
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

    // Single quick sparkle - just one pop and gone
    const newFireworks = [{
      id: 0,
      x: window.innerWidth * 0.5, // Center of screen
      y: window.innerHeight * 0.3, // Upper portion of screen
      emoji: '✨' // Single sparkle emoji
    }]

    setFireworks(newFireworks)

    // Quick animation - 300ms total duration
    const timer = setTimeout(() => {
      setFireworks([])
      onComplete()
    }, 300) // Very short duration - just a quick pop

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