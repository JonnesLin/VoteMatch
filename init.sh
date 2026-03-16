#!/bin/bash
# VoteMatch — Idempotent development environment startup
# Run this at the start of every coding agent session.

set -e
cd "$(dirname "$0")"

echo "=== VoteMatch Dev Setup ==="

# 1. Install dependencies
echo "[1/4] Installing dependencies..."
npm install --silent

# 2. Generate Prisma client
echo "[2/4] Generating Prisma client..."
npx prisma generate

# 3. Check database connection (non-fatal — DB may not exist yet in early sessions)
echo "[3/4] Checking database connection..."
if npx prisma db push --accept-data-loss 2>/dev/null; then
  echo "  ✓ Database connected and schema synced"
else
  echo "  ⚠ Database not available — set DATABASE_URL in .env"
  echo "    For local dev: DATABASE_URL=postgresql://user:pass@localhost:5432/votematch"
fi

# 4. Start dev server
echo "[4/4] Starting Next.js dev server..."
npm run dev &
DEV_PID=$!
echo "  ✓ Dev server started (PID: $DEV_PID) on http://localhost:3000"

echo ""
echo "=== Ready. Read claude-progress.txt and feature_list.json before starting work. ==="
