import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GameSession, Player, VotingRound, VotingSystem, VOTING_SYSTEMS } from '@/types'
import { generateUserId, saveSessionToStorage } from './session'
import { createRealTimeSync, RealTimeSync, saveOfflineVote, getOfflineVote, clearOfflineVote } from './realtime'

// Get client ID from URL parameter for multi-client testing
const getClientId = (): string => {
  if (typeof window === 'undefined') return ''
  const urlParams = new URLSearchParams(window.location.search)
  const clientId = urlParams.get('client')
  return clientId ? `-${clientId}` : ''
}

// Get storage key with client-specific namespace
const getStorageKey = (): string => {
  return `planning-poker-store${getClientId()}`
}

interface GameState {
  // Current session data
  session: GameSession | null
  currentUserId: string | null
  
  // UI state
  isVoting: boolean
  selectedVote: string | number | null
  showResults: boolean
  
  // Real-time sync
  realTimeSync: RealTimeSync | null
  isOnline: boolean
  
  // Actions
  setSession: (session: GameSession, userId: string) => void
  clearSession: () => void
  updateSessionName: (name: string) => void
  updateVotingSystem: (system: VotingSystem) => void
  
  // Real-time sync actions
  initializeRealTimeSync: () => void
  connectToSession: () => Promise<void>
  disconnectFromSession: () => void
  setOnlineStatus: (isOnline: boolean) => void
  
  // Player actions
  addPlayer: (name: string) => void
  removePlayer: (playerId: string) => void
  updatePlayerVote: (playerId: string, vote: string | number) => void
  
  // Voting actions
  startVoting: (issueName?: string, fromEvent?: boolean) => void
  submitVote: (vote: string | number) => void
  revealVotes: (fromEvent?: boolean) => void
  clearVotes: () => void
  
  // Settings actions
  updateGameSettings: (settings: any, facilitator?: string, name?: string, votingSystem?: VotingSystem) => void
  
  // Utility functions
  getCurrentPlayer: () => Player | null
  getAvailableCards: () => (string | number)[]
  calculateResults: () => { average: number; hasAgreement: boolean }
  canRevealVotes: () => boolean
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      session: null,
      currentUserId: null,
      isVoting: false,
      selectedVote: null,
      showResults: false,
      realTimeSync: null,
      isOnline: true,

      setSession: (session, userId) => {
        set({ 
          session: {
            ...session,
            players: session.players.map(p => ({
              ...p,
              isCurrentUser: p.id === userId
            }))
          }, 
          currentUserId: userId 
        })
        saveSessionToStorage(session, userId, session.players.find(p => p.id === userId)?.name || '')
      },

      clearSession: () => {
        const { realTimeSync } = get()
        realTimeSync?.disconnect()
        
        set({ 
          session: null, 
          currentUserId: null, 
          isVoting: false, 
          selectedVote: null, 
          showResults: false,
          realTimeSync: null
        })
        if (typeof window !== 'undefined') {
          localStorage.removeItem(getStorageKey())
        }
      },

      initializeRealTimeSync: () => {
        const sync = createRealTimeSync('websocket')
        
        // Set up event handlers
        sync.onEvent((event) => {
          const { session } = get()
          if (!session) return

          switch (event.type) {
            case 'PLAYER_JOINED':
              const newPlayer = event.payload.player
              if (!session.players.find(p => p.id === newPlayer.id)) {
                const updatedSession = {
                  ...session,
                  players: [...session.players, newPlayer]
                }
                set({ session: updatedSession })
              }
              break

            case 'PLAYER_LEFT':
            case 'PLAYER_DISCONNECTED':
              const updatedSession = {
                ...session,
                players: session.players.map(p => 
                  p.id === event.payload.playerId 
                    ? { ...p, isOnline: false }
                    : p
                )
              }
              set({ session: updatedSession })
              break

            case 'VOTE_SUBMITTED':
              const { playerId, vote } = event.payload
              const voteUpdatedSession = {
                ...session,
                currentVote: session.currentVote ? {
                  ...session.currentVote,
                  votes: {
                    ...session.currentVote.votes,
                    [playerId]: vote
                  }
                } : undefined,
                players: session.players.map(p => 
                  p.id === playerId 
                    ? { ...p, vote, hasVoted: true }
                    : p
                )
              }
              set({ session: voteUpdatedSession })
              break

            case 'VOTING_STARTED':
              const { issueName } = event.payload
              get().startVoting(issueName, true) // Pass true to indicate this is from an event
              break

            case 'VOTES_REVEALED':
              get().revealVotes(true) // Pass true to indicate this is from an event
              break

            case 'SESSION_UPDATED':
              const { session: updatedSessionData } = event.payload
              set({ session: updatedSessionData })
              break

            case 'PLAYER_RECONNECTED':
              const reconnectedSession = {
                ...session,
                players: session.players.map(p => 
                  p.id === event.payload.playerId 
                    ? { ...p, isOnline: true }
                    : p
                )
              }
              set({ session: reconnectedSession })
              break

            case 'SETTINGS_UPDATED':
              const { settings, facilitator, name, votingSystem } = event.payload
              const currentSession = get().session
              if (!currentSession) break
              
              const updatedSessionFromEvent = {
                ...currentSession,
                settings: settings ? { ...currentSession.settings, ...settings } : currentSession.settings,
                facilitator: facilitator || currentSession.facilitator,
                name: name || currentSession.name,
                votingSystem: (votingSystem as VotingSystem) || currentSession.votingSystem
              }
              set({ session: updatedSessionFromEvent })
              break
          }
        })

        // Set up session not found handler - auto leave session
        sync.onSessionNotFound(() => {
          console.log('🚪 Session not found - automatically leaving session')
          get().clearSession()
        })

        set({ realTimeSync: sync })
      },

      connectToSession: async () => {
        const { session, currentUserId, realTimeSync } = get()
        if (!session || !currentUserId || !realTimeSync) return

        try {
          // Get the current user's name
          const currentPlayer = session.players.find(p => p.id === currentUserId)
          const userName = currentPlayer?.name || localStorage.getItem('userName') || 'Anonymous'
          
          await realTimeSync.connect(session.id, currentUserId, userName)
          
          // Check for offline votes and sync them
          const offlineVote = getOfflineVote(session.id, currentUserId)
          if (offlineVote) {
            get().submitVote(offlineVote.vote)
            clearOfflineVote(session.id, currentUserId)
          }
        } catch (error) {
          console.error('Failed to connect to session:', error)
        }
      },

      disconnectFromSession: () => {
        const { realTimeSync } = get()
        realTimeSync?.disconnect()
      },

      setOnlineStatus: (isOnline) => {
        set({ isOnline })
        
        if (isOnline) {
          // Try to reconnect when coming back online
          get().connectToSession()
        }
      },

      updateSessionName: (name) => {
        const { session } = get()
        if (!session) return
        
        const updatedSession = { ...session, name }
        set({ session: updatedSession })
        saveSessionToStorage(updatedSession, get().currentUserId!, name)
      },

      updateVotingSystem: (system) => {
        const { session } = get()
        if (!session) return
        
        const updatedSession = { ...session, votingSystem: system }
        set({ session: updatedSession })
      },

      updateGameSettings: (settings, facilitator, name, votingSystem) => {
        const { session, realTimeSync } = get()
        if (!session) return

        const updatedSession = {
          ...session,
          settings: {
            ...session.settings,
            ...settings
          },
          facilitator: facilitator || session.facilitator,
          name: name || session.name,
          votingSystem: votingSystem || session.votingSystem
        }
        set({ session: updatedSession })

        // Send real-time event to other clients if connected
        if (realTimeSync?.status === 'connected') {
          realTimeSync.sendEvent({
            type: 'SETTINGS_UPDATED',
            payload: { settings, facilitator, name, votingSystem }
          })
        }
      },

      addPlayer: (name) => {
        const { session } = get()
        if (!session) return
        
        if (session.players.length >= 10) {
          throw new Error('Session is full (maximum 10 players)')
        }
        
        const nameExists = session.players.some(p => 
          p.name.toLowerCase() === name.toLowerCase()
        )
        
        if (nameExists) {
          throw new Error('A player with this name already exists')
        }
        
        const newPlayer: Player = {
          id: generateUserId(),
          name,
          isOnline: true
        }
        
        const updatedSession = {
          ...session,
          players: [...session.players, newPlayer]
        }
        
        set({ session: updatedSession })
      },

      removePlayer: (playerId) => {
        const { session } = get()
        if (!session) return
        
        const updatedSession = {
          ...session,
          players: session.players.filter(p => p.id !== playerId)
        }
        
        set({ session: updatedSession })
      },

      updatePlayerVote: (playerId, vote) => {
        const { session } = get()
        if (!session) return
        
        const updatedSession = {
          ...session,
          players: session.players.map(p => 
            p.id === playerId 
              ? { ...p, vote, hasVoted: true }
              : p
          )
        }
        
        set({ session: updatedSession })
      },

      startVoting: (issueName, fromEvent = false) => {
        const { session, realTimeSync } = get()
        if (!session) return
        
        const newVotingRound: VotingRound = {
          id: generateUserId(),
          issueName,
          votes: {},
          startTime: new Date(),
          isRevealed: false
        }
        
        const updatedSession = {
          ...session,
          currentVote: newVotingRound,
          players: session.players.map(p => ({
            ...p,
            vote: undefined,
            hasVoted: false
          }))
        }
        
        set({ 
          session: updatedSession, 
          isVoting: true, 
          selectedVote: null, 
          showResults: false 
        })

        // Only send real-time event if this is NOT from a received event
        if (!fromEvent && realTimeSync?.status === 'connected') {
          realTimeSync.sendEvent({
            type: 'VOTING_STARTED',
            payload: { issueName }
          })
        }
      },

      submitVote: (vote) => {
        const { session, currentUserId, realTimeSync } = get()
        if (!session || !currentUserId) return
        
        // Allow voting only if voting is active and not yet revealed
        if (!session.currentVote || session.currentVote.isRevealed) return
        
        // Update local state - allow vote changes
        const updatedSession = {
          ...session,
          players: session.players.map(player => 
            player.id === currentUserId 
              ? { ...player, vote, hasVoted: true }
              : player
          ),
          currentVote: {
            ...session.currentVote,
            votes: {
              ...session.currentVote.votes,
              [currentUserId]: vote
            }
          }
        }
        
        set({ 
          session: updatedSession, 
          selectedVote: vote 
        })
        
        // Store offline vote for reconnection
        saveOfflineVote(session.id, currentUserId, vote)
        
        // Send real-time event if connected
        if (realTimeSync?.status === 'connected') {
          realTimeSync.sendEvent({
            type: 'VOTE_SUBMITTED',
            payload: { playerId: currentUserId, vote }
          })
        }
      },

      revealVotes: (fromEvent = false) => {
        const { session, realTimeSync } = get()
        if (!session?.currentVote) return
        
        const results = get().calculateResults()
        
        const updatedCurrentVote = {
          ...session.currentVote,
          isRevealed: true,
          endTime: new Date(),
          average: results.average,
          hasAgreement: results.hasAgreement
        }
        
        const updatedSession = {
          ...session,
          currentVote: updatedCurrentVote,
          history: [...session.history, updatedCurrentVote]
        }
        
        set({ 
          session: updatedSession, 
          showResults: true,
          isVoting: false 
        })

        // Only send real-time event if this is NOT from a received event
        if (!fromEvent && realTimeSync?.status === 'connected') {
          realTimeSync.sendEvent({
            type: 'VOTES_REVEALED',
            payload: {}
          })
        }
      },

      clearVotes: () => {
        const { session } = get()
        if (!session) return
        
        const updatedSession = {
          ...session,
          currentVote: undefined,
          players: session.players.map(p => ({
            ...p,
            vote: undefined,
            hasVoted: false
          }))
        }
        
        set({ 
          session: updatedSession, 
          isVoting: false, 
          selectedVote: null, 
          showResults: false 
        })
      },

      getCurrentPlayer: () => {
        const { session, currentUserId } = get()
        if (!session || !currentUserId) return null
        return session.players.find(p => p.id === currentUserId) || null
      },

      getAvailableCards: () => {
        const { session } = get()
        if (!session) return []
        return [...VOTING_SYSTEMS[session.votingSystem]]
      },

      calculateResults: () => {
        const { session } = get()
        if (!session?.currentVote) return { average: 0, hasAgreement: false }
        
        const votes = Object.values(session.currentVote.votes)
        const numericVotes = votes.filter(v => typeof v === 'number') as number[]
        
        if (numericVotes.length === 0) {
          return { average: 0, hasAgreement: false }
        }
        
        const average = numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length
        
        // Check for agreement - all voters must have the same vote
        const hasAgreement = numericVotes.length > 0 && numericVotes.every(vote => vote === numericVotes[0])
        
        return { average, hasAgreement }
      },

      canRevealVotes: () => {
        const { session } = get()
        if (!session || !session.currentVote || session.currentVote.isRevealed) {
          return false
        }
        
        // Allow revealing even if not everyone has voted
        // At least one person must have voted
        const votedCount = session.players.filter(p => p.hasVoted).length
        return votedCount > 0
      }
    }),
    {
      name: getStorageKey(),
      partialize: (state) => ({
        session: state.session,
        currentUserId: state.currentUserId
      })
    }
  )
) 