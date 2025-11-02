#!/bin/bash
# Start both backend and frontend in development mode
echo "Starting Budgie Web Service Development..."
npx concurrently \
  "cd backend && npm run dev" \
  "cd frontend && npm run dev" \
  --names "API,WEB" \
  --prefix-colors "blue,green"
