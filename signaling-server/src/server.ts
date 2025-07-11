import WebSocket, { WebSocketServer } from 'ws'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { v4 as uuidv4 } from 'uuid'
import { SessionManager } from './services/SessionManager'
import { PlayerManager } from './services/PlayerManager'
import { WebSocketMessage, ServerResponse } from './types'
import { logger } from './utils/logger'

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json())

// Managers
const sessionManager = new SessionManager()
const playerManager = new PlayerManager()

// REST endpoints for session management
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.get('/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions().map(session => ({
    id: session.id,
    name: session.name,
    playerCount: session.players.filter(p => p.isOnline).length,
    lastActivity: session.lastActivity
  }))
  res.json(sessions)
})

app.post('/sessions', (req, res) => {
  const { name, facilitatorId, facilitatorName } = req.body
  
  if (!name || !facilitatorId || !facilitatorName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const session = sessionManager.createSession(name, facilitatorId, facilitatorName)
  res.json(session)
})

// WebSocket server
const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket) => {
  const connectionId = uuidv4()
  logger.info(`New WebSocket connection: ${connectionId}`)

  ws.on('message', async (data: Buffer) => {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString())
      await handleMessage(connectionId, ws, message)
    } catch (error) {
      logger.error('Failed to parse message:', error)
      sendError(ws, 'Invalid message format')
    }
  })

  ws.on('close', () => {
    const player = playerManager.removeConnection(connectionId)
    if (player) {
      logger.info(`Player disconnected: ${player.userName} from session ${player.sessionId}`)
      
      // Mark player as offline
      sessionManager.removePlayerFromSession(player.sessionId, player.userId)
      
      // Notify other players
      broadcastToSession(player.sessionId, {
        type: 'sync_event',
        event: {
          type: 'PLAYER_DISCONNECTED',
          payload: { playerId: player.userId }
        },
        timestamp: Date.now()
      })
    }
  })

  ws.on('error', (error) => {
    logger.error(`WebSocket error for ${connectionId}:`, error)
  })

  // Don't send initial heartbeat - wait for client to join first
})

async function handleMessage(connectionId: string, ws: WebSocket, message: WebSocketMessage) {
  switch (message.type) {
    case 'join':
      await handleJoin(connectionId, ws, message)
      break
    
    case 'sync_event':
      await handleSyncEvent(connectionId, message)
      break
    
    case 'heartbeat':
      handleHeartbeat(connectionId, ws)
      break
    
    case 'leave':
      await handleLeave(connectionId)
      break
    
    default:
      logger.warn(`Unknown message type: ${message.type}`)
      sendError(ws, 'Unknown message type')
  }
}

async function handleJoin(connectionId: string, ws: WebSocket, message: WebSocketMessage) {
  const { sessionId, userId, userName } = message
  
  if (!sessionId || !userId || !userName) {
    sendError(ws, 'Missing required fields for join')
    return
  }

  // Add connection
  playerManager.addConnection(connectionId, ws, sessionId, userId, userName)
  
  // Get or create session
  let session = sessionManager.getSession(sessionId)
  if (!session) {
    logger.warn(`Session ${sessionId} not found, player cannot join`)
    sendSessionNotFound(ws, 'Session not found')
    return
  }

  // Add player to session
  const success = sessionManager.addPlayerToSession(sessionId, {
    id: userId,
    name: userName,
    isOnline: true
  })

  if (success) {
    session = sessionManager.getSession(sessionId)!
    
    // Send success response
    const response: ServerResponse = {
      type: 'joined',
      session,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))

    // Notify other players
    broadcastToSession(sessionId, {
      type: 'sync_event',
      event: {
        type: 'PLAYER_JOINED',
        payload: { player: session.players.find(p => p.id === userId)! }
      },
      timestamp: Date.now()
    }, connectionId)

    logger.info(`Player ${userName} joined session ${sessionId}`)
  } else {
    sendError(ws, 'Failed to join session')
  }
}

async function handleSyncEvent(connectionId: string, message: WebSocketMessage) {
  const player = playerManager.getConnection(connectionId)
  if (!player || !message.event) {
    logger.warn('Invalid sync event: no player or event')
    return
  }

  const { sessionId } = player
  const event = message.event

  // Process event based on type
  switch (event.type) {
    case 'VOTE_SUBMITTED':
      const { playerId, vote } = event.payload
      sessionManager.updatePlayerVote(sessionId, playerId, vote)
      break
    
    case 'VOTING_STARTED':
      const { issueName } = event.payload
      sessionManager.startVoting(sessionId, issueName)
      break
    
    case 'VOTES_REVEALED':
      sessionManager.revealVotes(sessionId)
      break

    case 'SETTINGS_UPDATED':
      const { settings, facilitator, name, votingSystem } = event.payload
      sessionManager.updateSessionSettings(sessionId, settings, facilitator, name, votingSystem)
      break

    case 'PLAYER_LEFT':
      const { playerId: leftPlayerId } = event.payload
      sessionManager.removePlayerFromSession(sessionId, leftPlayerId)
      break

    case 'EMOJI_SENT':
      // No server-side processing needed for emoji events, just broadcast
      break
  }

  // Broadcast event to all players in session
  broadcastToSession(sessionId, {
    type: 'sync_event',
    event,
    timestamp: Date.now()
  })

  logger.info(`Sync event ${event.type} from ${player.userName} in session ${sessionId}`)
}

function handleHeartbeat(connectionId: string, ws: WebSocket) {
  playerManager.updateHeartbeat(connectionId)
  const response: ServerResponse = {
    type: 'heartbeat_ack',
    timestamp: Date.now()
  }
  ws.send(JSON.stringify(response))
}

async function handleLeave(connectionId: string) {
  const player = playerManager.removeConnection(connectionId)
  if (player) {
    sessionManager.removePlayerFromSession(player.sessionId, player.userId)
    
    broadcastToSession(player.sessionId, {
      type: 'sync_event',
      event: {
        type: 'PLAYER_LEFT',
        payload: { playerId: player.userId }
      },
      timestamp: Date.now()
    })

    logger.info(`Player ${player.userName} left session ${player.sessionId}`)
  }
}

function broadcastToSession(sessionId: string, message: ServerResponse, excludeConnectionId?: string) {
  const connections = playerManager.getConnectionsBySession(sessionId)
  
  connections.forEach(player => {
    if (excludeConnectionId && player.ws === playerManager.getConnection(excludeConnectionId)?.ws) {
      return
    }
    
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message))
    }
  })
}

function sendSessionNotFound(ws: WebSocket, message: string) {
  const response: ServerResponse = {
    type: 'session_not_found',
    message,
    timestamp: Date.now()
  }
  ws.send(JSON.stringify(response))
}

function sendError(ws: WebSocket, message: string) {
  const response: ServerResponse = {
    type: 'error',
    message,
    timestamp: Date.now()
  }
  ws.send(JSON.stringify(response))
}

function sendHeartbeat(ws: WebSocket) {
  const response: ServerResponse = {
    type: 'heartbeat_ack',
    timestamp: Date.now()
  }
  ws.send(JSON.stringify(response))
}

// Cleanup intervals
setInterval(() => {
  const staleConnections = playerManager.cleanupStaleConnections()
  const inactiveSessions = sessionManager.cleanupInactiveSessions()
  
  if (staleConnections > 0 || inactiveSessions > 0) {
    logger.info(`Cleaned up ${staleConnections} stale connections and ${inactiveSessions} inactive sessions`)
  }
   }, 60000) // Run every 60 seconds

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  logger.info(`Signaling server running on port ${PORT}`)
}) 