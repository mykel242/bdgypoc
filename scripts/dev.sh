#!/bin/bash
# Start both backend and frontend in development mode
echo "Starting Budgie Web Service Development..."
npx concurrently \
  "npx nodemon backend/server.js" \
  "cd frontend && npm run dev" \
  --names "API,WEB" \
  --prefix-colors "blue,green"
