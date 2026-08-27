# Stream Service

The real-time streaming service for Probstreet. This service manages live connections with frontend clients using WebSockets (Socket.io). It receives data from two main sources:

1. **Market Data Stream (Redis Pub/Sub):** Listens to the `stream:data` channel for events from the matching engine (e.g., price changes, executed trades) and routes them to the appropriate market Socket.io rooms.
2. **Internal Worker API (HTTP):** Exposes an internal, secured endpoint (`/api/v1/internal/notify`) that notification worker (like the notification-service) use to push direct, real-time alerts to a specific user's private WebSocket connection.

## Setup

1. Install dependencies from the workspace root.
2. Set up the `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Run the service:
   ```bash
   bun start
   ```

## Key Technologies

- **WebSockets:** Socket.io
- **Event Bus:** Redis Pub/Sub (`ioredis`)
- **Runtime:** Bun + Hono
