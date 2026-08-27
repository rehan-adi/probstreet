# Notification Service

The background job worker responsible for processing and delivering all user notifications in Probstreet.

This service is designed as a Cloudflare Worker that consumes events (like `market.created`, `trade.executed`, and `price.alert`) and dispatches the appropriate notifications via Email (Brevo), Push (Firebase), and WebSocket (via Stream Service).

## Setup

1. Install dependencies from the workspace root.
2. Set up the `.env` file (if running locally):
   ```bash
   cp .env.example .env
   ```
3. Run the worker locally:
   ```bash
   bun dev
   ```

## Key Technologies

- **Runtime:** Cloudflare Workers (via Wrangler)
- **Email:** Brevo
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Validation:** Zod (Environment Variables)

## How It Works

The Notification Service is an event-driven worker with three primary triggers:

### 1. HTTP Endpoint (Synchronous Trigger)

The worker exposes a simple HTTP `POST` handler at its root. Other backend services (like `api-service` or `processor-service`) can push urgent events directly to this endpoint. The endpoint verifies the `x-worker-secret`, queues the work in the background (`ctx.waitUntil`), and instantly responds with `202 Accepted`.(Only for development)

### 2. Queue Handler (Asynchronous Processing)

In production, events will be pushed into a Cloudflare Queue. The worker consumes messages from this queue in batches, processing them asynchronously and retrying failures automatically.

### 3. Event Processing

When an event (e.g., `trade.executed`) is processed, the service:

- Initializes a Prisma Edge connection.
- Fetches user notification preferences.
- Evaluates if the user wants an Email, Push Notification, or In-App (WebSocket) alert.
- Triggers the appropriate third-party API (Brevo/Firebase) or hits the internal `stream-service` API.
