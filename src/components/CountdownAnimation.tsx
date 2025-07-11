'use client'

import React, { useState, useEffect } from 'react'

interface CountdownAnimationProps {
  isVisible: boolean
  duration?: number // in seconds
  onComplete: () => void
}

export const CountdownAnimation: React.FC<CountdownAnimationProps> = ({
  isVisible,
  duration = 3,
  onComplete
}) => {
  const [count, setCount] = useState(duration)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      setCount(duration)
      setIsAnimating(false)
      return
    }

    setIsAnimating(true)
    setCount(duration)

    const interval = setInterval(() => {
      setCount((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(interval)
          setTimeout(() => {
            setIsAnimating(false)
            onComplete()
          }, 500) // Small delay before calling onComplete
          return 0
        }
        return prevCount - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, duration, onComplete])

  if (!isVisible || !isAnimating) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-full w-32 h-32 flex items-center justify-center shadow-2xl">
        <div 
          className={`text-6xl font-bold transition-all duration-300 ${
            count === 0 ? 'text-green-600 scale-110' : 'text-primary-600 animate-pulse'
          }`}
        >
          {count === 0 ? '🎉' : count}
        </div>
      </div>
    </div>
  )
}

// Mini countdown for button states
interface MiniCountdownProps {
  isVisible: boolean
  duration?: number
  onComplete: () => void
  children: React.ReactNode
}

export const MiniCountdown: React.FC<MiniCountdownProps> = ({
  isVisible,
  duration = 3,
  onComplete,
  children
}) => {
  const [count, setCount] = useState(duration)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      setCount(duration)
      setIsActive(false)
      return
    }

    setIsActive(true)
    setCount(duration)

    const interval = setInterval(() => {
      setCount((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(interval)
          setIsActive(false)
          onComplete()
          return 0
        }
        return prevCount - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, duration, onComplete])

  if (!isVisible) return <>{children}</>

  return (
    <div className="relative">
      {children}
      {isActive && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold animate-pulse">
          {count}
        </div>
      )}
    </div>
  )
} 