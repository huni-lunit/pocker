# Signaling Server Implementation Tasks

This document outlines the tasks for implementing a real-time WebSocket signaling server for the Pocker planning poker application, ensuring compatibility with the existing client code.

## Overview

The signaling server will:
- Handle WebSocket connections for real-time communication
- Manage game sessions and player connections
- Route messages between players in the same session
- Support all existing SyncEvent types from the client
- Provide session persistence and reconnection handling

## Task 1: Create WebSocket Signaling Server Core

### Objective
Implement a Node.js WebSocket server that manages real-time communication for planning poker sessions.

### Requirements
- Use `ws` library for WebSocket handling
- Support session-based routing (players only receive events from their session)
- Handle connection/disconnection gracefully
- Implement heartbeat/ping-pong for connection health
- Store active sessions and players in memory
- Log all events for debugging

### Implementation Steps

1. **Initialize Server Project**
   ```bash
   mkdir signaling-server
   cd signaling-server
   npm init -y
   npm install ws uuid cors express
   npm install -D @types/ws @types/uuid @types/express typescript ts-node nodemon
   ```

2. **Create Server Structure**
   ```
   signaling-server/
   ├── src/
   │   ├── server.ts
   │   ├── types/
   │   │   └── index.ts
   │   ├── services/
   │   │   ├── SessionManager.ts
   │   │   └── PlayerManager.ts
   │   └── utils/
   │       └── logger.ts
   ├── package.json
   ├── tsconfig.json
   └── Dockerfile
   ```

3. **Define Types (src/types/index.ts)**
   ```typescript
   // Copy and extend types from client
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
     votingSystem: 'simple' | 'extended'
     players: Player[]
     currentVote?: VotingRound
     settings: GameSettings
     history: VotingRound[]
     createdAt: Date
     lastActivity: Date
   }

   export interface VotingRound {
     id: string
     issueName?: string
     votes: Record<string, string | number>
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

   export type SyncEvent = 
     | { type: 'PLAYER_JOINED'; payload: { player: Player } }
     | { type: 'PLAYER_LEFT'; payload: { playerId: string } }
     | { type: 'VOTE_SUBMITTED'; payload: { playerId: string; vote: string | number } }
     | { type: 'VOTING_STARTED'; payload: { issueName?: string } }
     | { type: 'VOTES_REVEALED'; payload: {} }
     | { type: 'SESSION_UPDATED'; payload: { session: GameSession } }
     | { type: 'PLAYER_RECONNECTED'; payload: { playerId: string } }
     | { type: 'PLAYER_DISCONNECTED'; payload: { playerId: string } }

   export interface WebSocketMessage {
     type: 'join' | 'leave' | 'sync_event' | 'heartbeat'
     sessionId?: string
     userId?: string
     userName?: string
     event?: SyncEvent
     timestamp: number
   }

   export interface ServerResponse {
     type: 'joined' | 'error' | 'sync_event' | 'heartbeat_ack'
     message?: string
     event?: SyncEvent
     session?: GameSession
     timestamp: number
   }

   export interface ConnectedPlayer {
     ws: WebSocket
     sessionId: string
     userId: string
     userName: string
     lastHeartbeat: Date
   }
   ```

4. **Implement SessionManager (src/services/SessionManager.ts)**
   ```typescript
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

       const playerIndex = session.players.findIndex(p => p.id === playerId)
       if (playerIndex >= 0) {
         session.players[playerIndex].isOnline = false
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
       
       // Calculate average
       const votes = Object.values(session.currentVote.votes).filter(v => typeof v === 'number') as number[]
       if (votes.length > 0) {
         session.currentVote.average = votes.reduce((sum, vote) => sum + vote, 0) / votes.length
         session.currentVote.hasAgreement = votes.every(vote => vote === votes[0])
       }

       session.history.push(session.currentVote)
       session.lastActivity = new Date()
       return true
     }

     cleanupInactiveSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
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
   ```

5. **Implement PlayerManager (src/services/PlayerManager.ts)**
   ```typescript
   import WebSocket from 'ws'
   import { ConnectedPlayer } from '../types'

   export class PlayerManager {
     private connections = new Map<string, ConnectedPlayer>()
     private userToConnection = new Map<string, string>()

     addConnection(connectionId: string, ws: WebSocket, sessionId: string, userId: string, userName: string): void {
       const player: ConnectedPlayer = {
         ws,
         sessionId,
         userId,
         userName,
         lastHeartbeat: new Date()
       }

       this.connections.set(connectionId, player)
       this.userToConnection.set(`${sessionId}:${userId}`, connectionId)
     }

     removeConnection(connectionId: string): ConnectedPlayer | undefined {
       const player = this.connections.get(connectionId)
       if (player) {
         this.connections.delete(connectionId)
         this.userToConnection.delete(`${player.sessionId}:${player.userId}`)
       }
       return player
     }

     getConnection(connectionId: string): ConnectedPlayer | undefined {
       return this.connections.get(connectionId)
     }

     getConnectionsBySession(sessionId: string): ConnectedPlayer[] {
       return Array.from(this.connections.values()).filter(
         player => player.sessionId === sessionId
       )
     }

     updateHeartbeat(connectionId: string): boolean {
       const player = this.connections.get(connectionId)
       if (player) {
         player.lastHeartbeat = new Date()
         return true
       }
       return false
     }

     cleanupStaleConnections(maxAge: number = 30000): number {
       const now = new Date()
       let cleaned = 0

       for (const [connectionId, player] of this.connections.entries()) {
         if (now.getTime() - player.lastHeartbeat.getTime() > maxAge) {
           if (player.ws.readyState === WebSocket.OPEN) {
             player.ws.close()
           }
           this.removeConnection(connectionId)
           cleaned++
         }
       }

       return cleaned
     }

     getAllConnections(): ConnectedPlayer[] {
       return Array.from(this.connections.values())
     }
   }
   ```

6. **Create Main Server (src/server.ts)**
   ```typescript
   import WebSocket, { WebSocketServer } from 'ws'
   import express from 'express'
   import cors from 'cors'
   import { createServer } from 'http'
   import { v4 as uuidv4 } from 'uuid'
   import { SessionManager } from './services/SessionManager'
   import { PlayerManager } from './services/PlayerManager'
   import { WebSocketMessage, ServerResponse, SyncEvent } from './types'
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

     // Send initial heartbeat
     sendHeartbeat(ws)
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
       sendError(ws, 'Session not found')
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
   }, 30000) // Run every 30 seconds

   const PORT = process.env.PORT || 8080
   server.listen(PORT, () => {
     logger.info(`Signaling server running on port ${PORT}`)
   })
   ```

7. **Create Logger Utility (src/utils/logger.ts)**
   ```typescript
   export const logger = {
     info: (message: string, ...args: any[]) => {
       console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args)
     },
     warn: (message: string, ...args: any[]) => {
       console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args)
     },
     error: (message: string, ...args: any[]) => {
       console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args)
     }
   }
   ```

8. **Create tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "lib": ["ES2020"],
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

9. **Update package.json Scripts**
   ```json
   {
     "scripts": {
       "start": "node dist/server.js",
       "dev": "nodemon --exec ts-node src/server.ts",
       "build": "tsc",
       "test": "echo \"No tests yet\" && exit 0"
     }
   }
   ```

## Task 2: Create WebSocket Client Implementation

### Objective
Create a WebSocketRealTimeSync class that implements the existing RealTimeSync interface, ensuring seamless integration with the current client code.

### Implementation Steps

1. **Create WebSocketRealTimeSync Class in src/lib/realtime.ts**
   ```typescript
   // Add to existing realtime.ts file

   class WebSocketRealTimeSync implements RealTimeSync {
     status: ConnectionStatus = 'disconnected'
     private ws: WebSocket | null = null
     private eventCallbacks: ((event: SyncEvent) => void)[] = []
     private statusCallbacks: ((status: ConnectionStatus) => void)[] = []
     private sessionId: string | null = null
     private userId: string | null = null
     private heartbeatInterval: NodeJS.Timeout | null = null
     private reconnectTimeout: NodeJS.Timeout | null = null
     private reconnectAttempts = 0
     private maxReconnectAttempts = 5

     async connect(sessionId: string, userId: string): Promise<void> {
       this.sessionId = sessionId
       this.userId = userId
       this.setStatus('connecting')

       try {
         const wsUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'ws://localhost:8080'
         this.ws = new WebSocket(wsUrl)

         this.ws.onopen = () => {
           console.log('🔗 WebSocket connected')
           this.setStatus('connected')
           this.reconnectAttempts = 0
           this.sendJoinMessage()
           this.startHeartbeat()
         }

         this.ws.onmessage = (event) => {
           try {
             const response: ServerResponse = JSON.parse(event.data)
             this.handleServerResponse(response)
           } catch (error) {
             console.error('Failed to parse server response:', error)
           }
         }

         this.ws.onclose = (event) => {
           console.log('🔌 WebSocket disconnected:', event.code, event.reason)
           this.cleanup()
           
           if (event.code !== 1000) { // Not a normal closure
             this.handleReconnection()
           }
         }

         this.ws.onerror = (error) => {
           console.error('WebSocket error:', error)
           this.setStatus('error')
         }

       } catch (error) {
         console.error('Failed to establish WebSocket connection:', error)
         this.setStatus('error')
         throw error
       }
     }

     disconnect(): void {
       this.cleanup()
       
       if (this.ws) {
         this.sendLeaveMessage()
         this.ws.close(1000, 'Normal closure')
         this.ws = null
       }
       
       this.setStatus('disconnected')
       this.sessionId = null
       this.userId = null
     }

     sendEvent(event: SyncEvent): void {
       if (this.status !== 'connected' || !this.ws) {
         console.warn('Cannot send event: not connected')
         return
       }

       const message: WebSocketMessage = {
         type: 'sync_event',
         event,
         timestamp: Date.now()
       }

       this.ws.send(JSON.stringify(message))
       console.log('📤 Sent event:', event.type)
     }

     onEvent(callback: (event: SyncEvent) => void): void {
       this.eventCallbacks.push(callback)
     }

     onStatusChange(callback: (status: ConnectionStatus) => void): void {
       this.statusCallbacks.push(callback)
     }

     private sendJoinMessage(): void {
       if (!this.ws || !this.sessionId || !this.userId) return

       const userName = localStorage.getItem('userName') || 'Anonymous'
       const message: WebSocketMessage = {
         type: 'join',
         sessionId: this.sessionId,
         userId: this.userId,
         userName,
         timestamp: Date.now()
       }

       this.ws.send(JSON.stringify(message))
     }

     private sendLeaveMessage(): void {
       if (!this.ws) return

       const message: WebSocketMessage = {
         type: 'leave',
         timestamp: Date.now()
       }

       this.ws.send(JSON.stringify(message))
     }

     private handleServerResponse(response: ServerResponse): void {
       switch (response.type) {
         case 'joined':
           console.log('✅ Successfully joined session')
           if (response.session) {
             // Update local session state
             this.eventCallbacks.forEach(callback => 
               callback({
                 type: 'SESSION_UPDATED',
                 payload: { session: response.session! }
               })
             )
           }
           break

         case 'sync_event':
           if (response.event) {
             console.log('📥 Received event:', response.event.type)
             this.eventCallbacks.forEach(callback => callback(response.event!))
           }
           break

         case 'heartbeat_ack':
           // Heartbeat acknowledged
           break

         case 'error':
           console.error('Server error:', response.message)
           this.setStatus('error')
           break
       }
     }

     private startHeartbeat(): void {
       this.heartbeatInterval = setInterval(() => {
         if (this.ws?.readyState === WebSocket.OPEN) {
           const message: WebSocketMessage = {
             type: 'heartbeat',
             timestamp: Date.now()
           }
           this.ws.send(JSON.stringify(message))
         }
       }, 25000) // Send heartbeat every 25 seconds
     }

     private cleanup(): void {
       if (this.heartbeatInterval) {
         clearInterval(this.heartbeatInterval)
         this.heartbeatInterval = null
       }
       
       if (this.reconnectTimeout) {
         clearTimeout(this.reconnectTimeout)
         this.reconnectTimeout = null
       }
     }

     private handleReconnection(): void {
       if (this.reconnectAttempts >= this.maxReconnectAttempts) {
         console.error('Max reconnection attempts reached')
         this.setStatus('error')
         return
       }

       this.reconnectAttempts++
       const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
       
       console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
       this.setStatus('connecting')

       this.reconnectTimeout = setTimeout(() => {
         if (this.sessionId && this.userId) {
           this.connect(this.sessionId, this.userId).catch(() => {
             this.handleReconnection()
           })
         }
       }, delay)
     }

     private setStatus(status: ConnectionStatus): void {
       this.status = status
       this.statusCallbacks.forEach(callback => callback(status))
     }
   }

   // Update factory function
   export const createRealTimeSync = (type: 'simulated' | 'webrtc' | 'websocket' = 'simulated'): RealTimeSync => {
     switch (type) {
       case 'websocket':
         return new WebSocketRealTimeSync()
       case 'webrtc':
         return new WebRTCRealTimeSync()
       case 'simulated':
       default:
         return new SimulatedRealTimeSync()
     }
   }
   ```

2. **Add WebSocket Message Types to Client Types (src/types/index.ts)**
   ```typescript
   // Add these interfaces to existing types
   export interface WebSocketMessage {
     type: 'join' | 'leave' | 'sync_event' | 'heartbeat'
     sessionId?: string
     userId?: string
     userName?: string
     event?: SyncEvent
     timestamp: number
   }

   export interface ServerResponse {
     type: 'joined' | 'error' | 'sync_event' | 'heartbeat_ack'
     message?: string
     event?: SyncEvent
     session?: GameSession
     timestamp: number
   }
   ```

## Task 3: Create Signaling Server Dockerfile

### Objective
Create a production-ready Dockerfile for the signaling server with proper optimization and security.

### Implementation

**Create signaling-server/Dockerfile:**
```dockerfile
# Multi-stage build for signaling server

# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder  
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 websocket
RUN adduser --system --uid 1001 signaling

# Copy built application and dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

USER signaling

# Expose WebSocket port
EXPOSE 8080

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));" || exit 1

# Start the server
CMD ["node", "dist/server.js"]
```

## Task 4: Integration and Testing

### Objective
Integrate the WebSocket signaling server with the existing client and test all functionality.

### Implementation Steps

1. **Update Client to Use WebSocket by Default**
   ```typescript
   // In your React components, change:
   const realTimeSync = createRealTimeSync('websocket')
   ```

2. **Create Docker Compose for Development**
   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     web:
       build: .
       ports:
         - "3000:3000"
       environment:
         - SIGNALING_SERVER_URL=ws://signaling:8080
       depends_on:
         - signaling

     signaling:
       build: ./signaling-server
       ports:
         - "8080:8080"
       environment:
         - NODE_ENV=development
         - PORT=8080
   ```

3. **Create Production Docker Compose**
   ```yaml
   # docker-compose.prod.yml
   version: '3.8'
   services:
     web:
       image: pocker-web:latest
       ports:
         - "80:3000"
       environment:
         - SIGNALING_SERVER_URL=ws://your-domain.com:8080
       restart: unless-stopped

     signaling:
       image: pocker-signaling:latest
       ports:
         - "8080:8080"
       environment:
         - NODE_ENV=production
         - PORT=8080
       restart: unless-stopped
   ```

4. **Testing Checklist**
   - [ ] Players can join sessions
   - [ ] Real-time voting works
   - [ ] Vote reveal functionality
   - [ ] Player disconnect/reconnect handling
   - [ ] Session cleanup
   - [ ] Heartbeat mechanism
   - [ ] Error handling
   - [ ] Multiple concurrent sessions

## Task 5: Deployment and Monitoring

### Objective
Set up production deployment with monitoring and logging.

### Implementation Steps

1. **Add Structured Logging**
   ```typescript
   // Enhanced logger with structured logging
   import winston from 'winston'

   export const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.errors({ stack: true }),
       winston.format.json()
     ),
     transports: [
       new winston.transports.Console(),
       new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
       new winston.transports.File({ filename: 'logs/combined.log' })
     ]
   })
   ```

2. **Add Metrics Collection**
   ```typescript
   // Basic metrics collection
   export class MetricsCollector {
     private metrics = {
       activeConnections: 0,
       activeSessions: 0,
       totalMessages: 0,
       errors: 0
     }

     incrementConnections() { this.metrics.activeConnections++ }
     decrementConnections() { this.metrics.activeConnections-- }
     incrementSessions() { this.metrics.activeSessions++ }
     decrementSessions() { this.metrics.activeSessions-- }
     incrementMessages() { this.metrics.totalMessages++ }
     incrementErrors() { this.metrics.errors++ }

     getMetrics() { return { ...this.metrics } }
   }
   ```

3. **Environment Configuration**
   ```bash
   # .env.production
   NODE_ENV=production
   PORT=8080
   LOG_LEVEL=info
   MAX_CONNECTIONS=1000
   SESSION_CLEANUP_INTERVAL=300000
   CONNECTION_TIMEOUT=30000
   ```

## Estimated Timeline

- **Task 1**: 2-3 days (Server implementation)
- **Task 2**: 1 day (Client integration)
- **Task 3**: 0.5 days (Dockerfile)
- **Task 4**: 1-2 days (Testing and debugging)
- **Task 5**: 1 day (Deployment setup)

**Total**: 5.5-7.5 days

## Success Criteria

- ✅ Real-time communication works between multiple clients
- ✅ All existing SyncEvent types are supported
- ✅ Graceful handling of disconnections and reconnections
- ✅ Session persistence and cleanup
- ✅ Docker containers run successfully
- ✅ Production-ready with logging and monitoring
- ✅ Backward compatibility with existing client code 