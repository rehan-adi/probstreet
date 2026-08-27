#!/bin/bash

echo "Stopping all running processes for probstreet........"

pkill -f "make run"
pkill -f "bot_trading.ts"

echo "Freeing up ports for probstreet......."

lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
lsof -ti :1000 | xargs kill -9 2>/dev/null || true

echo "Killing specific service binaries..."

pkill -9 -f "matching-engine" || true
pkill -9 -f "exe/cmd" || true
pkill -9 -f "go-build.*/cmd" || true
pkill -9 -f "src/server.ts" || true
pkill -9 -f "processor-service" || true
pkill -9 -f "stream-service" || true
pm2 stop all 2>/dev/null || true

echo "Resetting Docker containers (Kafka, Redis, Zookeeper, PostgreSQL)........"
cd /Users/rehan/workspace/projects/probstreet
docker compose down -v
docker compose up -d
echo "Waiting for PostgreSQL to be ready..."
sleep 5

echo "Resetting PostgreSQL database........"
cd packages/database && bunx prisma db push --force-reset && cd ../..

echo "Configuring TimescaleDB (Hypertables & Continuous Aggregates)........"
psql "postgres://probstreet:probstreetadmin@localhost:5432/primary-database" -f packages/database/prisma/timescale_setup.sql

echo "Seeding database........"
cd packages/database && bun run db:seed && cd ../..

echo "Environment completely reset with TimescaleDB configured."

