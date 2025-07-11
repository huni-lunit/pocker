# Pocker Signaling Server

WebSocket signaling server for the Pocker planning poker application, providing real-time communication between players.

## Features

- Real-time WebSocket communication
- Session-based player management
- Vote tracking and revelation
- Automatic cleanup of stale connections and inactive sessions
- REST API for session management
- Health monitoring endpoint

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build Docker image
docker build -t pocker-signaling .

# Run container
docker run -p 8080:8080 pocker-signaling
```

## API Endpoints

### REST API

- `GET /health` - Health check endpoint
- `GET /sessions` - List all active sessions
- `POST /sessions` - Create a new session

### WebSocket Messages

The server accepts the following message types:

- `join` - Join a session
- `leave` - Leave a session  
- `sync_event` - Send a synchronization event
- `heartbeat` - Keep connection alive

## Environment Variables

- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production)

## Architecture

- **SessionManager** - Manages game sessions and voting rounds
- **PlayerManager** - Handles WebSocket connections and player state
- **Real-time Events** - Broadcasts events to all players in a session

## Supported Events

- `PLAYER_JOINED` - New player joins session
- `PLAYER_LEFT` - Player leaves session
- `VOTE_SUBMITTED` - Player submits vote
- `VOTING_STARTED` - New voting round begins
- `VOTES_REVEALED` - Votes are revealed to all players
- `SESSION_UPDATED` - Session state changes
- `PLAYER_RECONNECTED` - Player reconnects
- `PLAYER_DISCONNECTED` - Player loses connection 