import React, { useRef } from 'react'

interface Player {
  id: string
  name: string
  vote?: string | number
  isCurrentUser?: boolean
  hasVoted?: boolean
}

interface PlayerGridProps {
  players: Player[]
  showVotes?: boolean
  maxPlayers?: number
  enableFunFeatures?: boolean
  onPlayerClick?: (player: Player, element: HTMLElement) => void
}

export const PlayerGrid: React.FC<PlayerGridProps> = ({
  players,
  showVotes = false,
  maxPlayers = 10,
  enableFunFeatures = false,
  onPlayerClick
}) => {
  const getGridLayout = (playerCount: number) => {
    if (playerCount <= 2) return 'grid-cols-1 sm:grid-cols-2'
    if (playerCount <= 4) return 'grid-cols-2'
    if (playerCount <= 6) return 'grid-cols-2 sm:grid-cols-3'
    if (playerCount <= 9) return 'grid-cols-3'
    return 'grid-cols-3 sm:grid-cols-4'
  }
  
  const gridClasses = getGridLayout(players.length)
  
  return (
    <div className={`grid gap-4 ${gridClasses} max-w-4xl mx-auto`}>
      {players.slice(0, maxPlayers).map((player) => (
        <div
          key={player.id}
          data-player-id={player.id}
          className={`player-card ${player.isCurrentUser ? 'current-user' : ''} ${
            player.hasVoted ? 'voted' : ''
          } ${enableFunFeatures && !player.isCurrentUser ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
          onClick={enableFunFeatures && !player.isCurrentUser && onPlayerClick 
            ? (e) => onPlayerClick(player, e.currentTarget as HTMLElement)
            : undefined
          }
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-600">
                {player.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="font-medium text-gray-900 mb-1">{player.name}</p>
            {showVotes && player.vote !== undefined ? (
              <div className="text-2xl font-bold text-primary-600">
                {player.vote}
              </div>
            ) : player.hasVoted ? (
              <div className="text-sm text-green-600 font-medium">
                ✓ Voted
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                Waiting...
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
} 