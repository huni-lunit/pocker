"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerManager = void 0;
const ws_1 = __importDefault(require("ws"));
class PlayerManager {
    constructor() {
        this.connections = new Map();
        this.userToConnection = new Map();
    }
    addConnection(connectionId, ws, sessionId, userId, userName) {
        const player = {
            ws,
            sessionId,
            userId,
            userName,
            lastHeartbeat: new Date()
        };
        this.connections.set(connectionId, player);
        this.userToConnection.set(`${sessionId}:${userId}`, connectionId);
    }
    removeConnection(connectionId) {
        const player = this.connections.get(connectionId);
        if (player) {
            this.connections.delete(connectionId);
            this.userToConnection.delete(`${player.sessionId}:${player.userId}`);
        }
        return player;
    }
    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }
    getConnectionsBySession(sessionId) {
        return Array.from(this.connections.values()).filter(player => player.sessionId === sessionId);
    }
    updateHeartbeat(connectionId) {
        const player = this.connections.get(connectionId);
        if (player) {
            player.lastHeartbeat = new Date();
            return true;
        }
        return false;
    }
    cleanupStaleConnections(maxAge = 30000) {
        const now = new Date();
        let cleaned = 0;
        for (const [connectionId, player] of this.connections.entries()) {
            if (now.getTime() - player.lastHeartbeat.getTime() > maxAge) {
                if (player.ws.readyState === ws_1.default.OPEN) {
                    player.ws.close();
                }
                this.removeConnection(connectionId);
                cleaned++;
            }
        }
        return cleaned;
    }
    getAllConnections() {
        return Array.from(this.connections.values());
    }
}
exports.PlayerManager = PlayerManager;
