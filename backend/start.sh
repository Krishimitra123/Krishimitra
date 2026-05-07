#!/bin/bash
echo "Starting KrishiMitra Backend..."

# Kill any existing process on port 8000
PIDS=$(lsof -t -i :8000)
if [ ! -z "$PIDS" ]; then
    echo "Found existing processes on port 8000. Killing them..."
    kill -9 $PIDS
    sleep 1
fi

echo "Starting uvicorn server..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
