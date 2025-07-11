import { GameSession, Player, VotingRound } from '../types'
import { v4 as uuidv4 } from 'uuid'

export class SessionManager {
  private sessions = new Map<string, GameSession>()

  createSession(sessionName: string, facilitatorId: string, facilitatorName: string): GameSession {
    const session: GameSession = {
      id: uuidv4(),
      name: sessionName,
      facilitator: facilitatorId,
      votingSystem: 'simple',
      players: [{
        id: facilitatorId,
        name: facilitatorName,
        isOnline: true
      }],
      settings: {
        autoReveal: false,
        showAverage: true,
        showCountdown: true,
        enableFunFeatures: true,
        whoCanReveal: 'everyone',
        whoCanManageIssues: 'facilitator'
      },
      history: [],
      createdAt: new Date(),
      lastActivity: new Date()
    }
    
    this.sessions.set(session.id, session)
    return session
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId)
  }

  addPlayerToSession(sessionId: string, player: Player): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    const existingPlayerIndex = session.players.findIndex(p => p.id === player.id)
    if (existingPlayerIndex >= 0) {
      session.players[existingPlayerIndex] = { ...player, isOnline: true }
    } else {
      session.players.push({ ...player, isOnline: true })
    }

    session.lastActivity = new Date()
    return true
  }

  removePlayerFromSession(sessionId: string, playerId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    // Remove player from session
    session.players = session.players.filter(p => p.id !== playerId)
    
    // Remove player's vote if there's an active voting round
    if (session.currentVote && session.currentVote.votes[playerId]) {
      delete session.currentVote.votes[playerId]
    }
    
    session.lastActivity = new Date()
    return true
  }

  updatePlayerVote(sessionId: string, playerId: string, vote: string | number): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || !session.currentVote) return false

    session.currentVote.votes[playerId] = vote
    const player = session.players.find(p => p.id === playerId)
    if (player) {
      player.vote = vote
      player.hasVoted = true
    }

    session.lastActivity = new Date()
    return true
  }

  startVoting(sessionId: string, issueName?: string): VotingRound | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const votingRound: VotingRound = {
      id: uuidv4(),
      issueName,
      votes: {},
      startTime: new Date(),
      isRevealed: false
    }

    session.currentVote = votingRound
    session.players.forEach(player => {
      player.vote = undefined
      player.hasVoted = false
    })

    session.lastActivity = new Date()
    return votingRound
  }

  revealVotes(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || !session.currentVote) return false

    session.currentVote.isRevealed = true
    session.currentVote.endTime = new Date()

    // Calculate results - only include actual votes, exclude non-voters
    const votes = Object.values(session.currentVote.votes)
    const numericVotes = votes.filter(v => typeof v === 'number') as number[]
    
    if (numericVotes.length > 0) {
      session.currentVote.average = numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length
      // Check for agreement - all voters must have the same vote
      session.currentVote.hasAgreement = numericVotes.every(vote => vote === numericVotes[0])
    }

    // Add to history
    session.history.push({ ...session.currentVote })
    session.lastActivity = new Date()
    return true
  }

  updateSessionSettings(sessionId: string, settings?: any, facilitator?: string, name?: string, votingSystem?: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    // Update settings if provided
    if (settings) {
      session.settings = { ...session.settings, ...settings }
    }

    // Update facilitator if provided
    if (facilitator) {
      session.facilitator = facilitator
    }

    // Update session name if provided
    if (name) {
      session.name = name
    }

    // Update voting system if provided
    if (votingSystem) {
      session.votingSystem = votingSystem as 'simple' | 'extended'
    }

    session.lastActivity = new Date()
    return true
  }

       cleanupInactiveSessions(maxAge: number = 15 * 60 * 1000): number { // 15 minutes
    const now = new Date()
    let cleaned = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        this.sessions.delete(sessionId)
        cleaned++
      }
    }

    return cleaned
  }

  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values())
  }
} 