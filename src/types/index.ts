export interface Player {
  id: string
  name: string
  vote?: string | number
  isCurrentUser?: boolean
  hasVoted?: boolean
  isOnline?: boolean
}

export interface GameSession {
  id: string
  name: string
  facilitator: string
  votingSystem: VotingSystem
  players: Player[]
  currentVote?: VotingRound
  settings: GameSettings
  history: VotingRound[]
}

export interface VotingRound {
  id: string
  issueName?: string
  votes: Record<string, string | number> // playerId -> vote
  startTime: Date
  endTime?: Date
  isRevealed: boolean
  average?: number
  hasAgreement?: boolean
}

export interface GameSettings {
  autoReveal: boolean
  showAverage: boolean
  showCountdown: boolean
  enableFunFeatures: boolean
  whoCanReveal: 'everyone' | 'facilitator' | string[]
  whoCanManageIssues: 'everyone' | 'facilitator' | string[]
}

export type VotingSystem = 'simple' | 'extended'

export const VOTING_SYSTEMS = {
  simple: [1, 2, 3, 4, 5],
  extended: [0, 1, 2, 3, 4, 5, 6]
} as const

export interface SessionStorage {
  currentSession?: GameSession
  userName?: string
  userId?: string
}

// WebSocket message types for signaling server
export interface WebSocketMessage {
  type: 'join' | 'leave' | 'sync_event' | 'heartbeat'
  sessionId?: string
  userId?: string
  userName?: string
  event?: SyncEvent
  timestamp: number
}

export interface ServerResponse {
  type: 'joined' | 'error' | 'sync_event' | 'heartbeat_ack' | 'session_not_found'
  message?: string
  event?: SyncEvent
  session?: GameSession
  timestamp: number
}

// SyncEvent type definition (moved here to avoid circular imports)
export type SyncEvent = 
  | { type: 'PLAYER_JOINED'; payload: { player: Player } }
  | { type: 'PLAYER_LEFT'; payload: { playerId: string } }
  | { type: 'VOTE_SUBMITTED'; payload: { playerId: string; vote: string | number } }
  | { type: 'VOTING_STARTED'; payload: { issueName?: string } }
  | { type: 'VOTES_REVEALED'; payload: {} }
  | { type: 'SESSION_UPDATED'; payload: { session: GameSession } }
  | { type: 'PLAYER_RECONNECTED'; payload: { playerId: string } }
  | { type: 'PLAYER_DISCONNECTED'; payload: { playerId: string } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: any; facilitator?: string; name?: string; votingSystem?: string } }
  | { type: 'COUNTDOWN_STARTED'; payload: {} }
  | { type: 'EMOJI_SENT'; payload: { fromPlayerId: string; toPlayerId: string; emoji: string } } 