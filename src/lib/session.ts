import { GameSession, Player, SessionStorage, VotingSystem } from '@/types'

export const generateSessionId = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const generateUserId = (): string => {
  return Math.random().toString(36).substring(2, 15)
}

export const createSession = (
  sessionName: string,
  facilitatorName: string,
  votingSystem: VotingSystem = 'simple'
): GameSession => {
  const facilitatorId = generateUserId()
  
  return {
    id: generateSessionId(),
    name: sessionName,
    facilitator: facilitatorId,
    votingSystem,
    players: [
      {
        id: facilitatorId,
        name: facilitatorName,
        isCurrentUser: true,
        isOnline: true
      }
    ],
    settings: {
      autoReveal: false,
      showAverage: true,
      showCountdown: true,
      enableFunFeatures: true,
      whoCanReveal: 'everyone',
      whoCanManageIssues: 'everyone'
    },
    history: []
  }
}

export const joinSession = (
  session: GameSession,
  playerName: string
): { session: GameSession; playerId: string } => {
  const playerId = generateUserId()
  
  // Check if session is full
  if (session.players.length >= 10) {
    throw new Error('Session is full (maximum 10 players)')
  }
  
  // Check if name already exists
  const nameExists = session.players.some(player => 
    player.name.toLowerCase() === playerName.toLowerCase()
  )
  
  if (nameExists) {
    throw new Error('A player with this name already exists in the session')
  }
  
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    isCurrentUser: true,
    isOnline: true
  }
  
  const updatedSession = {
    ...session,
    players: [...session.players, newPlayer]
  }
  
  return { session: updatedSession, playerId }
}

export const saveSessionToStorage = (session: GameSession, userId: string, userName: string): void => {
  const storage: SessionStorage = {
    currentSession: session,
    userId,
    userName
  }
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('planningPoker', JSON.stringify(storage))
  }
}

export const loadSessionFromStorage = (): SessionStorage | null => {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem('planningPoker')
    if (!stored) return null
    
    const parsed = JSON.parse(stored)
    
    // Convert date strings back to Date objects
    if (parsed.currentSession?.history) {
      parsed.currentSession.history = parsed.currentSession.history.map((round: any) => ({
        ...round,
        startTime: new Date(round.startTime),
        endTime: round.endTime ? new Date(round.endTime) : undefined
      }))
    }
    
    if (parsed.currentSession?.currentVote) {
      parsed.currentSession.currentVote = {
        ...parsed.currentSession.currentVote,
        startTime: new Date(parsed.currentSession.currentVote.startTime),
        endTime: parsed.currentSession.currentVote.endTime 
          ? new Date(parsed.currentSession.currentVote.endTime) 
          : undefined
      }
    }
    
    return parsed
  } catch (error) {
    console.error('Failed to load session from storage:', error)
    return null
  }
}

export const clearSessionStorage = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('planningPoker')
  }
} 