#!/bin/bash
# Start a local server for ColorCraft (required for Free mode)
PORT=8000
echo "Starting ColorCraft on http://localhost:$PORT"
echo "Press Ctrl+C to stop."
open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null
python3 -m http.server $PORT
