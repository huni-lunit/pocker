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