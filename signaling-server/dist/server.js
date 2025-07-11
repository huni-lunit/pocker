"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importStar(require("ws"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const uuid_1 = require("uuid");
const SessionManager_1 = require("./services/SessionManager");
const PlayerManager_1 = require("./services/PlayerManager");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Managers
const sessionManager = new SessionManager_1.SessionManager();
const playerManager = new PlayerManager_1.PlayerManager();
// REST endpoints for session management
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
app.get('/sessions', (req, res) => {
    const sessions = sessionManager.getAllSessions().map(session => ({
        id: session.id,
        name: session.name,
        playerCount: session.players.filter(p => p.isOnline).length,
        lastActivity: session.lastActivity
    }));
    res.json(sessions);
});
app.post('/sessions', (req, res) => {
    const { name, facilitatorId, facilitatorName } = req.body;
    if (!name || !facilitatorId || !facilitatorName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const session = sessionManager.createSession(name, facilitatorId, facilitatorName);
    res.json(session);
});
// WebSocket server
const wss = new ws_1.WebSocketServer({ server });
wss.on('connection', (ws) => {
    const connectionId = (0, uuid_1.v4)();
    logger_1.logger.info(`New WebSocket connection: ${connectionId}`);
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await handleMessage(connectionId, ws, message);
        }
        catch (error) {
            logger_1.logger.error('Failed to parse message:', error);
            sendError(ws, 'Invalid message format');
        }
    });
    ws.on('close', () => {
        const player = playerManager.removeConnection(connectionId);
        if (player) {
            logger_1.logger.info(`Player disconnected: ${player.userName} from session ${player.sessionId}`);
            // Mark player as offline
            sessionManager.removePlayerFromSession(player.sessionId, player.userId);
            // Notify other players
            broadcastToSession(player.sessionId, {
                type: 'sync_event',
                event: {
                    type: 'PLAYER_DISCONNECTED',
                    payload: { playerId: player.userId }
                },
                timestamp: Date.now()
            });
        }
    });
    ws.on('error', (error) => {
        logger_1.logger.error(`WebSocket error for ${connectionId}:`, error);
    });
    // Send initial heartbeat
    sendHeartbeat(ws);
});
async function handleMessage(connectionId, ws, message) {
    switch (message.type) {
        case 'join':
            await handleJoin(connectionId, ws, message);
            break;
        case 'sync_event':
            await handleSyncEvent(connectionId, message);
            break;
        case 'heartbeat':
            handleHeartbeat(connectionId, ws);
            break;
        case 'leave':
            await handleLeave(connectionId);
            break;
        default:
            logger_1.logger.warn(`Unknown message type: ${message.type}`);
            sendError(ws, 'Unknown message type');
    }
}
async function handleJoin(connectionId, ws, message) {
    const { sessionId, userId, userName } = message;
    if (!sessionId || !userId || !userName) {
        sendError(ws, 'Missing required fields for join');
        return;
    }
    // Add connection
    playerManager.addConnection(connectionId, ws, sessionId, userId, userName);
    // Get or create session
    let session = sessionManager.getSession(sessionId);
    if (!session) {
        logger_1.logger.warn(`Session ${sessionId} not found, player cannot join`);
        sendError(ws, 'Session not found');
        return;
    }
    // Add player to session
    const success = sessionManager.addPlayerToSession(sessionId, {
        id: userId,
        name: userName,
        isOnline: true
    });
    if (success) {
        session = sessionManager.getSession(sessionId);
        // Send success response
        const response = {
            type: 'joined',
            session,
            timestamp: Date.now()
        };
        ws.send(JSON.stringify(response));
        // Notify other players
        broadcastToSession(sessionId, {
            type: 'sync_event',
            event: {
                type: 'PLAYER_JOINED',
                payload: { player: session.players.find(p => p.id === userId) }
            },
            timestamp: Date.now()
        }, connectionId);
        logger_1.logger.info(`Player ${userName} joined session ${sessionId}`);
    }
    else {
        sendError(ws, 'Failed to join session');
    }
}
async function handleSyncEvent(connectionId, message) {
    const player = playerManager.getConnection(connectionId);
    if (!player || !message.event) {
        logger_1.logger.warn('Invalid sync event: no player or event');
        return;
    }
    const { sessionId } = player;
    const event = message.event;
    // Process event based on type
    switch (event.type) {
        case 'VOTE_SUBMITTED':
            const { playerId, vote } = event.payload;
            sessionManager.updatePlayerVote(sessionId, playerId, vote);
            break;
        case 'VOTING_STARTED':
            const { issueName } = event.payload;
            sessionManager.startVoting(sessionId, issueName);
            break;
        case 'VOTES_REVEALED':
            sessionManager.revealVotes(sessionId);
            break;
    }
    // Broadcast event to all players in session
    broadcastToSession(sessionId, {
        type: 'sync_event',
        event,
        timestamp: Date.now()
    });
    logger_1.logger.info(`Sync event ${event.type} from ${player.userName} in session ${sessionId}`);
}
function handleHeartbeat(connectionId, ws) {
    playerManager.updateHeartbeat(connectionId);
    const response = {
        type: 'heartbeat_ack',
        timestamp: Date.now()
    };
    ws.send(JSON.stringify(response));
}
async function handleLeave(connectionId) {
    const player = playerManager.removeConnection(connectionId);
    if (player) {
        sessionManager.removePlayerFromSession(player.sessionId, player.userId);
        broadcastToSession(player.sessionId, {
            type: 'sync_event',
            event: {
                type: 'PLAYER_LEFT',
                payload: { playerId: player.userId }
            },
            timestamp: Date.now()
        });
        logger_1.logger.info(`Player ${player.userName} left session ${player.sessionId}`);
    }
}
function broadcastToSession(sessionId, message, excludeConnectionId) {
    const connections = playerManager.getConnectionsBySession(sessionId);
    connections.forEach(player => {
        if (excludeConnectionId && player.ws === playerManager.getConnection(excludeConnectionId)?.ws) {
            return;
        }
        if (player.ws.readyState === ws_1.default.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}
function sendError(ws, message) {
    const response = {
        type: 'error',
        message,
        timestamp: Date.now()
    };
    ws.send(JSON.stringify(response));
}
function sendHeartbeat(ws) {
    const response = {
        type: 'heartbeat_ack',
        timestamp: Date.now()
    };
    ws.send(JSON.stringify(response));
}
// Cleanup intervals
setInterval(() => {
    const staleConnections = playerManager.cleanupStaleConnections();
    const inactiveSessions = sessionManager.cleanupInactiveSessions();
    if (staleConnections > 0 || inactiveSessions > 0) {
        logger_1.logger.info(`Cleaned up ${staleConnections} stale connections and ${inactiveSessions} inactive sessions`);
    }
}, 30000); // Run every 30 seconds
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    logger_1.logger.info(`Signaling server running on port ${PORT}`);
});
