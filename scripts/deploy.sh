#!/bin/bash
# VoteMatch — Production Deployment Script
# Prerequisites: vercel CLI installed, logged in (run `vercel login` first)

set -e
cd "$(dirname "$0")/.."

echo "=== VoteMatch Production Deployment ==="

# 1. Verify build
echo "[1/4] Verifying build..."
npx prisma generate
npm run build
npm run test

# 2. Link Vercel project (first time only — interactive)
if [ ! -d ".vercel" ]; then
  echo "[2/4] Linking Vercel project..."
  vercel link
else
  echo "[2/4] Vercel project already linked."
fi

# 3. Set production env vars (first time only)
echo "[3/4] Setting environment variables..."
echo "  Required variables: DATABASE_URL, REDIS_URL, GEMINI_API_KEY, JWT_SECRET"
echo "  Set them via: vercel env add DATABASE_URL production"
echo "  Or in Vercel Dashboard → Settings → Environment Variables"

# 4. Deploy
echo "[4/4] Deploying to production..."
vercel --prod

echo ""
echo "=== Deployment complete ==="
echo "Next steps:"
echo "  1. vercel env add DATABASE_URL production"
echo "  2. vercel env add REDIS_URL production"
echo "  3. vercel env add GEMINI_API_KEY production"
echo "  4. vercel env add JWT_SECRET production"
echo "  5. npx prisma db push (against production DATABASE_URL)"
echo "  6. vercel domains add your-domain.com"
