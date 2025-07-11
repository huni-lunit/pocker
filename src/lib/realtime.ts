import React from 'react'
import { GameSession, Player, WebSocketMessage, ServerResponse, SyncEvent } from '@/types'

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// Real-time sync interface
export interface RealTimeSync {
  status: ConnectionStatus
  connect: (sessionId: string, userId: string, userName?: string) => Promise<void>
  disconnect: () => void
  sendEvent: (event: SyncEvent) => void
  onEvent: (callback: (event: SyncEvent) => void) => void
  onStatusChange: (callback: (status: ConnectionStatus) => void) => void
  onSessionNotFound: (callback: () => void) => void
}

// Simulated real-time sync for demo purposes
class SimulatedRealTimeSync implements RealTimeSync {
  status: ConnectionStatus = 'disconnected'
  private eventCallbacks: ((event: SyncEvent) => void)[] = []
  private statusCallbacks: ((status: ConnectionStatus) => void)[] = []
  private sessionNotFoundCallbacks: (() => void)[] = []
  private sessionId: string | null = null
  private userId: string | null = null

  async connect(sessionId: string, userId: string, userName?: string): Promise<void> {
    this.sessionId = sessionId
    this.userId = userId
    this.setStatus('connecting')
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    this.setStatus('connected')
    console.log(`🔗 Simulated connection established for session ${sessionId}`)
  }

  disconnect(): void {
    this.sessionId = null
    this.userId = null
    this.setStatus('disconnected')
    console.log('🔌 Disconnected from real-time sync')
  }

  sendEvent(event: SyncEvent): void {
    if (this.status !== 'connected') {
      console.warn('Cannot send event: not connected')
      return
    }
    
    console.log('📤 Sending event:', event.type, event.payload)
    
    // In a real implementation, this would send to other clients
    // For now, we'll just log it
  }

  onEvent(callback: (event: SyncEvent) => void): void {
    this.eventCallbacks.push(callback)
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallbacks.push(callback)
  }

  onSessionNotFound(callback: () => void): void {
    this.sessionNotFoundCallbacks.push(callback)
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status
    this.statusCallbacks.forEach(callback => callback(status))
  }

  // Simulate receiving events (for testing)
  simulateEvent(event: SyncEvent): void {
    console.log('📥 Received event:', event.type, event.payload)
    this.eventCallbacks.forEach(callback => callback(event))
  }
}

// WebRTC-based real-time sync (structure for future implementation)
class WebRTCRealTimeSync implements RealTimeSync {
  status: ConnectionStatus = 'disconnected'
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private eventCallbacks: ((event: SyncEvent) => void)[] = []
  private statusCallbacks: ((status: ConnectionStatus) => void)[] = []
  private sessionNotFoundCallbacks: (() => void)[] = []

  async connect(sessionId: string, userId: string, userName?: string): Promise<void> {
    this.setStatus('connecting')
    
    try {
      // Initialize WebRTC peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      })

      // Create data channel for real-time communication
      this.dataChannel = this.peerConnection.createDataChannel('planningPoker', {
        ordered: true
      })

      this.setupDataChannelHandlers()
      this.setupPeerConnectionHandlers()

      // In a real implementation, you would:
      // 1. Connect to a signaling server
      // 2. Exchange offers/answers with other peers
      // 3. Handle ICE candidates
      // 4. Establish peer-to-peer connections

      console.log('🚧 WebRTC sync is not fully implemented yet')
      this.setStatus('error')
      
    } catch (error) {
      console.error('Failed to establish WebRTC connection:', error)
      this.setStatus('error')
    }
  }

  disconnect(): void {
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
    
    this.setStatus('disconnected')
  }

  sendEvent(event: SyncEvent): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event))
    }
  }

  onEvent(callback: (event: SyncEvent) => void): void {
    this.eventCallbacks.push(callback)
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallbacks.push(callback)
  }

  onSessionNotFound(callback: () => void): void {
    this.sessionNotFoundCallbacks.push(callback)
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return

    this.dataChannel.onopen = () => {
      console.log('📡 WebRTC data channel opened')
      this.setStatus('connected')
    }

    this.dataChannel.onmessage = (event) => {
      try {
        const syncEvent: SyncEvent = JSON.parse(event.data)
        this.eventCallbacks.forEach(callback => callback(syncEvent))
      } catch (error) {
        console.error('Failed to parse sync event:', error)
      }
    }

    this.dataChannel.onclose = () => {
      console.log('📡 WebRTC data channel closed')
      this.setStatus('disconnected')
    }

    this.dataChannel.onerror = (error) => {
      console.error('WebRTC data channel error:', error)
      this.setStatus('error')
    }
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState)
    }

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState)
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status
    this.statusCallbacks.forEach(callback => callback(status))
  }
}

// WebSocket-based real-time sync for signaling server
class WebSocketRealTimeSync implements RealTimeSync {
  status: ConnectionStatus = 'disconnected'
  private ws: WebSocket | null = null
  private eventCallbacks: ((event: SyncEvent) => void)[] = []
  private statusCallbacks: ((status: ConnectionStatus) => void)[] = []
  private sessionNotFoundCallbacks: (() => void)[] = []
  private sessionId: string | null = null
  private userId: string | null = null
  private userName: string | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private lastReconnectTime = 0
  private minReconnectInterval = 5000 // Minimum 5 seconds between reconnection attempts

  async connect(sessionId: string, userId: string, userName?: string): Promise<void> {
    this.sessionId = sessionId
    this.userId = userId
    this.userName = userName || localStorage.getItem('userName') || 'Anonymous'
    this.setStatus('connecting')

    // Clean up any existing connection first
    if (this.ws) {
      console.log('🔄 Closing existing connection before reconnecting')
      this.ws.close(1000, 'Reconnecting')
      this.ws = null
    }
    this.cleanup()

    try {
      const wsUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'ws://localhost:8080'
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('🔗 WebSocket connected successfully')
        this.setStatus('connected')
        this.reconnectAttempts = 0
        this.lastReconnectTime = 0
        
        // Small delay to ensure connection is fully established
        setTimeout(() => {
          this.sendJoinMessage()
          this.startHeartbeat()
        }, 100)
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
        console.log('🔌 WebSocket disconnected:', event.code, event.reason, 'wasClean:', event.wasClean)
        this.cleanup()
        
        // Only reconnect if it wasn't a normal closure and we haven't been explicitly disconnected
        if (event.code !== 1000 && this.sessionId && this.userId) {
          console.log('🔄 Connection lost, will attempt reconnection')
          this.setStatus('disconnected')
          this.handleReconnection()
        } else {
          console.log('🔌 Connection closed normally, no reconnection needed')
          this.setStatus('disconnected')
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
    // Clear session info first to prevent reconnection
    const sessionId = this.sessionId
    const userId = this.userId
    
    this.sessionId = null
    this.userId = null
    this.userName = null
    
    this.cleanup()
    
    if (this.ws) {
      this.sendLeaveMessage()
      this.ws.close(1000, 'Normal closure')
      this.ws = null
    }
    
    this.setStatus('disconnected')
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

  onSessionNotFound(callback: () => void): void {
    this.sessionNotFoundCallbacks.push(callback)
  }

  private sendJoinMessage(): void {
    if (!this.ws || !this.sessionId || !this.userId || !this.userName) return

    const message: WebSocketMessage = {
      type: 'join',
      sessionId: this.sessionId,
      userId: this.userId,
      userName: this.userName,
      timestamp: Date.now()
    }

    this.ws.send(JSON.stringify(message))
    console.log('📤 Sending join message:', { sessionId: this.sessionId, userId: this.userId, userName: this.userName })
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

      case 'session_not_found':
        console.warn('Session not found:', response.message)
        this.sessionNotFoundCallbacks.forEach(callback => callback())
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
    const now = Date.now()
    
    // Prevent rapid reconnection attempts
    if (now - this.lastReconnectTime < this.minReconnectInterval) {
      console.log('⏳ Skipping reconnection - too soon after last attempt')
      return
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      this.setStatus('error')
      return
    }

    this.reconnectAttempts++
    this.lastReconnectTime = now
    const delay = Math.max(5000, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)) // 5s minimum, 30s max
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    this.setStatus('connecting')

    this.reconnectTimeout = setTimeout(() => {
      if (this.sessionId && this.userId && this.userName) {
        this.connect(this.sessionId, this.userId, this.userName).catch((error) => {
          console.error('Reconnection failed:', error)
          // Only continue reconnecting if we haven't reached max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.handleReconnection()
          } else {
            this.setStatus('error')
          }
        })
      }
    }, delay)
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status
    this.statusCallbacks.forEach(callback => callback(status))
  }
}

// Factory function to create appropriate sync implementation
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

// Offline storage for reconnection
export const saveOfflineVote = (sessionId: string, userId: string, vote: string | number): void => {
  const key = `offline_vote_${sessionId}_${userId}`
  const data = {
    vote,
    timestamp: Date.now()
  }
  localStorage.setItem(key, JSON.stringify(data))
}

export const getOfflineVote = (sessionId: string, userId: string): { vote: string | number; timestamp: number } | null => {
  const key = `offline_vote_${sessionId}_${userId}`
  const data = localStorage.getItem(key)
  if (!data) return null
  
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export const clearOfflineVote = (sessionId: string, userId: string): void => {
  const key = `offline_vote_${sessionId}_${userId}`
  localStorage.removeItem(key)
}

// Connection status hook for React components
export const useConnectionStatus = (realTimeSync: RealTimeSync | null) => {
  const [status, setStatus] = React.useState<ConnectionStatus>(realTimeSync?.status || 'disconnected')
  
  React.useEffect(() => {
    if (realTimeSync) {
      realTimeSync.onStatusChange(setStatus)
    }
  }, [realTimeSync])
  
  return status
} 