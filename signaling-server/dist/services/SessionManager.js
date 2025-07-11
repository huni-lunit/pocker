"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const uuid_1 = require("uuid");
class SessionManager {
    constructor() {
        this.sessions = new Map();
    }
    createSession(sessionName, facilitatorId, facilitatorName) {
        const session = {
            id: (0, uuid_1.v4)(),
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
        };
        this.sessions.set(session.id, session);
        return session;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    addPlayerToSession(sessionId, player) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const existingPlayerIndex = session.players.findIndex(p => p.id === player.id);
        if (existingPlayerIndex >= 0) {
            session.players[existingPlayerIndex] = { ...player, isOnline: true };
        }
        else {
            session.players.push({ ...player, isOnline: true });
        }
        session.lastActivity = new Date();
        return true;
    }
    removePlayerFromSession(sessionId, playerId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const playerIndex = session.players.findIndex(p => p.id === playerId);
        if (playerIndex >= 0) {
            session.players[playerIndex].isOnline = false;
        }
        session.lastActivity = new Date();
        return true;
    }
    updatePlayerVote(sessionId, playerId, vote) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.currentVote)
            return false;
        session.currentVote.votes[playerId] = vote;
        const player = session.players.find(p => p.id === playerId);
        if (player) {
            player.vote = vote;
            player.hasVoted = true;
        }
        session.lastActivity = new Date();
        return true;
    }
    startVoting(sessionId, issueName) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const votingRound = {
            id: (0, uuid_1.v4)(),
            issueName,
            votes: {},
            startTime: new Date(),
            isRevealed: false
        };
        session.currentVote = votingRound;
        session.players.forEach(player => {
            player.vote = undefined;
            player.hasVoted = false;
        });
        session.lastActivity = new Date();
        return votingRound;
    }
    revealVotes(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.currentVote)
            return false;
        session.currentVote.isRevealed = true;
        session.currentVote.endTime = new Date();
        // Calculate average
        const votes = Object.values(session.currentVote.votes).filter(v => typeof v === 'number');
        if (votes.length > 0) {
            session.currentVote.average = votes.reduce((sum, vote) => sum + vote, 0) / votes.length;
            session.currentVote.hasAgreement = votes.every(vote => vote === votes[0]);
        }
        session.history.push(session.currentVote);
        session.lastActivity = new Date();
        return true;
    }
    cleanupInactiveSessions(maxAge = 24 * 60 * 60 * 1000) {
        const now = new Date();
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now.getTime() - session.lastActivity.getTime() > maxAge) {
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }
        return cleaned;
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
}
exports.SessionManager = SessionManager;
