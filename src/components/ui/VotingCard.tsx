import React from 'react'

interface VotingCardProps {
  value: string | number
  isSelected?: boolean
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const VotingCard: React.FC<VotingCardProps> = ({
  value,
  isSelected = false,
  onClick,
  disabled = false,
  className = ''
}) => {
  const baseClasses = 'voting-card'
  const selectedClasses = isSelected ? 'selected' : ''
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''
  
  const classes = `${baseClasses} ${selectedClasses} ${disabledClasses} ${className}`
  
  return (
    <div
      className={classes}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {value}
    </div>
  )
} 